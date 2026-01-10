#ifndef PID_CONTROL_H
#define PID_CONTROL_H

#include <Arduino.h>

// ============== PID Controller Interface ==============

// Initialize the PID controller
void pid_init();

// Set the target setpoint temperature (°C)
void pid_set_setpoint(float setpoint);
float pid_get_setpoint();

// Set PID tuning parameters
void pid_set_tunings(float kp, float ki, float kd);

// Use aggressive tuning (for large errors)
void pid_set_aggressive_tunings();

// Use conservative tuning (for small errors)
void pid_set_conservative_tunings();

// Update the PID calculation with current temperature
// Call this every loop iteration when PID is enabled
void pid_update(float current_temp);

// Get the current PID output (0-255)
float pid_get_output();

// Reset the PID controller (clears integral term)
void pid_reset();

// Enable/disable PID control
void pid_enable();
void pid_disable();
bool pid_is_enabled();

// Automatically select tuning based on error magnitude
// Uses aggressive tuning when error > PID_THRESHOLD
// Uses conservative tuning when error <= PID_THRESHOLD
void pid_auto_tune(float current_temp);

// Get current tuning parameters (for debugging)
float pid_get_kp();
float pid_get_ki();
float pid_get_kd();

#endif // PID_CONTROL_H
