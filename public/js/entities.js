// entities.js — everything in Woodtown that moves, blinks, drifts, or talks.
//
// Each entity is independent: update(dt,t) + draw(ctx,t) in world coords,
// optional hit()/interact() to chat. Shared behaviours live in base classes
// (RoadWalker walks the road network and structurally cannot leave it).
// Add life to the town by appending to CITIZENS/CARS or the factory below.

import { g2w, hash, WORLD_W } from './iso.js';
import { ROAD_H_CENTERS, ROAD_V_CENTERS, ROAD_MIN, ROAD_MAX, LAKE } from './world.js';

export class Entity {
	update() {}
	draw() {}
	hit() { return false; }
	interact() { return null; } // → { name, line, freeze } for a speech bubble
}

// ---------------------------------------------------------------- walking
// Position model: `u` slides along the walk axis, `line` is the fixed
// cross coordinate — so drifting off the road network is impossible.
class RoadWalker extends Entity {
	constructor({ axis, u, line, dir, speed, pauseChance = 0, lane = 0 }) {
		super();
		Object.assign(this, { axis, u, line, dir, speed, pauseChance, lane });
		this.phase = Math.random() * 10;
		this.frozen = false;
		this.pauseUntil = 0;
	}

	pos() {
		const lane = this.lane * (this.axis === 'x' ? this.dir : -this.dir);
		return this.axis === 'x' ? [this.u, this.line + lane] : [this.line + lane, this.u];
	}

	get idle() { return this.frozen || performance.now() < this.pauseUntil; }

	update(dt, t) {
		if (this.frozen || t < this.pauseUntil) return;
		this.phase += this.speed * dt * 3;
		const target = this.nextStop();
		this.u += this.dir * this.speed * dt;
		if ((this.dir > 0 && this.u >= target) || (this.dir < 0 && this.u <= target)) {
			this.u = target;
			this.junction(t);
		}
		this.u = Math.min(ROAD_MAX, Math.max(ROAD_MIN, this.u));
	}

	nextStop() {
		const cross = this.axis === 'x' ? ROAD_V_CENTERS : ROAD_H_CENTERS;
		const stops = [...cross, this.dir > 0 ? ROAD_MAX : ROAD_MIN]
			.filter((s) => (this.dir > 0 ? s > this.u + 0.01 : s < this.u - 0.01))
			.sort((a, b) => (this.dir > 0 ? a - b : b - a));
		return stops.length ? stops[0] : (this.dir > 0 ? ROAD_MAX : ROAD_MIN);
	}

	junction(t) {
		const [x, y] = this.axis === 'x' ? [this.u, this.line] : [this.line, this.u];
		const opts = [];
		if (ROAD_H_CENTERS.includes(y)) {
			if (x > ROAD_MIN) opts.push(['x', -1, y, x]);
			if (x < ROAD_MAX) opts.push(['x', 1, y, x]);
		}
		if (ROAD_V_CENTERS.includes(x)) {
			if (y > ROAD_MIN) opts.push(['y', -1, x, y]);
			if (y < ROAD_MAX) opts.push(['y', 1, x, y]);
		}
		const fwd = opts.filter(([a, d]) => !(a === this.axis && d === -this.dir));
		const pick = (fwd.length ? fwd : [[this.axis, -this.dir, this.line, this.u]])[
			Math.floor(Math.random() * (fwd.length || 1))
		];
		[this.axis, this.dir, this.line, this.u] = pick;
		if (Math.random() < this.pauseChance) this.pauseUntil = t + 1200 + Math.random() * 2500;
	}
}

