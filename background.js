

// background.js - Cleaned and Corrected

// --- Script Loading ---
try {
    console.log('BG: Loading Firebase scripts...');
    importScripts(
        './firebase-app-compat.js',
        './firebase-firestore-compat.js',
        './firebase-config.js'
    );
    console.log('BG: Firebase scripts loaded successfully.');
} catch (e) {
    console.error('BG: CRITICAL - Script import failed:', e);
}

// --- Global State ---
let firestoreDB;

// --- XP Configuration ---
const XP_CONFIG = {
    WATCH_INTERVAL_SECONDS: 30,
    XP_PER_WATCH_INTERVAL: 2,
    XP_FOR_LIKE: 15,
    XP_FOR_COMMENT: 20,
};

// --- Core Functions ---
const getUserId = async () => {
    let { userId } = await chrome.storage.local.get('userId');
    if (!userId) {
        userId = crypto.randomUUID();
        await chrome.storage.local.set({ userId });
    }
    return userId;
};

const syncUserData = async (dataToSync) => {
    if (!firestoreDB) {
        console.error('Firestore not initialized. Cannot sync data.');
        return;
    }
    const userId = await getUserId();
    const userRef = firestoreDB.collection('users').doc(userId);
    try {
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            dataToSync.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        await userRef.set(dataToSync, { merge: true });
        console.log('User data synced to Firestore:', dataToSync);
    } catch (error) {
        console.error('Error syncing data to Firestore:', error);
    }
};

const grantXp = async (amount) => {
    let { userXP = 0 } = await chrome.storage.sync.get('userXP');
    const newXP = userXP + amount;
    await chrome.storage.sync.set({ userXP: newXP });
    await syncUserData({ xp: newXP });
    console.log(`Granted ${amount} XP. New total: ${newXP}`);
};

// --- Event Handlers ---
const onInstalledHandler = async (details) => {
    if (details.reason === 'install') {
        const userId = await getUserId();
        const initialData = { userXP: 0, giveawayHistory: [], tradeLink: '' };
        await chrome.storage.sync.set(initialData);
        await syncUserData({ xp: 0, tradeLink: '' });
        console.log(`New user initialized with ID: ${userId}`);
    }
};

const onMessageHandler = (message, sender, sendResponse) => {
    (async () => {
        try {
            switch (message.action) {
                case 'saveTradeLink':
                    await chrome.storage.sync.set({ tradeLink: message.link });
                    await syncUserData({ tradeLink: message.link });
                    sendResponse({ status: 'success', message: 'Trade link saved!' });
                    break;
                case 'userLikedVideo':
                    await grantXp(XP_CONFIG.XP_FOR_LIKE);
                    sendResponse({ status: 'success', message: 'XP for like granted.' });
                    break;
                case 'userCommented':
                    await grantXp(XP_CONFIG.XP_FOR_COMMENT);
                    sendResponse({ status: 'success', message: 'XP for comment granted.' });
                    break;
                case 'userWatchedVideo':
                    await grantXp(XP_CONFIG.XP_PER_WATCH_INTERVAL);
                    sendResponse({ status: 'success', message: 'XP for watch time granted.' });
                    break;
                case 'createWatchAlarm':
                    chrome.alarms.create('youtubeWatchTime', { periodInMinutes: XP_CONFIG.WATCH_INTERVAL_SECONDS / 60 });
                    sendResponse({ status: 'success', message: 'Watch time alarm created.' });
                    break;
                case 'clearWatchAlarm':
                    chrome.alarms.clear('youtubeWatchTime');
                    sendResponse({ status: 'success', message: 'Watch time alarm cleared.' });
                    break;
                default:
                    sendResponse({ status: 'error', message: 'Unknown action' });
                    break;
            }
        } catch (error) {
            console.error(`Error processing action ${message.action}:`, error);
            sendResponse({ status: 'error', message: `Failed to process action. ${error.message}` });
        }
    })();
    return true; // Keep channel open for async response
};

const onAlarmHandler = (alarm) => {
    if (alarm.name === 'youtubeWatchTime') {
        chrome.tabs.query({ active: true, url: '*://www.youtube.com/watch*' }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'youtubeWatchTimeAlarm' });
            }
        });
    }
};

// --- Initialization ---
// This IIFE ensures Firebase is ready before we attach any listeners.
(async () => {
    try {
        console.log('BG: Initializing Firebase...');
        firebase.initializeApp(firebaseConfig);
        firestoreDB = firebase.firestore();
        console.log('BG: Firebase initialized successfully.');

        // Attach listeners only after services are ready.
        chrome.runtime.onInstalled.addListener(onInstalledHandler);
        chrome.runtime.onMessage.addListener(onMessageHandler);
        chrome.alarms.onAlarm.addListener(onAlarmHandler);

        console.log('BG: Service worker started and listeners are active.');
    } catch (error) {
        console.error('BG: CRITICAL - Initialization failed:', error);
    }
})();
