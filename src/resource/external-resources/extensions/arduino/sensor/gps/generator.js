/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {
    Blockly.Arduino.gps_init = function (block) {
        const baud = Blockly.Arduino.valueToCode(block, 'BAUD', Blockly.Arduino.ORDER_ATOMIC);
        const rx = block.getFieldValue('RX');
        const tx = block.getFieldValue('TX');
        // const model = this.getFieldValue('MODEL');

        Blockly.Arduino.includes_.gps_init = `#include <TinyGPS++.h>\n#include <SoftwareSerial.h>`;
        Blockly.Arduino.definitions_.gps_init = `TinyGPSPlus gps;\nSoftwareSerial gpsneo(${rx}, ${tx});\n`;
        return `gpsneo.begin(${baud});\n`;
    };

    Blockly.Arduino.gps_location = function (block) {
        // const no = Blockly.Arduino.valueToCode(block, 'NO', Blockly.Arduino.ORDER_ATOMIC);
        const location = this.getFieldValue('LOCATION');
        return [`gps.location.${location}()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.gps_date = function (block) {
        // const no = Blockly.Arduino.valueToCode(block, 'NO', Blockly.Arduino.ORDER_ATOMIC);
        const date = this.getFieldValue('DATE');
        return [`gps.date.${date}()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.gps_time = function (block) {
        // const no = Blockly.Arduino.valueToCode(block, 'NO', Blockly.Arduino.ORDER_ATOMIC);
        const time = this.getFieldValue('TIME');
        return [`gps.time.${time}()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.gps_check = function (block) {
        // const no = Blockly.Arduino.valueToCode(block, 'NO', Blockly.Arduino.ORDER_ATOMIC);
        const check = this.getFieldValue('CHECK');
        return [`gps.${check}.isValid()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    return Blockly;
}

exports = addGenerator;
