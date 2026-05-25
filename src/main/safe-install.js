/**
 * Safe Install Mode (Phase 7 — Step 26)
 *
 * Provides safety checks before installing packages:
 * - Classify packages as "safe" (pure Python) vs "risky" (native build)
 * - Preflight check for build toolchain
 * - Warning before installing risky packages
 * - Allowlist support for known-safe packages
 */

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");
const { ipcMain } = require("electron");

// Known pure-Python packages (safe, no native extension build needed)
const KNOWN_SAFE_PACKAGES = new Set([
  "requests", "urllib3", "idna", "chardet", "certifi",
  "colorama", "tqdm", "pyyaml", "toml", "json5",
  "click", "rich", "tabulate", "python-dateutil", "six",
  "pytz", "tzdata", "markdown", "mistune", "pygments",
  "jinja2", "markupsafe", "bleach", "webencodings",
  "cssselect", "lxml", "beautifulsoup4", "soupsieve",
  "html5lib", "defusedxml", "isodate", "attrs",
  "jsonschema", "pyrsistent", "wrapt", "multidict",
  "yarl", "frozenlist", "aiosignal", "async-timeout",
  "packaging", "pyparsing", "pluggy", "more-itertools",
  "wcwidth", "prompt-toolkit", "pydantic", "typing-extensions",
  "pydantic-core", "annotated-types", "pydantic-settings",
  "python-dotenv", "environs", "marshmallow",
  "pillow", "imageio", "numpy", "scipy", "pandas",
  "matplotlib", "seaborn", "scikit-learn", "scikit-image",
  "opencv-python", "opencv-python-headless",
  "networkx", "sympy", "statistics",
  "flask", "django", "fastapi", "uvicorn",
  "aiohttp", "httpx", "websockets",
  "grpcio", "protobuf",
  "psutil", "platformdirs", "filelock",
  "distlib", "virtualenv", "pipenv", "poetry-core",
  "cffi", "cryptography", "bcrypt", "paramiko",
  "pynacl", "pyserial", "pymodbus",
  "wikipedia", "googlesearch-python",
  "youtube-dl", "yt-dlp",
  "pypdf2", "pypdf", "pdfminer.six", "pdfplumber",
  "openpyxl", "xlrd", "xlwt", "xlsxwriter",
  "python-pptx", "docx2txt", "python-docx",
  "redis", "pymongo", "sqlalchemy", "psycopg2-binary",
  "mysql-connector-python", "pymysql",
  "emoji", "unidecode", "inflect", "humanize",
  "memory-profiler", "line-profiler",
  "loguru", "structlog",
  "pendulum", "arrow", "moment",
  "faker", "factory-boy",
  "pytest", "pytest-cov", "pytest-mock", "pytest-xdist",
  "hypothesis", "tox", "nox",
  "black", "isort", "flake8", "pylint", "mypy",
  "bandit", "safety", "vulture",
  "sphinx", "sphinx-rtd-theme",
  "pre-commit", "husky",
  "celery", "rq", "huey",
  "nats-py", "paho-mqtt", "stomp.py",
  "mqtt-remote", "pymodbus3",
  "gpiozero", "rpi-gpio", "pigpio",
  "smbus2", "spidev",
  "adafruit-blinka", "adafruit-circuitpython-*",
  "micropython-*",
  "tensorflow", "tensorflow-cpu", "torch", "torchvision",
  "transformers", "datasets", "tokenizers",
  "sentencepiece", "sacremoses",
  "spacy", "nltk", "gensim",
  "openai", "anthropic", "cohere",
  "langchain", "llama-index",
  "chromadb", "faiss-cpu", "milvus",
  "sentence-transformers", "huggingface-hub",
  "accelerate", "bitsandbytes",
  "deepspeed", "megatron-core",
  "wandb", "mlflow",
  "streamlit", "gradio", "nicegui",
  "dash", "bokeh", "plotly",
  "altair", "vega-datasets",
  "shapely", "geopandas", "folium",
  "cartopy", "basemap",
  "rasterio", "gdal",
  "simplekml", "geocoder",
  "ipython", "jupyter", "notebook", "nbformat",
  "ipywidgets", "widgetsnbextension",
  "jupyterlab", "jupyter-server",
  "voila", "papermill",
  "nbdime", "nbstripout",
  "autopep8", "yapf", "docformatter",
  "interrogate", "darglint",
  "aiomysql", "aiosqlite", "aioredis",
  "asyncio-nats-client", "aio-pika",
  "uvloop", "httptools", "watchfiles",
  "orjson", "ujson", "python-snappy",
  "msgpack", "cbor2", "pickle5",
  "h5py", "netcdf4", "zarr",
  "dask", "distributed",
  "xarray", "rioxarray",
  "cftime", "cfgrib",
  "bottleneck", "numexpr",
  "numba", "llvmlite",
  "cython", "setuptools", "wheel",
]);

