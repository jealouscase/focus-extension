// Debug logging
console.log('Focus Helper content script loading at', new Date().toISOString());
chrome.runtime.sendMessage({ action: 'contentScriptReady' }, (response) => {
  console.log('Content script ready notification sent:', response);
});

// Add this to ensure the helper works even with manifest loading
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded at', new Date().toISOString());
  // Check if we need to show the helper on page load
  chrome.storage.sync.get(['distractionSites'], (result) => {
    const domain = extractDomain(window.location.href);
    const isDistraction = result.distractionSites && result.distractionSites.some(site => 
      domain === site.url || domain.endsWith('.' + site.url) || domain.includes(site.url)
    );
    
    if (isDistraction) {
      console.log('This is a distraction site, showing helper...');
      injectFocusHelper();
    }
  });
});


// Create container for our Focus Helper component
let focusHelperContainer = null;
let focusHelperVisible = false;
let scriptInjected = false;
let styleElement = null;

// Function to inject a simple test element
function injectTestElement() {
  console.log('Injecting test element');
  
  const testDiv = document.createElement('div');
  testDiv.id = 'focus-helper-test';
  testDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 200px;
    height: 100px;
    background-color: red;
    color: white;
    z-index: 2147483647;
    padding: 20px;
    border-radius: 8px;
    font-size: 16px;
    font-family: Arial, sans-serif;
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
  `;
  
  testDiv.innerHTML = '<strong>Focus Helper Test</strong><p>If you can see this, DOM injection works!</p>';
  document.body.appendChild(testDiv);
  
  console.log('Test element injected:', testDiv);
  
  // Add a button to manually trigger the actual Focus Helper
  const button = document.createElement('button');
  button.textContent = 'Show Focus Helper';
  button.style.cssText = `
    margin-top: 10px;
    padding: 5px 10px;
    background-color: white;
    color: black;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;
  button.onclick = function() {
    injectFocusHelper();
  };
  
  testDiv.appendChild(button);
}

// Function to add current site to distractions for testing
function addCurrentSiteToDistractions() {
  const domain = extractDomain(window.location.href);
  console.log('Adding current domain to distractions for testing:', domain);
  
  chrome.storage.sync.get(['distractionSites'], (result) => {
    const currentSites = result.distractionSites || [];
    
    // Check if already exists
    if (!currentSites.some(site => site.url === domain)) {
      const newSites = [...currentSites, { id: Date.now(), url: domain }];
      
      chrome.storage.sync.set({ distractionSites: newSites }, () => {
        console.log('Updated distraction sites:', newSites);
        console.log('Triggering injectFocusHelper');
        injectFocusHelper();
      });
    } else {
      console.log('Site already in distractions list');
      injectFocusHelper();
    }
  });
}

