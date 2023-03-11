/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {
    Blockly.Arduino.bh1750_init = function (block) {
        Blockly.Arduino.includes_.bh1750 = `#include <Wire.h>\n#include <BH1750.h>`;
        Blockly.Arduino.definitions_.bh1750 = `BH1750 lightMeter;`;
        return 'Wire.begin();\nlightMeter.begin();\n';
    };

    Blockly.Arduino.bh1750_readLightLevel = function () {
        return [`lightMeter.readLightLevel()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    return Blockly;
}

exports = addGenerator;
