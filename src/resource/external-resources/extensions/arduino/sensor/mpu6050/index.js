const mpu6050 = (formatMessage) => ({
    name: formatMessage({
        id: "mpu6050.name",
        default: "MPU6050 Sensor",
    }),
    extensionId: "mpu6050",
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
    author: "ArthurZheng",
    iconURL: `asset/mpu6050.png`,
    description: formatMessage({
        id: "mpu6050.description",
        default: "6-axis attitude sensor module based on MPU6050.",
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

module.exports = mpu6050;
