// town.js — Woodtown: map data + pre-rendered isometric pixel world.
//
// The whole static town is rendered once onto an offscreen canvas at
// world scale; main.js blits it with a pixelated zoom. Everything is
// data-driven: add a building to BUILDINGS and it appears, clickable.

export const TW = 32, TH = 16; // tile footprint in world px
const HW = TW / 2, HH = TH / 2;
export const GRID = 40;

// ---------------------------------------------------------------- palette
const GRASS = ['#7ec850', '#78c34b', '#86cf58'];
const ROAD = '#8d9095', ROAD_EDGE = '#75787d', DASH = '#f2e7c4';
const WATER = '#45b5ea', WATER_LIT = '#7cd0f5';
const SOIL = '#7a5230', SOIL_DARK = '#5e3d22';

function shade(hex, f) {
	const n = parseInt(hex.slice(1), 16);
	const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
	return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// deterministic per-tile randomness
function hash(x, y) {
	let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
	h = (h ^ (h >> 13)) * 1274126177;
	return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// ---------------------------------------------------------------- geometry
const OX = GRID * HW, OY = 96;
const SKIRT_D = 48; // how deep the island cross-section goes
export const WORLD_W = GRID * TW;
export const WORLD_H = GRID * TH + OY + SKIRT_D + 10;

export function g2w(gx, gy) {
	return [OX + (gx - gy) * HW, OY + (gx + gy) * HH];
}

export function w2g(x, y) {
	const dx = (x - OX) / HW, dy = (y - OY) / HH;
	return [(dy + dx) / 2, (dy - dx) / 2];
}

// ---------------------------------------------------------------- map data
// tile types: 0 grass, 1 road, 2 water
export const ROAD_ROWS = [10, 11, 26, 27], ROAD_COLS = [12, 13, 28, 29];
export const ROAD_H_CENTERS = [11, 27], ROAD_V_CENTERS = [13, 29]; // npc walk lines
const POND = { cx: 33.5, cy: 6.5, rx: 3.1, ry: 2.2 };

export function tileType(gx, gy) {
	if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return -1;
	const px = gx + 0.5, py = gy + 0.5;
	if (((px - POND.cx) / POND.rx) ** 2 + ((py - POND.cy) / POND.ry) ** 2 <= 1) return 2;
	if (ROAD_ROWS.includes(gy) && gx >= 1 && gx <= 38) return 1;
	if (ROAD_COLS.includes(gx) && gy >= 1 && gy <= 38) return 1;
	return 0;
}

const LAMPS = [
	[11.6, 9.6], [14.4, 12.4], [27.6, 9.6], [30.4, 12.4],
	[11.6, 25.6], [14.4, 28.4], [27.6, 25.6], [30.4, 28.4],
	[3, 12.4], [38, 9.6], [3, 28.4], [38, 25.6],
];

// buildings + a margin south of each (so their faces stay unobstructed)
function inBuildingZone(gx, gy) {
	for (const b of BUILDINGS) {
		const clear = Math.ceil((b.clearH || 30) / 8) + 1;
		if (gx >= b.gx - 1 && gx <= b.gx + b.w && gy >= b.gy - 1 && gy <= b.gy + b.dep + clear) return true;
	}
	return false;
}

// ---------------------------------------------------------------- town build
export function createTown() {
	const canvas = document.createElement('canvas');
	canvas.width = WORLD_W;
	canvas.height = WORLD_H;
	const g = canvas.getContext('2d');

	const occupied = new Set();
	const hotspots = [];
	const dynamic = {};

	drawIslandSkirt(g);
	drawTiles(g);

	const items = [];
	// stately hand-placed oaks (big, need room)
	const OAKS = [[10, 6], [14, 24], [9, 36], [31.5, 2.5], [37, 21]];
	for (const [ox, oy] of OAKS) items.push({ d: ox + oy, draw: (c) => drawOak(c, ox, oy) });
	// auto-scattered greenery on free grass — round trees, douglas firs, shrubs, flowers
	for (let gy = 0; gy < GRID; gy++) {
		for (let gx = 0; gx < GRID; gx++) {
			if (tileType(gx, gy) !== 0 || inBuildingZone(gx, gy)) continue;
			if (OAKS.some(([ox, oy]) => Math.abs(ox - gx) < 2 && Math.abs(oy - gy) < 2)) continue;
			const r = hash(gx * 3 + 1, gy * 5 + 2);
			if (r < 0.075) {
				const fir = hash(gx * 17, gy * 23) < 0.45;
				items.push({ d: gx + gy, draw: (c) => (fir ? drawFir(c, gx, gy) : drawTree(c, gx, gy)) });
			}
			else if (r < 0.13) items.push({ d: gx + gy, draw: (c) => drawShrub(c, gx, gy) });
			else if (r < 0.17) drawFlower(g, ...g2w(gx + 0.3 + hash(gx, gy * 7) * 0.4, gy + 0.6), hash(gy, gx));
		}
	}
	for (const [lx, ly] of LAMPS) items.push({ d: lx + ly, draw: (c) => drawLamp(c, lx, ly) });
	for (const b of BUILDINGS) {
		items.push({ d: b.gx + b.w + b.gy + b.dep, draw: (c) => b.render(c, b, hotspots, dynamic, occupied) });
	}
	items.sort((a, b) => a.d - b.d);
	for (const it of items) it.draw(g);

	drawDuckweed(g);

	return {
		canvas,
		hotspots,
		dynamic,
		isPlantable(gx, gy) {
			return tileType(Math.floor(gx), Math.floor(gy)) === 0 &&
				!occupied.has(`${Math.floor(gx)},${Math.floor(gy)}`);
		},
		plantFlower(wx, wy) {
			drawFlower(g, wx, wy, Math.random());
		},
	};
}

// ---------------------------------------------------------------- terrain
// underground cross-section: soil strata with buried surprises
function drawIslandSkirt(g) {
	const e = g2w(GRID, 0), s = g2w(GRID, GRID), w = g2w(0, GRID);

	function band(v0, v1, col) {
		g.fillStyle = col;
		g.beginPath();
		g.moveTo(w[0], w[1] + v0); g.lineTo(s[0], s[1] + v0); g.lineTo(e[0], e[1] + v0);
		g.lineTo(e[0], e[1] + v1); g.lineTo(s[0], s[1] + v1); g.lineTo(w[0], w[1] + v1);
		g.closePath();
		g.fill();
	}
	band(0, 12, SOIL);
	band(12, 36, SOIL_DARK);
	band(36, SKIRT_D, '#43301c');

	// pebbles + strata specks
	for (let i = 0; i < 90; i++) {
		const west = hash(i, 51) < 0.5;
		const u = hash(i, 13) * (WORLD_W / 2 - 30) + 10;
		const v = 8 + hash(i, 29) * (SKIRT_D - 16);
		const x = west ? w[0] + u : s[0] + u;
		const y = (west ? w[1] + u * 0.5 : s[1] - u * 0.5) + v;
		g.fillStyle = hash(i, 7) < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.09)';
		const ps = 1.5 + hash(i, 3) * 2.5;
		g.fillRect(x, y, ps, ps * 0.8);
	}

	// face transforms: SW face runs w→s, SE face runs s→e
	const onFace = (west, u, v) => {
		if (west) g.setTransform(1, 0.5, 0, 1, w[0] + u, w[1] + u * 0.5 + v);
		else g.setTransform(1, -0.5, 0, 1, s[0] + u, s[1] - u * 0.5 + v);
	};

	// --- dinosaur skeleton (SW face) ---
	onFace(true, 250, 26);
	g.strokeStyle = '#e6dcc4';
	g.fillStyle = '#e6dcc4';
	g.lineWidth = 2;
	g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(24, -5, 46, 0); g.stroke(); // spine
	g.lineWidth = 1.4;
	for (let i = 0; i < 5; i++) {
		g.beginPath(); g.arc(9 + i * 7, -1, 5, 0.25, Math.PI - 0.4); g.stroke(); // ribs
	}
	g.beginPath(); g.moveTo(46, 0); g.lineTo(56, -7); g.lineTo(64, -5); g.stroke(); // tail
	g.fillRect(-16, -8, 13, 9); // skull
	g.fillRect(-22, -4, 7, 5); // snout
	g.fillStyle = '#43301c';
	g.fillRect(-13, -6, 3, 3); // eye socket
	for (let i = 0; i < 3; i++) g.fillRect(-21 + i * 3, 0, 1.5, 2); // teeth gaps
	g.fillStyle = '#e6dcc4';
	g.fillRect(6, 6, 2, 7); g.fillRect(30, 6, 2, 7); // leg bones
	g.fillRect(4, 12, 6, 2); g.fillRect(28, 12, 6, 2); // feet
	resetT(g);

	// --- secret cave with crystals (SW face) ---
	onFace(true, 430, 24);
	g.fillStyle = '#151009';
	g.beginPath(); g.ellipse(0, 6, 24, 15, 0, Math.PI, 0); g.fill();
	g.fillRect(-24, 6, 48, 8);
	for (let i = 0; i < 4; i++) {
		g.fillStyle = i % 2 ? '#7ee8fa' : '#b197fc';
		const cx2 = -14 + i * 9;
		g.beginPath();
		g.moveTo(cx2 - 3, 13); g.lineTo(cx2, 4 - i % 2 * 3); g.lineTo(cx2 + 3, 13);
		g.closePath(); g.fill();
	}
	g.fillStyle = '#ffd43b';
	g.fillRect(14, 1, 2, 2); g.fillRect(18, 1, 2, 2); // eyes in the dark
	resetT(g);

	// --- buried treasure (SE face) ---
	onFace(false, 170, 28);
	g.fillStyle = '#8a5a33';
	g.fillRect(-9, -6, 18, 12);
	g.fillStyle = '#6f4a28';
	g.beginPath(); g.ellipse(0, -6, 9, 4, 0, Math.PI, 0); g.fill();
	g.fillStyle = '#ffd43b';
	g.fillRect(-1.5, -6, 3, 12);
	g.fillRect(-1, -3, 2, 3); // latch
	g.fillRect(-13, 5, 3, 2); g.fillRect(11, 3, 3, 2); g.fillRect(7, 7, 3, 2); // spilled coins
	resetT(g);

	// --- ammonite fossil (SE face) ---
	onFace(false, 430, 22);
	g.strokeStyle = '#d9c9a8';
	g.lineWidth = 2;
	for (let i = 0; i < 3; i++) {
		g.beginPath(); g.arc(i * 1.5, 0, 9 - i * 3, i * 0.8, Math.PI * 1.7 + i * 0.5); g.stroke();
	}
	resetT(g);
}

function tilePath(g, gx, gy) {
	const [x, y] = g2w(gx, gy);
	g.beginPath();
	g.moveTo(x, y);
	g.lineTo(x + HW, y + HH);
	g.lineTo(x, y + TH);
	g.lineTo(x - HW, y + HH);
	g.closePath();
}

function drawTiles(g) {
	for (let gy = 0; gy < GRID; gy++) {
		for (let gx = 0; gx < GRID; gx++) {
			const t = tileType(gx, gy);
			tilePath(g, gx, gy);
			if (t === 1) g.fillStyle = ROAD;
			else if (t === 2) g.fillStyle = WATER;
			else g.fillStyle = GRASS[Math.floor(hash(gx, gy) * GRASS.length)];
			g.fill();
			if (t === 1) {
				g.strokeStyle = ROAD_EDGE;
				g.lineWidth = 1;
				g.stroke();
			}
		}
	}
	// centre dashes
	g.strokeStyle = DASH;
	g.lineWidth = 2;
	for (const cy of ROAD_H_CENTERS) {
		for (let gx = 1; gx <= 37; gx += 2) {
			if (ROAD_COLS.includes(gx) || ROAD_COLS.includes(gx + 1)) continue;
			const [x1, y1] = g2w(gx + 0.2, cy), [x2, y2] = g2w(gx + 0.9, cy);
			g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
		}
	}
	for (const cx of ROAD_V_CENTERS) {
		for (let gy = 1; gy <= 37; gy += 2) {
			if (ROAD_ROWS.includes(gy) || ROAD_ROWS.includes(gy + 1)) continue;
			const [x1, y1] = g2w(cx, gy + 0.2), [x2, y2] = g2w(cx, gy + 0.9);
			g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
		}
	}
	// water sparkle
	for (let i = 0; i < 16; i++) {
		const a = hash(i, 77) * Math.PI * 2, r = hash(i, 33);
		const [x, y] = g2w(POND.cx + Math.cos(a) * POND.rx * r * 0.8, POND.cy + Math.sin(a) * POND.ry * r * 0.8);
		g.fillStyle = WATER_LIT;
		g.fillRect(Math.round(x), Math.round(y), 3, 1);
	}
}

function drawDuckweed(g) {
	for (let i = 0; i < 6; i++) {
		const a = 0.5 + i * 0.45;
		const [x, y] = g2w(POND.cx + Math.cos(a) * (POND.rx + 0.25), POND.cy + Math.sin(a) * (POND.ry + 0.25));
		g.strokeStyle = '#2b8a3e';
		g.lineWidth = 1;
		g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 5 - (i % 3)); g.stroke();
	}
}

