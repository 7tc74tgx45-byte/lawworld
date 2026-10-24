// Pure pixel-art portrait designs for the tutors (T16). No canvas, no DOM: each design is a palette plus an ordered
// list of filled rectangles [x, y, w, h, colourKey] on a 64x64 canvas. src/ui/portraits.js paints them with
// ctx.fillRect only. Keeping the designs as data makes them testable (bounds, palette size) in plain Node.
//
// Grid: the big shapes (head, hair mass, robe, braid) sit on a 2px pixel grid; the whole picture is 64x64.

export const PORTRAIT_SIZE = 64;

const R = (x, y, w, h, c) => [x, y, w, h, c];

// ---- shared pieces ---------------------------------------------------------------------------------------------

function backdrop() {
  return [
    R(0, 0, 64, 64, 'bg'),
    R(0, 0, 64, 24, 'bgLight'),
    R(0, 52, 64, 12, 'bgDark'),
    R(4, 4, 12, 14, 'bgAccent'), // a small framed picture on the wall
    R(6, 6, 8, 10, 'bgLight'),
  ];
}

/** Robe: sloped shoulders, a shirt V at the collar, lapel trim, shading. */
function robe() {
  return [
    R(10, 42, 44, 4, 'robe'),
    R(6, 46, 52, 18, 'robe'),
    R(6, 58, 52, 6, 'robeShade'),
    R(6, 46, 2, 18, 'robeShade'),
    R(56, 46, 2, 18, 'robeShade'),
    R(27, 36, 10, 8, 'skinShade'), // neck
    R(26, 44, 12, 4, 'shirt'),
    R(28, 48, 8, 4, 'shirt'),
    R(30, 52, 4, 4, 'shirt'),
    R(22, 44, 4, 16, 'robeLight'),
    R(38, 44, 4, 16, 'robeLight'),
    R(24, 44, 2, 20, 'trim'),
    R(38, 44, 2, 20, 'trim'),
  ];
}

const roundHead = () => [
  R(22, 12, 20, 2, 'skin'),
  R(18, 14, 28, 22, 'skin'),
  R(22, 36, 20, 2, 'skin'),
  R(24, 38, 16, 2, 'skinShade'),
  R(44, 16, 2, 18, 'skinShade'),
  R(26, 16, 8, 2, 'skinLight'),
  R(21, 29, 4, 2, 'skinLight'),
  R(39, 29, 4, 2, 'skinLight'),
  R(16, 24, 2, 6, 'skinShade'), // ears
  R(46, 24, 2, 6, 'skinShade'),
];

const sharpHead = () => [
  R(22, 12, 20, 2, 'skin'),
  R(18, 14, 28, 16, 'skin'),
  R(20, 30, 24, 4, 'skin'),
  R(22, 34, 20, 2, 'skin'),
  R(26, 36, 12, 2, 'skin'),
  R(28, 38, 8, 2, 'skinShade'),
  R(20, 30, 2, 4, 'skinShade'), // the jaw line
  R(42, 30, 2, 4, 'skinShade'),
  R(22, 34, 2, 2, 'skinShade'),
  R(40, 34, 2, 2, 'skinShade'),
  R(26, 16, 8, 2, 'skinLight'),
  R(16, 22, 2, 6, 'skinShade'),
  R(46, 22, 2, 6, 'skinShade'),
];

const nose = (y) => [R(31, y, 2, 6, 'skinShade')];

function eyes(y, browY) {
  return [
    R(23, y, 4, 3, 'eyeWhite'), R(37, y, 4, 3, 'eyeWhite'),
    R(24, y, 2, 3, 'pupil'), R(38, y, 2, 3, 'pupil'),
    R(22, browY, 6, 2, 'brow'), R(36, browY, 6, 2, 'brow'),
  ];
}

const mouth = (y) => [R(27, y - 1, 2, 2, 'skinShade'), R(35, y - 1, 2, 2, 'skinShade'), R(28, y, 8, 2, 'mouth')];

