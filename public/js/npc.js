// npc.js — Woodtown's citizens: little pixel people who wander the roads
// and chat when clicked. Add a person to CITIZENS and they show up.

import { g2w, ROAD_H_CENTERS, ROAD_V_CENTERS } from './town.js';

const ROAD_MIN = 1, ROAD_MAX = 38;

const CITIZENS = [
	{
		name: 'The Mayor', shirt: '#5c636e', skin: '#f3c19d', hat: null, hair: '#c0c0c0', tie: '#e0447c',
		speed: 1.1,
		lines: [
			'Welcome to Woodtown! Population: fluctuating.',
			'This whole town fits inside one email domain. Efficient governance.',
			'The wall downtown? Fully legal. I signed the permit myself. For myself.',
			'Vote for me! There is no election. Vote anyway.',
		],
	},
	{
		name: 'Penny the Painter', shirt: '#e0447c', skin: '#e8a87c', hat: '#1b2a4a',
		speed: 1.5,
		lines: [
			'Psst. The big wall by the fountain — anyone can paint it. ANYONE.',
			'I ran out of teal today. A tragedy in three acts.',
			'Paint something nice. Or weird. Weird is nice.',
			'Every stroke fades eventually. Very deep, if you think about it. I try not to.',
		],
	},
	{
		name: 'Pat the Postie', shirt: '#4d79c7', skin: '#c98d5e', hat: '#2f4a80',
		speed: 1.8,
		lines: [
			'Rain or shine, the mail gets through. It’s mostly spam.',
			'One inbox in this whole town, and it’s not even yours.',
			'You’ve got mail! Not here, though. Somewhere else.',
			'Somebody once mailed us a couch. We don’t talk about the couch.',
		],
	},
	{
		name: 'Gus the Builder', shirt: '#f59f00', skin: '#e8a87c', hat: '#ffd43b',
		speed: 0.9,
		lines: [
			'We’re expanding. The mayor keeps having ideas. Terrifying.',
			'That arcade? Any day now. Any day. Aaaany day.',
			'The crane doesn’t lift anything. It’s emotional support infrastructure.',
			'Hard hat area. The hat is mostly for style.',
		],
	},
	{
		name: 'Lil’ Dot', shirt: '#37b24d', skin: '#f3c19d', hat: null, hair: '#8a5a33', small: true,
		speed: 2.3,
		lines: [
			'Have you seen the cat?? She owes me five bucks.',
			'I clicked the grass and a FLOWER grew!! Try it!!',
			'When I grow up I wanna be a pixel artist. Or a duck.',
			'The fountain is NOT for swimming. I checked. Twice.',
		],
	},
	{
		name: 'Fern the Gardener', shirt: '#2b8a3e', skin: '#c98d5e', hat: '#d9b382',
		speed: 1.0,
		lines: [
			'Every tree in town? Planted by hand. My hand.',
			'The shrubs are load-bearing. Don’t ask.',
			'Don’t feed the duck bread. She prefers compliments.',
			'I’m growing a pumpkin for the fair. The fair hasn’t been built. The pumpkin doesn’t know that.',
		],
	},
];

// intersections + road ends form the walk graph
function optionsAt(nx, ny) {
	const opts = [];
	if (ROAD_H_CENTERS.includes(ny)) {
		if (nx > ROAD_MIN) opts.push(['x', -1]);
		if (nx < ROAD_MAX) opts.push(['x', 1]);
	}
	if (ROAD_V_CENTERS.includes(nx)) {
		if (ny > ROAD_MIN) opts.push(['y', -1]);
		if (ny < ROAD_MAX) opts.push(['y', 1]);
	}
	return opts;
}

// next graph node ahead of (x,y) moving along axis/dir
function nextNode(x, y, axis, dir) {
	if (axis === 'x') {
		const stops = [...ROAD_V_CENTERS, dir > 0 ? ROAD_MAX : ROAD_MIN]
			.filter((s) => (dir > 0 ? s > x + 0.01 : s < x - 0.01))
			.sort((a, b) => (dir > 0 ? a - b : b - a));
		return [stops[0], y];
	}
	const stops = [...ROAD_H_CENTERS, dir > 0 ? ROAD_MAX : ROAD_MIN]
		.filter((s) => (dir > 0 ? s > y + 0.01 : s < y - 0.01))
		.sort((a, b) => (dir > 0 ? a - b : b - a));
	return [x, stops[0]];
}

