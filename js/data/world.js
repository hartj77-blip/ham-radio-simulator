// Geography, callsign generation and operator names.
import { pick, randi, rand, chance, weighted } from '../util.js';

// abbr, name, lat, lon, call district, CQ zone
const ST = [
  ['AL', 'Alabama', 32.8, -86.8, 4, 4], ['AK', 'Alaska', 61.4, -150.0, 'KL7', 1], ['AZ', 'Arizona', 34.2, -111.7, 7, 3],
  ['AR', 'Arkansas', 34.9, -92.4, 5, 4], ['CA', 'California', 37.2, -119.5, 6, 3], ['CO', 'Colorado', 39.0, -105.5, 0, 4],
  ['CT', 'Connecticut', 41.6, -72.7, 1, 5], ['DE', 'Delaware', 39.0, -75.5, 3, 5], ['FL', 'Florida', 28.6, -82.4, 4, 5],
  ['GA', 'Georgia', 32.7, -83.4, 4, 5], ['HI', 'Hawaii', 20.8, -156.3, 'KH6', 31], ['ID', 'Idaho', 44.4, -114.6, 7, 3],
  ['IL', 'Illinois', 40.0, -89.2, 9, 4], ['IN', 'Indiana', 39.9, -86.3, 9, 4], ['IA', 'Iowa', 42.1, -93.5, 0, 4],
  ['KS', 'Kansas', 38.5, -98.4, 0, 4], ['KY', 'Kentucky', 37.5, -85.3, 4, 4], ['LA', 'Louisiana', 31.1, -92.0, 5, 4],
  ['ME', 'Maine', 45.4, -69.2, 1, 5], ['MD', 'Maryland', 39.0, -76.8, 3, 5], ['MA', 'Massachusetts', 42.3, -71.8, 1, 5],
  ['MI', 'Michigan', 44.3, -85.4, 8, 4], ['MN', 'Minnesota', 46.3, -94.3, 0, 4], ['MS', 'Mississippi', 32.7, -89.7, 5, 4],
  ['MO', 'Missouri', 38.4, -92.5, 0, 4], ['MT', 'Montana', 47.0, -109.6, 7, 4], ['NE', 'Nebraska', 41.5, -99.8, 0, 4],
  ['NV', 'Nevada', 39.3, -116.6, 7, 3], ['NH', 'New Hampshire', 43.7, -71.6, 1, 5], ['NJ', 'New Jersey', 40.2, -74.7, 2, 5],
  ['NM', 'New Mexico', 34.4, -106.1, 5, 4], ['NY', 'New York', 42.9, -75.5, 2, 5], ['NC', 'North Carolina', 35.6, -79.4, 4, 5],
  ['ND', 'North Dakota', 47.5, -100.5, 0, 4], ['OH', 'Ohio', 40.3, -82.8, 8, 4], ['OK', 'Oklahoma', 35.6, -97.5, 5, 4],
  ['OR', 'Oregon', 43.9, -120.6, 7, 3], ['PA', 'Pennsylvania', 40.9, -77.8, 3, 5], ['RI', 'Rhode Island', 41.7, -71.5, 1, 5],
  ['SC', 'South Carolina', 33.9, -80.9, 4, 5], ['SD', 'South Dakota', 44.4, -100.2, 0, 4], ['TN', 'Tennessee', 35.9, -86.4, 4, 4],
  ['TX', 'Texas', 31.5, -99.3, 5, 4], ['UT', 'Utah', 39.3, -111.7, 7, 3], ['VT', 'Vermont', 44.1, -72.7, 1, 5],
  ['VA', 'Virginia', 37.5, -78.8, 4, 5], ['WA', 'Washington', 47.4, -120.5, 7, 3], ['WV', 'West Virginia', 38.6, -80.6, 8, 5],
  ['WI', 'Wisconsin', 44.6, -89.9, 9, 4], ['WY', 'Wyoming', 43.0, -107.5, 7, 4],
];
export const STATES = ST.map(([abbr, name, lat, lon, dist, zone]) => ({ abbr, name, lat, lon, dist, zone }));
export const stateBy = (a) => STATES.find((s) => s.abbr === a);
export const STATE_NAME_TO_ABBR = Object.fromEntries(STATES.map((s) => [s.name.toUpperCase(), s.abbr]));

