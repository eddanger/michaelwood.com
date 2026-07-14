// painters.js — canvas painters that become three.js textures: the ground
// map, the underground cross-sections on the island's sides, and building
// facades. All pixel-art, all deterministic (same town for everyone).

import { GRID, ROAD_ROWS, ROAD_COLS, ROAD_H_CENTERS, ROAD_V_CENTERS, ROAD_MIN, ROAD_MAX, LAKE, DIRT_LOT, tileType, hash } from './data.js';

export const UNDER_DEPTH = 30; // island depth in world units (≈ 10× the old skirt)

const GRASS = ['#7ec850', '#78c34b', '#86cf58'];

// ---------------------------------------------------------------- ground
// One big top-down texture. Dense enough that zooming in reads like eBoy
// close-ups: pavers, grass blades, manholes, crosswalks, shoreline foam.
export function paintGround() {
	const P = 20; // was 12 — more texels/tile so close-ups have something to show
	const c = document.createElement('canvas');
	c.width = GRID * P;
	c.height = GRID * P;
	const g = c.getContext('2d');

	for (let gy = 0; gy < GRID; gy++) {
		for (let gx = 0; gx < GRID; gx++) {
			const t = tileType(gx, gy);
			const x = gx * P, y = gy * P;
			if (t === 1) {
				// eBoy purple-ash asphalt (refs use lavender roads, not grey)
				const cool = hash(gx, gy) > 0.5;
				g.fillStyle = cool ? '#6f6780' : '#7a728c';
				g.fillRect(x, y, P, P);
				g.fillStyle = cool ? '#66607a' : '#827a94';
				g.fillRect(x + 1, y + 1, P / 2 - 1, P / 2 - 1);
				g.fillRect(x + P / 2, y + P / 2, P / 2 - 1, P / 2 - 1);
				g.strokeStyle = '#5a5468';
				g.lineWidth = 1;
				g.strokeRect(x + 0.5, y + 0.5, P - 1, P - 1);
				// tar cracks / grit
				if (hash(gx * 3, gy * 5) > 0.72) {
					g.fillStyle = '#4e4860';
					g.fillRect(x + 3 + hash(gx, 1) * (P - 8), y + 4 + hash(gy, 2) * (P - 10), 3, 1);
				}
				// tiny yellow curb pips on road edges
				if (hash(gx * 9, gy * 11) > 0.82) {
					g.fillStyle = '#ffd43b';
					g.fillRect(x + 2, y + P - 3, 4, 2);
				}
			} else if (t === 2) {
				// water: two-tone tiles + deeper centre
				const dx = (gx + 0.5 - LAKE.cx) / LAKE.rx;
				const dy = (gy + 0.5 - LAKE.cy) / LAKE.ry;
				const deep = dx * dx + dy * dy;
				g.fillStyle = deep < 0.35 ? '#2f9ed4' : deep < 0.7 ? '#45b5ea' : '#5fc4f0';
				g.fillRect(x, y, P, P);
			} else {
				// grass base + blade/seed speckles that pop when zoomed in
				g.fillStyle = GRASS[Math.floor(hash(gx, gy) * GRASS.length)];
				g.fillRect(x, y, P, P);
				for (let i = 0; i < 5; i++) {
					const hx = hash(gx * 11 + i, gy * 13 + i);
					const hy = hash(gx * 17 + i, gy * 19 + i);
					g.fillStyle = hx > 0.55 ? '#6db844' : '#94d66a';
					g.fillRect(x + 1 + hx * (P - 3), y + 1 + hy * (P - 3), 1, hx > 0.7 ? 2 : 1);
				}
				// occasional clover / weed cluster
				if (hash(gx * 7, gy * 9) > 0.88) {
					g.fillStyle = '#2f9e44';
					g.fillRect(x + P * 0.4, y + P * 0.45, 2, 2);
					g.fillRect(x + P * 0.55, y + P * 0.4, 2, 2);
				}
			}
		}
	}
	// construction dirt lot — pebbles + tire tracks
	for (let gx = DIRT_LOT.gx; gx < DIRT_LOT.gx + DIRT_LOT.w; gx++)
		for (let gy = DIRT_LOT.gy; gy < DIRT_LOT.gy + DIRT_LOT.d; gy++) {
			const x = gx * P, y = gy * P;
			g.fillStyle = hash(gx, gy) > 0.5 ? '#c9a36a' : '#bd9760';
			g.fillRect(x, y, P, P);
			g.fillStyle = '#a88850';
			for (let i = 0; i < 3; i++) {
				g.fillRect(x + hash(gx + i, gy) * (P - 2), y + hash(gy + i, gx) * (P - 2), 2, 1);
			}
			if (gy === DIRT_LOT.gy + 1 || gy === DIRT_LOT.gy + 2) {
				g.fillStyle = '#9a7a48';
				g.fillRect(x, y + P * 0.35, P, 2);
				g.fillRect(x, y + P * 0.6, P, 2);
			}
		}
	// road centre dashes — cream on purple
	g.fillStyle = '#f2e7c4';
	for (const cy of ROAD_H_CENTERS) {
		for (let gx = ROAD_MIN; gx <= ROAD_MAX - 1; gx += 2) {
			if (ROAD_COLS.includes(gx) || ROAD_COLS.includes(gx + 1)) continue;
			g.fillRect(gx * P + 3, cy * P - 1, P - 6, 2);
		}
	}
	for (const cx of ROAD_V_CENTERS) {
		for (let gy = ROAD_MIN; gy <= ROAD_MAX - 1; gy += 2) {
			if (ROAD_ROWS.includes(gy) || ROAD_ROWS.includes(gy + 1)) continue;
			g.fillRect(cx * P - 1, gy * P + 3, 2, P - 6);
		}
	}
	// eBoy zebra crossings — bold yellow, not white
	g.fillStyle = '#ffd43b';
	for (const cy of ROAD_H_CENTERS) {
		for (const cx of ROAD_V_CENTERS) {
			for (let i = 0; i < 6; i++) {
				g.fillRect(cx * P - P + 1 + i * 3.5, cy * P - P * 0.6, 2.2, P * 1.2);
				g.fillRect(cx * P - P * 0.6, cy * P - P + 1 + i * 3.5, P * 1.2, 2.2);
			}
			// stop-line bars just before the box
			g.fillStyle = '#fff8e1';
			g.fillRect(cx * P - P * 1.4, cy * P - 2, P * 0.5, 3);
			g.fillRect(cx * P + P * 0.9, cy * P - 2, P * 0.5, 3);
			g.fillStyle = '#ffd43b';
		}
	}
	// painted lane arrows mid-block (graphic, not realistic)
	g.fillStyle = '#ffd43b';
	for (const [ax, ay, dir] of [
		[18, 11, 'e'], [22, 27, 'w'], [13, 18, 's'], [29, 22, 'n'],
		[35, 11, 'e'], [13, 32, 'n'], [40, 27, 'w'],
	]) {
		const x = ax * P + P / 2, y = ay * P + P / 2;
		if (dir === 'e' || dir === 'w') {
			const s = dir === 'e' ? 1 : -1;
			g.fillRect(x - 5 * s, y - 1, 8 * s, 2);
			g.fillRect(x + 2 * s, y - 3, 2 * s, 6);
		} else {
			const s = dir === 's' ? 1 : -1;
			g.fillRect(x - 1, y - 5 * s, 2, 8 * s);
			g.fillRect(x - 3, y + 2 * s, 6, 2 * s);
		}
	}
	// manhole covers near a few intersections
	for (const [mx, my] of [[13, 12], [29, 28], [13, 28], [29, 12], [13, 18], [29, 20]]) {
		const cx = mx * P + P / 2, cy = my * P + P / 2;
		g.fillStyle = '#4a4558';
		g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill();
		g.strokeStyle = '#2d2a36';
		g.lineWidth = 1;
		g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.stroke();
		g.beginPath(); g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy); g.stroke();
	}
	// permanent puddles (yellow-coat rain joke, eBoy style)
	for (const [px, py, s] of [[11.3, 12.4, 7], [28.6, 26.8, 6], [14.2, 27.5, 5], [30.5, 11.2, 6]]) {
		g.fillStyle = 'rgba(90, 180, 230, 0.55)';
		g.beginPath();
		g.ellipse(px * P, py * P, s, s * 0.55, 0, 0, 7);
		g.fill();
		g.fillStyle = 'rgba(200, 240, 255, 0.35)';
		g.fillRect(px * P - 2, py * P - 1, 3, 2);
	}
	// lake shallows, foam ring, denser sparkles
	g.fillStyle = '#a8e4fa';
	for (let i = 0; i < 90; i++) {
		const a = hash(i, 77) * Math.PI * 2, r = 0.88 + hash(i, 55) * 0.12;
		const x = (LAKE.cx + Math.cos(a) * LAKE.rx * r) * P;
		const y = (LAKE.cy + Math.sin(a) * LAKE.ry * r) * P;
		g.fillRect(Math.round(x), Math.round(y), 2, 2);
	}
	g.fillStyle = '#7cd0f5';
	for (let i = 0; i < 70; i++) {
		const a = hash(i, 88) * Math.PI * 2, r = hash(i, 33);
		const x = (LAKE.cx + Math.cos(a) * LAKE.rx * r * 0.85) * P;
		const y = (LAKE.cy + Math.sin(a) * LAKE.ry * r * 0.85) * P;
		g.fillRect(Math.round(x), Math.round(y), 3, 2);
	}
	// shore pebbles
	g.fillStyle = '#d0c4a8';
	for (let i = 0; i < 35; i++) {
		const a = hash(i, 101) * Math.PI * 2, r = 0.95 + hash(i, 102) * 0.08;
		const x = (LAKE.cx + Math.cos(a) * LAKE.rx * r) * P;
		const y = (LAKE.cy + Math.sin(a) * LAKE.ry * r) * P;
		g.fillRect(Math.round(x), Math.round(y), 2, 1);
	}
	return c;
}

