// main.js — Woodtown v5: isometric woods, physical logs & tools, piles.

import {
	createWorld,
	tryMove,
	tryUse,
	tryPickup,
	tryDrop,
	tryChop,
	tryDelimb,
	countLivingTrees,
	countGroundLogs,
	countCleanLogs,
	findChopTarget,
	findNearestItem,
	handsIsTool,
} from './world.js';
import { createRenderer } from './render.js';

const canvas = document.getElementById('forest');
const handsEl = document.getElementById('hands-label');
const treesEl = document.getElementById('tree-count');
const logsEl = document.getElementById('log-count');
const toastEl = document.getElementById('toast');

if (!canvas) {
	document.body.innerHTML = '<p style="font-family:monospace;padding:2rem">Missing #forest canvas. Serve with <code>bun run dev</code>.</p>';
	throw new Error('no #forest canvas');
}

const world = createWorld(42);
const renderer = createRenderer(canvas);

const keys = new Set();
let moveCooldown = 0;
let actionCooldown = 0;
let toastTimer = 0;

function toast(msg, ms = 2400) {
	if (!toastEl) return;
	toastEl.textContent = msg;
	toastEl.hidden = false;
	toastEl.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		toastEl.classList.remove('show');
		setTimeout(() => { toastEl.hidden = true; }, 250);
	}, ms);
}

function handsLabel(h) {
	if (!h) return 'empty hands';
	if (h.type === 'tool') return h.tool;
	if (h.type === 'log') {
		const b = h.branched ? ' + branches' : ' (clean)';
		return `log${b}`;
	}
	return '?';
}

function refreshHud() {
	if (handsEl) handsEl.textContent = handsLabel(world.player.hands);
	if (treesEl) treesEl.textContent = String(countLivingTrees(world));
	if (logsEl) {
		const total = countGroundLogs(world);
		const clean = countCleanLogs(world);
		logsEl.textContent = clean ? `${total} (${clean} clean)` : String(total);
	}
}

function doUse() {
	if (actionCooldown > 0) return;
	actionCooldown = 0.18;
	const r = tryUse(world);
	const ev = world.lastEvent?.type;
	if (r.ok && ev === 'chop') {
		renderer.addChopParticles(r.x, r.y, r.size || 1);
		toast(r.removed ? 'tree down · branched log on the ground' : `chop · ${r.hp}/${r.maxHp}`);
	} else if (r.ok && ev === 'delimb') {
		toast('sawed off branches · clean log');
	} else if (r.ok && ev === 'drop') {
		if (r.merged) toast(`stacked on pile (${r.count})`);
		else if (r.tool) toast(`${r.tool} on the ground`);
		else toast('log set down');
	} else if (!r.ok) {
		const msgs = {
			need_axe: 'need axe in hands (G grab · Q drop)',
			need_saw: 'need saw — grab it (G), leave axe on the ground',
			no_tree: 'face a tree (axe)',
			no_branched_log: 'face a branched log (saw)',
			empty_hands: 'hands empty — G to grab',
			nothing_near: 'nothing nearby',
			hands_full: 'hands full — Q to put down first',
		};
		if (msgs[r.reason]) toast(msgs[r.reason]);
	}
	refreshHud();
}

function doPickup() {
	if (actionCooldown > 0) return;
	actionCooldown = 0.15;
	const r = tryPickup(world);
	if (r.ok) {
		const h = r.hands;
		if (h?.type === 'tool') toast(r.swapped ? `swapped · now holding ${h.tool}` : `picked up ${h.tool}`);
		else if (h?.type === 'log') toast(h.branched ? 'carrying branched log' : 'carrying clean log');
		else toast('picked up');
	} else {
		const msgs = {
			nothing_near: 'nothing nearby',
			hands_full: 'drop what you\'re holding first (Q)',
		};
		toast(msgs[r.reason] || 'can\'t grab that');
	}
	refreshHud();
}

function doDrop() {
	if (actionCooldown > 0) return;
	actionCooldown = 0.15;
	const r = tryDrop(world);
	if (r.ok) {
		if (r.merged) toast(`into the pile (${r.count})`);
		else if (r.tool) toast(`left ${r.tool} on the ground`);
		else toast('log set down');
	} else if (r.reason === 'empty_hands') {
		toast('hands empty');
	}
	refreshHud();
}

function handleKey(e, down) {
	const k = e.key.toLowerCase();
	const block = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'enter', 'g', 'q', 'e', 'f'];
	if (block.includes(k) || e.code === 'Space') e.preventDefault();
	if (down) keys.add(k);
	else keys.delete(k);

	if (!down) return;
	if (k === ' ' || e.code === 'Space' || k === 'enter' || k === 'e' || k === 'f') doUse();
	if (k === 'g') doPickup();
	if (k === 'q') doDrop();
}

window.addEventListener('keydown', (e) => handleKey(e, true));
window.addEventListener('keyup', (e) => handleKey(e, false));

// pointer: face world point; smart action
canvas.addEventListener('pointerdown', (e) => {
	const rect = canvas.getBoundingClientRect();
	const scaleX = renderer.state.bw / rect.width;
	const scaleY = renderer.state.bh / rect.height;
	const bx = (e.clientX - rect.left) * scaleX;
	const by = (e.clientY - rect.top) * scaleY;
	const wpt = renderer.fromBuf(bx, by);

	const dx = wpt.x - (world.player.x + 0.5);
	const dy = wpt.y - (world.player.y + 0.5);
	if (Math.abs(dx) + Math.abs(dy) > 0.15) {
		if (Math.abs(dx) >= Math.abs(dy)) world.player.facing = dx > 0 ? 'e' : 'w';
		else world.player.facing = dy > 0 ? 's' : 'n';
	}

	// holding log → drop at click (merge into pile if near)
	if (world.player.hands?.type === 'log') {
		actionCooldown = 0;
		const r = tryDrop(world, wpt.x, wpt.y);
		if (r.ok) {
			toast(r.merged ? `stacked (${r.count})` : 'log placed');
			refreshHud();
		}
		return;
	}

	// near item → grab
	const near = findNearestItem(world, 1.2);
	if (near && Math.hypot(near.x - (world.player.x + 0.5), near.y - (world.player.y + 0.5)) < 1.35) {
		doPickup();
		return;
	}

	// axe + tree → chop; saw + log → delimb; else step
	if (handsIsTool(world, 'axe') && findChopTarget(world)) {
		doUse();
		return;
	}
	if (handsIsTool(world, 'saw')) {
		doUse();
		return;
	}

	tryMove(world, Math.sign(Math.round(dx)) || 0, Math.sign(Math.round(dy)) || 0);
	refreshHud();
});

refreshHud();
toast('chop trees → logs stay on the ground · G grab · Q drop/pile · saw trims branches', 4200);

let last = performance.now();
function frame(now) {
	const dt = Math.min(0.05, (now - last) / 1000);
	last = now;
	moveCooldown -= dt;
	actionCooldown -= dt;

	if (moveCooldown <= 0) {
		let dx = 0;
		let dy = 0;
		if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
		if (keys.has('arrowright') || keys.has('d')) dx += 1;
		if (keys.has('arrowup') || keys.has('w')) dy -= 1;
		if (keys.has('arrowdown') || keys.has('s')) dy += 1;
		if (dx || dy) {
			tryMove(world, dx, dy);
			moveCooldown = 0.055; // snappy tile steps
		}
	}

	renderer.draw(world, dt);
	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__woodtownV5 = {
	world,
	tryChop,
	tryDelimb,
	tryUse,
	tryPickup,
	tryDrop,
	tryMove,
	refreshHud,
};
