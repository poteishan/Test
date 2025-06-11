const APP_DOMAIN = "https://capstone-sigma-eight.vercel.app/";
let appTabId = null;
let pendingNotes = [];

// Load pending notes on startup
chrome.storage.local.get(['pendingNotes'], (result) => {
  pendingNotes = result.pendingNotes || [];
});

// Track when website is opened
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes(APP_DOMAIN)) {
    if (changeInfo.status === 'complete') {
      appTabId = tabId;
      // Send pending notes to the app
      sendPendingNotes();
    }
  }
});

function sendPendingNotes() {
  if (pendingNotes.length > 0 && appTabId) {
    pendingNotes.forEach(note => {
      chrome.tabs.sendMessage(appTabId, {
        source: 'sticky-notes-extension',
        action: "SAVE_NOTE",
        note: note
      });
    });
  }
}

// Clear reference when website is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === appTabId) {
    appTabId = null;
  }
});

// Handle communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveNoteToApp") {
    if (appTabId) {
      chrome.tabs.sendMessage(appTabId, {
        source: 'sticky-notes-extension',
        action: "SAVE_NOTE",
        note: request.note
      }, (response) => {
        if (response && response.success) {
          sendResponse({ success: true });
        } else {
          saveAsPending(request.note);
          sendResponse({ success: false });
        }
      });
      return true; // Keep message channel open
    } else {
      saveAsPending(request.note);
      sendResponse({ success: false });
      return true;
    }
  }
  return true;
});

function saveAsPending(note) {
  // Remove if already exists
  pendingNotes = pendingNotes.filter(n => n.id !== note.id);
  pendingNotes.push(note);
  chrome.storage.local.set({ pendingNotes });
}