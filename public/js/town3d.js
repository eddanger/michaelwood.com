// town3d.js — the static town: ground, the deep island block (underground
// cross-sections as side textures), voxel buildings with painted facades,
// and instanced forests. Grid (gx,gy) maps to world (x, z); 1 tile = 1 unit.

import { THREE } from './gfx.js';
import { GRID, BUILDINGS, OAKS, tileType, inBuildingZone, hash, DIRT_LOT } from './data.js';
import {
	paintGround, paintUnderground, UNDER_DEPTH, facade, shopFacade,
	garageFacade, postFacade, wembleFacade, cinemaFacade, arcadeFacade,
	townhallFacade, houseFacade, clockFace,
	skyscraperFacade, apartmentFacade, hotelFacade, neonFacade,
} from './painters.js';

function tex(canvas) {
	const t = new THREE.CanvasTexture(canvas);
	t.magFilter = THREE.NearestFilter;
	t.minFilter = THREE.NearestFilter;
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

const mat = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
const matT = (texture) => new THREE.MeshLambertMaterial({ map: texture });
const dark = (hex, f) => new THREE.Color(hex).multiplyScalar(f);

function boxMesh(w, h, d, materials, castShadow = true) {
	const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials);
	m.castShadow = castShadow;
	m.receiveShadow = true;
	return m;
}

// building box: painted facade on +z, tinted walls elsewhere
function bldgBox(b, facadeCanvas, wallColor, roofColor) {
	const side = mat(dark(wallColor, 0.82));
	const materials = [side, side, mat(roofColor), side, matT(tex(facadeCanvas)), mat(dark(wallColor, 0.7))];
	const m = boxMesh(b.w, b.h, b.d, materials);
	m.position.set(b.gx + b.w / 2, b.h / 2, b.gy + b.d / 2);
	return m;
}

export function buildTown(scene, wallCanvas) {
	const pickables = [];
	const anchors = {};
	const root = new THREE.Group();
	scene.add(root);

	// ------------------------------------------------------------ ground
	const groundTex = tex(paintGround());
	const ground = new THREE.Mesh(
		new THREE.PlaneGeometry(GRID, GRID),
		new THREE.MeshLambertMaterial({ map: groundTex })
	);
	ground.rotation.x = -Math.PI / 2;
	ground.position.set(GRID / 2, 0, GRID / 2);
	ground.receiveShadow = true;
	ground.userData.pick = { type: 'ground' };
	root.add(ground);
	pickables.push(ground);

	// ------------------------------------------------------- island block
	const southTex = tex(paintUnderground(false));
	const eastTex = tex(paintUnderground(true));
	const deepMat = new THREE.MeshBasicMaterial({ color: '#241d16' });
	const island = new THREE.Mesh(new THREE.BoxGeometry(GRID, UNDER_DEPTH, GRID), [
		new THREE.MeshBasicMaterial({ map: eastTex }),   // +x east
		deepMat,                                          // -x
		deepMat,                                          // +y (hidden under ground)
		new THREE.MeshBasicMaterial({ color: '#7a1f0e' }), // -y magma bottom
		new THREE.MeshBasicMaterial({ map: southTex }),  // +z south
		deepMat,                                          // -z
	]);
	island.position.set(GRID / 2, -UNDER_DEPTH / 2 - 0.01, GRID / 2);
	root.add(island);

	// ------------------------------------------------------------ water
	// slightly raised lake plane so boats/ducks sit on something shiny
	// (the lake is painted into the ground texture; this adds a shimmer layer)
	const lakeGlint = new THREE.Mesh(
		new THREE.PlaneGeometry(GRID, GRID),
		new THREE.MeshBasicMaterial({ color: '#7cd0f5', transparent: true, opacity: 0.12 })
	);
	lakeGlint.rotation.x = -Math.PI / 2;
	lakeGlint.position.set(GRID / 2, 0.02, GRID / 2);
	root.add(lakeGlint);

	// ---------------------------------------------------------- buildings
	for (const b of BUILDINGS) {
		const g = new THREE.Group();
		g.userData.pick = { type: 'building', b };
		buildKind(g, b, anchors, wallCanvas);
		root.add(g);
		pickables.push(g);
	}

	// -------------------------------------------------- underground, in 3D
	buildUnderground(root, anchors);

	// ------------------------------------------------ street clutter
	addStreetProps(root, anchors);

	// ------------------------------------------------------------- trees
	plantForest(root);
	for (const [ox, oy] of OAKS) root.add(oakTree(ox + 0.5, oy + 0.5));
	for (const l of LAMP_SPOTS) root.add(lamp(l[0], l[1]));

	// ------------------------------------------------------------ flowers
	const flowerGroup = new THREE.Group();
	root.add(flowerGroup);
	function addFlower(x, z) {
		const cols = ['#e0447c', '#f59f00', '#ae3ec9', '#fa5252', '#4dabf7', '#ffffff'];
		const f = new THREE.Group();
		const stem = boxMesh(0.05, 0.22, 0.05, mat('#2b8a3e'), false);
		stem.position.y = 0.11;
		const head = boxMesh(0.18, 0.16, 0.18, mat(cols[Math.floor(Math.random() * cols.length)]), false);
		head.position.y = 0.3;
		f.add(stem, head);
		f.position.set(x, 0, z);
		flowerGroup.add(f);
		if (flowerGroup.children.length > 400) flowerGroup.remove(flowerGroup.children[0]);
	}
	// pre-seeded meadow flowers
	for (let gy = 0; gy < GRID; gy++) {
		for (let gx = 0; gx < GRID; gx++) {
			if (tileType(gx, gy) !== 0 || inBuildingZone(gx, gy)) continue;
			const r = hash(gx * 3 + 1, gy * 5 + 2);
			if (r >= 0.13 && r < 0.165) addFlower(gx + 0.3 + hash(gx, gy * 7) * 0.4, gy + 0.6);
		}
	}

	return { pickables, anchors, addFlower };
}

