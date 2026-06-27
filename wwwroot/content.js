// Content script: injected into youtube.com watch pages.
// Rewrites the channel's "Subscribed" button to "Subscribed since <date>".
//
// Logs every step with the [SubDate] prefix. Open the YouTube tab's DevTools
// console (F12) to follow along. Background-worker logs use [SubDate][bg] and
// appear in the service-worker console (chrome://extensions -> this extension
// -> "service worker").

const LOG = "[SubDate]";

function isWatchPage() {
    return location.pathname === "/watch";
}

async function run() {
    try {
        if (!isWatchPage()) {
            console.log(LOG, "not a watch page, skipping:", location.pathname);
            return;
        }
        console.log(LOG, "watch page detected:", location.href);

        const channelId = await getChannelId();
        if (!channelId) {
            console.warn(LOG, "could not determine channelId — aborting.");
            return;
        }
        console.log(LOG, "channelId:", channelId);

        // OAuth-authorized request: no API key needed.
        const apiUrl =
            "https://content.googleapis.com/youtube/v3/subscriptions" +
            `?mine=true&maxResults=1&part=snippet&forChannelId=${channelId}`;

        console.log(LOG, "asking background worker for subscription date...");
        chrome.runtime.sendMessage(["GetSubscriptionDate", apiUrl], (data) => {
            if (chrome.runtime.lastError) {
                console.error(LOG, "sendMessage failed:", chrome.runtime.lastError.message);
                return;
            }
            handleSubscriptionResponse(data);
        });
    } catch (e) {
        console.error(LOG, "run() threw:", e);
    }
}

function handleSubscriptionResponse(data) {
    let res;
    try {
        res = JSON.parse(data);
    } catch (e) {
        console.error(LOG, "background returned non-JSON:", data);
        return;
    }

    if (res.error) {
        console.error(LOG, "background reported an error:", res);
        return;
    }

    if (!res.items || res.items.length === 0) {
        console.log(
            LOG,
            "no subscription returned. Either you're not subscribed to this channel, " +
            "or the API call failed. Full response:",
            res
        );
        return;
    }

    const publishedAt = res.items[0].snippet.publishedAt;
    const date = new Date(publishedAt).toLocaleDateString();
    console.log(LOG, "subscribed since", date, `(raw: ${publishedAt})`);
    injectDate(date);
}

// Get the current video's channel id by fetching the watch page HTML
// (same-origin, so the content script can do this directly) and pulling the
// channel id out of YouTube's embedded JSON. We re-fetch per video so SPA
// navigations always resolve the *current* channel.
async function getChannelId() {
    try {
        const html = await fetch(location.href, { credentials: "include" }).then((r) => r.text());
        // externalChannelId lives in playerMicroformatRenderer and is the most
        // reliable single source for the video's channel.
        let m = html.match(/"externalChannelId":"(UC[\w-]+)"/);
        if (m) {
            console.log(LOG, "channelId via externalChannelId");
            return m[1];
        }
        // Fallback: videoDetails.channelId.
        m = html.match(/"videoDetails":\{[^}]*?"channelId":"(UC[\w-]+)"/);
        if (m) {
            console.log(LOG, "channelId via videoDetails");
            return m[1];
        }
        console.warn(LOG, "no channelId pattern matched in page HTML.");
        return null;
    } catch (e) {
        console.error(LOG, "failed to fetch page HTML for channelId:", e);
        return null;
    }
}

// Find the subscribe button's text and append the date. YouTube hydrates and
// re-renders this button asynchronously, so we keep watching and re-apply.
function injectDate(date) {
    const desired = `Subscribed since ${date}`;

    const tryInject = () => {
        const renderer = document.querySelector(
            "ytd-subscribe-button-renderer, yt-subscribe-button-view-model"
        );
        const root = renderer || document;
        const candidates = root.querySelectorAll(
            ".yt-core-attributed-string, .yt-spec-button-shape-next__button-text-content"
        );
        for (const el of candidates) {
            const text = (el.textContent || "").trim();
            if (text === desired) return true; // already injected
            if (text === "Subscribed") {
                el.textContent = desired;
                console.log(LOG, "injected text into subscribe button.");
                return true;
            }
        }
        return false;
    };

    if (tryInject()) return;

    console.log(LOG, "subscribe button not ready; observing DOM for it...");
    const observer = new MutationObserver(() => tryInject());
    observer.observe(document.body, { childList: true, subtree: true });

    // Stop after a while; also log a diagnostic if we never succeeded so we can
    // see what the button actually looks like.
    setTimeout(() => {
        observer.disconnect();
        const r = document.querySelector("ytd-subscribe-button-renderer, yt-subscribe-button-view-model");
        if (!r) {
            console.warn(LOG, "gave up: no subscribe-button element found on the page.");
        } else if (r.textContent.indexOf(date) === -1) {
            console.warn(
                LOG,
                "gave up injecting. Subscribe button text content was:",
                JSON.stringify(r.textContent.trim())
            );
        }
    }, 20000);
}

// Initial run.
run();

// YouTube is a single-page app: re-run on client-side navigation.
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log(LOG, "navigation detected:", location.href);
        // Give YouTube a moment to swap in the new subscribe button.
        setTimeout(run, 1000);
    }
}).observe(document, { subtree: true, childList: true });
