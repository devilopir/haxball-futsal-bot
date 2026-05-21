class TimeoutManager {
  constructor() {
    this.timeouts = new Map();
    this.intervals = new Map();
  }

  set(key, callback, delay) {
    this.clear(key);
    const timeout = setTimeout(() => {
      this.timeouts.delete(key);
      try {
        callback();
      } catch (e) {
        console.error(`Timeout callback error [${key}]:`, e.message);
      }
    }, delay);
    this.timeouts.set(key, timeout);
    return timeout;
  }

  clear(key) {
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
  }

  setInterval(key, callback, interval) {
    this.clearInterval(key);
    const intervalId = setInterval(() => {
      try {
        callback();
      } catch (e) {
        console.error(`Interval callback error [${key}]:`, e.message);
      }
    }, interval);
    this.intervals.set(key, intervalId);
    return intervalId;
  }

  clearInterval(key) {
    const intervalId = this.intervals.get(key);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(key);
    }
  }

  clearAll() {
    this.timeouts.forEach(t => clearTimeout(t));
    this.intervals.forEach(i => clearInterval(i));
    this.timeouts.clear();
    this.intervals.clear();
  }

  has(key) {
    return this.timeouts.has(key) || this.intervals.has(key);
  }
}

module.exports = TimeoutManager;
