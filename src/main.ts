import { api, type Station } from './api';
import { state } from './state';
import { audio, onAudioEvent, initAudioContext, getFrequencyData, playStream, togglePause } from './audio';
import { buildFilmstrip, renderDial, renderPlaying, renderSearch, show, setHint, animateVU, resultsEl } from './render';
import { initLock, dismissLock } from './lock';

// ---- recently played (localStorage) ----
const RECENTS_KEY = 'r1-radio-recents';
const MAX_RECENTS = 8;

function loadRecents(): Station[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]'); } catch { return []; }
}

function saveRecent(station: Station) {
  const list = loadRecents().filter(s => s.id !== station.id);
  list.unshift(station);
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS))); } catch {}
}

async function doTune(station = state.stations[state.index]) {
  if (!station) return;
  initAudioContext();
  state.mode = 'playing';
  state.nowTuning = station;
  state.buffering = true;
  state.error = false;
  state.playing = false;
  show('playing');
  renderPlaying(state);
  saveRecent(station);
  try {
    const { stream, codec } = await api.tune(station.id);
    await playStream(stream, codec);
  } catch {
    state.error = true;
    state.buffering = false;
    renderPlaying(state);
  }
}

// ---- navigate dial ----
function navigate(delta: number) {
  const max = state.stations.length - 1;
  if (max < 0) return;
  state.index = Math.max(0, Math.min(max, state.index + delta));
  if (state.mode !== 'browse') {
    state.mode = 'browse';
    show('browse');
    // audio keeps playing while browsing
  }
  renderDial(state);
  // no auto-tune — user pushes PTT to play the highlighted station
}

// ---- play/pause ----
function handlePrimaryAction() {
  if (state.mode === 'playing') {
    initAudioContext();
    togglePause();
  } else if (state.mode === 'browse') {
    doTune();
  } else if (state.mode === 'search') {
    closeSearch();
  }
}

// ---- search ----
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const qInput = document.getElementById('q') as HTMLInputElement;

function runSearch(q: string) {
  if (!q.trim()) {
    state.searchResults = [];
    state.selResult = 0;
    renderSearch(state);
    return;
  }
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    try {
      const { stations } = await api.search(q);
      state.searchResults = stations;
      state.selResult = 0;
      renderSearch(state);
    } catch {}
  }, 300);
}

function openSearch() {
  state.mode = 'search';
  show('search');
  state.searchResults = loadRecents();
  state.selResult = 0;
  qInput.value = '';
  renderSearch(state);
  qInput.focus();
}

function closeSearch() {
  state.mode = 'browse';
  show('browse');
  renderDial(state);
}

function selectSearchResult(index: number) {
  const s = state.searchResults[index];
  if (s) doTune(s);
}

// ---- audio events → state ----
onAudioEvent(e => {
  if (e === 'playing')   { state.playing = true;  state.buffering = false; state.error = false; }
  if (e === 'paused')    { state.playing = false; state.buffering = false; }
  if (e === 'buffering') { state.buffering = true; state.playing = false; }
  if (e === 'error')     { state.error = true;    state.buffering = false; state.playing = false; }
  if (state.mode === 'playing') renderPlaying(state);
});

// ---- VU animation loop ----
function vuLoop() {
  animateVU(state.playing && !audio.paused, getFrequencyData);
  requestAnimationFrame(vuLoop);
}
requestAnimationFrame(vuLoop);

// ---- R1 hardware events ----
window.addEventListener('scrollUp', () => {
  if (state.mode === 'search') {
    state.selResult = Math.max(0, state.selResult - 1);
    renderSearch(state);
    resultsEl.children[state.selResult]?.scrollIntoView({ block: 'nearest' });
  } else {
    navigate(-1);
  }
});
window.addEventListener('scrollDown', () => {
  if (state.mode === 'search') {
    state.selResult = Math.min(state.searchResults.length - 1, state.selResult + 1);
    renderSearch(state);
    resultsEl.children[state.selResult]?.scrollIntoView({ block: 'nearest' });
  } else {
    navigate(1);
  }
});
// PTT short: in search = back to browse; in browse = play; in playing = pause
window.addEventListener('sideClick', () => {
  if (state.mode === 'search') closeSearch();
  else handlePrimaryAction();
});
window.addEventListener('longPressStart', () => openSearch());
window.addEventListener('longPressEnd',   () => {});

// ---- desktop: mouse wheel on screen ----
document.querySelector('.screen')!.addEventListener('wheel', e => {
  if (state.mode === 'search') return;
  e.preventDefault();
  navigate((e as WheelEvent).deltaY > 0 ? 1 : -1);
}, { passive: false });

// ---- desktop: drag physical wheel graphic ----
let dragY: number | null = null;
const wheelEl = document.getElementById('wheel')!;
wheelEl.addEventListener('pointerdown', e => { dragY = e.clientY; wheelEl.style.cursor = 'grabbing'; });
window.addEventListener('pointermove', e => {
  if (dragY === null) return;
  if (Math.abs(e.clientY - dragY) > 16) { navigate(e.clientY > dragY ? 1 : -1); dragY = e.clientY; }
});
window.addEventListener('pointerup', () => { dragY = null; wheelEl.style.cursor = 'grab'; });

// ---- tap/click handlers ----
document.getElementById('ptt')!.addEventListener('click', handlePrimaryAction);
// Tap playing screen → back to browse (audio keeps going)
document.getElementById('playing')!.addEventListener('click', () => {
  state.mode = 'browse';
  show('browse');
  renderDial(state);
});
document.getElementById('openSearch')!.addEventListener('click', openSearch);

// ---- search input ----
qInput.addEventListener('input', () => runSearch(qInput.value));

// ---- result clicks (event delegation) ----
resultsEl.addEventListener('click', e => {
  const el = (e.target as Element).closest('.result') as HTMLElement | null;
  if (!el) return;
  const id = el.dataset['id'];
  const i = state.searchResults.findIndex(s => s.id === id);
  if (i >= 0) selectSearchResult(i);
});

// ---- keyboard (desktop) ----
document.addEventListener('keydown', e => {
  if (state.mode === 'search') {
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      state.selResult = Math.max(0, Math.min(state.searchResults.length - 1, state.selResult + (e.key === 'ArrowDown' ? 1 : -1)));
      renderSearch(state);
      return;
    }
    if (e.key === 'Enter') { selectSearchResult(state.selResult); return; }
    return;
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { navigate(1); return; }
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { navigate(-1); return; }
  if (e.key === 'Enter') { handlePrimaryAction(); return; }
  if (e.key === 'Escape') { show('browse'); state.mode = 'browse'; }
});

// ---- boot ----
initLock(async () => {
  dismissLock();
  show('browse');
  state.mode = 'browse';
  setHint('▼ loading…');
  try {
    const recents = loadRecents();
    const { stations: rockStations } = await api.search('rock');
    const recentIds = new Set(recents.map(s => s.id));
    const list = [...recents, ...rockStations.filter(s => !recentIds.has(s.id))].slice(0, 30);
    state.stations = list;
    buildFilmstrip(list, recents.length, i => {
      state.index = i;
      renderDial(state);
      doTune();
    });
    renderDial(state);
    setHint('▼ push to play');
  } catch {
    setHint('⚠ proxy unreachable');
  }
});
