const fourDigitDisplay = (formatMessage) => ({
    name: formatMessage({
        id: "fourDigitDisplay.name",
        default: "4-Digit Display",
    }),
    extensionId: "fourDigitDisplay",
    version: "1.0.0",
    supportDevice: [
        // "arduinoUno",
        // "arduinoNano",
        // "arduinoNano2",
        // "arduinoLeonardo",
        // "arduinoMega2560",
        // "arduinoEsp8266",
        // "arduinoEsp32",
    ],
    author: "ArthurZheng",
    iconURL: `asset/fourDigitClockDisplay.png`,
    description: formatMessage({
        id: "fourDigitDisplay.description",
        default: "4-digit display module based on TM1637.",
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

module.exports = fourDigitDisplay;
