// All game content lives here. Add a crop, building, recipe, decoration or
// upgrade by adding an entry; the simulation, menus and art read from these tables.

export const TILE = 16;
export const MAP = { w: 48, h: 40, parcel: 8 };
export const START_PARCELS = [[2, 2], [3, 2]];
export const SAVE_VERSION = 1;

// ---------- Items ----------
// value = base sell price. icon = how sprites.js draws the 10x10 item icon.
export const ITEMS = {
  // crops
  wheat:      { name: 'Wheat', value: 2, icon: { k: 'wheat' } },
  carrot:     { name: 'Carrot', value: 5, icon: { k: 'carrot' } },
  strawberry: { name: 'Strawberry', value: 6, icon: { k: 'berry', c: '#e0434b', c2: '#ff7a7a' } },
  corn:       { name: 'Corn', value: 7, icon: { k: 'corn' } },
  sugarcane:  { name: 'Sugarcane', value: 8, icon: { k: 'cane' } },
  blueberry:  { name: 'Blueberry', value: 9, icon: { k: 'berries', c: '#4d63c9', c2: '#8fa2ff' } },
  potato:     { name: 'Potato', value: 10, icon: { k: 'potato' } },
  tomato:     { name: 'Tomato', value: 12, icon: { k: 'round', c: '#e2483a', c2: '#ff8a6a' } },
  sunflower:  { name: 'Sunflower', value: 20, icon: { k: 'sunflower' } },
  hops:       { name: 'Hops', value: 16, icon: { k: 'hops' } },
  cotton:     { name: 'Cotton', value: 22, icon: { k: 'cotton' } },
  grapes:     { name: 'Grapes', value: 20, icon: { k: 'grapes' } },
  lavender:   { name: 'Lavender', value: 36, icon: { k: 'lavender' } },
  pumpkin:    { name: 'Pumpkin', value: 60, icon: { k: 'pumpkin' } },
  // tree fruit
  apple:      { name: 'Apple', value: 8, icon: { k: 'round', c: '#d63a3a', c2: '#ff7b6b', leaf: true } },
  cherry:     { name: 'Cherry', value: 12, icon: { k: 'cherry' } },
  orange:     { name: 'Orange', value: 16, icon: { k: 'round', c: '#f08a24', c2: '#ffc061', leaf: true } },
  // animal goods
  egg:        { name: 'Egg', value: 6, icon: { k: 'egg' } },
  milk:       { name: 'Milk', value: 20, icon: { k: 'milk' } },
  wool:       { name: 'Wool', value: 28, icon: { k: 'wool' } },
  honey:      { name: 'Honey', value: 18, icon: { k: 'jar', c: '#f0b32a', lid: '#9c6b3f' } },
  // products
  flour:      { name: 'Flour', value: 10, icon: { k: 'sack', c: '#efe6d2', m: '#c9b48a' } },
  cornmeal:   { name: 'Cornmeal', value: 22, icon: { k: 'sack', c: '#f4d35e', m: '#c99a2e' } },
  sugar:      { name: 'Sugar', value: 26, icon: { k: 'sack', c: '#ffffff', m: '#b8c4d6' } },
  bread:      { name: 'Bread', value: 45, icon: { k: 'bread' } },
  potatobread:{ name: 'Potato Loaf', value: 58, icon: { k: 'bread', c: '#d9a35a' } },
  cornbread:  { name: 'Cornbread', value: 72, icon: { k: 'cornbread' } },
  cake:       { name: 'Cake', value: 160, icon: { k: 'cake' } },
  applepie:   { name: 'Apple Pie', value: 150, icon: { k: 'pie', c: '#e8a85a' } },
  pumpkinpie: { name: 'Pumpkin Pie', value: 185, icon: { k: 'pie', c: '#e07b2a' } },
  carrotjuice:{ name: 'Carrot Juice', value: 32, icon: { k: 'bottle', c: '#f08a24' } },
  applejuice: { name: 'Apple Juice', value: 45, icon: { k: 'bottle', c: '#f2cf55' } },
  orangejuice:{ name: 'Orange Juice', value: 78, icon: { k: 'bottle', c: '#ffa23a' } },
  sauce:      { name: 'Tomato Sauce', value: 58, icon: { k: 'jar', c: '#d33a2c', lid: '#e8e0d0' } },
  oil:        { name: 'Sunflower Oil', value: 95, icon: { k: 'bottle', c: '#e8c82a', tall: true } },
  strawjam:   { name: 'Strawberry Jam', value: 65, icon: { k: 'jar', c: '#d62f4b', lid: '#f2f2f2' } },
  bluejam:    { name: 'Blueberry Jam', value: 85, icon: { k: 'jar', c: '#4a4fb8', lid: '#f2f2f2' } },
  cherryjam:  { name: 'Cherry Jam', value: 100, icon: { k: 'jar', c: '#a3123a', lid: '#f2f2f2' } },
  butter:     { name: 'Butter', value: 55, icon: { k: 'butter' } },
  cheese:     { name: 'Cheese', value: 90, icon: { k: 'cheese' } },
  icecream:   { name: 'Ice Cream', value: 115, icon: { k: 'icecream' } },
  beer:       { name: 'Ale', value: 80, icon: { k: 'mug', c: '#e8a92a' } },
  cider:      { name: 'Cider', value: 62, icon: { k: 'mug', c: '#f2d36b' } },
  mead:       { name: 'Mead', value: 72, icon: { k: 'mug', c: '#f0b32a' } },
  grapejuice: { name: 'Grape Juice', value: 85, icon: { k: 'bottle', c: '#7b3fa0' } },
  wine:       { name: 'Wine', value: 155, icon: { k: 'wine', c: '#7a1f3d' } },
  cloth:      { name: 'Cloth', value: 92, icon: { k: 'cloth', c: '#e9e4f0' } },
  yarn:       { name: 'Yarn', value: 78, icon: { k: 'yarn', c: '#e98aa8' } },
  sachet:     { name: 'Lavender Sachet', value: 210, icon: { k: 'sachet' } },
  // --- Harvest Festival expansion ---
  oats:       { name: 'Oats', value: 6, icon: { k: 'oats' } },
  cabbage:    { name: 'Cabbage', value: 14, icon: { k: 'cabbage' } },
  onion:      { name: 'Onion', value: 9, icon: { k: 'onion' } },
  beans:      { name: 'Speckled Beans', value: 10, icon: { k: 'beans' } },
  cucumber:   { name: 'Cucumber', value: 12, icon: { k: 'cucumber' } },
  raspberry:  { name: 'Raspberry', value: 11, icon: { k: 'berries', c: '#d9345a', c2: '#ff8aa8' } },
  bellpepper: { name: 'Bell Pepper', value: 18, icon: { k: 'pepper' } },
  watermelon: { name: 'Watermelon', value: 75, icon: { k: 'melon', c: '#3f8a3a', s: '#2a6a2a' } },
  honeydew:   { name: 'Honeydew', value: 85, icon: { k: 'melon', c: '#cfe39a', s: '#a8c070' } },
  rice:       { name: 'Rice', value: 24, icon: { k: 'sack', c: '#f4efe0', m: '#d8cfb0' } },
  tealeaf:    { name: 'Tea Leaves', value: 40, icon: { k: 'tealeaf' } },
  coffeebean: { name: 'Coffee Beans', value: 50, icon: { k: 'coffeebean' } },
  plum:       { name: 'Plum', value: 14, icon: { k: 'round', c: '#7a3f9a', c2: '#a874c8', leaf: true } },
  peach:      { name: 'Peach', value: 18, icon: { k: 'round', c: '#f4a070', c2: '#ffd0a8', leaf: true } },
  sap:        { name: 'Maple Sap', value: 20, icon: { k: 'bucket' } },
  duckegg:    { name: 'Duck Egg', value: 14, icon: { k: 'egg', c: '#d8ecec' } },
  fish:       { name: 'River Fish', value: 22, icon: { k: 'fish' } },
  vinegar:    { name: 'Vinegar', value: 30, icon: { k: 'bottle', c: '#d8b070' } },
  pickles:    { name: 'Pickles', value: 100, icon: { k: 'jar', c: '#6a9a3a', lid: '#d8a040' } },
  sauerkraut: { name: 'Sauerkraut', value: 60, icon: { k: 'jar', c: '#e0e0a0', lid: '#9c6b3f' } },
  pickledpep: { name: 'Pickled Peppers', value: 140, icon: { k: 'jar', c: '#e0502a', lid: '#d8a040' } },
  pickledon:  { name: 'Pickled Onions', value: 85, icon: { k: 'jar', c: '#f0e8f8', lid: '#d8a040' } },
  oatmeal:    { name: 'Oatmeal', value: 75, icon: { k: 'bowl', c: '#e8d4a0' } },
  beanstew:   { name: 'Bean Stew', value: 80, icon: { k: 'bowl', c: '#9a5a32' } },
  veggiesoup: { name: 'Garden Soup', value: 85, icon: { k: 'bowl', c: '#e0a040' } },
  bakedpotato:{ name: 'Loaded Potato', value: 220, icon: { k: 'bakedpotato' } },
  stuffedpep: { name: 'Stuffed Peppers', value: 240, icon: { k: 'pepper', stuffed: true } },
  fishstew:   { name: 'Fisher’s Stew', value: 120, icon: { k: 'bowl', c: '#d8c8a0', fish: true } },
  friedrice:  { name: 'Fried Rice', value: 95, icon: { k: 'bowl', c: '#f0d070' } },
  candy:      { name: 'Candy', value: 75, icon: { k: 'candy', c: '#f06090' } },
  toffee:     { name: 'Toffee', value: 120, icon: { k: 'candy', c: '#c98a3a', square: true } },
  soda:       { name: 'Berry Soda', value: 85, icon: { k: 'bottle', c: '#e04a70', tall: true } },
  syrup:      { name: 'Maple Syrup', value: 95, icon: { k: 'bottle', c: '#b8641e' } },
  maplecandy: { name: 'Maple Candy', value: 170, icon: { k: 'candy', c: '#d8902e', leafy: true } },
  honeydrops: { name: 'Honey Drops', value: 95, icon: { k: 'candy', c: '#f4c030' } },
  tea:        { name: 'Cup of Tea', value: 110, icon: { k: 'cup', c: '#9ab040' } },
  coffee:     { name: 'Coffee', value: 135, icon: { k: 'cup', c: '#5a3420' } },
  latte:      { name: 'Latte', value: 240, icon: { k: 'cup', c: '#d8b088', foam: true } },
  chai:       { name: 'Honey Chai', value: 185, icon: { k: 'cup', c: '#c08a50', foam: true } },
  smokedfish: { name: 'Smoked Fish', value: 70, icon: { k: 'fish', smoked: true } },
  smokedcheese:{ name: 'Smoked Cheese', value: 130, icon: { k: 'cheese', smoked: true } },
  pancakes:   { name: 'Pancakes', value: 260, icon: { k: 'pancakes' } },
  muffin:     { name: 'Blueberry Muffin', value: 95, icon: { k: 'muffin' } },
  peachtart:  { name: 'Peach Tart', value: 190, icon: { k: 'pie', c: '#f4a070' } },
  plumcake:   { name: 'Plum Cake', value: 210, icon: { k: 'cake', top: '#7a3f9a' } },
  rasjam:     { name: 'Raspberry Jam', value: 90, icon: { k: 'jar', c: '#c8204a', lid: '#f2f2f2' } },
  plumjam:    { name: 'Plum Jam', value: 105, icon: { k: 'jar', c: '#5a2a7a', lid: '#f2f2f2' } },
  melonjelly: { name: 'Honeydew Jelly', value: 140, icon: { k: 'jelly', c: '#b8e070' } },
  wmjelly:    { name: 'Watermelon Jelly', value: 150, icon: { k: 'jelly', c: '#f05a6a' } },
  peachjam:   { name: 'Peach Preserves', value: 125, icon: { k: 'jar', c: '#f08a50', lid: '#f2f2f2' } },
  wmjuice:    { name: 'Watermelon Juice', value: 110, icon: { k: 'bottle', c: '#f05a6a' } },
  peachjuice: { name: 'Peach Nectar', value: 85, icon: { k: 'bottle', c: '#f4a070' } },
  plumwine:   { name: 'Plum Wine', value: 110, icon: { k: 'wine', c: '#5a2a6a' } },
  peachwine:  { name: 'Peach Wine', value: 130, icon: { k: 'wine', c: '#e8905a' } },
  ricewine:   { name: 'Rice Wine', value: 130, icon: { k: 'wine', c: '#e8e0c8' } },
  raswine:    { name: 'Raspberry Wine', value: 95, icon: { k: 'wine', c: '#b01a40' } },
  stout:      { name: 'Oat Stout', value: 95, icon: { k: 'mug', c: '#3a2418' } },
  yogurt:     { name: 'Berry Yogurt', value: 95, icon: { k: 'bowl', c: '#f4c8d8' } },
  // seasonal crops and goods
  asparagus:  { name: 'Asparagus', value: 16, icon: { k: 'asparagus' } },
  sunberry:   { name: 'Sunberry', value: 15, icon: { k: 'berries', c: '#f4a020', c2: '#ffe070' } },
  cranberry:  { name: 'Cranberry', value: 15, icon: { k: 'berries', c: '#b01a3a', c2: '#e85a70' } },
  frostmint:  { name: 'Frostmint', value: 18, icon: { k: 'tealeaf', c: '#8ad0c8' } },
  aspsoup:    { name: 'Spring Soup', value: 95, icon: { k: 'bowl', c: '#a8c860' } },
  sunjuice:   { name: 'Sunberry Juice', value: 75, icon: { k: 'bottle', c: '#f4a020' } },
  cransauce:  { name: 'Cranberry Sauce', value: 85, icon: { k: 'jar', c: '#a01434', lid: '#d8a040' } },
  mintcandy:  { name: 'Frostmint Candy', value: 95, icon: { k: 'candy', c: '#8ad0c8' } },
};

