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

    Blockly.Blocks.rfid_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RFID_INIT,
                args0: [
                    {
                        type: 'field_dropdown',
                        name: 'SDA',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'RESET',
                        options: digitalPins
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.rfid_isCard = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RFID_ISCARD,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_boolean']
            });
        }
    };

    Blockly.Blocks.rfid_readCardSerial = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RFID_READCARDSERIAL,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_boolean']
            });
        }
    };

    Blockly.Blocks.rfid_serialNum = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RFID_SERIALNUM,
                args0: [
                    {
                        type: 'input_value',
                        name: 'NUMBER'
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
