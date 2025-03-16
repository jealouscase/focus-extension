// Initialize default state when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(['distractionSites', 'objective', 'darkTheme'], (result) => {
      if (!result.distractionSites) {
        chrome.storage.sync.set({ distractionSites: [] });
      }
      if (!result.objective) {
        chrome.storage.sync.set({ objective: '' });
      }
      if (result.darkTheme === undefined) {
        chrome.storage.sync.set({ darkTheme: false });
      }
      console.log('Focus Helper initialized with default settings');
    });
  });
  
  // Extract domain from URL
  function extractDomain(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
    } catch (e) {
      console.error('Error extracting domain:', e);
      return null;
    }
  }
  
  // Check if a URL is in the distraction sites list
  function isDistractionSite(url, distractionSites) {
    if (!url || !distractionSites || distractionSites.length === 0) return false;
    
    const domain = extractDomain(url);
    if (!domain) return false;
    
    return distractionSites.some(site => {
      const siteDomain = site.url.toLowerCase();
      const currentDomain = domain.toLowerCase();
      return currentDomain === siteDomain || 
             currentDomain.endsWith('.' + siteDomain) || 
             currentDomain.includes(siteDomain);
    });
  }
  
    // Update the focus helper visibility on a tab
  function updateFocusHelperVisibility(tabId, url) {
    if (!url || !url.startsWith('http')) return;
    
    chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
      const shouldShow = isDistractionSite(url, distractionSites);
      console.log(`Tab ${tabId} at ${url} - Should show focus helper: ${shouldShow}`);
      
      // Skip trying to inject scripts if we don't need to show the helper
      if (!shouldShow) return;
      
      // Try using the regular content script communication first
      try {
        chrome.tabs.sendMessage(
          tabId, 
          { action: 'checkIfContentScriptExists' }, 
          response => {
            // If this succeeds, the content script is already loaded
            if (!chrome.runtime.lastError && response && response.exists) {
              console.log('Content script already exists in tab, sending visibility message');
              sendVisibilityMessage(tabId, shouldShow);
            } else {
              // Content script not loaded or not responding, don't try to inject manually
              console.log('Content script not detected, relying on manifest declaration');
              // Still try to send the visibility message as the content script might load later
              setTimeout(() => {
                sendVisibilityMessage(tabId, shouldShow);
              }, 1000);
            }
          }
        );
      } catch (e) {
        console.error('Error checking for content script:', e);
      }
    });
  }
  
    // Send the visibility message to a tab
  function sendVisibilityMessage(tabId, shouldShow) {
    try {
      chrome.tabs.sendMessage(tabId, { 
        action: shouldShow ? 'showFocusHelper' : 'hideFocusHelper'
      }, response => {
        if (chrome.runtime.lastError) {
          // Just log the error but don't try to recover - the content script declaration
          // in the manifest should handle loading the script automatically
          console.log(`Message to tab ${tabId} failed: ${chrome.runtime.lastError.message}`);
        } else if (response) {
          console.log(`Tab ${tabId} responded: ${response.status}`);
        }
      });
    } catch (e) {
      console.error('Error in sendVisibilityMessage:', e);
    }
  }
  
  // Listen for tab updates to check if the user is visiting a distraction site
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only act when the page is fully loaded and has a URL
    if (changeInfo.status === 'complete' && tab.url) {
      console.log(`Tab ${tabId} updated: ${tab.url}`);
      updateFocusHelperVisibility(tabId, tab.url);
    }
  });
  
  // Listen for messages from content scripts or popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    
    // Handle adding the current site
    if (request.action === 'addCurrentSite') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('Error querying tabs:', chrome.runtime.lastError);
          sendResponse({ success: false, reason: 'Error accessing current tab' });
          return;
        }
        
        if (tabs && tabs.length > 0 && tabs[0].url) {
          const domain = extractDomain(tabs[0].url);
          
          if (domain) {
            chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
              // Check if domain already exists
              if (!distractionSites.some(site => site.url === domain)) {
                const newSites = [...distractionSites, { 
                  id: Date.now(), 
                  url: domain 
                }];
                
                chrome.storage.sync.set({ distractionSites: newSites }, () => {
                  console.log(`Added ${domain} to distraction sites`);
                  sendResponse({ success: true, domain });
                  
                  // Update the focus helper on the current tab
                  if (tabs[0].id) {
                    updateFocusHelperVisibility(tabs[0].id, tabs[0].url);
                  }
                });
              } else {
                console.log(`${domain} is already in distraction sites`);
                sendResponse({ success: false, reason: 'duplicate' });
              }
            });
          } else {
            sendResponse({ success: false, reason: 'Invalid URL' });
          }
        } else {
          sendResponse({ success: false, reason: 'No active tab' });
        }
      });
      return true; // Keep the message channel open for the async response
    }
    
    // Handle site list updates
    if (request.action === 'sitesUpdated') {
      // Update all tabs when the distraction sites list changes
      chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          if (tab.id && tab.url && tab.url.startsWith('http')) {
            updateFocusHelperVisibility(tab.id, tab.url);
          }
        });
      });
      sendResponse({ success: true });
      return true;
    }
    
    // Default response
    sendResponse({ success: false, reason: 'Unknown action' });
    return true;
  });