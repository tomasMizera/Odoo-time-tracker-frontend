const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { execSync } = require("child_process");

const SERVICE  = "odoo-time-tracker";
const ACCOUNT  = "credentials";

// Uses macOS `security` CLI to create keychain items with no app-specific ACL,
// so the login keychain (auto-unlocked at login) grants access silently.
function loadCreds() {
  try {
    const b64 = execSync(
      `security find-generic-password -s "${SERVICE}" -a "${ACCOUNT}" -w`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
    ).trim();
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function saveCreds(data) {
  const b64 = Buffer.from(JSON.stringify(data)).toString("base64");
  try {
    execSync(`security delete-generic-password -s "${SERVICE}" -a "${ACCOUNT}"`,
      { stdio: "ignore" });
  } catch {}
  execSync(`security add-generic-password -s "${SERVICE}" -a "${ACCOUNT}" -w "${b64}"`);
}

function deleteCreds() {
  try {
    execSync(`security delete-generic-password -s "${SERVICE}" -a "${ACCOUNT}"`,
      { stdio: "ignore" });
  } catch {}
}

ipcMain.handle("keychain:get", () => {
  const data = loadCreds();
  return {
    creds:        data?.creds        ?? null,
    anthropicKey: data?.anthropicKey ?? "",
    userContext:  data?.userContext  ?? "",
  };
});

ipcMain.handle("keychain:save", (_, data) => {
  const existing = loadCreds() ?? {};
  saveCreds({ ...existing, ...data });
  return { ok: true };
});

ipcMain.handle("keychain:delete", () => {
  deleteCreds();
  return { ok: true };
});

ipcMain.handle("odoo:rpc", async (_, payload) => {
  const data  = loadCreds();
  const creds = data?.creds;
  if (!creds?.url) throw new Error("No Odoo URL configured");
  const res = await fetch(`${creds.url}/jsonrpc`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  return res.json();
});

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: "#0f0f1a",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile("odoo-tracker.html");
}

// Prevent Chromium from accessing the OS keychain for its internal storage
// (cookies, localStorage encryption). We manage credentials ourselves via
// the `security` CLI so this internal encryption isn't needed.
app.commandLine.appendSwitch("use-mock-keychain");

app.whenReady().then(createWindow);

app.on("window-all-closed", () => app.quit());

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
