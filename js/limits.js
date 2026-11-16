// Station limits: what the chosen equipment and FCC rules allow. There is no shop or
// ownership — every radio, antenna and accessory is available in every mode.
import { S } from './state.js';
import { rig, gearOf, gear, psuLimitW } from './rigs.js';

export const owns = () => true;
export const ownsGear = () => true;
export const feedOwned = () => true;
export const antOwned = () => true;

// Highest support available: trees in Training; masts and towers in Simulation & Free play.
export const maxHeight = () => (S.mode === 'training' ? 50 : 100);

// Why the station can't make full power (shown in the rig builder and radio).
export function powerChain() {
  const r = rig(), amp = gearOf('amp'), tuner = gearOf('tuner');
  const out = { rigW: Math.min(r.maxW, psuLimitW(r)), limits: [] };
  if (psuLimitW(r) < r.maxW) out.limits.push(`power supply (${gearOf('psu').amps} A) limits the radio to ${psuLimitW(r)} W`);
  let w = out.rigW;
  if (amp.out) {
    if (amp.mains === 240 && !gear().mains240) out.limits.push(`${amp.name} needs a 240 V circuit — running barefoot`);
    else if (out.rigW < amp.drive * 0.8) out.limits.push(`${amp.name} needs ~${amp.drive} W of drive; your radio gives ${out.rigW} W`);
    else w = amp.out;
  }
  if (tuner.maxW < w) { out.limits.push(`${tuner.name} is rated ${tuner.maxW} W`); w = tuner.maxW; }
  out.maxW = w;
  return out;
}
export const maxPower = () => powerChain().maxW;

// FCC power limits (simplified): Technicians 200 W PEP on HF; 30 m 200 W for everyone; else 1500 W.
export function powerLimit(lic, hz) {
  if (hz >= 10.1e6 && hz <= 10.15e6) return 200;
  if (lic === 'T' && hz < 30e6) return 200;
  return 1500;
}
