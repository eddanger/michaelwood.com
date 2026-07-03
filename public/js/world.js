// world.js — terrain: tiles, roads, the lake, scattered greenery, and the
// deep underground cross-section. Renders once into an offscreen canvas.

import {
	GRID, OY, SKIRT_D, WORLD_W, g2w, hash, tilePath, resetT,
	GRASS, ROAD, ROAD_EDGE, DASH, WATER, WATER_LIT, SOIL, SOIL_DARK,
} from './iso.js';
import { BUILDINGS, renderBuildings } from './buildings.js';

// ---------------------------------------------------------------- map data
// tile types: 0 grass, 1 road, 2 water
export const ROAD_MIN = 1, ROAD_MAX = GRID - 2;
export const ROAD_ROWS = [10, 11, 26, 27], ROAD_COLS = [12, 13, 28, 29];
export const ROAD_H_CENTERS = [11, 27], ROAD_V_CENTERS = [13, 29];
export const LAKE = { cx: 40, cy: 6.2, rx: 6.2, ry: 3.3 };

export function tileType(gx, gy) {
	if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return -1;
	const px = gx + 0.5, py = gy + 0.5;
	if (((px - LAKE.cx) / LAKE.rx) ** 2 + ((py - LAKE.cy) / LAKE.ry) ** 2 <= 1) return 2;
	if (ROAD_ROWS.includes(gy) && gx >= ROAD_MIN && gx <= ROAD_MAX) return 1;
	if (ROAD_COLS.includes(gx) && gy >= ROAD_MIN && gy <= ROAD_MAX) return 1;
	return 0;
}

const LAMPS = [
	[11.6, 9.6], [14.4, 12.4], [27.6, 9.6], [30.4, 12.4],
	[11.6, 25.6], [14.4, 28.4], [27.6, 25.6], [30.4, 28.4],
	[3, 12.4], [46, 9.6], [3, 28.4], [46, 25.6],
];

const OAKS = [[10, 6], [14, 24], [9, 36], [32, 2.5], [37, 21], [44, 32], [22, 42]];

// keep greenery off buildings and the strip south of them (face visibility)
function inBuildingZone(gx, gy) {
	for (const b of BUILDINGS) {
		const clear = Math.ceil((b.clearH || 30) / 8) + 1;
		if (gx >= b.gx - 1 && gx <= b.gx + b.w && gy >= b.gy - 1 && gy <= b.gy + b.dep + clear) return true;
	}
	return false;
}

// ---------------------------------------------------------------- build
export function createWorld() {
	const canvas = document.createElement('canvas');
	canvas.width = WORLD_W;
	canvas.height = OY + GRID * 16 + SKIRT_D + 20;
	const g = canvas.getContext('2d');

	const occupied = new Set();
	const hotspots = [];
	const anchors = {}; // named points for animated entities

	drawUnderground(g);
	drawTiles(g);

	const items = [];
	for (const [ox, oy] of OAKS) items.push({ d: ox + oy, draw: (c) => drawOak(c, ox, oy) });
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
	renderBuildings(items, hotspots, anchors, occupied);
	items.sort((a, b) => a.d - b.d);
	for (const it of items) it.draw(g);

	drawReeds(g);

	return {
		canvas,
		hotspots,
		anchors,
		isPlantable(gx, gy) {
			return tileType(Math.floor(gx), Math.floor(gy)) === 0 &&
				!occupied.has(`${Math.floor(gx)},${Math.floor(gy)}`);
		},
		plantFlower(wx, wy) {
			drawFlower(g, wx, wy, Math.random());
		},
	};
}

