# saltline-open-world

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ItzSudhan/saltline-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ItzSudhan/saltline-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Saltline** is an original open-world crime game set in Saltline Bay, a sunny coastal city. It runs in the browser on three.js and makes no network requests. You play Rae Castillo, working up from stolen cars to the vault under Halcyon Trust across five story jobs: steal, deliver, chase, eliminate, hold and escape.

- **City:** generated street grid with outskirts and hills, a day/night cycle with lit windows after dark, parked cars and shopfronts.
- **Traffic and pedestrians:** AI cars and scooters follow the roads, pedestrians walk the sidewalks, and beach-goers settle under umbrellas on Sunbreak Beach. You can drive any car or go on foot. The street reacts to a chase: drivers brake and swerve to the kerb for sirens or a speeding getaway car, and pedestrians run from the pursuit with their hands up. If you aim a gun at a slow car, its driver bails out and the car is yours to steal.
- **Near misses:** passing close to civilian traffic at speed pays cash and RP, and quick chains build a combo up to x5.
- **Police:** HEAT is a wanted level from 0 to 5, shown as a row of flames. Saltline Bay PD answers with a roster of named units, and the HUD lists each one with its live distance and what it is doing: ramming, flanking, pursuing, responding or holding a roadblock. At HEAT 3 an air unit flies over with a searchlight, and staying lit stops the heat cooling off. At HEAT 4 two cruisers park across the road ahead. Stay out of sight long enough and the heat cools off.
- **Weapons and rank:** five slots (fists, pistol, SMG, shotgun, rifle), switched with 1-5. Jobs, races, stashes and crimes earn RP toward ten ranks, and rank 3 and rank 6 unlock the shotgun and the rifle.
- **Crew:** three specialists on hotkeys with cooldowns. Z (Juno) swaps the plates: HEAT -1. X (Dex) does a quick fix: the car is repaired. C (Pip) puts eyes out: every police unit shows on the minimap for 22 s. Their portraits, and every face in the dialogue box, are painted on canvas.
- **Missions:** the HUD shows the mission number and title, stage n/m with a progress bar, a timer when there is one, and the next stage. The speedometer shows the car's name, its damage and the radio track playing.
- **Services and activities:** garage respray, gun shop and safehouse, plus the Sunbreak Sprint, a checkpoint street race with prize money and best-time records.
- **Save:** story progress, money, rank RP, weapons, armour, stashes found and your position are saved in localStorage.

Controls: WASD move/drive, mouse aim, LMB shoot, 1-5 weapons, F enter/exit car, Space handbrake, Q look back, Z/X/C crew, R radio, M map, Esc pause.

Headless checks (open with the server running): `?shot=soak` (100 s of random play), `?shot=missiontest` (plays every job and the race), `?shot=systemstest` (air unit, roadblock, roster, crew abilities, rank save, traffic yielding, gunpoint steal, near miss). The pause map (M or Esc) lists every story job with its giver and its pay, beside tiles for cash, rank, story progress and HEAT.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=1pww8frk&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
