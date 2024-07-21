chrome.runtime.sendMessage({ action: 'getWordMap' }, (response) => {
  if (response && response.wordMap) {
    replaceText(response.wordMap);
  }
});

function replaceText(wordMap) {
  function walk(node) {
    let child, next;

    switch (node.nodeType) {
      case 1:  // Element
      case 9:  // Document
      case 11: // Document fragment
        child = node.firstChild;
        while (child) {
          next = child.nextSibling;
          walk(child);
          child = next;
        }
        break;

      case 3: // Text node
        handleText(node);
        break;
    }
  }

  function handleText(textNode) {
    let text = textNode.nodeValue;
    for (let [word, { replacement, caseSensitive }] of Object.entries(wordMap)) {
      if (replacement === undefined) {
        continue;
      }
      // Create a regular expression with the appropriate flags
      const regexFlags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(`\\b${word}\\b`, regexFlags);
      text = text.replace(regex, replacement);
    }
    textNode.nodeValue = text;
  }

  walk(document.body);
}
