// Pixel icons for the interface (12x12 plus outline).
import { C, sprite, cached } from './core.js';
import { itemURL } from './items.js';

const I = {
  coin: (P) => { P.oval(0, 0, 12, 12, C.goldD); P.oval(1, 0, 10, 11, C.gold); P.oval(3, 2, 6, 7, C.goldD); P.oval(4, 2, 4, 6, C.goldL); P.px(2, 2, '#fff6c0'); },
  star: (P) => {
    P.r(5, 0, 2, 3, C.gold); P.r(4, 3, 4, 2, C.gold); P.r(0, 4, 12, 2, C.gold); P.r(2, 6, 8, 2, C.gold); P.r(2, 8, 3, 2, C.gold); P.r(7, 8, 3, 2, C.gold); P.r(1, 10, 3, 2, C.gold); P.r(8, 10, 3, 2, C.gold);
    P.px(5, 1, C.goldL); P.px(5, 4, C.goldL); P.px(3, 5, C.goldL);
  },
  box: (P) => { P.r(0, 3, 12, 9, C.wood); P.r(0, 3, 12, 2, C.woodL); P.r(1, 0, 10, 3, C.woodL); P.vl(5, 3, 9, C.woodD); P.vl(6, 3, 9, C.woodD); P.hl(0, 7, 12, C.woodD); },
  heart: (P) => { P.r(1, 1, 4, 5, C.pink); P.r(7, 1, 4, 5, C.pink); P.r(0, 2, 12, 4, C.pink); P.r(1, 6, 10, 2, C.pink); P.r(3, 8, 6, 2, C.pink); P.r(5, 10, 2, 1, C.pink); P.px(2, 2, '#ffe0ec'); P.px(3, 2, '#ffe0ec'); },
  people: (P) => { P.oval(1, 0, 5, 5, '#f2c9a0'); P.r(0, 5, 7, 6, C.blue); P.oval(6, 2, 5, 5, '#d9a27a'); P.r(5, 7, 7, 5, C.red); P.hl(1, 0, 5, '#6b4226'); P.hl(6, 2, 5, '#e0b25a'); },
  hammer: (P) => { P.line(2, 11, 8, 5, C.woodL); P.line(3, 11, 9, 5, C.woodD); P.r(5, 0, 7, 4, C.stone); P.r(5, 0, 7, 1, C.stoneL); P.r(8, 4, 2, 2, C.stoneD); },
  scroll: (P) => { P.r(1, 1, 10, 10, C.cream); P.r(0, 0, 12, 2, C.creamD); P.r(0, 10, 12, 2, C.creamD); P.hl(3, 4, 6, C.woodD); P.hl(3, 6, 5, C.woodD); P.hl(3, 8, 6, C.woodD); },
  up: (P) => { P.r(4, 5, 4, 7, C.leaf); P.r(2, 4, 8, 2, C.leaf); P.r(3, 2, 6, 2, C.leaf); P.r(5, 0, 2, 2, C.leaf); P.vl(4, 5, 7, C.leafL); },
  map: (P) => { P.r(0, 1, 12, 10, '#e8d8a8'); P.vl(4, 1, 10, '#c9b47a'); P.vl(8, 1, 10, '#c9b47a'); P.r(1, 3, 3, 3, C.leaf); P.r(9, 6, 2, 3, C.water); P.px(6, 5, C.red); P.px(5, 4, C.red); P.px(7, 4, C.red); P.px(6, 6, C.red); },
  menu: (P) => { P.r(0, 1, 12, 2, C.woodD); P.r(0, 5, 12, 2, C.woodD); P.r(0, 9, 12, 2, C.woodD); },
  market: (P) => { for (let i = 0; i < 12; i += 3) P.r(i, 0, 3, 4, (i / 3) % 2 ? C.white : C.red); P.r(0, 6, 12, 6, C.wood); P.r(0, 6, 12, 1, C.woodL); P.r(2, 4, 3, 2, C.orange); P.r(7, 4, 3, 2, C.leaf); },
  clock: (P) => { P.oval(0, 0, 12, 12, C.cream); P.vl(6, 2, 4, C.ol); P.hl(6, 6, 3, C.ol); },
  sprout: (P) => { P.r(0, 9, 12, 3, C.soil); P.vl(6, 3, 7, C.leaf); P.oval(1, 2, 5, 3, C.leafL); P.oval(7, 0, 5, 4, C.leaf); },
  boot: (P) => { P.r(2, 0, 5, 8, '#8a5a32'); P.r(2, 7, 9, 4, '#8a5a32'); P.r(2, 11, 10, 1, '#4a3020'); P.hl(2, 2, 5, '#6a3f22'); },
  basket: (P) => { P.rr(0, 5, 12, 7, '#c9944a'); P.hl(0, 5, 12, '#e0b06a'); for (let x = 1; x < 12; x += 2) P.vl(x, 6, 5, '#a8743a'); P.line(2, 5, 6, 0, '#a8743a'); P.line(6, 0, 10, 5, '#a8743a'); },
  hoe: (P) => { P.line(1, 11, 9, 3, C.woodL); P.r(7, 0, 5, 3, C.stoneD); P.r(9, 3, 3, 2, C.stoneD); },
  drop: (P) => { P.r(5, 0, 2, 2, C.water); P.r(4, 2, 4, 2, C.water); P.oval(2, 4, 8, 8, C.water); P.px(4, 6, C.waterL); P.px(4, 7, C.waterL); },
  egg: (P) => { P.oval(2, 0, 8, 12, '#fbf3df'); P.oval(3, 2, 3, 4, '#ffffff'); },
  gear: (P) => { P.oval(1, 1, 10, 10, C.stoneD); P.r(5, 0, 2, 12, C.stoneD); P.r(0, 5, 12, 2, C.stoneD); P.oval(3, 3, 6, 6, C.stone); P.oval(5, 5, 2, 2, C.ol); },
  moon: (P) => { P.oval(1, 0, 11, 12, '#f6e7a8'); P.ctx.globalCompositeOperation = 'destination-out'; P.oval(5, -2, 9, 10, '#000'); P.ctx.globalCompositeOperation = 'source-over'; P.px(3, 5, '#e0cc80'); },
  sun: (P) => { P.oval(2, 2, 8, 8, C.gold); P.px(5, 0, C.gold); P.px(6, 0, C.gold); P.px(0, 5, C.gold); P.px(0, 6, C.gold); P.px(11, 5, C.gold); P.px(11, 6, C.gold); P.px(5, 11, C.gold); P.px(6, 11, C.gold); P.oval(3, 3, 3, 3, C.goldL); },
  rain: (P) => { P.oval(0, 1, 7, 6, '#d8e0ea'); P.oval(4, 0, 8, 7, '#e8eef4'); P.px(2, 9, C.water); P.px(5, 10, C.water); P.px(8, 9, C.water); P.px(4, 11, C.water); },
  check: (P) => { P.line(1, 6, 4, 9, C.leafD); P.line(1, 7, 4, 10, C.leaf); P.line(4, 9, 11, 2, C.leafD); P.line(4, 10, 11, 3, C.leaf); },
  x: (P) => { P.line(1, 1, 10, 10, C.red); P.line(2, 1, 11, 10, C.red); P.line(10, 1, 1, 10, C.red); P.line(11, 1, 2, 10, C.red); },
  move: (P) => { P.r(5, 1, 2, 10, C.blue); P.r(1, 5, 10, 2, C.blue); P.r(4, 0, 4, 1, C.blue); P.r(4, 11, 4, 1, C.blue); P.r(0, 4, 1, 4, C.blue); P.r(11, 4, 1, 4, C.blue); },
  trash: (P) => { P.r(1, 2, 10, 2, C.stoneD); P.r(4, 0, 4, 2, C.stoneD); P.r(2, 4, 8, 8, C.stone); P.vl(4, 5, 6, C.stoneD); P.vl(7, 5, 6, C.stoneD); },
  lock: (P) => { P.r(3, 0, 6, 2, C.stoneD); P.vl(2, 1, 5, C.stoneD); P.vl(9, 1, 5, C.stoneD); P.r(1, 5, 10, 7, C.gold); P.r(5, 7, 2, 3, C.goldD); },
  cloud: (P) => { P.oval(0, 3, 7, 7, C.white); P.oval(4, 1, 8, 9, C.white); P.hl(1, 9, 10, C.whiteD); },
  user: (P) => { P.oval(3, 0, 6, 6, '#f2c9a0'); P.hl(3, 0, 6, '#6b4226'); P.rr(1, 6, 10, 6, C.blue); },
  paint: (P) => { P.r(1, 0, 10, 5, C.pink); P.r(1, 5, 10, 1, C.pinkD); P.r(5, 6, 2, 6, C.woodD); },
  eye: (P) => { P.oval(0, 2, 12, 8, C.white); P.oval(4, 3, 5, 6, C.blue); P.px(6, 5, C.ol); P.px(5, 4, '#fff'); },
  sell: (P) => { I.coin(P); },
  spring: (P) => { for (const [x, y] of [[5, 0], [9, 4], [5, 8], [1, 4]]) P.oval(x - 1, y, 4, 4, C.pink); P.oval(4, 4, 4, 4, C.yellow); P.vl(6, 9, 3, C.leaf); },
  summer: (P) => { I.sun(P); },
  autumn: (P) => { P.r(5, 0, 2, 12, '#8a4a22'); P.oval(1, 1, 10, 9, '#d8702e'); P.line(1, 3, 6, 6, '#e8a838'); P.line(11, 3, 6, 6, '#e8a838'); P.r(3, 5, 6, 2, '#c84a2a'); P.px(6, 0, '#d8702e'); },
  winter: (P) => { const c = '#a8d8f0'; P.vl(6, 0, 12, c); P.hl(0, 6, 12, c); P.line(2, 2, 10, 10, c); P.line(10, 2, 2, 10, c); P.px(6, 6, C.white); P.px(5, 1, c); P.px(7, 1, c); P.px(5, 11, c); P.px(7, 11, c); },
  ribbon: (P) => { P.oval(2, 0, 8, 8, '#5b8fe0'); P.oval(4, 2, 4, 4, C.gold); P.line(4, 7, 2, 11, '#5b8fe0'); P.line(5, 7, 3, 11, '#5b8fe0'); P.line(7, 7, 9, 11, '#d94545'); P.line(8, 7, 10, 11, '#d94545'); },
  book: (P) => { P.r(1, 1, 10, 11, '#8a4a3a'); P.r(2, 1, 9, 10, '#b8603a'); P.r(3, 2, 7, 8, '#d8784a'); P.r(2, 10, 9, 2, C.cream); P.r(5, 4, 3, 3, C.gold); P.vl(1, 1, 11, '#5a2a20'); },
  hat: (P) => { P.r(3, 2, 6, 6, '#8a5a32'); P.hl(3, 6, 6, '#3e2a1e'); P.r(0, 8, 12, 2, '#8a5a32'); P.hl(1, 10, 10, '#6a3f22'); },
  trophy: (P) => { P.r(2, 0, 8, 6, C.gold); P.r(0, 1, 2, 3, C.gold); P.r(10, 1, 2, 3, C.gold); P.r(4, 6, 4, 2, C.goldD); P.r(5, 8, 2, 2, C.goldD); P.r(2, 10, 8, 2, C.woodD); P.px(4, 1, C.goldL); },
};

export function icon(name) {
  return cached(`icon:${name}`, () => sprite(12, 12, I[name] || I.star));
}
const urls = new Map();
export function iconURL(name) {
  if (!urls.has(name)) urls.set(name, icon(name).toDataURL());
  return urls.get(name);
}
export const img = (name, cls = 'pi') => `<img class="${cls}" src="${iconURL(name)}" alt="">`;
export const itemImg = (id, cls = 'pi') => `<img class="${cls}" src="${itemURL(id)}" alt="">`;