function drawTree(g, tx, ty) {
	const [x, y] = g2w(tx + 0.5, ty + 0.5);
	const r = 5 + hash(tx * 7, ty * 3) * 3;
	g.fillStyle = 'rgba(0,0,0,0.15)';
	g.beginPath(); g.ellipse(x, y + 2, r * 0.9, r * 0.4, 0, 0, 7); g.fill();
	g.fillStyle = '#8a5a33';
	g.fillRect(x - 1, y - 8, 3, 9);
	const greens = ['#2f9e44', '#37b24d', '#2b8a3e'];
	const col = greens[Math.floor(hash(tx * 13, ty * 5) * 3)];
	g.fillStyle = col;
	g.beginPath(); g.ellipse(x + 0.5, y - 13, r, r * 0.95, 0, 0, 7); g.fill();
	g.fillStyle = 'rgba(255,255,255,0.18)';
	g.beginPath(); g.ellipse(x - r * 0.25, y - 15, r * 0.45, r * 0.4, 0, 0, 7); g.fill();
}

function drawOak(g, tx, ty) {
	const [x, y] = g2w(tx + 0.5, ty + 0.5);
	g.fillStyle = 'rgba(0,0,0,0.18)';
	g.beginPath(); g.ellipse(x, y + 2, 17, 6, 0, 0, 7); g.fill();
	// gnarled trunk with root flare
	g.fillStyle = '#6f4a28';
	g.beginPath();
	g.moveTo(x - 5, y + 1);
	g.lineTo(x - 2.5, y - 14);
	g.lineTo(x + 3.5, y - 14);
	g.lineTo(x + 6, y + 1);
	g.closePath();
	g.fill();
	g.fillStyle = '#5c3a1e';
	g.fillRect(x - 1, y - 14, 2, 15);
	// broad lumpy canopy
	g.fillStyle = '#2e8b3d';
	g.beginPath();
	g.ellipse(x, y - 24, 18, 13, 0, 0, 7);
	g.ellipse(x - 11, y - 20, 10, 8, 0, 0, 7);
	g.ellipse(x + 11, y - 21, 11, 8, 0, 0, 7);
	g.fill();
	g.fillStyle = '#3fa14f';
	g.beginPath();
	g.ellipse(x - 3, y - 28, 12, 8, 0, 0, 7);
	g.ellipse(x + 8, y - 25, 8, 6, 0, 0, 7);
	g.fill();
	g.fillStyle = 'rgba(255,255,255,0.16)';
	g.beginPath(); g.ellipse(x - 6, y - 31, 6, 3.5, 0, 0, 7); g.fill();
}

