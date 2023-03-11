const rtc = (formatMessage) => ({
    name: formatMessage({
        id: "rtc.name",
        default: "RTC Module",
    }),
    extensionId: "rtc",
    version: "1.0.0",
    supportDevice: [
        "arduinoUno",
        "arduinoNano",
        "arduinoNano2",
        "arduinoLeonardo",
        "arduinoMega2560",
        "arduinoEsp8266",
    ],
    author: "Petre Rodan",
    iconURL: `asset/ds3231.png`,
    description: formatMessage({
        id: "rtc.description",
        default: "RTC sensor module",
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

module.exports = rtc;
