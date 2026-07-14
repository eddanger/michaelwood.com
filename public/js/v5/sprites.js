// sprites.js — isometric eBoy-ish pixel trees & character (flat 2D, not voxels).

import { ISO_HW, ISO_HH } from './iso.js';

// Hot path: set fillStyle once per run of same color (callers batch when possible).
export function px(g, x, y, color) {
	if (g._pxc !== color) {
		g.fillStyle = color;
		g._pxc = color;
	}
	g.fillRect(x | 0, y | 0, 1, 1);
}

export function rect(g, x, y, w, h, color) {
	if (g._pxc !== color) {
		g.fillStyle = color;
		g._pxc = color;
	}
	g.fillRect(x | 0, y | 0, w | 0, h | 0);
}

/** Isometric ground diamond — few fillRects, no per-pixel style thrash. */
export function drawIsoTile(g, cx, cy, variant) {
	const greens = ['#6db844', '#78c34b', '#86cf58', '#5fa832', '#69b83a'];
	const fill = greens[variant % 5];
	g._pxc = null;
	g.fillStyle = fill;
	// diamond via horizontal spans (one fillStyle)
	for (let row = -ISO_HH; row <= ISO_HH; row++) {
		const t = 1 - Math.abs(row) / ISO_HH;
		const half = (ISO_HW * t) | 0;
		if (half < 1) continue;
		g.fillRect(cx - half, cy + row, half * 2 + 1, 1);
	}
	// edge rims in two colors
	g.fillStyle = '#3d7a24';
	for (let row = -ISO_HH; row <= 0; row++) {
		const t = 1 - Math.abs(row) / ISO_HH;
		const half = (ISO_HW * t) | 0;
		if (half < 1) continue;
		g.fillRect(cx - half, cy + row, 1, 1);
	}
	g.fillStyle = '#94d66a';
	for (let row = 0; row <= ISO_HH; row++) {
		const t = 1 - Math.abs(row) / ISO_HH;
		const half = (ISO_HW * t) | 0;
		if (half < 1) continue;
		g.fillRect(cx + half, cy + row, 1, 1);
	}
	// sparse details
	if (variant % 3 === 0) {
		g.fillStyle = '#94d66a';
		g.fillRect(cx - 2, cy - 1, 1, 1);
	}
	if (variant % 11 === 0) {
		g.fillStyle = '#e0447c';
		g.fillRect(cx, cy - 1, 1, 1);
		g.fillStyle = '#ffd43b';
		g.fillRect(cx + 1, cy - 1, 1, 1);
	}
}

/**
 * Isometric 3/4 tree. Feet / trunk base at (cx, baseY) in screen pixels.
 * size: 0.4–2.5 scales trunk + canopy; damaged 0..1 strips foliage.
 */
