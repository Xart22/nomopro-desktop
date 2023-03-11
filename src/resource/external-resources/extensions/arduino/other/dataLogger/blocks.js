/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addBlocks (Blockly) {
    const colour = '#3b3b3b';
    const secondaryColour = '#3b3b3b';

    const digitalPins = Blockly.getMainWorkspace().getFlyout()
        .getFlyoutItems()
        .find(block => block.type === 'arduino_pin_setDigitalOutput')
        .getField('PIN')
        .getOptions();

    Blockly.Blocks.dataLogger_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DATALOGGER_INIT,
                args0: [
                    {
                        type: 'field_dropdown',
                        name: 'CS',
                        options: digitalPins
                    }
                ],
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.dataLogger_openFile = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DATALOGGER_OPENFILE,
                args0: [
                    {
                        type: 'input_value',
                        name: 'NAME'
                    },
                    {
                        type: 'field_dropdown',
                        name: 'MODE',
                        options: [
                            [Blockly.Msg.DATALOGGER_MODE_READ, 'FILE_READ'],
                            [Blockly.Msg.DATALOGGER_MODE_READWRITE, 'FILE_WRITE']
                        ]
                    }
                ],
                tooltip: Blockly.Msg.DATALOGGER_OPENFILE_TOOLTIP,
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.dataLogger_closeFile = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DATALOGGER_CLOSEFILE,
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.dataLogger_print = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DATALOGGER_PRINT,
                args0: [
                    {
                        type: 'input_value',
                        name: 'DATA'
                    },
                    {
                        type: 'field_dropdown',
                        name: 'EOL',
                        options: [
                            [Blockly.Msg.DATALOGGER_EOL_WARP, 'warp'],
                            [Blockly.Msg.DATALOGGER_EOL_NOWARP, 'no-warp']
                        ]
                    }
                ],
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.dataLogger_fileDataAvailable = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DATALOGGER_FILEDATAAVAILABLE,
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.dataLogger_readFileData = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DATALOGGER_READFILEDATA,
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['output_string']
            });
        }
    };

    Blockly.Blocks.dataLogger_isFileExists = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DATALOGGER_ISFILEEXISTS,
                args0: [
                    {
                        type: 'input_value',
                        name: 'NAME'
                    }
                ],
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['output_boolean']
            });
        }
    };

    Blockly.Blocks.dataLogger_createFile = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DATALOGGER_CREATEFILE,
                args0: [
                    {
                        type: 'input_value',
                        name: 'NAME'
                    }
                ],
                colour: colour,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.dataLogger_deleteFile = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.DATALOGGER_DELETEFILE,
                args0: [
                    {
                        type: 'input_value',
                        name: 'NAME'
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
