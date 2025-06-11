chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "createNote") {
        const noteEl = createFloatingNote(request.note);
        document.body.appendChild(noteEl);
        saveNote(request.note);
    }
});

// Load existing notes on page load
chrome.storage.local.get(['notes'], ({ notes = [] }) => {
    notes.forEach(note => {
        const noteEl = createFloatingNote(note);
        document.body.appendChild(noteEl);
    });
});

function createFloatingNote(note) {
    const noteEl = document.createElement('div');
    noteEl.className = 'floating-note';
    noteEl.style.left = `${note.x}px`;
    noteEl.style.top = `${note.y}px`;
    noteEl.dataset.noteId = note.id;

    // CORRECTED HTML (removed extra quote after note-header)
    noteEl.innerHTML = `
        <div class="note-header">
            <div class="title-wrapper">
                <input type="text" class="note-title" 
                       value="${note.title || 'New Note'}" 
                       placeholder="Note Title">
                <div class="note-date">${note.date}</div>
            </div>
            <div class="note-controls">
                <button class="btn-save" title="Save to Website">💾</button>
                <button class="btn-share" title="Share Note">📤</button>
                <button class="close-btn" title="Close Note">×</button>
            </div>
        </div>
        <div class="note-content" contenteditable="true">${note.content || ''}</div>
    `;

    // Create share menu
    const shareMenu = document.createElement('div');
    shareMenu.className = 'share-menu';
    shareMenu.innerHTML = `
        <button class="share-option" data-type="whatsapp">WhatsApp</button>
        <button class="share-option" data-type="email">Email</button>
        <button class="share-option" data-type="copy">Copy Text</button>
        <button class="share-option" data-type="download">Download</button>
    `;
    noteEl.appendChild(shareMenu);

    const titleInput = noteEl.querySelector('.note-title');
    const contentEl = noteEl.querySelector('.note-content');
    const closeBtn = noteEl.querySelector('.close-btn');
    const shareBtn = noteEl.querySelector('.btn-share');
    const saveBtn = noteEl.querySelector('.btn-save');

    // Title handler
    titleInput.addEventListener('input', () => {
        note.title = titleInput.value.trim();
        saveNote(note);
    });

    // Content handler
    contentEl.addEventListener('input', () => {
        note.content = contentEl.innerHTML;
        saveNote(note);
    });

    // Close handler
    closeBtn.addEventListener('click', () => {
        noteEl.remove();
        chrome.storage.local.get(['notes'], ({ notes = [] }) => {
            const updatedNotes = notes.filter(n => n.id !== note.id);
            chrome.storage.local.set({ notes: updatedNotes });
        });
    });

    function createNoteElement(note) {
        // ... existing code ...
        if (note.folderId === floatingNotesFolder.id) {
            const ribbon = document.createElement('div');
            ribbon.className = 'floating-note-ribbon';
            ribbon.textContent = 'From Extension';
            noteElement.appendChild(ribbon);
        }
    }

    // Share button handler
    let shareMenuVisible = false;
    shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        shareMenuVisible = !shareMenuVisible;

        // Close all other share menus
        document.querySelectorAll('.share-menu').forEach(menu => {
            if (menu !== shareMenu) menu.style.display = 'none';
        });

        // Position menu near share button
        const rect = shareBtn.getBoundingClientRect();
        shareMenu.style.left = `${rect.left}px`;
        shareMenu.style.top = `${rect.bottom + 5}px`;
        shareMenu.style.display = shareMenuVisible ? 'flex' : 'none';
    });

    // Share option handlers
    shareMenu.querySelectorAll('.share-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const shareType = e.target.dataset.type;
            const contentText = contentEl.textContent || '';
            const title = note.title || 'Note';
            const date = note.date || '';

            const shareContent = `📝 ${title}\n📅 ${date}\n\n${contentText}`;

            switch (shareType) {
                case 'whatsapp':
                    shareViaWhatsApp(shareContent);
                    break;
                case 'email':
                    shareViaEmail(title, shareContent);
                    break;
                case 'copy':
                    copyToClipboard(shareContent);
                    break;
                case 'download':
                    downloadNote(title, shareContent);
                    break;
            }

            // Hide menu after selection
            shareMenu.style.display = 'none';
            shareMenuVisible = false;
        });
    });

    saveBtn.addEventListener('click', async () => {
        const noteData = {
            id: note.id,
            title: titleInput.value.trim(),
            content: contentEl.innerText, // Use text content
            date: note.date || new Date().toLocaleString()
        };
        // Always save locally first
        saveNoteLocally(noteData);

        // Try to save to app
        chrome.runtime.sendMessage({
            action: "saveNoteToApp",
            note: noteData
        }, (response) => {
            if (response && response.success) {
                showToast('Note saved to Floating Notes folder!');
            } else {
                showToast('Note saved locally. Will sync when app opens.');
            }
        });
    });

    // New function to save locally
    function saveNoteLocally(note) {
        chrome.storage.local.get(['localNotes'], ({ localNotes = [] }) => {
            const existingIndex = localNotes.findIndex(n => n.id === note.id);
            if (existingIndex >= 0) {
                localNotes[existingIndex] = note;
            } else {
                localNotes.push(note);
            }
            chrome.storage.local.set({ localNotes });
        });
    }
    // Drag implementation - fixed version
    let isDragging = false;
    let startX, startY, initialX, initialY;

    function startDrag(e) {
        // Only respond to left mouse button
        if (e.button !== 0 || e.target.closest('.btn-share')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = parseFloat(noteEl.style.left) || 0;
        initialY = parseFloat(noteEl.style.top) || 0;

        // Add dragging class for visual feedback
        noteEl.classList.add('dragging');

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
    }

    function drag(e) {
        if (e.button !== 0 ||
            e.target.closest('button') ||
            e.target.tagName === 'INPUT') return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        noteEl.style.left = `${initialX + dx}px`;
        noteEl.style.top = `${initialY + dy}px`;
    }

    function stopDrag() {
        if (!isDragging) return;
        isDragging = false;
        noteEl.classList.remove('dragging');

        // Update note position
        note.x = parseFloat(noteEl.style.left);
        note.y = parseFloat(noteEl.style.top);
        saveNote(note);

        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        noteEl.style.left = `${initialX + dx}px`;
        noteEl.style.top = `${initialY + dy}px`;
    }

    function stopDrag() {
        if (!isDragging) return;
        isDragging = false;
        noteEl.classList.remove('dragging');

        // Update note position
        note.x = parseFloat(noteEl.style.left);
        note.y = parseFloat(noteEl.style.top);
        saveNote(note);

        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }

    const header = noteEl.querySelector('.note-header');
    if (header) {
        header.addEventListener('mousedown', startDrag);
    }

    // Close share menu when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!noteEl.contains(e.target) && shareMenuVisible) {
            shareMenu.style.display = 'none';
            shareMenuVisible = false;
        }
    });

    // Initial focus for new notes
    if (!note.title && !note.content) {
        setTimeout(() => titleInput.focus(), 50);
    }

    return noteEl;
}

// Sharing functions
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
    }).catch(err => {
        showToast('Failed to copy!');
        console.error('Copy failed:', err);
    });
}

function shareViaWhatsApp(text) {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

function shareViaEmail(subject, body) {
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement('a');
    a.href = mailto;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function downloadNote(title, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'website-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Position toast above other notes
    toast.style.zIndex = '2147483647';

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 2000);
}

function saveNote(note) {
    chrome.storage.local.get(['notes'], ({ notes = [] }) => {
        const existingIndex = notes.findIndex(n => n.id === note.id);
        if (existingIndex >= 0) {
            notes[existingIndex] = note;
        } else {
            notes.push(note);
        }
        chrome.storage.local.set({ notes });
    });
}