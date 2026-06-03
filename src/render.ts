import type { Station } from './api';
import type { AppState } from './state';

const CHIP_W = 92; // 78px + 14px gap
const COLORS = ['#FF4500','#e8b04b','#d96a3a','#5aa0d6','#c43a3a','#7d8bd6','#6abf9a','#d6a05a','#4aab6d','#b06ab3'];

export function initials(name: string): string {
  return name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

export function chipColor(id: string): string {
  let h = 0;
  for (const c of id) h = ((h * 31) + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length]!;
}

// DOM refs
const film = document.getElementById('film')!;
const dialName = document.getElementById('dialName')!;
const dialSub = document.getElementById('dialSub')!;
const hint = document.getElementById('hint')!;
const npLogo = document.getElementById('npLogo')!;
const playState = document.getElementById('playState')!;
const npName = document.getElementById('npName')!;
const npTrack = document.getElementById('npTrack')!;
const transport = document.getElementById('transport')!;
const stat = document.getElementById('stat')!;
const resultsEl = document.getElementById('results')!;
const vuEl = document.getElementById('vu')!;
const searchBtn = document.getElementById('openSearch') as HTMLButtonElement;

// build VU bars once
for (let i = 0; i < 16; i++) {
  const b = document.createElement('i');
  vuEl.appendChild(b);
}

export function buildFilmstrip(stations: Station[], recentCount: number, onSelect: (i: number) => void) {
  film.innerHTML = '';
  stations.forEach((s, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.dataset['i'] = String(i);
    const color = chipColor(s.id);
    const badge = i < recentCount ? '<div class="chip-badge">▶ recent</div>' : '';
    chip.innerHTML = `<div class="logo" style="background:${color}">${initials(s.name)}</div><div class="nm">${s.name}</div>${badge}`;
    chip.addEventListener('click', () => onSelect(i));
    film.appendChild(chip);
  });
}

export function renderDial(state: AppState) {
  const { stations, index } = state;
  film.style.transform = `translate(calc(-50% - ${index * CHIP_W}px - 39px), -50%)`;
  [...film.children].forEach((c, i) => c.classList.toggle('center', i === index));
  const s = stations[index];
  if (!s) return;
  dialName.textContent = s.name;
  dialSub.textContent = s.nowPlaying ?? 'live radio';
}

export function renderPlaying(state: AppState) {
  const s = state.nowTuning;
  if (!s) return;
  const color = chipColor(s.id);
  npLogo.textContent = initials(s.name);
  (npLogo as HTMLElement).style.background = color;
  npName.textContent = s.name;
  npTrack.textContent = s.nowPlaying ? `♪ ${s.nowPlaying}  ·  ` : 'live radio  ·  ';

  if (state.error) {
    npLogo.className = 'np-logo is-paused';
    playState.textContent = '⚠';
    transport.textContent = 'off air — tap to browse another';
    stat.textContent = 'OFF AIR';
  } else if (state.buffering) {
    npLogo.className = 'np-logo';
    playState.textContent = '~';
    transport.textContent = 'connecting…';
    stat.textContent = 'BUFFERING';
  } else if (state.playing) {
    npLogo.className = 'np-logo is-playing';
    playState.textContent = '▶';
    transport.textContent = 'push to pause · tap to browse';
    stat.textContent = 'STREAMING';
  } else {
    npLogo.className = 'np-logo is-paused';
    playState.textContent = '⏸';
    transport.textContent = 'push to resume · tap to browse';
    stat.textContent = 'PAUSED';
  }
}

export function renderSearch(state: AppState) {
  const { searchResults, selResult } = state;
  if (!searchResults.length) {
    resultsEl.innerHTML = '<div class="kbd-note" style="padding:14px">no stations found</div>';
    return;
  }
  resultsEl.innerHTML = searchResults.map((s, i) => {
    const color = chipColor(s.id);
    return `<div class="result ${i === selResult ? 'sel' : ''}" data-id="${s.id}">
      <div class="logo" style="background:${color}">${initials(s.name)}</div>
      <div class="info">
        <div class="r-nm">${s.name}</div>
        <div class="r-sub">${s.nowPlaying ?? ''}</div>
      </div>
    </div>`;
  }).join('');
}

export function show(mode: AppState['mode']) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById(mode)!.classList.add('active');
  searchBtn.style.visibility = mode === 'search' ? 'hidden' : 'visible';
}

export function setHint(text: string) {
  hint.textContent = text;
}

export function animateVU(isPlaying: boolean, getData: () => Uint8Array) {
  const bars = [...vuEl.children] as HTMLElement[];
  const data = getData();
  bars.forEach((b, i) => {
    const raw = isPlaying ? (data[i] ?? 0) : 0;
    const h = isPlaying ? 4 + (raw / 255) * 24 : 4;
    b.style.height = `${h}px`;
    b.style.opacity = isPlaying ? '0.85' : '0.25';
  });
}

export { resultsEl };
