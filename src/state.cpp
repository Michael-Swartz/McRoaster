#include "state.h"
#include "config.h"
#include "hardware.h"
#include "pid_control.h"
#include "safety.h"

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
    
    Serial.println("[STATE] State machine initialized - OFF");
}

void state_update() {
    // Read current temperature
    float chamber_temp = thermocouple_read_filtered();
    
    // State-specific updates
    switch (_current_state) {
        case RoasterState::OFF:
            // Nothing to do in OFF state
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
    Serial.print("[STATE] Event: ");
    Serial.print((int)event);
    Serial.print(" in state: ");
    Serial.println(state_get_name(_current_state));
    
    switch (event) {
        case RoasterEvent::STOP:
            if (_current_state != RoasterState::OFF && _current_state != RoasterState::ERROR) {
                _enter_state(RoasterState::OFF);
            }
            break;
            
        case RoasterEvent::START_PREHEAT:
            if (_current_state == RoasterState::OFF) {
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
                Serial.print("[STATE] First crack marked at ");
                Serial.print(_first_crack_time / 1000);
                Serial.println(" seconds");
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
                Serial.print("[STATE] Setpoint changed to ");
                Serial.println(value);
            }
            break;
            
        case RoasterEvent::SET_FAN_SPEED:
            if (state_allows_fan_change()) {
                uint8_t speed = (uint8_t)value;
                if (speed > 100) speed = 100;
                
                // In manual mode, allow any speed
                // In other modes, enforce minimum when heater is on
                if (_current_state == RoasterState::MANUAL) {
                    _manual_fan_speed = speed;
                    fan_set_speed(speed);
                } else if (_current_state == RoasterState::ROASTING) {
                    if (speed < FAN_ROAST_MIN_DUTY) {
                        speed = FAN_ROAST_MIN_DUTY;
                    }
                    fan_set_speed(speed);
                }
                Serial.print("[STATE] Fan speed changed to ");
                Serial.println(speed);
            }
            break;
            
        case RoasterEvent::SET_HEATER_POWER:
            if (state_allows_heater_change() && _current_state == RoasterState::MANUAL) {
                uint8_t power = (uint8_t)value;
                if (power > 100) power = 100;
                _manual_heater_power = power;
                heater_set_power(power);
                Serial.print("[STATE] Heater power changed to ");
                Serial.println(power);
            }
            break;
            
        case RoasterEvent::DISCONNECTED:
            // On disconnect during active roasting, enter cooling
            if (_current_state == RoasterState::ROASTING || 
                _current_state == RoasterState::PREHEAT) {
                Serial.println("[STATE] Disconnect during active state - entering cooling");
                _enter_state(RoasterState::COOLING);
            } else if (_current_state == RoasterState::MANUAL) {
                Serial.println("[STATE] Disconnect in manual mode - entering OFF");
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
    if (_current_state == RoasterState::ROASTING || _current_state == RoasterState::COOLING) {
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
    return (_current_state == RoasterState::ROASTING ||
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
    Serial.print("[STATE] Exiting state: ");
    Serial.println(state_get_name(old_state));
    
    switch (old_state) {
        case RoasterState::OFF:
            // Nothing to clean up
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
    
    Serial.print("[STATE] Entering state: ");
    Serial.println(state_get_name(new_state));
    
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
            
        case RoasterState::PREHEAT:
            // Start preheat timer
            _preheat_start_time = millis();
            
            // Enable fan at preheat speed
            fan_set_speed(FAN_PREHEAT_DUTY);
            fan_enable();
            
            // Configure and enable PID for preheat target
            pid_set_setpoint(_preheat_target);
            pid_reset();
            pid_enable();
            
            // Enable heater (controlled by PID)
            heater_enable();
            
            Serial.print("[STATE] Preheating to ");
            Serial.print(_preheat_target);
            Serial.println("°C");
            break;
            
        case RoasterState::ROASTING:
            // Start roast timer
            _roast_start_time = millis();
            _first_crack_marked = false;
            _first_crack_time = 0;
            
            // Configure PID for roast setpoint
            pid_set_setpoint(_setpoint);
            pid_reset();
            pid_enable();
            
            // Fan continues at current speed (or default)
            if (fan_get_speed() < FAN_ROAST_MIN_DUTY) {
                fan_set_speed(FAN_ROAST_MIN_DUTY);
            }
            fan_enable();
            
            // Heater continues (controlled by PID)
            heater_enable();
            
            // Reset RoR calculation for new roast
            reset_ror();
            
            Serial.print("[STATE] Roasting at setpoint ");
            Serial.print(_setpoint);
            Serial.println("°C");
            break;
            
        case RoasterState::COOLING:
            // Disable heater immediately
            heater_disable();
            pid_disable();
            
            // Fan at maximum for cooling
            fan_set_speed(FAN_COOLING_DUTY);
            fan_enable();
            
            Serial.println("[STATE] Cooling - heater OFF, fan MAX");
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
            
            Serial.println("[STATE] Manual mode - direct control");
            break;
            
        case RoasterState::ERROR:
            // SAFETY: Disable all outputs
            fan_disable();
            heater_disable();
            pid_disable();
            
            Serial.print("[STATE] ERROR: ");
            Serial.print(_error_code);
            Serial.print(" - ");
            Serial.println(_error_message);
            break;
    }
}
