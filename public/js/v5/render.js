// render.js — fast isometric pixel forest.
// Ground baked once; trees sprite-cached; cull by SCREEN bounds (not a world box).
// Draw order: behind player → player → in-front trees ghosted so Mike stays visible.

import { hash2 } from './world.js';
import { worldToScreen, screenToWorld, depthKey, ISO_HW, ISO_HH } from './iso.js';
import { drawIsoTile, drawTree, drawPlayer, drawLog, drawTool, drawPile, px } from './sprites.js';

const TREE_PAD = 40;

function treeCacheKey(tree) {
	const dmg = tree.kind === 'stump' || tree.maxHp <= 0
		? 0
		: Math.min(3, Math.floor((1 - tree.hp / Math.max(1, tree.maxHp)) * 4));
	const sz = Math.round((tree.size || 1) * 4);
	const seed = (tree.seed || 0) & 7;
	return `${tree.kind}|${sz}|${dmg}|${seed}`;
}

function makeTreeSprite(tree) {
	const size = tree.size || 1;
	const damaged = tree.kind === 'stump' || tree.maxHp <= 0
		? 0
		: 1 - tree.hp / Math.max(1, tree.maxHp);
	const qTree = { ...tree, size: Math.round(size * 4) / 4 };
	const w = Math.ceil(28 + size * 28);
	const h = Math.ceil(24 + size * 36 + TREE_PAD);
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const cg = c.getContext('2d');
	cg.imageSmoothingEnabled = false;
	const footX = (w / 2) | 0;
	const footY = h - 4;
	drawTree(cg, qTree, footX, footY, qTree.kind === 'stump' ? 0 : damaged);
	return { canvas: c, ox: footX, oy: footY, w, h };
}

function bakeGround(world) {
	const pad = ISO_HW * 2;
	const originX = world.h * ISO_HW + pad;
	const originY = pad;
	const mapW = (world.w + world.h) * ISO_HW + pad * 2;
	const mapH = (world.w + world.h) * ISO_HH + pad * 2;
	const c = document.createElement('canvas');
	c.width = mapW;
	c.height = mapH;
	const cg = c.getContext('2d');
	cg.imageSmoothingEnabled = false;
	cg.fillStyle = '#5a9a38';
	cg.fillRect(0, 0, mapW, mapH);

	for (let ty = 0; ty < world.h; ty++) {
		for (let tx = 0; tx < world.w; tx++) {
			const p = worldToScreen(tx + 0.5, ty + 0.5);
			const v = (hash2(tx, ty, world.seed) * 100) | 0;
			drawIsoTile(cg, originX + p.x, originY + p.y, v);
		}
	}
	return { canvas: c, originX, originY };
}

