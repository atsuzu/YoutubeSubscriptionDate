// Service worker. Its only job: make the OAuth-authenticated call to the
// YouTube Data API (content scripts can't use chrome.identity or do this
// cross-origin request). Logs use the [SubDate][bg] prefix and show up in the
// service-worker console: chrome://extensions -> this extension -> "service worker".

// Import for the side effect of defining a global 'browser' variable.
import * as _ from "/content/Blazor.BrowserExtension/lib/browser-polyfill.min.js";

const LOG = "[SubDate][bg]";

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    const [cmd, arg] = msg;
    if (cmd === "GetSubscriptionDate") {
        GetSubscriptionDate(arg, sendResponse);
        return true; // respond asynchronously
    }
    return false;
});

function GetSubscriptionDate(url, sendResponse) {
    console.log(LOG, "requesting Google auth token...");
    chrome.identity.getAuthToken({ interactive: true }, function (token) {
        const lastError = chrome.runtime.lastError;
        if (lastError || !token) {
            const detail = lastError ? lastError.message : "no token returned";
            console.error(LOG, "getAuthToken failed:", detail);
            sendResponse(JSON.stringify({ error: "auth_failed", detail }));
            return;
        }

        console.log(LOG, "got token; calling YouTube Data API...");
        fetch(url, { headers: { Authorization: "Bearer " + token } })
            .then((response) => {
                console.log(LOG, "API HTTP status:", response.status);
                return response.text();
            })
            .then((text) => sendResponse(text))
            .catch((e) => {
                console.error(LOG, "API fetch failed:", e);
                sendResponse(JSON.stringify({ error: "fetch_failed", detail: String(e) }));
            });
    });
}
