// Content script for Workflow AI Chrome Extension

// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    // Get the currently selected text
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    
    // Send the selected text back
    sendResponse({ selectedText });
  }
  
  // Return true to indicate we want to send a response asynchronously
  return true;
});

// Add context menu for workflow generation
function setupContextMenu() {
  // Check if the context menu is already set up
  if (window.workflowAIContextMenuSet) return;
  
  // Add a custom class to elements that can trigger the context menu
  document.addEventListener('contextmenu', (event) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      // Add a custom class to the selected element
      const range = selection.getRangeAt(0);
      const selectedElement = range.commonAncestorContainer.parentElement;
      selectedElement.classList.add('workflow-ai-selection');
      
      // Remove the class after a short delay
      setTimeout(() => {
        selectedElement.classList.remove('workflow-ai-selection');
      }, 3000);
    }
  }, true);
  
  window.workflowAIContextMenuSet = true;
}

// Initialize the content script
function init() {
  setupContextMenu();
  
  // Listen for URL changes in single-page applications
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setupContextMenu();
    }
  });
  
  observer.observe(document, { subtree: true, childList: true });
  
  // Add a small indicator when the extension is active
  const style = document.createElement('style');
  style.textContent = `
    .workflow-ai-selection {
      background-color: rgba(74, 108, 247, 0.1) !important;
      outline: 2px dashed rgba(74, 108, 247, 0.5) !important;
      transition: all 0.3s ease !important;
    }
    
    .workflow-ai-tooltip {
      position: absolute;
      background-color: #4a6cf7;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      z-index: 10000;
      pointer-events: none;
      transform: translateY(-100%) translateY(-10px);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .workflow-ai-selection:hover::after {
      content: 'Right-click to generate workflow';
      position: absolute;
      background-color: #4a6cf7;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      transform: translateY(-100%) translateY(-10px);
      opacity: 1;
    }
  `;
  
  document.head.appendChild(style);
}

// Run the initialization when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPageContent') {
    // Get the page title and selected text
    const pageTitle = document.title;
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    
    // Send the page content back
    sendResponse({
      title: pageTitle,
      url: window.location.href,
      selectedText
    });
  }
  
  // Return true to indicate we want to send a response asynchronously
  return true;
});

// Add a context menu item for the extension
chrome.runtime.sendMessage({ action: 'setupContextMenu' });

// Listen for double-clicks to trigger workflow generation
document.addEventListener('dblclick', (event) => {
  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : '';
  
  if (selectedText.length > 0) {
    // Check if the double-click was on the selected text
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      // Show a small tooltip or indicator
      const tooltip = document.createElement('div');
      tooltip.className = 'workflow-ai-tooltip';
      tooltip.textContent = 'Generating workflow...';
      tooltip.style.position = 'fixed';
      tooltip.style.left = `${event.clientX}px`;
      tooltip.style.top = `${event.clientY - 30}px`;
      document.body.appendChild(tooltip);
      
      // Remove the tooltip after a delay
      setTimeout(() => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      }, 2000);
      
      // Send the selected text to the background script
      chrome.runtime.sendMessage({
        action: 'generateFromSelection',
        selectedText
      });
    }
  }
});
