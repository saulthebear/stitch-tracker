import express from 'express';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { randomUUID } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));

function rowNumber(label) {
  const match = label.trim().match(/^(?:(?:rnd|round|row)\s*\.?\s*)?(\d+)\b/i);
  return match ? Number(match[1]) : Infinity;
}

function sortRounds(rounds) {
  // Equal numbers and unnumbered rows keep their existing relative order.
  rounds.sort((a, b) => {
    const left = rowNumber(a.label);
    const right = rowNumber(b.label);
    return left === right ? 0 : left - right;
  });
}

function validDetails(action) {
  return Number.isSafeInteger(action.totalStitches) && action.totalStitches >= 1 && action.totalStitches <= 100000 &&
    typeof action.label === 'string' && action.label.length <= 100 &&
    typeof action.note === 'string' && action.note.length <= 2000;
}

function validRound(r) {
  return r && typeof r.id === 'string' && typeof r.label === 'string' &&
    typeof r.note === 'string' && Number.isSafeInteger(r.totalStitches) && r.totalStitches > 0 &&
    Number.isSafeInteger(r.currentStitch) && r.currentStitch >= 0 &&
    r.currentStitch <= r.totalStitches && typeof r.completed === 'boolean';
}

export function createApp(dataFile = resolve(root, 'data/pattern.json')) {
  let state = { revision: 0, rounds: [], activeId: null };
  if (existsSync(dataFile)) {
    state = JSON.parse(readFileSync(dataFile, 'utf8'));
    if (!Number.isSafeInteger(state.revision) || !Array.isArray(state.rounds) ||
        !state.rounds.every(validRound) ||
        (state.activeId !== null && !state.rounds.some(r => r.id === state.activeId))) {
      throw new Error(`Invalid saved pattern in ${dataFile}. Restore a backup before restarting.`);
    }
  }
  sortRounds(state.rounds);
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (req.get('sec-fetch-site') === 'cross-site' ||
        (origin && origin !== `${req.protocol}://${req.get('host')}`)) {
      return res.status(403).json({ error: 'Open the tracker directly to make changes.' });
    }
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/state', (_req, res) => res.json(state));
  app.post('/api/actions', (req, res, next) => {
    const action = req.body;
    if (!action || typeof action.type !== 'string') return res.status(400).json({ error: 'Invalid action.' });
    const updated = structuredClone(state);
    const round = updated.rounds.find(r => r.id === action.id);
    if (action.type === 'add') {
      if (!validDetails(action)) {
        return res.status(400).json({ error: 'Enter a whole stitch count between 1 and 100,000.' });
      }
      const added = { id: randomUUID(), label: action.label.trim() || `Rnd ${updated.rounds.length + 1}`,
        note: action.note, totalStitches: action.totalStitches, currentStitch: 0, completed: false };
      updated.rounds.push(added);
      updated.activeId ??= added.id;
    } else {
      if (!round) return res.status(404).json({ error: 'That row no longer exists. The pattern will refresh.' });
      switch (action.type) {
        case 'edit': {
          if (!validDetails(action) || !action.label.trim()) {
            return res.status(400).json({ error: 'Enter a row label and a whole stitch count between 1 and 100,000.' });
          }
          if (!action.original || ['label', 'note', 'totalStitches'].some(key => action.original[key] !== round[key])) {
            return res.status(409).json({ error: 'This row was edited on another device. Cancel and reopen it to edit the latest version.' });
          }
          if (action.totalStitches < round.currentStitch) {
            return res.status(400).json({ error: `This row already has ${round.currentStitch} stitches. Use Frog to reduce the count before lowering its target.` });
          }
          if (action.totalStitches > round.totalStitches) round.completed = false;
          round.label = action.label.trim();
          round.note = action.note;
          round.totalStitches = action.totalStitches;
          break;
        }
        case 'select': updated.activeId = round.id; break;
        case 'increment': round.currentStitch = Math.min(round.totalStitches, round.currentStitch + 1); break;
        case 'decrement': round.currentStitch = Math.max(0, round.currentStitch - 1); round.completed = false; break;
        case 'toggle': round.completed = !round.completed; break;
        case 'delete':
          updated.rounds = updated.rounds.filter(r => r.id !== round.id);
          if (updated.activeId === round.id) updated.activeId = updated.rounds.find(r => !r.completed)?.id ?? updated.rounds[0]?.id ?? null;
          break;
        case 'complete': {
          if (round.currentStitch !== round.totalStitches) return res.status(400).json({ error: 'Finish the stitches first.' });
          round.completed = true;
          const index = updated.rounds.indexOf(round);
          updated.activeId = [...updated.rounds.slice(index + 1), ...updated.rounds.slice(0, index)]
            .find(r => !r.completed)?.id ?? round.id;
          break;
        }
        default: return res.status(400).json({ error: 'Unknown action.' });
      }
    }
    sortRounds(updated.rounds);
    updated.revision++;
    try {
      // Commit each action before replying; concurrent phones never overwrite a stale snapshot.
      mkdirSync(dirname(dataFile), { recursive: true });
      writeFileSync(`${dataFile}.tmp`, JSON.stringify(updated, null, 2) + '\n', { mode: 0o600 });
      renameSync(`${dataFile}.tmp`, dataFile);
      state = updated;
      res.json(state);
    } catch (error) { next(error); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint.' }));
  app.use(express.static(resolve(root, 'dist')));
  app.use((error, _req, res, _next) => {
    console.error(error.message);
    res.status(error.status ?? 500).json({ error: error.status === 400 ? 'Invalid request.' : 'Could not save the change. Check the computer and try again.' });
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3210);
  const host = process.env.HOST || '0.0.0.0';
  if (!existsSync(resolve(root, 'dist/index.html'))) {
    console.error('Build the app first with npm run build, or use npm start.');
    process.exit(1);
  }
  const server = createApp(process.env.DATA_FILE ? resolve(process.env.DATA_FILE) : undefined).listen(port, host, () => {
    console.log(`\nStitch Tracker is running.\n\nComputer: http://localhost:${port}`);
    if (host === '0.0.0.0') {
      for (const addresses of Object.values(networkInterfaces())) {
        for (const address of addresses ?? []) {
          if (address.family === 'IPv4' && !address.internal) console.log(`Phone:    http://${address.address}:${port}`);
        }
      }
    }
    console.log('\nKeep this window open and your computer awake. Press Ctrl+C to stop.\n');
  });
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the existing tracker or set PORT to another number.` : error.message);
    process.exit(1);
  });
}
