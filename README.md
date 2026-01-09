# Avic's Text Replacement Extension for Chrome

A powerful, secure, and modern Google Chrome extension that automatically replaces text on websites you visit. Customize your web experience by swapping words, phrases, or names with your own preferred alternatives.

> **Note:** There is a [Firefox port of this Text Replacement extension](https://github.com/Avicennasis/Firefox-Text-Replacement). That codebase has been adapted to work with Firefox's extension APIs and manifest format.

## Features

### Core Functionality
*   **Real-time Replacement**: Text is replaced instantly as you browse, including dynamically loaded content.
*   **Modern UI**: Features a sleek, dark-mode "Glassmorphism" interface with system fonts for better performance.
*   **Toggle Controls**
    *   **Master Switch**: Instantly enable or disable the entire extension.
    *   **Individual Rules**: Toggle specific text replacements on or off without deleting them.
*   **Case Sensitivity**: Choose whether to match exact capitalization or ignore case (`Cat` vs `cat`).

### Performance & Safety
*   **Smart Performance**:
    *   Processes only newly-added content (10-100x faster on dynamic sites like Twitter/Reddit)
    *   Supports up to 255 rules with instant O(1) lookup performance
    *   100ms timeout protection prevents browser hangs on complex patterns
    *   Optimized regex compilation with longest-match-first sorting
*   **Safety Features**:
    *   Maximum rule limits (255 rules, 255 chars per pattern) prevent performance issues
    *   Intelligently skips inputs, text areas, and code blocks to avoid breaking websites
    *   Chrome storage quota validation with clear error messages
    *   Content Security Policy (CSP) prevents XSS attacks
    *   Comprehensive error handling with user-friendly messages

### Advanced Features
*   **Export/Import**: Backup your rules or share them between devices with JSON export/import
*   **Search & Filter**: Quickly find specific rules with real-time search (searches both original and replacement text)
*   **Accessibility**: Full WCAG 2.1 compliance with ARIA labels for screen reader users
*   **Privacy First**: No external dependencies, all data stored locally, zero tracking or analytics
*   **Debug Logging**: Optional debug mode for troubleshooting (toggle `ENABLE_DEBUG_LOGGING`)

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

### Basic Usage
1.  **Open Settings**: Click the extension icon in your toolbar to open the **Text Replacements** dashboard.
2.  **Add a Rule**
    *   **Original String**: The text you want to find (e.g., "dog").
    *   **Replacement String**: The text you want to see instead (e.g., "cat").
    *   **Match Case**: Toggle this if strictly "Dog" should be replaced but "dog" should not.
    *   Click **Add Rule**.
3.  **Manage Rules**:
    *   Edit rules directly in the table (changes save automatically)
    *   Toggle individual rules on/off without deleting them
    *   Use the search box to quickly find specific rules
    *   Remove rules with the Remove button

### Advanced Features
*   **Export Rules**: Click "Export Rules" to download all your rules as a JSON file (great for backups!)
*   **Import Rules**: Click "Import Rules" to load rules from a JSON file
    *   Choose "OK" to **replace** all existing rules
    *   Choose "Cancel" to **merge** with existing rules
*   **Search Rules**: Use the search box above the table to filter rules in real-time
*   **Debug Mode**: Set `ENABLE_DEBUG_LOGGING = true` in any JavaScript file to see detailed console logs

## Technical Details

### Architecture
*   **Manifest V3**: Uses modern Chrome extension architecture with service workers
*   **Content Scripts**: Runs on all pages to perform text replacement
*   **Storage**: Uses `chrome.storage.sync` for cross-device synchronization
*   **Observer Pattern**: MutationObserver watches for dynamic content changes

### Performance Optimizations
*   **Incremental Processing**: Only scans newly-added DOM nodes (not the entire page)
*   **O(1) Lookup**: Hash map-based replacement lookup for instant performance
*   **Regex Optimization**: Compiles all patterns into two optimized regexes (case-sensitive/insensitive)
*   **Timeout Protection**: 100ms timeout prevents regex catastrophic backtracking
*   **Granular Updates**: Only rebuilds/rescans when necessary (not on every settings change)

### Security Features
*   **Content Security Policy**: Prevents inline script execution
*   **No External Resources**: All fonts and scripts bundled locally
*   **Input Validation**: Prevents empty strings, validates pattern lengths, checks storage quotas
*   **Error Handling**: Comprehensive try-catch blocks with user-friendly error messages
*   **Safe DOM Manipulation**: Uses TreeWalker API and avoids innerHTML

### Code Quality
*   **Extensive Comments**: Every function documented for non-technical readers
*   **Logging System**: Consistent, prefix logging with debug mode toggle
*   **Constants**: Magic numbers extracted to named constants
*   **Error Recovery**: UI reverts to previous state on storage failures
*   **Type Safety**: JSDoc annotations for better IDE support

## What's New in v2.0

This version includes 20+ major improvements focusing on security, performance, and usability:

**Security & Reliability**
- ✅ Content Security Policy (CSP) prevents XSS attacks
- ✅ Removed external Google Fonts dependency (privacy + offline support)
- ✅ Chrome storage quota validation with clear error messages
- ✅ Pattern length limits (255 chars) prevent performance issues
- ✅ Rule count limit (255 rules) prevents browser slowdown
- ✅ 100ms regex timeout prevents catastrophic backtracking
- ✅ Comprehensive error handling across all storage operations

**Performance**
- ✅ 10-100x faster on dynamic sites (Twitter, Reddit, etc.)
- ✅ Process only mutated nodes instead of entire document
- ✅ O(1) replacement lookup with pre-built hash maps
- ✅ Granular change detection avoids unnecessary rescans
- ✅ Fixed race condition on initial page load

**Features**
- ✅ Export/import rules as JSON (backup & sharing)
- ✅ Real-time search/filter for rules table
- ✅ Full accessibility (WCAG 2.1) with ARIA labels
- ✅ Debug logging system with toggle
- ✅ Empty string validation
- ✅ Case-only rename prevention

**Code Quality**
- ✅ Magic numbers extracted to named constants
- ✅ Consistent error handling everywhere
- ✅ Improved inline documentation
- ✅ Professional logging utility

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

**Author:** Léon "Avic" Simmons ([@Avicennasis](https://github.com/Avicennasis))

**Version:** 2.0 (Major Overhaul & Audit)
