/**
 * Project Dependency Profile (Phase 7 — Step 25)
 *
 * Manages requirements.txt snapshot per project:
 * - Generate requirements.txt from currently installed packages
 * - Install from requirements.txt
 * - Import/export profile between projects/users
 * - Diff support: show what's missing/extra vs snapshot
 */

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");
const { ipcMain } = require("electron");

/**
 * Get the project deps directory
 */
const getDepsDir = (appRoot) => {
  return path.join(appRoot, "data", "project-deps");
};

/**
 * Get the path to a project's requirements file
 */
const sanitizeProjectId = (id) => {
  if (!id) return "default";
  // Only allow alphanumeric, hyphens, underscores, dots
  return String(id).replace(/[^a-zA-Z0-9_\-.]/g, "_");
};

const getRequirementsPath = (appRoot, projectId) => {
  const dir = getDepsDir(appRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const safeId = sanitizeProjectId(projectId);
  return path.join(dir, `${safeId}-requirements.txt`);
};

/**
 * Generate requirements.txt from currently installed packages in venv
 * Uses pip freeze to capture exact versions
 */
const generateRequirements = async (event, { appRoot, projectId = "default" }) => {
  const { getVenvPaths, ensureVirtualEnv } = require("./pip-manager");

  const venvResult = ensureVirtualEnv(appRoot);
  if (!venvResult.success) {
    return venvResult;
  }

  const result = spawnSync(venvResult.venvPaths.pip, ["freeze"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15000,
  });

  if (result.status !== 0) {
    return { success: false, error: (result.stderr || "pip freeze failed").trim() };
  }

  const depsPath = getRequirementsPath(appRoot, projectId);
  // Filter out pip, setuptools, wheel (base venv packages)
  const lines = result.stdout
    .split("\n")
    .filter((line) => {
      const l = (line || "").trim();
      if (!l || l.startsWith("#")) return false;
      const name = l.split("==")[0].split(">=")[0].split("@")[0].trim().toLowerCase();
      return !["pip", "setuptools", "wheel"].includes(name);
    })
    .join("\n");

  fs.writeFileSync(depsPath, lines + "\n", "utf8");
  logger.info(`Requirements generated for project ${projectId} at ${depsPath}`);

  return {
    success: true,
    path: depsPath,
    requirements: lines,
    packageCount: lines ? lines.split("\n").filter(Boolean).length : 0,
  };
};

/**
 * Install packages from a requirements file into the venv
 */
const installFromRequirements = async (event, { appRoot, projectId = "default", requirementsContent }) => {
  const { getVenvPaths, ensureVirtualEnv } = require("./pip-manager");

  const venvResult = ensureVirtualEnv(appRoot);
  if (!venvResult.success) {
    return venvResult;
  }

  // Write temporary requirements file
  const tmpFile = path.join(getDepsDir(appRoot), `_tmp_${projectId || "default"}.txt`);
  fs.writeFileSync(tmpFile, requirementsContent || "", "utf8");

  try {
    const result = spawnSync(venvResult.venvPaths.pip, [
      "install", "-r", tmpFile, "--quiet"
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });

    if (result.status !== 0) {
      return {
        success: false,
        error: (result.stderr || result.stdout || "pip install failed").trim(),
        exitCode: result.status,
      };
    }

    // Save the requirements as the project snapshot
    const depsPath = getRequirementsPath(appRoot, projectId);
    fs.writeFileSync(depsPath, requirementsContent || "", "utf8");

    return {
      success: true,
      path: depsPath,
      message: "Requirements installed successfully",
    };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }
};

/**
 * Export project dependencies as a portable requirements.txt content
 */
const exportDeps = async (event, { appRoot, projectId = "default" }) => {
  return readRequirements(appRoot, projectId);
};

/**
 * Import project dependencies from external requirements.txt content
 */
const importDeps = async (event, { appRoot, projectId = "default", requirementsContent }) => {
  if (!requirementsContent || requirementsContent.trim().length === 0) {
    return { success: false, error: "Empty requirements content" };
  }

  const depsPath = getRequirementsPath(appRoot, projectId);
  fs.writeFileSync(depsPath, requirementsContent, "utf8");
  logger.info(`Requirements imported for project ${projectId}`);

  return { success: true, path: depsPath, packageCount: requirementsContent.split("\n").filter(Boolean).length };
};

/**
 * Read requirements for a project
 */
const readRequirements = (appRoot, projectId) => {
  const depsPath = getRequirementsPath(appRoot, projectId);
  if (!fs.existsSync(depsPath)) {
    return { success: true, exists: false, requirements: "", path: depsPath };
  }

  const content = fs.readFileSync(depsPath, "utf8");
  return {
    success: true,
    exists: true,
    requirements: content,
    path: depsPath,
    packageCount: content.split("\n").filter(Boolean).length,
  };
};

/**
 * Diff current installed packages against a requirements file
 * Returns lists of packages to add/remove
 */
const diffRequirements = async (event, { appRoot, projectId = "default" }) => {
  const { getVenvPaths, ensureVirtualEnv } = require("./pip-manager");

  const venvResult = ensureVirtualEnv(appRoot);
  if (!venvResult.success) {
    return venvResult;
  }

  // Read current installed packages
  const freezeResult = spawnSync(venvResult.venvPaths.pip, ["freeze"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15000,
  });

  if (freezeResult.status !== 0) {
    return { success: false, error: (freezeResult.stderr || "pip freeze failed").trim() };
  }

  const installed = new Map();
  const installedLines = freezeResult.stdout.split("\n").filter(Boolean);
  for (const line of installedLines) {
    const parts = line.split("==");
    if (parts.length >= 2) {
      installed.set(parts[0].trim().toLowerCase(), { name: parts[0].trim(), version: parts[1].trim(), line });
    }
  }

  // Read requirements file
  const reqResult = readRequirements(appRoot, projectId);
  const required = new Map();
  if (reqResult.success && reqResult.exists) {
    const reqLines = reqResult.requirements.split("\n").filter(Boolean);
    for (const line of reqLines) {
      const parts = line.split("==");
      if (parts.length >= 2) {
        required.set(parts[0].trim().toLowerCase(), { name: parts[0].trim(), version: parts[1].trim(), line });
      } else {
        required.set(line.trim().toLowerCase(), { name: line.trim(), version: "*", line });
      }
    }
  }

  // Compute diff
  const toInstall = [];
  const toRemove = [];
  const match = [];

  for (const [name, info] of required) {
    if (installed.has(name)) {
      if (installed.get(name).version === info.version) {
        match.push(info.name);
      } else {
        toInstall.push(info);
      }
    } else {
      toInstall.push(info);
    }
  }

  for (const [name, info] of installed) {
    if (!required.has(name)) {
      // Don't suggest removing pip/setuptools/wheel
      if (!["pip", "setuptools", "wheel"].includes(name)) {
        toRemove.push(info);
      }
    }
  }

  return {
    success: true,
    projectId,
    toInstall: toInstall.map((i) => i.line),
    toRemove: toRemove.map((i) => i.line),
    matchCount: match.length,
    installCount: toInstall.length,
    removeCount: toRemove.length,
    installedCount: installed.size,
    requiredCount: required.size,
  };
};

/**
 * List all project dependency profiles
 */
const listProfiles = async (event, { appRoot }) => {
  const dir = getDepsDir(appRoot);
  if (!fs.existsSync(dir)) {
    return { success: true, profiles: [] };
  }

  const files = fs.readdirSync(dir);
  const profiles = [];
  for (const file of files) {
    if (file.endsWith("-requirements.txt")) {
      const projectId = file.replace("-requirements.txt", "");
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath, "utf8");
      profiles.push({
        projectId: projectId === "default" ? "default" : projectId,
        path: fullPath,
        packageCount: content.split("\n").filter(Boolean).length,
        modifiedAt: stat.mtime.toISOString(),
        size: stat.size,
      });
    }
  }

  return { success: true, profiles, count: profiles.length };
};

