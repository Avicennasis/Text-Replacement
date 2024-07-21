document.getElementById('manageButton').addEventListener('click', () => {
    chrome.tabs.create({ url: 'manage.html' });
});