// ---------------------------------------------------------------- citizens
const CITIZENS = [
	{
		name: 'The Mayor', shirt: '#5c636e', skin: '#f3c19d', hair: '#c0c0c0', tie: '#e0447c', speed: 1.1,
		lines: [
			'Welcome to Woodtown! Population: fluctuating.',
			'This whole town fits inside one email domain. Efficient governance.',
			'The wall downtown? Fully legal. I signed the permit myself. For myself.',
			'Vote for me! There is no election. Vote anyway.',
		],
	},
	{
		name: 'Penny the Painter', shirt: '#e0447c', skin: '#e8a87c', hat: '#1b2a4a', speed: 1.5,
		lines: [
			'Psst. The big wall by the fountain — anyone can paint it. ANYONE.',
			'I ran out of teal today. A tragedy in three acts.',
			'Paint something nice. Or weird. Weird is nice.',
			'Every stroke fades eventually. Very deep, if you think about it. I try not to.',
		],
	},
	{
		name: 'Pat the Postie', shirt: '#4d79c7', skin: '#c98d5e', hat: '#2f4a80', speed: 1.8,
		lines: [
			'Rain or shine, the mail gets through. It’s mostly spam.',
			'One inbox in this whole town, and it’s not even yours.',
			'You’ve got mail! Not here, though. Somewhere else.',
			'Somebody once mailed us a couch. We don’t talk about the couch.',
		],
	},
	{
		name: 'Gus the Builder', shirt: '#f59f00', skin: '#e8a87c', hat: '#ffd43b', speed: 0.9,
		lines: [
			'We’re expanding. The mayor keeps having ideas. Terrifying.',
			'That arcade? Any day now. Any day. Aaaany day.',
			'The crane doesn’t lift anything. It’s emotional support infrastructure.',
			'There’s something under this town. We dug down once. We don’t do that anymore.',
		],
	},
	{
		name: 'Lil’ Dot', shirt: '#37b24d', skin: '#f3c19d', hair: '#8a5a33', small: true, speed: 2.3,
		lines: [
			'Have you seen the cat?? She owes me five bucks.',
			'I clicked the grass and a FLOWER grew!! Try it!!',
			'When I grow up I wanna be a pixel artist. Or a duck.',
			'There’s a DRAGON under the town!! Gus told me not to tell you. Oops.',
		],
	},
	{
		name: 'Fern the Gardener', shirt: '#2b8a3e', skin: '#c98d5e', hat: '#d9b382', speed: 1.0,
		lines: [
			'Every tree in town? Planted by hand. My hand.',
			'The shrubs are load-bearing. Don’t ask.',
			'Don’t feed the ducks bread. They prefer compliments.',
			'The oaks remember everything. Anyway! Lovely weather.',
		],
	},
	{
		name: 'Joan the Jogger', shirt: '#12b886', skin: '#f3c19d', hair: '#1b2a4a', speed: 3.4,
		lines: [
			'Can’t stop. Lap 3,041.',
			'The hills here are all isometric. Great for the calves.',
			'Passed the UFO once. It waved.',
			'Hydration tip: the fountain is NOT potable. The duck told me.',
		],
	},
	{
		name: 'Old Walt', shirt: '#845ef7', skin: '#e8a87c', hair: '#e9ecef', speed: 0.6,
		lines: [
			'I saw the saucer again last night. Nobody believes me.',
			'In my day the whole internet was this size. We liked it that way.',
			'That fisherman’s been out there for years. Never caught a thing. Happiest man I know.',
			'Listen close at the mineshaft. Something snores.',
		],
	},
];

const SPAWNS = [
	[16, 27, 'x', 1], [13, 16, 'y', 1], [24, 11, 'x', -1], [29, 22, 'y', -1],
	[6, 11, 'x', 1], [13, 33, 'y', -1], [34, 27, 'x', 1], [29, 6, 'y', 1],
];

class Citizen extends RoadWalker {
	constructor(data, i) {
		const [u0, line0, axis, dir] = SPAWNS[i % SPAWNS.length];
		super({
			axis,
			u: axis === 'x' ? u0 : line0,
			line: axis === 'x' ? line0 : u0,
			dir,
			speed: data.speed,
			pauseChance: 0.3,
		});
		Object.assign(this, data);
		this.lineIdx = -1;
	}

	hit(wx, wy) {
		const [x, y] = g2w(...this.pos());
		return Math.hypot(wx - x, wy - (y - 8)) < 11;
	}

	interact() {
		this.lineIdx = (this.lineIdx + 1) % this.lines.length;
		return { name: this.name, line: this.lines[this.lineIdx], freeze: true };
	}

