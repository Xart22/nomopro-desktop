const sevenSegment = (formatMessage) => ({
    name: formatMessage({
        id: "sevenSegment.name",
        default: "Seven Segment",
    }),
    extensionId: "sevenSegment",
    version: "1.0.0",
    supportDevice: [
        "arduinoUno",
        "arduinoNano",
        "arduinoNano2",
        "arduinoLeonardo",
        "arduinoMega2560",
        "arduinoEsp8266",
        "arduinoEsp32",
    ],
    author: "ArthurZheng",
    iconURL: `asset/sevenSegment.png`,
    description: formatMessage({
        id: "sevenSegment.description",
        default: "Seven Segment Display.",
    }),
    featured: true,
    blocks: "blocks.js",
    generator: "generator.js",
    toolbox: "toolbox.js",
    msg: "msg.js",
    library: "lib",
    official: true,
    tags: ["display"],
    helpLink: "https://wiki.openblock.cc",
});

module.exports = sevenSegment;
