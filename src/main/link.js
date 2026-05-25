const { EventEmitter } = require("events");
const path = require("path");
const OpenBlockLink = require("../link/src");
const logger = require("./logger");
const { checkArduinoUpdateNeeded, startArduinoUpdate } = require("./arduino-updater");
const { showArduinoUpdateWindow } = require("./arduino-update-window");

function startLink({ win, userDataPath, toolsPath } = {}) {
  const resolvedToolsPath =
    toolsPath || path.join(__dirname, "../link/tools");

  const info = checkArduinoUpdateNeeded({ toolsPath: resolvedToolsPath });
  if (info) {
    logger.info("Arduino tools update required, showing progress window");
    const emitter = new EventEmitter();
    showArduinoUpdateWindow({ emitter });
    try {
      startArduinoUpdate({ emitter, ...info });
    } catch (e) {
      logger.error("startArduinoUpdate failed: " + e.message);
      emitter.emit("error", { message: e.message });
    }
  }

  const link = new OpenBlockLink(userDataPath, resolvedToolsPath);
  link.listen();
  logger.info("Link server started (module)");
  return link;
}

module.exports = { startLink };
