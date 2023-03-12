/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_RTC_CATEGORY}" id="RTC_CATEGORY" colour="#9F0050" secondaryColour="#820041">
    <block type="rtc_init" id="rtc_init">
    </block>
     <block type="rtc_getTemperature" id="rtc_getTemperature">
    </block>
    <block type="rtc_now" id="rtc_now">
     <field name="TYPE">year</field>  
    </block>
</category>`;
}

exports = addToolbox;