// ---------- Crops (planted on field plots) ----------
// yield = items per harvest, regrow = progress a regrowing crop restarts from
// after harvest, cost = coins to unlock the seed. Seed price per planting
// (seed) and grow time (time) are worked out from these further down.
export const CROPS = {
  wheat:      { yield: 2, level: 1,  cost: 0 },
  carrot:     { yield: 2, level: 1,  cost: 0 },
  strawberry: { yield: 2, level: 2,  cost: 80,    regrow: 0.42 },
  corn:       { yield: 2, level: 3,  cost: 200 },
  blueberry:  { yield: 3, level: 4,  cost: 400,   regrow: 0.4 },
  sugarcane:  { yield: 3, level: 5,  cost: 600 },
  potato:     { yield: 3, level: 5,  cost: 700 },
  tomato:     { yield: 3, level: 6,  cost: 1200,  regrow: 0.38 },
  sunflower:  { yield: 2, level: 7,  cost: 2000 },
  pumpkin:    { yield: 1, level: 8,  cost: 3500 },
  hops:       { yield: 3, level: 9,  cost: 5000,  regrow: 0.4 },
  grapes:     { yield: 3, level: 10, cost: 8000,  regrow: 0.38 },
  cotton:     { yield: 3, level: 11, cost: 12000 },
  lavender:   { yield: 2, level: 12, cost: 18000 },
  oats:       { yield: 3, level: 3,  cost: 250 },
  cabbage:    { yield: 2, level: 4,  cost: 450 },
  onion:      { yield: 3, level: 5,  cost: 650 },
  beans:      { yield: 3, level: 6,  cost: 1000,  regrow: 0.42 },
  cucumber:   { yield: 3, level: 7,  cost: 1800,  regrow: 0.4 },
  raspberry:  { yield: 3, level: 8,  cost: 3000,  regrow: 0.42 },
  bellpepper: { yield: 3, level: 10, cost: 7000,  regrow: 0.4 },
  watermelon: { yield: 1, level: 12, cost: 15000 },
  honeydew:   { yield: 1, level: 13, cost: 20000 },
  rice:       { yield: 4, level: 15, cost: 30000 },
  tealeaf:    { yield: 2, level: 17, cost: 50000,  regrow: 0.45 },
  coffeebean: { yield: 2, level: 20, cost: 90000,  regrow: 0.45 },
  // seasonal: can only be planted in their season (they finish growing if the season ends)
  asparagus:  { yield: 3, level: 3,  cost: 300,   season: 'spring' },
  sunberry:   { yield: 3, level: 3,  cost: 300,   season: 'summer', regrow: 0.42 },
  cranberry:  { yield: 3, level: 3,  cost: 300,   season: 'autumn', regrow: 0.42 },
  frostmint:  { yield: 3, level: 3,  cost: 300,   season: 'winter' },
};
export const CROP_ORDER = Object.keys(CROPS);
// Crops that count as flowers for beehives.
export const BEE_FLOWERS = new Set(['sunflower', 'lavender', 'raspberry']);

// ---------- Placeable things ----------
// cat: field | tree | house | storage | utility | craft | animal | special | path | fence | decor
// cost: number, or (n) => number where n = how many of this type you already own.
// walk: workers can walk over it. door: workers use the tile below it.
const grow = (base, k) => (n) => Math.round(base * Math.pow(k, n));