// ---------------------------------------------------------------- facades
// Painters draw in "face pixels": 16 px per tile of width, h px tall —
// supersampled so zoom-ins stay crisp (eBoy close-up density).
export const FACADE_SCALE = 6;

export function facade(wTiles, hPx, paint) {
	const S = FACADE_SCALE, U = wTiles * 16;
	const c = document.createElement('canvas');
	c.width = U * S;
	c.height = hPx * S;
	const g = c.getContext('2d');
	g.imageSmoothingEnabled = false;
	g.scale(S, S);
	paint(g, U, hPx);
	return c;
}

// tiny window mullion + sill — free detail that shows when zoomed in
function windowPane(g, x, y, w, h, glass = '#bcd6ff') {
	g.fillStyle = glass;
	g.fillRect(x, y, w, h);
	g.fillStyle = '#7a8aa0';
	g.fillRect(x + w / 2 - 0.4, y, 0.8, h); // vertical mullion
	g.fillRect(x, y + h / 2 - 0.4, w, 0.8); // horizontal
	g.fillStyle = '#8a7a68';
	g.fillRect(x - 0.5, y + h, w + 1, 1.2); // sill
}

// eBoy brick: individual courses with mortar + slight color jitter
function paintBrick(g, U, h, base = '#b0705a') {
	g.fillStyle = base;
	g.fillRect(0, 0, U, h);
	const brickH = 3, brickW = 6;
	for (let y = 0, row = 0; y < h; y += brickH, row++) {
		const off = (row % 2) * (brickW / 2);
		g.fillStyle = 'rgba(60,30,20,0.28)';
		g.fillRect(0, y + brickH - 0.6, U, 0.6); // mortar line
		for (let x = -brickW; x < U + brickW; x += brickW) {
			const bx = x + off;
			const jitter = hash(row * 13 + Math.floor(bx), 7);
			g.fillStyle = jitter > 0.66 ? '#c4846c' : jitter > 0.33 ? base : '#9a5e4a';
			g.fillRect(bx + 0.4, y + 0.3, brickW - 0.8, brickH - 1);
			g.fillStyle = 'rgba(60,30,20,0.2)';
			g.fillRect(bx + brickW - 0.5, y, 0.5, brickH); // vertical mortar
		}
	}
}