// pfx list, entity name, continent, CQ zone, lat, lon, name group, (speaks English with accent hint)
const DX = [
  [['VE3', 'VA3'], 'Canada', 'NA', 4, 44.0, -79.5, 'en', 'en-CA', 'Ontario'],
  [['VE2', 'VA2'], 'Canada', 'NA', 5, 46.8, -71.2, 'fr', 'fr-CA', 'Quebec'],
  [['VE7', 'VA7'], 'Canada', 'NA', 3, 49.3, -123.1, 'en', 'en-CA', 'British Columbia'],
  [['VE6'], 'Canada', 'NA', 4, 51.0, -114.1, 'en', 'en-CA', 'Alberta'],
  [['XE1', 'XE2'], 'Mexico', 'NA', 6, 19.4, -99.1, 'es', 'es-MX', 'Mexico City'],
  [['CO2', 'CM2'], 'Cuba', 'NA', 8, 23.1, -82.4, 'es', 'es-MX', 'Havana'],
  [['KP4', 'WP4', 'NP4'], 'Puerto Rico', 'NA', 8, 18.2, -66.5, 'es', 'en-US', 'San Juan'],
  [['PY2', 'PU2', 'PY1'], 'Brazil', 'SA', 11, -23.5, -46.6, 'pt', 'pt-BR', 'Sao Paulo'],
  [['LU1', 'LU4', 'LW2'], 'Argentina', 'SA', 13, -34.6, -58.4, 'es', 'es-AR', 'Buenos Aires'],
  [['CE3', 'CA3'], 'Chile', 'SA', 12, -33.4, -70.6, 'es', 'es-ES', 'Santiago'],
  [['HK3', 'HJ3'], 'Colombia', 'SA', 9, 4.7, -74.1, 'es', 'es-ES', 'Bogota'],
  [['G3', 'G4', 'M0', '2E0'], 'England', 'EU', 14, 52.0, -1.2, 'en', 'en-GB', 'England'],
  [['GM3', 'GM4', 'MM0'], 'Scotland', 'EU', 14, 56.5, -4.0, 'en', 'en-GB', 'Scotland'],
  [['EI4', 'EI7'], 'Ireland', 'EU', 14, 53.3, -6.3, 'en', 'en-IE', 'Dublin'],
  [['F4', 'F5', 'F6'], 'France', 'EU', 14, 47.0, 2.0, 'fr', 'fr-FR', 'France'],
  [['DL1', 'DK2', 'DJ5', 'DF3'], 'Germany', 'EU', 14, 51.0, 10.0, 'de', 'de-DE', 'Germany'],
  [['PA3', 'PA0', 'PD1'], 'Netherlands', 'EU', 14, 52.2, 5.3, 'nl', 'nl-NL', 'Netherlands'],
  [['ON4', 'ON7'], 'Belgium', 'EU', 14, 50.8, 4.4, 'nl', 'nl-BE', 'Belgium'],
  [['EA1', 'EA4', 'EA5'], 'Spain', 'EU', 14, 40.4, -3.7, 'es', 'es-ES', 'Spain'],
  [['CT1', 'CS7'], 'Portugal', 'EU', 14, 38.7, -9.1, 'pt', 'pt-PT', 'Lisbon'],
  [['I2', 'IK2', 'IZ1', 'I0'], 'Italy', 'EU', 15, 42.0, 12.5, 'it', 'it-IT', 'Italy'],
  [['HB9'], 'Switzerland', 'EU', 14, 46.9, 8.0, 'de', 'de-CH', 'Switzerland'],
  [['OE1', 'OE5'], 'Austria', 'EU', 15, 47.5, 14.5, 'de', 'de-AT', 'Austria'],
  [['SP2', 'SP5', 'SQ9'], 'Poland', 'EU', 15, 52.0, 19.0, 'pl', 'pl-PL', 'Poland'],
  [['OK1', 'OK2'], 'Czech Republic', 'EU', 15, 49.8, 15.5, 'pl', 'cs-CZ', 'Czech Republic'],
  [['SM5', 'SM0', 'SA3'], 'Sweden', 'EU', 14, 59.3, 18.0, 'nordic', 'sv-SE', 'Sweden'],
  [['LA1', 'LA9'], 'Norway', 'EU', 14, 60.0, 10.0, 'nordic', 'nb-NO', 'Norway'],
  [['OH2', 'OH6'], 'Finland', 'EU', 15, 61.0, 25.0, 'nordic', 'fi-FI', 'Finland'],
  [['OZ1', 'OZ7'], 'Denmark', 'EU', 14, 56.0, 10.0, 'nordic', 'da-DK', 'Denmark'],
  [['UA3', 'RA3', 'RV3'], 'European Russia', 'EU', 16, 55.7, 37.6, 'ru', 'ru-RU', 'Moscow'],
  [['UR5', 'UT1'], 'Ukraine', 'EU', 16, 50.4, 30.5, 'ru', 'uk-UA', 'Kyiv'],
  [['SV1'], 'Greece', 'EU', 20, 38.0, 23.7, 'other', 'el-GR', 'Athens'],
  [['9A2', '9A5'], 'Croatia', 'EU', 15, 45.8, 16.0, 'pl', 'hr-HR', 'Zagreb'],
  [['S51', 'S57'], 'Slovenia', 'EU', 15, 46.0, 14.5, 'pl', 'sl-SI', 'Slovenia'],
  [['HA5', 'HA8'], 'Hungary', 'EU', 15, 47.5, 19.0, 'pl', 'hu-HU', 'Budapest'],
  [['EA8'], 'Canary Islands', 'AF', 33, 28.1, -15.4, 'es', 'es-ES', 'Canary Islands'],
  [['CN8'], 'Morocco', 'AF', 33, 33.6, -7.6, 'other', 'fr-FR', 'Casablanca'],
  [['ZS1', 'ZS6'], 'South Africa', 'AF', 38, -26.2, 28.0, 'en', 'en-ZA', 'Johannesburg'],
  [['5Z4'], 'Kenya', 'AF', 37, -1.3, 36.8, 'en', 'en-KE', 'Nairobi'],
  [['4X1', '4Z5'], 'Israel', 'AS', 20, 32.0, 34.8, 'other', 'he-IL', 'Tel Aviv'],
  [['JA1', 'JH1', 'JR1', 'JA3', '7K1'], 'Japan', 'AS', 25, 35.7, 139.7, 'ja', 'ja-JP', 'Tokyo'],
  [['HL1', 'DS1'], 'South Korea', 'AS', 25, 37.5, 127.0, 'other', 'ko-KR', 'Seoul'],
  [['BY1', 'BD4'], 'China', 'AS', 24, 39.9, 116.4, 'other', 'zh-CN', 'Beijing'],
  [['DU1', 'DV1'], 'Philippines', 'OC', 27, 14.6, 121.0, 'en', 'en-PH', 'Manila'],
  [['YB0', 'YC1'], 'Indonesia', 'OC', 28, -6.2, 106.8, 'other', 'id-ID', 'Jakarta'],
  [['VU2'], 'India', 'AS', 22, 28.6, 77.2, 'en', 'en-IN', 'New Delhi'],
  [['HS0', 'E21'], 'Thailand', 'AS', 26, 13.7, 100.5, 'other', 'th-TH', 'Bangkok'],
  [['UA0', 'RA0'], 'Asiatic Russia', 'AS', 18, 55.0, 83.0, 'ru', 'ru-RU', 'Novosibirsk'],
  [['UN7'], 'Kazakhstan', 'AS', 17, 51.2, 71.4, 'ru', 'ru-RU', 'Astana'],
  [['VK2', 'VK3', 'VK4'], 'Australia', 'OC', 30, -33.9, 151.2, 'en', 'en-AU', 'Sydney'],
  [['VK6'], 'Australia', 'OC', 29, -31.9, 115.9, 'en', 'en-AU', 'Perth'],
  [['ZL1', 'ZL2'], 'New Zealand', 'OC', 32, -41.3, 174.8, 'en', 'en-NZ', 'Wellington'],
];
export const DX_ENTITIES = DX.map(([pfx, name, cont, zone, lat, lon, names, lang, qth]) => ({ pfx, name, cont, zone, lat, lon, names, lang, qth }));