export const DEFS = {
  plot: { name: 'Field Plot', cat: 'field', w: 1, h: 1, walk: true, level: 1, cost: (n) => 8 + 2 * n,
    desc: 'Tilled soil. Choose a crop and farmers plant, water and harvest it.' },

  // fruit trees
  appletree:  { name: 'Apple Tree', cat: 'tree', w: 1, h: 1, level: 4, cost: grow(250, 1.25), fruit: 'apple', time: 300, yield: 4, look: 'apple',
    desc: 'Fruits again and again. Farmers pick it when ripe.' },
  cherrytree: { name: 'Cherry Tree', cat: 'tree', w: 1, h: 1, level: 7, cost: grow(900, 1.25), fruit: 'cherry', time: 420, yield: 5, look: 'cherry',
    desc: 'Pink blossoms, then sweet cherries.' },
  plumtree:   { name: 'Plum Tree', cat: 'tree', w: 1, h: 1, level: 9, cost: grow(1800, 1.25), fruit: 'plum', time: 450, yield: 5, look: 'plum',
    desc: 'Deep purple plums for jam, cake and wine.' },
  peachtree:  { name: 'Peach Tree', cat: 'tree', w: 1, h: 1, level: 13, cost: grow(5000, 1.25), fruit: 'peach', time: 500, yield: 5, look: 'peach',
    desc: 'Soft blushing peaches.' },
  mapletree:  { name: 'Tapped Maple', cat: 'tree', w: 1, h: 1, level: 15, cost: grow(8000, 1.25), fruit: 'sap', time: 420, yield: 4, look: 'maple',
    desc: 'A sugar maple with a tap and bucket. Its sap boils down into syrup.' },
  orangetree: { name: 'Orange Tree', cat: 'tree', w: 1, h: 1, level: 11, cost: grow(3000, 1.25), fruit: 'orange', time: 480, yield: 5, look: 'orange',
    desc: 'A sunny citrus tree.' },

  // homes (each houses farmhands)
  farmhouse: { name: 'Farmhouse', cat: 'house', w: 3, h: 3, door: true, level: 1, cost: 0, unique: true, fixed: true, houses: 3,
    desc: 'Home sweet home. Houses 3 farmhands.' },
  cottage:   { name: 'Cottage', cat: 'house', w: 2, h: 2, door: true, level: 2, cost: grow(400, 1.8), houses: 2,
    desc: 'A cozy cottage with room for 2 more farmhands.' },

  // storage (all storage is shared; workers drop off at the nearest one)
  barn:  { name: 'Barn', cat: 'storage', w: 3, h: 2, door: true, level: 1, cost: grow(1500, 2.2), store: 60, upg: 120, maxLvl: 6,
    desc: 'Main storage. Upgrade it to hold more.' },
  silo:  { name: 'Silo', cat: 'storage', w: 2, h: 2, door: true, level: 2, cost: grow(300, 1.6), store: 80, upg: 250, maxLvl: 5,
    desc: 'Tall storage tower. +80 capacity.' },
  crate: { name: 'Storage Crate', cat: 'storage', w: 1, h: 1, door: true, level: 1, cost: grow(60, 1.3), store: 15, upg: 60, maxLvl: 4,
    desc: 'A small drop-off point. Put them near far fields to save walking.' },

  // utility
  well:      { name: 'Well', cat: 'utility', w: 1, h: 1, door: true, level: 2, cost: grow(150, 1.5),
    desc: 'Farmers fill watering cans here. Watered crops grow faster.' },
  sprinkler: { name: 'Sprinkler', cat: 'utility', w: 1, h: 1, level: 8, cost: grow(800, 1.15), radius: 1,
    desc: 'Keeps the 8 plots around it watered automatically.' },
  bigsprinkler: { name: 'Great Sprinkler', cat: 'utility', w: 1, h: 1, level: 14, cost: grow(4000, 1.15), radius: 2,
    desc: 'Keeps the 24 plots around it watered.' },
  market:    { name: 'Market Stall', cat: 'special', w: 2, h: 2, door: true, level: 1, cost: 0, unique: true, fixed: true,
    desc: 'Sell your goods and set up auto-selling.' },
  board:     { name: 'Notice Board', cat: 'special', w: 1, h: 1, door: true, level: 1, cost: 0, unique: true, fixed: true,
    desc: 'Villagers post orders here. Fill them for bonus coins.' },

  // production
  mill: { name: 'Mill', cat: 'craft', w: 2, h: 2, door: true, level: 3, cost: grow(500, 1.7), upg: 300, maxLvl: 5,
    desc: 'Grinds grain and cane.',
    recipes: [
      { out: 'flour', in: { wheat: 3 }, time: 15 },
      { out: 'cornmeal', in: { corn: 2 }, time: 20 },
      { out: 'sugar', in: { sugarcane: 2 }, time: 20, level: 5 },
    ] },
  bakery: { name: 'Bakery', cat: 'craft', w: 3, h: 2, door: true, level: 5, cost: grow(2000, 1.7), upg: 900, maxLvl: 5,
    desc: 'Warm ovens for breads, pies and cakes.',
    recipes: [
      { out: 'bread', in: { flour: 2, egg: 1 }, time: 30 },
      { out: 'potatobread', in: { flour: 1, potato: 2 }, time: 35 },
      { out: 'cornbread', in: { cornmeal: 2, egg: 1 }, time: 40 },
      { out: 'applepie', in: { flour: 1, apple: 3, butter: 1 }, time: 60, level: 8 },
      { out: 'cake', in: { flour: 2, egg: 2, sugar: 1, butter: 1 }, time: 70, level: 8 },
      { out: 'pumpkinpie', in: { pumpkin: 1, flour: 1, sugar: 1, egg: 1 }, time: 70, level: 9 },
      { out: 'muffin', in: { flour: 1, egg: 1, blueberry: 2 }, time: 40, level: 8 },
      { out: 'plumcake', in: { flour: 2, egg: 2, sugar: 1, plum: 2 }, time: 75, level: 10 },
      { out: 'peachtart', in: { flour: 1, butter: 1, peach: 2 }, time: 65, level: 13 },
      { out: 'pancakes', in: { flour: 1, egg: 1, milk: 1, syrup: 1 }, time: 50, level: 15 },
    ] },
  press: { name: 'Press House', cat: 'craft', w: 2, h: 2, door: true, level: 6, cost: grow(1800, 1.7), upg: 800, maxLvl: 5,
    desc: 'Squeezes fruit and seeds into juice and oil.',
    recipes: [
      { out: 'carrotjuice', in: { carrot: 4 }, time: 25 },
      { out: 'applejuice', in: { apple: 3 }, time: 30 },
      { out: 'sauce', in: { tomato: 3 }, time: 35 },
      { out: 'oil', in: { sunflower: 3 }, time: 45, level: 7 },
      { out: 'orangejuice', in: { orange: 3 }, time: 40, level: 11 },
      { out: 'wmjuice', in: { watermelon: 1 }, time: 40, level: 12 },
      { out: 'peachjuice', in: { peach: 3 }, time: 40, level: 13 },
      { out: 'sunjuice', in: { sunberry: 3 }, time: 35 },
    ] },
  kitchen: { name: 'Preserves Kitchen', cat: 'craft', w: 2, h: 2, door: true, level: 7, cost: grow(3000, 1.7), upg: 1200, maxLvl: 5,
    desc: 'Simmers fruit and sugar into jams and jellies.',
    recipes: [
      { out: 'strawjam', in: { strawberry: 3, sugar: 1 }, time: 40 },
      { out: 'bluejam', in: { blueberry: 3, sugar: 1 }, time: 45 },
      { out: 'cherryjam', in: { cherry: 3, sugar: 1 }, time: 50 },
      { out: 'rasjam', in: { raspberry: 3, sugar: 1 }, time: 45, level: 8 },
      { out: 'plumjam', in: { plum: 3, sugar: 1 }, time: 50, level: 9 },
      { out: 'wmjelly', in: { watermelon: 1, sugar: 1 }, time: 55, level: 12 },
      { out: 'melonjelly', in: { honeydew: 1, sugar: 1 }, time: 55, level: 13 },
      { out: 'peachjam', in: { peach: 3, sugar: 1 }, time: 55, level: 13 },
      { out: 'cransauce', in: { cranberry: 3, sugar: 1 }, time: 45 },
    ] },
  dairy: { name: 'Dairy', cat: 'craft', w: 2, h: 2, door: true, level: 7, cost: grow(3500, 1.7), upg: 1400, maxLvl: 5,
    desc: 'Churns butter and ages cheese.',
    recipes: [
      { out: 'butter', in: { milk: 2 }, time: 30 },
      { out: 'cheese', in: { milk: 3 }, time: 50 },
      { out: 'icecream', in: { milk: 1, sugar: 1, strawberry: 2 }, time: 45, level: 9 },
      { out: 'yogurt', in: { milk: 2, raspberry: 2 }, time: 40, level: 8 },
    ] },
  brewery: { name: 'Brewery', cat: 'craft', w: 3, h: 2, door: true, level: 9, cost: grow(8000, 1.7), upg: 3000, maxLvl: 5,
    desc: 'Copper kettles bubbling with ale, cider and mead.',
    recipes: [
      { out: 'cider', in: { apple: 4 }, time: 45 },
      { out: 'beer', in: { hops: 2, wheat: 2 }, time: 55 },
      { out: 'mead', in: { honey: 2 }, time: 50 },
      { out: 'stout', in: { oats: 3, hops: 2 }, time: 60 },
    ] },
  winery: { name: 'Winery', cat: 'craft', w: 3, h: 2, door: true, level: 10, cost: grow(12000, 1.7), upg: 5000, maxLvl: 5,
    desc: 'Stone cellars full of barrels.',
    recipes: [
      { out: 'grapejuice', in: { grapes: 3 }, time: 40 },
      { out: 'wine', in: { grapes: 4 }, time: 90 },
      { out: 'plumwine', in: { plum: 4 }, time: 80 },
      { out: 'raswine', in: { raspberry: 5 }, time: 75 },
      { out: 'peachwine', in: { peach: 4 }, time: 85, level: 13 },
      { out: 'ricewine', in: { rice: 4 }, time: 80, level: 15 },
    ] },
  loom: { name: 'Loom House', cat: 'craft', w: 2, h: 2, door: true, level: 11, cost: grow(10000, 1.7), upg: 4000, maxLvl: 5,
    desc: 'Spins and weaves soft goods.',
    recipes: [
      { out: 'cloth', in: { cotton: 3 }, time: 45 },
      { out: 'yarn', in: { wool: 2 }, time: 40 },
      { out: 'sachet', in: { cloth: 1, lavender: 2 }, time: 60, level: 12 },
    ] },
  pickler: { name: 'Pickling Shed', cat: 'craft', w: 2, h: 2, door: true, level: 7, cost: grow(2600, 1.7), upg: 1100, maxLvl: 5,
    desc: 'Crocks and barrels for vinegar, pickles and sauerkraut.',
    recipes: [
      { out: 'vinegar', in: { apple: 2 }, time: 40 },
      { out: 'sauerkraut', in: { cabbage: 2 }, time: 50 },
      { out: 'pickledon', in: { onion: 3, vinegar: 1 }, time: 55 },
      { out: 'pickles', in: { cucumber: 3, vinegar: 1 }, time: 60 },
      { out: 'pickledpep', in: { bellpepper: 3, vinegar: 1 }, time: 70, level: 10 },
    ] },
  cookhouse: { name: 'Cookhouse', cat: 'craft', w: 3, h: 2, door: true, level: 6, cost: grow(2400, 1.7), upg: 1000, maxLvl: 5,
    desc: 'Big bubbling pots of hearty farm food.',
    recipes: [
      { out: 'oatmeal', in: { oats: 2, milk: 1 }, time: 35 },
      { out: 'aspsoup', in: { asparagus: 3, milk: 1 }, time: 40 },
      { out: 'beanstew', in: { beans: 3, onion: 1 }, time: 45 },
      { out: 'veggiesoup', in: { carrot: 1, potato: 1, onion: 1, cabbage: 1 }, time: 45 },
      { out: 'bakedpotato', in: { potato: 2, butter: 1, cheese: 1 }, time: 60, level: 8 },
      { out: 'fishstew', in: { fish: 2, potato: 1, onion: 1 }, time: 55, level: 10 },
      { out: 'friedrice', in: { rice: 2, egg: 1, onion: 1 }, time: 45, level: 15 },
      { out: 'stuffedpep', in: { bellpepper: 2, rice: 1, cheese: 1 }, time: 70, level: 15 },
    ] },
  sweets: { name: 'Sweet Shop', cat: 'craft', w: 2, h: 2, door: true, level: 9, cost: grow(6000, 1.7), upg: 2500, maxLvl: 5,
    desc: 'Candy jars, toffee, fizzy soda and maple syrup.',
    recipes: [
      { out: 'candy', in: { sugar: 2 }, time: 35 },
      { out: 'mintcandy', in: { frostmint: 2, sugar: 1 }, time: 40 },
      { out: 'honeydrops', in: { honey: 2, sugar: 1 }, time: 40 },
      { out: 'soda', in: { sugar: 1, raspberry: 2 }, time: 40 },
      { out: 'toffee', in: { sugar: 1, butter: 1 }, time: 50 },
      { out: 'syrup', in: { sap: 3 }, time: 60, level: 15 },
      { out: 'maplecandy', in: { syrup: 1, sugar: 1 }, time: 60, level: 15 },
    ] },
  smokehouse: { name: 'Smokehouse', cat: 'craft', w: 2, h: 2, door: true, level: 11, cost: grow(9000, 1.7), upg: 3500, maxLvl: 5,
    desc: 'Slow wood smoke for fish and cheese.',
    recipes: [
      { out: 'smokedfish', in: { fish: 2 }, time: 60 },
      { out: 'smokedcheese', in: { cheese: 1 }, time: 70 },
    ] },
  teahouse: { name: 'Tea House', cat: 'craft', w: 3, h: 2, door: true, level: 17, cost: grow(40000, 1.7), upg: 15000, maxLvl: 5,
    desc: 'Dries tea, roasts coffee and steams milk.',
    recipes: [
      { out: 'tea', in: { tealeaf: 2 }, time: 45 },
      { out: 'chai', in: { tea: 1, milk: 1, honey: 1 }, time: 60 },
      { out: 'coffee', in: { coffeebean: 2 }, time: 50, level: 20 },
      { out: 'latte', in: { coffee: 1, milk: 1, sugar: 1 }, time: 70, level: 20 },
    ] },

  // animals: produce goods over time while they have feed
  coop:     { name: 'Chicken Coop', cat: 'animal', w: 2, h: 2, door: true, level: 3, cost: grow(400, 1.7), upg: 300, maxLvl: 5,
    animal: { item: 'egg', feed: 'wheat', time: 60, count: 2, kind: 'chicken' },
    desc: 'Hens lay eggs when fed wheat. More hens per level.' },
  cowshed:  { name: 'Cow Shed', cat: 'animal', w: 3, h: 2, door: true, level: 6, cost: grow(2500, 1.7), upg: 1200, maxLvl: 5,
    animal: { item: 'milk', feed: 'corn', time: 150, count: 2, kind: 'cow' },
    desc: 'Cows give milk when fed corn.' },
  sheeppen: { name: 'Sheep Pen', cat: 'animal', w: 3, h: 2, door: true, level: 9, cost: grow(5000, 1.7), upg: 2400, maxLvl: 5,
    animal: { item: 'wool', feed: 'carrot', time: 200, count: 2, kind: 'sheep' },
    desc: 'Fluffy sheep grow wool when fed carrots.' },
  duckhouse: { name: 'Duck House', cat: 'animal', w: 2, h: 2, door: true, level: 8, cost: grow(3000, 1.7), upg: 1400, maxLvl: 5,
    animal: { item: 'duckegg', feed: 'oats', time: 120, count: 2, kind: 'duck' },
    desc: 'Ducks waddle about and lay duck eggs when fed oats.' },
  dock: { name: 'Fishing Dock', cat: 'animal', w: 2, h: 2, door: true, level: 10, cost: grow(6000, 1.6), upg: 3000, maxLvl: 5, water: true,
    hive: { item: 'fish', time: 160, cap: 6 },
    desc: 'Build it beside the stream or pond. Fish are caught on their own; ranchers bring them in.' },
  beehive:  { name: 'Beehive', cat: 'animal', w: 1, h: 1, door: true, level: 5, cost: grow(600, 1.35), upg: 500, maxLvl: 5,
    hive: { item: 'honey', time: 180, cap: 6 },
    desc: 'Bees make honey on their own. Flowers within 3 tiles make them faster.' },

  // paths speed workers up
  path_dirt:  { name: 'Dirt Path', cat: 'path', w: 1, h: 1, walk: true, level: 1, cost: 4, speed: 1.3, desc: 'Farmhands walk 30% faster on it.' },
  path_stone: { name: 'Stone Path', cat: 'path', w: 1, h: 1, walk: true, level: 3, cost: 12, speed: 1.5, charm: 0.5, desc: 'Farmhands walk 50% faster on it.' },
  path_brick: { name: 'Brick Path', cat: 'path', w: 1, h: 1, walk: true, level: 6, cost: 25, speed: 1.65, charm: 1, desc: 'Farmhands walk 65% faster on it.' },
  path_gravel: { name: 'Gravel Path', cat: 'path', w: 1, h: 1, walk: true, level: 2, cost: 8, speed: 1.35, desc: 'Crunchy gravel. 35% faster walking.' },
  path_flag:  { name: 'Flagstones', cat: 'path', w: 1, h: 1, walk: true, level: 9, cost: 40, speed: 1.7, charm: 1.5, desc: 'Big flat stones. 70% faster walking.' },
  path_wood:  { name: 'Boardwalk', cat: 'path', w: 1, h: 1, walk: true, level: 4, cost: 15, speed: 1.5, charm: 0.5, desc: 'Wooden planks. 50% faster walking.' },

  // fences connect to their neighbours
  fence_wood:  { name: 'Wooden Fence', cat: 'fence', w: 1, h: 1, level: 1, cost: 6, charm: 0.5 },
  fence_white: { name: 'Picket Fence', cat: 'fence', w: 1, h: 1, level: 3, cost: 12, charm: 1 },
  hedge:       { name: 'Hedge', cat: 'fence', w: 1, h: 1, level: 4, cost: 18, charm: 1.5 },
  wall_stone:  { name: 'Stone Wall', cat: 'fence', w: 1, h: 1, level: 7, cost: 25, charm: 1.5 },
  fence_iron:  { name: 'Iron Railing', cat: 'fence', w: 1, h: 1, level: 12, cost: 45, charm: 2 },
  rosehedge:   { name: 'Rose Hedge', cat: 'fence', w: 1, h: 1, level: 10, cost: 40, charm: 3 },

  // decorations: purely for looks (each adds a little charm)
  flowers_red:    { name: 'Red Flowers', cat: 'decor', w: 1, h: 1, walk: true, level: 1, cost: 8, charm: 2, flower: true },
  flowers_yellow: { name: 'Yellow Flowers', cat: 'decor', w: 1, h: 1, walk: true, level: 1, cost: 8, charm: 2, flower: true },
  flowers_blue:   { name: 'Bluebells', cat: 'decor', w: 1, h: 1, walk: true, level: 2, cost: 10, charm: 2, flower: true },
  flowers_pink:   { name: 'Pink Tulips', cat: 'decor', w: 1, h: 1, walk: true, level: 3, cost: 12, charm: 2.5, flower: true },
  flowers_white:  { name: 'Daisies', cat: 'decor', w: 1, h: 1, walk: true, level: 2, cost: 10, charm: 2, flower: true },
  bush:        { name: 'Round Bush', cat: 'decor', w: 1, h: 1, level: 1, cost: 15, charm: 2 },
  berrybush:   { name: 'Berry Bush', cat: 'decor', w: 1, h: 1, level: 3, cost: 25, charm: 3 },
  rock:        { name: 'Mossy Rock', cat: 'decor', w: 1, h: 1, level: 1, cost: 10, charm: 1 },
  mushrooms:   { name: 'Mushroom Ring', cat: 'decor', w: 1, h: 1, walk: true, level: 2, cost: 20, charm: 3 },
  oak:         { name: 'Oak Tree', cat: 'decor', w: 1, h: 1, level: 1, cost: 40, charm: 4, tall: true },
  pine:        { name: 'Pine Tree', cat: 'decor', w: 1, h: 1, level: 2, cost: 40, charm: 4, tall: true },
  birch:       { name: 'Birch Tree', cat: 'decor', w: 1, h: 1, level: 4, cost: 60, charm: 5, tall: true },
  blossom:     { name: 'Blossom Tree', cat: 'decor', w: 1, h: 1, level: 6, cost: 150, charm: 8, tall: true },
  haybale:     { name: 'Hay Bale', cat: 'decor', w: 1, h: 1, level: 1, cost: 12, charm: 1.5 },
  barrel:      { name: 'Barrel', cat: 'decor', w: 1, h: 1, level: 2, cost: 15, charm: 1.5 },
  scarecrow:   { name: 'Scarecrow', cat: 'decor', w: 1, h: 1, level: 2, cost: 45, charm: 4 },
  bench:       { name: 'Garden Bench', cat: 'decor', w: 1, h: 1, level: 3, cost: 50, charm: 4 },
  lamp:        { name: 'Lamp Post', cat: 'decor', w: 1, h: 1, level: 4, cost: 70, charm: 4, light: 1 },
  mailbox:     { name: 'Mailbox', cat: 'decor', w: 1, h: 1, level: 2, cost: 30, charm: 2 },
  signpost:    { name: 'Signpost', cat: 'decor', w: 1, h: 1, level: 2, cost: 25, charm: 2 },
  wheelbarrow: { name: 'Wheelbarrow', cat: 'decor', w: 1, h: 1, level: 3, cost: 40, charm: 3 },
  gnome:       { name: 'Garden Gnome', cat: 'decor', w: 1, h: 1, level: 5, cost: 120, charm: 6 },
  birdbath:    { name: 'Bird Bath', cat: 'decor', w: 1, h: 1, level: 5, cost: 140, charm: 6 },
  pumpkins:    { name: 'Pumpkin Pile', cat: 'decor', w: 1, h: 1, level: 8, cost: 80, charm: 4 },
  lantern:     { name: 'Stone Lantern', cat: 'decor', w: 1, h: 1, level: 8, cost: 180, charm: 7, light: 1 },
  pond:        { name: 'Lily Pond', cat: 'decor', w: 2, h: 2, level: 5, cost: 400, charm: 15 },
  picnic:      { name: 'Picnic Blanket', cat: 'decor', w: 2, h: 1, walk: true, level: 6, cost: 160, charm: 8 },
  flowerarch:  { name: 'Flower Arch', cat: 'decor', w: 1, h: 1, walk: true, level: 7, cost: 220, charm: 10 },
  fountain:    { name: 'Fountain', cat: 'decor', w: 2, h: 2, level: 8, cost: 1200, charm: 25 },
  windmill:    { name: 'Little Windmill', cat: 'decor', w: 1, h: 1, level: 9, cost: 600, charm: 14 },
  statue:      { name: 'Hen Statue', cat: 'decor', w: 1, h: 1, level: 12, cost: 3000, charm: 30 },
  gazebo:      { name: 'Gazebo', cat: 'decor', w: 3, h: 3, level: 14, cost: 8000, charm: 60 },
  rosebush:    { name: 'Rose Bush', cat: 'decor', w: 1, h: 1, level: 3, cost: 35, charm: 3 },
  flowerpot:   { name: 'Flower Pot', cat: 'decor', w: 1, h: 1, walk: true, level: 2, cost: 18, charm: 2, flower: true },
  planter:     { name: 'Planter Box', cat: 'decor', w: 1, h: 1, level: 4, cost: 45, charm: 3, flower: true },
  cattails:    { name: 'Cattails', cat: 'decor', w: 1, h: 1, walk: true, level: 3, cost: 15, charm: 2 },
  stump:       { name: 'Tree Stump Seat', cat: 'decor', w: 1, h: 1, level: 2, cost: 20, charm: 2 },
  mushlog:     { name: 'Mushroom Log', cat: 'decor', w: 2, h: 1, level: 4, cost: 60, charm: 4 },
  rainbarrel:  { name: 'Rain Barrel', cat: 'decor', w: 1, h: 1, level: 3, cost: 40, charm: 2 },
  crates:      { name: 'Crate Stack', cat: 'decor', w: 1, h: 1, level: 2, cost: 25, charm: 1.5 },
  birdhouse:   { name: 'Birdhouse', cat: 'decor', w: 1, h: 1, level: 5, cost: 90, charm: 5 },
  skep:        { name: 'Straw Skep', cat: 'decor', w: 1, h: 1, level: 5, cost: 70, charm: 4 },
  campfire:    { name: 'Campfire', cat: 'decor', w: 1, h: 1, level: 6, cost: 120, charm: 6, light: 1 },
  picnictable: { name: 'Picnic Table', cat: 'decor', w: 2, h: 1, level: 6, cost: 180, charm: 7 },
  clothesline: { name: 'Clothesline', cat: 'decor', w: 2, h: 1, level: 7, cost: 150, charm: 6 },
  haywagon:    { name: 'Hay Wagon', cat: 'decor', w: 2, h: 1, level: 7, cost: 260, charm: 8 },
  hammock:     { name: 'Hammock', cat: 'decor', w: 2, h: 1, level: 8, cost: 320, charm: 10 },
  topiary:     { name: 'Topiary Duck', cat: 'decor', w: 1, h: 1, level: 9, cost: 450, charm: 12 },
  sunflowers:  { name: 'Sunflower Patch', cat: 'decor', w: 1, h: 1, level: 7, cost: 60, charm: 4, flower: true },
  wishingwell: { name: 'Wishing Well', cat: 'decor', w: 1, h: 1, level: 10, cost: 900, charm: 18 },
  fishgnome:   { name: 'Fishing Gnome', cat: 'decor', w: 1, h: 1, level: 10, cost: 400, charm: 9 },
  stringlights:{ name: 'Lantern Posts', cat: 'decor', w: 2, h: 1, level: 11, cost: 700, charm: 14, light: 1 },
  frogstatue:  { name: 'Frog Statue', cat: 'decor', w: 1, h: 1, level: 12, cost: 1500, charm: 20 },
  tractor:     { name: 'Little Tractor', cat: 'decor', w: 2, h: 2, level: 16, cost: 12000, charm: 45 },
  greenhouse:  { name: 'Glasshouse', cat: 'decor', w: 3, h: 2, level: 18, cost: 25000, charm: 80 },
  bigtree:     { name: 'Grand Old Oak', cat: 'decor', w: 2, h: 2, level: 20, cost: 40000, charm: 100, tall: true },
  clocktower:  { name: 'Clock Tower', cat: 'decor', w: 2, h: 2, level: 25, cost: 150000, charm: 200 },
  // seasonal decorations: only sold during their season, yours to keep forever
  kite:        { name: 'Kite Post', cat: 'decor', w: 1, h: 1, level: 1, cost: 120, charm: 6, season: 'spring' },
  tulipbed:    { name: 'Tulip Bed', cat: 'decor', w: 2, h: 1, walk: true, level: 1, cost: 150, charm: 7, season: 'spring', flower: true },
  parasol:     { name: 'Sun Parasol', cat: 'decor', w: 1, h: 1, level: 1, cost: 140, charm: 6, season: 'summer' },
  lemonade:    { name: 'Lemonade Stand', cat: 'decor', w: 2, h: 1, level: 1, cost: 300, charm: 9, season: 'summer' },
  leafpile:    { name: 'Leaf Pile', cat: 'decor', w: 1, h: 1, walk: true, level: 1, cost: 60, charm: 4, season: 'autumn' },
  cornshocks:  { name: 'Corn Shocks', cat: 'decor', w: 1, h: 1, level: 1, cost: 160, charm: 7, season: 'autumn' },
  snowman:     { name: 'Snowman', cat: 'decor', w: 1, h: 1, level: 1, cost: 150, charm: 7, season: 'winter' },
  gifttree:    { name: 'Twinkle Pine', cat: 'decor', w: 1, h: 1, level: 1, cost: 400, charm: 12, season: 'winter', light: 1, tall: true },
  // festival exclusives: bought with ribbons during that season's festival
  maypole:     { name: 'Maypole', cat: 'decor', w: 1, h: 1, level: 1, cost: 0, ribbons: 20, festival: 'spring', charm: 25 },
  icecart:     { name: 'Ice Cream Cart', cat: 'decor', w: 2, h: 1, level: 1, cost: 0, ribbons: 25, festival: 'summer', charm: 25 },
  jackolantern:{ name: 'Lantern Pumpkins', cat: 'decor', w: 1, h: 1, level: 1, cost: 0, ribbons: 20, festival: 'autumn', charm: 25, light: 1 },
  lanterntree: { name: 'Lantern Tree', cat: 'decor', w: 2, h: 2, level: 1, cost: 0, ribbons: 40, festival: 'winter', charm: 45, light: 1, tall: true },
  ribbonarch:  { name: 'Ribbon Arch', cat: 'decor', w: 1, h: 1, walk: true, level: 1, cost: 0, ribbons: 15, festival: 'any', charm: 18 },
};

