/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addBlocks (Blockly) {
    const color = '#FF6F00';
    const secondaryColour = '#FF4F00';
    const dualMotorColour = '#FF0000';

    const digitalPins = Blockly.getMainWorkspace().getFlyout()
        .getFlyoutItems()
        .find(block => block.type === 'arduino_pin_setDigitalOutput')
        .getField('PIN')
        .getOptions();

    const pwmPins = Blockly.getMainWorkspace().getFlyout()
        .getFlyoutItems()
        .find(block => block.type === 'arduino_pin_setPwmOutput')
        .getField('PIN')
        .getOptions();

    Blockly.Blocks.stepperMotor_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.STEPPERMOTOR_INIT,
                args0: [
                    {
                        type: 'input_value',
                        name: 'CH'
                    },
                    {
                        type: 'input_value',
                        name: 'STEPS'
                    },
                    {
                        type: 'field_dropdown',
                        name: 'PIN1',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'PIN2',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'PIN3',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'PIN4',
                        options: digitalPins
                    },
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.stepperMotor_speed = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.STEPPERMOTOR_SPEED,
                args0: [
                    {
                        type: 'input_value',
                        name: 'CH'
                    },
                    {
                        type: 'input_value',
                        name: 'SPEED'
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

     Blockly.Blocks.stepperMotor_step = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.STEPPERMOTOR_STEP,
                args0: [
                    {
                        type: 'input_value',
                        name: 'CH'
                    },
                    {
                        type: 'input_value',
                        name: 'STEP'
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    return Blockly;
}

exports = addBlocks;