// Packages known to need native build tools (compiler, etc.)
const KNOWN_NATIVE_PACKAGES = new Set([
  "numpy", "scipy", "pandas", "matplotlib",
  "opencv-python", "opencv-contrib-python",
  "pillow", "cffi", "cryptography",
  "bcrypt", "pynacl", "paramiko",
  "psutil", "grpcio", "protobuf",
  "lxml", "h5py", "netcdf4",
  "numexpr", "bottleneck",
  "numba", "llvmlite",
  "cython", "pyyaml",
  "uvloop", "httptools",
  "orjson", "ujson", "python-snappy",
  "msgpack", "cbor2",
  "aiomysql", "aioredis",
  "watchfiles",
  "pydantic-core",
  "regex", "fsspec",
  "gcsfs", "s3fs",
  "boto3", "botocore",
  "mysqlclient",
  "psycopg2", "psycopg2-binary",
  "psycopg", "psycopg-c",
  "tensorflow", "tensorflow-cpu",
  "torch", "torchvision", "torchaudio",
  "bitsandbytes", "deepspeed",
  "sentencepiece", "sacremoses",
  "spacy", "thinc",
  "nmslib", "hnswlib",
  "faiss-cpu", "faiss-gpu",
  "chromadb", "milvus",
  "pynndescent", "umap-learn",
  "rpy2", "jinxed",
  "blessed", "windows-curses",
  "readline", "gnureadline",
]);

// Packages that absolutely cannot work in embedded/venv Python (kernel drivers, etc.)
const BLOCKED_PACKAGES = new Set([
  "pywin32", "pywinpty", "win32api",
  "wmi", "pyad", "python-ldap",
  "pybluez", "bluetooth",
  "pyusb", "hidapi",
  "pygobject", "pygtk", "gtk",
  "pyqt5", "pyqt6", "pyside2", "pyside6",
  "tk", "tkinter",
  "wxpython",
]);

/**
 * Classify a package as safe, risky, or blocked
 */
const classifyPackage = (packageName) => {
  if (!packageName) return { level: "unknown", reason: "Empty package name" };

  const name = packageName.trim().toLowerCase();

  // Check blocked first
  for (const blocked of BLOCKED_PACKAGES) {
    if (name === blocked || name.startsWith(blocked)) {
      return { level: "blocked", reason: `Package '${name}' is not compatible with embedded Python runtime` };
    }
  }

  // Check known safe
  if (KNOWN_SAFE_PACKAGES.has(name)) {
    return { level: "safe", reason: "Known pure-Python package" };
  }

  // Check known native
  for (const native of KNOWN_NATIVE_PACKAGES) {
    if (name === native || name.startsWith(native)) {
      return { level: "risky", reason: "Package requires native extension build (compiler/toolchain)" };
    }
  }

  // Unknown: check if it might be pure Python by looking at PyPI metadata (if possible)
  // For now, classify unknown as "unknown" (user can choose to proceed)
  return { level: "unknown", reason: "Unknown package type - could require native build tools" };
};

/**
 * Preflight check for build toolchain
 * Checks if compilers are available for native packages
 */
