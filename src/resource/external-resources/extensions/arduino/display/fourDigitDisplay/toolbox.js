/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_DISPLAYFOURDIGITDISPLAY_CATEGORY}" id="DISPLAYFOURDIGITDISPLAY_CATEGORY" colour="#FF7F50" secondaryColour="#FF6347">
    <block type="displayFourDigitDisplay_init" id="displayFourDigitDisplay_init">
        <field name="DIO">2</field>
        <field name="CLK">3</field>
    </block>
    <block type="displayFourDigitDisplay_test" id="displayFourDigitDisplay_test">
    </block>
    <block type="displayFourDigitDisplay_segment" id="displayFourDigitDisplay_segment">
        <value name="SEGMENT">
            <shadow type="math_integer">
                <field name="NUM">0</field>
            </shadow>
        </value>
        <value name="VALUE">
            <shadow type="math_uint8_number">
                <field name="TEXT"></field>
            </shadow>
        </value>
         <value name="DESC">
            <shadow type="text">
                <field name="TEXT">Hello</field>
            </shadow>
        </value>
    </block>
    <block type="displayFourDigitDisplay_show" id="displayFourDigitDisplay_show">
        <value name="SEGMENT">
            <shadow type="math_integer">
                <field name="NUM">0</field>
            </shadow>
        </value>
    </block>
</category>`;
}

exports = addToolbox;
