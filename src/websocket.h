#ifndef WEBSOCKET_H
#define WEBSOCKET_H

#include <Arduino.h>
#include "WiFiS3.h"

// ============== WebSocket Server Interface ==============

// Initialize the WebSocket server
void websocket_init(WiFiServer* server);

// Update the WebSocket server (call every loop)
// Handles new connections, reads messages, manages disconnects
void websocket_update();

// Check if a client is connected
bool websocket_is_connected();

// Get the connected client IP address
String websocket_get_client_ip();

// Send the full roaster state
void websocket_send_state();

// Send an error message
void websocket_send_error(const char* code, const char* message, bool fatal = false);

// Send a roast event (e.g., first crack)
void websocket_send_roast_event(const char* event);

// Get time since last client activity (for disconnect detection)
unsigned long websocket_get_last_activity_ms();

// Check if client has been connected but inactive too long
bool websocket_is_stale();

// Disconnect the current client
void websocket_disconnect();

#endif // WEBSOCKET_H
