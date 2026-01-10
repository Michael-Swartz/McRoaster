# Thermistor Safety Monitor

## Overview

This document describes the implementation of a safety temperature monitor using a 100kΩ NTC thermistor attached to the heating element. This prevents the heating element from exceeding 215°C, which would blow the thermal fuse.

## Hardware Components

- **Thermistor**: 100kΩ NTC (Negative Temperature Coefficient)
- **Fixed Resistor**: 100kΩ ±1% (for voltage divider)
- **Arduino Pin**: Analog input (e.g., A1)
- **Operating Voltage**: 5V (Arduino supply)

## Purpose

- **Primary**: Monitor heating element surface temperature
- **Safety Limit**: 215°C (thermal fuse protection)
- **Action**: Automatically disable heater if temperature approaches limit (e.g., 210°C)
- **Redundancy**: Provides secondary temperature monitoring beyond the thermocouple

## Wiring Diagram

### Breadboard Layout

```
Arduino R4 WiFi                    Breadboard
┌─────────────┐                    
│             │         Rail       Power Rails        Component Area
│         5V  ├────────────────► [+] ──┬──────────────────────┐
│             │                    │   │                      │
│         GND ├────────────────► [-] ──┼────────────────┐     │
│             │                    │   │                │     │
│         A1  ├────────────────────┼───┼────────────────┼─────┤
└─────────────┘                    │   │                │     │
                                   │   │                │     │
                         Breadboard Connections          │     │
                                                         │     │
     j  i  h  g  f │ e  d  c  b  a                     │     │
  1  ·  ·  ·  ·  · │ ·  ·  ·  ·  ·                     │     │
  2  ·  ·  ·  ·  · │ ·  ·  ·  ·  ·                     │     │
  3  ·  ·  ·  ·  · │ ·  ·  ·  ·  ·                     │     │
  4  ·  ·  ·  ·  · │ ·  ·  ·  ·  ·                     │     │
  5  ·  ·  R1 ═══════════ ·  ·  ·  ◄──── 100kΩ Resistor (5V to A1)
  6  ·  ·  │  ·  · │ ·  ·  ·  ·  ·      │               │     │
  7  ·  ·  ├──────────────○  ·  ·  ◄──── Junction ──────┘     │
  8  ·  ·  │  ·  · │ ·  ·  ·  ·  ·      (to A1)               │
  9  ·  · RT  ·  · │ ·  ·  ·  ·  ·  ◄──── Thermistor          │
 10  ·  · RT  ·  · │ ·  ·  ·  ·  ·       100kΩ NTC            │
 11  ·  ·  │  ·  · │ ·  ·  ·  ·  ·      │                     │
 12  ·  ·  └──────────────────────────────────────────────────┘
                   │           (to GND)
                   │
             Thermistor leads go to heating element


Connection Summary:
  1. 5V (Arduino) ──► Power rail (+) ──► Row 5, column g (R1 top)
  2. Row 5, column c (R1 bottom) ──► Row 7, column c (junction)
  3. Row 7, column c (junction) ──► A1 (Arduino analog input)
  4. Row 9, column g (RT top) ──► Row 7, column g (junction)
  5. Row 10, column g (RT bottom) ──► GND rail (-)
```

### Schematic View

```
                    5V (Arduino)
                       │
                       │
                      ┌┴┐
                      │ │  R1 = 100kΩ Fixed Resistor
                      │ │  (1% tolerance recommended)
                      └┬┘
                       │
                       ├─────────► A1 (Arduino Analog Input)
                       │
                      ┌┴┐
                      │ │  RT = 100kΩ NTC Thermistor
                      │ │  (β = 3950 typical)
                      └┬┘
                       │
                      GND


Voltage Divider Formula:
    Vout = Vin × (RT / (R1 + RT))

Where:
    Vin  = 5V (Arduino supply)
    Vout = Analog pin reading (0-5V)
    R1   = 100kΩ fixed resistor
    RT   = Thermistor resistance (varies with temperature)
```

### Step-by-Step Wiring Instructions

1. **Place Components on Breadboard:**
   - Insert 100kΩ resistor (R1) across rows 5-7 (bridging center gap)
   - Leave space and insert thermistor (RT) across rows 9-12

2. **Connect Power:**
   - Red wire: Arduino 5V → Breadboard positive (+) rail
   - Black wire: Arduino GND → Breadboard negative (-) rail

3. **Build Voltage Divider:**
   - Wire from positive rail to top of R1 (row 5)
   - Wire from bottom of R1 (row 7) to top of thermistor (row 9)
   - Wire from bottom of thermistor (row 12) to negative rail

4. **Connect Analog Input:**
   - Wire from junction (row 7) to Arduino pin A1

5. **Extend Thermistor to Heating Element:**
   - Use longer wires or wire extensions on thermistor leads
   - Route to heating element location
   - Secure with Kapton tape to heating element surface

## Physical Installation

