/**
 * Zone / topic structure for the lawworld map.
 *
 * Each zone maps to a region on the game world and a domain of law.
 * Extend this as you build out areas and their associated content.
 *
 * @typedef {Object} Zone
 * @property {string} id          - Unique identifier
 * @property {string} name        - Display name
 * @property {string} topic       - Law topic this zone covers
 * @property {{ x: number, y: number }} origin  - Top-left tile coordinate of the zone
 * @property {{ w: number, h: number }} size     - Width/height in tiles
 * @property {string} [color]     - Tint override for ground tiles (hex string)
 */

/** @type {Zone[]} */
export const zones = [
  {
    id: 'contract',
    name: 'Contract District',
    topic: 'Contract Law',
    origin: { x: 0, y: 0 },
    size: { w: 10, h: 10 },
    color: '#3a7d44',
  },
  {
    id: 'tort',
    name: 'Tort Quarter',
    topic: 'Tort Law',
    origin: { x: 10, y: 0 },
    size: { w: 10, h: 10 },
    color: '#4a6d8c',
  },
  {
    id: 'constitutional',
    name: 'Constitutional Hall',
    topic: 'Constitutional Law',
    origin: { x: 20, y: 0 },
    size: { w: 10, h: 10 },
    color: '#8c6a2a',
  },
];

/**
 * Returns the zone the given tile coordinate falls within, or null.
 * @param {number} tileX
 * @param {number} tileY
 * @returns {Zone | null}
 */
export function getZoneAt(tileX, tileY) {
  return (
    zones.find(
      (z) =>
        tileX >= z.origin.x &&
        tileX < z.origin.x + z.size.w &&
        tileY >= z.origin.y &&
        tileY < z.origin.y + z.size.h
    ) ?? null
  );
}