/**
 * Delete a project dependency profile
 */
const deleteProfile = async (event, { appRoot, projectId = "default" }) => {
  const depsPath = getRequirementsPath(appRoot, projectId);
  if (!fs.existsSync(depsPath)) {
    return { success: false, error: "Profile not found" };
  }

  fs.unlinkSync(depsPath);
  logger.info(`Deleted requirements profile for project ${projectId}`);
  return { success: true };
};

const registerProjectDepsHandlers = ({ appRoot }) => {
  ipcMain.handle("project-deps-generate", async (event, { projectId }) => {
    return generateRequirements(event, { appRoot, projectId });
  });

  ipcMain.handle("project-deps-install", async (event, { projectId, requirementsContent }) => {
    return installFromRequirements(event, { appRoot, projectId, requirementsContent });
  });

  ipcMain.handle("project-deps-export", async (event, { projectId }) => {
    return exportDeps(event, { appRoot, projectId });
  });

  ipcMain.handle("project-deps-import", async (event, { projectId, requirementsContent }) => {
    return importDeps(event, { appRoot, projectId, requirementsContent });
  });

  ipcMain.handle("project-deps-diff", async (event, { projectId }) => {
    return diffRequirements(event, { appRoot, projectId });
  });

  ipcMain.handle("project-deps-list-profiles", async (event) => {
    return listProfiles(event, { appRoot });
  });

  ipcMain.handle("project-deps-delete-profile", async (event, { projectId }) => {
    return deleteProfile(event, { appRoot, projectId });
  });

  logger.info("Project dependency profile IPC handlers registered");
};

module.exports = { registerProjectDepsHandlers };