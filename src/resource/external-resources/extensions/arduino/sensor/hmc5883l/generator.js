/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {
    Blockly.Arduino.hmc5883l_init = function (block) {
        const ar = block.getFieldValue('AR');
        const gr = block.getFieldValue('GR');
        const fb = block.getFieldValue('FB');

        Blockly.Arduino.includes_.hmc5883l_init = `#include <HMC5883L.h>\n#include <Wire.h>`;
        Blockly.Arduino.definitions_.hmc5883l_init = `HMC5883L compass;`;
        return `
Serial.println("Initialize HMC5883L");
while (!compass.begin()) {
    Serial.println("Could not find a valid HMC5883L sensor, check wiring!");
    delay(500);
}
`;
    };

    Blockly.Arduino.hmc5883l_setRange = function (block) {
        const range = block.getFieldValue('RANGE');
        return `compass.setRange(${range});\n`;
    };

    Blockly.Arduino.hmc5883l_setMeasurementMode = function () {
        const meas = this.getFieldValue('MEASUREMENTMODE');
        return `compass.setMeasurementMode(${meas});\n`;
    };

    Blockly.Arduino.hmc5883l_setDataRate = function () {
        const dataRate = this.getFieldValue('DATARATE');
        return `compass.setDataRate(${dataRate});\n`;
    };

    Blockly.Arduino.hmc5883l_setSamples = function () {
        const samples = this.getFieldValue('SAMPLES');
        return `compass.setSamples(${samples});\n`;
    };

    Blockly.Arduino.hmc5883l_checkSettings = function () {
        Blockly.Arduino.definitions_.hmc5883l_checkSettings = `
void checkSettings() {
  Serial.print("Selected range: ");
  switch (compass.getRange())
  {
    case HMC5883L_RANGE_0_88GA: Serial.println("0.88 Ga"); break;
    case HMC5883L_RANGE_1_3GA:  Serial.println("1.3 Ga"); break;
    case HMC5883L_RANGE_1_9GA:  Serial.println("1.9 Ga"); break;
    case HMC5883L_RANGE_2_5GA:  Serial.println("2.5 Ga"); break;
    case HMC5883L_RANGE_4GA:    Serial.println("4 Ga"); break;
    case HMC5883L_RANGE_4_7GA:  Serial.println("4.7 Ga"); break;
    case HMC5883L_RANGE_5_6GA:  Serial.println("5.6 Ga"); break;
    case HMC5883L_RANGE_8_1GA:  Serial.println("8.1 Ga"); break;
    default: Serial.println("Bad range!");
  }
  
  Serial.print("Selected Measurement Mode: ");
  switch (compass.getMeasurementMode())
  {  
    case HMC5883L_IDLE: Serial.println("Idle mode"); break;
    case HMC5883L_SINGLE:  Serial.println("Single-Measurement"); break;
    case HMC5883L_CONTINOUS:  Serial.println("Continuous-Measurement"); break;
    default: Serial.println("Bad mode!");
  }

  Serial.print("Selected Data Rate: ");
  switch (compass.getDataRate())
  {  
    case HMC5883L_DATARATE_0_75_HZ: Serial.println("0.75 Hz"); break;
    case HMC5883L_DATARATE_1_5HZ:  Serial.println("1.5 Hz"); break;
    case HMC5883L_DATARATE_3HZ:  Serial.println("3 Hz"); break;
    case HMC5883L_DATARATE_7_5HZ: Serial.println("7.5 Hz"); break;
    case HMC5883L_DATARATE_15HZ:  Serial.println("15 Hz"); break;
    case HMC5883L_DATARATE_30HZ: Serial.println("30 Hz"); break;
    case HMC5883L_DATARATE_75HZ:  Serial.println("75 Hz"); break;
    default: Serial.println("Bad data rate!");
  }
  
  Serial.print("Selected number of samples: ");
  switch (compass.getSamples())
  {  
    case HMC5883L_SAMPLES_1: Serial.println("1"); break;
    case HMC5883L_SAMPLES_2: Serial.println("2"); break;
    case HMC5883L_SAMPLES_4: Serial.println("4"); break;
    case HMC5883L_SAMPLES_8: Serial.println("8"); break;
    default: Serial.println("Bad number of samples!");
  }

}     
`
        return `checkSettings();\n`;
    };
    
    Blockly.Arduino.hmc5883l_getRange = function () {
        return [`compass.getRange()`, Blockly.Arduino.ORDER_ATOMIC];;
    };

    Blockly.Arduino.hmc5883l_getMeasurementMode = function () {
        return [`compass.getMeasurementMode()`, Blockly.Arduino.ORDER_ATOMIC];;
    };

    Blockly.Arduino.hmc5883l_getDataRate = function () {
        return [`compass.getDataRate()`, Blockly.Arduino.ORDER_ATOMIC];;
    };

    Blockly.Arduino.hmc5883l_getSamples = function () {
        return [`compass.getSamples()`, Blockly.Arduino.ORDER_ATOMIC];;
    };

    Blockly.Arduino.hmc5883l_initReadRaws = function () {
        return `Vector raw = compass.readRaw();\n`;
    };

    Blockly.Arduino.hmc5883l_initReadNormalize = function () {
        return `Vector norm = compass.readNormalize();\n`;
    };

    Blockly.Arduino.hmc5883l_readRaws = function () {
        const axis = this.getFieldValue('AXIS');
        return [`raw.${axis}`, Blockly.Arduino.ORDER_ATOMIC];;
    };

    Blockly.Arduino.hmc5883l_readNormalize = function () {
        const axis = this.getFieldValue('AXIS');
        return [`norm.${axis}`, Blockly.Arduino.ORDER_ATOMIC];;
    };
    return Blockly;
}

exports = addGenerator;
