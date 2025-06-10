// This script runs on https://steamcommunity.com/my/tradeoffers/privacy

const tradeLinkInput = document.querySelector('#trade_offer_access_url');

if (tradeLinkInput && tradeLinkInput.value) {
    const tradeLink = tradeLinkInput.value;
    chrome.storage.sync.get('tradeLink', (data) => {
        // Save to storage only if it's different from the currently saved link
        if (data.tradeLink !== tradeLink) {
            chrome.storage.sync.set({ tradeLink: tradeLink }, () => {
                console.log('CS2 Giveaway Extension: Trade link saved.');
            });
        }
    });
}
