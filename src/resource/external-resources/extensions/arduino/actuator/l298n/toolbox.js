/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_L298N_CATEGORY}" id="L298N_CATEGORY" colour="#FF6F00" secondaryColour="#FF4F00">
    <block type="l298n_init" id="l298n_init">
        <value name="CH">
            <shadow type="math_whole_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
        <field name="IN1">2</field>
        <field name="IN2">3</field>
        <field name="EN">5</field>
    </block>
    <block type="l298n_run" id="l298n_run">
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
    <block type="l298n_stop" id="l298n_stop">
        <value name="CH">
            <shadow type="math_whole_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
    </block>
    <block type="l298nx2_init" id="l298nx2_init">
        <value name="CH">
            <shadow type="math_whole_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
        <field name="IN1_A">2</field>
        <field name="IN2_A">3</field>
        <field name="EN_A">5</field>
        <field name="IN1_B">4</field>
        <field name="IN2_B">5</field>
        <field name="EN_B">9</field>
    </block>
     <block type="l298nx2_movement" id="l298nx2_movement">
        <value name="CH">
            <shadow type="math_whole_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
         <field name="MOVEMENT">forward</field>
    </block>
     <block type="l298nx2_speed" id="l298nx2_speed">
        <value name="CH">
            <shadow type="math_whole_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
        <value name="SPEED">
            <shadow type="math_whole_number">
                <field name="NUM">80</field>
            </shadow>
        </value>
    </block>
     <block type="l298nx2_movementSingle" id="l298nx2_movementSingle">
        <value name="CH">
            <shadow type="math_whole_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
        <field name="MOTOR">A</field>
        <field name="MOVEMENT">forward</field>
    </block>
    <block type="l298nx2_speedSingle" id="l298nx2_speedSingle">
        <value name="CH">
            <shadow type="math_whole_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
        <field name="MOTOR">A</field>
        <value name="SPEED">
            <shadow type="math_whole_number">
                <field name="NUM">80</field>
            </shadow>
        </value>
    </block>
</category>`;
}

exports = addToolbox;