// Function to inject and show the focus helper
function injectFocusHelper() {
  console.log('Attempting to inject Focus Helper popup at', new Date().toISOString());
  console.log('Current URL:', window.location.href);
  
  // If already visible, no need to inject again
  if (focusHelperVisible) {
    console.log('Focus Helper already visible');
    return;
  }
  
  // Create container if it doesn't exist
  if (!focusHelperContainer) {
    console.log('Creating focus helper container');
    focusHelperContainer = document.createElement('div');
    focusHelperContainer.id = 'focus-helper-root';
    document.body.appendChild(focusHelperContainer);
    console.log('Container added to DOM:', focusHelperContainer);
  }
  
  const focusHelperHTML = `
    <div id="focus-helper" class="focus-helper">
      <div class="drag-handle" id="drag-handle">
        <div class="drag-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
      <div class="focus-helper-main active">
        <div class="focus-header">
          <h2>Focus Helper</h2>
          <button class="settings-toggle-btn" id="settings-toggle">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div class="objective-input">
          <div class="objective-label">
            <div class="pulse-dot"></div>
            <label>Current objective</label>
          </div>
          <input type="text" id="objective-input" placeholder="What are you working on?">
        </div>
        
        <div class="timer-section">
          <div class="timer-mode-tabs">
            <button class="mode-tab active" id="stopwatch-tab">Stopwatch</button>
            <button class="mode-tab" id="timer-tab">Timer</button>
          </div>
          
          <div class="timer-input">
            <input type="text" id="timer-time-input" placeholder="25:00">
          </div>
          
          <div class="timer-display" id="timer-display">00:00</div>
          
          <div class="timer-controls">
            <button class="timer-control-btn" id="timer-control">Start</button>
            <div class="auto-start-container">
              <label for="auto-start-toggle" class="auto-start-label">Auto-start</label>
              <label class="switch small">
                <input type="checkbox" id="auto-start-toggle">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
        </div>
        
        <div class="theme-toggle">
          <span>Theme</span>
          <label class="switch">
            <input type="checkbox" id="theme-toggle">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      
      <div class="focus-helper-settings">
        <div class="focus-header">
          <h2>Manage Distraction Sites</h2>
          <button class="settings-toggle-btn" id="back-to-main">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div class="site-input-wrap">
          <input type="text" id="site-url-input" placeholder="Enter website URL">
          <button id="add-site-btn">Add</button>
        </div>
        
        <button class="add-current-btn" id="add-current-site-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
          </svg>
          Add Current Site
        </button>
        
        <div class="sites-list" id="sites-list"></div>
      </div>
    </div>
  `;
  
  focusHelperContainer.innerHTML = focusHelperHTML;
  console.log('Focus Helper HTML injected');
  
  // Ensure styles are applied
  ensureStyles();
  console.log('Focus Helper styles applied');
  
  // Make the helper visible
  focusHelperContainer.style.display = 'block';
  focusHelperVisible = true;
  console.log('Focus Helper should now be visible');
  
  // Load saved data and set up event listeners
  loadSavedData();
  setupEventListeners();
  
  console.log('Focus Helper injection complete');
}

// Ensure styles are applied properly
function ensureStyles() {
  if (!styleElement || !document.head.contains(styleElement)) {
    // If style element doesn't exist or was removed, create it again
    styleElement = document.createElement('style');
    styleElement.id = 'focus-helper-styles';
    styleElement.textContent = getStylesText();
    document.head.appendChild(styleElement);
    console.log('Focus Helper styles injected');
  }
}

