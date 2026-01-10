#include <Arduino.h>
#include <SPI.h>
#include "WiFiS3.h"
#include "Arduino_LED_Matrix.h"
#include "secrets.h"

// MAX31855 SPI pins
const int MAX31855_CS = 10;  // Chip select pin

ArduinoLEDMatrix matrix;
WiFiServer server(81);  // WebSocket server on port 81
int status = WL_IDLE_STATUS;

// L298N Motor Driver Pins
const int ENA = 9;   // PWM pin for speed control
const int IN1 = 8;   // Motor direction pin 1
const int IN2 = 7;   // Motor direction pin 2

bool motorOn = false;
unsigned long lastTempRead = 0;
const unsigned long tempInterval = 2000;  // Read temp every 2 seconds

WiFiClient wsClient;
bool wsConnected = false;

// ============== SHA-1 Implementation ==============
#define SHA1_BLOCK_SIZE 64
#define SHA1_HASH_SIZE 20

uint32_t sha1_h[5];
uint32_t sha1_w[80];
uint8_t sha1_buffer[SHA1_BLOCK_SIZE];
uint32_t sha1_bufferIndex;
uint64_t sha1_totalBits;

#define SHA1_ROTL(x, n) (((x) << (n)) | ((x) >> (32 - (n))))

void sha1_init() {
  sha1_h[0] = 0x67452301;
  sha1_h[1] = 0xEFCDAB89;
  sha1_h[2] = 0x98BADCFE;
  sha1_h[3] = 0x10325476;
  sha1_h[4] = 0xC3D2E1F0;
  sha1_bufferIndex = 0;
  sha1_totalBits = 0;
}

