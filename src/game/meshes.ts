import { Vec3, sub, cross, normalize } from './math3d';

export type FaceRole = 'hull' | 'wing' | 'canopy' | 'engine' | 'accent';

export interface MeshTriangle {
  a: number;
  b: number;
  c: number;
  role: FaceRole;
}

export interface MeshEdge {
  a: number;
  b: number;
  role: FaceRole;
}

export interface Mesh3D {
  vertices: Vec3[];
  triangles: MeshTriangle[];
  edges: MeshEdge[];
  faceNormals: Vec3[];
}

function buildMesh(vertices: Vec3[], triangles: MeshTriangle[], edges: MeshEdge[]): Mesh3D {
  const faceNormals = triangles.map((tri) => {
    const va = vertices[tri.a];
    const vb = vertices[tri.b];
    const vc = vertices[tri.c];
    return normalize(cross(sub(vb, va), sub(vc, va)));
  });
  return { vertices, triangles, edges, faceNormals };
}

/**
 * Player Interceptor Jet: swept delta wings, sharp nose cone, twin angled tail fins,
 * raised cockpit canopy, and rear afterburner nozzle. Local forward is -Z.
 */
export const PLAYER_JET_MESH: Mesh3D = buildMesh(
  [
    // 0: Nose tip
    { x: 0, y: -0.1, z: -4.2 },
    // 1..4: Mid-fuselage diamond ring
    { x: -0.75, y: 0.0, z: -1.4 },
    { x: 0.75, y: 0.0, z: -1.4 },
    { x: 0, y: 0.52, z: -1.3 },
    { x: 0, y: -0.42, z: -1.3 },
    // 5..6: Canopy peak & rear
    { x: 0, y: 0.85, z: -0.4 },
    { x: 0, y: 0.48, z: 0.8 },
    // 7..10: Rear fuselage exhaust box
    { x: -0.8, y: 0.12, z: 2.6 },
    { x: 0.8, y: 0.12, z: 2.6 },
    { x: 0.55, y: -0.35, z: 2.7 },
    { x: -0.55, y: -0.35, z: 2.7 },
    // 11..14: Swept main wings (left & right roots/tips)
    { x: -3.9, y: -0.12, z: 1.9 },
    { x: -3.5, y: -0.12, z: 2.6 },
    { x: 3.9, y: -0.12, z: 1.9 },
    { x: 3.5, y: -0.12, z: 2.6 },
    // 15..16: Twin vertical tail fins
    { x: -1.15, y: 1.35, z: 2.7 },
    { x: 1.15, y: 1.35, z: 2.7 },
  ],
  [
    // Nose cone
    { a: 0, b: 3, c: 1, role: 'hull' },
    { a: 0, b: 2, c: 3, role: 'hull' },
    { a: 0, b: 1, c: 4, role: 'hull' },
    { a: 0, b: 4, c: 2, role: 'hull' },
    // Canopy
    { a: 3, b: 5, c: 1, role: 'canopy' },
    { a: 3, b: 2, c: 5, role: 'canopy' },
    { a: 5, b: 6, c: 1, role: 'canopy' },
    { a: 5, b: 2, c: 6, role: 'canopy' },
    // Mid-rear fuselage top & sides
    { a: 1, b: 6, c: 7, role: 'hull' },
    { a: 2, b: 8, c: 6, role: 'hull' },
    { a: 6, b: 8, c: 7, role: 'hull' },
    { a: 1, b: 7, c: 10, role: 'hull' },
    { a: 1, b: 10, c: 4, role: 'hull' },
    { a: 2, b: 9, c: 8, role: 'hull' },
    { a: 2, b: 4, c: 9, role: 'hull' },
    { a: 4, b: 10, c: 9, role: 'hull' },
    // Engine rear plate
    { a: 7, b: 8, c: 9, role: 'engine' },
    { a: 7, b: 9, c: 10, role: 'engine' },
    // Left wing (top & bottom)
    { a: 1, b: 7, c: 11, role: 'wing' },
    { a: 7, b: 12, c: 11, role: 'wing' },
    { a: 1, b: 11, c: 7, role: 'wing' },
    // Right wing (top & bottom)
    { a: 2, b: 13, c: 8, role: 'wing' },
    { a: 8, b: 13, c: 14, role: 'wing' },
    { a: 2, b: 8, c: 13, role: 'wing' },
    // Twin tail fins
    { a: 6, b: 15, c: 7, role: 'accent' },
    { a: 6, b: 8, c: 16, role: 'accent' },
  ],
  [
    { a: 0, b: 1, role: 'hull' },
    { a: 0, b: 2, role: 'hull' },
    { a: 0, b: 3, role: 'hull' },
    { a: 1, b: 11, role: 'wing' },
    { a: 11, b: 12, role: 'wing' },
    { a: 12, b: 7, role: 'wing' },
    { a: 2, b: 13, role: 'wing' },
    { a: 13, b: 14, role: 'wing' },
    { a: 14, b: 8, role: 'wing' },
    { a: 7, b: 15, role: 'accent' },
    { a: 8, b: 16, role: 'accent' },
    { a: 3, b: 5, role: 'canopy' },
    { a: 5, b: 6, role: 'canopy' },
  ],
);

