const logger = require("electron-log");
const os = require("os");

logger.transports.file.level = "info";
logger.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB max (L4)
logger.transports.file.appName = "nomopro-desktop";

// Rotate: keep last 3 log files
logger.transports.file.fileName = "nomopro.log";
logger.transports.file.archiveLog = (oldLogPath) => {
  const path = require("path");
  const fs = require("fs");
  const dir = path.dirname(oldLogPath);
  const basename = path.basename(oldLogPath, ".log");
  // Keep up to 3 rotated files
  for (let i = 3; i >= 1; i--) {
    const oldFile = path.join(dir, `${basename}.${i}.log`);
    const newFile = path.join(dir, `${basename}.${i + 1}.log`);
    if (fs.existsSync(oldFile)) {
      if (i === 3) {
        fs.unlinkSync(oldFile);
      } else {
        fs.renameSync(oldFile, newFile);
      }
    }
  }
  const firstRotate = path.join(dir, `${basename}.1.log`);
  fs.renameSync(oldLogPath, firstRotate);
};

module.exports = logger;
