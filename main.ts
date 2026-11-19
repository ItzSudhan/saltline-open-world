// SALTLINE: an original open-world crime game set in the sun-soaked coastal city of Saltline Bay
// (three.js, plain ES modules under game/src). This program hands it in for make.fun's gta6-01.
//
// You play Rae Castillo, working up from stolen cars to the vault under Halcyon Trust across five
// story jobs. The city is generated: a street grid, the outskirts and the hills, a day/night cycle
// with lit windows after dark, and traffic and pedestrians. You can drive or go on foot, and there
// are weapons. HEAT is a wanted level from 0 to 5: Saltline Bay PD sends pursuit cars and officers
// on foot after you. The city also has a garage respray, a gun shop and a safehouse, plus the
// Sunbreak Sprint street race with best-time records. Saves go to localStorage. The game is
// game/: plain static files (game/index.html and its ES modules, three.js vendored), no network
// requests.
//
// The police response is a roster of named units (police/PoliceRoster.js). Each one has a live
// behaviour: ramming, flanking, pursuing, responding or holding a roadblock. At HEAT 3 an air
// unit arrives with a searchlight (police/Helicopter.js), and at HEAT 4 two cruisers park across
// the road ahead (police/Roadblocks.js). Jobs, races, stashes and crimes earn RP toward ten ranks
// (progression/RankSystem.js), and ranks unlock a shotgun and a rifle in the five weapon slots.
// Three crew members have hotkey abilities with cooldowns (crew/CrewAbilities.js): swap plates
// (-1 HEAT), quick fix (repair the car) and eyes out (police on the minimap). Portraits are
// painted on canvas (ui/Portraits.js). Sunbreak Beach has umbrellas, towels and beach-goers
// (world/BeachProps.js), and scooters ride in traffic.
//
// The street reacts to a chase: civilian drivers brake and swerve to the kerb for sirens or a
// speeding getaway car (ai/TrafficSystem.js), and pedestrians run from the pursuit with their hands
// up (ai/PedestrianSystem.js). If you aim a gun at a slow car, its driver bails out and the car is
// yours to steal. Threading past traffic at speed pays near-miss combos in cash and RP
// (activities/NearMiss.js). The pause map lists every story job with its giver and its pay, beside
// tiles for cash, rank, story progress and HEAT (ui/Menus.js).
//
// This program (Node 22, standard library only) hands the game in. It copies game/ and screenshots/
// to /output and uses the vendored make.fun library to write /output/dossier.json, the summary the
// judge reads.
//
// Play it locally: run `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
