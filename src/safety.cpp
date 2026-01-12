#include "safety.h"
#include "config.h"
#include "hardware.h"
#include "state.h"
#include "serial_comm.h"

// ============== Internal State ==============

static bool _fault_active = false;
static char _fault_code[32] = "";
static char _fault_message[128] = "";
static bool _fault_fatal = false;

// Forward declaration from state.cpp
extern void state_enter_error(const char* code, const char* message, bool fatal);

// ============== Safety System Implementation ==============

void safety_init() {
    _fault_active = false;
    _fault_code[0] = '\0';
    _fault_message[0] = '\0';
    _fault_fatal = false;
    
    serial_send_log("info", "SAFETY", "Safety system initialized");
}

bool safety_update() {
    // If already in fault state, don't check again
    if (_fault_active) {
        return false;
    }
    
    // Read temperatures
    float chamber_temp = thermocouple_read_filtered();
    
    // Check chamber temperature
    if (!safety_check_chamber_temp(chamber_temp)) {
        return false;
    }
    
    // Check fan/heater interlock
    if (!safety_check_fan_for_heater(fan_get_speed(), heater_is_enabled())) {
        return false;
    }
    
    // Check thermocouple
    if (!safety_check_thermocouple()) {
        return false;
    }
    
    return true;
}

bool safety_is_ok() {
    return !_fault_active;
}

const char* safety_get_fault_code() {
    return _fault_code;
}

const char* safety_get_fault_message() {
    return _fault_message;
}

bool safety_is_fault_fatal() {
    return _fault_fatal;
}

void safety_clear_fault() {
    _fault_active = false;
    _fault_code[0] = '\0';
    _fault_message[0] = '\0';
    _fault_fatal = false;
    serial_send_log("info", "SAFETY", "Fault cleared");
}

void safety_trigger_fault(const char* code, const char* message, bool fatal) {
    if (_fault_active) {
        return;  // Already in fault state
    }
    
    _fault_active = true;
    _fault_fatal = fatal;
    
    strncpy(_fault_code, code, sizeof(_fault_code) - 1);
    _fault_code[sizeof(_fault_code) - 1] = '\0';
    
    strncpy(_fault_message, message, sizeof(_fault_message) - 1);
    _fault_message[sizeof(_fault_message) - 1] = '\0';
    
    char log_msg[256];
    snprintf(log_msg, sizeof(log_msg), "FAULT: %s - %s (Fatal: %s)", 
             _fault_code, _fault_message, _fault_fatal ? "YES" : "NO");
    serial_send_log("error", "SAFETY", log_msg);
    
    // Enter error state
    state_enter_error(code, message, fatal);
}

// ============== Individual Safety Checks ==============

bool safety_check_chamber_temp(float temp) {
    // Skip check if reading is invalid
    if (isnan(temp)) {
        return true;  // Will be caught by thermocouple check
    }
    
    if (temp >= MAX_CHAMBER_TEMP) {
        safety_trigger_fault("OVER_TEMP_CHAMBER", 
            "Chamber temperature exceeded maximum safe limit", true);
        return false;
    }
    
    // Warning level (non-fatal for now, just log)
    if (temp >= WARN_CHAMBER_TEMP) {
        char msg[64];
        snprintf(msg, sizeof(msg), "WARNING: Chamber temp high: %.1f", temp);
        serial_send_log("warn", "SAFETY", msg);
    }
    
    return true;
}

bool safety_check_fan_for_heater(uint8_t fan_percent, bool heater_on) {
    // If heater is off, no need to check fan
    if (!heater_on) {
        return true;
    }
    
    // Check if fan speed is adequate
    if (fan_percent < MIN_FAN_WHEN_HEATING && !fan_is_enabled()) {
        safety_trigger_fault("FAN_INTERLOCK",
            "Fan speed too low or disabled while heater is on", true);
        return false;
    }
    
    return true;
}

bool safety_check_thermocouple() {
    static uint8_t fault_count = 0;
    static uint8_t good_count = 0;
    static uint8_t last_fault = 0;
    static bool warning_logged = false;
    const uint8_t FAULT_THRESHOLD = 10;  // Require 10 consecutive faults (more tolerant)
    const uint8_t GOOD_THRESHOLD = 3;    // Require 3 good reads to clear
    
    uint8_t fault = thermocouple_get_fault();
    
    if (fault == 0) {
        // Good reading
        good_count++;
        if (good_count >= GOOD_THRESHOLD) {
            // Multiple good reads, clear fault counter
            fault_count = 0;
            last_fault = 0;
            good_count = 0;
            warning_logged = false;
        }
        return true;
    }
    
    // Fault detected, reset good counter
    good_count = 0;
    
    // Check if same fault persists
    if (fault == last_fault) {
        fault_count++;
    } else {
        // Different fault, reset counter
        fault_count = 1;
        last_fault = fault;
        warning_logged = false;
    }
    
    // Only trigger if fault persists for multiple reads
    if (fault_count < FAULT_THRESHOLD) {
        return true;  // Transient fault, ignore
    }
    
    // Persistent fault - determine type
    const char* fault_type;
    bool is_critical = true;  // Assume critical unless proven otherwise
    
    if (fault & 0x01) {
        fault_type = "Open circuit - thermocouple disconnected";
        is_critical = true;  // Open circuit is always critical
    } else if (fault & 0x02) {
        fault_type = "Short to GND";
        is_critical = false;  // Short to GND is just a warning
    } else if (fault & 0x04) {
        fault_type = "Short to VCC";
        is_critical = true;  // Short to VCC is critical
    } else {
        fault_type = "Unknown thermocouple fault";
        is_critical = true;  // Unknown faults are critical
    }
    
    char message[128];
    snprintf(message, sizeof(message), "Thermocouple fault: %s", fault_type);
    
    // Only trigger fault for critical errors when heater is enabled
    if (is_critical && heater_is_enabled()) {
        safety_trigger_fault("THERMOCOUPLE_FAULT", message, true);
        return false;
    } else {
        // Just log once when fault becomes persistent
        if (!warning_logged) {
            char msg[128];
            snprintf(msg, sizeof(msg), "WARNING: Persistent thermocouple %s (0x%02X) - %s",
                     is_critical ? "fault" : "noise", fault, fault_type);
            serial_send_log("warn", "SAFETY", msg);
            warning_logged = true;
        }
        return true;  // Allow operation
    }
}
