// Full-screen region transition overlay (T17). A fixed, click-through div that fades to the season colour and back,
// with the region name centred. Timing and colours live in src/logic/transitions.js.
import { createTransitionController, HALF_MS } from '../logic/transitions.js';

export class TransitionManager {
  constructor(doc = document) {
    this.root = doc.createElement('div');
    Object.assign(this.root.style, {
      position: 'fixed', inset: '0', zIndex: '1000', pointerEvents: 'none', opacity: '0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: `opacity ${HALF_MS}ms ease-in-out`,
    });
    this.root.setAttribute('aria-hidden', 'true');
    this.text = doc.createElement('div');
    Object.assign(this.text.style, {
      fontSize: '2rem', fontWeight: 'bold', textAlign: 'center', letterSpacing: '0.04em',
      fontFamily: 'Georgia, "Times New Roman", serif', padding: '0 1rem',
    });
    this.root.append(this.text);
    doc.body.append(this.root);
    const root = this.root;
    this.controller = createTransitionController({
      view: {
        begin: ({ fade, text, title }) => {
          root.style.background = fade;
          this.text.style.color = text;
          this.text.textContent = title;
          root.style.opacity = '0';
          void root.offsetWidth; // commit opacity 0 so the next change animates
          root.style.opacity = '1';
        },
        fadeOut: () => { root.style.opacity = '0'; },
        end: () => { this.text.textContent = ''; },
      },
    });
  }

  get busy() { return this.controller.busy; }

  /** Flash the destination's season colour and name; `onMidpoint` runs while the screen is fully covered. */
  crossRegion(fromRegion, toRegion, onMidpoint, onDone) {
    return this.controller.crossRegion(fromRegion, toRegion, onMidpoint, onDone);
  }

  destroy() { this.root.remove(); }
}
