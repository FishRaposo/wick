// Accessible DOM menus for pause and settings. The canvas keeps the gameplay surface; dialogs
// carry focus, labels and announcements so keyboard and screen-reader users can operate them.

import type { Settings } from '../platform/settings.ts';

export interface SettingsHandlers {
  onChange: (settings: Settings) => void;
  onFullscreen: () => void;
}

export interface PauseHandlers extends SettingsHandlers {
  onResume: () => void;
  onNewRun: () => void;
}

export class Menus {
  root: HTMLElement;
  announcer: HTMLElement;
  dialog: HTMLDialogElement | null = null;
  returnFocus: HTMLElement | null = null;

  constructor(root: HTMLElement, announcer: HTMLElement) {
    this.root = root;
    this.announcer = announcer;
  }

  get isOpen(): boolean {
    return this.dialog?.open === true;
  }

  announce(text: string): void {
    this.announcer.textContent = text;
  }

  close(): void {
    if (this.dialog?.open) this.dialog.close();
  }

  private settingsFields(settings: Settings, handlers: SettingsHandlers): DocumentFragment {
    const frag = document.createDocumentFragment();
    const row = (id: string, label: string, control: HTMLElement): HTMLLabelElement => {
      const el = document.createElement('label');
      el.className = 'row';
      el.htmlFor = id;
      el.textContent = label;
      el.append(control);
      return el;
    };
    const range = (id: string, value: number, onInput: (n: number) => void): HTMLInputElement => {
      const input = document.createElement('input');
      input.id = id;
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '5';
      input.value = String(Math.round(value * 100));
      input.addEventListener('input', () => onInput(Number(input.value) / 100));
      return input;
    };
    const check = (id: string, checked: boolean, onChange: (v: boolean) => void): HTMLInputElement => {
      const input = document.createElement('input');
      input.id = id;
      input.type = 'checkbox';
      input.checked = checked;
      input.addEventListener('change', () => onChange(input.checked));
      return input;
    };

    frag.append(
      row('wick-volume', 'Volume', range('wick-volume', settings.volume, (v) => handlers.onChange({ ...settings, volume: v }))),
      row('wick-mute', 'Mute', check('wick-mute', settings.muted, (v) => handlers.onChange({ ...settings, muted: v }))),
      row('wick-shake', 'Screen shake', range('wick-shake', settings.shake, (v) => handlers.onChange({ ...settings, shake: v }))),
      row('wick-flashes', 'Flashes', range('wick-flashes', settings.flashes, (v) => handlers.onChange({ ...settings, flashes: v }))),
      row('wick-reduced', 'Reduce motion', check('wick-reduced', settings.reducedMotion, (v) => handlers.onChange({ ...settings, reducedMotion: v }))),
    );
    const full = document.createElement('button');
    full.type = 'button';
    full.textContent = 'Fullscreen';
    full.addEventListener('click', handlers.onFullscreen);
    frag.append(full);
    return frag;
  }

  private open(title: string, body: Node, actions: HTMLElement[], onClose?: () => void): void {
    this.close();
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'wick-menu-title');
    const heading = document.createElement('h2');
    heading.id = 'wick-menu-title';
    heading.textContent = title;
    const content = document.createElement('div');
    content.append(body);
    const bar = document.createElement('div');
    bar.className = 'actions';
    for (const action of actions) bar.append(action);
    dialog.append(heading, content, bar);
    dialog.addEventListener('close', () => {
      dialog.remove();
      this.dialog = null;
      this.returnFocus?.focus();
      onClose?.();
    });
    this.root.append(dialog);
    this.dialog = dialog;
    dialog.showModal();
  }

  openPause(settings: Settings, handlers: PauseHandlers): void {
    const resume = document.createElement('button');
    resume.type = 'button';
    resume.textContent = 'Resume';
    resume.addEventListener('click', () => {
      this.close();
      handlers.onResume();
    });
    const fresh = document.createElement('button');
    fresh.type = 'button';
    fresh.textContent = 'New run';
    fresh.addEventListener('click', () => {
      this.close();
      handlers.onNewRun();
    });
    const body = document.createElement('div');
    body.append(this.settingsFields(settings, handlers));
    this.open('Paused', body, [resume, fresh], handlers.onResume);
  }

  openSettings(settings: Settings, handlers: SettingsHandlers, onClose?: () => void): void {
    const body = document.createElement('div');
    body.append(this.settingsFields(settings, handlers));
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => this.close());
    this.open('Settings', body, [close], onClose);
  }
}