// white stone surround (image #2 windows/door)
function stoneFrame(g, x, y, w, h, thick = 1.4) {
	g.fillStyle = '#f1eee6';
	g.fillRect(x - thick, y - thick, w + thick * 2, h + thick * 2);
	g.fillStyle = '#d8d2c4';
	g.fillRect(x - thick, y + h, w + thick * 2, 1); // shadow under sill
}

export function shopFacade(cfg) {
	return (g, U, h) => {
		// brick-ish body so storefronts match the eBoy townhouse read
		paintBrick(g, U, h, cfg.wall);
		// keep wall tint readable over brick by soft overlay
		g.fillStyle = cfg.wall;
		g.globalAlpha = 0.35;
		g.fillRect(0, 0, U, h);
		g.globalAlpha = 1;
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
			// awning fringe
			g.fillStyle = '#1b2a4a';
			for (let i = 0; i < Math.ceil(U / 3); i++) g.fillRect(3 + i * 3, top + 4, 1.5, 1.5);
		}
		const wy = top + (cfg.awning ? 6 : 2);
		if (cfg.sofa) {
			g.fillStyle = '#cfe8ff';
			g.fillRect(8, wy, 30, h - wy - 1);
			// window frame
			g.strokeStyle = '#5c6a7a'; g.lineWidth = 1;
			g.strokeRect(8.5, wy + 0.5, 29, h - wy - 2);
			const my = wy + (h - wy) / 2;
			g.fillStyle = '#8a5a33';
			g.fillRect(13, my + 1, 16, 2); g.fillRect(13, my - 2, 2.5, 5); g.fillRect(26.5, my - 2, 2.5, 5);
			g.strokeStyle = '#e03131'; g.lineWidth = 1.5;
			g.beginPath(); g.moveTo(11, wy + 1); g.lineTo(31, h - 2); g.moveTo(31, wy + 1); g.lineTo(11, h - 2); g.stroke();
		} else {
			const n = cfg.windows || 2;
			const wh = Math.min(9, h - wy - 8);
			for (let i = 0; i < n; i++) {
				windowPane(g, 6 + i * ((U - 24) / Math.max(1, n - 1)), wy, 10, wh);
			}
		}
		// door with knob + letter slot
		g.fillStyle = '#7a5230';
		g.fillRect(U - 16, h - 11, 10, 11);
		g.fillStyle = '#c9a227';
		g.fillRect(U - 8, h - 6, 1.5, 1.5);
		g.fillStyle = '#3e2c1c';
		g.fillRect(U - 14, h - 8, 5, 1);
	};
}