void sha1_processBlock() {
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

void sha1_update(const uint8_t* data, size_t len) {
  for (size_t i = 0; i < len; i++) {
    sha1_buffer[sha1_bufferIndex++] = data[i];
    sha1_totalBits += 8;
    if (sha1_bufferIndex == SHA1_BLOCK_SIZE) {
      sha1_processBlock();
      sha1_bufferIndex = 0;
    }
  }
}

void sha1_final(uint8_t* hash) {
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
const char base64_chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

String base64_encode(const uint8_t* data, size_t len) {
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

// Compute WebSocket accept key
String computeWebSocketAccept(String key) {
  key += "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

  sha1_init();
  sha1_update((const uint8_t*)key.c_str(), key.length());

  uint8_t hash[SHA1_HASH_SIZE];
  sha1_final(hash);

  return base64_encode(hash, SHA1_HASH_SIZE);
}

// ============== MAX31855 Functions ==============
uint32_t readMAX31855Raw() {
  uint32_t data = 0;

  digitalWrite(MAX31855_CS, LOW);
  delayMicroseconds(1);

  // Read 32 bits
  for (int i = 31; i >= 0; i--) {
    digitalWrite(SCK, HIGH);
    delayMicroseconds(1);
    if (digitalRead(MISO)) {
      data |= ((uint32_t)1 << i);
    }
    digitalWrite(SCK, LOW);
    delayMicroseconds(1);
  }

  digitalWrite(MAX31855_CS, HIGH);
  return data;
}

float readThermocouple() {
  uint32_t raw = readMAX31855Raw();

  // Check for faults (bit 16)
  if (raw & 0x10000) {
    if (raw & 0x01) Serial.println("Thermocouple open circuit!");
    if (raw & 0x02) Serial.println("Thermocouple short to GND!");
    if (raw & 0x04) Serial.println("Thermocouple short to VCC!");
    return -999.0;
  }

  // Extract thermocouple temperature (bits 31-18, signed 14-bit)
  int16_t temp14 = (raw >> 18) & 0x3FFF;
  if (temp14 & 0x2000) {  // Sign bit set
    temp14 |= 0xC000;     // Sign extend
  }

  // Resolution is 0.25°C
  return temp14 * 0.25;
}

float readColdJunction() {
  uint32_t raw = readMAX31855Raw();

  // Extract cold junction temp (bits 15-4, signed 12-bit)
  int16_t temp12 = (raw >> 4) & 0x0FFF;
  if (temp12 & 0x800) {  // Sign bit set
    temp12 |= 0xF000;    // Sign extend
  }

  // Resolution is 0.0625°C
  return temp12 * 0.0625;
}

// ============== WebSocket Functions ==============
void sendWebSocketFrame(String payload) {
  if (!wsConnected || !wsClient.connected()) return;

  int len = payload.length();

  // WebSocket frame: FIN + text opcode
  wsClient.write(0x81);

  // Payload length (no mask for server->client)
  if (len <= 125) {
    wsClient.write((uint8_t)len);
  } else if (len <= 65535) {
    wsClient.write(126);
    wsClient.write((uint8_t)(len >> 8));
    wsClient.write((uint8_t)(len & 0xFF));
  }

  // Payload
  wsClient.print(payload);
}

void sendTemperature(float temp) {
  String json = "{\"type\":\"temperature\",\"timestamp\":";
  json += String(millis());
  json += ",\"payload\":{\"value\":";
  json += String(temp, 2);
  json += ",\"unit\":\"C\"}}";

  sendWebSocketFrame(json);
  Serial.println("WS TX: " + json);
}

void sendMotorState() {
  String json = "{\"type\":\"motor\",\"timestamp\":";
  json += String(millis());
  json += ",\"payload\":{\"on\":";
  json += motorOn ? "true" : "false";
  json += "}}";

  sendWebSocketFrame(json);
  Serial.println("WS TX: " + json);
}

void sendState(float temp) {
  String json = "{\"type\":\"state\",\"timestamp\":";
  json += String(millis());
  json += ",\"payload\":{\"temperature\":{\"value\":";
  json += String(temp, 2);
  json += ",\"unit\":\"C\"},\"motor\":{\"on\":";
  json += motorOn ? "true" : "false";
  json += "}}}";

  sendWebSocketFrame(json);
  Serial.println("WS TX: " + json);
}

void sendConnected() {
  IPAddress ip = WiFi.localIP();
  String json = "{\"type\":\"connected\",\"timestamp\":";
  json += String(millis());
  json += ",\"payload\":{\"ip\":\"";
  json += ip.toString();
  json += "\",\"firmware\":\"1.0.0\"}}";

  sendWebSocketFrame(json);
  Serial.println("WS TX: " + json);
}

void sendError(const char* code, const char* message) {
  String json = "{\"type\":\"error\",\"timestamp\":";
  json += String(millis());
  json += ",\"payload\":{\"code\":\"";
  json += code;
  json += "\",\"message\":\"";
  json += message;
  json += "\"}}";

  sendWebSocketFrame(json);
  Serial.println("WS TX: " + json);
}

// ============== Motor Control ==============
void setMotor(bool on) {
  motorOn = on;
  if (on) {
    digitalWrite(IN1, HIGH);
    digitalWrite(IN2, LOW);
    analogWrite(ENA, 255);  // Full speed
    Serial.println("Motor ON");
    matrix.loadFrame(LEDMATRIX_EMOJI_HAPPY);
  } else {
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
    analogWrite(ENA, 0);
    Serial.println("Motor OFF");
    matrix.loadFrame(LEDMATRIX_EMOJI_SAD);
  }

  sendMotorState();
}

// ============== Setup ==============
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\nStarting Motor Controller...");

  // Initialize SPI pins for MAX31855
  pinMode(MAX31855_CS, OUTPUT);
  digitalWrite(MAX31855_CS, HIGH);
  pinMode(SCK, OUTPUT);
  pinMode(MISO, INPUT);

  // Initialize LED matrix
  matrix.begin();
  matrix.loadFrame(LEDMATRIX_BOOTLOADER_ON);

  // Read initial temperature
  delay(100);
  float temp = readThermocouple();
  Serial.print("Initial temp: ");
  Serial.print(temp);
  Serial.println(" C");

  // Initialize motor pins
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);

  // Check for WiFi module
  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println("Communication with WiFi module failed!");
    while (true);
  }

  // Connect to WiFi
  while (status != WL_CONNECTED) {
    Serial.print("Connecting to: ");
    Serial.println(ssid);
    status = WiFi.begin(ssid, password);
    delay(10000);
  }

  server.begin();

  // Show WiFi connected
  matrix.loadFrame(LEDMATRIX_CLOUD_WIFI);
  delay(2000);

  // Motor off by default
  motorOn = false;
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, 0);
  matrix.loadFrame(LEDMATRIX_EMOJI_SAD);

  // Print connection info
  Serial.println("\n========================================");
  Serial.println("Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.println("WebSocket server on port 81");
  Serial.println("========================================");
}

