/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addBlocks (Blockly) {
    const color = '#AE00AE';
    const secondaryColour = '#930093';

    Blockly.Blocks.bh1750_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BH1750_INIT,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.bh1750_readLightLevel = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BH1750_READLIGHTLEVEL,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    return Blockly;
}

exports = addBlocks;