/** Round wire glasses: a lens tint, then a 10x10 octagonal ring round each eye and a bridge. */
function roundGlasses(y) {
  const ring = (x) => [
    R(x + 2, y + 2, 6, 6, 'lens'),
    R(x + 2, y, 6, 2, 'frame'), R(x + 2, y + 8, 6, 2, 'frame'),
    R(x, y + 2, 2, 6, 'frame'), R(x + 8, y + 2, 2, 6, 'frame'),
  ];
  // Callers draw the rings first and the eyes after, so the eyes show through the tinted lens.
  return { ring, bridge: R(30, y + 3, 4, 2, 'frame') };
}

/** Half-moon reading glasses low on the nose, with the eyes looking over the top. */
function readingGlasses(y) {
  const half = (x) => [
    R(x + 2, y + 2, 6, 4, 'lens'),
    R(x, y, 10, 2, 'frame'), R(x, y + 2, 2, 4, 'frame'), R(x + 8, y + 2, 2, 4, 'frame'), R(x + 2, y + 6, 6, 2, 'frame'),
  ];
  return [...half(20), ...half(34), R(30, y, 4, 2, 'frame'), R(18, y, 2, 2, 'frame'), R(44, y, 2, 2, 'frame')];
}

// ---- the designs -----------------------------------------------------------------------------------------------

function hale() {
  const g = roundGlasses(21);
  return {
    palette: {
      bg: '#2d2a26', bgLight: '#3f3a33', bgDark: '#201e1b', bgAccent: '#8a6a3a',
      skin: '#e0ac82', skinShade: '#c48a62', skinLight: '#efc19a',
      hair: '#c9ced6', hairLight: '#eef1f6', hairDark: '#9aa1ad',
      brow: '#aab0ba', eyeWhite: '#f4f1ea', pupil: '#2a2a36', mouth: '#a8553f',
      frame: '#d4b24a', lens: '#cfe6f0',
      robe: '#1f4d36', robeShade: '#163a28', robeLight: '#2f6b4b', trim: '#c9a227', shirt: '#e8e2d0',
    },
    rects: [
      ...backdrop(), ...robe(), ...roundHead(), ...nose(26),
      R(16, 12, 4, 16, 'hair'), R(44, 12, 4, 16, 'hair'), R(16, 24, 4, 4, 'hairDark'), // silver hair at the sides
      R(18, 8, 28, 8, 'hair'), R(30, 8, 2, 6, 'hairDark'), R(22, 8, 8, 2, 'hairLight'), R(36, 10, 6, 2, 'hairLight'),
      ...g.ring(20), ...g.ring(34), g.bridge,
      ...eyes(25, 18),
      R(26, 31, 12, 2, 'hairLight'), // moustache
      ...mouth(34),
    ],
  };
}

function okafor() {
  return {
    palette: {
      bg: '#26323f', bgLight: '#33424f', bgDark: '#1b2530', bgAccent: '#7d8896',
      skin: '#8a5a3c', skinShade: '#6e4429', skinLight: '#a06c4a',
      hair: '#1c1618', hairLight: '#3a2d33',
      brow: '#140f11', eyeWhite: '#efe9df', pupil: '#17120f', mouth: '#5e2a26',
      robe: '#3b1f5c', robeShade: '#2a1544', robeLight: '#5a3585', trim: '#c0c0d0', shirt: '#f2f0f5',
      gold: '#d6b24a',
    },
    rects: [
      ...backdrop(), ...robe(), ...sharpHead(), ...nose(25),
      R(18, 10, 28, 6, 'hair'), R(20, 8, 24, 2, 'hair'), R(22, 8, 10, 2, 'hairLight'), // close-cropped
      R(16, 14, 2, 8, 'hair'), R(46, 14, 2, 8, 'hair'), R(18, 16, 2, 4, 'hair'), R(44, 16, 2, 4, 'hair'),
      ...eyes(24, 20),
      R(16, 28, 2, 2, 'gold'), R(46, 28, 2, 2, 'gold'), // stud earrings
      ...mouth(33),
    ],
  };
}

