// One district laid out as a "cell" (pure JS, local tile coordinates). A district is two rows of buildings
// facing a walkable lane. A signpost and an unlit brazier stand in the middle of the lane.
//
//   top row buildings    (door below each, on lane row 0)
//   lane row 0  (doors of the top row)
//   lane row 1  (signpost + brazier in the middle; walk around them)
//   lane row 2  (doors of the bottom row)
//   bottom row buildings (door above each, on lane row 2)

export const BLD_W = 3;
export const BLD_H = 2;
export const SLOT = 4; // building width + 1 tile of gap
export const LANE = 3;

/** Size in tiles of a district cell with n buildings. */
export function cellSize(n) {
  const per = Math.max(1, Math.ceil(n / 2));
  return { per, w: per * SLOT + 1, h: BLD_H * 2 + LANE };
}

/**
 * Lay out one district at tile offset (ox, oy).
 * Returns { w, h, buildings[], signpost, brazier, lane }.
 */
export function layoutCell(district, ox = 0, oy = 0) {
  const n = district.subsections.length;
  const { per, w, h } = cellSize(n);
  const buildings = district.subsections.map((sub, i) => {
    const top = i < per;
    const col = top ? i : i - per;
    const tx = ox + 1 + col * SLOT;
    const ty = top ? oy : oy + BLD_H + LANE;
    const door = { tx: tx + 1, ty: top ? oy + BLD_H : oy + BLD_H + LANE - 1 };
    return { id: sub.id, districtId: district.id, title: sub.title, tx, ty, w: BLD_W, h: BLD_H, door, side: top ? 'top' : 'bottom' };
  });
  const midX = ox + Math.floor(w / 2);
  const laneY = oy + BLD_H + 1;
  return {
    id: district.id,
    title: district.title,
    w,
    h,
    buildings,
    signpost: { tx: midX - 1, ty: laneY },
    brazier: { tx: midX, ty: laneY },
    rect: { x: ox, y: oy, w, h },
  };
}

/** Greedy left-to-right packing into rows no wider than maxW. items: [{ w, h }] -> positions + total size. */
export function packCells(items, maxW, gap = 2) {
  const pos = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  let usedW = 0;
  for (const it of items) {
    if (x > 0 && x + it.w > maxW) {
      x = 0;
      y += rowH + gap;
      rowH = 0;
    }
    pos.push({ x, y });
    x += it.w + gap;
    rowH = Math.max(rowH, it.h);
    usedW = Math.max(usedW, x - gap);
  }
  return { pos, w: usedW, h: items.length ? y + rowH : 0 };
}
