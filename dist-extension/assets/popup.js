class WorkflowAIApp {
  constructor() {
    this.elements = {};
    this.settings = {
      theme: 'light',
      apiKey: '',
      n8nUrl: 'http://localhost:5678',
      n8nApiKey: ''
    };
    this.history = [];
    this.notificationTimeout = null;
    this.loadingTimeout = null;
  }

  // Initialize the app
  async initialize() {
    try {
      console.log('Initializing app...');
      
      // Cache DOM elements first
      this.cacheElements();
      
      // Bind events early to capture all interactions
      this.bindEvents();
      
      // Load settings
      await this.loadSettings();
      
      // Apply theme
      this.applyTheme();
      
      // Initialize connection status
      this.initConnectionStatus();
      
      // Load history
      await this.loadHistory();
      
      // Update UI
      this.updateUI();
      
      // Show default tab after a small delay to ensure DOM is ready
      console.log('Switching to default tab...');
      setTimeout(() => {
        this.switchTab('generate');
      }, 50);
      
      console.log('App initialization complete');
      
    } catch (error) {
      console.error('Error initializing app:', error);
      this.showNotification('Failed to initialize app', 'error');
    }
  }

  // Cache DOM elements
  cacheElements() {
    try {
      this.elements = {
        // Tabs
        tabs: document.querySelectorAll('.tab-button'),
        tabPanes: document.querySelectorAll('.tab-pane'),
        
        // Generate Tab
        workflowPrompt: document.getElementById('workflowPrompt'),
        workflowResult: document.getElementById('workflowResult'),
        generateBtn: document.getElementById('generateBtn'),
        generationStatus: document.getElementById('generationStatus'),
        copyWorkflowBtn: document.getElementById('copyWorkflowBtn'),
        pushToN8nBtn: document.getElementById('pushToN8nBtn'),
        
        // Settings Tab
        apiKeyInput: document.getElementById('apiKey'),
        n8nUrlInput: document.getElementById('n8nUrl'),
        n8nApiKeyInput: document.getElementById('n8nApiKey'),
        testConnectionBtn: document.getElementById('testConnectionBtn'),
        testN8nBtn: document.getElementById('testN8nBtn'),
        
        // Status indicators
        connectionStatus: document.getElementById('connectionStatus'),
        n8nStatus: document.getElementById('n8nStatus'),
        
        // Theme toggle
        themeToggle: document.getElementById('themeToggle'),
        
        // History
        historyList: document.getElementById('historyList'),
        clearHistoryBtn: document.getElementById('clearHistoryBtn'),
        
        // Loading overlay
        loadingOverlay: document.getElementById('loadingOverlay'),
        loadingMessage: document.getElementById('loadingMessage')
      };
      
      // Initialize any missing elements to prevent errors
      this.elements.workflowResult = this.elements.workflowResult || { style: {}, textContent: '' };
      this.elements.copyWorkflowBtn = this.elements.copyWorkflowBtn || { style: {} };
      this.elements.pushToN8nBtn = this.elements.pushToN8nBtn || { style: {} };
      this.elements.loadingOverlay = this.elements.loadingOverlay || { classList: { add: () => {}, remove: () => {} } };
      this.elements.loadingMessage = this.elements.loadingMessage || { textContent: '' };
      
    } catch (error) {
      console.error('Error in cacheElements:', error);
      this.elements = {}; // Ensure elements is always an object
    }
  }

  // Bind event listeners
  bindEvents() {
    try {
      // Tab switching - use event delegation for better reliability
      document.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab-button');
        if (tab && tab.dataset.tab) {
          e.preventDefault();
          this.switchTab(tab.dataset.tab);
        }
      });
      
      // Bind buttons
      this.bindButtons();
      
    } catch (error) {
      console.error('Error in bindEvents:', error);
    }
  }
  
  // Toggle password visibility
  togglePasswordVisibility(inputId, toggleBtnId) {
    const input = document.getElementById(inputId);
    const toggleBtn = document.getElementById(toggleBtnId);
    if (!input || !toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
      const type = input.type === 'password' ? 'text' : 'password';
      input.type = type;
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
      }
    });
  }

  // Handle file import
  setupFileImport() {
    const importInput = document.getElementById('importDataInput');
    if (!importInput) return;

    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const content = await file.text();
        const data = JSON.parse(content);
        // Handle imported data here
        console.log('Imported data:', data);
        this.showNotification('Data imported successfully', 'success');
      } catch (error) {
        console.error('Error importing data:', error);
        this.showNotification('Failed to import data', 'error');
      }
    });
  }

  // Export data
  async exportData() {
    try {
      const data = {
        settings: this.settings,
        history: this.history
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-ai-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification('Data exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showNotification('Failed to export data', 'error');
    }
  }

  // Bind button events
  bindButtons() {
    try {
      console.log('Binding buttons...');
      
      // Generate workflow button
      const generateBtn = document.getElementById('generateBtn');
      if (generateBtn) {
        console.log('Found generate button');
        generateBtn.addEventListener('click', (e) => {
          console.log('Generate button clicked');
          e.preventDefault();
          this.generateWorkflow();
        });
      } else {
        console.warn('Generate button not found');
      }
      
      // Test connection buttons
      const testConnectionBtn = document.getElementById('testConnectionBtn');
      if (testConnectionBtn) {
        console.log('Found test connection button');
        testConnectionBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('Test connection button clicked');
          this.testConnection();
        });
      } else {
        console.warn('Test connection button not found');
      }
      
      const testN8nBtn = document.getElementById('testN8nBtn');
      if (testN8nBtn) {
        console.log('Found test n8n button');
        testN8nBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('Test n8n button clicked');
          this.testN8nConnection();
        });
      } else {
        console.warn('Test n8n button not found');
      }
      
      // Clear history button
      const clearHistoryBtn = document.getElementById('clearHistoryBtn');
      if (clearHistoryBtn) {
        console.log('Found clear history button');
        clearHistoryBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('Clear history button clicked');
          this.clearHistory();
        });
      } else {
        console.warn('Clear history button not found');
      }
      
      // New template button
      const newTemplateBtn = document.getElementById('newTemplateBtn');
      if (newTemplateBtn) {
        console.log('Found new template button');
        newTemplateBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('New template button clicked');
          // Implement template creation
          this.showNotification('Template creation not implemented yet', 'info');
        });
      } else {
        console.warn('New template button not found');
      }
      
      // Export/Import buttons
      const exportDataBtn = document.getElementById('exportDataBtn');
      if (exportDataBtn) {
        console.log('Found export data button');
        exportDataBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('Export data button clicked');
          this.exportData();
        });
      } else {
        console.warn('Export data button not found');
      }
      
      // Setup file import
      this.setupFileImport();
      
      // Setup password visibility toggles
      this.togglePasswordVisibility('apiKey', 'toggleApiKey');
      this.togglePasswordVisibility('n8nApiKey', 'toggleN8nApiKey');
      
      // Theme toggle and selector
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) {
        console.log('Found theme toggle');
        themeToggle.addEventListener('click', (e) => {
          this.settings.theme = e.target.checked ? 'dark' : 'light';
          this.applyTheme();
          this.saveSettings();
        });
      }
      
    } catch (error) {
      console.error('Error binding buttons:', error);
    }
  }

  // Switch between tabs
  switchTab(tabName) {
    try {
      console.log('Switching to tab:', tabName);
      
      // Ensure elements are cached
      if (!this.elements.tabPanes || !this.elements.tabs) {
        this.cacheElements();
      }
      
      // Hide all tab panes
      if (this.elements.tabPanes) {
        this.elements.tabPanes.forEach(pane => {
          if (pane) pane.classList.remove('active');
        });
      }
      
      // Deactivate all tab buttons
      if (this.elements.tabs) {
        this.elements.tabs.forEach(tab => {
          if (tab) tab.classList.remove('active');
        });
      }
      
      // Show selected tab
      const tabPane = document.getElementById(tabName);
      if (tabPane) {
        tabPane.classList.add('active');
      } else {
        console.error('Tab pane not found:', tabName);
      }
      
      // Activate clicked tab button
      const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
      if (tabButton) {
        tabButton.classList.add('active');
      } else {
        console.error('Tab button not found for:', tabName);
      }
      
      // Update UI for the active tab
      this.updateUI();
      
    } catch (error) {
      console.error('Error in switchTab:', error);
    }
  }

  // Set loading state with better visual feedback
  setLoading(isLoading, message = '') {
    if (!this.elements.loadingOverlay) return;
    
    const { loadingOverlay, loadingMessage } = this.elements;
    
    if (isLoading) {
      // Prevent multiple loading indicators
      if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
      
      // Show loading indicator after a small delay to prevent flickering
      this.loadingTimeout = setTimeout(() => {
        loadingOverlay.classList.add('visible');
        if (loadingMessage && message) {
          loadingMessage.textContent = message;
        }
      }, 200);
    } else {
      if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
      
      // Hide loading overlay with fade out effect
      loadingOverlay.classList.remove('visible');
      
      // Reset loading message after animation completes
      setTimeout(() => {
        if (loadingMessage) {
          loadingMessage.textContent = '';
        }
      }, 300);
    }
  }

  // Show notification to user
  showNotification(message, type = 'info') {
    // Implementation for showing notifications
    console.log(`[${type}] ${message}`);
  }

  // Load settings from storage
  async loadSettings() {
    try {
      const data = await new Promise((resolve) => {
        chrome.storage.local.get(['settings'], (result) => {
          resolve(result.settings || {});
        });
      });
      
      this.settings = { ...this.settings, ...data };
      
      // Update UI with loaded settings
      if (this.elements.apiKeyInput) this.elements.apiKeyInput.value = this.settings.apiKey || '';
      if (this.elements.n8nUrlInput) this.elements.n8nUrlInput.value = this.settings.n8nUrl || '';
      if (this.elements.n8nApiKeyInput) this.elements.n8nApiKeyInput.value = this.settings.n8nApiKey || '';
      if (this.elements.themeToggle) this.elements.themeToggle.checked = this.settings.theme === 'dark';
      
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Save settings to storage
  async saveSettings() {
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set({ settings: this.settings }, resolve);
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  // Apply theme to the UI
  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.settings.theme || 'light');
  }

  // Lazy load non-critical components
  async lazyLoadComponents() {
    try {
      // These will load in the background without blocking the UI
      const promises = [];
      
      // Add any lazy loading tasks here
      // Example: promises.push(this.loadSomeData());
      
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error in lazyLoadComponents:', error);
    }
  }

  // Initialize connection status
  initConnectionStatus() {
    if (this.elements.connectionStatus) {
      this.elements.connectionStatus.textContent = 'Disconnected';
      this.elements.connectionStatus.className = 'status status-error';
    }
    
    if (this.elements.n8nStatus) {
      this.elements.n8nStatus.textContent = 'Disconnected';
      this.elements.n8nStatus.className = 'status status-error';
    }
  }

  // Test connections if we have the required info
  async testConnectionsIfPossible() {
    if (this.settings.apiKey) {
      await this.testConnection();
    }
    
    if (this.settings.n8nUrl && this.settings.n8nApiKey) {
      await this.testN8nConnection();
    }
  }

  // Test Gemini API connection
  async testConnection() {
    if (!this.settings.apiKey) {
      this.showNotification('Please enter your Gemini API key first', 'error');
      return false;
    }

    this.setLoading(true, 'Testing Gemini API connection...');
    
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'testConnection',
            apiKey: this.settings.apiKey
          },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(response);
            }
          }
        );
      });

      if (response && response.success) {
        this.showNotification('Successfully connected to Gemini API', 'success');
        // Update connection status in UI
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
          statusEl.textContent = 'Connected to Gemini API';
          statusEl.className = 'status-message success';
        }
        return true;
      } else {
        const errorMsg = response?.error || 'Failed to connect to Gemini API';
        this.showNotification(errorMsg, 'error');
        return false;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      this.showNotification(`Connection test failed: ${error.message}`, 'error');
      return false;
    } finally {
      this.setLoading(false);
    }
  }

  // Test n8n connection
  async testN8nConnection() {
    if (!this.settings.n8nUrl || !this.settings.n8nApiKey) {
      this.showNotification('Please enter n8n URL and API key first', 'error');
      return false;
    }

    this.setLoading(true, 'Testing n8n connection...');
    
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'testN8nConnection',
            url: this.settings.n8nUrl,
            apiKey: this.settings.n8nApiKey
          },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(response);
            }
          }
        );
      });

      if (response && response.success) {
        this.showNotification('Successfully connected to n8n', 'success');
        // Update connection status in UI
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
          statusEl.textContent = 'Connected to n8n';
          statusEl.className = 'status-message success';
        }
        return true;
      } else {
        const errorMsg = response?.error || 'Failed to connect to n8n';
        this.showNotification(errorMsg, 'error');
        return false;
      }
    } catch (error) {
      console.error('n8n connection test failed:', error);
      this.showNotification(`n8n connection test failed: ${error.message}`, 'error');
      return false;
    } finally {
      this.setLoading(false);
    }
  }

  // Generate workflow based on user input
  async generateWorkflow() {
    try {
      // Get user input
      const prompt = document.getElementById('workflowPrompt')?.value.trim();
      const complexity = document.getElementById('workflowComplexity')?.value || 'moderate';
      const model = document.getElementById('model')?.value || 'gemini-1.5-flash';

      // Validate input
      if (!prompt) {
        this.showNotification('Please enter a workflow description', 'error');
        return;
      }

      if (!this.settings.apiKey) {
        this.showNotification('Please set your Gemini API key in Settings', 'error');
        this.switchTab('settings');
        return;
      }

      // Set loading state
      this.setLoading(true, 'Generating workflow...');
      
      // Generate a timestamp for this generation
      const timestamp = new Date().toISOString();
      
      // Send message to background script to generate workflow
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'generateWorkflow',
            prompt: prompt,
            complexity: complexity,
            model: model,
            apiKey: this.settings.apiKey,
            timestamp: timestamp
          },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(response);
            }
          }
        );
      });

      if (response && response.success) {
        // Show success message
        this.showNotification('Workflow generated successfully!', 'success');
        
        // Switch to the history tab to show the result
        this.switchTab('history');
        
        // Add to history
        const workflow = {
          id: timestamp,
          prompt: prompt,
          complexity: complexity,
          model: model,
          timestamp: timestamp,
          workflow: response.workflow,
          nodes: response.workflow?.nodes || [],
          connections: response.workflow?.connections || []
        };
        
        // Add to beginning of history and keep only last 50 items
        this.history.unshift(workflow);
        this.history = this.history.slice(0, 50);
        
        // Save updated history
        await new Promise((resolve) => {
          chrome.storage.local.set({ workflowHistory: this.history }, resolve);
        });
        
        // Update UI
        this.renderHistory();
        
      } else {
        const errorMsg = response?.error || 'Failed to generate workflow';
        this.showNotification(errorMsg, 'error');
      }
      
    } catch (error) {
      console.error('Workflow generation failed:', error);
      this.showNotification(`Workflow generation failed: ${error.message}`, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  // Clear history
  async clearHistory() {
    // Implementation for clearing history
    console.log('Clearing history...');
  }

  // Load history from storage
  async loadHistory() {
    try {
      const data = await new Promise((resolve) => {
        chrome.storage.local.get(['workflowHistory'], (result) => {
          resolve(result.workflowHistory || []);
        });
      });
      
      this.history = data;
      this.renderHistory();
      
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  // Render history list
  renderHistory() {
    try {
      const historyList = document.getElementById('historyList');
      if (!historyList) {
        console.error('History list element not found');
        return;
      }

      if (!this.history || this.history.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No workflow history yet. Generate a workflow to see it here.</div>';
        return;
      }

      // Clear existing content
      historyList.innerHTML = '';

      // Create and append history items
      this.history.forEach((item, index) => {
        if (!item) return;

        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.dataset.id = item.id || index;

        // Format date
        const date = item.timestamp ? new Date(item.timestamp) : new Date();
        const formattedDate = date.toLocaleString();
        
        // Count nodes and connections
        const nodeCount = item.nodes ? item.nodes.length : 0;
        const connectionCount = item.connections ? item.connections.length : 0;

        // Create HTML for the history item
        historyItem.innerHTML = `
          <div class="history-item-header">
            <h4>${item.prompt || 'Untitled Workflow'}</h4>
            <span class="history-item-date">${formattedDate}</span>
          </div>
          <div class="history-item-meta">
            <span class="chip">${item.model || 'gemini-1.5-flash'}</span>
            <span class="chip">${item.complexity || 'moderate'}</span>
            <span class="chip">${nodeCount} nodes</span>
            <span class="chip">${connectionCount} connections</span>
          </div>
          <div class="history-item-actions">
            <button class="btn btn-sm btn-view" data-action="view" data-id="${item.id || index}">
              <i class="fas fa-eye"></i> View
            </button>
            <button class="btn btn-sm btn-delete" data-action="delete" data-id="${item.id || index}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;

        // Add event listeners for the action buttons
        const viewBtn = historyItem.querySelector('[data-action="view"]');
        const deleteBtn = historyItem.querySelector('[data-action="delete"]');
        
        if (viewBtn) {
          viewBtn.addEventListener('click', (e) => this.viewWorkflow(item));
        }
        
        if (deleteBtn) {
          deleteBtn.addEventListener('click', (e) => this.deleteWorkflow(item.id || index, historyItem));
        }

        historyList.appendChild(historyItem);
      });
    } catch (error) {
      console.error('Error rendering history:', error);
      this.showNotification('Failed to load history', 'error');
    }
  }

  // View a specific workflow
  viewWorkflow(workflow) {
    try {
      // Create or get the workflow modal
      let modal = document.getElementById('workflowPreviewModal');
      
      if (!modal) {
        // Create the modal if it doesn't exist
        modal = document.createElement('div');
        modal.id = 'workflowPreviewModal';
        modal.className = 'modal';
        modal.innerHTML = `
          <div class="modal-content">
            <div class="modal-header">
              <h3>Workflow Details</h3>
              <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
              <div class="workflow-preview">
                <div class="workflow-meta">
                  <div><strong>Prompt:</strong> ${workflow.prompt || 'N/A'}</div>
                  <div><strong>Model:</strong> ${workflow.model || 'gemini-1.5-flash'}</div>
                  <div><strong>Complexity:</strong> ${workflow.complexity || 'moderate'}</div>
                  <div><strong>Generated on:</strong> ${workflow.timestamp ? new Date(workflow.timestamp).toLocaleString() : 'N/A'}</div>
                </div>
                <div class="workflow-tabs">
                  <button class="tab-button active" data-tab="nodes">Nodes (${workflow.nodes?.length || 0})</button>
                  <button class="tab-button" data-tab="connections">Connections (${workflow.connections?.length || 0})</button>
                  <button class="tab-button" data-tab="raw">Raw JSON</button>
                </div>
                <div class="tab-content">
                  <div id="nodes" class="tab-pane active">
                    ${this.renderNodesPreview(workflow.nodes || [])}
                  </div>
                  <div id="connections" class="tab-pane">
                    ${this.renderConnectionsPreview(workflow.connections || [])}
                  </div>
                  <div id="raw" class="tab-pane">
                    <pre><code>${JSON.stringify(workflow.workflow || {}, null, 2)}</code></pre>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" id="loadWorkflowBtn">Load in Editor</button>
              <button class="btn btn-primary" id="copyWorkflowBtn">Copy to Clipboard</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        // Add tab switching functionality
        modal.querySelectorAll('.tab-button').forEach(button => {
          button.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            // Hide all panes
            modal.querySelectorAll('.tab-pane').forEach(pane => {
              pane.classList.remove('active');
            });
            // Deactivate all buttons
            modal.querySelectorAll('.tab-button').forEach(btn => {
              btn.classList.remove('active');
            });
            // Show selected pane and activate button
            document.getElementById(tabName).classList.add('active');
            e.target.classList.add('active');
          });
        });

        // Close modal when clicking the X
        modal.querySelector('.close-modal').addEventListener('click', () => {
          modal.style.display = 'none';
        });

        // Close modal when clicking outside the content
        window.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.style.display = 'none';
          }
        });

        // Load in editor button
        const loadBtn = modal.querySelector('#loadWorkflowBtn');
        if (loadBtn) {
          loadBtn.addEventListener('click', () => this.loadWorkflowInEditor(workflow));
        }

        // Copy to clipboard button
        const copyBtn = modal.querySelector('#copyWorkflowBtn');
        if (copyBtn) {
          copyBtn.addEventListener('click', () => this.copyWorkflowToClipboard(workflow));
        }
      }


      // Show the modal
      modal.style.display = 'block';
      
    } catch (error) {
      console.error('Error viewing workflow:', error);
      this.showNotification('Failed to load workflow details', 'error');
    }
  }


  // Render nodes preview
  renderNodesPreview(nodes) {
    if (!nodes || nodes.length === 0) {
      return '<div class="empty-state">No nodes found in this workflow.</div>';
    }

    return `
      <div class="nodes-list">
        ${nodes.map(node => `
          <div class="node-item">
            <div class="node-header">
              <span class="node-type">${node.type || 'Unknown'}</span>
              <span class="node-id">ID: ${node.id || 'N/A'}</span>
            </div>
            <div class="node-params">
              ${node.parameters ? `
                <div class="node-params-title">Parameters:</div>
                <pre>${JSON.stringify(node.parameters, null, 2)}</pre>
              ` : '<div>No parameters</div>'}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Render connections preview
  renderConnectionsPreview(connections) {
    if (!connections || connections.length === 0) {
      return '<div class="empty-state">No connections found in this workflow.</div>';
    }

    return `
      <div class="connections-list">
        ${connections.map(conn => `
          <div class="connection-item">
            <div class="connection-source">
              <strong>From:</strong> ${conn.source || 'N/A'}
              ${conn.sourceOutput ? `<span class="connection-io">[${conn.sourceOutput}]</span>` : ''}
            </div>
            <div class="connection-arrow">→</div>
            <div class="connection-target">
              <strong>To:</strong> ${conn.target || 'N/A'}
              ${conn.targetInput ? `<span class="connection-io">[${conn.targetInput}]</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Load workflow in editor
  loadWorkflowInEditor(workflow) {
    try {
      // Switch to the generate tab
      this.switchTab('generate');
      
      // Set the prompt
      const promptInput = document.getElementById('workflowPrompt');
      if (promptInput) {
        promptInput.value = workflow.prompt || '';
      }
      
      // Set the complexity
      const complexitySelect = document.getElementById('workflowComplexity');
      if (complexitySelect && workflow.complexity) {
        complexitySelect.value = workflow.complexity;
      }
      
      // Set the model
      const modelSelect = document.getElementById('model');
      if (modelSelect && workflow.model) {
        modelSelect.value = workflow.model;
      }
      
      // Close the modal
      const modal = document.getElementById('workflowPreviewModal');
      if (modal) {
        modal.style.display = 'none';
      }
      
      this.showNotification('Workflow loaded. Click Generate to recreate it.', 'info');
      
    } catch (error) {
      console.error('Error loading workflow in editor:', error);
      this.showNotification('Failed to load workflow in editor', 'error');
    }
  }
  
  // Copy workflow to clipboard
  async copyWorkflowToClipboard(workflow) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(workflow.workflow || {}, null, 2));
      this.showNotification('Workflow copied to clipboard!', 'success');
    } catch (error) {
      console.error('Error copying workflow to clipboard:', error);
      this.showNotification('Failed to copy workflow', 'error');
    }
  }
  
  // Delete a workflow from history
  async deleteWorkflow(workflowId, element) {
    try {
      if (!workflowId) return;
      
      // Remove from the array
      this.history = this.history.filter(item => item.id !== workflowId);
      
      // Update storage
      await new Promise((resolve) => {
        chrome.storage.local.set({ workflowHistory: this.history }, resolve);
      });
      
      // Remove from UI with animation
      if (element) {
        element.style.opacity = '0';
        setTimeout(() => {
          element.remove();
          // If no more items, show empty state
          if (this.history.length === 0) {
            this.renderHistory();
          }
        }, 300);
      }
      
      this.showNotification('Workflow removed from history', 'success');
      
    } catch (error) {
      console.error('Error deleting workflow:', error);
      this.showNotification('Failed to delete workflow', 'error');
    }
  }

  // Update UI based on current state
  updateUI() {
    // Implementation for updating UI
    console.log('Updating UI...');
  }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new WorkflowAIApp();
  // Initialize after the constructor has finished
  window.app.initialize().catch(error => {
    console.error('Failed to initialize app:', error);
  });
});