function drawFir(g, tx, ty) {
	const [x, y] = g2w(tx + 0.5, ty + 0.5);
	const s = 0.85 + hash(tx * 19, ty * 7) * 0.45; // height variety
	g.fillStyle = 'rgba(0,0,0,0.15)';
	g.beginPath(); g.ellipse(x, y + 1.5, 7 * s, 3 * s, 0, 0, 7); g.fill();
	g.fillStyle = '#5c3a1e';
	g.fillRect(x - 1, y - 5, 3, 6);
	// stacked boughs, darker than the deciduous trees
	const tiers = [[9, -4], [7.5, -11], [5.5, -17], [3.5, -22]];
	for (let i = 0; i < tiers.length; i++) {
		const [hw, ty2] = tiers[i];
		g.fillStyle = i % 2 ? '#1d6b34' : '#175a2b';
		g.beginPath();
		g.moveTo(x - hw * s, y + ty2 * s);
		g.lineTo(x + hw * s, y + ty2 * s);
		g.lineTo(x + 0.5, y + (ty2 - 9) * s);
		g.closePath();
		g.fill();
	}
}

function drawShrub(g, tx, ty) {
	const [x, y] = g2w(tx + 0.5, ty + 0.6);
	const r = 3 + hash(tx * 11, ty * 9) * 2.5;
	g.fillStyle = 'rgba(0,0,0,0.12)';
	g.beginPath(); g.ellipse(x, y + 1, r, r * 0.4, 0, 0, 7); g.fill();
	g.fillStyle = hash(tx, ty * 2) > 0.5 ? '#2f9e44' : '#40b458';
	g.beginPath();
	g.ellipse(x, y - r * 0.5, r, r * 0.7, 0, 0, 7);
	g.ellipse(x - r * 0.6, y - r * 0.25, r * 0.6, r * 0.45, 0, 0, 7);
	g.ellipse(x + r * 0.6, y - r * 0.25, r * 0.6, r * 0.45, 0, 0, 7);
	g.fill();
	if (hash(tx * 3, ty) > 0.6) {
		g.fillStyle = '#e0447c';
		g.fillRect(x - 1, y - r, 2, 2);
	}
}

function drawLamp(g, lx, ly) {
	const [x, y] = g2w(lx, ly);
	g.fillStyle = '#3b3f46';
	g.fillRect(x - 1, y - 18, 2, 19);
	g.fillStyle = '#ffd43b';
	g.fillRect(x - 2, y - 21, 4, 4);
	g.fillStyle = 'rgba(255,212,59,0.25)';
	g.beginPath(); g.ellipse(x, y - 19, 6, 5, 0, 0, 7); g.fill();
}

function drawFlower(g, wx, wy, rnd) {
	const cols = ['#e0447c', '#f59f00', '#ae3ec9', '#fa5252', '#4dabf7', '#fff'];
	const c = cols[Math.floor(rnd * cols.length)];
	const x = Math.round(wx), y = Math.round(wy);
	g.strokeStyle = '#2b8a3e';
	g.lineWidth = 1;
	g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 4); g.stroke();
	g.fillStyle = c;
	g.fillRect(x - 2, y - 7, 5, 5);
	g.fillStyle = '#ffd43b';
	g.fillRect(x - 0.5, y - 5.5, 2, 2);
}

// ---------------------------------------------------------------- iso boxes
function box(g, gx, gy, w, d, h, col) {
	const A = g2w(gx, gy), B = g2w(gx + w, gy), C = g2w(gx + w, gy + d), D = g2w(gx, gy + d);
	g.fillStyle = shade(col, 0.8);
	g.beginPath();
	g.moveTo(D[0], D[1] - h); g.lineTo(C[0], C[1] - h); g.lineTo(C[0], C[1]); g.lineTo(D[0], D[1]);
	g.closePath(); g.fill();
	g.fillStyle = shade(col, 0.62);
	g.beginPath();
	g.moveTo(C[0], C[1] - h); g.lineTo(B[0], B[1] - h); g.lineTo(B[0], B[1]); g.lineTo(C[0], C[1]);
	g.closePath(); g.fill();
	g.fillStyle = col;
	g.beginPath();
	g.moveTo(A[0], A[1] - h); g.lineTo(B[0], B[1] - h); g.lineTo(C[0], C[1] - h); g.lineTo(D[0], D[1] - h);
	g.closePath(); g.fill();
	g.strokeStyle = 'rgba(0,0,0,0.25)';
	g.lineWidth = 1;
	g.stroke();
	return { A, B, C, D };
}

