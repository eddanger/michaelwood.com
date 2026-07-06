// life3d.js — everything that moves: voxel citizens, cars, cat, lake life,
// sky traffic, and the little animations anchored to buildings. Each entity
// owns a THREE.Group (this.obj), updates itself, and may chat when clicked.

import { THREE } from './gfx.js';
import {
	CITIZENS, SPAWNS, CARS, LAKE, MINER, hash, tileType,
	DOGS, DOG_LINES, DOG_PARK, BUSKER,
	ROAD_H_CENTERS, ROAD_V_CENTERS, ROAD_MIN, ROAD_MAX, GRID,
} from './data.js';
import { arcadeFacade, clockFace } from './painters.js';
import { LAMP_SPOTS } from './town3d.js';

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

// shared voxel-person builder (citizens + the miner)
function buildPerson(obj, data) {
	const s = data.small ? 0.72 : 1;
	const legGeo = new THREE.BoxGeometry(0.13, 0.36, 0.13);
	legGeo.translate(0, -0.18, 0);
	const legL = new THREE.Mesh(legGeo, mat('#2d3138'));
	legL.position.set(-0.09, 0.36, 0);
	legL.castShadow = true;
	const legR = legL.clone();
	legR.position.x = 0.09;
	const torso = vox(0.42, 0.42, 0.26, mat(data.shirt), 0, 0.57, 0);
	const head = vox(0.32, 0.3, 0.28, mat(data.skin), 0, 0.95, 0);
	const eye1 = vox(0.05, 0.05, 0.03, bmat('#1b2a4a'), -0.07, 0.98, 0.15, false);
	const eye2 = eye1.clone();
	eye2.position.x = 0.07;
	obj.add(legL, legR, torso, head, eye1, eye2);
	if (data.tie) obj.add(vox(0.09, 0.26, 0.04, mat(data.tie), 0, 0.6, 0.14, false));
	if (data.hat) {
		obj.add(vox(0.4, 0.08, 0.36, mat(data.hat), 0, 1.13, 0, false));
		obj.add(vox(0.26, 0.12, 0.24, mat(data.hat), 0, 1.2, 0, false));
	} else if (data.hair) {
		obj.add(vox(0.34, 0.1, 0.3, mat(data.hair), 0, 1.13, 0, false));
	}
	const dots = vox(0.4, 0.12, 0.08, bmat('#ffffff'), 0, 1.5, 0, false);
	dots.visible = false;
	obj.add(dots);
	obj.scale.set(s, s, s);
	return { legL, legR, dots };
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
		const parts = buildPerson(this.obj, this);
		this.legL = parts.legL;
		this.legR = parts.legR;
		this.dots = parts.dots;
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
		this.mat = cm; // Weather greys this out
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

// ---------------------------------------------------------------- the miner
// Mo isn't road-bound: he putters around the headframe, then rides the
// shaft down to work and comes back up for lunch/sunsets/UFOs.
class Miner extends Entity3D {
	constructor(mine, wheel) {
		super();
		this.mine = mine;
		this.wheel = wheel;
		const parts = buildPerson(this.obj, MINER);
		this.legL = parts.legL;
		this.legR = parts.legR;
		this.dots = parts.dots;
		// helmet lamp
		this.obj.add(vox(0.1, 0.09, 0.05, bmat('#ffe680'), 0, 1.2, 0.17, false));
		// pickaxe over the shoulder
		const handle = vox(0.05, 0.7, 0.05, mat('#8a5a33'), 0.26, 0.75, -0.08, false);
		handle.rotation.z = -0.5;
		const headPick = vox(0.34, 0.08, 0.08, mat('#5e6673'), 0.42, 1.02, -0.08, false);
		this.obj.add(handle, headPick);
		this.x = mine.x;
		this.z = mine.z + 0.8;
		this.y = 0;
		this.state = 'up';
		this.stateUntil = 0;
		this.target = null;
		this.phase = 0;
		this.frozen = false;
		this.lineIdx = -1;
	}

	pickTarget() {
		const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 1.6;
		this.target = [this.mine.x + Math.cos(a) * r, Math.min(49, this.mine.z + 0.4 + Math.abs(Math.sin(a)) * r)];
	}

	update(dt, t) {
		if (!this.stateUntil) {
			this.stateUntil = t + 24000;
			this.pickTarget();
		}
		const speed = 1.2;
		if (this.state === 'up' && !this.frozen) {
			if (t > this.stateUntil) {
				this.state = 'toShaft';
			} else if (this.target) {
				const [tx, tz] = this.target;
				const d = Math.hypot(tx - this.x, tz - this.z);
				if (d < 0.1) {
					if (Math.random() < 0.02) this.pickTarget();
				} else {
					this.x += ((tx - this.x) / d) * speed * dt;
					this.z += ((tz - this.z) / d) * speed * dt;
					this.phase += dt * 4;
					this.obj.rotation.y = Math.atan2(tx - this.x, tz - this.z);
				}
			}
		} else if (this.state === 'toShaft' && !this.frozen) {
			const d = Math.hypot(this.mine.x - this.x, this.mine.z - this.z);
			if (d < 0.12) {
				this.state = 'descend';
			} else {
				this.x += ((this.mine.x - this.x) / d) * speed * dt;
				this.z += ((this.mine.z - this.z) / d) * speed * dt;
				this.phase += dt * 4;
				this.obj.rotation.y = Math.atan2(this.mine.x - this.x, this.mine.z - this.z);
			}
		} else if (this.state === 'descend') {
			this.y -= dt * 1.1;
			if (this.wheel) this.wheel.rotation.z += dt * 4;
			if (this.y <= -1.8) {
				this.state = 'down';
				this.obj.visible = false;
				this.stateUntil = t + 14000 + Math.random() * 14000;
			}
		} else if (this.state === 'down') {
			if (t > this.stateUntil) {
				this.state = 'ascend';
				this.obj.visible = true;
			}
		} else if (this.state === 'ascend') {
			this.y += dt * 1.1;
			if (this.wheel) this.wheel.rotation.z -= dt * 4;
			if (this.y >= 0) {
				this.y = 0;
				this.state = 'up';
				this.stateUntil = t + 20000 + Math.random() * 15000;
				this.pickTarget();
			}
		}
		this.obj.position.set(this.x, this.y, this.z);
		const swing = (this.state === 'up' || this.state === 'toShaft') && !this.frozen ? Math.sin(this.phase * 6) * 0.5 : 0;
		this.legL.rotation.x = swing;
		this.legR.rotation.x = -swing;
		this.dots.visible = this.frozen;
	}

	interact() {
		if (!this.obj.visible) return null;
		this.lineIdx = (this.lineIdx + 1) % MINER.lines.length;
		return { name: MINER.name, line: MINER.lines[this.lineIdx], freeze: true };
	}
}

// ---------------------------------------------------------------- sky cycle
// A full day every 8 minutes: sun & square moon arc overhead, the sky
// blushes at dusk, stars and fireflies come out, streetlamps glow. Kept slow
// so shadows creep rather than sweep.
const DAY_MS = 480000;
const DAY_OFFSET = location.hash.includes('night') ? 0.62 : 0.06;

// shared clock: where are we in the day?
function dayPhase(t) {
	const p = ((t / DAY_MS) + DAY_OFFSET) % 1;
	const alt = Math.sin(p * Math.PI * 2);
	return { p, alt, f: THREE.MathUtils.smoothstep(alt, -0.12, 0.2) };
}

function mix3(a, b, k) {
	return a.map((c, i) => {
		const ca = new THREE.Color(c), cb = new THREE.Color(b[i]);
		return '#' + ca.lerp(cb, k).getHexString();
	});
}

class SkyCycle extends Entity3D {
	constructor(gfx, weather) {
		super();
		this.obj.userData.pick = null;
		this.gfx = gfx;
		this.weather = weather;
		// celestial bodies (flat squares, as Walt insists)
		this.sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), bmat('#ffd94a'));
		this.moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), bmat('#e8ecf4'));
		this.obj.add(this.sunMesh, this.moonMesh);
		// stars
		this.starMat = bmat('#ffffff', { transparent: true, opacity: 0 });
		for (let i = 0; i < 70; i++) {
			const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), this.starMat);
			s.position.set(hash(i, 21) * 76 - 13, 11 + hash(i, 22) * 10, hash(i, 23) * 76 - 13);
			this.obj.add(s);
		}
		// fireflies on grass
		this.flies = [];
		let placed = 0, tries = 0;
		while (placed < 36 && tries < 400) {
			const gx = Math.floor(hash(tries, 31) * GRID), gy = Math.floor(hash(tries, 32) * GRID);
			tries++;
			if (tileType(gx, gy) !== 0) continue;
			const f = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), bmat('#ffe066'));
			f.position.set(gx + hash(tries, 33), 0.5, gy + hash(tries, 34));
			f.userData.seed = placed;
			this.flies.push(f);
			this.obj.add(f);
			placed++;
		}
		// streetlamp halos
		this.haloMat = bmat('#ffd43b', { transparent: true, opacity: 0 });
		for (const [lx, lz] of LAMP_SPOTS) {
			const h = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), this.haloMat);
			h.position.set(lx, 1.28, lz);
			this.obj.add(h);
		}
		this.palettes = {
			day: ['#6db5e8', '#8fd3f4', '#c3ecfb'],
			dusk: ['#3c4a7a', '#e88a6a', '#ffd9a0'],
			night: ['#0b1030', '#17204a', '#2a3566'],
		};
	}

	update(dt, t) {
		const { p, alt, f } = dayPhase(t);
		const a = p * Math.PI * 2;
		const duskK = Math.max(0, 1 - Math.abs(alt) / 0.32) * (f > 0.02 ? 1 : 0.4);
		const w = this.weather ? this.weather.light : 1;

		const { sun, ambient } = this.gfx;
		sun.intensity = (0.35 + 2.0 * f) * (0.5 + 0.5 * w);
		ambient.intensity = (0.55 + 0.85 * f) * (0.6 + 0.4 * w);
		const dayCol = new THREE.Color('#fff2d8');
		const duskCol = new THREE.Color('#ffb36b');
		const nightCol = new THREE.Color('#8fa8dc');
		sun.color.copy(nightCol.lerp(dayCol, f).lerp(duskCol, duskK * 0.55));
		// the light source swings around the town through the day
		const la = a - Math.PI / 2;
		sun.position.set(25 + Math.cos(la) * 24, 16 + Math.abs(alt) * 22, 8 + Math.sin(la) * 10);

		// sky gradient
		let cols = mix3(this.palettes.night, this.palettes.day, f);
		cols = mix3(cols, this.palettes.dusk, duskK * 0.8);
		if (w < 1) cols = mix3(cols, ['#5c6672', '#78828e', '#98a2ac'], (1 - w) * 0.8);
		document.body.style.background = `linear-gradient(${cols[0]} 0%, ${cols[1]} 45%, ${cols[2]} 100%)`;

		// celestial arc, behind the town from the camera's viewpoint
		const R = { x: -0.707, z: 0.707 };
		const place = (mesh, ang) => {
			const y = 4 + Math.sin(ang) * 18;
			mesh.position.set(6 + R.x * Math.cos(ang) * 30, y, 6 + R.z * Math.cos(ang) * 30);
			mesh.visible = y > 1.5;
			mesh.lookAt(mesh.position.x + 1, mesh.position.y + 0.7, mesh.position.z + 1);
		};
		place(this.sunMesh, a);
		place(this.moonMesh, a + Math.PI);

		this.starMat.opacity = (1 - f) * 0.9;
		this.haloMat.opacity = (1 - f) * 0.4;
		const nightK = 1 - THREE.MathUtils.smoothstep(alt, -0.15, 0.05);
		for (const fly of this.flies) {
			const k = Math.max(0, Math.sin(t / 420 + fly.userData.seed * 2.7)) * nightK;
			fly.scale.setScalar(Math.max(0.001, k));
			fly.position.y = 0.45 + Math.sin(t / 900 + fly.userData.seed) * 0.15;
		}
	}
}

