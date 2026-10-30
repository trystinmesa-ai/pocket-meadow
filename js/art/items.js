// 10x10 item icons (12x12 with outline), used in menus, carried by farmhands and in piles.
import { C, sprite, cached, shade } from './core.js';
import { ITEMS } from '../data.js';

const K = {
  wheat(P) {
    for (const [x, h] of [[2, 7], [4, 8], [6, 8], [8, 7]]) {
      P.vl(x, 10 - h, h, C.yellowD);
      P.r(x - 1, 10 - h, 1, 3, C.gold); P.r(x + 1, 10 - h + 1, 1, 2, C.gold); P.r(x, 9 - h, 1, 2, C.goldL);
    }
    P.hl(1, 7, 8, C.woodD);
  },
  carrot(P) {
    P.r(4, 0, 1, 3, C.leaf); P.r(6, 0, 1, 3, C.leafL); P.px(5, 1, C.leaf);
    P.r(3, 3, 5, 2, C.orange); P.r(4, 5, 3, 2, C.orange); P.r(5, 7, 2, 2, C.orange); P.px(5, 9, C.orangeD);
    P.px(4, 4, '#ffc07a'); P.px(6, 6, C.orangeD); P.px(5, 4, C.orangeD);
  },
  berry(P, d) {
    P.r(3, 0, 4, 2, C.leaf); P.px(5, 0, C.leafL);
    P.rr(1, 2, 8, 6, d.c); P.r(3, 8, 4, 1, d.c); P.px(4, 9, d.c); P.px(5, 9, d.c);
    P.px(3, 3, d.c2); P.px(4, 3, d.c2);
    for (const [x, y] of [[3, 5], [6, 4], [5, 7], [7, 6], [2, 6]]) P.px(x, y, C.yellow);
  },
  berries(P, d) {
    for (const [x, y] of [[1, 3], [5, 2], [3, 6], [7, 5]]) { P.rr(x, y, 4, 4, d.c); P.px(x + 1, y + 1, d.c2); }
    P.px(6, 1, C.leaf); P.px(7, 0, C.leafL);
  },
  corn(P) {
    P.r(1, 2, 2, 7, C.leaf); P.r(7, 2, 2, 7, C.leafD);
    P.rr(3, 0, 4, 10, C.yellow);
    for (let y = 1; y < 9; y += 2) { P.px(4, y, C.goldL); P.px(5, y + 1, C.yellowD); }
  },
  cane(P) {
    for (const x of [2, 5, 8]) { P.r(x - 1, 1, 2, 9, '#c9d76a'); for (let y = 3; y < 10; y += 3) P.hl(x - 1, y, 2, '#8a9a3a'); }
    P.px(1, 0, C.leaf); P.px(4, 0, C.leafL); P.px(8, 0, C.leaf);
  },
  potato(P) {
    P.rr(1, 2, 8, 7, '#c99a5e'); P.r(2, 3, 3, 2, '#e0b87a');
    for (const [x, y] of [[3, 6], [6, 4], [7, 7]]) P.px(x, y, '#8e6a3e');
  },
  round(P, d) {
    if (d.leaf) { P.px(5, 0, C.woodD); P.r(6, 0, 2, 1, C.leaf); P.px(7, 1, C.leafL); }
    P.rr(1, 2, 8, 8, d.c); P.r(2, 3, 2, 2, d.c2); P.px(7, 8, shade(d.c, -0.25)); P.px(6, 9, shade(d.c, -0.25));
  },
  cherry(P) {
    P.line(5, 0, 2, 5, C.leafD); P.line(5, 0, 7, 5, C.leafD); P.r(5, 0, 3, 1, C.leaf);
    P.rr(0, 5, 5, 5, '#c21f3c'); P.px(1, 6, '#ff6f86'); P.rr(5, 5, 5, 5, '#c21f3c'); P.px(6, 6, '#ff6f86');
  },
  sunflower(P) {
    P.vl(5, 6, 4, C.leafD); P.px(6, 8, C.leaf);
    P.rr(1, 0, 8, 7, C.yellow); P.r(2, 1, 1, 1, C.goldL);
    P.rr(3, 2, 4, 3, '#6b3f1f'); P.px(4, 3, '#8e5a2e');
  },
  hops(P) {
    for (const [x, y] of [[1, 2], [5, 1], [3, 5]]) {
      P.rr(x, y, 4, 5, '#9ccc5a'); P.hl(x + 1, y + 2, 2, '#6f9e3a'); P.px(x + 1, y + 1, '#c6e88a');
    }
    P.px(5, 0, C.leafD);
  },
  cotton(P) {
    P.r(4, 7, 2, 3, C.woodD);
    P.oval(0, 1, 6, 6, C.white); P.oval(4, 0, 6, 6, C.white); P.oval(2, 3, 6, 5, C.white);
    P.px(2, 3, '#ffffff'); P.px(6, 2, C.whiteD); P.px(4, 6, C.whiteD);
  },
  grapes(P) {
    P.r(4, 0, 2, 2, C.woodD); P.r(6, 0, 3, 2, C.leaf);
    const g = '#8b4ab0', gl = '#b27ad6';
    for (const [x, y] of [[1, 2], [4, 2], [7, 2], [2, 5], [5, 5], [3, 8], [6, 7]]) { P.r(x, y, 3, 2, g); P.px(x, y, gl); }
  },
  lavender(P) {
    for (const x of [2, 5, 8]) { P.vl(x, 4, 6, C.leafD); for (let y = 0; y < 5; y++) P.px(x + (y % 2 ? -1 : 1) * 0, y, y % 2 ? '#9a7ae0' : '#b79af0'); P.px(x - 1, 2, '#8a6ad0'); }
    P.hl(1, 8, 8, '#c9b8e8');
  },
  pumpkin(P) {
    P.r(4, 0, 2, 2, C.leafD); P.px(6, 1, C.leaf);
    P.rr(0, 2, 10, 8, C.orange); P.vl(3, 3, 6, C.orangeD); P.vl(6, 3, 6, C.orangeD); P.r(1, 3, 1, 2, '#ffb767');
  },
  egg(P, d) { const c = d.c || '#fbf3df'; P.oval(2, 0, 6, 10, c); P.oval(3, 1, 2, 3, '#ffffff'); P.r(6, 6, 1, 2, shade(c, -0.15)); if (d.c) { P.px(5, 6, '#9ab8b8'); P.px(4, 3, '#9ab8b8'); } },
  milk(P) {
    P.r(3, 0, 4, 2, C.blue); P.r(3, 2, 4, 1, C.whiteD);
    P.rr(2, 3, 6, 7, C.white); P.r(3, 4, 1, 4, '#ffffff'); P.r(3, 6, 4, 2, '#9cc7ef');
  },
  wool(P) { P.oval(0, 2, 6, 6, '#f2ede2'); P.oval(4, 1, 6, 7, '#f2ede2'); P.oval(2, 4, 7, 6, '#e8e1d2'); P.px(2, 4, '#fff'); P.px(6, 3, '#fff'); },
  jar(P, d) {
    P.r(2, 0, 6, 2, d.lid || C.woodD); P.hl(2, 1, 6, shade(d.lid || C.woodD, -0.2));
    P.rr(1, 2, 8, 8, d.c); P.r(2, 4, 6, 3, C.cream); P.r(2, 3, 1, 5, shade(d.c, 0.35));
    P.hl(3, 5, 4, d.c);
  },
  sack(P, d) {
    P.r(3, 0, 4, 2, d.m); P.hl(2, 2, 6, d.m);
    P.rr(1, 3, 8, 7, d.c); P.r(2, 4, 1, 4, '#ffffff'); P.r(4, 5, 3, 3, d.m); P.px(5, 6, d.c);
  },
  bread(P, d) {
    const c = d.c || '#d98f45';
    P.rr(0, 3, 10, 6, c); P.r(1, 2, 8, 2, shade(c, 0.15));
    for (const x of [2, 5, 8]) P.line(x, 3, x - 1, 5, shade(c, 0.4));
    P.hl(1, 8, 8, shade(c, -0.25));
  },
  cornbread(P) { P.r(0, 3, 10, 6, '#e8b84a'); P.hl(0, 3, 10, '#f6d670'); P.r(0, 8, 10, 1, '#b8862a'); P.vl(5, 3, 6, '#c99a2e'); },
  cake(P, d) {
    P.r(1, 4, 8, 6, '#f3d7a6'); P.r(1, 4, 8, 2, d.top || '#fff2f6'); P.px(2, 6, '#fff2f6'); P.px(6, 6, '#fff2f6');
    P.hl(1, 8, 8, '#e8a8c0'); P.r(4, 1, 2, 3, C.red); P.px(4, 0, C.leaf);
  },
  pie(P, d) {
    P.r(0, 5, 10, 4, '#c98a4a'); P.rr(1, 3, 8, 3, d.c);
    for (const x of [2, 5, 7]) P.px(x, 4, '#f6d29a'); P.hl(0, 8, 10, '#9a6a3a');
  },
  bottle(P, d) {
    P.r(4, 0, 2, 1, C.woodD); P.r(4, 1, 2, 2, '#d8ecf0');
    P.rr(2, 3, 6, 7, d.c); P.r(3, 4, 1, 4, shade(d.c, 0.4)); P.r(3, 6, 4, 2, C.cream);
  },
  butter(P) { P.r(0, 6, 10, 3, '#d8e2ea'); P.r(1, 3, 8, 4, '#f6e07a'); P.hl(1, 3, 8, '#fff0a8'); P.r(8, 3, 1, 4, '#d9be52'); },
  cheese(P, d) {
    if (d.smoked) { P.r(0, 4, 10, 5, '#c98a3a'); P.line(0, 4, 9, 1, '#e0a858'); P.r(1, 2, 9, 2, '#d89a48'); P.px(3, 6, '#8a5a2a'); P.px(7, 5, '#8a5a2a'); return; }
    P.r(0, 4, 10, 5, '#f4c742'); P.line(0, 4, 9, 1, '#ffe27a'); P.r(1, 2, 9, 2, '#f8d65a'); P.px(0, 3, '#f8d65a');
    P.px(3, 6, '#d9a42a'); P.px(7, 5, '#d9a42a'); P.px(5, 7, '#d9a42a');
  },
  icecream(P) { P.oval(1, 0, 8, 6, '#fbd2e0'); P.px(3, 1, '#fff'); P.px(6, 2, C.red); P.line(2, 5, 5, 9, '#d9a062'); P.line(7, 5, 5, 9, '#d9a062'); P.r(3, 5, 4, 3, '#e8b878'); },
  mug(P, d) {
    P.r(1, 0, 6, 3, '#fbf8ef'); P.px(7, 1, '#fbf8ef');
    P.r(1, 3, 6, 7, d.c); P.r(2, 4, 1, 5, shade(d.c, 0.4)); P.r(7, 4, 2, 1, C.woodD); P.r(8, 4, 1, 4, C.woodD); P.r(7, 7, 2, 1, C.woodD);
    P.hl(1, 9, 6, C.woodD);
  },
  wine(P, d) {
    P.r(4, 0, 2, 2, '#c9a35a'); P.r(4, 2, 2, 2, d.c);
    P.rr(2, 4, 6, 6, d.c); P.r(3, 5, 1, 3, shade(d.c, 0.4)); P.r(3, 6, 4, 2, C.cream);
  },
  cloth(P, d) { P.rr(0, 2, 10, 7, d.c); P.r(0, 2, 3, 7, shade(d.c, -0.15)); P.hl(3, 4, 7, '#c9b8e0'); P.hl(3, 7, 7, '#c9b8e0'); },
  yarn(P, d) { P.oval(0, 1, 10, 9, d.c); P.line(2, 3, 7, 8, shade(d.c, 0.35)); P.line(1, 6, 5, 2, shade(d.c, 0.35)); P.line(5, 9, 9, 5, shade(d.c, -0.2)); },
  oats(P) {
    for (const [x, h] of [[2, 8], [5, 9], [8, 8]]) { P.vl(x, 10 - h, h, '#b8a060'); for (let y = 10 - h; y < 8; y += 2) { P.px(x - 1, y, '#e8d49a'); P.px(x + 1, y + 1, '#e8d49a'); } }
    P.hl(1, 8, 9, C.woodD);
  },
  cabbage(P) { P.oval(0, 1, 10, 9, '#6fae4d'); P.oval(2, 2, 6, 6, '#a8d878'); P.oval(3, 3, 4, 4, '#cdecA0'.toLowerCase()); P.line(5, 2, 5, 8, '#5a9a3a'); },
  onion(P) { P.r(4, 0, 2, 3, C.leaf); P.oval(1, 2, 8, 8, '#d8a060'); P.oval(2, 3, 3, 4, '#f0c890'); P.vl(5, 3, 6, '#b8803a'); P.r(4, 9, 2, 1, '#8a5a2a'); },
  beans(P) { for (const [x, y] of [[0, 2], [4, 0], [5, 5], [1, 6]]) { P.rr(x, y, 5, 4, '#e8dcc8'); P.px(x + 1, y + 1, '#8a4a3a'); P.px(x + 3, y + 2, '#8a4a3a'); } },
  cucumber(P) { P.line(1, 8, 8, 1, '#4a8a3a'); P.line(2, 8, 9, 1, '#4a8a3a'); P.line(1, 9, 9, 1, '#3a7a2e'); P.line(2, 7, 8, 1, '#7ab85a'); P.px(9, 0, C.leaf); for (const [x, y] of [[3, 6], [6, 3]]) P.px(x, y, '#cfe8a0'); },
  pepper(P, d) {
    P.r(4, 0, 2, 2, C.leafD); P.rr(1, 2, 8, 8, d.stuffed ? '#e0502a' : '#e8402a'); P.vl(5, 3, 6, '#b8301e'); P.r(2, 3, 1, 4, '#ff8a6a');
    if (d.stuffed) { P.r(2, 1, 6, 2, '#f4efe0'); P.px(4, 1, '#f4c742'); }
  },
  melon(P, d) { P.oval(0, 1, 10, 9, d.c); for (const x of [2, 5, 8]) P.vl(x, 2, 7, d.s); P.oval(2, 2, 3, 2, shade(d.c, 0.3)); },
  asparagus(P) { for (const x of [2, 5, 8]) { P.vl(x, 2, 8, '#6a9a4a'); P.r(x - 1, 1, 2, 3, '#8ab860'); P.px(x, 0, '#a07ab0'); } P.hl(1, 7, 9, '#c8a060'); },
  tealeaf(P, d) { if (d.c) { P.oval(0, 2, 6, 8, d.c); P.oval(4, 0, 6, 8, shade(d.c, 0.25)); P.line(1, 9, 4, 3, shade(d.c, -0.3)); P.line(5, 7, 8, 1, shade(d.c, -0.3)); P.px(3, 4, '#ffffff'); return; } P.oval(0, 2, 6, 8, '#6aa84a'); P.oval(4, 0, 6, 8, '#82c05a'); P.line(1, 9, 4, 3, '#3a7a2e'); P.line(5, 7, 8, 1, '#4a8a3a'); },
  coffeebean(P) { for (const [x, y] of [[0, 1], [5, 2], [2, 5]]) { P.oval(x, y, 5, 5, '#6a3a1e'); P.line(x + 1, y + 3, x + 3, y + 1, '#3a2010'); P.px(x + 1, y + 1, '#9a6a3a'); } },
  bucket(P) { P.line(1, 2, 5, 0, C.stoneDD); P.line(5, 0, 9, 2, C.stoneDD); P.r(1, 3, 8, 7, '#9aa8b0'); P.r(1, 3, 8, 2, '#d8a050'); P.vl(2, 5, 4, '#c8d4dc'); P.hl(1, 9, 8, '#6a7882'); },
  fish(P, d) {
    const c = d.smoked ? '#b8783a' : '#6a9ac8', l = d.smoked ? '#e0a858' : '#a8d0f0';
    P.oval(1, 2, 7, 6, c); P.r(7, 3, 3, 1, c); P.r(8, 2, 2, 1, c); P.r(8, 6, 2, 1, c); P.r(7, 5, 3, 1, c); P.hl(2, 4, 5, l); P.px(2, 3, '#1e1e2a'); P.px(4, 7, shade(c, -0.3));
  },
  bowl(P, d) {
    P.r(0, 3, 10, 2, d.c); P.px(2, 2, shade(d.c, 0.3)); P.px(6, 2, shade(d.c, 0.3));
    if (d.fish) P.r(4, 2, 3, 2, '#e8a080');
    P.r(0, 5, 10, 3, '#f4efe6'); P.r(1, 8, 8, 1, '#d8d0c0'); P.r(3, 9, 4, 1, '#c0b8a8'); P.hl(0, 5, 10, '#6a90c0');
  },
  bakedpotato(P) { P.oval(0, 3, 10, 7, '#b8844a'); P.oval(2, 2, 6, 4, '#fff4c8'); P.r(3, 2, 3, 2, '#f4c742'); P.px(6, 3, C.leaf); P.px(4, 1, C.leaf); },
  candy(P, d) {
    if (d.square) { P.rr(1, 2, 8, 7, d.c); P.hl(2, 3, 6, shade(d.c, 0.35)); P.line(2, 8, 8, 3, shade(d.c, -0.2)); return; }
    if (d.leafy) { P.r(4, 0, 2, 2, '#c8401e'); P.line(1, 3, 5, 9, d.c); P.line(9, 3, 5, 9, d.c); P.r(2, 2, 6, 4, d.c); P.px(3, 3, shade(d.c, 0.4)); return; }
    P.r(0, 3, 2, 4, shade(d.c, 0.3)); P.r(8, 3, 2, 4, shade(d.c, 0.3)); P.oval(2, 2, 6, 6, d.c); P.line(3, 6, 6, 3, '#ffffff'); P.px(2, 4, shade(d.c, 0.4));
  },
  cup(P, d) {
    P.r(1, 3, 7, 6, '#f4efe6'); P.r(8, 4, 2, 1, '#f4efe6'); P.r(9, 4, 1, 3, '#f4efe6'); P.r(8, 6, 2, 1, '#f4efe6');
    P.r(2, 3, 5, 2, d.foam ? '#f8ecd8' : d.c); if (d.foam) P.px(4, 3, d.c);
    P.hl(0, 9, 9, '#d8d0c0'); P.vl(2, 5, 3, '#ffffff');
    P.px(3, 0, '#e8e8e8'); P.px(5, 1, '#e8e8e8'); P.px(4, 2, '#e8e8e8');
  },
  pancakes(P) { for (const y of [6, 4, 2]) { P.rr(0, y, 10, 3, '#e8b060'); P.hl(1, y + 2, 8, '#c08838'); } P.r(3, 0, 4, 2, '#f6e07a'); P.line(2, 3, 2, 7, '#b8641e'); P.line(8, 3, 8, 6, '#b8641e'); },
  muffin(P) { P.oval(0, 0, 10, 6, '#c88a50'); for (const [x, y] of [[2, 2], [5, 1], [7, 3], [4, 4]]) P.px(x, y, '#4d63c9'); P.r(2, 5, 6, 5, '#f0d8b0'); for (let x = 3; x < 8; x += 2) P.vl(x, 6, 4, '#d8b888'); },
  jelly(P, d) { P.r(0, 8, 10, 2, '#e8e8f0'); P.rr(1, 2, 8, 7, d.c); P.r(2, 1, 6, 2, shade(d.c, 0.2)); P.r(2, 3, 2, 3, shade(d.c, 0.5)); P.hl(1, 6, 8, shade(d.c, -0.15)); },
  sachet(P) { P.rr(1, 3, 8, 7, '#c9b0ea'); P.r(3, 1, 4, 2, '#c9b0ea'); P.hl(2, 3, 6, '#7a5ab0'); P.px(5, 6, '#9a7ae0'); P.px(4, 7, '#7cc75a'); },
};

export function itemIcon(id) {
  return cached(`item:${id}`, () => {
    const d = ITEMS[id]?.icon || { k: 'sack', c: '#ccc', m: '#999' };
    return sprite(10, 10, (P) => (K[d.k] || K.sack)(P, d));
  });
}

const urlCache = new Map();
export function itemURL(id) {
  if (!urlCache.has(id)) urlCache.set(id, itemIcon(id).toDataURL());
  return urlCache.get(id);
}
