#ifndef CONFIG_H
#define CONFIG_H

// ============== Pin Definitions ==============

// MAX31855 Thermocouple (SPI)
#define PIN_THERMO_CS   10    // Chip select pin
// Uses hardware SPI: MISO (Pin 12), SCK (Pin 13)

// Thermistor Safety Monitor
#define PIN_THERMISTOR  A1    // Heater safety thermistor

// L298N Motor Driver (Blower Fan)
#define PIN_FAN_ENA     9     // PWM for fan speed
#define PIN_FAN_IN1     8     // Direction control
#define PIN_FAN_IN2     7     // Direction control

// SSR Heater Control
#define PIN_HEATER_SSR  6     // SSR control (PWM/digital)

// ============== Thermistor Constants ==============
#define THERMISTOR_VCC          5.0       // Supply voltage
#define THERMISTOR_R1           100000.0  // Fixed resistor (100kΩ)
#define THERMISTOR_R0           100000.0  // Thermistor resistance at 25°C
#define THERMISTOR_T0           298.15    // 25°C in Kelvin
#define THERMISTOR_BETA         3950.0    // Beta coefficient

// ============== PID Tuning ==============
// Aggressive tuning - used when far from setpoint (> PID_THRESHOLD)
#define PID_KP_AGGRESSIVE       120.0
#define PID_KI_AGGRESSIVE       30.0
#define PID_KD_AGGRESSIVE       60.0

// Conservative tuning - used when near setpoint (<= PID_THRESHOLD)
#define PID_KP_CONSERVATIVE     70.0
#define PID_KI_CONSERVATIVE     15.0
#define PID_KD_CONSERVATIVE     10.0

// Distance from setpoint to switch tuning modes (°C)
#define PID_THRESHOLD           10.0

// PID output limits
#define PID_OUTPUT_MIN          0.0
#define PID_OUTPUT_MAX          255.0

// ============== Safety Limits ==============
#define MAX_CHAMBER_TEMP        260.0     // °C - absolute max chamber temp
#define WARN_CHAMBER_TEMP       250.0     // °C - warning threshold
#define MIN_FAN_WHEN_HEATING    40        // % - minimum fan when heater enabled

// ============== Temperature Targets ==============
#define DEFAULT_PREHEAT_TEMP    180.0     // °C - default preheat target
#define DEFAULT_ROAST_SETPOINT  200.0     // °C - default roast setpoint
#define COOLING_TARGET_TEMP     50.0      // °C - temp to consider cooling complete

// ============== Timing ==============
#define TEMP_READ_INTERVAL_MS   1000      // Read temperature every 1 second
#define STATE_SEND_INTERVAL_MS  1000      // Send state update every 1 second
#define PREHEAT_TIMEOUT_MS      900000    // 15 minutes max preheat time
#define PID_WINDOW_SIZE_MS      2000      // 2 second PWM window for heater
#define DISCONNECT_TIMEOUT_MS   5000      // 5 seconds before auto-cooling on disconnect
#define COMMAND_COOLDOWN_MS     100       // Minimum time between commands

// ============== Fan Limits ==============
#define FAN_MIN_DUTY            0         // % - minimum fan speed
#define FAN_MAX_DUTY            100       // % - maximum fan speed
#define FAN_PREHEAT_DUTY        50        // % - during preheat (was 60)
#define FAN_ROAST_DEFAULT       90        // % - default for roasting state
#define FAN_COOLING_DUTY        100       // % - during cooling (max)
#define FAN_ROAST_MIN_DUTY      30        // % - minimum while roasting

// ============== Temperature Filtering ==============
#define LPF_ALPHA               0.15      // Low-pass filter coefficient (0.0-1.0)
                                          // Lower = smoother, slower response

// ============== Rate of Rise ==============
#define ROR_SAMPLE_INTERVAL_MS  30000     // 30 seconds between RoR calculations

// ============== Firmware ==============
#define FIRMWARE_VERSION        "3.0.0"   // WebSerial version

#endif // CONFIG_H
