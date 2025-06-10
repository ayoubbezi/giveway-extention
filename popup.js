document.addEventListener('DOMContentLoaded', () => {
  // --- Common Elements ---
  const status = document.getElementById('status');
  const tabs = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');

  // --- Home Tab Elements ---
  const tradeLinkInput = document.getElementById('tradeLink');
  const saveBtn = document.getElementById('saveBtn');
  const findLinkBtn = document.getElementById('findLinkBtn');

  // --- History Tab Elements ---
  const historyList = document.getElementById('historyList');
  const addTestEntryBtn = document.getElementById('addTestEntryBtn');

  // --- General Functions ---
  const updateStatus = (message, isError = false) => {
    status.textContent = message;
    status.style.color = isError ? '#ff6b6b' : '#66c0f4';
    setTimeout(() => {
        status.textContent = '';
    }, 3000);
  };

  // --- Tab Switching Logic ---
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = document.getElementById(tab.dataset.tab);

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      tabContents.forEach(c => c.classList.remove('active'));
      target.classList.add('active');
    });
  });

  // --- Home Tab Logic ---
  const loadTradeLink = () => {
    chrome.storage.sync.get('tradeLink', (data) => {
      if (data.tradeLink) {
        tradeLinkInput.value = data.tradeLink;
      }
    });
  };

  saveBtn.addEventListener('click', () => {
    const link = tradeLinkInput.value.trim();
    if (link.startsWith('https://steamcommunity.com/tradeoffer/')) {
      chrome.runtime.sendMessage({ action: 'saveTradeLink', link: link }, (response) => {
        if (chrome.runtime.lastError) {
          updateStatus('Error: ' + chrome.runtime.lastError.message, true);
          console.error(chrome.runtime.lastError.message);
        } else if (response.status === 'error') {
          updateStatus('Error: ' + response.message, true);
          console.error('Error from background script:', response.message);
        } else {
          updateStatus(response.message);
        }
      });
    } else {
      updateStatus('Invalid trade link.', true);
    }
  });

  findLinkBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://steamcommunity.com/my/tradeoffers/privacy' });
  });

  // --- History Tab Logic ---
  const loadHistory = () => {
    chrome.storage.sync.get({ giveawayHistory: [] }, (data) => {
      historyList.innerHTML = ''; // Clear existing list
      const reversedHistory = data.giveawayHistory.slice().reverse();
      if (reversedHistory.length === 0) {
        historyList.innerHTML = '<li>No giveaways entered yet.</li>';
        return;
      }
      reversedHistory.forEach(entry => {
        const li = document.createElement('li');
        const entryDate = new Date(entry.date).toLocaleString();
        li.innerHTML = `${entry.title}<span class="date">Entered: ${entryDate}</span>`;
        historyList.appendChild(li);
      });
    });
  };

  addTestEntryBtn.addEventListener('click', () => {
    chrome.storage.sync.get({ giveawayHistory: [] }, (data) => {
      const newHistory = data.giveawayHistory;
      const testEntry = {
        title: `Test Giveaway Entry #${newHistory.length + 1}`,
        date: new Date().toISOString(),
        videoUrl: 'https://youtube.com/example'
      };
      newHistory.push(testEntry); // Add to the end
      chrome.storage.sync.set({ giveawayHistory: newHistory }, () => {
        updateStatus('Test entry added!');
        loadHistory(); // Refresh the list
      });
    });
  });

  // --- XP and Leveling Logic ---
  const xpContainer = document.querySelector('.xp-container');
  const levelText = xpContainer.querySelector('.level-text');
  const xpBar = xpContainer.querySelector('.xp-bar');
  const xpText = xpContainer.querySelector('.xp-text');

  const calculateLevel = (xp) => {
    const baseXP = 100;
    const factor = 1.5;
    let level = 1;
    let requiredXP = baseXP;
    while (xp >= requiredXP) {
      xp -= requiredXP;
      level++;
      requiredXP = Math.floor(requiredXP * factor);
    }
    return { level, xp, requiredXP };
  };

  const updateXpDisplay = () => {
    chrome.storage.sync.get({ userXP: 0 }, (data) => {
      const { level, xp, requiredXP } = calculateLevel(data.userXP);
      const progress = (xp / requiredXP) * 100;

      levelText.textContent = `Level ${level}`;
      xpText.textContent = `${xp} / ${requiredXP} XP`;
      xpBar.style.width = `${progress}%`;
    });
  };

  // --- Initialization ---
  loadTradeLink();
  loadHistory();
  updateXpDisplay();

  // --- Storage Change Listener ---
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'sync') return;

    if (changes.tradeLink) {
      tradeLinkInput.value = changes.tradeLink.newValue;
      updateStatus('Trade link automatically updated!');
    }

    if (changes.giveawayHistory) {
      loadHistory(); // Refresh history if it changes
    }
  });
});
