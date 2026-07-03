// iso.js — shared isometric math, palette, and drawing helpers.

export const TW = 32, TH = 16; // tile footprint in world px
export const HW = TW / 2, HH = TH / 2;
export const GRID = 50;

export const OX = GRID * HW, OY = 96;
export const SKIRT_D = 480; // underground cross-section depth
export const SURFACE_H = GRID * TH + OY; // world px height of the surface part
export const WORLD_W = GRID * TW;
export const WORLD_H = SURFACE_H + SKIRT_D + 20;

// grid coords (floats ok) → world px
export function g2w(gx, gy) {
	return [OX + (gx - gy) * HW, OY + (gx + gy) * HH];
}

// world px → grid coords
export function w2g(x, y) {
	const dx = (x - OX) / HW, dy = (y - OY) / HH;
	return [(dy + dx) / 2, (dy - dx) / 2];
}

// deterministic pseudo-randomness (same town for everyone)
export function hash(x, y) {
	let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
	h = (h ^ (h >> 13)) * 1274126177;
	return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export function shade(hex, f) {
	const n = parseInt(hex.slice(1), 16);
	const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
	return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// ---------------------------------------------------------------- palette
export const GRASS = ['#7ec850', '#78c34b', '#86cf58'];
export const ROAD = '#8d9095', ROAD_EDGE = '#75787d', DASH = '#f2e7c4';
export const WATER = '#45b5ea', WATER_LIT = '#7cd0f5';
export const SOIL = '#7a5230', SOIL_DARK = '#5e3d22';
export const INK = '#1b2a4a';

// ---------------------------------------------------------------- shapes
export function tilePath(g, gx, gy) {
	const [x, y] = g2w(gx, gy);
	g.beginPath();
	g.moveTo(x, y);
	g.lineTo(x + HW, y + HH);
	g.lineTo(x, y + TH);
	g.lineTo(x - HW, y + HH);
	g.closePath();
}

// extruded box over tiles [gx, gx+w) × [gy, gy+d), height h
export function box(g, gx, gy, w, d, h, col) {
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

// map local (u,v) onto a box's SW face; u: 16px per tile along the face,
// v: px downward from the face top.
export function onSW(g, gx, gy1, h) {
	const [x, y] = g2w(gx, gy1);
	g.setTransform(1, 0.5, 0, 1, x, y - h);
}
export function resetT(g) {
	g.setTransform(1, 0, 0, 1, 0, 0);
}
