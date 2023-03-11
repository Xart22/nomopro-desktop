/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addBlocks(Blockly) {
    const color = "#BB5E00";
    const secondaryColour = "#9F5000";

    const digitalPins = Blockly.getMainWorkspace()
        .getFlyout()
        .getFlyoutItems()
        .find((block) => block.type === "arduino_pin_setDigitalOutput")
        .getField("PIN")
        .getOptions();

    // Blockly.Blocks.servo_init = {
    //     init: function () {
    //         this.jsonInit({
    //             message0: Blockly.Msg.SERVO_INIT,
    //             args0: [
    //                 {
    //                     type: "field_dropdown",
    //                     name: "PIN",
    //                     options: digitalPins,
    //                 },
    //             ],
    //             colour: color,
    //             secondaryColour: secondaryColour,
    //             extensions: ["shape_statement"],
    //         });
    //     },
    // };
    Blockly.Blocks.servo_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.SERVO_INIT,
                args0: [
                    {
                        type: "input_value",
                        name: "NO",
                    },
                    {
                        type: "field_dropdown",
                        name: "PIN",
                        options: digitalPins,
                    },
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ["shape_statement"],
            });
        },
    };

    Blockly.Blocks.servo_write = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.SERVO_WRITE,
                args0: [
                    {
                        type: "input_value",
                        name: "NO",
                    },
                    {
                        type: "input_value",
                        name: "DEGREE",
                    },
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ["shape_statement"],
            });
        },
    };

    // Blockly.Blocks.irRemoteReceiver_dataAvailable = {
    //     init: function () {
    //         this.jsonInit({
    //             message0: Blockly.Msg.IRREMOTERECEIVER_DATAAVAILABLE,
    //             colour: color,
    //             secondaryColour: secondaryColour,
    //             extensions: ["output_boolean"],
    //         });
    //     },
    // };

    // Blockly.Blocks.irRemoteReceiver_recivedCommand = {
    //     init: function () {
    //         this.jsonInit({
    //             message0: Blockly.Msg.IRREMOTERECEIVER_RECIVEDCOMMAND,
    //             colour: color,
    //             secondaryColour: secondaryColour,
    //             extensions: ["output_number"],
    //         });
    //     },
    // };

    // Blockly.Blocks.irRemoteReceiver_resume = {
    //     init: function () {
    //         this.jsonInit({
    //             message0: Blockly.Msg.IRREMOTERECEIVER_RESUME,
    //             colour: color,
    //             secondaryColour: secondaryColour,
    //             extensions: ["shape_statement"],
    //         });
    //     },
    // };

    return Blockly;
}

exports = addBlocks;