// local (u,v) → the SW face of a box; u: 16px per tile along the face,
// v: px downward from the face top.
function onSW(g, gx, gy1, h) {
	const [x, y] = g2w(gx, gy1);
	g.setTransform(1, 0.5, 0, 1, x, y - h);
}
function resetT(g) {
	g.setTransform(1, 0, 0, 1, 0, 0);
}

function markOccupied(occ, gx, gy, w, d) {
	for (let x = Math.floor(gx) - 1; x < gx + w; x++)
		for (let y = Math.floor(gy) - 1; y < gy + d; y++) occ.add(`${x},${y}`);
}

function bbox(hotspots, id, corners, h, title, body, action) {
	const xs = corners.flatMap((c) => c[0]), ys = corners.flatMap((c) => c[1]);
	hotspots.push({
		id, title, body, action,
		x0: Math.min(...xs), x1: Math.max(...xs),
		y0: Math.min(...ys) - h, y1: Math.max(...ys),
	});
}

// ---------------------------------------------------------------- buildings
// clearH keeps auto-greenery out of the building's face + a margin south.
const BUILDINGS = [
	{ id: 'garage', gx: 3, gy: 2, w: 5, dep: 4, clearH: 26, render: renderGarage },
	{ id: 'post', gx: 15, gy: 4, w: 4, dep: 4, clearH: 38, render: renderPost },
	{ id: 'bakery', gx: 22, gy: 4, w: 4, dep: 4, clearH: 24, render: shopRenderer({
		h: 24, col: '#f9a8c9', signBg: '#7a2946', signFg: '#ffdeeb', sign: 'BAKERY',
		windows: 2, title: 'WOODTOWN BAKERY',
		body: 'Fresh pixel bread daily. Everything is exactly 8 bits crispy. The croissants are rectangles — nobody minds.',
	}) },
	{ id: 'wall', gx: 2, gy: 14, w: 8, dep: 1, clearH: 34, render: renderWall },
	{ id: 'shop', gx: 1, gy: 21, w: 5, dep: 4, clearH: 30, render: shopRenderer({
		h: 30, col: '#ffd166', signBg: '#1b2a4a', signFg: '#ffd43b', sign: 'NOT A FURNITURE', sign2: 'STORE',
		awning: true, sofa: true, title: 'DEFINITELY NOT A FURNITURE STORE',
		body: 'People keep wandering in looking for tables and chairs. Different Michael Wood. This store has never stocked a single item, and business is great.',
	}) },
	{ id: 'fountain', gx: 8, gy: 19, w: 3, dep: 3, clearH: 8, render: renderFountain },
	{ id: 'townhall', gx: 16, gy: 14, w: 6, dep: 5, clearH: 62, render: renderTownhall },
	{ id: 'cafe', gx: 24, gy: 14, w: 4, dep: 4, clearH: 26, render: shopRenderer({
		h: 26, col: '#b08968', signBg: '#3e2c1c', signFg: '#ffe8cc', sign: 'BEAN THERE',
		windows: 2, title: 'BEAN THERE CAFÉ',
		body: 'Coffee so pixelated you can count the beans. Free wifi, no password, no wifi.',
	}) },
	{ id: 'house', gx: 24, gy: 21, w: 3, dep: 3, clearH: 34, render: renderHouse },
	{ id: 'wemble', gx: 16, gy: 21, w: 5, dep: 3, clearH: 36, render: renderWemble },
	{ id: 'cinema', gx: 31, gy: 14, w: 5, dep: 5, clearH: 38, render: renderCinema },
	{ id: 'library', gx: 31, gy: 22, w: 4, dep: 3, clearH: 24, render: shopRenderer({
		h: 24, col: '#c8b6a6', signBg: '#4a3728', signFg: '#f4e3c2', sign: 'LIBRARY',
		windows: 3, title: 'WOODTOWN LIBRARY',
		body: 'One book: the resume. It’s at /resume.md and it’s riveting. Shhh.',
	}) },
	{ id: 'arcade', gx: 16, gy: 29, w: 4, dep: 4, clearH: 34, render: renderArcade },
	{ id: 'constr', gx: 23, gy: 29, w: 4, dep: 4, clearH: 14, render: renderConstruction },
	{ id: 'greenhouse', gx: 3, gy: 30, w: 4, dep: 3, clearH: 16, render: renderGreenhouse },
	{ id: 'tower', gx: 33, gy: 30, w: 2, dep: 2, clearH: 58, render: renderTower },
];

// generic storefront — most of the “variety” buildings are just configs
function shopRenderer(cfg) {
	return function (g, b, hotspots, dyn, occ) {
		const { gx, gy, w } = b, h = cfg.h, U = w * 16;
		const f = box(g, gx, gy, w, b.dep, h, cfg.col);
		markOccupied(occ, gx, gy, w, b.dep);
		onSW(g, gx, gy + b.dep, h);
		g.fillStyle = cfg.signBg;
		g.fillRect(3, 2, U - 6, cfg.sign2 ? 14 : 9);
		g.fillStyle = cfg.signFg;
		g.font = 'bold 6px monospace';
		g.fillText(cfg.sign, Math.max(4, (U - cfg.sign.length * 3.7) / 2), 8.5);
		if (cfg.sign2) g.fillText(cfg.sign2, Math.max(4, (U - cfg.sign2.length * 3.7) / 2), 15);
		const top = cfg.sign2 ? 17 : 12;
		if (cfg.awning) {
			for (let i = 0; i < Math.ceil(U / 9); i++) {
				g.fillStyle = i % 2 ? '#fff' : '#e0447c';
				g.fillRect(3 + i * 9, top, 9, 4);
			}
		}
		const wy = top + (cfg.awning ? 6 : 2);
		if (cfg.sofa) {
			g.fillStyle = '#cfe8ff';
			g.fillRect(8, wy, 30, h - wy - 1);
			const my = wy + (h - wy) / 2;
			g.fillStyle = '#8a5a33';
			g.fillRect(13, my + 1, 16, 2); g.fillRect(13, my - 2, 2.5, 5); g.fillRect(26.5, my - 2, 2.5, 5);
			g.strokeStyle = '#e03131'; g.lineWidth = 1.5;
			g.beginPath(); g.moveTo(11, wy + 1); g.lineTo(31, h - 2); g.moveTo(31, wy + 1); g.lineTo(11, h - 2); g.stroke();
		} else {
			g.fillStyle = '#bcd6ff';
			const n = cfg.windows || 2, ww = 10;
			for (let i = 0; i < n; i++) {
				g.fillRect(6 + i * ((U - 24) / Math.max(1, n - 1)), wy, ww, Math.min(9, h - wy - 8));
			}
		}
		g.fillStyle = '#7a5230';
		g.fillRect(U - 16, h - 11, 10, 11); // door
		resetT(g);
		bbox(hotspots, b.id, [f.A, f.B, f.C, f.D], h, cfg.title, cfg.body, cfg.action);
	};
}