// ---------------------------------------------------------------- kinds
function buildKind(g, b, anchors, wallCanvas) {
	const H = b.h, cx = b.gx + b.w / 2, cz = b.gy + b.d / 2;
	const kind = b.kind;

	if (kind === 'shop') {
		g.add(bldgBox(b, facade(b.w, H * 16, shopFacade(b.shop)), b.wall, b.roof));
		return;
	}

	if (kind === 'garage') {
		g.add(bldgBox(b, facade(b.w, H * 16, garageFacade), '#aab2c0', '#c3cad6'));
		const pole = boxMesh(0.06, 0.8, 0.06, mat('#444'));
		pole.position.set(b.gx + 0.7, H + 0.4, b.gy + 0.7);
		g.add(pole);
		const beacon = boxMesh(0.16, 0.16, 0.16, new THREE.MeshBasicMaterial({ color: '#ff6b6b' }));
		beacon.position.set(b.gx + 0.7, H + 0.85, b.gy + 0.7);
		g.add(beacon);
		anchors.beacon = beacon;
		// the little robot (bobs via BotBob)
		const bot = new THREE.Group();
		const body = boxMesh(0.34, 0.34, 0.26, mat('#4dd4e8'));
		body.position.y = 0.38;
		const eye1 = boxMesh(0.07, 0.07, 0.05, new THREE.MeshBasicMaterial({ color: '#1b2a4a' }));
		eye1.position.set(-0.07, 0.44, 0.14);
		const eye2 = eye1.clone();
		eye2.position.x = 0.07;
		const leg1 = boxMesh(0.09, 0.22, 0.09, mat('#37b6c9'));
		leg1.position.set(-0.09, 0.11, 0);
		const leg2 = leg1.clone();
		leg2.position.x = 0.09;
		bot.add(body, eye1, eye2, leg1, leg2);
		bot.position.set(b.gx + b.w - 0.6, 0, b.gy + b.d + 0.35);
		g.add(bot);
		anchors.bot = bot;
		return;
	}

	if (kind === 'post') {
		g.add(bldgBox(b, facade(b.w, H * 16, postFacade), '#f4e3c2', '#f4e3c2'));
		const roof = boxMesh(b.w + 0.3, 0.32, b.d + 0.3, mat('#4d79c7'));
		roof.position.set(cx, H + 0.16, cz);
		g.add(roof);
		const pole = boxMesh(0.06, 1.5, 0.06, mat('#555'));
		pole.position.set(b.gx + b.w - 0.3, H + 1, b.gy + 0.3);
		g.add(pole);
		const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.45), new THREE.MeshBasicMaterial({ color: '#e0447c', side: THREE.DoubleSide }));
		flag.position.set(b.gx + b.w + 0.13, H + 1.5, b.gy + 0.3);
		g.add(flag);
		anchors.flag = flag;
		return;
	}

	if (kind === 'graffiti') {
		const wallTex = tex(wallCanvas);
		anchors.wallTex = wallTex;
		const side = mat('#8e939b');
		const m = boxMesh(b.w, H, b.d, [side, side, mat('#b0b4ba'), side, matT(wallTex), mat('#9aa0a8')]);
		m.position.set(cx, H / 2, cz);
		g.add(m);
		// spray cans at the base
		const canCols = ['#e0447c', '#4dabf7', '#ffd43b'];
		for (let i = 0; i < 3; i++) {
			const can = boxMesh(0.14, 0.3, 0.14, mat(canCols[i]));
			can.position.set(b.gx + 0.5 + i * 0.3, 0.15, b.gy + b.d + 0.25);
			g.add(can);
		}
		return;
	}

	if (kind === 'fountain') {
		const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.35, 10), mat('#a8a396'));
		ring.position.set(cx, 0.17, cz);
		ring.castShadow = true;
		const water = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 10), mat('#45b5ea'));
		water.position.set(cx, 0.24, cz);
		const pillar = boxMesh(0.3, 0.9, 0.3, mat('#8f8a7e'));
		pillar.position.set(cx, 0.45, cz);
		g.add(ring, water, pillar);
		anchors.fountain = { x: cx, y: 1, z: cz };
		return;
	}

	if (kind === 'townhall') {
		g.add(bldgBox(b, facade(b.w, H * 16, townhallFacade), '#9a5e4a', '#6f4a28'));
		const clockCanvas = facade(2, 1.4 * 16, clockFace);
		anchors.clockCanvas = clockCanvas;
		const clockTex = tex(clockCanvas);
		anchors.clockTex = clockTex;
		const side = mat('#8a5342');
		const tower = boxMesh(2, 1.4, 2, [side, side, mat('#f1eee6'), side, matT(clockTex), side]);
		tower.position.set(b.gx + 3, H + 0.7, b.gy + 2.5);
		// front steps + railings (ref #2)
		const steps = boxMesh(b.w * 0.55, 0.18, 0.55, mat('#e9e4d8'));
		steps.position.set(cx, 0.09, b.gy + b.d + 0.2);
		const railL = boxMesh(0.06, 0.55, 0.06, mat('#f1eee6'));
		railL.position.set(cx - b.w * 0.22, 0.4, b.gy + b.d + 0.35);
		const railR = railL.clone();
		railR.position.x = cx + b.w * 0.22;
		g.add(tower, steps, railL, railR);
		return;
	}

	if (kind === 'house') {
		g.add(bldgBox(b, facade(b.w, H * 16, houseFacade), '#9a5e4a', '#6f4a28'));
		const chim = boxMesh(0.35, 0.7, 0.35, mat('#9a6348'));
		chim.position.set(b.gx + 0.6, H + 0.35, b.gy + 0.5);
		g.add(chim);
		anchors.chimney = { x: b.gx + 0.6, y: H + 0.75, z: b.gy + 0.5 };
		return;
	}

	if (kind === 'wemble') {
		g.add(bldgBox(b, facade(b.w, H * 16, wembleFacade), '#e5e7eb', '#f3f4f6'));
		const pole = boxMesh(0.06, 1, 0.06, mat('#555'));
		pole.position.set(b.gx + 0.4, H + 0.5, b.gy + 0.4);
		const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), new THREE.MeshBasicMaterial({ color: '#2563eb', side: THREE.DoubleSide }));
		flag.position.set(b.gx + 0.78, H + 0.85, b.gy + 0.4);
		// rooftop helipad joke + AC units
		const pad = boxMesh(1.2, 0.06, 1.2, mat('#343a40'));
		pad.position.set(cx, H + 0.03, cz);
		const Hmark = boxMesh(0.5, 0.02, 0.08, new THREE.MeshBasicMaterial({ color: '#ffd43b' }), false);
		Hmark.position.set(cx, H + 0.08, cz);
		const Hmark2 = boxMesh(0.08, 0.02, 0.5, new THREE.MeshBasicMaterial({ color: '#ffd43b' }), false);
		Hmark2.position.set(cx, H + 0.08, cz);
		const ac = boxMesh(0.5, 0.3, 0.4, mat('#868e96'));
		ac.position.set(b.gx + b.w - 0.7, H + 0.15, b.gy + 0.6);
		g.add(pole, flag, pad, Hmark, Hmark2, ac);
		anchors.wembleFlag = flag;
		return;
	}

	if (kind === 'cinema') {
		g.add(bldgBox(b, facade(b.w, H * 16, cinemaFacade), '#c94f7c', '#a83f66'));
		// marquee ledge + blinky bulbs
		const ledge = boxMesh(b.w * 0.9, 0.12, 0.5, mat('#12131a'));
		ledge.position.set(cx, H * 0.68, b.gy + b.d + 0.25);
		g.add(ledge);
		const bulbs = [];
		for (let i = 0; i < 9; i++) {
			const bulb = boxMesh(0.12, 0.12, 0.12, new THREE.MeshBasicMaterial({ color: '#ffd43b' }), false);
			bulb.position.set(b.gx + 0.55 + i * 0.48, H * 0.68 + 0.12, b.gy + b.d + 0.48);
			g.add(bulb);
			bulbs.push(bulb);
		}
		anchors.marquee = bulbs;
		return;
	}

	if (kind === 'arcade') {
		const canvas = facade(b.w, H * 16, (g2, U, h2) => arcadeFacade(g2, U, h2, 0));
		anchors.arcadeCanvas = canvas;
		const t = tex(canvas);
		anchors.arcadeTex = t;
		const side = mat(dark('#5f3dc4', 0.82));
		const m = boxMesh(b.w, H, b.d, [side, side, mat('#5f3dc4'), side, matT(t), side]);
		m.position.set(cx, H / 2, cz);
		g.add(m);
		return;
	}

	if (kind === 'construction') {
		// fence
		const fenceMat = mat('#e8590c');
		for (let i = 0; i <= b.w; i++) {
			const p1 = boxMesh(0.08, 0.4, 0.08, fenceMat);
			p1.position.set(b.gx + i, 0.2, b.gy + b.d);
			const p2 = boxMesh(0.08, 0.4, 0.08, fenceMat);
			p2.position.set(b.gx + b.w, 0.2, b.gy + i);
			g.add(p1, p2);
		}
		// crane (jib/cable/block swing via CraneAnim)
		const craneMat = mat('#f59f00');
		const mast = boxMesh(0.18, b.h, 0.18, craneMat);
		mast.position.set(b.gx + 0.8, b.h / 2, b.gy + 0.8);
		const jib = boxMesh(3, 0.14, 0.14, craneMat);
		jib.position.set(b.gx + 0.8 + 1.2, b.h - 0.2, b.gy + 0.8);
		const cable = boxMesh(0.03, 1.4, 0.03, mat('#666'));
		cable.position.set(b.gx + 2.6, b.h - 0.9 - 0.5, b.gy + 0.8);
		const block = boxMesh(0.5, 0.4, 0.5, mat('#868e96'));
		block.position.set(b.gx + 2.6, b.h - 1.8, b.gy + 0.8);
		g.add(mast, jib, cable, block);
		anchors.crane = {
			jib, cable, block,
			pivotX: b.gx + 0.8, pivotY: b.h - 0.2, pivotZ: b.gy + 0.8,
			jibLen: 1.2, tipLen: 1.8, cableDrop: 1.4, blockDrop: 1.6,
		};
		// sign
		const signCanvas = facade(2, 20, (g2) => {
			g2.fillStyle = '#ffd43b';
			g2.fillRect(0, 0, 32, 20);
			g2.fillStyle = '#1b2a4a';
			g2.font = 'bold 5px monospace';
			g2.fillText('FUTURE WEIRD', 2, 8);
			g2.fillText('IDEA HERE', 6, 15);
		});
		const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), matT(tex(signCanvas)));
		sign.position.set(b.gx + b.w - 1, 0.7, b.gy + b.d + 0.01);
		const legs = boxMesh(0.08, 0.5, 0.08, mat('#8a5a33'));
		legs.position.set(b.gx + b.w - 1, 0.25, b.gy + b.d - 0.05);
		g.add(sign, legs);
		return;
	}

	if (kind === 'greenhouse') {
		const glass = new THREE.Mesh(
			new THREE.BoxGeometry(b.w, H, b.d),
			new THREE.MeshLambertMaterial({ color: '#9fe3d0', transparent: true, opacity: 0.65 })
		);
		glass.position.set(cx, H / 2, cz);
		glass.castShadow = true;
		const ridge = boxMesh(b.w, 0.08, 0.14, mat('#e6fcf5'));
		ridge.position.set(cx, H + 0.04, cz);
		g.add(glass, ridge);
		// crop rows
		for (let row = 0; row < 2; row++) {
			for (let i = 0; i < 6; i++) {
				const soil = boxMesh(0.3, 0.1, 0.18, mat('#8a5a33'), false);
				soil.position.set(b.gx + 0.5 + i * 0.55, 0.05, b.gy + b.d + 0.8 + row);
				const sprout = boxMesh(0.16, 0.16, 0.12, mat(row ? '#37b24d' : '#e0447c'), false);
				sprout.position.set(b.gx + 0.5 + i * 0.55, 0.2, b.gy + b.d + 0.8 + row);
				g.add(soil, sprout);
			}
		}
		return;
	}

	if (kind === 'dogpark') {
		const post = mat('#8a5a33');
		const railM = mat('#a06b3f');
		// perimeter fence with a gap for the gate (south side, middle)
		const step = 1;
		for (let i = 0; i <= b.w; i += step) {
			for (const [px, pz, skip] of [
				[b.gx + i, b.gy, false],
				[b.gx + i, b.gy + b.d, Math.abs(i - b.w / 2) < 0.6],
				[b.gx, b.gy + Math.min(i, b.d), false],
				[b.gx + b.w, b.gy + Math.min(i, b.d), false],
			]) {
				if (skip) continue;
				const p = boxMesh(0.09, 0.55, 0.09, post);
				p.position.set(px, 0.27, pz);
				g.add(p);
			}
		}
		for (const [rx, rz, rw, rd] of [
			[b.gx + b.w / 2, b.gy, b.w, 0.06],
			[b.gx + b.w / 2 - 1.3, b.gy + b.d, b.w - 2.6 < 0 ? 0 : b.w / 2 - 0.6, 0.06],
			[b.gx + b.w / 2 + 1.3, b.gy + b.d, b.w / 2 - 0.6, 0.06],
			[b.gx, b.gy + b.d / 2, 0.06, b.d],
			[b.gx + b.w, b.gy + b.d / 2, 0.06, b.d],
		]) {
			if (!rw || !rd) continue;
			const r = boxMesh(rw, 0.07, rd, railM, false);
			r.position.set(rx, 0.44, rz);
			g.add(r);
		}
		// ceremonial hydrant
		const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8), mat('#e03131'));
		hyd.position.set(b.gx + 1, 0.25, b.gy + 1);
		hyd.castShadow = true;
		const hydCap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.2, 8), mat('#c92a2a'));
		hydCap.position.set(b.gx + 1, 0.58, b.gy + 1);
		g.add(hyd, hydCap);
		// water bowl
		const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.12, 8), mat('#4dabf7'));
		bowl.position.set(b.gx + b.w - 1, 0.06, b.gy + 0.8);
		g.add(bowl);
		// sign over the gate
		const signCanvas = facade(3, 12, (g2) => {
			g2.fillStyle = '#8a5a33';
			g2.fillRect(0, 0, 48, 12);
			g2.fillStyle = '#ffe8cc';
			g2.font = 'bold 6px monospace';
			g2.fillText('DOG PARK', 7, 8.5);
		});
		const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), matT(tex(signCanvas)));
		sign.position.set(b.gx + b.w / 2, 0.95, b.gy + b.d + 0.01);
		const sp1 = boxMesh(0.08, 1.15, 0.08, post);
		sp1.position.set(b.gx + b.w / 2 - 0.85, 0.57, b.gy + b.d);
		const sp2 = sp1.clone();
		sp2.position.x = b.gx + b.w / 2 + 0.85;
		g.add(sign, sp1, sp2);
		return;
	}

	if (kind === 'mine') {
		// headframe straddling the shaft (which reaches the south cliff face)
		const MX = 22.7, MZ = 48.2;
		const timber = mat('#6f4a28');
		const hatch = boxMesh(1.1, 0.12, 1.1, new THREE.MeshBasicMaterial({ color: '#17110b' }), false);
		hatch.position.set(MX, 0.06, MZ);
		g.add(hatch);
		for (const [dx, dz] of [[-0.65, -0.5], [0.65, -0.5], [-0.65, 0.5], [0.65, 0.5]]) {
			const leg = boxMesh(0.14, 1.9, 0.14, timber);
			leg.position.set(MX + dx, 0.95, MZ + dz);
			leg.rotation.z = dx > 0 ? -0.18 : 0.18;
			g.add(leg);
		}
		const cross = boxMesh(1.7, 0.14, 0.14, timber);
		cross.position.set(MX, 1.85, MZ);
		g.add(cross);
		const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 10);
		wheelGeo.rotateX(Math.PI / 2); // axis along z so rotation.z spins it
		const wheel = new THREE.Mesh(wheelGeo, mat('#8a5a33'));
		wheel.position.set(MX, 2.15, MZ);
		wheel.castShadow = true;
		g.add(wheel);
		const rope = boxMesh(0.04, 1.9, 0.04, mat('#3e2c1c'), false);
		rope.position.set(MX, 1, MZ);
		g.add(rope);
		anchors.mineWheel = wheel;
		// MINE sign
		const signCanvas = facade(2, 12, (g2) => {
			g2.fillStyle = '#6f4a28';
			g2.fillRect(0, 0, 32, 12);
			g2.fillStyle = '#ffd43b';
			g2.font = 'bold 7px monospace';
			g2.fillText('MINE', 7, 9);
		});
		const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.5), matT(tex(signCanvas)));
		sign.position.set(MX, 1.5, MZ + 0.56);
		g.add(sign);
		// ore pile + a lantern
		for (const [ox, oz, oc] of [[-1.2, 0.9, '#5e6673'], [-0.9, 1.1, '#5e6673'], [-1.05, 0.75, '#ffd43b']]) {
			const ore = boxMesh(0.28, 0.22, 0.28, mat(oc));
			ore.position.set(MX + ox, 0.11, MZ + oz);
			g.add(ore);
		}
		const post = boxMesh(0.08, 1, 0.08, mat('#3e2c1c'));
		post.position.set(MX + 1.3, 0.5, MZ + 0.8);
		const lantern = boxMesh(0.18, 0.22, 0.18, new THREE.MeshBasicMaterial({ color: '#ffb52e' }));
		lantern.position.set(MX + 1.3, 1.05, MZ + 0.8);
		g.add(post, lantern);
		anchors.mine = { x: MX, z: MZ };
		return;
	}

	if (kind === 'watertower') {
		const legMat = mat('#5e6673');
		for (const [lx, lz] of [[0.3, 0.3], [1.7, 0.3], [0.3, 1.7], [1.7, 1.7]]) {
			const leg = boxMesh(0.1, 2.2, 0.1, legMat);
			leg.position.set(b.gx + lx, 1.1, b.gy + lz);
			g.add(leg);
		}
		const label = facade(6, 24, (g2, U, h2) => {
			g2.fillStyle = '#74c0fc';
			g2.fillRect(0, 0, U, h2);
			g2.fillStyle = '#1b2a4a';
			g2.font = 'bold 6px monospace';
			g2.fillText('WOODTOWN', 8, 14);
		});
		const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.3, 12), matT(tex(label)));
		tank.castShadow = true;
		tank.position.set(b.gx + 1, 2.85, b.gy + 1);
		const lid = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.4, 12), mat('#a5d8ff'));
		lid.position.set(b.gx + 1, 3.7, b.gy + 1);
		g.add(tank, lid);
		return;
	}

	if (kind === 'skyscraper') {
		g.add(bldgBox(b, facade(b.w, H * 16, skyscraperFacade(b)), b.wall, b.roof));
		// rooftop mechanicals + antenna (eBoy silhouette)
		const ac = boxMesh(0.55, 0.35, 0.45, mat('#868e96'));
		ac.position.set(b.gx + 0.6, H + 0.18, b.gy + 0.6);
		const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.45, 8), mat('#74c0fc'));
		tank.position.set(b.gx + b.w - 0.55, H + 0.25, b.gy + b.d - 0.55);
		const mast = boxMesh(0.06, 1.1, 0.06, mat('#adb5bd'));
		mast.position.set(cx, H + 0.7, cz);
		const blink = boxMesh(0.14, 0.14, 0.14, new THREE.MeshBasicMaterial({ color: '#ff6b6b' }), false);
		blink.position.set(cx, H + 1.25, cz);
		g.add(ac, tank, mast, blink);
		if (!anchors.skyBeacons) anchors.skyBeacons = [];
		anchors.skyBeacons.push(blink);
		// vertical neon strip on the street corner
		const strip = boxMesh(0.08, H * 0.7, 0.08, new THREE.MeshBasicMaterial({ color: b.neon || '#ff5ea8' }), false);
		strip.position.set(b.gx + 0.05, H * 0.45, b.gy + b.d + 0.04);
		g.add(strip);
		if (b.id === 'sky1') anchors.roofDeck = { x: cx, y: H + 0.05, z: cz };
		return;
	}

	if (kind === 'apartment') {
		g.add(bldgBox(b, facade(b.w, H * 16, apartmentFacade(b)), b.wall, b.roof));
		// rooftop clothesline + AC
		const pole1 = boxMesh(0.05, 0.5, 0.05, mat('#868e96'));
		pole1.position.set(b.gx + 0.4, H + 0.25, b.gy + 0.4);
		const pole2 = pole1.clone();
		pole2.position.set(b.gx + b.w - 0.4, H + 0.25, b.gy + b.d - 0.4);
		const line = boxMesh(b.w - 0.6, 0.03, 0.03, mat('#dee2e6'), false);
		line.position.set(cx, H + 0.48, cz);
		const sock = boxMesh(0.2, 0.28, 0.08, mat('#4dabf7'), false);
		sock.position.set(cx - 0.3, H + 0.35, cz);
		const sock2 = boxMesh(0.18, 0.24, 0.08, mat('#e0447c'), false);
		sock2.position.set(cx + 0.35, H + 0.33, cz);
		g.add(pole1, pole2, line, sock, sock2);
		return;
	}

	if (kind === 'hotel') {
		g.add(bldgBox(b, facade(b.w, H * 16, hotelFacade(b)), b.wall, b.roof));
		// rooftop pool (tiny blue rectangle — eBoy joke)
		const deck = boxMesh(b.w * 0.7, 0.06, b.d * 0.55, mat('#ced4da'));
		deck.position.set(cx, H + 0.03, cz);
		const pool = boxMesh(b.w * 0.45, 0.08, b.d * 0.3, new THREE.MeshBasicMaterial({ color: '#4dabf7' }), false);
		pool.position.set(cx, H + 0.08, cz);
		const umbrella = boxMesh(0.35, 0.05, 0.35, mat('#ff6b9d'), false);
		umbrella.position.set(cx + b.w * 0.22, H + 0.22, cz - b.d * 0.12);
		const upole = boxMesh(0.04, 0.25, 0.04, mat('#868e96'), false);
		upole.position.set(cx + b.w * 0.22, H + 0.12, cz - b.d * 0.12);
		g.add(deck, pool, umbrella, upole);
		// rooftop beacon
		const mast = boxMesh(0.05, 0.7, 0.05, mat('#adb5bd'));
		mast.position.set(b.gx + 0.3, H + 0.4, b.gy + 0.3);
		const blink = boxMesh(0.12, 0.12, 0.12, new THREE.MeshBasicMaterial({ color: b.accent || '#e0447c' }), false);
		blink.position.set(b.gx + 0.3, H + 0.8, b.gy + 0.3);
		g.add(mast, blink);
		if (!anchors.skyBeacons) anchors.skyBeacons = [];
		anchors.skyBeacons.push(blink);
		return;
	}

	if (kind === 'neon') {
		g.add(bldgBox(b, facade(b.w, H * 16, neonFacade(b)), b.wall, b.roof));
		// freestanding neon sign box on the roof
		const board = boxMesh(b.w * 0.8, 0.5, 0.12, new THREE.MeshBasicMaterial({ color: b.neon || '#ff5ea8' }), false);
		board.position.set(cx, H + 0.4, b.gy + b.d + 0.05);
		const board2 = boxMesh(b.w * 0.55, 0.28, 0.1, new THREE.MeshBasicMaterial({ color: b.neon2 || '#4dd4e8' }), false);
		board2.position.set(cx, H + 0.85, b.gy + b.d + 0.05);
		g.add(board, board2);
		if (!anchors.neonSigns) anchors.neonSigns = [];
		anchors.neonSigns.push(board, board2);
		return;
	}

	if (kind === 'radio') {
		// lattice mast with guy-wire vibe and blinking tip
		const base = boxMesh(b.w * 0.7, 0.25, b.d * 0.7, mat('#5e6673'));
		base.position.set(cx, 0.12, cz);
		const mast = boxMesh(0.18, H, 0.18, mat('#adb5bd'));
		mast.position.set(cx, H / 2, cz);
		// cross spars
		for (let i = 1; i < 6; i++) {
			const spar = boxMesh(0.9 - i * 0.08, 0.06, 0.06, mat('#868e96'), false);
			spar.position.set(cx, i * (H / 6), cz);
			g.add(spar);
		}
		const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.15, 0.2, 8), mat('#ced4da'));
		dish.position.set(cx + 0.35, H * 0.55, cz);
		dish.rotation.z = 0.6;
		const blink = boxMesh(0.2, 0.2, 0.2, new THREE.MeshBasicMaterial({ color: '#ff6b6b' }), false);
		blink.position.set(cx, H + 0.15, cz);
		g.add(base, mast, dish, blink);
		if (!anchors.skyBeacons) anchors.skyBeacons = [];
		anchors.skyBeacons.push(blink);
		return;
	}

	if (kind === 'newsstand') {
		const shed = boxMesh(b.w, H, b.d, mat('#f4e3c2'));
		shed.position.set(cx, H / 2, cz);
		const roof = boxMesh(b.w + 0.25, 0.12, b.d + 0.25, mat('#e03131'));
		roof.position.set(cx, H + 0.06, cz);
		const counter = boxMesh(b.w * 0.9, 0.2, 0.2, mat('#8a5a33'));
		counter.position.set(cx, 0.55, b.gy + b.d + 0.05);
		// magazine stack colors
		const cols = ['#e0447c', '#4dabf7', '#ffd43b', '#37b24d', '#845ef7'];
		for (let i = 0; i < 5; i++) {
			const mag = boxMesh(0.35, 0.28, 0.08, mat(cols[i]), false);
			mag.position.set(b.gx + 0.4 + i * 0.45, 0.75, b.gy + b.d + 0.12);
			g.add(mag);
		}
		const signCanvas = facade(3, 12, (g2) => {
			g2.fillStyle = '#1b2a4a';
			g2.fillRect(0, 0, 48, 12);
			g2.fillStyle = '#ffd43b';
			g2.font = 'bold 5px monospace';
			g2.fillText('GAZETTE', 6, 8.5);
		});
		const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), matT(tex(signCanvas)));
		sign.position.set(cx, H + 0.35, b.gy + b.d + 0.02);
		g.add(shed, roof, counter, sign);
		return;
	}
}

