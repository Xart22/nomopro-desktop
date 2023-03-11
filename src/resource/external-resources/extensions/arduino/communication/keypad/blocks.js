/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addBlocks (Blockly) {
    const color = '#FF3399';
    const secondaryColour = '#C71585';

    Blockly.Blocks.keypad_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.KEYPAD_INIT,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.keypad_getKey = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.KEYPAD_GETKEY,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_string']
            });
        }
    };

    return Blockly;
}

exports = addBlocks;
