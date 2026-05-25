const { shell, ipcRenderer, contextBridge } = require("electron");

window.addEventListener("DOMContentLoaded", async () => {
  const btn = document.getElementById("login");
  const error = document.getElementById("error");
  const openComunity = document.querySelector('[aria-label="Open Community"]');
  const openTutorial = document.querySelector(
    '[aria-label="Nomokit Tutorials"]',
  );

  if (error !== null) {
    error.style.display = "none";
  }
  if (openComunity !== null) {
    openComunity.addEventListener("click", () => {
      shell.openExternal("https://nomo-kit.com/community");
    });
  }

  if (openTutorial !== null) {
    openTutorial.addEventListener("click", () => {
      shell.openExternal("https://nomo-kit.com/tutorial");
    });
  }
  if (error !== null) {
    error.style.display = "none";
  }

  const email = document.getElementById("email");
  const password = document.getElementById("password");

  if (password) {
    password.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        login();
      }
    });
  }
  function login() {
    if (email.value !== "" && password.value !== "") {
      ipcRenderer.send("login", {
        email: email.value,
        password: password.value,
      });
    } else {
      email.classList.add("is-invalid");
      password.classList.add("is-invalid");
    }
  }

  if (error !== null) {
    btn.addEventListener("click", async () => {
      login();
    });
    email.addEventListener("keyup", (e) => {
      error.style.display = "none";
      email.classList.remove("is-invalid");
      password.classList.remove("is-invalid");
    });
    password.addEventListener("keyup", () => {
      error.style.display = "none";
      email.classList.remove("is-invalid");
      password.classList.remove("is-invalid");
    });
    ipcRenderer.on("login-fail", (event, arg) => {
      error.style.display = "block";
      email.classList.add("is-invalid");
      password.classList.add("is-invalid");
      error.innerHTML = "Email atau password salah";
    });
    // ipcRenderer.on("no-subscription", (event, arg) => {
    //   error.style.display = "block";
    //   error.innerHTML = "Anda belum memiliki paket langganan";
    // });
  }

  ipcRenderer.on("download-progress", function (event, text) {
    const progress = document.getElementById("progress-bar");
    const textProgress = document.getElementById("textUpdate");
    progress.style.width = text + "%";
    progress.innerHTML = text + "%";
    if (text.includes("100")) {
      progress.style.width = "100%";
      progress.innerHTML = "%";
      textProgress.innerHTML = "Instaling...";
    }
  });
});

