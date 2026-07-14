/**
 * Physical ground economy tests — shipped world.js only.
 * Run: bun test tests/v5-world.test.js
 */
import { describe, expect, test } from 'bun:test';
import {
	createWorld,
	tryChop,
	tryDelimb,
	tryPickup,
	tryDrop,
	tryMove,
	tryUse,
	countLivingTrees,
	countGroundLogs,
	countCleanLogs,
	plantTree,
	isLiving,
	handsIsTool,
	makeLog,
} from '../public/js/v5/world.js';

describe('createWorld', () => {
	test('starts with axe in hands and saw on the ground', () => {
		const w = createWorld(42);
		expect(handsIsTool(w, 'axe')).toBe(true);
		expect(w.player.wood).toBeUndefined();
		const saw = w.items.find((i) => i.type === 'tool' && i.tool === 'saw');
		expect(saw).toBeTruthy();
		expect(countLivingTrees(w)).toBeGreaterThan(200);
	});
});

describe('chop → ground log (not inventory)', () => {
	test('felling creates a branched log on the ground, no wood wallet', () => {
		const w = createWorld(42);
		w.trees = w.trees.filter((t) => Math.hypot(t.x - w.player.x, t.y - w.player.y) > 4);
		w.items = w.items.filter((i) => i.type === 'tool'); // keep saw
		w.player.facing = 'n';
		const tree = plantTree(w, w.player.x, w.player.y - 1, {
			kind: 'oak',
			size: 1,
			hp: 1,
			maxHp: 1,
			ox: 0,
			oy: 0,
			x: w.player.x + 0.5,
			y: w.player.y - 0.5,
		});
		const logsBefore = countGroundLogs(w);
		const r = tryChop(w);
		expect(r.ok).toBe(true);
		expect(r.removed).toBe(true);
		expect(r.woodGained).toBeUndefined();
		expect(tree.kind).toBe('stump');
		expect(countGroundLogs(w)).toBe(logsBefore + 1);
		const log = w.items.find((i) => i.type === 'log');
		expect(log).toBeTruthy();
		expect(log.branched).toBe(true);
		expect(w.player.hands?.type).toBe('tool'); // still holding axe, not wood
	});

	test('cannot chop without axe', () => {
		const w = createWorld(1);
		w.player.hands = null;
		w.trees = [];
		plantTree(w, w.player.x + 1, w.player.y, {
			hp: 1, maxHp: 1, kind: 'pine', size: 1,
			x: w.player.x + 1.2, y: w.player.y + 0.5, ox: 0, oy: 0,
		});
		w.player.facing = 'e';
		const r = tryChop(w);
		expect(r.ok).toBe(false);
		expect(r.reason).toBe('need_axe');
	});
});