	draw(ctx, t) {
		const [x, y] = g2w(...this.pos());
		const step = this.idle ? 0 : Math.sin(this.phase * 6) * 1.4;
		const s = this.small ? 0.75 : 1;
		ctx.save();
		ctx.translate(x, y);
		ctx.scale((this.axis === 'x' ? this.dir : 1) * s, s);
		ctx.fillStyle = 'rgba(0,0,0,0.18)';
		ctx.beginPath(); ctx.ellipse(0, 0.5, 4.5, 1.8, 0, 0, 7); ctx.fill();
		ctx.fillStyle = '#2d3138';
		ctx.fillRect(-2.5, -4, 2, 4 + step * 0.5);
		ctx.fillRect(0.8, -4, 2, 4 - step * 0.5);
		ctx.fillStyle = this.shirt;
		ctx.fillRect(-3, -10, 6.5, 6.5);
		if (this.tie) { ctx.fillStyle = this.tie; ctx.fillRect(-0.6, -9.5, 1.6, 4); }
		ctx.fillStyle = this.skin;
		ctx.fillRect(-2.4, -15, 5.2, 5);
		ctx.fillStyle = '#1b2a4a';
		ctx.fillRect(0.6, -13.6, 1.1, 1.1);
		if (this.hat) {
			ctx.fillStyle = this.hat;
			ctx.fillRect(-3, -16.6, 6.4, 2.2);
			ctx.fillRect(-1.6, -18, 3.6, 1.8);
		} else if (this.hair) {
			ctx.fillStyle = this.hair;
			ctx.fillRect(-2.4, -16.4, 5.2, 1.8);
		}
		if (this.frozen) {
			ctx.fillStyle = '#fff';
			const k = Math.floor(t / 350) % 3;
			for (let i = 0; i < 3; i++) ctx.fillRect(-2 + i * 2.4, -20 - (i === k ? 1.4 : 0), 1.5, 1.5);
		}
		ctx.restore();
	}
}

// ---------------------------------------------------------------- cat
class Cat extends RoadWalker {
	constructor() {
		super({ axis: 'x', u: 4, line: 27, dir: 1, speed: 2.4, pauseChance: 0.25, lane: -0.1 });
		this.meows = ['meow.', 'mrrp?', '...she has places to be.', 'meow. (that’s five bucks, Dot.)'];
	}
	hit(wx, wy) {
		const [x, y] = g2w(...this.pos());
		return Math.hypot(wx - x, wy - (y - 5)) < 10;
	}
	interact() {
		return { name: 'the cat', line: this.meows[Math.floor(Math.random() * this.meows.length)], freeze: true };
	}
	draw(ctx, t) {
		const [x, y] = g2w(...this.pos());
		const step = this.idle ? 0 : Math.sin(t / 90) * 1;
		ctx.save();
		ctx.translate(x, y);
		if ((this.axis === 'x' ? this.dir : 1) < 0) ctx.scale(-1, 1);
		ctx.fillStyle = '#3b3f46';
		ctx.fillRect(-6, -6, 11, 4);
		ctx.fillRect(3, -9, 5, 5);
		ctx.fillRect(3, -11, 1.6, 2); ctx.fillRect(6.4, -11, 1.6, 2);
		ctx.fillRect(-6, -2, 1.6, 2 + step); ctx.fillRect(3, -2, 1.6, 2 - step);
		ctx.fillRect(-9, -8 + Math.sin(t / 400) * 1.5, 3, 1.6);
		ctx.fillStyle = '#ffd43b';
		ctx.fillRect(6.5, -8, 1, 1);
		ctx.restore();
	}
}

// ---------------------------------------------------------------- cars
const CARS = [
	{ body: '#e03131', top: '#ffe3e3', speed: 5.5, spawn: [20, 11, 'x', 1] },
	{ body: '#1971c2', top: '#d0ebff', speed: 4.6, spawn: [13, 20, 'y', -1] },
	{ body: '#f08c00', top: '#fff3bf', speed: 5.0, spawn: [40, 27, 'x', -1] },
];

