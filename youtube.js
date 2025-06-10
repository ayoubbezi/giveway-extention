console.log('--- YOUTUBE.JS CONTENT SCRIPT LOADED ---');

const YOUR_CHANNEL_ID = 'UChYPEOQRZyRZg1UWHFiZWRg';
const WATCH_INTERVAL_NAME = 'youtubeWatchTime';

let likeButtonObserver = null;
let commentObserver = null;

const getChannelIdFromPage = () => {
    console.log('CS2 Giveaway Ext: Attempting to get channel ID...');

    const getFromDOM = () => {
        return new Promise((resolve) => {
            console.log('CS2 Giveaway Ext: Method 1: Using DOM element transfer.');
            const dataDivId = 'cs2-giveaway-extension-data';
            const scriptId = `cs2-giveaway-script-${Date.now()}`;

            // Inject the script that will place the data in the DOM
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = chrome.runtime.getURL('injector.js');
            (document.head || document.documentElement).appendChild(script);
            script.remove(); // The script is executed once added, so we can remove it right away.

            // Poll the DOM for the data container
            let attempts = 0;
            const maxAttempts = 20; // 20 * 250ms = 5 seconds timeout
            const interval = setInterval(() => {
                const dataDiv = document.getElementById(dataDivId);
                if (dataDiv) {
                    clearInterval(interval);
                    const ytDataString = dataDiv.textContent;
                    dataDiv.remove(); // Clean up the DOM

                    if (dataDiv.hasAttribute('data-error') || !ytDataString) {
                         console.error('CS2 Giveaway Ext: DOM element indicates injector script failed.');
                         resolve(null);
                         return;
                    }

                    try {
                        const combinedData = JSON.parse(ytDataString);
                        const ytData = combinedData.ytInitialData;
                        const ytPlayerResponse = combinedData.ytInitialPlayerResponse;

                        console.log("CS2 Giveaway Ext: Received combined data from injector:", combinedData);

                        // Path 1 (Most Reliable): From ytInitialPlayerResponse, as discovered in research.
                        let channelId = ytPlayerResponse?.videoDetails?.channelId;

                        // Path 2: From ytInitialData's player overlay.
                        if (!channelId) {
                            channelId = ytData?.playerOverlays?.playerOverlayRenderer?.videoDetails?.channelId;
                        }

                        // Path 3: From ytInitialData's microformat data.
                        if (!channelId) {
                            channelId = ytData?.microformat?.playerMicroformatRenderer?.externalChannelId;
                        }

                        // Path 4: Deep search in ytInitialData's standard watch pages.
                        if (!channelId) {
                            const secondaryInfo = ytData?.contents?.twoColumnWatchNextResults?.results?.results?.contents
                                ?.find(c => c.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer;
                            channelId = secondaryInfo?.owner?.videoOwnerRenderer?.channelId;
                        }

                        if (channelId) {
                            console.log('CS2 Giveaway Ext: Method 1 SUCCESS - Extracted channel ID from DOM:', channelId);
                            resolve(channelId);
                        } else {
                            console.error('CS2 Giveaway Ext: Method 1 FAILED - Could not extract channel ID from any known location.');
                            console.groupCollapsed('CS2 Giveaway Ext: Debug Data (Click to expand)');
                            console.log('ytInitialData:', ytData);
                            console.log('ytInitialPlayerResponse:', ytPlayerResponse);
                            console.groupEnd();
                            resolve(null);
                        }
                    } catch (e) {
                        console.error('CS2 Giveaway Ext: Method 1 FAILED - Could not parse combined data from DOM element.', e);
                        resolve(null);
                    }
                } else {
                    attempts++;
                    if (attempts > maxAttempts) {
                        clearInterval(interval);
                        console.error('CS2 Giveaway Ext: Method 1 FAILED - Timed out waiting for DOM element.');
                        resolve(null);
                    }
                }
            }, 250);
        });
    };

    return new Promise(async (resolve) => {
        // We now exclusively use the DOM method, which is more reliable.
        const channelId = await getFromDOM();

        if (channelId) {
            console.log('CS2 Giveaway Ext: FINAL - Successfully determined Channel ID:', channelId);
        } else {
            // This log now correctly indicates that the primary (and only) method failed.
            console.error('CS2 Giveaway Ext: FINAL - Failed to determine Channel ID.');
        }
        resolve(channelId);
    });
};

const isOwnVideo = async () => {
  const pageChannelId = await getChannelIdFromPage();
  console.log(`CS2 Giveaway Ext: Detected Page Channel ID: ${pageChannelId}`);
  console.log(`CS2 Giveaway Ext: Your configured Channel ID: ${YOUR_CHANNEL_ID}`);
  return pageChannelId === YOUR_CHANNEL_ID;
};

const grantXp = (action) => {
  chrome.runtime.sendMessage({ action }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('CS2 Giveaway Ext: Error sending message:', chrome.runtime.lastError.message);
    } else if (response) {
      console.log(`CS2 Giveaway Ext: ${response.message}`);
    }
  });
};