// ---------------------------------------------------------------- weather
// 80-second systems roll through: clear, cloudy, rain, the odd snowfall —
// with a rainbow when rain clears in daylight.
const WEATHER_MS = 80000;

class Weather extends Entity3D {
	constructor(cloudsEnt) {
		super();
		this.obj.userData.pick = null;
		this.clouds = cloudsEnt;
		this.light = 1;
		this.forceRain = location.hash.includes('rain');
		// rain pool
		this.rain = new THREE.Group();
		this.rainMat = bmat('#9fc6e8', { transparent: true, opacity: 0 });
		for (let i = 0; i < 200; i++) {
			const d = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.8, 0.09), this.rainMat);
			this.resetDrop(d, true);
			this.rain.add(d);
		}
		// snow pool
		this.snow = new THREE.Group();
		this.snowMat = bmat('#ffffff', { transparent: true, opacity: 0 });
		for (let i = 0; i < 140; i++) {
			const d = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), this.snowMat);
			this.resetDrop(d, true);
			this.snow.add(d);
		}
		this.obj.add(this.rain, this.snow);
		// rainbow
		const rc = document.createElement('canvas');
		rc.width = 256; rc.height = 128;
		const rg = rc.getContext('2d');
		const bands = ['#fa5252', '#f76707', '#ffd43b', '#37b24d', '#4dabf7', '#845ef7'];
		bands.forEach((c, i) => {
			rg.strokeStyle = c;
			rg.lineWidth = 7;
			rg.beginPath();
			rg.arc(128, 128, 112 - i * 7, Math.PI, 0);
			rg.stroke();
		});
		const rt = new THREE.CanvasTexture(rc);
		rt.colorSpace = THREE.SRGBColorSpace;
		this.rainbowMat = new THREE.MeshBasicMaterial({ map: rt, transparent: true, opacity: 0, side: THREE.DoubleSide });
		this.rainbow = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), this.rainbowMat);
		this.rainbow.position.set(14, 5.5, 14);
		this.rainbow.rotation.y = Math.PI / 4;
		this.obj.add(this.rainbow);
	}

	kindFor(cyc) {
		if (this.forceRain) return 'rain';
		const r = hash(cyc * 7 + 1, 313);
		if (r < 0.5) return 'clear';
		if (r < 0.72) return 'cloudy';
		if (r < 0.93) return 'rain';
		return 'snow';
	}

	resetDrop(d, anywhere) {
		d.position.set(Math.random() * 54 - 2, anywhere ? Math.random() * 12 + 2 : 12 + Math.random() * 3, Math.random() * 54 - 2);
	}

	update(dt, t) {
		const cyc = Math.floor(t / WEATHER_MS);
		const into = (t % WEATHER_MS) / 1000;
		const kind = this.kindFor(cyc);
		const ramp = Math.min(1, into / 6, (WEATHER_MS / 1000 - into) / 6);

		const targets = { clear: 1, cloudy: 0.78, rain: 0.55, snow: 0.72 };
		this.light += ((1 - ramp) + targets[kind] * ramp - this.light) * Math.min(1, dt * 2);

		if (this.clouds) {
			const grey = kind === 'clear' ? 0 : ramp * (kind === 'cloudy' ? 0.5 : 0.75);
			this.clouds.mat.color.lerpColors(new THREE.Color('#ffffff'), new THREE.Color('#8b95a5'), grey);
		}

		this.rainMat.opacity = kind === 'rain' ? ramp * 0.7 : 0;
		this.snowMat.opacity = kind === 'snow' ? ramp * 0.95 : 0;
		if (kind === 'rain') {
			for (const d of this.rain.children) {
				d.position.y -= dt * 17;
				if (d.position.y < 0.2) this.resetDrop(d);
			}
		}
		if (kind === 'snow') {
			for (const d of this.snow.children) {
				d.position.y -= dt * 1.7;
				d.position.x += Math.sin(t / 700 + d.position.z) * dt * 0.7;
				if (d.position.y < 0.1) this.resetDrop(d);
			}
		}

		// rainbow: shows as a rain system clears in daylight
		const prevWasRain = this.kindFor(cyc - 1) === 'rain' && !this.forceRain;
		const rb = prevWasRain && into < 24 ? Math.min(1, into / 5, (24 - into) / 8) : 0;
		this.rainbowMat.opacity = rb * 0.55 * this.light;
	}
}

