# Workflow AI Chrome Extension

A Chrome extension that helps you generate and manage workflows using AI, with integration to n8n for automation.

## Features

- Generate workflows using natural language prompts
- Test connections to Gemini API and n8n
- Save and manage workflow templates
- History of generated workflows
- Dark/light theme support
- Data import/export functionality

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `dist-extension` directory

## Configuration

1. Click on the extension icon in your Chrome toolbar
2. Go to the "Settings" tab
3. Enter your Gemini API key
4. (Optional) Configure n8n URL and API key if you want to test n8n connections

## Usage

### Generate a Workflow

1. Click on the extension icon
2. Go to the "Generate" tab
3. Enter a description of the workflow you want to create
4. Select the complexity level and model
5. Click "Generate Workflow"

### Save a Template

1. After generating a workflow, you can save it as a template
2. Go to the "Templates" tab to view and manage your saved templates

### Test Connections

1. Go to the "Settings" tab
2. Enter your API keys
3. Click the "Test Connection" buttons to verify the connections

## Development

### Project Structure

- `popup.html` - Main extension popup UI
- `assets/popup.js` - Popup JavaScript logic
- `assets/background.js` - Background script for extension
- `assets/popup.css` - Styles for the popup
- `assets/content.css` - Styles for content scripts
- `manifest.json` - Extension manifest file

### Building

1. Make your changes to the source files
2. The extension will automatically reload when you save changes in development mode

## License

MIT
