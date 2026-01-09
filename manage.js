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

// -----------------------------------------------------------------------------
// LOGGING UTILITY
// Simple logging system for consistent error reporting and debugging.
// -----------------------------------------------------------------------------
const ENABLE_DEBUG_LOGGING = false; // Toggle for debug logs

const Logger = {
  info: (message, ...args) => console.log(`[Text Replacement] ${message}`, ...args),
  debug: (message, ...args) => ENABLE_DEBUG_LOGGING && console.log(`[Text Replacement DEBUG] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[Text Replacement WARNING] ${message}`, ...args),
  error: (message, ...args) => console.error(`[Text Replacement ERROR] ${message}`, ...args)
};

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

    // Listen for Export button click
    document.getElementById('exportBtn').addEventListener('click', () => {
        exportRules();
    });

    // Listen for Import button click (triggers hidden file input)
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    // Listen for file selection
    document.getElementById('importFile').addEventListener('change', (e) => {
        importRules(e.target.files[0]);
    });

    // Listen for search box input (with debouncing for better performance)
    let searchTimeout;
    document.getElementById('searchBox').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterRules(e.target.value);
        }, 150); // 150ms debounce to avoid filtering on every keystroke
    });
});

/**
 * Loads the Global On/Off state from storage.
 */
function loadSettings() {
    chrome.storage.sync.get('extensionEnabled', (data) => {
        // Error handling: Check if the Chrome API call failed
        if (chrome.runtime.lastError) {
            Logger.error('Failed to load settings:', chrome.runtime.lastError);
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
            Logger.error('Failed to save master switch setting:', chrome.runtime.lastError);
            showStatus('Error saving setting.', true);
        } else {
            showStatus(isEnabled ? 'Extension Enabled' : 'Extension Disabled');
            Logger.debug('Master switch updated:', isEnabled);
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
            Logger.error('Failed to load word map:', chrome.runtime.lastError);
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
            Logger.error('Failed to get word map for update:', chrome.runtime.lastError);
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
                Logger.error('Failed to save replacement update:', chrome.runtime.lastError);
                showStatus('Error saving changes.', true);
                loadWordMap(); // Revert on failure
            } else {
                Logger.debug('Word map updated successfully');
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
            Logger.error('Failed to get word map for adding rule:', chrome.runtime.lastError);
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
                Logger.error('Failed to add new replacement:', chrome.runtime.lastError);
                showStatus('Error adding replacement. Storage full?', true);
            } else {
                Logger.debug('New replacement added:', newOriginal, '→', newReplacement);
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
            Logger.error('Failed to get word map for removal:', chrome.runtime.lastError);
            showStatus('Error loading data. Rule not removed.', true);
            return;
        }

        const wordMap = data.wordMap || {};
        delete wordMap[originalText]; // Remove key

        chrome.storage.sync.set({ wordMap }, () => {
            if (chrome.runtime.lastError) {
                Logger.error('Failed to save after removal:', chrome.runtime.lastError);
                showStatus('Error removing replacement.', true);
                loadWordMap(); // Reload to revert to previous state
            } else {
                Logger.debug('Replacement removed:', originalText);
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

// -----------------------------------------------------------------------------
// EXPORT/IMPORT FUNCTIONALITY
// Allows users to backup their rules and share them between devices.
// -----------------------------------------------------------------------------

/**
 * Exports all replacement rules to a JSON file.
 * This creates a downloadable backup that users can save and import later.
 */
function exportRules() {
    chrome.storage.sync.get('wordMap', (data) => {
        // Error handling: Check if the Chrome API call failed
        if (chrome.runtime.lastError) {
            Logger.error('Failed to get word map for export:', chrome.runtime.lastError);
            showStatus('Error loading rules for export.', true);
            return;
        }

        const wordMap = data.wordMap || {};

        // Check if there are any rules to export
        if (Object.keys(wordMap).length === 0) {
            showStatus('No rules to export!', true);
            return;
        }

        // Create a JSON export object with metadata
        // This helps with version compatibility in the future
        const exportData = {
            version: '2.0', // Extension version
            exportedAt: new Date().toISOString(), // Timestamp for user reference
            rulesCount: Object.keys(wordMap).length,
            rules: wordMap
        };

        // Convert to pretty-printed JSON (easier to read if user opens the file)
        const jsonString = JSON.stringify(exportData, null, 2);

        // Create a Blob (binary large object) from the JSON string
        // This is required to create a downloadable file in the browser
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Create a temporary download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Generate filename with current date for easy organization
        // Example: "text-replacement-rules-2025-01-09.json"
        const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        a.download = `text-replacement-rules-${dateStr}.json`;

        // Trigger the download by programmatically clicking the link
        document.body.appendChild(a);
        a.click();

        // Clean up: remove the temporary link and revoke the blob URL
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Logger.debug('Rules exported successfully:', Object.keys(wordMap).length, 'rules');
        showStatus(`Exported ${Object.keys(wordMap).length} rules successfully!`);
    });
}

/**
 * Imports replacement rules from a JSON file.
 * Users can choose to merge with existing rules or replace them entirely.
 *
 * @param {File} file - The JSON file selected by the user
 */
function importRules(file) {
    // Validation: Ensure a file was actually selected
    if (!file) {
        Logger.warn('Import attempted with no file selected');
        return;
    }

    // Validation: Check file type (basic security check)
    if (!file.name.endsWith('.json')) {
        showStatus('Please select a valid JSON file!', true);
        return;
    }

    // FileReader API allows us to read the contents of the file
    const reader = new FileReader();

    // This function runs after the file is successfully read
    reader.onload = (e) => {
        try {
            // Parse the JSON file contents
            const importData = JSON.parse(e.target.result);

            // Validation: Check if this is a valid export file
            if (!importData.rules || typeof importData.rules !== 'object') {
                showStatus('Invalid file format! Please select a valid export file.', true);
                Logger.error('Invalid import file structure:', importData);
                return;
            }

            const importedRules = importData.rules;
            const importCount = Object.keys(importedRules).length;

            // Validation: Check if the file has any rules
            if (importCount === 0) {
                showStatus('The import file contains no rules!', true);
                return;
            }

            // Ask user how they want to import (merge or replace)
            // Using confirm() for simplicity - could be upgraded to a custom modal later
            const shouldReplace = confirm(
                `Found ${importCount} rules in the file.\n\n` +
                `Click OK to REPLACE all existing rules.\n` +
                `Click Cancel to MERGE with existing rules.`
            );

            // Get current rules from storage
            chrome.storage.sync.get('wordMap', (data) => {
                if (chrome.runtime.lastError) {
                    Logger.error('Failed to get word map for import:', chrome.runtime.lastError);
                    showStatus('Error loading current rules.', true);
                    return;
                }

                let finalRules;

                if (shouldReplace) {
                    // REPLACE mode: Use only the imported rules
                    finalRules = importedRules;
                    Logger.debug('Import mode: REPLACE');
                } else {
                    // MERGE mode: Combine existing and imported rules
                    // Imported rules overwrite existing ones if there's a conflict
                    finalRules = { ...data.wordMap, ...importedRules };
                    Logger.debug('Import mode: MERGE');
                }

                // Validation: Check if result would exceed rule limit
                const finalCount = Object.keys(finalRules).length;
                if (finalCount > MAX_RULES) {
                    showStatus(`Import would exceed maximum of ${MAX_RULES} rules! (Would have ${finalCount})`, true);
                    return;
                }

                // Validation: Check storage quota
                const quotaError = validateStorageQuota(finalRules);
                if (quotaError) {
                    showStatus(quotaError, true);
                    return;
                }

                // Save the imported rules
                chrome.storage.sync.set({ wordMap: finalRules }, () => {
                    if (chrome.runtime.lastError) {
                        Logger.error('Failed to save imported rules:', chrome.runtime.lastError);
                        showStatus('Error saving imported rules.', true);
                    } else {
                        Logger.debug('Import successful:', finalCount, 'total rules');
                        loadWordMap(); // Reload the UI to show new rules
                        showStatus(`Successfully imported ${importCount} rules! Total: ${finalCount}`);
                    }
                });
            });

        } catch (error) {
            // Handle JSON parsing errors or other exceptions
            Logger.error('Failed to parse import file:', error);
            showStatus('Invalid JSON file! Please check the file format.', true);
        }
    };

    // This function runs if file reading fails
    reader.onerror = () => {
        Logger.error('Failed to read import file:', reader.error);
        showStatus('Error reading file. Please try again.', true);
    };

    // Start reading the file as text
    // This is asynchronous - the onload function above will be called when done
    reader.readAsText(file);

    // Reset the file input so the same file can be selected again if needed
    document.getElementById('importFile').value = '';
}

// -----------------------------------------------------------------------------
// SEARCH/FILTER FUNCTIONALITY
// Helps users quickly find specific rules when they have many.
// -----------------------------------------------------------------------------

/**
 * Filters the rules table based on search query.
 * Searches in both original text and replacement text columns.
 * Case-insensitive search for better user experience.
 *
 * @param {string} query - The search term entered by the user
 */
function filterRules(query) {
    const searchQuery = query.toLowerCase().trim();
    const rows = document.querySelectorAll('#replacementList tr');
    let visibleCount = 0;
    let totalCount = rows.length;

    // If search is empty, show all rows
    if (!searchQuery) {
        rows.forEach(row => {
            row.style.display = '';
        });
        document.getElementById('searchResults').textContent = '';
        return;
    }

    // Filter rows based on search query
    rows.forEach(row => {
        // Get the text inputs from the row (original and replacement text)
        const inputs = row.querySelectorAll('input[type="text"]');
        if (inputs.length < 2) return; // Safety check

        const originalText = inputs[0].value.toLowerCase();
        const replacementText = inputs[1].value.toLowerCase();

        // Check if either column contains the search query
        const matches = originalText.includes(searchQuery) || replacementText.includes(searchQuery);

        // Show or hide the row based on match
        if (matches) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    // Update the search results counter
    const resultsEl = document.getElementById('searchResults');
    if (visibleCount === 0) {
        resultsEl.textContent = 'No matches found';
        resultsEl.style.color = '#ff1744'; // Red for no results
    } else if (visibleCount === totalCount) {
        resultsEl.textContent = `Showing all ${totalCount} rules`;
        resultsEl.style.color = 'var(--text-muted)';
    } else {
        resultsEl.textContent = `Showing ${visibleCount} of ${totalCount} rules`;
        resultsEl.style.color = 'var(--primary)'; // Highlight when filtering
    }

    Logger.debug('Search query:', searchQuery, '| Visible:', visibleCount, '/', totalCount);
}
