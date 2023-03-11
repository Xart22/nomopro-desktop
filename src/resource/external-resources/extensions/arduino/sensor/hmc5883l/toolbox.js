/* eslint-disable func-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
function addToolbox () {
    return `
<category name="%{BKY_HMC5883L_CATEGORY}" id="HMC5883L_CATEGORY" colour="#0066CC" secondaryColour="#005AB5">
    <block type="hmc5883l_init" id="hmc5883l_init"></block>
    <block type="hmc5883l_setRange" id="hmc5883l_setRange">
      <field name="RANGE">HMC5883L_RANGE_1_3GA</field>
    </block>
    <block type="hmc5883l_setMeasurementMode" id="hmc5883l_setMeasurementMode">
      <field name="MEASUREMENTMODE">HMC5883L_CONTINOUS</field>  
    </block>
    <block type="hmc5883l_setDataRate" id="hmc5883l_setDataRate">
        <field name="DATARATE">HMC5883L_DATARATE_15HZ</field>  
    </block>
    <block type="hmc5883l_setSamples" id="hmc5883l_setSamples">
        <field name="SAMPLES">HMC5883L_SAMPLES_1</field>  
    </block>
    <block type="hmc5883l_checkSettings" id="hmc5883l_checkSettings"></block>
    <block type="hmc5883l_getRange" id="hmc5883l_getRange"></block>
    <block type="hmc5883l_getMeasurementMode" id="hmc5883l_getMeasurementMode"></block>
    <block type="hmc5883l_getDataRate" id="hmc5883l_getDataRate"></block>
    <block type="hmc5883l_getSamples" id="hmc5883l_getSamples"></block>
    <block type="hmc5883l_initReadRaws" id="hmc5883l_initReadRaws"></block>
    <block type="hmc5883l_initReadNormalize" id="hmc5883l_initReadNormalize"></block>
    <block type="hmc5883l_readNormalize" id="hmc5883l_readNormalize">
        <field name="AXIS">XAxis</field>  
    </block>
    <block type="hmc5883l_readRaws" id="hmc5883l_readRaws">
        <field name="AXIS">XAxis</field>  
    </block>
</category>`;
}

exports = addToolbox;
