document.addEventListener('DOMContentLoaded', () => {
  class WorkflowAIApp {
    constructor() {
      // DOM Elements
      this.tabButtons = document.querySelectorAll('.tab-button');
      this.tabPanes = document.querySelectorAll('.tab-pane');
      this.themeToggle = document.getElementById('themeToggle');
      this.themeSelect = document.getElementById('themeSelect');
      
      // Generate Tab
      this.workflowPrompt = document.getElementById('workflowPrompt');
      this.workflowComplexity = document.getElementById('workflowComplexity');
      this.modelSelect = document.getElementById('model');
      this.generateBtn = document.getElementById('generateBtn');
      this.generationStatus = document.getElementById('generationStatus');
      
      // Templates Tab
      this.templatesList = document.getElementById('templatesList');
      this.templateSearch = document.getElementById('templateSearch');
      this.newTemplateBtn = document.getElementById('newTemplateBtn');
      
      // History Tab
      this.historyList = document.getElementById('historyList');
      this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
      
      // Settings Tab
      this.apiKeyInput = document.getElementById('apiKey');
      this.n8nUrlInput = document.getElementById('n8nUrl');
      this.n8nApiKeyInput = document.getElementById('n8nApiKey');
      this.testConnectionBtn = document.getElementById('testConnectionBtn');
      this.testN8nBtn = document.getElementById('testN8nBtn');
      this.exportDataBtn = document.getElementById('exportDataBtn');
      this.importDataBtn = document.getElementById('importDataBtn');
      this.importDataInput = document.getElementById('importDataInput');
      this.toggleApiKeyBtn = document.getElementById('toggleApiKey');
      this.toggleN8nApiKeyBtn = document.getElementById('toggleN8nApiKey');
      
      // State
      this.settings = {
        apiKey: '',
        n8nUrl: 'http://localhost:5678',
        n8nApiKey: '',
        model: 'gemini-1.5-flash',
        theme: 'system',
        templates: [],
        history: []
      };
      
      this.init();
    }
    
    async init() {
      await this.loadSettings();
      this.setupEventListeners();
      this.setupTheme();
      this.renderTemplates();
      this.renderHistory();
      this.switchTab('generate');
    }
    
    async loadSettings() {
      try {
        const data = await chrome.storage.local.get(Object.keys(this.settings));
        this.settings = { ...this.settings, ...data };
        
        // Update UI with loaded settings
        if (this.apiKeyInput) this.apiKeyInput.value = this.settings.apiKey || '';
        if (this.n8nUrlInput) this.n8nUrlInput.value = this.settings.n8nUrl || 'http://localhost:5678';
        if (this.n8nApiKeyInput) this.n8nApiKeyInput.value = this.settings.n8nApiKey || '';
        if (this.modelSelect) this.modelSelect.value = this.settings.model || 'gemini-1.5-flash';
        if (this.themeSelect) this.themeSelect.value = this.settings.theme || 'system';
        
        // Apply theme
        this.setTheme(this.settings.theme);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
    
    async saveSettings() {
      try {
        // Update settings from UI
        if (this.apiKeyInput) this.settings.apiKey = this.apiKeyInput.value.trim();
        if (this.n8nUrlInput) this.settings.n8nUrl = this.n8nUrlInput.value.trim();
        if (this.n8nApiKeyInput) this.settings.n8nApiKey = this.n8nApiKeyInput.value.trim();
        if (this.modelSelect) this.settings.model = this.modelSelect.value;
        if (this.themeSelect) this.settings.theme = this.themeSelect.value;
        
        await chrome.storage.local.set(this.settings);
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    }
    
    setupEventListeners() {
      // Tab switching
      this.tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          const tabId = button.dataset.tab;
          if (tabId) this.switchTab(tabId);
        });
      });
      
      // Theme toggle
      if (this.themeToggle) {
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
      }
      
      // Theme select
      if (this.themeSelect) {
        this.themeSelect.addEventListener('change', (e) => {
          this.setTheme(e.target.value);
          this.saveSettings();
        });
      }
      
      // API Key visibility toggle
      if (this.toggleApiKeyBtn && this.apiKeyInput) {
        this.toggleApiKeyBtn.addEventListener('click', () => this.toggleApiKeyVisibility(this.apiKeyInput, this.toggleApiKeyBtn));
      }
      
      // n8n API Key visibility toggle
      if (this.toggleN8nApiKeyBtn && this.n8nApiKeyInput) {
        this.toggleN8nApiKeyBtn.addEventListener('click', () => 
          this.toggleApiKeyVisibility(this.n8nApiKeyInput, this.toggleN8nApiKeyBtn)
        );
      }
      
      // Test API connection
      if (this.testConnectionBtn) {
        this.testConnectionBtn.addEventListener('click', () => this.testApiKey());
      }
      
      // Test n8n connection
      if (this.testN8nBtn) {
        this.testN8nBtn.addEventListener('click', () => this.testN8nConnection());
      }
      
      // Generate workflow
      if (this.generateBtn && this.workflowPrompt) {
        this.generateBtn.addEventListener('click', () => this.generateWorkflow());
      }
      
      // New template
      if (this.newTemplateBtn) {
        this.newTemplateBtn.addEventListener('click', () => this.showNewTemplateModal());
      }
      
      // Template search
      if (this.templateSearch) {
        this.templateSearch.addEventListener('input', (e) => this.filterTemplates(e.target.value));
      }
      
      // Clear history
      if (this.clearHistoryBtn) {
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
      }
      
      // Export data
      if (this.exportDataBtn) {
        this.exportDataBtn.addEventListener('click', () => this.exportData());
      }
      
      // Import data
      if (this.importDataInput) {
        this.importDataInput.addEventListener('change', (e) => this.handleImportData(e));
      }
      
      // Save settings on input changes
      const saveSettingsInputs = [
        this.apiKeyInput,
        this.n8nUrlInput,
        this.n8nApiKeyInput,
        this.modelSelect
      ];
      
      saveSettingsInputs.forEach(input => {
        if (input) {
          input.addEventListener('change', () => this.saveSettings());
        }
      });
    }
    
    // Tab management
    switchTab(tabId) {
      // Update active tab button
      this.tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
      });
      
      // Show active tab content
      this.tabPanes.forEach(pane => {
        pane.classList.toggle('active', pane.id === tabId);
      });
      
      // Save active tab
      chrome.storage.local.set({ activeTab: tabId });
    }
    
    // Theme management
    setupTheme() {
      // Set initial theme
      this.setTheme(this.settings.theme);
      
      // Listen for system theme changes
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      prefersDark.addEventListener('change', (e) => {
        if (this.settings.theme === 'system') {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      });
    }
    
    setTheme(theme) {
      this.settings.theme = theme;
      
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
      
      if (this.themeSelect) {
        this.themeSelect.value = theme;
      }
      
      // Update theme toggle icon
      if (this.themeToggle) {
        const icon = this.themeToggle.querySelector('i');
        if (icon) {
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
      }
      
      // Save theme preference
      this.saveSettings();
    }
    
    toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      this.setTheme(newTheme);
    }
    
    // API Key visibility toggle
    toggleApiKeyVisibility(inputElement, toggleButton) {
      const isPassword = inputElement.type === 'password';
      inputElement.type = isPassword ? 'text' : 'password';
      
      const icon = toggleButton.querySelector('i');
      if (icon) {
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
      }
    }
    
    // Test API connection with timeout
    async testApiKey() {
      const API_TIMEOUT = 10000; // 10 seconds
      const testButton = this.testConnectionBtn;
      let timeoutId;
      
      try {
        const apiKey = this.settings.apiKey?.trim();
        
        if (!apiKey) {
          this.showStatus('Please enter your Gemini API key', 'error', true);
          return false;
        }

        // Update UI
        this.showStatus('Testing API key...', 'info', true);
        if (testButton) {
          testButton.disabled = true;
          testButton.textContent = 'Testing...';
        }
        
        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Connection timed out. The server is taking too long to respond.'));
          }, API_TIMEOUT);
        });
        
        // Create the API request promise
        const apiPromise = fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          method: 'GET',
          headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json'
          }
        });
        
        // Race between the API call and the timeout
        const response = await Promise.race([apiPromise, timeoutPromise]);
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        
        this.showStatus('✅ API key is valid!', 'success', true);
        return true;
        
      } catch (error) {
        console.error('API test failed:', error);
        const errorMessage = error.message.includes('Failed to fetch') 
          ? 'Network error. Please check your internet connection.' 
          : error.message;
        this.showStatus(`❌ ${errorMessage}`, 'error', true);
        return false;
        
      } finally {
        // Cleanup
        if (timeoutId) clearTimeout(timeoutId);
        if (testButton) {
          testButton.disabled = false;
          testButton.textContent = 'Test Connection';
        }
      }
    }
    
    // Test n8n connection with timeout
    async testN8nConnection() {
      const API_TIMEOUT = 10000; // 10 seconds
      const testButton = this.testN8nBtn;
      const originalButtonText = testButton?.textContent;
      let timeoutId;
      
      try {
        // Get current input values
        let n8nUrl = (this.n8nUrlInput?.value || '').trim();
        const n8nApiKey = (this.n8nApiKeyInput?.value || '').trim();
        
        // Validate inputs
        if (!n8nUrl) {
          this.showStatus('Please enter n8n URL', 'error');
          return false;
        }
        
        if (!n8nApiKey) {
          this.showStatus('Please enter n8n API key', 'error');
          return false;
        }

        // Ensure URL has protocol and correct format
        if (!n8nUrl.startsWith('http://') && !n8nUrl.startsWith('https://')) {
          n8nUrl = 'http://' + n8nUrl;
        }
        
        // Normalize URL (remove trailing slashes)
        n8nUrl = n8nUrl.replace(/\/+$/, '');
        
        // Update UI
        this.showStatus('Testing n8n connection...', 'info', true);
        if (testButton) {
          testButton.disabled = true;
          testButton.textContent = 'Testing...';
        }
        
        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Connection timed out. n8n server is not responding.'));
          }, API_TIMEOUT);
        });
        
        // Create the API request promise
        const healthCheckUrl = `${n8nUrl}/rest/healthz`;
        const apiPromise = fetch(healthCheckUrl, {
          method: 'GET',
          headers: {
            'X-N8N-API-KEY': n8nApiKey,
            'Accept': 'application/json'
          }
        });
        
        // Race between the API call and the timeout
        const response = await Promise.race([apiPromise, timeoutPromise]);
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json().catch(() => ({}));
        
        if (data.status === 'ok') {
          this.showStatus('✅ Successfully connected to n8n!', 'success', true);
          
          // Save the valid URL and API key
          this.settings.n8nUrl = n8nUrl;
          this.settings.n8nApiKey = n8nApiKey;
          await this.saveSettings();
          
          return true;
        } else {
          throw new Error(data.message || 'Failed to connect to n8n');
        }
        
      } catch (error) {
        console.error('n8n connection test failed:', error);
        const errorMessage = error.message.includes('Failed to fetch')
          ? 'Failed to connect to n8n. Make sure the URL is correct and n8n is running.'
          : error.message;
        this.showStatus(`❌ ${errorMessage}`, 'error', true);
        return false;
        
      } finally {
        // Cleanup
        if (timeoutId) clearTimeout(timeoutId);
        if (testButton) {
          testButton.disabled = false;
          testButton.textContent = originalButtonText || 'Test n8n Connection';
        }
      }
    }
    
    // Workflow generation
    async generateWorkflow() {
      try {
        if (!this.workflowPrompt) {
          console.error('Workflow prompt element not found');
          return;
        }
        
        const prompt = this.workflowPrompt.value.trim();
        if (!prompt) {
          this.showStatus('Please enter a workflow description', 'error');
          return;
        }
        
        if (!this.settings.apiKey) {
          this.showStatus('Please set your API key in Settings', 'error');
          this.switchTab('settings');
          return;
        }
        
        const complexity = this.workflowComplexity ? this.workflowComplexity.value : 'moderate';
        const model = this.modelSelect ? this.modelSelect.value : 'gemini-1.5-flash';
        
        this.showStatus('Generating workflow...', 'info');
        
        // Generate the workflow using the selected model
        const result = await this.generateWithGemini(prompt, complexity, model);
        
        if (result) {
          this.showStatus('Workflow generated successfully!', 'success');
          
          // Add to history
          this.addToHistory({
            id: Date.now().toString(),
            prompt,
            result,
            complexity,
            model,
            timestamp: new Date().toISOString(),
            isFavorite: false
          });
          
          // Switch to history tab
          this.switchTab('history');
        }
      } catch (error) {
        console.error('Error generating workflow:', error);
        this.showStatus(`Error: ${error.message}`, 'error');
      }
    }
    
    async generateWithGemini(prompt, complexity, model) {
      try {
        // This is a placeholder for the actual API call to Gemini
        // You'll need to implement this based on the Gemini API documentation
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.settings.apiKey}`, {
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
        console.error('Error calling Gemini API:', error);
        throw new Error(`Failed to generate workflow: ${error.message}`);
      }
    }
    
    // Templates management
    renderTemplates() {
      if (!this.templatesList) return;
      
      if (this.settings.templates?.length === 0) {
        this.templatesList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No templates saved yet</p>
          </div>
        `;
        return;
      }
      
      this.templatesList.innerHTML = this.settings.templates
        .map(template => `
          <div class="template-item" data-id="${template.id}">
            <div class="template-header">
              <div class="template-title">${template.name || 'Untitled Template'}</div>
              <div class="template-actions">
                <button class="icon-button use-template" title="Use Template">
                  <i class="fas fa-play"></i>
                </button>
                <button class="icon-button edit-template" title="Edit Template">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="icon-button delete-template" title="Delete Template">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="template-description">
              ${template.description || 'No description'}
            </div>
            <div class="template-footer">
              <span>${template.model || 'N/A'}</span>
              <span>${new Date(template.timestamp).toLocaleDateString()}</span>
            </div>
          </div>
        `).join('');
      
      // Add event listeners to template actions
      this.templatesList.querySelectorAll('.use-template').forEach(button => {
        button.addEventListener('click', (e) => {
          const templateId = e.target.closest('.template-item')?.dataset.id;
          if (templateId) this.useTemplate(templateId);
        });
      });
      
      this.templatesList.querySelectorAll('.edit-template').forEach(button => {
        button.addEventListener('click', (e) => {
          const templateId = e.target.closest('.template-item')?.dataset.id;
          if (templateId) this.editTemplate(templateId);
        });
      });
      
      this.templatesList.querySelectorAll('.delete-template').forEach(button => {
        button.addEventListener('click', (e) => {
          const templateId = e.target.closest('.template-item')?.dataset.id;
          if (templateId) this.deleteTemplate(templateId);
        });
      });
    }
    
    filterTemplates(query) {
      if (!this.templatesList) return;
      
      const searchTerm = query.toLowerCase().trim();
      const items = this.templatesList.querySelectorAll('.template-item');
      
      items.forEach(item => {
        const title = item.querySelector('.template-title')?.textContent?.toLowerCase() || '';
        const description = item.querySelector('.template-description')?.textContent?.toLowerCase() || '';
        const isVisible = title.includes(searchTerm) || description.includes(searchTerm);
        item.style.display = isVisible ? 'block' : 'none';
      });
    }
    
    showNewTemplateModal() {
      // This would show a modal to create a new template
      // For now, we'll just show a message
      this.showStatus('New template functionality coming soon!', 'info');
    }
    
    useTemplate(templateId) {
      const template = this.settings.templates.find(t => t.id === templateId);
      if (!template) return;
      
      if (this.workflowPrompt) {
        this.workflowPrompt.value = template.prompt || '';
      }
      
      if (this.workflowComplexity) {
        this.workflowComplexity.value = template.complexity || 'moderate';
      }
      
      if (this.modelSelect) {
        this.modelSelect.value = template.model || 'gemini-1.5-flash';
      }
      
      this.switchTab('generate');
      this.showStatus(`Loaded template: ${template.name || 'Untitled'}`, 'success');
    }
    
    editTemplate(templateId) {
      // This would show a modal to edit the template
      // For now, we'll just show a message
      this.showStatus('Edit template functionality coming soon!', 'info');
    }
    
    deleteTemplate(templateId) {
      if (confirm('Are you sure you want to delete this template?')) {
        this.settings.templates = this.settings.templates.filter(t => t.id !== templateId);
        this.saveSettings();
        this.renderTemplates();
        this.showStatus('Template deleted', 'success');
      }
    }
    
    // History management
    renderHistory() {
      if (!this.historyList) return;
      
      if (this.settings.history?.length === 0) {
        this.historyList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-history"></i>
            <p>No history yet</p>
          </div>
        `;
        return;
      }
      
      // Sort history by timestamp (newest first)
      const sortedHistory = [...this.settings.history].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      this.historyList.innerHTML = sortedHistory
        .map(item => {
          const previewText = item.result 
            ? item.result.split('\n').slice(0, 3).join('\n')
            : 'No workflow generated';
            
          return `
            <div class="history-item" data-id="${item.id}">
              <div class="history-header">
                <div class="history-title">
                  <i class="fas fa-chevron-${item.expanded ? 'down' : 'right'} toggle-expand"></i>
                  ${item.prompt.substring(0, 50)}${item.prompt.length > 50 ? '...' : ''}
                </div>
                <div class="history-actions">
                  <button class="btn btn-sm btn-view">
                    <i class="fas fa-eye"></i> View
                  </button>
                  <button class="icon-button favorite" title="${item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                    <i class="fas${item.isFavorite ? ' fa-star' : ' fa-star-o'}"></i>
                  </button>
                  <button class="icon-button copy" title="Copy to clipboard">
                    <i class="fas fa-copy"></i>
                  </button>
                  <button class="icon-button delete" title="Delete">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="history-preview" title="${item.prompt}">
                <div class="preview-header">
                  <strong>Prompt:</strong> ${item.prompt.substring(0, 100)}${item.prompt.length > 100 ? '...' : ''}
                </div>
                <div class="preview-content">
                  <strong>Preview:</strong>
                  <pre>${previewText}</pre>
                </div>
              </div>
              <div class="history-details" style="display: ${item.expanded ? 'block' : 'none'};">
                <div class="workflow-full">
                  <h4>Generated Workflow:</h4>
                  <pre>${item.result || 'No workflow generated'}</pre>
                </div>
              </div>
              <div class="history-footer">
                <div class="workflow-meta">
                  <span class="badge">${item.model || 'N/A'}</span>
                  <span class="badge">${item.complexity || 'N/A'}</span>
                  <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <button class="btn btn-link btn-sm toggle-details">
                  ${item.expanded ? 'Hide Details' : 'Show Details'}
                </button>
              </div>
            </div>
          `;
        }).join('');
      
      // Add event listeners to history actions
      this.historyList.querySelectorAll('.favorite').forEach(button => {
        button.addEventListener('click', (e) => {
          const historyId = e.target.closest('.history-item')?.dataset.id;
          if (historyId) this.toggleFavorite(historyId);
        });
      });
      
      this.historyList.querySelectorAll('.copy').forEach(button => {
        button.addEventListener('click', (e) => {
          const historyId = e.target.closest('.history-item')?.dataset.id;
          if (historyId) this.copyToClipboard(historyId);
        });
      });
      
      this.historyList.querySelectorAll('.delete').forEach(button => {
        button.addEventListener('click', (e) => {
          const historyId = e.target.closest('.history-item')?.dataset.id;
          if (historyId) this.deleteHistoryItem(historyId);
        });
      });
      
      // Add click handlers for view buttons
      this.historyList.querySelectorAll('.btn-view').forEach(button => {
        button.addEventListener('click', (e) => {
          const historyItem = e.target.closest('.history-item');
          const historyId = historyItem?.dataset.id;
          if (historyId) {
            // Toggle the expanded state
            const item = this.settings.history.find(h => h.id === historyId);
            if (item) {
              item.expanded = !item.expanded;
              this.saveSettings();
              this.renderHistory();
            }
          }
        });
      });
      
      // Add click handlers for expand/collapse toggles
      this.historyList.querySelectorAll('.toggle-expand, .toggle-details').forEach(element => {
        element.addEventListener('click', (e) => {
          const historyItem = e.target.closest('.history-item');
          const historyId = historyItem?.dataset.id;
          if (historyId) {
            const item = this.settings.history.find(h => h.id === historyId);
            if (item) {
              item.expanded = !item.expanded;
              this.saveSettings();
              
              // Toggle the details section
              const details = historyItem.querySelector('.history-details');
              const toggleIcon = historyItem.querySelector('.toggle-expand');
              const toggleButton = historyItem.querySelector('.toggle-details');
              
              if (details) {
                details.style.display = item.expanded ? 'block' : 'none';
              }
              if (toggleIcon) {
                toggleIcon.className = `fas fa-chevron-${item.expanded ? 'down' : 'right'} toggle-expand`;
              }
              if (toggleButton) {
                toggleButton.textContent = item.expanded ? 'Hide Details' : 'Show Details';
              }
            }
          }
        });
      });
    }
    
    addToHistory(item) {
      if (!this.settings.history) {
        this.settings.history = [];
      }
      
      // Add new item to the beginning of the array
      this.settings.history.unshift(item);
      
      // Keep only the most recent 100 items
      if (this.settings.history.length > 100) {
        this.settings.history = this.settings.history.slice(0, 100);
      }
      
      this.saveSettings();
      this.renderHistory();
    }
    
    toggleFavorite(itemId) {
      const item = this.settings.history.find(item => item.id === itemId);
      if (item) {
        item.isFavorite = !item.isFavorite;
        this.saveSettings();
        this.renderHistory();
      }
    }
    
    async copyToClipboard(itemId) {
      const item = this.settings.history.find(item => item.id === itemId);
      if (!item) return;
      
      try {
        await navigator.clipboard.writeText(item.result);
        this.showStatus('Copied to clipboard!', 'success');
      } catch (error) {
        console.error('Failed to copy:', error);
        this.showStatus('Failed to copy to clipboard', 'error');
      }
    }
    
    deleteHistoryItem(itemId) {
      if (confirm('Are you sure you want to delete this item?')) {
        this.settings.history = this.settings.history.filter(item => item.id !== itemId);
        this.saveSettings();
        this.renderHistory();
        this.showStatus('Item deleted', 'success');
      }
    }
    
    clearHistory() {
      if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
        this.settings.history = [];
        this.saveSettings();
        this.renderHistory();
        this.showStatus('History cleared', 'success');
      }
    }
    
    // Data import/export
    exportData() {
      try {
        const data = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          settings: this.settings
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `workflow-ai-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showStatus('Data exported successfully', 'success');
      } catch (error) {
        console.error('Error exporting data:', error);
        this.showStatus('Failed to export data', 'error');
      }
    }
    
    async handleImportData(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      try {
        const content = await file.text();
        const data = JSON.parse(content);
        
        if (!data.version || !data.settings) {
          throw new Error('Invalid backup file format');
        }
        
        if (confirm('This will overwrite your current settings. Continue?')) {
          this.settings = { ...this.settings, ...data.settings };
          await this.saveSettings();
          await this.loadSettings();
          this.renderTemplates();
          this.renderHistory();
          this.showStatus('Data imported successfully', 'success');
        }
      } catch (error) {
        console.error('Error importing data:', error);
        this.showStatus('Failed to import data: ' + error.message, 'error');
      } finally {
        // Reset the file input
        if (this.importDataInput) {
          this.importDataInput.value = '';
        }
      }
    }
    
    // Utility methods
    showStatus(message, type = 'info', isConnectionStatus = false) {
      const statusElement = isConnectionStatus 
        ? document.getElementById('connectionStatus')
        : this.generationStatus;
        
      if (!statusElement) {
        console.error('Status element not found');
        return;
      }
      
      statusElement.textContent = message;
      statusElement.className = `status-message ${type}`;
      this.generationStatus.className = 'status-message';
      
      // Remove any existing status classes
      this.generationStatus.classList.remove('success', 'error', 'info');
      
      // Add the appropriate status class
      if (type) {
        this.generationStatus.classList.add(type);
      }
      
      // Auto-hide after 5 seconds
      clearTimeout(this.statusTimeout);
      this.statusTimeout = setTimeout(() => {
        if (this.generationStatus) {
          this.generationStatus.textContent = '';
          this.generationStatus.className = 'status-message';
        }
      }, 5000);
    }
  }
  
  // Initialize the app
  const app = new WorkflowAIApp();
  
  // Make app available globally for debugging
  window.app = app;
});
