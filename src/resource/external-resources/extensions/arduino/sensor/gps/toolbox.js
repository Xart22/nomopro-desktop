/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_GPS_CATEGORY}" id="GPS_CATEGORY" colour="#9F0050" secondaryColour="#820041">
    <block type="gps_init" id="gps_init">
        <field name="RX">1</field>
        <field name="TX">2</field>
         <value name="BAUD">
            <shadow type="math_whole_number">
                <field name="NUM">4800</field>
            </shadow>
        </value>
    </block>
    <block type="gps_location" id="gps_location">
        <field name="LOCATION">lat</field>
    </block>
    <block type="gps_date" id="gps_date">
        <field name="DATE">day</field>
    </block>
     <block type="gps_time" id="gps_time">
        <field name="TIME">hour</field>
    </block>
    <block type="gps_check" id="gps_check">
        <field name="CHECK">date</field>
    </block>
</category>`;
}

exports = addToolbox;
