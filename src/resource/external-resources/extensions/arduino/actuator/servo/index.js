const irRemoteReceiver = (formatMessage) => ({
    name: formatMessage({
        id: "servo.name",
        default: "Servo",
    }),
    extensionId: "servo",
    version: "1.0.0",
    supportDevice: ["arduinoUno", "arduinoNano2", "arduinoNano"],
    author: "Robo Club",
    iconURL: `asset/servo.png`,
    description: formatMessage({
        id: "servoMotor.description",
        default: "Allows Arduino boards to control a variety of servo motors.",
    }),
    featured: true,
    blocks: "blocks.js",
    generator: "generator.js",
    toolbox: "toolbox.js",
    msg: "msg.js",
    library: "lib",
    official: true,
    tags: ["actuator"],
    helpLink: "https://nomokit.robo-club.com",
});

module.exports = irRemoteReceiver;