/**
 * Enemy Scout Dart: razor-sharp triangular interceptor.
 */
export const SCOUT_MESH: Mesh3D = buildMesh(
  [
    { x: 0, y: 0, z: -3.6 },
    { x: -3.1, y: -0.1, z: 2.0 },
    { x: 3.1, y: -0.1, z: 2.0 },
    { x: 0, y: 0.75, z: 0.4 },
    { x: 0, y: -0.45, z: 1.6 },
    { x: 0, y: 1.25, z: 2.1 },
    { x: 0, y: 0.05, z: 2.2 },
  ],
  [
    { a: 0, b: 3, c: 1, role: 'wing' },
    { a: 0, b: 2, c: 3, role: 'wing' },
    { a: 0, b: 1, c: 4, role: 'hull' },
    { a: 0, b: 4, c: 2, role: 'hull' },
    { a: 3, b: 6, c: 1, role: 'wing' },
    { a: 3, b: 2, c: 6, role: 'wing' },
    { a: 1, b: 6, c: 4, role: 'engine' },
    { a: 2, b: 4, c: 6, role: 'engine' },
    { a: 3, b: 5, c: 6, role: 'accent' },
  ],
  [
    { a: 0, b: 1, role: 'wing' },
    { a: 0, b: 2, role: 'wing' },
    { a: 1, b: 6, role: 'wing' },
    { a: 2, b: 6, role: 'wing' },
    { a: 0, b: 3, role: 'canopy' },
    { a: 3, b: 5, role: 'accent' },
    { a: 5, b: 6, role: 'accent' },
  ],
);

/**
 * Enemy Heavy Gunship: wide twin-boom armored frame.
 */