// ============== Main Loop ==============
void loop() {
  // Read and send temperature periodically
  if (millis() - lastTempRead >= tempInterval) {
    lastTempRead = millis();
    float temp = readThermocouple();
    Serial.print("Temperature: ");
    Serial.print(temp);
    Serial.println(" C");

    if (temp <= -999.0) {
      uint32_t raw = readMAX31855Raw();
      if (raw & 0x01) sendError("THERMOCOUPLE_OPEN", "Thermocouple open circuit!");
      if (raw & 0x02) sendError("THERMOCOUPLE_SHORT_GND", "Thermocouple short to GND!");
      if (raw & 0x04) sendError("THERMOCOUPLE_SHORT_VCC", "Thermocouple short to VCC!");
    } else {
      sendTemperature(temp);
    }
  }

  // Check for new WebSocket client
  WiFiClient newClient = server.available();

  if (newClient) {
    Serial.println("New client connecting...");
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

    // Check if this is a WebSocket upgrade request
    if (request.indexOf("Upgrade: websocket") > 0) {
      Serial.println("WebSocket handshake request received");

      // Extract key
      int keyStart = request.indexOf("Sec-WebSocket-Key: ") + 19;
      int keyEnd = request.indexOf("\r\n", keyStart);
      String key = request.substring(keyStart, keyEnd);

      Serial.print("Key: ");
      Serial.println(key);

      // Compute proper accept key
      String acceptKey = computeWebSocketAccept(key);
      Serial.print("Accept: ");
      Serial.println(acceptKey);

      // Send WebSocket handshake response
      newClient.println("HTTP/1.1 101 Switching Protocols");
      newClient.println("Upgrade: websocket");
      newClient.println("Connection: Upgrade");
      newClient.print("Sec-WebSocket-Accept: ");
      newClient.println(acceptKey);
      newClient.println();

      wsClient = newClient;
      wsConnected = true;

      Serial.println("WebSocket connected!");

      // Send connected message and initial state
      delay(100);
      sendConnected();
      float temp = readThermocouple();
      sendState(temp);
    } else {
      // Regular HTTP request
      newClient.println("HTTP/1.1 200 OK");
      newClient.println("Content-type:text/plain");
      newClient.println();
      newClient.println("WebSocket server running on port 81");
      newClient.stop();
    }
  }

  // Check if WebSocket client disconnected
  if (wsConnected && !wsClient.connected()) {
    Serial.println("WebSocket client disconnected");
    wsConnected = false;
  }

  // Handle incoming WebSocket messages
  if (wsConnected && wsClient.available()) {
    uint8_t opcode = wsClient.read();
    uint8_t len = wsClient.read();

    bool masked = len & 0x80;
    len &= 0x7F;

    uint8_t mask[4];
    if (masked) {
      for (int i = 0; i < 4; i++) {
        mask[i] = wsClient.read();
      }
    }

    String message = "";
    for (int i = 0; i < len; i++) {
      uint8_t c = wsClient.read();
      if (masked) {
        c ^= mask[i % 4];
      }
      message += (char)c;
    }

    Serial.print("WS RX: ");
    Serial.println(message);

    // Handle commands
    if (message.indexOf("\"type\":\"setMotor\"") > 0) {
      bool newState = message.indexOf("\"on\":true") > 0;
      setMotor(newState);
    } else if (message.indexOf("\"type\":\"getState\"") > 0) {
      float temp = readThermocouple();
      sendState(temp);
    }
  }
}
