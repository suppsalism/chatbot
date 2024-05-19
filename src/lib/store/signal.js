const signal = {
  context: [],
  create_signal(value) {
    const subscriptions = new Set();

    const read = () => {
      const observer = this.context[this.context.length - 1];
      if (observer) subscriptions.add(observer);
      return value;
    };
    const write = (newValue) => {
      value = newValue;
      for (const observer of subscriptions) {
        observer.execute();
      }
    };

    return [read, write];
  },
  create_effect(fn) {
    const effect = {
      execute(self) {
        self?.context.push(effect);
        fn();
        self?.context.pop();
      },
    };

    effect.execute(this);
  },
  create_memo(fn) {
    const [signal, set_signal] = this.create_signal();
    this.create_effect(() => set_signal(fn()));
    return signal;
  },
};

export default signal;
