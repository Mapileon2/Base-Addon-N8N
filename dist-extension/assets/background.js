// Background script for Workflow AI Chrome Extension

// Configuration
const CONFIG = {
  API_TIMEOUT: 10000, // 10 seconds
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000, // 1 second
  RATE_LIMITS: {
    testConnection: { maxRequests: 10, timeWindow: 60 * 1000 },
    testN8nConnection: { maxRequests: 10, timeWindow: 60 * 1000 },
    generateWorkflow: { maxRequests: 5, timeWindow: 60 * 1000 },
    pushToN8n: { maxRequests: 5, timeWindow: 60 * 1000 }
  }
};

// Simple rate limiting implementation
const rateLimiters = new Map();

function getRateLimiter(action) {
  if (!rateLimiters.has(action)) {
    const config = CONFIG.RATE_LIMITS[action] || { maxRequests: 10, timeWindow: 60000 };
    rateLimiters.set(action, {
      queue: [],
      inProgress: 0,
      ...config
    });
  }
  return rateLimiters.get(action);
}

async function withRateLimit(action, fn) {
  const limiter = getRateLimiter(action);
  const now = Date.now();
  
  // Clean up old requests
  limiter.queue = limiter.queue.filter(t => now - t < limiter.timeWindow);
  
  // If we're at capacity, wait
  if (limiter.queue.length >= limiter.maxRequests || limiter.inProgress >= limiter.maxRequests) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return withRateLimit(action, fn);
  }
  
  // Add to queue and process
  limiter.queue.push(now);
  limiter.inProgress++;
  
  try {
    return await fn();
  } finally {
    limiter.inProgress--;
  }
}

// Helper function for fetch with timeout and retry
async function fetchWithRetry(url, options = {}, retries = CONFIG.MAX_RETRIES) {
  let lastError;
  const attempt = CONFIG.MAX_RETRIES - retries + 1;
  
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
    
    try {
      console.log(`Fetch attempt ${attempt + i}/${CONFIG.MAX_RETRIES + 1}: ${url}`);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      
      clearTimeout(timeoutId);
      
      // Handle non-2xx responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 
          `HTTP ${response.status} ${response.statusText}`
        );
      }
      
      return response;
      
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      
      // Don't retry for these status codes
      if (error.message.includes('400') || 
          error.message.includes('401') || 
          error.message.includes('403') ||
          error.message.includes('404')) {
        throw error;
      }
      
      // Calculate exponential backoff delay (with jitter)
      const baseDelay = Math.min(1000 * Math.pow(2, i), 10000);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      
      if (i < retries) {
        console.warn(`Attempt ${attempt + i} failed: ${error.message}. Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError || new Error('Request failed after all retries');
}

// Test Gemini API connection
async function testGeminiConnection(apiKey, model = 'gemini-1.5-flash') {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  // Only use gemini-1.5-flash as it's the only working model
  const modelsToTry = ['gemini-1.5-flash'];
  
  // If the requested model is different, log a warning
  if (model && model !== 'gemini-1.5-flash') {
    console.warn(`Requested model ${model} is not available for testing. Using gemini-1.5-flash instead.`);
  }

  let lastError;
  
  for (const currentModel of modelsToTry) {
    try {
      console.log(`Trying Gemini model: ${currentModel}`);
      
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;
      const response = await fetchWithRetry(
        `${endpoint}?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{
                text: 'Hello, this is a test connection to Gemini API. Please respond with "OK" if you receive this message.'
              }]
            }],
            generationConfig: {
              maxOutputTokens: 20,
              temperature: 0.3,
              topP: 0.95,
              topK: 40
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_NONE'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_NONE'
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_NONE'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE'
              }
            ]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;
        console.error(`Gemini API error (${currentModel}):`, errorMessage);
        
        if (response.status === 400) {
          throw new Error(`Invalid request to Gemini API: ${errorMessage}`);
        } else if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid API key. Please check your Gemini API key and try again.');
        } else if (response.status === 404) {
          throw new Error(`Model ${currentModel} not found. Please check if the model name is correct.`);
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait before making more requests.');
        } else if (response.status >= 500) {
          throw new Error('Gemini API server error. Please try again later.');
        } else {
          throw new Error(`Gemini API error: ${errorMessage}`);
        }
      }

      const data = await response.json();
      console.log('Gemini API response:', data);
      
      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error('Unexpected response format from Gemini API');
      }
      
      return { 
        success: true,
        model: currentModel,
        response: data.candidates[0].content.parts[0].text.trim()
      };
      
    } catch (error) {
      console.warn(`Failed with model ${currentModel}:`, error.message);
      lastError = error;
      
      // If this was a specific model request, don't try others
      if (model) break;
      
      // Wait a bit before trying the next model
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Provide a more helpful error message
  if (lastError) {
    if (lastError.message.includes('API key')) {
      throw new Error('Invalid Gemini API key. Please check your API key and try again.');
    } else if (lastError.message.includes('model')) {
      throw new Error('No working Gemini model found. Please try a different model or check your API access.');
    } else if (lastError.message.includes('network')) {
      throw new Error('Network error. Please check your internet connection and try again.');
    }
  }
  
  throw lastError || new Error('Failed to connect to Gemini API. Please try again later.');
}

