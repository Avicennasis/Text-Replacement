function replaceTextInNode(node, wordMap) {
  // Only process text nodes
  if (node.nodeType === 3) {
    let text = node.nodeValue;
    for (const [word, { replacement, caseSensitive }] of Object.entries(wordMap)) {
      if (replacement === undefined) continue;
      const regexFlags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(`\\b${word}\\b`, regexFlags);
      text = text.replace(regex, replacement);
    }
    node.nodeValue = text;
  }
  // Recursively call for child nodes
  else if (node.nodeType === 1 && node.childNodes) {
    node.childNodes.forEach(child => replaceTextInNode(child, wordMap));
  }
}

chrome.storage.sync.get('wordMap', (data) => {
  if (data.wordMap) {
    const wordMap = data.wordMap;
    
    // Initial replacement on page load
    replaceTextInNode(document.body, wordMap);

    // Observe for future changes to the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          replaceTextInNode(node, wordMap);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
});
