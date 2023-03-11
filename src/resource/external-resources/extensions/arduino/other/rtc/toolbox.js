/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_RTC_CATEGORY}" id="RTC_CATEGORY" colour="#9F0050" secondaryColour="#820041">
    <block type="rtc_init" id="rtc_init">
    </block>
    <block type="rtc_getDowStr" id="rtc_getDowStr">
    </block>
    <block type="rtc_getDateStr" id="rtc_getDateStr">
    </block>
    <block type="rtc_getYear" id="rtc_getYear">
    </block>
     <block type="rtc_getMonth" id="rtc_getMonth">
    </block>
     <block type="rtc_getHour" id="rtc_getHour">
     <field name="12H">true</field>
     <field name="PM">true</field>    
    </block>
     <block type="rtc_getMinute" id="rtc_getMinute">
    </block>
     <block type="rtc_getSecond" id="rtc_getSecond">
    </block>
     <block type="rtc_getTemperature" id="rtc_getTemperature">
    </block>
     <block type="rtc_osilatorCheck" id="rtc_osilatorCheck">
    </block>
</category>`;
}

exports = addToolbox;
