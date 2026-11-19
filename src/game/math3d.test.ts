import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Camera3D,
  defaultBasis,
  dot,
  length,
  projectWorldPoint,
  rotateBasisLocal,
  rotateBasisWorldYaw,
  terrainHeightAt,
} from './math3d';

test('defaultBasis is orthonormal and forward faces -Z', () => {
  const b = defaultBasis();
  assert.deepEqual(b.forward, { x: 0, y: 0, z: -1 });
  assert.deepEqual(b.up, { x: 0, y: 1, z: 0 });
  assert.deepEqual(b.right, { x: 1, y: 0, z: 0 });
  assert.ok(Math.abs(dot(b.forward, b.up)) < 1e-6);
  assert.ok(Math.abs(dot(b.forward, b.right)) < 1e-6);
});

test('rotateBasisLocal preserves unit vector lengths after multiple rotations', () => {
  let b = defaultBasis();
  for (let i = 0; i < 40; i++) {
    b = rotateBasisLocal(b, 0.13, -0.09, 0.21);
  }
  assert.ok(Math.abs(length(b.forward) - 1) < 1e-5);
  assert.ok(Math.abs(length(b.up) - 1) < 1e-5);
  assert.ok(Math.abs(length(b.right) - 1) < 1e-5);
  assert.ok(Math.abs(dot(b.forward, b.up)) < 1e-5);
});

test('rotateBasisWorldYaw turns forward vector around world Y', () => {
  const b = rotateBasisWorldYaw(defaultBasis(), Math.PI / 2);
  assert.ok(Math.abs(b.forward.x + 1) < 1e-5);
  assert.ok(Math.abs(b.forward.z) < 1e-5);
});

test('projectWorldPoint projects center target to grid center and rejects behind-camera points', () => {
  const cam: Camera3D = {
    pos: { x: 0, y: 0, z: 0 },
    basis: defaultBasis(),
    fovScale: 1.0,
    charAspect: 0.5,
  };
  const front = projectWorldPoint({ x: 0, y: 0, z: -20 }, cam, 100, 40);
  assert.equal(front.visible, true);
  assert.ok(Math.abs(front.x - 50) < 0.01);
  assert.ok(Math.abs(front.y - 20) < 0.01);

  const behind = projectWorldPoint({ x: 0, y: 0, z: 10 }, cam, 100, 40);
  assert.equal(behind.visible, false);
});

test('terrainHeightAt keeps spawn corridor safely below starting flight altitude', () => {
  const h = terrainHeightAt(0, 0);
  assert.ok(h < 20, `expected valley near origin to be < 20, got ${h}`);
});
