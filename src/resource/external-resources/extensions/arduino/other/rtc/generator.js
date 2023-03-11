/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {
    Blockly.Arduino.rtc_init = function (block) {
        Blockly.Arduino.includes_.rtc_init = `#include <DS3231.h>\n#include <Wire.h>`;
        Blockly.Arduino.definitions_.rtc_init = `DS3231 rtc;`;
        return `Wire.begin();\n`;
    };

    // Blockly.Arduino.rtc_setDate = function (block) {
    //     const day = Blockly.Arduino.valueToCode(block, 'DAY', Blockly.Arduino.ORDER_ATOMIC);
    //     const month = Blockly.Arduino.valueToCode(block, 'MONTH', Blockly.Arduino.ORDER_ATOMIC);
    //     const year = Blockly.Arduino.valueToCode(block, 'YEAR', Blockly.Arduino.ORDER_ATOMIC);
    //     return `rtc.setDate(${day},${month},${year});\n`;
    // };

    // Blockly.Arduino.rtc_setTime = function (block) {
    //     const h = Blockly.Arduino.valueToCode(block, 'HOUR', Blockly.Arduino.ORDER_ATOMIC);
    //     const m = Blockly.Arduino.valueToCode(block, 'MINUTE', Blockly.Arduino.ORDER_ATOMIC);
    //     const s = Blockly.Arduino.valueToCode(block, 'SECOND', Blockly.Arduino.ORDER_ATOMIC);
    //     return `rtc.setTime(${h},${m},${s});\n`;
    // };

    // Blockly.Arduino.rtc_setDow = function (block) {
    //     const dow = Blockly.Arduino.valueToCode(block, 'DOW', Blockly.Arduino.ORDER_ATOMIC);
      
    //     return `rtc.setDow(${dow});\n`;
    // };

    Blockly.Arduino.rtc_getDowStr = function (block) {
        return [`rtc.getDoW()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.rtc_getDateStr = function (block) {
        return [`rtc.getDate()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.rtc_getYear = function (block) {
        return [`rtc.getYear()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.rtc_getMonth = function (block) {
        return [`rtc.getMonth()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.rtc_getHour = function (block) {
        const h12 = block.getFieldValue('12H');
        const pm = block.getFieldValue('PM');
        return [`rtc.getHour(${h12},${pm})`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.rtc_getMinute = function (block) {
        return [`rtc.getMinute()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.rtc_getSecond = function (block) {
        return [`rtc.getSecond()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.rtc_getTemperature = function (block) {
        return [`rtc.getTemperature()`, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.rtc_osilatorCheck = function (block) {
        return [`rtc.osilatoreCheck()`, Blockly.Arduino.ORDER_ATOMIC];
    };


    return Blockly;
}

exports = addGenerator;
