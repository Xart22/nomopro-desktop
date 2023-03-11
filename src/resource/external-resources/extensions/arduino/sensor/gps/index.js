const gps = (formatMessage) => ({
    name: formatMessage({
        id: "gps.name",
        default: "GPS Module",
    }),
    extensionId: "gps",
    version: "1.0.0",
    supportDevice: [
        "arduinoUno",
        "arduinoNano",
        "arduinoNano2",
        "arduinoLeonardo",
        "arduinoMega2560",
        "arduinoEsp8266",
    ],
    author: "Mikal Hart",
    iconURL: `asset/gps.png`,
    description: formatMessage({
        id: "gps.description",
        default: "GPS sensor module",
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

module.exports = gps;
