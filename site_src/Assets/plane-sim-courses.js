// Stunt-mode ring courses: hand-plotted chains of [x, y, z, radius?] (radius
// defaults to the course `r`). Each was routed offline against the terrain /
// city so every ring clears the ground and no leg contains an unmakeable
// corner. Pure data — the ring meshes and scoring live in plane-sim.src.js.
export const STUNTS = {
  valley: {
    label: 'Valley Run',
    desc: 'Low through the central valley, under two bridges, home past the lakes.',
    map: 'coastal',
    r: 26,
    spawn: { x: 0, y: 55, z: 100, hdg: 0, speed: 100 },
    rings: [
      [0, 45, -700], [0, 39, -1100], [0, 33, -1500], [0, 49, -1900], [0, 46, -2300],
      [0, 33, -2650], [0, 4, -3000, 14], // under the north bridge
      [-600, 74, -3250], [-1200, 144, -3100], [-1800, 186, -2850], [-2300, 193, -2400],
      [-2450, 188, -1950], [-2600, 189, -1500], [-2575, 152, -1050], [-2550, 101, -600],
      [-2450, 63, -150], [-2350, 33, 300], [-2275, 33, 800],
      [-2200, 4, 1300, 14], // under the west bridge
      [-2050, 53, 1650], [-1900, 63, 2000], [-1500, 37, 2100], [-1100, 33, 2200],
      [-750, 33, 2050], [-400, 33, 1900], [-100, 33, 1600], [200, 44, 1300],
      [250, 44, 900], [300, 45, 500], [250, 45, 150], [200, 45, -200],
    ],
  },
  canyon: {
    label: 'The Canyon',
    desc: 'Tight below the rim: weave the gorge switchbacks slow and nimble, sprint the straight, then pull hard over the exit ridge.',
    map: 'canyon',
    r: 24,
    spawn: {
      x: 0, y: 470, z: 4400, hdg: 0, speed: 120,
    },
    rings: [
      // Rings follow CANYON.PATH; tight r-20 hoops mark the sharp 60-90° corners.
      [0, 18, 3400], [0, 18, 2950], [0, 18, 2500],
      [-400, 18, 2050, 20], [150, 16, 1750, 20], [-150, 16, 1550], [-450, 16, 1350, 20],
      [-175, 18, 1175], [100, 17, 1000, 20],
      [-350, 16, 600], [-750, 17, 150],
      [-1150, 17, -200, 20], [-650, 17, -600, 20], [-1050, 16, -1000, 20],
      [-750, 17, -1150], [-450, 17, -1300], [-50, 17, -1425],
      [350, 16, -1550], [750, 16, -1725], [1150, 15, -1900], [1450, 17, -2025], [1750, 17, -2150],
      [2200, 17, -2500, 20], [1900, 16, -2900, 20],
      [2350, 17, -3250], [2600, 17, -3575], [2850, 16, -3900],
      // Guide ring on the ~620 m exit wall, then pop over the crest — a zoom climb.
      [2900, 420, -4150, 30], [2950, 690, -4500, 30], [3080, 665, -4950],
    ],
  },
  wavetop: {
    label: 'Wavetop Circuit',
    desc: 'A slalom off the carrier’s bow, wave-high out to the enemy fleet and home.',
    map: 'ocean',
    r: 22,
    spawn: { x: 0, y: 45, z: 260, hdg: 0, speed: 100 },
    rings: [
      [60, 18, -300], [-60, 18, -700], [60, 18, -1100], [-60, 18, -1500], [0, 15, -1900],
      [300, 60, -2300], [600, 90, -2700], [800, 40, -3300], [900, 25, -3900], [950, 16, -4400],
      [950, 30, -5000], [600, 70, -5300], [200, 120, -4600], [0, 120, -3800], [0, 90, -3000],
      [0, 60, -2200], [0, 30, -1200], [0, 25, -500],
    ],
  },
  skyline: {
    label: 'Skyline Dash',
    desc: 'Thread the city itself — weave the streets and tower gaps below the rooftops, crossing Midtown twice.',
    map: 'city',
    // The 3.7 km chain was A*-routed against the real city building AABBs at
    // 125 m and verified against the game's collision test (1875 samples, 0
    // hits, worst gap 14 m, ~87 m mean clearance). Do NOT hand-edit a ring
    // without re-running the routing/validation (see the obstacles() dev
    // handle) — moving one can steer a straight leg into a facade.
    r: 10,
    spawn: { x: 1602, y: 125, z: -1073, hdg: -140, speed: 105 },
    rings: [
      [1500, 125, -950], [1400, 125, -830], [1280, 125, -710], [1200, 125, -560],
      [1320, 125, -440], [1370, 125, -420], [1520, 125, -340], [1550, 125, -340],
      [1640, 125, -430], [1690, 125, -420], [1840, 125, -340], [1980, 125, -340],
      [1990, 125, -300], [1990, 125, -240], [1990, 125, -70], [1990, 125, 100],
      [1990, 125, 270], [1990, 125, 380], [1960, 125, 390], [1890, 125, 480],
      [1720, 125, 480], [1560, 125, 490], [1490, 125, 640], [1450, 125, 660],
      [1580, 125, 760], [1700, 125, 880], [1690, 125, 1040], [1540, 125, 1110],
      [1500, 125, 1120],
    ],
  },
};