export function garageFacade(g, U, h) {
	g.fillStyle = '#aab2c0';
	g.fillRect(0, 0, U, h);
	// corrugated siding
	g.fillStyle = 'rgba(0,0,0,0.07)';
	for (let x = 1; x < U; x += 2) g.fillRect(x, 0, 0.7, h);
	g.fillStyle = '#6b7686';
	g.fillRect(12, 8, U - 24, h - 8);
	g.strokeStyle = '#59636f';
	g.lineWidth = 1;
	for (let v = 11; v < h; v += 3) { g.beginPath(); g.moveTo(12, v); g.lineTo(U - 12, v); g.stroke(); }
	// door handle + sensor light
	g.fillStyle = '#c9a227';
	g.fillRect(U - 18, h / 2, 2, 4);
	g.fillStyle = '#ff6b6b';
	g.fillRect(U / 2 - 1, 9, 2, 2);
	g.fillStyle = '#1b2a4a';
	g.font = 'bold 6px monospace';
	g.fillText('GARAGEBOT', (U - 54) / 2, 6.5);
}

export function postFacade(g, U, h) {
	g.fillStyle = '#f4e3c2';
	g.fillRect(0, 0, U, h);
	g.fillStyle = 'rgba(0,0,0,0.05)';
	for (let y = 2; y < h; y += 3) g.fillRect(0, y, U, 0.5);
	g.fillStyle = '#4d79c7';
	g.fillRect(4, 4, U - 8, 9);
	g.fillStyle = '#fff';
	g.font = 'bold 7px monospace';
	g.fillText('POST OFFICE', 9, 11);
	g.fillStyle = '#7a5230';
	g.fillRect(U / 2 - 5, h - 15, 10, 15);
	g.fillStyle = '#c9a227';
	g.fillRect(U / 2 + 2, h - 8, 1.5, 1.5);
	// mail slot
	g.fillStyle = '#1b2a4a';
	g.fillRect(U / 2 - 3, h - 11, 6, 1.5);
	windowPane(g, 8, 16, 9, 8);
	windowPane(g, U - 17, 16, 9, 8);
}

