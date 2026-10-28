export {};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    __wick: unknown;
  }
}
