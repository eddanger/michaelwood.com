// data.js — the town as data: grid, roads, lake, buildings, citizens, cars.
// Pure data + deterministic hash. Rendering lives in painters/town3d/life3d.

export const GRID = 50;

export function hash(x, y) {
	let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
	h = (h ^ (h >> 13)) * 1274126177;
	return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// tile types: 0 grass, 1 road, 2 water
export const ROAD_MIN = 1, ROAD_MAX = GRID - 2;
export const ROAD_ROWS = [10, 11, 26, 27], ROAD_COLS = [12, 13, 28, 29];
export const ROAD_H_CENTERS = [11, 27], ROAD_V_CENTERS = [13, 29];
export const LAKE = { cx: 40, cy: 6.2, rx: 6.2, ry: 3.3 };
export const DIRT_LOT = { gx: 23, gy: 29, w: 4, d: 4 };

export function tileType(gx, gy) {
	if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return -1;
	const px = gx + 0.5, py = gy + 0.5;
	if (((px - LAKE.cx) / LAKE.rx) ** 2 + ((py - LAKE.cy) / LAKE.ry) ** 2 <= 1) return 2;
	if (ROAD_ROWS.includes(gy) && gx >= ROAD_MIN && gx <= ROAD_MAX) return 1;
	if (ROAD_COLS.includes(gx) && gy >= ROAD_MIN && gy <= ROAD_MAX) return 1;
	return 0;
}

// heights are in world units (1 unit = 1 tile = 16 face-px)
export const BUILDINGS = [
	{ id: 'garage', gx: 3, gy: 2, w: 5, d: 4, h: 1.6, kind: 'garage', title: 'GARAGEBOT HQ',
		body: 'A small robot lives here and operates one very real garage door somewhere in Canada. Employee of the month, every month, since forever.' },
	{ id: 'post', gx: 15, gy: 4, w: 4, d: 4, h: 1.9, kind: 'post', title: 'WOODTOWN POST OFFICE',
		body: 'This entire town exists so one guy’s email gets delivered. That’s it. That’s the website. (No, you can’t see the mail.)' },
	{ id: 'bakery', gx: 22, gy: 4, w: 4, d: 4, h: 1.5, kind: 'shop', wall: '#f9a8c9', roof: '#e585ad',
		shop: { wall: '#f9a8c9', signBg: '#7a2946', signFg: '#ffdeeb', sign: 'BAKERY', windows: 2 },
		title: 'WOODTOWN BAKERY',
		body: 'Fresh pixel bread daily. Everything is exactly 8 bits crispy. The croissants are rectangles — nobody minds.' },
	{ id: 'wall', gx: 2, gy: 14, w: 8, d: 1, h: 2.1, kind: 'graffiti', title: 'THE WALL',
		body: 'Woodtown’s finest surface. Everything painted here is seen by every visitor, and slowly weathers away with time. Leave your mark.',
		action: { label: '🎨 paint it', kind: 'wall' } },
	{ id: 'shop', gx: 1, gy: 21, w: 5, d: 4, h: 1.9, kind: 'shop', wall: '#ffd166', roof: '#e5b44e',
		shop: { wall: '#ffd166', signBg: '#1b2a4a', signFg: '#ffd43b', sign: 'NOT A FURNITURE', sign2: 'STORE', awning: true, sofa: true },
		title: 'DEFINITELY NOT A FURNITURE STORE',
		body: 'People keep wandering in looking for tables and chairs. Different Michael Wood. This store has never stocked a single item, and business is great.' },
	{ id: 'fountain', gx: 8, gy: 19, w: 3, d: 3, h: 0.9, kind: 'fountain', title: 'WISHING FOUNTAIN',
		body: 'Toss in a coin! (Coins not included. Wishes granted at the mayor’s discretion, which is to say never, but the splashing is nice.)' },
	{ id: 'townhall', gx: 16, gy: 14, w: 6, d: 5, h: 2.4, kind: 'townhall', title: 'WOODTOWN TOWN HALL',
		body: 'Seat of government. The clock is real — it shows YOUR time, because in Woodtown, the visitor is always right.' },
	{ id: 'cafe', gx: 24, gy: 14, w: 4, d: 4, h: 1.6, kind: 'shop', wall: '#b08968', roof: '#94714f',
		shop: { wall: '#b08968', signBg: '#3e2c1c', signFg: '#ffe8cc', sign: 'BEAN THERE', windows: 2 },
		title: 'BEAN THERE CAFÉ',
		body: 'Coffee so pixelated you can count the beans. Free wifi, no password, no wifi.' },
	{ id: 'house', gx: 24, gy: 21, w: 3, d: 3, h: 1.4, kind: 'house', title: 'MIKE’S PLACE',
		body: 'Home of the mayor (self-appointed, ran unopposed). If you need him, leave a note on the big wall downtown.' },
	{ id: 'wemble', gx: 16, gy: 21, w: 5, d: 3, h: 2.25, kind: 'wemble', title: 'WEMBLE DEVELOPMENT CORPORATION — HQ',
		body: 'World headquarters. A real software company, run by the mayor. Rumour has it they built this entire town.',
		action: { label: 'visit wemble.com →', kind: 'link', url: 'https://wemble.com' } },
	{ id: 'cinema', gx: 31, gy: 14, w: 5, d: 5, h: 2.25, kind: 'cinema', title: 'PIXELPLEX CINEMA',
		body: 'Now showing: “NOT A BUG” — the heartwarming story of a feature. One screen, zero seats, five stars. (Sequel “NOT A BUG 2: STILL A FEATURE” in production.)' },
	{ id: 'library', gx: 31, gy: 22, w: 4, d: 3, h: 1.5, kind: 'shop', wall: '#c8b6a6', roof: '#a99787',
		shop: { wall: '#c8b6a6', signBg: '#4a3728', signFg: '#f4e3c2', sign: 'LIBRARY', windows: 3 },
		title: 'WOODTOWN LIBRARY',
		body: 'One book: the resume. It’s at /resume.md and it’s riveting. Shhh.' },
	{ id: 'arcade', gx: 16, gy: 29, w: 4, d: 4, h: 2.1, kind: 'arcade', title: 'WOODTOWN ARCADE',
		body: 'Cabinets are on order. This town keeps growing — new stuff shows up when the mayor gets a weird idea. Check back.' },
	{ id: 'constr', gx: 23, gy: 29, w: 4, d: 4, h: 2.9, kind: 'construction', title: 'CONSTRUCTION SITE',
		body: 'Something is being built here. Nobody knows what — the blueprints are just a napkin with “make it fun” written on it.' },
	{ id: 'greenhouse', gx: 3, gy: 30, w: 4, d: 3, h: 0.9, kind: 'greenhouse', title: 'FERN’S GREENHOUSE',
		body: 'Tomatoes, flowers, and one suspiciously large pumpkin being grown for the fair. The fair is also not built yet.' },
	{ id: 'tower', gx: 36, gy: 30, w: 2, d: 2, h: 3.4, kind: 'watertower', title: 'WOODTOWN WATER TOWER',
		body: 'Est. whenever this domain was registered. Population: 1, plus you. Water quality: pixelated.' },
	{ id: 'boathouse', gx: 42, gy: 12, w: 3, d: 2, h: 1.25, kind: 'shop', wall: '#74a3c7', roof: '#5b88ab',
		shop: { wall: '#74a3c7', signBg: '#274156', signFg: '#d7ecff', sign: 'BOATS', windows: 1 },
		title: 'WOODTOWN BOAT RENTAL',
		body: 'One boat. It’s out. It’s always out. Ask the guy on the lake how the fishing is — he loves that.' },
];

export const OAKS = [[10, 6], [14, 24], [9, 36], [32, 2.5], [37, 21], [44, 32], [22, 42]];

// keep auto-greenery off buildings + a margin south (storefront visibility)
export function inBuildingZone(gx, gy) {
	for (const b of BUILDINGS) {
		const clear = Math.ceil(b.h * 2) + 1;
		if (gx >= b.gx - 1 && gx <= b.gx + b.w && gy >= b.gy - 1 && gy <= b.gy + b.d + clear) return true;
	}
	return false;
}

export const CITIZENS = [
	{ name: 'The Mayor', shirt: '#5c636e', skin: '#f3c19d', hair: '#c0c0c0', tie: '#e0447c', speed: 1.1,
		lines: [
			'Welcome to Woodtown! Population: fluctuating.',
			'This whole town fits inside one email domain. Efficient governance.',
			'The wall downtown? Fully legal. I signed the permit myself. For myself.',
			'Vote for me! There is no election. Vote anyway.',
		] },
	{ name: 'Penny the Painter', shirt: '#e0447c', skin: '#e8a87c', hat: '#1b2a4a', speed: 1.5,
		lines: [
			'Psst. The big wall by the fountain — anyone can paint it. ANYONE.',
			'I ran out of teal today. A tragedy in three acts.',
			'Paint something nice. Or weird. Weird is nice.',
			'Every stroke fades eventually. Very deep, if you think about it. I try not to.',
		] },
	{ name: 'Pat the Postie', shirt: '#4d79c7', skin: '#c98d5e', hat: '#2f4a80', speed: 1.8,
		lines: [
			'Rain or shine, the mail gets through. It’s mostly spam.',
			'One inbox in this whole town, and it’s not even yours.',
			'You’ve got mail! Not here, though. Somewhere else.',
			'Somebody once mailed us a couch. We don’t talk about the couch.',
		] },
	{ name: 'Gus the Builder', shirt: '#f59f00', skin: '#e8a87c', hat: '#ffd43b', speed: 0.9,
		lines: [
			'We’re expanding. The mayor keeps having ideas. Terrifying.',
			'That arcade? Any day now. Any day. Aaaany day.',
			'The crane doesn’t lift anything. It’s emotional support infrastructure.',
			'There’s something under this town. We dug down once. We don’t do that anymore.',
		] },
	{ name: 'Lil’ Dot', shirt: '#37b24d', skin: '#f3c19d', hair: '#8a5a33', small: true, speed: 2.3,
		lines: [
			'Have you seen the cat?? She owes me five bucks.',
			'I clicked the grass and a FLOWER grew!! Try it!!',
			'When I grow up I wanna be a pixel artist. Or a duck.',
			'There’s a DRAGON under the town!! Gus told me not to tell you. Oops.',
		] },
	{ name: 'Fern the Gardener', shirt: '#2b8a3e', skin: '#c98d5e', hat: '#d9b382', speed: 1.0,
		lines: [
			'Every tree in town? Planted by hand. My hand.',
			'The shrubs are load-bearing. Don’t ask.',
			'Don’t feed the ducks bread. They prefer compliments.',
			'The oaks remember everything. Anyway! Lovely weather.',
		] },
	{ name: 'Joan the Jogger', shirt: '#12b886', skin: '#f3c19d', hair: '#1b2a4a', speed: 3.4,
		lines: [
			'Can’t stop. Lap 3,041.',
			'The hills here are all isometric. Great for the calves.',
			'Passed the UFO once. It waved.',
			'Hydration tip: the fountain is NOT potable. The duck told me.',
		] },
	{ name: 'Old Walt', shirt: '#845ef7', skin: '#e8a87c', hair: '#e9ecef', speed: 0.6,
		lines: [
			'I saw the saucer again last night. Nobody believes me.',
			'In my day the whole internet was this size. We liked it that way.',
			'That fisherman’s been out there for years. Never caught a thing. Happiest man I know.',
			'Listen close at the mineshaft. Something snores.',
		] },
];

export const SPAWNS = [
	[16, 27, 'x', 1], [13, 16, 'y', 1], [24, 11, 'x', -1], [29, 22, 'y', -1],
	[6, 11, 'x', 1], [13, 33, 'y', -1], [34, 27, 'x', 1], [29, 6, 'y', 1],
];

export const CARS = [
	{ body: '#e03131', top: '#ffe3e3', speed: 5.5, spawn: [20, 11, 'x', 1] },
	{ body: '#1971c2', top: '#d0ebff', speed: 4.6, spawn: [13, 20, 'y', -1] },
	{ body: '#f08c00', top: '#fff3bf', speed: 5.0, spawn: [40, 27, 'x', -1] },
];
