const FLOATING_NOTES_FOLDER_NAME = "Floating Notes";
const MAIN_FOLDER_NAME = "Main";

// let data = [
//     {
//         id: 'folder-1', name: 'My First Folder', notes: [
//             {
//                 id: 'note-1',
//                 title: 'Shopping List',
//                 content: '',
//                 color: '#fffb82',
//                 created: new Date().toISOString(),
//                 liked: false,
//                 todos: [
//                     { text: 'Buy milk', done: false },
//                     { text: 'Get eggs', done: true }
//                 ],
//                 timer: null,
//                 bulletPoints: ['Remember to check expiry dates', 'Buy organic if possible'],
//                 featuresCollapsed: false,
//             },
//             {
//                 id: 'note-2',
//                 title: 'Work Tasks',
//                 content: 'Finish report by Friday\nPrepare presentation slides',
//                 color: '#ffd3b6',
//                 created: new Date(new Date().getTime() - 2 * 3600000).toISOString(),
//                 liked: true,
//                 todos: [],
//                 timer: { seconds: 1800, running: false, interval: null },
//                 bulletPoints: [],
//                 featuresCollapsed: false,
//             },
//         ]
//     },
// ];

function loadPendingNotes() {
    // Request pending notes from background
    chrome.runtime.sendMessage({ action: "getPendingNotes" }, (response) => {
        if (response.pendingNotes) {
            response.pendingNotes.forEach(note => {
                saveExtensionNote(note);
            });
            // Clear pending after loading
            chrome.runtime.sendMessage({ action: "clearPendingNotes" });
        }
    });
}


function getFloatingNotesFolder() {
    let folder = data.find(f => f.name === FLOATING_NOTES_FOLDER_NAME);
    if (!folder) {
        folder = {
            id: 'folder-floating', // Fixed ID for consistency
            name: FLOATING_NOTES_FOLDER_NAME,
            notes: [],
            isExtensionFolder: true
        };
        data.push(folder);
        saveData();
        renderFolders();
    }
    return folder;
}
// Update the top event listener
window.addEventListener('message', (event) => {
    if (event.data.source === 'sticky-notes-extension' &&
        event.data.action === 'SAVE_NOTE') {

        if (event.data.source === 'sticky-notes-extension' &&
            event.data.action === 'SAVE_NOTE') {
            const success = saveExtensionNote(event.data.note);
            event.source.postMessage({ success }, event.origin);
        }

        const noteData = event.data.note;
        const folder = ensureFloatingNotesFolder();

        // Create/update note
        let existingNote = folder.notes.find(n => n.id === noteData.id);
        if (!existingNote) {
            existingNote = {
                id: noteData.id,
                title: noteData.title || 'Floating Note',
                content: noteData.content || '',
                color: '#fff9c4',
                created: new Date().toISOString(),
                isExtensionNote: true
            };
            folder.notes.push(existingNote);
        } else {
            // Update existing note
            existingNote.title = noteData.title || existingNote.title;
            existingNote.content = noteData.content || existingNote.content;
        }

        saveData();

        // Update UI
        selectedFolderId = folder.id;
        renderFolders();
        renderNotes();

        showToast(`Saved floating note to "${folder.name}" folder!`);
    }
});

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 2000);
}

// Currently selected folder id
let selectedFolderId = null;

// Generate unique id for new folders and notes
function generateId(prefix = 'id') {
    return prefix + '-' + Math.random().toString(36).substr(2, 9);
}

// Format datetime nicely
function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleString(undefined, options);
}

// Save and Load data from localStorage for persistence
function saveData() {
    try {
        localStorage.setItem('stickyNotesData', JSON.stringify(data));
    } catch { }
}
function loadData() {
    try {
        const stored = localStorage.getItem('stickyNotesData');
        if (stored) {
            data = JSON.parse(stored);
        }
    } catch { }
}

// DOM Elements cache
const folderListDiv = document.getElementById('folder-list');
const folderTitleEl = document.getElementById('folder-title');
const notesContainer = document.getElementById('notes-container');
const addNoteBtn = document.getElementById('add-note-btn');
const newFolderBtn = document.getElementById('new-folder-btn');
const searchInput = document.getElementById('search-input');

