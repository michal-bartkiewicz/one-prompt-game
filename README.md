# Vector Interceptor

A 3D aircraft dogfighting game rendered in real time into a low-refresh-rate ASCII terminal viewport for a retro Linux/CRT hacker aesthetic.

## Prerequisites

- [Node.js](https://nodejs.org/) **18+** (or 20+ LTS)
- **npm** (included with Node.js)

No API keys, external databases, or backend services are required—everything (3D software rasterizer, flight physics, AI squadrons, and Web Audio synth) runs locally in your browser.

---

## Single-File Offline HTML (Linux, Windows, Android)

You can build the entire game into **one self-contained `.html` file** that opens directly from disk (`file://`) in Firefox, Chrome, or Edge on Linux, Windows, or Android—no Node server or internet connection required at runtime:

```bash
npm install
npm run build:html
```

This generates:

```text
dist/vector-interceptor.html
```

Copy or open `dist/vector-interceptor.html` directly in Firefox or any mobile/desktop browser:
- **Linux**: `firefox dist/vector-interceptor.html`
- **Windows**: Double-click `vector-interceptor.html`
- **Android**: Open `vector-interceptor.html` in Firefox for Android or Chrome

*(Standard Vite `dist/index.html` uses `<script type="module">` and `/assets/...` paths, which browsers block over `file://` due to CORS. `npm run build:html` bundles all CSS and JS into a single inline classic script with zero external requests.)*

---

## Launch Locally in Dev Mode

1. **Install dependencies** (inside the project directory):

   ```bash
   npm install
   ```

2. **Start the development server**:

   ```bash
   npm run dev
   ```

3. **Open in your browser**:

   Navigate to:

   ```text
   http://localhost:3000
   ```

   > Tip: Append `?autostart=1` (`http://localhost:3000/?autostart=1`) to skip the title screen and launch straight into flight.

---

## Production Build & Static Hosting

If you want to build and serve the standard multi-file production bundle:

1. **Build the app**:

   ```bash
   npm run build
   ```

   This outputs static files into the `dist/` directory.

2. **Serve and open in your browser**:

   - **Vite Preview**:
     ```bash
     npm run preview
     ```
     Then open the local URL printed in your terminal (typically `http://localhost:4173`).

   - **Python static server** (handy on Linux):
     ```bash
     python3 -m http.server 8080 --directory dist
     ```
     Then open `http://localhost:8080`.

   - **Deploy `dist/`** to any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages, Nginx, etc.).

---

## Controls

| Key | Action |
| :--- | :--- |
| `W` / `S` or `↑` / `↓` | Pitch up / down |
| `A` / `D` or `←` / `→` | Bank and turn left / right |
| `Q` / `E` | Rudder roll dodge |
| `Shift` | Afterburner boost |
| `Space` | Fire twin autocannons |
| `Enter` or `M` | Launch homing missile (when locked) |
| `V` | Toggle Chase / Cockpit camera |
| `F` | Cycle terminal refresh rate (`8 Hz` / `12 Hz` / `18 Hz` / `24 Hz`) |
| `C` | Cycle CRT phosphor palette (`Green` / `Amber` / `Cyan`) |
| `I` | Toggle pitch axis (`Arcade Normal` / `Inverted Flight`) |
| `N` | Mute / unmute procedural Web Audio |
| `P` or `Esc` | Pause / resume simulation |

---

## Tests & Typecheck

```bash
# Run unit tests (3D math, Z-buffered ASCII rasterizer, flight & combat simulation)
npx tsx --test src/game/math3d.test.ts src/engine/asciiRenderer.test.ts src/game/simulation.test.ts

# Typecheck
npm run lint
```