// eBoy street clutter: every few tiles a little joke (refs 1–3)
function addStreetProps(root, anchors) {
	// hot-dog cart spot (vendor entity sits here)
	anchors.hotdog = { x: 14.5, z: 12.6 };
	// oversized billboard facing the plaza
	const bb = new THREE.Group();
	const post = boxMesh(0.12, 2.4, 0.12, mat('#5e6673'));
	post.position.y = 1.2;
	const boardCanvas = facade(5, 28, (g2, U, h2) => {
		g2.fillStyle = '#1b2a4a';
		g2.fillRect(0, 0, U, h2);
		g2.fillStyle = '#ff5ea8';
		g2.fillRect(2, 2, U - 4, 10);
		g2.fillStyle = '#fff';
		g2.font = 'bold 6px monospace';
		g2.fillText('VISIT', 22, 9);
		g2.fillStyle = '#4dd4e8';
		g2.font = 'bold 7px monospace';
		g2.fillText('WOODTOWN', 8, 20);
		g2.fillStyle = '#ffd43b';
		g2.font = 'bold 5px monospace';
		g2.fillText('pop: YOU', 18, 26);
	});
	const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), matT(tex(boardCanvas)));
	board.position.set(0, 2.5, 0.08);
	bb.add(post, board);
	bb.position.set(10.5, 0, 16.2);
	root.add(bb);

	// traffic cones + orange/white barriers (ref #1)
	for (const [x, z] of [[22.5, 28.5], [27.2, 28.8], [27.5, 32.5], [23.2, 33.2], [26.5, 29.2]]) {
		const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 6), mat('#ff922b'));
		cone.position.set(x, 0.18, z);
		cone.castShadow = true;
		const stripe = boxMesh(0.16, 0.06, 0.16, mat('#fff'), false);
		stripe.position.set(x, 0.22, z);
		root.add(cone, stripe);
	}
	// barrier runs
	for (const [x, z, rot] of [[24.5, 28.3, 0], [26.8, 30.5, 0.5], [22.8, 31.5, -0.3]]) {
		const bar = new THREE.Group();
		for (let i = 0; i < 3; i++) {
			const seg = boxMesh(0.55, 0.12, 0.1, mat(i % 2 ? '#ff922b' : '#fff'), false);
			seg.position.set(i * 0.5 - 0.5, 0.45, 0);
			bar.add(seg);
		}
		const leg1 = boxMesh(0.08, 0.5, 0.08, mat('#868e96'));
		leg1.position.set(-0.7, 0.25, 0);
		const leg2 = leg1.clone();
		leg2.position.x = 0.7;
		bar.add(leg1, leg2);
		bar.position.set(x, 0, z);
		bar.rotation.y = rot;
		root.add(bar);
	}

	// purple construction smoke plume anchor (animated in life3d)
	anchors.constrSmoke = { x: 25.2, y: 1.2, z: 31.4 };

	// hard-hat mountain (ref #2 gold/hat piles)
	const hatPile = new THREE.Group();
	const hatCols = ['#ffd43b', '#f08c00', '#ffd43b', '#fab005', '#e67700'];
	for (let i = 0; i < 9; i++) {
		const hat = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), mat(hatCols[i % hatCols.length]));
		hat.scale.y = 0.55;
		hat.position.set((i % 3) * 0.22 - 0.22, 0.1 + Math.floor(i / 3) * 0.12, (Math.floor(i / 3) % 2) * 0.15);
		hatPile.add(hat);
	}
	hatPile.position.set(22.2, 0, 30.2);
	root.add(hatPile);

	// gold coin spill near Bit Bank (ref #2)
	const gold = new THREE.Group();
	for (let i = 0; i < 14; i++) {
		const coin = boxMesh(0.12, 0.05, 0.12, new THREE.MeshBasicMaterial({ color: '#ffd43b' }), false);
		coin.position.set(hash(i, 2) * 0.9 - 0.2, 0.04 + hash(i, 3) * 0.08, hash(i, 4) * 0.7);
		coin.rotation.y = hash(i, 5) * 3;
		gold.add(coin);
	}
	gold.position.set(40.5, 0, 18.2);
	root.add(gold);

	// black phone booth (ref #2)
	const booth = new THREE.Group();
	const boothBody = boxMesh(0.55, 1.35, 0.55, mat('#1b1f2a'));
	boothBody.position.y = 0.68;
	const boothGlass = boxMesh(0.4, 0.55, 0.06, new THREE.MeshBasicMaterial({ color: '#74c0fc', transparent: true, opacity: 0.45 }), false);
	boothGlass.position.set(0, 0.85, 0.28);
	const boothRoof = boxMesh(0.62, 0.1, 0.62, mat('#0d1117'));
	boothRoof.position.y = 1.4;
	booth.add(boothBody, boothGlass, boothRoof);
	booth.position.set(18.5, 0, 19.3);
	root.add(booth);

	// mailbox by the post office
	const box = boxMesh(0.28, 0.45, 0.22, mat('#4d79c7'));
	box.position.set(14.2, 0.28, 8.3);
	const flag = boxMesh(0.12, 0.06, 0.04, mat('#e03131'), false);
	flag.position.set(14.35, 0.42, 8.3);
	root.add(box, flag);

	// fire hydrant downtown
	const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.4, 6), mat('#e03131'));
	hyd.position.set(15.2, 0.2, 13.5);
	hyd.castShadow = true;
	root.add(hyd);

	// static vignette figures — frozen jokes you can still click
	anchors.vignettes = [
		// yellow raincoat + blue umbrella over a puddle (ref #1)
		{ kind: 'rain', x: 11.4, z: 12.5, rot: 0.4 },
		// construction worker pointing (ref #1)
		{ kind: 'pointer', x: 23.8, z: 28.0, rot: -0.6 },
		// worker with shovel + green bottle (ref #2)
		{ kind: 'shovel', x: 27.5, z: 20.5, rot: 2.2 },
		// two astronauts high-five-ish (ref #1)
		{ kind: 'astro', x: 38.5, z: 13.2, rot: 0.2 },
		{ kind: 'astro', x: 39.1, z: 13.5, rot: -2.4 },
		// royal stroll outside town hall (ref #2, Woodtown edition)
		{ kind: 'topper', x: 18.2, z: 19.6, rot: 0.1 },
		{ kind: 'pink', x: 18.7, z: 19.7, rot: 0.1 },
	];

	// rooftop sandwich spawn reference (chased across town)
	anchors.sandwichStart = { x: 18, z: 24 };
}

