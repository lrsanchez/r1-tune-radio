let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let hlsInstance: { destroy(): void; loadSource(s: string): void; attachMedia(el: HTMLMediaElement): void; once(e: string, fn: () => void): void } | null = null;

export const audio = new Audio();
audio.crossOrigin = 'anonymous';

type AudioEventType = 'playing' | 'paused' | 'buffering' | 'error';
const listeners: ((e: AudioEventType) => void)[] = [];
function emit(e: AudioEventType) { listeners.forEach(fn => fn(e)); }

export function onAudioEvent(fn: (e: AudioEventType) => void) { listeners.push(fn); }

let intentionallyPaused = false;
let savedStream = '';
let savedCodec = 'mp3';

// Only emit from native events when NOT in an intentional-pause state
audio.addEventListener('waiting', () => { if (!intentionallyPaused) emit('buffering'); });
audio.addEventListener('playing', () => { if (!intentionallyPaused) emit('playing'); });
audio.addEventListener('error',   () => { if (!intentionallyPaused) emit('error'); });
// pause event is handled manually — we emit 'paused' ourselves in pause()

export function initAudioContext() {
  if (ctx) return;
  ctx = new AudioContext();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  const source = ctx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(ctx.destination);
}

export function getFrequencyData(): Uint8Array {
  if (!analyser) return new Uint8Array(32).fill(0);
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  return data;
}

export async function playStream(stream: string, codec: string): Promise<void> {
  intentionallyPaused = false;
  savedStream = stream;
  savedCodec = codec;

  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }

  if (codec === 'hls') {
    const { default: Hls } = await import('hls.js');
    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsInstance = hls;
      hls.loadSource(stream);
      hls.attachMedia(audio);
      hls.once(Hls.Events.MANIFEST_PARSED, () => { audio.play().catch(() => {}); });
      return;
    }
  }
  audio.src = stream;
  audio.play().catch(() => {});
}

export function pause() {
  intentionallyPaused = true;
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  audio.pause();
  audio.src = ''; // fully stop — prevents live-stream CDN reconnect
  emit('paused');
}

export function resume() {
  if (!savedStream) return;
  playStream(savedStream, savedCodec);
}

export function togglePause() {
  if (intentionallyPaused) resume();
  else pause();
}

export function isPaused() { return intentionallyPaused; }
