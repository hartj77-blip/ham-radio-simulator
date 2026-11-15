// Runs MoM jobs in a module Web Worker (falls back to the main thread if workers are unavailable).
let worker = null, seq = 0;
const pending = new Map();

function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      if (e.data.progress != null) { p.onProgress && p.onProgress(e.data.progress); return; }
      pending.delete(e.data.id);
      e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data);
    };
    worker.onerror = (e) => { for (const p of pending.values()) p.reject(new Error(e.message || 'worker error')); pending.clear(); worker = false; };
  } catch (e) { worker = false; }
  return worker;
}

export async function runSolver(job, onProgress) {
  const w = getWorker();
  if (w) {
    const id = ++seq;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject, onProgress }); w.postMessage({ id, ...job }); });
  }
  // fallback
  const { mesh, solve } = await import('./mom.js');
  const { postZ } = await import('./models.js');
  const m = mesh(job.model, job.fMesh || Math.max(...job.freqs));
  return { sweep: job.freqs.map((f) => { const s = solve(m, f); return { f, Zraw: s.Z, Z: postZ(job.model, s.Z) }; }) };
}
