/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addBlocks (Blockly) {
    const color = '#0066CC';
    const secondaryColour = '#005AB5';

    Blockly.Blocks.hmc5883l_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_INIT,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.hmc5883l_setRange = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_SETRANGE,
                args0: [
                    {
                     type: 'field_dropdown',
                        name: 'RANGE',
                        options: [
                            ['HMC5883L_RANGE_0_88GA', 'HMC5883L_RANGE_0_88GA'],
                            ['HMC5883L_RANGE_1_3GA', 'HMC5883L_RANGE_1_3GA '],
                            ['HMC5883L_RANGE_1_9GA', 'HMC5883L_RANGE_1_9GA'],
                            ['HMC5883L_RANGE_2_5GA', 'HMC5883L_RANGE_2_5GA'],
                            ['HMC5883L_RANGE_4GA', 'HMC5883L_RANGE_4GA'],
                            ['HMC5883L_RANGE_4_7GA', 'HMC5883L_RANGE_4_7GA'],
                            ['HMC5883L_RANGE_5_6GA', 'HMC5883L_RANGE_5_6GA'],
                            ['HMC5883L_RANGE_8_1GA', 'HMC5883L_RANGE_8_1GA'],
                        ],
                    
                    },
                ],
                
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.hmc5883l_setMeasurementMode = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_SETMEASUREMENTMODE,
                args0: [
                    {
                        type: 'field_dropdown',
                        name: 'MEASUREMENTMODE',
                        options: [
                            ['HMC5883L_IDLE', 'HMC5883L_IDLE'],
                            ['HMC5883L_SINGLE', 'HMC5883L_SINGLE'],
                            ['HMC5883L_CONTINOUS', 'HMC5883L_CONTINOUS'],
                        ]
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.hmc5883l_setDataRate = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_SETDATARATE,
                args0: [
                    {
                        type: 'field_dropdown',
                        name: 'DATARATE',
                        options: [
                            ['HMC5883L_DATARATE_0_75HZ', 'HMC5883L_DATARATE_0_75HZ'],
                            ['HMC5883L_DATARATE_1_5HZ', 'HMC5883L_DATARATE_1_5HZ'],
                            ['HMC5883L_DATARATE_3HZ', 'HMC5883L_DATARATE_3HZ'],
                            ['HMC5883L_DATARATE_7_50HZ', 'HMC5883L_DATARATE_7_50HZ'],
                            ['HMC5883L_RANGE_4GA', 'HMC5883L_RANGE_4GA'],
                            ['HMC5883L_DATARATE_15HZ', 'HMC5883L_DATARATE_15HZ'],
                            ['HMC5883L_DATARATE_30HZ', 'HMC5883L_DATARATE_30HZ'],
                            ['HMC5883L_DATARATE_75HZ', 'HMC5883L_DATARATE_75HZ'],
                        ]
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };


    Blockly.Blocks.hmc5883l_setSamples = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_SETSAMPLES,
                args0: [
                    {
                        type: 'field_dropdown',
                        name: 'SAMPLES',
                        options: [
                            ['HMC5883L_SAMPLES_1', 'HMC5883L_SAMPLES_1'],
                            ['HMC5883L_SAMPLES_2', 'HMC5883L_SAMPLES_2'],
                            ['HMC5883L_SAMPLES_4', 'HMC5883L_SAMPLES_4'],
                            ['HMC5883L_SAMPLES_8', 'HMC5883L_SAMPLES_8'],
                        ]
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.hmc5883l_checkSettings = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_CHECKSETTINGS,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.hmc5883l_getRange = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_GETRANGE,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.hmc5883l_getMeasurementMode = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_GETMEASUREMENTMODE,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.hmc5883l_getDataRate = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_GETDATARATE,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.hmc5883l_getSamples = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_GETSAMPLES,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.hmc5883l_initReadRaws = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_INITREADRAWS,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

     Blockly.Blocks.hmc5883l_initReadNormalize = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_INITREADNORMALIZE,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.hmc5883l_readRaws = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_READRAWS,
                args0: [
                    {
                        type: 'field_dropdown',
                        name: 'AXIS',
                        options: [
                            ['XAxis ', 'XAxis'],
                            ['YAxis ', 'YAxis '],
                        ]
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.hmc5883l_readNormalize = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HMC5883L_READNORMALIZE,
                args0: [
                    {
                        type: 'field_dropdown',
                        name: 'AXIS',
                        options: [
                            ['XAxis ', 'XAxis'],
                            ['YAxis ', 'YAxis '],
                        ]
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    return Blockly;
}

exports = addBlocks;