export function drawTree(g, tree, cx, baseY, damaged = 0) {
	const kind = tree.kind;
	const size = tree.size || 1;
	const d = Math.min(1, Math.max(0, damaged));
	const seed = tree.seed || 0;

	// isometric shadow ellipse
	const shW = Math.max(3, Math.round(5 * size));
	const shH = Math.max(1, Math.round(2 * size));
	g.fillStyle = 'rgba(20,40,20,0.22)';
	for (let row = -shH; row <= shH; row++) {
		const t = 1 - Math.abs(row) / (shH + 0.01);
		const half = Math.max(1, Math.floor(shW * t));
		g.fillRect(cx - half, baseY + row, half * 2, 1);
	}

	if (kind === 'stump') {
		const tw = Math.max(2, Math.round(2.2 * size));
		const th = Math.max(2, Math.round(3 * Math.min(size, 1.2)));
		// iso stump block: left + right faces
		for (let y = 0; y < th; y++) {
			for (let x = 0; x < tw; x++) {
				px(g, cx - tw + x, baseY - y, '#5c3a1e'); // left face
				px(g, cx + x, baseY - y - 1, '#8a5a33'); // right face (raised)
			}
		}
		// cut top
		for (let x = -tw + 1; x < tw; x++) {
			const yy = baseY - th - Math.floor(Math.abs(x) * 0.15);
			px(g, cx + x, yy, x < 0 ? '#c9a36a' : '#e8c07a');
		}
		return;
	}

	// --- trunk (two-tone iso “box” column) ---
	const trunkH = Math.max(3, Math.round((kind === 'pine' ? 9 : kind === 'birch' ? 8 : kind === 'bush' ? 3 : 7) * size));
	const trunkW = Math.max(1, Math.round((kind === 'bush' ? 1.2 : 1.6) * size));
	const trunkL = kind === 'birch' ? '#e9ecef' : '#5c3a1e';
	const trunkR = kind === 'birch' ? '#ced4da' : '#8a5a33';
	const trunkDark = kind === 'birch' ? '#adb5bd' : '#3e2c1c';

	for (let y = 0; y < trunkH; y++) {
		// left face
		for (let x = 0; x < trunkW; x++) {
			px(g, cx - trunkW + x, baseY - y, (x === 0 ? trunkDark : trunkL));
		}
		// right face (offset up-right for iso)
		for (let x = 0; x < trunkW; x++) {
			px(g, cx + x, baseY - y - 1, trunkR);
		}
	}
	if (kind === 'birch') {
		for (let i = 2; i < trunkH; i += 3) {
			px(g, cx, baseY - i, '#1b2a4a');
			px(g, cx - 1, baseY - i, '#495057');
		}
	}

	// chop notches when damaged
	if (d > 0.15) {
		px(g, cx + trunkW, baseY - Math.floor(trunkH * 0.25), '#c9a36a');
		px(g, cx + trunkW, baseY - Math.floor(trunkH * 0.25) - 1, '#8a5a33');
	}
	if (d > 0.45) {
		px(g, cx - trunkW, baseY - Math.floor(trunkH * 0.3), '#c9a36a');
	}

	const canopyBase = baseY - trunkH;
	const shrink = 1 - d * 0.45;

	if (kind === 'bush') {
		drawCanopyBlob(g, cx, canopyBase, 3.2 * size * shrink, seed, ['#2f9e44', '#40c057', '#37b24d', '#1b5e20']);
		return;
	}

	if (kind === 'pine') {
		// stacked iso cones
		const layers = Math.max(3, Math.round(5 * size * shrink));
		for (let L = 0; L < layers; L++) {
			const t = L / layers;
			const w = (1.2 + (1 - t) * 4.5) * size * shrink;
			const y = canopyBase - Math.round(L * 2.4 * size);
			const cols = t < 0.3 ? ['#1b5e20', '#2e7d32'] : t < 0.7 ? ['#2e7d32', '#388e3c'] : ['#43a047', '#66bb6a'];
			drawCanopyDiamond(g, cx, y, w, cols, seed + L);
		}
		// highlight tip
		px(g, cx, canopyBase - Math.round(layers * 2.4 * size) - 1, '#a5d6a7');
		return;
	}

	if (kind === 'oak') {
		const r = 4.5 * size * shrink;
		drawCanopyBlob(g, cx - Math.round(size), canopyBase - Math.round(2 * size), r * 0.85, seed, ['#1b5e20', '#2e7d32', '#388e3c']);
		drawCanopyBlob(g, cx + Math.round(size * 1.2), canopyBase - Math.round(1.5 * size), r * 0.9, seed + 3, ['#2e7d32', '#43a047', '#1b5e20']);
		drawCanopyBlob(g, cx, canopyBase - Math.round(3.5 * size), r, seed + 7, ['#388e3c', '#43a047', '#66bb6a', '#2e7d32']);
		if (d < 0.35 && size > 0.8) {
			px(g, cx + Math.round(r * 0.5), canopyBase - Math.round(2 * size), '#e8590c');
			px(g, cx - Math.round(r * 0.4), canopyBase - Math.round(size), '#fab005');
		}
		return;
	}

	// birch — tall airy oval
	const r = 3.6 * size * shrink;
	drawCanopyBlob(g, cx, canopyBase - Math.round(2 * size), r, seed, ['#69db7c', '#51cf66', '#40c057', '#2f9e44']);
	drawCanopyBlob(g, cx + 1, canopyBase - Math.round(4 * size), r * 0.75, seed + 2, ['#b2f2bb', '#69db7c', '#40c057']);
}