const trackWatchTime = () => {
  const video = document.querySelector('video.html5-main-video');
  if (video && !video.paused) {
    grantXp('userWatchedVideo');
  }
};

const startWatchTimeTracking = () => {
  chrome.runtime.sendMessage({ action: 'createWatchAlarm' });
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'youtubeWatchTimeAlarm') {
      trackWatchTime();
    }
  });
};

const trackLikes = () => {
  const likeButton = document.querySelector('#top-level-buttons-computed > ytd-toggle-button-renderer:nth-child(1)');
  if (!likeButton) return;

  likeButtonObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && likeButton.classList.contains('style-default-active')) {
        console.log('CS2 Giveaway Ext: User liked the video.');
        grantXp('userLikedVideo');
        likeButtonObserver.disconnect();
      }
    });
  });

  likeButtonObserver.observe(likeButton, { attributes: true });
};

const trackComments = () => {
    console.log('CS2 Giveaway Ext: Setting up comment tracker using event delegation.');

    // Find the top-level comments element, which is stable.
    const commentsElement = document.querySelector('#comments');

    if (!commentsElement) {
        // If the comments section isn't loaded yet, we'll wait for it.
        const observer = new MutationObserver((mutations, obs) => {
            if (document.querySelector('#comments')) {
                console.log('CS2 Giveaway Ext: Comments section detected, initializing tracker.');
                trackComments(); // Re-run the setup
                obs.disconnect(); // We don't need this observer anymore
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return;
    }

    // Remove any old listeners to prevent duplicates.
    if (commentsElement.dataset.commentListenerAttached === 'true') {
        console.log('CS2 Giveaway Ext: Comment listener already attached.');
        return;
    }

    // Attach a 'mousedown' listener to the stable parent element. This is more reliable
    // than 'click' as it's less likely to be stopped by the page's own scripts.
    commentsElement.addEventListener('mousedown', (event) => {
        // Check if the clicked element is the comment submit button.
        const submitButton = event.target.closest('#submit-button');

        if (submitButton) {
            console.log('CS2 Giveaway Ext: Comment submitted, granting XP.');
            grantXp('userCommented');
        }
    });

    // Mark the element so we don't attach the listener again.
    commentsElement.dataset.commentListenerAttached = 'true';
    console.log('CS2 Giveaway Ext: Comment tracker is now active.');
};

const initializeTrackers = () => {
  console.log('CS2 Giveaway Ext: Your video detected. Initializing trackers.');
  startWatchTimeTracking();
  trackLikes();
  trackComments();
};

const cleanup = () => {
    console.log('CS2 Giveaway Ext: Cleaning up old trackers.');
    chrome.runtime.sendMessage({ action: 'clearWatchAlarm' });
    if(likeButtonObserver) likeButtonObserver.disconnect();
    if(commentObserver) commentObserver.disconnect();
}

const main = () => {
    console.log('CS2 Giveaway Ext: Main logic running.');
    let currentHref = document.location.href;

    // This observer handles YouTube's single-page navigation
    const navigationObserver = new MutationObserver(() => {
        if (currentHref !== document.location.href) {
            console.log(`CS2 Giveaway Ext: URL changed to ${document.location.href}`);
            currentHref = document.location.href;
            cleanup();
            setTimeout(async () => {
                if (await isOwnVideo()) {
                    initializeTrackers();
                } else {
                    console.log('CS2 Giveaway Ext: Not your video, trackers not initialized.');
                }
            }, 1500); // Wait for new page content to load
        }
    });

    navigationObserver.observe(document.body, { childList: true, subtree: true });

    // Initial check on page load
    setTimeout(async () => {
        if (await isOwnVideo()) {
            initializeTrackers();
        } else {
            console.log('CS2 Giveaway Ext: Not your video on initial load, trackers not initialized.');
        }
    }, 1500);
};

// --- Script Entry Point ---
// This observer waits for the main YouTube app element to be loaded before running the script.
const appObserver = new MutationObserver((mutations, obs) => {
    if (document.querySelector('ytd-app') || document.querySelector('ytm-app')) {
        console.log('CS2 Giveaway Ext: YouTube app element found. Running main script.');
        obs.disconnect(); // Stop observing once the app is found
        main();
    }
});

appObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
});
