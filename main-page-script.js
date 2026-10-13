// Application Data State
const now = new Date();
const systemYear = now.getFullYear();
const systemMonth = now.getMonth();
const systemDay = now.getDate();
const systemDateString = `${systemYear}-${String(systemMonth + 1).padStart(2, '0')}-${String(systemDay).padStart(2, '0')}`;



/* ==========================================================================
   RESPONSIVE READ ALOUD ENGINE & DYNAMIC SPEED SLIDER (NO HIGHLIGHT)
   ========================================================================== */
let isReadingAloud = false;
let currentUtterance = null;

function toggleReadAloud() {
  if (!('speechSynthesis' in window)) {
    showToast('Speech synthesis not supported.');
    return;
  }
  const canvas = document.getElementById('editor-canvas');
  const label = document.getElementById('read-aloud-label');
  const speedDropdown = document.getElementById('speech-speed-dropdown');
  const text = canvas ? (canvas.innerText || '').trim() : '';

  if (isReadingAloud) {
    window.speechSynthesis.cancel();
    isReadingAloud = false;
    if (label) label.innerText = 'Read Aloud';
    if (speedDropdown) speedDropdown.classList.add('hidden');
    showToast('Read aloud stopped.');
  } else {
    if (!text) {
      showToast('No note content to read.');
      return;
    }

    currentUtterance = new SpeechSynthesisUtterance(text);
    const speedSelect = document.getElementById('speech-speed-dropdown');
    currentUtterance.rate = speedSelect ? parseFloat(speedSelect.value) : 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const naturalVoice = voices.find(v => v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('enhanced') || v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david')) || voices.find(v => v.lang.includes('en')) || voices[0];
      currentUtterance.voice = naturalVoice;
    }
    currentUtterance.pitch = 1.0;

    currentUtterance.onstart = () => {
      isReadingAloud = true;
      if (label) label.innerText = 'Stop Reading';
      if (speedDropdown) speedDropdown.classList.remove('hidden');
      showToast('Reading note aloud... 🔊');
    };

    currentUtterance.onend = () => {
      isReadingAloud = false;
      if (label) label.innerText = 'Read Aloud';
      if (speedDropdown) speedDropdown.classList.add('hidden');
    };

    currentUtterance.onerror = () => {
      isReadingAloud = false;
      if (label) label.innerText = 'Read Aloud';
      if (speedDropdown) speedDropdown.classList.add('hidden');
      showToast('Speech playback ended.');
    };

    window.speechSynthesis.speak(currentUtterance);
  }
}

// Instantly updates playback speed live on-the-fly without restarting voice from top
function updateSpeechRateFromDropdown(val) {
  const parsedRate = parseFloat(val);

  if (isReadingAloud && currentUtterance && 'speechSynthesis' in window) {
    currentUtterance.rate = parsedRate;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }
}

/* ==========================================================================
   FOLDER CREATION & MANAGEMENT FUNCTIONS
   ========================================================================== */
function openCreateFolderModal() {
  const input = document.getElementById('modal-folder-name');
  if (input) input.value = '';
  const modal = document.getElementById('modal-create-folder');
  if (modal) {
    modal.classList.remove('hidden');
    setTimeout(() => { if (input) input.focus(); }, 50);
  }
}

function closeCreateFolderModal() {
  const modal = document.getElementById('modal-create-folder');
  if (modal) modal.classList.add('hidden');
}

function submitCreateFolder() {
  const input = document.getElementById('modal-folder-name');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;

  if (!state.folders) state.folders = [];
  
  // Creates an unlimited note folder
  state.folders.push({ 
    id: Date.now(), 
    name: name, 
    noteIds: [] 
  });

  closeCreateFolderModal();
  renderSidebar();
  showToast(`Folder "${name}" created successfully.`);
}

function renameFolder(folderId) {
  if (!state.folders) return;
  const folder = state.folders.find(f => f.id === folderId);
  if (!folder) return;
  const newName = prompt('Enter new folder name:', folder.name);
  if (newName && newName.trim()) {
    folder.name = newName.trim();
    renderSidebar();
    showToast('Folder renamed successfully.');
  }
}

function moveNoteToFolder(noteId, targetFolderId) {
  // Remove note from any existing folder first
  state.folders.forEach(f => {
    f.noteIds = f.noteIds.filter(id => id !== noteId);
  });

  const targetFolder = state.folders.find(f => f.id === targetFolderId);
  if (targetFolder) {
    if (targetFolder.noteIds.length >= targetFolder.limit) {
      showToast(`Folder limit reached (${targetFolder.limit} max files).`);
      return;
    }
    targetFolder.noteIds.push(noteId);
    renderSidebar();
    showToast(`Note moved to folder "${targetFolder.name}".`);
  }
}

function confirmDeleteFolderId(folderId) {
  const folder = state.folders.find(f => f.id === folderId);
  if (!folder) return;
  state.folderToDelete = folderId;

  const fileNames = folder.noteIds.map(nid => {
    const n = state.notes.find(note => note.id === nid);
    return n ? (n.title || 'Untitled Note') : '';
  }).filter(Boolean).join(', ');

  document.getElementById('delete-folder-modal-text').innerHTML = `Are you sure you want to delete folder <strong class="text-zinc-900">${folder.name}</strong>? It contains <strong class="text-zinc-900">${folder.noteIds.length}</strong> note file(s): <span class="italic text-zinc-500">${fileNames || 'None'}</span>.`;
  document.getElementById('modal-delete-folder').classList.remove('hidden');
}

function closeDeleteFolderModal() {
  document.getElementById('modal-delete-folder').classList.add('hidden');
  state.folderToDelete = null;
}

function confirmDeleteFolder() {
  if (!state.folderToDelete) return;
  state.folders = state.folders.filter(f => f.id !== state.folderToDelete);
  closeDeleteFolderModal();
  renderSidebar();
  showToast('Folder deleted.');
}

/* ==========================================================================
   FOLDER INTERACTION: COLLAPSE & FILE MANAGER-STYLE INLINE RENAME
   ========================================================================== */
function toggleFolderCollapse(folderId) {
  if (!state.folders) return;
  const folder = state.folders.find(f => f.id === folderId);
  if (folder) {
    folder.expanded = folder.expanded === undefined ? false : !folder.expanded;
    renderSidebar();
  }
}

function enableFolderInlineRename(spanEl, folderId) {
  if (!state.folders) return;
  const folder = state.folders.find(f => f.id === folderId);
  if (!folder) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = folder.name;
  input.className = 'bg-white border border-zinc-300 rounded px-1.5 py-0.5 text-xs font-bold text-zinc-900 w-full focus:outline-none';

  spanEl.replaceWith(input);
  input.focus();
  input.select();

  const saveRename = () => {
    const newName = input.value.trim();
    if (newName) {
      folder.name = newName;
      showToast('Folder renamed successfully.');
    }
    renderSidebar();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRename();
    } else if (e.key === 'Escape') {
      renderSidebar();
    }
  });

  input.addEventListener('blur', () => {
    saveRename();
  });
}

