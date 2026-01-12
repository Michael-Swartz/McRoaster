#include <Arduino.h>
#include "Arduino_LED_Matrix.h"

#include "config.h"
#include "hardware.h"
#include "state.h"
#include "pid_control.h"
#include "safety.h"
#include "serial_comm.h"

// ============== Global Objects ==============

ArduinoLEDMatrix matrix;

// ============== LED Matrix Patterns ==============

void updateMatrixForState() {
    RoasterState state = state_get_current();

    switch (state) {
        case RoasterState::OFF:
            matrix.loadFrame(LEDMATRIX_EMOJI_SAD);
            break;
        case RoasterState::FAN_ONLY:
            matrix.loadFrame(LEDMATRIX_CLOUD_WIFI);
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
    // Initialize serial communication first
    serial_comm_init();

    delay(1000);

    // Initialize LED matrix
    matrix.begin();
    matrix.loadFrame(LEDMATRIX_BOOTLOADER_ON);

    // Initialize hardware
    hardware_init();

    // Initialize PID controller
    pid_init();

    // Initialize safety system
    safety_init();

    // Initialize state machine
    state_init();

    // Test temperature sensors
    delay(100);

    float chamberTemp = thermocouple_read();
    float heaterTemp = thermistor_read();

    // Show ready state
    matrix.loadFrame(LEDMATRIX_EMOJI_SAD);  // OFF state

    // Announce ready state
    serial_send_connected();
}

// ============== Main Loop ==============

static RoasterState lastState = RoasterState::OFF;

void loop() {
    // Handle serial communication
    serial_comm_update();

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
}