```
┌─────────────────────────────────────┐
│   Heating Element (1400W)           │
│                                     │
│   [Thermal Fuse - 215°C]            │
│                                     │
│   ╔═══════════════════════════════╗ │
│   ║   Heating Coil                ║ │
│   ║                               ║ │
│   ║   ┌─────┐                     ║ │
│   ║   │ 🌡️  │ ◄── 100kΩ Thermistor ║ │
│   ║   └─────┘     (Kapton tape)   ║ │
│   ╚═══════════════════════════════╝ │
└─────────────────────────────────────┘

Installation Notes:
- Use Kapton (polyimide) tape - rated to 260°C
- Position thermistor on underside of element housing
- Ensure good thermal contact
- Route wires away from hot areas
- Use silicone wire (rated 200°C+) if near heat
```

## Thermistor Calculations

### Steinhart-Hart Equation

The most accurate method for NTC thermistor temperature calculation:

```
1/T = A + B×ln(R) + C×(ln(R))³

Where:
    T = Temperature in Kelvin
    R = Thermistor resistance in ohms
    A, B, C = Steinhart-Hart coefficients
```

### Simplified Beta Formula

For 100kΩ NTC thermistors (adequate accuracy for this application):

```
1/T = 1/T₀ + (1/β)×ln(R/R₀)

Where:
    T  = Temperature in Kelvin
    T₀ = Reference temperature = 298.15K (25°C)
    R  = Measured resistance
    R₀ = Resistance at 25°C = 100kΩ
    β  = Beta coefficient (typically 3950 for 100k NTC)
```

### Arduino Implementation

```cpp
// Constants
const int THERMISTOR_PIN = A1;
const float VCC = 5.0;              // Supply voltage
const float R1 = 100000.0;          // Fixed resistor (100kΩ)
const float R0 = 100000.0;          // Thermistor resistance at 25°C
const float T0 = 298.15;            // 25°C in Kelvin
const float BETA = 3950.0;          // Beta coefficient
const float TEMP_SAFETY_LIMIT = 210.0;  // °C - below thermal fuse rating

float readHeaterTemperature() {
    // Read analog value (0-1023)
    int adcValue = analogRead(THERMISTOR_PIN);
    
    // Convert to voltage
    float voltage = (adcValue / 1023.0) * VCC;
    
    // Calculate thermistor resistance
    float resistance = R1 * (VCC / voltage - 1.0);
    
    // Calculate temperature using Beta formula
    float tempK = 1.0 / (1.0/T0 + (1.0/BETA) * log(resistance/R0));
    float tempC = tempK - 273.15;
    
    return tempC;
}

void checkHeaterSafety() {
    float heaterTemp = readHeaterTemperature();
    
    if (heaterTemp >= TEMP_SAFETY_LIMIT) {
        // EMERGENCY SHUTOFF
        digitalWrite(HEATER_SSR_PIN, LOW);
        heaterOn = false;
        
        // Send error via WebSocket
        sendError("HEATER_OVERHEAT", 
                  "Heating element exceeded safe temperature!");
    }
}
```

## Calibration

### Optional 3-Point Calibration

For improved accuracy, measure actual resistance at three known temperatures:

1. **Ice water** (0°C)
2. **Boiling water** (100°C)  
3. **Room temperature** (25°C)

Use online Steinhart-Hart calculator to derive A, B, C coefficients.

### Verification

1. Measure room temperature with thermistor
2. Compare to known accurate thermometer
3. Adjust β value if needed (typically 3900-4000)

## WebSocket Integration

See [websocket-schema.md](websocket-schema.md) for the `heaterSafety` message type.

## Safety Features

### Software Protections

1. **Temperature Monitoring**: Check every loop iteration
2. **Automatic Shutoff**: Disable SSR if temp ≥ 210°C
3. **Error Reporting**: Send `HEATER_OVERHEAT` error immediately
4. **Hysteresis**: Don't re-enable until temp drops to safe level (e.g., 180°C)

### Hardware Protections

1. **Thermal Fuse**: Mechanical cutoff at 215°C (non-resettable)
2. **SSR Rating**: Use adequately rated solid state relay
3. **Heat Sinking**: Proper cooling for SSR and heating element

### Monitoring Strategy

```
Temperature Zones:
    0-180°C:   Normal operation
  180-200°C:   Warning zone (send warning message)
  200-210°C:   Critical zone (reduce power or disable)
  210°C+:      Emergency shutoff
  215°C+:      Thermal fuse blows (hardware protection)
```

## Troubleshooting

### Reading Appears Incorrect

- Check wiring connections
- Verify R1 resistor value (use multimeter)
- Measure voltage at A1 pin
- Confirm β value from thermistor datasheet

### Temperature Too High/Low

- Verify physical contact with heating element
- Check for proper thermal paste/tape
- Calibrate using known temperatures
- Adjust β coefficient in code

### Noisy Readings

- Add 0.1µF capacitor across thermistor
- Average multiple readings (e.g., 10 samples)
- Use lower ADC reference voltage (AREF)

## References

- [Thermistor Beta Formula](https://en.wikipedia.org/wiki/Thermistor)
- [Steinhart-Hart Calculator](https://www.thinksrs.com/downloads/programs/therm%20calc/ntccalibrator/ntccalculator.html)
- [Arduino Analog Input](https://www.arduino.cc/reference/en/language/functions/analog-io/analogread/)
