import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialGameState,
  damagePlayer,
  emptyInput,
  getHudSnapshot,
  renderSimulationToBuffer,
  startNewSortie,
  stepGameState,
} from './simulation';
import { AsciiBuffer } from '../engine/asciiRenderer';

test('simulation survives first 5 seconds with zero player input', () => {
  const state = createInitialGameState();
  startNewSortie(state);
  const input = emptyInput();

  for (let i = 0; i < 300; i++) {
    stepGameState(state, input, 1 / 60);
  }

  assert.equal(state.phase, 'playing');
  assert.ok(state.player.hp > 0, 'player must survive initial seconds without input');
  assert.ok(state.enemies.length >= 3, 'wave 1 enemies should be active');
});

test('wave 2 spawns all three distinct enemy archetypes including ace', () => {
  const state = createInitialGameState();
  startNewSortie(state);
  state.enemies = [];
  state.waveSpawnDelay = 0.05;

  // Step through wave clear delay to trigger wave 2
  const input = emptyInput();
  for (let i = 0; i < 10; i++) {
    stepGameState(state, input, 0.02);
  }

  assert.equal(state.wave, 2);
  const kinds = new Set(state.enemies.map((e) => e.kind));
  assert.ok(kinds.has('scout'));
  assert.ok(kinds.has('heavy'));
  assert.ok(kinds.has('ace'));
});

test('player autocannon fire spawns projectiles, hits enemy, and awards score on KO', () => {
  const state = createInitialGameState();
  startNewSortie(state);
  // Place one low-HP enemy directly in front of player nose
  state.enemies = [
    {
      ...state.enemies[0],
      pos: { x: state.player.pos.x, y: state.player.pos.y, z: state.player.pos.z - 25 },
      hp: 10,
      maxHp: 40,
      points: 100,
    },
  ];

  const input = { ...emptyInput(), fireGun: true };
  // Step enough frames for projectile to travel 25m and KO timer (0.36s) to explode
  for (let i = 0; i < 45; i++) {
    stepGameState(state, input, 1 / 60);
  }

  assert.ok(state.shotsFired >= 2);
  assert.ok(state.shotsHit >= 1);
  assert.equal(state.kills, 1);
  assert.equal(state.score, 100);
});

test('damagePlayer transitions phase to gameover when HP reaches 0', () => {
  const state = createInitialGameState();
  startNewSortie(state);
  state.score = 450;
  damagePlayer(state, 150);

  assert.equal(state.player.hp, 0);
  assert.equal(state.phase, 'gameover');
  assert.equal(state.bestScore, 450);
});

test('renderSimulationToBuffer produces valid ASCII frame in both title and playing phases', () => {
  const state = createInitialGameState();
  const buf = new AsciiBuffer(90, 32);

  renderSimulationToBuffer(state, buf);
  assert.ok(buf.toPlainText().trim().length > 30);

  startNewSortie(state);
  stepGameState(state, emptyInput(), 0.016);
  renderSimulationToBuffer(state, buf);
  const hud = getHudSnapshot(state);
  assert.equal(hud.phase, 'playing');
  assert.ok(buf.toPlainText().includes('+'));
});
