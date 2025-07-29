document.addEventListener('DOMContentLoaded', () => {
    loadWordMap();

    document.getElementById('addReplacementForm').addEventListener('submit', (event) => {
        event.preventDefault();
        addReplacement();
    });
});

function loadWordMap() {
    chrome.storage.sync.get('wordMap', (data) => {
        const wordMap = data.wordMap || {};
        const replacementList = document.getElementById('replacementList');
        replacementList.innerHTML = '';

        Object.keys(wordMap).forEach(originalText => {
            const replacement = wordMap[originalText].replacement;
            const caseSensitive = wordMap[originalText].caseSensitive;
            addRowToTable(originalText, replacement, caseSensitive);
        });
    });
}

function addRowToTable(originalText, replacement, caseSensitive) {
    const replacementList = document.getElementById('replacementList');
    const row = document.createElement('tr');

    const originalTextCell = document.createElement('td');
    const replacementTextCell = document.createElement('td');
    const caseSensitiveCell = document.createElement('td');
    const removeCell = document.createElement('td');

    const originalTextInput = document.createElement('input');
    originalTextInput.type = 'text';
    originalTextInput.value = originalText;
    originalTextInput.addEventListener('change', () => updateReplacement(originalText, 'originalText', originalTextInput.value));

    const replacementTextInput = document.createElement('input');
    replacementTextInput.type = 'text';
    replacementTextInput.value = replacement;
    replacementTextInput.addEventListener('change', () => updateReplacement(originalText, 'replacement', replacementTextInput.value));

    const caseSensitiveCheckbox = document.createElement('input');
    caseSensitiveCheckbox.type = 'checkbox';
    caseSensitiveCheckbox.checked = caseSensitive;
    caseSensitiveCheckbox.addEventListener('change', () => updateReplacement(originalText, 'caseSensitive', caseSensitiveCheckbox.checked));

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.className = 'button';
    removeButton.addEventListener('click', () => removeReplacement(originalText));

    originalTextCell.appendChild(originalTextInput);
    replacementTextCell.appendChild(replacementTextInput);
    caseSensitiveCell.appendChild(caseSensitiveCheckbox);
    removeCell.appendChild(removeButton);

    row.appendChild(originalTextCell);
    row.appendChild(replacementTextCell);
    row.appendChild(caseSensitiveCell);
    row.appendChild(removeCell);

    replacementList.appendChild(row);
}

function updateReplacement(originalText, field, newValue) {
    chrome.storage.sync.get('wordMap', (data) => {
        const wordMap = data.wordMap || {};
        if (!wordMap[originalText]) return;

        const originalData = wordMap[originalText]; // Keep a copy

        // If the original text key is being changed
        if (field === 'originalText') {
            // Do nothing if the new key is empty or already exists
            if (!newValue || wordMap[newValue]) {
                // Optional: provide user feedback here
                loadWordMap(); // a reload resets the input to its original value
                return;
            }
            delete wordMap[originalText];
            wordMap[newValue] = originalData;
        } else {
            wordMap[originalText][field] = newValue;
        }

        // Save the updated map and reload the whole table to re-bind events
        chrome.storage.sync.set({ wordMap }, () => {
            loadWordMap();
        });
    });
}

function addReplacement() {
    const newOriginal = document.getElementById('newOriginal').value;
    const newReplacement = document.getElementById('newReplacement').value;
    const newCaseSensitive = document.getElementById('newCaseSensitive').checked;

    chrome.storage.sync.get('wordMap', (data) => {
        const wordMap = data.wordMap || {};
        wordMap[newOriginal] = {
            replacement: newReplacement,
            caseSensitive: newCaseSensitive
        };
        chrome.storage.sync.set({ wordMap }, () => {
            addRowToTable(newOriginal, newReplacement, newCaseSensitive);
            document.getElementById('addReplacementForm').reset();
        });
    });
}

function removeReplacement(originalText) {
    chrome.storage.sync.get('wordMap', (data) => {
        const wordMap = data.wordMap || {};
        delete wordMap[originalText];
        chrome.storage.sync.set({ wordMap }, () => {
            loadWordMap();
        });
    });
}
