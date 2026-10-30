// Decorations, fences, piles and wild-land clutter.
import { C, sprite, cached, shade, noise } from './core.js';
import { treeSprite, pineSprite } from './plants.js';
import { millSails } from './buildings.js';

const win = (P, x, y, w, h) => { P.r(x - 1, y - 1, w + 2, h + 2, C.woodDD); P.r(x, y, w, h, C.glass); P.hl(x, y, w, '#d8f2ff'); };

const flowerPatch = (c, d) => (P) => {
  for (const [x, y] of [[3, 13], [8, 15], [12, 12], [5, 8], [11, 6], [2, 4]]) {
    P.vl(x, y - 2, 3, C.leafD); P.px(x + 1, y - 1, C.leaf);
    P.px(x, y - 4, c); P.px(x - 1, y - 3, c); P.px(x + 1, y - 3, c); P.px(x, y - 2, c); P.px(x, y - 3, d);
  }
};

// [w, h, draw] in pixels; sprites sit with their bottom on the footprint's bottom edge.
const DECOR = {
  flowers_red: [16, 16, flowerPatch(C.red, C.yellow)],
  flowers_yellow: [16, 16, flowerPatch(C.yellow, '#c96a2e')],
  flowers_blue: [16, 16, flowerPatch('#7aa0f0', C.white)],
  flowers_pink: [16, 16, (P) => {
    for (const [x, y] of [[3, 14], [7, 12], [11, 14], [5, 7], [10, 7], [13, 9]]) {
      P.vl(x, y - 3, 4, C.leafD); P.px(x - 1, y - 1, C.leaf);
      P.r(x - 1, y - 6, 3, 3, C.pink); P.px(x, y - 6, '#ffd0e0'); P.px(x - 1, y - 6, C.pinkD);
    }
  }],
  flowers_white: [16, 16, flowerPatch(C.white, C.yellow)],
  bush: [16, 14, (P) => { P.oval(0, 1, 16, 13, C.leafD); P.oval(1, 0, 14, 11, C.leaf); P.oval(3, 1, 6, 4, C.leafL); P.px(10, 3, C.leafL); }],
  berrybush: [16, 14, (P) => {
    P.oval(0, 1, 16, 13, C.leafD); P.oval(1, 0, 14, 11, C.leaf); P.oval(3, 1, 6, 4, C.leafL);
    for (const [x, y] of [[4, 6], [9, 4], [11, 8], [6, 9], [13, 5]]) { P.r(x, y, 2, 2, C.red); P.px(x, y, '#ff9a9a'); }
  }],
  rock: [14, 10, (P) => { P.oval(0, 1, 14, 9, C.stoneD); P.oval(1, 0, 11, 7, C.stone); P.oval(2, 1, 5, 3, C.stoneL); P.r(8, 0, 4, 2, C.leaf); P.px(9, 0, C.leafL); }],
  mushrooms: [16, 14, (P) => {
    for (const [x, y, c] of [[2, 12, C.red], [7, 9, '#e8a060'], [11, 13, C.red], [12, 6, '#e8a060'], [4, 5, C.red]]) {
      P.r(x + 1, y - 2, 2, 3, C.cream); P.rr(x, y - 5, 4, 3, c); P.px(x + 1, y - 5, C.white);
    }
  }],
  oak: [24, 34, null, (s) => treeSprite('oak', null, false, s)],
  pine: [20, 34, null, (s) => pineSprite(s)],
  birch: [24, 34, null, (s) => treeSprite('birch', null, false, s)],
  blossom: [24, 34, null, (s) => treeSprite('blossom', null, s !== 'autumn' && s !== 'winter', s)],
  haybale: [16, 12, (P) => {
    P.rr(0, 1, 16, 11, '#e0b84a'); P.r(1, 1, 14, 3, '#f2d06a');
    for (let x = 2; x < 15; x += 3) P.vl(x, 4, 7, '#c49a32');
    P.vl(5, 1, 11, '#9a6a2a'); P.vl(10, 1, 11, '#9a6a2a');
  }],
  barrel: [10, 13, (P) => {
    P.rr(0, 1, 10, 12, C.wood); P.oval(0, 0, 10, 4, C.woodD); P.oval(1, 0, 8, 3, '#5a3a20');
    P.hl(0, 4, 10, C.stoneDD); P.hl(0, 9, 10, C.stoneDD); P.vl(2, 3, 9, C.woodL);
  }],
  scarecrow: [16, 26, (P) => {
    P.vl(7, 6, 20, C.woodD); P.hl(1, 11, 14, C.woodD);
    P.r(4, 10, 8, 8, '#5f8fd0'); P.r(4, 14, 8, 2, '#4a70b0'); P.r(1, 10, 3, 3, '#5f8fd0'); P.r(12, 10, 3, 3, '#5f8fd0');
    P.px(0, 12, '#e8c45a'); P.px(15, 12, '#e8c45a'); P.r(5, 18, 6, 2, '#e8c45a');
    P.oval(4, 3, 8, 7, '#f2e0b0'); P.px(6, 6, C.ol); P.px(9, 6, C.ol); P.hl(6, 8, 4, '#c98a5a');
    P.r(2, 2, 12, 2, '#d9b65a'); P.r(4, 0, 8, 3, '#e8c45a'); P.hl(4, 2, 8, C.red);
  }],
  bench: [16, 12, (P) => {
    P.r(0, 0, 16, 2, C.wood); P.r(0, 3, 16, 2, C.wood); P.hl(0, 0, 16, C.woodL);
    P.r(0, 6, 16, 3, C.woodL); P.hl(0, 8, 16, C.woodD);
    P.r(1, 9, 2, 3, C.stoneDD); P.r(13, 9, 2, 3, C.stoneDD); P.vl(1, 0, 6, C.woodD); P.vl(14, 0, 6, C.woodD);
  }],
  lamp: [8, 28, (P) => {
    P.r(3, 8, 2, 18, '#3e3a4a'); P.r(1, 25, 6, 3, '#3e3a4a');
    P.r(1, 2, 6, 6, '#3e3a4a'); P.r(2, 3, 4, 4, C.glow); P.px(2, 3, '#fff4c8'); P.r(0, 1, 8, 1, '#3e3a4a'); P.px(3, 0, '#3e3a4a'); P.px(4, 0, '#3e3a4a');
  }],
  mailbox: [10, 16, (P) => {
    P.r(4, 8, 2, 8, C.woodD); P.rr(0, 2, 10, 7, '#5f8fd0'); P.r(1, 2, 8, 2, '#8ab0f0'); P.r(8, 0, 1, 5, C.red); P.r(8, 0, 2, 2, C.red);
  }],
  signpost: [16, 20, (P) => {
    P.r(7, 4, 2, 16, C.woodD);
    P.r(1, 3, 12, 5, C.woodL); P.px(13, 5, C.woodL); P.px(0, 5, C.woodL); P.hl(3, 5, 7, C.woodD);
    P.r(4, 9, 11, 4, C.wood); P.px(3, 11, C.wood); P.hl(6, 11, 6, C.woodD);
  }],
  wheelbarrow: [16, 12, (P) => {
    P.r(2, 2, 11, 6, '#c4483a'); P.hl(2, 2, 11, '#e0705a'); P.r(3, 3, 9, 2, '#e8c45a');
    P.oval(1, 7, 5, 5, '#3e3a4a'); P.px(3, 9, C.stone); P.line(12, 6, 15, 10, C.woodD); P.vl(10, 8, 4, C.woodD);
  }],
  gnome: [10, 16, (P) => {
    P.line(5, 0, 1, 7, C.red); P.line(5, 0, 8, 7, C.red); P.r(2, 4, 6, 4, C.red); P.r(1, 7, 8, 1, C.redD);
    P.r(2, 8, 6, 3, '#f2c9a0'); P.r(2, 10, 6, 3, C.white); P.px(3, 9, C.ol); P.px(6, 9, C.ol);
    P.r(1, 12, 8, 3, '#5f8fd0'); P.r(2, 15, 2, 1, C.woodD); P.r(6, 15, 2, 1, C.woodD);
  }],
  birdbath: [14, 18, (P) => {
    P.r(5, 7, 4, 9, C.stone); P.r(3, 15, 8, 3, C.stoneD);
    P.oval(0, 3, 14, 6, C.stoneD); P.oval(1, 3, 12, 4, C.stone); P.oval(3, 4, 8, 2, C.water); P.px(4, 4, C.waterL);
    P.r(9, 0, 3, 3, '#8aa0c8'); P.px(11, 1, C.orange);
  }],
  pumpkins: [16, 12, (P) => {
    P.rr(0, 4, 9, 8, C.orange); P.vl(3, 5, 6, C.orangeD); P.r(4, 2, 2, 2, C.leafD);
    P.rr(8, 6, 8, 6, '#f2a84a'); P.vl(11, 7, 4, C.orangeD); P.px(12, 5, C.leafD);
    P.rr(5, 0, 6, 5, '#e0d0a0'); P.px(8, 0, C.leafD);
  }],
  lantern: [12, 22, (P) => {
    P.r(3, 12, 6, 8, C.stone); P.r(1, 19, 10, 3, C.stoneD);
    P.r(1, 6, 10, 6, C.stone); P.r(3, 7, 6, 4, C.glow); P.r(0, 3, 12, 3, C.stoneD); P.r(3, 1, 6, 2, C.stoneD); P.px(5, 0, C.stoneD);
  }],
  pond: [32, 30, (P) => {
    P.oval(0, 2, 32, 28, C.stoneD); P.oval(1, 2, 30, 25, '#7aa08a'); P.oval(3, 4, 26, 21, C.water);
    P.oval(6, 7, 10, 5, C.waterL); P.r(18, 16, 6, 4, C.leaf); P.px(20, 16, '#3a8a4a'); P.r(9, 18, 5, 3, C.leaf); P.px(11, 17, C.pink); P.px(12, 17, '#ffd0e0');
    for (const [x, y] of [[2, 12], [28, 10], [26, 22], [4, 24]]) { P.vl(x, y - 4, 5, C.leafD); P.px(x, y - 5, '#8a5a3a'); }
  }],
  picnic: [32, 14, (P) => {
    for (let j = 0; j < 12; j += 3) for (let i = 0; i < 30; i += 3) P.r(1 + i, 2 + j, 3, 3, ((i + j) / 3) % 2 ? C.red : C.white);
    P.r(20, 0, 9, 6, '#c49a5a'); P.hl(20, 0, 9, '#e0b878'); P.line(21, 0, 24, -3, C.woodD); P.line(27, 0, 24, -3, C.woodD);
    P.r(5, 5, 4, 4, '#d98f45'); P.r(11, 6, 3, 3, C.red);
  }],
  flowerarch: [16, 26, (P) => {
    P.r(0, 6, 2, 20, C.woodL); P.r(14, 6, 2, 20, C.woodL); P.r(0, 3, 16, 3, C.woodL);
    for (let i = 0; i < 26; i += 2) {
      const x = i < 6 ? 0 : i < 20 ? (i - 6) : 14, y = i < 6 ? 25 - i * 3 : i < 20 ? 3 : (i - 20) * 3 + 6;
      P.px(x + (i % 3), y, C.leaf); P.px(x + 1, y + 1, i % 4 ? C.pink : C.white);
    }
    for (let x = 0; x < 16; x += 3) { P.px(x, 2, C.pink); P.px(x + 1, 4, C.white); P.px(x + 2, 3, C.leafL); }
  }],
  fountain: [32, 30, (P) => {
    P.oval(0, 10, 32, 20, C.stoneD); P.oval(1, 10, 30, 17, C.stone); P.oval(3, 12, 26, 13, C.water); P.oval(5, 13, 10, 4, C.waterL);
    P.r(13, 4, 6, 12, C.stone); P.vl(13, 4, 12, C.stoneL); P.oval(8, 2, 16, 6, C.stoneD); P.oval(9, 2, 14, 4, C.stone); P.oval(11, 3, 10, 2, C.water);
    P.r(15, 0, 2, 3, C.waterL);
  }],
  windmill: [16, 30, (P) => {
    for (let y = 10; y < 30; y++) { const inset = ((30 - y) / 20) * 3 | 0; P.hl(3 + inset, y, 10 - inset * 2, C.white); P.px(3 + inset, y, '#ffffff'); P.px(12 - inset, y, C.whiteD); }
    P.oval(3, 6, 10, 7, C.roofR); P.oval(4, 6, 8, 5, C.roofRL);
    P.r(6, 24, 4, 6, C.woodD); P.r(7, 16, 2, 3, C.glass);
  }],
  statue: [14, 24, (P) => {
    P.r(1, 16, 12, 8, C.stoneD); P.r(2, 16, 10, 2, C.stoneL); P.r(0, 22, 14, 2, C.stoneDD);
    P.oval(2, 6, 10, 10, C.stoneL); P.oval(7, 2, 6, 6, C.stoneL); P.r(12, 5, 2, 2, C.gold); P.r(8, 1, 3, 2, C.stone);
    P.px(10, 4, C.stoneDD); P.line(3, 9, 6, 12, C.stone);
  }],
  gazebo: [48, 52, (P) => {
    for (const x of [3, 22, 43]) P.r(x, 20, 3, 30, C.white);
    P.r(0, 46, 48, 6, C.stoneD); P.r(1, 46, 46, 2, C.stoneL);
    for (let y = 0; y < 22; y++) { const w = Math.round(8 + (y / 22) * 40); P.hl(24 - (w >> 1), y, w, y % 4 === 3 ? C.roofBD : C.roofB); }
    P.hl(0, 21, 48, C.white); P.r(22, 0, 4, 3, C.gold);
    P.hl(5, 36, 17, C.white); P.hl(26, 36, 17, C.white); for (let x = 6; x < 43; x += 3) if (x < 21 || x > 26) P.vl(x, 36, 10, C.whiteD);
  }],
  rosebush: [16, 14, (P) => {
    P.oval(0, 1, 16, 13, C.leafD); P.oval(1, 0, 14, 11, C.leaf);
    for (const [x, y] of [[3, 3], [9, 2], [12, 6], [5, 8], [8, 6]]) { P.r(x, y, 3, 3, '#d9345a'); P.px(x + 1, y, '#ff8aa8'); P.px(x + 1, y + 1, '#a81e3c'); }
  }],
  flowerpot: [10, 14, (P) => {
    P.r(1, 8, 8, 6, '#c8643a'); P.r(0, 7, 10, 2, '#e07a4a'); P.hl(2, 13, 6, '#9a4a2a');
    for (const [x, c] of [[2, C.pink], [5, C.yellow], [7, C.red]]) { P.vl(x, 3, 4, C.leafD); P.r(x - 1, 1, 3, 3, c); P.px(x, 2, C.yellowD); }
  }],
  planter: [16, 14, (P) => {
    P.r(0, 7, 16, 7, C.wood); P.hl(0, 7, 16, C.woodL); P.vl(5, 8, 6, C.woodD); P.vl(10, 8, 6, C.woodD);
    for (let x = 1; x < 15; x += 3) { P.vl(x + 1, 3, 4, C.leafD); P.r(x, 1, 3, 3, (x % 2) ? '#9a7ae0' : C.pink); }
  }],
  cattails: [14, 18, (P) => {
    for (const [x, h] of [[2, 14], [6, 17], [10, 13], [12, 15]]) { P.vl(x, 18 - h, h, '#6a9a4a'); P.r(x - 1, 18 - h + 1, 2, 4, '#7a4a2a'); }
    P.line(4, 18, 1, 9, C.leaf); P.line(8, 18, 11, 8, C.leafL);
  }],
  stump: [14, 10, (P) => { P.oval(0, 4, 14, 6, C.woodD); P.oval(1, 0, 12, 7, C.wood); P.oval(3, 1, 8, 4, '#d8a870'); P.oval(5, 2, 4, 2, '#c08a50'); P.px(11, 6, C.leaf); }],
  mushlog: [30, 15, (P) => {
    P.ctx.translate(0, 3);
    P.rr(0, 3, 28, 9, C.woodD); P.hl(1, 3, 26, C.wood); P.oval(25, 3, 5, 9, '#d8a870'); P.oval(26, 5, 3, 5, '#c08a50');
    for (const [x, c] of [[4, C.red], [9, '#e8a060'], [15, C.red], [20, '#e8a060']]) { P.r(x + 1, 0, 2, 3, C.cream); P.rr(x, -2, 4, 3, c); P.px(x + 1, -2, C.white); }
    for (let x = 2; x < 24; x += 5) P.px(x, 8, C.leaf);
  }],
  rainbarrel: [12, 16, (P) => {
    P.rr(0, 3, 12, 13, C.wood); P.oval(0, 1, 12, 5, C.woodD); P.oval(1, 2, 10, 3, C.water); P.px(3, 2, C.waterL);
    P.hl(0, 7, 12, C.stoneDD); P.hl(0, 12, 12, C.stoneDD); P.vl(2, 5, 9, C.woodL); P.r(10, 9, 2, 2, C.stoneD);
  }],
  crates: [14, 16, (P) => {
    P.r(0, 7, 8, 9, C.wood); P.r(6, 9, 8, 7, C.woodL); P.r(2, 0, 8, 8, C.wood);
    for (const [x, y, w, h] of [[0, 7, 8, 9], [6, 9, 8, 7], [2, 0, 8, 8]]) { P.line(x, y, x + w - 1, y + h - 1, C.woodD); P.hl(x, y, w, C.woodL); }
    P.r(3, 1, 3, 2, C.red);
  }],
  birdhouse: [12, 26, (P) => {
    P.r(5, 12, 2, 14, C.woodD);
    P.r(1, 4, 10, 9, '#6a9ac8'); P.line(0, 5, 6, 0, C.roofR); P.line(11, 5, 6, 0, C.roofR); P.line(1, 5, 6, 1, C.roofR); P.line(10, 5, 6, 1, C.roofR);
    P.oval(4, 6, 4, 4, '#2a1e24'); P.hl(3, 11, 6, C.woodL); P.r(8, 2, 3, 2, '#d9534f'); P.px(10, 2, C.orange);
  }],
  skep: [14, 14, (P) => {
    P.r(4, 12, 6, 2, C.woodD);
    for (let j = 0; j < 5; j++) { const w = 6 + j * 2; P.rr(7 - w / 2, j * 2 + 1, w, 2, j % 2 ? '#d9b65a' : '#ecd07a'); }
    P.oval(5, 8, 4, 3, '#3a2a20'); P.px(11, 3, C.gold); P.px(2, 6, C.gold);
  }],
  campfire: [14, 12, (P) => {
    for (const [x, y] of [[0, 9], [10, 9], [5, 10], [2, 6], [9, 6]]) P.rr(x, y, 4, 3, C.stoneD);
    P.line(2, 10, 11, 7, C.woodD); P.line(2, 7, 11, 10, C.wood);
    P.r(5, 3, 4, 5, C.orange); P.r(6, 1, 2, 3, C.yellow); P.px(4, 5, C.orange); P.px(9, 4, C.yellow); P.px(6, 6, '#fff4c8');
  }],
  picnictable: [32, 14, (P) => {
    P.r(0, 2, 32, 5, C.wood); P.hl(0, 2, 32, C.woodL); P.hl(0, 6, 32, C.woodD);
    P.r(2, 9, 28, 2, C.woodL); for (const x of [3, 27]) P.r(x, 7, 2, 7, C.woodD);
    P.r(6, 0, 8, 3, '#d9534f'); P.r(8, -1, 4, 1, C.cream); P.r(20, 0, 3, 3, '#f4efe6'); P.r(24, 0, 3, 3, '#d98f45');
  }],
  clothesline: [32, 22, (P) => {
    P.r(1, 2, 2, 20, C.woodD); P.r(29, 2, 2, 20, C.woodD); P.line(2, 3, 30, 4, '#e8e8e8');
    for (const [x, c, h] of [[6, '#5f8fd0', 7], [12, '#f4efe6', 9], [18, '#e07ba5', 6], [23, '#e8b23a', 8]]) { P.r(x, 4, 5, h, c); P.hl(x, 4, 5, shade(c, -0.2)); P.px(x + 1, 3, C.woodL); }
  }],
  haywagon: [32, 18, (P) => {
    P.r(2, 4, 26, 8, '#e0b84a'); P.r(3, 2, 22, 3, '#f2d06a'); for (let x = 4; x < 26; x += 4) P.vl(x, 4, 7, '#c49a32');
    P.r(0, 11, 30, 3, C.wood); P.hl(0, 11, 30, C.woodL); P.line(28, 12, 32, 9, C.woodD);
    for (const x of [3, 21]) { P.oval(x, 12, 6, 6, C.woodDD); P.oval(x + 2, 14, 2, 2, C.stone); }
  }],
  hammock: [32, 20, (P) => {
    P.r(0, 2, 3, 18, C.woodD); P.r(29, 2, 3, 18, C.woodD); P.oval(-1, -2, 6, 6, C.leaf); P.oval(27, -2, 6, 6, C.leaf);
    for (let x = 3; x < 29; x++) { const y = 8 + Math.round(Math.sin(((x - 3) / 26) * Math.PI) * 5); P.vl(x, y, 3, (x % 4 < 2) ? '#d9534f' : C.cream); }
  }],
  topiary: [14, 22, (P) => {
    P.r(3, 18, 8, 4, '#c8643a'); P.r(2, 17, 10, 2, '#e07a4a');
    P.oval(1, 7, 12, 11, C.leafD); P.oval(2, 7, 10, 9, C.leaf); P.oval(7, 1, 6, 7, C.leaf); P.r(12, 4, 2, 2, C.leafD); P.px(9, 3, C.ol); P.px(4, 9, C.leafL);
  }],
  sunflowers: [16, 24, (P) => {
    for (const [x, h] of [[3, 18], [8, 22], [13, 17]]) { P.vl(x, 24 - h, h, C.leafD); P.px(x + 1, 24 - h + 8, C.leaf); P.rr(x - 3, 24 - h - 3, 7, 6, C.yellow); P.r(x - 1, 24 - h - 1, 3, 2, '#6b3f1f'); }
  }],
  wishingwell: [16, 26, (P) => {
    P.vl(2, 4, 14, C.woodD); P.vl(13, 4, 14, C.woodD);
    P.line(0, 6, 8, 0, C.roofB); P.line(15, 6, 8, 0, C.roofB); P.line(1, 6, 8, 1, C.roofBL); P.line(14, 6, 8, 1, C.roofBL); P.hl(0, 6, 16, C.roofBD);
    P.oval(0, 14, 16, 12, C.stoneD); P.oval(1, 14, 14, 9, C.stone); P.oval(3, 16, 10, 4, C.waterDD); P.px(6, 17, C.gold); P.px(9, 18, C.gold);
    for (const [x, y] of [[2, 21], [7, 23], [12, 21]]) P.r(x, y, 3, 2, C.stoneL); P.px(4, 15, C.pink); P.px(12, 15, C.leaf);
  }],
  fishgnome: [12, 18, (P) => {
    P.line(9, 0, 11, 14, C.woodD); P.vl(11, 4, 10, '#e8e8e8');
    P.line(4, 2, 1, 8, '#5f8fd0'); P.line(4, 2, 7, 8, '#5f8fd0'); P.r(2, 6, 5, 3, '#5f8fd0');
    P.r(2, 9, 5, 2, '#f2c9a0'); P.r(2, 10, 5, 3, C.white); P.r(1, 13, 7, 3, '#e8b23a'); P.r(2, 16, 2, 2, C.woodD); P.r(5, 16, 2, 2, C.woodD);
  }],
  stringlights: [32, 26, (P) => {
    for (const x of [1, 29]) { P.r(x, 6, 2, 20, '#3e3a4a'); P.r(x - 1, 24, 4, 2, '#3e3a4a'); }
    for (let x = 3; x < 29; x++) { const y = 7 + Math.round(Math.sin(((x - 3) / 26) * Math.PI) * 5); P.px(x, y, '#3e3a4a'); if (x % 4 === 1) { P.r(x, y + 1, 2, 2, [C.glow, '#ff9a6a', '#a8e0ff', '#ffd0e8'][(x >> 2) % 4]); } }
  }],
  frogstatue: [14, 18, (P) => {
    P.r(1, 12, 12, 6, C.stoneD); P.hl(1, 12, 12, C.stoneL);
    P.oval(1, 3, 12, 10, '#6a9a8a'); P.oval(2, 1, 4, 4, '#7aaa9a'); P.oval(8, 1, 4, 4, '#7aaa9a'); P.px(3, 2, C.ol); P.px(9, 2, C.ol);
    P.hl(4, 8, 6, '#4a7a6a'); P.r(5, 0, 4, 1, C.gold); P.px(5, -1, C.gold); P.px(8, -1, C.gold);
  }],
  tractor: [32, 30, (P) => {
    P.r(4, 8, 14, 12, '#d9534f'); P.r(18, 13, 12, 8, '#d9534f'); P.hl(4, 8, 14, '#f07a6a'); P.r(6, 10, 10, 6, C.glass); P.vl(11, 10, 6, '#a8302a');
    P.r(26, 6, 2, 8, '#3e3a4a'); P.r(25, 5, 4, 2, '#3e3a4a');
    P.oval(2, 16, 14, 14, '#3a3440'); P.oval(6, 20, 6, 6, '#e8b23a'); P.oval(20, 20, 10, 10, '#3a3440'); P.oval(23, 23, 4, 4, '#e8b23a');
  }],
  greenhouse: [48, 40, (P) => {
    P.r(1, 14, 46, 26, '#a8d8e8'); for (let x = 1; x < 47; x += 7) P.vl(x, 14, 26, C.white); P.hl(1, 26, 46, C.white);
    for (let y = 0; y < 15; y++) { const w = Math.round(10 + (y / 15) * 36); P.hl(24 - (w >> 1), y, w, y % 3 ? '#c8ecf4' : C.white); }
    for (let x = 4; x < 44; x += 6) { P.r(x, 32, 4, 6, C.leaf); P.px(x + 1, 31, C.pink); P.px(x + 2, 33, C.red); }
    P.r(20, 28, 8, 12, '#d8f0f8'); P.vl(24, 28, 12, C.white); P.r(0, 39, 48, 1, C.stoneD);
  }],
  bigtree: [44, 48, (P) => {
    P.r(18, 28, 8, 20, C.woodD); P.vl(25, 28, 20, C.woodDD); P.line(16, 47, 20, 40, C.woodD); P.line(28, 47, 24, 40, C.woodD);
    for (const [x, y, w, h] of [[0, 8, 26, 24], [18, 6, 26, 24], [8, 0, 28, 22], [6, 16, 32, 18]]) { P.oval(x, y, w, h, '#3c7f37'); P.oval(x + 2, y, w - 4, h - 4, '#4f9a45'); }
    for (let i = 0; i < 14; i++) { const x = 4 + ((noise(i, 2, 9) * 34) | 0), y = 3 + ((noise(i, 3, 9) * 26) | 0); P.oval(x, y, 5, 3, '#6cb85a'); }
    P.r(24, 36, 6, 8, '#d9534f'); P.line(24, 36, 22, 30, '#e8e8e8'); P.line(30, 36, 32, 30, '#e8e8e8');
  }],
  clocktower: [32, 64, (P) => {
    P.r(5, 18, 22, 46, '#d8c8a8'); P.vl(5, 18, 46, '#f0e4c8'); P.vl(26, 18, 46, '#b0a080');
    for (let y = 22; y < 62; y += 6) P.hl(5, y, 22, '#c0b090');
    P.r(3, 14, 26, 4, C.stoneD); for (let y = 0; y < 14; y++) { const w = Math.round(4 + (y / 14) * 24); P.hl(16 - (w >> 1), y, w, y % 3 ? C.roofB : C.roofBD); }
    P.oval(9, 22, 14, 14, C.ol); P.oval(10, 23, 12, 12, C.white); P.vl(16, 25, 5, C.ol); P.hl(16, 29, 4, C.ol);
    P.r(12, 52, 8, 12, C.woodD); P.px(13, 51, C.woodD); P.px(18, 51, C.woodD); P.r(15, 0, 2, 2, C.gold);
    win(P, 14, 40, 4, 6);
  }],
  kite: [16, 30, (P) => {
    P.r(7, 14, 2, 16, C.woodD); P.line(8, 14, 6, 9, '#e8e8e8'); P.line(6, 9, 4, 6, '#e8e8e8');
    P.line(8, 0, 14, 5, C.red); P.line(14, 5, 8, 10, C.red); P.line(8, 10, 2, 5, C.yellow); P.line(2, 5, 8, 0, C.yellow);
    P.r(6, 3, 5, 4, C.red); P.r(4, 4, 3, 2, C.yellow); P.vl(8, 1, 9, C.woodL);
    for (const [x, y, c] of [[9, 12, C.blue], [10, 15, C.pink], [11, 18, C.yellow]]) P.r(x, y, 2, 1, c);
  }],
  tulipbed: [32, 14, (P) => {
    P.rr(0, 6, 32, 8, C.soilD); P.rr(1, 6, 30, 6, C.soil);
    for (let x = 2; x < 31; x += 3) { const c = [C.red, C.pink, C.yellow, '#9a6ad0'][(x / 3) % 4 | 0]; P.vl(x + 1, 3, 5, C.leafD); P.r(x, 0, 3, 3, c); P.px(x + 1, 0, shade(c, 0.4)); }
  }],
  parasol: [16, 28, (P) => {
    P.r(7, 8, 2, 20, C.woodL);
    for (let i = 0; i < 16; i += 4) P.r(i, 2, 4, 6, (i / 4) % 2 ? C.white : '#5fb3c8');
    P.r(2, 0, 12, 2, '#5fb3c8'); P.hl(0, 8, 16, '#3f8aa0'); P.r(7, -1, 2, 2, C.woodD);
  }],
  lemonade: [32, 24, (P) => {
    P.r(1, 12, 30, 12, C.wood); P.hl(1, 12, 30, C.woodL); for (let x = 4; x < 30; x += 5) P.vl(x, 13, 11, C.woodD);
    P.vl(2, 0, 12, C.woodD); P.vl(29, 0, 12, C.woodD); for (let i = 0; i < 32; i += 4) P.r(i, 0, 4, 4, (i / 4) % 2 ? C.white : C.yellow);
    P.r(8, 6, 6, 6, '#f6e07a'); P.hl(8, 6, 6, C.white); P.r(18, 8, 3, 4, '#f6e07a'); P.r(22, 8, 3, 4, '#f6e07a'); P.r(10, 16, 12, 4, C.cream); P.hl(11, 18, 10, C.yellowD);
  }],
  leafpile: [16, 10, (P) => {
    P.oval(0, 2, 16, 8, '#c86a2a');
    for (let i = 0; i < 18; i++) P.px(1 + ((noise(i, 1, 4) * 14) | 0), 2 + ((noise(i, 2, 4) * 7) | 0), ['#e8a838', '#d8582e', '#a84a22', '#f0c050'][i % 4]);
  }],
  cornshocks: [14, 24, (P) => {
    for (let i = 0; i < 7; i++) { const x = 1 + i * 2; P.line(7, 4, x, 23, i % 2 ? '#d8b860' : '#c8a048'); }
    P.hl(3, 12, 8, '#8a6a2a'); P.r(5, 0, 4, 5, '#d8b860'); P.r(10, 18, 4, 5, C.orange); P.vl(12, 18, 5, C.orangeD);
  }],
  snowman: [14, 24, (P) => {
    P.oval(0, 11, 14, 13, '#f4f8fa'); P.oval(2, 3, 10, 10, '#f4f8fa'); P.oval(1, 12, 6, 5, '#ffffff');
    P.r(3, 0, 8, 2, '#2e2a36'); P.r(4, -3, 6, 3, '#2e2a36'); P.px(5, 6, C.ol); P.px(8, 6, C.ol); P.r(7, 8, 3, 1, C.orange);
    P.r(2, 12, 10, 2, C.red); P.r(9, 14, 2, 4, C.red); for (const y of [16, 19]) P.px(7, y, C.ol);
  }],
  gifttree: [20, 36, (P) => {
    P.r(8, 28, 4, 6, C.woodD);
    for (const [y, r] of [[2, 4], [8, 6], [14, 8], [21, 10]]) for (let j = 0; j < 8; j++) { const w = Math.round((r * (j + 2)) / 9); P.hl(10 - w, y + j, w * 2, j > 5 ? '#2f6a3c' : '#3f8a4a'); }
    for (let i = 0; i < 12; i++) P.px(3 + ((noise(i, 5, 2) * 14) | 0), 6 + ((noise(i, 6, 2) * 22) | 0), [C.red, C.gold, '#a8e0ff', C.pink][i % 4]);
    P.r(9, 0, 2, 3, C.gold); P.px(8, 1, C.gold); P.px(11, 1, C.gold);
    P.r(1, 31, 6, 5, C.red); P.vl(4, 31, 5, C.gold); P.r(13, 32, 6, 4, C.blue); P.vl(16, 32, 4, C.white);
  }],
  maypole: [16, 40, (P) => {
    P.r(7, 2, 2, 38, C.white); P.r(5, 0, 6, 3, C.gold);
    for (let k = 0; k < 4; k++) { const c = [C.red, C.blue, C.yellow, C.pink][k]; P.line(8, 3, k < 2 ? 0 + k * 2 : 14 - (k - 2) * 2, 34 + (k % 2) * 3, c); }
    P.oval(4, 0, 8, 4, C.leaf); for (const x of [4, 7, 10]) P.px(x, 1, C.pink);
  }],
  icecart: [32, 26, (P) => {
    P.r(2, 10, 26, 10, '#f4efe6'); P.hl(2, 10, 26, '#ffffff'); P.r(2, 16, 26, 2, '#f08bb0');
    P.vl(4, 0, 10, C.stoneD); P.vl(25, 0, 10, C.stoneD); for (let i = 0; i < 28; i += 4) P.r(i + 1, 0, 4, 3, (i / 4) % 2 ? C.white : '#f08bb0');
    for (const [x, c] of [[7, '#fbd2e0'], [12, '#f6e07a'], [17, '#a8e0c8']]) { P.oval(x, 6, 4, 4, c); P.line(x + 1, 9, x + 2, 11, '#d9a062'); }
    P.oval(3, 19, 7, 7, '#3a3440'); P.oval(20, 19, 7, 7, '#3a3440'); P.line(28, 14, 32, 10, C.stoneD);
  }],
  jackolantern: [16, 14, (P) => {
    P.rr(0, 4, 9, 9, C.orange); P.vl(4, 5, 7, C.orangeD); P.r(3, 2, 2, 2, C.leafD);
    P.px(2, 7, '#ffe27a'); P.px(6, 7, '#ffe27a'); P.hl(2, 10, 5, '#ffe27a');
    P.rr(8, 7, 8, 7, '#f2a84a'); P.vl(12, 8, 5, C.orangeD); P.px(10, 9, '#ffe27a'); P.px(13, 9, '#ffe27a'); P.hl(10, 11, 4, '#ffe27a');
  }],
  lanterntree: [36, 50, (P) => {
    P.r(16, 30, 5, 20, C.woodD); P.line(16, 49, 12, 46, C.woodD); P.line(20, 49, 25, 46, C.woodD);
    for (const [x, y, w, h] of [[0, 8, 20, 22], [16, 6, 20, 22], [6, 0, 24, 20]]) { P.oval(x, y, w, h, '#3c6a50'); P.oval(x + 2, y, w - 4, h - 4, '#4f8a62'); }
    for (let i = 0; i < 14; i++) { const x = 3 + ((noise(i, 4, 7) * 28) | 0), y = 4 + ((noise(i, 5, 7) * 24) | 0); P.r(x, y, 2, 3, [C.glow, '#ff9a6a', '#ffd0e8'][i % 3]); P.px(x, y - 1, C.woodDD); }
  }],
  ribbonarch: [16, 28, (P) => {
    P.r(0, 6, 2, 22, C.white); P.r(14, 6, 2, 22, C.white);
    for (let x = 0; x < 16; x++) { const y = 4 - Math.round(Math.sin((x / 15) * Math.PI) * 4); P.r(x, y + 2, 1, 3, [C.red, C.yellow, C.blue, C.pink][(x >> 2) % 4]); }
    for (const y of [10, 16, 22]) { P.px(0, y, C.red); P.px(15, y + 2, C.blue); }
  }],
};

