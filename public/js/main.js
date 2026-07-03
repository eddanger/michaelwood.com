// main.js — camera, input, HUD and the loop that stitches town + wall together.

import { createTown, drawDynamic, WORLD_W, WORLD_H, w2g, g2w, catPos, duckPos } from './town.js';
import { createWall, initWallMode } from './wall.js';
import { createNpcs } from './npc.js';

const canvas = document.getElementById('town');
const ctx = canvas.getContext('2d');

const town = createTown();
const wall = createWall();
const npcs = createNpcs();
wall.load(); // fetch shared graffiti in the background

// ---------------------------------------------------------------- camera
const cam = { zoom: 2.5, x: 0, y: 0, min: 1.2, max: 8 };

function fitCamera() {
	canvas.width = window.innerWidth * devicePixelRatio;
	canvas.height = window.innerHeight * devicePixelRatio;
	const fit = Math.min(canvas.width / WORLD_W, canvas.height / WORLD_H) * 0.95;
	cam.min = Math.max(1, fit * 0.8);
	if (!cam.placed) {
		cam.zoom = Math.max(1.5, fit * 1.2);
		cam.x = (canvas.width - WORLD_W * cam.zoom) / 2;
		cam.y = (canvas.height - WORLD_H * cam.zoom) / 2;
		cam.placed = true;
	}
	clampCam();
}

function clampCam() {
	const w = WORLD_W * cam.zoom, h = WORLD_H * cam.zoom;
	const mx = canvas.width * 0.6, my = canvas.height * 0.6;
	cam.x = Math.min(mx, Math.max(canvas.width - w - mx, cam.x));
	cam.y = Math.min(my, Math.max(canvas.height - h - my, cam.y));
}

function toWorld(clientX, clientY) {
	return [
		(clientX * devicePixelRatio - cam.x) / cam.zoom,
		(clientY * devicePixelRatio - cam.y) / cam.zoom,
	];
}

window.addEventListener('resize', fitCamera);
fitCamera();

// ---------------------------------------------------------------- input
const plaque = document.getElementById('plaque');
let inWall = false;
let pointers = new Map();
let dragged = false;
let pinchDist = 0;

canvas.addEventListener('pointerdown', (e) => {
	canvas.setPointerCapture(e.pointerId);
	pointers.set(e.pointerId, [e.clientX, e.clientY]);
	dragged = false;
	if (pointers.size === 2) {
		const [a, b] = [...pointers.values()];
		pinchDist = Math.hypot(a[0] - b[0], a[1] - b[1]);
	}
	canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (e) => {
	if (!pointers.has(e.pointerId)) return;
	const prev = pointers.get(e.pointerId);
	pointers.set(e.pointerId, [e.clientX, e.clientY]);
	if (pointers.size === 1) {
		const dx = (e.clientX - prev[0]) * devicePixelRatio;
		const dy = (e.clientY - prev[1]) * devicePixelRatio;
		if (Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]) > 1) dragged = true;
		cam.x += dx;
		cam.y += dy;
		clampCam();
	} else if (pointers.size === 2) {
		const [a, b] = [...pointers.values()];
		const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
		if (pinchDist > 0) {
			zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinchDist);
			dragged = true;
		}
		pinchDist = d;
	}
});

function endPointer(e) {
	pointers.delete(e.pointerId);
	canvas.classList.remove('dragging');
	if (pointers.size === 0 && !dragged) handleClick(e);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));

