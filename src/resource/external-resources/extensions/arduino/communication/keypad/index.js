const keypad = (formatMessage) => ({
    name: formatMessage({
        id: "keypad.name",
        default: "Keypad",
    }),
    extensionId: "keypad",
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
    author: "Mark Stanley,Alexander Brevig",
    iconURL: `asset/keypad.png`,
    description: formatMessage({
        id: "keypad.description",
        default: "Keypad",
    }),
    featured: true,
    blocks: "blocks.js",
    generator: "generator.js",
    toolbox: "toolbox.js",
    msg: "msg.js",
    library: "lib",
    official: true,
    tags: ["other"],
    helpLink: "https://wiki.openblock.cc",
});

module.exports = keypad;
