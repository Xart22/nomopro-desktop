/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_KEYPAD_CATEGORY}" id="KEYPAD_CATEGORY" colour="#FF3399" secondaryColour="#C71585">
    <block type="keypad_init" id="keypad_init">
    </block>
    <block type="keypad_getKey" id="keypad_getKey">
    </block>
</category>`;
}

exports = addToolbox;