const NAMES = {
  en: ['Bob', 'Jim', 'Tom', 'Bill', 'Dave', 'Mike', 'John', 'Steve', 'Gary', 'Ron', 'Joe', 'Mark', 'Dan', 'Ed', 'Ken', 'Rick',
    'Paul', 'Chuck', 'Larry', 'Jeff', 'Sue', 'Mary', 'Pat', 'Linda', 'Karen', 'Amy', 'Beth', 'Jan', 'Kim', 'Lynn', 'Hal', 'Walt',
    'Stan', 'Art', 'Al', 'Ray', 'Ted', 'Don', 'Fred', 'Rich', 'Doug', 'Carl', 'Phil', 'Ann', 'Deb', 'Nancy', 'Rob', 'Tim', 'Chris', 'Matt'],
  de: ['Hans', 'Klaus', 'Jurgen', 'Peter', 'Uwe', 'Dieter', 'Wolf', 'Frank', 'Andi', 'Heike'],
  fr: ['Pierre', 'Jean', 'Michel', 'Alain', 'Luc', 'Marc', 'Yves', 'Claire'],
  es: ['Jose', 'Juan', 'Carlos', 'Pedro', 'Luis', 'Pepe', 'Miguel', 'Ana', 'Rafa'],
  pt: ['Joao', 'Paulo', 'Rui', 'Marcos', 'Tiago', 'Rita'],
  it: ['Marco', 'Luigi', 'Gianni', 'Franco', 'Paolo', 'Max', 'Sara'],
  nl: ['Piet', 'Jan', 'Kees', 'Wim', 'Bart', 'Joost'],
  pl: ['Jan', 'Marek', 'Tomas', 'Pavel', 'Zoltan', 'Ivo', 'Janez'],
  nordic: ['Lars', 'Olaf', 'Pekka', 'Jens', 'Bjorn', 'Sven', 'Kari', 'Ari'],
  ru: ['Ivan', 'Sergey', 'Alex', 'Dima', 'Vlad', 'Olga', 'Yuri', 'Igor'],
  ja: ['Taro', 'Hiro', 'Ken', 'Masa', 'Toshi', 'Yuki', 'Kazu'],
  other: ['Ali', 'Raj', 'Wei', 'Kim', 'Nikos', 'Dov', 'Somchai', 'Budi', 'Omar'],
};
export const nameFor = (group) => pick(NAMES[group] || NAMES.en);

