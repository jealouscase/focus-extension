document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const mainView = document.getElementById('main-view');
  const settingsView = document.getElementById('settings-view');
  const switchViewBtn = document.getElementById('switch-view');
  const mainViewText = document.getElementById('main-view-text');
  const settingsViewText = document.getElementById('settings-view-text');
  
  const objectiveInput = document.getElementById('objective-input');
  const addCurrentSiteBtn = document.getElementById('add-current-site-btn');
  const settingsAddCurrentBtn = document.getElementById('settings-add-current-btn');
  const themeToggle = document.getElementById('theme-toggle');
  
  const stopwatchTab = document.getElementById('stopwatch-tab');
  const timerTab = document.getElementById('timer-tab');
  const timerInput = document.getElementById('timer-input');
  const timerTimeInput = document.getElementById('timer-time-input');
  const timerDisplay = document.getElementById('timer-display');
  const timerControl = document.getElementById('timer-control');
  
  const siteUrlInput = document.getElementById('site-url-input');
  const addSiteBtn = document.getElementById('add-site-btn');
  const sitesList = document.getElementById('sites-list');
  
  // View switching
  let currentView = 'main';
  
  switchViewBtn.addEventListener('click', () => {
    if (currentView === 'main') {
      mainView.classList.remove('active');
      settingsView.classList.add('active');
      mainViewText.style.display = 'none';
      settingsViewText.style.display = 'inline';
      currentView = 'settings';
      loadSites(); // Refresh sites list when switching to settings view
    } else {
      settingsView.classList.remove('active');
      mainView.classList.add('active');
      settingsViewText.style.display = 'none';
      mainViewText.style.display = 'inline';
      currentView = 'main';
    }
  });
  
  // Timer functionality
  let timerMode = 'stopwatch';
  let timerRunning = false;
  let timerInterval = null;
  let timerValue = 0;
  
  stopwatchTab.addEventListener('click', () => setTimerMode('stopwatch'));
  timerTab.addEventListener('click', () => setTimerMode('timer'));
  timerControl.addEventListener('click', toggleTimer);
  
  function setTimerMode(mode) {
    timerMode = mode;
    
    // Update UI
    stopwatchTab.classList.toggle('active', mode === 'stopwatch');
    timerTab.classList.toggle('active', mode === 'timer');
    timerInput.style.display = mode === 'timer' ? 'block' : 'none';
    
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
      const inputValue = timerTimeInput.value;
      const timeParts = inputValue.split(':');
      let mins = 0, secs = 0;
      
      if (timeParts.length === 2) {
        mins = parseInt(timeParts[0]) || 0;
        secs = parseInt(timeParts[1]) || 0;
      } else if (timeParts.length === 1) {
        mins = parseInt(timeParts[0]) || 0;
      }
      
      timerValue = mins * 60 + secs;
      if (timerValue <= 0) timerValue = 1500; // Default 25 mins
    }
    
    timerRunning = true;
    timerControl.textContent = 'Stop';
    timerDisplay.classList.remove('blink');
    
    timerInterval = setInterval(() => {
      if (timerMode === 'stopwatch') {
        timerValue++;
      } else {
        timerValue--;
        if (timerValue <= 0) {
          stopTimer();
          timerDisplay.classList.add('blink');
          return;
        }
      }
      updateTimerDisplay();
    }, 1000);
  }
  
  function stopTimer() {
    timerRunning = false;
    timerControl.textContent = 'Start';
    clearInterval(timerInterval);
  }
  
  function updateTimerDisplay() {
    const mins = Math.floor(timerValue / 60);
    const secs = timerValue % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    timerDisplay.textContent = timeStr;
  }
  
  // Load saved data
  chrome.storage.sync.get(['objective', 'darkTheme', 'autoStart'], (result) => {
    // Set objective
    if (result.objective) {
      objectiveInput.value = result.objective;
    }
    
    // Set theme
    if (result.darkTheme) {
      themeToggle.checked = true;
      document.body.classList.add('dark');
    }
    
    // Set auto-start
    if (result.autoStart) {
      document.getElementById('auto-start-toggle').checked = true;
    }
    
    // Set default timer input
    timerTimeInput.value = '25:00';
  });
  
  // Site management
  function loadSites() {
    chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
      if (distractionSites.length === 0) {
        sitesList.innerHTML = '<p style="text-align: center; color: #6b7280;">No sites added yet</p>';
        return;
      }
      
      sitesList.innerHTML = '';
      distractionSites.forEach(site => {
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
    });
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
  
  function addSite() {
    const url = siteUrlInput.value.trim();
    
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
        siteUrlInput.value = '';
        loadSites();
        notifySitesUpdated();
      });
    });
  }
  
  function addCurrentSite() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        alert('Unable to access the current tab. Please try again.');
        return;
      }
      
      if (tabs && tabs.length > 0 && tabs[0].url) {
        const domain = extractDomain(tabs[0].url);
        
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
            loadSites();
            notifySitesUpdated();
            
            // Show confirmation
            if (currentView === 'main') {
              addCurrentSiteBtn.textContent = 'Site Added!';
              addCurrentSiteBtn.style.backgroundColor = '#10b981';
              
              setTimeout(() => {
                addCurrentSiteBtn.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
                  </svg>
                  Add Current Site as Distraction
                `;
                addCurrentSiteBtn.style.backgroundColor = '';
              }, 2000);
            }
          });
        });
      } else {
        alert('No active tab found or the current page has no URL');
      }
    });
  }
  
  function deleteSite(id) {
    chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
      const newSites = distractionSites.filter(site => site.id !== id);
      chrome.storage.sync.set({ distractionSites: newSites }, () => {
        loadSites();
        notifySitesUpdated();
      });
    });
  }
  
  function notifySitesUpdated() {
    chrome.runtime.sendMessage({ action: 'sitesUpdated' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error notifying background script:', chrome.runtime.lastError);
      }
    });
  }
  
  // Event listeners
  objectiveInput.addEventListener('change', () => {
    chrome.storage.sync.set({ objective: objectiveInput.value });
  });
  
  themeToggle.addEventListener('change', () => {
    const isDarkTheme = themeToggle.checked;
    document.body.classList.toggle('dark', isDarkTheme);
    chrome.storage.sync.set({ darkTheme: isDarkTheme });
  });
  
  document.getElementById('auto-start-toggle').addEventListener('change', (e) => {
    chrome.storage.sync.set({ autoStart: e.target.checked });
  });
  
  addCurrentSiteBtn.addEventListener('click', addCurrentSite);
  settingsAddCurrentBtn.addEventListener('click', addCurrentSite);
  
  addSiteBtn.addEventListener('click', addSite);
  siteUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSite();
  });
  
  // Initial load
  loadSites();
});