// -------------------------------------------------- underground animations
class DragonAnim extends Entity3D {
	constructor(a) {
		super();
		this.obj.userData.pick = null;
		this.a = a;
		this.embers = [];
		for (let i = 0; i < 4; i++) {
			const e = new THREE.Mesh(
				new THREE.BoxGeometry(0.14, 0.14, 0.14),
				new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff8c2e' : '#ffb52e', transparent: true })
			);
			this.embers.push(e);
			this.obj.add(e);
		}
	}
	update(dt, t) {
		const breathe = 1 + Math.sin(t / 1400) * 0.04;
		this.a.body.scale.set(1.5 * breathe, 0.75 * breathe, 0.7);
		this.a.eye.material.opacity = 1;
		this.a.eye.scale.y = 0.4 + Math.max(0, Math.sin(t / 5200)) * 0.8; // slow blink
		this.embers.forEach((e, i) => {
			const k = ((t / 2200) + i / 4) % 1;
			e.position.set(this.a.snout.x + k * 0.9, this.a.snout.y + k * 1.6, this.a.snout.z);
			e.material.opacity = 0.8 * (1 - k);
			const s = 0.6 + k;
			e.scale.set(s, s, s);
		});
	}
}

class ElevatorAnim extends Entity3D {
	constructor(a) {
		super();
		this.obj.userData.pick = null;
		this.a = a;
	}
	update(dt, t) {
		// long slow round trips; the passenger only rides sometimes
		const k = (t % 26000) / 26000;
		const y = -2 - Math.abs(Math.sin(k * Math.PI * 2)) * 13.5;
		this.a.cage.position.y = y;
		this.a.passenger.visible = Math.floor(t / 26000) % 2 === 0;
	}
}