export function wembleFacade(g, U, h) {
	g.fillStyle = '#e5e7eb';
	g.fillRect(0, 0, U, h);
	// curtain-wall grid
	g.strokeStyle = 'rgba(0,0,0,0.08)';
	g.lineWidth = 0.5;
	for (let x = 0; x < U; x += 4) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x, h); g.stroke(); }
	g.fillStyle = '#2563eb';
	g.fillRect(3, 2, U - 6, 9);
	g.fillStyle = '#fff';
	g.font = 'bold 7px monospace';
	g.fillText('WEMBLE', (U - 25) / 2, 9);
	g.fillStyle = '#1a1a1a';
	g.font = 'bold 4px monospace';
	g.fillText('DEVELOPMENT CORPORATION', 12, 15.5);
	const rows = Math.max(3, Math.floor((h - 30) / 5.6));
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < 5; col++) {
			const lit = (row * 5 + col) % 4 === 1;
			windowPane(g, 6 + col * 15, 18 + row * 5.6, 11, 4, lit ? '#fdf3d7' : '#93c5fd');
		}
	}
	g.fillStyle = '#1a1a1a';
	g.fillRect(U - 18, h - 11, 11, 11);
	g.fillStyle = '#c9a227';
	g.fillRect(U - 10, h - 6, 1.5, 1.5);
}

// dense glass tower — eBoy skyline staple
export function skyscraperFacade(cfg) {
	return (g, U, h) => {
		g.fillStyle = cfg.wall;
		g.fillRect(0, 0, U, h);
		// vertical mullions
		g.fillStyle = 'rgba(255,255,255,0.06)';
		for (let x = 2; x < U; x += 4) g.fillRect(x, 14, 1, h - 14);
		// neon crown band
		g.fillStyle = cfg.neon || '#ff5ea8';
		g.fillRect(0, 0, U, 3);
		g.fillStyle = cfg.accent || '#4dd4e8';
		g.fillRect(0, 3, U, 2);
		// logo plate
		g.fillStyle = '#0d1117';
		g.fillRect(2, 6, U - 4, 8);
		g.fillStyle = cfg.neon || '#ff5ea8';
		g.font = 'bold 5px monospace';
		const label = cfg.sign || 'TOWER';
		g.fillText(label, Math.max(3, (U - label.length * 3.2) / 2), 12);
		const floors = cfg.floors || Math.floor((h - 20) / 5);
		const cols = Math.max(2, Math.floor((U - 8) / 7));
		for (let row = 0; row < floors; row++) {
			for (let col = 0; col < cols; col++) {
				const lit = hash(row * 17 + col, floors + col) > 0.38;
				const glass = lit
					? (hash(row, col) > 0.7 ? '#fff3bf' : '#d0ebff')
					: (hash(row + 3, col) > 0.5 ? '#3d4a5c' : '#2c3544');
				const wx = 3 + col * ((U - 6) / cols);
				const wy = 16 + row * ((h - 28) / Math.max(1, floors));
				g.fillStyle = glass;
				g.fillRect(wx, wy, 5, 3.2);
				// tiny sill
				g.fillStyle = 'rgba(0,0,0,0.25)';
				g.fillRect(wx, wy + 3.2, 5, 0.5);
			}
		}
		// ground lobby
		g.fillStyle = cfg.accent || '#4dd4e8';
		g.fillRect(U / 2 - 5, h - 10, 10, 10);
		g.fillStyle = '#0d1117';
		g.fillRect(U / 2 - 3.5, h - 8, 7, 8);
		// antenna blink stubs painted as static pixels
		g.fillStyle = '#ff6b6b';
		g.fillRect(U / 2 - 0.5, 0, 1, 2);
	};
}

export function apartmentFacade(cfg) {
	return (g, U, h) => {
		g.fillStyle = cfg.wall;
		g.fillRect(0, 0, U, h);
		// stucco noise
		for (let i = 0; i < 40; i++) {
			g.fillStyle = hash(i, 3) > 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)';
			g.fillRect(hash(i, 1) * U, hash(i, 2) * h, 2, 2);
		}
		g.fillStyle = cfg.accent || '#5c7cfa';
		g.fillRect(2, 2, U - 4, 7);
		g.fillStyle = '#fff';
		g.font = 'bold 5px monospace';
		g.fillText('STACK OVRFLW', 4, 7.5);
		const floors = Math.max(3, Math.floor((h - 20) / 7));
		const cols = 3;
		for (let row = 0; row < floors; row++) {
			for (let col = 0; col < cols; col++) {
				const wx = 5 + col * ((U - 10) / cols);
				const wy = 12 + row * ((h - 22) / floors);
				windowPane(g, wx, wy, 8, 4.5, hash(row, col) > 0.45 ? '#fdf3d7' : '#a5d8ff');
				// balcony rail
				g.fillStyle = '#868e96';
				g.fillRect(wx - 1, wy + 4.5, 10, 1);
				// laundry / plant pixels
				if (hash(row * 3, col * 5) > 0.55) {
					g.fillStyle = ['#e0447c', '#4dabf7', '#ffd43b', '#37b24d'][Math.floor(hash(row, col + 9) * 4)];
					g.fillRect(wx + 1 + hash(row, col) * 4, wy + 5.5, 2, 2);
				}
			}
		}
		g.fillStyle = '#7a5230';
		g.fillRect(U / 2 - 5, h - 10, 10, 10);
		g.fillStyle = '#c9a227';
		g.fillRect(U / 2 + 2, h - 6, 1.5, 1.5);
	};
}

