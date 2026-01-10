#include "websocket.h"
#include "config.h"
#include "state.h"
#include "hardware.h"
#include "safety.h"

// ============== Internal State ==============

static WiFiServer* _server = nullptr;
static WiFiClient _client;
static bool _connected = false;
static unsigned long _last_activity = 0;
static unsigned long _last_state_send = 0;

// ============== SHA-1 Implementation ==============
#define SHA1_BLOCK_SIZE 64
#define SHA1_HASH_SIZE 20

static uint32_t sha1_h[5];
static uint32_t sha1_w[80];
static uint8_t sha1_buffer[SHA1_BLOCK_SIZE];
static uint32_t sha1_bufferIndex;
static uint64_t sha1_totalBits;

#define SHA1_ROTL(x, n) (((x) << (n)) | ((x) >> (32 - (n))))

static void sha1_init() {
    sha1_h[0] = 0x67452301;
    sha1_h[1] = 0xEFCDAB89;
    sha1_h[2] = 0x98BADCFE;
    sha1_h[3] = 0x10325476;
    sha1_h[4] = 0xC3D2E1F0;
    sha1_bufferIndex = 0;
    sha1_totalBits = 0;
}

static void sha1_processBlock() {
    for (int i = 0; i < 16; i++) {
        sha1_w[i] = ((uint32_t)sha1_buffer[i * 4] << 24) |
                    ((uint32_t)sha1_buffer[i * 4 + 1] << 16) |
                    ((uint32_t)sha1_buffer[i * 4 + 2] << 8) |
                    ((uint32_t)sha1_buffer[i * 4 + 3]);
    }
    for (int i = 16; i < 80; i++) {
        sha1_w[i] = SHA1_ROTL(sha1_w[i-3] ^ sha1_w[i-8] ^ sha1_w[i-14] ^ sha1_w[i-16], 1);
    }

    uint32_t a = sha1_h[0], b = sha1_h[1], c = sha1_h[2], d = sha1_h[3], e = sha1_h[4];

    for (int i = 0; i < 80; i++) {
        uint32_t f, k;
        if (i < 20) {
            f = (b & c) | ((~b) & d);
            k = 0x5A827999;
        } else if (i < 40) {
            f = b ^ c ^ d;
            k = 0x6ED9EBA1;
        } else if (i < 60) {
            f = (b & c) | (b & d) | (c & d);
            k = 0x8F1BBCDC;
        } else {
            f = b ^ c ^ d;
            k = 0xCA62C1D6;
        }
        uint32_t temp = SHA1_ROTL(a, 5) + f + e + k + sha1_w[i];
        e = d;
        d = c;
        c = SHA1_ROTL(b, 30);
        b = a;
        a = temp;
    }

    sha1_h[0] += a;
    sha1_h[1] += b;
    sha1_h[2] += c;
    sha1_h[3] += d;
    sha1_h[4] += e;
}

static void sha1_update(const uint8_t* data, size_t len) {
    for (size_t i = 0; i < len; i++) {
        sha1_buffer[sha1_bufferIndex++] = data[i];
        sha1_totalBits += 8;
        if (sha1_bufferIndex == SHA1_BLOCK_SIZE) {
            sha1_processBlock();
            sha1_bufferIndex = 0;
        }
    }
}

static void sha1_final(uint8_t* hash) {
    sha1_buffer[sha1_bufferIndex++] = 0x80;
    if (sha1_bufferIndex > 56) {
        while (sha1_bufferIndex < SHA1_BLOCK_SIZE) sha1_buffer[sha1_bufferIndex++] = 0;
        sha1_processBlock();
        sha1_bufferIndex = 0;
    }
    while (sha1_bufferIndex < 56) sha1_buffer[sha1_bufferIndex++] = 0;

    for (int i = 7; i >= 0; i--) {
        sha1_buffer[56 + (7 - i)] = (sha1_totalBits >> (i * 8)) & 0xFF;
    }
    sha1_processBlock();

    for (int i = 0; i < 5; i++) {
        hash[i * 4] = (sha1_h[i] >> 24) & 0xFF;
        hash[i * 4 + 1] = (sha1_h[i] >> 16) & 0xFF;
        hash[i * 4 + 2] = (sha1_h[i] >> 8) & 0xFF;
        hash[i * 4 + 3] = sha1_h[i] & 0xFF;
    }
}

