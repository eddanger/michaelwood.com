// main.js — glue: gfx pipeline + static town + living entities + the shared
// graffiti wall, plus pointer input and the HUD overlays.

import { createGfx } from './gfx.js';
import { buildTown } from './town3d.js';
import { createLife } from './life3d.js';
import { tileType, inBuildingZone } from './data.js';
import { createWall, initWallMode } from './wall.js';

const canvas = document.getElementById('town');
const gfx = createGfx(canvas);

const wall = createWall();
const town = buildTown(gfx.scene, wall.canvas);
const life = createLife(gfx, town.anchors, wall);
wall.load(); // fetch shared graffiti in the background

const pickables = [...life.map((e) => e.obj), ...town.pickables];

// ---------------------------------------------------------------- input
let pointers = new Map();
let dragged = false;
let pinchDist = 0;
let inWall = false;

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
		const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
		if (Math.abs(dx) + Math.abs(dy) > 1) dragged = true;
		gfx.panBy(dx, dy);
	} else if (pointers.size === 2) {
		const [a, b] = [...pointers.values()];
		const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
		if (pinchDist > 0) {
			gfx.zoomBy(d / pinchDist, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
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
	gfx.zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
}, { passive: false });

// ---------------------------------------------------------------- clicks
function handleClick(e) {
	if (inWall) return;
	const hit = gfx.pick(e.clientX, e.clientY, pickables);
	if (!hit) {
		hidePlaque();
		hideBubble();
		return;
	}
	if (hit.data.type === 'entity') {
		const r = hit.data.ent.interact();
		if (r) showBubble(r.name, r.line, e.clientX, e.clientY, r.freeze ? hit.data.ent : null);
		return;
	}
	if (hit.data.type === 'building') {
		showPlaque(hit.data.b, e.clientX, e.clientY);
		return;
	}
	// ground: plant a flower on free grass
	hidePlaque();
	hideBubble();
	const gx = Math.floor(hit.point.x), gy = Math.floor(hit.point.z);
	if (tileType(gx, gy) === 0 && !inBuildingZone(gx, gy)) {
		town.addFlower(hit.point.x, hit.point.z);
	}
}

// ---------------------------------------------------------------- bubble
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

// ---------------------------------------------------------------- plaque
const plaque = document.getElementById('plaque');
const plaqueTitle = document.getElementById('plaque-title');
const plaqueBody = document.getElementById('plaque-body');
const plaqueAction = document.getElementById('plaque-action');
document.getElementById('plaque-close').addEventListener('click', hidePlaque);

function showPlaque(b, cx, cy) {
	hideBubble();
	plaqueTitle.textContent = b.title;
	plaqueBody.textContent = b.body;
	if (b.action) {
		plaqueAction.hidden = false;
		plaqueAction.textContent = b.action.label;
		plaqueAction.onclick = () => {
			hidePlaque();
			if (b.action.kind === 'wall') enterWall();
			else if (b.action.kind === 'link') window.open(b.action.url, '_blank', 'noopener');
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
if (location.hash === '#far') {
	gfx.view.span = 40;
	gfx.apply();
}
if (location.hash === '#underground') {
	gfx.view.ty = -16;
	gfx.view.span = 22;
	gfx.apply();
}

// ---------------------------------------------------------------- loop
let lastT = 0;
function frame(t) {
	const dt = Math.min(0.05, (t - lastT) / 1000);
	lastT = t;
	for (const e of life) e.update(dt, t);
	gfx.renderer.render(gfx.scene, gfx.camera);
	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