class CartAnim extends Entity3D {
	constructor(cart) {
		super();
		this.obj.userData.pick = null;
		this.cart = cart;
	}
	update(dt, t) {
		const k = (t % 17000) / 17000;
		const s = Math.sin(k * Math.PI * 2);
		this.cart.position.x = 27.6 + s * 3.4;
		this.cart.rotation.z = Math.cos(k * Math.PI * 2) * 0.02;
	}
}

class CrystalGlow extends Entity3D {
	constructor(crystals) {
		super();
		this.obj.userData.pick = null;
		this.crystals = crystals;
	}
	update(dt, t) {
		this.crystals.forEach((c, i) => {
			c.material.opacity = 0.65 + Math.sin(t / 700 + i * 1.7) * 0.3;
		});
	}
}

// ---------------------------------------------------------------- fireworks
// Shows after dark (and always with #fireworks). Rockets, bursts, oohs.
class Fireworks extends Entity3D {
	constructor() {
		super();
		this.obj.userData.pick = null;
		this.force = location.hash.includes('fireworks');
		this.pool = [];
		for (let i = 0; i < 150; i++) {
			const m = new THREE.Mesh(
				new THREE.BoxGeometry(0.16, 0.16, 0.16),
				new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 })
			);
			m.visible = false;
			this.pool.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
			this.obj.add(m);
		}
		this.rockets = [];
		this.nextLaunch = 0;
		this.cols = ['#ff5ea8', '#ffd43b', '#4dd4e8', '#8ce99a', '#b197fc', '#ff8c2e'];
	}

	spawn(x, y, z, col, vx, vy, vz, life) {
		const p = this.pool.find((q) => q.life <= 0);
		if (!p) return;
		Object.assign(p, { vx, vy, vz, life, max: life });
		p.mesh.position.set(x, y, z);
		p.mesh.material.color.set(col);
		p.mesh.visible = true;
	}

	update(dt, t) {
		const { f } = dayPhase(t);
		const showTime = this.force || (f < 0.25 && (t % 45000) < 14000);
		if (showTime && t > this.nextLaunch) {
			this.nextLaunch = t + 1100 + Math.random() * 1500;
			this.rockets.push({
				x: 12 + Math.random() * 26, z: 12 + Math.random() * 26,
				y: 2, vy: 8 + Math.random() * 3,
				burstY: 9 + Math.random() * 5,
				col: this.cols[Math.floor(Math.random() * this.cols.length)],
			});
		}
		for (const r of this.rockets) {
			r.y += r.vy * dt;
			if (Math.random() < 0.5) this.spawn(r.x, r.y - 0.3, r.z, '#fff3bf', 0, -1, 0, 0.35);
			if (r.y >= r.burstY) {
				r.dead = true;
				for (let i = 0; i < 26; i++) {
					const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
					const sp = 3.5 + Math.random() * 2.5;
					this.spawn(r.x, r.y, r.z, r.col,
						Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp, 1.5);
				}
			}
		}
		this.rockets = this.rockets.filter((r) => !r.dead);
		for (const p of this.pool) {
			if (p.life <= 0) continue;
			p.life -= dt;
			p.vy -= 3.5 * dt;
			p.mesh.position.x += p.vx * dt;
			p.mesh.position.y += p.vy * dt;
			p.mesh.position.z += p.vz * dt;
			p.mesh.material.opacity = Math.max(0, p.life / p.max);
			if (p.life <= 0) p.mesh.visible = false;
		}
	}
}

