// life3d.js — everything that moves: voxel citizens, cars, cat, lake life,
// sky traffic, and the little animations anchored to buildings. Each entity
// owns a THREE.Group (this.obj), updates itself, and may chat when clicked.

import { THREE } from './gfx.js';
import {
	CITIZENS, SPAWNS, CARS, LAKE, hash,
	ROAD_H_CENTERS, ROAD_V_CENTERS, ROAD_MIN, ROAD_MAX, GRID,
} from './data.js';
import { arcadeFacade, clockFace } from './painters.js';

const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const bmat = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });

function vox(w, h, d, material, x = 0, y = 0, z = 0, cast = true) {
	const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
	m.position.set(x, y, z);
	m.castShadow = cast;
	return m;
}

export class Entity3D {
	constructor() {
		this.obj = new THREE.Group();
		this.obj.userData.pick = { type: 'entity', ent: this };
	}
	update() {}
	interact() { return null; }
}

// ---------------------------------------------------------------- walkers
// {axis, u, line} position model: leaving the road network is impossible.
class Walker extends Entity3D {
	constructor({ axis, u, line, dir, speed, pauseChance = 0, lane = 0 }) {
		super();
		Object.assign(this, { axis, u, line, dir, speed, pauseChance, lane });
		this.phase = Math.random() * 10;
		this.frozen = false;
		this.pauseUntil = 0;
	}

	gridPos() {
		const lane = this.lane * (this.axis === 'x' ? this.dir : -this.dir);
		return this.axis === 'x' ? [this.u, this.line + lane] : [this.line + lane, this.u];
	}

	get idle() { return this.frozen || performance.now() < this.pauseUntil; }

	heading() {
		return this.axis === 'x' ? Math.atan2(this.dir, 0) : Math.atan2(0, this.dir);
	}

	update(dt, t) {
		if (!this.frozen && t >= this.pauseUntil) {
			this.phase += this.speed * dt * 3;
			const target = this.nextStop();
			this.u += this.dir * this.speed * dt;
			if ((this.dir > 0 && this.u >= target) || (this.dir < 0 && this.u <= target)) {
				this.u = target;
				this.junction(t);
			}
			this.u = Math.min(ROAD_MAX, Math.max(ROAD_MIN, this.u));
		}
		const [gx, gy] = this.gridPos();
		this.obj.position.set(gx, 0, gy);
		this.obj.rotation.y = this.heading();
		this.animate(dt, t);
	}

	animate() {}

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
class Citizen extends Walker {
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
		this.build();
	}

	build() {
		const s = this.small ? 0.72 : 1;
		// legs pivot at the hip
		const legGeo = new THREE.BoxGeometry(0.13, 0.36, 0.13);
		legGeo.translate(0, -0.18, 0);
		this.legL = new THREE.Mesh(legGeo, mat('#2d3138'));
		this.legL.position.set(-0.09, 0.36, 0);
		this.legL.castShadow = true;
		this.legR = this.legL.clone();
		this.legR.position.x = 0.09;
		const torso = vox(0.42, 0.42, 0.26, mat(this.shirt), 0, 0.57, 0);
		const head = vox(0.32, 0.3, 0.28, mat(this.skin), 0, 0.95, 0);
		const eye1 = vox(0.05, 0.05, 0.03, bmat('#1b2a4a'), -0.07, 0.98, 0.15, false);
		const eye2 = eye1.clone();
		eye2.position.x = 0.07;
		this.obj.add(this.legL, this.legR, torso, head, eye1, eye2);
		if (this.tie) this.obj.add(vox(0.09, 0.26, 0.04, mat(this.tie), 0, 0.6, 0.14, false));
		if (this.hat) {
			this.obj.add(vox(0.4, 0.08, 0.36, mat(this.hat), 0, 1.13, 0, false));
			this.obj.add(vox(0.26, 0.12, 0.24, mat(this.hat), 0, 1.2, 0, false));
		} else if (this.hair) {
			this.obj.add(vox(0.34, 0.1, 0.3, mat(this.hair), 0, 1.13, 0, false));
		}
		// chat indicator
		this.dots = vox(0.4, 0.12, 0.08, bmat('#ffffff'), 0, 1.5, 0, false);
		this.dots.visible = false;
		this.obj.add(this.dots);
		this.obj.scale.set(s, s, s);
	}

