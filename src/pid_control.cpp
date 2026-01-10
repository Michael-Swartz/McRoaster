#include "pid_control.h"
#include "config.h"

// ============== Internal State ==============

static float _setpoint = DEFAULT_ROAST_SETPOINT;
static float _kp = PID_KP_CONSERVATIVE;
static float _ki = PID_KI_CONSERVATIVE;
static float _kd = PID_KD_CONSERVATIVE;

static float _output = 0;
static float _integral = 0;
static float _last_error = 0;
static float _last_input = 0;

static bool _enabled = false;
static unsigned long _last_time = 0;
static bool _is_aggressive = false;

// ============== PID Controller Implementation ==============

void pid_init() {
    _setpoint = DEFAULT_ROAST_SETPOINT;
    _kp = PID_KP_CONSERVATIVE;
    _ki = PID_KI_CONSERVATIVE;
    _kd = PID_KD_CONSERVATIVE;
    _output = 0;
    _integral = 0;
    _last_error = 0;
    _last_input = 0;
    _enabled = false;
    _last_time = 0;
    _is_aggressive = false;
    
    Serial.println("[PID] Initialized");
}

void pid_set_setpoint(float setpoint) {
    _setpoint = setpoint;
    Serial.print("[PID] Setpoint: ");
    Serial.println(setpoint);
}

float pid_get_setpoint() {
    return _setpoint;
}

void pid_set_tunings(float kp, float ki, float kd) {
    _kp = kp;
    _ki = ki;
    _kd = kd;
    
    Serial.print("[PID] Tunings: Kp=");
    Serial.print(kp);
    Serial.print(" Ki=");
    Serial.print(ki);
    Serial.print(" Kd=");
    Serial.println(kd);
}

void pid_set_aggressive_tunings() {
    _kp = PID_KP_AGGRESSIVE;
    _ki = PID_KI_AGGRESSIVE;
    _kd = PID_KD_AGGRESSIVE;
    _is_aggressive = true;
    Serial.println("[PID] Using aggressive tunings");
}

void pid_set_conservative_tunings() {
    _kp = PID_KP_CONSERVATIVE;
    _ki = PID_KI_CONSERVATIVE;
    _kd = PID_KD_CONSERVATIVE;
    _is_aggressive = false;
    Serial.println("[PID] Using conservative tunings");
}

void pid_update(float current_temp) {
    if (!_enabled) {
        _output = 0;
        return;
    }
    
    unsigned long now = millis();
    
    // Initialize on first call
    if (_last_time == 0) {
        _last_time = now;
        _last_input = current_temp;
        _last_error = _setpoint - current_temp;
        return;
    }
    
    // Calculate time delta in seconds
    float dt = (now - _last_time) / 1000.0;
    
    // Prevent division by zero or negative time
    if (dt <= 0) return;
    
    // Calculate error
    float error = _setpoint - current_temp;
    
    // Auto-tune based on error magnitude
    pid_auto_tune(current_temp);
    
    // Proportional term
    float p_term = _kp * error;
    
    // Integral term with anti-windup
    _integral += error * dt;
    
    // Anti-windup: clamp integral
    float max_integral = PID_OUTPUT_MAX / _ki;
    if (_integral > max_integral) _integral = max_integral;
    if (_integral < -max_integral) _integral = -max_integral;
    
    float i_term = _ki * _integral;
    
    // Derivative term (on measurement to avoid derivative kick)
    float d_input = (current_temp - _last_input) / dt;
    float d_term = -_kd * d_input;
    
    // Calculate output
    _output = p_term + i_term + d_term;
    
    // Clamp output to valid range
    if (_output > PID_OUTPUT_MAX) _output = PID_OUTPUT_MAX;
    if (_output < PID_OUTPUT_MIN) _output = PID_OUTPUT_MIN;
    
    // Store for next iteration
    _last_time = now;
    _last_input = current_temp;
    _last_error = error;
}

float pid_get_output() {
    return _output;
}

void pid_reset() {
    _integral = 0;
    _last_error = 0;
    _last_input = 0;
    _last_time = 0;
    _output = 0;
    Serial.println("[PID] Reset");
}

void pid_enable() {
    _enabled = true;
    _last_time = 0;  // Reset timing on enable
    Serial.println("[PID] Enabled");
}

void pid_disable() {
    _enabled = false;
    _output = 0;
    Serial.println("[PID] Disabled");
}

bool pid_is_enabled() {
    return _enabled;
}

void pid_auto_tune(float current_temp) {
    float error = abs(_setpoint - current_temp);
    
    // Switch to aggressive tuning when far from setpoint
    if (error > PID_THRESHOLD && !_is_aggressive) {
        pid_set_aggressive_tunings();
    }
    // Switch to conservative tuning when close to setpoint
    else if (error <= PID_THRESHOLD && _is_aggressive) {
        pid_set_conservative_tunings();
    }
}

float pid_get_kp() {
    return _kp;
}

float pid_get_ki() {
    return _ki;
}

float pid_get_kd() {
    return _kd;
}
