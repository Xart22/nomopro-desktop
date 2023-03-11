/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_GPRS_CATEGORY}" id="GPRS_CATEGORY" colour="#BBBB00" secondaryColour="#888800">
    <block type="gprs_init" id="gprs_init">
    </block>
    <block type="gprs_preInit" id="gprs_preInit">
    </block>
    <block type="gprs_sendSms" id="gprs_sendSms">
        <value name="NUMBER">
            <shadow type="text">
                <field name="TEXT">081212341234</field>
            </shadow>
        </value>
        <value name="MESSAGE">
            <shadow type="text">
                <field name="TEXT">Hello Nomokit!</field>
            </shadow>
        </value>
    </block>
</category>`;
}

exports = addToolbox;
