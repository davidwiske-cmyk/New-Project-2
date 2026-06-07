// Service worker — kept minimal, message passing handled in content.js and popup.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("Virtual Try-On extension installed.");
});
