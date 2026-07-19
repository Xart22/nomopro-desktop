/**
 * Error Boundary for IPC handlers (L3)
 *
 * Wraps ipcMain.handle with try-catch, logging, and consistent error response.
 * Prevents unhandled rejections from crashing the app.
 */

const logger = require("./logger");
const { ipcMain } = require("electron");

/**
 * Register an IPC handler with automatic error boundary
 * @param {string} channel - IPC channel name
 * @param {Function} handler - async (event, ...args) => result
 */
function registerSafeHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const result = await handler(event, ...args);
      return result;
    } catch (err) {
      logger.error(`[IPC Error] ${channel}: ${err.message}`);
      return {
        success: false,
        error: err.message,
        channel,
        timestamp: new Date().toISOString(),
      };
    }
  });
}

module.exports = { registerSafeHandler };
