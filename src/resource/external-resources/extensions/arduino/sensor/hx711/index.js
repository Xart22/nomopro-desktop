const hx711 = (formatMessage) => ({
    name: "HX711",
    extensionId: "hx711",
    version: "1.0.0",
    supportDevice: [
        "arduinoUno",
        "arduinoNano",
        "arduinoNano2",
        "arduinoLeonardo",
        "arduinoMega2560",
    ],
    author: "github.com/bogde",
    iconURL: `asset/hx711.png`,
    description: formatMessage({
        id: "hx711.description",
        default: "Load sensor module based on HX711.",
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

module.exports = hx711;
