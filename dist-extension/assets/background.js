// Background script for Workflow AI Chrome Extension

// Set up context menu
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'generateWorkflow',
      title: 'Generate Workflow with Selection',
      contexts: ['selection']
    });
  });
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.local.set({
      apiKey: '',
      n8nUrl: 'http://localhost:5678',
      n8nApiKey: '',
      model: 'gemini-1.5-flash',
      theme: 'system',
      templates: [],
      history: [],
      firstRun: true
    }, () => {
      // Set up context menu
      setupContextMenu();
      // Open options page after install
      chrome.tabs.create({
        url: chrome.runtime.getURL('popup.html#settings')
      });
    });
  } else if (details.reason === 'update') {
    // Update context menu on extension update
    setupContextMenu();
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'generateWorkflow' && info.selectionText) {
    // Open the popup with the selected text as prompt
    chrome.storage.local.get(['apiKey', 'model'], (data) => {
      if (data.apiKey) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'openPopupWithText',
          text: info.selectionText
        });
      } else {
        // If no API key is set, open the settings page
        chrome.tabs.create({
          url: chrome.runtime.getURL('popup.html#settings')
        });
      }
    });
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle different message types
  switch (request.action) {
    case 'testConnection':
      // Handle test connection request
      testConnection(request.apiKey)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Required for async response
      
    case 'testN8nConnection':
      // Handle n8n connection test
      testN8nConnection(request.url, request.apiKey)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'generateWorkflow':
      // Handle workflow generation
      generateWorkflow(request.prompt, request.options)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    default:
      console.warn('Unknown action:', request.action);
  }
});

// Test Gemini API connection
async function testConnection(apiKey) {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: {
        'x-goog-api-key': apiKey
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || 'Failed to connect to API');
    }
    
    return { connected: true };
  } catch (error) {
    console.error('Connection test failed:', error);
    throw new Error(`Connection test failed: ${error.message}`);
  }
}

// Test n8n connection
async function testN8nConnection(url, apiKey) {
  if (!url) {
    throw new Error('n8n URL is required');
  }
  
  if (!apiKey) {
    throw new Error('n8n API key is required');
  }
  
  try {
    // Ensure URL is properly formatted
    let apiUrl;
    try {
      const parsedUrl = new URL(url);
      apiUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname.replace(/\/+$/, '')}/rest/healthz`;
    } catch (error) {
      throw new Error(`Invalid URL: ${error.message}`);
    }
    
    const response = await fetch(apiUrl, {
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(`Connection failed: ${errorMessage}`);
    }
    
    return { connected: true };
  } catch (error) {
    console.error('n8n connection test failed:', error);
    throw new Error(`n8n connection failed: ${error.message}`);
  }
}

// Generate workflow using Gemini API
async function generateWorkflow(prompt, options = {}) {
  const { apiKey, model = 'gemini-1.5-flash', complexity = 'moderate' } = options;
  
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  if (!prompt) {
    throw new Error('Prompt is required');
  }
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate a workflow for: ${prompt}\n\nComplexity: ${complexity}`
          }]
        }]
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to generate workflow');
    }
    
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No content generated';
  } catch (error) {
    console.error('Error generating workflow:', error);
    throw new Error(`Failed to generate workflow: ${error.message}`);
  }
}

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case 'open-popup':
      // Open the extension popup
      chrome.action.openPopup();
      break;
      
    case 'generate-workflow':
      // Get the selected text and generate a workflow
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: () => window.getSelection().toString().trim()
          }, (results) => {
            const selectedText = results?.[0]?.result;
            if (selectedText) {
              // Open popup with the selected text as prompt
              chrome.storage.local.get(['apiKey', 'model'], (data) => {
                chrome.windows.create({
                  url: `popup.html#generate?prompt=${encodeURIComponent(selectedText)}`,
                  type: 'popup',
                  width: 400,
                  height: 600
                });
              });
            }
          });
        }
      });
      break;
  }
});

// Handle context menu items
chrome.runtime.onInstalled.addListener(() => {
  // Create a context menu item
  chrome.contextMenus.create({
    id: 'generateWorkflow',
    title: 'Generate Workflow with Workflow AI',
    contexts: ['selection']
  });
});

// Handle context menu item clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'generateWorkflow' && info.selectionText) {
    // Open popup with the selected text as prompt
    chrome.storage.local.get(['apiKey', 'model'], (data) => {
      chrome.windows.create({
        url: `popup.html#generate?prompt=${encodeURIComponent(info.selectionText)}`,
        type: 'popup',
        width: 400,
        height: 600
      });
    });
  }
});

// Handle browser action click (extension icon)
chrome.action.onClicked.addListener((tab) => {
  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 400,
    height: 600
  });
});