// Get the styles text
function getStylesText() {
  return `
    /* Ensure all our styles are isolated and highly specific */
    #focus-helper-root,
    #focus-helper-root *,
    #focus-helper-root *::before,
    #focus-helper-root *::after {
      all: initial;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: normal;
    }
    
    #focus-helper-root div,
    #focus-helper-root span,
    #focus-helper-root h1,
    #focus-helper-root h2,
    #focus-helper-root h3,
    #focus-helper-root p,
    #focus-helper-root button,
    #focus-helper-root input,
    #focus-helper-root label {
      display: block;
      margin: 0;
      padding: 0;
    }
    #focus-helper-root {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      width: 360px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-sizing: border-box;
      user-select: none;
    }
    
    .focus-helper {
      background-color: #ffffff !important;
      color: #111827 !important;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      position: relative;
    }
    
    .drag-handle {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 12px;
      cursor: move;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    #focus-helper-root:hover .drag-handle {
      opacity: 1;
    }
    
    .drag-dots {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 4px;
    }
    
    .drag-dots span {
      width: 4px;
      height: 4px;
      background-color: #9ca3af;
      border-radius: 50%;
      display: inline-block;
    }
    
    .focus-helper.dark {
      background-color: #1f2937 !important;
      color: #f9fafb !important;
    }
    
    .focus-helper * {
      box-sizing: border-box;
      font-family: inherit;
    }
    
    .focus-helper-main,
    .focus-helper-settings {
      padding: 20px;
      display: none;
    }
    
    .focus-helper-main.active,
    .focus-helper-settings.active {
      display: block;
    }
    
    .focus-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .focus-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
    
    .settings-toggle-btn {
      background: transparent;
      border: none;
      color: inherit;
      cursor: pointer;
      border-radius: 50%;
      padding: 6px;
    }
    
    .settings-toggle-btn:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
    
    .focus-helper.dark .settings-toggle-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .objective-input {
      margin-bottom: 20px;
    }
    
    .objective-label {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .pulse-dot {
      width: 12px;
      height: 12px;
      background-color: #ef4444;
      border-radius: 50%;
      margin-right: 8px;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% { opacity: 0.5; transform: scale(0.95); }
      50% { opacity: 1; transform: scale(1.05); }
      100% { opacity: 0.5; transform: scale(0.95); }
    }
    
    input[type="text"] {
      width: 100%;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      font-size: 14px;
      background-color: #f9fafb;
      color: #111827;
    }
    
    .focus-helper.dark input[type="text"] {
      background-color: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }
    
    .timer-section {
      margin-bottom: 20px;
    }
    
    .timer-mode-tabs {
      display: flex;
      margin-bottom: 12px;
    }
    
    .mode-tab {
      padding: 8px 16px;
      background-color: #f3f4f6;
      border: none;
      border-radius: 6px;
      margin-right: 8px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .mode-tab.active {
      background-color: #3b82f6;
      color: white;
    }
    
    .focus-helper.dark .mode-tab {
      background-color: #374151;
      color: #e5e7eb;
    }
    
    .focus-helper.dark .mode-tab.active {
      background-color: #2563eb;
    }
    
    .timer-input {
      margin-bottom: 12px;
      display: none;
    }
    
    .timer-display {
      font-size: 36px;
      font-weight: 700;
      text-align: center;
      margin: 20px 0;
    }
    
    .timer-display.blink {
      animation: blink 1s infinite;
    }
    
    @keyframes blink {
      0% { color: inherit; }
      50% { color: #4b5563; }
      100% { color: inherit; }
    }
    
    .timer-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    
    .timer-control-btn {
      flex-grow: 1;
      margin-right: 12px;
      padding: 12px;
      background-color: #10b981 !important;
      color: white !important;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
    }
    
    .timer-control-btn:hover {
      background-color: #059669 !important;
    }
    
    .focus-helper.dark .timer-control-btn {
      background-color: #059669 !important;
    }
    
    .focus-helper.dark .timer-control-btn:hover {
      background-color: #047857 !important;
    }
    
    .auto-start-container {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .auto-start-label {
      font-size: 12px;
      margin-bottom: 4px;
      color: inherit;
    }
    
    .switch.small {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 20px;
    }
    
    .switch.small .slider:before {
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
    }
    
    .switch.small input:checked + .slider:before {
      transform: translateX(20px);
    }
    
    .theme-toggle {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
    }
    
    .focus-helper.dark .theme-toggle {
      border-color: #4b5563;
    }
    
    .switch {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 24px;
    }
    
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
    }
    
    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .4s;
    }
    
    input:checked + .slider {
      background-color: #3b82f6;
    }
    
    .focus-helper.dark input:checked + .slider {
      background-color: #2563eb;
    }
    
    input:checked + .slider:before {
      transform: translateX(24px);
    }
    
    .slider.round {
      border-radius: 24px;
    }
    
    .slider.round:before {
      border-radius: 50%;
    }
    
    .site-input-wrap {
      position: relative;
      margin-bottom: 16px;
    }
    
    .site-input-wrap input {
      padding-right: 60px;
    }
    
    .site-input-wrap button {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      border: none;
      background-color: #3b82f6 !important;
      color: white !important;
      padding: 0 16px;
      border-radius: 0 6px 6px 0;
      cursor: pointer;
    }
    
    .focus-helper.dark .site-input-wrap button {
      background-color: #2563eb !important;
    }
    
    .site-input-wrap button:hover {
      background-color: #2563eb !important;
    }
    
    .focus-helper.dark .site-input-wrap button:hover {
      background-color: #1d4ed8 !important;
    }
    
    .add-current-btn {
      width: 100%;
      padding: 12px;
      background-color: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
    }
    
    .focus-helper.dark .add-current-btn {
      background-color: #374151;
      border-color: #4b5563;
      color: #e5e7eb;
    }
    
    .add-current-btn svg {
      margin-right: 8px;
    }
    
    .add-current-btn:hover {
      background-color: #e5e7eb;
    }
    
    .focus-helper.dark .add-current-btn:hover {
      background-color: #4b5563;
    }
    
    .sites-list {
      max-height: 300px;
      overflow-y: auto;
    }
    
    .site-item {
      padding: 12px;
      background-color: #f3f4f6;
      border-radius: 6px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .focus-helper.dark .site-item {
      background-color: #374151;
    }
    
    .delete-site-btn {
      background-color: transparent;
      border: none;
      color: #ef4444;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      width: 30px;
      height: 30px;
      padding: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .site-item:hover .delete-site-btn {
      opacity: 1;
    }
    
    .delete-site-btn:hover {
      background-color: rgba(239, 68, 68, 0.1);
    }
  `;
}