/** Soft round canopy cluster. */
function drawCanopyBlob(g, cx, cy, radius, seed, colors) {
	const r = Math.max(2, Math.round(radius));
	const r2 = r * r;
	for (let y = -r; y <= r; y++) {
		for (let x = -r; x <= r + 1; x++) {
			// squash for iso depth
			const d2 = x * x * 0.85 + y * y * 1.35;
			if (d2 > r2) continue;
			// dither by position + seed for eBoy pixel noise
			const n = ((x * 13 + y * 7 + seed) >>> 0) % colors.length;
			// lighter on top-right (sun)
			const c = (x - y > r * 0.3) ? colors[Math.min(colors.length - 1, n)] : colors[n % colors.length];
			const lit = colors[colors.length - 1];
			px(g, cx + x, cy + y, (x - y > r * 0.55) ? lit : c);
		}
	}
}

/** Diamond / cone layer for pines. */
function drawCanopyDiamond(g, cx, cy, halfW, colors, seed) {
	const hw = Math.max(1, Math.round(halfW));
	const hh = Math.max(1, Math.round(halfW * 0.55));
	for (let row = -hh; row <= hh; row++) {
		const t = 1 - Math.abs(row) / (hh + 0.01);
		const half = Math.max(1, Math.floor(hw * t));
		const y = cy + row;
		for (let x = -half; x <= half; x++) {
			const n = ((x * 5 + row * 9 + seed) >>> 0) % colors.length;
			px(g, cx + x, y, colors[n]);
		}
	}
}

/**
 * Isometric Mike. Feet at (cx, baseY). hands = null | tool | log.
 */
export function drawPlayer(g, cx, baseY, facing, swing = 0, hands = null) {
	g._pxc = null;
	// shadow
	g.fillStyle = 'rgba(0,0,0,0.25)';
	g.fillRect(cx - 4, baseY, 9, 2);

	const bob = Math.round(Math.sin(swing * 6) * 1);

	// 1px outline for forest readability
	rect(g, cx - 4, baseY - 18, 9, 18, '#1b2a4a');

	// legs
	rect(g, cx - 2, baseY - 4 + bob, 2, 4, '#1b1f24');
	rect(g, cx + 1, baseY - 4 - bob, 2, 4, '#2d3138');

	// body — brighter teal so he pops on green
	rect(g, cx - 3, baseY - 10, 4, 6, '#0ca678');
	rect(g, cx + 1, baseY - 11, 3, 6, '#3bc9db');
	rect(g, cx - 3, baseY - 5, 7, 1, '#5c3a1e');

	// head
	rect(g, cx - 2, baseY - 15, 5, 4, '#ffd8a8');
	rect(g, cx - 2, baseY - 17, 5, 2, '#5c3a1e');
	px(g, cx - 2, baseY - 15, '#5c3a1e');
	px(g, cx + 2, baseY - 15, '#5c3a1e');

	if (facing !== 'n') {
		const ex = facing === 'w' ? cx - 1 : facing === 'e' ? cx + 1 : cx;
		px(g, ex - 1, baseY - 14, '#1b2a4a');
		px(g, ex + 1, baseY - 14, '#1b2a4a');
	}

	const swingA = Math.sin(swing * Math.PI) * 5;
	let ax = cx + 4;
	let ay = baseY - 9;

	if (facing === 'w') {
		ax = cx - 6; ay = baseY - 9;
	} else if (facing === 'n') {
		ax = cx + 3; ay = baseY - 12 - swingA;
	} else if (facing === 's') {
		ax = cx + 4; ay = baseY - 7;
	} else {
		ax = cx + 5; ay = baseY - 9 - swingA * 0.15;
	}

	if (hands?.type === 'tool' && hands.tool === 'axe') {
		const hx = facing === 'w' ? ax - 2 : ax + 2;
		const hy = ay - 3 + (facing === 's' ? swingA : 0);
		rect(g, ax, ay, 1, 5, '#8a5a33');
		rect(g, hx - 1, hy, 4, 2, '#adb5bd');
		px(g, hx + 2, hy, '#f1f3f5');
	} else if (hands?.type === 'tool' && hands.tool === 'saw') {
		// handsaw blade
		rect(g, ax, ay + 1, 1, 4, '#8a5a33');
		rect(g, ax + (facing === 'w' ? -4 : 1), ay, 4, 2, '#ced4da');
		for (let i = 0; i < 3; i++) {
			px(g, ax + (facing === 'w' ? -1 - i : 2 + i), ay + 2, '#868e96');
		}
	} else if (hands?.type === 'log') {
		// carrying log on shoulder
		const lw = Math.max(4, Math.round(5 * (hands.size || 1)));
		rect(g, cx - 2, baseY - 14, lw, 3, '#8a5a33');
		rect(g, cx - 2, baseY - 15, lw, 1, '#c9a36a');
		if (hands.branched) {
			px(g, cx + 2, baseY - 16, '#2e7d32');
			px(g, cx + 4, baseY - 17, '#388e3c');
			px(g, cx, baseY - 16, '#1b5e20');
		}
	}
}

