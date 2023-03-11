/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {
   Blockly.Arduino.sevenSegment_init = function () {

        Blockly.Arduino.definitions_.sevenSegment_init = `
const byte numeral[10] ={
// 0 = led dalam seven segment yang tidak diberikan tagangan
// 1 = led dalam seven segment yang diberikan tagangamasukan
B11111101, // angka 0
B01100001, // angka 1
B11011011, // angka 2
B11110011, // angka 3
B01100111, // angka 4
B10110111, // angka 5
B00111111, // angka 6
B11100001, // angka 7
B11111111, // angka 8
B11100111, // angka 9
};
// pin dari segment dp,G,F,E,D,C,B,A
const int segmentPins[8] = { 5,9,8,7,6,4,3,2};
        `;

        return `
for(int i=0; i < 8; i++) {
    pinMode(segmentPins[i], OUTPUT);
}\n`;
    };

    Blockly.Arduino.sevenSegment_showDigit = function (block) {
        Blockly.Arduino.definitions_.sevenSegment_showDigit = `
void showDigit(int number) {
    boolean isBitSet;
    for(int segment = 1; segment < 8; segment++) {
        isBitSet= bitRead(numeral[number], segment);
        digitalWrite( segmentPins[segment], isBitSet);
    }
}\n
`;
        return ``;
    };

     Blockly.Arduino.sevenSegment_show = function (block) {
        const digit = Blockly.Arduino.valueToCode(block, 'DIGIT', Blockly.Arduino.ORDER_ATOMIC);

        return `showDigit(${digit});\n`;
    };

    return Blockly;
}

exports = addGenerator;
