// manage.js
// -----------------------------------------------------------------------------
// This script handles the "Manage Replacements" page UI.
// It allows users to Add, Remove, and Modify replacement rules.
// All data is saved to 'chrome.storage.sync', which syncs across your
// signed-in Chrome devices.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// CHROME STORAGE LIMITS
// These limits are enforced by Google Chrome, not by this extension.
// - SYNC_QUOTA_BYTES: Maximum total storage (100 KB for all your rules combined)
// - QUOTA_BYTES_PER_ITEM: Maximum size for a single storage item (8 KB)
// We check these limits before saving to give you helpful error messages.
// -----------------------------------------------------------------------------
const SYNC_QUOTA_BYTES = chrome.storage.sync.QUOTA_BYTES || 102400; // 100 KB
const QUOTA_BYTES_PER_ITEM = chrome.storage.sync.QUOTA_BYTES_PER_ITEM || 8192; // 8 KB

// -----------------------------------------------------------------------------
// SAFETY LIMITS
// These limits protect against performance issues and potential ReDoS attacks.
// - MAX_RULES: Prevents creating so many rules that the browser hangs
// - MAX_PATTERN_LENGTH: Prevents extremely long patterns that could cause regex issues
// These are reasonable limits that 99% of users will never hit.
// -----------------------------------------------------------------------------
const MAX_RULES = 255; // Maximum number of replacement rules allowed
const MAX_PATTERN_LENGTH = 255; // Maximum length for original text or replacement text

// -----------------------------------------------------------------------------
// UI CONSTANTS
// These control the behavior of user interface elements.
// -----------------------------------------------------------------------------
const STATUS_DISPLAY_DURATION_MS = 3000; // How long to show status messages (3 seconds)

/**
 * Estimates the storage size (in bytes) of the wordMap object.
 * Chrome storage counts JSON-serialized size, so we stringify to measure.
 *
 * @param {Object} wordMap - The replacement rules object
 * @returns {number} - Estimated size in bytes
 */
function estimateStorageSize(wordMap) {
    // Chrome stores data as JSON, so we need to measure the JSON string length.
    // Each character in a JS string is approximately 1 byte in UTF-8 for ASCII,
    // but can be up to 4 bytes for special characters. We use a conservative estimate.
    const jsonString = JSON.stringify({ wordMap });
    return new Blob([jsonString]).size; // Accurate byte size
}

/**
 * Checks if adding/updating a rule would exceed Chrome's storage limits.
 * Returns an error message if limits would be exceeded, or null if OK.
 *
 * @param {Object} wordMap - The proposed wordMap to save
 * @returns {string|null} - Error message or null if valid
 */
function validateStorageQuota(wordMap) {
    const estimatedSize = estimateStorageSize(wordMap);

    // Check total storage limit (Google Chrome's limit, not ours!)
    if (estimatedSize > SYNC_QUOTA_BYTES) {
        const usedKB = (estimatedSize / 1024).toFixed(1);
        const maxKB = (SYNC_QUOTA_BYTES / 1024).toFixed(0);
        return `Storage full! You're using ${usedKB} KB of Google Chrome's ${maxKB} KB limit. Please remove some rules to free up space.`;
    }

    // Check per-item limit (less common, but can happen with very long replacement texts)
    if (estimatedSize > QUOTA_BYTES_PER_ITEM) {
        return `This rule is too large. Google Chrome limits individual storage items to 8 KB.`;
    }

    return null; // All good!
}

document.addEventListener('DOMContentLoaded', () => {
    // Load saved settings when the page starts
    loadSettings();
    loadWordMap();

    // Listen for the "Add Rule" form submission
    document.getElementById('addReplacementForm').addEventListener('submit', (event) => {
        event.preventDefault(); // Stop the page from reloading
        addReplacement();
    });

    // Listen for the Master Switch toggle
    document.getElementById('masterSwitch').addEventListener('change', (e) => {
        updateMasterSwitch(e.target.checked);
    });
});

/**
 * Loads the Global On/Off state from storage.
 */
