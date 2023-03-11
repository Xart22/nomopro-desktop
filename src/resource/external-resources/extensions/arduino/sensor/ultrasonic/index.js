const ultrasonic = (formatMessage) => ({
    name: formatMessage({
        id: "ultrasonic.name", //edit id sesuai sensor
        default: "Ultrasonic",
    }),
    extensionId: "ultrasonic",
    version: "1.0.0",
    supportDevice: [
        "arduinoUno",
        "arduinoNano",
        "arduinoLeonardo",
        "arduinoMega2560",
        "arduinoEsp32",
        "arduinoEsp8266",
        "arduinoNano2",
    ],
    author: "Liang",
    iconURL: `asset/ultrasonic.png`,
    description: formatMessage({
        id: "ultrasonic.description",
        default: "Standard ultrasonic distance measurement module.",
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

module.exports = ultrasonic;
