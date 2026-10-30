# Pocket Meadow

A cozy, top-down pixel-art idle farming game for your phone and laptop. Little farmhands plant, water, harvest, carry goods and run workshops on their own, and the farm keeps working while you're away.

There is no build step and no dependencies. It's plain JavaScript modules and a canvas, and every bit of art is drawn in code, so you can deploy the folder exactly as it is.

## What's in the game

- **Farmhands** you can watch working: Farmers (fields and fruit trees), Haulers (carry harvests, stock workshops), Artisans (run workshops) and Ranchers (animals and bees). Each has walking, carrying, working, sitting and idle animations. They level up as they work. When their own job runs out, they help with other jobs.
- **26 crops** (wheat to coffee), 6 fruit trees including a tapped maple for syrup, chickens, ducks, cows, sheep, beehives, and a fishing dock you build beside the stream or pond.
- **13 workshops with 69 recipes**, for example wheat → flour → bread or pancakes, cucumbers + vinegar → pickles, oats + milk → oatmeal, sap → maple syrup → maple candy, tea leaves → tea → honey chai, coffee → latte, grapes, plums and peaches → wine, and berries and melons → jams and jellies.
- **Economy:** market selling, auto-sell with a "keep" amount, orders from neighbours on the notice board, 10 farm-wide upgrades, building upgrades, 40 farm levels.
- **Long-term goals:** the Journal holds about 60 guided goals, 17 tiered achievements (several unlock hats), and a collection book of 107 goods to discover. 12 hats can be earned or bought and given to any farmhand.
- **Expansion and decoration:** 30 land parcels, 6 path types (farmhands walk faster on paths), 6 fences and hedges, and 57 decorations up to a Glasshouse, a Grand Old Oak and a Clock Tower. Decorations add charm, which raises sell prices a little.
- **Look:** a warm "Golden Cozy" palette by day that turns into a teal-and-amber "Moody Evening" at night, following your real clock. It has soft cast shadows, blocky pixel lamplight, rain, chimney smoke, butterflies and fireflies. Add `?hour=21` to the address to preview night, `?season=winter` to preview a season, or `?festival=1` to preview a festival.
- **Seasons:** spring, summer, autumn and winter turn over every real week. Each season changes the ground and trees (blossom, autumn colour, snow), gives in-season crops +25% growth, and sells its own decorations. Spring, summer, autumn and winter each have one crop that can only be planted that season.
- **Festivals:** every weekend the season holds a fair (Blossom Fair, Melon Feast, Harvest Moon Fair, Lantern Festival). Bunting goes up, festival orders pay ribbons, and ribbons buy decorations and hats you can't get any other way. Tap the season chip at the top.
- **Pets:** adopt up to 4 cats, dogs, bunnies or foxes in Farmhands. They wander, nap, follow your farmhands and love a pat.
- **Idle progress:** when you come back, the farm fast-forwards through the time you were away (8 hours by default, up to 24 with the Night Shift upgrade) and shows a "Welcome back" summary.
- **Cloud save:** sign in with your Tally account and your phone and laptop share one farm.

## Code layout

| File | What it does |
|---|---|
| `js/data.js` | **All content**: items, crops, buildings, recipes, decorations, upgrades, roles, levels, goals. Add content here. |
| `js/world.js` | Game state, new-farm setup, map, placement rules, inventory, upgrade effects |
| `js/sim.js` | Simulation: growth, animals, workshops, orders, and the farmhand job system |
| `js/path.js` | A* pathfinding (paths are cheaper to walk) |
| `js/economy.js` | Selling, buying, upgrades, land, hiring, orders |
| `js/save.js` | Local save and offline catch-up |
| `js/cloud.js` | Supabase sign-in and cloud save (plain `fetch`) |
| `js/render.js` | Canvas renderer: depth sorting, lighting, weather, particles, overlays |
| `js/input.js` | Touch and mouse: pan, pinch, wheel zoom, tap, paint |
| `js/ui.js` | Menus, selection card, placement modes, dialogs |
| `js/art/*.js` | Pixel-art sprites drawn in code (buildings, crops, characters, hats, decorations, icons). `grade.js` holds the day colour grade. |
| `supabase/schema.sql` | The cloud-save table. Run it once (see below). |
| `tests/index.html` | In-browser test suite (simulation, economy, offline, save/load, sync) |

**Adding content:** a new crop needs an entry in `ITEMS` and `CROPS` in `data.js`, plus a drawing in `js/art/plants.js` (and an icon kind in `js/art/items.js` if no existing kind fits). A new workshop is a `DEFS` entry with `recipes`, plus a drawing in `js/art/buildings.js`. A new decoration is a `DEFS` entry plus a drawing in `js/art/decor.js`. Menus, recipes, orders and the level-up screen pick up new entries automatically.

## Run it on your computer

```
cd tally-app
/usr/bin/ruby -run -e httpd meadow -p 8010
```

Open http://localhost:8010. The tests are at http://localhost:8010/tests/.

## Set up cloud save (once, about 2 minutes)

The game uses the same Supabase project and the same login as Tally. It just needs one new table:

1. Open https://supabase.com/dashboard and pick your Tally project.
2. Go to **SQL Editor**, then **New query**.
3. Paste everything from `supabase/schema.sql` and click **Run**.

In the game, open **Menu** and sign in with your Tally email and password. Do the same on your other device. The farm uploads every minute and whenever you leave, and on opening each device loads the newest copy.

## Letting someone else play

Every account gets its own private farm. The database only ever shows each account its own row. People who share a phone or laptop don't mix farms either, because each account keeps its own copy on the device and signing out switches back to a separate "guest" farm.

Your Supabase project has sign-ups switched off (it's shared with Tally), so add a new player by hand:

1. In the Supabase dashboard, open **Authentication → Users → Add user → Create new user**.
2. Enter their email and a password, and tick **Auto Confirm User**.
3. They open the game, go to **Menu**, and sign in. A brand-new account can either take over the farm already on that device or start fresh.

The **Create account** button in the game works too if you ever turn on sign-ups (**Authentication → Sign In / Providers → Allow new users to sign up**). That would also let anyone create a Tally login. They would only ever see their own data, but adding people by hand keeps both apps closed.

**Backups:** Menu → Backups downloads the farm as a file, and **Restore backup…** loads one back.

## Put it online

Any static HTTPS host works. iPhones need HTTPS for the Home Screen app and offline support.

**Vercel** (like Tally): put this folder in its own GitHub repository, then in Vercel choose **Add New → Project**, import that repository and click **Deploy** (no settings needed). Every `git push` redeploys.

**GitHub Pages**: in the repository's **Settings → Pages**, set the source to the `main` branch and the root folder.

**Every release:** bump `VERSION` in `sw.js`, or phones keep the cached old version.

## Install on your phone

- **iPhone:** open the game's URL in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open it in Chrome, tap the menu, then **Install app**.

It opens full screen like a normal app and works offline. Sign in once on each device to share the farm.
