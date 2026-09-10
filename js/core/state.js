class Store {
  #state = {};
  #listeners = new Map();

  get(key) {
    return this.#state[key];
  }

  set(key, value) {
    this.#state[key] = value;
    (this.#listeners.get(key) || []).forEach((cb) => cb(value));
  }

  subscribe(key, callback) {
    if (!this.#listeners.has(key)) this.#listeners.set(key, []);
    this.#listeners.get(key).push(callback);
    return () => {
      const arr = this.#listeners.get(key) || [];
      this.#listeners.set(key, arr.filter((cb) => cb !== callback));
    };
  }
}

export const store = new Store();