for (const [id, d] of Object.entries(DEFS)) {
  d.id = id;
  if (d.walk === undefined) d.walk = false;
}

// ---------- What each item is for ----------
// USES[item]: recipes that take it ({ out, at, r }), animals it feeds
// ({ feeds, at }) and hives it helps ({ bees, at }). SOURCES[item]: the
// buildings and trees that make it. Info cards read both.
export const USES = {}, SOURCES = {};
const addTo = (map, k, v) => (map[k] ||= []).push(v);
for (const [type, d] of Object.entries(DEFS)) {
  for (const r of d.recipes || []) { for (const k in r.in) addTo(USES, k, { out: r.out, at: type, r }); addTo(SOURCES, r.out, type); }
  if (d.animal) { addTo(USES, d.animal.feed, { feeds: d.animal.kind, at: type }); addTo(SOURCES, d.animal.item, type); }
  if (d.hive) addTo(SOURCES, d.hive.item, type);
  if (d.fruit) addTo(SOURCES, d.fruit, type);
}
for (const c of BEE_FLOWERS) addTo(USES, c, { bees: true, at: 'beehive' });
for (const c in CROPS) addTo(SOURCES, c, 'plot');

// ---------- Crop balance ----------
// Everything follows from what one harvest sells for: pricier crops cost more
// to plant and take longer, while earning a bit more per second. Crops with
// more uses, regrowing crops and seasonal crops give up some raw-sale profit
// in exchange for that extra benefit. Wheat seeds are the cheapest, and a farm
// with no coins at all still gets them free, so it can always start again.
export const SEED_SHARE = 0.25;
for (const [id, c] of Object.entries(CROPS)) {
  const harvest = ITEMS[id].value * c.yield;
  const uses = (USES[id] || []).length;
  c.seed = Math.max(1, Math.round(harvest * SEED_SHARE));
  let rate = (0.1 * Math.pow(harvest / 4, 0.25)) / (1 + 0.06 * Math.max(0, uses - 1)); // coins per second, sold raw
  if (c.season) rate *= 1.25;
  // regrowing crops: the first crop takes longer, then it keeps coming back
  const t = c.regrow ? harvest / ((1 - c.regrow) * rate * 1.1) : (harvest - c.seed) / rate;
  c.time = Math.max(30, Math.round(t / 5) * 5);
}

