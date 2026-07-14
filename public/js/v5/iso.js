// iso.js — isometric projection helpers (eBoy-style 2:1 diamond tiles).

/** Half-width / half-height of one ground diamond in buffer pixels. */
export const ISO_HW = 12;
export const ISO_HH = 6;

/** World (float cell) → screen pixel relative to origin (0,0) world. */
export function worldToScreen(wx, wy) {
	return {
		x: (wx - wy) * ISO_HW,
		y: (wx + wy) * ISO_HH,
	};
}

/** Screen delta → approximate world (for click picking). */
export function screenToWorld(sx, sy) {
	const wx = (sx / ISO_HW + sy / ISO_HH) / 2;
	const wy = (sy / ISO_HH - sx / ISO_HW) / 2;
	return { x: wx, y: wy };
}

/** Depth key for painter's algorithm (draw far first). */
export function depthKey(wx, wy, bias = 0) {
	return wx + wy + bias;
}
