/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addBlocks (Blockly) {
    const colour = '#FF7F50';
    const secondaryColour = '#FF6347';
    const colour2 = '#6AACD8'
    const secondaryColour2 = '#8ED2FF'

    const digitalPins = Blockly.getMainWorkspace().getFlyout()
        .getFlyoutItems()
        .find(block => block.type === 'arduino_pin_setDigitalOutput')
        .getField('PIN')
        .getOptions();

    Blockly.Blocks.displayFourDigitDisplay_init = {
         init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DISPLAYFOURDIGITDISPLAY_INIT,
                args0: [
                    {
                        type: 'field_dropdown',
                        name: 'DIO',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'CLK',
                        options: digitalPins
                    }
                ],
                colour: colour2,
                secondaryColour: secondaryColour2,
                extensions: ['shape_statement']
            });
        }
    }

    Blockly.Blocks.displayFourDigitDisplay_test = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DISPLAYFOURDIGITDISPLAY_TEST,
                colour: colour2,
                secondaryColour: secondaryColour2,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.displayFourDigitDisplay_segment = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DISPLAYFOURDIGITDISPLAY_SEGMENT,
                args0: [
                    {
                        type: 'input_value',
                        name: 'SEGMENT'
                    },
                    {
                        type: 'input_value',
                        name: 'VALUE'
                    },
                    {
                        type: 'input_value',
                        name: 'DESC'
                    },
                ],
                colour: colour2,
                secondaryColour: secondaryColour2,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.displayFourDigitDisplay_show = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DISPLAYFOURDIGITDISPLAY_SHOW,
                args0: [
                    {
                        type: 'input_value',
                        name: 'SEGMENT'
                    },
                ],
                colour: colour2,
                secondaryColour: secondaryColour2,
                extensions: ['shape_statement']
            });
        }
    };
 
    return Blockly;
}

exports = addBlocks;