// Render folders list
function renderFolders() {
    // Always render the folder list
    folderListDiv.innerHTML = '';

    data.forEach(folder => {
        const div = document.createElement('div');
        let className = 'folder-item';
        if (folder.id === selectedFolderId) className += ' active';
        if (folder.isExtensionFolder) className += ' floating-notes';
        div.className = className;

        const folderNameSpan = document.createElement('span');
        folderNameSpan.className = 'folder-name';
        folderNameSpan.textContent = folder.name;
        folderNameSpan.tabIndex = 0;
        folderNameSpan.setAttribute('role', 'listitem');
        folderNameSpan.setAttribute('aria-selected', folder.id === selectedFolderId ? 'true' : 'false');

        div.onclick = () => {
            selectedFolderId = folder.id;
            renderFolders();  // Update folder highlighting
            renderNotes();    // Render notes for selected folder
        };

        folderNameSpan.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                div.click();
            }
        };

        div.appendChild(folderNameSpan);

        // Delete button for folder
        const canDelete = data.length > 1;
        const delBtn = document.createElement('button');
        delBtn.className = 'folder-delete-btn';
        delBtn.title = 'Delete folder';
        delBtn.setAttribute('aria-label', 'Delete folder ' + folder.name);
        delBtn.disabled = !canDelete;
        delBtn.textContent = '×';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete the folder "${folder.name}" and all its notes?`)) {
                data = data.filter(f => f.id !== folder.id);
                if (selectedFolderId === folder.id) {
                    selectedFolderId = data.length ? data[0].id : null;
                }
                renderFolders();
                renderNotes();
                saveData();
            }
        };

        div.appendChild(delBtn);
        folderListDiv.appendChild(div);
    });
}

// Render notes for selected folder
function renderNotes() {
    if (!selectedFolderId) {
        folderTitleEl.textContent = 'Select a folder';
        notesContainer.innerHTML = '';
        addNoteBtn.disabled = true;
        return;
    }

    const folder = data.find(f => f.id === selectedFolderId);

    // Handle Main folder view
    if (folder.isMainFolder) {
        folderTitleEl.textContent = folder.name;
        addNoteBtn.disabled = true;

        // Collect all notes from all non-Main folders
        let allNotes = [];
        data.forEach(f => {
            if (!f.isMainFolder && f.notes) {
                allNotes = allNotes.concat(f.notes);
            }
        });

        // Filter notes based on search query
        const query = searchInput.value.toLowerCase();
        const filteredNotes = allNotes.filter(note => {
            return note.title.toLowerCase().includes(query) ||
                note.content.toLowerCase().includes(query);
        });

        notesContainer.innerHTML = '';

        if (filteredNotes.length === 0) {
            const noNoteMsg = document.createElement('p');
            noNoteMsg.textContent = 'No notes found';
            noNoteMsg.style.color = '#555';
            notesContainer.appendChild(noNoteMsg);
            return;
        }

        filteredNotes.forEach(note => {
            // Find which folder this note belongs to
            const parentFolder = data.find(f =>
                f.notes && f.notes.some(n => n.id === note.id)
            );
            notesContainer.appendChild(createNoteElement(note, parentFolder));
        });
        return;
    }

    // Handle regular folder view
    folderTitleEl.textContent = folder.name;
    addNoteBtn.disabled = false;

    // Filter notes based on search query
    const query = searchInput.value.toLowerCase();

    if (!folder.notes) folder.notes = [];

    const filteredNotes = folder.notes.filter(note => {
        return note.title.toLowerCase().includes(query) ||
            note.content.toLowerCase().includes(query) ||
            (note.bulletPoints && note.bulletPoints.some(bp => bp.toLowerCase().includes(query))) ||
            (note.todos && note.todos.some(todo => todo.text.toLowerCase().includes(query)));
    });

    notesContainer.innerHTML = '';

    if (filteredNotes.length === 0) {
        const noNoteMsg = document.createElement('p');
        noNoteMsg.textContent = 'No notes found';
        noNoteMsg.style.color = '#555';
        notesContainer.appendChild(noNoteMsg);
        return;
    }

    filteredNotes.forEach(note => {
        notesContainer.appendChild(createNoteElement(note, folder));
    });
}

// Create sticky note element
function createNoteElement(note, folder) {

    const noteEl = document.createElement('article');
    noteEl.className = 'sticky-note';
    noteEl.style.backgroundColor = note.color;
    noteEl.setAttribute('aria-label', `Note titled ${note.title}`);

    if (note.isExtensionNote) {
        noteEl.classList.add('floating-note-saved');
        const ribbon = document.createElement('div');
        ribbon.className = 'floating-note-ribbon';
        ribbon.textContent = 'From Extension';
        noteEl.appendChild(ribbon);
    }

    // Delete button for note top right corner
    const noteDelBtn = document.createElement('button');
    noteDelBtn.className = 'note-delete-btn';
    noteDelBtn.title = 'Delete note';
    noteDelBtn.setAttribute('aria-label', `Delete note titled ${note.title}`);
    noteDelBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete the note "${note.title}"?`)) {
            // Remove note from folder.notes
            folder.notes = folder.notes.filter(n => n.id !== note.id);
            renderNotes();
            saveData();
        }
    };


    // Note header
    const header = document.createElement('div');
    header.className = 'note-header';

    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'note-title';
    titleEl.textContent = note.title;
    titleEl.tabIndex = 0;
    titleEl.setAttribute('role', 'textbox');
    titleEl.setAttribute('aria-multiline', 'false');
    titleEl.setAttribute('aria-label', 'Note title, click to edit');
    titleEl.onclick = () => enableEditTitle(titleEl, note, folder);
    titleEl.onkeydown = e => {
        if (e.key === "Enter") {
            e.preventDefault();
            titleEl.blur();
        }
    };

    // Date created
    const createdEl = document.createElement('div');
    createdEl.className = 'note-created';
    createdEl.textContent = formatDateTime(note.created);

    // Like button
    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-btn';
    likeBtn.innerHTML = note.liked ? '❤️' : '🤍';
    likeBtn.title = note.liked ? 'Unlike note' : 'Like note';
    likeBtn.setAttribute('aria-pressed', note.liked);
    likeBtn.onclick = () => {
        note.liked = !note.liked;
        likeBtn.innerHTML = note.liked ? '❤️' : '🤍';
        likeBtn.setAttribute('aria-pressed', note.liked);
        likeBtn.title = note.liked ? 'Unlike note' : 'Like note';
        saveData();
    };

    // Color picker
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'color-picker';
    colorInput.title = 'Change note color';
    colorInput.value = rgbToHex(note.color);
    colorInput.oninput = (e) => {
        note.color = e.target.value;
        noteEl.style.backgroundColor = note.color;
        saveData();
    };
    // noteEl.appendChild(colorInput)

    header.appendChild(titleEl);
    header.appendChild(createdEl);
    header.appendChild(likeBtn);
    noteEl.appendChild(header);

    // Content area (editable)
    const contentEl = document.createElement('div');
    contentEl.className = 'note-content';
    const contentParts = [
        note.content,
        ...note.todos.map(t => `☐ ${t.text}`),
        ...note.bulletPoints.map(b => `• ${b}`)
    ];
    contentEl.textContent = contentParts.join('\n');
    contentEl.tabIndex = 0;
    contentEl.setAttribute('role', 'textbox');
    contentEl.setAttribute('aria-multiline', 'true');
    contentEl.setAttribute('aria-label', 'Note content, click to edit');
    contentEl.onclick = () => enableEditContent(contentEl, note, folder);
    contentEl.oninput = () => {
        note.content = contentEl.textContent;
        saveData();
    };
    contentEl.onkeydown = (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertText', false, '  ');
        }
    };

    noteEl.appendChild(contentEl);

    // Add this code in app.txt (near other utility functions)
    // Replace existing shareNote and noteToText functions with:
    function shareNote(note) {
        const formattedText = noteToText(note);

        if (navigator.share) {
            navigator.share({
                title: `Note: ${note.title}`,
                text: formattedText
            }).catch(error => {
                console.log('Sharing failed:', error);
                copyToClipboardFallback(formattedText);
            });
        } else {
            copyToClipboardFallback(formattedText);
        }
    }

    function noteToText(note) {
        const sections = [];

        // Header
        sections.push(`📝 ${note.title}`);
        sections.push('━'.repeat(note.title.length + 2));

        // Main Content
        if (note.content) sections.push(`\n${note.content}\n`);

        // Todos
        if (note.todos.length > 0) {
            sections.push('\n✅ To-Dos:');
            note.todos.forEach(todo => {
                sections.push(`▢ ${todo.done ? '✓' : ' '} ${todo.text}`);
            });
        }

        // Bullet Points
        if (note.bulletPoints.length > 0) {
            sections.push('\n🔹 Key Points:');
            sections.push(...note.bulletPoints.map(bp => `• ${bp}`));
        }

        // Metadata
        sections.push('\n―――――――――――――――――――');
        sections.push(`🕒 Created: ${formatDateTime(note.created)}`);

        return sections.join('\n');
    }

    function copyToClipboardFallback(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Note copied to clipboard!');
        }).catch(() => {
            alert('Could not copy text. Please manually select and copy.');
        });
    }

    // Add this utility function
    function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = '#80cbc4';
        toast.style.color = '#263238';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '25px';
        toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 2000);
    }

    // Editing functions
    function enableEditTitle(titleElement, note, folder) {
        titleElement.contentEditable = 'true';
        titleElement.focus();
        noteEl.classList.add('editing');

        const onBlur = () => {
            titleElement.contentEditable = 'false';
            const newTitle = titleElement.textContent.trim() || 'Untitled Note';
            titleElement.textContent = newTitle;
            note.title = newTitle;
            noteEl.classList.remove('editing');
            saveData();
            titleElement.removeEventListener('blur', onBlur);
        };
        titleElement.addEventListener('blur', onBlur);
    }
    function enableEditContent(contentElement, note, folder) {
        contentElement.contentEditable = 'true';
        contentElement.focus();
        noteEl.classList.add('editing');

        const onBlur = () => {
            contentElement.contentEditable = 'false';
            note.content = contentElement.textContent;
            noteEl.classList.remove('editing');
            saveData();
            contentElement.removeEventListener('blur', onBlur);
        };
        contentElement.addEventListener('blur', onBlur);
    }

    // Add dropdown menu
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'note-dropdown';

    const dropBtn = document.createElement('button');
    dropBtn.className = 'note-dropbtn';
    dropBtn.innerHTML = '⋮';
    dropBtn.setAttribute('aria-label', 'Note options');

    const dropdownContent = document.createElement('div');
    dropdownContent.className = 'note-dropdown-content';

    // Dropdown items
    const menuItems = [
        {
            text: 'Expand',
            action: () => showExpandedNote(note)
        },
        { text: 'Share', action: () => shareNote(note) }, // Add this line
        { text: 'Change color', action: () => colorInput.click() },
        { text: 'Delete', action: () => noteDelBtn.click() },
    ];

    menuItems.forEach(item => {
        const button = document.createElement('button');
        button.textContent = item.text;
        button.onclick = (e) => {
            e.stopPropagation();
            item.action();
            dropdownContent.classList.remove('show');
        };
        dropdownContent.appendChild(button);
    });

    // Toggle dropdown
    dropBtn.onclick = (e) => {
        e.stopPropagation();
        dropdownContent.classList.toggle('show');
    };

    dropdownContainer.appendChild(dropBtn);
    dropdownContainer.appendChild(dropdownContent);
    header.appendChild(dropdownContainer);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdownContainer.contains(e.target)) {
            dropdownContent.classList.remove('show');
        }
    });

    return noteEl;
}