// ============== Base64 Implementation ==============
static const char base64_chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static String base64_encode(const uint8_t* data, size_t len) {
    String result = "";
    int i = 0;
    uint8_t array3[3], array4[4];
    int idx = 0;

    while (len--) {
        array3[idx++] = *(data++);
        if (idx == 3) {
            array4[0] = (array3[0] & 0xfc) >> 2;
            array4[1] = ((array3[0] & 0x03) << 4) + ((array3[1] & 0xf0) >> 4);
            array4[2] = ((array3[1] & 0x0f) << 2) + ((array3[2] & 0xc0) >> 6);
            array4[3] = array3[2] & 0x3f;
            for (i = 0; i < 4; i++) result += base64_chars[array4[i]];
            idx = 0;
        }
    }

    if (idx) {
        for (int j = idx; j < 3; j++) array3[j] = 0;
        array4[0] = (array3[0] & 0xfc) >> 2;
        array4[1] = ((array3[0] & 0x03) << 4) + ((array3[1] & 0xf0) >> 4);
        array4[2] = ((array3[1] & 0x0f) << 2) + ((array3[2] & 0xc0) >> 6);
        for (int j = 0; j < idx + 1; j++) result += base64_chars[array4[j]];
        while (idx++ < 3) result += '=';
    }

    return result;
}

static String computeWebSocketAccept(String key) {
    key += "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

    sha1_init();
    sha1_update((const uint8_t*)key.c_str(), key.length());

    uint8_t hash[SHA1_HASH_SIZE];
    sha1_final(hash);

    return base64_encode(hash, SHA1_HASH_SIZE);
}

// ============== WebSocket Frame Sending ==============

static void sendWebSocketFrame(const String& payload) {
    if (!_connected || !_client.connected()) {
        return;
    }

    int len = payload.length();

    // WebSocket frame: FIN + text opcode
    _client.write(0x81);

    // Payload length (no mask for server->client)
    if (len <= 125) {
        _client.write((uint8_t)len);
    } else if (len <= 65535) {
        _client.write(126);
        _client.write((uint8_t)(len >> 8));
        _client.write((uint8_t)(len & 0xFF));
    }

    // Write payload
    _client.print(payload);
    _client.flush();
}

// ============== Message Handlers ==============

static void handleMessage(const String& message) {
    Serial.print("[WS] RX: ");
    Serial.println(message);
    
    _last_activity = millis();
    
    // Parse message type
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
        websocket_send_roast_event("FIRST_CRACK");
    }
    else if (message.indexOf("\"type\":\"stop\"") >= 0) {
        state_handle_event(RoasterEvent::STOP);
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
        websocket_send_state();
    }
    else {
        Serial.println("[WS] Unknown command");
    }
}

// ============== WebSocket Server Implementation ==============

void websocket_init(WiFiServer* server) {
    _server = server;
    _connected = false;
    _last_activity = 0;
    _last_state_send = 0;
    Serial.println("[WS] WebSocket server initialized");
}

