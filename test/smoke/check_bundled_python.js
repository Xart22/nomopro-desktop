const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

function findCandidates() {
  const resourcesPython = path.join(
    process.resourcesPath || __dirname,
    "..",
    "..",
    "python",
  );
  const candidates = [];
  try {
    if (fs.existsSync(resourcesPython)) {
      if (process.platform === "win32") {
        const pexe = path.join(resourcesPython, "python.exe");
        const pexeAlt = path.join(resourcesPython, "python", "python.exe");
        if (fs.existsSync(pexe)) candidates.push(pexe);
        if (fs.existsSync(pexeAlt)) candidates.push(pexeAlt);
      } else {
        const pyBin = path.join(resourcesPython, "bin", "python3");
        const pyBinAlt = path.join(resourcesPython, "bin", "python");
        if (fs.existsSync(pyBin)) candidates.push(pyBin);
        if (fs.existsSync(pyBinAlt)) candidates.push(pyBinAlt);
      }
    }
  } catch (e) {}

  // fallback
  if (process.platform === "win32") {
    candidates.push("python", "py");
  } else {
    candidates.push("python3", "python");
  }
  return candidates;
}

function check() {
  const candidates = findCandidates();
  console.log("Candidates:", candidates);
  for (const c of candidates) {
    try {
      const res = spawnSync(c, ["--version"], { encoding: "utf8" });
      if (res.status === 0) {
        console.log("Found python:", c, res.stdout || res.stderr);
        return 0;
      }
    } catch (e) {
      // continue
    }
  }
  console.error("No python runtime found from candidates");
  return 2;
}

process.exitCode = check();
