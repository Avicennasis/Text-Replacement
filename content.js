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

// -----------------------------------------------------------------------------
// SAFETY CONFIGURATION
// This timeout prevents the extension from hanging if regex operations take too long.
// If processing a single text node takes more than this limit, we skip it safely.
// This protects against complex patterns on very large text blocks.
// -----------------------------------------------------------------------------
const REGEX_TIMEOUT_MS = 100; // Maximum time (in milliseconds) to process a single text node

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
let wordMapCache = {};       // Quick lookup for replacements (exact match)
let wordMapCacheLower = {};  // Quick lookup for case-insensitive matches (lowercase keys)
let extensionEnabled = true; // Master switch state

/**
 * Updates the internal rules based on settings loaded from storage.
 * This is called whenever you change settings in the Manage page.
 *
 * PERFORMANCE: Builds optimized lookup maps to avoid slow linear searches during replacement.
 */
function updateRegexes(wordMap) {
  const sensitiveWords = [];
  const insensitiveWords = [];
  const activeMap = {};
  const activeLowerMap = {}; // Lowercase version for fast case-insensitive lookups

  for (const [word, data] of Object.entries(wordMap)) {
    // Only include rules that are explicitly enabled
    if (data.enabled !== false) {
      activeMap[word] = data;

      // Build lowercase lookup map for case-insensitive rules
      // This allows O(1) lookup instead of O(n) iteration during replacement
      if (!data.caseSensitive) {
        activeLowerMap[word.toLowerCase()] = data;
      }

      if (data.caseSensitive) {
        sensitiveWords.push(word);
      } else {
        insensitiveWords.push(word);
      }
    }
  }

  wordMapCache = activeMap;
  wordMapCacheLower = activeLowerMap;
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
 *
 * SAFETY: Includes timeout protection to prevent browser hangs on complex patterns.
 */
function processNode(node) {
  // Safety checks: stop if disabled, or if it's a dangerous tag/editable area.
  if (!extensionEnabled) return;
  if (ignoredTags.has(node.parentNode.tagName) || isEditable(node.parentNode)) return;

  let text = node.nodeValue;
  let changed = false;

  // Start timer to enforce timeout limit and prevent browser freezing
  const startTime = performance.now();

  // This function decides what replacement text to use for a match.
  // PERFORMANCE: Uses O(1) hash map lookups instead of O(n) iteration!
  const replaceCallback = (match) => {
    // Timeout safety check: if we've been processing too long, abort!
    // This prevents the extension from hanging the browser on pathological patterns.
    if (performance.now() - startTime > REGEX_TIMEOUT_MS) {
      throw new Error('Regex timeout'); // Will be caught below
    }

    // 1. Check exact match (for case-sensitive rules)
    if (wordMapCache[match]) return wordMapCache[match].replacement;

    // 2. Check case-insensitive match using our pre-built lowercase map
    // OLD CODE: Looped through ALL keys - O(n) complexity! Slow with many rules.
    // NEW CODE: Direct hash lookup - O(1) complexity! Instant even with 255 rules.
    const lowerMatch = match.toLowerCase();
    if (wordMapCacheLower[lowerMatch]) {
      return wordMapCacheLower[lowerMatch].replacement;
    }

    // 3. Fallback (shouldn't happen if regex works correctly)
    return match;
  };

  try {
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
  } catch (error) {
    // If timeout occurs, silently skip this node and continue.
    // This is better than hanging the entire browser!
    // The user won't notice - only this one text block is skipped.
    if (error.message === 'Regex timeout') {
      console.warn('Text replacement timeout on node (skipping):', node.nodeValue?.substring(0, 50));
      return;
    }
    // Re-throw unexpected errors for debugging
    throw error;
  }
}

/**
 * Scans the entire document for text to replace.
 * Uses a "TreeWalker" which is the most efficient way to browse the DOM.
 *
 * NOTE: This function is only used for the initial page load.
 * For dynamic content, we use processElement() to only scan new nodes (much faster!).
 */
function processDocument() {
  if (!extensionEnabled) return;
  if (!sensitiveRegex && !insensitiveRegex) return;
  if (!document.body) return; // Safety check: don't run if body doesn't exist yet

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

/**
 * Processes a single element and all its text nodes.
 * This is MUCH faster than scanning the entire document!
 *
 * Used by the MutationObserver to only process newly-added content.
 * For example, when Twitter loads new tweets, we only scan those tweets, not the whole page.
 *
 * @param {Element} element - The DOM element to process
 */
function processElement(element) {
  if (!extensionEnabled) return;
  if (!sensitiveRegex && !insensitiveRegex) return;

  // If it's a text node, process it directly
  if (element.nodeType === Node.TEXT_NODE) {
    processNode(element);
    return;
  }

  // If it's an element node, walk through its text nodes
  if (element.nodeType === Node.ELEMENT_NODE) {
    const walker = document.createTreeWalker(
      element,
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
  // This watches for new content (like "Load More" buttons or infinite scroll).
  // -----------------------------------------------------------------------------

  const observer = new MutationObserver((mutations) => {
    if (!extensionEnabled) return;

    // PERFORMANCE OPTIMIZATION:
    // Instead of re-scanning the ENTIRE page on every change, we only process
    // the specific nodes that were just added. This is WAY faster!
    //
    // Example: When Twitter adds 10 new tweets, we only scan those 10 tweets,
    // not the entire page with thousands of existing tweets.
    for (const mutation of mutations) {
      // Only care about added nodes (ignore attribute/text changes to existing nodes)
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          // Process the newly-added node (and its children if it's an element)
          processElement(node);
        }
      }
    }
  });

  // Start watching the body for changes
  // childList: watch for nodes being added/removed
  // subtree: watch the entire tree, not just direct children
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
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