// In new note creation:
// Update new note creation
const newNote = {
    id: generateId('note'),
    title: 'Untitled Note',
    content: '',
    color: '#fffb82',
    created: new Date().toISOString(),
    liked: false,
    todos: [],
    timer: null,
    bulletPoints: [],
    featuresCollapsed: false,
    float: false,          // Add this
    floatPosition: null    // Add this
};


// Convert RGB color to hex color string if needed
function rgbToHex(color) {
    if (color.startsWith('#')) return color;
    const rgb = color.match(/\d+/g);
    if (!rgb) return '#fffb82';
    return '#' + rgb.slice(0, 3).map(x => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Update the click handler

// Add new folder
newFolderBtn.onclick = () => {
    const folderName = prompt('Enter new folder name:');
    if (folderName && folderName.trim()) {
        const newFolder = { id: generateId('folder'), name: folderName.trim(), notes: [] };
        data.push(newFolder);
        selectedFolderId = newFolder.id;
        renderFolders();
        renderNotes();
        saveData();
    }
};

// Add new note in selected folder
addNoteBtn.onclick = () => {
    if (!selectedFolderId) return;
    const folder = data.find(f => f.id === selectedFolderId);
    const newNote = {
        id: generateId('note'),
        title: 'Untitled Note',
        content: '',
        color: '#fffb82',
        created: new Date().toISOString(),
        liked: false,
        todos: [],
        timer: null,
        bulletPoints: [],
        featuresCollapsed: false,
    };
    folder.notes.push(newNote);
    renderNotes();
    saveData();
};


// Remove any duplicate showExpandedNote functions
// Keep only ONE version:
function showExpandedNote(note, folder) {
    const overlay = document.createElement('div');
    overlay.className = 'expanded-overlay';

    const tempNote = JSON.parse(JSON.stringify(note));

    const content = document.createElement('div');
    content.className = 'expanded-content';
    content.innerHTML = `
        <div class="expanded-header">
            <textarea class="editable-title" placeholder="Note title" style="height:20px">${tempNote.title}</textarea>
            <button class="close-btn">&times;</button>
        </div>
        <div class="expanded-body">
            <textarea class="auto-expand-content" placeholder="Start typing...">${formatContentForEditing(tempNote)}</textarea>
        </div>
        <div class="formatting-tools">
            <button class="format-btn bullet" title="Add bullet point">•</button>
            <button class="format-btn todo" title="Add todo item">☑</button>
            <button class="format-btn bold" title="Bold text"><strong>B</strong></button>
        </div>
    `;

    const titleInput = content.querySelector('.editable-title');
    const contentInput = content.querySelector('.auto-expand-content');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-btn';
    saveBtn.textContent = 'Save Changes';

    // Auto-expanding textareas
    function autoExpand(field) {
        field.style.height = 'auto';
        field.style.height = field.scrollHeight + 'px';
    }

    [titleInput, contentInput].forEach(input => {
        input.addEventListener('input', () => autoExpand(input));
        autoExpand(input);
    });

    // Formatting handlers
    content.querySelector('.bullet').onclick = () => {
        insertAtCursor(contentInput, '\n- ');
    };
    content.querySelector('.todo').onclick = () => {
        insertAtCursor(contentInput, '\n☐ ');
    };
    content.querySelector('.bold').onclick = () => {
        wrapSelection(contentInput, '**', '**');
    };

    // Save handler
    saveBtn.onclick = () => {
        note.title = titleInput.value.trim();
        note.content = contentInput.value;
        note.bulletPoints = parseBulletPoints(contentInput.value);
        note.todos = parseTodos(contentInput.value);

        saveData();
        renderNotes();
        overlay.remove();
    };

    // Close handlers
    content.querySelector('.close-btn').onclick = () => overlay.remove();
    overlay.onclick = (e) => {
        if (e.target === overlay && confirm('Discard changes?')) overlay.remove();
    };

    content.appendChild(saveBtn);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

function handlePendingNotes() {
  // This will be called automatically when notes arrive
  // No need to load via chrome.runtime
}

function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + text +
        textarea.value.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
}

function wrapSelection(textarea, prefix, suffix) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    textarea.value = textarea.value.substring(0, start) +
        prefix + selected + suffix +
        textarea.value.substring(end);
    textarea.focus();
    textarea.selectionStart = start + prefix.length;
    textarea.selectionEnd = end + prefix.length;
}

function parseContent(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    return Array.from(tempDiv.querySelectorAll('h3, p, li'))
        .map(el => {
            if (el.tagName === 'H3') return `## ${el.textContent}`;
            if (el.tagName === 'LI') {
                if (el.textContent.startsWith('☐ ')) return `- [ ] ${el.textContent.slice(2)}`;
                return `- ${el.textContent}`;
            }
            return el.textContent;
        })
        .join('\n');
}

// Update parseBulletPoints function:
function parseBulletPoints(content) {
    return content.split('\n')
        .filter(line => line.match(/^[-•*]\s/))
        .map(line => line.replace(/^[-•*]\s/, '').trim());
}

function parseTodos(content) {
    return content.split('\n')
        .filter(line => line.startsWith('- [ ]'))
        .map(line => ({
            text: line.replace('- [ ] ', '').trim(),
            done: false
        }));
}

function formatContentForEditing(note) {
    return [
        ...note.content.split('\n'),
        ...note.todos.map(t => `- [ ] ${t.text}`),
        ...note.bulletPoints.map(b => `- ${b}`)
    ].join('\n');
}

function addFormattingHandlers(container, contentEl) {
    container.querySelector('.bullet').onclick = () => {
        insertAtCursor('\n- ', contentEl);
    };

    container.querySelector('.todo').onclick = () => {
        insertAtCursor('\n☐ ', contentEl);
    };

    container.querySelector('.bold').onclick = () => {
        wrapSelection('**', '**', contentEl);
    };
}


function formatEditableContent(note) {
    return `
        <div class="content-section">
            ${note.content.split('\n').map(line => {
        if (line.startsWith('## '))
            return `<h3 contenteditable="true">${line.replace('## ', '')}</h3>`;
        if (line.startsWith('- [ ] '))
            return `<li class="todo-item" contenteditable="false">
                              <input type="checkbox"> ${line.replace('- [ ] ', '')}
                            </li>`;
        if (line.startsWith('- '))
            return `<li contenteditable="true">${line.replace('- ', '')}</li>`;
        return `<p contenteditable="true">${line}</p>`;
    }).join('')}
        </div>
        ${note.bulletPoints.length ? `
        <div class="bullet-section">
            <h4>Key Points</h4>
            <ul>${note.bulletPoints.map(bp => `
                <li contenteditable="true">${bp}</li>
            `).join('')}</ul>
        </div>` : ''}
    `;
}
function handleTitleChange(note, titleEl) {
    note.title = titleEl.textContent.trim();
    // Update sticky note title in real-time
    const stickyNote = document.querySelector(`[aria-label="Note titled ${note.title}"]`);
    if (stickyNote) {
        stickyNote.querySelector('.note-title').textContent = note.title;
    }
}

function handleContentChange(note, event) {
    const target = event.target;
    if (target.matches('h3')) {
        // Update headers
        const lineIndex = Array.from(target.parentNode.children).indexOf(target);
        note.content = note.content.split('\n').map((line, idx) =>
            idx === lineIndex ? `## ${target.textContent}` : line
        ).join('\n');
    } else if (target.matches('li')) {
        // Update bullet points
        const list = target.closest('ul');
        const index = Array.from(list.children).indexOf(target);
        if (list.closest('.bullet-section')) {
            note.bulletPoints[index] = target.textContent;
        } else {
            note.content = note.content.split('\n').map((line, idx) =>
                line.startsWith('- ') && idx === index ? `- ${target.textContent}` : line
            ).join('\n');
        }
    } else {
        // Update regular paragraphs
        const lineIndex = Array.from(target.parentNode.children).indexOf(target);
        note.content = note.content.split('\n').map((line, idx) =>
            idx === lineIndex ? target.textContent : line
        ).join('\n');
    }

    // Update sticky note content in real-time
    const stickyNote = document.querySelector(`[aria-label="Note titled ${note.title}"]`);
    if (stickyNote) {
        stickyNote.querySelector('.note-content').textContent = note.content;
    }
}

function wrapSelection(prefix, suffix, element) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const text = range.extractContents();
    const span = document.createElement('span');
    span.textContent = `${prefix}${text.textContent}${suffix}`;
    range.insertNode(span);
}