class Car extends RoadWalker {
	constructor(cfg) {
		const [u0, line0, axis, dir] = cfg.spawn;
		super({
			axis,
			u: axis === 'x' ? u0 : line0,
			line: axis === 'x' ? line0 : u0,
			dir,
			speed: cfg.speed,
			lane: 0.4, // drive on the right
		});
		this.cfg = cfg;
	}
	hit(wx, wy) {
		const [x, y] = g2w(...this.pos());
		return Math.hypot(wx - x, wy - (y - 4)) < 12;
	}
	interact() {
		return { name: 'a car', line: ['beep beep.', 'honk.', '(polite Canadian honk)'][Math.floor(Math.random() * 3)] };
	}
	draw(ctx) {
		const [x, y] = g2w(...this.pos());
		const flipX = this.axis === 'x' ? this.dir : 1;
		const skew = this.axis === 'x' ? 0.5 : -0.5;
		ctx.save();
		ctx.translate(x, y);
		ctx.transform(flipX, skew * flipX, 0, 1, 0, 0);
		ctx.fillStyle = 'rgba(0,0,0,0.2)';
		ctx.beginPath(); ctx.ellipse(0, 0.5, 9, 2.4, 0, 0, 7); ctx.fill();
		ctx.fillStyle = this.cfg.body;
		ctx.fillRect(-9, -6, 18, 5);
		ctx.fillStyle = this.cfg.top;
		ctx.fillRect(-4, -9.5, 9, 4);
		ctx.fillStyle = '#15181d';
		ctx.beginPath(); ctx.arc(-5, -0.5, 2, 0, 7); ctx.arc(5, -0.5, 2, 0, 7); ctx.fill();
		ctx.fillStyle = '#ffd43b';
		ctx.fillRect(8, -5.5, 1.5, 2); // headlight
		ctx.restore();
	}
}

// ---------------------------------------------------------------- lake life
class Boat extends Entity {
	constructor() {
		super();
		this.lines = [
			'Caught anything? Three boots and a dial-up modem.',
			'The big one’s down there. I’ve seen it. It has wifi.',
			'Shhh. You’ll scare the pixels.',
			'Best office in town. Terrible cell reception. Perfect.',
		];
		this.lineIdx = -1;
	}
	pos(t) {
		return [
			LAKE.cx + Math.cos(t / 21000) * 1.6 + 0.6,
			LAKE.cy + Math.sin(t / 17000) * 0.9,
		];
	}
	hit(wx, wy) {
		const [x, y] = g2w(...this.pos(performance.now()));
		return Math.hypot(wx - x, wy - (y - 8)) < 18;
	}
	interact() {
		this.lineIdx = (this.lineIdx + 1) % this.lines.length;
		return { name: 'Sal the Fisher', line: this.lines[this.lineIdx] };
	}
	draw(ctx, t) {
		const [x, y0] = g2w(...this.pos(t));
		const y = y0 + Math.sin(t / 900) * 1.2; // bob
		ctx.save();
		ctx.translate(x, y);
		// ripples
		ctx.strokeStyle = 'rgba(255,255,255,0.4)';
		ctx.lineWidth = 1;
		ctx.beginPath(); ctx.ellipse(0, 1, 16 + Math.sin(t / 700) * 2, 4, 0, 0, 7); ctx.stroke();
		// hull
		ctx.fillStyle = '#8a5a33';
		ctx.beginPath();
		ctx.moveTo(-14, -3); ctx.lineTo(14, -3); ctx.lineTo(9, 3); ctx.lineTo(-9, 3);
		ctx.closePath(); ctx.fill();
		ctx.fillStyle = '#6f4a28';
		ctx.fillRect(-14, -4, 28, 2);
		// Sal
		ctx.fillStyle = '#c98d5e';
		ctx.fillRect(-4, -13, 5, 4.5); // head
		ctx.fillStyle = '#5c940d';
		ctx.fillRect(-5, -9, 7, 5.5); // raincoat
		ctx.fillStyle = '#3e4a1c';
		ctx.fillRect(-5.5, -14.6, 8, 2); // hat
		ctx.fillRect(-3, -16, 4.5, 1.8);
		// rod + line + bobber
		ctx.strokeStyle = '#3e2c1c';
		ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(1, -9); ctx.lineTo(17, -17); ctx.stroke();
		ctx.strokeStyle = 'rgba(255,255,255,0.6)';
		const dip = Math.max(0, Math.sin(t / 2600)) * 2;
		ctx.beginPath(); ctx.moveTo(17, -17); ctx.lineTo(17, -1 + dip); ctx.stroke();
		ctx.fillStyle = '#e03131';
		ctx.fillRect(16, -1 + dip, 2.4, 2.4);
		ctx.restore();
	}
}

