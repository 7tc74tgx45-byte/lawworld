// Region transition rules (T17), pure: season colours, banner text and the timeline of a crossing.
// No DOM here. The overlay in src/ui/transitions.js is the "view" this controller drives, so the timing is unit-tested.

export const TRANSITION_MS = 600; // 0 -> 1 -> 0 opacity in total
export const HALF_MS = TRANSITION_MS / 2; // the midpoint (peak) is here

// fade = overlay colour, text = banner colour. Hub spring green, Contract summer amber, Tort autumn grey (mist),
// Public Law winter white. The banner text is a contrasting tone of the same season so it stays readable on the flash.
export const SEASON_STYLE = {
  spring: { fade: '#2f7d3a', text: '#d8ffcf' },
  summer: { fade: '#c98a14', text: '#2e1c00' },
  autumn: { fade: '#6b6f78', text: '#f0e6d8' },
  winter: { fade: '#f2f8fc', text: '#2b4a6b' },
};

export const seasonStyle = (season) => SEASON_STYLE[season] ?? SEASON_STYLE.spring;

const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
/** WCAG contrast ratio of two #rrggbb colours (1..21). */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The name shown in the banner. The hub is Foundations Town. */
export const bannerTitle = (region) => (region?.isHub ? 'Foundations Town' : region?.title ?? '');

/**
 * Drives one crossing at a time. `view` = { begin({fade, text, title}), fadeOut(), end() }.
 * `schedule(fn, ms)` defaults to setTimeout; tests inject their own clock.
 */
export function createTransitionController({ view, schedule = (fn, ms) => setTimeout(fn, ms) }) {
  let busy = false;

  function crossRegion(fromRegion, toRegion, onMidpoint, onDone) {
    if (busy || !toRegion) return false;
    if (fromRegion && fromRegion.id === toRegion.id) return false;
    busy = true;
    const style = seasonStyle(toRegion.season);
    view.begin({ fade: style.fade, text: style.text, title: bannerTitle(toRegion) });
    schedule(() => {
      // The screen is fully covered: safe to swap weather, music and anything else. A failure must not strand the overlay.
      try { onMidpoint?.(); } catch (err) { console.error('Region transition midpoint failed', err); }
      view.fadeOut();
      schedule(() => {
        view.end();
        busy = false;
        try { onDone?.(); } catch (err) { console.error('Region transition done failed', err); }
      }, HALF_MS);
    }, HALF_MS);
    return true;
  }

  return { crossRegion, get busy() { return busy; } };
}
