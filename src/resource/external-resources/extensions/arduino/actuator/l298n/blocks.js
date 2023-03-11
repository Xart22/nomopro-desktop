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

    Blockly.Blocks.l298n_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.L298N_INIT,
                args0: [
                    {
                        type: 'input_value',
                        name: 'CH'
                    },
                    {
                        type: 'field_dropdown',
                        name: 'IN1',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'IN2',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'EN',
                        options: pwmPins
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.l298n_run = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.L298N_RUN,
                args0: [
                    {
                        type: 'input_value',
                        name: 'CH'
                    },
                    {
                        type: 'field_dropdown',
                        name: 'DIR',
                        options: [
                            [Blockly.Msg.L298N_FORWARD, 'L298N_FORWARD'],
                            [Blockly.Msg.L298N_BACK, 'L298N_BACKWARD']]
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

    Blockly.Blocks.l298n_stop = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.L298N_STOP,
                args0: [
                    {
                        type: 'input_value',
                        name: 'CH'
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    //dual motors
    Blockly.Blocks.l298nx2_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.L298NX2_INIT,
                args0: [
                    {
                        type: 'input_value',
                        name: 'CH'
                    },
                    {
                        type: 'field_dropdown',
                        name: 'IN1_A',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'IN2_A',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'EN_A',
                        options: pwmPins
                    },
                     {
                        type: 'field_dropdown',
                        name: 'IN1_B',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'IN2_B',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'EN_B',
                        options: pwmPins
                    }
                ],
                colour: dualMotorColour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

     Blockly.Blocks.l298nx2_movementSingle = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.L298NX2_MOVEMENTSINGLE,
                args0: [
                    {
                        type: 'input_value',
                        name: 'CH'
                    },
                    {
                        type: 'field_dropdown',
                        name: 'MOTOR',
                        options: [
                            ['A', 'A'],
                            ['B', 'B']
                        ]
                    },
                    {
                        type: 'field_dropdown',
                        name: 'MOVEMENT',
                        options: [
                            ['forward', 'forward'],
                            ['backward', 'backward'],
                            ['stop', 'stop']
                        ]
                    }
                ],
                colour: dualMotorColour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };


    Blockly.Blocks.l298nx2_speedSingle = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.L298NX2_SPEEDSINGLE,
                args0: [
                    {
                        type: 'input_value',
                        name: 'CH'
                    },
                    {
                        type: 'field_dropdown',
                        name: 'MOTOR',
                        options: [
                            ['A', 'A'],
                            ['B', 'B']
                        ]
                    },
                    {
                        type: 'input_value',
                        name: 'SPEED'
                    }
                ],
                colour: dualMotorColour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };


    Blockly.Blocks.l298nx2_movement = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.L298NX2_MOVEMENT,
                args0: [
                    {
                        type: 'input_value',
                        name: 'CH'
                    },
                    {
                        type: 'field_dropdown',
                        name: 'MOVEMENT',
                        options: [
                            ['forward', 'forward'],
                            ['backward', 'backward'],
                            ['stop', 'stop']
                        ]
                    }
                    
                ],
                colour: dualMotorColour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.l298nx2_speed = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.L298NX2_SPEED,
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
                colour: dualMotorColour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    return Blockly;
}

exports = addBlocks;
