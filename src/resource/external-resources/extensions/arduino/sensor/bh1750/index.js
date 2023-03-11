const bh1750 = (formatMessage) => ({
    name: "BH1750",
    extensionId: "bh1750",
    version: "1.0.0",
    supportDevice: [
        "arduinoUno",
        "arduinoNano",
        "arduinoNano2",
        "arduinoLeonardo",
        "arduinoMega2560",
    ],
    author: "Christopher Laws",
    iconURL: `asset/bh1750.png`,
    description: formatMessage({
        id: "bh1750.description",
        default: "Digital Ambient Light Sensor IC for I2C bus interface.",
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

module.exports = bh1750;