	animate(dt, t) {
		const swing = this.idle ? 0 : Math.sin(this.phase * 6) * 0.55;
		this.legL.rotation.x = swing;
		this.legR.rotation.x = -swing;
		this.dots.visible = this.frozen;
		if (this.frozen) this.dots.position.y = 1.5 + Math.sin(t / 300) * 0.04;
	}

	interact() {
		this.lineIdx = (this.lineIdx + 1) % this.lines.length;
		return { name: this.name, line: this.lines[this.lineIdx], freeze: true };
	}
}

// ---------------------------------------------------------------- cat
class Cat extends Walker {
	constructor() {
		super({ axis: 'x', u: 4, line: 27, dir: 1, speed: 2.4, pauseChance: 0.25, lane: -0.25 });
		const grey = mat('#3b3f46');
		this.obj.add(vox(0.2, 0.2, 0.52, grey, 0, 0.22, 0));
		this.obj.add(vox(0.24, 0.22, 0.2, grey, 0, 0.34, 0.32));
		this.obj.add(vox(0.06, 0.1, 0.06, grey, -0.07, 0.5, 0.34, false));
		this.obj.add(vox(0.06, 0.1, 0.06, grey, 0.07, 0.5, 0.34, false));
		this.tail = vox(0.05, 0.05, 0.3, grey, 0, 0.34, -0.38, false);
		this.obj.add(this.tail);
		this.legs = [];
		for (const [lx, lz] of [[-0.07, 0.18], [0.07, 0.18], [-0.07, -0.18], [0.07, -0.18]]) {
			const leg = vox(0.06, 0.14, 0.06, grey, lx, 0.07, lz, false);
			this.legs.push(leg);
			this.obj.add(leg);
		}
		const eye = vox(0.04, 0.04, 0.02, bmat('#ffd43b'), 0.07, 0.38, 0.43, false);
		this.obj.add(eye, ((e) => { const e2 = eye.clone(); e2.position.x = -0.07; return e2; })());
		this.meows = ['meow.', 'mrrp?', '...she has places to be.', 'meow. (that’s five bucks, Dot.)'];
	}
	animate(dt, t) {
		const swing = this.idle ? 0 : Math.sin(t / 90) * 0.06;
		this.legs.forEach((l, i) => { l.position.y = 0.07 + (i % 2 ? swing : -swing); });
		this.tail.rotation.x = 0.4 + Math.sin(t / 400) * 0.25;
	}
	interact() {
		return { name: 'the cat', line: this.meows[Math.floor(Math.random() * this.meows.length)], freeze: true };
	}
}

// ---------------------------------------------------------------- cars
class Car extends Walker {
	constructor(cfg) {
		const [u0, line0, axis, dir] = cfg.spawn;
		super({
			axis,
			u: axis === 'x' ? u0 : line0,
			line: axis === 'x' ? line0 : u0,
			dir,
			speed: cfg.speed,
			lane: 0.4,
		});
		this.obj.add(vox(0.55, 0.26, 1.1, mat(cfg.body), 0, 0.3, 0));
		this.obj.add(vox(0.48, 0.24, 0.55, mat(cfg.top), 0, 0.55, -0.08));
		const wheel = mat('#15181d');
		for (const [wx, wz] of [[-0.26, 0.32], [0.26, 0.32], [-0.26, -0.32], [0.26, -0.32]]) {
			this.obj.add(vox(0.1, 0.18, 0.18, wheel, wx, 0.12, wz, false));
		}
		this.obj.add(vox(0.12, 0.08, 0.04, bmat('#fff3bf'), -0.16, 0.3, 0.56, false));
		this.obj.add(vox(0.12, 0.08, 0.04, bmat('#fff3bf'), 0.16, 0.3, 0.56, false));
	}
	interact() {
		return { name: 'a car', line: ['beep beep.', 'honk.', '(polite Canadian honk)'][Math.floor(Math.random() * 3)] };
	}
}

