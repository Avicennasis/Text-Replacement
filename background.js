// background.js
// -----------------------------------------------------------------------------
// This is the background service worker.
// It is event-driven and runs only when needed.
// -----------------------------------------------------------------------------

// Runs when you install the extension for the first time.
chrome.runtime.onInstalled.addListener(() => {
  console.log('Avic\'s Text Replacement extension installed!');
});

// Listens for clicks on the Extension Icon in the browser toolbar.
// We use this to open the full 'manage.html' page instead of a small popup,
// giving the user a better interface to manage their rules.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'manage.html' });
});
