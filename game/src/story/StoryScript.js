// The story of Saltline: who's who, and the five jobs that take Rae Castillo from stolen cars
// to the vault under Halcyon Trust. Missions are data; MissionDirector plays them.

// Each character's `look` is painted into the dialogue portrait by ui/Portraits.js.
export const CAST = {
  rae: { name: 'Rae Castillo', initials: 'RC', color: '#ff6b5a', role: 'Ferry pilot · driver',
    look: { skin: '#c48a62', hair: '#3a1f14', style: 'long', shirt: '#ff6b5a', bg: '#5a2a3a', earring: '#ffd166' } },
  tide: { name: "Tomas 'Tide' Okafor", initials: 'TO', color: '#ffb347', role: "Fixer · Tide's Garage",
    look: { skin: '#6b4330', hair: '#1a1210', style: 'buzz', shirt: '#2b5d7b', collar: '#ffb347', bg: '#5a3a14', beard: '#1a1210', smile: true } },
  nadia: { name: 'Nadia Sol', initials: 'NS', color: '#ff4fa0', role: 'Club owner · The Lantern',
    look: { skin: '#e8c0a0', hair: '#141016', style: 'bun', shirt: '#5b3a78', bg: '#4a1840', glasses: '#ff4fa0', shades: true, earring: '#ffffff' } },
  voss: { name: 'Councilman Harlan Voss', initials: 'HV', color: '#9fb4c7', role: 'City council',
    look: { skin: '#f0c8a8', hair: '#f2f2f2', style: 'short', shirt: '#22252b', collar: '#c3242f', bg: '#2a3442', stern: true } },
  benny: { name: 'Benny Coral', initials: 'BC', color: '#ff9f1c', role: 'Coral Kings boss',
    look: { skin: '#a8714f', hair: '#2a1712', style: 'buzz', shirt: '#ff9f1c', bg: '#4a2a10', cap: '#ff9f1c', capBadge: '#19d3c5', stern: true } },
  dispatch: { name: 'SBPD Dispatch', initials: 'PD', color: '#6ab7ff', role: 'Saltline Bay PD',
    look: { skin: '#d9a07a', hair: '#2a2420', style: 'bun', shirt: '#1d3f8a', collar: '#ffffff', bg: '#14264a', headset: true } },
  news: { name: 'Wave 104.2 News', initials: 'FM', color: '#19d3c5', role: 'Radio news',
    look: { skin: '#8a5a3c', hair: '#120c0a', style: 'curly', shirt: '#19d3c5', bg: '#0f3a40', headset: true, smile: true } },
};

