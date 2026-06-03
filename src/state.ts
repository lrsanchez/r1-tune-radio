import type { Station } from './api';

export type Mode = 'browse' | 'playing' | 'search';

export interface AppState {
  mode: Mode;
  stations: Station[];
  index: number;
  nowTuning: Station | null;
  playing: boolean;
  buffering: boolean;
  error: boolean;
  searchResults: Station[];
  selResult: number;
}

export const state: AppState = {
  mode: 'browse',
  stations: [],
  index: 0,
  nowTuning: null,
  playing: false,
  buffering: false,
  error: false,
  searchResults: [],
  selResult: 0,
};