const WALL_H = 34;
function renderWall(g, b, hotspots, dyn, occ) {
	const { gx, gy, w } = b;
	const f = box(g, gx, gy, w, 1, WALL_H, '#b0b4ba');
	markOccupied(occ, gx, gy, w, 1);
	dyn.wallFace = { gx, gy1: gy + 1, h: WALL_H, uw: w * 16 };
	const [cx, cy] = g2w(gx + 0.6, gy + 1.35);
	for (let i = 0; i < 3; i++) {
		g.fillStyle = ['#e0447c', '#4dabf7', '#ffd43b'][i];
		g.fillRect(cx + i * 5, cy - 6, 3, 6);
		g.fillStyle = '#333';
		g.fillRect(cx + i * 5, cy - 8, 3, 2);
	}
	bbox(hotspots, 'wall', [f.A, f.B, f.C, f.D], WALL_H, 'THE WALL',
		'Woodtown’s finest surface. Everything painted here is seen by every visitor, and slowly weathers away with time. Leave your mark.',
		{ label: '🎨 paint it', kind: 'wall' });
}

function renderGarage(g, b, hotspots, dyn, occ) {
	const { gx, gy, w } = b, h = 26;
	const f = box(g, gx, gy, w, b.dep, h, '#aab2c0');
	markOccupied(occ, gx, gy, w, b.dep);
	onSW(g, gx, gy + b.dep, h);
	g.fillStyle = '#6b7686';
	g.fillRect(12, 8, 46, 18);
	g.strokeStyle = '#59636f';
	for (let v = 11; v < 26; v += 4) { g.beginPath(); g.moveTo(12, v); g.lineTo(58, v); g.stroke(); }
	g.fillStyle = '#1b2a4a';
	g.font = 'bold 6px monospace';
	g.fillText('GARAGEBOT', 18, 6.5);
	resetT(g);
	const [ax, ay] = g2w(gx + 0.7, gy + 0.7);
	g.strokeStyle = '#444'; g.lineWidth = 1;
	g.beginPath(); g.moveTo(ax, ay - h); g.lineTo(ax, ay - h - 12); g.stroke();
	dyn.antenna = { x: ax, y: ay - h - 13 };
	const [rx, ry] = g2w(gx + w * 0.9, gy + b.dep + 0.35);
	g.fillStyle = '#4dd4e8';
	g.fillRect(rx, ry - 8, 6, 6);
	g.fillStyle = '#1b2a4a';
	g.fillRect(rx + 1, ry - 6.5, 1.6, 1.6); g.fillRect(rx + 3.4, ry - 6.5, 1.6, 1.6);
	g.fillStyle = '#4dd4e8';
	g.fillRect(rx + 1, ry - 2, 1.6, 2); g.fillRect(rx + 3.4, ry - 2, 1.6, 2);
	bbox(hotspots, 'garage', [f.A, f.B, f.C, f.D], h, 'GARAGEBOT HQ',
		'A small robot lives here and operates one very real garage door somewhere in Canada. Employee of the month, every month, since forever.');
}

function renderPost(g, b, hotspots, dyn, occ) {
	const { gx, gy, w } = b, h = 30;
	const f = box(g, gx, gy, w, b.dep, h, '#f4e3c2');
	markOccupied(occ, gx, gy, w, b.dep);
	g.save();
	g.translate(0, -h);
	box(g, gx - 0.15, gy - 0.15, w + 0.3, b.dep + 0.3, 5, '#4d79c7');
	g.restore();
	onSW(g, gx, gy + b.dep, h);
	g.fillStyle = '#4d79c7';
	g.fillRect(4, 4, 56, 9);
	g.fillStyle = '#fff';
	g.font = 'bold 7px monospace';
	g.fillText('POST OFFICE', 9, 11);
	g.fillStyle = '#7a5230';
	g.fillRect(27, 15, 10, 15);
	g.fillStyle = '#bcd6ff';
	g.fillRect(8, 16, 9, 8); g.fillRect(47, 16, 9, 8);
	resetT(g);
	const [px, py] = g2w(gx + w - 0.3, gy + 0.3);
	g.strokeStyle = '#555';
	g.beginPath(); g.moveTo(px, py - h - 5); g.lineTo(px, py - h - 24); g.stroke();
	dyn.flag = { x: px, y: py - h - 23 };
	bbox(hotspots, 'post', [f.A, f.B, f.C, f.D], h + 8, 'WOODTOWN POST OFFICE',
		'This entire town exists so one guy’s email gets delivered. That’s it. That’s the website. (No, you can’t see the mail.)');
}

function renderFountain(g, b, hotspots, dyn, occ) {
	const { gx, gy } = b;
	markOccupied(occ, gx, gy, b.w, b.dep);
	const [cx, cy] = g2w(gx + 1.5, gy + 1.5);
	// stone plaza
	g.fillStyle = '#c9c4b4';
	g.beginPath(); g.ellipse(cx, cy, 40, 20, 0, 0, 7); g.fill();
	g.fillStyle = '#a8a396';
	g.beginPath(); g.ellipse(cx, cy, 26, 13, 0, 0, 7); g.fill();
	g.fillStyle = WATER;
	g.beginPath(); g.ellipse(cx, cy, 20, 10, 0, 0, 7); g.fill();
	g.fillStyle = '#8f8a7e';
	g.fillRect(cx - 3, cy - 12, 6, 12);
	dyn.fountain = { x: cx, y: cy - 12 };
	bbox(hotspots, 'fountain', [[cx - 40, cy], [cx + 40, cy]], 20, 'WISHING FOUNTAIN',
		'Toss in a coin! (Coins not included. Wishes granted at the mayor’s discretion, which is to say never, but the splashing is nice.)');
}

