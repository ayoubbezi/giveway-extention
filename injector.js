// Wrapped in an IIFE to prevent redeclaration errors on SPA navigation.
(function() {
    // This script is injected into the main page to access YouTube's page data.
    // It polls for the data objects and injects them into a hidden DOM element for the content script.

    const injectData = (data) => {
        const oldDiv = document.getElementById('cs2-giveaway-extension-data');
        if (oldDiv) oldDiv.remove();

        const dataDiv = document.createElement('div');
        dataDiv.id = 'cs2-giveaway-extension-data';
        dataDiv.style.display = 'none';
        try {
            dataDiv.textContent = JSON.stringify(data);
        } catch (e) {
            dataDiv.textContent = JSON.stringify({ error: `Injector script failed during stringify: ${e.toString()}` });
        }
        document.body.appendChild(dataDiv);
    };

    let attempts = 0;
    const maxAttempts = 20; // 20 * 250ms = 5 seconds timeout
    const interval = setInterval(() => {
        attempts++;

        // Wait until at least one of the data objects is available.
        if (window.ytInitialData || window.ytInitialPlayerResponse) {
            clearInterval(interval);
            // Package both objects to give the content script all possible data sources.
            const combinedData = {
                ytInitialData: window.ytInitialData || null,
                ytInitialPlayerResponse: window.ytInitialPlayerResponse || null,
            };
            injectData(combinedData);
        } else if (attempts >= maxAttempts) {
            // If neither object is found after the timeout, report an error.
            clearInterval(interval);
            console.error('CS2 Giveaway Ext: Injector timed out waiting for page data.');
            injectData({ error: 'Timed out waiting for YouTube page data.' });
        }
    }, 250);
})();
