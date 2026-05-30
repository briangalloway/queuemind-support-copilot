// Background service worker for QueueMind Chrome Extension (Manifest V3)

// Configure the extension to open the side panel when the user clicks the toolbar icon
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .then(() => {
        console.log("QueueMind Side Panel behavior configured successfully.");
      })
      .catch((error) => {
        console.error("Error setting panel behavior:", error);
      });
  }
});
