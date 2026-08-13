import { describe, it, expect, vi } from 'vitest';
import {
  createSignal,
  createEffect,
  createMemo,
  batch,
  createRoot,
} from '../../src/reactive/signal';

describe('createSignal', () => {
  it('reads back what was written', () => {
    const [value, setValue] = createSignal(1);
    expect(value()).toBe(1);
    setValue(2);
    expect(value()).toBe(2);
  });

  it('accepts an updater function', () => {
    const [count, setCount] = createSignal(1);
    setCount((prev) => prev + 1);
    expect(count()).toBe(2);
  });

  it('does not notify when the value is unchanged by Object.is', () => {
    const [value, setValue] = createSignal('a');
    const spy = vi.fn();
    createEffect(() => {
      value();
      spy();
    });

    expect(spy).toHaveBeenCalledTimes(1);
    setValue('a');
    expect(spy).toHaveBeenCalledTimes(1);
    setValue('b');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('honors a custom equals', () => {
    const [value, setValue] = createSignal({ n: 1 }, { equals: (a, b) => a.n === b.n });
    const spy = vi.fn();
    createEffect(() => {
      value();
      spy();
    });

    setValue({ n: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
    setValue({ n: 2 });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('createEffect', () => {
  it('runs immediately and re-runs when a tracked signal changes', () => {
    const [value, setValue] = createSignal(0);
    const seen = [];
    createEffect(() => seen.push(value()));

    setValue(1);
    setValue(2);
    expect(seen).toEqual([0, 1, 2]);
  });

  it('only tracks signals actually read on the last run', () => {
    const [useA, setUseA] = createSignal(true);
    const [a, setA] = createSignal('a');
    const [b, setB] = createSignal('b');
    const spy = vi.fn();

    createEffect(() => {
      spy(useA() ? a() : b());
    });

    setB('b2'); // untracked on this run
    expect(spy).toHaveBeenCalledTimes(1);

    setUseA(false);
    expect(spy).toHaveBeenCalledTimes(2);

    setA('a2'); // no longer tracked
    expect(spy).toHaveBeenCalledTimes(2);

    setB('b3');
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('runs a returned cleanup before each re-run and on dispose', () => {
    const [value, setValue] = createSignal(0);
    const cleanup = vi.fn();
    const dispose = createEffect(() => {
      value();
      return cleanup;
    });

    expect(cleanup).not.toHaveBeenCalled();
    setValue(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it('stops re-running once disposed', () => {
    const [value, setValue] = createSignal(0);
    const spy = vi.fn();
    const dispose = createEffect(() => spy(value()));

    dispose();
    setValue(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('logs and contains a throwing effect rather than breaking the writer', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const [value, setValue] = createSignal(0);
    createEffect(() => {
      if (value() > 0) throw new Error('boom');
    });

    expect(() => setValue(1)).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('createMemo', () => {
  it('derives a read-only value that updates with its sources', () => {
    const [first, setFirst] = createSignal('Ada');
    const [last, setLast] = createSignal('Lovelace');
    const full = createMemo(() => `${first()} ${last()}`);

    expect(full()).toBe('Ada Lovelace');
    setLast('L.');
    expect(full()).toBe('Ada L.');
    setFirst('A.');
    expect(full()).toBe('A. L.');
  });

  it('can be tracked by an effect', () => {
    const [n, setN] = createSignal(1);
    const doubled = createMemo(() => n() * 2);
    const seen = [];
    createEffect(() => seen.push(doubled()));

    setN(2);
    expect(seen.at(-1)).toBe(4);
  });
});

describe('batch', () => {
  it('coalesces multiple writes into a single effect pass', () => {
    const [a, setA] = createSignal(0);
    const [b, setB] = createSignal(0);
    const spy = vi.fn();
    createEffect(() => spy(a() + b()));

    expect(spy).toHaveBeenCalledTimes(1);
    batch(() => {
      setA(1);
      setB(1);
    });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(2);
  });

  it('returns the callback result', () => {
    expect(batch(() => 'done')).toBe('done');
  });

  it('still flushes when the batched callback throws', () => {
    const [value, setValue] = createSignal(0);
    const spy = vi.fn();
    createEffect(() => spy(value()));

    expect(() =>
      batch(() => {
        setValue(1);
        throw new Error('boom');
      })
    ).toThrow('boom');

    expect(spy).toHaveBeenLastCalledWith(1);
  });

  it('flushes only once for nested batches', () => {
    const [value, setValue] = createSignal(0);
    const spy = vi.fn();
    createEffect(() => spy(value()));

    batch(() => {
      setValue(1);
      batch(() => setValue(2));
      setValue(3);
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(3);
  });
});

describe('createRoot', () => {
  it('returns whatever the callback returns', () => {
    expect(createRoot(() => 'value')).toBe('value');
  });

  it('disposes every effect created inside it — the guarantee destroy() relies on', () => {
    const [value, setValue] = createSignal(0);
    const first = vi.fn();
    const second = vi.fn();

    const dispose = createRoot((disposeRoot) => {
      createEffect(() => first(value()));
      createEffect(() => second(value()));
      return disposeRoot;
    });

    setValue(1);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);

    dispose();
    setValue(2);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('disposes effects created indirectly through a memo', () => {
    const [value, setValue] = createSignal(1);
    const spy = vi.fn();

    const dispose = createRoot((disposeRoot) => {
      const doubled = createMemo(() => {
        spy();
        return value() * 2;
      });
      doubled();
      return disposeRoot;
    });

    const before = spy.mock.calls.length;
    dispose();
    setValue(2);
    expect(spy).toHaveBeenCalledTimes(before);
  });

  it('runs the cleanup an owned effect returned', () => {
    const cleanup = vi.fn();
    const dispose = createRoot((disposeRoot) => {
      createEffect(() => cleanup);
      return disposeRoot;
    });

    expect(cleanup).not.toHaveBeenCalled();
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('is safe to dispose twice', () => {
    const dispose = createRoot((disposeRoot) => {
      createEffect(() => {});
      return disposeRoot;
    });

    dispose();
    expect(() => dispose()).not.toThrow();
  });
});
