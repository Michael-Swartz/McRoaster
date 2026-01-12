#include "state.h"
#include "config.h"
#include "hardware.h"
#include "pid_control.h"
#include "safety.h"
#include "serial_comm.h"

// ============== Internal State ==============

static RoasterState _current_state = RoasterState::OFF;

// Temperature settings
static float _setpoint = DEFAULT_ROAST_SETPOINT;
static float _preheat_target = DEFAULT_PREHEAT_TEMP;

// Timing
static unsigned long _roast_start_time = 0;
static unsigned long _preheat_start_time = 0;
static bool _first_crack_marked = false;
static unsigned long _first_crack_time = 0;

// Error state
static char _error_code[32] = "";
static char _error_message[128] = "";
static bool _error_fatal = false;

// Manual mode settings
static uint8_t _manual_fan_speed = 50;
static uint8_t _manual_heater_power = 0;

// Fan-only mode settings
static uint8_t _fan_only_speed = 50;

// ============== Forward Declarations ==============
static void _enter_state(RoasterState new_state);
static void _exit_state(RoasterState old_state);

// ============== State Machine Interface ==============

void state_init() {
    _current_state = RoasterState::OFF;
    _setpoint = DEFAULT_ROAST_SETPOINT;
    _preheat_target = DEFAULT_PREHEAT_TEMP;
    _roast_start_time = 0;
    _preheat_start_time = 0;
    _first_crack_marked = false;
    _first_crack_time = 0;
    _error_code[0] = '\0';
    _error_message[0] = '\0';
    _error_fatal = false;
    
    // Ensure outputs are off
    fan_disable();
    heater_disable();
    
    serial_send_log("info", "STATE", "State machine initialized - OFF");
}

void state_update() {
    // Read current temperature
    float chamber_temp = thermocouple_read_filtered();
    
    // State-specific updates
    switch (_current_state) {
        case RoasterState::OFF:
            // Nothing to do in OFF state
            break;

        case RoasterState::FAN_ONLY:
            // Fan running, heater MUST stay off
            // Nothing else to update - fan speed is set directly
            break;

        case RoasterState::PREHEAT:
            // Run PID to reach preheat temperature
            pid_update(chamber_temp);
            heater_set_pid_output(pid_get_output());
            heater_update();
            
            // Check for preheat timeout
            if (millis() - _preheat_start_time > PREHEAT_TIMEOUT_MS) {
                safety_trigger_fault("PREHEAT_TIMEOUT", "Preheat exceeded 15 minute limit", true);
            }
            break;
            
        case RoasterState::ROASTING:
            // Run PID to maintain setpoint
            pid_update(chamber_temp);
            heater_set_pid_output(pid_get_output());
            heater_update();
            break;
            
        case RoasterState::COOLING:
            // Check if cooling is complete
            if (chamber_temp < COOLING_TARGET_TEMP) {
                state_handle_event(RoasterEvent::COOL_COMPLETE);
            }
            break;
            
        case RoasterState::MANUAL:
            // In manual mode, heater is directly controlled
            heater_update();
            break;
            
        case RoasterState::ERROR:
            // Ensure outputs stay off in error state
            // (already handled by _enter_state)
            break;
    }
}