function renderTownhall(g, b, hotspots, dyn, occ) {
	const { gx, gy, w } = b, h = 38;
	const f = box(g, gx, gy, w, b.dep, h, '#e9e4d8');
	markOccupied(occ, gx, gy, w, b.dep);
	// clock tower
	g.save();
	g.translate(0, -h);
	box(g, gx + 2, gy + 1.5, 2, 2, 22, '#dcd6c8');
	g.restore();
	onSW(g, gx, gy + b.dep, h);
	g.fillStyle = '#8f8878';
	g.fillRect(3, 4, 90, 8);
	g.fillStyle = '#fdf3d7';
	g.font = 'bold 7px monospace';
	g.fillText('TOWN HALL', 30, 10.5);
	// columns
	g.fillStyle = '#d5cfc0';
	for (let i = 0; i < 4; i++) g.fillRect(9 + i * 23, 14, 5, 24);
	g.fillStyle = '#7a5230';
	g.fillRect(42, 22, 12, 16);
	resetT(g);
	// clock face on the tower (hands are animated)
	const [tx, ty] = g2w(gx + 2, gy + 3.5);
	const cxy = { x: tx + 16, y: ty - h - 22 + 9 };
	g.fillStyle = '#fdf3d7';
	g.beginPath(); g.ellipse(cxy.x, cxy.y, 6, 6, 0, 0, 7); g.fill();
	g.strokeStyle = '#1b2a4a'; g.lineWidth = 1; g.stroke();
	dyn.clock = cxy;
	bbox(hotspots, 'townhall', [f.A, f.B, f.C, f.D], h + 24, 'WOODTOWN TOWN HALL',
		'Seat of government. The clock is real — it shows YOUR time, because in Woodtown, the visitor is always right.');
}

function renderHouse(g, b, hotspots, dyn, occ) {
	const { gx, gy, w } = b, h = 22;
	const f = box(g, gx, gy, w, b.dep, h, '#e8896a');
	markOccupied(occ, gx, gy, w, b.dep);
	onSW(g, gx, gy + b.dep, h);
	g.fillStyle = '#7a5230';
	g.fillRect(6, 10, 9, 12);
	g.fillStyle = '#bcd6ff';
	g.fillRect(24, 9, 10, 8);
	resetT(g);
	const [cx, cy] = g2w(gx + 0.6, gy + 0.5);
	g.fillStyle = '#9a6348';
	g.fillRect(cx - 2, cy - h - 10, 5, 10);
	dyn.chimney = { x: cx + 0.5, y: cy - h - 11 };
	bbox(hotspots, 'house', [f.A, f.B, f.C, f.D], h + 10, 'MIKE’S PLACE',
		'Home of the mayor (self-appointed, ran unopposed). If you need him, leave a note on the big wall downtown.');
}

function renderCinema(g, b, hotspots, dyn, occ) {
	const { gx, gy, w } = b, h = 36;
	const f = box(g, gx, gy, w, b.dep, h, '#c94f7c');
	markOccupied(occ, gx, gy, w, b.dep);
	onSW(g, gx, gy + b.dep, h);
	g.fillStyle = '#12131a';
	g.fillRect(3, 2, 74, 12);
	g.fillStyle = '#fff';
	g.font = 'bold 8px monospace';
	g.fillText('PIXELPLEX', 18, 11);
	// poster: now showing
	g.fillStyle = '#fdf3d7';
	g.fillRect(6, 17, 26, 16);
	g.fillStyle = '#1b2a4a';
	g.font = 'bold 4px monospace';
	g.fillText('NOW SHOWING', 8, 22);
	g.fillText('"NOT A BUG"', 8, 27);
	g.fillText('★★★★★', 10, 31.5);
	g.fillStyle = '#7a5230';
	g.fillRect(44, 22, 12, 14);
	g.fillStyle = '#ffd43b';
	for (let i = 0; i < 5; i++) g.fillRect(4 + i * 15, 14.5, 3, 1.5); // marquee dots
	resetT(g);
	bbox(hotspots, 'cinema', [f.A, f.B, f.C, f.D], h, 'PIXELPLEX CINEMA',
		'Now showing: “NOT A BUG” — the heartwarming story of a feature. One screen, zero seats, five stars. (Sequel “NOT A BUG 2: STILL A FEATURE” in production.)');
}

function renderArcade(g, b, hotspots, dyn, occ) {
	const { gx, gy, w } = b, h = 34;
	const f = box(g, gx, gy, w, b.dep, h, '#5f3dc4');
	markOccupied(occ, gx, gy, w, b.dep);
	onSW(g, gx, gy + b.dep, h);
	g.fillStyle = '#12131a';
	g.fillRect(3, 3, 58, 12);
	g.fillStyle = '#12131a';
	g.fillRect(8, 18, 14, 12); g.fillRect(40, 18, 14, 12);
	g.fillStyle = '#ffd43b';
	g.font = 'bold 6px monospace';
	g.fillText('SOON!', 25, 26);
	resetT(g);
	dyn.marquee = { gx, gy1: gy + b.dep, h };
	bbox(hotspots, 'arcade', [f.A, f.B, f.C, f.D], h, 'WOODTOWN ARCADE',
		'Cabinets are on order. This town keeps growing — new stuff shows up when the mayor gets a weird idea. Check back.');
}

function renderConstruction(g, b, hotspots, dyn, occ) {
	const { gx, gy, w } = b;
	markOccupied(occ, gx, gy, w, b.dep);
	// dirt lot
	for (let x = gx; x < gx + w; x++)
		for (let y = gy; y < gy + b.dep; y++) {
			tilePath(g, x, y);
			g.fillStyle = hash(x, y) > 0.5 ? '#c9a36a' : '#bd9760';
			g.fill();
		}
	// fence posts
	g.fillStyle = '#e8590c';
	for (let i = 0; i <= w; i++) {
		const [px, py] = g2w(gx + i, gy + b.dep);
		g.fillRect(px - 1, py - 6, 2, 6);
		const [qx, qy] = g2w(gx + w, gy + i);
		g.fillRect(qx - 1, qy - 6, 2, 6);
	}
	// crane
	const [mx, my] = g2w(gx + 0.8, gy + 0.8);
	g.strokeStyle = '#f59f00';
	g.lineWidth = 2;
	g.beginPath(); g.moveTo(mx, my); g.lineTo(mx, my - 46); g.stroke();
	g.beginPath(); g.moveTo(mx - 10, my - 40); g.lineTo(mx + 34, my - 40); g.stroke();
	g.lineWidth = 1;
	g.strokeStyle = '#666';
	g.beginPath(); g.moveTo(mx + 28, my - 40); g.lineTo(mx + 28, my - 18); g.stroke();
	g.fillStyle = '#868e96';
	g.fillRect(mx + 24, my - 18, 8, 6); // dangling block
	// sign
	const [sx, sy] = g2w(gx + w - 0.5, gy + b.dep - 0.2);
	g.fillStyle = '#ffd43b';
	g.fillRect(sx - 14, sy - 16, 28, 10);
	g.fillStyle = '#1b2a4a';
	g.font = 'bold 4px monospace';
	g.fillText('FUTURE WEIRD', sx - 12, sy - 11.5);
	g.fillText('IDEA HERE', sx - 9, sy - 7.5);
	const c1 = g2w(gx, gy), c2 = g2w(gx + w, gy + b.dep);
	bbox(hotspots, 'constr', [c1, c2, g2w(gx + w, gy), g2w(gx, gy + b.dep)], 46, 'CONSTRUCTION SITE',
		'Something is being built here. Nobody knows what — the blueprints are just a napkin with “make it fun” written on it.');
}

