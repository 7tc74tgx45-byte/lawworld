// Counts open DOM overlays so the game can disable Phaser keyboard input while ANY is open,
// and restore it only when the last one closes. Pure JS: lock/unlock callbacks are injected.

export function createOverlayLock({ lock, unlock } = {}) {
  let count = 0;
  return {
    /** Returns a release function (safe to call twice). */
    acquire() {
      count++;
      if (count === 1) lock?.();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        count--;
        if (count === 0) unlock?.();
      };
    },
    get count() {
      return count;
    },
    get isOpen() {
      return count > 0;
    },
  };
}