function loadSettings() {
    chrome.storage.sync.get('extensionEnabled', (data) => {
        // Error handling: Check if the Chrome API call failed
        if (chrome.runtime.lastError) {
            console.error('Failed to load settings:', chrome.runtime.lastError);
            showStatus('Error loading settings. Please refresh the page.', true);
            return;
        }

        // Default to TRUE if the setting doesn't exist yet
        const isEnabled = data.extensionEnabled !== false;
        document.getElementById('masterSwitch').checked = isEnabled;
    });
}

/**
 * Saves the Global On/Off state.
 */
function updateMasterSwitch(isEnabled) {
    chrome.storage.sync.set({ extensionEnabled: isEnabled }, () => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            showStatus('Error saving setting.', true);
        } else {
            showStatus(isEnabled ? 'Extension Enabled' : 'Extension Disabled');
        }
    });
}

/**
 * Loads all replacement rules from storage and builds the UI table.
 */
function loadWordMap() {
    chrome.storage.sync.get('wordMap', (data) => {
        // Error handling: Check if the Chrome API call failed
        if (chrome.runtime.lastError) {
            console.error('Failed to load word map:', chrome.runtime.lastError);
            showStatus('Error loading rules. Please refresh the page.', true);
            return;
        }

        const wordMap = data.wordMap || {};
        const replacementList = document.getElementById('replacementList');
        replacementList.innerHTML = ''; // Clear existing table

        // Sort and create a row for each rule
        Object.keys(wordMap).forEach(originalText => {
            const data = wordMap[originalText];
            // Handle cases where older versions might not have 'enabled' property
            const enabled = data.enabled !== false;
            addRowToTable(originalText, data.replacement, data.caseSensitive, enabled);
        });
    });
}

/**
 * Helper function to create a fancy Toggle Slider element.
 */
function createToggle(checked, changeCallback) {
    const label = document.createElement('label');
    label.className = 'toggle-switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    // When clicked, run the provided callback function
    input.addEventListener('change', (e) => changeCallback(e.target.checked));

    const slider = document.createElement('span');
    slider.className = 'slider';

    label.appendChild(input);
    label.appendChild(slider);
    return label;
}

/**
 * Creates a single table row (tr) for a replacement rule.
 */
function addRowToTable(originalText, replacement, caseSensitive, enabled) {
    const replacementList = document.getElementById('replacementList');
    const row = document.createElement('tr');

    // Create Cells
    const originalTextCell = document.createElement('td');
    const replacementTextCell = document.createElement('td');
    const caseSensitiveCell = document.createElement('td');
    const enabledCell = document.createElement('td');
    const removeCell = document.createElement('td');

    // 1. Original Text Input (Editable)
    const originalTextInput = document.createElement('input');
    originalTextInput.type = 'text';
    originalTextInput.value = originalText;
    // Update storage when text changes
    originalTextInput.addEventListener('change', () => updateReplacement(originalText, 'originalText', originalTextInput.value));

    // 2. Replacement Text Input (Editable)
    const replacementTextInput = document.createElement('input');
    replacementTextInput.type = 'text';
    replacementTextInput.value = replacement;
    // Update storage when text changes
    replacementTextInput.addEventListener('change', () => updateReplacement(originalText, 'replacement', replacementTextInput.value));

    // 3. Match Case Toggle
    const caseToggle = createToggle(caseSensitive, (checked) => {
        updateReplacement(originalText, 'caseSensitive', checked);
    });

    // 4. Enabled/Disabled Toggle
    const enabledToggle = createToggle(enabled, (checked) => {
        updateReplacement(originalText, 'enabled', checked);
        // Visual feedback: fade out disabled rows
        row.style.opacity = checked ? '1' : '0.5';
    });

    // Set initial visual state
    row.style.opacity = enabled ? '1' : '0.5';

    // 5. Remove Button
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.className = 'btn-remove';
    removeButton.addEventListener('click', () => removeReplacement(originalText));

    // Assemble the row structure
    // We use .appendChild to securely add elements to the DOM
    originalTextCell.appendChild(originalTextInput);
    replacementTextCell.appendChild(replacementTextInput);

    caseSensitiveCell.appendChild(caseToggle);
    caseSensitiveCell.style.textAlign = 'center';

    enabledCell.appendChild(enabledToggle);
    enabledCell.style.textAlign = 'center';

    removeCell.appendChild(removeButton);
    removeCell.style.textAlign = 'right';

    row.appendChild(originalTextCell);
    row.appendChild(replacementTextCell);
    row.appendChild(caseSensitiveCell);
    row.appendChild(enabledCell);
    row.appendChild(removeCell);

    // Add to table
    replacementList.appendChild(row);
}

