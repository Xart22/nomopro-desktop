/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_BH1750_CATEGORY}" id="BH1750_CATEGORY" colour="#AE00AE" secondaryColour="#930093">
    <block type="bh1750_init" id="bh1750_init">
    </block>
    <block type="bh1750_readLightLevel" id="bh1750_readLightLevel">
    </block>
</category>`;
}

exports = addToolbox;
