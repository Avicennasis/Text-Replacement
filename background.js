// background.js
// -----------------------------------------------------------------------------
// This is the background service worker.
// It is event-driven and runs only when needed.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// LOGGING UTILITY
// Simple logging system to provide consistent, prefixed log messages.
// -----------------------------------------------------------------------------
const ENABLE_DEBUG_LOGGING = false; // Toggle for debug logs

const Logger = {
  info: (message, ...args) => console.log(`[Text Replacement] ${message}`, ...args),
  debug: (message, ...args) => ENABLE_DEBUG_LOGGING && console.log(`[Text Replacement DEBUG] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[Text Replacement WARNING] ${message}`, ...args),
  error: (message, ...args) => console.error(`[Text Replacement ERROR] ${message}`, ...args)
};

// Runs when you install the extension for the first time.
chrome.runtime.onInstalled.addListener(() => {
  Logger.info('Extension installed successfully!');
  Logger.debug('Installation details:', chrome.runtime.getManifest());
});

// Listens for clicks on the Extension Icon in the browser toolbar.
// We use this to open the full 'manage.html' page instead of a small popup,
// giving the user a better interface to manage their rules.
chrome.action.onClicked.addListener(() => {
  Logger.debug('Extension icon clicked, opening management page');
  chrome.tabs.create({ url: 'manage.html' });
});
