// content.js
// -----------------------------------------------------------------------------
// This script runs on every webpage you visit. Its ONLY purpose is to find 
// text you want to replace and replace it. 
//
// PRIVACY NOTICE: 
// - This script does NOT send any data to external servers.
// - It does NOT track your browsing history.
// - All replacement rules are stored locally in your Chrome browser sync storage.
// -----------------------------------------------------------------------------

/**
 * Escapes special characters in a string to safe-guard against Regular Expression issues.
 * This prevents a "Regex Injection" attack and ensures that characters like "." or "*"
 * are treated as literal text, not special commands.
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles a list of words into a single, optimized Regular Expression.
 * This allows the extension to search for ALL your words at once, rather than
 * looping through the entire page hundreds of times (which would be slow).
 * 
 * @param {string[]} words - Array of words to find.
 * @param {boolean} caseSensitive - Whether to match exact casing.
 */
function buildRegex(words, caseSensitive) {
  if (words.length === 0) return null;

  // Sort words by length (longest first) to ensure "superman" is found before "super".
  // This prevents partial replacements from breaking longer words.
  const patterns = words.map(word => {
    const escaped = escapeRegExp(word);

    // Add "word boundaries" (\b) if the word starts/ends with a letter/number.
    // This ensures that replacing "cat" doesn't turn "catch" into "dogch".
    const prefix = /^\w/.test(word) ? '\\b' : '';
    const suffix = /\w$/.test(word) ? '\\b' : '';
    return `${prefix}${escaped}${suffix}`;
  });

  patterns.sort((a, b) => b.length - a.length);

  // Create the final Regex. 'g' = global (find all), 'i' = case-insensitive.
  return new RegExp(patterns.join('|'), caseSensitive ? 'g' : 'gi');
}

// Global variables to hold our current state.
let sensitiveRegex = null;   // For Case-Sensitive rules
let insensitiveRegex = null; // For Case-Insensitive rules
let wordMapCache = {};       // Quick lookup for replacements
let extensionEnabled = true; // Master switch state

/**
 * Updates the internal rules based on settings loaded from storage.
 * This is called whenever you change settings in the Manage page.
 */
function updateRegexes(wordMap) {
  const sensitiveWords = [];
  const insensitiveWords = [];
  const activeMap = {};

  for (const [word, data] of Object.entries(wordMap)) {
    // Only include rules that are explicitly enabled
    if (data.enabled !== false) {
      activeMap[word] = data;
      if (data.caseSensitive) {
        sensitiveWords.push(word);
      } else {
        insensitiveWords.push(word);
      }
    }
  }

  wordMapCache = activeMap;
  sensitiveRegex = buildRegex(sensitiveWords, true);
  insensitiveRegex = buildRegex(insensitiveWords, false);
}

// A list of HTML tags we NEVER touch. 
// Modifying these could break websites or annoying users while typing.
const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT']);

/**
 * Checks if a node is editable (like a text box).
 * We skip these so we don't change text while you are typing it!
 */
function isEditable(node) {
  if (node.isContentEditable) return true;
  if (node.parentNode && node.parentNode.isContentEditable) return true;
  return false;
}

/**
 * The core function that actually changes text.
 * It looks at a single text node, checks for matches, and swaps them.
 */
function processNode(node) {
  // Safety checks: stop if disabled, or if it's a dangerous tag/editable area.
  if (!extensionEnabled) return;
  if (ignoredTags.has(node.parentNode.tagName) || isEditable(node.parentNode)) return;

  let text = node.nodeValue;
  let changed = false;

  // This function decides what replacement text to use for a match.
  const replaceCallback = (match) => {
    // 1. Check exact match
    if (wordMapCache[match]) return wordMapCache[match].replacement;

    // 2. Check case-insensitive match
    const lowerMatch = match.toLowerCase();
    for (const key in wordMapCache) {
      if (key.toLowerCase() === lowerMatch) return wordMapCache[key].replacement;
    }

    // 3. Fallback (shouldn't happen if regex works)
    return match;
  };

  // Run Case-Sensitive replacements first
  if (sensitiveRegex) {
    const newText = text.replace(sensitiveRegex, replaceCallback);
    if (newText !== text) {
      text = newText;
      changed = true;
    }
  }

  // Run Case-Insensitive replacements second
  if (insensitiveRegex) {
    const newText = text.replace(insensitiveRegex, replaceCallback);
    if (newText !== text) {
      text = newText;
      changed = true;
    }
  }

  // Only update the DOM if we actually changed something.
  if (changed) {
    node.nodeValue = text;
  }
}

/**
 * Scans the entire document for text to replace.
 * Uses a "TreeWalker" which is the most efficient way to browse the DOM.
 */
function processDocument() {
  if (!extensionEnabled) return;
  if (!sensitiveRegex && !insensitiveRegex) return;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip ignored tags immediately for performance
        if (ignoredTags.has(node.parentNode.tagName) || isEditable(node.parentNode)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  while (walker.nextNode()) {
    processNode(walker.currentNode);
  }
}

// Utility to limit how often a function runs (Performance)
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// -----------------------------------------------------------------------------
// INITIALIZATION
// This runs when the page loads.
// -----------------------------------------------------------------------------
chrome.storage.sync.get(['wordMap', 'extensionEnabled'], (data) => {
  extensionEnabled = data.extensionEnabled !== false;

  // Build the rules and run the first pass
  if (data.wordMap && extensionEnabled) {
    updateRegexes(data.wordMap);
    processDocument();
  }

  // -----------------------------------------------------------------------------
  // DYNAMIC OBSERVER
  // This watches for new content (like "Load More" buttons or finding results).
  // -----------------------------------------------------------------------------

  // Create a debounced processor to avoid freezing the browser on rapid updates
  const debouncedProcess = debounce(() => {
    if (extensionEnabled) processDocument();
  }, 200); // 200ms delay

  const observer = new MutationObserver((mutations) => {
    if (!extensionEnabled) return;

    // Performance optimization: 
    // Only trigger if actual NODES were added (ignoring attribute changes)
    let relevantMutation = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        relevantMutation = true;
        break;
      }
    }

    if (relevantMutation) {
      debouncedProcess();
    }
  });

  // Start watching the body for changes
  observer.observe(document.body, { childList: true, subtree: true });
});

// -----------------------------------------------------------------------------
// SETTINGS LISTENER
// Updates live when you change settings in the menu.
// -----------------------------------------------------------------------------
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    // Correctly update Master Switch state
    if (changes.extensionEnabled) {
      extensionEnabled = changes.extensionEnabled.newValue;
    }

    // Correctly update Rules
    if (changes.wordMap) {
      updateRegexes(changes.wordMap.newValue || {});
    }

    // Apply immediate updates if enabled
    if (extensionEnabled) {
      processDocument();
    }
  }
});
