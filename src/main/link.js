const path = require("path");
const OpenBlockLink = require("../link/src");
const logger = require("./logger");
const { getAppDataPath } = require("./appdata");

function startLink({ win, userDataPath, toolsPath } = {}) {
  const resolvedToolsPath = toolsPath || path.join(__dirname, "../link/tools");
  const resolvedUserDataPath = userDataPath || getAppDataPath("link-data");

  // Arduino tools update dihapus dari auto-startup.
  // User bisa trigger manual via menu: Tools > Arduino Board > Install/Uninstall Board.

  const link = new OpenBlockLink(resolvedUserDataPath, resolvedToolsPath);
  link.listen();
  logger.info("Link server started (module)");
  return link;
}

module.exports = { startLink };
