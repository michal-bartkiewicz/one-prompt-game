import {
  Basis3,
  Camera3D,
  Vec3,
  clamp,
  dot,
  meshToWorld,
  projectCameraPoint,
  projectWorldPoint,
  terrainHeightAt,
  worldToCamera,
} from '../game/math3d';
import { FaceRole, Mesh3D } from '../game/meshes';

/**
 * Semantic terminal color palette indices mapped to CSS `.c-N` classes.
 */
export const enum AsciiColor {
  Empty = 0,
  Dim = 1,
  Mid = 2,
  Bright = 3,
  Highlight = 4,
  Amber = 5,
  Alert = 6,
}

const SHADE_RAMP = ' .:-=+*#%@';

export class AsciiBuffer {
  readonly cols: number;
  readonly rows: number;
  readonly chars: Uint16Array;
  readonly colors: Uint8Array;
  readonly depth: Float32Array;

  constructor(cols: number, rows: number) {
    this.cols = Math.max(20, Math.floor(cols));
    this.rows = Math.max(12, Math.floor(rows));
    const size = this.cols * this.rows;
    this.chars = new Uint16Array(size);
    this.colors = new Uint8Array(size);
    this.depth = new Float32Array(size);
    this.clear();
  }

  clear(): void {
    this.chars.fill(32); // space
    this.colors.fill(AsciiColor.Empty);
    this.depth.fill(1e9);
  }