export function createNpcs() {
	const spawns = [
		[16, 27, 'x', 1], [13, 16, 'y', 1], [24, 11, 'x', -1],
		[29, 22, 'y', -1], [6, 11, 'x', 1], [13, 33, 'y', -1],
	];
	const npcs = CITIZENS.map((c, i) => {
		const [x, y, axis, dir] = spawns[i % spawns.length];
		return {
			...c,
			x, y, axis, dir,
			phase: Math.random() * 10,
			lineIdx: -1,
			frozen: false,
			pauseUntil: 0,
		};
	});

	function update(dt, t) {
		for (const n of npcs) {
			if (n.frozen || t < n.pauseUntil) continue;
			const step = n.speed * dt;
			n.phase += step * 3;
			const [tx, ty] = nextNode(n.x, n.y, n.axis, n.dir);
			if (n.axis === 'x') {
				n.x += n.dir * step;
				if ((n.dir > 0 && n.x >= tx) || (n.dir < 0 && n.x <= tx)) arrive(n, tx, ty, t);
			} else {
				n.y += n.dir * step;
				if ((n.dir > 0 && n.y >= ty) || (n.dir < 0 && n.y <= ty)) arrive(n, tx, ty, t);
			}
		}
	}

	function arrive(n, nx, ny, t) {
		n.x = nx;
		n.y = ny;
		const opts = optionsAt(nx, ny).filter(([axis, dir]) => !(axis === n.axis && dir === -n.dir));
		const pick = (opts.length ? opts : [[n.axis, -n.dir]])[Math.floor(Math.random() * (opts.length || 1))];
		n.axis = pick[0];
		n.dir = pick[1];
		if (Math.random() < 0.3) n.pauseUntil = t + 1200 + Math.random() * 2500; // stop and smell the pixels
	}

	function draw(ctx, t) {
		for (const n of npcs) {
			const [x, y] = g2w(n.x, n.y);
			const idle = n.frozen || t < n.pauseUntil;
			const step = idle ? 0 : Math.sin(n.phase * 6) * 1.4;
			const s = n.small ? 0.75 : 1;
			ctx.save();
			ctx.translate(x, y);
			ctx.scale((n.axis === 'x' ? n.dir : 1) * s, s);
			// shadow
			ctx.fillStyle = 'rgba(0,0,0,0.18)';
			ctx.beginPath(); ctx.ellipse(0, 0.5, 4.5, 1.8, 0, 0, 7); ctx.fill();
			// legs
			ctx.fillStyle = '#2d3138';
			ctx.fillRect(-2.5, -4, 2, 4 + step * 0.5);
			ctx.fillRect(0.8, -4, 2, 4 - step * 0.5);
			// body
			ctx.fillStyle = n.shirt;
			ctx.fillRect(-3, -10, 6.5, 6.5);
			if (n.tie) { ctx.fillStyle = n.tie; ctx.fillRect(-0.6, -9.5, 1.6, 4); }
			// head
			ctx.fillStyle = n.skin;
			ctx.fillRect(-2.4, -15, 5.2, 5);
			ctx.fillStyle = '#1b2a4a';
			ctx.fillRect(0.6, -13.6, 1.1, 1.1); // eye
			// hat or hair
			if (n.hat) {
				ctx.fillStyle = n.hat;
				ctx.fillRect(-3, -16.6, 6.4, 2.2);
				ctx.fillRect(-1.6, -18, 3.6, 1.8);
			} else if (n.hair) {
				ctx.fillStyle = n.hair;
				ctx.fillRect(-2.4, -16.4, 5.2, 1.8);
			}
			// idle chat dots
			if (n.frozen) {
				ctx.fillStyle = '#fff';
				const k = Math.floor(t / 350) % 3;
				for (let i = 0; i < 3; i++) ctx.fillRect(-2 + i * 2.4, -20 - (i === k ? 1.4 : 0), 1.5, 1.5);
			}
			ctx.restore();
		}
	}

	// nearest npc within `radius` world px of a world point
	function hitTest(wx, wy, radius = 10) {
		let best = null, bd = radius;
		for (const n of npcs) {
			const [x, y] = g2w(n.x, n.y);
			const d = Math.hypot(wx - x, wy - (y - 8));
			if (d < bd) { bd = d; best = n; }
		}
		return best;
	}

	function nextLine(n) {
		n.lineIdx = (n.lineIdx + 1) % n.lines.length;
		return n.lines[n.lineIdx];
	}

	return { npcs, update, draw, hitTest, nextLine };
}