export const BUILD_TABS = [
  { id: 'field', name: 'Fields', cats: ['field', 'tree'] },
  { id: 'build', name: 'Buildings', cats: ['craft', 'animal', 'storage', 'house', 'utility'] },
  { id: 'path', name: 'Paths', cats: ['path', 'fence'] },
  { id: 'decor', name: 'Decor', cats: ['decor'] },
];

// ---------- Farmhands ----------
// tasks are listed in the order a farmhand of that role looks for them.
export const ROLES = {
  farmer:  { name: 'Farmer', desc: 'Plants, waters and harvests fields and trees.', tasks: ['harvest', 'plant', 'water', 'pickTree'], hat: 'straw' },
  hauler:  { name: 'Hauler', desc: 'Carries harvests to storage and supplies buildings.', tasks: ['haulPile', 'collect', 'supply', 'feed'], hat: 'cap' },
  artisan: { name: 'Artisan', desc: 'Runs the mill, bakery and other workshops.', tasks: ['operate', 'supply', 'collect'], hat: 'bandana' },
  rancher: { name: 'Rancher', desc: 'Feeds animals and gathers eggs, milk, wool and honey.', tasks: ['feed', 'collectAnimal', 'pickTree', 'haulPile'], hat: 'wide' },
};
export const ROLE_ORDER = ['farmer', 'hauler', 'artisan', 'rancher'];

