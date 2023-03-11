/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox() {
    return `
<category name="%{BKY_SERVO_UNO_CATEGORY}" id="SERVO_UNO_CATEGORY" colour="#BB5E00" secondaryColour="#9F5000">
    <block type="servo_init" id="servo_init">
        <value name="NO">
            <shadow type="math_whole_number">
                <field name="NUM">1</field>
            </shadow>
        </value>
        <field name="PIN">2</field>
    </block>
   <block type="servo_write" id="servo_write">
     <value name="NO">
            <shadow type="math_whole_number">
                <field name="NUM">1</field>
            </shadow>
      </value>
      <value name="DEGREE">
        <shadow type="math_number">
          <field name="NUM">90</field>
        </shadow>
      </value>
    </block>
</category>`;
}

exports = addToolbox;