  plot(x: number, y: number, z: number, ch: string, color: AsciiColor): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.cols || iy < 0 || iy >= this.rows) return;
    if (z <= 0) return;
    const idx = iy * this.cols + ix;
    if (z <= this.depth[idx]) {
      this.depth[idx] = z;
      this.chars[idx] = ch.charCodeAt(0);
      this.colors[idx] = color;
    }
  }

  plotHud(x: number, y: number, ch: string, color: AsciiColor): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.cols || iy < 0 || iy >= this.rows) return;
    const idx = iy * this.cols + ix;
    this.depth[idx] = 0.01;
    this.chars[idx] = ch.charCodeAt(0);
    this.colors[idx] = color;
  }

  drawText(x: number, y: number, text: string, color: AsciiColor): void {
    const iy = Math.round(y);
    if (iy < 0 || iy >= this.rows) return;
    const startX = Math.round(x);
    for (let i = 0; i < text.length; i++) {
      const ix = startX + i;
      if (ix < 0 || ix >= this.cols) continue;
      const code = text.charCodeAt(i);
      if (code === 32) continue;
      const idx = iy * this.cols + ix;
      this.depth[idx] = 0.01;
      this.chars[idx] = code;
      this.colors[idx] = color;
    }
  }

  drawLine(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    color: AsciiColor,
    chOverride?: string,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    if (steps <= 0 || steps > 400) {
      this.plot(x0, y0, z0, chOverride ?? '*', color);
      return;
    }
    const ch = chOverride ?? pickLineChar(dx, dy);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      const pz = z0 + (z1 - z0) * t;
      this.plot(px, py, pz, ch, color);
    }
  }

  fillTriangle(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    ch: string,
    color: AsciiColor,
  ): void {
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(this.cols - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(this.rows - 1, Math.ceil(Math.max(ay, by, cy)));

    if (minX > maxX || minY > maxY) return;

    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-3) return;
    const invArea = 1 / area;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * invArea;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * invArea;
        const w2 = 1 - w0 - w1;
        if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) {
          const z = w0 * az + w1 * bz + w2 * cz;
          if (z > 0.6) {
            const idx = py * this.cols + px;
            if (z < this.depth[idx]) {
              this.depth[idx] = z;
              this.chars[idx] = ch.charCodeAt(0);
              this.colors[idx] = color;
            }
          }
        }
      }
    }
  }

  /**
   * Serialize buffer into plain multi-line ASCII string (useful for testing & snapshots).
   */
  toPlainText(): string {
    const lines: string[] = [];
    for (let r = 0; r < this.rows; r++) {
      const offset = r * this.cols;
      let line = '';
      for (let c = 0; c < this.cols; c++) {
        line += String.fromCharCode(this.chars[offset + c]);
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  /**
   * Serialize into span-grouped HTML rows so terminal flush is ultra-fast (< 1ms).
   */
  toTerminalHtml(): string {
    const rowsHtml: string[] = new Array(this.rows);
    for (let r = 0; r < this.rows; r++) {
      const offset = r * this.cols;
      let rowStr = '';
      let curColor = this.colors[offset];
      let run = '';

      for (let c = 0; c < this.cols; c++) {
        const chCode = this.chars[offset + c];
        const col = chCode === 32 ? AsciiColor.Empty : this.colors[offset + c];
        const ch =
          chCode === 60
            ? '&lt;'
            : chCode === 62
              ? '&gt;'
              : chCode === 38
                ? '&amp;'
                : String.fromCharCode(chCode);

        if (col === curColor) {
          run += ch;
        } else {
          if (curColor === AsciiColor.Empty) {
            rowStr += run;
          } else {
            rowStr += `<span class="c-${curColor}">${run}</span>`;
          }
          curColor = col;
          run = ch;
        }
      }
      if (run.length > 0) {
        if (curColor === AsciiColor.Empty) {
          rowStr += run;
        } else {
          rowStr += `<span class="c-${curColor}">${run}</span>`;
        }
      }
      rowsHtml[r] = rowStr;
    }
    return rowsHtml.join('\n');
  }
}

function pickLineChar(dx: number, dy: number): string {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy) * 1.75; // compensate char cell aspect ratio
  if (adx < 1e-3 && ady < 1e-3) return '+';
  const ratio = ady / (adx + 1e-5);
  if (ratio < 0.38) return '-';
  if (ratio > 2.4) return '|';
  return dx * dy >= 0 ? '\\' : '/';
}

export function luminanceToAscii(intensity: number): string {
  const idx = Math.round(clamp(intensity, 0.12, 1) * (SHADE_RAMP.length - 1));
  return SHADE_RAMP[idx];
}

const SUN_DIR: Vec3 = { x: 0.48, y: 0.78, z: -0.4 };

function roleBaseColor(role: FaceRole, isEnemy: boolean, isAlert: boolean): AsciiColor {
  if (isAlert) return AsciiColor.Alert;
  if (isEnemy) {
    if (role === 'engine') return AsciiColor.Amber;
    if (role === 'canopy') return AsciiColor.Highlight;
    if (role === 'accent') return AsciiColor.Alert;
    return AsciiColor.Amber;
  }
  if (role === 'engine') return AsciiColor.Amber;
  if (role === 'canopy') return AsciiColor.Highlight;
  if (role === 'accent') return AsciiColor.Bright;
  return AsciiColor.Bright;
}

export function renderMesh(
  buf: AsciiBuffer,
  mesh: Mesh3D,
  origin: Vec3,
  basis: Basis3,
  cam: Camera3D,
  options: {
    scale?: number;
    isEnemy?: boolean;
    hitFlash?: boolean;
    wireframeBoost?: boolean;
  } = {},
): void {
  const meshScale = options.scale ?? 1;
  const isEnemy = options.isEnemy ?? false;
  const hitFlash = options.hitFlash ?? false;

  // Transform all vertices once
  const projected = mesh.vertices.map((v) => {
    const scaled = meshScale === 1 ? v : { x: v.x * meshScale, y: v.y * meshScale, z: v.z * meshScale };
    const world = meshToWorld(scaled, origin, basis);
    const camSpace = worldToCamera(world, cam);
    return {
      camSpace,
      proj: projectCameraPoint(camSpace, buf.cols, buf.rows, cam.fovScale, cam.charAspect, 0.8),
    };
  });

  // Shaded triangles
  for (let i = 0; i < mesh.triangles.length; i++) {
    const tri = mesh.triangles[i];
    const pa = projected[tri.a];
    const pb = projected[tri.b];
    const pc = projected[tri.c];
    if (!pa.proj.visible || !pb.proj.visible || !pc.proj.visible) continue;

    // Rotate face normal to world space
    const ln = mesh.faceNormals[i];
    const worldNormal: Vec3 = {
      x: basis.right.x * ln.x + basis.up.x * ln.y + basis.forward.x * -ln.z,
      y: basis.right.y * ln.x + basis.up.y * ln.y + basis.forward.y * -ln.z,
      z: basis.right.z * ln.x + basis.up.z * ln.y + basis.forward.z * -ln.z,
    };

    const ndotl = clamp(dot(worldNormal, SUN_DIR) * 0.65 + 0.45, 0.18, 1);
    const ch = hitFlash ? '@' : luminanceToAscii(ndotl);
    const col = hitFlash
      ? AsciiColor.Highlight
      : ndotl > 0.72 && !isEnemy
        ? AsciiColor.Highlight
        : roleBaseColor(tri.role, isEnemy, false);

    buf.fillTriangle(
      pa.proj.x,
      pa.proj.y,
      pa.proj.z,
      pb.proj.x,
      pb.proj.y,
      pb.proj.z,
      pc.proj.x,
      pc.proj.y,
      pc.proj.z,
      ch,
      col,
    );
  }

  // Crisp edge outline for unmistakable aircraft silhouette at range
  if (options.wireframeBoost !== false) {
    for (let i = 0; i < mesh.edges.length; i++) {
      const edge = mesh.edges[i];
      const pa = projected[edge.a];
      const pb = projected[edge.b];
      if (!pa.proj.visible || !pb.proj.visible) continue;
      const col = hitFlash
        ? AsciiColor.Highlight
        : isEnemy
          ? AsciiColor.Alert
          : AsciiColor.Highlight;
      buf.drawLine(
        pa.proj.x,
        pa.proj.y,
        pa.proj.z - 0.08,
        pb.proj.x,
        pb.proj.y,
        pb.proj.z - 0.08,
        col,
      );
    }
  }
}

/**
 * Render rolling 3D wireframe terrain grid below the camera.
 */
export function renderTerrainGrid(buf: AsciiBuffer, cam: Camera3D): void {
  const spacing = 54;
  const halfSpan = 8; // 17x17 grid anchored to player XZ
  const baseX = Math.floor(cam.pos.x / spacing) * spacing;
  const baseZ = Math.floor(cam.pos.z / spacing) * spacing;

  const gridSize = halfSpan * 2 + 1;
  const pts: ReturnType<typeof projectWorldPoint>[] = new Array(gridSize * gridSize);

  for (let gz = 0; gz < gridSize; gz++) {
    const wz = baseZ + (gz - halfSpan) * spacing;
    for (let gx = 0; gx < gridSize; gx++) {
      const wx = baseX + (gx - halfSpan) * spacing;
      const wy = terrainHeightAt(wx, wz);
      pts[gz * gridSize + gx] = projectWorldPoint({ x: wx, y: wy, z: wz }, cam, buf.cols, buf.rows, 2.0);
    }
  }

  for (let gz = 0; gz < gridSize; gz++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const p = pts[gz * gridSize + gx];
      if (!p.visible) continue;

      const distColor =
        p.z < 150 ? AsciiColor.Mid : AsciiColor.Dim;
      const nodeChar = p.z < 140 ? '+' : '.';
      buf.plot(p.x, p.y, p.z, nodeChar, distColor);

      if (gx + 1 < gridSize) {
        const pr = pts[gz * gridSize + (gx + 1)];
        if (pr.visible && (p.z < 380 || pr.z < 380)) {
          buf.drawLine(p.x, p.y, p.z, pr.x, pr.y, pr.z, distColor, p.z < 160 ? '-' : '.');
        }
      }
      if (gz + 1 < gridSize) {
        const pd = pts[(gz + 1) * gridSize + gx];
        if (pd.visible && (p.z < 380 || pd.z < 380)) {
          buf.drawLine(p.x, p.y, p.z, pd.x, pd.y, pd.z, distColor, p.z < 160 ? ':' : '.');
        }
      }
    }
  }

  // Subtle upper-airspace cloud/stratum grid markers so high-altitude loops feel spatial
  const cloudSpacing = 120;
  const cBaseX = Math.floor(cam.pos.x / cloudSpacing) * cloudSpacing;
  const cBaseZ = Math.floor(cam.pos.z / cloudSpacing) * cloudSpacing;
  for (let cz = -3; cz <= 3; cz++) {
    for (let cx = -3; cx <= 3; cx++) {
      const wx = cBaseX + cx * cloudSpacing;
      const wz = cBaseZ + cz * cloudSpacing;
      const wy = 148 + Math.sin(wx * 0.02 + wz * 0.02) * 14;
      const cp = projectWorldPoint({ x: wx, y: wy, z: wz }, cam, buf.cols, buf.rows, 8.0);
      if (cp.visible && cp.z < 460) {
        buf.plot(cp.x, cp.y, cp.z, '~', AsciiColor.Dim);
        buf.plot(cp.x + 1, cp.y, cp.z, '~', AsciiColor.Dim);
      }
    }
  }
}