// ---------------------------------------------------------------- busker
// Six-String Sam. Click to start the tune (WebAudio square-wave folk),
// click again for another line — the song survives until you stop him.
class Busker extends Entity3D {
	constructor() {
		super();
		const parts = buildPerson(this.obj, BUSKER);
		this.dots = parts.dots;
		parts.legL.visible = parts.legR.visible = true;
		// guitar
		const gtr = vox(0.5, 0.34, 0.1, mat('#8a5a33'), 0.05, 0.5, 0.2, false);
		gtr.rotation.z = -0.35;
		const neck = vox(0.5, 0.07, 0.06, mat('#5c3a1e'), -0.3, 0.68, 0.2, false);
		neck.rotation.z = -0.35;
		this.obj.add(gtr, neck);
		this.obj.position.set(10.3, 0, 23.2);
		this.obj.rotation.y = 0.7;
		// open guitar case with a coin
		const kase = vox(0.6, 0.08, 0.34, mat('#3e2c1c'), 0.9, 0.04, 0.5, false);
		const coin = vox(0.1, 0.05, 0.1, bmat('#ffd43b'), 0.85, 0.1, 0.5, false);
		this.obj.add(kase, coin);
		// floating notes
		this.notes = [];
		const nc = document.createElement('canvas');
		nc.width = 32; nc.height = 32;
		const ng = nc.getContext('2d');
		ng.font = 'bold 26px monospace';
		ng.fillStyle = '#1b2a4a';
		ng.fillText('♪', 5, 26);
		const ntex = new THREE.CanvasTexture(nc);
		for (let i = 0; i < 3; i++) {
			const n = new THREE.Mesh(
				new THREE.PlaneGeometry(0.4, 0.4),
				new THREE.MeshBasicMaterial({ map: ntex, transparent: true, opacity: 0 })
			);
			this.notes.push(n);
			this.obj.add(n);
		}
		this.playing = false;
		this.audio = null;
		this.nextNote = 0;
		this.step = 0;
		this.lineIdx = -1;
		// C major pentatonic ramble
		this.tune = [0, 4, 7, 9, 7, 4, 12, 9, 7, 4, 0, 4, 7, 16, 12, 9];
	}

