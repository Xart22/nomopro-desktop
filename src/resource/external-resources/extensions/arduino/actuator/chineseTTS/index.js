const chineseTTS = formatMessage => ({
    name: formatMessage({
        id: 'chineseTTS.name',
        default: 'Chinese TTS'
    }),
    extensionId: 'chineseTTS',
    version: '1.0.0',
    supportDevice: [],
    author: 'ArthurZheng',
    iconURL: `asset/chineseTTS.png`,
    description: formatMessage({
        id: 'chineseTTS.description',
        default: 'Text to speech module based on SYN6288, support Chinese and English letters and numbers.'
    }),
    featured: true,
    blocks: 'blocks.js',
    generator: 'generator.js',
    toolbox: 'toolbox.js',
    msg: 'msg.js',
    library: 'lib',
    official: true,
    tags: ['actuator'],
    helpLink: 'https://wiki.openblock.cc'
});

module.exports = chineseTTS;
