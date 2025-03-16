document.addEventListener('DOMContentLoaded', function () {
    const newSiteInput = document.getElementById('new-site-input');
    const addSiteBtn = document.getElementById('add-site-btn');
    const addCurrentSiteBtn = document.getElementById('add-current-site-btn');
    const sitesList = document.getElementById('sites-list');
    const themeToggle = document.getElementById('theme-toggle');

    // Load theme
    chrome.storage.sync.get(['darkTheme'], (result) => {
        if (result.darkTheme) {
            themeToggle.checked = true;
            document.body.classList.add('dark-theme');
        }
    });

    // Toggle theme
    themeToggle.addEventListener('change', () => {
        const isDarkTheme = themeToggle.checked;
        chrome.storage.sync.set({ darkTheme: isDarkTheme });
        document.body.classList.toggle('dark-theme', isDarkTheme);
    });

    // Extract domain from URL
    function extractDomain(url) {
        try {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            const hostname = new URL(url).hostname;
            return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
        } catch (e) {
            return url;
        }
    }

    // Load sites
    function loadSites() {
        chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
            if (distractionSites.length === 0) {
                sitesList.innerHTML = '<p class="empty-message">No sites added yet</p>';
                return;
            }

            sitesList.innerHTML = '';
            distractionSites.forEach(site => {
                const siteEl = document.createElement('div');
                siteEl.className = 'site-item';
                siteEl.innerHTML = `
            <span>${site.url}</span>
            <button class="delete-btn" data-id="${site.id}">Delete</button>
          `;
                sitesList.appendChild(siteEl);
            });

            // Add event listeners for delete buttons
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.getAttribute('data-id'));
                    deleteSite(id);
                });
            });
        });
    }

    // Add a new site
    function addSite() {
        if (newSiteInput.value.trim() === '') return;

        const domain = extractDomain(newSiteInput.value.trim());

        chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
            // Check if domain already exists
            if (distractionSites.some(site => site.url === domain)) {
                alert('This site is already in your list.');
                return;
            }

            const newSites = [...distractionSites, {
                id: Date.now(),
                url: domain
            }];

            chrome.storage.sync.set({ distractionSites: newSites }, () => {
                newSiteInput.value = '';
                loadSites();
            });
        });
    }

    // Add current site
    function addCurrentSite() {
        try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError) {
                    console.error("Error querying tabs:", chrome.runtime.lastError);
                    alert("Unable to access the current tab. Please try again.");
                    return;
                }

                if (tabs && tabs.length > 0 && tabs[0].url) {
                    const domain = extractDomain(tabs[0].url);

                    if (!domain) {
                        alert("Could not determine the domain of the current page.");
                        return;
                    }

                    chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
                        // Check if domain already exists
                        if (distractionSites.some(site => site.url === domain)) {
                            alert('This site is already in your list.');
                            return;
                        }

                        const newSites = [...distractionSites, {
                            id: Date.now(),
                            url: domain
                        }];

                        chrome.storage.sync.set({ distractionSites: newSites }, loadSites);
                    });
                } else {
                    alert("No active tab found or the current page has no URL.");
                }
            });
        } catch (error) {
            console.error("Error in addCurrentSite:", error);
            alert("An error occurred. Please try again later.");
        }
    }

    // Delete a site
    function deleteSite(id) {
        chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
            const newSites = distractionSites.filter(site => site.id !== id);
            chrome.storage.sync.set({ distractionSites: newSites }, loadSites);
        });
    }

    // Event listeners
    addSiteBtn.addEventListener('click', addSite);
    addCurrentSiteBtn.addEventListener('click', addCurrentSite);
    newSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addSite();
    });

    // Load sites on page load
    loadSites();
});