void state_handle_event(RoasterEvent event, float value) {
    char msg[64];
    snprintf(msg, sizeof(msg), "Event: %d in state: %s", (int)event, state_get_name(_current_state));
    serial_send_log("debug", "STATE", msg);
    
    switch (event) {
        case RoasterEvent::STOP:
            if (_current_state != RoasterState::OFF && _current_state != RoasterState::ERROR) {
                _enter_state(RoasterState::OFF);
            }
            break;
            
        case RoasterEvent::START_FAN_ONLY:
            if (_current_state == RoasterState::OFF) {
                if (value > 0 && value <= 100) {
                    _fan_only_speed = (uint8_t)value;
                }
                _enter_state(RoasterState::FAN_ONLY);
            }
            break;

        case RoasterEvent::EXIT_FAN_ONLY:
            if (_current_state == RoasterState::FAN_ONLY) {
                _enter_state(RoasterState::OFF);
            }
            break;

        case RoasterEvent::START_PREHEAT:
            // Can start preheat from OFF or FAN_ONLY
            if (_current_state == RoasterState::OFF || _current_state == RoasterState::FAN_ONLY) {
                if (value > 0) {
                    _preheat_target = value;
                }
                _enter_state(RoasterState::PREHEAT);
            }
            break;
            
        case RoasterEvent::LOAD_BEANS:
            if (_current_state == RoasterState::PREHEAT) {
                if (value > 0) {
                    _setpoint = value;
                }
                _enter_state(RoasterState::ROASTING);
            }
            break;
            
        case RoasterEvent::END_ROAST:
            if (_current_state == RoasterState::ROASTING) {
                _enter_state(RoasterState::COOLING);
            }
            break;
            
        case RoasterEvent::FIRST_CRACK:
            if (_current_state == RoasterState::ROASTING && !_first_crack_marked) {
                _first_crack_marked = true;
                _first_crack_time = millis() - _roast_start_time;
                char msg[64];
                snprintf(msg, sizeof(msg), "First crack marked at %lu seconds", _first_crack_time / 1000);
                serial_send_log("info", "STATE", msg);
            }
            break;
            
        case RoasterEvent::COOL_COMPLETE:
            if (_current_state == RoasterState::COOLING) {
                _enter_state(RoasterState::OFF);
            }
            break;
            
        case RoasterEvent::ENTER_MANUAL:
            if (_current_state == RoasterState::OFF) {
                _enter_state(RoasterState::MANUAL);
            }
            break;
            
        case RoasterEvent::EXIT_MANUAL:
            if (_current_state == RoasterState::MANUAL) {
                _enter_state(RoasterState::OFF);
            }
            break;
            
        case RoasterEvent::FAULT:
            // Handled by safety module via safety_trigger_fault()
            break;
            
        case RoasterEvent::CLEAR_FAULT:
            if (_current_state == RoasterState::ERROR) {
                safety_clear_fault();
                _error_code[0] = '\0';
                _error_message[0] = '\0';
                _error_fatal = false;
                _enter_state(RoasterState::OFF);
            }
            break;
            
        case RoasterEvent::SET_SETPOINT:
            if (state_allows_setpoint_change() && value > 0) {
                _setpoint = value;
                if (_current_state == RoasterState::PREHEAT) {
                    _preheat_target = value;
                    pid_set_setpoint(value);
                } else if (_current_state == RoasterState::ROASTING) {
                    pid_set_setpoint(value);
                }
                char msg[48];
                snprintf(msg, sizeof(msg), "Setpoint changed to %.1f", value);
                serial_send_log("info", "STATE", msg);
            }
            break;
            
        case RoasterEvent::SET_FAN_SPEED:
            if (state_allows_fan_change()) {
                uint8_t speed = (uint8_t)value;
                if (speed > 100) speed = 100;

                // In manual or fan-only mode, allow any speed (0-100)
                if (_current_state == RoasterState::MANUAL) {
                    _manual_fan_speed = speed;
                    fan_set_speed(speed);
                } else if (_current_state == RoasterState::FAN_ONLY) {
                    _fan_only_speed = speed;
                    fan_set_speed(speed);
                } else if (_current_state == RoasterState::PREHEAT || _current_state == RoasterState::ROASTING) {
                    // Enforce minimum when heater is on
                    if (speed < FAN_ROAST_MIN_DUTY) {
                        speed = FAN_ROAST_MIN_DUTY;
                    }
                    fan_set_speed(speed);
                }
                char msg[48];
                snprintf(msg, sizeof(msg), "Fan speed changed to %d", speed);
                serial_send_log("info", "STATE", msg);
            }
            break;
            
        case RoasterEvent::SET_HEATER_POWER:
            if (state_allows_heater_change() && _current_state == RoasterState::MANUAL) {
                uint8_t power = (uint8_t)value;
                if (power > 100) power = 100;
                _manual_heater_power = power;
                heater_set_power(power);
                char msg[48];
                snprintf(msg, sizeof(msg), "Heater power changed to %d", power);
                serial_send_log("info", "STATE", msg);
            }
            break;
            
        case RoasterEvent::DISCONNECTED:
            // On disconnect during active roasting, enter cooling
            if (_current_state == RoasterState::ROASTING ||
                _current_state == RoasterState::PREHEAT) {
                serial_send_log("warn", "STATE", "Disconnect during active state - entering cooling");
                _enter_state(RoasterState::COOLING);
            } else if (_current_state == RoasterState::MANUAL ||
                       _current_state == RoasterState::FAN_ONLY) {
                serial_send_log("info", "STATE", "Disconnect in manual/fan-only mode - entering OFF");
                _enter_state(RoasterState::OFF);
            }
            break;
            
        case RoasterEvent::NONE:
        default:
            break;
    }
}