describe('pickup / drop / piles', () => {
	test('grab log, drop next to another log → pile', () => {
		const w = createWorld(1);
		w.trees = [];
		w.items = [];
		w.player.hands = null;
		const a = makeLog(w, w.player.x + 0.5, w.player.y + 0.2, { woodKind: 'oak', size: 1, branched: true });
		const b = makeLog(w, w.player.x + 0.7, w.player.y + 0.15, { woodKind: 'pine', size: 0.9, branched: true });
		w.items.push(a, b);

		// pickup nearest
		const p1 = tryPickup(w);
		expect(p1.ok).toBe(true);
		expect(w.player.hands?.type).toBe('log');
		expect(w.items.some((i) => i.type === 'log')).toBe(true);

		// drop toward remaining log → merge pile
		w.player.facing = 'e';
		const d = tryDrop(w);
		expect(d.ok).toBe(true);
		expect(d.merged).toBe(true);
		expect(d.count).toBe(2);
		const pile = w.items.find((i) => i.type === 'pile');
		expect(pile).toBeTruthy();
		expect(pile.stack.length).toBe(2);
		expect(w.player.hands).toBeNull();
	});

	test('drop third log onto pile grows stack', () => {
		const w = createWorld(1);
		w.trees = [];
		w.items = [];
		w.player.hands = null;
		const px = w.player.x + 0.6;
		const py = w.player.y + 0.5;
		const a = makeLog(w, px, py, { woodKind: 'oak', size: 1, branched: false });
		const b = makeLog(w, px + 0.15, py, { woodKind: 'oak', size: 1, branched: false });
		w.items.push(a, b);
		tryPickup(w);
		// drop onto the remaining log's position so they merge
		const remaining = w.items.find((i) => i.type === 'log');
		expect(remaining).toBeTruthy();
		const d1 = tryDrop(w, remaining.x, remaining.y);
		expect(d1.ok).toBe(true);
		expect(d1.merged).toBe(true);
		const pile = w.items.find((i) => i.type === 'pile');
		expect(pile.stack.length).toBe(2);

		w.player.hands = { type: 'log', woodKind: 'birch', size: 0.8, branched: true };
		const d = tryDrop(w, pile.x, pile.y);
		expect(d.ok).toBe(true);
		expect(d.merged).toBe(true);
		expect(pile.stack.length).toBe(3);
	});

	test('swap axe for saw on the ground', () => {
		const w = createWorld(42);
		// clear to only saw near player
		const saw = w.items.find((i) => i.type === 'tool' && i.tool === 'saw');
		expect(saw).toBeTruthy();
		saw.x = w.player.x + 0.4;
		saw.y = w.player.y + 0.3;
		w.items = [saw];
		expect(handsIsTool(w, 'axe')).toBe(true);
		const r = tryPickup(w);
		expect(r.ok).toBe(true);
		expect(handsIsTool(w, 'saw')).toBe(true);
		expect(w.items.some((i) => i.type === 'tool' && i.tool === 'axe')).toBe(true);
	});
});

describe('delimb with saw', () => {
	test('saw turns branched log into clean log', () => {
		const w = createWorld(1);
		w.trees = [];
		w.items = [];
		w.player.hands = { type: 'tool', tool: 'saw' };
		const log = makeLog(w, w.player.x + 0.9, w.player.y + 0.5, {
			woodKind: 'oak', size: 1.2, branched: true,
		});
		w.items.push(log);
		w.player.facing = 'e';
		expect(countCleanLogs(w)).toBe(0);
		const r = tryDelimb(w);
		expect(r.ok).toBe(true);
		expect(log.branched).toBe(false);
		expect(countCleanLogs(w)).toBe(1);
	});

	test('axe cannot delimb', () => {
		const w = createWorld(1);
		w.player.hands = { type: 'tool', tool: 'axe' };
		w.items = [makeLog(w, w.player.x + 1, w.player.y + 0.5, { branched: true })];
		w.player.facing = 'e';
		const r = tryDelimb(w);
		expect(r.ok).toBe(false);
		expect(r.reason).toBe('need_saw');
	});
});

describe('tryUse dispatch', () => {
	test('use with axe chops; use with saw delimbs', () => {
		const w = createWorld(1);
		w.trees = [];
		w.items = [];
		w.player.hands = { type: 'tool', tool: 'axe' };
		plantTree(w, w.player.x + 1, w.player.y, {
			hp: 1, maxHp: 1, kind: 'pine', size: 1,
			x: w.player.x + 1.1, y: w.player.y + 0.5, ox: 0, oy: 0,
		});
		w.player.facing = 'e';
		const chop = tryUse(w);
		expect(chop.ok).toBe(true);
		expect(chop.removed).toBe(true);

		// pick saw path
		w.player.hands = { type: 'tool', tool: 'saw' };
		const log = w.items.find((i) => i.type === 'log');
		expect(log.branched).toBe(true);
		// move log in front
		log.x = w.player.x + 1;
		log.y = w.player.y + 0.5;
		const saw = tryUse(w);
		expect(saw.ok).toBe(true);
		expect(log.branched).toBe(false);
	});
});

describe('movement still works', () => {
	test('open tile move', () => {
		const w = createWorld(42);
		w.trees = w.trees.filter((t) => !(t.x > w.player.x && t.x < w.player.x + 2 && Math.abs(t.y - w.player.y) < 1));
		const x0 = w.player.x;
		const r = tryMove(w, 1, 0);
		expect(r.moved).toBe(true);
		expect(w.player.x).toBe(x0 + 1);
	});
});
