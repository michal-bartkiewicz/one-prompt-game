export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Basis3 {
  forward: Vec3;
  up: Vec3;
  right: Vec3;
}

export interface Camera3D {
  pos: Vec3;
  basis: Basis3;
  fovScale: number; // e.g., 1.15 (~80 deg vertical/horizontal balanced)
  charAspect: number; // width/height of one monospace cell (~0.56)
}

export interface ProjectedPoint {
  x: number;
  y: number;
  z: number; // depth in camera space (> 0 is in front)
  visible: boolean;
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function lengthSq(v: Vec3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function length(v: Vec3): number {
  return Math.sqrt(lengthSq(v));
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v);
  if (len < 1e-8) {
    return { x: 0, y: 0, z: -1 };
  }
  const inv = 1 / len;
  return { x: v.x * inv, y: v.y * inv, z: v.z * inv };
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function clamp(val: number, min: number, max: number): number {
  return val < min ? min : val > max ? max : val;
}

export function defaultBasis(): Basis3 {
  return {
    forward: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
  };
}

/**
 * Rodrigues' rotation formula: rotate vector `v` around unit `axis` by `angle` radians.
 */
export function rotateAroundAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
  if (Math.abs(angle) < 1e-8) return v;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kDotV = dot(axis, v);
  const kCrossV = cross(axis, v);
  return {
    x: v.x * c + kCrossV.x * s + axis.x * kDotV * (1 - c),
    y: v.y * c + kCrossV.y * s + axis.y * kDotV * (1 - c),
    z: v.z * c + kCrossV.z * s + axis.z * kDotV * (1 - c),
  };
}

export function orthonormalizeBasis(b: Basis3): Basis3 {
  const forward = normalize(b.forward);
  const right = normalize(cross(forward, b.up));
  const up = normalize(cross(right, forward));
  return { forward, up, right };
}

/**
 * Rotate a Basis3 by local pitch (around right), yaw (around up), and roll (around forward).
 */
export function rotateBasisLocal(
  basis: Basis3,
  pitchRad: number,
  yawRad: number,
  rollRad: number,
): Basis3 {
  let { forward, up, right } = basis;

  if (Math.abs(pitchRad) > 1e-7) {
    forward = rotateAroundAxis(forward, right, pitchRad);
    up = rotateAroundAxis(up, right, pitchRad);
  }
  if (Math.abs(yawRad) > 1e-7) {
    forward = rotateAroundAxis(forward, up, yawRad);
    right = rotateAroundAxis(right, up, yawRad);
  }
  if (Math.abs(rollRad) > 1e-7) {
    up = rotateAroundAxis(up, forward, rollRad);
    right = rotateAroundAxis(right, forward, rollRad);
  }

  return orthonormalizeBasis({ forward, up, right });
}

/**
 * Rotate a Basis3 around world Y axis (for horizontal banking turns in arcade flight).
 */
export function rotateBasisWorldYaw(basis: Basis3, yawRad: number): Basis3 {
  if (Math.abs(yawRad) < 1e-7) return basis;
  const worldUp: Vec3 = { x: 0, y: 1, z: 0 };
  return orthonormalizeBasis({
    forward: rotateAroundAxis(basis.forward, worldUp, yawRad),
    up: rotateAroundAxis(basis.up, worldUp, yawRad),
    right: rotateAroundAxis(basis.right, worldUp, yawRad),
  });
}

export function basisFromForward(forwardDir: Vec3, worldUp: Vec3 = { x: 0, y: 1, z: 0 }): Basis3 {
  const forward = normalize(forwardDir);
  let right = cross(forward, worldUp);
  if (lengthSq(right) < 1e-6) {
    right = { x: 1, y: 0, z: 0 };
  } else {
    right = normalize(right);
  }
  const up = normalize(cross(right, forward));
  return { forward, up, right };
}

export function localToWorld(local: Vec3, origin: Vec3, basis: Basis3): Vec3 {
  return {
    x: origin.x + basis.right.x * local.x + basis.up.x * local.y + basis.forward.x * -local.z,
    y: origin.y + basis.right.y * local.x + basis.up.y * local.y + basis.forward.y * -local.z,
    z: origin.z + basis.right.z * local.x + basis.up.z * local.y + basis.forward.z * -local.z,
  };
}

/**
 * Transform local mesh vertex (where -Z is nose forward, +Y is up, +X is right wing)
 * into world coordinates.
 */
export function meshToWorld(local: Vec3, origin: Vec3, basis: Basis3): Vec3 {
  const fwd = -local.z;
  return {
    x: origin.x + basis.right.x * local.x + basis.up.x * local.y + basis.forward.x * fwd,
    y: origin.y + basis.right.y * local.x + basis.up.y * local.y + basis.forward.y * fwd,
    z: origin.z + basis.right.z * local.x + basis.up.z * local.y + basis.forward.z * fwd,
  };
}

export function worldToCamera(world: Vec3, cam: Camera3D): Vec3 {
  const d = sub(world, cam.pos);
  return {
    x: dot(d, cam.basis.right),
    y: dot(d, cam.basis.up),
    z: dot(d, cam.basis.forward),
  };
}

export function projectCameraPoint(
  camSpace: Vec3,
  cols: number,
  rows: number,
  fovScale: number,
  charAspect: number,
  nearClip = 0.6,
): ProjectedPoint {
  if (camSpace.z <= nearClip) {
    return { x: 0, y: 0, z: camSpace.z, visible: false };
  }
  const halfH = rows * 0.5;
  const invZ = fovScale / camSpace.z;
  const x = cols * 0.5 + (camSpace.x * invZ * halfH) / charAspect;
  const y = halfH - camSpace.y * invZ * halfH;
  return { x, y, z: camSpace.z, visible: true };
}

export function projectWorldPoint(
  world: Vec3,
  cam: Camera3D,
  cols: number,
  rows: number,
  nearClip = 0.6,
): ProjectedPoint {
  const cs = worldToCamera(world, cam);
  return projectCameraPoint(cs, cols, rows, cam.fovScale, cam.charAspect, nearClip);
}

/**
 * Deterministic rolling mountain/canyon terrain heightfield.
 * Keeps a navigable valley near x=0 so spawn is always clear.
 */
export function terrainHeightAt(x: number, z: number): number {
  const valley = Math.min(1, Math.abs(x) / 140);
  const ridgeA = Math.sin(x * 0.018) * Math.cos(z * 0.016) * 24;
  const ridgeB = Math.sin(x * 0.043 + 1.2) * Math.sin(z * 0.039 - 0.7) * 11;
  const detail = Math.cos((x + z) * 0.09) * 2.5;
  return Math.max(-8, (ridgeA + ridgeB) * (0.35 + 0.65 * valley) + detail);
}