// Test n8n connection
async function testN8nConnection(url, apiKey) {
  if (!url) {
    throw new Error('n8n URL is required');
  }

  const headers = {};
  if (apiKey) {
    headers['X-N8N-API-KEY'] = apiKey;
  }

  // Clean and normalize the base URL
  const baseUrl = url.replace(/\/+$/, ''); // Remove trailing slashes
  
  // Try multiple endpoints and methods
  const endpoints = [
    { url: `${baseUrl}/rest/health`, method: 'GET' },    // Newer n8n versions
    { url: `${baseUrl}/rest/healthz`, method: 'GET' },   // Older n8n versions
    { url: `${baseUrl}/rest/settings`, method: 'GET' },  // Alternative endpoint
    { url: `${baseUrl}/rest/version`, method: 'GET' }    // Version endpoint
  ];
  
  const errors = [];
  
  for (const { url: endpoint, method } of endpoints) {
    try {
      console.log(`Trying to connect to n8n at: ${endpoint} [${method}]`);
      const response = await fetchWithRetry(endpoint, { 
        headers,
        method,
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log('n8n connection successful, response:', data);
        
        // If we hit the version endpoint directly
        if (endpoint.endsWith('/version')) {
          return {
            version: data.version || 'unknown',
            status: 'ok'
          };
        }
        
        // For other endpoints, try to get version info
        try {
          const versionResponse = await fetchWithRetry(
            `${baseUrl}/rest/version`,
            { headers, method: 'GET', timeout: 3000 }
          );
          const versionData = await versionResponse.json().catch(() => ({}));
          return {
            version: versionData.version || 'unknown',
            status: 'ok'
          };
        } catch (e) {
          console.warn('Could not fetch version info:', e.message);
          return { version: 'unknown', status: 'ok' };
        }
      } else {
        const errorText = await response.text().catch(() => 'No details');
        errors.push(`${endpoint}: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      console.warn(`Connection attempt failed (${endpoint}):`, error.message);
      errors.push(`${endpoint}: ${error.message}`);
    }
  }
  
  // If we get here, all attempts failed
  const errorMessage = [
    'Failed to connect to n8n. Please check:',
    '1. The n8n server is running',
    '2. The URL is correct (try opening it in your browser)',
    '3. CORS is properly configured on the n8n server',
    '4. The API key (if required) is correct',
    '\nConnection attempts:',
    ...errors.map((e, i) => `  ${i + 1}. ${e}`)
  ].join('\n');

  throw new Error(errorMessage);
}

// Generate workflow using Gemini
async function generateWorkflowWithGemini(apiKey, prompt, model = 'gemini-1.5-flash') {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  if (!prompt) {
    throw new Error('Prompt is required');
  }

  // Only use gemini-1.5-flash as it's the only working model
  const models = ['gemini-1.5-flash'];
  
  // If the requested model is different, log a warning
  if (model !== 'gemini-1.5-flash') {
    console.warn(`Requested model ${model} is not available. Using gemini-1.5-flash instead.`);
  }

  let lastError;

  for (const currentModel of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;
      const response = await fetchWithRetry(
        `${endpoint}?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Generate an n8n workflow as JSON based on this description: ${prompt}. 
                Return only the JSON with no additional text or markdown formatting.`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 4096,
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_NONE'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_NONE'
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_NONE'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE'
              }
            ]
          }),
          timeout: 60000 // 60 seconds for generation
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Model ${currentModel} failed`);
      }

      const data = await response.json();

      // Extract the generated text
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) {
        throw new Error('No generated content in response');
      }

      // Try to parse the JSON from the response
      try {
        // Handle cases where the model might return markdown code blocks
        const jsonMatch = generatedText.match(/```(?:json)?\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : generatedText;
        const result = JSON.parse(jsonString);

        // Add model info to the result
        result._meta = {
          model: currentModel,
          generatedAt: new Date().toISOString(),
          tokensUsed: data.usageMetadata?.totalTokenCount
        };

        return result;
      } catch (parseError) {
        console.error(`Failed to parse response from model ${currentModel}:`, parseError);
        throw new Error(`Model ${currentModel} returned invalid JSON. Please try again or use a different model.`);
      }
    } catch (error) {
      console.warn(`Generation failed with model ${currentModel}:`, error.message);
      lastError = error;
    }
  }

  throw lastError || new Error('All model attempts failed. Please check your API key and try again.');
}

// Push workflow to n8n
async function pushWorkflowToN8n(url, apiKey, workflow) {
  if (!url) {
    throw new Error('n8n URL is required');
  }
  if (!workflow) {
    throw new Error('Workflow is required');
  }

  const endpoint = `${url.replace(/\/$/, '')}/rest/workflows`;
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    headers['X-N8N-API-KEY'] = apiKey;
  }

  // First, create a new workflow
  const createResponse = await fetchWithRetry(
    endpoint,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: workflow.name || 'Generated Workflow',
        nodes: workflow.nodes || [],
        connections: workflow.connections || {},
        active: false,
        settings: workflow.settings || {},
        tags: workflow.tags || []
      }),
      // Shorter timeout for local connections
      timeout: url.includes('localhost') ? 5000 : 15000
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to create workflow in n8n');
  }

  const createdWorkflow = await createResponse.json();
  return createdWorkflow;
}

// Helper function to send error response
function sendErrorResponse(sendResponse, error, action) {
  console.error(`Error in ${action}:`, error);
  const response = {
    success: false,
    error: error.message || 'An unknown error occurred',
    action: action
  };
  
  // Only include stack in development
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      response.stack = error.stack;
    }
  } catch (e) {
    // Ignore errors in development mode check
  }
  
  sendResponse(response);}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;
  
  // Helper to handle async operations with proper error handling
  const handleAsync = async () => {
    try {
      let result;
      
      switch (action) {
        case 'testConnection':
          result = await withRateLimit('testConnection', async () => {
            return await testGeminiConnection(request.apiKey);
          });
          break;
          
        case 'testN8nConnection':
          result = await withRateLimit('testN8nConnection', async () => {
            return await testN8nConnection(request.url, request.apiKey);
          });
          break;
          
        case 'generateWorkflow':
          result = await withRateLimit('generateWorkflow', async () => {
            const workflow = await generateWorkflowWithGemini(
              request.apiKey,
              request.prompt,
              request.model
            );
            
            if (request.pushToN8n) {
              const n8nResult = await withRateLimit('pushToN8n', async () => {
                return await pushWorkflowToN8n(
                  request.n8nUrl,
                  request.n8nApiKey,
                  workflow
                );
              });
              
              if (!n8nResult || !n8nResult.success) {
                throw new Error(`Generated workflow but failed to push to n8n: ${n8nResult?.error || 'Unknown error'}`);
              }
              
              return { ...workflow, n8nId: n8nResult.id };
            }
            
            return workflow;
          });
          break;
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      // Send success response
      sendResponse({ 
        success: true, 
        data: result,
        action: action
      });
    } catch (error) {
      sendErrorResponse(sendResponse, error, action);
    }
  };
  
  // Handle testConnection action within the existing async handler
  if (action === 'testConnection') {
    (async () => {
      try {
        const { apiKey, model = 'gemini-1.5-flash' } = request;
        console.log('Testing Gemini connection with model:', model);
        
        const result = await withRateLimit('testConnection', async () => {
          return await testGeminiConnection(apiKey, model);
        });
        
        console.log('Gemini connection test successful:', result);
        
        // Send a minimal success response
        sendResponse({ 
          success: true, 
          model: model,
          response: 'OK'
        });
      } catch (error) {
        console.error('Gemini connection test failed:', error);
        sendErrorResponse(sendResponse, error, 'testConnection');
      }
    })();
    return true; // Will respond asynchronously
  }
  
  // Handle testN8nConnection action
  if (action === 'testN8nConnection') {
    (async () => {
      try {
        const { n8nUrl, n8nApiKey } = request;
        console.log('Testing n8n connection to:', n8nUrl);
        
        const result = await withRateLimit('testN8nConnection', async () => {
          return await testN8nConnection(n8nUrl, n8nApiKey);
        });
        
        console.log('n8n connection test successful:', result);
        sendResponse({ 
          success: true, 
          data: {
            version: result.version,
            status: 'Connected'
          }
        });
      } catch (error) {
        console.error('n8n connection test failed:', error);
        sendErrorResponse(sendResponse, error, 'testN8nConnection');
      }
    })();
    return true; // Will respond asynchronously
  }
  
  // Handle generateWorkflow action
  if (action === 'generateWorkflow') {
    (async () => {
      try {
        const { prompt, model = 'gemini-1.5-flash', apiKey, options = {} } = request;
        console.log('Generating workflow with model:', model);
        
        const workflow = await withRateLimit('generateWorkflow', async () => {
          return await generateWorkflowWithGemini(apiKey, prompt, model);
        });
        
        console.log('Workflow generated successfully');
        sendResponse({ 
          success: true, 
          workflow: workflow,
          model: model
        });
      } catch (error) {
        console.error('Workflow generation failed:', error);
        sendErrorResponse(sendResponse, error, 'generateWorkflow');
      }
    })();
    return true; // Will respond asynchronously
  }
  
  // Handle pushToN8n action
  if (action === 'pushToN8n') {
    (async () => {
      try {
        const { workflow, n8nUrl, n8nApiKey } = request;
        console.log('Pushing workflow to n8n');
        
        const result = await withRateLimit('pushToN8n', async () => {
          return await pushWorkflowToN8n(n8nUrl, n8nApiKey, workflow);
        });
        
        console.log('Workflow pushed to n8n successfully');
        sendResponse({ 
          success: true, 
          data: result
        });
      } catch (error) {
        console.error('Failed to push workflow to n8n:', error);
        sendErrorResponse(sendResponse, error, 'pushToN8n');
      }
    })();
    return true; // Will respond asynchronously
  }
  
  // If we get here, the action is not recognized
  sendErrorResponse(sendResponse, new Error(`Unknown action: ${action}`), 'unknown');
  return true;
});
// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Workflow AI extension installed');
  
  // Initialize storage with default values
  chrome.storage.local.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          theme: 'light',
          apiKey: '',
          n8nUrl: 'http://localhost:5678',
          n8nApiKey: ''
        }
      });
    }
  });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-popup') {
    // Focus the extension popup
    const url = chrome.runtime.getURL('popup.html');
    const [tab] = await chrome.tabs.query({ url });
    
    if (tab) {
      chrome.windows.update(tab.windowId, { focused: true });
      chrome.tabs.update(tab.id, { active: true });
    } else {
      chrome.windows.create({
        url,
        type: 'popup',
        width: 400,
        height: 600
      });
    }
  }
});
