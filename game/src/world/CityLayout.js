// The plan of Saltline Bay: a grid of city blocks, its districts, landmark lots and named places.
// x runs west to east (the ocean lies east), z runs north to south. Units are metres.
export const GRID = 8;            // blocks per side
export const CELL = 80;           // road centre to road centre
export const ROAD_HALF = 8;       // half the road width
export const SIDEWALK = 4;
export const LANE = 3.8;          // lane centre offset from the road centre line
export const HALF = (GRID * CELL) / 2; // 320
export const BEACH_START = HALF + ROAD_HALF + 4;
export const SHORE_X = 420;
export const WORLD_MIN = -HALF - 14;
export const WORLD_MAX_X = SHORE_X - 6;
export const WORLD_MAX = HALF + 14;

export const roadCoord = (i) => -HALF + i * CELL;
export const roadIndexNear = (v) => Math.max(0, Math.min(GRID, Math.round((v + HALF) / CELL)));
export const blockIndexAt = (v) => Math.floor((v + HALF) / CELL);
export const blockCenter = (bi, bj) => ({ x: roadCoord(bi) + CELL / 2, z: roadCoord(bj) + CELL / 2 });

// Landmark lots: one big building with a sign, or the central park.
export const LANDMARKS = {
  '3,3': { id: 'bank', name: 'HALCYON TRUST', color: '#e8dcc4', height: 46, sign: '#0f5d63' },
  '4,3': { id: 'park', name: 'Halcyon Square' },
  '1,4': { id: 'police', name: 'SALTLINE BAY PD', color: '#dfe7ef', height: 16, sign: '#1d3f8a' },
  '2,1': { id: 'hospital', name: 'ST. MARISOL MEDICAL', color: '#f4f4f0', height: 24, sign: '#c3242f' },
  '6,5': { id: 'garage', name: "TIDE'S GARAGE", color: '#f2a65a', height: 9, sign: '#16324f' },
  '7,1': { id: 'safehouse', name: 'PELICAN SUITES', color: '#9fe3e0', height: 20, sign: '#e2557a' },
  '5,2': { id: 'gunshop', name: 'IRONLEAF ARMS', color: '#c9b79c', height: 10, sign: '#2e4d2c' },
  '2,5': { id: 'club', name: 'THE LANTERN CLUB', color: '#5b3a78', height: 14, sign: '#ff4fa0' },
};

// A point on the sidewalk in front (south side) of a block, or on the lane beside it.
export function frontOf(bi, bj, onRoad = false, along = 0) {
  const c = blockCenter(bi, bj);
  return { x: c.x + along, z: roadCoord(bj + 1) - (onRoad ? LANE : ROAD_HALF + 2) };
}

export const LOCATIONS = {
  garage: { ...frontOf(6, 5), label: "Tide's Garage" },
  garageBay: { ...frontOf(6, 5, true), label: "Tide's Garage" },
  safehouse: { ...frontOf(7, 1), label: 'Pelican Suites safehouse' },
  hospital: { ...frontOf(2, 1), label: 'St. Marisol Medical' },
  police: { ...frontOf(1, 4), label: 'Saltline Bay PD' },
  gunshop: { ...frontOf(5, 2), label: 'Ironleaf Arms' },
  club: { ...frontOf(2, 5), label: 'The Lantern Club' },
  clubCurb: { ...frontOf(2, 5, true), label: 'The Lantern Club' },
  bank: { ...frontOf(3, 3), label: 'Halcyon Trust' },
  bankCurb: { ...frontOf(3, 3, true, 20), label: 'Halcyon Trust' },
  kestrel: { x: roadCoord(1) - LANE - 1.5, z: blockCenter(0, 1).z, label: 'Coral Heights' },
  pier: { x: 405, z: 120, label: 'Driftwood Pier' },
  pierRoad: { x: HALF + LANE, z: 120, label: 'Seabreak Parade' },
  boardwalk: { x: 360, z: -60, label: 'Sunbreak Boardwalk' },
  courierStart: { x: roadCoord(4) + LANE, z: roadCoord(7) - 30, label: 'Palmetto Yards' },
  start: { ...frontOf(6, 5, false, -12), label: 'Marina Row' },
};

export const DISTRICTS = [
  { name: 'Sunbreak Beach', color: '#f5d38a' },
  { name: 'Halcyon Downtown', color: '#7fd6ff' },
  { name: 'Coral Heights', color: '#ff9db0' },
  { name: 'Pelican Point', color: '#9ff0c0' },
  { name: 'Mangrove Flats', color: '#b8e07a' },
  { name: 'Marina Row', color: '#ffc27a' },
  { name: 'Palmetto Yards', color: '#d7b8ff' },
];

export function districtAt(x, z) {
  if (x > BEACH_START - 2) return DISTRICTS[0];
  const bi = blockIndexAt(x), bj = blockIndexAt(z);
  if (bi >= 3 && bi <= 4 && bj >= 2 && bj <= 4) return DISTRICTS[1];
  if (bj <= 1) return bi <= 2 ? DISTRICTS[2] : DISTRICTS[3];
  if (bi <= 2) return bj <= 2 ? DISTRICTS[2] : DISTRICTS[4];
  if (bi >= 5) return DISTRICTS[5];
  return DISTRICTS[6];
}

export function isDowntown(bi, bj) { return bi >= 3 && bi <= 4 && bj >= 2 && bj <= 4; }

// Is (x, z) on a road surface (not inside a block)?
export function onRoad(x, z) {
  const lx = ((x + HALF) % CELL + CELL) % CELL, lz = ((z + HALF) % CELL + CELL) % CELL;
  const nearX = lx < ROAD_HALF || lx > CELL - ROAD_HALF;
  const nearZ = lz < ROAD_HALF || lz > CELL - ROAD_HALF;
  return nearX || nearZ;
}

export const ROAD_NAMES_X = ['Gullwing Ave', 'Coral Ave', 'Saltmarsh Ave', 'Halcyon Ave', 'Lantern Ave', 'Marlin Ave', 'Tidewater Ave', 'Pelican Ave', 'Seabreak Parade'];
export const ROAD_NAMES_Z = ['1st St', '2nd St', 'Sunset Blvd', 'Mangrove St', 'Ferry St', 'Palm Row', 'Dockside St', 'Shell St', 'South Shore Rd'];
