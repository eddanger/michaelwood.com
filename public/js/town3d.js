// town3d.js — the static town: ground, the deep island block (underground
// cross-sections as side textures), voxel buildings with painted facades,
// and instanced forests. Grid (gx,gy) maps to world (x, z); 1 tile = 1 unit.

import { THREE } from './gfx.js';
import { GRID, BUILDINGS, OAKS, tileType, inBuildingZone, hash, DIRT_LOT } from './data.js';
import {
	paintGround, paintUnderground, UNDER_DEPTH, facade, shopFacade,
	garageFacade, postFacade, wembleFacade, cinemaFacade, arcadeFacade,
	townhallFacade, houseFacade, clockFace,
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
		// the little robot
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
		g.add(bldgBox(b, facade(b.w, H * 16, townhallFacade), '#e9e4d8', '#d5cfc0'));
		const clockCanvas = facade(2, 1.4 * 16, clockFace);
		anchors.clockCanvas = clockCanvas;
		const clockTex = tex(clockCanvas);
		anchors.clockTex = clockTex;
		const side = mat('#cfc8b8');
		const tower = boxMesh(2, 1.4, 2, [side, side, mat('#dcd6c8'), side, matT(clockTex), side]);
		tower.position.set(b.gx + 3, H + 0.7, b.gy + 2.5);
		g.add(tower);
		return;
	}

	if (kind === 'house') {
		g.add(bldgBox(b, facade(b.w, H * 16, houseFacade), '#e8896a', '#c96b4e'));
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
		g.add(pole, flag);
		anchors.wembleFlag = flag;
		return;
	}

	if (kind === 'cinema') {
		g.add(bldgBox(b, facade(b.w, H * 16, cinemaFacade), '#c94f7c', '#a83f66'));
		// marquee ledge
		const ledge = boxMesh(b.w * 0.9, 0.12, 0.5, mat('#12131a'));
		ledge.position.set(cx, H * 0.68, b.gy + b.d + 0.25);
		g.add(ledge);
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
		// crane
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
			const leg = boxMesh(0.1, 2, 0.1, legMat);
			leg.position.set(b.gx + lx, 1, b.gy + lz);
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
		tank.position.set(b.gx + 1, 2.55, b.gy + 1);
		const lid = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.4, 12), mat('#a5d8ff'));
		lid.position.set(b.gx + 1, 3.4, b.gy + 1);
		g.add(tank, lid);
		return;
	}
}

// ---------------------------------------------------------------- greenery
export const LAMP_SPOTS = [
	[11.6, 9.6], [14.4, 12.4], [27.6, 9.6], [30.4, 12.4],
	[11.6, 25.6], [14.4, 28.4], [27.6, 25.6], [30.4, 28.4],
	[3, 12.4], [46, 9.6], [3, 28.4], [46, 25.6],
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
