const { shell, ipcRenderer, contextBridge } = require("electron");

window.addEventListener("DOMContentLoaded", async () => {
  const btn = document.getElementById("login");
  const error = document.getElementById("error");
  const openComunity = document.querySelector('[aria-label="Open Community"]');
  const openTutorial = document.querySelector(
    '[aria-label="Nomokit Tutorials"]'
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

contextBridge.exposeInMainWorld('electronAPI', {
  getUserData: (params) => ipcRenderer.send("getUserData", params),
  on: (channel, func) => {
        ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
    },
});