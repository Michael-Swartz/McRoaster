#ifndef HARDWARE_H
#define HARDWARE_H

#include <Arduino.h>

// ============== Initialization ==============
void hardware_init();

// ============== Fan Control ==============
void fan_enable();
void fan_disable();
void fan_set_speed(uint8_t percent);  // 0-100
uint8_t fan_get_speed();
bool fan_is_enabled();

// ============== Heater Control ==============
void heater_enable();
void heater_disable();
void heater_set_power(uint8_t percent);  // 0-100 (for manual mode)
void heater_update();                     // Call in loop for time-proportioning
uint8_t heater_get_power();
bool heater_is_enabled();

// Set the PID output value (0-255) which heater_update() will use
void heater_set_pid_output(float output);

// ============== Temperature Reading ==============
// Raw thermocouple reading (°C or NAN on error)
float thermocouple_read();

// Get fault code from last thermocouple read (0 = no fault)
// Bit 0: Open circuit, Bit 1: Short to GND, Bit 2: Short to VCC
uint8_t thermocouple_get_fault();

// Cold junction temperature (internal reference)
float thermocouple_read_cold_junction();

// Low-pass filtered thermocouple reading
float thermocouple_read_filtered();
void thermocouple_reset_filter();

// Thermistor reading for heater safety (°C)
float thermistor_read();

// ============== Rate of Rise ==============
// Returns rate of temperature change in °C/min
// Returns 0 if not enough time has elapsed since last sample
float calculate_ror();
void reset_ror();

#endif // HARDWARE_H
