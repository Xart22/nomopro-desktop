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

    Blockly.Blocks.sevenSegment_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.SEVENSEGMENT_INIT,
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.sevenSegment_showDigit = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.SEVENSEGMENT_SHOWDIGIT,
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.sevenSegment_show = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.SEVENSEGMENT_SHOW,
                args0: [
                    {
                        type: 'input_value',
                        name: 'DIGIT'
                    }
                ],
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    return Blockly;
}

exports = addBlocks;
