// World generation (T09). Pure JS and deterministic: the same curriculum always gives the same world, so new vault
// notes add districts and buildings without any hand-editing.
//
//   buildWorld(curriculum) -> { cols, rows, tiles, zones, regions, districts, buildings, spawn, corridors }
//
// Shape of the world (the first curriculum region is the hub town, spring, in the centre):
//
//                 Public Law (winter)
//                        |
//      Foundations hub --+-- Contract (summer)
//                        |
//                    Tort (autumn)
//
// Every region is a rectangle of grass with a tree border and a moat of water around it; paths bridge the water.
// Districts are fenced yards (see layoutCell.js) packed into rows, each with a signpost and a brazier.
// Doors, signposts and braziers are never blocked: reachability from the hub spawn is tested, not assumed.

import { cellSize, layoutCell, packCells } from './layoutCell.js';
import { TILE } from './worldQuery.js';

export const MARGIN = 6; // region edge -> first cell: 2 trees, a free ring, then the fence
export const CORRIDOR = 8; // water between regions (the path bridges it)
export const WATER_PAD = 6;
export const REGION_MAX_W = 64;
export const CELL_GAP = 4;
export const PLAZA_W = 11;
export const PLAZA_H = 7;
export const PLAZA_BAND = PLAZA_H + 2;
export const GARDEN_PLOTS = 40; // max; actual active count comes from activePlotCount(save) at runtime

const hash = (x, y) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;

/** Region layout in its own local tile coordinates (origin top-left of the region rectangle). */
function layoutRegion(region, isHub) {
  const sizes = region.districts.map((d) => {
    const { w, h } = cellSize(d.subsections.length);
    return { w, h };
  });
  const packed = packCells(sizes, REGION_MAX_W, CELL_GAP);
  const band = isHub ? PLAZA_BAND : 0;
  const innerW = Math.max(packed.w, isHub ? PLAZA_W : 12);
  const w = innerW + 2 * MARGIN;
  const h = packed.h + band + 2 * MARGIN;
  const cells = region.districts.map((d, i) => layoutCell(d, MARGIN + packed.pos[i].x, MARGIN + band + packed.pos[i].y));
  const plaza = isHub ? { x: MARGIN + Math.floor((innerW - PLAZA_W) / 2), y: MARGIN + 1, w: PLAZA_W, h: PLAZA_H } : null;
  return { w, h, cells, plaza };
}

/** Where each region sits relative to the hub (hub at 0,0). Order of curriculum regions: hub, east, south, north. */
function placeRegions(locals) {
  if (locals.length > 4) throw new Error('layout supports a hub plus three regions (east, south, north)');
  const [hub, east, south, north] = locals;
  const cx = Math.floor(hub.w / 2);
  const pos = [{ x: 0, y: 0 }];
  if (east) pos.push({ x: hub.w + CORRIDOR, y: 0 });
  if (south) pos.push({ x: cx - Math.floor(south.w / 2), y: hub.h + CORRIDOR });
  if (north) pos.push({ x: cx - Math.floor(north.w / 2), y: -(CORRIDOR + north.h) });
  return pos;
}

