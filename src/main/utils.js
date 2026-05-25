const fs = require("fs");
const path = require("path");

/**
 * Recursively walk a directory and compute total file size and count.
 * @param {string} dir - Directory to scan
 * @param {object} [options]
 * @param {string} [options.excludeDir] - Skip directories whose name starts with this string
 * @returns {{ size: number, count: number }}
 */
function walkDirSize(dir, { excludeDir } = {}) {
  let size = 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isFile()) {
      const stat = fs.statSync(full);
      size += stat.size;
      count++;
    } else if (entry.isDirectory() && (!excludeDir || !entry.name.startsWith(excludeDir))) {
      const sub = walkDirSize(full, { excludeDir });
      size += sub.size;
      count += sub.count;
    }
  }
  return { size, count };
}

/**
 * Recursively copy a directory.
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {object} [options]
 * @param {string} [options.excludeDir] - Skip directories whose name starts with this string
 */
function copyRecursive(src, dest, { excludeDir } = {}) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    } else if (entry.isDirectory() && (!excludeDir || !entry.name.startsWith(excludeDir))) {
      copyRecursive(srcPath, destPath, { excludeDir });
    }
  }
}

module.exports = { walkDirSize, copyRecursive };