function renderGreenhouse(g, b, hotspots, dyn, occ) {
	const { gx, gy, w } = b, h = 14;
	markOccupied(occ, gx, gy, w, b.dep + 3);
	g.globalAlpha = 0.85;
	const f = box(g, gx, gy, w, b.dep, h, '#9fe3d0');
	g.globalAlpha = 1;
	onSW(g, gx, gy + b.dep, h);
	g.strokeStyle = '#e6fcf5';
	g.lineWidth = 1;
	for (let u = 8; u < w * 16; u += 10) { g.beginPath(); g.moveTo(u, 0); g.lineTo(u, h); g.stroke(); }
	resetT(g);
	// crop rows south of the glass
	for (let row = 0; row < 2; row++) {
		for (let i = 0; i < 6; i++) {
			const [px, py] = g2w(gx + 0.5 + i * 0.55, gy + b.dep + 0.8 + row);
			g.fillStyle = '#8a5a33';
			g.fillRect(px - 2, py - 1, 5, 2);
			g.fillStyle = row ? '#37b24d' : '#e0447c';
			g.fillRect(px - 1, py - 4, 3, 3);
		}
	}
	bbox(hotspots, 'greenhouse', [f.A, f.B, f.C, f.D], h, 'FERN’S GREENHOUSE',
		'Tomatoes, flowers, and one suspiciously large pumpkin being grown for the fair. The fair is also not built yet.');
}

function renderWemble(g, b, hotspots, dyn, occ) {
	const { gx, gy, w } = b, h = 36, U = w * 16;
	const f = box(g, gx, gy, w, b.dep, h, '#e5e7eb');
	markOccupied(occ, gx, gy, w, b.dep);
	onSW(g, gx, gy + b.dep, h);
	// brand band
	g.fillStyle = '#2563eb';
	g.fillRect(3, 2, U - 6, 9);
	g.fillStyle = '#fff';
	g.font = 'bold 7px monospace';
	g.fillText('WEMBLE', 26, 9);
	g.fillStyle = '#1a1a1a';
	g.font = 'bold 4px monospace';
	g.fillText('DEVELOPMENT CORPORATION', 12, 15.5);
	// glass office grid
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 5; col++) {
			g.fillStyle = (row * 5 + col) % 4 === 1 ? '#fdf3d7' : '#93c5fd'; // someone's working late
			g.fillRect(6 + col * 15, 18 + row * 5.6, 11, 4);
		}
	}
	g.fillStyle = '#1a1a1a';
	g.fillRect(U - 18, h - 11, 11, 11); // door
	resetT(g);
	// rooftop 'W' flag
	const [px, py] = g2w(gx + 0.4, gy + 0.4);
	g.strokeStyle = '#555';
	g.beginPath(); g.moveTo(px, py - h); g.lineTo(px, py - h - 16); g.stroke();
	g.fillStyle = '#2563eb';
	g.fillRect(px, py - h - 16, 10, 7);
	g.fillStyle = '#fff';
	g.font = 'bold 6px monospace';
	g.fillText('W', px + 3, py - h - 10.5);
	bbox(hotspots, 'wemble', [f.A, f.B, f.C, f.D], h + 16, 'WEMBLE DEVELOPMENT CORPORATION — HQ',
		'World headquarters. A real software company, run by the mayor. Rumour has it they built this entire town.',
		{ label: 'visit wemble.com →', kind: 'link', url: 'https://wemble.com' });
}

function renderTower(g, b, hotspots, dyn, occ) {
	const { gx, gy } = b;
	markOccupied(occ, gx, gy, 2, 2);
	const [bx, by] = g2w(gx + 1, gy + 1);
	g.strokeStyle = '#5e6673';
	g.lineWidth = 2;
	for (const [dx] of [[-9], [9]]) {
		g.beginPath(); g.moveTo(bx + dx, by - 2); g.lineTo(bx + dx * 0.6, by - 30); g.stroke();
	}
	g.fillStyle = '#74c0fc';
	g.fillRect(bx - 14, by - 52, 28, 22);
	g.beginPath(); g.ellipse(bx, by - 52, 14, 5, 0, 0, 7); g.fillStyle = '#a5d8ff'; g.fill();
	g.beginPath(); g.ellipse(bx, by - 30, 14, 5, 0, 0, 7); g.fillStyle = '#5aaee8'; g.fill();
	g.fillStyle = '#1b2a4a';
	g.font = 'bold 5px monospace';
	g.fillText('WOODTOWN', bx - 11, by - 40);
	bbox(hotspots, 'tower', [[bx - 15, by], [bx + 15, by]], 55, 'WOODTOWN WATER TOWER',
		'Est. whenever this domain was registered. Population: 1, plus you. Water quality: pixelated.');
}

// ---------------------------------------------------------------- animation
export function drawDynamic(ctx, town, t, wallCanvas) {
	const dyn = town.dynamic;

	if (dyn.wallFace && wallCanvas) {
		const wf = dyn.wallFace;
		const [x, y] = g2w(wf.gx, wf.gy1);
		ctx.save();
		ctx.transform(wf.uw / wallCanvas.width, (wf.uw * 0.5) / wallCanvas.width, 0, wf.h / wallCanvas.height, x, y - wf.h);
		ctx.drawImage(wallCanvas, 0, 0);
		ctx.restore();
	}

	if (dyn.antenna) {
		ctx.fillStyle = Math.floor(t / 700) % 2 ? '#ff6b6b' : '#8a2f2f';
		ctx.fillRect(dyn.antenna.x - 1.5, dyn.antenna.y - 1.5, 3, 3);
	}

	if (dyn.flag) {
		const { x, y } = dyn.flag;
		const wave = Math.sin(t / 300) * 2;
		ctx.fillStyle = '#e0447c';
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + 12, y + 2 + wave);
		ctx.lineTo(x, y + 7);
		ctx.closePath();
		ctx.fill();
	}

	if (dyn.chimney) {
		for (let i = 0; i < 3; i++) {
			const p = ((t / 1600) + i / 3) % 1;
			ctx.fillStyle = `rgba(240,240,245,${0.55 * (1 - p)})`;
			const s = 2 + p * 4;
			ctx.fillRect(dyn.chimney.x - s / 2 + Math.sin(p * 6 + i) * 2, dyn.chimney.y - p * 22, s, s);
		}
	}

	if (dyn.marquee) {
		const m = dyn.marquee;
		const [x, y] = g2w(m.gx, m.gy1);
		ctx.save();
		ctx.transform(1, 0.5, 0, 1, x, y - m.h);
		ctx.font = 'bold 8px monospace';
		ctx.fillStyle = Math.floor(t / 800) % 2 ? '#ff5ea8' : '#4dd4e8';
		ctx.fillText('ARCADE', 17, 12);
		ctx.restore();
	}

	if (dyn.fountain) {
		const { x, y } = dyn.fountain;
		for (let i = 0; i < 6; i++) {
			const p = ((t / 900) + i / 6) % 1;
			ctx.fillStyle = `rgba(160,220,250,${0.9 - p * 0.7})`;
			const dx = Math.sin(i * 2.4) * p * 10;
			ctx.fillRect(x + dx - 1, y - 8 * Math.sin(p * Math.PI) - 2, 2, 2);
		}
	}

	if (dyn.clock) {
		const { x, y } = dyn.clock;
		const now = new Date();
		const ha = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2;
		const ma = now.getMinutes() / 60 * Math.PI * 2 - Math.PI / 2;
		ctx.strokeStyle = '#1b2a4a';
		ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ha) * 3, y + Math.sin(ha) * 3); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ma) * 4.5, y + Math.sin(ma) * 4.5); ctx.stroke();
	}

	drawCat(ctx, t);
	drawDuck(ctx, t);
	drawClouds(ctx, t);
	drawUfo(ctx, t);
}

