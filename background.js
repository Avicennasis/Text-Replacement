chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed!');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getWordMap') {
    chrome.storage.sync.get('wordMap', (data) => {
      sendResponse(data);
    });
    // Indicate that the response will be sent asynchronously
    return true;
  }
});
