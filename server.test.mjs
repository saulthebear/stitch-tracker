import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './server.mjs';

test('shared actions preserve concurrent stitches, bounds, and saved progress across restarts', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'stitch-tracker-test-'));
  const dataFile = join(folder, 'pattern.json');
  let server;
  let base;
  async function start() {
    server = createApp(dataFile).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { await new Promise(resolve => server.close(resolve)); }
  async function action(body, expectedStatus = 200, headers = {}) {
    const response = await fetch(`${base}/api/actions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
    });
    assert.equal(response.status, expectedStatus);
    return response.json();
  }
  try {
    await start();
    let state = await action({ type: 'add', label: 'Rnd 1', note: '[sc, inc] x 8', totalStitches: 24 });
    const id = state.activeId;
    await Promise.all(Array.from({ length: 20 }, () => action({ type: 'increment', id })));
    state = await (await fetch(`${base}/api/state`)).json();
    assert.equal(state.rounds[0].currentStitch, 20);
    await action({ type: 'complete', id }, 400);
    await Promise.all(Array.from({ length: 8 }, () => action({ type: 'increment', id })));
    state = await action({ type: 'add', label: 'Rnd 2', note: '', totalStitches: 12 });
    const secondId = state.rounds[1].id;
    state = await action({ type: 'complete', id });
    assert.equal(state.activeId, secondId);
    assert.equal(state.rounds[0].currentStitch, 24);
    assert.equal(state.rounds[0].completed, true);
    assert.deepEqual(JSON.parse(readFileSync(dataFile, 'utf8')), state);
    await stop();
    await start();
    assert.deepEqual(await (await fetch(`${base}/api/state`)).json(), state);
    state = await action({ type: 'decrement', id: secondId });
    assert.equal(state.rounds[1].currentStitch, 0);
    state = await action({ type: 'delete', id: secondId });
    assert.equal(state.activeId, id);
    await action({ type: 'increment', id: secondId }, 404);
    await action({ type: 'add', label: '', note: '', totalStitches: -1 }, 400);
    await action({ type: 'add', label: '', note: '', totalStitches: 1.5 }, 400);
    await action({ type: 'increment', id }, 403, { Origin: 'https://unrelated.example' });
    state = await action({ type: 'delete', id });
    assert.deepEqual(state.rounds, []);
    assert.equal(state.activeId, null);
  } finally {
    if (server?.listening) await stop();
    rmSync(folder, { recursive: true, force: true });
  }
});

test('a damaged save is preserved instead of silently replaced', () => {
  const folder = mkdtempSync(join(tmpdir(), 'stitch-tracker-test-'));
  const dataFile = join(folder, 'pattern.json');
  try {
    writeFileSync(dataFile, '{broken');
    assert.throws(() => createApp(dataFile));
    assert.equal(readFileSync(dataFile, 'utf8'), '{broken');
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('numeric ordering and edits preserve live progress and reject stale edits', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'stitch-tracker-edit-test-'));
  const dataFile = join(folder, 'pattern.json');
  const server = createApp(dataFile).listen(0, '127.0.0.1');
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}`;
    async function action(body, status = 200) {
      const response = await fetch(`${base}/api/actions`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, status);
      return response.json();
    }
    let state;
    for (const label of ['Finishing', 'Rnd 10', 'Rnd 4', '4', 'Rnd 2', 'Assembly']) {
      state = await action({ type: 'add', label, note: '', totalStitches: 2 });
    }
    assert.deepEqual(state.rounds.map(r => r.label), ['Rnd 2', 'Rnd 4', '4', 'Rnd 10', 'Finishing', 'Assembly']);
    const original = state.rounds.find(r => r.label === 'Rnd 10');
    const edit = { type: 'edit', id: original.id, original, label: 'Rnd 3', note: 'Updated note', totalStitches: 3 };
    await action({ type: 'select', id: original.id });
    await action({ type: 'increment', id: original.id });
    state = await action(edit);
    assert.deepEqual(state.rounds.map(r => r.label), ['Rnd 2', 'Rnd 3', 'Rnd 4', '4', 'Finishing', 'Assembly']);
    assert.equal(state.activeId, original.id);
    let edited = state.rounds.find(r => r.id === original.id);
    assert.equal(edited.currentStitch, 1);
    assert.equal(edited.note, 'Updated note');
    await action({ ...edit, label: 'Old edit' }, 409);
    await action({ ...edit, original: edited, totalStitches: 0 }, 400);
    await action({ ...edit, original: edited, label: ' ' }, 400);
    await action({ type: 'increment', id: original.id });
    await action({ ...edit, original: edited, totalStitches: 1 }, 400);
    await action({ type: 'increment', id: original.id });
    state = await action({ type: 'complete', id: original.id });
    assert.equal(state.rounds.find(r => r.id === state.activeId).label, 'Rnd 4');
    edited = state.rounds.find(r => r.id === original.id);
    state = await action({ ...edit, original: edited, totalStitches: 4 });
    assert.equal(state.rounds.find(r => r.id === original.id).completed, false);
    assert.equal(state.rounds.find(r => r.id === original.id).currentStitch, 3);
    assert.deepEqual(JSON.parse(readFileSync(dataFile, 'utf8')), state);

    // Existing saves are sorted when loaded, with equivalent labels kept in order.
    const saved = { ...state, rounds: [...state.rounds].reverse() };
    writeFileSync(dataFile, JSON.stringify(saved));
    const restored = createApp(dataFile).listen(0, '127.0.0.1');
    try {
      await new Promise((resolve, reject) => { restored.once('listening', resolve); restored.once('error', reject); });
      const response = await fetch(`http://127.0.0.1:${restored.address().port}/api/state`);
      const loaded = await response.json();
      assert.deepEqual(loaded.rounds.map(r => r.label), ['Rnd 2', 'Rnd 3', '4', 'Rnd 4', 'Assembly', 'Finishing']);
      assert.equal(loaded.activeId, state.activeId);
    } finally { await new Promise(resolve => restored.close(resolve)); }
  } finally {
    await new Promise(resolve => server.close(resolve));
    rmSync(folder, { recursive: true, force: true });
  }
});
