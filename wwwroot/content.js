function GetChannelId() {
    chrome.runtime.sendMessage( //goes to bg_page.js
        ["GetChannelID", location.href],
        data => {
            let result = data.match("\"channelId\"\:\"([^\"]*)\"");
            var channelId = result[1];

            SetSubscriptionDate(channelId)
        }
    )
}

function GetSubscriptionInfoUrl(channelId) {
    return `https://content.googleapis.com/youtube/v3/subscriptions?mine=true&maxResults=50&part=snippet&key=AIzaSyAlp4lZkYS1x4jT4oJ3lMj_-GpPZcd1Grg&forChannelId=${channelId}`
}

function IsYoutubeVideoPage() {
    return location.href.indexOf("https://www.youtube.com/watch?v=") >= 0
}

function RetrieveSubscriptionDate() {
    if (!IsYoutubeVideoPage()) {
        return;
    }

    GetChannelId();
}

function SetSubscriptionDate(channelId) {
    let subscriberInfoUrl = GetSubscriptionInfoUrl(channelId);
    chrome.runtime.sendMessage( //goes to bg_page.js
        ["GetSubscriptionDate", subscriberInfoUrl],
        data => {
            let responseBlob = JSON.parse(data);
            date = responseBlob["items"][0]["snippet"]["publishedAt"];
            
            let dateTime = new Date(date).toLocaleDateString();
            SetSubscriptionText(dateTime);
        }
    )
}

function SetSubscriptionText(datetime) {
    let subscriptionParentClass = document.body;

    let observer = new MutationObserver(function(mutations){
        let subscriptionButton = document.getElementById("notification-preference-button");
        if(subscriptionButton) {
            let subscriptionText = subscriptionButton.getElementsByClassName("yt-core-attributed-string yt-core-attributed-string--white-space-no-wrap")[0];

            if (subscriptionText.textContent == "Subscribed") {
                subscriptionText.textContent = `${subscriptionText.textContent} since ${datetime}`;
                observer.disconnect(); // to stop observing the dom
            }
        }
    })

    observer.observe(subscriptionParentClass, { 
        childList: true,
        subtree: true // needed if the node you're targeting is not the direct parent
    });
}

RetrieveSubscriptionDate();

let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    onUrlChange();
  }
}).observe(document, {subtree: true, childList: true});

function onUrlChange() {
    RetrieveSubscriptionDate();
}