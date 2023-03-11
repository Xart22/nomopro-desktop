const irRemoteReceiver = (formatMessage) => ({
    name: formatMessage({
        id: "irRemoteReceiver.name",
        default: "IR Remote Receiver",
    }),
    extensionId: "irRemoteReceiver",
    version: "1.0.0",
    supportDevice: [
        "arduinoUno",
        "arduinoNano",
        "arduinoLeonardo",
        "arduinoMega2560",
        "arduinoEsp32",
        "arduinoNano2",
        "arduinoEsp8266",
    ],
    author: "ArthurZheng",
    iconURL: `asset/irRemoteReceiver.png`,
    description: formatMessage({
        id: "irRemoteReceiver.description",
        default: "Receiving and decoding data in infrared carrier.",
    }),
    featured: true,
    blocks: "blocks.js",
    generator: "generator.js",
    toolbox: "toolbox.js",
    msg: "msg.js",
    library: "lib",
    official: true,
    tags: ["communication"],
    helpLink: "https://wiki.openblock.cc",
});

module.exports = irRemoteReceiver;