// ---------------------------------------------------------------- surface
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
	g.strokeStyle = DASH;
	g.lineWidth = 2;
	for (const cy of ROAD_H_CENTERS) {
		for (let gx = ROAD_MIN; gx <= ROAD_MAX - 1; gx += 2) {
			if (ROAD_COLS.includes(gx) || ROAD_COLS.includes(gx + 1)) continue;
			const [x1, y1] = g2w(gx + 0.2, cy), [x2, y2] = g2w(gx + 0.9, cy);
			g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
		}
	}
	for (const cx of ROAD_V_CENTERS) {
		for (let gy = ROAD_MIN; gy <= ROAD_MAX - 1; gy += 2) {
			if (ROAD_ROWS.includes(gy) || ROAD_ROWS.includes(gy + 1)) continue;
			const [x1, y1] = g2w(cx, gy + 0.2), [x2, y2] = g2w(cx, gy + 0.9);
			g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
		}
	}
	// lake sparkle
	for (let i = 0; i < 30; i++) {
		const a = hash(i, 77) * Math.PI * 2, r = hash(i, 33);
		const [x, y] = g2w(LAKE.cx + Math.cos(a) * LAKE.rx * r * 0.85, LAKE.cy + Math.sin(a) * LAKE.ry * r * 0.85);
		g.fillStyle = WATER_LIT;
		g.fillRect(Math.round(x), Math.round(y), 3, 1);
	}
}

