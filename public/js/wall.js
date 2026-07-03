// wall.js — the shared graffiti wall: offscreen wall canvas (also used as
// the in-town preview), spray rendering, and the /api/wall client.

export const WALL_W = 1600, WALL_H = 700;

const PALETTE = [
	'#ff3b6b', '#ff8c1a', '#ffd400', '#3ddc55', '#28c7a0',
	'#33b6ff', '#4d6bff', '#b04dff', '#ff5ed2', '#ffffff', '#1a1a1e',
];
const SIZES = { S: 7, M: 14, L: 26 };
const MAX_POINTS = 300;
const MAX_AGE_MS = 60 * 86400_000;

// deterministic PRNG so spray speckle replays the same for everyone
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a |= 0; a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function createWall() {
	const canvas = document.createElement('canvas');
	canvas.width = WALL_W;
	canvas.height = WALL_H;
	const g = canvas.getContext('2d');

	const state = {
		canvas,
		strokes: [], // { id, t, d: {color,size,pts} }
		lastId: 0,
		artists: 0,
		dirty: true,
	};

	drawBricks(g);

	state.redraw = () => {
		drawBricks(g);
		const now = Date.now();
		for (const s of state.strokes) drawStroke(g, s.d, 1 - Math.min(1, (now - s.t) / MAX_AGE_MS));
		state.dirty = true;
	};

	state.addStroke = (stroke, t, id) => {
		state.strokes.push({ id: id || 0, t: t || Date.now(), d: stroke });
		if (id) state.lastId = Math.max(state.lastId, id);
		drawStroke(g, stroke, 1);
		state.dirty = true;
	};

	// incremental spray while a stroke is in progress
	state.drawSegment = (d) => {
		drawStroke(g, d, 1);
		state.dirty = true;
	};

	state.load = async () => {
		try {
			const res = await fetch('/api/wall');
			if (!res.ok) return false;
			const { strokes } = await res.json();
			state.strokes = strokes.map((s) => ({ id: s.id, t: s.t, d: JSON.parse(s.d) }));
			state.lastId = state.strokes.length ? state.strokes[state.strokes.length - 1].id : 0;
			state.redraw();
			return true;
		} catch {
			return false;
		}
	};

	state.poll = async () => {
		// cheap: refetch and append anything newer than lastId
		try {
			const res = await fetch('/api/wall');
			if (!res.ok) return;
			const { strokes } = await res.json();
			for (const s of strokes) {
				if (s.id > state.lastId) state.addStroke(JSON.parse(s.d), s.t, s.id);
			}
		} catch { /* offline is fine */ }
	};

	return state;
}

// ---------------------------------------------------------------- rendering
function drawBricks(g) {
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.fillStyle = '#c9553e';
	g.fillRect(0, 0, WALL_W, WALL_H);
	const bw = 64, bh = 26;
	const rnd = mulberry32(1234);
	for (let row = 0; row * bh < WALL_H; row++) {
		for (let col = -1; col * bw < WALL_W; col++) {
			const x = col * bw + (row % 2 ? bw / 2 : 0);
			const f = 0.92 + rnd() * 0.16;
			g.fillStyle = `rgb(${Math.round(201 * f)},${Math.round(85 * f)},${Math.round(62 * f)})`;
			g.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
		}
	}
	// mortar shadow lines
	g.fillStyle = 'rgba(0,0,0,0.08)';
	for (let row = 0; row * bh < WALL_H; row++) g.fillRect(0, row * bh, WALL_W, 2);
	// faded whitewash invitation
	g.fillStyle = 'rgba(255,255,255,0.16)';
	g.font = 'bold 130px monospace';
	g.textAlign = 'center';
	g.fillText('PAINT ME', WALL_W / 2, WALL_H / 2 + 45);
	g.textAlign = 'left';
}

function strokeSeed(d) {
	const p = d.pts[0];
	return (Math.round(p[0]) * 7919 + Math.round(p[1]) * 104729 + d.pts.length) >>> 0;
}

export function drawStroke(g, d, alpha) {
	if (alpha <= 0.04) return;
	const rnd = mulberry32(strokeSeed(d));
	const r = d.size;
	g.save();
	g.globalAlpha = Math.min(1, 0.35 + alpha * 0.65);
	g.fillStyle = d.color;
	g.strokeStyle = d.color;
	// soft connected core line
	g.globalAlpha *= 0.85;
	g.lineWidth = r * 0.9;
	g.lineCap = 'round';
	g.lineJoin = 'round';
	g.beginPath();
	g.moveTo(d.pts[0][0], d.pts[0][1]);
	for (const [x, y] of d.pts) g.lineTo(x, y);
	g.stroke();
	// speckle halo — the "spray" look
	g.globalAlpha = Math.min(1, 0.35 + alpha * 0.65) * 0.5;
	for (const [x, y] of d.pts) {
		const n = 4 + Math.floor(r / 3);
		for (let i = 0; i < n; i++) {
			const a = rnd() * Math.PI * 2, dist = (rnd() + rnd()) * r * 0.75;
			const s = 1 + rnd() * 2;
			g.fillRect(x + Math.cos(a) * dist, y + Math.sin(a) * dist, s, s);
		}
	}
	g.restore();
}