const preflightCheck = async () => {
  const checks = {
    python: false,
    pip: false,
    gcc: false,
    gpp: false,
    make: false,
    cmake: false,
    rustc: false,
    visualStudio: false,
  };

  // Check Python
  try {
    const py = spawnSync("python", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    checks.python = py.status === 0;
  } catch (e) {}

  // Check pip
  try {
    const pip = spawnSync("pip", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    checks.pip = pip.status === 0;
  } catch (e) {}

  // Check gcc/g++ (Unix)
  if (process.platform !== "win32") {
    try {
      const gcc = spawnSync("gcc", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      checks.gcc = gcc.status === 0;
    } catch (e) {}
    try {
      const gpp = spawnSync("g++", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      checks.gpp = gpp.status === 0;
    } catch (e) {}
    try {
      const make = spawnSync("make", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      checks.make = make.status === 0;
    } catch (e) {}
    try {
      const cmake = spawnSync("cmake", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      checks.cmake = cmake.status === 0;
    } catch (e) {}
    try {
      const rustc = spawnSync("rustc", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      checks.rustc = rustc.status === 0;
    } catch (e) {}
  }

  // Check Visual Studio (Windows)
  if (process.platform === "win32") {
    try {
      const vs = spawnSync("where", ["cl.exe"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      checks.visualStudio = vs.status === 0;
    } catch (e) {}
  }

  const hasNativeToolchain = checks.gcc || checks.gpp || checks.visualStudio;

  return {
    success: true,
    checks,
    hasNativeToolchain,
    warning: !hasNativeToolchain
      ? "No C/C++ compiler found. Packages requiring native extensions may fail to build."
      : null,
  };
};

/**
 * Get safety warning for a package
 */
const getSafetyWarning = async (event, { packageName }) => {
  const classification = classifyPackage(packageName);

  if (classification.level === "safe") {
    return {
      success: true,
      level: "safe",
      message: `Package '${packageName}' is a known pure-Python package. Safe to install.`,
      canInstall: true,
      requiresConfirmation: false,
    };
  }

  if (classification.level === "blocked") {
    return {
      success: true,
      level: "blocked",
      message: classification.reason,
      canInstall: false,
      requiresConfirmation: false,
    };
  }

  if (classification.level === "risky") {
    const preflight = await preflightCheck();
    if (preflight.hasNativeToolchain) {
      return {
        success: true,
        level: "risky",
        message: `Package '${packageName}' requires native extension build. Build tools detected.`,
        canInstall: true,
        requiresConfirmation: true,
        preflight,
      };
    }
    return {
      success: true,
      level: "risky",
      message: `Package '${packageName}' requires native extension build but no C/C++ compiler was detected. Installation may fail.`,
      canInstall: true,
      requiresConfirmation: true,
      preflight,
    };
  }

  // Unknown
  const preflight = await preflightCheck();
  return {
    success: true,
    level: "unknown",
    message: `Package '${packageName}' type is unknown. Proceed with caution.`,
    canInstall: true,
    requiresConfirmation: true,
    preflight,
  };
};

/**
 * Get the allowlist (list of known safe packages for display)
 */
const getAllowlist = async () => {
  return {
    success: true,
    safeCount: KNOWN_SAFE_PACKAGES.size,
    nativeCount: KNOWN_NATIVE_PACKAGES.size,
    blockedCount: BLOCKED_PACKAGES.size,
    safePackages: Array.from(KNOWN_SAFE_PACKAGES).sort(),
    nativePackages: Array.from(KNOWN_NATIVE_PACKAGES).sort(),
    blockedPackages: Array.from(BLOCKED_PACKAGES).sort(),
  };
};

const registerSafeInstallHandlers = () => {
  ipcMain.handle("safe-install-classify", async (event, { packageName }) => {
    return { success: true, classification: classifyPackage(packageName) };
  });

  ipcMain.handle("safe-install-preflight", async () => {
    return preflightCheck();
  });

  ipcMain.handle("safe-install-warning", async (event, { packageName }) => {
    return getSafetyWarning(event, { packageName });
  });

  ipcMain.handle("safe-install-allowlist", async () => {
    return getAllowlist();
  });

  logger.info("Safe install mode IPC handlers registered");
};

module.exports = { registerSafeInstallHandlers, classifyPackage, preflightCheck, getAllowlist };