const hmc5883l = (formatMessage) => ({
    name: formatMessage({
        id: "hmc5883l.name",
        default: "HMC5883L Sensor",
    }),
    extensionId: "hmc5883l",
    version: "1.0.0",
    supportDevice: [
        "arduinoUno",
        "arduinoNano",
        "arduinoNano2",
        "arduinoLeonardo",
        "arduinoMega2560",
        "arduinoEsp32",
        "arduinoEsp8266",
    ],
    author: "ArthurZheng",
    iconURL: `asset/hmc5883l.png`,
    description: formatMessage({
        id: "hmc5883l.description",
        default: "HMC5883L Triple Axis Digital Compass Arduino Library",
    }),
    featured: true,
    blocks: "blocks.js",
    generator: "generator.js",
    toolbox: "toolbox.js",
    msg: "msg.js",
    library: "lib",
    official: true,
    tags: ["sensor"],
    helpLink: "https://wiki.openblock.cc",
});

module.exports = hmc5883l;