function renderSidebarNotesHtml() {
  if (!state.folders) state.folders = [];
  let html = '';

  // 1. Render Folders (Default collapsed so notes are hidden until toggled)
  state.folders.forEach(folder => {
    if (folder.expanded === undefined) folder.expanded = false; 

    html += `
      <div class="mb-2" ondragover="event.preventDefault()" ondrop="handleFolderDrop(event, ${folder.id})">
        <div class="flex items-center justify-between text-xs font-bold text-zinc-700 py-1.5 px-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <!-- Collapse / Expand Arrow -->
            <button onclick="toggleFolderCollapse(${folder.id})" class="w-5 h-5 flex-shrink-0 flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-transform cursor-pointer ${folder.expanded ? 'rotate-90' : ''}" title="Toggle folder">
              <span class="material-symbols-rounded text-sm">chevron_right</span>
            </button>
            <!-- Folder Name (Double click to inline rename) -->
            <span ondblclick="enableFolderInlineRename(this, ${folder.id})" class="truncate flex-1 cursor-text select-none" title="Double-click to rename">
              📁 ${folder.name} <span class="text-[10px] text-zinc-400 font-normal">(${folder.noteIds.length})</span>
            </span>
          </div>
          <button onclick="event.stopPropagation(); confirmDeleteFolderId(${folder.id})" class="flex-shrink-0 text-zinc-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer" title="Delete folder">
            <span class="material-symbols-rounded text-xs">delete</span>
          </button>
        </div>

        <!-- Notes list inside folder (Hidden by default unless toggled open) -->
        <div class="pl-6 mt-1 space-y-0.5 ${folder.expanded ? '' : 'hidden'}">
          ${folder.noteIds.map(noteId => {
            const note = state.notes.find(n => n.id === noteId);
            if (!note) return '';
            return `
              <div 
                draggable="true" 
                ondragstart="handleNoteDragStart(event, ${note.id})" 
                onclick="selectNote(${note.id})" 
                class="group flex items-center justify-between py-1 px-2 rounded-xl text-xs cursor-pointer ${state.activeNoteId === note.id ? 'bg-zinc-100 font-semibold' : 'text-zinc-600 hover:bg-zinc-50'}"
              >
                <span class="truncate">${note.title || 'Untitled'}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  // 2. Render Unassigned / All Notes
  const unassignedNotes = state.notes.filter(n => !state.folders.some(f => f.noteIds.includes(n.id)));
  if (unassignedNotes.length > 0 || state.folders.length > 0) {
    html += `<div class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 pt-2">All Notes / Unfiled</div>`;
    html += unassignedNotes.map(note => `
      <div 
        draggable="true" 
        ondragstart="handleNoteDragStart(event, ${note.id})" 
        onclick="selectNote(${note.id})" 
        class="group flex items-center justify-between py-1 px-2 rounded-xl text-xs cursor-pointer text-zinc-600 hover:bg-zinc-50"
      >
        <span class="truncate flex-1">${note.title || 'Untitled'}</span>
      </div>
    `).join('');
  }

  return html || '<p class="text-[11px] text-zinc-400 italic py-1">No notes or folders</p>';
}

/* ==========================================================================
   PERSONALIZATION CONFIGURATIONS & REWARD TIERS
   ========================================================================== */

// 1. Basic Themes (50 pts, Monochrome is free)
const BASIC_THEMES = [
  { id: 'monochrome', name: 'Monochrome Slate', cost: 0, previewClass: 'from-zinc-700 to-zinc-900', bgClass: 'bg-[#e7e9ee]' },
  { id: 'golden', name: 'Warm Amber Honey', cost: 50, previewClass: 'from-amber-500 to-amber-700', bgClass: 'bg-[#faebd2]' },
  { id: 'skyblue', name: 'Cerulean Sky Blue', cost: 50, previewClass: 'from-sky-500 to-blue-700', bgClass: 'bg-[#d5e7f7]' },
  { id: 'violet', name: 'Royal Velvet Purple', cost: 50, previewClass: 'from-purple-500 to-indigo-700', bgClass: 'bg-[#e5dbf5]' }
];

// 2. Artwork Themes (100 pts)
const ARTWORK_THEMES = [
  { 
    id: 'art-studio', 
    name: 'Blueprint Grid Studio', 
    cost: 100, 
    bgClass: 'bg-art-studio',
    previewClass: 'bg-art-studio' 
  },
  { 
    id: 'art-kyoto', 
    name: 'Kyoto Sun Texture', 
    cost: 100, 
    bgClass: 'bg-art-kyoto',
    previewClass: 'bg-art-kyoto' 
  },
  { 
    id: 'art-pines', 
    name: 'Nordic Forest Pines', 
    cost: 100, 
    bgClass: 'bg-art-pines',
    previewClass: 'bg-art-pines' 
  },
  { 
    id: 'art-celestial', 
    name: 'Celestial Star Map', 
    cost: 100, 
    bgClass: 'bg-art-celestial',
    previewClass: 'bg-art-celestial' 
  }
];

const ANIMATED_THEMES = [
  { 
    id: 'anim-aurora', 
    name: 'Vibrant Aurora Borealis', 
    cost: 200, 
    previewClass: 'from-cyan-500 via-emerald-400 to-purple-500', 
    bgClass: 'bg-animated-aurora' 
  },
  { 
    id: 'anim-twilight', 
    name: 'Lofi Twilight Sunset', 
    cost: 200, 
    previewClass: 'from-pink-500 via-purple-500 to-amber-400', 
    bgClass: 'bg-animated-twilight' 
  },
  { 
    id: 'anim-ocean', 
    name: 'Deep Sea Abyssal Drift', 
    cost: 200, 
    previewClass: 'from-blue-600 via-sky-500 to-indigo-600', 
    bgClass: 'bg-animated-ocean' 
  },
  { 
    id: 'anim-nebula', 
    name: 'Cosmic Nebula Pulse', 
    cost: 200, 
    previewClass: 'from-fuchsia-600 via-violet-600 to-indigo-900', 
    bgClass: 'bg-animated-nebula' 
  }
];

// 4. Low-Stress Typography (70 pts each, Default is free)
const FONT_STYLES = [
  { id: 'font-app-default', name: 'Clean Sans (Neutral)', cost: 0, fontClass: 'font-app-default', sample: 'Aa Bb Cc — Everyday focus and clarity' },
  { id: 'font-app-humanist', name: 'Jakarta (Humanist)', cost: 70, fontClass: 'font-app-humanist', sample: 'Aa Bb Cc — Rounded, friendly modern strokes' },
  { id: 'font-app-editorial', name: 'Lora (Quiet Editorial)', cost: 70, fontClass: 'font-app-editorial', sample: 'Aa Bb Cc — Elegant serif with reduced glare' },
  { id: 'font-app-comfort', name: 'Comfortaa (Soft Rounded)', cost: 70, fontClass: 'font-app-comfort', sample: 'Aa Bb Cc — Playful, warm, anti-stress curves' },
  { id: 'font-app-hyperlegible', name: 'Hyperlegible (Eye Relief)', cost: 70, fontClass: 'font-app-hyperlegible', sample: 'Aa Bb Cc — Specially crafted for low fatigue' }
];

/* ==========================================================================
   GLOBAL SEARCH OVERLAY CONTROLLER
   ========================================================================== */

function handleGlobalSearch(query) {
  const q = (query || '').toLowerCase().trim();
  const dropdown = document.getElementById('global-search-dropdown');
  const clearBtn = document.getElementById('global-search-clear-btn');
  if (!dropdown) return;

  if (clearBtn) {
    if (q.length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  if (!q) {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
    return;
  }

  const matches = state.notes.filter(note => {
    const title = (note.title || '').toLowerCase();
    const plainContent = (note.content || '').replace(/<[^>]+>/g, '').toLowerCase();
    return title.includes(q) || plainContent.includes(q);
  });

  dropdown.classList.remove('hidden');

  if (matches.length === 0) {
    dropdown.innerHTML = `
      <div class="py-6 px-4 text-center text-zinc-400 text-xs italic">
        No notes found matching "<span class="font-bold text-zinc-600">${escapeHtml(query)}</span>"
      </div>
    `;
    return;
  }

  dropdown.innerHTML = `
    <div class="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 flex items-center justify-between">
      <span>Matching Notes</span>
      <span>${matches.length} found</span>
    </div>
    <div class="divide-y divide-zinc-50 pt-1">
      ${matches.map(note => {
        const plain = (note.content || '').replace(/<[^>]+>/g, '').trim();
        return `
          <div 
            onclick="openSearchedNote(${note.id})" 
            class="group p-2.5 hover:bg-zinc-50 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-3"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-base text-zinc-400 group-hover:text-zinc-900 transition-colors">draft</span>
                <span class="text-xs font-bold text-zinc-900 truncate">${note.title || 'Untitled Note'}</span>
              </div>
              <p class="text-[11px] text-zinc-400 truncate pl-6 mt-0.5">${plain || 'Empty note...'}</p>
            </div>
            <div class="text-right flex-shrink-0">
              <span class="text-[10px] text-zinc-400 block">${note.created || ''}</span>
              <span class="text-[10px] font-bold text-zinc-700 group-hover:text-zinc-900 flex items-center justify-end gap-0.5">
                Open <span class="material-symbols-rounded text-xs">arrow_forward</span>
              </span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function openSearchedNote(noteId) {
  selectNote(noteId);
  closeGlobalSearch();
}

function clearGlobalSearch() {
  const input = document.getElementById('global-search-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  handleGlobalSearch('');
}

function closeGlobalSearch() {
  const dropdown = document.getElementById('global-search-dropdown');
  const clearBtn = document.getElementById('global-search-clear-btn');
  if (dropdown) dropdown.classList.add('hidden');
  if (clearBtn) clearBtn.classList.add('hidden');
  const input = document.getElementById('global-search-input');
  if (input) input.value = '';
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

document.addEventListener('click', (e) => {
  const container = document.getElementById('global-search-container');
  const dropdown = document.getElementById('global-search-dropdown');
  if (container && !container.contains(e.target) && dropdown) {
    dropdown.classList.add('hidden');
  }
});

const STORE_KEY = "sessionTimerSettings";
const STATE_KEY = "notedTimerState";
const LIMITS = { focus: { min: 1, max: 120 }, brk: { min: 1, max: 60 } };

function loadTimerSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    let focus = stored.focus !== undefined ? stored.focus : 25;
    let brk = stored.brk !== undefined ? stored.brk : 5;
    if (focus === 1 && brk === 1) {
      focus = 25;
      brk = 5;
    }
    return {
      focus: focus,
      brk: brk,
      autoFocus: stored.autoFocus !== undefined ? stored.autoFocus : true,
      autoBreak: stored.autoBreak !== undefined ? stored.autoBreak : true
    };
  } catch (e) {
    return { focus: 25, brk: 5, autoFocus: true, autoBreak: true };
  }
}

let timerSettings = loadTimerSettings();
let draftSettings = { ...timerSettings };

let state = {
  points: 0,
  currentView: 'dashboard',
  sidebarCollapsed: false,
  notesExpanded: true,
  filesViewMode: 'list',
  
  notes: [],
  activeNoteId: null,
  
  tasks: [],
  completedTasks: [],
  deletedTasks: [],

  calendarMonth: systemMonth,
  calendarYear: systemYear,
  selectedCalendarDate: systemDateString,
  calendarViewType: 'month',

  isDarkMode: false,
  unlockedThemes: ['monochrome'],
  activeTheme: 'monochrome',

  taskTypes: [
    { id: 'study', label: 'Study', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
    { id: 'work', label: 'Work', bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
    { id: 'meeting', label: 'Meeting', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
    { id: 'personal', label: 'Personal', bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' }
  ],
  selectedTaskType: 'study',
  selectedPriority: 'Medium',

  // Pomodoro Engine State
  timerMode: 'focus',
  timerRemaining: timerSettings.focus * 60,
  timerRunning: false,
  timerInterval: null,
  timerEndAt: 0,

  // Personalization State
  unlockedFonts: ['font-app-default'],
  activeFont: 'font-app-default',
  featureGames: true,
  featureTimer: true,
  targetRedeemItem: null
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/* ========== PRIMARY NAVIGATION & VIEW SWITCHING ========== */
function switchView(viewName) {
  state.currentView = viewName;
  ['dashboard', 'calendar', 'notes', 'personalization'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  const activeEl = document.getElementById(`view-${viewName}`);
  if (activeEl) activeEl.classList.remove('hidden');

  renderSidebar();
  if (viewName === 'calendar') renderCalendar();
  if (viewName === 'dashboard') renderDashboardNotes();
  if (viewName === 'personalization') renderPersonalization();
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  renderSidebar();
}

function toggleNotesAccordion() {
  if (state.sidebarCollapsed) {
    toggleSidebar();
    return;
  }
  state.notesExpanded = !state.notesExpanded;
  renderSidebar();
}

function renderSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  const brandBtn = document.getElementById('brand-header-btn');
  if (!sidebar) return;

  if (state.sidebarCollapsed) {
    // 1. Minimized Brand Header Button (Slim w-14)
    if (brandBtn) {
      brandBtn.className = "h-12 bg-white rounded-2xl border border-zinc-200/80 shadow-xs flex items-center justify-center transition-all hover:border-zinc-300 flex-shrink-0 cursor-pointer w-14 px-0";
      brandBtn.innerHTML = `
        <div class="w-7 h-7 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
          <img src="noted-logo-icon.png" alt="noted logo" class="w-full h-full object-contain">
        </div>
      `;
    }

    // 2. Minimized Slim Sidebar (w-14)
    sidebar.className = "bg-white rounded-3xl border border-zinc-200/80 shadow-xs flex flex-col justify-between items-center transition-all duration-300 flex-shrink-0 relative overflow-visible select-none w-14 py-3.5 px-0";
    sidebar.innerHTML = `
      <div class="w-full flex flex-col items-center space-y-3.5">
        <button onclick="toggleSidebar()" class="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/80 flex items-center justify-center text-zinc-700 transition-all shadow-2xs cursor-pointer" title="Expand sidebar">
          <span class="material-symbols-rounded text-sm">chevron_right</span>
        </button>

        <!-- Compact Navigation Icons -->
        <nav class="w-full flex flex-col items-center space-y-1.5 px-1">
          <button onclick="switchView('dashboard')" class="w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${state.currentView === 'dashboard' ? 'bg-zinc-100 text-zinc-900 font-bold' : 'text-zinc-600 hover:bg-zinc-50'}" title="Dashboard">
            <span class="material-symbols-rounded text-lg">dashboard</span>
          </button>
          <button onclick="switchView('notes')" class="w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${state.currentView === 'notes' ? 'bg-zinc-100 text-zinc-900 font-bold' : 'text-zinc-600 hover:bg-zinc-50'}" title="My Notes">
            <span class="material-symbols-rounded text-lg">description</span>
          </button>
          <button onclick="switchView('calendar')" class="w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${state.currentView === 'calendar' ? 'bg-zinc-100 text-zinc-900 font-bold' : 'text-zinc-600 hover:bg-zinc-50'}" title="Calendar">
            <span class="material-symbols-rounded text-lg">calendar_month</span>
          </button>
          <button onclick="switchView('personalization')" class="w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${state.currentView === 'personalization' ? 'bg-zinc-100 text-zinc-900 font-bold' : 'text-zinc-600 hover:bg-zinc-50'}" title="Personalization">
            <span class="material-symbols-rounded text-lg">palette</span>
          </button>
        </nav>
      </div>

      <!-- Minimized Account Avatar Trigger (Opens Account Modal) -->
      <div class="w-full flex flex-col items-center gap-2 pt-2.5 border-t border-zinc-100">
        <button 
  type="button"
  id="user-profile-mini-btn"
  onclick="toggleAccountMenu(event)" 
  class="w-8 h-8 rounded-full bg-[#1e2329] text-white font-bold flex items-center justify-center text-xs flex-shrink-0 shadow-xs hover:ring-2 hover:ring-zinc-400 transition-all cursor-pointer" 
  title="Account options"
>
  A
</button>
      </div>
    `;
  } else {
    // Expanded Sidebar (Full size w-64)
    if (brandBtn) {
      brandBtn.className = "h-12 bg-white rounded-2xl border border-zinc-200/80 shadow-xs flex items-center px-4 gap-2.5 transition-all hover:border-zinc-300 flex-shrink-0 cursor-pointer";
      brandBtn.innerHTML = `
        <div class="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
          <img src="noted-logo-icon.png" alt="noted logo" class="w-full h-full object-contain">
        </div>
        <span class="font-black text-lg tracking-tight text-zinc-900">noted</span>
      `;
    }

    sidebar.className = "bg-white rounded-3xl border border-zinc-200/80 shadow-xs flex flex-col justify-between transition-all duration-300 flex-shrink-0 relative overflow-visible select-none w-64 p-5";
    sidebar.innerHTML = `
      <div class="flex flex-col overflow-hidden">
        <div class="flex items-center justify-between w-full overflow-hidden mb-7">
          <div>
  <div class="flex items-center gap-1 text-[11px] text-zinc-500 font-medium leading-tight">
    <span>Hello</span>
    <img 
      src="waving_hand_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" 
      alt="waving hand" 
      class="w-3.5 h-3.5 object-contain brightness-0 opacity-60 [html.dark-theme_&]:brightness-0 [html.dark-theme_&]:invert [html.dark-theme_&]:opacity-90 inline-block align-middle"
    />
  </div>
  <h2 class="text-lg font-black tracking-tight text-zinc-900 m-0 leading-tight">Angeline</h2>
</div>
          <button onclick="toggleSidebar()" class="w-7 h-7 rounded-full bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-500 transition-colors flex-shrink-0 shadow-2xs cursor-pointer" title="Collapse sidebar">
            <span class="material-symbols-rounded text-base leading-none">chevron_left</span>
          </button>
        </div>

        <nav class="space-y-1">
          <button onclick="switchView('dashboard')" class="w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-medium transition-colors cursor-pointer ${state.currentView === 'dashboard' ? 'bg-zinc-100 text-zinc-900 font-bold' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}">
            <span class="material-symbols-rounded text-xl text-zinc-700">dashboard</span>
            <span>Dashboard</span>
          </button>

          <div>
            <div class="flex flex-col min-h-0">
              <div onclick="toggleNotesAccordion()" class="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer select-none flex-shrink-0">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-rounded text-xl text-zinc-600">description</span>
                  <span>My Notes</span>
                </div>
                <div class="flex items-center gap-1">
                  <button type="button" onclick="event.stopPropagation(); openCreateFolderModal();" class="w-5 h-5 rounded-md hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer" title="Create folder">
                    <span class="material-symbols-rounded text-sm">create_new_folder</span>
                  </button>
                  <button type="button" onclick="event.stopPropagation(); openCreateNoteModal();" class="w-5 h-5 rounded-md hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer" title="Create note">
                    <span class="material-symbols-rounded text-sm">add</span>
                  </button>
                  <span id="notes-chevron-icon" class="material-symbols-rounded text-sm text-zinc-400 transition-transform ${state.notesExpanded ? '' : 'rotate-180'}">expand_more</span>
                </div>
              </div>

              <div 
                id="sidebar-notes-container" 
                class="pl-3 pr-1 mt-1 space-y-1 overflow-y-auto max-h-[40vh] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-200 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb]:rounded-full ${state.notesExpanded ? '' : 'hidden'}"
              >
                ${renderSidebarNotesHtml()}
              </div>
            </div>
          </div>

          <button onclick="switchView('calendar')" class="w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm transition-colors cursor-pointer ${state.currentView === 'calendar' ? 'bg-zinc-100 text-zinc-900 font-bold' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}">
            <span class="material-symbols-rounded text-xl text-zinc-700">calendar_month</span>
            <span>Calendar</span>
          </button>

          <button onclick="switchView('personalization')" class="w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-medium hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer ${state.currentView === 'personalization' ? 'bg-zinc-100 text-zinc-900 font-bold' : 'text-zinc-600'}">
            <span class="material-symbols-rounded text-xl text-zinc-600">palette</span>
            <span>Personalization</span>
          </button>
        </nav>
      </div>

      <!-- Account Card at bottom of expanded sidebar -->
      <div class="pt-3 border-t border-zinc-100">
       <button 
  type="button" 
  id="user-profile-pill-btn"
  onclick="toggleAccountMenu(event)" 
  class="w-full flex items-center justify-between p-2.5 rounded-2xl bg-white hover:bg-zinc-50/80 border border-zinc-200/80 hover:border-zinc-300 shadow-2xs transition-all cursor-pointer group text-left select-none relative"
>
  <div class="flex items-center gap-3 min-w-0 flex-1">
    <div class="w-9 h-9 rounded-full bg-[#1e2329] text-white font-bold flex items-center justify-center text-sm flex-shrink-0 shadow-xs">
      A
    </div>
    <div class="truncate">
      <p class="text-xs font-extrabold text-zinc-900 tracking-tight leading-snug truncate">Angeline Sanchez</p>
      <p class="text-[11px] text-zinc-500 font-normal leading-tight truncate">angelineee@gmail.com</p>
    </div>
  </div>
  <span id="account-chevron-icon" class="material-symbols-rounded text-zinc-800 text-xl flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5">
    chevron_right
  </span>
</button>
      </div>
    `;
  }
}

function getOrCreateAccountMenu() {
  let menu = document.getElementById('account-popover-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'account-popover-menu';
    menu.className = 'fixed bg-white rounded-3xl border border-zinc-200/90 shadow-2xl p-2.5 space-y-1 z-[9999] origin-bottom-left transition-all';
    menu.style.display = 'none';
    menu.innerHTML = `
      <!-- Current User Account Header -->
      <div class="px-3 py-2.5 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center gap-2.5 mb-1.5">
        <div class="w-8 h-8 rounded-full bg-[#1e2329] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-2xs">
          A
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-bold text-zinc-900 truncate">Angeline Sanchez</p>
          <p class="text-[10px] text-zinc-500 truncate">angelineee@gmail.com</p>
        </div>
        <span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Active Account"></span>
      </div>

      <!-- Action: Switch Account -->
      <button 
        type="button" 
        onclick="handleSwitchAccount()" 
        class="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100/80 rounded-xl transition-colors cursor-pointer"
      >
        <span class="material-symbols-rounded text-base text-zinc-500">switch_account</span>
        <span>Switch account</span>
      </button>

      <!-- Action: Add Account -->
      <button 
        type="button" 
        onclick="handleAddAccount()" 
        class="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100/80 rounded-xl transition-colors cursor-pointer"
      >
        <span class="material-symbols-rounded text-base text-zinc-500">person_add</span>
        <span>Add account</span>
      </button>

      <div class="h-px bg-zinc-100 my-1"></div>

      <!-- Action: Log Out -->
      <button 
        type="button" 
        onclick="closeAccountMenu(); openLogoutModal();" 
        class="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
      >
        <span class="material-symbols-rounded text-base text-rose-500">logout</span>
        <span>Log out</span>
      </button>
    `;
    menu.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(menu);
  }
  return menu;
}

// 2. Main Toggle Handler
function toggleAccountMenu(e) {
  const evt = e || window.event;
  if (evt) {
    evt.preventDefault();
    evt.stopPropagation();
  }

  const menu = getOrCreateAccountMenu();
  const chevron = document.getElementById('account-chevron-icon');
  
  // Find which button triggered this (either expanded pill or mini avatar)
  const triggerBtn = (evt && evt.currentTarget) 
    || document.getElementById('user-profile-pill-btn') 
    || document.getElementById('user-profile-mini-btn');

  const isVisible = menu.style.display === 'block';

  if (isVisible) {
    closeAccountMenu();
  } else {
    // Calculate dynamic anchor position relative to the screen
    if (triggerBtn) {
      const rect = triggerBtn.getBoundingClientRect();
      menu.style.width = '240px';
      menu.style.left = `${rect.right + 12}px`;
      menu.style.bottom = `${Math.max(12, window.innerHeight - rect.bottom)}px`;
      menu.style.top = 'auto';
    }

    menu.classList.remove('hidden');
    menu.style.display = 'block';

    if (chevron) {
      chevron.style.transform = 'rotate(90deg)';
    }
  }
}

// 3. Close Handler
function closeAccountMenu() {
  const menu = document.getElementById('account-popover-menu');
  const chevron = document.getElementById('account-chevron-icon');
  if (menu) {
    menu.classList.add('hidden');
    menu.style.display = 'none';
  }
  if (chevron) {
    chevron.style.transform = 'rotate(0deg)';
  }
}

function handleSwitchAccount() {
  closeAccountMenu();
  showToast('Account switching is currently in preview mode.');
}

function handleAddAccount() {
  closeAccountMenu();
  showToast('Connect another account feature coming soon.');
}

// 4. Close automatically when clicking outside or resizing
document.addEventListener('click', (e) => {
  const menu = document.getElementById('account-popover-menu');
  if (!menu || menu.style.display !== 'block') return;

  const isTriggerClick = e.target.closest('#user-profile-pill-btn') || e.target.closest('#user-profile-mini-btn');
  const isMenuClick = menu.contains(e.target);

  if (!isTriggerClick && !isMenuClick) {
    closeAccountMenu();
  }
});

window.addEventListener('resize', closeAccountMenu);
function renderSidebarNotesHtml() {
  if (!state.folders) state.folders = [];
  let html = '';

  // 1. Render Folders (Strictly hidden unless toggled open)
  state.folders.forEach(folder => {
    // Explicitly guarantee false if not set
    if (folder.expanded === undefined) folder.expanded = false;

    html += `
      <div class="mb-1.5" ondragover="event.preventDefault()" ondrop="handleFolderDrop(event, ${folder.id})">
        <div class="flex items-center justify-between text-xs font-bold text-zinc-700 py-1.5 px-2 rounded-xl bg-zinc-50 border border-zinc-200/80 hover:bg-zinc-100/60 transition-colors">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <!-- Down/Right Toggle Arrow -->
            <button 
              type="button" 
              onclick="event.stopPropagation(); toggleFolderCollapse(${folder.id})" 
              class="w-4 h-4 flex-shrink-0 flex items-center justify-center text-zinc-400 hover:text-zinc-800 transition-transform cursor-pointer ${folder.expanded ? 'rotate-90' : ''}" 
              title="Toggle folder"
            >
              <span class="material-symbols-rounded text-sm">chevron_right</span>
            </button>
            
            <!-- Folder Title (Double-click inline rename) -->
            <span ondblclick="enableFolderInlineRename(this, ${folder.id})" class="truncate flex-1 cursor-text select-none inline-flex items-center gap-1.5" title="Double-click to rename">
  <img 
    src="folder_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" 
    alt="Folder" 
    class="w-3.5 h-3.5 object-contain brightness-0 opacity-60 [html.dark-theme_&]:brightness-0 [html.dark-theme_&]:invert [html.dark-theme_&]:opacity-90 flex-shrink-0" 
  />
  <span class="truncate">${folder.name}</span>
  <span class="text-[10px] text-zinc-400 font-normal flex-shrink-0">(${folder.noteIds.length})</span>
</span>
          </div>

          <button onclick="event.stopPropagation(); confirmDeleteFolderId(${folder.id})" class="flex-shrink-0 text-zinc-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer" title="Delete folder">
            <span class="material-symbols-rounded text-xs">delete</span>
          </button>
        </div>

        <!-- Notes List: Strictly hidden when folder.expanded is false -->
        <div class="pl-5 mt-1 space-y-0.5 ${folder.expanded ? '' : 'hidden'}">
          ${folder.noteIds.length === 0 
            ? '<p class="text-[10px] text-zinc-400 italic py-1 pl-2">Folder is empty</p>' 
            : folder.noteIds.map(noteId => {
                const note = state.notes.find(n => n.id === noteId);
                if (!note) return '';
                return `
                  <div 
                    draggable="true" 
                    ondragstart="handleNoteDragStart(event, ${note.id})" 
                    onclick="selectNote(${note.id})" 
                    class="group flex items-center justify-between py-1 px-2 rounded-xl text-xs cursor-pointer ${state.activeNoteId === note.id ? 'bg-zinc-100 font-semibold text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50'}"
                  >
                    <span class="truncate">${note.title || 'Untitled'}</span>
                  </div>
                `;
              }).join('')
          }
        </div>
      </div>
    `;
  });

  // 2. Render Unassigned / General Notes
  const unassignedNotes = state.notes.filter(n => !state.folders.some(f => f.noteIds.includes(n.id)));
  if (unassignedNotes.length > 0 || state.folders.length > 0) {
    if (unassignedNotes.length > 0) {
      html += `<div class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 pt-2">All Notes / Unfiled</div>`;
    }
    html += unassignedNotes.map(note => `
      <div 
        draggable="true" 
        ondragstart="handleNoteDragStart(event, ${note.id})" 
        onclick="selectNote(${note.id})" 
        class="group flex items-center justify-between py-1 px-2 rounded-xl text-xs cursor-pointer text-zinc-600 hover:bg-zinc-50"
      >
        <span class="truncate flex-1">${note.title || 'Untitled'}</span>
      </div>
    `).join('');
  }

  return html || '<p class="text-[11px] text-zinc-400 italic py-1 pl-2">No notes or folders</p>';
}

/* ==========================================================================
   DRAG & DROP NOTE INTO FOLDER ENGINE
   ========================================================================== */
function handleNoteDragStart(event, noteId) {
  event.dataTransfer.setData('text/plain', noteId);
}

function handleFolderDrop(event, targetFolderId) {
  event.preventDefault();
  const noteId = parseInt(event.dataTransfer.getData('text/plain'));
  if (isNaN(noteId)) return;

  // Remove note from any other folder first
  state.folders.forEach(f => {
    f.noteIds = f.noteIds.filter(id => id !== noteId);
  });

  // Add note to target folder (Unlimited capacity)
  const targetFolder = state.folders.find(f => f.id === targetFolderId);
  if (targetFolder) {
    targetFolder.noteIds.push(noteId);
    renderSidebar();
    showToast(`Note moved to "${targetFolder.name}".`);
  }
}

function submitCreateFolder() {
  const input = document.getElementById('modal-folder-name');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;

  if (!state.folders) state.folders = [];
  // Starts collapsed by default
  state.folders.push({
    id: Date.now(),
    name: name,
    expanded: false,
    noteIds: []
  });

  closeCreateFolderModal();
  renderSidebar();
  showToast(`Folder "${name}" created.`);
}

function toggleFolderCollapse(folderId) {
  if (!state.folders) return;
  const folder = state.folders.find(f => f.id === folderId);
  if (folder) {
    folder.expanded = !folder.expanded;
    renderSidebar();
  }
}

/* ========== AUDIO CHIME SYNTHESIZER ========== */
function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {}
}

/* ========== POMODORO ENGINE STATE MACHINE ========== */
function totalModeSeconds() {
  return (state.timerMode === 'focus' ? timerSettings.focus : timerSettings.brk) * 60;
}

function toggleTimer() {
  if (state.timerRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  if (state.timerRunning) return;
  state.timerEndAt = Date.now() + state.timerRemaining * 1000;
  state.timerRunning = true;
  state.timerInterval = setInterval(timerTick, 250);
  updateTimerDisplays();
  saveTimerState();
}

function pauseTimer() {
  if (!state.timerRunning) return;
  clearInterval(state.timerInterval);
  state.timerRunning = false;
  updateTimerDisplays();
  saveTimerState();
}

function resetTimer() {
  pauseTimer();
  state.timerRemaining = totalModeSeconds();
  updateTimerDisplays();
  saveTimerState();
}

function skipTimer() {
  pauseTimer();
  state.timerMode = state.timerMode === 'focus' ? 'break' : 'focus';
  state.timerRemaining = totalModeSeconds();
  updateTimerDisplays();
  saveTimerState();
}

function timerTick() {
  const left = Math.max(0, Math.round((state.timerEndAt - Date.now()) / 1000));
  if (left !== state.timerRemaining) {
    state.timerRemaining = left;
    updateTimerDisplays();
  }
  if (left <= 0) {
    finishSession();
  }
}

function finishSession() {
  const prevMode = state.timerMode;
  pauseTimer();
  playChime();

  if (prevMode === 'focus') {
    state.timerMode = 'break';
    state.timerRemaining = timerSettings.brk * 60;
    state.points += 1;
    updatePointsDisplay();
    showToast("Pomodoro complete: +1 point earned 🏆");
    if (state.featureGames) {
      openBreakModal();
    }
  } else {
    state.timerMode = 'focus';
    state.timerRemaining = timerSettings.focus * 60;
    showToast("Break over. Back to focus! ✍️");
  }

  const auto = prevMode === 'focus' ? timerSettings.autoBreak : timerSettings.autoFocus;
  updateTimerDisplays();
  saveTimerState();

  if (auto) {
    startTimer();
  }
}

function saveTimerState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      mode: state.timerMode,
      remaining: state.timerRemaining,
      running: state.timerRunning,
      endAt: state.timerEndAt
    }));
  } catch (e) {}
}

function restoreTimerState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY));
    if (!saved) {
      state.timerRemaining = timerSettings.focus * 60;
      return;
    }
    state.timerMode = saved.mode === 'break' ? 'break' : 'focus';
    if (saved.running) {
      const left = Math.round((saved.endAt - Date.now()) / 1000);
      if (left > 0) {
        state.timerRemaining = left;
        startTimer();
        return;
      }
      state.timerRemaining = totalModeSeconds();
      return;
    }
    const savedRemaining = Number(saved.remaining);
    state.timerRemaining = Math.min(Math.max(0, isNaN(savedRemaining) ? totalModeSeconds() : savedRemaining), totalModeSeconds());
  } catch (e) {
    state.timerRemaining = timerSettings.focus * 60;
  }
}

function formatTime(secs) {
  const hrs = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(hrs).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerDisplays() {
  const timeStr = formatTime(state.timerRemaining);
  document.querySelectorAll('.timer-display').forEach(el => el.innerText = timeStr);

  document.querySelectorAll('.timer-label').forEach(el => {
    el.innerText = state.timerMode === 'focus' ? 'Focus timer' : 'Break timer';
  });

  document.querySelectorAll('.timer-play-btn').forEach(btn => {
    const icon = btn.querySelector('.timer-icon');
    if (icon) {
      icon.innerText = state.timerRunning ? 'pause' : 'play_arrow';
    }
  });

  const isFocus = state.timerMode === 'focus';
  const isAuto = isFocus ? timerSettings.autoBreak : timerSettings.autoFocus;
  document.querySelectorAll('.next-pill').forEach(pill => {
    if (isAuto) {
      pill.className = "next-pill text-[11px] font-bold px-3 py-1 rounded-full text-white bg-[#1f2329] flex items-center gap-1.5 shadow-2xs select-none";
      pill.innerHTML = `
        <span class="material-symbols-rounded text-xs text-amber-300">bolt</span>
        <span>Next ${isFocus ? 'break' : 'Pomodoro'} <strong class="text-white font-extrabold">Auto</strong></span>
      `;
    } else {
      pill.className = "next-pill text-[11px] font-bold px-3 py-1 rounded-full text-zinc-700 bg-zinc-200/90 border border-zinc-300/80 flex items-center gap-1.5 shadow-2xs select-none";
      pill.innerHTML = `
        <span class="material-symbols-rounded text-xs text-zinc-500">touch_app</span>
        <span>Next ${isFocus ? 'break' : 'Pomodoro'} <strong class="text-zinc-900 font-extrabold">Manual</strong></span>
      `;
    }
  });
}

/* ========== SESSION TIMER MODAL LOGIC ========== */
function openTimerModal() {
  draftSettings = { ...timerSettings };
  renderTimerModal();
  document.getElementById('modal-timer').classList.remove('hidden');
}

function closeTimerModal() {
  document.getElementById('modal-timer').classList.add('hidden');
}

function renderTimerModal() {
  const focusInput = document.getElementById('focus-duration-input');
  const brkInput = document.getElementById('break-duration-input');
  if (focusInput) focusInput.value = draftSettings.focus;
  if (brkInput) brkInput.value = draftSettings.brk;

  const dial = document.getElementById('modal-target-time-display');
  if (dial) dial.innerText = `${String(draftSettings.focus).padStart(2, '0')}:00`;

  const desc = document.getElementById('pomodoro-desc-text');
  if (desc) desc.innerText = `Work in focused ${draftSettings.focus}-minute blocks with ${draftSettings.brk}-minute breaks.`;

  const toggleAutoFocus = document.getElementById('toggle-auto-focus');
  if (toggleAutoFocus) {
    toggleAutoFocus.className = `w-10 h-6 rounded-full transition-colors relative p-0.5 flex-shrink-0 cursor-pointer ${draftSettings.autoFocus ? 'bg-blue-600' : 'bg-zinc-300'}`;
    toggleAutoFocus.firstElementChild.className = `w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${draftSettings.autoFocus ? 'translate-x-4' : 'translate-x-0'}`;
  }

  const toggleAutoBreak = document.getElementById('toggle-auto-break');
  if (toggleAutoBreak) {
    toggleAutoBreak.className = `w-10 h-6 rounded-full transition-colors relative p-0.5 flex-shrink-0 cursor-pointer ${draftSettings.autoBreak ? 'bg-blue-600' : 'bg-zinc-300'}`;
    toggleAutoBreak.firstElementChild.className = `w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${draftSettings.autoBreak ? 'translate-x-4' : 'translate-x-0'}`;
  }
}

function handleFocusInput(val) {
  const num = parseInt(val);
  if (!isNaN(num) && num > 0) {
    draftSettings.focus = num;
    document.getElementById('modal-target-time-display').innerText = `${String(num).padStart(2, '0')}:00`;
    document.getElementById('pomodoro-desc-text').innerText = `Work in focused ${num}-minute blocks with ${draftSettings.brk}-minute breaks.`;
  }
}

function clampFocusInput(input) {
  let num = parseInt(input.value) || 25;
  num = Math.max(LIMITS.focus.min, Math.min(LIMITS.focus.max, num));
  input.value = num;
  draftSettings.focus = num;
  renderTimerModal();
}

function handleBreakInput(val) {
  const num = parseInt(val);
  if (!isNaN(num) && num > 0) {
    draftSettings.brk = num;
    document.getElementById('pomodoro-desc-text').innerText = `Work in focused ${draftSettings.focus}-minute blocks with ${num}-minute breaks.`;
  }
}

function clampBreakInput(input) {
  let num = parseInt(input.value) || 5;
  num = Math.max(LIMITS.brk.min, Math.min(LIMITS.brk.max, num));
  input.value = num;
  draftSettings.brk = num;
  renderTimerModal();
}

function toggleAutoSetting(key) {
  draftSettings[key] = !draftSettings[key];
  renderTimerModal();
}

function stepFocus(delta) {
  draftSettings.focus = Math.max(LIMITS.focus.min, Math.min(LIMITS.focus.max, draftSettings.focus + delta));
  renderTimerModal();
}

function stepBreak(delta) {
  draftSettings.brk = Math.max(LIMITS.brk.min, Math.min(LIMITS.brk.max, draftSettings.brk + delta));
  renderTimerModal();
}

function setupStepperListeners() {
  const bindStepper = (btnId, fn) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    let timer;
    const stop = () => clearTimeout(timer);
    const trigger = () => {
      fn();
      timer = setTimeout(function loop() {
        fn();
        timer = setTimeout(loop, 90);
      }, 350);
    };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      trigger();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
  };

  bindStepper('btn-step-focus-dec', () => stepFocus(-1));
  bindStepper('btn-step-focus-inc', () => stepFocus(1));
  bindStepper('btn-step-brk-dec', () => stepBreak(-1));
  bindStepper('btn-step-brk-inc', () => stepBreak(1));
}

function savePomodoroSettings() {
  timerSettings = { ...draftSettings };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(timerSettings));
  } catch (e) {}
  pauseTimer();
  state.timerMode = 'focus';
  state.timerRemaining = timerSettings.focus * 60;
  closeTimerModal();
  updateTimerDisplays();
  saveTimerState();
  showToast(`Timer set: ${timerSettings.focus}m focus, ${timerSettings.brk}m break`);
}

