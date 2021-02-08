chrome.runtime.onMessage.addListener(function(message, callback) {
  if (message.type == "saveLocalStorage") {
    chrome.storage.local.set({[message.key]: message.value})
  } else if (message.type == "getLocalStorage") {
    const value = chrome.storage.local.get(message.key);
    chrome.runtime.sendMessage({type: "getLocalStorageResult", "key": message.key, "value": value});
  }
});