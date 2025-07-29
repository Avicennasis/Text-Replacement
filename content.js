// content.js

function escapeRegExp(string) {
  // Escapes special characters for use in a regular expression.
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function replaceTextInNode(node, wordMap) {
  // Only process text nodes
  if (node.nodeType === 3) {
    let text = node.nodeValue;
    for (const [word, { replacement, caseSensitive }] of Object.entries(wordMap)) {
      if (replacement === undefined) continue;

      const escapedWord = escapeRegExp(word);
      const regexFlags = caseSensitive ? 'g' : 'gi';

      // Conditionally add word boundaries
      const prefix = /^\w/.test(word) ? '\\b' : '';
      const suffix = /\w$/.test(word) ? '\\b' : '';
      
      const regex = new RegExp(`${prefix}${escapedWord}${suffix}`, regexFlags);
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