// Hats farmhands can wear. Unlocked through achievements (ach) or bought (cost).
export const HATS = {
  flowercrown: { name: 'Flower Crown', ach: 'harvest:2' },
  chef:        { name: 'Chef Hat', ach: 'craft:2' },
  beanie:      { name: 'Cozy Beanie', cost: 2500 },
  buckethat:   { name: 'Bucket Hat', ach: 'fish:1' },
  beekeeper:   { name: 'Beekeeper Veil', ach: 'animal:2' },
  beret:       { name: 'Painter’s Beret', ach: 'charm:2' },
  froghat:     { name: 'Frog Hat', ach: 'veteran:0' },
  pumpkinhat:  { name: 'Pumpkin Hat', ach: 'pumpkin:0' },
  mushroomcap: { name: 'Mushroom Cap', cost: 25000 },
  tophat:      { name: 'Top Hat', ach: 'level:2' },
  wizard:      { name: 'Wizard Hat', ach: 'collect:2' },
  crown:       { name: 'Golden Crown', ach: 'land:4' },
  bunnyears:   { name: 'Bunny Ears', ribbons: 12, festival: 'spring' },
  sunhat:      { name: 'Sun Hat', ribbons: 12, festival: 'summer' },
  acornhat:    { name: 'Acorn Cap', ribbons: 12, festival: 'autumn' },
  earmuffs:    { name: 'Earmuffs', ribbons: 12, festival: 'winter' },
};

// ---------- Seasons & festivals ----------
// Seasons turn over every real week, all devices agree because it comes from
// the date. Crops a season favours grow 25% faster; in winter the rest grow a
// little slower. Each weekend the current season holds a festival.
export const SEASONS = [
  { id: 'spring', name: 'Spring', festival: 'Blossom Fair', favored: ['strawberry', 'carrot', 'cabbage', 'onion', 'tealeaf', 'raspberry', 'asparagus'] },
  { id: 'summer', name: 'Summer', festival: 'Melon Feast', favored: ['corn', 'tomato', 'blueberry', 'sunflower', 'watermelon', 'honeydew', 'bellpepper', 'cucumber', 'sunberry'] },
  { id: 'autumn', name: 'Autumn', festival: 'Harvest Moon Fair', favored: ['pumpkin', 'potato', 'wheat', 'grapes', 'beans', 'oats', 'cranberry', 'hops'] },
  { id: 'winter', name: 'Winter', festival: 'Lantern Festival', favored: ['frostmint', 'cabbage', 'onion', 'coffeebean', 'rice'] },
];
export const SEASON_BONUS = 1.25, WINTER_SLOW = 0.85;
export const FESTIVAL_ORDER_EVERY = 40 * 60; // seconds between festival orders
export const FESTIVAL_SLOTS = 3;

// ---------- Pets ----------
export const PETS = {
  cat:   { name: 'Cat', colors: ['#e8a060', '#3a3440', '#f4efe6', '#9a9aa8'] },
  dog:   { name: 'Dog', colors: ['#c08a50', '#f4efe6', '#5a3a28', '#e0c080'] },
  bunny: { name: 'Bunny', colors: ['#f4efe6', '#a88a70', '#d8d0d8', '#5a4a40'] },
  fox:   { name: 'Fox', colors: ['#e0702e', '#c8a080', '#f4efe6'] },
};
export const MAX_PETS = 4;
export const petCost = (n) => Math.round(400 * Math.pow(3, n));
export const PET_NAMES = ['Biscuit', 'Mochi', 'Pumpkin', 'Waffles', 'Pepper', 'Clover', 'Bean', 'Nutmeg', 'Toffee', 'Sprout', 'Maple', 'Pudding', 'Hazel', 'Pickle', 'Button', 'Juniper'];
// Everything a farmhand can do when their own job has nothing waiting.
export const ALL_TASKS = ['harvest', 'haulPile', 'plant', 'operate', 'supply', 'collect', 'feed', 'collectAnimal', 'pickTree', 'water'];

