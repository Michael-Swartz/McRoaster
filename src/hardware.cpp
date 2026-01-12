#include "hardware.h"
#include "config.h"
#include "serial_comm.h"
#include <SPI.h>

// ============== Internal State ==============

// Fan state
static bool _fan_enabled = false;
static uint8_t _fan_speed = 0;  // 0-100%

// Debug: track actual PWM value written
static uint8_t _fan_pwm_written = 0;

// Heater state
static bool _heater_enabled = false;
static uint8_t _heater_power = 0;    // 0-100% for display
static float _heater_pid_output = 0; // 0-255 from PID
static unsigned long _heater_window_start = 0;

// Thermocouple state
static uint8_t _thermo_fault = 0;
static float _filtered_temp = 0;
static bool _filter_initialized = false;

// Rate of Rise state
static float _ror_last_temp = 0;
static unsigned long _ror_last_time = 0;
static float _ror_value = 0;

// ============== Initialization ==============

void hardware_init() {
    serial_send_log("info", "HW", "Hardware init starting");

    // Initialize SPI for MAX31855
    pinMode(PIN_THERMO_CS, OUTPUT);
    digitalWrite(PIN_THERMO_CS, HIGH);
    SPI.begin();
    serial_send_log("debug", "HW", "SPI initialized for thermocouple");

    // Initialize fan pins (L298N)
    char msg[64];
    snprintf(msg, sizeof(msg), "Fan pins: ENA=%d IN1=%d IN2=%d", PIN_FAN_ENA, PIN_FAN_IN1, PIN_FAN_IN2);
    serial_send_log("debug", "HW", msg);

    pinMode(PIN_FAN_ENA, OUTPUT);
    pinMode(PIN_FAN_IN1, OUTPUT);
    pinMode(PIN_FAN_IN2, OUTPUT);

    // Start with fan off
    digitalWrite(PIN_FAN_IN1, LOW);
    digitalWrite(PIN_FAN_IN2, LOW);
    analogWrite(PIN_FAN_ENA, 0);
    _fan_pwm_written = 0;

    serial_send_log("debug", "HW", "Fan pins configured, initial state LOW");

    // Initialize heater SSR pin
    pinMode(PIN_HEATER_SSR, OUTPUT);
    digitalWrite(PIN_HEATER_SSR, LOW);
    snprintf(msg, sizeof(msg), "Heater SSR pin %d configured", PIN_HEATER_SSR);
    serial_send_log("debug", "HW", msg);

    // Initialize thermistor pin
    pinMode(PIN_THERMISTOR, INPUT);

    // Initialize heater window
    _heater_window_start = millis();

    serial_send_log("info", "HW", "Hardware init complete");
}

// ============== Fan Control ==============

void fan_enable() {
    _fan_enabled = true;
    // Set direction (forward)
    digitalWrite(PIN_FAN_IN1, HIGH);
    digitalWrite(PIN_FAN_IN2, LOW);
    // Apply current speed
    uint8_t pwm = map(_fan_speed, 0, 100, 0, 255);
    analogWrite(PIN_FAN_ENA, pwm);
    _fan_pwm_written = pwm;

    char msg[64];
    snprintf(msg, sizeof(msg), "Fan enabled at %d%% (PWM=%d)", _fan_speed, pwm);
    serial_send_log("info", "HW", msg);
}

void fan_disable() {
    _fan_enabled = false;
    digitalWrite(PIN_FAN_IN1, LOW);
    digitalWrite(PIN_FAN_IN2, LOW);
    analogWrite(PIN_FAN_ENA, 0);
    _fan_pwm_written = 0;
    serial_send_log("info", "HW", "Fan disabled");
}

void fan_set_speed(uint8_t percent) {
    if (percent > 100) percent = 100;
    _fan_speed = percent;

    char msg[64];
    if (_fan_enabled) {
        uint8_t pwm = map(percent, 0, 100, 0, 255);
        analogWrite(PIN_FAN_ENA, pwm);
        _fan_pwm_written = pwm;
        snprintf(msg, sizeof(msg), "Fan speed set to %d%% (PWM=%d)", percent, pwm);
    } else {
        snprintf(msg, sizeof(msg), "Fan speed set to %d%% (pending - fan disabled)", percent);
    }
    serial_send_log("debug", "HW", msg);
}