// rare visitor from... elsewhere. Guaranteed flyby on the first cycle so
// every fresh visitor gets one sighting; after that it's luck.
function drawUfo(ctx, t) {
	const CYCLE = 75000, FLIGHT = 9000;
	const cyc = Math.floor(t / CYCLE);
	if (cyc > 0 && hash(cyc, 999) > 0.3) return;
	const p = (t % CYCLE) / FLIGHT;
	if (p > 1) return;
	const dir = hash(cyc, 555) > 0.5 ? 1 : -1;
	const x = dir > 0 ? -70 + p * (WORLD_W + 140) : WORLD_W + 70 - p * (WORLD_W + 140);
	const y = 18 + hash(cyc, 333) * 44 + Math.sin(p * 17) * 6;
	ctx.save();
	ctx.translate(x, y);
	// dome first, saucer over its lower half
	ctx.fillStyle = '#a5f3fc';
	ctx.beginPath(); ctx.ellipse(0, -4, 7, 6, 0, 0, 7); ctx.fill();
	ctx.fillStyle = '#3b4552';
	ctx.beginPath(); ctx.ellipse(0, -4.5, 2.5, 2, 0, 0, 7); ctx.fill(); // pilot?
	ctx.fillStyle = '#b7c0cc';
	ctx.beginPath(); ctx.ellipse(0, 0, 17, 5.5, 0, 0, 7); ctx.fill();
	ctx.fillStyle = '#8d97a5';
	ctx.beginPath(); ctx.ellipse(0, 2, 12, 3, 0, 0, 7); ctx.fill();
	// blinking underside lights
	const k = Math.floor(t / 140) % 3;
	for (let i = 0; i < 3; i++) {
		ctx.fillStyle = i === k ? '#ff5ea8' : '#ffd43b';
		ctx.fillRect(-7 + i * 7, 2.5, 2.5, 2.5);
	}
	ctx.restore();
}

// cat + duck are clickable critters; expose their positions
export function catPos(t) {
	const period = 70000, p = (t % period) / period;
	const u = p < 0.5 ? 2 + p * 2 * 35 : 37 - (p - 0.5) * 2 * 35;
	return { u, dir: p < 0.5 ? 1 : -1, gy: 26.9 };
}

function drawCat(ctx, t) {
	const { u, dir, gy } = catPos(t);
	const [x, y] = g2w(u, gy);
	const step = Math.sin(t / 90) * 1;
	ctx.save();
	ctx.translate(x, y);
	if (dir < 0) ctx.scale(-1, 1);
	ctx.fillStyle = '#3b3f46';
	ctx.fillRect(-6, -6, 11, 4);
	ctx.fillRect(3, -9, 5, 5);
	ctx.fillRect(3, -11, 1.6, 2); ctx.fillRect(6.4, -11, 1.6, 2);
	ctx.fillRect(-6, -2, 1.6, 2 + step); ctx.fillRect(3, -2, 1.6, 2 - step);
	ctx.fillRect(-9, -8 + Math.sin(t / 400) * 1.5, 3, 1.6);
	ctx.fillStyle = '#ffd43b';
	ctx.fillRect(6.5, -8, 1, 1);
	ctx.restore();
}

export function duckPos(t) {
	return {
		gx: POND.cx + Math.cos(t / 5200) * 1.3,
		gy: POND.cy + Math.sin(t / 4100) * 0.8,
	};
}

function drawDuck(ctx, t) {
	const { gx, gy } = duckPos(t);
	const [x, y] = g2w(gx, gy);
	const flip = Math.cos(t / 5200) > 0 ? -1 : 1;
	ctx.save();
	ctx.translate(x, y);
	if (flip < 0) ctx.scale(-1, 1);
	ctx.fillStyle = '#ffd43b';
	ctx.fillRect(-3, -4, 6, 3.4);
	ctx.fillRect(1, -7, 3, 3.4);
	ctx.fillStyle = '#f76707';
	ctx.fillRect(4, -6, 2, 1.4);
	ctx.fillStyle = '#1b2a4a';
	ctx.fillRect(2.2, -6.2, 1, 1);
	ctx.strokeStyle = 'rgba(255,255,255,0.5)';
	ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke();
	ctx.restore();
}

const CLOUDS = [
	{ y: 30, s: 1.5, v: 5200 },
	{ y: 58, s: 1, v: 7600 },
	{ y: 14, s: 0.8, v: 9800 },
	{ y: 44, s: 1.2, v: 6400 },
];
function drawClouds(ctx, t) {
	ctx.fillStyle = 'rgba(255,255,255,0.85)';
	for (let i = 0; i < CLOUDS.length; i++) {
		const c = CLOUDS[i];
		const x = ((t / c.v) * 60 + i * 340) % (WORLD_W + 160) - 80;
		ctx.save();
		ctx.translate(x, c.y);
		ctx.scale(c.s, c.s);
		ctx.beginPath();
		ctx.ellipse(0, 0, 22, 8, 0, 0, 7);
		ctx.ellipse(14, -4, 14, 7, 0, 0, 7);
		ctx.ellipse(-14, -2, 12, 6, 0, 0, 7);
		ctx.fill();
		ctx.restore();
	}
}