export const WORKER_NAMES = ['Pip', 'Bea', 'Tomo', 'Juniper', 'Odie', 'Marigold', 'Rook', 'Fern', 'Basil', 'Clover', 'Hazel', 'Milo',
  'Poppy', 'Sorrel', 'Wren', 'Otto', 'Daisy', 'Finch', 'Ivy', 'Bram', 'Lumi', 'Moss', 'Nettle', 'Quill', 'Rosa', 'Sage'];
export const SKIN = ['#f6d2ae', '#eebd92', '#d39b6a', '#a86f4c', '#7a4c32'];
export const HAIR = ['#3b2a20', '#6b4226', '#a8642e', '#e0b25a', '#d9733b', '#2a2a3a', '#9a9a9a', '#c94f5f'];
export const SHIRTS = ['#d9534f', '#4f8fd9', '#5fb35a', '#e8b23a', '#a66bd1', '#e07ba5', '#43b3a6', '#e8823a', '#f2efe6'];
export const PANTS = ['#4a5a8a', '#6b4a2b', '#3f6b4a', '#5a4a6b', '#8a6a3b'];

// The first two farmhands are cheap so a new farm can get going.
export const hireCost = (n) => (n < 2 ? [40, 80][n] : Math.round(120 * Math.pow(2.05, n - 2)));
export const MAX_WORKER_LEVEL = 10;
export const workerXpNeeded = (lvl) => Math.round(30 * Math.pow(1.7, lvl - 1));

// ---------- Upgrades ----------
export const UPGRADES = [
  { id: 'grow',   name: 'Green Thumb',   desc: 'Crops grow 10% faster per level.', max: 10, base: 150, k: 1.85, level: 1, icon: 'sprout' },
  { id: 'boots',  name: 'Comfy Boots',   desc: 'Farmhands walk 8% faster per level.', max: 8, base: 200, k: 1.9, level: 2, icon: 'boot' },
  { id: 'basket', name: 'Bigger Baskets', desc: 'Farmhands carry 1 more item per level.', max: 6, base: 300, k: 2.3, level: 2, icon: 'basket' },
  { id: 'tools',  name: 'Fine Tools',    desc: 'Planting, harvesting and handling are 10% quicker per level.', max: 10, base: 250, k: 1.85, level: 3, icon: 'hoe' },
  { id: 'water',  name: 'Deep Well',     desc: 'Watered crops get +10% more growth speed per level.', max: 5, base: 400, k: 2.1, level: 3, icon: 'drop' },
  { id: 'haggle', name: 'Haggling',      desc: 'Everything sells for 5% more per level.', max: 10, base: 500, k: 1.9, level: 4, icon: 'coin' },
  { id: 'animal', name: 'Happy Animals', desc: 'Animals and bees produce 12% faster per level.', max: 8, base: 600, k: 1.9, level: 4, icon: 'egg' },
  { id: 'craft',  name: 'Artisan Skill', desc: 'Workshops craft 10% faster per level.', max: 10, base: 800, k: 1.85, level: 5, icon: 'gear' },
  { id: 'bumper', name: 'Bumper Crops',  desc: '+8% chance per level of an extra item each harvest.', max: 8, base: 1000, k: 2.0, level: 6, icon: 'star' },
  { id: 'night',  name: 'Night Shift',   desc: 'The farm keeps working 2 more hours while you are away (base 8h).', max: 8, base: 1200, k: 1.8, level: 4, icon: 'moon' },
];
export const upgradeCost = (u, lvl) => Math.round(u.base * Math.pow(u.k, lvl));

// ---------- Farm levels ----------
// XP comes from coins earned (sales and orders).
const XP_TABLE = [0, 0, 60, 200, 500, 1000, 1800, 3000, 4800, 7500, 11000, 16000, 23000, 32000, 45000, 62000];
export const MAX_LEVEL = 40;
export function xpForLevel(l) {
  if (l < XP_TABLE.length) return XP_TABLE[l];
  return Math.round(XP_TABLE[XP_TABLE.length - 1] * Math.pow(1.38, l - XP_TABLE.length + 1));
}
export const levelReward = (l) => 25 * l * l;

// ---------- Land ----------
export const parcelCost = (bought) => Math.round(250 * Math.pow(1.48, bought));
export const parcelLevel = (bought) => 1 + Math.floor(bought * 0.75);

// ---------- Charm ----------
// Decorations add charm; charm adds a small sell bonus (capped).
export const CHARM_BONUS_PER = 0.0025;
export const CHARM_BONUS_MAX = 0.25;

// ---------- Orders ----------
export const ORDER_SLOTS = 3;
export const ORDER_EVERY = 8 * 60;     // seconds between new orders
export const ORDER_NAMES = ['Granny Elm', 'Baker Rue', 'Mayor Pell', 'Tilly the Cook', 'Old Barnaby', 'Miss Clementine', 'Chef Augustin',
  'Farmer Joss', 'Little Nim', 'Innkeeper Bram', 'Professor Wick', 'Auntie Fen'];

// ---------- Weather ----------
export const RAIN_BLOCK = 20 * 60;     // weather changes in 20 minute blocks
export const RAIN_CHANCE = 0.14;