/**
 * Render faint 3D sky stars / altitude markers so climbing and looping feel unmistakably 3D.
 */
const SKY_STARS: Vec3[] = Array.from({ length: 64 }, (_, i) => {
  const theta = i * 2.39996;
  const phi = ((i % 9) / 9) * 0.78 + 0.08;
  const r = 900;
  return {
    x: Math.cos(theta) * Math.cos(phi) * r,
    y: Math.sin(phi) * r,
    z: Math.sin(theta) * Math.cos(phi) * r,
  };
});

export function renderSkyMarkers(buf: AsciiBuffer, cam: Camera3D): void {
  const skyCam: Camera3D = {
    pos: { x: 0, y: 0, z: 0 },
    basis: cam.basis,
    fovScale: cam.fovScale,
    charAspect: cam.charAspect,
  };
  for (let i = 0; i < SKY_STARS.length; i++) {
    const p = projectWorldPoint(SKY_STARS[i], skyCam, buf.cols, buf.rows, 1);
    if (p.visible) {
      buf.plot(p.x, p.y, 900, i % 4 === 0 ? '+' : '.', AsciiColor.Dim);
    }
  }
}

/**
 * Render artificial horizon line & center crosshair inside the terminal buffer.
 */
export function renderFlightHorizonHud(
  buf: AsciiBuffer,
  playerBasis: Basis3,
  isCockpit: boolean,
): void {
  const cx = Math.floor(buf.cols * 0.5);
  const cy = Math.floor(buf.rows * 0.5);

  // Horizon pitch & roll indicator
  const pitchOffset = Math.round(playerBasis.forward.y * buf.rows * 0.35);
  const horizonY = cy + pitchOffset;
  const rollSlope = clamp(-playerBasis.right.y / Math.max(0.2, Math.abs(playerBasis.up.y) + 0.3), -1.1, 1.1);

  const halfSpan = isCockpit ? 24 : 14;
  for (let dx = -halfSpan; dx <= halfSpan; dx++) {
    if (Math.abs(dx) < 4) continue;
    if (Math.abs(dx) % 2 === 1) continue;
    const hy = Math.round(horizonY + dx * rollSlope * 0.45);
    if (hy > 2 && hy < buf.rows - 3) {
      buf.plotHud(cx + dx, hy, dx % 4 === 0 ? '-' : '.', isCockpit ? AsciiColor.Mid : AsciiColor.Dim);
    }
  }

  // Cockpit canopy struts & pitch ladder
  if (isCockpit) {
    for (let r = 3; r < Math.floor(buf.rows * 0.36); r++) {
      const lx = Math.round(buf.cols * 0.14 + r * 0.65);
      const rx = Math.round(buf.cols * 0.86 - r * 0.65);
      buf.plotHud(lx, r, '\\', AsciiColor.Dim);
      buf.plotHud(rx, r, '/', AsciiColor.Dim);
    }
    buf.plotHud(cx - 3, cy, '[', AsciiColor.Bright);
    buf.plotHud(cx + 3, cy, ']', AsciiColor.Bright);
    buf.plotHud(cx, cy, '+', AsciiColor.Highlight);
  } else {
    buf.plotHud(cx - 2, cy, '-', AsciiColor.Mid);
    buf.plotHud(cx + 2, cy, '-', AsciiColor.Mid);
    buf.plotHud(cx, cy - 1, '|', AsciiColor.Mid);
    buf.plotHud(cx, cy + 1, '|', AsciiColor.Mid);
    buf.plotHud(cx, cy, '+', AsciiColor.Highlight);
  }
}
