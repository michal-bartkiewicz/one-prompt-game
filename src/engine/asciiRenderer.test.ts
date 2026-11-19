import test from 'node:test';
import assert from 'node:assert/strict';
import { AsciiBuffer, AsciiColor, luminanceToAscii, renderMesh } from './asciiRenderer';
import { Camera3D, defaultBasis } from '../game/math3d';
import { PLAYER_JET_MESH } from '../game/meshes';

test('AsciiBuffer Z-buffer keeps closer fragment over farther fragment', () => {
  const buf = new AsciiBuffer(40, 20);
  buf.plot(10, 10, 50, '.', AsciiColor.Dim);
  buf.plot(10, 10, 12, '@', AsciiColor.Highlight);
  // Attempting to draw farther fragment afterwards must NOT overwrite closer one
  buf.plot(10, 10, 30, '#', AsciiColor.Mid);

  const idx = 10 * buf.cols + 10;
  assert.equal(String.fromCharCode(buf.chars[idx]), '@');
  assert.equal(buf.colors[idx], AsciiColor.Highlight);
});

test('luminanceToAscii maps low to sparse and high to dense characters', () => {
  const dark = luminanceToAscii(0.1);
  const bright = luminanceToAscii(1.0);
  assert.notEqual(dark, bright);
  assert.equal(bright, '@');
});

test('renderMesh rasterizes player jet cleanly into AsciiBuffer without out-of-bounds errors', () => {
  const buf = new AsciiBuffer(80, 30);
  const cam: Camera3D = {
    pos: { x: 0, y: 3, z: 12 },
    basis: defaultBasis(),
    fovScale: 1.2,
    charAspect: 0.56,
  };
  renderMesh(buf, PLAYER_JET_MESH, { x: 0, y: 0, z: 0 }, defaultBasis(), cam);
  const text = buf.toPlainText();
  assert.ok(text.trim().length > 20, 'expected non-empty ASCII mesh render');
  const html = buf.toTerminalHtml();
  assert.ok(html.includes('<span class="c-'), 'expected colored span output');
});
