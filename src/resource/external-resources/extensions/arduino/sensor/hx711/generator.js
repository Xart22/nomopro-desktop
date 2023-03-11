/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {
    Blockly.Arduino.hx711_init = function (block) {
        const dout = block.getFieldValue('DOUT');
        const clk = block.getFieldValue('CLK');
        // const calibrationFactor = Blockly.Arduino.valueToCode(block, 'CALIBRATION_FACTOR', Blockly.Arduino.ORDER_ATOMIC);
        Blockly.Arduino.includes_.hx711_init = `#include <HX711.h>`;
        Blockly.Arduino.definitions_.hx711_init = `HX711 scale;\n`;
        return `scale.begin(${dout}, ${clk});\n`;
    };

    Blockly.Arduino.hx711_getUnits = function () {
        return [`scale.get_units()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.hx711_setScale = function (block) {
        const calibrationFactor = Blockly.Arduino.valueToCode(block, 'CALIBRATION_FACTOR', Blockly.Arduino.ORDER_ATOMIC);
        return `scale.set_scale(${calibrationFactor});\n`;
    };

    Blockly.Arduino.hx711_tare = function () {
        return `scale.tare();\n`;
    };

    Blockly.Arduino.hx711_readAverage = function (block) {
        return [`scale.read_average()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    return Blockly;
}

exports = addGenerator;