uint8_t fan_get_speed() {
    return _fan_speed;
}

bool fan_is_enabled() {
    return _fan_enabled;
}

void fan_debug_dump() {
    char msg[128];
    serial_send_log("debug", "HW", "=== FAN DEBUG DUMP ===");
    snprintf(msg, sizeof(msg), "Fan enabled: %s, speed: %d%%, PWM written: %d",
             _fan_enabled ? "YES" : "NO", _fan_speed, _fan_pwm_written);
    serial_send_log("debug", "HW", msg);
    snprintf(msg, sizeof(msg), "Pins: ENA=%d IN1=%d IN2=%d", PIN_FAN_ENA, PIN_FAN_IN1, PIN_FAN_IN2);
    serial_send_log("debug", "HW", msg);

    // Force write to pins
    serial_send_log("debug", "HW", "Forcing pin writes...");
    if (_fan_enabled) {
        digitalWrite(PIN_FAN_IN1, HIGH);
        digitalWrite(PIN_FAN_IN2, LOW);
        analogWrite(PIN_FAN_ENA, _fan_pwm_written);
        serial_send_log("debug", "HW", "Wrote: IN1=HIGH, IN2=LOW, ENA=PWM");
    } else {
        digitalWrite(PIN_FAN_IN1, LOW);
        digitalWrite(PIN_FAN_IN2, LOW);
        analogWrite(PIN_FAN_ENA, 0);
        serial_send_log("debug", "HW", "Wrote: IN1=LOW, IN2=LOW, ENA=0");
    }
}

void fan_test_direct() {
    // Direct pin test - bypasses all state management
    serial_send_log("warn", "HW", "Direct pin test starting - 5 second hold");

    // Force pins as outputs again
    pinMode(PIN_FAN_ENA, OUTPUT);
    pinMode(PIN_FAN_IN1, OUTPUT);
    pinMode(PIN_FAN_IN2, OUTPUT);

    // Set all HIGH
    digitalWrite(PIN_FAN_IN1, HIGH);
    digitalWrite(PIN_FAN_IN2, HIGH);
    analogWrite(PIN_FAN_ENA, 255);

    serial_send_log("debug", "HW", "Pins set HIGH for 5 seconds");

    delay(5000);

    // Restore to safe state
    digitalWrite(PIN_FAN_IN1, LOW);
    digitalWrite(PIN_FAN_IN2, LOW);
    analogWrite(PIN_FAN_ENA, 0);

    serial_send_log("info", "HW", "Direct pin test complete");
}

// ============== Heater Control ==============

void heater_enable() {
    _heater_enabled = true;
    _heater_window_start = millis();
    serial_send_log("info", "HW", "Heater enabled");
}

void heater_disable() {
    _heater_enabled = false;
    _heater_pid_output = 0;
    _heater_power = 0;
    digitalWrite(PIN_HEATER_SSR, LOW);
    serial_send_log("info", "HW", "Heater disabled");
}

void heater_set_power(uint8_t percent) {
    if (percent > 100) percent = 100;
    _heater_power = percent;
    // Convert percentage to PID output scale (0-255)
    _heater_pid_output = map(percent, 0, 100, 0, 255);

    char msg[48];
    snprintf(msg, sizeof(msg), "Heater power set to %d%%", percent);
    serial_send_log("debug", "HW", msg);
}

void heater_set_pid_output(float output) {
    if (output < 0) output = 0;
    if (output > 255) output = 255;
    _heater_pid_output = output;
    // Update percentage for display
    _heater_power = map((int)output, 0, 255, 0, 100);
}

void heater_update() {
    if (!_heater_enabled) {
        digitalWrite(PIN_HEATER_SSR, LOW);
        return;
    }

    // Time-proportioning PWM for SSR
    unsigned long now = millis();
    unsigned long windowTime = now - _heater_window_start;

    // Reset window if needed
    if (windowTime >= PID_WINDOW_SIZE_MS) {
        _heater_window_start = now;
        windowTime = 0;
    }

    // Calculate on-time from PID output
    unsigned long onTime = map((int)_heater_pid_output, 0, 255, 0, PID_WINDOW_SIZE_MS);

    // Set SSR state based on window position
    if (windowTime < onTime) {
        digitalWrite(PIN_HEATER_SSR, HIGH);
    } else {
        digitalWrite(PIN_HEATER_SSR, LOW);
    }
}

