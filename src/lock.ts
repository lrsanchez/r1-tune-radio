const PIN = (import.meta.env['VITE_PIN'] as string | undefined) ?? '';
const SESSION_KEY = 'r1-radio-unlocked';

let digits: string[] = [];

function isUnlocked() {
  return !PIN || sessionStorage.getItem(SESSION_KEY) === '1';
}

function render() {
  const container = document.getElementById('lockDigits')!;
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const el = document.createElement('div');
    el.className = 'pd' + (digits[i] !== undefined ? ' filled' : i === digits.length ? ' active' : '');
    el.textContent = digits[i] !== undefined ? '•' : '';
    container.appendChild(el);
  }
}

function setError(msg: string) {
  document.getElementById('lockErr')!.textContent = msg;
}

function submit(onUnlock: () => void) {
  if (digits.length < 6) { setError('enter all 6 digits'); return; }
  if (digits.join('') === PIN) {
    sessionStorage.setItem(SESSION_KEY, '1');
    onUnlock();
  } else {
    setError('wrong pin');
    digits = [];
    render();
  }
}

export function initLock(onUnlock: () => void) {
  if (isUnlocked()) { onUnlock(); return; }

  // show lock, hide status bar
  const lockEl = document.getElementById('lock')!;
  lockEl.classList.add('active');
  (document.querySelector('.statusbar') as HTMLElement).style.display = 'none';

  render();

  document.getElementById('lock')!.addEventListener('click', e => {
    const btn = (e.target as Element).closest('[data-k]') as HTMLElement | null;
    if (!btn) return;
    const k = btn.dataset['k']!;
    setError('');
    if (k === 'del') { digits.pop(); render(); }
    else if (k === 'ok') { submit(onUnlock); }
    else if (digits.length < 6) { digits.push(k); render(); if (digits.length === 6) submit(onUnlock); }
  });

  // keyboard support for desktop testing
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lock')!.classList.contains('active')) return;
    if (e.key >= '0' && e.key <= '9' && digits.length < 6) { digits.push(e.key); render(); if (digits.length === 6) submit(onUnlock); }
    if (e.key === 'Backspace') { digits.pop(); render(); }
    if (e.key === 'Enter') { submit(onUnlock); }
  });
}

export function dismissLock() {
  const lockEl = document.getElementById('lock')!;
  lockEl.classList.remove('active');
  (document.querySelector('.statusbar') as HTMLElement).style.display = '';
}
