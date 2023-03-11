/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_RFID_CATEGORY}" id="RFID_CATEGORY" colour="#AE00AE" secondaryColour="#930093">
    <block type="rfid_init" id="dht_init">
        <field name="SDA">10</field>
        <field name="RESET">9</field>
    </block>
    <block type="rfid_isCard" id="rfid_isCard">
    </block>
    <block type="rfid_readCardSerial" id="rfid_readCardSerial">
    </block>
    <block type="rfid_serialNum" id="rfid_serialNum">
        <value name="NUMBER">
            <shadow type="math_whole_number">
                <field name="NUM">1</field>
            </shadow>
        </value>
    </block>
</category>`;
}

exports = addToolbox;