export const MISSIONS = [
  {
    id: 'wheels', title: 'Salt in the Wound', giver: 'tide', start: 'garage', reward: 1500,
    unlock: 'Tide\'s Garage: drive in to repair your car and cool off the heat ($250)',
    intro: [
      ['tide', 'Rae! Ferry licence still suspended? Good. I have work that pays better than boats.'],
      ['tide', 'Client wants a Kestrel GT. Cherry red. One is parked up in Coral Heights.'],
      ['rae', 'Steal it, bring it here, don\'t scratch it. I know the drill, Tide.'],
    ],
    steps: [
      { type: 'spawnCar', id: 'kestrel', car: 'kestrel', at: 'kestrel', heading: 0 },
      { type: 'enterCar', id: 'kestrel', text: 'Steal the red Kestrel GT in Coral Heights' },
      { type: 'say', lines: [['tide', 'Bring her home. Cops get curious about a Kestrel doing two hundred.']] },
      { type: 'deliver', id: 'kestrel', to: 'garageBay', text: 'Deliver the Kestrel GT to Tide\'s Garage' },
    ],
    outro: [['tide', 'Not a scratch. Okay, one scratch. Here\'s your cut, and the garage is yours to use.']],
  },
  {
    id: 'ledger', title: 'Paper Tide', giver: 'nadia', start: 'club', reward: 2500,
    unlock: 'Squall SMG added to your arsenal',
    intro: [
      ['nadia', 'You\'re Tide\'s driver? A ledger is waiting for me at the foot of Driftwood Pier.'],
      ['nadia', 'It lists every dirty dollar Councilman Voss moves through Halcyon Trust.'],
      ['rae', 'And the people who want it back?'],
      ['nadia', 'Drive fast, sweetheart.'],
    ],
    steps: [
      { type: 'goto', to: 'pier', text: 'Collect the ledger at Driftwood Pier', radius: 7 },
      { type: 'say', lines: [['dispatch', 'All units: armed courier reported at Driftwood Pier.'], ['rae', 'Got the ledger. Got company too.']] },
      { type: 'wanted', level: 2 },
      { type: 'goto', to: 'club', text: 'Get the ledger to the Lantern Club', timeLimit: 150, radius: 6 },
    ],
    outro: [['nadia', 'Beautiful. Take this, and take the Squall. You\'ll need it with Voss awake.']],
    give: { weapon: 'smg', ammo: 150 },
  },
  {
    id: 'courier', title: 'Taillight Run', giver: 'nadia', start: 'club', reward: 4000,
    unlock: 'Body armour restocked at every safehouse visit',
    intro: [
      ['nadia', 'Voss knows we have a copy. His courier is moving the original books.'],
      ['nadia', 'Black Sable Interceptor, heading through Palmetto Yards. Wreck it before it reaches the bank.'],
    ],
    steps: [
      { type: 'spawnChase', id: 'courier', car: 'courier', at: 'courierStart' },
      { type: 'destroy', id: 'courier', text: 'Wreck the black Sable Interceptor', timeLimit: 180 },
      { type: 'say', lines: [['rae', 'Books are ash. So is the car.'], ['dispatch', 'Vehicle fire in progress, suspect fleeing!']] },
      { type: 'wanted', level: 2 },
      { type: 'loseWanted', text: 'Lose the heat' },
    ],
    outro: [['nadia', 'Voss is bleeding money. He will send dogs next. Stay sharp.']],
    give: { armor: 100 },
  },
  {
    id: 'kings', title: 'Boardwalk Kings', giver: 'tide', start: 'garage', reward: 5000,
    unlock: 'Marlin Vela sports car waiting at Pelican Suites',
    intro: [
      ['tide', 'The Coral Kings turned my shop upside down. Voss is paying them to find you.'],
      ['tide', 'They run the Sunbreak Boardwalk. Benny Coral holds court by the big wheel.'],
      ['rae', 'Then I\'ll go and say hello.'],
    ],
    steps: [
      { type: 'goto', to: 'boardwalk', text: 'Head to Sunbreak Boardwalk', radius: 45 },
      { type: 'spawnGang', tag: 'kings', at: 'boardwalk', count: 6 },
      { type: 'say', lines: [['benny', 'Castillo! Voss pays double if you come in breathing. Kings, get her!']] },
      { type: 'eliminate', tag: 'kings', text: 'Take out the Coral Kings' },
      { type: 'wanted', level: 2 },
      { type: 'loseWanted', text: 'Lose the heat' },
    ],
    outro: [['tide', 'Kings are done on the boardwalk. I left you something sporty at Pelican Suites.']],
  },
  {
    id: 'heist', title: 'Halcyon Heist', giver: 'nadia', start: 'safehouse', reward: 25000,
    unlock: 'The city is yours. Free roam, Salt Stashes and the open road.',
    intro: [
      ['nadia', 'The ledger proves it: Voss\'s slush fund sits in the Halcyon Trust vault.'],
      ['tide', 'Grab wheels, park at the bank. Rae walks in, Rae walks out rich.'],
      ['rae', 'And Voss goes down with his vault.'],
    ],
    steps: [
      { type: 'goto', to: 'bankCurb', text: 'Bring a getaway car to Halcyon Trust', inVehicle: true, radius: 8 },
      { type: 'goto', to: 'bank', text: 'Walk into Halcyon Trust', onFoot: true, radius: 4 },
      { type: 'say', lines: [['dispatch', 'Silent alarm at Halcyon Trust! All units respond!'], ['nadia', 'Vault timer is running. Hold the lobby!']] },
      { type: 'wanted', level: 3 },
      { type: 'spawnGuards', at: 'bank', count: 3 },
      { type: 'hold', to: 'bank', seconds: 14, text: 'Crack the vault: hold the lobby', radius: 9 },
      { type: 'say', lines: [['rae', 'Bags are full. Moving!'], ['tide', 'Every cop in Saltline is coming. Lose them!']] },
      { type: 'wanted', level: 4 },
      { type: 'loseWanted', text: 'Escape with the money: lose the heat' },
      { type: 'goto', to: 'safehouse', text: 'Lie low at Pelican Suites', radius: 6 },
    ],
    outro: [
      ['news', 'Breaking: Councilman Harlan Voss arrested after a leaked ledger tied him to the Halcyon Trust robbery.'],
      ['nadia', 'Voss is finished, and Saltline Bay has a new pair of queens.'],
    ],
  },
];

export const RADIO_STATIONS = ['Wave 104.2 Saltwater FM', 'KORL 88.1 Coral Heat', 'Low Tide Lounge 97.5', 'Radio Off'];

// Fictional tracks each station rotates through.
export const RADIO_SONGS = [
  ['The Low Reefs – Glass Harbor', 'Mira Vance – Neon Undertow', 'Saltwater Saints – Ferry at Dusk', 'Pelican Static – Heatwave Hotel'],
  ['DJ Coralline – Bassline Tide', 'Kid Marrow – Six Lanes', 'Brineboys – Palm Row Anthem'],
  ['June Ashby – Slow Swell', 'The Quiet Keys – Lantern Light', 'Oro Bay Trio – 2 A.M. Boardwalk'],
  [],
];
