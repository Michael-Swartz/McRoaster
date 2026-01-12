#include "serial_comm.h"
#include "config.h"
#include "state.h"
#include "hardware.h"
#include "safety.h"

// ============== Configuration ==============

#define SERIAL_BAUD_RATE        115200
#define SERIAL_TIMEOUT_MS       5000      // 5 seconds without data = disconnected
#define STATE_UPDATE_INTERVAL   1000      // Send state every 1 second
#define INPUT_BUFFER_SIZE       512

// ============== Internal State ==============

static char inputBuffer[INPUT_BUFFER_SIZE];
static size_t bufferIndex = 0;
static unsigned long lastDataReceived = 0;
static unsigned long lastStateUpdate = 0;
static bool connectionActive = false;

// ============== Forward Declarations ==============

static void parseCommand(const String& command);

// ============== Serial Communication Interface ==============

void serial_comm_init() {
    Serial.begin(SERIAL_BAUD_RATE);
    bufferIndex = 0;
    lastDataReceived = 0;
    lastStateUpdate = 0;
    connectionActive = false;

    // Clear any pending data
    while (Serial.available()) {
        Serial.read();
    }
}

void serial_comm_update() {
    // Read incoming bytes and accumulate in buffer
    while (Serial.available()) {
        char c = Serial.read();

        // Update activity timestamp when we receive data
        lastDataReceived = millis();
        if (!connectionActive) {
            connectionActive = true;
            serial_send_connected();
        }

        if (c == '\n') {
            // Complete line received - parse as command
            inputBuffer[bufferIndex] = '\0';
            if (bufferIndex > 0) {
                parseCommand(String(inputBuffer));
            }
            bufferIndex = 0;
        } else if (c != '\r') {
            // Add to buffer if not carriage return
            if (bufferIndex < INPUT_BUFFER_SIZE - 1) {
                inputBuffer[bufferIndex++] = c;
            } else {
                // Buffer overflow - reset
                bufferIndex = 0;
            }
        }
    }

    // Check for connection timeout
    if (connectionActive && (millis() - lastDataReceived > SERIAL_TIMEOUT_MS)) {
        connectionActive = false;
        state_handle_event(RoasterEvent::DISCONNECTED);
    }

    // Send periodic state updates
    if (millis() - lastStateUpdate >= STATE_UPDATE_INTERVAL) {
        serial_send_state();
        lastStateUpdate = millis();
    }
}

bool serial_is_active() {
    return connectionActive && (millis() - lastDataReceived < SERIAL_TIMEOUT_MS);
}

unsigned long serial_get_last_activity_ms() {
    return millis() - lastDataReceived;
}

// ============== Message Sending ==============

void serial_send_state() {
    RoasterState state = state_get_current();
    float chamberTemp = thermocouple_read_filtered();
    float heaterTemp = thermistor_read();

    String json = "{\"type\":\"roasterState\",\"timestamp\":";
    json += String(millis());
    json += ",\"payload\":{";
    json += "\"state\":\"";
    json += state_get_name(state);
    json += "\",\"stateId\":";
    json += String((int)state);
    json += ",\"chamberTemp\":";
    json += isnan(chamberTemp) ? "null" : String(chamberTemp, 1);
    json += ",\"heaterTemp\":";
    json += String(heaterTemp, 1);
    json += ",\"setpoint\":";
    json += String(state_get_setpoint(), 1);
    json += ",\"fanSpeed\":";
    json += String(state_get_fan_speed());
    json += ",\"heaterPower\":";
    json += String(state_get_heater_power());
    json += ",\"heaterEnabled\":";
    json += heater_is_enabled() ? "true" : "false";
    json += ",\"pidEnabled\":";
    json += state_is_pid_enabled() ? "true" : "false";
    json += ",\"roastTimeMs\":";
    json += String(state_get_roast_time_ms());
    json += ",\"firstCrackMarked\":";
    json += state_is_first_crack_marked() ? "true" : "false";
    json += ",\"firstCrackTimeMs\":";
    json += state_is_first_crack_marked() ? String(state_get_first_crack_time_ms()) : "null";
    json += ",\"ror\":";
    json += String(calculate_ror(), 1);

    // Error info
    if (state == RoasterState::ERROR) {
        json += ",\"error\":{\"code\":\"";
        json += state_get_error_code();
        json += "\",\"message\":\"";
        json += state_get_error_message();
        json += "\",\"fatal\":";
        json += state_is_error_fatal() ? "true" : "false";
        json += "}";
    } else {
        json += ",\"error\":null";
    }

    json += "}}";

    Serial.println(json);
}

void serial_send_error(int code, const char* message) {
    String json = "{\"type\":\"error\",\"timestamp\":";
    json += String(millis());
    json += ",\"payload\":{\"code\":";
    json += String(code);
    json += ",\"message\":\"";
    json += message;
    json += "\"}}";

    Serial.println(json);
}