	startAudio() {
		if (!this.audio) {
			this.audio = new (window.AudioContext || window.webkitAudioContext)();
			this.master = this.audio.createGain();
			this.master.gain.value = 0.05;
			this.master.connect(this.audio.destination);
		}
		this.audio.resume();
	}

	note(freq, when, dur, type = 'square', vol = 1) {
		const o = this.audio.createOscillator();
		const gn = this.audio.createGain();
		o.type = type;
		o.frequency.value = freq;
		gn.gain.setValueAtTime(0.0001, when);
		gn.gain.linearRampToValueAtTime(vol, when + 0.01);
		gn.gain.exponentialRampToValueAtTime(0.0001, when + dur);
		o.connect(gn);
		gn.connect(this.master);
		o.start(when);
		o.stop(when + dur + 0.05);
	}

	update(dt, t) {
		// schedule ahead while playing
		if (this.playing && this.audio) {
			const now = this.audio.currentTime;
			while (this.nextNote < now + 0.4) {
				const semi = this.tune[this.step % this.tune.length];
				const jitter = Math.random() < 0.12 ? 2 : 0;
				this.note(261.6 * Math.pow(2, (semi + jitter + 12) / 12), this.nextNote, 0.22, 'square', 0.8);
				if (this.step % 4 === 0) {
					this.note(261.6 * Math.pow(2, (this.step % 8 === 0 ? 0 : 7) / 12) / 2, this.nextNote, 0.4, 'triangle', 1.2);
				}
				this.nextNote += 0.24;
				this.step++;
			}
		}
		this.notes.forEach((n, i) => {
			const k = ((t / 2400) + i / 3) % 1;
			n.position.set(0.4 + Math.sin(k * 5 + i) * 0.2, 1.3 + k * 1.2, 0.2);
			n.material.opacity = this.playing ? Math.min(1, (1 - k) * 1.5) * 0.9 : 0;
			n.lookAt(n.position.x + 1, n.position.y + 0.7, n.position.z + 1);
		});
		this.obj.rotation.z = this.playing ? Math.sin(t / 260) * 0.03 : 0;
	}

