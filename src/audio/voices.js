// Small Web Audio building blocks for the procedural music (T15). Everything is synthesised; nothing is loaded.
// A "voice" is one oscillator (optionally with vibrato or tremolo) shaped by an envelope and sent to `out`.

/** Fade in over `attack`, hold, fade out over `release`. Overlapping bars with equal attack/release sum to a steady level. */
export const padEnv = (attack, release) => (p, s, e, peak) => {
  p.setValueAtTime(0, s);
  p.linearRampToValueAtTime(peak, s + attack);
  p.setValueAtTime(peak, Math.max(s + attack, e - release));
  p.linearRampToValueAtTime(0, e);
};

/** Plucked: instant attack, exponential decay. */
export const pluckEnv = (decay) => (p, s, e, peak) => {
  p.setValueAtTime(0, s);
  p.linearRampToValueAtTime(peak, s + 0.006);
  p.exponentialRampToValueAtTime(0.0001, Math.min(e, s + decay));
  p.setValueAtTime(0, Math.min(e, s + decay) + 0.01);
};

/** Long attack, then a slow exponential decay until the voice ends. */
export const swellEnv = (attack) => (p, s, e, peak) => {
  p.setValueAtTime(0, s);
  p.linearRampToValueAtTime(peak, s + attack);
  p.exponentialRampToValueAtTime(0.0001, e);
  p.setValueAtTime(0, e + 0.01);
};

/**
 * Play one note. Options: type, freq (Hz), start/end (context seconds), peak (gain), detune (cents), env (see above),
 * vibrato { rate, cents }, tremolo { rate, depth } (depth 0-1 of the gain).
 */
export function voice(ctx, out, o) {
  const { type = 'sine', freq, start, end, peak = 0.1, detune = 0, env, vibrato, tremolo } = o;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const extras = [];
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const amt = ctx.createGain();
    lfo.frequency.value = vibrato.rate;
    amt.gain.value = vibrato.cents;
    lfo.connect(amt);
    amt.connect(osc.detune);
    extras.push(lfo);
  }
  let node = osc;
  if (tremolo) {
    const trem = ctx.createGain();
    trem.gain.value = 1 - tremolo.depth;
    const lfo = ctx.createOscillator();
    const amt = ctx.createGain();
    lfo.frequency.value = tremolo.rate;
    amt.gain.value = tremolo.depth;
    lfo.connect(amt);
    amt.connect(trem.gain);
    node.connect(trem);
    node = trem;
    extras.push(lfo);
  }
  const g = ctx.createGain();
  g.gain.value = 0;
  (env ?? padEnv(1, 1))(g.gain, start, end, peak);
  node.connect(g);
  g.connect(out);
  const stopAt = end + 0.05;
  for (const n of [osc, ...extras]) {
    n.start(start);
    n.stop(stopAt);
  }
  osc.onended = () => {
    try { g.disconnect(); } catch { /* already gone */ }
  };
  return osc;
}