void serial_send_event(const char* event, const char* data) {
    String json = "{\"type\":\"roastEvent\",\"timestamp\":";
    json += String(millis());
    json += ",\"payload\":{\"event\":\"";
    json += event;
    json += "\",\"roastTimeMs\":";
    json += String(state_get_roast_time_ms());
    json += ",\"chamberTemp\":";
    float temp = thermocouple_read_filtered();
    json += isnan(temp) ? "null" : String(temp, 1);
    if (data && strlen(data) > 0) {
        json += ",\"data\":\"";
        json += data;
        json += "\"";
    }
    json += "}}";

    Serial.println(json);
}

void serial_send_connected() {
    String json = "{\"type\":\"connected\",\"timestamp\":";
    json += String(millis());
    json += ",\"payload\":{\"firmware\":\"";
    json += FIRMWARE_VERSION;
    json += "\"}}";

    Serial.println(json);
}

void serial_send_log(const char* level, const char* source, const char* message) {
    String json = "{\"type\":\"log\",\"timestamp\":";
    json += String(millis());
    json += ",\"payload\":{\"level\":\"";
    json += level;
    json += "\",\"source\":\"";
    json += source;
    json += "\",\"message\":\"";
    // Escape special characters in message
    for (const char* p = message; *p; p++) {
        if (*p == '"') json += "\\\"";
        else if (*p == '\\') json += "\\\\";
        else if (*p == '\n') json += "\\n";
        else json += *p;
    }
    json += "\"}}";

    Serial.println(json);
}

// ============== Command Parsing ==============

static void parseCommand(const String& message) {
    // Parse message type using indexOf (same pattern as websocket.cpp)
    if (message.indexOf("\"type\":\"startPreheat\"") >= 0) {
        float targetTemp = DEFAULT_PREHEAT_TEMP;
        int idx = message.indexOf("\"targetTemp\":");
        if (idx >= 0) {
            targetTemp = message.substring(idx + 13).toFloat();
        }
        state_handle_event(RoasterEvent::START_PREHEAT, targetTemp);
    }
    else if (message.indexOf("\"type\":\"loadBeans\"") >= 0) {
        float setpoint = DEFAULT_ROAST_SETPOINT;
        int idx = message.indexOf("\"setpoint\":");
        if (idx >= 0) {
            setpoint = message.substring(idx + 11).toFloat();
        }
        state_handle_event(RoasterEvent::LOAD_BEANS, setpoint);
    }
    else if (message.indexOf("\"type\":\"endRoast\"") >= 0) {
        state_handle_event(RoasterEvent::END_ROAST);
    }
    else if (message.indexOf("\"type\":\"markFirstCrack\"") >= 0) {
        state_handle_event(RoasterEvent::FIRST_CRACK);
        serial_send_event("FIRST_CRACK", nullptr);
    }
    else if (message.indexOf("\"type\":\"stop\"") >= 0) {
        state_handle_event(RoasterEvent::STOP);
    }
    else if (message.indexOf("\"type\":\"enterFanOnly\"") >= 0) {
        float fanSpeed = 50;  // Default 50%
        int idx = message.indexOf("\"fanSpeed\":");
        if (idx >= 0) {
            fanSpeed = message.substring(idx + 11).toFloat();
        }
        state_handle_event(RoasterEvent::START_FAN_ONLY, fanSpeed);
    }
    else if (message.indexOf("\"type\":\"exitFanOnly\"") >= 0) {
        state_handle_event(RoasterEvent::EXIT_FAN_ONLY);
    }
    else if (message.indexOf("\"type\":\"enterManual\"") >= 0) {
        state_handle_event(RoasterEvent::ENTER_MANUAL);
    }
    else if (message.indexOf("\"type\":\"exitManual\"") >= 0) {
        state_handle_event(RoasterEvent::EXIT_MANUAL);
    }
    else if (message.indexOf("\"type\":\"clearFault\"") >= 0) {
        state_handle_event(RoasterEvent::CLEAR_FAULT);
    }
    else if (message.indexOf("\"type\":\"setSetpoint\"") >= 0) {
        int idx = message.indexOf("\"value\":");
        if (idx >= 0) {
            float value = message.substring(idx + 8).toFloat();
            state_handle_event(RoasterEvent::SET_SETPOINT, value);
        }
    }
    else if (message.indexOf("\"type\":\"setFanSpeed\"") >= 0) {
        int idx = message.indexOf("\"value\":");
        if (idx >= 0) {
            float value = message.substring(idx + 8).toFloat();
            state_handle_event(RoasterEvent::SET_FAN_SPEED, value);
        }
    }
    else if (message.indexOf("\"type\":\"setHeaterPower\"") >= 0) {
        int idx = message.indexOf("\"value\":");
        if (idx >= 0) {
            float value = message.substring(idx + 8).toFloat();
            state_handle_event(RoasterEvent::SET_HEATER_POWER, value);
        }
    }
    else if (message.indexOf("\"type\":\"getState\"") >= 0) {
        serial_send_state();
    }
    else if (message.indexOf("\"type\":\"debugFan\"") >= 0) {
        fan_debug_dump();
    }
    else if (message.indexOf("\"type\":\"testFanPins\"") >= 0) {
        fan_test_direct();
    }
    // Unknown command - ignore silently
}
