const rfid = (formatMessage) => ({
    name: "RFID",
    extensionId: "rfid",
    version: "1.0.0",
    supportDevice: [
        "arduinoUno",
        "arduinoNano",
        "arduinoNano2",
        "arduinoLeonardo",
        "arduinoMega2560",
    ],
    author: "SONG LIU",
    iconURL: `asset/rfid.png`,
    description: formatMessage({
        id: "rfid.description",
        default: "RFID RC522 sensor module",
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

module.exports = rfid;
