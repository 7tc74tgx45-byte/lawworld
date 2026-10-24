// Season palettes and building-state colours (shared by the world renderer). Colours only; no logic.

export const SEASON_PALETTE = {
  spring: { grassA: '#6fae62', grassB: '#5f9c55', fleck: '#f2b8d0', tree: '#7bbf6a', treeDark: '#4d8c43', trunk: '#6b4a2b', path: '#cdb98a', pathEdge: '#b19f72', water: '#4f8fc7', waterLight: '#7fb4e0', fence: '#8a6a3f' },
  summer: { grassA: '#7bb248', grassB: '#6aa03b', fleck: '#e8d74a', tree: '#3f8f3a', treeDark: '#2a6a2a', trunk: '#6b4a2b', path: '#d6c28e', pathEdge: '#b9a56f', water: '#3f8fd0', waterLight: '#74b6ea', fence: '#8a6a3f' },
  autumn: { grassA: '#a39a45', grassB: '#92893a', fleck: '#d0702a', tree: '#d9772b', treeDark: '#a8481c', trunk: '#5e3d22', path: '#b79a6c', pathEdge: '#97805a', water: '#4a7aa0', waterLight: '#7aa2c4', fence: '#6e4f30' },
  winter: { grassA: '#e4ecf1', grassB: '#d3dee6', fleck: '#ffffff', tree: '#3f6f5a', treeDark: '#2a4f40', trunk: '#4a3a2c', path: '#b9c2c9', pathEdge: '#9aa5ae', water: '#7fa8c8', waterLight: '#b8d4e8', fence: '#6b5a4a' },
};

/** Per-season extras: sand/shore, tree canopy shades and accents, flowers, roof dressing. */
export const SEASON_EXTRA = {
  spring: { sand: '#e6d6a2', sandDark: '#cdbb84', canopy: ['#8ccf78', '#6fb35f', '#4d8c43'], accent: ['#f7c6da', '#ffffff'], flowers: ['#f7a8c8', '#ffffff', '#f4e27a'], roofDress: 'moss', grassBlade: '#7fc271' },
  summer: { sand: '#ecd9a0', sandDark: '#d4bd7c', canopy: ['#58ad48', '#3f8f3a', '#2a6a2a'], accent: ['#f0e060', '#79c255'], flowers: ['#f6d83a', '#ff7a59', '#ffffff'], roofDress: 'none', grassBlade: '#4f8f2f' },
  autumn: { sand: '#c9b07a', sandDark: '#a89160', canopy: ['#f0952f', '#d9772b', '#a8481c'], accent: ['#c0392b', '#f2c14e'], flowers: ['#c0502a', '#e8a33a', '#8a3b1c'], roofDress: 'leaves', grassBlade: '#7d7430' },
  winter: { sand: '#d6dde3', sandDark: '#b4bec7', canopy: ['#4f8068', '#3f6f5a', '#2a4f40'], accent: ['#ffffff', '#dfeaf2'], flowers: ['#bcd6ea', '#ffffff', '#9fc1da'], roofDress: 'snow', grassBlade: '#c2d1dc' },
};

export function seasonExtra(season) {
  return SEASON_EXTRA[season] ?? SEASON_EXTRA.spring;
}

/** Walls, roof and mark for each state. Locked is grey with a padlock; the others are distinct hues. */
export const STATE_STYLE = {
  locked: { wall: '#7a7a86', roof: '#4c4c58', door: '#33333c', mark: 'padlock' },
  available: { wall: '#5b8fd6', roof: '#2f5596', door: '#1f2f55', mark: 'none' },
  explored: { wall: '#e0aa45', roof: '#9a6a1c', door: '#5a3a10', mark: 'half' },
  consolidated: { wall: '#58b86e', roof: '#2b7a40', door: '#17421f', mark: 'tick' },
};

export const STATE_LABEL = {
  locked: 'Locked',
  available: 'Available',
  explored: 'Explored',
  consolidated: 'Consolidated',
};

export function seasonPalette(season) {
  return SEASON_PALETTE[season] ?? SEASON_PALETTE.spring;
}