// ------------------------------------------------------------ underground
// 3D set-pieces mounted proud of the cross-section faces. South face props
// sit at z ≈ 50.1 (x = painted-u/16, y = -v/16); east face at x ≈ 50.1.
function buildUnderground(root, anchors) {
	const g = new THREE.Group();
	root.add(g);
	const bone = mat('#e6dcc4');

	// --- dinosaur skeleton (south face, by the old dig)
	const dino = new THREE.Group();
	const spine = boxMesh(3, 0.16, 0.16, bone, false);
	spine.position.set(1.4, 0.35, 0);
	dino.add(spine);
	for (let i = 0; i < 5; i++) {
		const rib = boxMesh(0.1, 0.75, 0.12, bone, false);
		rib.position.set(0.5 + i * 0.45, -0.08, 0);
		rib.rotation.z = 0.22;
		dino.add(rib);
	}
	const skull = boxMesh(0.7, 0.5, 0.3, bone, false);
	skull.position.set(-0.45, 0.28, 0);
	const snout = boxMesh(0.45, 0.26, 0.26, bone, false);
	snout.position.set(-0.9, 0.16, 0);
	const socket = boxMesh(0.16, 0.16, 0.05, new THREE.MeshBasicMaterial({ color: '#3a2c1c' }), false);
	socket.position.set(-0.5, 0.32, 0.16);
	const tail1 = boxMesh(0.7, 0.13, 0.13, bone, false);
	tail1.position.set(3.15, 0.5, 0);
	tail1.rotation.z = 0.4;
	const tail2 = boxMesh(0.5, 0.1, 0.1, bone, false);
	tail2.position.set(3.65, 0.72, 0);
	dino.add(skull, snout, socket, tail1, tail2);
	for (const lx of [0.9, 2.1]) {
		const leg = boxMesh(0.13, 0.6, 0.13, bone, false);
		leg.position.set(lx, -0.55, 0);
		const foot = boxMesh(0.4, 0.12, 0.16, bone, false);
		foot.position.set(lx + 0.1, -0.85, 0);
		dino.add(leg, foot);
	}
	dino.position.set(15.6, -2.6, 50.12);
	g.add(dino);

	// --- crystal cave crystals (south face) — CrystalGlow pulses these
	anchors.crystals = [];
	const crystalCols = ['#7ee8fa', '#b197fc', '#ff8fd0', '#7ee8fa'];
	for (let i = 0; i < 4; i++) {
		const c = new THREE.Mesh(
			new THREE.ConeGeometry(0.16, 0.55 + (i % 2) * 0.25, 5),
			new THREE.MeshBasicMaterial({ color: crystalCols[i], transparent: true })
		);
		c.position.set(34.2 + i * 0.55, -2.3, 50.14);
		c.rotation.z = (i - 1.5) * 0.12;
		anchors.crystals.push(c);
		g.add(c);
	}

	// --- elevator cage in the shaft (south face) — ElevatorAnim rides it
	const cage = new THREE.Group();
	const cageFrame = boxMesh(1.1, 1.2, 0.18, mat('#8a6a3c'), false);
	cageFrame.position.y = 0.6;
	const cageFloor = boxMesh(1.2, 0.12, 0.24, mat('#6f4a28'), false);
	const passenger = boxMesh(0.3, 0.55, 0.14, mat('#a0693a'), false);
	passenger.position.set(0, 0.4, 0.02);
	passenger.visible = false;
	cage.add(cageFrame, cageFloor, passenger);
	cage.position.set(22.7, -2, 50.08);
	anchors.elevator = { cage, passenger };
	g.add(cage);

	// --- minecart on rails in the lower drift (south face) — CartAnim rolls it
	const railY = -16.45, railZ = 50.1;
	for (const dy of [0, 0.14]) {
		const rail = boxMesh(8.2, 0.06, 0.06, mat('#6b5230'), false);
		rail.position.set(27.6, railY - 0.28 + dy * 0, railZ + (dy ? 0.1 : -0.1));
		g.add(rail);
	}
	const cart = new THREE.Group();
	const tub = boxMesh(0.9, 0.5, 0.5, mat('#5e6673'), false);
	tub.position.y = 0.25;
	const oreA = boxMesh(0.25, 0.2, 0.25, new THREE.MeshBasicMaterial({ color: '#ffd43b' }), false);
	oreA.position.set(-0.15, 0.55, 0);
	const oreB = oreA.clone();
	oreB.position.set(0.2, 0.5, 0.1);
	const w1 = boxMesh(0.2, 0.2, 0.1, mat('#2b2523'), false);
	w1.position.set(-0.28, -0.05, 0.2);
	const w2 = w1.clone(); w2.position.x = 0.28;
	cart.add(tub, oreA, oreB, w1, w2);
	cart.position.set(25, railY, railZ);
	anchors.minecart = cart;
	g.add(cart);

	// --- the gnome's front door (south face, just under the lawn)
	const door = new THREE.Group();
	const slab = boxMesh(0.8, 1, 0.12, mat('#6f4a28'), false);
	slab.position.y = 0.5;
	const arch = boxMesh(0.55, 0.28, 0.12, mat('#6f4a28'), false);
	arch.position.y = 1.06;
	const win = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 8), new THREE.MeshBasicMaterial({ color: '#ffd43b' }));
	win.rotation.x = Math.PI / 2;
	win.position.set(0, 0.78, 0.08);
	const knob = boxMesh(0.08, 0.08, 0.06, mat('#e8590c'), false);
	knob.position.set(0.26, 0.45, 0.08);
	const matDoor = boxMesh(0.7, 0.06, 0.3, mat('#8a2f2f'), false);
	matDoor.position.set(0, 0.03, 0.24);
	door.add(slab, arch, win, knob, matDoor);
	for (const [mx, mc] of [[-0.75, '#fa5252'], [0.8, '#e8fff3']]) {
		const stem = boxMesh(0.08, 0.3, 0.08, mat('#f4e3c2'), false);
		stem.position.set(mx, 0.15, 0.1);
		const cap = boxMesh(0.3, 0.14, 0.3, mat(mc), false);
		cap.position.set(mx, 0.35, 0.1);
		door.add(stem, cap);
	}
	door.position.set(30.6, -2.25, 50.1);
	anchors.gnomeWindow = win;
	g.add(door);

	// --- the dragon (south face, deep) — DragonAnim breathes it
	const dragon = new THREE.Group();
	const dbody = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), mat('#232331'));
	dbody.scale.set(1.5, 0.75, 0.7);
	const dbelly = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), mat('#2c2c40'));
	dbelly.scale.set(1.2, 0.6, 0.6);
	dbelly.position.set(0.4, -0.3, 0.15);
	const dhead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), mat('#232331'));
	dhead.scale.set(1.3, 0.8, 0.8);
	dhead.position.set(2.3, 0.35, 0.2);
	const dsnout = boxMesh(0.7, 0.35, 0.5, mat('#232331'), false);
	dsnout.position.set(3.1, 0.2, 0.2);
	const deye = boxMesh(0.28, 0.09, 0.06, new THREE.MeshBasicMaterial({ color: '#ff6b2e' }), false);
	deye.position.set(2.55, 0.55, 0.62);
	const dtail = new THREE.Group();
	for (let i = 0; i < 4; i++) {
		const seg = boxMesh(0.7 - i * 0.13, 0.4 - i * 0.07, 0.4 - i * 0.07, mat('#232331'), false);
		seg.position.set(-1.8 - i * 0.55, 0.1 + i * 0.22, 0.1);
		seg.rotation.z = i * 0.25;
		dtail.add(seg);
	}
	dragon.add(dbody, dbelly, dhead, dsnout, deye, dtail);
	for (let i = 0; i < 4; i++) {
		const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 4), mat('#31314a'));
		spike.position.set(-1 + i * 0.7, 0.95 - Math.abs(i - 1.5) * 0.1, 0.1);
		dragon.add(spike);
	}
	dragon.position.set(35, -25, 50.6);
	anchors.dragon = { group: dragon, body: dbody, eye: deye, snout: { x: 38.2, y: -24.7, z: 50.7 } };
	g.add(dragon);

	// --- treasure chest (east face)
	const chest = new THREE.Group();
	const base = boxMesh(1, 0.55, 0.45, mat('#8a5a33'), false);
	base.position.y = 0.28;
	const lid = boxMesh(1, 0.3, 0.45, mat('#6f4a28'), false);
	lid.position.set(0, 0.68, -0.18);
	lid.rotation.x = -0.9;
	const band = boxMesh(0.14, 0.56, 0.47, mat('#ffd43b'), false);
	band.position.y = 0.28;
	chest.add(base, lid, band);
	for (let i = 0; i < 5; i++) {
		const coin = boxMesh(0.14, 0.1, 0.14, new THREE.MeshBasicMaterial({ color: '#ffd43b' }), false);
		coin.position.set(-0.5 + hash(i, 8) * 1, 0.62 + hash(i, 9) * 0.1, hash(i, 12) * 0.2 - 0.1);
		chest.add(coin);
	}
	chest.rotation.y = Math.PI / 2; // face east, out of the cliff
	chest.position.set(50.12, -2.4, 50 - 230 / 16);
	g.add(chest);
	anchors.treasure = chest;
}

