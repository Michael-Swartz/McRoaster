#ifndef STATE_H
#define STATE_H

#include <Arduino.h>

// ============== State Enumeration ==============
enum class RoasterState {
    OFF = 0,
    FAN_ONLY = 1,   // Fan running, heater disabled - for pre-warming beans or testing
    PREHEAT = 2,
    ROASTING = 3,
    COOLING = 4,
    MANUAL = 5,
    ERROR = 6
};

// ============== Event Enumeration ==============
enum class RoasterEvent {
    NONE = 0,
    STOP,
    START_FAN_ONLY,     // Enter fan-only mode from OFF
    EXIT_FAN_ONLY,      // Exit fan-only mode to OFF
    START_PREHEAT,
    LOAD_BEANS,
    END_ROAST,
    FIRST_CRACK,
    COOL_COMPLETE,
    ENTER_MANUAL,
    EXIT_MANUAL,
    FAULT,
    CLEAR_FAULT,
    SET_SETPOINT,
    SET_FAN_SPEED,
    SET_HEATER_POWER,
    DISCONNECTED
};

// ============== State Machine Interface ==============

// Initialize the state machine
void state_init();

// Update the state machine (call every loop iteration)
void state_update();

// Handle an event with optional value parameter
void state_handle_event(RoasterEvent event, float value = 0);

// Get current state
RoasterState state_get_current();

// Get state name as string
const char* state_get_name(RoasterState state);

// ============== State Data Accessors ==============

// Temperature setpoint (°C)
float state_get_setpoint();
void state_set_setpoint(float setpoint);

// Preheat target temperature (°C)
float state_get_preheat_target();
void state_set_preheat_target(float target);

// Fan speed (0-100%)
uint8_t state_get_fan_speed();

// Heater power (0-100%)
uint8_t state_get_heater_power();

// Roast timing
uint32_t state_get_roast_time_ms();
bool state_is_first_crack_marked();
uint32_t state_get_first_crack_time_ms();

// Error information
const char* state_get_error_code();
const char* state_get_error_message();
bool state_is_error_fatal();

// PID status
bool state_is_pid_enabled();

// Check if state allows parameter changes
bool state_allows_setpoint_change();
bool state_allows_fan_change();
bool state_allows_heater_change();

#endif // STATE_H