// Function to hide the focus helper
function hideFocusHelper() {
  if (focusHelperContainer && focusHelperVisible) {
    focusHelperContainer.style.display = 'none';
    focusHelperVisible = false;
    console.log('Focus Helper hidden');
  }
}

// Set up a MutationObserver to watch for style removal
function setupStyleObserver() {
  // Create an observer instance linked to a callback function
  const observer = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        // Check if our style element was removed
        if (!document.getElementById('focus-helper-styles')) {
          console.log('Focus Helper styles were removed, re-adding them');
          ensureStyles();
        }
      }
    }
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.head, { childList: true, subtree: true });
  
  // Also periodically check for styles just to be extra safe
  setInterval(ensureStyles, 2000);
}

// Load saved data from storage
function loadSavedData() {
  chrome.storage.sync.get(['objective', 'darkTheme', 'distractionSites'], (result) => {
    console.log('Loaded saved data:', result);
    
    // Set objective
    const objectiveInput = document.getElementById('objective-input');
    if (objectiveInput && result.objective) {
      objectiveInput.value = result.objective;
    }
    
    // Set theme
    if (result.darkTheme) {
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        themeToggle.checked = true;
        document.querySelector('.focus-helper').classList.add('dark');
      }
    }
    
    // Load sites
    updateSitesList(result.distractionSites || []);
  });
}

// Setup event listeners for all interactive elements
function setupEventListeners() {
  console.log('Setting up event listeners');
  
  // Toggle between main and settings views
  document.getElementById('settings-toggle').addEventListener('click', () => {
    document.querySelector('.focus-helper-main').classList.remove('active');
    document.querySelector('.focus-helper-settings').classList.add('active');
  });
  
  document.getElementById('back-to-main').addEventListener('click', () => {
    document.querySelector('.focus-helper-settings').classList.remove('active');
    document.querySelector('.focus-helper-main').classList.add('active');
  });
  
  // Save objective
  document.getElementById('objective-input').addEventListener('change', (e) => {
    chrome.storage.sync.set({ objective: e.target.value });
  });
  
  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('change', (e) => {
    const isDarkTheme = e.target.checked;
    document.querySelector('.focus-helper').classList.toggle('dark', isDarkTheme);
    chrome.storage.sync.set({ darkTheme: isDarkTheme });
  });
  
  // Timer mode tabs
  document.getElementById('stopwatch-tab').addEventListener('click', () => {
    setTimerMode('stopwatch');
  });
  
  document.getElementById('timer-tab').addEventListener('click', () => {
    setTimerMode('timer');
  });
  
  // Timer control
  document.getElementById('timer-control').addEventListener('click', toggleTimer);
  
  // Auto-start toggle
  const autoStartToggle = document.getElementById('auto-start-toggle');
  chrome.storage.sync.get(['autoStart'], (result) => {
    if (result.autoStart) {
      autoStartToggle.checked = true;
      // If auto-start is enabled and we just loaded, start the timer
      if (timerMode === 'stopwatch' && !timerRunning) {
        startTimer();
      }
    }
  });
  
  autoStartToggle.addEventListener('change', (e) => {
    chrome.storage.sync.set({ autoStart: e.target.checked });
  });
  
  // Add site
  document.getElementById('add-site-btn').addEventListener('click', addNewSite);
  document.getElementById('site-url-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addNewSite();
  });
  
  // Add current site
  document.getElementById('add-current-site-btn').addEventListener('click', addCurrentSite);
  
  // Setup drag functionality
  setupDraggable();
  
  console.log('Event listeners set up successfully');
}

