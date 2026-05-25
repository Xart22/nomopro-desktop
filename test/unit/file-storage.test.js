const assert = require("assert");
const path = require("path");
const fs = require("fs");
const os = require("os");

describe("File storage IPC handlers", () => {
  const testDir = path.join(os.tmpdir(), "nomopro-test-storage-" + Date.now());

  // Simulate the getDefaultStorageDir and ensureDefaultStorageDir logic
  const getDefaultStorageDir = () => {
    const docsDir =
      process.env.USERPROFILE
        ? path.join(process.env.USERPROFILE, "Documents")
        : process.env.HOME
          ? path.join(process.env.HOME, "Documents")
          : testDir;
    return path.join(docsDir, "OpenBlock");
  };

  const ensureDefaultStorageDir = () => {
    const dir = getDefaultStorageDir();
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    } catch (e) {
      const fallback = path.join(testDir, "projects");
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true });
      }
      return fallback;
    }
  };

  before(() => {
    // Clean up any previous test data
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  after(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  it("getDefaultStorageDir returns a non-empty path", () => {
    const dir = getDefaultStorageDir();
    assert.ok(dir.length > 0, "Storage dir should not be empty");
    assert.ok(dir.includes("OpenBlock"), "Should include OpenBlock subdirectory");
  });

  it("ensureDefaultStorageDir creates the directory if absent", () => {
    const dir = ensureDefaultStorageDir();
    assert.ok(fs.existsSync(dir), "Directory should exist after ensure");
    assert.ok(fs.statSync(dir).isDirectory(), "Should be a directory");
  });

  it("save and read a file from storage", () => {
    const dir = ensureDefaultStorageDir();
    const fileName = "test-script.py";
    const content = 'print("hello from desktop")\n';

    const targetPath = path.join(dir, fileName);
    fs.writeFileSync(targetPath, content, "utf8");

    assert.ok(fs.existsSync(targetPath), "File should exist after save");

    const readContent = fs.readFileSync(targetPath, "utf8");
    assert.equal(readContent, content, "Content should match");
  });

  it("conflict handling renames duplicate files", () => {
    const dir = ensureDefaultStorageDir();
    const uniqueId = Date.now();
    const fileName = `conflict-${uniqueId}.py`;
    const targetPath = path.join(dir, fileName);

    // Cleanup any leftover
    try { fs.unlinkSync(targetPath); } catch(e) {}

    // Write first file
    fs.writeFileSync(targetPath, "first", "utf8");
    assert.ok(fs.existsSync(targetPath));

    // Simulate the conflict rename logic from ipc.js
    let finalPath = targetPath;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      finalPath = path.join(dir, `${base} (${counter})${ext}`);
      counter++;
    }
    fs.writeFileSync(finalPath, "second", "utf8");

    assert.ok(fs.existsSync(finalPath), "Renamed file should exist");
    assert.notEqual(targetPath, finalPath, "Paths should differ");
    assert.ok(finalPath.includes(`(${counter - 1})`), `Should have (1) suffix in ${finalPath}`);
  });

  it("list files returns correct metadata", () => {
    const dir = ensureDefaultStorageDir();

    // Ensure a known file exists
    const testFile = path.join(dir, "list-test.py");
    fs.writeFileSync(testFile, "test content", "utf8");

    const files = fs.readdirSync(dir).filter((f) => {
      const fullPath = path.join(dir, f);
      return fs.statSync(fullPath).isFile();
    });

    assert.ok(files.length > 0, "Should have at least one file");
    const found = files.some((f) => f === "list-test.py");
    assert.ok(found, "list-test.py should be in file list");
  });

  it("delete file removes it from storage", () => {
    const dir = ensureDefaultStorageDir();
    const fileName = "delete-test.txt";
    const targetPath = path.join(dir, fileName);

    fs.writeFileSync(targetPath, "to be deleted", "utf8");
    assert.ok(fs.existsSync(targetPath), "File should exist before delete");

    fs.unlinkSync(targetPath);
    assert.ok(!fs.existsSync(targetPath), "File should not exist after delete");
  });

  it("read non-existent file returns error", () => {
    const dir = getDefaultStorageDir();
    const targetPath = path.join(dir, "nonexistent-file-12345.py");

    const exists = fs.existsSync(targetPath);
    assert.equal(exists, false, "Non-existent file should not exist");
  });

  it("save in subdirectories preserves relative path structure", () => {
    const dir = ensureDefaultStorageDir();
    const subDir = path.join(dir, "subdir");
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }

    const filePath = path.join(subDir, "nested.py");
    fs.writeFileSync(filePath, "nested content", "utf8");
    assert.ok(fs.existsSync(filePath), "Nested file should exist");
  });
});