const dataLogger = (formatMessage) => ({
    name: formatMessage({
        id: "dataLogger.name",
        default: "Data Logger Module",
    }),
    extensionId: "dataLogger",
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
    author: "Robo Club",
    iconURL: `asset/dataLogger.png`,
    description: formatMessage({
        id: "dataLogger.description",
        default: "Data Logger Module.",
    }),
    featured: true,
    blocks: "blocks.js",
    generator: "generator.js",
    toolbox: "toolbox.js",
    msg: "msg.js",
    library: "lib",
    official: true,
    tags: ["shield"],
    helpLink: "https://wiki.openblock.cc",
});

module.exports = dataLogger;