// Make the popup draggable
function setupDraggable() {
  const dragHandle = document.getElementById('drag-handle');
  const container = document.getElementById('focus-helper-root');
  let isDragging = false;
  let offsetX, offsetY;
  
  // Load saved position
  chrome.storage.sync.get(['positionX', 'positionY'], (result) => {
    if (result.positionX !== undefined && result.positionY !== undefined) {
      container.style.top = `${result.positionY}px`;
      container.style.right = 'auto';
      container.style.left = `${result.positionX}px`;
    }
  });
  
  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    
    // Get the current position of the container
    const rect = container.getBoundingClientRect();
    
    // Calculate the offset from the mouse to the top-left corner of the container
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    // Add event listeners for drag and drop
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDrop);
    
    // Prevent text selection during drag
    e.preventDefault();
  });
  
  function onDrag(e) {
    if (!isDragging) return;
    
    // Calculate new position
    const newLeft = e.clientX - offsetX;
    const newTop = e.clientY - offsetY;
    
    // Apply new position
    container.style.left = `${newLeft}px`;
    container.style.top = `${newTop}px`;
    container.style.right = 'auto';
  }
  
  function onDrop() {
    if (!isDragging) return;
    
    // Stop dragging
    isDragging = false;
    
    // Save the position
    const rect = container.getBoundingClientRect();
    chrome.storage.sync.set({ 
      positionX: rect.left,
      positionY: rect.top
    });
    
    // Remove event listeners
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDrop);
  }
}

// Timer functionality
let timerMode = 'stopwatch';
let timerRunning = false;
let timerInterval = null;
let timerValue = 0;

function setTimerMode(mode) {
  timerMode = mode;
  
  // Update UI
  document.getElementById('stopwatch-tab').classList.toggle('active', mode === 'stopwatch');
  document.getElementById('timer-tab').classList.toggle('active', mode === 'timer');
  document.querySelector('.timer-input').style.display = mode === 'timer' ? 'block' : 'none';
  
  // Reset timer
  stopTimer();
  timerValue = 0;
  updateTimerDisplay();
}

function toggleTimer() {
  if (timerRunning) {
    stopTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  // If timer mode and not running, get input value
  if (timerMode === 'timer' && !timerRunning) {
    const inputValue = document.getElementById('timer-time-input').value;
    const [mins, secs] = inputValue.split(':').map(Number);
    timerValue = (mins || 0) * 60 + (secs || 0);
    if (timerValue <= 0) timerValue = 1500; // Default 25 mins
  }
  
  timerRunning = true;
  document.getElementById('timer-control').textContent = 'Stop';
  document.getElementById('timer-display').classList.remove('blink');
  
  timerInterval = setInterval(() => {
    if (timerMode === 'stopwatch') {
      timerValue++;
    } else {
      timerValue--;
      if (timerValue <= 0) {
        stopTimer();
        document.getElementById('timer-display').classList.add('blink');
        return;
      }
    }
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  timerRunning = false;
  document.getElementById('timer-control').textContent = 'Start';
  clearInterval(timerInterval);
}

function updateTimerDisplay() {
  const mins = Math.floor(timerValue / 60);
  const secs = timerValue % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  document.getElementById('timer-display').textContent = timeStr;
}

// Site management
function updateSitesList(sites) {
  const sitesList = document.getElementById('sites-list');
  
  if (!sitesList) return;
  
  if (!sites || sites.length === 0) {
    sitesList.innerHTML = '<p style="text-align: center; padding: 20px; color: #6b7280;">No sites added yet</p>';
    return;
  }
  
  sitesList.innerHTML = '';
  sites.forEach(site => {
    const siteEl = document.createElement('div');
    siteEl.className = 'site-item';
    siteEl.innerHTML = `
      <span>${site.url}</span>
      <button class="delete-site-btn" data-id="${site.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    `;
    sitesList.appendChild(siteEl);
  });
  
  // Add delete event listeners
  document.querySelectorAll('.delete-site-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-id'));
      deleteSite(id);
    });
  });
}

