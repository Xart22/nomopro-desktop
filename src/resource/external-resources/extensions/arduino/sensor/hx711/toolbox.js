/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_HX711_CATEGORY}" id="HX711_CATEGORY" colour="#AE00AE" secondaryColour="#930093">
    <block type="hx711_init" id="hx711_init">
        <field name="DOUT">2</field>
        <field name="CLK">3</field>
    </block>
    <block type="hx711_getUnits" id="hx711_getUnits">
    </block>
    <block type="hx711_setScale" id="hx711_setScale">
        <value name="CALIBRATION_FACTOR">
            <shadow type="math_whole_number">
                <field name="NUM">200</field>
            </shadow>
        </value>
    </block>
    <block type="hx711_tare" id="hx711_tare">
    </block>
    <block type="hx711_readAverage" id="hx711_readAverage">
    </block>
</category>`;
}

exports = addToolbox;