// ---------------------------------------------------------------- lake life
class Boat extends Entity3D {
	constructor() {
		super();
		this.lines = [
			'Caught anything? Three boots and a dial-up modem.',
			'The big one’s down there. I’ve seen it. It has wifi.',
			'Shhh. You’ll scare the pixels.',
			'Best office in town. Terrible cell reception. Perfect.',
		];
		this.lineIdx = -1;
		this.obj.add(vox(0.7, 0.2, 1.7, mat('#8a5a33'), 0, 0.12, 0));
		this.obj.add(vox(0.8, 0.1, 1.85, mat('#6f4a28'), 0, 0.24, 0));
		// Sal
		this.obj.add(vox(0.34, 0.34, 0.24, mat('#5c940d'), 0, 0.48, -0.2));
		this.obj.add(vox(0.26, 0.24, 0.24, mat('#c98d5e'), 0, 0.78, -0.2));
		this.obj.add(vox(0.36, 0.07, 0.34, mat('#3e4a1c'), 0, 0.93, -0.2, false));
		// rod + line + bobber
		const rod = vox(0.03, 0.03, 1.1, mat('#3e2c1c'), 0, 0.75, 0.45, false);
		rod.rotation.x = -0.5;
		this.obj.add(rod);
		this.line3d = vox(0.02, 0.55, 0.02, bmat('#e9ecef'), 0, 0.65, 0.95, false);
		this.obj.add(this.line3d);
		this.bobber = vox(0.09, 0.09, 0.09, bmat('#e03131'), 0, 0.12, 0.95, false);
		this.obj.add(this.bobber);
	}
	update(dt, t) {
		const x = LAKE.cx + Math.cos(t / 21000) * 1.6 + 0.6;
		const z = LAKE.cy + Math.sin(t / 17000) * 0.9;
		this.obj.position.set(x, 0.02 + Math.sin(t / 900) * 0.03, z);
		this.obj.rotation.y = Math.sin(t / 6000) * 0.4 + 0.6;
		const dip = Math.max(0, Math.sin(t / 2600)) * 0.08;
		this.bobber.position.y = 0.12 - dip;
	}
	interact() {
		this.lineIdx = (this.lineIdx + 1) % this.lines.length;
		return { name: 'Sal the Fisher', line: this.lines[this.lineIdx] };
	}
}

class DuckFamily extends Entity3D {
	constructor() {
		super();
		this.trail = [];
		this.ducks = [this.makeDuck(1), this.makeDuck(0.55), this.makeDuck(0.5)];
		this.ducks.forEach((d) => this.obj.add(d));
	}
	makeDuck(s) {
		const g = new THREE.Group();
		g.add(vox(0.26, 0.18, 0.4, mat('#ffd43b'), 0, 0.1, 0));
		g.add(vox(0.18, 0.2, 0.18, mat('#ffd43b'), 0, 0.3, 0.16));
		g.add(vox(0.08, 0.05, 0.12, mat('#f76707'), 0, 0.3, 0.3, false));
		g.scale.set(s, s, s);
		return g;
	}
	update(dt, t) {
		const mx = LAKE.cx - 2 + Math.cos(t / 5200) * 1.4;
		const mz = LAKE.cy + 1 + Math.sin(t / 4100) * 0.9;
		if (!this.lastSample || t - this.lastSample > 260) {
			this.trail.unshift([mx, mz]);
			this.trail.length = Math.min(this.trail.length, 10);
			this.lastSample = t;
		}
		const heading = Math.atan2(-Math.sin(t / 5200) / 5200 * 1.4, Math.cos(t / 4100) / 4100 * 0.9);
		this.ducks[0].position.set(mx, 0.02, mz);
		this.ducks[0].rotation.y = heading;
		for (let i = 1; i < 3; i++) {
			const p = this.trail[i * 3];
			if (p) {
				this.ducks[i].position.set(p[0], 0.02, p[1]);
				this.ducks[i].rotation.y = heading;
			}
		}
	}
	interact() {
		return { name: 'the ducks', line: ['quack.', 'quack quack quack. (a family meeting)', '(they accept compliments)'][Math.floor(Math.random() * 3)] };
	}
}

