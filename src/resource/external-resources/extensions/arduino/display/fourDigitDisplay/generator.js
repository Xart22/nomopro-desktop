/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {
    Blockly.Arduino.displayFourDigitDisplay_init = function (block) {
        const dio = block.getFieldValue('DIO');
        const clk = block.getFieldValue('CLK');

        Blockly.Arduino.includes_.displayFourDigitDisplay_init = `#include <TM1637Display.h>\n#define TEST_DELAY 3000`;
        Blockly.Arduino.definitions_.displayFourDigitDisplay_init = `TM1637Display display(${clk}, ${dio});`;

        return ``;
    };

    
    Blockly.Arduino.displayFourDigitDisplay_test = function () {
        return `
int k;
uint8_t data[] = { 0xff, 0xff, 0xff, 0xff };
uint8_t blank[] = { 0x00, 0x00, 0x00, 0x00 };
display.setBrightness(0x0f);

// All segments on
display.setSegments(data);
delay(TEST_DELAY);

// Selectively set different digits
data[0] = display.encodeDigit(0);
data[1] = display.encodeDigit(1);
data[2] = display.encodeDigit(2);
data[3] = display.encodeDigit(3);
display.setSegments(data);
delay(TEST_DELAY);

  /*
  for(k = 3; k >= 0; k--) {
	display.setSegments(data, 1, k);
	delay(TEST_DELAY);
	}
  */

  display.clear();
  display.setSegments(data+2, 2, 2);
  delay(TEST_DELAY);

  display.clear();
  display.setSegments(data+2, 2, 1);
  delay(TEST_DELAY);

  display.clear();
  display.setSegments(data+1, 3, 1);
  delay(TEST_DELAY);


  // Show decimal numbers with/without leading zeros
  display.showNumberDec(0, false); // Expect: ___0
  delay(TEST_DELAY);
  display.showNumberDec(0, true);  // Expect: 0000
  delay(TEST_DELAY);
    display.showNumberDec(1, false); // Expect: ___1
    delay(TEST_DELAY);
  display.showNumberDec(1, true);  // Expect: 0001
  delay(TEST_DELAY);
  display.showNumberDec(301, false); // Expect: _301
  delay(TEST_DELAY);
  display.showNumberDec(301, true); // Expect: 0301
  delay(TEST_DELAY);
  display.clear();
  display.showNumberDec(14, false, 2, 1); // Expect: _14_
  delay(TEST_DELAY);
  display.clear();
  display.showNumberDec(4, true, 2, 2);  // Expect: __04
  delay(TEST_DELAY);
  display.showNumberDec(-1, false);  // Expect: __-1
  delay(TEST_DELAY);
  display.showNumberDec(-12);        // Expect: _-12
  delay(TEST_DELAY);
  display.showNumberDec(-999);       // Expect: -999
  delay(TEST_DELAY);
  display.clear();
  display.showNumberDec(-5, false, 3, 0); // Expect: _-5_
  delay(TEST_DELAY);
  display.showNumberHexEx(0xf1af);        // Expect: f1Af
  delay(TEST_DELAY);
  display.showNumberHexEx(0x2c);          // Expect: __2C
  delay(TEST_DELAY);
  display.showNumberHexEx(0xd1, 0, true); // Expect: 00d1
  delay(TEST_DELAY);
  display.clear();
  display.showNumberHexEx(0xd1, 0, true, 2); // Expect: d1__
  delay(TEST_DELAY);
  
	// Run through all the dots
	for(k=0; k <= 4; k++) {
		display.showNumberDecEx(0, (0x80 >> k), true);
		delay(TEST_DELAY);
	}

  // Brightness Test
  for(k = 0; k < 4; k++)
	data[k] = 0xff;
  for(k = 0; k < 7; k++) {
    display.setBrightness(k);
    display.setSegments(data);
    delay(TEST_DELAY);
  }
  
  // On/Off test
  for(k = 0; k < 4; k++) {
    display.setBrightness(7, false);  // Turn off
    display.setSegments(data);
    delay(TEST_DELAY);
    display.setBrightness(7, true); // Turn on
    display.setSegments(data);
    delay(TEST_DELAY);  
  }
        `;
    };

    Blockly.Arduino.displayFourDigitDisplay_segment = function (block) {
       const segment = Blockly.Arduino.valueToCode(block, 'SEGMENT', Blockly.Arduino.ORDER_ATOMIC);
       const data = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);
        const desc = Blockly.Arduino.valueToCode(block, 'DESC', Blockly.Arduino.ORDER_ATOMIC);
        Blockly.Arduino.definitions_.displayFourDigitDisplay_segment = `const uint8_t SEG_${segment}[] = {${data}}; // Display : ${desc}\n`;

        return ``;
    };

    Blockly.Arduino.displayFourDigitDisplay_show = function (block) {
       const segment = Blockly.Arduino.valueToCode(block, 'SEGMENT', Blockly.Arduino.ORDER_ATOMIC);

        return `display.setSegments(SEG_${segment});\n`;
    };

    return Blockly;
}

exports = addGenerator;