export function createRenderer(canvas) {
	// alpha:true so ghosted trees blend correctly over the player
	const buffer = document.createElement('canvas');
	const g = buffer.getContext('2d', { alpha: false });
	const screen = canvas.getContext('2d', { alpha: false });
	g.imageSmoothingEnabled = false;
	screen.imageSmoothingEnabled = false;

	const treeCache = new Map();
	let ground = null;
	let groundSeed = null;

	const state = {
		buffer,
		g,
		screen,
		canvas,
		bw: 240,
		bh: 140,
		camWX: 24,
		camWY: 18,
		shake: 0,
		chopSwing: 0,
		particles: [],
		behind: [],
		front: [],
		itemsBehind: [],
		itemsFront: [],
	};

	function ensureGround(world) {
		if (!ground || groundSeed !== world.seed || ground.w !== world.w) {
			ground = bakeGround(world);
			ground.w = world.w;
			groundSeed = world.seed;
			treeCache.clear();
		}
	}

	function getTreeSprite(tree) {
		const key = treeCacheKey(tree);
		let spr = treeCache.get(key);
		if (!spr) {
			spr = makeTreeSprite(tree);
			treeCache.set(key, spr);
			if (treeCache.size > 200) {
				treeCache.delete(treeCache.keys().next().value);
			}
		}
		return spr;
	}

	function resize() {
		const cssW = canvas.clientWidth || window.innerWidth;
		const cssH = canvas.clientHeight || window.innerHeight;
		state.bw = Math.max(160, Math.min(360, (cssW / 4.5) | 0));
		state.bh = Math.max(100, Math.min(220, (cssH / 4.5) | 0));
		state.bw -= state.bw & 1;
		state.bh -= state.bh & 1;
		buffer.width = state.bw;
		buffer.height = state.bh;
		canvas.width = state.bw;
		canvas.height = state.bh;
		g.imageSmoothingEnabled = false;
		screen.imageSmoothingEnabled = false;
	}

	function follow(world) {
		const tx = world.player.x + 0.5;
		const ty = world.player.y + 0.5;
		state.camWX += (tx - state.camWX) * 0.45;
		state.camWY += (ty - state.camWY) * 0.45;
	}

	function toBuf(wx, wy, camX, camY) {
		const p = worldToScreen(wx, wy);
		return {
			x: (p.x - camX + state.bw * 0.5) | 0,
			y: (p.y - camY + state.bh * 0.5) | 0,
		};
	}

	function fromBuf(bx, by) {
		const cam = worldToScreen(state.camWX, state.camWY);
		return screenToWorld(
			bx - state.bw * 0.5 + cam.x,
			by - state.bh * 0.5 + cam.y
		);
	}

	function addChopParticles(wx, wy, size = 1) {
		const n = 4 + ((size * 2) | 0);
		for (let i = 0; i < n; i++) {
			state.particles.push({
				wx: wx + (Math.random() - 0.5) * 0.25,
				wy: wy + (Math.random() - 0.5) * 0.25,
				vx: (Math.random() - 0.5) * 1.4,
				vy: (Math.random() - 0.5) * 1.4,
				vz: 0.9 + Math.random(),
				life: 0.25 + Math.random() * 0.2,
				c: Math.random() > 0.45 ? '#8a5a33' : '#2e7d32',
			});
		}
		state.shake = 0.12;
		state.chopSwing = 1;
	}

	function draw(world, dt) {
		if (state.chopSwing > 0) state.chopSwing = Math.max(0, state.chopSwing - dt * 5);
		if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.4);

		ensureGround(world);
		follow(world);

		const shakeX = state.shake > 0 ? ((Math.random() - 0.5) * 3) | 0 : 0;
		const shakeY = state.shake > 0 ? ((Math.random() - 0.5) * 2) | 0 : 0;

		const cam = worldToScreen(state.camWX, state.camWY);
		const camX = cam.x;
		const camY = cam.y;
		const bw = state.bw;
		const bh = state.bh;

		// ground
		const gx = (ground.originX + camX - bw * 0.5 - shakeX) | 0;
		const gy = (ground.originY + camY - bh * 0.5 - shakeY) | 0;
		g.fillStyle = '#7ec8f0';
		g.fillRect(0, 0, bw, bh);
		g.drawImage(ground.canvas, gx, gy, bw, bh, 0, 0, bw, bh);

		const pwx = world.player.x + 0.5;
		const pwy = world.player.y + 0.5;
		const playerDepth = pwx + pwy; // same as depthKey without bias
		const ps = toBuf(pwx, pwy, camX, camY);
		const psx = ps.x + shakeX;
		const psy = ps.y + shakeY;

		// Screen-space cull pads — tall canopies need lots of top headroom.
		// This is the whole frame, not a world-axis box (iso diamond).
		const padL = 80;
		const padR = 80;
		const padT = 120; // canopy above foot
		const padB = 40;

		const behind = state.behind;
		const front = state.front;
		const itemsBehind = state.itemsBehind;
		const itemsFront = state.itemsFront;
		behind.length = 0;
		front.length = 0;
		itemsBehind.length = 0;
		itemsFront.length = 0;

		// ── trees: project → screen cull → split behind/front ─────────
		const trees = world.trees;
		for (let i = 0; i < trees.length; i++) {
			const t = trees[i];
			const wx = t.x + (t.ox || 0);
			const wy = t.y + (t.oy || 0);
			const p = worldToScreen(wx, wy);
			const sx = (p.x - camX + bw * 0.5) | 0;
			const sy = (p.y - camY + bh * 0.5) | 0;
			// rough size for cull (don't need sprite yet)
			const sz = t.size || 1;
			const halfW = (14 + sz * 14) | 0;
			const tall = (20 + sz * 36) | 0;
			if (sx + halfW < -padL || sx - halfW > bw + padR) continue;
			if (sy + 8 < -padB || sy - tall > bh + padT) continue;

			const depth = wx + wy + sz * 0.01;
			const entry = { t, wx, wy, sx: sx + shakeX, sy: sy + shakeY, depth };
			if (depth <= playerDepth + 0.02) behind.push(entry);
			else front.push(entry);
		}

		// ── ground items ──────────────────────────────────────────────
		const items = world.items;
		if (items) {
			for (let i = 0; i < items.length; i++) {
				const it = items[i];
				const p = worldToScreen(it.x, it.y);
				const sx = (p.x - camX + bw * 0.5 + shakeX) | 0;
				const sy = (p.y - camY + bh * 0.5 + shakeY) | 0;
				if (sx < -40 || sx > bw + 40 || sy < -40 || sy > bh + 40) continue;
				const depth = it.x + it.y;
				const entry = { it, sx, sy, depth };
				if (depth <= playerDepth) itemsBehind.push(entry);
				else itemsFront.push(entry);
			}
		}

		behind.sort((a, b) => a.depth - b.depth);
		front.sort((a, b) => a.depth - b.depth);
		itemsBehind.sort((a, b) => a.depth - b.depth);
		itemsFront.sort((a, b) => a.depth - b.depth);

		// PASS 1 — solid trees behind player
		g.globalAlpha = 1;
		for (let i = 0; i < behind.length; i++) {
			const e = behind[i];
			const spr = getTreeSprite(e.t);
			g.drawImage(spr.canvas, e.sx - spr.ox, e.sy - spr.oy);
		}
		for (let i = 0; i < itemsBehind.length; i++) {
			const e = itemsBehind[i];
			const it = e.it;
			if (it.type === 'log') drawLog(g, e.sx, e.sy, it);
			else if (it.type === 'tool') drawTool(g, e.sx, e.sy, it.tool);
			else if (it.type === 'pile') drawPile(g, e.sx, e.sy, it);
		}

		// PASS 2 — player always fully opaque on top of everything behind
		g.globalAlpha = 1;
		g.fillStyle = 'rgba(27,42,74,0.65)';
		g.fillRect(psx - 7, psy - 21, 15, 24);
		drawPlayer(g, psx, psy, world.player.facing, state.chopSwing, world.player.hands);
		g.fillStyle = '#ffd43b';
		g.fillRect(psx - 3, psy + 1, 7, 2);

		// PASS 3 — trees/items in front, ghosted so you still see Mike
		// Stronger transparency: 0.22 so character reads through dense canopy
		g.globalAlpha = 0.22;
		for (let i = 0; i < front.length; i++) {
			const e = front[i];
			const spr = getTreeSprite(e.t);
			g.drawImage(spr.canvas, e.sx - spr.ox, e.sy - spr.oy);
		}
		g.globalAlpha = 0.45; // items a bit more solid than foliage
		for (let i = 0; i < itemsFront.length; i++) {
			const e = itemsFront[i];
			const it = e.it;
			if (it.type === 'log') drawLog(g, e.sx, e.sy, it);
			else if (it.type === 'tool') drawTool(g, e.sx, e.sy, it.tool);
			else if (it.type === 'pile') drawPile(g, e.sx, e.sy, it);
		}
		g.globalAlpha = 1;

		// particles
		const parts = state.particles;
		for (let i = parts.length - 1; i >= 0; i--) {
			const p = parts[i];
			p.life -= dt;
			if (p.life <= 0) {
				parts.splice(i, 1);
				continue;
			}
			p.wx += p.vx * dt;
			p.wy += p.vy * dt;
			p.vz -= 4 * dt;
			const sp = toBuf(p.wx, p.wy, camX, camY);
			px(g, sp.x + shakeX, sp.y + shakeY - ((p.vz * 8) | 0), p.c);
		}

		screen.imageSmoothingEnabled = false;
		screen.drawImage(buffer, 0, 0);
	}

	resize();
	window.addEventListener('resize', resize);

	return {
		resize,
		draw,
		follow,
		addChopParticles,
		fromBuf,
		toBuf: (wx, wy) => {
			const cam = worldToScreen(state.camWX, state.camWY);
			return toBuf(wx, wy, cam.x, cam.y);
		},
		state,
		get camX() { return 0; },
		get camY() { return 0; },
	};
}
