import chokidar from 'chokidar';

class Watcher {
  private watcher;
  private timer: any;
  private events: Record<string, Function[]> = {};

  constructor(dir: string) {
    this.watcher = chokidar
      .watch(dir, {
        ignoreInitial: true,
      })
      .on('all', this.handler.bind(this));
  }

  handler() {
    if (this.timer) clearTimeout(this.timer);

    this.timer = setTimeout(() => {
      for (const fn of this.events['change'] || []) {
        fn();
      }
    }, 100);
  }

  on(event: string, callback: Function) {
    this.events[event] ??= [];
    this.events[event].push(callback);
  }

  async close() {
    await this.watcher.close();
  }
}

export { Watcher };
