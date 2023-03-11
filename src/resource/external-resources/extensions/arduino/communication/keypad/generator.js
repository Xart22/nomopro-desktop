/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {

    Blockly.Arduino.keypad_init = function (block) {
        Blockly.Arduino.includes_.ps2_init = '#include <Keypad.h>';
        Blockly.Arduino.definitions_.ps2_init = `
        const byte ROWS = 4;
        const byte COLS = 4;
        char keys[ROWS][COLS] = {
            \t{'1','2','3','A'},
            \t{'4','5','6','B'},
            \t{'7','8','9','C'},
            \t{'*','0','#','D'}
        };\n
        byte colPins[COLS] = {5, 4, 3, 2}; // pin 2,3,4,5 untuk pin kolom keypad 
        byte rowPins[ROWS] = {9, 8, 7, 6}; // pin 6,7,8,9 untuk pin baris keypad 
        Keypad keypad = Keypad( makeKeymap(keys), rowPins, colPins, ROWS, COLS );
        `;

        return '';
    };

    Blockly.Arduino.keypad_getKey = function () {
        return ['keypad.getKey()', Blockly.Arduino.ORDER_ATOMIC];
    };

    return Blockly;
}

exports = addGenerator;