export function hotelFacade(cfg) {
	return (g, U, h) => {
		g.fillStyle = cfg.wall;
		g.fillRect(0, 0, U, h);
		// vertical art-deco stripes
		g.fillStyle = 'rgba(0,0,0,0.05)';
		for (let x = 3; x < U; x += 6) g.fillRect(x, 14, 1.5, h - 14);
		g.fillStyle = cfg.accent || '#e0447c';
		g.fillRect(0, 0, U, 4);
		g.fillStyle = '#1b2a4a';
		g.fillRect(2, 5, U - 4, 9);
		g.fillStyle = '#ffd43b';
		g.font = 'bold 6px monospace';
		g.fillText('GRAND PIXEL', Math.max(3, (U - 48) / 2), 12);
		const floors = Math.max(4, Math.floor((h - 24) / 5));
		const cols = 4;
		for (let row = 0; row < floors; row++) {
			for (let col = 0; col < cols; col++) {
				const lit = (row + col) % 3 !== 0;
				windowPane(g, 4 + col * ((U - 8) / cols), 16 + row * ((h - 28) / floors), 6, 3.5, lit ? '#fff3bf' : '#74c0fc');
			}
		}
		// canopy
		g.fillStyle = cfg.accent || '#e0447c';
		g.fillRect(U / 2 - 10, h - 12, 20, 2);
		g.fillStyle = '#1b2a4a';
		g.fillRect(U / 2 - 4, h - 10, 8, 10);
		// revolving-door dots
		g.fillStyle = '#ffd43b';
		g.fillRect(U / 2 - 1, h - 6, 2, 2);
	};
}

export function neonFacade(cfg) {
	return (g, U, h) => {
		g.fillStyle = cfg.wall || '#1b1f3a';
		g.fillRect(0, 0, U, h);
		// brick night wall
		g.fillStyle = 'rgba(255,255,255,0.04)';
		for (let y = 0; y < h; y += 3) {
			g.fillRect(0, y, U, 0.5);
			for (let x = (y / 3) % 2 * 4; x < U; x += 8) g.fillRect(x, y, 0.5, 3);
		}
		// big neon sign block
		g.fillStyle = '#0a0a12';
		g.fillRect(3, 3, U - 6, 14);
		g.fillStyle = cfg.neon || '#ff5ea8';
		g.font = 'bold 7px monospace';
		const s = cfg.sign || 'NEON';
		g.fillText(s, Math.max(4, (U - s.length * 4.2) / 2), 12);
		g.fillStyle = cfg.neon2 || '#4dd4e8';
		g.font = 'bold 5px monospace';
		g.fillText('24/7', U / 2 - 8, 16);
		// glowing windows
		for (let i = 0; i < 4; i++) {
			g.fillStyle = i % 2 ? (cfg.neon || '#ff5ea8') : (cfg.neon2 || '#4dd4e8');
			g.fillRect(6 + i * ((U - 16) / 3), 20, 8, 6);
			g.fillStyle = 'rgba(255,255,255,0.15)';
			g.fillRect(6 + i * ((U - 16) / 3), 20, 8, 1);
		}
		// OPEN sign
		g.fillStyle = '#0a0a12';
		g.fillRect(U - 18, h - 14, 14, 6);
		g.fillStyle = '#37b24d';
		g.font = 'bold 5px monospace';
		g.fillText('OPEN', U - 16, h - 9.5);
		g.fillStyle = '#3e2c1c';
		g.fillRect(6, h - 12, 10, 12);
	};
}