/**
 * Updates a specific field of an existing rule in storage.
 */
function updateReplacement(originalText, field, newValue) {
    // VALIDATION: Prevent empty original text (would match nothing - user error)
    // Note: We allow empty replacement text (valid use case: delete the original)
    if (field === 'originalText' && typeof newValue === 'string') {
        if (!newValue || !newValue.trim()) {
            showStatus('Original text cannot be empty!', true);
            loadWordMap(); // Reset UI to previous valid state
            return;
        }
    }

    // SAFETY CHECK: Validate pattern length when editing text fields
    // This prevents users from accidentally creating overly long patterns
    if ((field === 'originalText' || field === 'replacement') && typeof newValue === 'string') {
        if (newValue.length > MAX_PATTERN_LENGTH) {
            showStatus(`Text too long! Maximum ${MAX_PATTERN_LENGTH} characters allowed.`, true);
            loadWordMap(); // Reset UI to previous valid state
            return;
        }
    }

    chrome.storage.sync.get('wordMap', (data) => {
        // Error handling: Check if the Chrome API call failed
        if (chrome.runtime.lastError) {
            console.error('Failed to get word map for update:', chrome.runtime.lastError);
            showStatus('Error loading data. Changes not saved.', true);
            loadWordMap(); // Revert UI to previous state
            return;
        }

        const wordMap = data.wordMap || {};
        if (!wordMap[originalText]) return;

        const originalData = wordMap[originalText];

        // Special handling for renaming the key (Original Text)
        if (field === 'originalText') {
            // Prevent overwriting existing keys or creating invalid ones
            if (!newValue) {
                loadWordMap(); // Reset UI to previous valid state
                showStatus('Original text cannot be empty.', true);
                return;
            }

            // Check if newValue already exists (and isn't just a case change of the same key)
            if (wordMap[newValue] && newValue !== originalText) {
                loadWordMap(); // Reset UI to previous valid state
                showStatus('A rule with this original text already exists.', true);
                return;
            }

            // EDGE CASE: Prevent renames that only differ in case (cat → CAT)
            // This can cause confusion with case-insensitive matching rules
            // For example, if you have "cat" (case-insensitive) and rename it to "Cat",
            // it would still match "CAT" or "cat", making the rename pointless
            if (newValue.toLowerCase() !== originalText.toLowerCase()) {
                // This is a real rename (not just case change), allow it
                delete wordMap[originalText];
                wordMap[newValue] = originalData;
            } else if (newValue === originalText) {
                // Exact same value, no change needed (user probably just re-focused the field)
                return;
            } else {
                // Case-only change detected (cat → Cat, cat → CAT, etc.)
                loadWordMap(); // Reset UI to previous valid state
                showStatus('Cannot rename to only differ in case (e.g., "cat" to "Cat"). Create a new rule instead.', true);
                return;
            }
        } else {
            // Normal update
            wordMap[originalText][field] = newValue;
        }

        // IMPORTANT: Validate storage quota BEFORE attempting to save.
        // This check protects against exceeding Chrome's limits when editing rules.
        const quotaError = validateStorageQuota(wordMap);
        if (quotaError) {
            showStatus(quotaError, true);
            loadWordMap(); // Revert UI to previous valid state
            return;
        }

        // Save back to storage
        chrome.storage.sync.set({ wordMap }, () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                showStatus('Error saving changes.', true);
                loadWordMap(); // Revert on failure
            } else {
                console.log('Word map updated');
                // Don't show "Saved" toast for every keystroke, mostly for buttons
                if (field !== 'originalText' && field !== 'replacement') {
                    // Logic for toggles
                } else {
                    showStatus('Saved.');
                }
            }
        });
    });
}

/**
 * Adds a brand new replacement rule.
 */
