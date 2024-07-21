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
    originalTextInput.addEventListener('input', () => updateReplacement(originalText, 'originalText', originalTextInput.value));

    const replacementTextInput = document.createElement('input');
    replacementTextInput.type = 'text';
    replacementTextInput.value = replacement;
    replacementTextInput.addEventListener('input', () => updateReplacement(originalText, 'replacement', replacementTextInput.value));

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

        if (field === 'originalText') {
            wordMap[newValue] = wordMap[originalText];
            delete wordMap[originalText];
        } else {
            wordMap[originalText][field] = newValue;
        }

        chrome.storage.sync.set({ wordMap });
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