class DuckFamily extends Entity {
	constructor() {
		super();
		this.trail = [];
	}
	momPos(t) {
		return [
			LAKE.cx - 2 + Math.cos(t / 5200) * 1.4,
			LAKE.cy + 1 + Math.sin(t / 4100) * 0.9,
		];
	}
	update(dt, t) {
		if (!this.lastSample || t - this.lastSample > 260) {
			this.trail.unshift(this.momPos(t));
			this.trail.length = Math.min(this.trail.length, 8);
			this.lastSample = t;
		}
	}
	hit(wx, wy) {
		const [x, y] = g2w(...this.momPos(performance.now()));
		return Math.hypot(wx - x, wy - (y - 4)) < 12;
	}
	interact() {
		return { name: 'the ducks', line: ['quack.', 'quack quack quack. (a family meeting)', '(they accept compliments)'][Math.floor(Math.random() * 3)] };
	}
	drawDuck(ctx, gx, gy, t, s, flip) {
		const [x, y] = g2w(gx, gy);
		ctx.save();
		ctx.translate(x, y);
		ctx.scale(flip * s, s);
		ctx.fillStyle = '#ffd43b';
		ctx.fillRect(-3, -4, 6, 3.4);
		ctx.fillRect(1, -7, 3, 3.4);
		ctx.fillStyle = '#f76707';
		ctx.fillRect(4, -6, 2, 1.4);
		ctx.fillStyle = '#1b2a4a';
		ctx.fillRect(2.2, -6.2, 1, 1);
		ctx.strokeStyle = 'rgba(255,255,255,0.5)';
		ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke();
		ctx.restore();
	}
	draw(ctx, t) {
		const flip = Math.cos(t / 5200) > 0 ? -1 : 1;
		this.drawDuck(ctx, ...this.momPos(t), t, 1, flip);
		for (let i = 0; i < 2; i++) {
			const p = this.trail[(i + 1) * 3];
			if (p) this.drawDuck(ctx, p[0], p[1], t, 0.55, flip);
		}
	}
}

// ---------------------------------------------------------------- sky
class Clouds extends Entity {
	draw(ctx, t) {
		const CLOUDS = [
			{ y: 30, s: 1.5, v: 5200 }, { y: 58, s: 1, v: 7600 },
			{ y: 14, s: 0.8, v: 9800 }, { y: 44, s: 1.2, v: 6400 },
		];
		ctx.fillStyle = 'rgba(255,255,255,0.85)';
		for (let i = 0; i < CLOUDS.length; i++) {
			const c = CLOUDS[i];
			const x = ((t / c.v) * 60 + i * 380) % (WORLD_W + 160) - 80;
			ctx.save();
			ctx.translate(x, c.y);
			ctx.scale(c.s, c.s);
			ctx.beginPath();
			ctx.ellipse(0, 0, 22, 8, 0, 0, 7);
			ctx.ellipse(14, -4, 14, 7, 0, 0, 7);
			ctx.ellipse(-14, -2, 12, 6, 0, 0, 7);
			ctx.fill();
			ctx.restore();
		}
	}
}