function updatePointsDisplay() {
  document.querySelectorAll('.points-display').forEach(el => el.innerText = state.points);
}

/* ========== DASHBOARD & NOTES CONTROLLERS ========== */
function renderDashboardNotes() {
  const container = document.getElementById('notes-content-container');
  const countBadge = document.getElementById('dashboard-notes-count');
  if (!container) return;
  if (countBadge) countBadge.innerText = `${state.notes.length} files`;

  if (state.notes.length === 0) {
    container.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center py-8 my-auto">
        <p class="text-zinc-400 text-sm">No notes yet. Click "Create note" to start writing.</p>
        <button onclick="openCreateNoteModal()" class="bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-white px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer">
          <span class="material-symbols-rounded text-sm">add</span>
          <span>Create note</span>
        </button>
      </div>
    `;
    return;
  }



  if (state.filesViewMode === 'list') {
    container.innerHTML = `
      <div class="flex-1 min-h-0 flex flex-col">
        <div class="grid grid-cols-12 text-xs font-bold text-zinc-400 uppercase tracking-wider pb-2 border-b border-zinc-100 px-3 flex-shrink-0">
          <div class="col-span-8">File</div>
          <div class="col-span-4 text-right">Created</div>
        </div>
        <div class="divide-y divide-zinc-50 overflow-y-auto flex-1">
          ${state.notes.map(note => `
            <div onclick="selectNote(${note.id})" class="grid grid-cols-12 items-center py-3.5 px-3 hover:bg-zinc-50 rounded-2xl cursor-pointer transition-colors group">
              <div class="col-span-8 flex items-center gap-3 min-w-0 pr-2">
                <span class="material-symbols-rounded text-xl text-zinc-400 flex-shrink-0">draft</span>
                <span class="font-semibold text-sm truncate ${!note.title ? 'text-zinc-400 italic' : 'text-zinc-900'}">${note.title || 'Untitled Note'}</span>
              </div>
              <div class="col-span-4 flex items-center justify-end gap-3 flex-shrink-0">
                <span class="text-xs text-zinc-400 whitespace-nowrap">${note.created}</span>
                <button onclick="event.stopPropagation(); deleteNote(${note.id})" class="w-8 h-8 rounded-xl flex items-center justify-center p-2 text-zinc-300 group-hover:text-zinc-600 hover:text-rose-600 hover:bg-rose-50 transition-colors flex-shrink-0 cursor-pointer" title="Delete note">
                  <span class="material-symbols-rounded text-base">delete</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-1 overflow-y-auto flex-1">
        ${state.notes.map(note => {
          const plain = (note.content || '').replace(/<[^>]+>/g, '').trim();
          return `
            <div onclick="selectNote(${note.id})" class="group bg-zinc-50/70 hover:bg-white border border-zinc-200/80 hover:border-zinc-300 rounded-3xl p-4 cursor-pointer transition-all flex flex-col justify-between h-48 shadow-2xs hover:shadow-xs">
              <div class="space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="w-8 h-8 rounded-xl bg-white border border-zinc-200/80 text-zinc-700 flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-colors flex-shrink-0">
                    <span class="material-symbols-rounded text-base">draft</span>
                  </div>
                  <button onclick="event.stopPropagation(); deleteNote(${note.id})" class="w-8 h-8 rounded-xl flex items-center justify-center p-2 text-zinc-300 hover:text-rose-600 hover:bg-rose-50 p-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 cursor-pointer" title="Delete note">
                    <span class="material-symbols-rounded text-base">delete</span>
                  </button>
                </div>
                <h4 class="font-bold text-sm line-clamp-1 ${!note.title ? 'text-zinc-400 italic' : 'text-zinc-900'}">${note.title || 'Untitled Note'}</h4>
                <p class="text-xs text-zinc-500 line-clamp-3 leading-relaxed">${plain || 'No content in note...'}</p>
              </div>
              <div class="pt-2 border-t border-zinc-200/60 flex items-center justify-between text-[11px] text-zinc-400">
                <span>${note.created}</span>
                <span class="font-semibold text-zinc-600 group-hover:text-zinc-900 flex items-center gap-0.5">
                  Open <span class="material-symbols-rounded text-xs">arrow_forward</span>
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

function setAlignActive(button) {
  document.querySelectorAll('.align-btn').forEach(btn => {
    btn.classList.remove('bg-zinc-900', 'text-white');
    btn.classList.add('text-zinc-700', 'hover:bg-zinc-200/70');
  });
  button.classList.add('bg-zinc-900', 'text-white');
  button.classList.remove('text-zinc-700', 'hover:bg-zinc-200/70');
}

function setFilesViewMode(mode) {
  state.filesViewMode = mode;
  const listBtn = document.getElementById('view-mode-list-btn');
  const gridBtn = document.getElementById('view-mode-grid-btn');
  if (mode === 'list') {
    listBtn.className = 'px-3 py-1 rounded-lg text-xs font-extrabold bg-white text-zinc-900 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer';
    gridBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-all cursor-pointer';
  } else {
    gridBtn.className = 'px-3 py-1 rounded-lg text-xs font-extrabold bg-white text-zinc-900 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer';
    listBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-all cursor-pointer';
  }
  renderDashboardNotes();
}

function selectNote(id) {
  const note = state.notes.find(n => n.id === id);
  if (!note) return;
  state.activeNoteId = id;
  document.getElementById('editor-note-title').value = note.title || '';
  const canvas = document.getElementById('editor-canvas');
  canvas.innerHTML = note.content || '';
  updateEditorStats();
  switchView('notes');
  renderSidebar();
}

function deleteNote(id) {
  state.notes = state.notes.filter(n => n.id !== id);
  if (state.activeNoteId === id) {
    state.activeNoteId = null;
    document.getElementById('editor-note-title').value = '';
    document.getElementById('editor-canvas').innerHTML = '';
    updateEditorStats();
  }
  renderAll();
  showToast('Note deleted.');
}

function saveActiveNote() {
  if (!state.activeNoteId) return;
  const note = state.notes.find(n => n.id === state.activeNoteId);
  if (note) {
    note.title = document.getElementById('editor-note-title').value.trim();
    note.content = document.getElementById('editor-canvas').innerHTML;
    renderSidebar();
    renderDashboardNotes();
    showToast('Note saved successfully!');
  }
}

function handleEditorInput() {
  updateEditorStats();
  if (state.activeNoteId) {
    const note = state.notes.find(n => n.id === state.activeNoteId);
    if (note) {
      note.title = document.getElementById('editor-note-title').value;
      note.content = document.getElementById('editor-canvas').innerHTML;
    }
  }
}

function updateEditorStats() {
  const canvas = document.getElementById('editor-canvas');
  if (!canvas) return;
  const text = canvas.innerText || '';
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('note-word-count').innerText = `${words} words`;
  document.getElementById('note-char-count').innerText = `${text.length} characters`;
  document.getElementById('note-read-time').innerText = `${Math.ceil(words / 200)} min read`;
}

function formatDoc(command, val = null) {
  const canvas = document.getElementById('editor-canvas');
  if (canvas) {
    canvas.focus();
  }
  document.execCommand(command, false, val);
  updateEditorStats();
  updateToolbarActiveStates();
  saveActiveNoteSilently();
}

function changeFontFamily(fontClass) {
  const canvas = document.getElementById('editor-canvas');
  canvas.className = `flex-1 w-full min-h-[420px] text-zinc-700 leading-relaxed focus:outline-none text-base border-none outline-none ${fontClass}`;
}

function changeFontSize(size) {
  document.execCommand('fontSize', false, size);
  document.getElementById('editor-canvas').focus();
}

function insertChecklist() {
  const canvas = document.getElementById('editor-canvas');
  if (!canvas) return;
  const sel = window.getSelection();
  let selectedText = '';
  if (sel && sel.rangeCount > 0) {
    selectedText = sel.toString().trim();
  }
  const itemHtml = `<div class="checklist-item"><input type="checkbox" onchange="toggleChecklistItem(this)" /><span class="checklist-content">${selectedText || 'New to-do item...'}</span></div>`;
  document.execCommand('insertHTML', false, itemHtml);
  canvas.focus();
  updateEditorStats();
  updateToolbarActiveStates();
  saveActiveNoteSilently();
}

function toggleChecklistItem(checkbox) {
  const parent = checkbox.closest('.checklist-item');
  if (!parent) return;
  if (checkbox.checked) {
    parent.classList.add('checked');
    checkbox.setAttribute('checked', 'checked');
  } else {
    parent.classList.remove('checked');
    checkbox.removeAttribute('checked');
  }
  saveActiveNoteSilently();
}

function cleanupEmptyEditorCanvas() {
  const canvas = document.getElementById('editor-canvas');
  if (!canvas) return;
  const rawText = (canvas.innerText || '').replace(/\u00a0/g, ' ').trim();
  if (rawText === '' && canvas.querySelectorAll('.checklist-item').length === 0) {
    canvas.innerHTML = '';
  }
}

function handleEditorBackspace(e) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  if (!range.collapsed) {
    setTimeout(() => {
      cleanupEmptyEditorCanvas();
      updateEditorStats();
      updateToolbarActiveStates();
      saveActiveNoteSilently();
    }, 0);
    return;
  }

  const canvas = document.getElementById('editor-canvas');
  const anchorNode = sel.anchorNode;
  const el = anchorNode ? (anchorNode.nodeType === 1 ? anchorNode : anchorNode.parentElement) : null;

  const checklistItem = el ? el.closest('.checklist-item') : null;
  if (checklistItem) {
    const textSpan = checklistItem.querySelector('.checklist-content') || checklistItem;
    const text = textSpan ? textSpan.innerText.replace(/\u00a0/g, ' ').trim() : '';

    if (range.startOffset === 0 || text === '') {
      e.preventDefault();
      if (text === '') {
        const prev = checklistItem.previousElementSibling;
        checklistItem.remove();
        if (canvas.childNodes.length === 0 || canvas.innerText.trim() === '') {
          canvas.innerHTML = '';
          canvas.focus();
        } else if (prev) {
          const newRange = document.createRange();
          newRange.selectNodeContents(prev);
          newRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } else {
          canvas.focus();
        }
      } else {
        const p = document.createElement('div');
        p.innerText = text;
        checklistItem.parentNode.insertBefore(p, checklistItem);
        checklistItem.remove();
        const newRange = document.createRange();
        newRange.setStart(p.firstChild || p, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      cleanupEmptyEditorCanvas();
      updateEditorStats();
      updateToolbarActiveStates();
      saveActiveNoteSilently();
      return;
    }
  }

  setTimeout(() => {
    cleanupEmptyEditorCanvas();
    updateEditorStats();
    updateToolbarActiveStates();
    saveActiveNoteSilently();
  }, 0);
}

function saveActiveNoteSilently() {
  if (!state.activeNoteId) return;
  const note = state.notes.find(n => n.id === state.activeNoteId);
  if (note) {
    const titleEl = document.getElementById('editor-note-title');
    const canvasEl = document.getElementById('editor-canvas');
    if (titleEl) note.title = titleEl.value.trim();
    if (canvasEl) note.content = canvasEl.innerHTML;
  }
}

function updateToolbarActiveStates() {
  const isUl = document.queryCommandState('insertUnorderedList');
  const isOl = document.queryCommandState('insertOrderedList');
  const ulBtn = document.getElementById('btn-format-ul');
  const olBtn = document.getElementById('btn-format-ol');
  const checkBtn = document.getElementById('btn-format-checklist');

  if (ulBtn) {
    if (isUl) {
      ulBtn.classList.add('bg-zinc-900', 'text-white');
      ulBtn.classList.remove('text-zinc-700', 'hover:bg-zinc-200/70');
    } else {
      ulBtn.classList.remove('bg-zinc-900', 'text-white');
      ulBtn.classList.add('text-zinc-700', 'hover:bg-zinc-200/70');
    }
  }

  if (olBtn) {
    if (isOl) {
      olBtn.classList.add('bg-zinc-900', 'text-white');
      olBtn.classList.remove('text-zinc-700', 'hover:bg-zinc-200/70');
    } else {
      olBtn.classList.remove('bg-zinc-900', 'text-white');
      olBtn.classList.add('text-zinc-700', 'hover:bg-zinc-200/70');
    }
  }

  if (checkBtn) {
    const sel = window.getSelection();
    let inChecklist = false;
    if (sel && sel.anchorNode) {
      const el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      if (el && el.closest('.checklist-item')) inChecklist = true;
    }
    if (inChecklist) {
      checkBtn.classList.add('bg-zinc-900', 'text-white');
      checkBtn.classList.remove('text-zinc-700', 'hover:bg-zinc-200/70');
    } else {
      checkBtn.classList.remove('bg-zinc-900', 'text-white');
      checkBtn.classList.add('text-zinc-700', 'hover:bg-zinc-200/70');
    }
  }
}

function toggleColorPicker() {
  const popover = document.getElementById('color-picker-popover');
  popover.classList.toggle('hidden');
}

function applyTextColor(hex) {
  document.execCommand('foreColor', false, hex);
  document.getElementById('active-color-dot').style.backgroundColor = hex;
  document.getElementById('color-picker-popover').classList.add('hidden');
}

function applyHighlightColor(hex) {
  document.execCommand('hiliteColor', false, hex);
  document.getElementById('color-picker-popover').classList.add('hidden');
}

/* ========== CALENDAR & TASKS IMPLEMENTATION ========== */
function renderCalendar() {
  const viewport = document.getElementById('calendar-viewport');
  if (!viewport) return;

  const monthSelect = document.getElementById('cal-month-select');
  if (monthSelect) monthSelect.value = state.calendarMonth;

  const yearInput = document.getElementById('cal-year-input');
  if (yearInput) yearInput.value = state.calendarYear;

  if (state.calendarViewType === 'month') {
    const daysInMonth = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(state.calendarYear, state.calendarMonth, 1).getDay();
    const prevMonthDays = new Date(state.calendarYear, state.calendarMonth, 0).getDate();

    let gridHtml = `
      <div class="grid grid-cols-7 text-center text-xs font-black text-zinc-500 uppercase tracking-wider py-1.5 w-full">
        <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
      </div>
      <div class="grid grid-cols-7 gap-1.5 sm:gap-2 text-xs w-full">
    `;

    for (let i = 0; i < firstDayIndex; i++) {
      gridHtml += `
        <div class="min-h-[68px] sm:min-h-[78px] p-1.5 sm:p-2 rounded-2xl border border-zinc-100 bg-zinc-50/40 text-zinc-300 font-semibold select-none flex flex-col justify-start">
          <span class="text-xs">${prevMonthDays - firstDayIndex + i + 1}</span>
        </div>
      `;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${state.calendarYear}-${String(state.calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSelected = state.selectedCalendarDate === dateString;
      const isToday = dateString === systemDateString;
      const dayTasks = state.tasks.filter(t => t.dueDate === dateString);

      let cellClass = isSelected
        ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/20'
        : isToday
        ? 'bg-amber-50/60 border-amber-300 font-bold text-zinc-900 ring-2 ring-amber-400/40 shadow-xs'
        : 'bg-white hover:bg-zinc-50 border-zinc-200/90 hover:border-zinc-400 text-zinc-800 shadow-2xs hover:shadow-xs';

      gridHtml += `
        <div onclick="selectCalendarDate('${dateString}')" class="group min-h-[68px] sm:min-h-[78px] p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${cellClass} overflow-hidden">
          <div class="flex items-center justify-between">
            <span class="w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center font-black text-xs ${isSelected ? 'bg-white text-zinc-900' : isToday ? 'bg-amber-400 text-amber-950' : 'text-zinc-800 group-hover:bg-zinc-100'}">
              ${d}
            </span>
            <div class="flex items-center gap-1">
              ${isToday && !isSelected ? '<span class="text-[9px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded-md font-extrabold uppercase hidden sm:inline">Today</span>' : ''}
              ${dayTasks.length > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-zinc-900 text-white'}">${dayTasks.length}</span>` : ''}
            </div>
          </div>

          <div class="space-y-1 my-1 overflow-hidden">
            ${dayTasks.map(t => {
              const typeObj = state.taskTypes.find(type => type.id === t.type) || state.taskTypes[0];
              return `
                <div onclick="event.stopPropagation(); completeTask(${t.id})" class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-[11px] font-bold truncate flex items-center justify-between gap-1 shadow-2xs border ${isSelected ? 'bg-white/20 text-white border-white/30' : `${typeObj.bg} ${typeObj.text} border-black/5 hover:scale-[1.02]`}" title="${t.title} (Click to complete)">
                  <div class="flex items-center gap-1 truncate min-w-0">
                    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${typeObj.dot}"></span>
                    <span class="truncate">${t.title}</span>
                  </div>
                  <span class="material-symbols-rounded text-xs opacity-60 flex-shrink-0">check</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    gridHtml += '</div>';
    viewport.innerHTML = gridHtml;
  } else if (state.calendarViewType === 'week') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    viewport.innerHTML = `
      <div class="grid grid-cols-7 gap-2">
        ${days.map((d, idx) => {
          const dayNum = ((idx + 1) % 28) || 1;
          const dateString = `${state.calendarYear}-${String(state.calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const weekTasks = state.tasks.filter(t => t.dueDate === dateString);
          return `
            <div class="bg-zinc-50 rounded-2xl p-3 border border-zinc-100 flex flex-col space-y-2 min-h-[220px]">
              <div class="border-b border-zinc-200/60 pb-1.5 flex items-center justify-between">
                <span class="text-xs font-bold text-zinc-500 uppercase">${d}</span>
                <span class="text-sm font-black text-zinc-900">${dayNum}</span>
              </div>
              <div class="space-y-1.5 flex-1">
                ${weekTasks.length === 0 ? '<span class="text-[10px] text-zinc-300 italic">No tasks</span>' : weekTasks.map(t => `
                  <div onclick="completeTask(${t.id})" class="p-1.5 bg-white border border-zinc-200/80 rounded-xl text-[11px] font-semibold text-zinc-800 shadow-2xs cursor-pointer hover:border-zinc-400">
                    <p class="truncate">${t.title}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (state.calendarViewType === 'day') {
    viewport.innerHTML = `
      <div class="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-zinc-200">
          <div>
            <h4 class="text-base font-black text-zinc-900">${monthNames[state.calendarMonth]} ${state.selectedCalendarDate.split('-')[2]}, ${state.calendarYear}</h4>
            <p class="text-xs text-zinc-400">Detailed hourly focus schedule</p>
          </div>
          <span class="text-xs font-bold bg-zinc-900 text-white px-2.5 py-1 rounded-xl">Today's Schedule</span>
        </div>
        <div class="space-y-2">
          ${['09:00 AM', '10:30 AM', '01:00 PM', '03:30 PM', '05:00 PM'].map(slot => {
            const matching = state.tasks.filter(t => t.time === slot);
            return `
              <div class="flex items-start gap-4 p-2 rounded-xl hover:bg-white transition-colors">
                <span class="w-16 text-xs font-mono font-bold text-zinc-400 pt-1">${slot}</span>
                <div class="flex-1 space-y-1.5">
                  ${matching.length === 0 ? '<div class="border border-dashed border-zinc-200 rounded-xl py-2 px-3 text-[11px] text-zinc-300">Free time slot</div>' : matching.map(t => `
                    <div onclick="completeTask(${t.id})" class="p-2.5 bg-white border border-zinc-200 rounded-xl flex items-center justify-between shadow-2xs cursor-pointer">
                      <span class="text-xs font-bold text-zinc-800">${t.title}</span>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">Task</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else {
    viewport.innerHTML = `
      <div class="space-y-2">
        ${state.tasks.length === 0 ? '<div class="py-8 text-center text-zinc-400 text-xs italic">No scheduled tasks in list view.</div>' : state.tasks.map(t => `
          <div onclick="completeTask(${t.id})" class="flex items-center justify-between p-3.5 bg-zinc-50 hover:bg-zinc-100/80 rounded-2xl border border-zinc-100 cursor-pointer">
            <div>
              <h5 class="text-sm font-bold text-zinc-900">${t.title}</h5>
              <p class="text-[11px] text-zinc-400">${t.dueDate} at${t.time}</p>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${t.priority === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}">${t.priority}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
}

function selectCalendarDate(dateStr) {
  state.selectedCalendarDate = dateStr;
  renderCalendar();
}

function changeMonth(delta) {
  state.calendarMonth += delta;
  if (state.calendarMonth > 11) {
    state.calendarMonth = 0;
    state.calendarYear++;
  } else if (state.calendarMonth < 0) {
    state.calendarMonth = 11;
    state.calendarYear--;
  }
  renderCalendar();
}

function handleMonthSelect(val) {
  state.calendarMonth = parseInt(val);
  renderCalendar();
}

function handleYearInput(val) {
  const year = parseInt(val);
  if (!isNaN(year) && year > 1900 && year < 2100) {
    state.calendarYear = year;
    renderCalendar();
  }
}

function setCalendarViewType(type) {
  state.calendarViewType = type;
  ['month', 'week', 'day', 'list'].forEach(t => {
    const btn = document.getElementById(`view-type-${t}`);
    if (btn) {
      if (t === type) {
        btn.className = 'px-3 py-1 rounded-xl text-xs font-bold bg-white text-zinc-900 shadow-xs cursor-pointer';
      } else {
        btn.className = 'px-3 py-1 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-900 cursor-pointer';
      }
    }
  });
  renderCalendar();
}

/* ==========================================================================
   TASK MANAGEMENT WITH AUTOMATIC DEADLINE-BASED PRIORITY & EMAIL REMINDERS
   ========================================================================== */

function getTaskPoints(priority) {
  const p = (priority || 'medium').toLowerCase();
  if (p === 'high') return 10000;
  if (p === 'low') return 5;
  return 7;
}

// Deadline Priority Rule:
// 1–2 days (or overdue/today) -> High
// 3–4 days (~4 days)          -> Medium
// 5+ days (1 week+)           -> Low
function calculatePriorityFromDate(dateStr) {
  if (!dateStr) return 'Medium';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays <= 2) return 'High';
  if (diffDays <= 4) return 'Medium';
  return 'Low';
}

function autoEvaluateModalPriority() {
  const dateInput = document.getElementById('new-task-due-date');
  const badge = document.getElementById('auto-priority-badge');
  if (!dateInput || !dateInput.value) return;

  const autoPri = calculatePriorityFromDate(dateInput.value);
  setTaskPriority(autoPri);

  if (badge) {
    badge.classList.remove('hidden');
    badge.classList.add('flex');
    if (autoPri === 'High') {
      badge.textContent = '⚡ Auto-set to High (Due in 1–2 days)';
      badge.className = 'text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1';
    } else if (autoPri === 'Medium') {
      badge.textContent = '⚡ Auto-set to Medium (Due in ~4 days)';
      badge.className = 'text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1';
    } else {
      badge.textContent = '⚡ Auto-set to Low (Due in 1 week+)';
      badge.className = 'text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1';
    }
  }
}

function completeTask(id) {
  const taskIndex = state.tasks.findIndex(t => t.id === id);
  if (taskIndex > -1) {
    const task = state.tasks.splice(taskIndex, 1)[0];
    task.completed = true;
    state.completedTasks.unshift(task);

    const pts = getTaskPoints(task.priority);
    state.points += pts;

    showToast(`Task completed! +${pts} points earned (${task.priority || 'Medium'} Priority) 🎉`);
    renderAll();
  }
}

function uncompleteTask(id) {
  const taskIndex = state.completedTasks.findIndex(t => t.id === id);
  if (taskIndex > -1) {
    const task = state.completedTasks.splice(taskIndex, 1)[0];
    task.completed = false;
    state.tasks.unshift(task);

    const pts = getTaskPoints(task.priority);
    state.points = Math.max(0, state.points - pts);

    showToast(`Task moved back to active (-${pts} points)`);
    renderAll();
  }
}

function deleteTask(id, fromCompleted = false) {
  let task;
  if (fromCompleted) {
    const idx = state.completedTasks.findIndex(t => t.id === id);
    if (idx > -1) task = state.completedTasks.splice(idx, 1)[0];
  } else {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx > -1) task = state.tasks.splice(idx, 1)[0];
  }
  if (task) {
    task.deletedAt = 'Just now';
    state.deletedTasks.unshift(task);
    showToast('Task moved to deleted.');
    renderAll();
  }
}

/* ==========================================================================
   TASK LIST RENDERER (STYLED TO MATCH CALENDAR VIEW)
   ========================================================================== */
function renderTasksLists() {
  const activeContainer = document.getElementById('active-tasks-list') || document.getElementById('active-tasks-container');
  const activeCountEl = document.getElementById('active-tasks-count');
  if (activeCountEl) activeCountEl.innerText = `${state.tasks.length} items`;

  if (activeContainer) {
    if (state.tasks.length === 0) {
      activeContainer.innerHTML = '<div class="py-8 text-center text-zinc-400 text-xs italic">No active tasks. Click "+ Add Task" to schedule one.</div>';
    } else {
      activeContainer.innerHTML = state.tasks.map(task => {
        // Resolve task category matching Calendar's task types
        const typeObj = (state.taskTypes || []).find(t => t.id === task.type) || {
          label: 'Task',
          bg: 'bg-zinc-100',
          text: 'text-zinc-800',
          dot: 'bg-zinc-400'
        };

        // Priority badges matching Calendar's color palette
        let priorityClasses = 'bg-amber-100 text-amber-800';
        if (task.priority === 'High') priorityClasses = 'bg-rose-100 text-rose-700';
        else if (task.priority === 'Low') priorityClasses = 'bg-emerald-100 text-emerald-800';

        const displayTime = task.time || task.dueTime || '';
        const dateSubtitle = task.dueDate 
          ? `${task.dueDate}${displayTime ? ` at ${displayTime}` : ''}`
          : 'No scheduled date';

        return `
          <div class="group flex items-center justify-between p-3.5 bg-zinc-50 hover:bg-zinc-100/80 rounded-2xl border border-zinc-100/90 hover:border-zinc-200 transition-all gap-3 cursor-pointer">
            <label class="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0" onclick="event.stopPropagation()">
              <!-- Checkbox -->
              <input 
                type="checkbox" 
                onchange="completeTask(${task.id})" 
                class="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-0 cursor-pointer flex-shrink-0" 
              />
              
              <!-- Title, Category Pill & Due Date -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h5 class="text-sm font-bold text-zinc-900 truncate leading-snug">${escapeHtml(task.title)}</h5>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${typeObj.bg} ${typeObj.text} flex-shrink-0">
                    <span class="w-1.5 h-1.5 rounded-full ${typeObj.dot}"></span>
                    <span>${typeObj.label}</span>
                  </span>
                </div>
                <p class="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1 font-medium truncate">
                  <span class="material-symbols-rounded text-xs text-zinc-400">event</span>
                  <span>${dateSubtitle}</span>
                </p>
              </div>
            </label>

            <!-- Priority Chip & Delete Button -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${priorityClasses} flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                <span>${task.priority}</span>
              </span>
              <button 
                onclick="event.stopPropagation(); deleteTask(${task.id})" 
                class="w-7 h-7 rounded-lg flex items-center justify-center p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex-shrink-0 cursor-pointer" 
                title="Delete task"
              >
                <span class="material-symbols-rounded text-sm">delete</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Completed Tasks List
  const completedContainer = document.getElementById('completed-tasks-list');
  const completedCountEl = document.getElementById('completed-tasks-count');
  if (completedCountEl) completedCountEl.innerText = `${state.completedTasks.length} items`;

  if (completedContainer) {
    if (state.completedTasks.length === 0) {
      completedContainer.innerHTML = '<div class="py-6 text-center text-zinc-400 text-xs italic">Completed tasks will appear here. (+5 Low, +7 Med, +10 High)</div>';
    } else {
      completedContainer.innerHTML = state.completedTasks.map(task => `
        <div class="flex items-center justify-between p-3 bg-zinc-50/60 rounded-2xl border border-zinc-100 gap-2">
          <label class="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0 pr-2">
            <input type="checkbox" checked onchange="uncompleteTask(${task.id})" class="w-4 h-4 rounded text-zinc-900 border-zinc-300 cursor-pointer flex-shrink-0" />
            <span class="text-sm font-semibold text-zinc-400 line-through truncate">${escapeHtml(task.title)}</span>
          </label>
          <button onclick="deleteTask(${task.id}, true)" class="w-7 h-7 rounded-lg flex items-center justify-center p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex-shrink-0 cursor-pointer" title="Delete task">
            <span class="material-symbols-rounded text-sm">delete</span>
          </button>
        </div>
      `).join('');
    }
  }

  // Deleted Tasks List
  const deletedContainer = document.getElementById('deleted-tasks-list');
  const deletedCountEl = document.getElementById('deleted-tasks-count');
  if (deletedCountEl) deletedCountEl.innerText = `${state.deletedTasks.length} items`;

  if (deletedContainer) {
    if (state.deletedTasks.length === 0) {
      deletedContainer.innerHTML = '<div class="py-4 text-center text-zinc-400 text-xs italic">No deleted tasks.</div>';
    } else {
      deletedContainer.innerHTML = state.deletedTasks.map(task => `
        <div class="p-2.5 bg-zinc-50 rounded-xl text-xs text-zinc-400 flex items-center justify-between">
          <span class="line-through truncate">${escapeHtml(task.title)}</span>
          <span class="text-[10px]">${task.deletedAt || ''}</span>
        </div>
      `).join('');
    }
  }
}


  // Completed Tasks List
  const completedContainer = document.getElementById('completed-tasks-list');
  const completedCountEl = document.getElementById('completed-tasks-count');
  if (completedCountEl) completedCountEl.innerText = `${state.completedTasks.length} items`;

  if (completedContainer) {
    if (state.completedTasks.length === 0) {
      completedContainer.innerHTML = '<div class="py-6 text-center text-zinc-400 text-xs italic">Completed tasks will appear here. (+5 Low, +7 Med, +10 High)</div>';
    } else {
      completedContainer.innerHTML = state.completedTasks.map(task => `
        <div class="flex items-center justify-between p-3 bg-zinc-50/60 rounded-2xl border border-zinc-100 gap-2">
          <label class="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0 pr-2">
            <input type="checkbox" checked onchange="uncompleteTask(${task.id})" class="w-4 h-4 rounded text-zinc-900 border-zinc-300 cursor-pointer flex-shrink-0" />
            <span class="text-sm font-semibold text-zinc-400 line-through truncate">${escapeHtml(task.title)}</span>
          </label>
          <button onclick="deleteTask(${task.id}, true)" class="w-7 h-7 rounded-lg flex items-center justify-center p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex-shrink-0 cursor-pointer" title="Delete task">
            <span class="material-symbols-rounded text-sm">delete</span>
          </button>
        </div>
      `).join('');
    }
  }

  // Deleted Tasks List
  const deletedContainer = document.getElementById('deleted-tasks-list');
  const deletedCountEl = document.getElementById('deleted-tasks-count');
  if (deletedCountEl) deletedCountEl.innerText = `${state.deletedTasks.length} items`;

  if (deletedContainer) {
    if (state.deletedTasks.length === 0) {
      deletedContainer.innerHTML = '<div class="py-4 text-center text-zinc-400 text-xs italic">No deleted tasks.</div>';
    } else {
      deletedContainer.innerHTML = state.deletedTasks.map(task => `
        <div class="p-2.5 bg-zinc-50 rounded-xl text-xs text-zinc-400 flex items-center justify-between">
          <span class="line-through truncate">${escapeHtml(task.title)}</span>
          <span class="text-[10px]">${task.deletedAt || ''}</span>
        </div>
      `).join('');
    }
  }


function openTaskModal(specificDate = null) {
  document.getElementById('new-task-title-input').value = '';
  clearTaskTitleError();
  const dateInput = document.getElementById('new-task-due-date');
  dateInput.value = specificDate || state.selectedCalendarDate || systemDateString;
  dateInput.onchange = autoEvaluateModalPriority;

  autoEvaluateModalPriority();
  document.getElementById('modal-task').classList.remove('hidden');
}

function closeTaskModal() {
  document.getElementById('modal-task').classList.add('hidden');
  clearTaskTitleError();
}

function clearTaskTitleError() {
  const errorEl = document.getElementById('task-title-error');
  const titleInput = document.getElementById('new-task-title-input');
  if (errorEl) errorEl.classList.add('hidden');
  if (titleInput) titleInput.classList.remove('border-rose-400');
}

function renderTaskTypePills() {
  const container = document.getElementById('task-type-pills');
  if (!container) return;
  container.innerHTML = state.taskTypes.map(type => `
    <button
      type="button"
      onclick="selectTaskType('${type.id}')"
      class="px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${state.selectedTaskType === type.id ? 'border-zinc-900 bg-zinc-900 text-white shadow-2xs' : `${type.bg}${type.text} border-transparent hover:border-zinc-300`}"
    >
      <span class="w-1.5 h-1.5 rounded-full ${type.dot}"></span>
      <span>${type.label}</span>
    </button>
  `).join('');
}

function selectTaskType(typeId) {
  state.selectedTaskType = typeId;
  renderTaskTypePills();
}

function toggleAddCustomType() {
  document.getElementById('custom-type-input-bar').classList.toggle('hidden');
}

function submitCustomType() {
  const input = document.getElementById('custom-type-name-input');
  const val = input.value.trim();
  if (!val) return;
  const newType = {
    id: val.toLowerCase().replace(/\s+/g, '-'),
    label: val,
    bg: 'bg-teal-100',
    text: 'text-teal-800',
    dot: 'bg-teal-500'
  };
  state.taskTypes.push(newType);
  state.selectedTaskType = newType.id;
  input.value = '';
  document.getElementById('custom-type-input-bar').classList.add('hidden');
  renderTaskTypePills();
  showToast(`Added task type "${newType.label}"`);
}

function setTaskPriority(pri) {
  state.selectedPriority = pri;
  const pLower = (pri || 'medium').toLowerCase();

  ['low', 'medium', 'high'].forEach(p => {
    const btn = document.getElementById(`priority-btn-${p}`);
    if (!btn) return;
    if (p === pLower) {
      if (p === 'medium') btn.className = 'priority-btn py-2 px-3 rounded-2xl text-xs font-bold border border-amber-400 bg-amber-50 text-amber-900 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs';
      else if (p === 'high') btn.className = 'priority-btn py-2 px-3 rounded-2xl text-xs font-bold border border-rose-500 bg-rose-50 text-rose-900 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs';
      else btn.className = 'priority-btn py-2 px-3 rounded-2xl text-xs font-bold border border-emerald-500 bg-emerald-50 text-emerald-900 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs';
    } else {
      btn.className = 'priority-btn py-2 px-3 rounded-2xl text-xs font-bold border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 flex items-center justify-center gap-1.5 cursor-pointer';
    }
  });
}


// Background scanner: upgrades priority as deadlines approach and triggers reminders
function checkUpcomingTaskDeadlines() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  state.tasks.forEach(task => {
    if (!task.completed && task.dueDate) {
      const updatedPri = calculatePriorityFromDate(task.dueDate);
      task.priority = updatedPri;

      if (updatedPri === 'High' && task.emailReminder && !task.emailReminderSent) {
        task.emailReminderSent = true;
        showToast(`📧 Reminder sent to angelineee@gmail.com: "${task.title}" is due soon! (High Priority)`);
      }
    }
  });

  renderTasksLists();
  renderCalendar();
}

setInterval(checkUpcomingTaskDeadlines, 60000);

/* ==========================================================================
   AUTOMATIC PRIORITY EVALUATION & EMAIL REMINDER ENGINE
   ========================================================================== */

// 1. Manually or programmatically update the priority UI buttons
function setTaskPriority(level) {
  state.selectedPriority = level;

  const btnLow = document.getElementById('priority-btn-low');
  const btnMed = document.getElementById('priority-btn-medium');
  const btnHigh = document.getElementById('priority-btn-high');
  const badge = document.getElementById('auto-priority-badge');

  // Reset styles
  [btnLow, btnMed, btnHigh].forEach(btn => {
    if (btn) {
      btn.className = 'priority-btn py-2 px-3 rounded-2xl text-xs font-bold border border-zinc-200 bg-zinc-50 text-zinc-600 flex items-center justify-center gap-1.5 cursor-pointer transition-all';
    }
  });

  if (level === 'Low' && btnLow) {
    btnLow.className = 'priority-btn py-2 px-3 rounded-2xl text-xs font-bold border border-emerald-400 bg-emerald-50 text-emerald-900 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs';
  } else if (level === 'Medium' && btnMed) {
    btnMed.className = 'priority-btn py-2 px-3 rounded-2xl text-xs font-bold border border-amber-400 bg-amber-50 text-amber-900 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs';
  } else if (level === 'High' && btnHigh) {
    btnHigh.className = 'priority-btn py-2 px-3 rounded-2xl text-xs font-bold border border-rose-500 bg-rose-50 text-rose-900 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs';
  }

  // Hide badge if user manually switches away from High
  if (level !== 'High' && badge) {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
  }
}

// 2. Evaluates the selected date inside the modal as soon as it is picked
function autoEvaluateModalPriority() {
  const dateInput = document.getElementById('new-task-due-date');
  const badge = document.getElementById('auto-priority-badge');
  if (!dateInput || !dateInput.value) return;

  const selectedDate = new Date(dateInput.value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  selectedDate.setHours(0, 0, 0, 0);

  const diffTime = selectedDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 2) {
    // 1-2 days from now (or today/overdue) -> High
    setTaskPriority('High');
    if (badge) {
      badge.textContent = '⚡ Auto-set to High (Due in 1–2 days)';
      badge.className = 'text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1';
    }
  } else if (diffDays <= 4) {
    // 3-4 days from now -> Medium
    setTaskPriority('Medium');
    if (badge) {
      badge.textContent = '⚡ Auto-set to Medium (Due in ~4 days)';
      badge.className = 'text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1';
    }
  } else {
    // 5+ days / 1 week+ from now -> Low
    setTaskPriority('Low');
    if (badge) {
      badge.textContent = '⚡ Auto-set to Low (Due in 1 week+)';
      badge.className = 'text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1';
    }
  }
}

// 3. Task submission with email reminder flags
function submitNewTask() {
  const titleInput = document.getElementById('new-task-title-input');
  const titleError = document.getElementById('task-title-error');
  const title = titleInput ? titleInput.value.trim() : '';

  if (!title) {
    if (titleError) titleError.classList.remove('hidden');
    if (titleInput) titleInput.classList.add('border-rose-400');
    return;
  }

  const dueDate = document.getElementById('new-task-due-date')?.value || '';
  const hour = (document.getElementById('new-task-hour')?.value || '10').padStart(2, '0');
  const min = (document.getElementById('new-task-minute')?.value || '30').padStart(2, '0');
  const ampm = document.getElementById('new-task-ampm')?.value || 'AM';
  const allowEmailReminder = document.getElementById('new-task-email-reminder')?.checked ?? true;

  // Compute final priority
  const finalPriority = state.selectedPriority || calculatePriorityFromDate(dueDate);

  const newTask = {
    id: Date.now(),
    title: title,
    dueDate: dueDate,
    dueTime: `${hour}:${min} ${ampm}`,
    time: `${hour}:${min} ${ampm}`,
    type: state.selectedTaskType || 'study',
    priority: finalPriority,
    completed: false,
    emailReminder: allowEmailReminder,
    emailReminderSent: false
  };

  if (!state.tasks) state.tasks = [];
  state.tasks.unshift(newTask);

  closeTaskModal();

  // FIX: Force immediate render across active tasks list, calendar, and counters
  renderAll();

  // Send simulated reminder email if task is in the 1-2 day window
  if (finalPriority === 'High') {
    newTask.emailReminderSent = true;
    showToast(`📧 Email alert sent to angelineee@gmail.com: "${title}" is due in 1–2 days!`);
  } else {
    showToast(`Task "${title}" created successfully.`);
  }
}

function clearTaskTitleError() {
  const titleInput = document.getElementById('new-task-title-input');
  const titleError = document.getElementById('task-title-error');
  if (titleError) titleError.classList.add('hidden');
  if (titleInput) titleInput.classList.remove('border-rose-400');
}

// 4. Background deadline checker with email notifications
function checkUpcomingTaskDeadlines() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const userEmail = 'angelineee@gmail.com'; // Replace with actual user email in production

  state.tasks.forEach(task => {
    if (!task.completed && task.dueDate) {
      const due = new Date(task.dueDate);
      due.setHours(0, 0, 0, 0);

      const diffTime = due - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Dynamic priority adjustment based on remaining days
      if (diffDays <= 2) {
        task.priority = 'High';

        // Trigger email notification once when task enters the 1-2 day window
        if (task.emailReminder && !task.emailReminderSent) {
          task.emailReminderSent = true;
          showToast(`📧 Email alert sent to ${userEmail}: "${task.title}" is due in 1–2 days! (Priority: High)`);
        }
      } else if (diffDays <= 4) {
        task.priority = 'Medium';
      } else {
        task.priority = 'Low';
      }
    }
  });

  if (typeof renderCalendarTasks === 'function') renderCalendarTasks();
  if (typeof renderDashboardNotes === 'function') renderDashboardNotes();
}

// 5. Periodic check (runs on startup & every 60 seconds)
setInterval(checkUpcomingTaskDeadlines, 60000);

/* ==========================================================================
   PERSONALIZATION RENDERING & REWARDS ENGINE
   ========================================================================== */

function renderPersonalization() {
  renderThemeSection('themes-basic-grid', BASIC_THEMES);
  renderThemeSection('themes-artwork-grid', ARTWORK_THEMES);
  renderThemeSection('themes-animated-grid', ANIMATED_THEMES);
  renderFontsGrid();
}

function renderThemeSection(containerId, themeList) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = themeList.map(theme => {
    const isUnlocked = state.unlockedThemes.includes(theme.id);
    const isActive = state.activeTheme === theme.id;
    const isArtwork = theme.id.startsWith('art-');
    const isAnimated = theme.id.startsWith('anim-');

    // Apply live background textures/animations to cards
    let bannerClasses = `bg-gradient-to-tr ${theme.previewClass}`;
    if (isArtwork) {
      bannerClasses = `${theme.bgClass} border border-zinc-900/10`;
    } else if (isAnimated) {
      bannerClasses = `${theme.bgClass} animated-card-preview border border-white/20`;
    }

    return `
      <div class="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs flex flex-col justify-between space-y-3.5 hover:border-zinc-300 transition-all">
        <!-- Live Visual Preview Banner -->
        <div class="h-28 rounded-2xl ${bannerClasses} relative p-3 flex flex-col justify-between text-white shadow-inner overflow-hidden">
          <div class="flex items-center justify-between z-10">
            ${isAnimated ? `
              <span class="text-[9px] font-black uppercase tracking-wider bg-black/50 backdrop-blur-xs px-2.5 py-1 rounded-full text-cyan-300 flex items-center gap-1.5 shadow-xs">
                <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                <span>Live Motion</span>
              </span>
            ` : isArtwork ? `
              <span class="text-[9px] font-bold uppercase tracking-wider bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded-full text-zinc-200">
                Pattern
              </span>
            ` : '<span></span>'}

            ${!isUnlocked ? `
              <div class="bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-full text-[10px] font-bold">
                ${theme.cost} pts
              </div>
            ` : `
              <span class="material-symbols-rounded text-sm bg-black/40 backdrop-blur-xs rounded-full p-0.5 text-emerald-400 font-bold">check</span>
            `}
          </div>

          <!-- Unlock Progress Bar -->
          <div class="w-full bg-black/30 h-1.5 rounded-full overflow-hidden mt-auto z-10 backdrop-blur-xs">
            <div class="bg-white h-full transition-all duration-300" style="width: ${isUnlocked ? '100%' : `${Math.min(100, (state.points / theme.cost) * 100)}%`}"></div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <div class="truncate">
            <h3 class="font-bold text-xs text-zinc-900 truncate">${theme.name}</h3>
            <p class="text-[10px] text-zinc-400">${isActive ? 'Active' : isUnlocked ? 'Unlocked' : `${theme.cost} pts`}</p>
          </div>
          <button onclick="handleThemeAction('${theme.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
            isActive
              ? 'bg-zinc-100 text-zinc-900 cursor-default'
              : isUnlocked
              ? 'bg-zinc-900 text-white hover:bg-zinc-800'
              : state.points >= theme.cost
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
          }">
            ${isActive ? 'Active' : isUnlocked ? 'Apply' : 'Unlock'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderFontsGrid() {
  const container = document.getElementById('fonts-grid');
  if (!container) return;

  container.innerHTML = FONT_STYLES.map(font => {
    const isUnlocked = state.unlockedFonts.includes(font.id);
    const isActive = state.activeFont === font.id;
    return `
      <div class="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs flex flex-col justify-between space-y-3 hover:border-zinc-300 transition-all">
        <div class="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
          <span class="text-[10px] font-bold text-zinc-400 block mb-1">PREVIEW</span>
          <p class="${font.fontClass} text-sm text-zinc-800 leading-snug truncate">${font.sample}</p>
        </div>

        <div class="flex items-center justify-between gap-2">
          <div class="truncate">
            <h3 class="font-bold text-xs text-zinc-900 truncate">${font.name}</h3>
            <p class="text-[10px] text-zinc-400">${isActive ? 'Current Font' : isUnlocked ? 'Unlocked' : `${font.cost} pts`}</p>
          </div>
          <button onclick="handleFontAction('${font.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
            isActive
              ? 'bg-zinc-100 text-zinc-900 cursor-default'
              : isUnlocked
              ? 'bg-zinc-900 text-white hover:bg-zinc-800'
              : state.points >= font.cost
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
          }">
            ${isActive ? 'Active' : isUnlocked ? 'Apply' : 'Unlock'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function handleThemeAction(themeId) {
  const allThemes = [...BASIC_THEMES, ...ARTWORK_THEMES, ...ANIMATED_THEMES];
  const theme = allThemes.find(t => t.id === themeId);
  if (!theme) return;

  if (state.unlockedThemes.includes(themeId)) {
    applyThemeClass(theme);
    renderPersonalization();
    showToast(`${theme.name} applied!`);
    return;
  }

  state.targetRedeemItem = { type: 'theme', item: theme };
  const desc = document.getElementById('redeem-modal-desc');
  if (desc) {
    desc.innerHTML = `Unlock <strong class="text-zinc-900">${theme.name}</strong> for <strong class="text-zinc-900 font-extrabold">${theme.cost} points</strong>?`;
  }
  document.getElementById('modal-redeem').classList.remove('hidden');
}

function handleFontAction(fontId) {
  const font = FONT_STYLES.find(f => f.id === fontId);
  if (!font) return;

  if (state.unlockedFonts.includes(fontId)) {
    applyFontClass(font);
    renderPersonalization();
    showToast(`Font changed to ${font.name}!`);
    return;
  }

  state.targetRedeemItem = { type: 'font', item: font };
  const desc = document.getElementById('redeem-modal-desc');
  if (desc) {
    desc.innerHTML = `Unlock <strong class="text-zinc-900">${font.name}</strong> font for <strong class="text-zinc-900 font-extrabold">${font.cost} points</strong>?`;
  }
  document.getElementById('modal-redeem').classList.remove('hidden');
}

function confirmRedeemItem() {
  if (!state.targetRedeemItem) return;
  const { type, item } = state.targetRedeemItem;

  if (state.points < item.cost) {
    showToast(`Not enough points. Need ${item.cost - state.points} more.`);
    closeRedeemModal();
    return;
  }

  state.points -= item.cost;

  if (type === 'theme') {
    state.unlockedThemes.push(item.id);
    applyThemeClass(item);
  } else if (type === 'font') {
    state.unlockedFonts.push(item.id);
    applyFontClass(item);
  }

  closeRedeemModal();
  renderAll();
  showToast(`Unlocked and applied ${item.name}! ✨`);
}

function confirmRedeemTheme() {
  confirmRedeemItem();
}

function closeRedeemModal() {
  const modal = document.getElementById('modal-redeem');
  if (modal) modal.classList.add('hidden');
  state.targetRedeemItem = null;
}

function toggleDarkMode() {
  state.isDarkMode = !state.isDarkMode;

  if (state.isDarkMode && state.activeTheme !== 'monochrome') {
    state.activeTheme = 'monochrome';
  }

  updateDarkModeUI();
  renderPersonalization();
  showToast(state.isDarkMode ? 'Monochrome Dark Mode enabled 🌙' : 'Light Mode restored ☀️');
}

function updateDarkModeUI() {
  const isDark = !!state.isDarkMode;

  // Toggle class on root & body so the CSS filter triggers instantly
  document.documentElement.classList.toggle('dark-theme', isDark);
  document.body.classList.toggle('dark-theme', isDark);

  // Sync Personalization toggle switch UI if present
  const toggleBtn = document.getElementById('feature-dark-toggle');
  if (toggleBtn) {
    toggleBtn.className = `w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer flex-shrink-0 ${
      isDark ? 'bg-zinc-900' : 'bg-zinc-300'
    }`;
    if (toggleBtn.firstElementChild) {
      toggleBtn.firstElementChild.className = `w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
        isDark ? 'translate-x-6' : 'translate-x-0'
      }`;
    }
  }
}
function applyThemeClass(theme) {
  state.activeTheme = theme.id;
  localStorage.setItem('noted_active_theme', theme.id);

  const body = document.getElementById('app-body');
  if (!body) return;

  if (theme.id !== 'monochrome' && state.isDarkMode) {
    state.isDarkMode = false;
    localStorage.setItem('noted_dark_mode', 'false');
    updateDarkModeUI();
  }

  body.className = body.className
    .replace(/bg-\[[^\]]+\]/g, '')
    .replace(/bg-animated-\w+/g, '')
    .replace(/bg-art-\w+/g, '')
    .trim();

  body.style.backgroundColor = '';
  body.style.backgroundImage = '';
  body.style.animation = '';

  if (!state.isDarkMode) {
    body.classList.add(theme.bgClass);
  }
}

function applyFontClass(font) {
  state.activeFont = font.id;
  localStorage.setItem('noted_active_font', font.id);

  const body = document.getElementById('app-body');
  if (!body) return;

  body.className = body.className.replace(/font-app-\w+/g, '').trim();
  body.classList.add(font.fontClass);
}

function toggleDarkMode() {
  state.isDarkMode = !state.isDarkMode;
  localStorage.setItem('noted_dark_mode', state.isDarkMode ? 'true' : 'false');

  if (state.isDarkMode && state.activeTheme !== 'monochrome') {
    state.activeTheme = 'monochrome';
    localStorage.setItem('noted_active_theme', 'monochrome');
  }

  updateDarkModeUI();
  renderPersonalization();
  showToast(state.isDarkMode ? 'Monochrome Dark Mode enabled 🌙' : 'Light Mode restored ☀️');
}

function applyFontClass(font) {
  state.activeFont = font.id;
  const body = document.getElementById('app-body');
  if (!body) return;

  body.className = body.className.replace(/font-app-\w+/g, '').trim();
  body.classList.add(font.fontClass);
}

function updateTimerWidgetsUI() {
  const isEnabled = !!state.featureTimer;
  const prefixes = ['cal', 'dash'];

  prefixes.forEach(prefix => {
    const widget = document.getElementById(`${prefix}-timer-widget`);
    if (!widget) return;

    const controls = document.getElementById(`${prefix}-timer-controls-area`) || widget.querySelector('.timer-controls-area');
    const badge = document.getElementById(`${prefix}-timer-disabled-badge`) || widget.querySelector('.timer-disabled-badge');
    const enableBtn = document.getElementById(`${prefix}-timer-enable-btn`) || widget.querySelector('.timer-enable-btn');
    const activeActions = widget.querySelector('.timer-active-header-actions');

    if (isEnabled) {
      // 1. Enabled State
      widget.classList.remove('bg-zinc-50/60', 'bg-zinc-50/70', 'border-dashed');
      if (controls) controls.classList.remove('opacity-35', 'pointer-events-none', 'grayscale');
      if (badge) badge.classList.add('hidden');
      if (enableBtn) {
        enableBtn.classList.add('hidden');
        enableBtn.classList.remove('flex');
      }
      if (activeActions) activeActions.classList.remove('hidden');
    } else {
      // 2. Disabled State: Display remains visible, but greyed out and locked
      widget.classList.add('bg-zinc-50/60', 'border-dashed');
      if (controls) controls.classList.add('opacity-35', 'pointer-events-none', 'grayscale');
      if (badge) badge.classList.remove('hidden');
      if (enableBtn) {
        enableBtn.classList.remove('hidden');
        enableBtn.classList.add('flex');
      }
      if (activeActions) activeActions.classList.add('hidden');
    }
  });

  // Keep Next Break pills in sync across all views
  const nextPills = document.querySelectorAll('.next-pill');
  nextPills.forEach(pill => {
    if (isEnabled) {
      pill.classList.remove('hidden');
    } else {
      pill.classList.add('hidden');
    }
  });

  // Synchronize Personalization page switch if present
  const toggleBtn = document.getElementById('feature-timer-toggle');
  if (toggleBtn) {
    toggleBtn.className = `w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${isEnabled ? 'bg-zinc-900' : 'bg-zinc-300'}`;
    if (toggleBtn.firstElementChild) {
      toggleBtn.firstElementChild.className = `w-5 h-5 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-0'} shadow-xs`;
    }
  }
}

function toggleSystemFeature(feat) {
  if (feat === 'timer') {
    state.featureTimer = !state.featureTimer;

    // Pause ticking if user disables the timer mid-session
    if (!state.featureTimer && state.timerRunning) {
      pauseTimer();
    }

    updateTimerWidgetsUI();
    showToast(state.featureTimer ? 'Focus Timer activated ⏱️' : 'Focus Timer disabled');
  } else if (feat === 'games') {
    state.featureGames = !state.featureGames;
    const toggleBtn = document.getElementById('feature-games-toggle');
    if (toggleBtn) {
      toggleBtn.className = `w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${state.featureGames ? 'bg-zinc-900' : 'bg-zinc-300'}`;
      toggleBtn.firstElementChild.className = `w-5 h-5 rounded-full bg-white transition-transform ${state.featureGames ? 'translate-x-6' : 'translate-x-0'}`;
    }
  }
}

/* ========== DIALOGS & UTILITIES ========== */
function openLogoutModal() { document.getElementById('modal-logout').classList.remove('hidden'); }
function closeLogoutModal() { document.getElementById('modal-logout').classList.add('hidden'); }
function confirmLogout() {
  closeLogoutModal();
  showToast('Logged out successfully.');
}

function openBreakModal() { document.getElementById('modal-break').classList.remove('hidden'); }
function closeBreakModal() { document.getElementById('modal-break').classList.add('hidden'); }
function acceptBreakGame() {
  closeBreakModal();
  window.location.href = 'GameMenu.html';
}

function openCreateNoteModal() {
  document.getElementById('modal-quick-note-title').value = '';
  document.getElementById('modal-create-note').classList.remove('hidden');
  setTimeout(() => document.getElementById('modal-quick-note-title').focus(), 50);
}
function closeCreateNoteModal() { document.getElementById('modal-create-note').classList.add('hidden'); }
function submitQuickNote() {
  const title = document.getElementById('modal-quick-note-title').value.trim();
  const newNote = {
    id: Date.now(),
    title,
    content: '',
    created: 'Just now'
  };
  state.notes.unshift(newNote);
  state.activeNoteId = newNote.id;
  closeCreateNoteModal();
  renderAll();
  selectNote(newNote.id);
  showToast('New note created.');
}

function toggleCollapsible(listId, chevronId) {
  const list = document.getElementById(listId);
  const chevron = document.getElementById(chevronId);
  list.classList.toggle('hidden');
  if (chevron) chevron.classList.toggle('rotate-180');
}

function showToast(msg) {
  const toast = document.getElementById('toast-notification');
  document.getElementById('toast-text').innerText = msg;
  toast.classList.remove('-translate-y-16', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('-translate-y-16', 'opacity-0');
  }, 3200);
}

function renderAll() {
  updatePointsDisplay();
  updateTimerDisplays();
  renderSidebar();
  renderDashboardNotes();
  renderCalendar();
  renderTasksLists();
  renderPersonalization();
  renderTaskTypePills();
}

/* ==========================================================================
   GOOGLE DOCS-STYLE DRAGGABLE ANNOTATION CONTROLLER
   ========================================================================== */
let savedSelectionRange = null;
let currentActiveMark = null;
let hideViewTimeout = null;

function makeDraggable(element, handleSelector) {
  let isDragging = false;
  let startX, startY, origLeft, origTop;

  const handle = element.querySelector(handleSelector) || element;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = element.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;

    element.style.transform = 'none';
    element.style.left = `${origLeft}px`;
    element.style.top = `${origTop}px`;
    element.dataset.userDragged = "true";

    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const maxLeft = window.innerWidth - element.offsetWidth - 12;
    const maxTop = window.innerHeight - element.offsetHeight - 12;

    element.style.left = `${Math.max(12, Math.min(maxLeft, origLeft + dx))}px`;
    element.style.top = `${Math.max(12, Math.min(maxTop, origTop + dy))}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
    }
  });
}

function saveEditorSelection() {
  const sel = window.getSelection();
  const canvas = document.getElementById('editor-canvas');
  const bar = document.getElementById('floating-annotate-bar');
  const card = document.getElementById('floating-comment-card');

  checkCaretAnnotation();

  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    if (bar && card && card.classList.contains('hidden')) {
      bar.classList.add('hidden');
    }
    return;
  }

  const range = sel.getRangeAt(0);
  if (!canvas || !canvas.contains(range.commonAncestorContainer)) {
    if (bar) bar.classList.add('hidden');
    return;
  }

  savedSelectionRange = range.cloneRange();
  const rect = range.getBoundingClientRect();

  if (rect.width > 0 && bar && card.classList.contains('hidden')) {
    bar.style.transform = 'none';
    bar.style.top = `${Math.max(10, rect.top - 42)}px`;
    bar.style.left = `${Math.min(window.innerWidth - bar.offsetWidth - 20, rect.right + 8)}px`;
    bar.classList.remove('hidden');
  }
}

function openFloatingCommentInput() {
  const bar = document.getElementById('floating-annotate-bar');
  const card = document.getElementById('floating-comment-card');
  const textarea = document.getElementById('floating-comment-textarea');
  if (!bar || !card || !savedSelectionRange) return;

  const rect = savedSelectionRange.getBoundingClientRect();
  bar.classList.add('hidden');

  delete card.dataset.userDragged;
  card.style.transform = 'none';

  card.style.top = `${Math.min(window.innerHeight - card.offsetHeight - 20, Math.max(10, rect.top - 20))}px`;
  card.style.left = `${Math.min(window.innerWidth - card.offsetWidth - 20, rect.right + 12)}px`;
  card.classList.remove('hidden');

  if (textarea) {
    textarea.value = '';
    setTimeout(() => textarea.focus(), 60);
  }
}

function closeFloatingCommentCard() {
  const card = document.getElementById('floating-comment-card');
  const bar = document.getElementById('floating-annotate-bar');
  if (card) card.classList.add('hidden');
  if (bar) bar.classList.add('hidden');
}

function confirmFloatingAnnotation() {
  const textarea = document.getElementById('floating-comment-textarea');
  const comment = textarea.value.trim();
  const canvas = document.getElementById('editor-canvas');

  if (!comment || !savedSelectionRange || !canvas) {
    closeFloatingCommentCard();
    return;
  }

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedSelectionRange);

  const selectedContent = savedSelectionRange.extractContents();

  const mark = document.createElement('mark');
  mark.className = 'annotated-word';
  mark.setAttribute('data-annotation', comment);
  mark.appendChild(selectedContent);

  savedSelectionRange.insertNode(mark);
  savedSelectionRange.setStartAfter(mark);
  savedSelectionRange.collapse(true);
  sel.removeAllRanges();

  closeFloatingCommentCard();
  updateEditorStats();
  saveActiveNoteSilently();
  showToast('Annotation added ✨');
}

function showAnnotationViewCard(markEl) {
  clearTimeout(hideViewTimeout);
  currentActiveMark = markEl;

  const viewCard = document.getElementById('floating-annotation-view');
  const commentText = document.getElementById('view-card-comment-text');
  const pinIndicator = document.getElementById('view-card-pin-indicator');
  const pinBtnText = document.querySelector('#btn-view-toggle-pin .pin-text');
  if (!viewCard || !markEl) return;

  const comment = markEl.getAttribute('data-annotation') || '';
  const isPinned = markEl.classList.contains('pinned');

  commentText.innerText = comment;
  if (isPinned) {
    pinIndicator.classList.remove('hidden');
    pinBtnText.innerText = 'Unpin';
  } else {
    pinIndicator.classList.add('hidden');
    pinBtnText.innerText = 'Pin';
  }

  if (!viewCard.dataset.userDragged) {
    const rect = markEl.getBoundingClientRect();
    viewCard.style.transform = 'none';
    viewCard.style.top = `${Math.max(10, rect.top - 10)}px`;
    viewCard.style.left = `${Math.min(window.innerWidth - viewCard.offsetWidth - 20, rect.right + 12)}px`;
  }

  viewCard.classList.remove('hidden');
}

function scheduleHideAnnotationViewCard() {
  hideViewTimeout = setTimeout(() => {
    if (currentActiveMark && currentActiveMark.classList.contains('pinned')) return;
    const viewCard = document.getElementById('floating-annotation-view');
    if (viewCard) {
      viewCard.classList.add('hidden');
      delete viewCard.dataset.userDragged;
    }
    currentActiveMark = null;
  }, 250);
}

function checkCaretAnnotation() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  const node = sel.anchorNode;
  if (!node) return;

  const mark = node.nodeType === 1 ? node.closest('.annotated-word') : node.parentElement?.closest('.annotated-word');

  if (mark) {
    document.querySelectorAll('.annotated-word.active-caret').forEach(el => el.classList.remove('active-caret'));
    mark.classList.add('active-caret');
    showAnnotationViewCard(mark);
  } else {
    document.querySelectorAll('.annotated-word.active-caret').forEach(el => el.classList.remove('active-caret'));
    scheduleHideAnnotationViewCard();
  }
}

function handlePinActiveAnnotation() {
  if (!currentActiveMark) return;
  const isPinned = currentActiveMark.classList.toggle('pinned');
  showAnnotationViewCard(currentActiveMark);
  saveActiveNoteSilently();
  showToast(isPinned ? 'Annotation pinned in place 📌' : 'Annotation unpinned');
}

function handleDeleteActiveAnnotation() {
  if (!currentActiveMark) return;
  const originalText = currentActiveMark.innerText;
  const textNode = document.createTextNode(originalText);
  currentActiveMark.parentNode.replaceChild(textNode, currentActiveMark);

  const viewCard = document.getElementById('floating-annotation-view');
  if (viewCard) {
    viewCard.classList.add('hidden');
    delete viewCard.dataset.userDragged;
  }
  currentActiveMark = null;

  updateEditorStats();
  saveActiveNoteSilently();
  showToast('Annotation removed.');
}

/* ========== GLOBAL EVENT HANDLERS & INITIALIZATION ========== */
document.addEventListener('mouseover', (e) => {
  const mark = e.target.closest('.annotated-word');
  if (mark) {
    showAnnotationViewCard(mark);
  }
});

document.addEventListener('mouseout', (e) => {
  const mark = e.target.closest('.annotated-word');
  const viewCard = e.relatedTarget?.closest('#floating-annotation-view');
  if (mark && !viewCard) {
    scheduleHideAnnotationViewCard();
  }
});

const viewCardEl = document.getElementById('floating-annotation-view');
if (viewCardEl) {
  viewCardEl.addEventListener('mouseenter', () => clearTimeout(hideViewTimeout));
  viewCardEl.addEventListener('mouseleave', () => scheduleHideAnnotationViewCard());
}

document.addEventListener('mousedown', (e) => {
  const bar = document.getElementById('floating-annotate-bar');
  const card = document.getElementById('floating-comment-card');
  const viewCard = document.getElementById('floating-annotation-view');

  if (bar && !bar.contains(e.target) && card && !card.contains(e.target)) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      bar.classList.add('hidden');
    }
  }

  if (viewCard && !viewCard.contains(e.target) && !e.target.closest('.annotated-word')) {
    if (currentActiveMark && !currentActiveMark.classList.contains('pinned')) {
      viewCard.classList.add('hidden');
      delete viewCard.dataset.userDragged;
      currentActiveMark = null;
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  updateDarkModeUI();
  const monthSelect = document.getElementById('cal-month-select');
  if (monthSelect) {
    monthSelect.innerHTML = monthNames.map((m, idx) => `<option value="${idx}">${m}</option>`).join('');
    monthSelect.value = state.calendarMonth;
  }

  const yearInput = document.getElementById('cal-year-input');
  if (yearInput) {
    yearInput.value = state.calendarYear;
  }

  const dueDateInput = document.getElementById('new-task-due-date');
  if (dueDateInput) {
    dueDateInput.value = state.selectedCalendarDate;
  }

  setupStepperListeners();
  restoreTimerState();
  switchView('dashboard');
  updateTimerWidgetsUI();
  renderAll();

  const composerCard = document.getElementById('floating-comment-card');
  const viewCard = document.getElementById('floating-annotation-view');
  if (composerCard) makeDraggable(composerCard, '.drag-handle');
  if (viewCard) makeDraggable(viewCard, '.drag-handle');

  const canvas = document.getElementById('editor-canvas');
  if (canvas) {
    canvas.addEventListener('mouseup', saveEditorSelection);
    canvas.addEventListener('keyup', (e) => {
      saveEditorSelection();
      updateToolbarActiveStates();
      updateEditorStats();
    });
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        handleEditorBackspace(e);
      }
    });
  }
});