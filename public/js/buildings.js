// buildings.js — every structure in Woodtown. Data-driven: add an entry to
// BUILDINGS (a config for shopRenderer, or a custom render fn) and it
// appears in the world, clickable. Animated bits (flags, smoke, neon…)
// register named anchor points that entities.js brings to life.

import { g2w, hash, box, onSW, resetT, tilePath, WATER } from './iso.js';

// clearH keeps auto-greenery out of the building's face + a margin south.
export const BUILDINGS = [
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
	{ id: 'tower', gx: 36, gy: 30, w: 2, dep: 2, clearH: 58, render: renderTower },
	{ id: 'boathouse', gx: 42, gy: 12, w: 3, dep: 2, clearH: 20, render: shopRenderer({
		h: 20, col: '#74a3c7', signBg: '#274156', signFg: '#d7ecff', sign: 'BOATS',
		windows: 1, title: 'WOODTOWN BOAT RENTAL',
		body: 'One boat. It’s out. It’s always out. Ask the guy on the lake how the fishing is — he loves that.',
	}) },
];

export function renderBuildings(items, hotspots, anchors, occupied) {
	for (const b of BUILDINGS) {
		items.push({
			d: b.gx + b.w + b.gy + b.dep,
			draw: (g) => b.render(g, b, hotspots, anchors, occupied),
		});
	}
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

// generic storefront — most of the variety buildings are just configs
function shopRenderer(cfg) {
	return function (g, b, hotspots, anchors, occ) {
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
		g.fillRect(U - 16, h - 11, 10, 11);
		resetT(g);
		bbox(hotspots, b.id, [f.A, f.B, f.C, f.D], h, cfg.title, cfg.body, cfg.action);
	};
}

export const WALL_H = 34;
function renderWall(g, b, hotspots, anchors, occ) {
	const { gx, gy, w } = b;
	const f = box(g, gx, gy, w, 1, WALL_H, '#b0b4ba');
	markOccupied(occ, gx, gy, w, 1);
	anchors.wallFace = { gx, gy1: gy + 1, h: WALL_H, uw: w * 16 };
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

function renderGarage(g, b, hotspots, anchors, occ) {
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
	anchors.antenna = { x: ax, y: ay - h - 13 };
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

function renderPost(g, b, hotspots, anchors, occ) {
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
	anchors.flag = { x: px, y: py - h - 23 };
	bbox(hotspots, 'post', [f.A, f.B, f.C, f.D], h + 8, 'WOODTOWN POST OFFICE',
		'This entire town exists so one guy’s email gets delivered. That’s it. That’s the website. (No, you can’t see the mail.)');
}

function renderFountain(g, b, hotspots, anchors, occ) {
	const { gx, gy } = b;
	markOccupied(occ, gx, gy, b.w, b.dep);
	const [cx, cy] = g2w(gx + 1.5, gy + 1.5);
	g.fillStyle = '#c9c4b4';
	g.beginPath(); g.ellipse(cx, cy, 40, 20, 0, 0, 7); g.fill();
	g.fillStyle = '#a8a396';
	g.beginPath(); g.ellipse(cx, cy, 26, 13, 0, 0, 7); g.fill();
	g.fillStyle = WATER;
	g.beginPath(); g.ellipse(cx, cy, 20, 10, 0, 0, 7); g.fill();
	g.fillStyle = '#8f8a7e';
	g.fillRect(cx - 3, cy - 12, 6, 12);
	anchors.fountain = { x: cx, y: cy - 12 };
	bbox(hotspots, 'fountain', [[cx - 40, cy], [cx + 40, cy]], 20, 'WISHING FOUNTAIN',
		'Toss in a coin! (Coins not included. Wishes granted at the mayor’s discretion, which is to say never, but the splashing is nice.)');
}

function renderTownhall(g, b, hotspots, anchors, occ) {
	const { gx, gy, w } = b, h = 38;
	const f = box(g, gx, gy, w, b.dep, h, '#e9e4d8');
	markOccupied(occ, gx, gy, w, b.dep);
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
	g.fillStyle = '#d5cfc0';
	for (let i = 0; i < 4; i++) g.fillRect(9 + i * 23, 14, 5, 24);
	g.fillStyle = '#7a5230';
	g.fillRect(42, 22, 12, 16);
	resetT(g);
	const [tx, ty] = g2w(gx + 2, gy + 3.5);
	const cxy = { x: tx + 16, y: ty - h - 22 + 9 };
	g.fillStyle = '#fdf3d7';
	g.beginPath(); g.ellipse(cxy.x, cxy.y, 6, 6, 0, 0, 7); g.fill();
	g.strokeStyle = '#1b2a4a'; g.lineWidth = 1; g.stroke();
	anchors.clock = cxy;
	bbox(hotspots, 'townhall', [f.A, f.B, f.C, f.D], h + 24, 'WOODTOWN TOWN HALL',
		'Seat of government. The clock is real — it shows YOUR time, because in Woodtown, the visitor is always right.');
}

function renderHouse(g, b, hotspots, anchors, occ) {
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
	anchors.chimney = { x: cx + 0.5, y: cy - h - 11 };
	bbox(hotspots, 'house', [f.A, f.B, f.C, f.D], h + 10, 'MIKE’S PLACE',
		'Home of the mayor (self-appointed, ran unopposed). If you need him, leave a note on the big wall downtown.');
}

function renderWemble(g, b, hotspots, anchors, occ) {
	const { gx, gy, w } = b, h = 36, U = w * 16;
	const f = box(g, gx, gy, w, b.dep, h, '#e5e7eb');
	markOccupied(occ, gx, gy, w, b.dep);
	onSW(g, gx, gy + b.dep, h);
	g.fillStyle = '#2563eb';
	g.fillRect(3, 2, U - 6, 9);
	g.fillStyle = '#fff';
	g.font = 'bold 7px monospace';
	g.fillText('WEMBLE', 26, 9);
	g.fillStyle = '#1a1a1a';
	g.font = 'bold 4px monospace';
	g.fillText('DEVELOPMENT CORPORATION', 12, 15.5);
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 5; col++) {
			g.fillStyle = (row * 5 + col) % 4 === 1 ? '#fdf3d7' : '#93c5fd';
			g.fillRect(6 + col * 15, 18 + row * 5.6, 11, 4);
		}
	}
	g.fillStyle = '#1a1a1a';
	g.fillRect(U - 18, h - 11, 11, 11);
	resetT(g);
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

function renderCinema(g, b, hotspots, anchors, occ) {
	const { gx, gy, w } = b, h = 36;
	const f = box(g, gx, gy, w, b.dep, h, '#c94f7c');
	markOccupied(occ, gx, gy, w, b.dep);
	onSW(g, gx, gy + b.dep, h);
	g.fillStyle = '#12131a';
	g.fillRect(3, 2, 74, 12);
	g.fillStyle = '#fff';
	g.font = 'bold 8px monospace';
	g.fillText('PIXELPLEX', 18, 11);
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
	for (let i = 0; i < 5; i++) g.fillRect(4 + i * 15, 14.5, 3, 1.5);
	resetT(g);
	bbox(hotspots, 'cinema', [f.A, f.B, f.C, f.D], h, 'PIXELPLEX CINEMA',
		'Now showing: “NOT A BUG” — the heartwarming story of a feature. One screen, zero seats, five stars. (Sequel “NOT A BUG 2: STILL A FEATURE” in production.)');
}

function renderArcade(g, b, hotspots, anchors, occ) {
	const { gx, gy, w } = b, h = 34;
	const f = box(g, gx, gy, w, b.dep, h, '#5f3dc4');
	markOccupied(occ, gx, gy, w, b.dep);
	onSW(g, gx, gy + b.dep, h);
	g.fillStyle = '#12131a';
	g.fillRect(3, 3, 58, 12);
	g.fillRect(8, 18, 14, 12); g.fillRect(40, 18, 14, 12);
	g.fillStyle = '#ffd43b';
	g.font = 'bold 6px monospace';
	g.fillText('SOON!', 25, 26);
	resetT(g);
	anchors.marquee = { gx, gy1: gy + b.dep, h };
	bbox(hotspots, 'arcade', [f.A, f.B, f.C, f.D], h, 'WOODTOWN ARCADE',
		'Cabinets are on order. This town keeps growing — new stuff shows up when the mayor gets a weird idea. Check back.');
}

function renderConstruction(g, b, hotspots, anchors, occ) {
	const { gx, gy, w } = b;
	markOccupied(occ, gx, gy, w, b.dep);
	for (let x = gx; x < gx + w; x++)
		for (let y = gy; y < gy + b.dep; y++) {
			tilePath(g, x, y);
			g.fillStyle = hash(x, y) > 0.5 ? '#c9a36a' : '#bd9760';
			g.fill();
		}
	g.fillStyle = '#e8590c';
	for (let i = 0; i <= w; i++) {
		const [px, py] = g2w(gx + i, gy + b.dep);
		g.fillRect(px - 1, py - 6, 2, 6);
		const [qx, qy] = g2w(gx + w, gy + i);
		g.fillRect(qx - 1, qy - 6, 2, 6);
	}
	const [mx, my] = g2w(gx + 0.8, gy + 0.8);
	g.strokeStyle = '#f59f00';
	g.lineWidth = 2;
	g.beginPath(); g.moveTo(mx, my); g.lineTo(mx, my - 46); g.stroke();
	g.beginPath(); g.moveTo(mx - 10, my - 40); g.lineTo(mx + 34, my - 40); g.stroke();
	g.lineWidth = 1;
	g.strokeStyle = '#666';
	g.beginPath(); g.moveTo(mx + 28, my - 40); g.lineTo(mx + 28, my - 18); g.stroke();
	g.fillStyle = '#868e96';
	g.fillRect(mx + 24, my - 18, 8, 6);
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

function renderGreenhouse(g, b, hotspots, anchors, occ) {
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

function renderTower(g, b, hotspots, anchors, occ) {
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
