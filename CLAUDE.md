# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
npm install keytar
node odoo-proxy.js
```

Then open `http://localhost:3010` in a browser. No build step is required — React is loaded via CDN and JSX is transpiled in-browser by Babel.

## Architecture

This is a two-file application:

- **`odoo-proxy.js`** — Node.js HTTP server (port 3010). Serves the frontend and acts as a secure backend proxy. Stores/retrieves credentials (Odoo connection + Anthropic API key) via the system keychain using `keytar`. Proxies Odoo JSON-RPC requests so the Odoo URL never reaches the browser.

- **`odoo-tracker.html`** — Single-file React SPA (no bundler). Contains all UI, state, and logic. Makes direct calls to the Anthropic Claude API from the browser for AI parsing. Communicates with the proxy for keychain access and Odoo requests.

### Data Flow

1. User types a natural-language work description
2. Frontend calls Anthropic Claude API directly, passing project/task context
3. Claude returns structured JSON (date, project, task, hours, description)
4. User reviews/edits parsed entries
5. Entries are submitted to Odoo via `POST /jsonrpc` on the proxy
6. Entries are also cached in `localStorage` for history/offline use

### Backend Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Serve HTML frontend |
| `GET/POST` | `/keychain/creds` | Read/write credentials in system keychain |
| `POST` | `/keychain/delete` | Clear stored credentials |
| `POST` | `/jsonrpc` | Proxy requests to Odoo JSON-RPC API |

## Theming System

All colours use CSS custom properties on the `data-theme` body attribute (`"light"` or `"dark"`). Accent colours are further overridden at runtime via `body.style.setProperty()` from a `PALETTES` array of 10 options (forest, ocean, violet, rust, rose, teal, amber, slate, midnight, crimson).

- **localStorage keys:** `odoo-tracker-theme`, `odoo-tracker-palette`
- **Accent CSS vars:** `--accent`, `--accent-hi`, `--accent-gradient`, `--accent-text`, `--accent-text-hi`, `--accent-text-lo`, `--border-accent`
- **Font:** Inter from Google Fonts CDN (400/500/600/700)

When adding UI, always use `var(--accent)`, `var(--text)`, `var(--border)` etc. — never hardcode colours.

## Electron Desktop App

`electron-main.js` wraps the app as a macOS desktop app (loads port 3011). `dist/` contains the built app (`Odoo Tracker.app`). The browser dev workflow uses port 3010 only.

## Testing UI Changes

After editing `odoo-tracker.html`, always reload `http://localhost:3010` in Chrome and verify the changed feature visually before reporting done. Use browser automation tools (`mcp__claude-in-chrome__*`) to test interactively.