export function cinemaFacade(g, U, h) {
	g.fillStyle = '#c94f7c';
	g.fillRect(0, 0, U, h);
	// art-deco vertical ribs
	g.fillStyle = 'rgba(255,255,255,0.08)';
	for (let x = 2; x < U; x += 5) g.fillRect(x, 0, 1.5, h);
	g.fillStyle = '#12131a';
	g.fillRect(3, 2, U - 6, 12);
	g.fillStyle = '#fff';
	g.font = 'bold 8px monospace';
	g.fillText('PIXELPLEX', 18, 11);
	g.fillStyle = '#fdf3d7';
	g.fillRect(6, 17, 26, 16);
	// poster frame
	g.strokeStyle = '#1b2a4a'; g.lineWidth = 1;
	g.strokeRect(6.5, 17.5, 25, 15);
	g.fillStyle = '#1b2a4a';
	g.font = 'bold 4px monospace';
	g.fillText('NOW SHOWING', 8, 22);
	g.fillText('"NOT A BUG"', 8, 27);
	g.fillText('★★★★★', 10, 31.5);
	g.fillStyle = '#7a5230';
	g.fillRect(44, 22, 12, 14);
	g.fillStyle = '#c9a227';
	g.fillRect(53, 29, 1.5, 1.5);
	g.fillStyle = '#ffd43b';
	for (let i = 0; i < 5; i++) g.fillRect(4 + i * 15, 14.5, 3, 1.5);
	// extra floors of marquee lights when the cinema goes tall
	for (let y = 36; y < h - 8; y += 6) {
		g.fillStyle = y % 12 < 6 ? '#ffd43b' : '#ff5ea8';
		for (let i = 0; i < 6; i++) g.fillRect(6 + i * 12, y, 3, 2);
	}
}

// arcade facade is repainted per frame for the neon blink
export function arcadeFacade(g, U, h, t) {
	g.fillStyle = '#5f3dc4';
	g.fillRect(0, 0, U, h);
	// pixel-grid wallpaper
	g.fillStyle = 'rgba(0,0,0,0.12)';
	for (let y = 16; y < h; y += 3)
		for (let x = 2; x < U - 2; x += 3) g.fillRect(x, y, 1.5, 1.5);
	g.fillStyle = '#12131a';
	g.fillRect(3, 3, U - 6, 12);
	g.fillRect(8, 18, 14, 12); g.fillRect(U - 24, 18, 14, 12);
	// cabinet screens glow
	const glow = Math.floor(t / 800) % 2 ? '#ff5ea8' : '#4dd4e8';
	g.fillStyle = glow;
	g.fillRect(10, 20, 10, 7);
	g.fillRect(U - 22, 20, 10, 7);
	g.font = 'bold 8px monospace';
	g.fillStyle = glow;
	g.fillText('ARCADE', 17, 12);
	g.fillStyle = '#ffd43b';
	g.font = 'bold 6px monospace';
	g.fillText('SOON!', 25, 26);
	// coin slot
	g.fillStyle = '#1b2a4a';
	g.fillRect(U / 2 - 2, h - 6, 4, 1.5);
}

export function townhallFacade(g, U, h) {
	// brick body like the eBoy townhouse ref
	paintBrick(g, U, h, '#b0705a');
	// cream cornice band
	g.fillStyle = '#f1eee6';
	g.fillRect(0, 0, U, 5);
	g.fillStyle = '#d8d2c4';
	g.fillRect(0, 5, U, 1.5);
	// crest (St-George-ish shield + flourishes)
	const cx = U / 2;
	g.fillStyle = '#3d9e4a';
	g.fillRect(cx - 9, 7, 3, 2); g.fillRect(cx + 6, 7, 3, 2);
	g.fillRect(cx - 11, 9, 2, 4); g.fillRect(cx + 9, 9, 2, 4);
	g.fillStyle = '#f1eee6';
	g.fillRect(cx - 6, 6, 12, 12);
	g.fillStyle = '#c92a2a';
	g.fillRect(cx - 4, 8, 8, 8);
	g.fillStyle = '#f1eee6';
	g.fillRect(cx - 0.7, 8, 1.4, 8);
	g.fillRect(cx - 4, 11.3, 8, 1.4);
	// stone window surrounds + dark panes (upper floors)
	const floors = Math.max(2, Math.floor((h - 36) / 12));
	for (let row = 0; row < floors; row++) {
		for (let col = 0; col < 4; col++) {
			const wx = 8 + col * ((U - 16) / 4);
			const wy = 20 + row * 11;
			stoneFrame(g, wx, wy, 8, 7);
			windowPane(g, wx, wy, 8, 7, '#1b2a4a');
		}
	}
	// columns framing door
	g.fillStyle = '#f1eee6';
	for (const px of [U / 2 - 14, U / 2 + 9]) {
		g.fillRect(px, h - 22, 5, 22);
		g.fillRect(px - 1, h - 22, 7, 2); // capital
	}
	// rainbow awning (ref: red/yellow)
	for (let i = 0; i < 8; i++) {
		g.fillStyle = i % 2 ? '#ffd43b' : '#e03131';
		g.fillRect(U / 2 - 12 + i * 3, h - 20, 3, 3.5);
	}
	// door with white surround
	stoneFrame(g, U / 2 - 6, h - 16, 12, 16, 1.8);
	g.fillStyle = '#3e2c1c';
	g.fillRect(U / 2 - 6, h - 16, 12, 16);
	g.fillStyle = '#c9a227';
	g.fillRect(U / 2 + 3, h - 9, 1.5, 1.5);
	g.fillStyle = '#bcd6ff';
	g.beginPath(); g.arc(U / 2, h - 16, 4.5, Math.PI, 0); g.fill();
	// TOWN HALL plaque
	g.fillStyle = '#1b2a4a';
	g.fillRect(U / 2 - 16, h - 26, 32, 5);
	g.fillStyle = '#ffd43b';
	g.font = 'bold 4px monospace';
	g.fillText('TOWN HALL', U / 2 - 14, h - 22.5);
}