contextBridge.exposeInMainWorld("electronAPI", {
  // Python candidates (virtualenv priority)
  getPythonCandidates: async () => {
    return await ipcRenderer.invoke("get-python-candidates");
  },
  // Async invoke-based getUserData
  getUserData: () => {
    ipcRenderer.send("getUserData", "");
  },
  // Channel subscription for main->renderer events
  on: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
  },
  // Remove listener for cleanup
  removeListener: (channel, func) => {
    ipcRenderer.removeListener(channel, func);
  },
  // File storage API
  fileStorage: {
    saveToDefaultDir: async (fileName, content) => {
      return await ipcRenderer.invoke("file-storage-save", {
        fileName,
        content:
          typeof content === "string" ? content : JSON.stringify(content),
      });
    },
    readFromDefaultDir: async (fileName) => {
      return await ipcRenderer.invoke("file-storage-read", { fileName });
    },
    listFiles: async () => {
      return await ipcRenderer.invoke("file-storage-list");
    },
    deleteFile: async (fileName) => {
      return await ipcRenderer.invoke("file-storage-delete", { fileName });
    },
    getDefaultDir: async () => {
      return await ipcRenderer.invoke("file-storage-get-default-dir");
    },
  },
  // Pip package management API
  pip: {
    install: async (packageName, options = {}) => {
      return await ipcRenderer.invoke("pip-install", {
        packageName,
        upgrade: options.upgrade || false,
        pre: options.pre || false,
      });
    },
    uninstall: async (packageName) => {
      return await ipcRenderer.invoke("pip-uninstall", { packageName });
    },
    list: async () => {
      return await ipcRenderer.invoke("pip-list");
    },
    show: async (packageName) => {
      return await ipcRenderer.invoke("pip-show", { packageName });
    },
    getCacheInfo: async () => {
      return await ipcRenderer.invoke("pip-cache-info");
    },
    clearCache: async () => {
      return await ipcRenderer.invoke("pip-cache-clear");
    },
    runInVenv: async (code) => {
      return await ipcRenderer.invoke("pip-run-in-venv", { code });
    },
    ensureVenv: async () => {
      return await ipcRenderer.invoke("pip-ensure-venv");
    },
    // Subscribe to pip progress events from main process
    onProgress: (callback) => {
      ipcRenderer.on("pip-operation-progress", (event, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners("pip-operation-progress");
      };
    },
  },
  // Project dependency profile API (Phase 7)
  projectDeps: {
    generate: async (projectId) => {
      return await ipcRenderer.invoke("project-deps-generate", { projectId });
    },
    install: async (projectId, requirementsContent) => {
      return await ipcRenderer.invoke("project-deps-install", {
        projectId,
        requirementsContent,
      });
    },
    export: async (projectId) => {
      return await ipcRenderer.invoke("project-deps-export", { projectId });
    },
    import: async (projectId, requirementsContent) => {
      return await ipcRenderer.invoke("project-deps-import", {
        projectId,
        requirementsContent,
      });
    },
    diff: async (projectId) => {
      return await ipcRenderer.invoke("project-deps-diff", { projectId });
    },
    listProfiles: async () => {
      return await ipcRenderer.invoke("project-deps-list-profiles");
    },
    deleteProfile: async (projectId) => {
      return await ipcRenderer.invoke("project-deps-delete-profile", {
        projectId,
      });
    },
  },
  // Safe install mode API (Phase 7)
  safeInstall: {
    classify: async (packageName) => {
      return await ipcRenderer.invoke("safe-install-classify", { packageName });
    },
    preflight: async () => {
      return await ipcRenderer.invoke("safe-install-preflight");
    },
    getWarning: async (packageName) => {
      return await ipcRenderer.invoke("safe-install-warning", { packageName });
    },
    getAllowlist: async () => {
      return await ipcRenderer.invoke("safe-install-allowlist");
    },
  },
  // Diagnostic bundle API (Phase 7)
  diagnostic: {
    collect: async () => {
      return await ipcRenderer.invoke("diagnostic-collect");
    },
    generateReport: async () => {
      return await ipcRenderer.invoke("diagnostic-generate-report");
    },
    saveReport: async () => {
      return await ipcRenderer.invoke("diagnostic-save-report");
    },
  },
  // Offline wheel cache API (Phase 7)
  offlineCache: {
    getInfo: async () => {
      return await ipcRenderer.invoke("offline-cache-info");
    },
    install: async (packageName) => {
      return await ipcRenderer.invoke("offline-cache-install", { packageName });
    },
    clear: async () => {
      return await ipcRenderer.invoke("offline-cache-clear");
    },
    remove: async (packageName) => {
      return await ipcRenderer.invoke("offline-cache-remove", { packageName });
    },
  },
  // Recovery mode API (Phase 7)
  recovery: {
    verifyPython: async () => {
      return await ipcRenderer.invoke("recovery-verify-python");
    },
    restorePython: async () => {
      return await ipcRenderer.invoke("recovery-restore-python");
    },
    createBackup: async () => {
      return await ipcRenderer.invoke("recovery-create-backup");
    },
    verifyShortcuts: async () => {
      return await ipcRenderer.invoke("recovery-verify-shortcuts");
    },
  },
  // MicroPython flashing API
  micropython: {
    flash: async (portPath) => {
      return await ipcRenderer.invoke("micropython-flash", { portPath });
    },
    onFlashProgress: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on("micropython-flash-progress", handler);
      return () => {
        ipcRenderer.removeListener("micropython-flash-progress", handler);
      };
    },
  },
});

// Expose platformInfo for renderer detection
contextBridge.exposeInMainWorld("platformInfo", {
  isDesktop: true,
});

// Bridge for desktop python runner expected by renderer
contextBridge.exposeInMainWorld("nomoproDesktopPython", {
  runPythonCode: async (code) => {
    return await ipcRenderer.invoke("nomopro-python-run", { code });
  },
  stopPythonCode: async () => {
    return await ipcRenderer.invoke("nomopro-python-stop");
  },
  writeStdin: async (data) => {
    return await ipcRenderer.invoke("nomopro-python-write-stdin", data);
  },
});
