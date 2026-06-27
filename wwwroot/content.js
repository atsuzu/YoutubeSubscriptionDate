// Injected into youtube.com watch pages. Rewrites the channel's
// "Subscribed" button to read "Subscribed since <date>".

const SUBSCRIBED_LABEL = "Subscribed";

function GetChannelId() {
    chrome.runtime.sendMessage( // goes to BackgroundWorker.js
        ["GetChannelID", location.href],
        data => {
            let result = data && data.match(/"channelId":"([^"]*)"/);
            if (!result) {
                console.warn("[SubDate] Could not find channelId in page HTML.");
                return;
            }
            SetSubscriptionDate(result[1]);
        }
    );
}

function GetSubscriptionInfoUrl(channelId) {
    return `https://content.googleapis.com/youtube/v3/subscriptions?mine=true&maxResults=50&part=snippet&key=AIzaSyAlp4lZkYS1x4jT4oJ3lMj_-GpPZcd1Grg&forChannelId=${channelId}`;
}

function IsYoutubeVideoPage() {
    return location.href.indexOf("https://www.youtube.com/watch?v=") >= 0;
}

function RetrieveSubscriptionDate() {
    if (!IsYoutubeVideoPage()) {
        return;
    }

    GetChannelId();
}

function SetSubscriptionDate(channelId) {
    let subscriberInfoUrl = GetSubscriptionInfoUrl(channelId);
    chrome.runtime.sendMessage( // goes to BackgroundWorker.js
        ["GetSubscriptionDate", subscriberInfoUrl],
        data => {
            let responseBlob;
            try {
                responseBlob = JSON.parse(data);
            } catch (e) {
                console.warn("[SubDate] Subscriptions API did not return JSON.", data);
                return;
            }

            let items = responseBlob && responseBlob.items;
            if (!items || items.length === 0) {
                // Not subscribed, or the API returned an error/empty result.
                // Leave the button untouched rather than crashing.
                return;
            }

            let date = items[0].snippet.publishedAt;
            let dateTime = new Date(date).toLocaleDateString();
            SetSubscriptionText(dateTime);
        }
    );
}

// Find the subscribe button's text element and append the date.
// Anchored on the stable <ytd-subscribe-button-renderer> custom element and
// the visible "Subscribed" text, rather than fragile element ids/class combos.
function SetSubscriptionText(datetime) {
    const desiredText = `${SUBSCRIBED_LABEL} since ${datetime}`;

    const tryInject = () => {
        const renderer = document.querySelector("ytd-subscribe-button-renderer");
        if (!renderer) {
            return false;
        }

        // The button label is rendered inside a yt-core-attributed-string span.
        // There can be several; pick the one that currently reads "Subscribed".
        const candidates = renderer.querySelectorAll(".yt-core-attributed-string");
        for (const el of candidates) {
            const label = (el.textContent || "").trim();
            if (label === SUBSCRIBED_LABEL) {
                el.textContent = desiredText;
                return true;
            }
        }
        return false;
    };

    // Try immediately, then keep watching: YouTube hydrates and re-renders the
    // button asynchronously and on navigation, which would otherwise wipe our
    // change. Re-inject whenever it reverts to plain "Subscribed".
    tryInject();

    const observer = new MutationObserver(() => tryInject());
    observer.observe(document.body, { childList: true, subtree: true });

    // Stop watching after a while so observers don't accumulate across SPA navs.
    setTimeout(() => observer.disconnect(), 15000);
}

RetrieveSubscriptionDate();

// YouTube is a single-page app: detect client-side navigations and re-run.
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        onUrlChange();
    }
}).observe(document, { subtree: true, childList: true });

function onUrlChange() {
    RetrieveSubscriptionDate();
}
