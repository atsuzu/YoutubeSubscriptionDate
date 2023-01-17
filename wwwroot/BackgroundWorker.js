// Import for the side effect of defining a global 'browser' variable
import * as _ from "/content/Blazor.BrowserExtension/lib/browser-polyfill.min.js";

chrome.runtime.onMessage.addListener(
  function(msg, sender, onSuccess) {
      var arg, cmd;
      [cmd, arg] = msg;

      if (cmd == "GetSubscriptionDate") {
        GetSubscriptionDate(arg, onSuccess);
      }
      else if(cmd == "GetChannelID") {
        GetChannelID(arg, onSuccess);
      }
      return true;  // Will respond asynchronously.
  }
);

function GetChannelID(url, onSuccess) {
  fetch(url, {
    headers: {
        'referer': 'https://www.youtube.com/'
    }
  })
  .then(response => response.text())
  .then(responseText => onSuccess(responseText))
}

function GetSubscriptionDate(url, onSuccess) {
  chrome.identity.getAuthToken({interactive: true}, function(token) {
    fetch(url, {
      headers: {
          'referer': 'https://www.youtube.com/',
          'Authorization': 'Bearer ' + token
      }
    })
    .then(response => response.text())
    .then(responseText => onSuccess(responseText))
  });
}
