// Records an encounter's result exactly once, however it ends (VISION §1.2, §7). Pure JS.
//
//   const rec = createEncounterRecorder((result) => ...write progress + save...);
//   rec.finish(result)   // the verdict was reached
//   rec.leave(result)    // the player left, or the tab was hidden/closed (pagehide): records evaluated progress so far
//
// Whichever comes first records; later calls are ignored. A verdict followed by Leave must not count twice,
// and a pagehide followed by the overlay's own close must not count twice either.

export function createEncounterRecorder(record) {
  let recorded = false;
  const once = (result) => {
    if (recorded) return false;
    recorded = true;
    record(result);
    return true;
  };
  return {
    finish: once,
    leave: once,
    get recorded() {
      return recorded;
    },
  };
}

/**
 * What to do when the page is being hidden mid-encounter: ask the engine to leave (keeps every evaluated answer,
 * marks the subsection explored) and record it. Safe to call when nothing is open or nothing was answered.
 */
export function recordOnPageHide(engine, recorder) {
  if (!engine || recorder.recorded) return false;
  return recorder.leave(engine.leave());
}
