const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { dialog, app } = require("electron");
const logger = require("./logger");

function initSocket({ socket, appRoot, win }) {
  socket.on("disconnect", () => {
    if (win && !win.isDestroyed())
      win.loadFile(path.join(appRoot, "/src/connection/index.html"));
  });

  socket.on("connect", () => {
    try {
      const token = JSON.parse(
        fs.readFileSync(path.join(appRoot, "data/user.json"), "utf8"),
      );
      if (token.token !== undefined) {
        const { setMenu } = require(path.join(appRoot, "src/main/menu"));
        setMenu({ win, appRoot, app });
        if (win && !win.isDestroyed())
          win.loadFile(path.join(appRoot, "/src/gui/index.html"));
      } else {
        if (win && !win.isDestroyed())
          win.loadFile(path.join(appRoot, "/src/auth/index.html"));
      }
    } catch (e) {
      logger.error("Error handling socket connect:", e);
    }
  });

  socket.on("login-fail", async (data) => {
    try {
      const token = JSON.parse(
        fs.readFileSync(path.join(appRoot, "data/user.json"), "utf8"),
      );
      if (data === token.token) {
        try {
          await axios.get("https://nomo-kit.com/api/logout", {
            headers: { Authorization: "Bearer " + token.token },
          });
        } catch (e) {
          logger.warn("Logout request failed, continuing: " + e.message);
        }
        try {
          fs.writeFileSync(
            path.join(appRoot, "data/user.json"),
            JSON.stringify({}),
          );
        } catch (e) {
          logger.error("Failed to clear user.json: " + e.message);
        }
        dialog.showErrorBox(
          "Error: ",
          "Seseorang telah login dengan akun anda, silahkan login kembali",
        );
        app.relaunch();
        app.exit();
      }
    } catch (err) {
      logger.error("login-fail handler error: " + err.message);
    }
  });
}

module.exports = { initSocket };
