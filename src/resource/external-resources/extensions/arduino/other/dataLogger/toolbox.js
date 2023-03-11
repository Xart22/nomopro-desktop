/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_DATALOGGER_CATEGORY}" id="DATALOGGER_CATEGORY" colour="#3b3b3b" secondaryColour="#3b3b3b">
    <block type="dataLogger_init" id="dataLogger_init">
        <field name="CS">2</field>
    </block>
    <block type="dataLogger_openFile" id="dataLogger_openFile">
        <value name="NAME">
            <shadow type="text">
                <field name="TEXT">OB.txt</field>
            </shadow>
        </value>
    </block>
    <block type="dataLogger_closeFile" id="dataLogger_closeFile"></block>
    <block type="dataLogger_print" id="dataLogger_print">
        <value name="DATA">
            <shadow type="text">
                <field name="TEXT">Hello Openblock</field>
            </shadow>
        </value>
    </block>
    <block type="dataLogger_fileDataAvailable" id="dataLogger_fileDataAvailable"></block>
    <block type="dataLogger_readFileData" id="dataLogger_readFileData"></block>
    <block type="dataLogger_isFileExists" id="dataLogger_isFileExists">
        <value name="NAME">
            <shadow type="text">
                <field name="TEXT">OB.txt</field>
            </shadow>
        </value>
    </block>
    <block type="dataLogger_createFile" id="dataLogger_createFile">
        <value name="NAME">
            <shadow type="text">
                <field name="TEXT">OB.txt</field>
            </shadow>
        </value>
    </block>
    <block type="dataLogger_deleteFile" id="dataLogger_deleteFile">
        <value name="NAME">
            <shadow type="text">
                <field name="TEXT">OB.txt</field>
            </shadow>
        </value>
    </block>
</category>`;
}

exports = addToolbox;