const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letters = (n) => Array.from({ length: n }, () => L[randi(0, 25)]).join('');

export function usCall(state) {
  const st = typeof state === 'string' ? stateBy(state) : state;
  if (st.dist === 'KL7') return pick(['KL7', 'AL7', 'NL7', 'WL7']) + letters(randi(2, 3));
  if (st.dist === 'KH6') return pick(['KH6', 'AH6', 'NH6', 'WH6']) + letters(randi(2, 3));
  const d = st.dist;
  const fmt = weighted([['1x3', 30], ['2x3', 35], ['1x2', 8], ['2x1', 4], ['2x2', 15], ['1x1', 0]]);
  switch (fmt) {
    case '1x3': return pick('KNW') + d + letters(3);
    case '2x3': return pick('KNW') + L[randi(0, 25)] + d + letters(3);
    case '1x2': return pick('KNW') + d + letters(2);
    case '2x1': return pick('KNW') + L[randi(0, 25)] + d + letters(1);
    default: return 'A' + L[randi(0, 11)] + d + letters(2);
  }
}

export function dxCall(ent) {
  const p = pick(ent.pfx);
  return p + letters(chance(0.6) ? 3 : 2);
}

// Sequential-style call for a new licensee: 2x3 "Group D" like KD9ABC.
export function newLicenseeCall(stateAbbr, cls) {
  const st = stateBy(stateAbbr);
  const d = typeof st.dist === 'number' ? st.dist : st.dist === 'KL7' ? 7 : 6;
  if (cls === 'E') {
    // Group A: 1x2 / 2x1 / 2x2 starting with A
    return pick([() => pick('KNW') + d + letters(2), () => 'A' + L[randi(0, 11)] + d + letters(2), () => pick('KNW') + L[randi(0, 25)] + d + letters(1)])();
  }
  if (cls === 'G') return pick('KNW') + L[randi(0, 25)] + d + letters(3);
  return 'K' + pick('CDEFIJ') + d + letters(3);
}

export const isCallsign = (t) => /^([A-Z]{1,2}|[0-9][A-Z]|[A-Z][0-9])[0-9][A-Z]{1,4}(\/[A-Z0-9]{1,4})?$/.test(t) && !/^[1-5][0-9N][0-9N]$/.test(t);

// A random operator anywhere (weighting by region).
export function randomOp({ usWeight = 0.6, onlyUS = false, onlyDX = false } = {}) {
  if (!onlyDX && (onlyUS || chance(usWeight))) {
    const st = pick(STATES);
    return {
      call: usCall(st), country: 'United States', cont: st.abbr === 'HI' ? 'OC' : 'NA', zone: st.zone, state: st.abbr,
      qth: st.name, lat: st.lat + rand(-1.5, 1.5), lon: st.lon + rand(-2, 2), name: nameFor('en'), lang: 'en-US',
      dxcc: st.abbr === 'HI' ? 'Hawaii' : st.abbr === 'AK' ? 'Alaska' : 'United States',
    };
  }
  const e = pick(DX_ENTITIES);
  return {
    call: dxCall(e), country: e.name, cont: e.cont, zone: e.zone, state: null, qth: e.qth,
    lat: e.lat + rand(-1, 1), lon: e.lon + rand(-1.5, 1.5), name: nameFor(e.names), lang: e.lang, dxcc: e.name,
    prov: e.name === 'Canada' ? { Ontario: 'ON', Quebec: 'QC', 'British Columbia': 'BC', Alberta: 'AB' }[e.qth] : null,
  };
}

export const PHONETIC = {
  A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet',
  K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
  U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
  0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', '/': 'stroke',
};
export const phonetic = (s) => [...String(s).toUpperCase()].map((c) => PHONETIC[c] || c).join(' ');
const DIG = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
export const digitsSpoken = (s) => [...String(s)].map((c) => (/\d/.test(c) ? DIG[+c] : PHONETIC[c] || c)).join(' ');