/** Ground log — horizontal iso timber; branches if not limbed. */
export function drawLog(g, cx, baseY, log) {
	const size = log.size || 1;
	const len = Math.max(5, Math.round(7 * Math.min(size, 1.8)));
	const thick = Math.max(2, Math.round(2 * Math.min(size, 1.5)));
	// shadow
	g.fillStyle = 'rgba(0,0,0,0.18)';
	g.fillRect(cx - (len >> 1), baseY, len, 2);
	// body
	const x0 = cx - (len >> 1);
	rect(g, x0, baseY - thick, len, thick, '#6b4423');
	rect(g, x0, baseY - thick - 1, len, 1, '#8a5a33');
	// cut ends
	rect(g, x0, baseY - thick, 1, thick, '#c9a36a');
	rect(g, x0 + len - 1, baseY - thick, 1, thick, '#a67c52');
	if (log.branched) {
		// branch stubs + leaves
		const mids = [2, Math.floor(len / 2), len - 3];
		for (const m of mids) {
			if (m < 1 || m >= len) continue;
			px(g, x0 + m, baseY - thick - 2, '#5c3a1e');
			px(g, x0 + m, baseY - thick - 3, '#2e7d32');
			px(g, x0 + m + 1, baseY - thick - 3, '#43a047');
		}
	}
}

export function drawTool(g, cx, baseY, tool) {
	g.fillStyle = 'rgba(0,0,0,0.15)';
	g.fillRect(cx - 3, baseY, 7, 2);
	if (tool === 'axe') {
		rect(g, cx, baseY - 6, 1, 6, '#8a5a33');
		rect(g, cx - 1, baseY - 8, 4, 2, '#adb5bd');
		px(g, cx + 2, baseY - 8, '#f1f3f5');
	} else if (tool === 'saw') {
		rect(g, cx - 1, baseY - 5, 1, 5, '#8a5a33');
		rect(g, cx, baseY - 6, 5, 2, '#ced4da');
		for (let i = 0; i < 4; i++) px(g, cx + 1 + i, baseY - 4, '#868e96');
	} else {
		rect(g, cx - 1, baseY - 4, 3, 4, '#495057');
	}
}

export function drawPile(g, cx, baseY, pile) {
	const n = pile.stack?.length || 0;
	const logs = (pile.stack || []).filter((s) => s.type === 'log');
	const tools = (pile.stack || []).filter((s) => s.type === 'tool');
	// stacked log layers
	const layers = Math.min(4, Math.max(1, logs.length));
	for (let i = 0; i < layers; i++) {
		const log = logs[i] || { size: 1, branched: false };
		const y = baseY - i * 3;
		drawLog(g, cx + (i % 2), y, { ...log, size: Math.min(log.size || 1, 1.2) });
	}
	// tools on top
	if (tools.length) {
		drawTool(g, cx + 4, baseY - layers * 3 - 2, tools[tools.length - 1].tool);
	}
	// count pip
	if (n > 1) {
		rect(g, cx + 5, baseY - layers * 3 - 8, 5, 5, '#1b2a4a');
		// tiny white pixels as "count" hint
		px(g, cx + 6, baseY - layers * 3 - 6, '#fff');
		if (n > 2) px(g, cx + 8, baseY - layers * 3 - 6, '#fff');
	}
}