	interact() {
		this.startAudio();
		this.playing = !this.playing;
		if (this.playing && this.audio) this.nextNote = this.audio.currentTime + 0.05;
		this.lineIdx = (this.lineIdx + 1) % BUSKER.lines.length;
		const status = this.playing ? ' 🎵' : ' (…and that’s the set. click for an encore.)';
		return { name: BUSKER.name, line: BUSKER.lines[this.lineIdx] + status };
	}
}

// ---------------------------------------------------------------- dogs
class Dog extends Entity3D {
	constructor(cfg, i) {
		super();
		this.cfg = cfg;
		const c = mat(cfg.col);
		this.obj.add(vox(0.26, 0.24, 0.55, c, 0, 0.26, 0));
		this.obj.add(vox(0.26, 0.26, 0.24, c, 0, 0.42, 0.35));
		this.obj.add(vox(0.14, 0.12, 0.14, mat(cfg.patch || cfg.col), 0, 0.36, 0.5, false)); // snout
		this.obj.add(vox(0.08, 0.14, 0.06, mat(cfg.ear), -0.09, 0.58, 0.32, false));
		this.obj.add(vox(0.08, 0.14, 0.06, mat(cfg.ear), 0.09, 0.58, 0.32, false));
		this.tail = vox(0.07, 0.07, 0.26, c, 0, 0.34, -0.38, false);
		this.obj.add(this.tail);
		this.legs = [];
		for (const [lx, lz] of [[-0.09, 0.2], [0.09, 0.2], [-0.09, -0.2], [0.09, -0.2]]) {
			const leg = vox(0.09, 0.16, 0.09, c, lx, 0.08, lz, false);
			this.legs.push(leg);
			this.obj.add(leg);
		}
		this.x = DOG_PARK.x0 + hash(i, 1) * (DOG_PARK.x1 - DOG_PARK.x0);
		this.z = DOG_PARK.z0 + hash(i, 2) * (DOG_PARK.z1 - DOG_PARK.z0);
		this.pickTarget();
		this.zoomUntil = 0;
		this.restUntil = 0;
	}