// ---------------------------------------------------------------- sky
class Clouds extends Entity3D {
	constructor() {
		super();
		this.obj.userData.pick = null;
		this.clouds = [];
		const cm = bmat('#ffffff', { transparent: true, opacity: 0.88 });
		for (let i = 0; i < 5; i++) {
			const c = new THREE.Group();
			for (let j = 0; j < 3; j++) {
				const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 - j * 0.2, 1), cm);
				blob.position.set(j * 1.1 - 1, (j % 2) * 0.3, (j % 2) * 0.5);
				blob.scale.y = 0.55;
				c.add(blob);
			}
			const s = 0.8 + hash(i, 4) * 1;
			c.scale.set(s, s, s);
			c.position.set(hash(i, 9) * GRID, 7 + hash(i, 3) * 3, hash(i, 6) * GRID);
			this.clouds.push(c);
			this.obj.add(c);
		}
	}
	update(dt, t) {
		for (let i = 0; i < this.clouds.length; i++) {
			const c = this.clouds[i];
			c.position.x += dt * (0.25 + i * 0.06);
			if (c.position.x > GRID + 8) c.position.x = -8;
		}
	}
}

class Balloon extends Entity3D {
	constructor() {
		super();
		const canvas = document.createElement('canvas');
		canvas.width = 32; canvas.height = 8;
		const g = canvas.getContext('2d');
		['#e0447c', '#ffd43b', '#4dabf7', '#37b24d'].forEach((c, i) => {
			g.fillStyle = c;
			g.fillRect(i * 8, 0, 8, 8);
		});
		const t = new THREE.CanvasTexture(canvas);
		t.magFilter = THREE.NearestFilter;
		t.colorSpace = THREE.SRGBColorSpace;
		const env = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshLambertMaterial({ map: t }));
		env.scale.y = 1.2;
		env.position.y = 1.4;
		env.castShadow = true;
		const basket = vox(0.5, 0.4, 0.5, mat('#8a5a33'), 0, -0.4, 0);
		const pilot = vox(0.2, 0.2, 0.2, mat('#f3c19d'), 0, -0.1, 0, false);
		this.obj.add(env, basket, pilot);
	}
	update(dt, t) {
		this.obj.position.set(
			((t / 90000) * (GRID + 14)) % (GRID + 14) - 7,
			8.5 + Math.sin(t / 4000) * 0.5,
			14 + Math.sin(t / 23000) * 8
		);
	}
	interact() {
		return { name: 'balloon pilot', line: ['Lovely day for it!', 'I can see your house from here. It’s the orange one.', 'Up here it’s all just pixels, friend.'][Math.floor(Math.random() * 3)] };
	}
}

class Birds extends Entity3D {
	constructor() {
		super();
		this.obj.userData.pick = null;
		this.flock = [];
		for (let i = 0; i < 4; i++) {
			const b = new THREE.Group();
			const w1 = vox(0.3, 0.03, 0.1, bmat('#1b2a4a'), -0.15, 0, 0, false);
			const w2 = vox(0.3, 0.03, 0.1, bmat('#1b2a4a'), 0.15, 0, 0, false);
			b.add(w1, w2);
			b.userData.wings = [w1, w2];
			this.flock.push(b);
			this.obj.add(b);
		}
	}
	update(dt, t) {
		const CYCLE = 34000, FLIGHT = 12000;
		const cyc = Math.floor(t / CYCLE);
		const p = (t % CYCLE) / FLIGHT;
		const show = hash(cyc, 777) <= 0.6 && p <= 1;
		this.obj.visible = show;
		if (!show) return;
		const dir = hash(cyc, 111) > 0.5 ? 1 : -1;
		const bx = dir > 0 ? -3 + p * (GRID + 6) : GRID + 3 - p * (GRID + 6);
		const bz = 8 + hash(cyc, 222) * 30;
		this.flock.forEach((b, i) => {
			b.position.set(bx - dir * i * 0.8 - dir * (i % 2) * 0.3, 6 + Math.sin(t / 200 + i) * 0.2, bz + i * 0.5);
			const flap = Math.sin(t / 130 + i * 2) * 0.7;
			b.userData.wings[0].rotation.z = flap;
			b.userData.wings[1].rotation.z = -flap;
		});
	}
}