uint8_t heater_get_power() {
    return _heater_power;
}

bool heater_is_enabled() {
    return _heater_enabled;
}

// ============== Thermocouple Reading ==============

static uint32_t _read_max31855_raw() {
    uint32_t data = 0;

    digitalWrite(PIN_THERMO_CS, LOW);
    delayMicroseconds(100);

    SPI.beginTransaction(SPISettings(500000, MSBFIRST, SPI_MODE0));

    uint8_t b0 = SPI.transfer(0x00);
    uint8_t b1 = SPI.transfer(0x00);
    uint8_t b2 = SPI.transfer(0x00);
    uint8_t b3 = SPI.transfer(0x00);

    SPI.endTransaction();

    digitalWrite(PIN_THERMO_CS, HIGH);

    data = ((uint32_t)b0 << 24) | ((uint32_t)b1 << 16) | ((uint32_t)b2 << 8) | b3;

    return data;
}

float thermocouple_read() {
    uint32_t raw1 = _read_max31855_raw();
    delayMicroseconds(100);
    uint32_t raw2 = _read_max31855_raw();

    uint32_t raw = raw1;
    if ((raw1 & 0x10007) != (raw2 & 0x10007)) {
        delayMicroseconds(100);
        raw = _read_max31855_raw();
    }

    if (raw & 0x10000) {
        _thermo_fault = raw & 0x07;
        return NAN;
    }

    _thermo_fault = 0;

    int16_t temp14 = (raw >> 18) & 0x3FFF;
    if (temp14 & 0x2000) {
        temp14 |= 0xC000;
    }

    return temp14 * 0.25;
}

uint8_t thermocouple_get_fault() {
    return _thermo_fault;
}

float thermocouple_read_cold_junction() {
    uint32_t raw = _read_max31855_raw();

    int16_t temp12 = (raw >> 4) & 0x0FFF;
    if (temp12 & 0x800) {
        temp12 |= 0xF000;
    }

    return temp12 * 0.0625;
}

float thermocouple_read_filtered() {
    float raw = thermocouple_read();

    if (isnan(raw)) {
        return _filtered_temp;
    }

    if (!_filter_initialized) {
        _filtered_temp = raw;
        _filter_initialized = true;
        return raw;
    }

    _filtered_temp = (LPF_ALPHA * raw) + ((1.0 - LPF_ALPHA) * _filtered_temp);
    return _filtered_temp;
}

void thermocouple_reset_filter() {
    _filter_initialized = false;
    _filtered_temp = 0;
}

// ============== Thermistor Reading ==============

float thermistor_read() {
    int adcValue = analogRead(PIN_THERMISTOR);

    if (adcValue == 0) return 999.0;

    float voltage = (adcValue / 1023.0) * THERMISTOR_VCC;

    if (voltage <= 0) return 999.0;

    float resistance = THERMISTOR_R1 * (THERMISTOR_VCC / voltage - 1.0);

    if (resistance <= 0) return 999.0;

    float tempK = 1.0 / (1.0 / THERMISTOR_T0 + (1.0 / THERMISTOR_BETA) * log(resistance / THERMISTOR_R0));
    float tempC = tempK - 273.15;

    return tempC;
}

// ============== Rate of Rise ==============

float calculate_ror() {
    float current_temp = thermocouple_read_filtered();
    unsigned long current_time = millis();

    if (_ror_last_time == 0) {
        _ror_last_temp = current_temp;
        _ror_last_time = current_time;
        return 0;
    }

    unsigned long elapsed = current_time - _ror_last_time;
    if (elapsed >= ROR_SAMPLE_INTERVAL_MS) {
        float delta_temp = current_temp - _ror_last_temp;
        float delta_minutes = elapsed / 60000.0;

        _ror_value = delta_temp / delta_minutes;

        _ror_last_temp = current_temp;
        _ror_last_time = current_time;
    }

    return _ror_value;
}

void reset_ror() {
    _ror_last_temp = 0;
    _ror_last_time = 0;
    _ror_value = 0;
}
