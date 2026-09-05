# Celeste

A period and hormone tracker that runs as an installable web app. All data stays
in the browser on the device — no server, no account, nothing uploaded.

---

## Putting it on GitHub from an iPad

You only do this once. After it, Netlify rebuilds and republishes by itself
every time you push, so you never build anything or visit Netlify again.

### 1. Make the repository

In Safari, go to **github.com**, create a free account, then **New repository**:

- Name: `celeste`
- **Private**
- Do **not** tick "Add a README" — this project already has one

### 2. Install Working Copy

**Working Copy** from the App Store. It is a real git client for iPad and it
shows up inside the Files app, which is what makes the rest of this work.

Open it, go to Settings → Repository Hosting → GitHub, and sign in.

### 3. Clone and fill the repo

1. In Working Copy, tap **+** → **Clone repository** → pick `celeste`
2. Unzip this project in the Files app (long-press the zip → Uncompress)
3. Open Files → Browse → **Working Copy** → `celeste`
4. Copy everything from the unzipped folder into it — `src`, `public`,
   `index.html`, `package.json`, `vite.config.js`, `netlify.toml`, `README.md`,
   `.gitignore`
5. Back in Working Copy, tap the repo → **Commit** → write a message → **Push**

### 4. Connect Netlify

At **app.netlify.com**: *Add new site → Import an existing project → GitHub*,
authorise, pick `celeste`. The build settings come from `netlify.toml`, so leave
them alone and deploy.

First build takes two or three minutes. After that, roughly one minute per push.

### 5. Install it on your phone

Open your Netlify URL in **Safari** → Share → **Add to Home Screen**.
On Android, open in Chrome and accept the install prompt.

---

## Updating it after that

1. Download the new `celeste-app.jsx`
2. In Files, rename it to **`App.jsx`**
3. Drop it into **Working Copy → celeste → src**, replacing the old one
4. Commit and push

Netlify does the rest. Nothing to build, nothing to upload.

### The one thing to remember

When you change the app, bump **both** version numbers so installed phones know
to update:

- `src/App.jsx` → `const VERSION = "1.2"`
- `public/sw.js` → `const CACHE = "celeste-1.2"`

Keep them identical. If you skip this, anyone who has installed the app keeps
seeing the old version, because it runs from cache. When they match a new value,
people get a *"A new version is ready"* banner with a Reload button.

---

## Running it on a computer (optional)

```bash
npm install     # once
npm run dev     # local preview, updates as you save
npm run build   # produces dist/, the finished site
```

`npm run dev` also prints a Network address you can open on your phone over Wi-Fi.

---

## What's in here

| File | What it does |
|---|---|
| `src/App.jsx` | The whole app — every screen, the hormone model, the cycle maths, twelve languages |
| `src/storage.js` | Saves your data to IndexedDB in the browser |
| `src/pwa.js` | Registers the service worker, spots new builds |
| `src/Prompts.jsx` | The "add to home screen" and "new version" banners |
| `public/sw.js` | Makes the app open offline. Bump `CACHE` on every deploy |
| `public/manifest.webmanifest` | Name, colours and icons used when installing |
| `public/icons/` | The flower icon at the sizes iOS and Android need |
| `public/_headers` | Stops the service worker itself being cached |
| `netlify.toml` | Tells Netlify how to build — no dashboard config needed |

---

## Known limits of a web app

- **Reminders do not fire yet.** They appear as banners inside the app. Real
  notifications need a small push server, and on iPhone they only work once the
  app has been added to the home screen.
- **Widgets are not possible.** That page is a preview of a native build.
- **Apple Health cannot connect.** A browser has no route to HealthKit.
- **iOS may clear the data** if the app goes many weeks completely unused. Export
  a backup occasionally: Settings → Export report → Download full backup.