export function decorSprite(type, season = 'summer') {
  const seasonal = DECOR[type] && DECOR[type][3];
  return cached(`decor:${type}${seasonal ? `:${season}` : ''}`, () => {
    const d = DECOR[type];
    if (!d) return sprite(16, 16, (P) => P.r(4, 4, 8, 8, C.pink));
    if (d[3]) return d[3](season);
    return sprite(d[0], d[1], d[2]);
  });
}
export const smallWindmillSails = (f) => millSails(f, true);

// ---------- fences (mask: 1 N, 2 E, 4 S, 8 W) ----------
export function fenceSprite(type, mask) {
  return cached(`fence:${type}:${mask}`, () => sprite(16, 22, (P) => {
    const N = mask & 1, E = mask & 2, S = mask & 4, W = mask & 8;
    if (type === 'hedge') {
      const x0 = W ? 0 : 2, x1 = E ? 16 : 14, y0 = N ? 0 : 6;
      P.r(x0, y0, x1 - x0, 22 - y0 - (S ? 0 : 2), C.leafD);
      P.r(x0, y0, x1 - x0, 14 - (N ? 0 : 6) + (N ? 6 : 0), C.leaf);
      for (let i = 0; i < 6; i++) P.px(x0 + ((noise(i, mask, 3) * (x1 - x0)) | 0), y0 + 1 + ((noise(i, mask, 4) * 8) | 0), C.leafL);
      P.hl(x0, 21 - (S ? 0 : 2), x1 - x0, C.leafDD);
      return;
    }
    if (type === 'rosehedge') {
      const x0 = W ? 0 : 2, x1 = E ? 16 : 14, y0 = N ? 0 : 6;
      P.r(x0, y0, x1 - x0, 22 - y0 - (S ? 0 : 2), C.leafD);
      P.r(x0, y0, x1 - x0, 14 - (N ? 0 : 6) + (N ? 6 : 0), C.leaf);
      for (let i = 0; i < 5; i++) { const x = x0 + 1 + ((noise(i, mask, 7) * (x1 - x0 - 3)) | 0), y = y0 + 1 + ((noise(i, mask, 8) * 9) | 0); P.r(x, y, 2, 2, i % 2 ? '#d9345a' : '#f6a8c8'); }
      P.hl(x0, 21 - (S ? 0 : 2), x1 - x0, C.leafDD);
      return;
    }
    if (type === 'fence_iron') {
      const bar = '#3e3a4a', hi = '#6a6478';
      if (W) { P.r(0, 9, 8, 1, bar); P.r(0, 17, 8, 1, bar); }
      if (E) { P.r(8, 9, 8, 1, bar); P.r(8, 17, 8, 1, bar); }
      for (const x of (W ? [1, 4] : []).concat(E ? [11, 14] : [])) { P.vl(x, 7, 13, bar); P.px(x, 6, C.gold); }
      if (N) P.vl(7, 0, 8, bar);
      P.r(6, 5, 4, 16, bar); P.vl(7, 6, 14, hi); P.r(6, 3, 4, 2, C.gold);
      return;
    }
    if (type === 'wall_stone') {
      const x0 = W ? 0 : 3, x1 = E ? 16 : 13, y0 = N ? 0 : 10;
      for (let y = y0; y < 22; y += 3) for (let x = x0 + (y % 6 ? 0 : 2); x < x1; x += 5) {
        const w = Math.min(4, x1 - x);
        P.r(x, y, w, 3, noise(x, y, mask) < 0.5 ? C.stone : C.stoneL); P.hl(x, y + 2, w, C.stoneD);
      }
      P.hl(x0, y0, x1 - x0, C.stoneL);
      return;
    }
    const white = type === 'fence_white';
    const post = white ? C.white : C.wood, postD = white ? C.whiteD : C.woodD, rail = white ? '#f4f0e6' : C.woodL;
    if (W) { P.r(0, 11, 8, 2, rail); P.r(0, 16, 8, 2, rail); }
    if (E) { P.r(8, 11, 8, 2, rail); P.r(8, 16, 8, 2, rail); }
    if (N) { P.r(7, 0, 2, 9, postD); P.vl(7, 0, 9, rail); }
    if (S) { P.r(7, 18, 2, 4, postD); }
    if (white) {
      for (const x of (W ? [1, 4] : []).concat(E ? [11, 14] : [])) { P.r(x, 8, 2, 12, post); P.px(x, 7, post); P.vl(x + 1, 9, 11, postD); }
    }
    P.r(6, 8, 4, 13, post); P.vl(9, 9, 12, postD); P.hl(6, 8, 4, white ? '#ffffff' : C.woodL);
  }));
}

