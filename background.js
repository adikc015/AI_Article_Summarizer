chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["geminiApiKey"], (result) => {
    if (!result || result.geminiApiKey === undefined) {
      // If the geminiApiKey does not exist in storage, open the options page
      chrome.tabs.create({ url: "options.html" });
    }
  });
});