function drawReeds(g) {
	for (let i = 0; i < 10; i++) {
		const a = 0.4 + i * 0.3;
		const [x, y] = g2w(LAKE.cx + Math.cos(a) * (LAKE.rx + 0.3), LAKE.cy + Math.sin(a) * (LAKE.ry + 0.3));
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
	g.fillStyle = greens[Math.floor(hash(tx * 13, ty * 5) * 3)];
	g.beginPath(); g.ellipse(x + 0.5, y - 13, r, r * 0.95, 0, 0, 7); g.fill();
	g.fillStyle = 'rgba(255,255,255,0.18)';
	g.beginPath(); g.ellipse(x - r * 0.25, y - 15, r * 0.45, r * 0.4, 0, 0, 7); g.fill();
}

function drawOak(g, tx, ty) {
	const [x, y] = g2w(tx + 0.5, ty + 0.5);
	g.fillStyle = 'rgba(0,0,0,0.18)';
	g.beginPath(); g.ellipse(x, y + 2, 17, 6, 0, 0, 7); g.fill();
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
	const s = 0.85 + hash(tx * 19, ty * 7) * 0.45;
	g.fillStyle = 'rgba(0,0,0,0.15)';
	g.beginPath(); g.ellipse(x, y + 1.5, 7 * s, 3 * s, 0, 0, 7); g.fill();
	g.fillStyle = '#5c3a1e';
	g.fillRect(x - 1, y - 5, 3, 6);
	const tiers = [[9, -4], [7.5, -11], [5.5, -17], [3.5, -22]];
	for (let i = 0; i < tiers.length; i++) {
		const [hw2, ty2] = tiers[i];
		g.fillStyle = i % 2 ? '#1d6b34' : '#175a2b';
		g.beginPath();
		g.moveTo(x - hw2 * s, y + ty2 * s);
		g.lineTo(x + hw2 * s, y + ty2 * s);
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
	const x = Math.round(wx), y = Math.round(wy);
	g.strokeStyle = '#2b8a3e';
	g.lineWidth = 1;
	g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 4); g.stroke();
	g.fillStyle = cols[Math.floor(rnd * cols.length)];
	g.fillRect(x - 2, y - 7, 5, 5);
	g.fillStyle = '#ffd43b';
	g.fillRect(x - 0.5, y - 5.5, 2, 2);
}

// ============================================================ UNDERGROUND
// The island cross-section: ~480px of strata, secrets, and one very lost
// rubber duck. SW face runs west→south, SE face runs south→east.
function drawUnderground(g) {
	const e = g2w(GRID, 0), s = g2w(GRID, GRID), w = g2w(0, GRID);
	const FACE = WORLD_W / 2; // px length of each face

	function band(v0, v1, col) {
		g.fillStyle = col;
		g.beginPath();
		g.moveTo(w[0], w[1] + v0); g.lineTo(s[0], s[1] + v0); g.lineTo(e[0], e[1] + v0);
		g.lineTo(e[0], e[1] + v1); g.lineTo(s[0], s[1] + v1); g.lineTo(w[0], w[1] + v1);
		g.closePath();
		g.fill();
	}
	// strata: topsoil → subsoil → clay → stone → deep stone → magma
	band(0, 12, SOIL);
	band(12, 60, SOIL_DARK);
	band(60, 160, '#4a3423');
	band(160, 300, '#3a2f28');
	band(300, 440, '#2b2523');
	band(440, SKIRT_D, '#7a1f0e');
	// magma glow
	const mg = g.createLinearGradient(0, w[1] + 420, 0, w[1] + SKIRT_D);
	mg.addColorStop(0, 'rgba(255,100,20,0)');
	mg.addColorStop(1, 'rgba(255,140,30,0.55)');
	g.fillStyle = mg;
	band(420, SKIRT_D, g.fillStyle);

	// scattered pebbles / specks through all layers
	for (let i = 0; i < 420; i++) {
		const west = hash(i, 51) < 0.5;
		const u = hash(i, 13) * (FACE - 30) + 10;
		const v = 8 + hash(i, 29) * (SKIRT_D - 60);
		const x = west ? w[0] + u : s[0] + u;
		const y = (west ? w[1] + u * 0.5 : s[1] - u * 0.5) + v;
		g.fillStyle = hash(i, 7) < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.08)';
		const ps = 1.5 + hash(i, 3) * 2.5;
		g.fillRect(x, y, ps, ps * 0.8);
	}

	const onFace = (west, u, v) => {
		if (west) g.setTransform(1, 0.5, 0, 1, w[0] + u, w[1] + u * 0.5 + v);
		else g.setTransform(1, -0.5, 0, 1, s[0] + u, s[1] - u * 0.5 + v);
	};

	// ---- SW face ------------------------------------------------------
	// tree roots
	for (const ru of [70, 330]) {
		onFace(true, ru, 2);
		g.strokeStyle = '#5c3a1e';
		g.lineWidth = 2;
		for (let i = -2; i <= 2; i++) {
			g.beginPath();
			g.moveTo(0, 0);
			g.quadraticCurveTo(i * 8, 14, i * 14, 26 + Math.abs(i) * 4);
			g.stroke();
		}
		resetT(g);
	}

	// dinosaur skeleton
	onFace(true, 250, 40);
	g.strokeStyle = '#e6dcc4';
	g.fillStyle = '#e6dcc4';
	g.lineWidth = 2;
	g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(24, -5, 46, 0); g.stroke();
	g.lineWidth = 1.4;
	for (let i = 0; i < 5; i++) {
		g.beginPath(); g.arc(9 + i * 7, -1, 5, 0.25, Math.PI - 0.4); g.stroke();
	}
	g.beginPath(); g.moveTo(46, 0); g.lineTo(56, -7); g.lineTo(64, -5); g.stroke();
	g.fillRect(-16, -8, 13, 9);
	g.fillRect(-22, -4, 7, 5);
	g.fillStyle = '#3a2c1c';
	g.fillRect(-13, -6, 3, 3);
	for (let i = 0; i < 3; i++) g.fillRect(-21 + i * 3, 0, 1.5, 2);
	g.fillStyle = '#e6dcc4';
	g.fillRect(6, 6, 2, 7); g.fillRect(30, 6, 2, 7);
	g.fillRect(4, 12, 6, 2); g.fillRect(28, 12, 6, 2);
	resetT(g);

	// crystal cave with eyes
	onFace(true, 650, 28);
	g.fillStyle = '#151009';
	g.beginPath(); g.ellipse(0, 6, 24, 15, 0, Math.PI, 0); g.fill();
	g.fillRect(-24, 6, 48, 8);
	for (let i = 0; i < 4; i++) {
		g.fillStyle = i % 2 ? '#7ee8fa' : '#b197fc';
		const cx2 = -14 + i * 9;
		g.beginPath();
		g.moveTo(cx2 - 3, 13); g.lineTo(cx2, 4 - (i % 2) * 3); g.lineTo(cx2 + 3, 13);
		g.closePath(); g.fill();
	}
	g.fillStyle = '#ffd43b';
	g.fillRect(14, 1, 2, 2); g.fillRect(18, 1, 2, 2);
	resetT(g);

	// abandoned mineshaft: vertical shaft + two drifts, ladder, cart
	onFace(true, 480, 20);
	g.fillStyle = '#17110b';
	g.fillRect(0, 0, 26, 265); // shaft
	g.fillStyle = '#141210';
	g.fillRect(-110, 100, 110, 24); // upper drift (left)
	g.fillRect(26, 236, 130, 26); // lower drift (right)
	g.strokeStyle = '#8a6a3c'; // timber frames
	g.lineWidth = 3;
	for (const dv of [0, 100, 236]) {
		g.beginPath(); g.moveTo(-1, dv); g.lineTo(-1, dv + 26); g.moveTo(27, dv); g.lineTo(27, dv + 26); g.stroke();
	}
	for (let v = 8; v < 260; v += 16) { // ladder
		g.strokeStyle = '#a07a45';
		g.lineWidth = 1.5;
		g.beginPath(); g.moveTo(5, v); g.lineTo(15, v); g.stroke();
	}
	g.strokeStyle = '#a07a45';
	g.beginPath(); g.moveTo(5, 4); g.lineTo(5, 262); g.moveTo(15, 4); g.lineTo(15, 262); g.stroke();
	// minecart in lower drift
	g.fillStyle = '#5e6673';
	g.fillRect(120, 244, 22, 12);
	g.fillStyle = '#2b2523';
	g.beginPath(); g.arc(126, 258, 3, 0, 7); g.arc(137, 258, 3, 0, 7); g.fill();
	g.fillStyle = '#ffd43b'; // ore glint in the cart
	g.fillRect(124, 241, 4, 3); g.fillRect(131, 240, 5, 4);
	// lantern
	g.fillStyle = '#ffb52e';
	g.fillRect(-90, 108, 4, 5);
	g.fillStyle = 'rgba(255,181,46,0.18)';
	g.beginPath(); g.ellipse(-88, 111, 16, 12, 0, 0, 7); g.fill();
	resetT(g);

	// gem clusters
	for (const [gu, gv, seed] of [[150, 190, 1], [620, 150, 2], [340, 350, 3]]) {
		onFace(true, gu, gv);
		for (let i = 0; i < 5; i++) {
			g.fillStyle = ['#7ee8fa', '#b197fc', '#ff8fd0', '#8ce99a', '#ffd43b'][Math.floor(hash(i, seed) * 5)];
			const ax = (hash(i, seed * 3) - 0.5) * 26, ay = (hash(i, seed * 7) - 0.5) * 14;
			g.beginPath();
			g.moveTo(ax - 3, ay + 5); g.lineTo(ax, ay - 4); g.lineTo(ax + 3, ay + 5);
			g.closePath(); g.fill();
		}
		resetT(g);
	}

	// aquifer cave: underground pond, stalactites, glow mushrooms
	onFace(true, 180, 300);
	g.fillStyle = '#0e0b08';
	g.beginPath(); g.ellipse(0, 0, 55, 26, 0, 0, 7); g.fill();
	g.fillStyle = '#2b6f8e';
	g.beginPath(); g.ellipse(0, 12, 44, 9, 0, 0, 7); g.fill();
	g.fillStyle = '#3f93b8';
	g.beginPath(); g.ellipse(-6, 11, 30, 5, 0, 0, 7); g.fill();
	g.fillStyle = '#241d16';
	for (let i = 0; i < 5; i++) { // stalactites
		const sx2 = -36 + i * 17;
		g.beginPath();
		g.moveTo(sx2 - 4, -24 + Math.abs(i - 2) * 3);
		g.lineTo(sx2, -6 + (i % 2) * 4);
		g.lineTo(sx2 + 4, -24 + Math.abs(i - 2) * 3);
		g.closePath(); g.fill();
	}
	for (let i = 0; i < 3; i++) { // glow mushrooms
		const mx = -30 + i * 12;
		g.fillStyle = '#e8fff3';
		g.fillRect(mx, 14, 1.6, 4);
		g.fillStyle = '#69f0ae';
		g.fillRect(mx - 2, 11, 6, 3);
	}
	resetT(g);

	// sleeping dragon, deep down
	onFace(true, 550, 400);
	g.fillStyle = '#232331';
	g.beginPath(); g.ellipse(0, 0, 34, 13, 0, 0, 7); g.fill(); // body curl
	g.beginPath(); g.ellipse(26, -8, 12, 7, 0.4, 0, 7); g.fill(); // head
	g.beginPath(); // tail wrap
	g.moveTo(-32, 4); g.quadraticCurveTo(-48, 12, -40, -10); g.lineTo(-34, -6);
	g.quadraticCurveTo(-42, 4, -30, 0);
	g.closePath(); g.fill();
	g.fillStyle = '#31314a';
	for (let i = 0; i < 5; i++) { // back spikes
		const bx = -18 + i * 9;
		g.beginPath();
		g.moveTo(bx - 3, -10); g.lineTo(bx, -17 + (i % 2) * 2); g.lineTo(bx + 3, -10);
		g.closePath(); g.fill();
	}
	g.fillStyle = '#ff6b2e'; // one eye, barely open
	g.fillRect(28, -9, 4, 1.6);
	for (let i = 0; i < 3; i++) { // snore smoke
		g.fillStyle = `rgba(180,180,200,${0.35 - i * 0.1})`;
		g.fillRect(38 + i * 6, -14 - i * 5, 3 + i, 3 + i);
	}
	resetT(g);

	// ---- SE face ------------------------------------------------------
	// leaky pipe near the surface
	onFace(false, 80, 16);
	g.fillStyle = '#7d8590';
	g.fillRect(-40, 0, 80, 7);
	g.fillStyle = '#5e6673';
	g.fillRect(-14, -2, 8, 11); g.fillRect(10, -2, 8, 11); // couplings
	g.fillStyle = '#45b5ea';
	g.fillRect(0, 9, 2, 3); g.fillRect(0.5, 15, 1.5, 2); // drip
	resetT(g);

	// buried treasure
	onFace(false, 170, 34);
	g.fillStyle = '#8a5a33';
	g.fillRect(-9, -6, 18, 12);
	g.fillStyle = '#6f4a28';
	g.beginPath(); g.ellipse(0, -6, 9, 4, 0, Math.PI, 0); g.fill();
	g.fillStyle = '#ffd43b';
	g.fillRect(-1.5, -6, 3, 12);
	g.fillRect(-1, -3, 2, 3);
	g.fillRect(-13, 5, 3, 2); g.fillRect(11, 3, 3, 2); g.fillRect(7, 7, 3, 2);
	resetT(g);

	// earthworms
	for (const [wu, wv] of [[320, 60], [520, 45], [240, 130]]) {
		onFace(false, wu, wv);
		g.strokeStyle = '#d98fa2';
		g.lineWidth = 2.5;
		g.beginPath();
		g.moveTo(-8, 0);
		g.quadraticCurveTo(-3, -5, 0, 0);
		g.quadraticCurveTo(3, 5, 8, 0);
		g.stroke();
		resetT(g);
	}

	// ammonite (small) + giant ammonite deeper
	onFace(false, 430, 26);
	g.strokeStyle = '#d9c9a8';
	g.lineWidth = 2;
	for (let i = 0; i < 3; i++) {
		g.beginPath(); g.arc(i * 1.5, 0, 9 - i * 3, i * 0.8, Math.PI * 1.7 + i * 0.5); g.stroke();
	}
	resetT(g);
	onFace(false, 260, 210);
	g.strokeStyle = '#c9b28e';
	g.lineWidth = 3.5;
	for (let i = 0; i < 5; i++) {
		g.beginPath(); g.arc(i * 2.5, 0, 30 - i * 6, i * 0.7, Math.PI * 1.75 + i * 0.4); g.stroke();
	}
	resetT(g);

	// skeleton fish
	onFace(false, 620, 95);
	g.strokeStyle = '#cfc3ab';
	g.lineWidth = 1.5;
	g.beginPath(); g.moveTo(-12, 0); g.lineTo(10, 0); g.stroke();
	for (let i = 0; i < 4; i++) {
		g.beginPath(); g.moveTo(-8 + i * 5, -4); g.lineTo(-8 + i * 5, 4); g.stroke();
	}
	g.beginPath(); g.moveTo(10, 0); g.lineTo(16, -5); g.lineTo(16, 5); g.closePath(); g.stroke();
	g.fillStyle = '#cfc3ab';
	g.beginPath(); g.arc(-14, 0, 3.5, 0, 7); g.fill();
	g.fillStyle = '#3a2f28';
	g.fillRect(-15.5, -1.5, 2, 2);
	resetT(g);

	// geode
	onFace(false, 520, 270);
	g.fillStyle = '#1d1916';
	g.beginPath(); g.ellipse(0, 0, 20, 15, 0.3, 0, 7); g.fill();
	g.fillStyle = '#4a3b55';
	g.beginPath(); g.ellipse(0, 0, 14, 10, 0.3, 0, 7); g.fill();
	g.fillStyle = '#b197fc';
	for (let i = 0; i < 6; i++) {
		const a = i * 1.05, d = 5 + hash(i, 44) * 4;
		g.beginPath();
		g.moveTo(Math.cos(a) * d - 2, Math.sin(a) * d * 0.7 + 2);
		g.lineTo(Math.cos(a) * d, Math.sin(a) * d * 0.7 - 3);
		g.lineTo(Math.cos(a) * d + 2, Math.sin(a) * d * 0.7 + 2);
		g.closePath(); g.fill();
	}
	resetT(g);

	// the mystery door
	onFace(false, 380, 385);
	g.fillStyle = '#3a3f4a';
	g.fillRect(-14, -22, 28, 44);
	g.strokeStyle = '#20242c';
	g.lineWidth = 2;
	g.strokeRect(-14, -22, 28, 44);
	g.fillStyle = '#20242c';
	for (const rv of [-16, -2, 12]) { g.fillRect(-11, rv, 3, 3); g.fillRect(8, rv, 3, 3); }
	g.fillStyle = '#7ee8fa'; // glowing keyhole
	g.beginPath(); g.arc(0, 0, 2.5, 0, 7); g.fill();
	g.fillRect(-1, 1, 2, 6);
	g.fillStyle = 'rgba(126,232,250,0.12)';
	g.beginPath(); g.ellipse(0, 0, 26, 30, 0, 0, 7); g.fill();
	g.fillStyle = '#ffd43b';
	g.font = 'bold 8px monospace';
	g.fillText('?', -2.5, -28);
	resetT(g);

	// one rubber duck, impossibly deep
	onFace(false, 690, 452);
	g.fillStyle = '#ffd43b';
	g.fillRect(-3, -3, 6, 3.4);
	g.fillRect(1, -6, 3, 3.4);
	g.fillStyle = '#f76707';
	g.fillRect(4, -5, 2, 1.4);
	g.fillStyle = '#1b2a4a';
	g.fillRect(2.2, -5.2, 1, 1);
	resetT(g);

	// magma bubbles
	for (let i = 0; i < 26; i++) {
		const west = hash(i, 91) < 0.5;
		const u = hash(i, 61) * (FACE - 40) + 20;
		const v = 448 + hash(i, 71) * 24;
		const x = west ? w[0] + u : s[0] + u;
		const y = (west ? w[1] + u * 0.5 : s[1] - u * 0.5) + v;
		g.fillStyle = hash(i, 5) < 0.5 ? '#ff8c2e' : '#ffb52e';
		const bs = 2 + hash(i, 17) * 3;
		g.beginPath(); g.arc(x, y, bs, 0, 7); g.fill();
	}
}
