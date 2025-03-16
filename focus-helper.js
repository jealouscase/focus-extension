// This file would normally be built from our React component
// For demonstration purposes, we're simplifying it to a direct script

(function () {
    // Wait for React and ReactDOM to be available
    const checkReady = setInterval(() => {
        if (window.React && window.ReactDOM) {
            clearInterval(checkReady);
            initializeFocusHelper();
        }
    }, 100);

    function initializeFocusHelper() {
        const { useState, useEffect } = React;

        const FocusHelper = () => {
            // Get initial state from data attributes or use defaults
            const container = document.getElementById('focus-helper-root');
            const initialObjective = container.getAttribute('data-objective') || '';
            const initialTheme = container.getAttribute('data-theme') === 'dark';

            // State variables
            const [objective, setObjective] = useState(initialObjective);
            const [timerMode, setTimerMode] = useState('stopwatch');
            const [isRunning, setIsRunning] = useState(false);
            const [time, setTime] = useState(0);
            const [inputTime, setInputTime] = useState('25:00');
            const [isTimerComplete, setIsTimerComplete] = useState(false);
            const [isDarkTheme, setIsDarkTheme] = useState(initialTheme);
            const [showSettings, setShowSettings] = useState(false);
            const [newSiteUrl, setNewSiteUrl] = useState('');
            const [distractionSites, setDistractionSites] = useState([]);

            // Load distraction sites
            useEffect(() => {
                // In extension context, we use postMessage to request data
                window.addEventListener('message', function (event) {
                    if (event.data.type === 'focusHelper_sitesData') {
                        setDistractionSites(event.data.sites);
                    } else if (event.data.type === 'focusHelper_currentSiteResponse') {
                        if (event.data.success) {
                            // Add the newly added site to our local state
                            setDistractionSites(prevSites => {
                                const newSite = { id: Date.now(), url: event.data.domain };
                                return [...prevSites, newSite];
                            });
                        }
                    }
                });

                // Request sites data
                chrome.storage.sync.get(['distractionSites'], ({ distractionSites = [] }) => {
                    setDistractionSites(distractionSites);
                });
            }, []);

            // Effect for running the timer
            useEffect(() => {
                let interval = null;

                if (isRunning) {
                    interval = setInterval(() => {
                        if (timerMode === 'stopwatch') {
                            setTime(prevTime => prevTime + 1);
                        } else {
                            setTime(prevTime => {
                                if (prevTime <= 1) {
                                    clearInterval(interval);
                                    setIsRunning(false);
                                    setIsTimerComplete(true);
                                    return 0;
                                }
                                return prevTime - 1;
                            });
                        }
                    }, 1000);
                } else {
                    clearInterval(interval);
                }

                return () => clearInterval(interval);
            }, [isRunning, timerMode]);

            // Effect for blinking when timer completes
            useEffect(() => {
                let blinkInterval = null;

                if (isTimerComplete) {
                    blinkInterval = setInterval(() => {
                        setIsTimerComplete(prev => !prev);
                    }, 500);
                }

                return () => clearInterval(blinkInterval);
            }, [isTimerComplete]);

            // Save objective when it changes
            useEffect(() => {
                window.postMessage({
                    type: 'focusHelper_saveObjective',
                    objective
                }, '*');
            }, [objective]);

            // Save theme when it changes
            useEffect(() => {
                window.postMessage({
                    type: 'focusHelper_setTheme',
                    isDarkTheme
                }, '*');
            }, [isDarkTheme]);

            // Format time as mm:ss
            const formatTime = (seconds) => {
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            };

            // Parse time input (mm:ss) to seconds
            const parseTimeInput = (input) => {
                const [mins, secs] = input.split(':').map(Number);
                return (mins * 60) + (secs || 0);
            };

            // Handle timer start/stop
            const handleTimerToggle = () => {
                if (!isRunning && timerMode === 'timer') {
                    setTime(parseTimeInput(inputTime));
                    setIsTimerComplete(false);
                }
                setIsRunning(!isRunning);
            };

            // Handle timer mode change
            const handleModeChange = (mode) => {
                setIsRunning(false);
                setTimerMode(mode);
                setTime(mode === 'stopwatch' ? 0 : parseTimeInput(inputTime));
                setIsTimerComplete(false);
            };

            // Handle time input change
            const handleTimeInputChange = (e) => {
                setInputTime(e.target.value);
            };

            // Handle theme toggle
            const toggleTheme = () => {
                setIsDarkTheme(!isDarkTheme);
            };

            // Extract domain from URL
            const extractDomain = (url) => {
                try {
                    // Add protocol if missing
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = 'https://' + url;
                    }

                    const hostname = new URL(url).hostname;
                    return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
                } catch (e) {
                    return url;
                }
            };

            // Handle adding a new distraction site
            const handleAddSite = () => {
                if (newSiteUrl.trim() !== '') {
                    const domain = extractDomain(newSiteUrl.trim());
                    // Check if domain already exists
                    if (!distractionSites.some(site => site.url === domain)) {
                        const newSite = { id: Date.now(), url: domain };
                        setDistractionSites([...distractionSites, newSite]);

                        // Send message to content script
                        window.postMessage({
                            type: 'focusHelper_addSite',
                            site: newSite
                        }, '*');
                    }
                    setNewSiteUrl('');
                }
            };

            // Handle adding current site
            const handleAddCurrentSite = () => {
                window.postMessage({
                    type: 'focusHelper_getCurrentSite'
                }, '*');
            };

            // Handle deleting a distraction site
            const handleDeleteSite = (id) => {
                setDistractionSites(distractionSites.filter(site => site.id !== id));

                // Send message to content script
                window.postMessage({
                    type: 'focusHelper_deleteSite',
                    id
                }, '*');
            };

            // Handle key press in URL input
            const handleKeyPress = (e) => {
                if (e.key === 'Enter') {
                    handleAddSite();
                }
            };

            return (
                <div className={`p-6 rounded-lg shadow-lg w-96 ${isDarkTheme ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Focus Helper</h2>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-1 rounded-full ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                        >
                            {showSettings ? (
                                // Back icon
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                // Link icon
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {showSettings ? (
                        // Settings View
                        <div>
                            <h3 className="font-medium mb-3 text-lg">Manage Distraction Sites</h3>
                            <div className="relative mb-5">
                                <input
                                    type="text"
                                    value={newSiteUrl}
                                    onChange={(e) => setNewSiteUrl(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Enter website URL"
                                    className={`w-full p-3 pr-16 rounded border ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'}`}
                                />
                                <button
                                    onClick={handleAddSite}
                                    className={`absolute right-0 top-0 h-full px-4 rounded-r ${isDarkTheme ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                                >
                                    Add
                                </button>
                            </div>

                            <button
                                onClick={handleAddCurrentSite}
                                className={`w-full mb-4 p-3 rounded border ${isDarkTheme ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-gray-100 border-gray-300 hover:bg-gray-200'} flex items-center justify-center`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                </svg>
                                Add Current Site
                            </button>

                            <div className="max-h-64 overflow-y-auto pr-1">
                                {distractionSites.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4">No sites added yet</p>
                                ) : (
                                    <ul>
                                        {distractionSites.map(site => (
                                            <li
                                                key={site.id}
                                                className={`relative p-3 mb-2 rounded group flex items-center ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-100'}`}
                                            >
                                                <span className="block truncate pr-10 flex-grow">{site.url}</span>
                                                <button
                                                    onClick={() => handleDeleteSite(site.id)}
                                                    className={`p-1.5 rounded-full ${isDarkTheme ? 'text-gray-400 hover:text-red-400 hover:bg-gray-600' : 'text-gray-500 hover:text-red-500 hover:bg-gray-200'} opacity-0 group-hover:opacity-100 transition-opacity absolute right-2`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Main View
                        <>
                            <div className="mb-5">
                                <div className="flex items-center mb-2">
                                    <div className="w-3 h-3 rounded-full mr-2 animate-pulse bg-red-500"></div>
                                    <label className="block font-medium">Current objective</label>
                                </div>
                                <input
                                    type="text"
                                    value={objective}
                                    onChange={(e) => setObjective(e.target.value)}
                                    className={`w-full p-3 rounded border ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'}`}
                                    placeholder="What are you working on?"
                                />
                            </div>

                            <div className="mb-5">
                                <div className="flex justify-between mb-3">
                                    <div className="flex space-x-3">
                                        <button
                                            onClick={() => handleModeChange('stopwatch')}
                                            className={`px-4 py-2 rounded ${timerMode === 'stopwatch' ? (isDarkTheme ? 'bg-blue-600' : 'bg-blue-500 text-white') : (isDarkTheme ? 'bg-gray-700' : 'bg-gray-200')}`}
                                        >
                                            Stopwatch
                                        </button>
                                        <button
                                            onClick={() => handleModeChange('timer')}
                                            className={`px-4 py-2 rounded ${timerMode === 'timer' ? (isDarkTheme ? 'bg-blue-600' : 'bg-blue-500 text-white') : (isDarkTheme ? 'bg-gray-700' : 'bg-gray-200')}`}
                                        >
                                            Timer
                                        </button>
                                    </div>
                                </div>

                                {timerMode === 'timer' && !isRunning && (
                                    <input
                                        type="text"
                                        value={inputTime}
                                        onChange={handleTimeInputChange}
                                        className={`w-full p-3 mb-3 rounded border ${isDarkTheme ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'}`}
                                        placeholder="25:00"
                                    />
                                )}

                                <div className={`text-4xl font-bold text-center py-6 ${isTimerComplete ? 'animate-pulse' : ''}`}>
                                    {timerMode === 'stopwatch' ? formatTime(time) : formatTime(time)}
                                </div>

                                <button
                                    onClick={handleTimerToggle}
                                    className={`w-full py-3 rounded text-lg font-medium ${isDarkTheme ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
                                >
                                    {isRunning ? 'Stop' : 'Start'}
                                </button>
                            </div>

                            <div className="flex items-center justify-between border-t pt-4 mt-4">
                                <span className="text-lg">Theme</span>
                                <button
                                    onClick={toggleTheme}
                                    className={`relative inline-flex h-7 w-14 items-center rounded-full ${isDarkTheme ? 'bg-blue-600' : 'bg-gray-300'}`}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${isDarkTheme ? 'translate-x-8' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            );
        };

        // Render the component
        ReactDOM.render(
            <FocusHelper />,
            document.getElementById('focus-helper-root')
        );
    }
})();