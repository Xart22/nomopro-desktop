/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addGenerator (Blockly) {
    Blockly.Arduino.l298n_init = function (block) {
        const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
        const in1 = block.getFieldValue('IN1');
        const in2 = block.getFieldValue('IN2');
        const en = block.getFieldValue('EN');

        Blockly.Arduino.includes_.l298n_init = `#include <L298N.h>`;
        Blockly.Arduino.definitions_[`l298n_init_${ch}_${in1}_${in2}_${en}`] =
          `L298N motor_${ch}(${en}, ${in1}, ${in2});`;
        return '';
    };

    Blockly.Arduino.l298n_run = function (block) {
        const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
        const dir = this.getFieldValue('DIR');
        const speed = Blockly.Arduino.valueToCode(block, 'SPEED', Blockly.Arduino.ORDER_ATOMIC);

        return `motor_${ch}.run(${dir}, ${speed});\n`;
    };

    Blockly.Arduino.l298n_stop = function (block) {
        const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);

        return `motor_${ch}.stop();\n`;
    };

    //for double motors using L298NX2.h
      Blockly.Arduino.l298nx2_init = function (block) {
        const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
        const in1_A = block.getFieldValue('IN1_A');
        const in2_A = block.getFieldValue('IN2_A');
        const en_A = block.getFieldValue('EN_A');

        const in1_B = block.getFieldValue('IN1_B');
        const in2_B = block.getFieldValue('IN2_B');
        const en_B = block.getFieldValue('EN_B');

        Blockly.Arduino.includes_.l298nx2_init = `#include <L298NX2.h>`;
        Blockly.Arduino.definitions_[`l298nx2_init_${ch}_${in1_A}_${in2_A}_${en_A}_${in1_B}_${in2_B}_${en_B}`] =
          `L298NX2 motor_${ch}(${en_A}, ${in1_A}, ${in2_A},${en_B}, ${in1_B}, ${in2_B});`;
        return '';
    };

    Blockly.Arduino.l298nx2_movementSingle = function (block) {
         const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
         const motor = block.getFieldValue('MOTOR');
         const movement = block.getFieldValue('MOVEMENT');

         return `motor_${ch}.${movement}${motor}();\n`
    }

     Blockly.Arduino.l298nx2_backwardSingle = function (block) {
         const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
         const motor = block.getFieldValue('MOTOR');

         return `motor_${ch}.backward${motor}();\n`
    }

     Blockly.Arduino.l298nx2_stopSingle = function (block) {
         const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
         const motor = block.getFieldValue('MOTOR');

         return `motor_${ch}.stop${motor}();\n`
    }

    Blockly.Arduino.l298nx2_speedSingle = function (block) {
        const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
        const motor = block.getFieldValue('MOTOR');
        const speed = Blockly.Arduino.valueToCode(block, 'SPEED', Blockly.Arduino.ORDER_ATOMIC);

         return `motor_${ch}.setSpeed${motor}(${speed});\n`
    }


    Blockly.Arduino.l298nx2_movement = function (block) {
        const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
        const movement = block.getFieldValue('MOVEMENT');   
        return `motor_${ch}.${movement}();\n`;
    };

    Blockly.Arduino.l298nx2_speed = function (block) {
        const ch = Blockly.Arduino.valueToCode(block, 'CH', Blockly.Arduino.ORDER_ATOMIC);
        const speed = Blockly.Arduino.valueToCode(block, 'SPEED', Blockly.Arduino.ORDER_ATOMIC);

         return `motor_${ch}.setSpeed(${speed});\n`
    }


    return Blockly;
}

exports = addGenerator;
