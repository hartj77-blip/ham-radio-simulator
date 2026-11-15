// Contest definitions (simplified versions of real events).
export const CONTESTS = {
  fd: {
    id: 'fd', name: 'Field Day', short: 'FD',
    desc: 'The biggest on-air event in North America. Work as many US/Canadian stations as possible. Exchange: your class (transmitters + category, e.g. "1D" = 1 transmitter, home station) and ARRL section (here: your state). CW contacts = 2 points, phone = 1. Running ≤100 W doubles your score.',
    fields: [{ k: 'cls', label: 'Class', ph: '3A', w: 4 }, { k: 'sec', label: 'Sec', ph: 'OH', w: 4 }],
    cq: { cw: (m) => `CQ FD ${m} ${m}`, ph: (m) => `CQ Field Day, CQ Field Day, §${m}§, §${m}§, Field Day.` },
    tu: { cw: (m) => `TU ${m} FD`, ph: (m) => `{TU|Thanks}, §${m}§ {QRZ|Q R Z} Field Day.` },
  },
  dx: {
    id: 'dx', name: 'DX Contest (CQ WW style)', short: 'DX',
    desc: 'Work the world! Exchange: signal report (always 599 / "5NN") and your CQ zone. Points: other continents 3, same continent other country 1 (2 within North America), own country 0 — but every new zone and country is a multiplier.',
    fields: [{ k: 'rst', label: 'RST', ph: '599', w: 4, def: true }, { k: 'zone', label: 'Zone', ph: '14', w: 3 }],
    cq: { cw: (m) => `CQ TEST ${m} ${m}`, ph: (m) => `CQ contest, CQ contest, §${m}§, §${m}§, contest.` },
    tu: { cw: (m) => `TU ${m}`, ph: (m) => `{TU|Thanks}, §${m}§ contest.` },
  },
  qp: {
    id: 'qp', name: 'State QSO Party', short: 'QP',
    desc: 'Work as many US states (and Canadian provinces) as you can. Exchange: signal report + your state. CW = 2 points, phone = 1; each state/province is a multiplier. Great for Worked All States!',
    fields: [{ k: 'rst', label: 'RST', ph: '599', w: 4, def: true }, { k: 'st', label: 'State', ph: 'TX', w: 4 }],
    cq: { cw: (m) => `CQ QP ${m} ${m}`, ph: (m) => `CQ QSO party, §${m}§, §${m}§, QSO party.` },
    tu: { cw: (m) => `TU ${m}`, ph: (m) => `{TU|Thanks}, §${m}§ QSO party.` },
  },
};
