/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {
    Blockly.Arduino.gprs_init = function (block) {
        Blockly.Arduino.includes_.gprs_init = `#include <gprs.h>`;
        Blockly.Arduino.definitions_.gprs_init = `GPRS gprs;`;

        return `
        while(0 != gprs.init()) {
            delay(1000);
            Serial.print("init error");
        }
        `;
    };

    Blockly.Arduino.gprs_preInit = function (block) {
        return `gprs.preInit();\n`;
    };

    Blockly.Arduino.gprs_sendSms = function (block) {
        const message = Blockly.Arduino.valueToCode(block, 'MESSAGE', Blockly.Arduino.ORDER_ATOMIC);
        const number = Blockly.Arduino.valueToCode(block, 'NUMBER', Blockly.Arduino.ORDER_ATOMIC);

        return `gprs.sendSMS(${number}, ${message});\n`;
    };

    return Blockly;
}

exports = addGenerator;
