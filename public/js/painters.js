// painters.js — canvas painters that become three.js textures: the ground
// map, the underground cross-sections on the island's sides, and building
// facades. All pixel-art, all deterministic (same town for everyone).

import { GRID, ROAD_ROWS, ROAD_COLS, ROAD_H_CENTERS, ROAD_V_CENTERS, ROAD_MIN, ROAD_MAX, LAKE, DIRT_LOT, tileType, hash } from './data.js';

export const UNDER_DEPTH = 30; // island depth in world units (≈ 10× the old skirt)

const GRASS = ['#7ec850', '#78c34b', '#86cf58'];

// ---------------------------------------------------------------- ground
// One big top-down texture: 12 px per tile.
export function paintGround() {
	const P = 12;
	const c = document.createElement('canvas');
	c.width = GRID * P;
	c.height = GRID * P;
	const g = c.getContext('2d');

	for (let gy = 0; gy < GRID; gy++) {
		for (let gx = 0; gx < GRID; gx++) {
			const t = tileType(gx, gy);
			if (t === 1) g.fillStyle = '#8d9095';
			else if (t === 2) g.fillStyle = '#45b5ea';
			else g.fillStyle = GRASS[Math.floor(hash(gx, gy) * GRASS.length)];
			g.fillRect(gx * P, gy * P, P, P);
			if (t === 1) {
				g.strokeStyle = '#75787d';
				g.lineWidth = 1;
				g.strokeRect(gx * P + 0.5, gy * P + 0.5, P - 1, P - 1);
			}
		}
	}
	// construction dirt lot
	for (let gx = DIRT_LOT.gx; gx < DIRT_LOT.gx + DIRT_LOT.w; gx++)
		for (let gy = DIRT_LOT.gy; gy < DIRT_LOT.gy + DIRT_LOT.d; gy++) {
			g.fillStyle = hash(gx, gy) > 0.5 ? '#c9a36a' : '#bd9760';
			g.fillRect(gx * P, gy * P, P, P);
		}
	// road centre dashes
	g.fillStyle = '#f2e7c4';
	for (const cy of ROAD_H_CENTERS) {
		for (let gx = ROAD_MIN; gx <= ROAD_MAX - 1; gx += 2) {
			if (ROAD_COLS.includes(gx) || ROAD_COLS.includes(gx + 1)) continue;
			g.fillRect(gx * P + 2, cy * P - 1, P - 4, 2);
		}
	}
	for (const cx of ROAD_V_CENTERS) {
		for (let gy = ROAD_MIN; gy <= ROAD_MAX - 1; gy += 2) {
			if (ROAD_ROWS.includes(gy) || ROAD_ROWS.includes(gy + 1)) continue;
			g.fillRect(cx * P - 1, gy * P + 2, 2, P - 4);
		}
	}
	// lake shallows + sparkle
	g.fillStyle = '#7cd0f5';
	for (let i = 0; i < 40; i++) {
		const a = hash(i, 77) * Math.PI * 2, r = hash(i, 33);
		const x = (LAKE.cx + Math.cos(a) * LAKE.rx * r * 0.85) * P;
		const y = (LAKE.cy + Math.sin(a) * LAKE.ry * r * 0.85) * P;
		g.fillRect(Math.round(x), Math.round(y), 4, 2);
	}
	return c;
}

// ---------------------------------------------------------------- facades
// Painters draw in "face pixels": 16 px per tile of width, h px tall —
// same coordinate system the 2D site used, rendered at 4× for crispness.
export function facade(wTiles, hPx, paint) {
	const S = 4, U = wTiles * 16;
	const c = document.createElement('canvas');
	c.width = U * S;
	c.height = hPx * S;
	const g = c.getContext('2d');
	g.scale(S, S);
	paint(g, U, hPx);
	return c;
}

export function shopFacade(cfg) {
	return (g, U, h) => {
		g.fillStyle = cfg.wall;
		g.fillRect(0, 0, U, h);
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
			const n = cfg.windows || 2;
			for (let i = 0; i < n; i++) {
				g.fillRect(6 + i * ((U - 24) / Math.max(1, n - 1)), wy, 10, Math.min(9, h - wy - 8));
			}
		}
		g.fillStyle = '#7a5230';
		g.fillRect(U - 16, h - 11, 10, 11);
	};
}