// ---------------------------------------------------------------- greenery
export const LAMP_SPOTS = [
	[11.6, 9.6], [14.4, 12.4], [27.6, 9.6], [30.4, 12.4],
	[11.6, 25.6], [14.4, 28.4], [27.6, 25.6], [30.4, 28.4],
	[3, 12.4], [46, 9.6], [3, 28.4], [46, 25.6],
	// denser street lights around the high-rise block
	[35.5, 12.4], [39.5, 12.4], [43.5, 18.4], [35.5, 28.4],
	[14.4, 36.4], [3, 36.4], [30.4, 36.4],
];

function lamp(x, z) {
	const g = new THREE.Group();
	const pole = boxMesh(0.08, 1.2, 0.08, mat('#3b3f46'));
	pole.position.y = 0.6;
	const head = boxMesh(0.22, 0.22, 0.22, new THREE.MeshBasicMaterial({ color: '#ffd43b' }));
	head.position.y = 1.28;
	g.add(pole, head);
	g.position.set(x, 0, z);
	return g;
}

function oakTree(x, z) {
	const g = new THREE.Group();
	const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 1.1, 7), mat('#6f4a28'));
	trunk.position.y = 0.55;
	trunk.castShadow = true;
	g.add(trunk);
	const greens = ['#2e8b3d', '#3fa14f', '#2e8b3d'];
	const blobs = [[0, 1.7, 0, 1.15], [-0.75, 1.4, 0.15, 0.7], [0.7, 1.5, -0.1, 0.75], [0.05, 2.3, 0.05, 0.7]];
	blobs.forEach(([bx, by, bz, r], i) => {
		const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(greens[i % 3]));
		s.position.set(bx, by, bz);
		s.castShadow = true;
		g.add(s);
	});
	g.position.set(x, 0, z);
	return g;
}

