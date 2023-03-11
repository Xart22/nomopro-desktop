/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addBlocks (Blockly) {
    const color = '#9F0050';
    const secondaryColour = '#820041';

    const digitalPins = Blockly.getMainWorkspace().getFlyout()
        .getFlyoutItems()
        .find(block => block.type === 'arduino_pin_setDigitalOutput')
        .getField('PIN')
        .getOptions();

    Blockly.Blocks.rtc_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RTC_INIT,
                // args0: [ 
                //     {
                //         type: 'field_dropdown',
                //         name: 'SDA',
                //         options: digitalPins
                //     },
                //     {
                //         type: 'field_dropdown',
                //         name: 'SCL',
                //         options: digitalPins
                //     },
                //     // {
                //     //     type: 'field_dropdown',
                //     //     name: 'MODEL',
                //     //     options: [
                //     //         ['GP2Y0A21YK0F', 'GP2Y0A21YK0F'],
                //     //         ['GP2Y0A02YK0F', 'GP2Y0A02YK0F'],
                //     //         ['GP2Y0A710K0F', 'GP2Y0A710K0F']
                //     //     ]
                //     // }
                // ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    // Blockly.Blocks.rtc_setDate = {
    //     init: function () {
    //         this.jsonInit({
    //             message0: Blockly.Msg.RTC_SETDATE,
    //             args0: [
    //                 {
    //                     type: 'input_value',
    //                     name: 'DAY'
    //                 },
    //                 {
    //                     type: 'input_value',
    //                     name: 'MONTH'
    //                 },
    //                 {
    //                     type: 'input_value',
    //                     name: 'YEAR'
    //                 }
    //             ],
    //             colour: color,
    //             secondaryColour: secondaryColour,
    //             extensions: ['shape_statement']
    //         });
    //     }
    // };

    // Blockly.Blocks.rtc_setTime = {
    //     init: function () {
    //         this.jsonInit({
    //             message0: Blockly.Msg.RTC_SETTIME,
    //             args0: [
    //                 {
    //                     type: 'input_value',
    //                     name: 'HOUR'
    //                 },
    //                 {
    //                     type: 'input_value',
    //                     name: 'MINUTE'
    //                 },
    //                 {
    //                     type: 'input_value',
    //                     name: 'SECOND'
    //                 }
    //             ],
    //             colour: color,
    //             secondaryColour: secondaryColour,
    //             extensions: ['shape_statement']
    //         });
    //     }
    // };

    // Blockly.Blocks.rtc_setDow = {
    //     init: function () {
    //         this.jsonInit({
    //             message0: Blockly.Msg.RTC_SETDOW,
    //             args0: [
    //                 {
    //                     type: 'input_value',
    //                     name: 'DOW'
    //                 }
    //             ],
    //             colour: color,
    //             secondaryColour: secondaryColour,
    //             extensions: ['shape_statement']
    //         });
    //     }
    // };

    Blockly.Blocks.rtc_getDowStr = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RTC_GETDOW,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_string']
            });
        }
    };

    Blockly.Blocks.rtc_getDateStr = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RTC_GETDATE,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_string']
            });
        }
    };

    Blockly.Blocks.rtc_getYear = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RTC_GETYEAR,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_string']
            });
        }
    };

     Blockly.Blocks.rtc_getMonth = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RTC_GETMONTH,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_string']
            });
        }
    };

    Blockly.Blocks.rtc_getHour = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RTC_GETHOUR,
                colour: color,
                args0: [ 
                    {
                        type: 'field_dropdown',
                        name: '12H',
                        options: [
                            ['true', true],
                            ['false', false]
                        ]
                    },
                    {
                        type: 'field_dropdown',
                        name: 'PM',
                        options: [
                            ['true', true],
                            ['false', false]
                        ]
                    }
                ],
                secondaryColour: secondaryColour,
                extensions: ['output_string']
            });
        }
    };

    Blockly.Blocks.rtc_getMinute = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RTC_GETMINUTE,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_string']
            });
        }
    };

    Blockly.Blocks.rtc_getSecond = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RTC_GETSECOND,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_string']
            });
        }
    };

    Blockly.Blocks.rtc_getTemperature = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RTC_GETTEMPERATURE,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_string']
            });
        }
    };

    Blockly.Blocks.rtc_osilatorCheck = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.RTC_OSILATORCHECK,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_boolean']
            });
        }
    };
    
    // Blockly.Blocks.rtc_getTimeStr = {
    //     init: function () {
    //         this.jsonInit({
    //             message0: Blockly.Msg.RTC_GETTIMESTR,
    //             colour: color,
    //             secondaryColour: secondaryColour,
    //             extensions: ['output_string']
    //         });
    //     }
    // };

    return Blockly;
}

exports = addBlocks;