RoasterState state_get_current() {
    return _current_state;
}

const char* state_get_name(RoasterState state) {
    switch (state) {
        case RoasterState::OFF:      return "OFF";
        case RoasterState::FAN_ONLY: return "FAN_ONLY";
        case RoasterState::PREHEAT:  return "PREHEAT";
        case RoasterState::ROASTING: return "ROASTING";
        case RoasterState::COOLING:  return "COOLING";
        case RoasterState::MANUAL:   return "MANUAL";
        case RoasterState::ERROR:    return "ERROR";
        default:                     return "UNKNOWN";
    }
}

// ============== State Data Accessors ==============

float state_get_setpoint() {
    if (_current_state == RoasterState::PREHEAT) {
        return _preheat_target;
    }
    return _setpoint;
}

void state_set_setpoint(float setpoint) {
    _setpoint = setpoint;
}

float state_get_preheat_target() {
    return _preheat_target;
}

void state_set_preheat_target(float target) {
    _preheat_target = target;
}

uint8_t state_get_fan_speed() {
    return fan_get_speed();
}

uint8_t state_get_heater_power() {
    return heater_get_power();
}

uint32_t state_get_roast_time_ms() {
    // Return elapsed time from PREHEAT through COOLING
    if (_current_state == RoasterState::PREHEAT || 
        _current_state == RoasterState::ROASTING || 
        _current_state == RoasterState::COOLING) {
        if (_roast_start_time > 0) {
            return millis() - _roast_start_time;
        }
    }
    return 0;
}

bool state_is_first_crack_marked() {
    return _first_crack_marked;
}

uint32_t state_get_first_crack_time_ms() {
    return _first_crack_time;
}

const char* state_get_error_code() {
    return _error_code;
}

const char* state_get_error_message() {
    return _error_message;
}

bool state_is_error_fatal() {
    return _error_fatal;
}

bool state_is_pid_enabled() {
    return (_current_state == RoasterState::PREHEAT || 
            _current_state == RoasterState::ROASTING);
}

bool state_allows_setpoint_change() {
    return (_current_state == RoasterState::OFF ||
            _current_state == RoasterState::PREHEAT ||
            _current_state == RoasterState::ROASTING);
}

bool state_allows_fan_change() {
    return (_current_state == RoasterState::FAN_ONLY ||
            _current_state == RoasterState::PREHEAT ||
            _current_state == RoasterState::ROASTING ||
            _current_state == RoasterState::MANUAL);
}

bool state_allows_heater_change() {
    return (_current_state == RoasterState::MANUAL);
}

// ============== Internal Functions ==============

// Called by safety module when a fault is triggered
void state_enter_error(const char* code, const char* message, bool fatal) {
    strncpy(_error_code, code, sizeof(_error_code) - 1);
    _error_code[sizeof(_error_code) - 1] = '\0';
    
    strncpy(_error_message, message, sizeof(_error_message) - 1);
    _error_message[sizeof(_error_message) - 1] = '\0';
    
    _error_fatal = fatal;
    
    _enter_state(RoasterState::ERROR);
}