function patel() {
  const braid = [];
  for (let i = 0; i < 7; i++) braid.push(R(47, 30 + i * 4, 6, 4, i % 2 ? 'hair' : 'hairLight'));
  braid.push(R(47, 58, 6, 2, 'tie'), R(48, 60, 4, 4, 'hair'), R(44, 28, 4, 4, 'tie'));
  return {
    palette: {
      bg: '#232a44', bgLight: '#30385a', bgDark: '#181d33', bgAccent: '#a3242f',
      skin: '#c68a5e', skinShade: '#a86d45', skinLight: '#d9a176',
      hair: '#1b1316', hairLight: '#43323b',
      brow: '#150f11', eyeWhite: '#f4efe6', pupil: '#1c1410', mouth: '#9a3a3a',
      frame: '#8a5a2a', lens: '#d6ecf2', tie: '#d4a72c',
      robe: '#a3242f', robeShade: '#7a1a24', robeLight: '#c43a44', trim: '#d4a72c', shirt: '#f0e6d2',
    },
    rects: [
      ...backdrop(), ...robe(), ...roundHead(), ...nose(26),
      R(16, 12, 4, 18, 'hair'), R(44, 12, 4, 18, 'hair'), R(18, 10, 28, 6, 'hair'), R(20, 8, 24, 2, 'hair'),
      R(31, 8, 2, 8, 'hairLight'), R(22, 10, 6, 2, 'hairLight'), // centre parting
      ...eyes(22, 18),
      ...readingGlasses(26),
      ...mouth(34),
      ...braid, // the long braid over the right shoulder
    ],
  };
}

function chen() {
  return {
    palette: {
      bg: '#2b2740', bgLight: '#3a3558', bgDark: '#1f1c30', bgAccent: '#6fb5a8',
      skin: '#f0c7a0', skinShade: '#d6a57c', skinLight: '#f8d9b8',
      hair: '#3a2a22', hairLight: '#5b4336', hairDark: '#261a15',
      brow: '#2e211b', eyeWhite: '#fbf6ee', pupil: '#2a1d16', mouth: '#b4564a',
      robe: '#7a5fb0', robeShade: '#5d4690', robeLight: '#9b82cc', trim: '#cfc3ea', shirt: '#f3ece0',
      lanyard: '#2f8f83',
    },
    rects: [
      ...backdrop(), ...robe(), ...roundHead(), ...nose(26),
      R(16, 12, 4, 12, 'hair'), R(44, 12, 4, 12, 'hair'), R(18, 8, 28, 8, 'hair'),
      R(20, 6, 8, 2, 'hair'), R(34, 6, 8, 2, 'hair'), R(18, 14, 10, 4, 'hair'), R(36, 14, 10, 4, 'hair'),
      R(22, 8, 6, 2, 'hairLight'), R(36, 10, 6, 2, 'hairLight'), R(28, 14, 2, 2, 'hairDark'),
      ...eyes(25, 21),
      R(27, 34, 10, 2, 'mouth'), R(29, 34, 6, 1, 'eyeWhite'), R(26, 33, 2, 2, 'skinShade'), R(36, 33, 2, 2, 'skinShade'),
      R(28, 44, 2, 16, 'lanyard'), R(34, 44, 2, 16, 'lanyard'), R(29, 58, 6, 6, 'bgAccent'), // seminar lanyard and badge
    ],
  };
}

const DESIGNS = { hale, okafor, patel, chen };
export const PORTRAIT_IDS = Object.keys(DESIGNS);

/** Which design a tutor persona gets. Unknown ids fall back to Dr Chen (the default first-pass tutor). */
export function portraitIdFor(tutorId) {
  return DESIGNS[tutorId] ? tutorId : 'chen';
}

/** { palette, rects } for a tutor; rects are [x, y, w, h, colourKey] in paint order. */
export function buildPortrait(tutorId) {
  return DESIGNS[portraitIdFor(tutorId)]();
}

/** Distinct colours actually used by a design. */
export function usedColours(design) {
  return new Set(design.rects.map((r) => design.palette[r[4]]));
}
