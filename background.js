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
  
  // Force injection function to ensure content script runs
  function forceInjectContentScript(tabId, url, shouldShow) {
    console.log(`Force injecting content script into tab ${tabId}`);
    
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.error(`Error injecting content script: ${chrome.runtime.lastError.message}`);
      } else {
        console.log(`Content script force-injected into tab ${tabId}`);
        
        // Also inject CSS
        chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['content.css']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error(`Error injecting CSS: ${chrome.runtime.lastError.message}`);
          } else {
            console.log(`CSS injected into tab ${tabId}`);
          }
          
          // Send the visibility message after a short delay
          setTimeout(() => {
            sendVisibilityMessage(tabId, shouldShow);
          }, 500);
        });
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
  
  // Update the focus helper visibility on a tab
  function updateFocusHelperVisibility(tabId, url) {
    if (!url || !url.startsWith('http')) return;
    
    chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
      const shouldShow = isDistractionSite(url, distractionSites);
      console.log(`Tab ${tabId} at ${url} - Should show focus helper: ${shouldShow}`);
      
      // Skip if we don't need to show the helper
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
              // Content script not loaded, force inject it
              console.log('Content script not detected, forcing injection');
              forceInjectContentScript(tabId, url, shouldShow);
            }
          }
        );
      } catch (e) {
        console.error('Error checking for content script:', e);
        // Try force injection as a fallback
        forceInjectContentScript(tabId, url, shouldShow);
      }
    });
  }