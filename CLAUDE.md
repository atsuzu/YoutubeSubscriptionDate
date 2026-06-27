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

Work is split across two JS files. The split exists because content scripts cannot use `chrome.identity` or make the cross-origin Google API call — only the service worker can. Both files log every step (`[SubDate]` from the content script in the page console; `[SubDate][bg]` from the worker in the service-worker console) — this is the primary way to debug it, since the extension can only be observed in a real browser.

1. **`wwwroot/content.js`** is injected into `https://www.youtube.com/*`. On every watch page (and on SPA URL changes, detected via a `MutationObserver` watching `location.href`):
   - Resolves the video's channel id itself by `fetch`-ing the current watch URL (same-origin) and regexing `externalChannelId` (fallback `videoDetails.channelId`) out of the embedded JSON. Re-fetches per navigation so the id always matches the current video.
   - Sends `["GetSubscriptionDate", apiUrl]` to the worker to fetch the user's subscription record for that channel.
   - Locates the subscribe button via `ytd-subscribe-button-renderer` / `yt-subscribe-button-view-model` and the visible "Subscribed" text (not fragile element ids), then rewrites it to "Subscribed since <date>". A `MutationObserver` re-applies across YouTube's async re-renders, and logs the button's text if it never finds it.
2. **`wwwroot/BackgroundWorker.js`** is the MV3 service worker. It handles only `GetSubscriptionDate`: wraps the fetch in `chrome.identity.getAuthToken({interactive: true})`, checks `chrome.runtime.lastError`, and sends the OAuth bearer token to the YouTube Data API v3 `subscriptions?mine=true&forChannelId=...` endpoint. No API key is used — OAuth-authorized requests don't need one.

## Manifest & auth (`wwwroot/manifest.json`)

- OAuth is configured via the `oauth2` block (Google client id + `youtube.readonly` scope) and the `identity` permission. The `key` field pins the extension id so the OAuth client id stays valid across loads — do not change it casually.
- `host_permissions` grants `content.googleapis.com`; `content_scripts` matches youtube.com; `web_accessible_resources` exposes the Blazor `framework/*` and `content/*` assets.
- CSP includes `wasm-unsafe-eval`, required for the Blazor WASM runtime.
- The OAuth `client_id` and `key` are public-by-design (client IDs and the extension-id public key are not secrets). There is **no** `client_secret`, and the previously hardcoded Google API key has been removed.

## Razor pages

`Pages/Index.razor`, `Options.razor`, `Popup.razor` map to `index.html` / `options.html` / `popup.html` and are near-empty template stubs. `manifest.json` wires `options.html` as the options page. There is no popup registered. Only touch these if adding actual extension UI.
