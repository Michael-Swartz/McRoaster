#include "safety.h"
#include "config.h"
#include "hardware.h"
#include "state.h"

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
    
    Serial.println("[SAFETY] Safety system initialized");
}

bool safety_update() {
    // If already in fault state, don't check again
    if (_fault_active) {
        return false;
    }
    
    // Read temperatures
    float chamber_temp = thermocouple_read_filtered();
    float heater_temp = thermistor_read();
    
    // Check chamber temperature
    if (!safety_check_chamber_temp(chamber_temp)) {
        return false;
    }
    
    // Check heater temperature
    if (!safety_check_heater_temp(heater_temp)) {
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
    Serial.println("[SAFETY] Fault cleared");
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
    
    Serial.println("\n!!! SAFETY FAULT !!!");
    Serial.print("Code: ");
    Serial.println(_fault_code);
    Serial.print("Message: ");
    Serial.println(_fault_message);
    Serial.print("Fatal: ");
    Serial.println(_fault_fatal ? "YES" : "NO");
    
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
        Serial.print("[SAFETY] WARNING: Chamber temp high: ");
        Serial.println(temp);
    }
    
    return true;
}

bool safety_check_heater_temp(float temp) {
    // Skip check if reading is invalid
    if (temp > 500 || temp < -50) {
        // Thermistor reading is likely invalid
        return true;
    }
    
    if (temp >= MAX_HEATER_TEMP) {
        safety_trigger_fault("OVER_TEMP_HEATER",
            "Heater temperature exceeded maximum safe limit", true);
        return false;
    }
    
    // Warning level (non-fatal for now, just log)
    if (temp >= WARN_HEATER_TEMP) {
        Serial.print("[SAFETY] WARNING: Heater temp high: ");
        Serial.println(temp);
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
    uint8_t fault = thermocouple_get_fault();
    
    if (fault == 0) {
        return true;
    }
    
    // Determine fault type
    const char* fault_type;
    if (fault & 0x01) {
        fault_type = "Open circuit - thermocouple disconnected";
    } else if (fault & 0x02) {
        fault_type = "Short to GND";
    } else if (fault & 0x04) {
        fault_type = "Short to VCC";
    } else {
        fault_type = "Unknown thermocouple fault";
    }
    
    char message[128];
    snprintf(message, sizeof(message), "Thermocouple fault: %s", fault_type);
    
    // Only trigger fault if heater is enabled (critical situation)
    // Otherwise just log warning
    if (heater_is_enabled()) {
        safety_trigger_fault("THERMOCOUPLE_FAULT", message, true);
        return false;
    } else {
        Serial.print("[SAFETY] WARNING: ");
        Serial.println(message);
        return true;  // Allow operation without heater
    }
}
