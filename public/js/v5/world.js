// world.js — pure simulation for Woodtown v5.
// Physical ground economy: trees → logs (with branches), tools on ground,
// one thing in hands, piles for organizing. No abstract wood inventory.
// Future hooks: mill boards/planks from clean logs.

export const W = 48;
export const H = 36;

export const TOOLS = ['axe', 'saw']; // hands can hold one tool at a time
export const TREE_KINDS = ['pine', 'oak', 'birch', 'bush'];
const KIND_BASE_HP = { pine: 3, oak: 4, birch: 2, bush: 1 };

export function hash2(x, y, seed = 1) {
	let n = ((x * 374761393) + (y * 668265263) + (seed * 1274126177)) | 0;
	n = (n ^ (n >>> 13)) * 1274126177;
	return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function nextId(world) {
	return world.nextId++;
}

// ─── factories ───────────────────────────────────────────────────────────

export function makeTree(x, y, seed, id = 0) {
	const hx = Math.floor(x * 17);
	const hy = Math.floor(y * 19);
	const rKind = hash2(hx, hy, seed + 7);
	const rSize = hash2(hx + 3, hy + 5, seed + 11);
	const rVar = hash2(hx + 9, hy + 2, seed + 13);

	let kind = TREE_KINDS[Math.floor(rKind * TREE_KINDS.length) % TREE_KINDS.length];
	let size;
	if (rSize < 0.28) size = 0.4 + rSize * 0.9;
	else if (rSize < 0.72) size = 0.7 + (rSize - 0.28) * 1.4;
	else if (rSize < 0.92) size = 1.35 + (rSize - 0.72) * 2.5;
	else size = 1.9 + (rSize - 0.92) * 7.5;

	if (kind === 'bush') size = Math.min(size, 0.75);
	if (size > 1.7 && kind !== 'oak' && kind !== 'pine') kind = rVar > 0.5 ? 'oak' : 'pine';
	if (size < 0.55 && kind === 'oak') kind = 'bush';

	const base = KIND_BASE_HP[kind] || 2;
	const maxHp = Math.max(1, Math.round(base * size * size * 1.15));

	return {
		id,
		x,
		y,
		kind,
		size: Math.round(size * 100) / 100,
		hp: maxHp,
		maxHp,
		seed: Math.floor(rVar * 1e6),
		ox: (hash2(hx, hy, seed + 21) - 0.5) * 0.35,
		oy: (hash2(hx, hy, seed + 22) - 0.5) * 0.25,
	};
}

/** Fallen tree on the ground — still has branches until sawed. */
export function makeLog(world, x, y, { woodKind = 'oak', size = 1, branched = true } = {}) {
	return {
		id: nextId(world),
		type: 'log',
		x,
		y,
		woodKind,
		size: Math.round(size * 100) / 100,
		branched: !!branched,
	};
}

export function makeToolItem(world, x, y, tool) {
	return {
		id: nextId(world),
		type: 'tool',
		tool,
		x,
		y,
	};
}

export function makePile(world, x, y, stack = []) {
	return {
		id: nextId(world),
		type: 'pile',
		x,
		y,
		stack: stack.map(cloneStackItem),
	};
}

/** Stack entry: no world position (lives in pile or hands). */
export function cloneStackItem(item) {
	if (item.type === 'tool') return { type: 'tool', tool: item.tool };
	if (item.type === 'log') {
		return {
			type: 'log',
			woodKind: item.woodKind,
			size: item.size,
			branched: !!item.branched,
		};
	}
	return { ...item };
}

export function logFromTree(world, tree) {
	// bushes are scrubby; still a "log" with branches for the loop
	return makeLog(world, tree.x + (tree.ox || 0), tree.y + (tree.oy || 0), {
		woodKind: tree.kind === 'bush' ? 'oak' : tree.kind,
		size: tree.size,
		branched: true,
	});
}

// ─── world create ────────────────────────────────────────────────────────

export function createWorld(seed = 42) {
	const cx = Math.floor(W / 2);
	const cy = Math.floor(H / 2);
	const trees = [];
	let id = 0;

	const step = 0.42;
	for (let y = 0.3; y < H - 0.3; y += step) {
		for (let x = 0.3; x < W - 0.3; x += step) {
			const jx = x + (hash2(Math.floor(x * 10), Math.floor(y * 10), seed) - 0.5) * step;
			const jy = y + (hash2(Math.floor(x * 10) + 1, Math.floor(y * 10), seed + 3) - 0.5) * step;
			const dist = Math.hypot(jx - cx, jy - cy);
			if (dist < 2.4) continue;

			const density = hash2(Math.floor(jx * 8), Math.floor(jy * 8), seed + 5);
			const thresh = dist < 4 ? 0.62 : 0.48;
			if (density > thresh) continue;

			trees.push(makeTree(jx, jy, seed, id++));

			if (hash2(Math.floor(jx * 12), Math.floor(jy * 12), seed + 9) > 0.78) {
				const ux = jx + (hash2(id, 1, seed) - 0.5) * 0.55;
				const uy = jy + (hash2(id, 2, seed) - 0.5) * 0.55;
				if (Math.hypot(ux - cx, uy - cy) >= 2.4) {
					const under = makeTree(ux, uy, seed + 99, id++);
					under.size = Math.min(under.size, 0.7);
					under.maxHp = Math.max(1, Math.round(under.maxHp * 0.45));
					under.hp = under.maxHp;
					if (under.size < 0.6) under.kind = 'bush';
					trees.push(under);
				}
			}
		}
	}

	for (let g = 0; g < 14; g++) {
		const gx = 3 + hash2(g, 1, seed + 40) * (W - 6);
		const gy = 3 + hash2(g, 2, seed + 41) * (H - 6);
		if (Math.hypot(gx - cx, gy - cy) < 6) continue;
		const giant = makeTree(gx, gy, seed + 200 + g, id++);
		giant.size = 2.1 + hash2(g, 3, seed) * 0.4;
		giant.kind = hash2(g, 4, seed) > 0.5 ? 'oak' : 'pine';
		giant.maxHp = Math.max(8, Math.round(KIND_BASE_HP[giant.kind] * giant.size * giant.size * 1.2));
		giant.hp = giant.maxHp;
		trees.push(giant);
	}

	const world = {
		seed,
		w: W,
		h: H,
		nextId: id + 100,
		trees,
		// everything on the forest floor (tools, logs, piles)
		items: [],
		player: {
			x: cx,
			y: cy,
			facing: 's',
			name: 'Mike',
			// hands: null | { type:'tool', tool } | { type:'log', woodKind, size, branched }
			hands: { type: 'tool', tool: 'axe' },
		},
		lastEvent: null,
	};

	// spare saw on the ground in the clearing — leave tools around, don't pocket them all
	world.items.push(makeToolItem(world, cx + 1.2, cy - 0.4, 'saw'));

	return world;
}

// ─── spatial helpers ─────────────────────────────────────────────────────

export function inBounds(world, x, y) {
	return x >= 0 && y >= 0 && x < world.w && y < world.h;
}

export function trunkRadius(tree) {
	if (!tree || tree.kind === 'stump' || tree.hp <= 0) return 0;
	return 0.28 + tree.size * 0.2;
}

export function isLiving(tree) {
	return !!(tree && tree.kind !== 'stump' && tree.hp > 0);
}

export function isBlocking(world, x, y) {
	if (!inBounds(world, x, y)) return true;
	const cx = x + 0.5;
	const cy = y + 0.5;
	for (const t of world.trees) {
		if (!isLiving(t)) continue;
		const r = trunkRadius(t);
		const dx = (t.x + t.ox) - cx;
		const dy = (t.y + t.oy) - cy;
		if (dx * dx + dy * dy < r * r) return true;
	}
	return false;
}

const FACING_DELTA = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
export function facingDelta(facing) {
	return FACING_DELTA[facing] || FACING_DELTA.s;
}

export function playerCenter(world) {
	return { x: world.player.x + 0.5, y: world.player.y + 0.5 };
}

function dist2(ax, ay, bx, by) {
	const dx = ax - bx;
	const dy = ay - by;
	return dx * dx + dy * dy;
}

/** Nearest living tree in facing cone. */
export function findChopTarget(world) {
	const p = world.player;
	const [fx, fy] = facingDelta(p.facing);
	const { x: originX, y: originY } = playerCenter(world);
	const reach = 1.55;
	let best = null;
	let bestScore = Infinity;

	for (const t of world.trees) {
		if (!isLiving(t)) continue;
		const tx = t.x + t.ox;
		const ty = t.y + t.oy;
		const dx = tx - originX;
		const dy = ty - originY;
		const dist = Math.hypot(dx, dy);
		if (dist > reach + trunkRadius(t)) continue;
		const along = dx * fx + dy * fy;
		if (along < -0.15) continue;
		const lateral = Math.abs(dx * fy - dy * fx);
		const score = dist + lateral * 0.55 - along * 0.1;
		if (score < bestScore) {
			bestScore = score;
			best = t;
		}
	}
	return best;
}

/** Nearest ground item within radius of player (or facing point). */
export function findNearestItem(world, radius = 1.35) {
	const { x, y } = playerCenter(world);
	let best = null;
	let bestD = radius;
	for (const it of world.items) {
		const d = Math.hypot(it.x - x, it.y - y);
		if (d < bestD) {
			bestD = d;
			best = it;
		}
	}
	return best;
}

/** Nearest log or pile that can accept a log (for merge on drop). */
export function findLogDropTarget(world, x, y, radius = 0.85, excludeId = null) {
	let best = null;
	let bestD = radius;
	for (const it of world.items) {
		if (excludeId != null && it.id === excludeId) continue;
		if (it.type !== 'log' && it.type !== 'pile') continue;
		const d = Math.hypot(it.x - x, it.y - y);
		if (d < bestD) {
			bestD = d;
			best = it;
		}
	}
	return best;
}

export function handsIsTool(world, tool) {
	const h = world.player.hands;
	return !!(h && h.type === 'tool' && h.tool === tool);
}

export function handsFree(world) {
	return world.player.hands == null;
}

// ─── movement ────────────────────────────────────────────────────────────

export function tryMove(world, dx, dy) {
	const p = world.player;
	if (dx === 0 && dy === 0) return { moved: false, blocked: false };

	if (Math.abs(dx) >= Math.abs(dy)) p.facing = dx > 0 ? 'e' : 'w';
	else p.facing = dy > 0 ? 's' : 'n';

	const sx = dx === 0 ? 0 : dx > 0 ? 1 : -1;
	const sy = dy === 0 ? 0 : dy > 0 ? 1 : -1;

	let nx = p.x;
	let ny = p.y;
	if (sx !== 0 && sy !== 0) {
		if (Math.abs(dx) >= Math.abs(dy)) {
			nx = p.x + sx;
			ny = p.y;
			if (isBlocking(world, nx, ny)) {
				nx = p.x;
				ny = p.y + sy;
			}
		} else {
			nx = p.x;
			ny = p.y + sy;
			if (isBlocking(world, nx, ny)) {
				nx = p.x + sx;
				ny = p.y;
			}
		}
	} else {
		nx = p.x + sx;
		ny = p.y + sy;
	}

	if (!inBounds(world, nx, ny) || isBlocking(world, nx, ny)) {
		world.lastEvent = { type: 'bump' };
		return { moved: false, blocked: true };
	}

	p.x = nx;
	p.y = ny;
	world.lastEvent = { type: 'move', x: nx, y: ny };
	return { moved: true, blocked: false };
}

// ─── axe: chop tree → stump + ground log (branched) ──────────────────────

export function tryChop(world) {
	if (!handsIsTool(world, 'axe')) {
		const r = { ok: false, reason: 'need_axe' };
		world.lastEvent = { type: 'chop_miss', ...r };
		return r;
	}

	const tree = findChopTarget(world);
	if (!tree) {
		const r = { ok: false, reason: 'no_tree' };
		world.lastEvent = { type: 'chop_miss', ...r };
		return r;
	}

	tree.hp -= 1;
	let removed = false;
	let log = null;

	if (tree.hp <= 0) {
		tree.kind = 'stump';
		tree.hp = 0;
		removed = true;
		// physical log on the ground — NOT inventory
		log = logFromTree(world, tree);
		world.items.push(log);
	}

	const r = {
		ok: true,
		x: tree.x,
		y: tree.y,
		treeId: tree.id,
		hp: tree.hp,
		maxHp: tree.maxHp,
		size: tree.size,
		removed,
		logId: log?.id ?? null,
		kind: tree.kind,
	};
	world.lastEvent = { type: 'chop', ...r };
	return r;
}

// ─── saw: trim branches off a log ────────────────────────────────────────

export function findDelimbTarget(world) {
	const p = world.player;
	const [fx, fy] = facingDelta(p.facing);
	const { x: ox, y: oy } = playerCenter(world);
	let best = null;
	let bestScore = Infinity;

	for (const it of world.items) {
		if (it.type === 'log' && it.branched) {
			const dx = it.x - ox;
			const dy = it.y - oy;
			const dist = Math.hypot(dx, dy);
			if (dist > 1.5) continue;
			const along = dx * fx + dy * fy;
			if (along < -0.2) continue;
			const score = dist + Math.abs(dx * fy - dy * fx) * 0.5;
			if (score < bestScore) {
				bestScore = score;
				best = it;
			}
		}
		// branched log inside a pile? delimb top branched log in adjacent pile
		if (it.type === 'pile') {
			const dx = it.x - ox;
			const dy = it.y - oy;
			const dist = Math.hypot(dx, dy);
			if (dist > 1.5) continue;
			const along = dx * fx + dy * fy;
			if (along < -0.2) continue;
			const idx = it.stack.findIndex((s) => s.type === 'log' && s.branched);
			if (idx < 0) continue;
			const score = dist + 0.05;
			if (score < bestScore) {
				bestScore = score;
				best = { pile: it, stackIndex: idx };
			}
		}
	}
	return best;
}

export function tryDelimb(world) {
	if (!handsIsTool(world, 'saw')) {
		const r = { ok: false, reason: 'need_saw' };
		world.lastEvent = { type: 'delimb_miss', ...r };
		return r;
	}

	const target = findDelimbTarget(world);
	if (!target) {
		const r = { ok: false, reason: 'no_branched_log' };
		world.lastEvent = { type: 'delimb_miss', ...r };
		return r;
	}

	if (target.pile) {
		const entry = target.pile.stack[target.stackIndex];
		entry.branched = false;
		const r = {
			ok: true,
			inPile: true,
			pileId: target.pile.id,
			woodKind: entry.woodKind,
			size: entry.size,
		};
		world.lastEvent = { type: 'delimb', ...r };
		return r;
	}

	target.branched = false;
	const r = {
		ok: true,
		inPile: false,
		logId: target.id,
		x: target.x,
		y: target.y,
		woodKind: target.woodKind,
		size: target.size,
	};
	world.lastEvent = { type: 'delimb', ...r };
	return r;
}

// ─── use: dispatch by tool in hands ──────────────────────────────────────

export function tryUse(world) {
	const h = world.player.hands;
	if (!h) {
		const r = { ok: false, reason: 'empty_hands' };
		world.lastEvent = { type: 'use_miss', ...r };
		return r;
	}
	if (h.type === 'tool' && h.tool === 'axe') return tryChop(world);
	if (h.type === 'tool' && h.tool === 'saw') return tryDelimb(world);
	if (h.type === 'log') {
		// using a carried log = put it down in front
		return tryDrop(world);
	}
	const r = { ok: false, reason: 'unknown_hands' };
	world.lastEvent = { type: 'use_miss', ...r };
	return r;
}

// ─── pickup / drop / piles ───────────────────────────────────────────────

function removeItem(world, item) {
	const i = world.items.indexOf(item);
	if (i >= 0) world.items.splice(i, 1);
}

/**
 * Pick up nearest ground thing into hands.
 * - Free hands: take it
 * - Holding tool, pickup tool: swap
 * - Holding anything, pickup log: must drop first (can't juggle)
 * - Pile: take top item of stack
 */
export function tryPickup(world) {
	const item = findNearestItem(world, 1.4);
	if (!item) {
		const r = { ok: false, reason: 'nothing_near' };
		world.lastEvent = { type: 'pickup_miss', ...r };
		return r;
	}

	const hands = world.player.hands;

	if (item.type === 'pile') {
		if (item.stack.length === 0) {
			removeItem(world, item);
			return tryPickup(world);
		}
		if (hands && hands.type === 'log') {
			const r = { ok: false, reason: 'hands_full' };
			world.lastEvent = { type: 'pickup_miss', ...r };
			return r;
		}
		// take top of stack; if holding a tool, swap it into the pile
		const taken = item.stack.pop();
		if (hands && hands.type === 'tool') {
			item.stack.push(cloneStackItem(hands));
		} else if (hands) {
			item.stack.push(taken);
			const r = { ok: false, reason: 'hands_full' };
			world.lastEvent = { type: 'pickup_miss', ...r };
			return r;
		}
		world.player.hands = taken;
		if (item.stack.length === 0) removeItem(world, item);
		const r = { ok: true, from: 'pile', hands: world.player.hands, pileId: item.id };
		world.lastEvent = { type: 'pickup', ...r };
		return r;
	}

	if (item.type === 'log') {
		if (hands) {
			const r = { ok: false, reason: 'hands_full' };
			world.lastEvent = { type: 'pickup_miss', ...r };
			return r;
		}
		world.player.hands = cloneStackItem(item);
		removeItem(world, item);
		const r = { ok: true, from: 'ground', hands: world.player.hands };
		world.lastEvent = { type: 'pickup', ...r };
		return r;
	}

	if (item.type === 'tool') {
		if (hands && hands.type === 'log') {
			const r = { ok: false, reason: 'hands_full' };
			world.lastEvent = { type: 'pickup_miss', ...r };
			return r;
		}
		const prev = hands && hands.type === 'tool' ? hands : null;
		world.player.hands = { type: 'tool', tool: item.tool };
		removeItem(world, item);
		if (prev) {
			// leave previous tool where this one was
			world.items.push(makeToolItem(world, item.x, item.y, prev.tool));
		}
		const r = { ok: true, from: 'ground', hands: world.player.hands, swapped: !!prev };
		world.lastEvent = { type: 'pickup', ...r };
		return r;
	}

	const r = { ok: false, reason: 'unknown_item' };
	world.lastEvent = { type: 'pickup_miss', ...r };
	return r;
}

/**
 * Drop hands in front of player.
 * Logs dropped onto other logs/piles merge into a pile.
 * Tools dropped onto piles join the stack.
 */
export function tryDrop(world, atX = null, atY = null) {
	const hands = world.player.hands;
	if (!hands) {
		const r = { ok: false, reason: 'empty_hands' };
		world.lastEvent = { type: 'drop_miss', ...r };
		return r;
	}

	const [fx, fy] = facingDelta(world.player.facing);
	const x = atX != null ? atX : world.player.x + 0.5 + fx * 0.65;
	const y = atY != null ? atY : world.player.y + 0.5 + fy * 0.65;

	if (hands.type === 'log') {
		const target = findLogDropTarget(world, x, y, 0.9);
		if (target && target.type === 'log') {
			// create pile from both
			const pile = makePile(world, target.x, target.y, [
				cloneStackItem(target),
				cloneStackItem(hands),
			]);
			removeItem(world, target);
			world.items.push(pile);
			world.player.hands = null;
			const r = { ok: true, merged: true, pileId: pile.id, count: pile.stack.length };
			world.lastEvent = { type: 'drop', ...r };
			return r;
		}
		if (target && target.type === 'pile') {
			target.stack.push(cloneStackItem(hands));
			world.player.hands = null;
			const r = { ok: true, merged: true, pileId: target.id, count: target.stack.length };
			world.lastEvent = { type: 'drop', ...r };
			return r;
		}
		const log = makeLog(world, x, y, hands);
		world.items.push(log);
		world.player.hands = null;
		const r = { ok: true, merged: false, logId: log.id, x, y };
		world.lastEvent = { type: 'drop', ...r };
		return r;
	}

	if (hands.type === 'tool') {
		// drop onto pile if nearby
		const near = findNearestItem(world, 0.9);
		if (near && near.type === 'pile') {
			// only if we're close to that pile position
			if (Math.hypot(near.x - x, near.y - y) < 0.95) {
				near.stack.push(cloneStackItem(hands));
				world.player.hands = null;
				const r = { ok: true, merged: true, pileId: near.id, tool: hands.tool };
				world.lastEvent = { type: 'drop', ...r };
				return r;
			}
		}
		const tool = makeToolItem(world, x, y, hands.tool);
		world.items.push(tool);
		world.player.hands = null;
		const r = { ok: true, merged: false, tool: hands.tool, x, y };
		world.lastEvent = { type: 'drop', ...r };
		return r;
	}

	const r = { ok: false, reason: 'unknown_hands' };
	world.lastEvent = { type: 'drop_miss', ...r };
	return r;
}

// ─── counts / test helpers ───────────────────────────────────────────────

export function countLivingTrees(world) {
	let n = 0;
	for (const t of world.trees) if (isLiving(t)) n++;
	return n;
}

export function countGroundLogs(world) {
	let n = 0;
	for (const it of world.items) {
		if (it.type === 'log') n++;
		if (it.type === 'pile') n += it.stack.filter((s) => s.type === 'log').length;
	}
	if (world.player.hands?.type === 'log') n++;
	return n;
}

export function countCleanLogs(world) {
	let n = 0;
	const tally = (s) => {
		if (s.type === 'log' && !s.branched) n++;
	};
	for (const it of world.items) {
		if (it.type === 'log') tally(it);
		if (it.type === 'pile') it.stack.forEach(tally);
	}
	if (world.player.hands) tally(world.player.hands);
	return n;
}

export function plantTree(world, x, y, partial = {}) {
	const t = makeTree(x + 0.5, y + 0.5, world.seed, world.trees.length);
	Object.assign(t, partial);
	if (partial.maxHp != null && partial.hp == null) t.hp = partial.maxHp;
	world.trees.push(t);
	return t;
}

export function getTree(world, x, y) {
	const cx = x + 0.5;
	const cy = y + 0.5;
	let best = null;
	let bestD = 0.55;
	for (const t of world.trees) {
		if (!t) continue;
		const d = Math.hypot((t.x + t.ox) - cx, (t.y + t.oy) - cy);
		if (d < bestD) {
			bestD = d;
			best = t;
		}
	}
	return best;
}

export function serializeWorld(world) {
	return JSON.parse(JSON.stringify({
		seed: world.seed,
		w: world.w,
		h: world.h,
		trees: world.trees,
		items: world.items,
		player: world.player,
		nextId: world.nextId,
	}));
}
