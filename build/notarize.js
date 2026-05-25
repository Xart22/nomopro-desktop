/**
 * Notarization script for macOS builds
 *
 * Uses xcrun notarytool directly (no npm dependency needed).
 * Requires environment variables:
 *   APPLE_ID                    — Apple ID email
 *   APPLE_APP_SPECIFIC_PASSWORD — App-specific password
 *   APPLE_TEAM_ID               — Team ID (optional)
 *
 * Windows signing uses electron-builder built-in via:
 *   WIN_CSC_LINK           — Path to .pfx or .p12 certificate file
 *   WIN_CSC_KEY_PASSWORD   — Certificate password
 */

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.default = async function (context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== "darwin") {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) {
    console.warn("[notarize] App not found at", appPath);
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const appleTeamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword) {
    console.warn(
      "[notarize] Skipping: APPLE_ID and APPLE_APP_SPECIFIC_PASSWORD must be set"
    );
    return;
  }

  const dmgPath = appPath.replace(/\.app$/, ".dmg");

  console.log("[notarize] Submitting to Apple notary service...");

  // Submit to notary service
  const submitArgs = ["notarytool", "submit", dmgPath || appPath];
  submitArgs.push("--apple-id", appleId);
  submitArgs.push("--password", appleIdPassword);
  if (appleTeamId) {
    submitArgs.push("--team-id", appleTeamId);
  }
  submitArgs.push("--wait");

  const result = spawnSync("xcrun", submitArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 600000,
  });

  if (result.status === 0) {
    console.log("[notarize] Notarization submitted successfully");
  } else {
    console.error("[notarize] Notarization failed:", result.stderr || result.stdout);
  }
};