function addReplacement() {
    const newOriginal = document.getElementById('newOriginal').value;
    const newReplacement = document.getElementById('newReplacement').value;
    const newCaseSensitive = document.getElementById('newCaseSensitive').checked;

    // VALIDATION: Prevent empty strings
    // Empty original text would match nothing, and empty replacement would just delete text
    // Both are confusing and likely user errors, so we reject them
    if (!newOriginal || !newOriginal.trim()) {
        showStatus('Original text cannot be empty!', true);
        return;
    }

    if (!newReplacement && newReplacement !== '') {
        showStatus('Replacement text cannot be empty!', true);
        return;
    }

    // Note: We allow empty replacement string (newReplacement === '') because
    // that's a valid use case: user wants to delete/remove the original text entirely

    // SAFETY CHECK: Validate pattern length to prevent performance issues
    // Very long patterns can cause the browser to freeze when processing large pages
    if (newOriginal.length > MAX_PATTERN_LENGTH) {
        showStatus(`Original text too long! Maximum ${MAX_PATTERN_LENGTH} characters allowed.`, true);
        return;
    }

    if (newReplacement.length > MAX_PATTERN_LENGTH) {
        showStatus(`Replacement text too long! Maximum ${MAX_PATTERN_LENGTH} characters allowed.`, true);
        return;
    }

    chrome.storage.sync.get('wordMap', (data) => {
        // Error handling: Check if the Chrome API call failed
        if (chrome.runtime.lastError) {
            console.error('Failed to get word map for adding rule:', chrome.runtime.lastError);
            showStatus('Error loading data. Rule not added.', true);
            return;
        }

        const wordMap = data.wordMap || {};

        // SAFETY CHECK: Limit total number of rules to prevent browser slowdown
        // Having hundreds of rules can make regex compilation and page processing very slow
        if (Object.keys(wordMap).length >= MAX_RULES) {
            showStatus(`Maximum ${MAX_RULES} rules allowed. Please remove some rules before adding more.`, true);
            return;
        }

        // Prevent duplicates
        if (wordMap[newOriginal]) {
            showStatus('Rule already exists for this word.', true);
            return;
        }

        // Add new rule object
        wordMap[newOriginal] = {
            replacement: newReplacement,
            caseSensitive: newCaseSensitive,
            enabled: true
        };

        // IMPORTANT: Validate storage quota BEFORE attempting to save.
        // This prevents cryptic errors and gives users clear feedback.
        const quotaError = validateStorageQuota(wordMap);
        if (quotaError) {
            showStatus(quotaError, true);
            return;
        }

        // Save
        chrome.storage.sync.set({ wordMap }, () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                showStatus('Error adding replacement. Storage full?', true);
            } else {
                // On success, update UI instantly without full reload
                addRowToTable(newOriginal, newReplacement, newCaseSensitive, true);

                // Clear input fields for next entry
                document.getElementById('newOriginal').value = '';
                document.getElementById('newReplacement').value = '';
                document.getElementById('newCaseSensitive').checked = false;

                showStatus('Replacement added.');
            }
        });
    });
}

/**
 * Removes a rule permanently.
 */
function removeReplacement(originalText) {
    chrome.storage.sync.get('wordMap', (data) => {
        // Error handling: Check if the Chrome API call failed
        if (chrome.runtime.lastError) {
            console.error('Failed to get word map for removal:', chrome.runtime.lastError);
            showStatus('Error loading data. Rule not removed.', true);
            return;
        }

        const wordMap = data.wordMap || {};
        delete wordMap[originalText]; // Remove key

        chrome.storage.sync.set({ wordMap }, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to save after removal:', chrome.runtime.lastError);
                showStatus('Error removing replacement.', true);
                loadWordMap(); // Reload to revert to previous state
            } else {
                loadWordMap(); // Reload table to reflect removal
                showStatus('Replacement removed.');
            }
        });
    });
}

/**
 * Displays a temporary status message to the user.
 * The message automatically disappears after STATUS_DISPLAY_DURATION_MS.
 *
 * @param {string} message - The message to display
 * @param {boolean} isError - Whether this is an error (red) or success (green) message
 */
function showStatus(message, isError = false) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#ff1744' : '#00e676';

        // Clear message after configured duration
        setTimeout(() => {
            statusEl.textContent = '';
        }, STATUS_DISPLAY_DURATION_MS);
    }
}
