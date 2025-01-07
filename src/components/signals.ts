import { batch, Signal } from "@preact/signals-react";
import { createContext, useContext } from "react";

class Linked {
  #linked: Signal<boolean>;
  #signals = new Map<LinkedSignal<any>, Signal<any>>();
  constructor(linked = true) {
    this.#linked = new Signal(linked);
  }

  get value() {
    return this.#linked.value;
  }

  set value(value: boolean) {
    if (this.#linked.value === value) return;
    if (!value) {
      this.#linked.value = false;
      return;
    }

    batch(() => {
      for (const [link, signal] of this.#signals.entries()) {
        link.syncLocal(signal);
      }
      this.#linked.value = true;
    });
  }

  peek() {
    return this.#linked.peek();
  }

  get(signal: LinkedSignal<any>) {
    if (!this.#signals.has(signal)) {
      this.#signals.set(signal, new Signal(signal.value));
    }

    return this.#signals.get(signal)!;
  }
}

export const LinkedContext = createContext<Linked>(new Linked());

export class LinkedSignal<T> {
  #parent: Signal<T>;
  constructor(value: T | Signal<T>) {
    this.#parent = value instanceof Signal ? value : new Signal(value);
  }

  set value(value: T) {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const linked = useContext(LinkedContext);
      if (linked.value) this.value = value;
      linked.get(this).value = value;
    } catch (e) {
      this.#parent.value = value;
    }
  }

  get value() {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const linked = useContext(LinkedContext);
      if (linked.value) return this.#parent.value;
      return linked.get(this).value;
    } catch (e) {
      return this.#parent.value;
    }
  }

  peek(): T {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const linked = useContext(LinkedContext);
      if (linked.peek()) return this.#parent.peek();
      return linked.get(this).peek();
    } catch (e) {
      return this.#parent.peek();
    }
  }

  syncLocal(signal: Signal<T>) {
    signal.value = this.#parent.value;
  }
}