function plantForest(root) {
	const rounds = [], firs = [], shrubs = [];
	for (let gy = 0; gy < GRID; gy++) {
		for (let gx = 0; gx < GRID; gx++) {
			if (tileType(gx, gy) !== 0 || inBuildingZone(gx, gy)) continue;
			if (OAKS.some(([ox, oy]) => Math.abs(ox - gx) < 2 && Math.abs(oy - gy) < 2)) continue;
			// keep the dirt lot clear
			if (gx >= DIRT_LOT.gx - 1 && gx <= DIRT_LOT.gx + DIRT_LOT.w && gy >= DIRT_LOT.gy - 1 && gy <= DIRT_LOT.gy + DIRT_LOT.d) continue;
			const r = hash(gx * 3 + 1, gy * 5 + 2);
			if (r < 0.075) {
				const s = 0.8 + hash(gx * 17, gy * 23) * 0.5;
				(hash(gx * 17, gy * 23) < 0.45 ? firs : rounds).push([gx + 0.5, gy + 0.5, s]);
			} else if (r < 0.13) {
				shrubs.push([gx + 0.5, gy + 0.6, 0.7 + hash(gx * 11, gy * 9) * 0.5]);
			}
		}
	}

	const dummy = new THREE.Object3D();
	function instanced(geo, material, list, y, castShadow = true) {
		const im = new THREE.InstancedMesh(geo, material, list.length);
		im.castShadow = castShadow;
		list.forEach(([x, z, s], i) => {
			dummy.position.set(x, y * s, z);
			dummy.scale.set(s, s, s);
			dummy.updateMatrix();
			im.setMatrixAt(i, dummy.matrix);
		});
		root.add(im);
		return im;
	}

	// round trees: trunk + blob
	instanced(new THREE.BoxGeometry(0.16, 0.7, 0.16), mat('#8a5a33'), rounds, 0.35);
	instanced(new THREE.IcosahedronGeometry(0.62, 1), mat('#37b24d'), rounds, 1.15);
	// firs: trunk + 3 cones
	instanced(new THREE.BoxGeometry(0.14, 0.5, 0.14), mat('#5c3a1e'), firs, 0.25);
	instanced(new THREE.ConeGeometry(0.62, 0.85, 7), mat('#175a2b'), firs, 0.75);
	instanced(new THREE.ConeGeometry(0.48, 0.75, 7), mat('#1d6b34'), firs, 1.3);
	instanced(new THREE.ConeGeometry(0.32, 0.65, 7), mat('#175a2b'), firs, 1.8);
	// shrubs
	instanced(new THREE.IcosahedronGeometry(0.4, 1), mat('#2f9e44'), shrubs, 0.3);
}
