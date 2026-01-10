#include "hardware.h"
#include "config.h"
#include <SPI.h>

// ============== Internal State ==============

// Fan state
static bool _fan_enabled = false;
static uint8_t _fan_speed = 0;  // 0-100%

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
    // Initialize SPI pins for MAX31855
    pinMode(PIN_THERMO_CS, OUTPUT);
    digitalWrite(PIN_THERMO_CS, HIGH);
    pinMode(SCK, OUTPUT);
    pinMode(MISO, INPUT);
    
    // Initialize fan pins (L298N)
    pinMode(PIN_FAN_ENA, OUTPUT);
    pinMode(PIN_FAN_IN1, OUTPUT);
    pinMode(PIN_FAN_IN2, OUTPUT);
    
    // Start with fan off
    digitalWrite(PIN_FAN_IN1, LOW);
    digitalWrite(PIN_FAN_IN2, LOW);
    analogWrite(PIN_FAN_ENA, 0);
    
    // Initialize heater SSR pin
    pinMode(PIN_HEATER_SSR, OUTPUT);
    digitalWrite(PIN_HEATER_SSR, LOW);
    
    // Initialize thermistor pin
    pinMode(PIN_THERMISTOR, INPUT);
    
    // Initialize heater window
    _heater_window_start = millis();
    
    Serial.println("[HW] Hardware initialized");
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
    Serial.print("[HW] Fan enabled at ");
    Serial.print(_fan_speed);
    Serial.println("%");
}

void fan_disable() {
    _fan_enabled = false;
    digitalWrite(PIN_FAN_IN1, LOW);
    digitalWrite(PIN_FAN_IN2, LOW);
    analogWrite(PIN_FAN_ENA, 0);
    Serial.println("[HW] Fan disabled");
}

void fan_set_speed(uint8_t percent) {
    if (percent > 100) percent = 100;
    _fan_speed = percent;
    
    if (_fan_enabled) {
        uint8_t pwm = map(percent, 0, 100, 0, 255);
        analogWrite(PIN_FAN_ENA, pwm);
    }
    
    Serial.print("[HW] Fan speed set to ");
    Serial.print(percent);
    Serial.println("%");
}

uint8_t fan_get_speed() {
    return _fan_speed;
}

bool fan_is_enabled() {
    return _fan_enabled;
}

// ============== Heater Control ==============

void heater_enable() {
    _heater_enabled = true;
    _heater_window_start = millis();
    Serial.println("[HW] Heater enabled");
}

void heater_disable() {
    _heater_enabled = false;
    _heater_pid_output = 0;
    _heater_power = 0;
    digitalWrite(PIN_HEATER_SSR, LOW);
    Serial.println("[HW] Heater disabled");
}

void heater_set_power(uint8_t percent) {
    if (percent > 100) percent = 100;
    _heater_power = percent;
    // Convert percentage to PID output scale (0-255)
    _heater_pid_output = map(percent, 0, 100, 0, 255);
    Serial.print("[HW] Heater power set to ");
    Serial.print(percent);
    Serial.println("%");
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
    // This creates a slow PWM suitable for SSR control
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
    delayMicroseconds(1);
    
    // Read 32 bits via bit-banging
    for (int i = 31; i >= 0; i--) {
        digitalWrite(SCK, HIGH);
        delayMicroseconds(1);
        if (digitalRead(MISO)) {
            data |= ((uint32_t)1 << i);
        }
        digitalWrite(SCK, LOW);
        delayMicroseconds(1);
    }
    
    digitalWrite(PIN_THERMO_CS, HIGH);
    return data;
}

float thermocouple_read() {
    uint32_t raw = _read_max31855_raw();
    
    // Check for faults (bit 16)
    if (raw & 0x10000) {
        _thermo_fault = raw & 0x07;  // Fault bits are in lower 3 bits
        return NAN;
    }
    
    _thermo_fault = 0;
    
    // Extract thermocouple temperature (bits 31-18, signed 14-bit)
    int16_t temp14 = (raw >> 18) & 0x3FFF;
    if (temp14 & 0x2000) {  // Sign bit set
        temp14 |= 0xC000;   // Sign extend
    }
    
    // Resolution is 0.25°C
    return temp14 * 0.25;
}

uint8_t thermocouple_get_fault() {
    return _thermo_fault;
}

float thermocouple_read_cold_junction() {
    uint32_t raw = _read_max31855_raw();
    
    // Extract cold junction temp (bits 15-4, signed 12-bit)
    int16_t temp12 = (raw >> 4) & 0x0FFF;
    if (temp12 & 0x800) {  // Sign bit set
        temp12 |= 0xF000;  // Sign extend
    }
    
    // Resolution is 0.0625°C
    return temp12 * 0.0625;
}

float thermocouple_read_filtered() {
    float raw = thermocouple_read();
    
    // If fault, return last good value
    if (isnan(raw)) {
        return _filtered_temp;
    }
    
    // Initialize filter on first valid reading
    if (!_filter_initialized) {
        _filtered_temp = raw;
        _filter_initialized = true;
        return raw;
    }
    
    // Exponential moving average (low-pass filter)
    _filtered_temp = (LPF_ALPHA * raw) + ((1.0 - LPF_ALPHA) * _filtered_temp);
    return _filtered_temp;
}

void thermocouple_reset_filter() {
    _filter_initialized = false;
    _filtered_temp = 0;
}

// ============== Thermistor Reading ==============

float thermistor_read() {
    // Read analog value (0-1023 on 10-bit ADC)
    int adcValue = analogRead(PIN_THERMISTOR);
    
    // Prevent division by zero
    if (adcValue == 0) return 999.0;
    
    // Convert to voltage
    float voltage = (adcValue / 1023.0) * THERMISTOR_VCC;
    
    // Prevent division by zero
    if (voltage <= 0) return 999.0;
    
    // Calculate thermistor resistance
    // Using voltage divider: Vout = Vin * (RT / (R1 + RT))
    // Solved for RT: RT = R1 * (Vin / Vout - 1)
    float resistance = THERMISTOR_R1 * (THERMISTOR_VCC / voltage - 1.0);
    
    // Prevent invalid calculation
    if (resistance <= 0) return 999.0;
    
    // Calculate temperature using Steinhart-Hart Beta formula
    // 1/T = 1/T0 + (1/β) * ln(R/R0)
    float tempK = 1.0 / (1.0 / THERMISTOR_T0 + (1.0 / THERMISTOR_BETA) * log(resistance / THERMISTOR_R0));
    float tempC = tempK - 273.15;
    
    return tempC;
}

// ============== Rate of Rise ==============

float calculate_ror() {
    float current_temp = thermocouple_read_filtered();
    unsigned long current_time = millis();
    
    // Initialize on first call
    if (_ror_last_time == 0) {
        _ror_last_temp = current_temp;
        _ror_last_time = current_time;
        return 0;
    }
    
    // Check if enough time has elapsed
    unsigned long elapsed = current_time - _ror_last_time;
    if (elapsed >= ROR_SAMPLE_INTERVAL_MS) {
        float delta_temp = current_temp - _ror_last_temp;
        float delta_minutes = elapsed / 60000.0;
        
        _ror_value = delta_temp / delta_minutes;  // °C/min
        
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