export const HEAVY_MESH: Mesh3D = buildMesh(
  [
    // Central armored pod
    { x: 0, y: 0.2, z: -3.4 },
    { x: -1.1, y: 0.5, z: -1.2 },
    { x: 1.1, y: 0.5, z: -1.2 },
    { x: -1.1, y: -0.6, z: -1.2 },
    { x: 1.1, y: -0.6, z: -1.2 },
    { x: 0, y: 0.65, z: 2.4 },
    { x: 0, y: -0.55, z: 2.4 },
    // Left outer boom & wide wing
    { x: -4.4, y: 0.1, z: -0.8 },
    { x: -4.4, y: 0.1, z: 2.8 },
    { x: -4.4, y: 1.2, z: 2.6 },
    // Right outer boom & wide wing
    { x: 4.4, y: 0.1, z: -0.8 },
    { x: 4.4, y: 0.1, z: 2.8 },
    { x: 4.4, y: 1.2, z: 2.6 },
  ],
  [
    { a: 0, b: 2, c: 1, role: 'canopy' },
    { a: 0, b: 1, c: 3, role: 'hull' },
    { a: 0, b: 4, c: 2, role: 'hull' },
    { a: 0, b: 3, c: 4, role: 'hull' },
    { a: 1, b: 2, c: 5, role: 'hull' },
    { a: 1, b: 5, c: 3, role: 'hull' },
    { a: 2, b: 4, c: 5, role: 'hull' },
    { a: 3, b: 5, c: 6, role: 'engine' },
    { a: 4, b: 6, c: 5, role: 'engine' },
    // Left wing bridge
    { a: 1, b: 5, c: 7, role: 'wing' },
    { a: 5, b: 8, c: 7, role: 'wing' },
    { a: 7, b: 8, c: 9, role: 'accent' },
    // Right wing bridge
    { a: 2, b: 10, c: 5, role: 'wing' },
    { a: 5, b: 10, c: 11, role: 'wing' },
    { a: 10, b: 12, c: 11, role: 'accent' },
  ],
  [
    { a: 0, b: 1, role: 'hull' },
    { a: 0, b: 2, role: 'hull' },
    { a: 1, b: 7, role: 'wing' },
    { a: 7, b: 8, role: 'wing' },
    { a: 8, b: 9, role: 'accent' },
    { a: 2, b: 10, role: 'wing' },
    { a: 10, b: 11, role: 'wing' },
    { a: 11, b: 12, role: 'accent' },
    { a: 5, b: 8, role: 'wing' },
    { a: 5, b: 11, role: 'wing' },
  ],
);

/**
 * Enemy Ace Phantom: forward-swept stealth silhouette.
 */
export const ACE_MESH: Mesh3D = buildMesh(
  [
    { x: 0, y: 0, z: -4.5 },
    { x: -1.0, y: 0.25, z: -0.5 },
    { x: 1.0, y: 0.25, z: -0.5 },
    { x: 0, y: 0.8, z: -0.6 },
    { x: 0, y: -0.45, z: 0.2 },
    // Forward-swept wingtips
    { x: -4.2, y: 0.15, z: -1.6 },
    { x: -3.5, y: 0.0, z: 1.6 },
    { x: 4.2, y: 0.15, z: -1.6 },
    { x: 3.5, y: 0.0, z: 1.6 },
    // Rear & V-tail
    { x: 0, y: 0.1, z: 2.8 },
    { x: -1.4, y: 1.4, z: 2.8 },
    { x: 1.4, y: 1.4, z: 2.8 },
  ],
  [
    { a: 0, b: 3, c: 1, role: 'canopy' },
    { a: 0, b: 2, c: 3, role: 'canopy' },
    { a: 0, b: 1, c: 4, role: 'hull' },
    { a: 0, b: 4, c: 2, role: 'hull' },
    { a: 3, b: 9, c: 1, role: 'hull' },
    { a: 3, b: 2, c: 9, role: 'hull' },
    { a: 1, b: 9, c: 4, role: 'hull' },
    { a: 2, b: 4, c: 9, role: 'hull' },
    // Forward-swept wings
    { a: 1, b: 6, c: 5, role: 'wing' },
    { a: 1, b: 9, c: 6, role: 'wing' },
    { a: 2, b: 7, c: 8, role: 'wing' },
    { a: 2, b: 8, c: 9, role: 'wing' },
    // V-tail
    { a: 1, b: 10, c: 9, role: 'accent' },
    { a: 2, b: 9, c: 11, role: 'accent' },
  ],
  [
    { a: 0, b: 1, role: 'hull' },
    { a: 0, b: 2, role: 'hull' },
    { a: 1, b: 5, role: 'wing' },
    { a: 5, b: 6, role: 'wing' },
    { a: 6, b: 9, role: 'wing' },
    { a: 2, b: 7, role: 'wing' },
    { a: 7, b: 8, role: 'wing' },
    { a: 8, b: 9, role: 'wing' },
    { a: 9, b: 10, role: 'accent' },
    { a: 9, b: 11, role: 'accent' },
  ],
);
