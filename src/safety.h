#ifndef SAFETY_H
#define SAFETY_H

#include <Arduino.h>

// ============== Safety System Interface ==============

// Initialize the safety system
void safety_init();

// Update the safety system (call every loop)
// Returns true if everything is OK, false if a fault occurred
bool safety_update();

// Check if system is in a safe state
bool safety_is_ok();

// Get fault information
const char* safety_get_fault_code();
const char* safety_get_fault_message();
bool safety_is_fault_fatal();

// Clear the current fault (if any)
void safety_clear_fault();

// Manually trigger a fault
void safety_trigger_fault(const char* code, const char* message, bool fatal = true);

// ============== Individual Safety Checks ==============

// Check if chamber temperature is within limits
// Returns true if safe
bool safety_check_chamber_temp(float temp);

// Check if fan speed is adequate for heater operation
// Returns true if safe
bool safety_check_fan_for_heater(uint8_t fan_percent, bool heater_on);

// Check thermocouple for faults
// Returns true if no faults
bool safety_check_thermocouple();

#endif // SAFETY_H
