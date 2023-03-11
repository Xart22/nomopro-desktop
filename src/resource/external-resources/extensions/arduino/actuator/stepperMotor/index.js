const l298n = (formatMessage) => ({
    name: "Stepper Motor",
    extensionId: "stepperMotor",
    version: "1.1.3",
    supportDevice: [
        "arduinoUno",
        "arduinoNano",
        "arduinoNano2",
        "arduinoLeonardo",
        "arduinoMega2560",
        "arduinoEsp8266",
    ],
    author: "Tom Igoe",
    iconURL: `asset/stepper.png`,
    description: formatMessage({
        id: "stepperMotor.description",
        default: "Stepper motor drive module.",
    }),
    featured: true,
    blocks: "blocks.js",
    generator: "generator.js",
    toolbox: "toolbox.js",
    msg: "msg.js",
    library: "lib",
    official: true,
    tags: ["actuator"],
    helpLink: "https://wiki.openblock.cc",
});

module.exports = l298n;