class Ufo extends Entity3D {
	constructor() {
		super();
		const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 0.22, 10), mat('#b7c0cc'));
		const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 0.16, 10), mat('#8d97a5'));
		rim.position.y = -0.16;
		const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 6), new THREE.MeshLambertMaterial({ color: '#a5f3fc', transparent: true, opacity: 0.85 }));
		dome.position.y = 0.25;
		const pilot = vox(0.16, 0.16, 0.16, mat('#3b4552'), 0, 0.22, 0, false);
		this.lights = [];
		for (let i = 0; i < 3; i++) {
			const l = vox(0.14, 0.08, 0.14, bmat('#ffd43b'), Math.cos(i * 2.1) * 0.5, -0.2, Math.sin(i * 2.1) * 0.5, false);
			this.lights.push(l);
			this.obj.add(l);
		}
		this.obj.add(saucer, rim, dome, pilot);
	}
	update(dt, t) {
		const CYCLE = 75000, FLIGHT = 9000;
		const cyc = Math.floor(t / CYCLE);
		const p = (t % CYCLE) / FLIGHT;
		const show = (cyc === 0 || hash(cyc, 999) <= 0.3) && p <= 1;
		this.obj.visible = show;
		if (!show) return;
		const dir = hash(cyc, 555) > 0.5 ? 1 : -1;
		this.obj.position.set(
			dir > 0 ? -4 + p * (GRID + 8) : GRID + 4 - p * (GRID + 8),
			7 + hash(cyc, 333) * 2.5 + Math.sin(p * 17) * 0.4,
			10 + hash(cyc, 444) * 26
		);
		this.obj.rotation.y = t / 900;
		const k = Math.floor(t / 140) % 3;
		this.lights.forEach((l, i) => l.material = i === k ? bmat('#ff5ea8') : bmat('#ffd43b'));
	}
	interact() {
		return { name: '???', line: '⌇⍜ ⌰⍜⋏⊑ (translation unavailable)' };
	}
}

// ------------------------------------------------- building-anchored bits
class Smoke extends Entity3D {
	constructor(a) {
		super();
		this.obj.userData.pick = null;
		this.puffs = [];
		for (let i = 0; i < 3; i++) {
			const p = new THREE.Mesh(
				new THREE.BoxGeometry(0.2, 0.2, 0.2),
				new THREE.MeshBasicMaterial({ color: '#f0f0f5', transparent: true })
			);
			this.puffs.push(p);
			this.obj.add(p);
		}
		this.obj.position.set(a.x, a.y, a.z);
	}
	update(dt, t) {
		this.puffs.forEach((p, i) => {
			const k = ((t / 1600) + i / 3) % 1;
			p.position.set(Math.sin(k * 6 + i) * 0.12, k * 1.4, 0);
			const s = 0.6 + k * 1.4;
			p.scale.set(s, s, s);
			p.material.opacity = 0.5 * (1 - k);
		});
	}
}

class FountainJet extends Entity3D {
	constructor(a) {
		super();
		this.obj.userData.pick = null;
		this.drops = [];
		for (let i = 0; i < 7; i++) {
			const d = new THREE.Mesh(
				new THREE.BoxGeometry(0.09, 0.09, 0.09),
				new THREE.MeshBasicMaterial({ color: '#a0dcfa', transparent: true })
			);
			this.drops.push(d);
			this.obj.add(d);
		}
		this.obj.position.set(a.x, a.y, a.z);
	}
	update(dt, t) {
		this.drops.forEach((d, i) => {
			const k = ((t / 900) + i / 7) % 1;
			const a = i * 0.9;
			d.position.set(Math.cos(a) * k * 0.7, Math.sin(k * Math.PI) * 0.7, Math.sin(a) * k * 0.7);
			d.material.opacity = 0.9 - k * 0.7;
		});
	}
}

