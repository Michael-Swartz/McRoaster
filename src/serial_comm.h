#ifndef SERIAL_COMM_H
#define SERIAL_COMM_H

#include <Arduino.h>

// ============== Serial Communication Interface ==============

// Initialize serial communication
void serial_comm_init();

// Update serial communication (call every loop)
// Handles reading commands and sending periodic state updates
void serial_comm_update();

// Send the full roaster state
void serial_send_state();

// Send an error message
void serial_send_error(int code, const char* message);

// Send a roast event (e.g., first crack)
void serial_send_event(const char* event, const char* data);

// Send connection acknowledgment with firmware version
void serial_send_connected();

// Send a log message (replaces Serial.print for debug output)
// level: "debug", "info", "warn", "error"
void serial_send_log(const char* level, const char* source, const char* message);

// Returns true if received data within timeout (connection is active)
bool serial_is_active();

// Get time since last received data
unsigned long serial_get_last_activity_ms();

#endif // SERIAL_COMM_H
