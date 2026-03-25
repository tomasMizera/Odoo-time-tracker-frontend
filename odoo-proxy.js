#!/usr/bin/env node
// Odoo Time Tracker Server
// Serves the app, proxies Odoo, and manages keychain credentials.
//
// Setup:
//   npm install keytar
//   node server.js
//
// Then open: http://localhost:3010

const http = require("http");
const path = require("path");
const fs   = require("fs");

let keytar;
try {
  keytar = require("keytar");
} catch {
  console.error("❌  keytar not found. Run: npm install keytar");
  process.exit(1);
}

const PORT    = 3010;
const SERVICE = "odoo-time-tracker";
const ODOO_KEY  = "odoo_creds";     // stores JSON: { url, db, email, password }
const ANTH_KEY  = "anthropic_key";  // stores raw API key string
const CTX_KEY   = "user_context";   // stores freeform user context string

// ── Read the HTML file (same directory as this script) ──
const HTML_PATH = path.join(__dirname, "odoo-tracker.html");

// ── Helpers ──
function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// ── Server ──
const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // ── Serve the HTML app ──
  if (method === "GET" && url === "/") {
    if (!fs.existsSync(HTML_PATH)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`odoo-tracker.html not found at: ${HTML_PATH}`);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(fs.readFileSync(HTML_PATH));
    return;
  }

  // ── Keychain: GET credentials ──
  if (method === "GET" && url === "/keychain/creds") {
    const raw = await keytar.getPassword(SERVICE, ODOO_KEY);
    const ak  = await keytar.getPassword(SERVICE, ANTH_KEY);
    const ctx = await keytar.getPassword(SERVICE, CTX_KEY);
    const creds = raw ? JSON.parse(raw) : null;
    json(res, 200, { creds, anthropicKey: ak || "", userContext: ctx || "" });
    return;
  }

  // ── Keychain: SAVE credentials ──
  if (method === "POST" && url === "/keychain/creds") {
    const body = JSON.parse(await readBody(req));
    await keytar.setPassword(SERVICE, ODOO_KEY, JSON.stringify(body.creds));
    if (body.anthropicKey !== undefined) {
      await keytar.setPassword(SERVICE, ANTH_KEY, body.anthropicKey);
    }
    if (body.userContext !== undefined) {
      await keytar.setPassword(SERVICE, CTX_KEY, body.userContext);
    }
    json(res, 200, { ok: true });
    return;
  }

  // ── Keychain: DELETE credentials ──
  if (method === "POST" && url === "/keychain/delete") {
    await keytar.deletePassword(SERVICE, ODOO_KEY);
    await keytar.deletePassword(SERVICE, ANTH_KEY);
    await keytar.deletePassword(SERVICE, CTX_KEY);
    json(res, 200, { ok: true });
    return;
  }

  // ── Odoo proxy ──
  if (method === "POST" && url === "/jsonrpc") {
    const body = await readBody(req);
    // Read target URL from keychain
    const raw = await keytar.getPassword(SERVICE, ODOO_KEY);
    const creds = raw ? JSON.parse(raw) : null;
    if (!creds?.url) { json(res, 400, { error: "No Odoo URL in keychain" }); return; }
    try {
      const odooRes = await fetch(`${creds.url}/jsonrpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const text = await odooRes.text();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(text);
    } catch (e) {
      json(res, 502, { error: { message: "Proxy error: " + e.message } });
    }
    return;
  }

  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => {
  console.log("");
  console.log("  ⏱  Odoo Time Tracker");
  console.log(`  ✅  Running at http://localhost:${PORT}`);
  console.log("  🔐  Credentials stored in system keychain");
  console.log("");
  console.log("  Press Ctrl+C to stop");
  console.log("");

  const url = `http://localhost:${PORT}`;
  const cmd = process.platform === "win32" ? `start "" "${url}"`
    : process.platform === "darwin" ? `open "${url}"`
    : `xdg-open "${url}"`;
  require("child_process").exec(cmd);
});
