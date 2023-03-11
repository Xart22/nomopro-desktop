/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {
    Blockly.Arduino.rfid_init = function (block) {
        const sda = block.getFieldValue('SDA');
        const rst = block.getFieldValue('RESET');

        Blockly.Arduino.includes_.rfid_init = `#include <SPI.h>\n#include <RFID.h>`;
        Blockly.Arduino.definitions_.rfid_init = `RFID rfid(${sda},${rst});`;
        return 'SPI.begin();\nrfid.init();\n';
    };

    Blockly.Arduino.rfid_isCard = function () {
        return [`rfid.isCard()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.rfid_readCardSerial = function () {
        return [`rfid.readCardSerial()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.rfid_serialNum = function (block) {
        const num = Blockly.Arduino.valueToCode(block, 'NUMBER', Blockly.Arduino.ORDER_ATOMIC);
        return [`rfid.serNum[${num}]`, Blockly.Arduino.ORDER_ATOMIC];
    };

    return Blockly;
}

exports = addGenerator;
