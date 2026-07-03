// main.js — camera, input, HUD and the loop stitching world + entities + wall.

import { WORLD_W, WORLD_H, SURFACE_H, w2g } from './iso.js';
import { createWorld } from './world.js';
import { createEntities } from './entities.js';
import { createWall, initWallMode } from './wall.js';

const canvas = document.getElementById('town');
const ctx = canvas.getContext('2d');

const world = createWorld();
const wall = createWall();
const entities = createEntities(world, wall.canvas);
wall.load(); // fetch shared graffiti in the background

// ---------------------------------------------------------------- camera
const cam = { zoom: 2.5, x: 0, y: 0, min: 1.2, max: 8 };

function fitCamera() {
	canvas.width = window.innerWidth * devicePixelRatio;
	canvas.height = window.innerHeight * devicePixelRatio;
	// frame the surface town by default; the underground is there to discover
	const fit = Math.min(canvas.width / WORLD_W, canvas.height / (SURFACE_H + 40));
	cam.min = Math.min(canvas.width / WORLD_W, canvas.height / WORLD_H) * 0.85;
	if (!cam.placed) {
		cam.zoom = Math.max(1.4, fit * 1.15);
		cam.x = (canvas.width - WORLD_W * cam.zoom) / 2;
		cam.y = (canvas.height - SURFACE_H * cam.zoom) / 2;
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

	// 1) entities (citizens, cat, cars, boat, ducks, balloon…)
	for (const ent of entities) {
		if (!ent.hit(wx, wy)) continue;
		const r = ent.interact();
		if (r) {
			showBubble(r.name, r.line, e.clientX, e.clientY, r.freeze ? ent : null);
			return;
		}
	}

	// 2) buildings — topmost hotspot wins (draw order; later = nearer)
	const hits = world.hotspots.filter((h) => wx >= h.x0 && wx <= h.x1 && wy >= h.y0 && wy <= h.y1);
	const hit = hits[hits.length - 1];
	if (hit) {
		showPlaque(hit, e.clientX, e.clientY);
		return;
	}
	hidePlaque();
	hideBubble();

	// 3) clicking grass plants a flower
	const [gx, gy] = w2g(wx, wy);
	if (world.isPlantable(gx, gy)) world.plantFlower(wx, wy);
}

// ---------------------------------------------------------------- speech bubble
const bubble = document.getElementById('bubble');
const bubbleName = document.getElementById('bubble-name');
const bubbleLine = document.getElementById('bubble-line');
let chattingEnt = null;

function showBubble(name, line, cx, cy, ent) {
	hidePlaque();
	if (chattingEnt && chattingEnt !== ent) chattingEnt.frozen = false;
	chattingEnt = ent || null;
	if (ent) ent.frozen = true;
	bubbleName.textContent = name;
	bubbleLine.textContent = line;
	bubble.hidden = false;
	const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
	bubble.style.left = `${Math.max(8, Math.min(window.innerWidth - bw - 8, cx - bw / 2))}px`;
	bubble.style.top = `${Math.max(8, Math.min(window.innerHeight - bh - 8, cy - bh - 26))}px`;
}
function hideBubble() {
	bubble.hidden = true;
	if (chattingEnt) chattingEnt.frozen = false;
	chattingEnt = null;
}
document.getElementById('bubble-close').addEventListener('click', hideBubble);

// ---------------------------------------------------------------- plaques
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
	hideBubble();
	wallMode.open();
}

if (location.hash === '#wall') enterWall();
// deep link straight to the dinosaur bones & co.
if (location.hash === '#underground') {
	cam.zoom = Math.max(cam.min, canvas.width / WORLD_W);
	cam.x = (canvas.width - WORLD_W * cam.zoom) / 2;
	cam.y = canvas.height - WORLD_H * cam.zoom - 20;
	clampCam();
}

// ---------------------------------------------------------------- render loop
let lastT = 0;
function frame(t) {
	const dt = Math.min(0.05, (t - lastT) / 1000);
	lastT = t;
	for (const ent of entities) ent.update(dt, t);

	ctx.imageSmoothingEnabled = false;
	const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
	sky.addColorStop(0, '#8fd3f4');
	sky.addColorStop(1, '#b8e6f9');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.save();
	ctx.setTransform(cam.zoom, 0, 0, cam.zoom, cam.x, cam.y);
	ctx.drawImage(world.canvas, 0, 0);
	for (const ent of entities) ent.draw(ctx, t);
	ctx.restore();

	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
