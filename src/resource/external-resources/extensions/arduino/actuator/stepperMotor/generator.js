/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {
    Blockly.Arduino.stepperMotor_init = function (block) {
        const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
        const steps = Blockly.Arduino.valueToCode(block, 'STEPS', Blockly.Arduino.ORDER_ATOMIC);
        const pin1 = block.getFieldValue('PIN1');
        const pin2 = block.getFieldValue('PIN2');
        const pin3 = block.getFieldValue('PIN3');
        const pin4 = block.getFieldValue('PIN4');

        Blockly.Arduino.includes_.l298n_init = `#include <Stepper.h>`;
        Blockly.Arduino.definitions_[`stepperMotor_init${ch}_${steps}_${pin1}_${pin2}_${pin3}_${pin4}`] =
          `Stepper stepper_${ch}(${steps}, ${pin1}, ${pin2}, ${pin3}, ${pin4});`;
        return '';
    };

    Blockly.Arduino.stepperMotor_speed = function (block) {
        const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
        const speed = Blockly.Arduino.valueToCode(block, 'SPEED', Blockly.Arduino.ORDER_ATOMIC);

        return `stepper_${ch}.setSpeed(${speed});\n`;
    };

    Blockly.Arduino.stepperMotor_step = function (block) {
        const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
        const steps = Blockly.Arduino.valueToCode(block, 'STEP', Blockly.Arduino.ORDER_ATOMIC);

        return `stepper_${ch}.step(${steps});\n`;
    };


    return Blockly;
}

exports = addGenerator;
