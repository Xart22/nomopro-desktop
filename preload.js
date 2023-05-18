const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", async () => {
  const btn = document.getElementById("login");
  const error = document.getElementById("error");
  if (error !== null) {
    error.style.display = "none";
  }

  const email = document.getElementById("email");
  const password = document.getElementById("password");

  password.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      login();
    }
  });
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
    ipcRenderer.on("no-subscription", (event, arg) => {
      error.style.display = "block";
      error.innerHTML = "Anda belum memiliki paket langganan";
    });
  }

  ipcRenderer.on("download-progress", function (event, text) {
    const progress = document.getElementById("progress-bar");
    progress.style.width = text + "%";
    progress.innerHTML = text.toFixed(0) + "%";
  });
});