class Balloon extends Entity {
	pos(t) {
		return [
			((t / 90000) * (WORLD_W + 200)) % (WORLD_W + 200) - 100,
			52 + Math.sin(t / 4000) * 8,
		];
	}
	hit(wx, wy) {
		const [x, y] = this.pos(performance.now());
		return Math.hypot(wx - x, wy - y) < 20;
	}
	interact() {
		return { name: 'balloon pilot', line: ['Lovely day for it!', 'I can see your house from here. It’s the orange one.', 'Up here it’s all just pixels, friend.'][Math.floor(Math.random() * 3)] };
	}
	draw(ctx, t) {
		const [x, y] = this.pos(t);
		ctx.save();
		ctx.translate(x, y);
		const stripes = ['#e0447c', '#ffd43b', '#4dabf7', '#37b24d'];
		for (let i = 0; i < 4; i++) {
			ctx.fillStyle = stripes[i];
			ctx.beginPath();
			ctx.ellipse(0, 0, 14 - i * 3.4, 17, 0, 0, 7);
			ctx.fill();
		}
		ctx.strokeStyle = '#5c3a1e';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(-7, 13); ctx.lineTo(-4, 22); ctx.moveTo(7, 13); ctx.lineTo(4, 22);
		ctx.stroke();
		ctx.fillStyle = '#8a5a33';
		ctx.fillRect(-5, 22, 10, 7);
		ctx.fillStyle = '#f3c19d'; // tiny pilot
		ctx.fillRect(-1.5, 19.5, 3, 3);
		ctx.restore();
	}
}

class Birds extends Entity {
	draw(ctx, t) {
		const CYCLE = 34000, FLIGHT = 12000;
		const cyc = Math.floor(t / CYCLE);
		if (hash(cyc, 777) > 0.6) return;
		const p = (t % CYCLE) / FLIGHT;
		if (p > 1) return;
		const dir = hash(cyc, 111) > 0.5 ? 1 : -1;
		const bx = dir > 0 ? -40 + p * (WORLD_W + 80) : WORLD_W + 40 - p * (WORLD_W + 80);
		const by = 30 + hash(cyc, 222) * 40;
		ctx.strokeStyle = '#1b2a4a';
		ctx.lineWidth = 1.2;
		for (let i = 0; i < 4; i++) {
			const x = bx - dir * i * 11 - dir * (i % 2) * 4;
			const y = by + i * 4 + Math.sin(t / 200 + i) * 2;
			const w = Math.sin(t / 130 + i * 2) * 3;
			ctx.beginPath();
			ctx.moveTo(x - 4, y - w);
			ctx.quadraticCurveTo(x, y + 2, x + 4, y - w);
			ctx.stroke();
		}
	}
}

class Ufo extends Entity {
	// guaranteed flyby on the first cycle; luck after that
	draw(ctx, t) {
		const CYCLE = 75000, FLIGHT = 9000;
		const cyc = Math.floor(t / CYCLE);
		if (cyc > 0 && hash(cyc, 999) > 0.3) return;
		const p = (t % CYCLE) / FLIGHT;
		if (p > 1) return;
		const dir = hash(cyc, 555) > 0.5 ? 1 : -1;
		const x = dir > 0 ? -70 + p * (WORLD_W + 140) : WORLD_W + 70 - p * (WORLD_W + 140);
		const y = 18 + hash(cyc, 333) * 44 + Math.sin(p * 17) * 6;
		ctx.save();
		ctx.translate(x, y);
		ctx.fillStyle = '#a5f3fc';
		ctx.beginPath(); ctx.ellipse(0, -4, 7, 6, 0, 0, 7); ctx.fill();
		ctx.fillStyle = '#3b4552';
		ctx.beginPath(); ctx.ellipse(0, -4.5, 2.5, 2, 0, 0, 7); ctx.fill();
		ctx.fillStyle = '#b7c0cc';
		ctx.beginPath(); ctx.ellipse(0, 0, 17, 5.5, 0, 0, 7); ctx.fill();
		ctx.fillStyle = '#8d97a5';
		ctx.beginPath(); ctx.ellipse(0, 2, 12, 3, 0, 0, 7); ctx.fill();
		const k = Math.floor(t / 140) % 3;
		for (let i = 0; i < 3; i++) {
			ctx.fillStyle = i === k ? '#ff5ea8' : '#ffd43b';
			ctx.fillRect(-7 + i * 7, 2.5, 2.5, 2.5);
		}
		ctx.restore();
	}
}

// ------------------------------------------------- building-anchored bits
class WallPreview extends Entity {
	constructor(anchor, wallCanvas) { super(); this.a = anchor; this.wc = wallCanvas; }
	draw(ctx) {
		const [x, y] = g2w(this.a.gx, this.a.gy1);
		ctx.save();
		ctx.transform(this.a.uw / this.wc.width, (this.a.uw * 0.5) / this.wc.width, 0, this.a.h / this.wc.height, x, y - this.a.h);
		ctx.drawImage(this.wc, 0, 0);
		ctx.restore();
	}
}

