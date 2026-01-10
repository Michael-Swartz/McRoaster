#include <Arduino.h>
#include "WiFiS3.h"
#include "Arduino_LED_Matrix.h"
#include <WiFiUdp.h>
#include <ArduinoMDNS.h>

#include "config.h"
#include "hardware.h"
#include "state.h"
#include "pid_control.h"
#include "safety.h"
#include "websocket.h"
#include "secrets.h"

// ============== Global Objects ==============

ArduinoLEDMatrix matrix;
WiFiServer server(WEBSOCKET_PORT);
WiFiUDP udp;
MDNS mdns(udp);

int wifiStatus = WL_IDLE_STATUS;

// ============== LED Matrix Patterns ==============

void updateMatrixForState() {
    RoasterState state = state_get_current();
    
    switch (state) {
        case RoasterState::OFF:
            matrix.loadFrame(LEDMATRIX_EMOJI_SAD);
            break;
        case RoasterState::PREHEAT:
            matrix.loadFrame(LEDMATRIX_BOOTLOADER_ON);
            break;
        case RoasterState::ROASTING:
            matrix.loadFrame(LEDMATRIX_EMOJI_HAPPY);
            break;
        case RoasterState::COOLING:
            matrix.loadFrame(LEDMATRIX_CLOUD_WIFI);
            break;
        case RoasterState::MANUAL:
            matrix.loadFrame(LEDMATRIX_HEART_BIG);
            break;
        case RoasterState::ERROR:
            matrix.loadFrame(LEDMATRIX_DANGER);
            break;
    }
}

// ============== Setup ==============

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n");
    Serial.println("========================================");
    Serial.println("  MCRoaster Coffee Roaster Controller");
    Serial.println("  Firmware: " FIRMWARE_VERSION);
    Serial.println("========================================");
    Serial.println();
    
    // Initialize LED matrix
    matrix.begin();
    matrix.loadFrame(LEDMATRIX_BOOTLOADER_ON);
    
    // Initialize hardware
    Serial.println("[INIT] Initializing hardware...");
    hardware_init();
    
    // Initialize PID controller
    Serial.println("[INIT] Initializing PID controller...");
    pid_init();
    
    // Initialize safety system
    Serial.println("[INIT] Initializing safety system...");
    safety_init();
    
    // Initialize state machine
    Serial.println("[INIT] Initializing state machine...");
    state_init();
    
    // Test temperature sensors
    Serial.println("[INIT] Testing sensors...");
    delay(100);
    
    float chamberTemp = thermocouple_read();
    Serial.print("  Chamber temp: ");
    if (isnan(chamberTemp)) {
        Serial.println("FAULT - check thermocouple");
    } else {
        Serial.print(chamberTemp);
        Serial.println(" C");
    }
    
    float heaterTemp = thermistor_read();
    Serial.print("  Heater temp: ");
    Serial.print(heaterTemp);
    Serial.println(" C");
    
    // Check for WiFi module
    if (WiFi.status() == WL_NO_MODULE) {
        Serial.println("[ERROR] WiFi module not found!");
        matrix.loadFrame(LEDMATRIX_DANGER);
        while (true) {
            delay(1000);
        }
    }
    
    // Connect to WiFi
    Serial.println("[INIT] Connecting to WiFi...");
    Serial.print("  SSID: ");
    Serial.println(ssid);
    
    while (wifiStatus != WL_CONNECTED) {
        wifiStatus = WiFi.begin(ssid, password);
        if (wifiStatus != WL_CONNECTED) {
            Serial.println("  Retrying...");
            delay(5000);
        }
    }
    
    Serial.println("  Connected!");
    Serial.print("  IP: ");
    Serial.println(WiFi.localIP());
    
    // Start WebSocket server
    server.begin();
    websocket_init(&server);
    
    // Start mDNS
    mdns.begin(WiFi.localIP(), MDNS_HOSTNAME);
    Serial.print("[INIT] mDNS: ");
    Serial.print(MDNS_HOSTNAME);
    Serial.println(".local");
    
    // Show ready state
    matrix.loadFrame(LEDMATRIX_EMOJI_SAD);  // OFF state
    
    Serial.println();
    Serial.println("========================================");
    Serial.println("  System Ready!");
    Serial.print("  WebSocket: ws://");
    Serial.print(WiFi.localIP());
    Serial.print(":");
    Serial.println(WEBSOCKET_PORT);
    Serial.print("  mDNS: ");
    Serial.print(MDNS_HOSTNAME);
    Serial.println(".local");
    Serial.println("========================================");
    Serial.println();
}

// ============== Main Loop ==============

static RoasterState lastState = RoasterState::OFF;
static unsigned long lastDebugPrint = 0;
const unsigned long DEBUG_PRINT_INTERVAL = 5000;

void loop() {
    // Run mDNS responder
    mdns.run();
    
    // Update WebSocket (handles connections, messages)
    websocket_update();
    
    // Update safety system
    safety_update();
    
    // Update state machine
    state_update();
    
    // Update LED matrix if state changed
    RoasterState currentState = state_get_current();
    if (currentState != lastState) {
        updateMatrixForState();
        lastState = currentState;
    }
    
    // Periodic debug output
    if (millis() - lastDebugPrint >= DEBUG_PRINT_INTERVAL) {
        lastDebugPrint = millis();
        
        Serial.println("--- Status ---");
        Serial.print("State: ");
        Serial.println(state_get_name(currentState));
        Serial.print("Chamber: ");
        float chamberTemp = thermocouple_read_filtered();
        Serial.print(isnan(chamberTemp) ? -999 : chamberTemp);
        Serial.print(" C, Heater: ");
        Serial.print(thermistor_read());
        Serial.println(" C");
        Serial.print("Setpoint: ");
        Serial.print(state_get_setpoint());
        Serial.print(" C, Fan: ");
        Serial.print(state_get_fan_speed());
        Serial.print("%, Heater: ");
        Serial.print(state_get_heater_power());
        Serial.println("%");
        Serial.print("WebSocket: ");
        Serial.println(websocket_is_connected() ? "Connected" : "Disconnected");
        Serial.println("--------------");
    }
}