export function houseFacade(g, U, h) {
	paintBrick(g, U, h, '#c4846c');
	// white string course
	g.fillStyle = '#f1eee6';
	g.fillRect(0, 4, U, 2);
	// door with stone surround
	stoneFrame(g, 5, h - 13, 10, 13, 1.5);
	g.fillStyle = '#5c3a1e';
	g.fillRect(5, h - 13, 10, 13);
	g.fillStyle = '#c9a227';
	g.fillRect(12, h - 7, 1.5, 1.5);
	// window with thick white frame
	stoneFrame(g, U - 22, 8, 12, 9, 1.6);
	windowPane(g, U - 22, 8, 12, 9, '#1b2a4a');
	// flower box
	g.fillStyle = '#8a5a33';
	g.fillRect(U - 23, 18, 14, 2.5);
	g.fillStyle = '#e0447c';
	g.fillRect(U - 21, 16.5, 2.5, 2.5);
	g.fillStyle = '#ffd43b';
	g.fillRect(U - 17, 16.5, 2.5, 2.5);
	g.fillStyle = '#4dabf7';
	g.fillRect(U - 13, 16.5, 2.5, 2.5);
}

export function boathouseFacade(g, U, h) {
	g.fillStyle = '#74a3c7';
	g.fillRect(0, 0, U, h);
	g.fillStyle = 'rgba(255,255,255,0.1)';
	for (let y = 12; y < h; y += 3) g.fillRect(0, y, U, 0.6);
	g.fillStyle = '#274156';
	g.fillRect(3, 2, U - 6, 9);
	g.fillStyle = '#d7ecff';
	g.font = 'bold 6px monospace';
	g.fillText('BOATS', (U - 24) / 2, 8.5);
	g.fillStyle = '#37536b';
	g.fillRect(8, h - 9, U - 16, 9); // big water door
	// door planks + rope pull
	g.fillStyle = 'rgba(0,0,0,0.15)';
	for (let x = 10; x < U - 10; x += 4) g.fillRect(x, h - 9, 1, 9);
	g.fillStyle = '#c9a227';
	g.fillRect(U / 2 - 1, h - 5, 2, 2);
}

// clock face; hands drawn by the Clock entity
export function clockFace(g, U, h) {
	g.fillStyle = '#dcd6c8';
	g.fillRect(0, 0, U, h);
	// stone border
	g.strokeStyle = '#8f8878';
	g.lineWidth = 1.5;
	g.strokeRect(1, 1, U - 2, h - 2);
	g.fillStyle = '#fdf3d7';
	g.beginPath(); g.arc(U / 2, h / 2, 6.5, 0, 7); g.fill();
	g.strokeStyle = '#1b2a4a';
	g.lineWidth = 1;
	g.stroke();
	// hour ticks
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
		const r0 = 4.5, r1 = 5.8;
		g.beginPath();
		g.moveTo(U / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
		g.lineTo(U / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1);
		g.stroke();
	}
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