class Antenna extends Entity {
	constructor(a) { super(); this.a = a; }
	draw(ctx, t) {
		ctx.fillStyle = Math.floor(t / 700) % 2 ? '#ff6b6b' : '#8a2f2f';
		ctx.fillRect(this.a.x - 1.5, this.a.y - 1.5, 3, 3);
	}
}

class Flag extends Entity {
	constructor(a) { super(); this.a = a; }
	draw(ctx, t) {
		const wave = Math.sin(t / 300) * 2;
		ctx.fillStyle = '#e0447c';
		ctx.beginPath();
		ctx.moveTo(this.a.x, this.a.y);
		ctx.lineTo(this.a.x + 12, this.a.y + 2 + wave);
		ctx.lineTo(this.a.x, this.a.y + 7);
		ctx.closePath();
		ctx.fill();
	}
}

class Smoke extends Entity {
	constructor(a) { super(); this.a = a; }
	draw(ctx, t) {
		for (let i = 0; i < 3; i++) {
			const p = ((t / 1600) + i / 3) % 1;
			ctx.fillStyle = `rgba(240,240,245,${0.55 * (1 - p)})`;
			const s = 2 + p * 4;
			ctx.fillRect(this.a.x - s / 2 + Math.sin(p * 6 + i) * 2, this.a.y - p * 22, s, s);
		}
	}
}

class Marquee extends Entity {
	constructor(a) { super(); this.a = a; }
	draw(ctx, t) {
		const [x, y] = g2w(this.a.gx, this.a.gy1);
		ctx.save();
		ctx.transform(1, 0.5, 0, 1, x, y - this.a.h);
		ctx.font = 'bold 8px monospace';
		ctx.fillStyle = Math.floor(t / 800) % 2 ? '#ff5ea8' : '#4dd4e8';
		ctx.fillText('ARCADE', 17, 12);
		ctx.restore();
	}
}

class FountainJet extends Entity {
	constructor(a) { super(); this.a = a; }
	draw(ctx, t) {
		for (let i = 0; i < 6; i++) {
			const p = ((t / 900) + i / 6) % 1;
			ctx.fillStyle = `rgba(160,220,250,${0.9 - p * 0.7})`;
			const dx = Math.sin(i * 2.4) * p * 10;
			ctx.fillRect(this.a.x + dx - 1, this.a.y - 8 * Math.sin(p * Math.PI) - 2, 2, 2);
		}
	}
}

class Clock extends Entity {
	constructor(a) { super(); this.a = a; }
	draw(ctx) {
		const now = new Date();
		const ha = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2;
		const ma = now.getMinutes() / 60 * Math.PI * 2 - Math.PI / 2;
		ctx.strokeStyle = '#1b2a4a';
		ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(this.a.x, this.a.y); ctx.lineTo(this.a.x + Math.cos(ha) * 3, this.a.y + Math.sin(ha) * 3); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(this.a.x, this.a.y); ctx.lineTo(this.a.x + Math.cos(ma) * 4.5, this.a.y + Math.sin(ma) * 4.5); ctx.stroke();
	}
}

// ---------------------------------------------------------------- factory
export function createEntities(world, wallCanvas) {
	const a = world.anchors;
	const list = [];
	if (a.wallFace) list.push(new WallPreview(a.wallFace, wallCanvas));
	if (a.antenna) list.push(new Antenna(a.antenna));
	if (a.flag) list.push(new Flag(a.flag));
	if (a.chimney) list.push(new Smoke(a.chimney));
	if (a.marquee) list.push(new Marquee(a.marquee));
	if (a.fountain) list.push(new FountainJet(a.fountain));
	if (a.clock) list.push(new Clock(a.clock));
	CITIZENS.forEach((c, i) => list.push(new Citizen(c, i)));
	CARS.forEach((c) => list.push(new Car(c)));
	list.push(new Cat());
	list.push(new Boat());
	list.push(new DuckFamily());
	list.push(new Birds());
	list.push(new Balloon());
	list.push(new Clouds());
	list.push(new Ufo());
	return list;
}
