/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addBlocks (Blockly) {
    const color = '#AE00AE';
    const secondaryColour = '#930093';

    const digitalPins = Blockly.getMainWorkspace().getFlyout()
        .getFlyoutItems()
        .find(block => block.type === 'arduino_pin_setDigitalOutput')
        .getField('PIN')
        .getOptions();

    Blockly.Blocks.hx711_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HX711_INIT,
                args0: [
                    {
                        type: 'field_dropdown',
                        name: 'DOUT',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'CLK',
                        options: digitalPins
                    },
                    // {
                    //     type: 'input_value',
                    //     name: 'CALIBRATION_FACTOR'
                    // },
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.hx711_getUnits = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HX711_GETUNITS,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.hx711_setScale = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HX711_SETSCALE,
                args0: [
                    {
                        type: 'input_value',
                        name: 'CALIBRATION_FACTOR'
                    },
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };


    Blockly.Blocks.hx711_tare = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HX711_TARE,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.hx711_readAverage = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.HX711_READAVERAGE,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    return Blockly;
}

exports = addBlocks;