class Flapper extends Entity3D {
	// waving flags
	constructor(mesh, speed = 300) {
		super();
		this.obj.userData.pick = null;
		this.mesh = mesh;
		this.speed = speed;
	}
	update(dt, t) {
		this.mesh.rotation.y = Math.sin(t / this.speed) * 0.35;
		this.mesh.scale.x = 0.85 + Math.sin(t / this.speed) * 0.15;
	}
}

class Blinker extends Entity3D {
	constructor(mesh) {
		super();
		this.obj.userData.pick = null;
		this.mesh = mesh;
		this.on = bmat('#ff6b6b');
		this.off = bmat('#8a2f2f');
	}
	update(dt, t) {
		this.mesh.material = Math.floor(t / 700) % 2 ? this.on : this.off;
	}
}

class MarqueeAnim extends Entity3D {
	constructor(canvas, texture) {
		super();
		this.obj.userData.pick = null;
		this.canvas = canvas;
		this.texture = texture;
		this.last = -1;
	}
	update(dt, t) {
		const k = Math.floor(t / 800) % 2;
		if (k === this.last) return;
		this.last = k;
		const g = this.canvas.getContext('2d');
		g.setTransform(4, 0, 0, 4, 0, 0);
		arcadeFacade(g, this.canvas.width / 4, this.canvas.height / 4, t);
		this.texture.needsUpdate = true;
	}
}

class ClockAnim extends Entity3D {
	constructor(canvas, texture) {
		super();
		this.obj.userData.pick = null;
		this.canvas = canvas;
		this.texture = texture;
		this.lastMin = -1;
	}
	update() {
		const now = new Date();
		if (now.getMinutes() === this.lastMin) return;
		this.lastMin = now.getMinutes();
		const g = this.canvas.getContext('2d');
		g.setTransform(4, 0, 0, 4, 0, 0);
		const U = this.canvas.width / 4, H = this.canvas.height / 4;
		clockFace(g, U, H);
		const cx = U / 2, cy = H / 2;
		const ha = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2;
		const ma = now.getMinutes() / 60 * Math.PI * 2 - Math.PI / 2;
		g.strokeStyle = '#1b2a4a';
		g.lineWidth = 1;
		g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ha) * 3.4, cy + Math.sin(ha) * 3.4); g.stroke();
		g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ma) * 5, cy + Math.sin(ma) * 5); g.stroke();
		this.texture.needsUpdate = true;
	}
}

class WallSync extends Entity3D {
	constructor(wall, texture) {
		super();
		this.obj.userData.pick = null;
		this.wall = wall;
		this.texture = texture;
		this.lastCount = -1;
		this.lastCheck = 0;
	}
	update(dt, t) {
		if (t - this.lastCheck < 500) return;
		this.lastCheck = t;
		const n = this.wall.strokes.length + this.wall.lastId;
		if (n !== this.lastCount) {
			this.lastCount = n;
			this.texture.needsUpdate = true;
		}
	}
}

// ---------------------------------------------------------------- factory
export function createLife(scene, anchors, wall) {
	const list = [];
	CITIZENS.forEach((c, i) => list.push(new Citizen(c, i)));
	CARS.forEach((c) => list.push(new Car(c)));
	list.push(new Cat(), new Boat(), new DuckFamily(), new Clouds(), new Balloon(), new Birds(), new Ufo());
	if (anchors.chimney) list.push(new Smoke(anchors.chimney));
	if (anchors.fountain) list.push(new FountainJet(anchors.fountain));
	if (anchors.flag) list.push(new Flapper(anchors.flag));
	if (anchors.wembleFlag) list.push(new Flapper(anchors.wembleFlag, 380));
	if (anchors.beacon) list.push(new Blinker(anchors.beacon));
	if (anchors.arcadeCanvas) list.push(new MarqueeAnim(anchors.arcadeCanvas, anchors.arcadeTex));
	if (anchors.clockCanvas) list.push(new ClockAnim(anchors.clockCanvas, anchors.clockTex));
	if (anchors.wallTex) list.push(new WallSync(wall, anchors.wallTex));
	for (const e of list) scene.add(e.obj);
	return list;
}