// ---------- pile basket (item drawn on top) ----------
export function basketSprite() {
  return cached('basket', () => sprite(12, 8, (P) => {
    P.rr(0, 0, 12, 8, '#c9944a'); P.hl(0, 0, 12, '#e0b06a');
    for (let x = 1; x < 12; x += 2) P.vl(x, 1, 6, '#a8743a');
    P.hl(0, 4, 12, '#a8743a');
  }));
}

// ---------- wild clutter on land you don't own yet ----------
export function wildSprite(kind, season = 'summer') {
  return cached(`wild:${kind}:${season}`, () => {
    if (kind === 'tree') return treeSprite('oak', null, false, season);
    if (kind === 'pine') return pineSprite(season);
    if (kind === 'stump') return sprite(12, 9, (P) => { P.oval(0, 4, 12, 5, C.woodD); P.oval(1, 0, 10, 6, C.wood); P.oval(2, 1, 8, 4, '#d8a870'); P.px(5, 2, C.woodD); P.px(6, 3, C.woodD); });
    if (kind === 'tall') return sprite(14, 12, (P) => {
      for (let i = 0; i < 7; i++) { const x = 1 + i * 2, h = 6 + ((noise(i, 3, 1) * 6) | 0); P.vl(x, 12 - h, h, i % 2 ? '#4a8a3c' : '#5d9a45'); P.px(x, 11 - h, '#7cb85a'); }
    });
    if (kind === 'rock') return decorSprite('rock');
    return decorSprite('bush');
  });
}

export { shade };
