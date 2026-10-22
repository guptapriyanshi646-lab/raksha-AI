# RakshaAI Frontend (HTML, CSS, JavaScript)

A responsive frontend prototype for the RakshaAI B.Tech mini project. It includes a landing page, feature cards, an interactive suspicious-link checker interface, a safety tip, and a backend integration adapter.

## Files

- `index.html` — page structure and content
- `style.css` — responsive visual design
- `script.js` — navigation, demo URL checks, results UI, optional speech sample, and backend request adapter
- `config.js` — switch between demo mode and backend mode

## Run locally

1. Download and extract this folder.
2. Open `index.html` in a modern browser.
3. For a smoother local development experience, use VS Code with the Live Server extension.

No Node.js installation or build step is required for the frontend-only demo.

## Demo mode

By default, `config.js` has:

```js
window.RAKSHA_CONFIG = {
  DEMO_MODE: true,
  API_BASE_URL: "",
  SCAN_ENDPOINT: "/api/scan",
  REQUEST_TIMEOUT_MS: 12000
};
```

In demo mode, the browser runs basic heuristics such as checking HTTPS usage, punycode, suspicious words, long hostnames, and multiple subdomains. These are educational signals only. They do **not** query a threat-intelligence database and cannot confirm that a URL is safe or malicious.

## Connect the backend later

Coordinate with the backend teammate on the endpoint URL, request fields, and response format. Then update `config.js`, for example:

```js
window.RAKSHA_CONFIG = {
  DEMO_MODE: false,
  API_BASE_URL: "http://localhost:8000",
  SCAN_ENDPOINT: "/api/scan",
  REQUEST_TIMEOUT_MS: 12000
};
```

The frontend sends a JSON POST request to `API_BASE_URL + SCAN_ENDPOINT` with this request body:

```json
{ "url": "https://example.com/" }
```

Expected response example:

```json
{
  "status": "suspicious",
  "score": 68,
  "signals": [
    { "level": "warning", "text": "The domain resembles a known brand." },
    "The URL contains an unusual redirect parameter."
  ]
}
```

Supported status values include `safe`, `suspicious`, and `dangerous` (the UI also maps common synonyms such as `malicious`, `low`, `medium`, and `high`). `signals` can be an array of strings or objects with `text`/`message` and optional `level`. The backend can also return `reasons` as an array instead of `signals`.

### Integration notes

- Ensure the backend enables CORS for the frontend origin when running on a different port or domain.
- Never put API secrets or private keys in frontend JavaScript. Keep secrets on the backend.
- `http://localhost:8000` only works on the same computer as the backend. For a deployed website, use the deployed backend URL and HTTPS.
- A browser cannot monitor ordinary phone calls in the background. Call monitoring, AI inference, reputation checks, and guardian alerts require separate backend/mobile implementation and permissions.
- The voice sample is a browser speech-synthesis demo and voice availability depends on the user's device/browser.

## Deploy on GitHub Pages

Upload `index.html`, `style.css`, `script.js`, `config.js`, and this README to the repository root. In GitHub, open **Settings → Pages**, choose **Deploy from a branch**, select the `main` branch and `/(root)`, then save. GitHub Pages can host this static frontend; it does not host a FastAPI backend.
