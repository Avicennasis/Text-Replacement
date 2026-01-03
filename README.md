# Avic's Text Replacement Extension

A powerful, secure, and modern Google Chrome extension that automatically replaces text on websites you visit. Customize your web experience by swapping words, phrases, or names with your own preferred alternatives.

## Features

*   **Real-time Replacement**: Text is replaced instantly as you browse.
*   **Modern UI**: Features a sleek, dark-mode "Glassmorphism" interface.
*   **Toggle Controls**
    *   **Master Switch**: Instantly enable or disable the entire extension.
    *   **Individual Rules**: Toggle specific text replacements on or off without deleting them.
*   **Case Sensitivity**: Choose whether to match exact capitalization or ignore case (`Cat` vs `cat`).
*   **Smart & Safe**:
    *   **Privacy First**: All data is stored locally in your browser. Nothing is sent to any server.
    *   **Performance**: Uses advanced "Debouncing" and efficient DOM traversal to ensure it doesn't slow down your browsing.
    *   **Safety**: Intelligently skips inputs, text areas, and code blocks so it doesn't break forms or websites.

## Transparency & Safety

Because this extension needs permission to "read and modify data on all websites" to function, we believe you have a right to know exactly what is happening under the hood.

This project is built on a commitment to **absolute transparency**:

*   **Extensive In-Code Documentation**: Every script in this codebase (`content.js`, `manage.js`, `background.js`) is heavily commented. We have intentionally written these comments to be understood by non-developers, so you can verify for yourself that the code is safe and does nothing "sketchy."
*   **Zero Data Collection**: This extension does not track you, does not use analytics, and never talks to an external server. Your data stays 100% local.
*   **Open Source Commitment**: We provide this code fully open-source so you don't have to trust a "black box" with your browsing history. The idea is simple: a useful tool that respects your privacy.

## Installation

Since this is a custom developer extension, you install it via "Developer Mode" in Chrome:

1.  Download or Clone this repository to your computer.
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Toggle **Developer mode** in the top-right corner.
4.  Click the **Load unpacked** button in the top-left.
5.  Select the folder containing this project's files.

## Usage

1.  **Open Settings**: Click the extension icon in your toolbar to open the **Text Replacements** dashboard.
2.  **Add a Rule**
    *   **Original String**: The text you want to find (e.g., "dog").
    *   **Replacement String**: The text you want to see instead (e.g., "cat").
    *   **Match Case**: Toggle this if strictly "Dog" should be replaced but "dog" should not.
    *   Click **Add Rule**.
3.  **Manage Rules**: Use the table to see all your active replacements. You can toggle them on/off or remove them entirely.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

**Author:** Léon "Avic" Simmons ([@Avicennasis](https://github.com/Avicennasis))