void websocket_update() {
    if (_server == nullptr) return;
    
    // Check for new connections
    WiFiClient newClient = _server->available();
    
    if (newClient) {
        Serial.println("[WS] New client connecting...");
        
        // Handle existing connection
        if (_connected) {
            if (_client.connected()) {
                Serial.println("[WS] Closing existing connection for new client");
                _client.stop();
            }
            _connected = false;
            delay(50);
        }
        
        // Read HTTP request
        String request = "";
        unsigned long timeout = millis() + 5000;
        
        while (newClient.connected() && millis() < timeout) {
            if (newClient.available()) {
                char c = newClient.read();
                request += c;
                if (request.endsWith("\r\n\r\n")) {
                    break;
                }
            }
        }
        
        // Check for WebSocket upgrade
        if (request.indexOf("Upgrade: websocket") > 0) {
            // Extract key
            int keyStart = request.indexOf("Sec-WebSocket-Key: ") + 19;
            int keyEnd = request.indexOf("\r\n", keyStart);
            String key = request.substring(keyStart, keyEnd);
            
            // Compute accept key
            String acceptKey = computeWebSocketAccept(key);
            
            // Send handshake response
            newClient.println("HTTP/1.1 101 Switching Protocols");
            newClient.println("Upgrade: websocket");
            newClient.println("Connection: Upgrade");
            newClient.print("Sec-WebSocket-Accept: ");
            newClient.println(acceptKey);
            newClient.println();
            
            _client = newClient;
            _connected = true;
            _last_activity = millis();
            
            Serial.println("[WS] Client connected!");
            Serial.print("[WS] Client IP: ");
            Serial.println(_client.remoteIP());
            
            // Send initial state
            delay(100);
            websocket_send_state();
        } else {
            // Regular HTTP request
            newClient.println("HTTP/1.1 200 OK");
            newClient.println("Content-type:text/plain");
            newClient.println();
            newClient.println("MCRoaster WebSocket Server");
            newClient.stop();
        }
    }
    
    // Check for disconnection
    if (_connected && !_client.connected()) {
        Serial.println("[WS] Client disconnected!");
        _connected = false;
        state_handle_event(RoasterEvent::DISCONNECTED);
    }
    
    // Read incoming messages
    if (_connected && _client.available()) {
        uint8_t opcode = _client.read();
        uint8_t len = _client.read();
        
        // Check for close frame
        if ((opcode & 0x0F) == 0x08) {
            Serial.println("[WS] Close frame received");
            _client.stop();
            _connected = false;
            state_handle_event(RoasterEvent::DISCONNECTED);
            return;
        }
        
        bool masked = len & 0x80;
        len &= 0x7F;
        
        // Extended length (not typically needed for our messages)
        uint16_t msgLen = len;
        if (len == 126) {
            msgLen = (_client.read() << 8) | _client.read();
        }
        
        // Read mask
        uint8_t mask[4] = {0, 0, 0, 0};
        if (masked) {
            for (int i = 0; i < 4; i++) {
                mask[i] = _client.read();
            }
        }
        
        // Read payload
        String message = "";
        for (int i = 0; i < msgLen; i++) {
            uint8_t c = _client.read();
            if (masked) {
                c ^= mask[i % 4];
            }
            message += (char)c;
        }
        
        handleMessage(message);
    }
    
    // Send periodic state updates
    if (_connected && (millis() - _last_state_send >= STATE_SEND_INTERVAL_MS)) {
        websocket_send_state();
        _last_state_send = millis();
    }
}

bool websocket_is_connected() {
    return _connected;
}

String websocket_get_client_ip() {
    if (_connected) {
        return _client.remoteIP().toString();
    }
    return "";
}

void websocket_send_state() {
    if (!_connected) return;
    
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
    
    sendWebSocketFrame(json);
}

void websocket_send_error(const char* code, const char* message, bool fatal) {
    if (!_connected) return;
    
    String json = "{\"type\":\"error\",\"timestamp\":";
    json += String(millis());
    json += ",\"payload\":{\"code\":\"";
    json += code;
    json += "\",\"message\":\"";
    json += message;
    json += "\",\"fatal\":";
    json += fatal ? "true" : "false";
    json += "}}";
    
    sendWebSocketFrame(json);
}

void websocket_send_roast_event(const char* event) {
    if (!_connected) return;
    
    String json = "{\"type\":\"roastEvent\",\"timestamp\":";
    json += String(millis());
    json += ",\"payload\":{\"event\":\"";
    json += event;
    json += "\",\"roastTimeMs\":";
    json += String(state_get_roast_time_ms());
    json += ",\"chamberTemp\":";
    float temp = thermocouple_read_filtered();
    json += isnan(temp) ? "null" : String(temp, 1);
    json += "}}";
    
    sendWebSocketFrame(json);
}

unsigned long websocket_get_last_activity_ms() {
    return millis() - _last_activity;
}

bool websocket_is_stale() {
    return _connected && (millis() - _last_activity > DISCONNECT_TIMEOUT_MS);
}

void websocket_disconnect() {
    if (_connected) {
        _client.stop();
        _connected = false;
    }
}