function formatNoteContent(note) {
    return `
        <div class="note-section">
            ${note.content.split('\n').map(line => {
        if (line.startsWith('## ')) return `<h3>${line.replace('## ', '')}</h3>`;
        if (line.startsWith('- ')) return `<ul><li>${line.replace('- ', '')}</li></ul>`;
        return `<p>${line}</p>`;
    }).join('')}
        </div>
        ${note.bulletPoints.length ? `
        <div class="bullet-section">
            <h4>Key Points</h4>
            <ul>${note.bulletPoints.map(bp => `<li>${bp}</li>`).join('')}</ul>
        </div>` : ''}
    `;
}

function ensureMainFolder() {
    const folderName = MAIN_FOLDER_NAME;
    let folder = data.find(f => f.name === folderName);
    if (!folder) {
        folder = {
            id: 'folder-main', // Fixed ID to prevent deletion
            name: folderName,
            notes: [],
            isMainFolder: true
        };
        data.unshift(folder); // Add at the beginning
        saveData();
    }
    return folder;
}

function createSaveButton(onSave) {
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Changes';
    saveBtn.className = 'save-btn';
    saveBtn.onclick = onSave;
    return saveBtn;
}
// Search functionality (filter notes)
searchInput.oninput = () => {
    renderNotes();
};

