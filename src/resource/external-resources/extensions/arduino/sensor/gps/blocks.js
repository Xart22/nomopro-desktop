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

    Blockly.Blocks.gps_init = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.GPS_INIT,
                args0: [ 
                    {
                        type: 'field_dropdown',
                        name: 'RX',
                        options: digitalPins
                    },
                    {
                        type: 'field_dropdown',
                        name: 'TX',
                        options: digitalPins
                    },
                    {
                        type: 'input_value',
                        name: 'BAUD'
                    },
                    // {
                    //     type: 'field_dropdown',
                    //     name: 'MODEL',
                    //     options: [
                    //         ['GP2Y0A21YK0F', 'GP2Y0A21YK0F'],
                    //         ['GP2Y0A02YK0F', 'GP2Y0A02YK0F'],
                    //         ['GP2Y0A710K0F', 'GP2Y0A710K0F']
                    //     ]
                    // }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.gps_location = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.GPS_LOCATION,
                args0: [
                     {
                        type: 'field_dropdown',
                        name: 'LOCATION',
                        options: [
                            ['lat', 'lat'],
                            ['lng', 'lng']
                        ]
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.gps_date = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.GPS_DATE,
                args0: [
                     {
                        type: 'field_dropdown',
                        name: 'DATE',
                        options: [
                            ['day', 'day'],
                            ['month', 'month'],
                            ['year', 'year']
                        ]
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_string']
            });
        }
    };

    Blockly.Blocks.gps_time = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.GPS_TIME,
                args0: [
                     {
                        type: 'field_dropdown',
                        name: 'TIME',
                        options: [
                            ['minute', 'minute'],
                            ['hour', 'hour'],
                            ['second', 'second'],
                            ['centisecond', 'centisecond']
                        ]
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.gps_check = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.GPS_CHECK,
                args0: [
                     {
                        type: 'field_dropdown',
                        name: 'CHECK',
                        options: [
                            ['date', 'date'],
                            ['location', 'location'],
                            ['time', 'time']
                        ]
                    }
                ],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_boolean']
            });
        }
    };

    return Blockly;
}

exports = addBlocks;
