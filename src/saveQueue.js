// One writer per board/group list. Track acknowledged writes separately from local edits;
// failures retain the latest edits for an explicit retry. No background retry loop on failure.
export function createSaveQueue(initial, save, onError, onChange = () => {}, delay = 500) {
  let saved = initial, current = initial, running = null, timer = 0, disposed = false;
  const changed = () => { if (!disposed) onChange(); };
  const queue = {
    get dirty() { return current !== saved; },
    get running() { return running; },
    get current() { return current; },
    set(next) {
      if (disposed) return;
      current = next; clearTimeout(timer); changed();
      timer = setTimeout(() => queue.flush().catch(() => {}), delay);
    },
    replace(next) {
      if (disposed || queue.dirty || running) return false;
      saved = current = next; return true;
    },
    flush() {
      clearTimeout(timer);
      if (running) return running;
      if (disposed || !queue.dirty) return Promise.resolve();
      running = Promise.resolve().then(async () => {
        while (!disposed && queue.dirty) {
          const next = current;
          await save(saved, next, acknowledged => { if (!disposed) saved = acknowledged; });
          if (disposed) return;
          saved = next;
        }
      }).catch(error => { if (!disposed) onError(error); throw error; })
        .finally(() => { running = null; changed(); });
      changed();
      return running;
    },
    dispose() { disposed = true; clearTimeout(timer); }
  };
  return queue;
}