	pickTarget() {
		this.tx = DOG_PARK.x0 + Math.random() * (DOG_PARK.x1 - DOG_PARK.x0);
		this.tz = DOG_PARK.z0 + Math.random() * (DOG_PARK.z1 - DOG_PARK.z0);
	}

	update(dt, t) {
		const zooming = t < this.zoomUntil;
		const resting = t < this.restUntil;
		if (!resting) {
			const speed = this.cfg.speed * (zooming ? 3.2 : 1);
			const d = Math.hypot(this.tx - this.x, this.tz - this.z);
			if (d < 0.15) {
				const r = Math.random();
				if (r < 0.18) this.zoomUntil = t + 2600; // ZOOMIES
				else if (r < 0.45) this.restUntil = t + 1500 + Math.random() * 2500;
				this.pickTarget();
			} else {
				this.x += ((this.tx - this.x) / d) * speed * dt;
				this.z += ((this.tz - this.z) / d) * speed * dt;
				this.obj.rotation.y = Math.atan2(this.tx - this.x, this.tz - this.z);
			}
		}
		this.obj.position.set(this.x, 0, this.z);
		const wag = Math.sin(t / (zooming ? 60 : 160)) * 0.5;
		this.tail.rotation.y = wag;
		const step = resting ? 0 : Math.sin(t / (zooming ? 50 : 110)) * 0.05;
		this.legs.forEach((l, i2) => { l.position.y = 0.08 + (i2 % 2 ? step : -step); });
	}

	interact() {
		return { name: this.cfg.name, line: DOG_LINES[Math.floor(Math.random() * DOG_LINES.length)] };
	}
}

// ---------------------------------------------------------------- factory
export function createLife(gfx, anchors, wall) {
	const list = [];
	const clouds = new Clouds();
	const weather = new Weather(clouds);
	list.push(new SkyCycle(gfx, weather), weather);
	CITIZENS.forEach((c, i) => list.push(new Citizen(c, i)));
	CARS.forEach((c) => list.push(new Car(c)));
	list.push(new Cat(), new Boat(), new DuckFamily(), clouds, new Balloon(), new Birds(), new Ufo());
	list.push(new Fireworks(), new Busker());
	DOGS.forEach((d, i) => list.push(new Dog(d, i)));
	if (anchors.mine) list.push(new Miner(anchors.mine, anchors.mineWheel));
	if (anchors.dragon) list.push(new DragonAnim(anchors.dragon));
	if (anchors.elevator) list.push(new ElevatorAnim(anchors.elevator));
	if (anchors.minecart) list.push(new CartAnim(anchors.minecart));
	if (anchors.crystals) list.push(new CrystalGlow(anchors.crystals));
	if (anchors.chimney) list.push(new Smoke(anchors.chimney));
	if (anchors.fountain) list.push(new FountainJet(anchors.fountain));
	if (anchors.flag) list.push(new Flapper(anchors.flag));
	if (anchors.wembleFlag) list.push(new Flapper(anchors.wembleFlag, 380));
	if (anchors.beacon) list.push(new Blinker(anchors.beacon));
	if (anchors.arcadeCanvas) list.push(new MarqueeAnim(anchors.arcadeCanvas, anchors.arcadeTex));
	if (anchors.clockCanvas) list.push(new ClockAnim(anchors.clockCanvas, anchors.clockTex));
	if (anchors.wallTex) list.push(new WallSync(wall, anchors.wallTex));
	for (const e of list) gfx.scene.add(e.obj);
	return list;
}