// ---------- Goals (a gentle guided path) ----------
// check(s, w) -> number progress toward n.
const count = (w, type) => w.objects.filter((o) => o.type === type).length;
export const GOALS = [
  { text: 'Hire a farmer (Farmhands menu)', n: 1, check: (s) => s.workers.filter((w) => w.role === 'farmer').length, reward: 30 },
  { text: 'Build 4 wheat field plots', n: 4, check: (s, w) => w.plots.length, reward: 40 },
  { text: 'Harvest 30 wheat', n: 30, check: (s) => s.stats.harvest.wheat || 0, reward: 50 },
  { text: 'Sell goods at the market', n: 1, check: (s) => (s.stats.soldCoins > 0 ? 1 : 0), reward: 30 },
  { text: 'Plant some carrots', n: 4, check: (s, w) => w.plots.filter((p) => p.crop === 'carrot').length, reward: 50 },
  { text: 'Hire a hauler to carry harvests', n: 1, check: (s) => s.workers.filter((w) => w.role === 'hauler').length, reward: 60 },
  { text: 'Lay 10 path tiles', n: 10, check: (s, w) => w.objects.filter((o) => o.type.startsWith('path_')).length, reward: 60 },
  { text: 'Fill an order on the notice board', n: 1, check: (s) => s.stats.orders || 0, reward: 100 },
  { text: 'Build a Well', n: 1, check: (s, w) => count(w, 'well'), reward: 80 },
  { text: 'Unlock strawberries', n: 1, check: (s) => (s.seeds.strawberry ? 1 : 0), reward: 60 },
  { text: 'Plant 8 flowers', n: 8, check: (s, w) => w.objects.filter((o) => DEFS[o.type].flower).length, reward: 80 },
  { text: 'Buy a new parcel of land', n: 3, check: (s) => s.map.owned.filter(Boolean).length, reward: 150 },
  { text: 'Reach farm level 3', n: 3, check: (s) => s.level, reward: 120 },
  { text: 'Build a Mill', n: 1, check: (s, w) => count(w, 'mill'), reward: 150 },
  { text: 'Make 10 flour', n: 10, check: (s) => s.stats.craft.flour || 0, reward: 150 },
  { text: 'Build a Chicken Coop', n: 1, check: (s, w) => count(w, 'coop'), reward: 150 },
  { text: 'Collect 15 eggs', n: 15, check: (s) => s.stats.harvest.egg || 0, reward: 200 },
  { text: 'Hire an Artisan', n: 1, check: (s) => s.workers.filter((x) => x.role === 'artisan').length, reward: 150 },
  { text: 'Reach farm level 5', n: 5, check: (s) => s.level, reward: 400 },
  { text: 'Build a Bakery', n: 1, check: (s, w) => count(w, 'bakery'), reward: 500 },
  { text: 'Bake 10 bread', n: 10, check: (s) => s.stats.craft.bread || 0, reward: 600 },
  { text: 'Plant 2 apple trees', n: 2, check: (s, w) => count(w, 'appletree'), reward: 400 },
  { text: 'Reach 50 charm', n: 50, check: (s, w) => Math.floor(w.charm), reward: 500 },
  { text: 'Adopt a pet', n: 1, check: (s) => (s.pets || []).length, reward: 300 },
  { text: 'Build a Beehive', n: 1, check: (s, w) => count(w, 'beehive'), reward: 400 },
  { text: 'Have 6 farmhands', n: 6, check: (s) => s.workers.length, reward: 800 },
  { text: 'Reach farm level 7', n: 7, check: (s) => s.level, reward: 1500 },
  { text: 'Build a Cow Shed', n: 1, check: (s, w) => count(w, 'cowshed'), reward: 1200 },
  { text: 'Make 10 butter', n: 10, check: (s) => s.stats.craft.butter || 0, reward: 1500 },
  { text: 'Bake a cake', n: 1, check: (s) => s.stats.craft.cake || 0, reward: 2500 },
  { text: 'Own 10 parcels of land', n: 10, check: (s) => s.map.owned.filter(Boolean).length, reward: 5000 },
  { text: 'Reach farm level 10', n: 10, check: (s) => s.level, reward: 8000 },
  { text: 'Build a Winery', n: 1, check: (s, w) => count(w, 'winery'), reward: 8000 },
  { text: 'Make 20 wine', n: 20, check: (s) => s.stats.craft.wine || 0, reward: 15000 },
  { text: 'Reach 300 charm', n: 300, check: (s, w) => Math.floor(w.charm), reward: 20000 },
  { text: 'Have 12 farmhands', n: 12, check: (s) => s.workers.length, reward: 25000 },
  { text: 'Reach farm level 15', n: 15, check: (s) => s.level, reward: 50000 },
  { text: 'Build a Cookhouse', n: 1, check: (s, w) => count(w, 'cookhouse'), reward: 3000 },
  { text: 'Cook 10 bowls of oatmeal', n: 10, check: (s) => s.stats.craft.oatmeal || 0, reward: 4000 },
  { text: 'Build a Pickling Shed', n: 1, check: (s, w) => count(w, 'pickler'), reward: 4000 },
  { text: 'Make 15 jars of pickles', n: 15, check: (s) => s.stats.craft.pickles || 0, reward: 8000 },
  { text: 'Build a Duck House', n: 1, check: (s, w) => count(w, 'duckhouse'), reward: 5000 },
  { text: 'Build a Fishing Dock by the water', n: 1, check: (s, w) => count(w, 'dock'), reward: 10000 },
  { text: 'Catch 50 fish', n: 50, check: (s) => s.stats.harvest.fish || 0, reward: 12000 },
  { text: 'Build a Sweet Shop', n: 1, check: (s, w) => count(w, 'sweets'), reward: 12000 },
  { text: 'Plant a Tapped Maple', n: 1, check: (s, w) => count(w, 'mapletree'), reward: 20000 },
  { text: 'Flip 10 stacks of pancakes', n: 10, check: (s) => s.stats.craft.pancakes || 0, reward: 40000 },
  { text: 'Reach farm level 18', n: 18, check: (s) => s.level, reward: 80000 },
  { text: 'Build the Tea House', n: 1, check: (s, w) => count(w, 'teahouse'), reward: 100000 },
  { text: 'Brew 25 cups of tea', n: 25, check: (s) => s.stats.craft.tea || 0, reward: 120000 },
  { text: 'Collect 75 different goods', n: 75, check: (s) => discovered(s), reward: 200000 },
  { text: 'Reach farm level 20', n: 20, check: (s) => s.level, reward: 250000 },
  { text: 'Serve 25 lattes', n: 25, check: (s) => s.stats.craft.latte || 0, reward: 400000 },
  { text: 'Reach 1,000 charm', n: 1000, check: (s, w) => Math.floor(w.charm), reward: 500000 },
  { text: 'Have 20 farmhands', n: 20, check: (s) => s.workers.length, reward: 600000 },
  { text: 'Own every parcel of land', n: 30, check: (s) => s.map.owned.filter(Boolean).length, reward: 1000000 },
  { text: 'Build the Clock Tower', n: 1, check: (s, w) => count(w, 'clocktower'), reward: 1500000 },
  { text: 'Reach farm level 25', n: 25, check: (s) => s.level, reward: 3000000 },
  { text: 'Discover every good in the collection', n: Object.keys(ITEMS).length, check: (s) => discovered(s), reward: 5000000 },
  { text: 'Reach farm level 30', n: 30, check: (s) => s.level, reward: 10000000 },
];

/** Number of different goods ever harvested or made. */
export function discovered(s) {
  const seen = new Set([...Object.keys(s.stats.harvest), ...Object.keys(s.stats.craft)]);
  let n = 0;
  for (const k of seen) if (ITEMS[k] && ((s.stats.harvest[k] || 0) + (s.stats.craft[k] || 0)) > 0) n++;
  return n;
}

// ---------- Achievements ----------
// Each has tiers; claiming a tier pays coins (and some unlock hats, see HATS).
const sumOf = (obj, keys) => keys.reduce((a, k) => a + (obj[k] || 0), 0);
const CROP_KEYS = () => Object.keys(CROPS);
const BAKED = ['bread', 'potatobread', 'cornbread', 'cake', 'applepie', 'pumpkinpie', 'muffin', 'plumcake', 'peachtart', 'pancakes'];
const DRINKS = ['beer', 'cider', 'mead', 'stout', 'wine', 'grapejuice', 'plumwine', 'peachwine', 'ricewine', 'raswine', 'soda', 'tea', 'coffee', 'latte', 'chai'];
const PRESERVES = ['strawjam', 'bluejam', 'cherryjam', 'rasjam', 'plumjam', 'peachjam', 'melonjelly', 'wmjelly', 'pickles', 'sauerkraut', 'pickledpep', 'pickledon'];
export const ACHIEVEMENTS = [
  { id: 'harvest', name: 'Green Thumb', what: 'Harvest crops', tiers: [100, 1000, 10000, 100000, 1000000], value: (s) => sumOf(s.stats.harvest, CROP_KEYS()) },
  { id: 'earn', name: 'Nest Egg', what: 'Earn coins', tiers: [1000, 10000, 100000, 1e6, 1e7, 1e8], value: (s) => s.stats.earned },
  { id: 'craft', name: 'Handmade', what: 'Craft goods in workshops', tiers: [10, 100, 1000, 10000, 100000], value: (s) => Object.values(s.stats.craft).reduce((a, b) => a + b, 0) },
  { id: 'baker', name: 'Rise and Shine', what: 'Bake breads, pies and cakes', tiers: [25, 250, 2500], value: (s) => sumOf(s.stats.craft, BAKED) },
  { id: 'drinks', name: 'Cheers!', what: 'Brew drinks of any kind', tiers: [25, 250, 2500], value: (s) => sumOf(s.stats.craft, DRINKS) },
  { id: 'jars', name: 'Pantry Shelves', what: 'Put up jams, jellies and pickles', tiers: [25, 250, 2500], value: (s) => sumOf(s.stats.craft, PRESERVES) },
  { id: 'animal', name: 'Barnyard Friends', what: 'Collect eggs, milk, wool and honey', tiers: [100, 1000, 10000, 50000], value: (s) => sumOf(s.stats.harvest, ['egg', 'duckegg', 'milk', 'wool', 'honey']) },
  { id: 'fruit', name: 'Orchard Keeper', what: 'Pick fruit and sap from trees', tiers: [100, 1000, 10000], value: (s) => sumOf(s.stats.harvest, ['apple', 'cherry', 'orange', 'plum', 'peach', 'sap']) },
  { id: 'fish', name: 'Gone Fishing', what: 'Catch fish', tiers: [25, 250, 2500], value: (s) => s.stats.harvest.fish || 0 },
  { id: 'pumpkin', name: 'Great Pumpkin', what: 'Grow pumpkins', tiers: [100], value: (s) => s.stats.harvest.pumpkin || 0 },
  { id: 'orders', name: 'Good Neighbour', what: 'Fill orders', tiers: [5, 25, 100, 500, 2000], value: (s) => s.stats.orders },
  { id: 'hands', name: 'Full House', what: 'Hire farmhands', tiers: [4, 8, 12, 16, 20], value: (s) => s.workers.length },
  { id: 'veteran', name: 'Old Hand', what: 'Train a farmhand to level 10', tiers: [1], value: (s) => s.workers.filter((x) => x.lvl >= 10).length },
  { id: 'charm', name: 'Picture Perfect', what: 'Reach charm', tiers: [25, 100, 300, 800, 2000], value: (s, w) => Math.floor(w.charm) },
  { id: 'land', name: 'Rolling Acres', what: 'Own parcels of land', tiers: [4, 8, 15, 22, 30], value: (s) => s.map.owned.filter(Boolean).length },
  { id: 'level', name: 'Farm Famous', what: 'Reach farm level', tiers: [5, 10, 20, 30, 40], value: (s) => s.level },
  { id: 'pets', name: 'Best Friends', what: 'Give your pets a pat', tiers: [10, 100, 1000], value: (s) => s.stats.pats || 0 },
  { id: 'festival', name: 'Fair Favourite', what: 'Fill festival orders', tiers: [5, 25, 100, 300], value: (s) => s.stats.festOrders || 0 },
  { id: 'collect', name: 'Collector', what: 'Discover different goods', tiers: [10, 25, 50, 75, 100], value: (s) => discovered(s) },
];
export const achReward = (a, tier) => Math.round(80 * Math.pow(4.2, tier) * (a.tiers.length > 3 ? 1 : 1.6));

