import isElectron from 'is-electron';
import Mousetrap from 'mousetrap';

import { Engine } from './engine';

type ClickType = 'left' | 'middle' | 'right';
type InputNamespace = 'in-game' | 'chat' | 'inventory' | 'menu' | '*';
type InputOccasion = 'keydown' | 'keypress' | 'keyup';
type ClickCallbacks = { callback: () => void; namespace: InputNamespace }[];
type ScrollCallbacks = { up: (delta?: number) => void; down: (delta?: number) => void; namespace: InputNamespace }[];

class Inputs {
  public namespace: InputNamespace = 'menu';
  public combos: Map<string, string> = new Map();
  public callbacks: Map<string, () => void> = new Map();
  public clickCallbacks: Map<ClickType, ClickCallbacks> = new Map();
  public scrollCallbacks: ScrollCallbacks = [];

  private unbinds: (() => void)[] = [];

  constructor(public engine: Engine) {
    this.add('forward', 'w');
    this.add('backward', 's');
    this.add('left', 'a');
    this.add('right', 'd');
    this.add('space', 'space');
    this.add('dbl-space', 'space space');
    this.add('esc', 'esc');
    this.add('up', 'up');
    this.add('down', 'down');
    this.add('enter', 'enter');
    this.add('tab', 'tab');

    this.initEventPrevents();
    this.initClickListener();
    this.initScrollListener();
  }

  initEventPrevents = () => {
    if (isElectron()) {
      const listener = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (this.engine.locked) {
            this.engine.unlock();
          }
        }
      };

      // add event listener to document to unlock control
      document.addEventListener('keyup', listener);
      this.unbinds.push(() => document.removeEventListener('keyup', listener));
    }
  };

  initClickListener = () => {
    (['left', 'middle', 'right'] as ClickType[]).forEach((type) => this.clickCallbacks.set(type, []));

    const listener = ({ button }) => {
      if (!this.engine.locked) return;

      let callbacks: ClickCallbacks = [];

      if (button === 0) callbacks = this.clickCallbacks.get('left');
      else if (button === 1) callbacks = this.clickCallbacks.get('middle');
      else if (button === 2) callbacks = this.clickCallbacks.get('right');

      callbacks.forEach(({ namespace, callback }) => {
        if (this.namespace === namespace) callback();
      });
    };

    document.addEventListener('mousedown', listener, false);
    this.unbinds.push(() => document.removeEventListener('mousedown', listener, false));
  };

  initScrollListener = () => {
    const listener = ({ deltaY }) => {
      if (!this.engine.locked) return;

      this.scrollCallbacks.forEach(({ up, down, namespace }) => {
        if (this.namespace === namespace) {
          if (deltaY > 0) up(deltaY);
          else if (deltaY < 0) down(deltaY);
        }
      });
    };

    document.addEventListener('wheel', listener);
    this.unbinds.push(() => document.removeEventListener('wheel', listener));
  };

  click = (type: ClickType, callback: () => void, namespace: InputNamespace) => {
    this.clickCallbacks.get(type).push({ namespace, callback });
  };

  scroll = (up: (delta?: number) => void, down: (delta?: number) => void, namespace: InputNamespace) => {
    this.scrollCallbacks.push({ up, down, namespace });
  };

  add = (name: string, combo: string) => {
    this.combos.set(name, combo);
  };

  bind = (
    name: string,
    callback: () => void,
    namespace: InputNamespace,
    { occasion = 'keydown', element }: { occasion?: InputOccasion; element?: HTMLElement } = {},
  ) => {
    let combo = this.combos.get(name);

    if (!combo) {
      if (name.length === 1) {
        // single keys
        this.add(name, name);
        combo = name;
      } else {
        throw new Error(`Error registering input, combo ${name}: not found.`);
      }
    }

    const mousetrap = element ? new Mousetrap(element) : Mousetrap;

    mousetrap.bind(
      combo,
      () => {
        if (this.namespace === namespace || namespace === '*') callback();
        return false;
      },
      occasion,
    );

    this.unbinds.push(() => {
      mousetrap.unbind(combo, occasion);
    });
  };

  setNamespace = (namespace: InputNamespace) => {
    this.namespace = namespace;
  };

  dispose = () => {
    this.unbinds.forEach((fn) => fn());
  };
}

export { Inputs };
