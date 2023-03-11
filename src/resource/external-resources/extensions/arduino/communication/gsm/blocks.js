/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addBlocks (Blockly) {
    const colour = '#BBBB00';
    const secondaryColour = '#888800';

    Blockly.Blocks.gprs_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.GPRS_INIT,
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.gprs_preInit = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.GPRS_PREINIT,
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.gprs_sendSms = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.GPRS_SENDSMS,
                args0: [
                    {
                        type: 'input_value',
                        name: 'MESSAGE'
                    },
                    {
                        type: 'input_value',
                        name: 'NUMBER'
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
