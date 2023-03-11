/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_STEPPERMOTOR_CATEGORY}" id="STEPPERMOTOR_CATEGORY" colour="#FF6F00" secondaryColour="#FF4F00">
    <block type="stepperMotor_init" id="stepperMotor_init">
        <value name="CH">
            <shadow type="math_whole_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
        <value name="STEP">
            <shadow type="math_whole_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
        <field name="PIN1">2</field>
        <field name="PIN2">3</field>
        <field name="PIN3">4</field>
        <field name="PIN4">5</field>
    </block>
    <block type="stepperMotor_speed" id="stepperMotor_speed">
        <value name="CH">
            <shadow type="math_whole_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
        <value name="SPEED">
            <shadow type="math_int9_number">
                <field name="NUM">255</field>
            </shadow>
        </value>
    </block>
    <block type="stepperMotor_step" id="stepperMotor_step">
        <value name="CH">
            <shadow type="math_whole_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
        <value name="STEP">
            <shadow type="math_int9_number">
                <field name="NUM">100</field>
            </shadow>
        </value>
    </block>
</category>`;
}

exports = addToolbox;