function addNewSite() {
  const input = document.getElementById('site-url-input');
  const url = input.value.trim();
  
  if (!url) return;
  
  const domain = extractDomain(url);
  
  if (!domain) {
    alert('Please enter a valid website URL');
    return;
  }
  
  chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
    // Check if domain already exists
    if (distractionSites.some(site => site.url === domain)) {
      alert('This site is already in your list');
      return;
    }
    
    const newSites = [...distractionSites, { 
      id: Date.now(), 
      url: domain 
    }];
    
    chrome.storage.sync.set({ distractionSites: newSites }, () => {
      input.value = '';
      updateSitesList(newSites);
      notifySitesUpdated();
    });
  });
}

function addCurrentSite() {
  const url = window.location.href;
  const domain = extractDomain(url);
  
  if (!domain) {
    alert('Could not determine the domain of the current page');
    return;
  }
  
  chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
    // Check if domain already exists
    if (distractionSites.some(site => site.url === domain)) {
      alert('This site is already in your list');
      return;
    }
    
    const newSites = [...distractionSites, { 
      id: Date.now(), 
      url: domain 
    }];
    
    chrome.storage.sync.set({ distractionSites: newSites }, () => {
      updateSitesList(newSites);
      notifySitesUpdated();
    });
  });
}

function deleteSite(id) {
  chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
    const newSites = distractionSites.filter(site => site.id !== id);
    chrome.storage.sync.set({ distractionSites: newSites }, () => {
      updateSitesList(newSites);
      notifySitesUpdated();
    });
  });
}

function notifySitesUpdated() {
  try {
    chrome.runtime.sendMessage({ action: 'sitesUpdated' }, (response) => {
      // Don't check lastError directly as it sometimes causes errors itself
      console.log('Sites updated notification sent');
    });
  } catch (error) {
    console.error('Failed to notify background script:', error);
  }
}

// Extract domain from URL
function extractDomain(url) {
  try {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const hostname = new URL(url).hostname;
    return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
  } catch (e) {
    console.error('Error extracting domain:', e);
    return null;
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'showFocusHelper') {
    injectFocusHelper();
    sendResponse({ status: 'showing' });
  } else if (request.action === 'hideFocusHelper') {
    hideFocusHelper();
    sendResponse({ status: 'hidden' });
  } else if (request.action === 'checkIfContentScriptExists') {
    sendResponse({ exists: true });
  } else if (request.action === 'checkStyles') {
    ensureStyles();
    sendResponse({ status: 'styles-checked' });
  }
  
  return true; // Keep the message channel open for asynchronous response
});

// Expose functions for manual testing via browser console
window.showFocusHelper = function() {
  console.log('Manual trigger for Focus Helper');
  injectFocusHelper();
};

window.testElement = function() {
  console.log('Manual trigger for test element');
  injectTestElement();
};

window.addCurrentSiteToDistractions = addCurrentSiteToDistractions;

// Make sure styles are applied when the page loads
window.addEventListener('load', () => {
  console.log('Window load event fired');
  ensureStyles();
  
  // Add a test element on page load for debugging
  injectTestElement();
  
  // Check if we should show the helper based on the current URL
  chrome.storage.sync.get(['distractionSites'], (result) => {
    console.log('Current distraction sites:', result.distractionSites || []);
    
    const domain = extractDomain(window.location.href);
    console.log('Current domain:', domain);
    
    const isDistraction = result.distractionSites && result.distractionSites.some(site => 
      domain === site.url || domain.endsWith('.' + site.url) || domain.includes(site.url)
    );
    
    console.log('Is current site a distraction?', isDistraction);
    
    if (isDistraction) {
      console.log('Calling injectFocusHelper because site is in distraction list');
      injectFocusHelper();
    }
  });
  
  // Let the background script know the content script is ready
  chrome.runtime.sendMessage({ action: 'contentScriptReady' });
});

// Also check styles when DOM content is loaded (earlier than window.load)
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded - Adding test element and checking styles');
  ensureStyles();
});

console.log('Focus Helper content script loaded completely');