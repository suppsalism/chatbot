/**
 * A small SolidJS-style push-based signal store (spec §8). No virtual DOM,
 * no diffing — effects mutate real nodes directly.
 */

const MAX_EFFECT_DEPTH = 200;

const effectStack = []; // reactive tracking context — "who is reading right now"
const ownerStack = []; // disposal ownership context — "who created this effect"

let batchDepth = 0;
let pendingEffects = null;
let runDepth = 0;

function currentObserver() {
  return effectStack[effectStack.length - 1];
}

function currentOwner() {
  return ownerStack[ownerStack.length - 1];
}

function runEffects(effects) {
  for (const effect of effects) {
    try {
      effect.execute();
    } catch (error) {
      console.error('[ss-chat] effect threw', error);
    }
  }
}

function notify(subscribers) {
  if (subscribers.size === 0) return;
  const effects = [...subscribers];

  if (batchDepth > 0) {
    for (const effect of effects) pendingEffects.add(effect);
    return;
  }

  runEffects(effects);
}

/** @returns {[() => T, (next: T | ((prev: T) => T)) => void]} */
export function createSignal(initialValue, options = {}) {
  const equals = options.equals ?? Object.is;
  let value = initialValue;
  const subscribers = new Set();

  function read() {
    const observer = currentObserver();
    if (observer) {
      subscribers.add(observer);
      observer.sources.add(subscribers);
    }
    return value;
  }

  function write(next) {
    const nextValue = typeof next === 'function' ? next(value) : next;
    if (equals(value, nextValue)) return;
    value = nextValue;
    notify(subscribers);
  }

  return [read, write];
}

/** Runs fn immediately and re-runs it whenever a signal it read changes. */
export function createEffect(fn) {
  const effect = {
    sources: new Set(),
    cleanup: null,
    disposed: false,
    execute() {
      if (effect.disposed) return;

      runDepth += 1;
      if (runDepth > MAX_EFFECT_DEPTH) {
        runDepth -= 1;
        throw new Error(
          '[ss-chat] reactive update exceeded max depth — an effect is writing a signal it reads'
        );
      }

      for (const subscribers of effect.sources) subscribers.delete(effect);
      effect.sources.clear();
      if (typeof effect.cleanup === 'function') {
        effect.cleanup();
        effect.cleanup = null;
      }

      effectStack.push(effect);
      try {
        const result = fn();
        if (typeof result === 'function') effect.cleanup = result;
      } finally {
        effectStack.pop();
        runDepth -= 1;
      }
    },
    dispose() {
      if (effect.disposed) return;
      effect.disposed = true;
      for (const subscribers of effect.sources) subscribers.delete(effect);
      effect.sources.clear();
      if (typeof effect.cleanup === 'function') {
        effect.cleanup();
        effect.cleanup = null;
      }
    },
  };

  currentOwner()?.effects.push(effect);
  effect.execute();
  return effect.dispose;
}

/** A derived read-only signal. */
export function createMemo(fn) {
  const [read, write] = createSignal(undefined);
  createEffect(() => write(fn()));
  return read;
}

/** Runs fn, coalescing every signal write inside it into one effect pass. */
export function batch(fn) {
  const isOutermost = batchDepth === 0;
  if (isOutermost) pendingEffects = new Set();
  batchDepth += 1;

  try {
    return fn();
  } finally {
    batchDepth -= 1;
    if (isOutermost) {
      const effects = pendingEffects;
      pendingEffects = null;
      runEffects(effects);
    }
  }
}

/**
 * Creates an ownership scope. Every effect (including ones created inside
 * memos) made while fn runs is tracked; calling dispose() unsubscribes all
 * of them and runs their cleanups. This is what makes destroy() complete.
 */
export function createRoot(fn) {
  const owner = { effects: [] };
  ownerStack.push(owner);

  function dispose() {
    for (const effect of [...owner.effects].reverse()) effect.dispose();
    owner.effects.length = 0;
  }

  try {
    return fn(dispose);
  } finally {
    ownerStack.pop();
  }
}
