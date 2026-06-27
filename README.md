# Youtube Subscription Date

A Chrome/Edge extension (Manifest V3) that rewrites YouTube's **Subscribed** button on a
watch page to read **Subscribed since `<date>`** when you're already subscribed to the
channel.

It's built as a Blazor WebAssembly browser extension (via the `Blazor.BrowserExtension`
package), but the actual feature logic lives in plain JavaScript:

- `wwwroot/content.js` — injected into `youtube.com`; locates the subscribe button and
  rewrites its text.
- `wwwroot/BackgroundWorker.js` — the service worker; fetches the channel id from the page
  and calls the YouTube Data API (using a Google OAuth token via `chrome.identity`) to look
  up when you subscribed.

## Prerequisites

- [.NET 7 SDK](https://dotnet.microsoft.com/download/dotnet/7.0) (`dotnet --version`)
- Chrome or any Chromium browser (Edge, Brave, …)

## Build

```bash
dotnet publish -c Release
```

The loadable extension is written to:

```
bin/Release/net7.0/publish/wwwroot/
```

## Run / test locally (load unpacked)

1. Build with the command above.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** on (top right).
4. Click **Load unpacked** and select the published `wwwroot/` folder above.
5. Open a YouTube video for a channel you're subscribed to. The button should read
   "Subscribed since …". The first run triggers a Google sign-in consent popup
   (`chrome.identity`).

When you change code, re-run `dotnet publish -c Release`, then click the **Reload** ↻ icon on
the extension card and refresh the YouTube tab.

Tip: open the YouTube page's DevTools console to see `[SubDate]` warnings, and the service
worker console (the **service worker** link on the extension card) for background errors.

## Publish to the Chrome Web Store

1. **Bump the version** in `wwwroot/manifest.json` (`"version"`). The Web Store rejects
   re-uploads that don't increase the version.
2. **Build**: `dotnet publish -c Release`.
3. **Zip the published output**. Zip the *contents* of `bin/Release/net7.0/publish/wwwroot/`
   (so `manifest.json` sits at the root of the zip), e.g. from that folder:
   ```bash
   cd bin/Release/net7.0/publish/wwwroot
   zip -r ../youtube-subscription-date.zip .
   ```
4. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (one-time $5 developer registration), **Add new item**, and upload the zip.
5. Fill in the listing (description, screenshots, icons, privacy practices) and submit for
   review.

### Important: OAuth setup must match the published extension

This extension signs the user in with Google to read their subscriptions
(`youtube.readonly` scope). For that to keep working after publishing:

- The `"key"` field in `manifest.json` pins the extension ID. Keep it stable so the ID
  doesn't change between local testing and the store, otherwise the OAuth client breaks.
- The `oauth2.client_id` must be a **Chrome Extension** OAuth client in the
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials) whose Item ID
  matches this extension's ID.
- `youtube.readonly` is a **sensitive scope**, so the Google OAuth consent screen must be
  published and pass Google's verification before the extension works for users outside your
  test list. Set this up under **APIs & Services → OAuth consent screen**.

## Privacy policy

`PrivacyPolicy.html` is included for the store listing (host it somewhere public and link it
in the listing).