export function garageFacade(g, U, h) {
	g.fillStyle = '#aab2c0';
	g.fillRect(0, 0, U, h);
	g.fillStyle = '#6b7686';
	g.fillRect(12, 8, U - 24, h - 8);
	g.strokeStyle = '#59636f';
	for (let v = 11; v < h; v += 4) { g.beginPath(); g.moveTo(12, v); g.lineTo(U - 12, v); g.stroke(); }
	g.fillStyle = '#1b2a4a';
	g.font = 'bold 6px monospace';
	g.fillText('GARAGEBOT', (U - 54) / 2, 6.5);
}

export function postFacade(g, U, h) {
	g.fillStyle = '#f4e3c2';
	g.fillRect(0, 0, U, h);
	g.fillStyle = '#4d79c7';
	g.fillRect(4, 4, U - 8, 9);
	g.fillStyle = '#fff';
	g.font = 'bold 7px monospace';
	g.fillText('POST OFFICE', 9, 11);
	g.fillStyle = '#7a5230';
	g.fillRect(U / 2 - 5, h - 15, 10, 15);
	g.fillStyle = '#bcd6ff';
	g.fillRect(8, 16, 9, 8); g.fillRect(U - 17, 16, 9, 8);
}

export function wembleFacade(g, U, h) {
	g.fillStyle = '#e5e7eb';
	g.fillRect(0, 0, U, h);
	g.fillStyle = '#2563eb';
	g.fillRect(3, 2, U - 6, 9);
	g.fillStyle = '#fff';
	g.font = 'bold 7px monospace';
	g.fillText('WEMBLE', (U - 25) / 2, 9);
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
}

export function cinemaFacade(g, U, h) {
	g.fillStyle = '#c94f7c';
	g.fillRect(0, 0, U, h);
	g.fillStyle = '#12131a';
	g.fillRect(3, 2, U - 6, 12);
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
}

// arcade facade is repainted per frame for the neon blink
export function arcadeFacade(g, U, h, t) {
	g.fillStyle = '#5f3dc4';
	g.fillRect(0, 0, U, h);
	g.fillStyle = '#12131a';
	g.fillRect(3, 3, U - 6, 12);
	g.fillRect(8, 18, 14, 12); g.fillRect(U - 24, 18, 14, 12);
	g.font = 'bold 8px monospace';
	g.fillStyle = Math.floor(t / 800) % 2 ? '#ff5ea8' : '#4dd4e8';
	g.fillText('ARCADE', 17, 12);
	g.fillStyle = '#ffd43b';
	g.font = 'bold 6px monospace';
	g.fillText('SOON!', 25, 26);
}

export function townhallFacade(g, U, h) {
	g.fillStyle = '#e9e4d8';
	g.fillRect(0, 0, U, h);
	g.fillStyle = '#8f8878';
	g.fillRect(3, 4, U - 6, 8);
	g.fillStyle = '#fdf3d7';
	g.font = 'bold 7px monospace';
	g.fillText('TOWN HALL', (U - 42) / 2, 10.5);
	g.fillStyle = '#d5cfc0';
	for (let i = 0; i < 4; i++) g.fillRect(9 + i * ((U - 22) / 3), 14, 5, h - 14);
	g.fillStyle = '#7a5230';
	g.fillRect(U / 2 - 6, h - 16, 12, 16);
}

export function houseFacade(g, U, h) {
	g.fillStyle = '#e8896a';
	g.fillRect(0, 0, U, h);
	g.fillStyle = '#7a5230';
	g.fillRect(6, h - 12, 9, 12);
	g.fillStyle = '#bcd6ff';
	g.fillRect(U - 24, 9, 10, 8);
}

export function boathouseFacade(g, U, h) {
	g.fillStyle = '#74a3c7';
	g.fillRect(0, 0, U, h);
	g.fillStyle = '#274156';
	g.fillRect(3, 2, U - 6, 9);
	g.fillStyle = '#d7ecff';
	g.font = 'bold 6px monospace';
	g.fillText('BOATS', (U - 24) / 2, 8.5);
	g.fillStyle = '#37536b';
	g.fillRect(8, h - 9, U - 16, 9); // big water door
}