function duplicateNote(note, folder) {
    const newNote = JSON.parse(JSON.stringify(note));
    newNote.id = generateId('note');
    newNote.created = new Date().toISOString();
    folder.notes.push(newNote);
    renderNotes();
    saveData();
}

function toggleLike(note) {
    note.liked = !note.liked;
    renderNotes();
    saveData();
}

// Initialize app - load data if saved
function init() {
    loadData();
    ensureFloatingNotesFolder();
    ensureMainFolder();
    if (data.length > 0) {
        selectedFolderId = data[0].id;
    }
    renderFolders();  // Render folder list
    renderNotes();    // Render notes for selected folder
}


// Handle messages from extension
window.addEventListener('message', (event) => {
  if (event.data.source === 'sticky-notes-extension' && 
      event.data.action === 'SAVE_NOTE') {
    
    const noteData = event.data.note;
    const folder = ensureFloatingNotesFolder();
    
    // Create/update note
    const existingIndex = folder.notes.findIndex(n => n.id === noteData.id);
    if (existingIndex >= 0) {
      folder.notes[existingIndex] = {
        ...folder.notes[existingIndex],
        title: noteData.title,
        content: noteData.content
      };
    } else {
      folder.notes.push({
        id: noteData.id,
        title: noteData.title || 'Floating Note',
        content: noteData.content || '',
        color: '#fff9c4',
        created: noteData.date || new Date().toISOString(),
        isExtensionNote: true
      });
    }
    
    saveData();
    
    // Send response back to extension
    event.source.postMessage({ success: true }, event.origin);
    
    // Refresh UI
    if (selectedFolderId === folder.id) {
      renderNotes();
    }
  }
});

