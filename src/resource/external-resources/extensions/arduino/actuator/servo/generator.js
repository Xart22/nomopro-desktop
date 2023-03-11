/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator(Blockly) {
    Blockly.Arduino.servo_init = function (block) {
        const no = Blockly.Arduino.valueToCode(
            block,
            "NO",
            Blockly.Arduino.ORDER_ATOMIC
        );
        const pin = block.getFieldValue("PIN");

        Blockly.Arduino.includes_.servo_init = `#include <Servo.h>`;
        Blockly.Arduino.definitions_[`servo_init_${no}`] = `Servo servo_${no};`;
        return `servo_${no}.attach(${pin});\n`;
    };

    Blockly.Arduino.servo_write = function (block) {
        const no = Blockly.Arduino.valueToCode(
            block,
            "NO",
            Blockly.Arduino.ORDER_ATOMIC
        );
        const degree = Blockly.Arduino.valueToCode(
            this,
            "DEGREE",
            Blockly.Arduino.ORDER_ATOMIC
        );

        return `servo_${no}.write(${degree})\n`;
    };

    return Blockly;
    // Blockly.Arduino.irRemoteReceiver_init = function (block) {
    //     const pin = block.getFieldValue('PIN');

    //     Blockly.Arduino.includes_.irRemoteReceiver_init = '#include <IRremote.h>';
    //     Blockly.Arduino.definitions_.irRemoteReceiver_init = `IRrecv irRemoteReceiver(${pin});`;

    //     return `irRemoteReceiver.enableIRIn();\n`;
    // };

    // Blockly.Arduino.irRemoteReceiver_dataAvailable = function () {
    //     return ['irRemoteReceiver.decode()', Blockly.Arduino.ORDER_ATOMIC];
    // };

    // Blockly.Arduino.irRemoteReceiver_recivedCommand = function () {
    //     return ['irRemoteReceiver.decodedIRData.command', Blockly.Arduino.ORDER_ATOMIC];
    // };

    // Blockly.Arduino.irRemoteReceiver_resume = function () {
    //     return 'irRemoteReceiver.resume();\n';
    // };
}

exports = addGenerator;