// clock face; hands drawn by the Clock entity
export function clockFace(g, U, h) {
	g.fillStyle = '#dcd6c8';
	g.fillRect(0, 0, U, h);
	g.fillStyle = '#fdf3d7';
	g.beginPath(); g.arc(U / 2, h / 2, 6.5, 0, 7); g.fill();
	g.strokeStyle = '#1b2a4a';
	g.lineWidth = 1;
	g.stroke();
}

// ------------------------------------------------------------ underground
// Two rectangular cross-sections (south face and east face of the island).
// 16 px = 1 world unit. Same buried treasures as v4.1, now 10× the dirt.
export function paintUnderground(eastFace) {
	const W = GRID * 16, H = UNDER_DEPTH * 16;
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	const g = c.getContext('2d');

	const bands = [
		[0, 12, '#7a5230'], [12, 60, '#5e3d22'], [60, 160, '#4a3423'],
		[160, 300, '#3a2f28'], [300, 440, '#2b2523'], [440, H, '#7a1f0e'],
	];
	for (const [v0, v1, col] of bands) {
		g.fillStyle = col;
		g.fillRect(0, v0, W, v1 - v0);
	}
	const mg = g.createLinearGradient(0, 420, 0, H);
	mg.addColorStop(0, 'rgba(255,100,20,0)');
	mg.addColorStop(1, 'rgba(255,140,30,0.55)');
	g.fillStyle = mg;
	g.fillRect(0, 420, W, H - 420);

	// pebbles
	for (let i = 0; i < 260; i++) {
		const u = hash(i, eastFace ? 14 : 13) * (W - 30) + 10;
		const v = 8 + hash(i, eastFace ? 28 : 29) * (H - 68);
		g.fillStyle = hash(i, 7) < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.08)';
		const ps = 1.5 + hash(i, 3) * 2.5;
		g.fillRect(u, v, ps, ps * 0.8);
	}
	// magma bubbles
	for (let i = 0; i < 20; i++) {
		g.fillStyle = hash(i, 5) < 0.5 ? '#ff8c2e' : '#ffb52e';
		const bs = 2 + hash(i, 17) * 3;
		g.beginPath();
		g.arc(hash(i, eastFace ? 62 : 61) * (W - 40) + 20, 448 + hash(i, 71) * 24, bs, 0, 7);
		g.fill();
	}

	const at = (u, v, fn) => { g.save(); g.translate(u, v); fn(); g.restore(); };

	if (!eastFace) {
		// ---- south face: bones, mine, cave, aquifer, dragon
		for (const ru of [70, 430]) at(ru, 2, () => {
			g.strokeStyle = '#5c3a1e';
			g.lineWidth = 2;
			for (let i = -2; i <= 2; i++) {
				g.beginPath();
				g.moveTo(0, 0);
				g.quadraticCurveTo(i * 8, 14, i * 14, 26 + Math.abs(i) * 4);
				g.stroke();
			}
		});
		// (dino bones, cave crystals, gnome door, dragon are 3D props now —
		// town3d.buildUnderground mounts them on this face)
		at(560, 28, () => { // cave mouth stays painted; crystals go 3D
			g.fillStyle = '#151009';
			g.beginPath(); g.ellipse(0, 6, 24, 15, 0, Math.PI, 0); g.fill();
			g.fillRect(-24, 6, 48, 8);
			g.fillStyle = '#ffd43b';
			g.fillRect(14, 1, 2, 2); g.fillRect(18, 1, 2, 2);
		});
		at(350, 20, () => { // mineshaft — connects to the headframe on the surface
			g.fillStyle = '#17110b';
			g.fillRect(0, -20, 26, 20); // up to daylight
			g.fillRect(0, 0, 26, 265);
			g.fillStyle = '#141210';
			g.fillRect(-110, 100, 110, 24);
			g.fillRect(26, 236, 130, 26);
			g.strokeStyle = '#8a6a3c';
			g.lineWidth = 3;
			for (const dv of [0, 100, 236]) {
				g.beginPath(); g.moveTo(-1, dv); g.lineTo(-1, dv + 26); g.moveTo(27, dv); g.lineTo(27, dv + 26); g.stroke();
			}
			g.strokeStyle = '#a07a45';
			g.lineWidth = 1.5;
			for (let v = 8; v < 260; v += 16) { g.beginPath(); g.moveTo(5, v); g.lineTo(15, v); g.stroke(); }
			g.beginPath(); g.moveTo(5, 4); g.lineTo(5, 262); g.moveTo(15, 4); g.lineTo(15, 262); g.stroke();
			g.fillStyle = '#5e6673';
			g.fillRect(120, 244, 22, 12);
			g.fillStyle = '#2b2523';
			g.beginPath(); g.arc(126, 258, 3, 0, 7); g.arc(137, 258, 3, 0, 7); g.fill();
			g.fillStyle = '#ffd43b';
			g.fillRect(124, 241, 4, 3); g.fillRect(131, 240, 5, 4);
			g.fillStyle = '#ffb52e';
			g.fillRect(-90, 108, 4, 5);
			g.fillStyle = 'rgba(255,181,46,0.18)';
			g.beginPath(); g.ellipse(-88, 111, 16, 12, 0, 0, 7); g.fill();
			// gold seams off the drifts
			g.strokeStyle = '#ffd43b';
			g.lineWidth = 2;
			g.beginPath();
			g.moveTo(140, 262); g.lineTo(152, 268); g.lineTo(148, 276); g.lineTo(162, 281);
			g.moveTo(-80, 126); g.lineTo(-70, 132); g.lineTo(-74, 139);
			g.stroke();
		});
		for (const [gu, gv, seed] of [[150, 190, 1], [620, 150, 2], [340, 350, 3]]) at(gu, gv, () => {
			for (let i = 0; i < 5; i++) {
				g.fillStyle = ['#7ee8fa', '#b197fc', '#ff8fd0', '#8ce99a', '#ffd43b'][Math.floor(hash(i, seed) * 5)];
				const ax = (hash(i, seed * 3) - 0.5) * 26, ay = (hash(i, seed * 7) - 0.5) * 14;
				g.beginPath();
				g.moveTo(ax - 3, ay + 5); g.lineTo(ax, ay - 4); g.lineTo(ax + 3, ay + 5);
				g.closePath(); g.fill();
			}
		});
		at(180, 310, () => { // aquifer
			g.fillStyle = '#0e0b08';
			g.beginPath(); g.ellipse(0, 0, 55, 26, 0, 0, 7); g.fill();
			g.fillStyle = '#2b6f8e';
			g.beginPath(); g.ellipse(0, 12, 44, 9, 0, 0, 7); g.fill();
			g.fillStyle = '#3f93b8';
			g.beginPath(); g.ellipse(-6, 11, 30, 5, 0, 0, 7); g.fill();
			g.fillStyle = '#241d16';
			for (let i = 0; i < 5; i++) {
				const sx2 = -36 + i * 17;
				g.beginPath();
				g.moveTo(sx2 - 4, -24 + Math.abs(i - 2) * 3);
				g.lineTo(sx2, -6 + (i % 2) * 4);
				g.lineTo(sx2 + 4, -24 + Math.abs(i - 2) * 3);
				g.closePath(); g.fill();
			}
			for (let i = 0; i < 3; i++) {
				const mx = -30 + i * 12;
				g.fillStyle = '#e8fff3';
				g.fillRect(mx, 14, 1.6, 4);
				g.fillStyle = '#69f0ae';
				g.fillRect(mx - 2, 11, 6, 3);
			}
		});
		// (the dragon sleeps in 3D now — see town3d.buildUnderground)
	} else {
		// ---- east face: pipe, treasure, worms, capsule, cabinet, geode, door, duck
		at(120, 16, () => {
			g.fillStyle = '#7d8590';
			g.fillRect(-40, 0, 80, 7);
			g.fillStyle = '#5e6673';
			g.fillRect(-14, -2, 8, 11); g.fillRect(10, -2, 8, 11);
			g.fillStyle = '#45b5ea';
			g.fillRect(0, 9, 2, 3); g.fillRect(0.5, 15, 1.5, 2);
		});
		// (treasure chest is a 3D prop now)
		for (const [wu, wv] of [[380, 60], [580, 45], [300, 130]]) at(wu, wv, () => {
			g.strokeStyle = '#d98fa2';
			g.lineWidth = 2.5;
			g.beginPath();
			g.moveTo(-8, 0);
			g.quadraticCurveTo(-3, -5, 0, 0);
			g.quadraticCurveTo(3, 5, 8, 0);
			g.stroke();
		});
		at(395, 46, () => { // WORM XING sign, obviously
			g.fillStyle = '#8a5a33';
			g.fillRect(-0.8, 0, 1.6, 12);
			g.fillStyle = '#ffd43b';
			g.save();
			g.rotate(Math.PI / 4);
			g.fillRect(-5.5, -5.5, 11, 11);
			g.restore();
			g.strokeStyle = '#1b2a4a';
			g.lineWidth = 1.6;
			g.beginPath();
			g.moveTo(-3.5, 0.5); g.quadraticCurveTo(-1.5, -2.5, 0, 0.5); g.quadraticCurveTo(1.5, 3, 3.5, 0.5);
			g.stroke();
		});
		at(150, 95, () => { // one (1) lost sock
			g.fillStyle = '#e03131';
			g.fillRect(-3, -8, 6, 10);
			g.fillRect(-3, 2, 9, 5);
			g.fillStyle = '#fff';
			g.fillRect(-3, -8, 6, 2.4);
			g.fillRect(-3, -3.5, 6, 1.6);
		});
		at(300, 210, () => { // Y2K time capsule
			g.fillStyle = '#7d8590';
			g.fillRect(-14, -9, 28, 18);
			g.strokeStyle = '#4a525c';
			g.lineWidth = 1.6;
			g.strokeRect(-14, -9, 28, 18);
			for (let i = 0; i < 4; i++) { // hazard stripes
				g.fillStyle = i % 2 ? '#ffd43b' : '#1b2a4a';
				g.fillRect(-14 + i * 7, -9, 7, 3);
			}
			g.fillStyle = '#ffd43b';
			g.font = 'bold 7px monospace';
			g.fillText('Y2K', -6, 3);
			g.fillStyle = '#c9d2dc';
			g.font = 'bold 3px monospace';
			g.fillText('DO NOT OPEN', -9, 7);
			g.fillText('(we forgot why)', -10.5, 10.8);
		});
		at(180, 250, () => { // arcade cabinet, in transit since 1998
			g.fillStyle = '#5f3dc4';
			g.fillRect(-10, -18, 20, 36);
			g.fillStyle = '#3b2687';
			g.fillRect(-10, -18, 20, 5);
			g.fillStyle = '#12131a';
			g.fillRect(-7, -11, 14, 11);
			g.fillStyle = '#4dd4e8';
			g.font = 'bold 7px monospace';
			g.fillText('?', -2, -3.5);
			g.fillStyle = '#e0447c'; // joystick + buttons
			g.fillRect(-5, 3, 3, 3);
			g.fillStyle = '#ffd43b';
			g.fillRect(1, 4, 2.4, 2.4); g.fillRect(5, 3, 2.4, 2.4);
			g.fillStyle = '#c9d2dc';
			g.font = 'bold 3px monospace';
			g.fillText('SHIPPED 1998', -9, 15);
		});
		at(660, 95, () => {
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
		});
		at(560, 270, () => {
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
		});
		at(420, 385, () => {
			g.fillStyle = '#3a3f4a';
			g.fillRect(-14, -22, 28, 44);
			g.strokeStyle = '#20242c';
			g.lineWidth = 2;
			g.strokeRect(-14, -22, 28, 44);
			g.fillStyle = '#20242c';
			for (const rv of [-16, -2, 12]) { g.fillRect(-11, rv, 3, 3); g.fillRect(8, rv, 3, 3); }
			g.fillStyle = '#7ee8fa';
			g.beginPath(); g.arc(0, 0, 2.5, 0, 7); g.fill();
			g.fillRect(-1, 1, 2, 6);
			g.fillStyle = 'rgba(126,232,250,0.12)';
			g.beginPath(); g.ellipse(0, 0, 26, 30, 0, 0, 7); g.fill();
			g.fillStyle = '#ffd43b';
			g.font = 'bold 8px monospace';
			g.fillText('?', -2.5, -28);
		});
		at(700, 452, () => {
			g.fillStyle = '#ffd43b';
			g.fillRect(-3, -3, 6, 3.4);
			g.fillRect(1, -6, 3, 3.4);
			g.fillStyle = '#f76707';
			g.fillRect(4, -5, 2, 1.4);
			g.fillStyle = '#1b2a4a';
			g.fillRect(2.2, -5.2, 1, 1);
		});
	}
	return c;
}