function saveExtensionNote(noteData) {
    // Find or create Floating Notes folder
    let folder = data.find(f => f.name === "Floating Notes");
    if (!folder) {
        folder = {
            id: generateId('folder'),
            name: "Floating Notes",
            notes: [],
            isExtensionFolder: true
        };
        data.push(folder);
        saveData();
        renderFolders();
    }

    const newNote = {
        id: generateId('note'),
        title: noteData.title || 'Floating Note',
        content: noteData.content || '',
        color: '#fffb82',
        created: new Date().toISOString(),
        liked: false,
        todos: [],
        timer: null,
        bulletPoints: [],
        featuresCollapsed: false,
        float: false,
        floatPosition: null,
        isExtensionNote: true
    };

    folder.notes.push(newNote);
    saveData();

    // Switch to floating notes folder
    selectedFolderId = folder.id;
    renderFolders();
    renderNotes();

    showToast('Floating note saved!');
}

function ensureFloatingNotesFolder() {
    const folderName = "Floating Notes";
    let folder = data.find(f => f.name === folderName);
    if (!folder) {
        folder = {
            id: 'folder-floating',
            name: folderName,
            notes: [],
            isExtensionFolder: true
        };
        data.push(folder);
        saveData();
    }
    return folder;
}



function saveExtensionNote(noteData) {
    const folder = ensureFloatingNotesFolder();

    // Create/update note
    const existingIndex = folder.notes.findIndex(n => n.id === noteData.id);
    if (existingIndex >= 0) {
        folder.notes[existingIndex] = {
            ...folder.notes[existingIndex],
            title: noteData.title,
            content: noteData.content
        };
    } else {
        folder.notes.push({
            id: noteData.id,
            title: noteData.title || 'Floating Note',
            content: noteData.content || '',
            color: '#fff9c4',
            created: noteData.date || new Date().toISOString(),
            isExtensionNote: true
        });
    }

    saveData();
    return true;
}
window.onload = init;
