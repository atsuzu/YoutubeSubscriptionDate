# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome/Edge browser extension (Manifest V3) that rewrites YouTube's "Subscribed" button to read "Subscribed since `<date>`" on watch pages. It is built with **Blazor WebAssembly** scaffolded by the [`Blazor.BrowserExtension`](https://github.com/mingyaulee/Blazor.BrowserExtension) package, but the actual feature is implemented in plain JavaScript (`wwwroot/content.js` + `wwwroot/BackgroundWorker.js`). The Blazor/Razor side is mostly template scaffolding and is not where the logic lives.

## Build & run

- `dotnet build` — compile.
- `dotnet publish -c Release` — produces the loadable extension at `bin/Release/net10.0/publish/browserextension/` (the `Blazor.BrowserExtension` build assembles this folder; note it's `browserextension/`, not `wwwroot/`, as of package v5). Load that folder as an **unpacked extension** in `chrome://extensions` (Developer Mode → Load unpacked). The extension cannot be exercised via plain `dotnet run`; it must run inside the browser against youtube.com.
- Target framework is `net10.0` (`Blazor.BrowserExtension` 5.x). No test project exists.

When iterating on the JS in `wwwroot/`, rebuild/publish and hit "Reload" on the extension card, then reload a YouTube watch page.

## How the feature works (the important flow)

The work happens across two JS files communicating by `chrome.runtime.sendMessage`, because content scripts cannot call `chrome.identity` directly — only the background service worker can.

1. **`wwwroot/content.js`** is injected into `https://www.youtube.com/*`. On every watch page (and on SPA URL changes, detected via a `MutationObserver` watching `location.href`):
   - Sends `["GetChannelID", url]` to the background worker, which fetches the page HTML; content.js regex-extracts `channelId` from it.
   - Sends `["GetSubscriptionDate", apiUrl]` to fetch the user's subscription record for that channel.
   - Uses another `MutationObserver` to wait for `#notification-preference-button` to render, then appends ` since <date>` to its text once it reads "Subscribed". This DOM dependency (button id + the `yt-core-attributed-string` class names) is brittle and breaks when YouTube changes its markup.
2. **`wwwroot/BackgroundWorker.js`** is the MV3 service worker. It handles the two message commands. `GetSubscriptionDate` wraps the fetch in `chrome.identity.getAuthToken({interactive: true})` and sends the OAuth bearer token to the YouTube Data API v3 `subscriptions?mine=true&forChannelId=...` endpoint.

## Manifest & auth (`wwwroot/manifest.json`)

- OAuth is configured via the `oauth2` block (Google client id + `youtube.readonly` scope) and the `identity` permission. The `key` field pins the extension id so the OAuth client id stays valid across loads — do not change it casually.
- `host_permissions` grants `content.googleapis.com`; `content_scripts` matches youtube.com; `web_accessible_resources` exposes the Blazor `framework/*` and `content/*` assets.
- CSP includes `wasm-unsafe-eval`, required for the Blazor WASM runtime.
- `content.js` contains a hardcoded Google API `key` for the `GetChannelID` path. Treat any keys/client ids here as live credentials.

## Razor pages

`Pages/Index.razor`, `Options.razor`, `Popup.razor` map to `index.html` / `options.html` / `popup.html` and are near-empty template stubs. `manifest.json` wires `options.html` as the options page. There is no popup registered. Only touch these if adding actual extension UI.
