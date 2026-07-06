// gfx.js — three.js plumbing: pixelated render pipeline, isometric ortho
// camera, drag/zoom controls, and raycast picking.
//
// The pixel-art look: render to a small internal buffer (PIXEL screen px per
// rendered px), then let CSS stretch it with image-rendering: pixelated.

import * as THREE from './vendor/three.module.min.js';
export { THREE };

export const PIXEL = 4; // screen px per rendered px, at street-level zoom

export function createGfx(canvas) {
	const tilt = document.getElementById('tiltshift');
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.BasicShadowMap; // hard, chunky, pixel-y
	renderer.setPixelRatio(1);

	const scene = new THREE.Scene();

	// isometric-ish: 45° yaw, ~33° pitch
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
	const AZ = Math.PI / 4, PITCH = Math.PI / 5.5;
	const camDir = new THREE.Vector3(
		Math.cos(PITCH) * Math.cos(AZ),
		Math.sin(PITCH),
		Math.cos(PITCH) * Math.sin(AZ)
	);

	// view state: target point + view half-height in world units.
	// Panning moves the target in the CAMERA plane, so dragging down past the
	// island edge naturally reveals the underground.
	const view = { tx: 25, ty: 0.5, tz: 25, span: 15, min: 5, max: 44 };
	const R = new THREE.Vector3(), U = new THREE.Vector3();

	// Render grain adapts to zoom: chunky pixels up close, finer when zoomed
	// out so the whole town stays legible instead of dissolving into mush.
	function pixelSize() {
		if (window.innerWidth < 700) return 2; // phones are fine-grained already
		if (view.span > 30) return 2;
		if (view.span > 21) return 3;
		return PIXEL;
	}

	let curPx = 0;
	function syncBuffer() {
		const px = pixelSize();
		if (px === curPx) return;
		curPx = px;
		renderer.setSize(
			Math.max(2, Math.floor(window.innerWidth / px)),
			Math.max(2, Math.floor(window.innerHeight / px)),
			false
		);
		canvas.style.width = '100%';
		canvas.style.height = '100%';
	}

	function apply() {
		syncBuffer();
		const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
		camera.left = -view.span * aspect;
		camera.right = view.span * aspect;
		camera.top = view.span;
		camera.bottom = -view.span;
		camera.position.set(
			view.tx + camDir.x * 120,
			view.ty + camDir.y * 120,
			view.tz + camDir.z * 120
		);
		camera.lookAt(view.tx, view.ty, view.tz);
		camera.updateMatrix();
		camera.updateProjectionMatrix();
		R.setFromMatrixColumn(camera.matrix, 0);
		U.setFromMatrixColumn(camera.matrix, 1);
		// tilt-shift fades in as you pull back — miniature-town effect
		if (tilt) tilt.style.opacity = Math.min(1, Math.max(0, (view.span - 17) / 15)).toFixed(2);
	}

	function resize() {
		curPx = 0; // force a buffer rebuild at the new window size
		apply();
	}
	window.addEventListener('resize', resize);

	// lights (SkyCycle entity animates these through the day)
	const ambient = new THREE.AmbientLight('#cfe8ff', 1.35);
	scene.add(ambient);
	const sun = new THREE.DirectionalLight('#fff2d8', 2.2);
	sun.position.set(18, 40, 6);
	sun.target.position.set(25, 0, 25);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	const sc = sun.shadow.camera;
	sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40;
	sc.near = 1; sc.far = 120;
	scene.add(sun, sun.target);

	// ---------------------------------------------------------- controls
	function unitsPerPx() {
		return (2 * view.span) / canvas.clientHeight;
	}

	function panBy(dxPx, dyPx) {
		const w = unitsPerPx();
		view.tx += -R.x * dxPx * w + U.x * dyPx * w;
		view.ty += -R.y * dxPx * w + U.y * dyPx * w;
		view.tz += -R.z * dxPx * w + U.z * dyPx * w;
		clampView();
		apply();
	}

	function zoomBy(factor, cx, cy) {
		const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
		const nx = (cx / canvas.clientWidth) * 2 - 1;
		const ny = -(cy / canvas.clientHeight) * 2 + 1;
		const s0 = view.span;
		view.span = Math.min(view.max, Math.max(view.min, view.span / factor));
		const ds = s0 - view.span;
		// keep the world point under the cursor fixed
		view.tx += (R.x * nx * aspect + U.x * ny) * ds;
		view.ty += (R.y * nx * aspect + U.y * ny) * ds;
		view.tz += (R.z * nx * aspect + U.z * ny) * ds;
		clampView();
		apply();
	}

	function clampView() {
		view.tx = Math.min(64, Math.max(-14, view.tx));
		view.tz = Math.min(64, Math.max(-14, view.tz));
		view.ty = Math.min(6, Math.max(-36, view.ty));
	}

	// ---------------------------------------------------------- picking
	const ray = new THREE.Raycaster();
	const ndc = new THREE.Vector2();
	function setNdc(cx, cy) {
		ndc.x = (cx / canvas.clientWidth) * 2 - 1;
		ndc.y = -(cy / canvas.clientHeight) * 2 + 1;
		ray.setFromCamera(ndc, camera);
	}

	function pick(cx, cy, objects) {
		setNdc(cx, cy);
		const hits = ray.intersectObjects(objects, true);
		for (const h of hits) {
			let o = h.object;
			while (o) {
				if (o.userData && o.userData.pick) return { data: o.userData.pick, point: h.point };
				o = o.parent;
			}
		}
		return null;
	}

	const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
	const tmpV = new THREE.Vector3();
	function screenToGround(cx, cy) {
		setNdc(cx, cy);
		return ray.ray.intersectPlane(groundPlane, tmpV) ? { x: tmpV.x, z: tmpV.z } : null;
	}

	resize();
	return { renderer, scene, camera, view, sun, ambient, apply, panBy, zoomBy, clampView, pick, screenToGround, resize };
}