static void _exit_state(RoasterState old_state) {
    char msg[48];
    snprintf(msg, sizeof(msg), "Exiting state: %s", state_get_name(old_state));
    serial_send_log("debug", "STATE", msg);

    switch (old_state) {
        case RoasterState::OFF:
            // Nothing to clean up
            break;

        case RoasterState::FAN_ONLY:
            // Nothing special to clean up
            break;

        case RoasterState::PREHEAT:
            // PID will be reconfigured in new state if needed
            break;
            
        case RoasterState::ROASTING:
            // Roast complete
            break;
            
        case RoasterState::COOLING:
            // Cooling complete
            break;
            
        case RoasterState::MANUAL:
            // Exit manual mode
            _manual_heater_power = 0;
            break;
            
        case RoasterState::ERROR:
            // Clearing error
            break;
    }
}

static void _enter_state(RoasterState new_state) {
    if (new_state == _current_state) return;
    
    RoasterState old_state = _current_state;
    _exit_state(old_state);
    
    _current_state = new_state;
    
    char msg[48];
    snprintf(msg, sizeof(msg), "Entering state: %s", state_get_name(new_state));
    serial_send_log("info", "STATE", msg);
    
    switch (new_state) {
        case RoasterState::OFF:
            // Disable all outputs
            fan_disable();
            heater_disable();
            pid_disable();

            // Reset roast tracking
            _roast_start_time = 0;
            _first_crack_marked = false;
            _first_crack_time = 0;
            reset_ror();
            break;

        case RoasterState::FAN_ONLY:
            // CRITICAL: Heater MUST be disabled in this state
            heater_disable();
            pid_disable();

            // Enable fan at stored speed (default 50%)
            fan_set_speed(_fan_only_speed);
            fan_enable();

            snprintf(msg, sizeof(msg), "Fan-only mode at %d%% speed - heater disabled", _fan_only_speed);
            serial_send_log("info", "STATE", msg);
            break;

        case RoasterState::PREHEAT:
            // Start session timer (includes preheat through cooling)
            _roast_start_time = millis();
            _preheat_start_time = millis();

            // Enable fan at preheat speed (50%)
            fan_set_speed(FAN_PREHEAT_DUTY);
            fan_enable();
            
            // Configure and enable PID for preheat target
            pid_set_setpoint(_preheat_target);
            pid_reset();
            pid_enable();
            
            // Enable heater (controlled by PID)
            heater_enable();
            
            snprintf(msg, sizeof(msg), "Preheating to %.1f°C", _preheat_target);
            serial_send_log("info", "STATE", msg);
            break;
            
        case RoasterState::ROASTING:
            // Don't reset roast timer - it started in PREHEAT
            // _roast_start_time already set in PREHEAT
            _first_crack_marked = false;
            _first_crack_time = 0;

            // Configure PID for roast setpoint
            pid_set_setpoint(_setpoint);
            pid_reset();
            pid_enable();

            // Set fan to roasting default (90%)
            fan_set_speed(FAN_ROAST_DEFAULT);
            fan_enable();
            
            // Heater continues (controlled by PID)
            heater_enable();
            
            // Reset RoR calculation for new roast
            reset_ror();
            
            snprintf(msg, sizeof(msg), "Roasting at setpoint %.1f°C", _setpoint);
            serial_send_log("info", "STATE", msg);
            break;
            
        case RoasterState::COOLING:
            // Disable heater immediately
            heater_disable();
            pid_disable();
            
            // Fan at maximum for cooling
            fan_set_speed(FAN_COOLING_DUTY);
            fan_enable();
            
            serial_send_log("info", "STATE", "Cooling - heater OFF, fan MAX");
            break;
            
        case RoasterState::MANUAL:
            // Start with safe defaults
            _manual_fan_speed = 50;
            _manual_heater_power = 0;
            
            // Enable fan at default speed
            fan_set_speed(_manual_fan_speed);
            fan_enable();
            
            // Heater starts at 0% power
            heater_set_power(0);
            heater_enable();
            
            // No PID in manual mode
            pid_disable();
            
            serial_send_log("info", "STATE", "Manual mode - direct control");
            break;
            
        case RoasterState::ERROR:
            // SAFETY: Disable all outputs
            fan_disable();
            heater_disable();
            pid_disable();
            
            snprintf(msg, sizeof(msg), "ERROR: %s - %s", _error_code, _error_message);
            serial_send_log("error", "STATE", msg);
            break;
    }
}
