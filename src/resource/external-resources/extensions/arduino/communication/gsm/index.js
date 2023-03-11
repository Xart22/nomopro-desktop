const gprs = (formatMessage) => ({
    name: formatMessage({
        id: "gprs.name",
        default: "GSM Module",
    }),
    extensionId: "gprs",
    version: "1.0.0",
    supportDevice: [
        "arduinoUno",
        "arduinoNano",
        "arduinoLeonardo",
        "arduinoNano2",
        "arduinoMega2560",
        "arduinoEsp8266",
        "arduinoEsp32",
    ],
    author: "ArthurZheng",
    iconURL: `asset/gprs.png`,
    description: formatMessage({
        id: "gprs.description",
        default:
            "module used for voice calls, SMS and GPRS. SIM 800L V2 one GSM GPRS.",
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

module.exports = gprs;
