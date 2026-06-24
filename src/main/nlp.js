const { ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

// In-memory training data store
let trainedIntents = [];

/**
 * Find a working Python interpreter, prioritising bundled Python.
 */
function getPythonExe() {
  const candidates = [];

  // Bundled Python
  try {
    const resourcesPy =
      path.join(process.resourcesPath || __dirname, "..", "..", "python");
    if (fs.existsSync(resourcesPy)) {
      const pexe = path.join(resourcesPy, "python.exe");
      if (fs.existsSync(pexe)) candidates.push(pexe);
    }
  } catch (_) {
    // ignore
  }

  candidates.push("python", "py");
  return candidates[0] || "python";
}

/**
 * Run NLP Python script with given input, return parsed result.
 */
function runNlpPython(script) {
  return new Promise((resolve, reject) => {
    const py = getPythonExe();
    const proc = spawn(py, ["-c", script], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch (_) {
          resolve(stdout.trim());
        }
      } else {
        reject(new Error(stderr || "NLP process failed"));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Sentiment analysis using textblob or simple heuristic.
 */
function sentimentPythonScript(text) {
  return `
import json, sys
try:
    from textblob import TextBlob
    blob = TextBlob("""${text.replace(/"/g, '\\"')}""")
    pol = blob.sentiment.polarity
    if pol > 0.1: print(json.dumps("positive"))
    elif pol < -0.1: print(json.dumps("negative"))
    else: print(json.dumps("neutral"))
except ImportError:
    # Simple keyword fallback
    t = """${text.replace(/"/g, '\\"')}""".lower()
    pos = ["good","great","love","excellent","happy","wonderful","amazing","fantastic"]
    neg = ["bad","terrible","hate","awful","sad","horrible","ugly","worst"]
    p = sum(1 for w in pos if w in t.split())
    n = sum(1 for w in neg if w in t.split())
    if p > n: print(json.dumps("positive"))
    elif n > p: print(json.dumps("negative"))
    else: print(json.dumps("neutral"))
`;
}

/**
 * Named entity recognition using spaCy or simple regex.
 */
function entitiesPythonScript(text) {
  return `
import json, sys
try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    doc = nlp("""${text.replace(/"/g, '\\"')}""")
    ents = [{"text": e.text, "type": e.label_} for e in doc.ents]
    print(json.dumps(ents))
except ImportError:
    import re
    t = """${text.replace(/"/g, '\\"')}"""
    # Simple uppercase word detection for proper nouns
    words = t.split()
    found = []
    for i, w in enumerate(words):
        if w[0].isupper() and w.lower() not in ["i","the","a","an","this","that"]:
            found.append({"text": w, "type": "PROPER_NOUN"})
    print(json.dumps(found))
`;
}

/**
 * Fallback entities extraction — pure JS, no Python needed.
 */
function _entitiesFallback(text) {
    const skip = new Set(["i", "the", "a", "an", "this", "that"]);
    const words = text.split(/\s+/);
    const found = [];
    for (const w of words) {
        if (w.length > 0 && w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() && !skip.has(w.toLowerCase())) {
            found.push({text: w, type: "PROPER_NOUN"});
        }
    }
    return JSON.stringify(found);
}

/**
 * Classify text against trained intents.
 */
function classifyScript(text) {
  const intentsJson = JSON.stringify(trainedIntents);
  return `
import json, sys
intents = json.loads("""${intentsJson.replace(/"/g, '\\"')}""")
text = """${text.replace(/"/g, '\\"')}""".lower()

if not intents:
    print(json.dumps(""))
    sys.exit(0)

# Simple keyword matching
best_label = ""
best_score = 0
for intent in intents:
    score = 0
    for ex in intent.get("examples", []):
        words = ex.lower().split()
        matches = sum(1 for w in words if w in text)
        if matches > 0:
            score += matches / len(words)
    if score > best_score:
        best_score = score
        best_label = intent["label"]

if best_score >= 0.3:
    print(json.dumps(best_label))
else:
    print(json.dumps(""))
`;
}

/**
 * Compute similarity between two texts using difflib.
 */
function similarityScript(text1, text2) {
  return `
import json, sys
try:
    from difflib import SequenceMatcher
    r = SequenceMatcher(None, """${text1.replace(/"/g, '\\"')}""".lower(), """${text2.replace(/"/g, '\\"')}""".lower()).ratio()
    print(json.dumps(r))
except Exception:
    print(json.dumps(0.0))
`;
}

function registerNlpHandlers() {
  ipcMain.handle("nlp:sentiment", async (_event, text) => {
    try {
      const script = sentimentPythonScript(text);
      const result = await runNlpPython(script);
      return result || "neutral";
    } catch (_) {
      return "neutral";
    }
  });

  ipcMain.handle("nlp:entities", async (_event, text) => {
    try {
      const script = entitiesPythonScript(text);
      const result = await runNlpPython(script);
      if (Array.isArray(result) && result.length > 0) {
        return JSON.stringify(result);
      }
      // If Python failed or returned empty, fallback to pure JS regex
      return _entitiesFallback(text);
    } catch (_) {
      return _entitiesFallback(text);
    }
  });

  ipcMain.handle("nlp:classify", async (_event, text) => {
    try {
      const script = classifyScript(text);
      const result = await runNlpPython(script);
      return result || "";
    } catch (_) {
      return "";
    }
  });

  // Synchronous classify — pure JS keyword matching, no Python subprocess.
  // Returns {label: string, confidence: number}
  ipcMain.on("nlp:classify-sync", (event, text) => {
    const input = text.toLowerCase();
    let bestLabel = "";
    let bestScore = 0;

    for (const intent of trainedIntents) {
      let score = 0;
      for (const ex of intent.examples) {
        const words = ex.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;
        const matches = words.filter((w) => input.includes(w)).length;
        if (matches > 0) {
          score += matches / words.length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestLabel = intent.label;
      }
    }

    event.returnValue = {
      label: bestScore >= 0.3 ? bestLabel : "",
      confidence: bestScore,
    };
  });

  // Async classify result — returns {label, confidence}
  ipcMain.handle("nlp:classify-result", async (_event, text) => {
    const input = text.toLowerCase();
    let bestLabel = "";
    let bestScore = 0;

    for (const intent of trainedIntents) {
      let score = 0;
      for (const ex of intent.examples) {
        const words = ex.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;
        const matches = words.filter((w) => input.includes(w)).length;
        if (matches > 0) {
          score += matches / words.length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestLabel = intent.label;
      }
    }

    return {
      label: bestScore >= 0.3 ? bestLabel : "",
      confidence: bestScore,
    };
  });

  // Sentiment score — returns numeric -1.0 to 1.0
  ipcMain.handle("nlp:sentiment-score", async (_event, text) => {
    try {
      const script = sentimentPythonScript(text);
      const result = await runNlpPython(script);
      // result is "positive"/"negative"/"neutral" — convert to number
      if (result === "positive") return 0.6;
      if (result === "negative") return -0.6;
      return 0.0;
    } catch (_) {
      return 0.0;
    }
  });

  // Remove a single intent by label
  ipcMain.handle("nlp:remove-intent", async (_event, label) => {
    const before = trainedIntents.length;
    trainedIntents = trainedIntents.filter((i) => i.label !== label);
    return { success: true, removed: before - trainedIntents.length };
  });

  ipcMain.handle("nlp:train", async (_event, label, examples) => {
    trainedIntents = trainedIntents.filter((i) => i.label !== label);
    trainedIntents.push({ label, examples: Array.isArray(examples) ? examples : [examples] });
    return { success: true, total: trainedIntents.length };
  });

  ipcMain.handle("nlp:similarity", async (_event, text1, text2) => {
    try {
      const script = similarityScript(text1, text2);
      const result = await runNlpPython(script);
      return typeof result === "number" ? result : 0;
    } catch (_) {
      return 0;
    }
  });

  ipcMain.handle("nlp:export-training", async () => {
    const data = {
      version: "1.0",
      model: "nlp",
      intents: trainedIntents,
      settings: {
        algorithm: "intent_classifier",
        trained: trainedIntents.length > 0,
      },
    };

    const result = await dialog.showSaveDialog({
      title: "Export NLP Training Data",
      defaultPath: "nlp-training-data.nlp",
      filters: [{ name: "NLP Data", extensions: ["nlp"] }],
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), "utf-8");
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });

  ipcMain.handle("nlp:import-training", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import NLP Training Data",
      filters: [{ name: "NLP Data", extensions: ["nlp"] }],
      properties: ["openFile"],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const content = fs.readFileSync(result.filePaths[0], "utf-8");
      const data = JSON.parse(content);
      if (data && data.intents) {
        trainedIntents = data.intents;
      }
      return data || { intents: [] };
    }
    return null;
  });

  ipcMain.handle("nlp:reset-all", async () => {
    trainedIntents = [];
    return { success: true };
  });

  ipcMain.handle("nlp:get-intents", async () => {
    return trainedIntents.map((i) => i.label);
  });

  ipcMain.handle("nlp:upload-csv", async () => {
    const result = await dialog.showOpenDialog({
      title: "Upload CSV File",
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
      properties: ["openFile"],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, "utf-8");
      const fileName = path.basename(filePath);
      return { content, fileName };
    }
    return null;
  });

  ipcMain.handle("nlp:download-csv-template", async () => {
    const csvContent = 'name,age,city\nAlice,25,New York\nBob,30,Los Angeles\nCharlie,22,Chicago\nDiana,28,Houston';
    const result = await dialog.showSaveDialog({
      title: "Download CSV Template",
      defaultPath: "nlp-template.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, csvContent, "utf-8");
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });

  ipcMain.handle("nlp:download-csv", async (_event, data) => {
    const result = await dialog.showSaveDialog({
      title: "Download CSV File",
      defaultPath: "nlp-output.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, data, "utf-8");
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });
}

module.exports = { registerNlpHandlers };