canvas.addEventListener('wheel', (e) => {
	e.preventDefault();
	zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

function zoomAt(cx, cy, factor) {
	const nz = Math.min(cam.max, Math.max(cam.min, cam.zoom * factor));
	const [wx, wy] = toWorld(cx, cy);
	cam.x = cx * devicePixelRatio - wx * nz;
	cam.y = cy * devicePixelRatio - wy * nz;
	cam.zoom = nz;
	clampCam();
}

// ---------------------------------------------------------------- clicks
function handleClick(e) {
	if (inWall) return;
	const [wx, wy] = toWorld(e.clientX, e.clientY);

	// 1) citizens (and critters) first
	const npc = npcs.hitTest(wx, wy, 11);
	if (npc) {
		showBubble(npc.name, npcs.nextLine(npc), e.clientX, e.clientY, npc);
		return;
	}
	const t = performance.now();
	const cp = catPos(t), cw = g2w(cp.u, cp.gy);
	if (Math.hypot(wx - cw[0], wy - (cw[1] - 5)) < 10) {
		showBubble('the cat', ['meow.', 'mrrp?', '...she has places to be.'][Math.floor(Math.random() * 3)], e.clientX, e.clientY);
		return;
	}
	const dp = duckPos(t), dw = g2w(dp.gx, dp.gy);
	if (Math.hypot(wx - dw[0], wy - (dw[1] - 4)) < 10) {
		showBubble('the duck', ['quack.', 'quack quack.', '(she accepts compliments)'][Math.floor(Math.random() * 3)], e.clientX, e.clientY);
		return;
	}

	// 2) buildings — topmost hotspot wins (draw order; later = nearer)
	const hits = town.hotspots.filter((h) => wx >= h.x0 && wx <= h.x1 && wy >= h.y0 && wy <= h.y1);
	const hit = hits[hits.length - 1];
	if (hit) {
		showPlaque(hit, e.clientX, e.clientY);
		return;
	}
	hidePlaque();
	hideBubble();

	// 3) clicking grass plants a flower
	const [gx, gy] = w2g(wx, wy);
	if (town.isPlantable(gx, gy)) town.plantFlower(wx, wy);
}

// ---------------------------------------------------------------- speech bubble
const bubble = document.getElementById('bubble');
const bubbleName = document.getElementById('bubble-name');
const bubbleLine = document.getElementById('bubble-line');
let chattingNpc = null;

function showBubble(name, line, cx, cy, npc) {
	hidePlaque();
	if (chattingNpc && chattingNpc !== npc) chattingNpc.frozen = false;
	chattingNpc = npc || null;
	if (npc) npc.frozen = true;
	bubbleName.textContent = name;
	bubbleLine.textContent = line;
	bubble.hidden = false;
	const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
	bubble.style.left = `${Math.max(8, Math.min(window.innerWidth - bw - 8, cx - bw / 2))}px`;
	bubble.style.top = `${Math.max(8, Math.min(window.innerHeight - bh - 8, cy - bh - 26))}px`;
}
function hideBubble() {
	bubble.hidden = true;
	if (chattingNpc) chattingNpc.frozen = false;
	chattingNpc = null;
}
document.getElementById('bubble-close').addEventListener('click', hideBubble);

const plaqueTitle = document.getElementById('plaque-title');
const plaqueBody = document.getElementById('plaque-body');
const plaqueAction = document.getElementById('plaque-action');
document.getElementById('plaque-close').addEventListener('click', hidePlaque);

function showPlaque(h, cx, cy) {
	hideBubble();
	plaqueTitle.textContent = h.title;
	plaqueBody.textContent = h.body;
	if (h.action) {
		plaqueAction.hidden = false;
		plaqueAction.textContent = h.action.label;
		plaqueAction.onclick = () => {
			hidePlaque();
			if (h.action.kind === 'wall') enterWall();
			else if (h.action.kind === 'link') window.open(h.action.url, '_blank', 'noopener');
		};
	} else {
		plaqueAction.hidden = true;
	}
	plaque.hidden = false;
	const pw = plaque.offsetWidth, ph = plaque.offsetHeight;
	plaque.style.left = `${Math.max(8, Math.min(window.innerWidth - pw - 8, cx - pw / 2))}px`;
	plaque.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, cy - ph - 18))}px`;
}
function hidePlaque() {
	plaque.hidden = true;
}

// ---------------------------------------------------------------- wall mode
const wallMode = initWallMode(wall, () => { inWall = false; });
function enterWall() {
	inWall = true;
	hidePlaque();
	wallMode.open();
}

// double-click the wall building also works via plaque; deep link:
if (location.hash === '#wall') enterWall();

// ---------------------------------------------------------------- render loop
let lastT = 0;
function frame(t) {
	const dt = Math.min(0.05, (t - lastT) / 1000);
	lastT = t;
	npcs.update(dt, t);
	ctx.imageSmoothingEnabled = false;
	// sky
	const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
	sky.addColorStop(0, '#8fd3f4');
	sky.addColorStop(1, '#b8e6f9');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.save();
	ctx.setTransform(cam.zoom, 0, 0, cam.zoom, cam.x, cam.y);
	ctx.drawImage(town.canvas, 0, 0);
	npcs.draw(ctx, t);
	drawDynamic(ctx, town, t, wall.canvas);
	ctx.restore();

	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