export function buildWorld(curriculum) {
  const curRegions = curriculum.modules.flatMap((m) => m.regions.map((r) => ({ ...r, moduleId: m.id, moduleTitle: m.title })));
  if (!curRegions.length) throw new Error('curriculum has no regions');
  const locals = curRegions.map((r, i) => layoutRegion(r, i === 0));
  const pos = placeRegions(locals);

  const minX = Math.min(...pos.map((p) => p.x));
  const minY = Math.min(...pos.map((p) => p.y));
  const maxX = Math.max(...pos.map((p, i) => p.x + locals[i].w));
  const maxY = Math.max(...pos.map((p, i) => p.y + locals[i].h));
  const ox = WATER_PAD - minX;
  const oy = WATER_PAD - minY;
  const cols = maxX - minX + 2 * WATER_PAD;
  const rows = maxY - minY + 2 * WATER_PAD;
  const tiles = new Uint8Array(cols * rows).fill(TILE.WATER);
  const set = (x, y, t) => {
    if (x >= 0 && y >= 0 && x < cols && y < rows) tiles[y * cols + x] = t;
  };

  const regions = [];
  const districts = [];
  const buildings = [];
  let spawn = null;
  let garden = { plots: [] };

  curRegions.forEach((cr, i) => {
    const L = locals[i];
    const rx = pos[i].x + ox;
    const ry = pos[i].y + oy;
    regions.push({
      id: cr.id, title: cr.title, season: cr.season, material: cr.material, moduleId: cr.moduleId, moduleTitle: cr.moduleTitle,
      index: i, isHub: i === 0, rect: { x: rx, y: ry, w: L.w, h: L.h },
    });
    // ground and the tree border (outer ring solid, second ring mostly trees, third ring sparse)
    for (let y = 0; y < L.h; y++) {
      for (let x = 0; x < L.w; x++) {
        const d = Math.min(x, y, L.w - 1 - x, L.h - 1 - y);
        const r = hash(rx + x, ry + y) % 100;
        let t = TILE.GRASS;
        if (d === 0 || (d === 1 && r < 75) || (d === 2 && r < 12)) t = TILE.TREE;
        set(rx + x, ry + y, t);
      }
    }
    if (L.plaza) {
      const p = L.plaza;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) set(rx + p.x + x, ry + p.y + y, TILE.PATH);
      const fx = rx + p.x + Math.floor(p.w / 2) - 1;
      const fy = ry + p.y + 1;
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) set(fx + x, fy + y, TILE.WATER); // fountain
        // Knowledge garden (T13): six walkable plots in a row below the fountain (never blocking).
        garden = { plots: Array.from({ length: GARDEN_PLOTS }, (_, k) => {
          const col = k % 4;
          const row = Math.floor(k / 4);
          return { id: `plot-${k}`, tx: rx + p.x + col * 2, ty: ry + p.y + 3 + row * 2 };
        }) };
      spawn = { tx: rx + p.x + Math.floor(p.w / 2), ty: ry + p.y + 5 };
    }
    L.cells.forEach((cell, k) => {
      const c = layoutCell(curRegions[i].districts[k], rx + cell.rect.x, ry + cell.rect.y);
      const cx0 = c.rect.x;
      const cy0 = c.rect.y;
      for (let y = 2; y <= 4; y++) for (let x = 0; x < c.w; x++) set(cx0 + x, cy0 + y, TILE.PATH); // the lane
      for (let x = 0; x < c.w; x++) {
        set(cx0 + x, cy0 - 1, TILE.FENCE);
        set(cx0 + x, cy0 + c.h, TILE.FENCE);
      }
      for (const y of [0, 1, 5, 6]) {
        set(cx0, cy0 + y, TILE.FENCE);
        set(cx0 + c.w - 1, cy0 + y, TILE.FENCE);
      }
      for (const b of c.buildings) {
        for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) set(b.tx + x, b.ty + y, TILE.BUILDING);
        buildings.push({ ...b, regionId: cr.id, moduleId: cr.moduleId });
      }
      set(c.signpost.tx, c.signpost.ty, TILE.SIGN);
      set(c.brazier.tx, c.brazier.ty, TILE.BRAZIER);
      districts.push({ id: c.id, title: c.title, regionId: cr.id, rect: c.rect, signpost: c.signpost, brazier: c.brazier });
    });
  });

  // paths bridging the water between the hub and each region (3 tiles wide, from a free ring to a free ring)
  const corridors = [];
  const carve = (x0, y0, x1, y1) => {
    corridors.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, TILE.PATH);
  };
  const hub = regions[0].rect;
  const hcx = hub.x + Math.floor(hub.w / 2);
  const hrow = hub.y + MARGIN + 3;
  regions.slice(1).forEach((r, k) => {
    const q = r.rect;
    if (k === 0) carve(hub.x + hub.w - 5, hrow, q.x + 4, hrow + 2); // east
    else if (k === 1) carve(hcx - 1, hub.y + hub.h - 5, hcx + 1, q.y + 4); // south
    else carve(hcx - 1, q.y + q.h - 5, hcx + 1, hub.y + 4); // north
  });

  // nearest region per tile (picks the season palette, also for water and paths between regions)
  const zones = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let best = 0;
      let bestD = Infinity;
      for (const r of regions) {
        const dx = Math.max(r.rect.x - x, 0, x - (r.rect.x + r.rect.w - 1));
        const dy = Math.max(r.rect.y - y, 0, y - (r.rect.y + r.rect.h - 1));
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = r.index;
        }
      }
      zones[y * cols + x] = best;
    }
  }

  return { cols, rows, tiles, zones, regions, districts, buildings, spawn, corridors, garden };
}
