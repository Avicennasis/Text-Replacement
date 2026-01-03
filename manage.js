// manage.js
// -----------------------------------------------------------------------------
// This script handles the "Manage Replacements" page UI.
// It allows users to Add, Remove, and Modify replacement rules.
// All data is saved to 'chrome.storage.sync', which syncs across your 
// signed-in Chrome devices.
// -----------------------------------------------------------------------------

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
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
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
    chrome.storage.sync.get('wordMap', (data) => {
        const wordMap = data.wordMap || {};
        if (!wordMap[originalText]) return;

        const originalData = wordMap[originalText];

        // Special handling for renaming the key (Original Text)
        if (field === 'originalText') {
            // Prevent overwriting existing keys or creating invalid ones
            if (!newValue || (wordMap[newValue] && newValue !== originalText)) {
                loadWordMap(); // Reset UI to previous valid state
                showStatus('Invalid key or key already exists.', true);
                return;
            }
            // Delete old key, add new key
            delete wordMap[originalText];
            wordMap[newValue] = originalData;
        } else {
            // Normal update
            wordMap[originalText][field] = newValue;
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

    chrome.storage.sync.get('wordMap', (data) => {
        const wordMap = data.wordMap || {};

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
        const wordMap = data.wordMap || {};
        delete wordMap[originalText]; // Remove key

        chrome.storage.sync.set({ wordMap }, () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                showStatus('Error removing replacement.', true);
            } else {
                loadWordMap(); // Reload table to reflect removal
                showStatus('Replacement removed.');
            }
        });
    });
}

/**
 * Displays a temporary status message to the user.
 */
function showStatus(message, isError = false) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#ff1744' : '#00e676';

        // Clear message after 3 seconds
        setTimeout(() => {
            statusEl.textContent = '';
        }, 3000);
    }
}