// ---------------------------------------------------------------- wall mode UI
export function initWallMode(wall, onExit) {
	const overlay = document.getElementById('wall-mode');
	const cv = document.getElementById('wall-canvas');
	const ctx = cv.getContext('2d');
	const colorsEl = document.getElementById('wall-colors');
	const sizesEl = document.getElementById('wall-sizes');
	const countEl = document.getElementById('wall-count');

	let color = localStorage.getItem('spray-color') || PALETTE[0];
	let sizeKey = localStorage.getItem('spray-size') || 'M';
	let view = { scale: 1, x: 0, y: 0 };
	let painting = null; // in-progress stroke
	let pollTimer = null;
	let raf = null;

	// palette buttons
	for (const c of PALETTE) {
		const b = document.createElement('button');
		b.style.background = c;
		b.dataset.color = c;
		if (c === color) b.classList.add('active');
		b.addEventListener('click', () => {
			color = c;
			localStorage.setItem('spray-color', c);
			colorsEl.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
		});
		colorsEl.appendChild(b);
	}
	for (const k of Object.keys(SIZES)) {
		const b = document.createElement('button');
		b.textContent = k;
		if (k === sizeKey) b.classList.add('active');
		b.addEventListener('click', () => {
			sizeKey = k;
			localStorage.setItem('spray-size', k);
			sizesEl.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
		});
		sizesEl.appendChild(b);
	}

	function layout() {
		const vw = window.innerWidth, vh = window.innerHeight;
		view.scale = Math.min(vw / WALL_W, (vh - 130) / WALL_H);
		cv.width = Math.round(WALL_W * view.scale);
		cv.height = Math.round(WALL_H * view.scale);
		cv.style.left = `${Math.round((vw - cv.width) / 2)}px`;
		cv.style.top = `${Math.round(Math.max(44, (vh - cv.height) / 2 - 20))}px`;
		wall.dirty = true;
	}

	function frame() {
		if (wall.dirty) {
			ctx.imageSmoothingEnabled = false;
			ctx.clearRect(0, 0, cv.width, cv.height);
			ctx.drawImage(wall.canvas, 0, 0, cv.width, cv.height);
			wall.dirty = false;
		}
		raf = requestAnimationFrame(frame);
	}

	function toWall(e) {
		const r = cv.getBoundingClientRect();
		return [
			Math.max(0, Math.min(WALL_W, (e.clientX - r.left) / view.scale)),
			Math.max(0, Math.min(WALL_H, (e.clientY - r.top) / view.scale)),
		];
	}

	cv.addEventListener('pointerdown', (e) => {
		e.preventDefault();
		cv.setPointerCapture(e.pointerId);
		const [x, y] = toWall(e);
		painting = { color, size: SIZES[sizeKey], pts: [[x, y]] };
		wall.addStroke(painting); // registers the live stroke; pts keep growing
	});
	cv.addEventListener('pointermove', (e) => {
		if (!painting) return;
		const [x, y] = toWall(e);
		const last = painting.pts[painting.pts.length - 1];
		if (Math.hypot(x - last[0], y - last[1]) < 6) return;
		painting.pts.push([x, y]);
		wall.drawSegment({ color: painting.color, size: painting.size, pts: [last, [x, y]] });
		if (painting.pts.length >= MAX_POINTS) finishStroke();
	});
	cv.addEventListener('pointerup', finishStroke);
	cv.addEventListener('pointercancel', finishStroke);

	async function finishStroke() {
		if (!painting) return;
		const d = painting;
		painting = null;
		const live = wall.strokes.find((s) => s.d === d);
		try {
			const res = await fetch('/api/wall', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ color: d.color, size: d.size, pts: d.pts }),
			});
			if (res.ok && live) {
				const { id, t } = await res.json();
				live.id = id;
				live.t = t;
				wall.lastId = Math.max(wall.lastId, id);
			}
		} catch { /* stays local-only */ }
	}

	document.getElementById('wall-back').addEventListener('click', close);

	function open() {
		overlay.hidden = false;
		layout();
		frame();
		wall.poll().then(updateCount);
		pollTimer = setInterval(() => wall.poll().then(updateCount), 12000);
		window.addEventListener('resize', layout);
	}
	function close() {
		overlay.hidden = true;
		cancelAnimationFrame(raf);
		clearInterval(pollTimer);
		window.removeEventListener('resize', layout);
		onExit();
	}
	function updateCount() {
		const n = wall.strokes.length;
		countEl.textContent = n
			? `· ${n} stroke${n === 1 ? '' : 's'} and counting`
			: '· fresh bricks, first spray is yours';
	}

	return { open };
}
