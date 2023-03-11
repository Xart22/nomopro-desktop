/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_SEVENSEGMENT_CATEGORY}" id="SEVENSEGMENT_CATEGORY" colour="#FF7F50" secondaryColour="#FF6347">
    <block type="sevenSegment_init" id="sevenSegment_init">
    </block>
     <block type="sevenSegment_showDigit" id="sevenSegment_showDigit">
    </block>
    <block type="sevenSegment_show" id="sevenSegment_show">
        <value name="DIGIT">
            <shadow type="math_whole_number">
                <field name="NUM">1</field>
            </shadow>
        </value>
    </block>
</category>`;
}

exports = addToolbox;
