import {
  AsciiBuffer,
  AsciiColor,
  renderFlightHorizonHud,
  renderMesh,
  renderSkyMarkers,
  renderTerrainGrid,
} from '../engine/asciiRenderer';
import {
  Basis3,
  Camera3D,
  Vec3,
  add,
  basisFromForward,
  clamp,
  defaultBasis,
  dot,
  length,
  lerpVec3,
  normalize,
  projectWorldPoint,
  rotateBasisLocal,
  rotateBasisWorldYaw,
  scale,
  sub,
  terrainHeightAt,
} from './math3d';
import { ACE_MESH, HEAVY_MESH, PLAYER_JET_MESH, SCOUT_MESH } from './meshes';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';
export type EnemyKind = 'scout' | 'heavy' | 'ace';
export type CameraMode = 'chase' | 'cockpit';

export interface InputState {
  pitchUp: boolean;
  pitchDown: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  boost: boolean;
  fireGun: boolean;
  fireMissile: boolean;
}

export interface PlayerState {
  pos: Vec3;
  basis: Basis3;
  speed: number;
  hp: number;
  maxHp: number;
  boost: number;
  gunCooldown: number;
  missileCooldown: number;
  maxMissileCooldown: number;
  visualRoll: number;
  visualPitch: number;
  hitFlashTimer: number;
  scrapeCooldown: number;
}

export interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  pos: Vec3;
  basis: Basis3;
  speed: number;
  hp: number;
  maxHp: number;
  points: number;
  fireCooldown: number;
  windupTimer: number; // > 0 when telegraphing a heavy/aimed attack
  burstRemaining: number;
  burstTimer: number;
  orbitSign: number;
  evadeTimer: number;
  hitFlashTimer: number;
  dyingTimer: number; // > 0 during KO spiral before explosion
  isDying: boolean;
}

export interface Projectile {
  active: boolean;
  fromPlayer: boolean;
  isMissile: boolean;
  pos: Vec3;
  vel: Vec3;
  life: number;
  damage: number;
  targetId: number;
}

export interface Particle {
  active: boolean;
  pos: Vec3;
  vel: Vec3;
  life: number;
  maxLife: number;
  ch: string;
  color: AsciiColor;
}

export interface SimEvent {
  type:
    | 'gun'
    | 'missile'
    | 'hit'
    | 'kill'
    | 'playerHit'
    | 'lockComplete'
    | 'incomingWarning'
    | 'waveClear'
    | 'gameover';
}

export interface RadarBlip {
  x: number; // -1..1 relative to player right
  z: number; // -1..1 relative to player forward (-1 ahead, +1 behind)
  kind: EnemyKind;
  locked: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  hp: number;
  maxHp: number;
  boost: number;
  speed: number;
  altitude: number;
  score: number;
  bestScore: number;
  wave: number;
  kills: number;
  accuracy: number;
  missileReadyPct: number;
  lockTargetKind: EnemyKind | null;
  lockProgress: number;
  lockDistance: number | null;
  incomingWarning: boolean;
  enemiesRemaining: number;
  waveBannerTimer: number;
  radarBlips: RadarBlip[];
  cameraMode: CameraMode;
}

export interface GameState {
  phase: GamePhase;
  time: number;
  titleSpinAngle: number;
  player: PlayerState;
  cameraPos: Vec3;
  cameraBasis: Basis3;
  cameraMode: CameraMode;
  invertPitch: boolean;
  enemies: EnemyEntity[];
  nextEnemyId: number;
  projectiles: Projectile[];
  projCursor: number;
  particles: Particle[];
  partCursor: number;
  wave: number;
  waveBannerTimer: number;
  waveSpawnDelay: number;
  score: number;
  bestScore: number;
  kills: number;
  shotsFired: number;
  shotsHit: number;
  hitstopTimer: number;
  shakeTrauma: number;
  lockTargetId: number | null;
  lockProgress: number;
  incomingWarning: boolean;
  invertPitchFactor: number;
  pendingEvents: SimEvent[];
}

const MAX_PROJECTILES = 96;
const MAX_PARTICLES = 128;

export function emptyInput(): InputState {
  return {
    pitchUp: false,
    pitchDown: false,
    turnLeft: false,
    turnRight: false,
    rollLeft: false,
    rollRight: false,
    boost: false,
    fireGun: false,
    fireMissile: false,
  };
}

function createProjectilePool(): Projectile[] {
  return Array.from({ length: MAX_PROJECTILES }, () => ({
    active: false,
    fromPlayer: true,
    isMissile: false,
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    life: 0,
    damage: 10,
    targetId: -1,
  }));
}

function createParticlePool(): Particle[] {
  return Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    life: 0,
    maxLife: 1,
    ch: '*',
    color: AsciiColor.Amber,
  }));
}

export function createInitialGameState(bestScore = 0): GameState {
  const startPos: Vec3 = { x: 0, y: 72, z: 0 };
  const startBasis = defaultBasis();
  return {
    phase: 'title',
    time: 0,
    titleSpinAngle: 0.4,
    player: {
      pos: { ...startPos },
      basis: startBasis,
      speed: 52,
      hp: 100,
      maxHp: 100,
      boost: 100,
      gunCooldown: 0,
      missileCooldown: 0,
      maxMissileCooldown: 3.5,
      visualRoll: 0,
      visualPitch: 0,
      hitFlashTimer: 0,
      scrapeCooldown: 0,
    },
    cameraPos: { x: 0, y: 76.5, z: 16 },
    cameraBasis: startBasis,
    cameraMode: 'chase',
    invertPitch: false,
    enemies: [],
    nextEnemyId: 1,
    projectiles: createProjectilePool(),
    projCursor: 0,
    particles: createParticlePool(),
    partCursor: 0,
    wave: 1,
    waveBannerTimer: 0,
    waveSpawnDelay: 0,
    score: 0,
    bestScore,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    hitstopTimer: 0,
    shakeTrauma: 0,
    lockTargetId: null,
    lockProgress: 0,
    incomingWarning: false,
    invertPitchFactor: 1,
    pendingEvents: [],
  };
}

export function startNewSortie(state: GameState): void {
  const best = Math.max(state.bestScore, state.score);
  const camMode = state.cameraMode;
  const invert = state.invertPitch;
  const fresh = createInitialGameState(best);
  Object.assign(state, fresh);
  state.phase = 'playing';
  state.cameraMode = camMode;
  state.invertPitch = invert;
  state.invertPitchFactor = invert ? -1 : 1;
  state.waveBannerTimer = 2.0;
  spawnWave(state, 1);
}

export function spawnWave(state: GameState, waveNum: number): void {
  state.wave = waveNum;
  const totalCount = Math.min(8, 3 + waveNum);

  for (let i = 0; i < totalCount; i++) {
    let kind: EnemyKind = 'scout';
    if (waveNum >= 2 && i === totalCount - 1) {
      kind = 'ace';
    } else if (i % 3 === 1 || (waveNum >= 3 && i === 2)) {
      kind = 'heavy';
    } else if (waveNum >= 4 && i % 2 === 0) {
      kind = 'ace';
    }

    const angle = ((i / totalCount) - 0.5) * 1.15 + (i % 2 === 0 ? 0.12 : -0.12);
    const dist = 225 + (i % 3) * 45;
    const altOffset = 6 + (i % 3) * 12;

    const spawnOffset = add(
      scale(state.player.basis.forward, dist * Math.cos(angle)),
      scale(state.player.basis.right, dist * Math.sin(angle)),
    );
    const pos: Vec3 = {
      x: state.player.pos.x + spawnOffset.x,
      y: Math.max(terrainHeightAt(state.player.pos.x + spawnOffset.x, state.player.pos.z + spawnOffset.z) + 32, state.player.pos.y + altOffset),
      z: state.player.pos.z + spawnOffset.z,
    };

    // Start enemies flying tangentially/across player's windscreen so they stay visible ahead
    const tangentHeading = normalize(
      add(scale(state.player.basis.right, i % 2 === 0 ? 0.8 : -0.8), scale(state.player.basis.forward, -0.35)),
    );
    const stats = enemyStats(kind, waveNum);

    state.enemies.push({
      id: state.nextEnemyId++,
      kind,
      pos,
      basis: basisFromForward(tangentHeading),
      speed: stats.speed,
      hp: stats.hp,
      maxHp: stats.hp,
      points: stats.points,
      fireCooldown: 1.4 + i * 0.55,
      windupTimer: 0,
      burstRemaining: 0,
      burstTimer: 0,
      orbitSign: i % 2 === 0 ? 1 : -1,
      evadeTimer: 0,
      hitFlashTimer: 0,
      dyingTimer: 0,
      isDying: false,
    });
  }
}

function enemyStats(kind: EnemyKind, wave: number): { speed: number; hp: number; points: number } {
  const speedScale = 1 + Math.min(0.28, (wave - 1) * 0.05);
  switch (kind) {
    case 'scout':
      return { speed: 40 * speedScale, hp: 36, points: 100 };
    case 'heavy':
      return { speed: 30 * speedScale, hp: 84 + Math.min(30, (wave - 1) * 8), points: 250 };
    case 'ace':
      return { speed: 46 * speedScale, hp: 62 + Math.min(24, (wave - 1) * 6), points: 350 };
  }
}

function emitParticle(
  state: GameState,
  pos: Vec3,
  vel: Vec3,
  life: number,
  ch: string,
  color: AsciiColor,
): void {
  const p = state.particles[state.partCursor];
  state.partCursor = (state.partCursor + 1) % MAX_PARTICLES;
  p.active = true;
  p.pos.x = pos.x;
  p.pos.y = pos.y;
  p.pos.z = pos.z;
  p.vel.x = vel.x;
  p.vel.y = vel.y;
  p.vel.z = vel.z;
  p.life = life;
  p.maxLife = life;
  p.ch = ch;
  p.color = color;
}

function emitExplosionBurst(state: GameState, center: Vec3, count = 18): void {
  const chars = ['@', '#', '*', '+', ':', '.'];
  const colors = [AsciiColor.Highlight, AsciiColor.Amber, AsciiColor.Alert];
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2 + (i % 3) * 0.4;
    const phi = ((i % 5) - 2) * 0.45;
    const spd = 16 + (i % 4) * 11;
    const vel: Vec3 = {
      x: Math.cos(theta) * Math.cos(phi) * spd,
      y: Math.sin(phi) * spd + 4,
      z: Math.sin(theta) * Math.cos(phi) * spd,
    };
    emitParticle(
      state,
      center,
      vel,
      0.42 + (i % 4) * 0.14,
      chars[i % chars.length],
      colors[i % colors.length],
    );
  }
}

function spawnProjectile(
  state: GameState,
  fromPlayer: boolean,
  isMissile: boolean,
  pos: Vec3,
  vel: Vec3,
  damage: number,
  life: number,
  targetId = -1,
): void {
  const pr = state.projectiles[state.projCursor];
  state.projCursor = (state.projCursor + 1) % MAX_PROJECTILES;
  pr.active = true;
  pr.fromPlayer = fromPlayer;
  pr.isMissile = isMissile;
  pr.pos.x = pos.x;
  pr.pos.y = pos.y;
  pr.pos.z = pos.z;
  pr.vel.x = vel.x;
  pr.vel.y = vel.y;
  pr.vel.z = vel.z;
  pr.damage = damage;
  pr.life = life;
  pr.targetId = targetId;
}

export function stepGameState(state: GameState, input: InputState, rawDt: number): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  state.pendingEvents.length = 0;

  if (state.phase === 'title') {
    state.time += dt;
    state.titleSpinAngle += dt * 0.55;
    return;
  }

  if (state.phase === 'paused' || state.phase === 'gameover') {
    return;
  }

  // Decay visual timers even during hitstop
  state.shakeTrauma = Math.max(0, state.shakeTrauma - dt * 1.45);
  state.player.hitFlashTimer = Math.max(0, state.player.hitFlashTimer - dt);
  state.waveBannerTimer = Math.max(0, state.waveBannerTimer - dt);

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return;
  }

  state.time += dt;
  const p = state.player;
  p.gunCooldown = Math.max(0, p.gunCooldown - dt);
  p.missileCooldown = Math.max(0, p.missileCooldown - dt);
  p.scrapeCooldown = Math.max(0, p.scrapeCooldown - dt);

  // Player flight controls
  const turnInput = (input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0);
  const pitchRaw = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
  const pitchInput = pitchRaw * (state.invertPitch ? -1 : 1);
  const rollInput = (input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0);

  const boosting = input.boost && p.boost > 2;
  if (boosting) {
    p.boost = Math.max(0, p.boost - 34 * dt);
  } else {
    p.boost = Math.min(100, p.boost + 18 * dt);
  }

  const targetSpeed = boosting ? 86 : 52;
  p.speed += (targetSpeed - p.speed) * (1 - Math.exp(-5 * dt));

  // Smooth arcade flight turning & pitching
  const yawRate = -turnInput * 1.45 - rollInput * 0.7;
  const pitchRate = pitchInput * 1.18;
  p.basis = rotateBasisWorldYaw(p.basis, yawRate * dt);
  p.basis = rotateBasisLocal(p.basis, pitchRate * dt, 0, 0);

  // Clamp steep vertical pitch to avoid gimbal flipping while keeping crisp loops/climbs
  if (p.basis.forward.y > 0.85) {
    p.basis.forward.y = 0.85;
    p.basis = basisFromForward(p.basis.forward);
  } else if (p.basis.forward.y < -0.82) {
    p.basis.forward.y = -0.82;
    p.basis = basisFromForward(p.basis.forward);
  }

  // Gentle auto-level pitch toward horizon when no pitch input is held (ensures survival without input)
  if (pitchInput === 0) {
    const levelForward = normalize({ x: p.basis.forward.x, y: p.basis.forward.y * Math.exp(-1.1 * dt), z: p.basis.forward.z });
    p.basis = basisFromForward(levelForward);
  }

  // Visual banking angle for chase jet model
  const targetRoll = clamp(turnInput * 0.62 + rollInput * 0.85, -1.05, 1.05);
  p.visualRoll += (targetRoll - p.visualRoll) * (1 - Math.exp(-8 * dt));
  const targetVisPitch = clamp(pitchInput * 0.16, -0.25, 0.25);
  p.visualPitch += (targetVisPitch - p.visualPitch) * (1 - Math.exp(-8 * dt));

  // Integrate player position
  p.pos = add(p.pos, scale(p.basis.forward, p.speed * dt));

  // Keep player within wide arena ceiling & soft perimeter turn-back
  if (p.pos.y > 260) {
    p.pos.y = 260;
    if (p.basis.forward.y > 0) {
      p.basis.forward.y = 0;
      p.basis = basisFromForward(p.basis.forward);
    }
  }
  const distFromCenter = Math.hypot(p.pos.x, p.pos.z);
  if (distFromCenter > 950) {
    const toOrigin = normalize({ x: -p.pos.x, y: 0, z: -p.pos.z });
    const blended = normalize(lerpVec3(p.basis.forward, toOrigin, dt * 1.4));
    p.basis = basisFromForward(blended);
  }

  // Ground clearance & terrain scrape protection
  const groundY = terrainHeightAt(p.pos.x, p.pos.z);
  const minSafeY = groundY + 11;
  if (p.pos.y < minSafeY) {
    p.pos.y = minSafeY;
    const climbFwd = normalize({ x: p.basis.forward.x, y: Math.max(0.22, p.basis.forward.y), z: p.basis.forward.z });
    p.basis = basisFromForward(climbFwd);
    if (p.scrapeCooldown <= 0) {
      p.scrapeCooldown = 0.75;
      damagePlayer(state, 10);
    }
  }

  // Player afterburner trail particles
  if (boosting && Math.floor(state.time * 30) % 2 === 0) {
    const exhaustPos = sub(p.pos, scale(p.basis.forward, 3.2));
    emitParticle(state, exhaustPos, scale(p.basis.forward, -12), 0.25, '*', AsciiColor.Amber);
  }

  // Target lock evaluation
  updateTargetLock(state, dt);

  // Player firing autocannons
  if (input.fireGun && p.gunCooldown <= 0) {
    p.gunCooldown = 0.11;
    const muzzleLeft = add(add(p.pos, scale(p.basis.forward, 3.5)), scale(p.basis.right, -1.6));
    const muzzleRight = add(add(p.pos, scale(p.basis.forward, 3.5)), scale(p.basis.right, 1.6));

    // Slight convergence toward locked target if inside tight nose cone
    let aimDir = p.basis.forward;
    if (state.lockTargetId !== null) {
      const target = state.enemies.find((e) => e.id === state.lockTargetId && !e.isDying);
      if (target) {
        const leadDist = length(sub(target.pos, p.pos));
        const leadPos = add(target.pos, scale(target.basis.forward, (target.speed * leadDist) / 260));
        const toLead = normalize(sub(leadPos, p.pos));
        if (dot(toLead, p.basis.forward) > 0.96) {
          aimDir = toLead;
        }
      }
    }

    const bulletSpeed = 270;
    const vel = add(scale(aimDir, bulletSpeed), scale(p.basis.forward, p.speed * 0.2));
    spawnProjectile(state, true, false, muzzleLeft, vel, 12, 1.4);
    spawnProjectile(state, true, false, muzzleRight, vel, 12, 1.4);
    state.shotsFired += 2;
    state.pendingEvents.push({ type: 'gun' });
  }

  // Player firing homing missile
  if (input.fireMissile && p.missileCooldown <= 0 && state.lockTargetId !== null && state.lockProgress >= 0.99) {
    p.missileCooldown = p.maxMissileCooldown;
    const launchPos = add(p.pos, scale(p.basis.forward, 4.0));
    spawnProjectile(
      state,
      true,
      true,
      launchPos,
      scale(p.basis.forward, 155),
      55,
      3.5,
      state.lockTargetId,
    );
    state.shotsFired += 1;
    state.pendingEvents.push({ type: 'missile' });
  }

  // Update enemies (3 distinct movement/attack policies + crowd token cap)
  updateEnemies(state, dt);

  // Update projectiles & collisions
  updateProjectiles(state, dt);

  // Update particles
  for (let i = 0; i < state.particles.length; i++) {
    const pt = state.particles[i];
    if (!pt.active) continue;
    pt.life -= dt;
    if (pt.life <= 0) {
      pt.active = false;
      continue;
    }
    pt.pos = add(pt.pos, scale(pt.vel, dt));
    pt.vel = scale(pt.vel, Math.exp(-1.5 * dt));
  }

  // Check wave completion
  if (state.enemies.length === 0) {
    if (state.waveSpawnDelay <= 0) {
      state.waveSpawnDelay = 1.6;
      state.pendingEvents.push({ type: 'waveClear' });
    } else {
      state.waveSpawnDelay -= dt;
      if (state.waveSpawnDelay <= 0) {
        state.waveBannerTimer = 2.2;
        spawnWave(state, state.wave + 1);
      }
    }
  }

  // Update Chase / Cockpit camera smoothly
  updateCamera(state, dt);
}

function updateTargetLock(state: GameState, dt: number): void {
  const p = state.player;
  let bestId: number | null = null;
  let bestScore = -1;

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.isDying) continue;
    const toE = sub(e.pos, p.pos);
    const dist = length(toE);
    if (dist > 420 || dist < 6) continue;
    const align = dot(scale(toE, 1 / dist), p.basis.forward);
    if (align > 0.87) {
      const candidateScore = align - dist * 0.0002;
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestId = e.id;
      }
    }
  }

  if (bestId === null) {
    state.lockTargetId = null;
    state.lockProgress = Math.max(0, state.lockProgress - dt * 2.5);
    return;
  }

  if (bestId !== state.lockTargetId) {
    state.lockTargetId = bestId;
    state.lockProgress = 0.25;
  } else {
    const prev = state.lockProgress;
    state.lockProgress = Math.min(1, state.lockProgress + dt * 1.45);
    if (prev < 1 && state.lockProgress >= 1) {
      state.pendingEvents.push({ type: 'lockComplete' });
    }
  }
}

function updateEnemies(state: GameState, dt: number): void {
  const p = state.player;
  const maxConcurrentAttackers = state.wave >= 3 ? 3 : 2;
  let activeAttackers = 0;
  let incoming = false;

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (!e.isDying && (e.windupTimer > 0 || e.burstRemaining > 0)) {
      activeAttackers++;
      if (e.windupTimer > 0) incoming = true;
    }
  }

  const nextEnemies: EnemyEntity[] = [];

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);

    if (e.isDying) {
      e.dyingTimer -= dt;
      e.basis = rotateBasisLocal(e.basis, -0.8 * dt, 0.5 * dt, 6.2 * dt);
      e.pos = add(e.pos, scale(e.basis.forward, e.speed * 0.75 * dt));
      e.pos.y -= 12 * dt;
      if (Math.floor(e.dyingTimer * 24) % 2 === 0) {
        emitParticle(state, e.pos, { x: 0, y: 3, z: 0 }, 0.35, '*', AsciiColor.Amber);
      }
      if (e.dyingTimer <= 0) {
        emitExplosionBurst(state, e.pos, 22);
        state.score += e.points;
        state.bestScore = Math.max(state.bestScore, state.score);
        state.kills += 1;
        state.hitstopTimer = 0.045;
        state.shakeTrauma = Math.min(1, state.shakeTrauma + 0.42);
        state.pendingEvents.push({ type: 'kill' });
        continue;
      }
      nextEnemies.push(e);
      continue;
    }

    const toPlayerVec = sub(p.pos, e.pos);
    const dist = Math.max(1, length(toPlayerVec));
    const toPlayerDir = scale(toPlayerVec, 1 / dist);
    let desiredDir = toPlayerDir;
    let turnRate = 1.25;

    if (e.kind === 'scout') {
      // Policy 1: Orbit / Flanking Interceptor
      turnRate = 1.65;
      if (dist < 105) {
        const tangent = normalize({
          x: -toPlayerDir.z * e.orbitSign,
          y: 0.18,
          z: toPlayerDir.x * e.orbitSign,
        });
        desiredDir = normalize(lerpVec3(tangent, scale(toPlayerDir, -0.35), 0.25));
      } else {
        const flank = normalize({
          x: toPlayerDir.x - toPlayerDir.z * 0.42 * e.orbitSign,
          y: toPlayerDir.y + 0.06,
          z: toPlayerDir.z + toPlayerDir.x * 0.42 * e.orbitSign,
        });
        desiredDir = flank;
      }
    } else if (e.kind === 'heavy') {
      // Policy 2: Steadfast Attack-Run Gunship
      turnRate = 0.85;
      if (dist < 75) {
        // Pull up and break away after pass
        desiredDir = normalize({ x: e.basis.forward.x, y: 0.45, z: e.basis.forward.z });
      } else {
        desiredDir = toPlayerDir;
      }
    } else {
      // Policy 3: Ace Phantom - Evasive S-turns when inside player's forward cone
      turnRate = 2.05;
      const playerLookingAtAce = dot(normalize(sub(e.pos, p.pos)), p.basis.forward) > 0.88;
      if (playerLookingAtAce && dist < 240) {
        e.evadeTimer = 0.8;
      }
      if (e.evadeTimer > 0) {
        e.evadeTimer -= dt;
        const jink = Math.sin(state.time * 6.5 + e.id) * 0.85;
        desiredDir = normalize({
          x: toPlayerDir.x * 0.2 + e.basis.right.x * jink,
          y: 0.42 * Math.cos(state.time * 4.5 + e.id),
          z: toPlayerDir.z * 0.2 + e.basis.right.z * jink,
        });
      } else {
        desiredDir = toPlayerDir;
      }
    }

    // Steer enemy forward toward desiredDir
    const steered = normalize(lerpVec3(e.basis.forward, desiredDir, clamp(turnRate * dt, 0, 1)));
    e.basis = basisFromForward(steered);
    e.pos = add(e.pos, scale(e.basis.forward, e.speed * dt));

    // Keep enemy safely above terrain
    const eGround = terrainHeightAt(e.pos.x, e.pos.z) + 18;
    if (e.pos.y < eGround) {
      e.pos.y = eGround;
    }

    // Attack logic with crowd token pool + visible windup telegraph
    e.fireCooldown -= dt;
    const facingPlayer = dot(e.basis.forward, toPlayerDir) > 0.72;

    if (e.windupTimer > 0) {
      e.windupTimer -= dt;
      incoming = true;
      if (e.windupTimer <= 0) {
        e.burstRemaining = e.kind === 'heavy' ? 3 : e.kind === 'ace' ? 2 : 1;
        e.burstTimer = 0;
      }
    } else if (e.burstRemaining > 0) {
      e.burstTimer -= dt;
      if (e.burstTimer <= 0) {
        e.burstRemaining -= 1;
        e.burstTimer = 0.16;
        const aimLead = add(p.pos, scale(p.basis.forward, p.speed * 0.18));
        const shotDir = normalize(sub(aimLead, e.pos));
        const shotSpeed = e.kind === 'ace' ? 145 : 122;
        const dmg = e.kind === 'heavy' ? 12 : 8;
        spawnProjectile(state, false, false, add(e.pos, scale(shotDir, 4)), scale(shotDir, shotSpeed), dmg, 2.4);
      }
    } else if (e.fireCooldown <= 0 && dist < 290 && facingPlayer && activeAttackers < maxConcurrentAttackers) {
      activeAttackers++;
      e.windupTimer = e.kind === 'heavy' ? 0.65 : 0.4;
      e.fireCooldown = e.kind === 'heavy' ? 3.2 : e.kind === 'ace' ? 2.1 : 2.6;
      incoming = true;
      state.pendingEvents.push({ type: 'incomingWarning' });
    }

    nextEnemies.push(e);
  }

  state.enemies = nextEnemies;
  state.incomingWarning = incoming;
}

function updateProjectiles(state: GameState, dt: number): void {
  const p = state.player;
  for (let i = 0; i < state.projectiles.length; i++) {
    const pr = state.projectiles[i];
    if (!pr.active) continue;

    pr.life -= dt;
    if (pr.life <= 0) {
      pr.active = false;
      continue;
    }

    // Homing guidance for player missiles
    if (pr.isMissile && pr.targetId >= 0) {
      const target = state.enemies.find((e) => e.id === pr.targetId && !e.isDying);
      if (target) {
        const curSpd = length(pr.vel);
        const desired = normalize(sub(target.pos, pr.pos));
        const newDir = normalize(lerpVec3(normalize(pr.vel), desired, clamp(5.2 * dt, 0, 1)));
        pr.vel = scale(newDir, Math.max(curSpd, 165));
      }
      if (Math.floor(pr.life * 28) % 2 === 0) {
        emitParticle(state, pr.pos, { x: 0, y: 0, z: 0 }, 0.25, ':', AsciiColor.Dim);
      }
    }

    pr.pos = add(pr.pos, scale(pr.vel, dt));

    // Check ground impact
    if (pr.pos.y < terrainHeightAt(pr.pos.x, pr.pos.z)) {
      pr.active = false;
      emitParticle(state, pr.pos, { x: 0, y: 8, z: 0 }, 0.28, '*', AsciiColor.Mid);
      continue;
    }

    if (pr.fromPlayer) {
      const hitRadius = pr.isMissile ? 8.2 : 6.4;
      for (let j = 0; j < state.enemies.length; j++) {
        const e = state.enemies[j];
        if (e.isDying) continue;
        if (length(sub(pr.pos, e.pos)) <= hitRadius) {
          pr.active = false;
          e.hp -= pr.damage;
          e.hitFlashTimer = 0.09;
          state.shotsHit += 1;
          state.pendingEvents.push({ type: 'hit' });

          if (pr.isMissile) {
            emitExplosionBurst(state, pr.pos, 10);
          } else {
            emitParticle(state, pr.pos, { x: 0, y: 4, z: 0 }, 0.2, '+', AsciiColor.Highlight);
          }

          if (e.hp <= 0) {
            e.isDying = true;
            e.dyingTimer = 0.36;
          }
          break;
        }
      }
    } else {
      // Enemy projectile vs player
      if (length(sub(pr.pos, p.pos)) <= 4.4) {
        pr.active = false;
        damagePlayer(state, pr.damage);
      }
    }
  }
}

export function damagePlayer(state: GameState, amount: number): void {
  if (state.phase !== 'playing') return;
  state.player.hp = Math.max(0, state.player.hp - amount);
  state.player.hitFlashTimer = 0.16;
  state.shakeTrauma = Math.min(1, state.shakeTrauma + 0.45);
  state.pendingEvents.push({ type: 'playerHit' });
  if (state.player.hp <= 0) {
    state.phase = 'gameover';
    state.bestScore = Math.max(state.bestScore, state.score);
    state.pendingEvents.push({ type: 'gameover' });
  }
}

function updateCamera(state: GameState, dt: number): void {
  const p = state.player;
  if (state.cameraMode === 'cockpit') {
    state.cameraPos = add(p.pos, scale(p.basis.up, 0.7));
    state.cameraBasis = p.basis;
    return;
  }

  const desiredPos = add(
    sub(p.pos, scale(p.basis.forward, 13.5)),
    scale(p.basis.up, 5.4),
  );
  const posAlpha = 1 - Math.exp(-11 * dt);
  state.cameraPos = lerpVec3(state.cameraPos, desiredPos, posAlpha);

  const lookTarget = add(p.pos, scale(p.basis.forward, 32));
  const targetDir = normalize(sub(lookTarget, state.cameraPos));
  const camFwd = normalize(lerpVec3(state.cameraBasis.forward, targetDir, 1 - Math.exp(-12 * dt)));
  state.cameraBasis = basisFromForward(camFwd, p.basis.up);
}

export function getHudSnapshot(state: GameState): HudSnapshot {
  const p = state.player;
  const ground = terrainHeightAt(p.pos.x, p.pos.z);
  const alt = Math.max(0, Math.round((p.pos.y - ground) * 12));
  const lockEnemy =
    state.lockTargetId !== null
      ? state.enemies.find((e) => e.id === state.lockTargetId && !e.isDying) ?? null
      : null;

  const radarRange = 420;
  const radarBlips: RadarBlip[] = [];
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.isDying) continue;
    const d = sub(e.pos, p.pos);
    const rx = clamp(dot(d, p.basis.right) / radarRange, -1, 1);
    const rz = clamp(-dot(d, p.basis.forward) / radarRange, -1, 1);
    radarBlips.push({
      x: rx,
      z: rz,
      kind: e.kind,
      locked: e.id === state.lockTargetId,
    });
  }

  return {
    phase: state.phase,
    hp: Math.round(p.hp),
    maxHp: p.maxHp,
    boost: Math.round(p.boost),
    speed: Math.round(p.speed * 9.5),
    altitude: alt,
    score: state.score,
    bestScore: Math.max(state.bestScore, state.score),
    wave: state.wave,
    kills: state.kills,
    accuracy: state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0,
    missileReadyPct:
      p.missileCooldown <= 0
        ? 100
        : Math.round((1 - p.missileCooldown / p.maxMissileCooldown) * 100),
    lockTargetKind: lockEnemy ? lockEnemy.kind : null,
    lockProgress: state.lockProgress,
    lockDistance: lockEnemy ? Math.round(length(sub(lockEnemy.pos, p.pos))) : null,
    incomingWarning: state.incomingWarning,
    enemiesRemaining: state.enemies.filter((e) => !e.isDying).length,
    waveBannerTimer: state.waveBannerTimer,
    radarBlips,
    cameraMode: state.cameraMode,
  };
}

/**
 * Render the active 3D scene (title showcase or active dogfight) into an AsciiBuffer.
 */
export function renderSimulationToBuffer(state: GameState, buf: AsciiBuffer): void {
  buf.clear();

  if (state.phase === 'title') {
    renderTitleShowcase(state, buf);
    return;
  }

  // Camera shake offset from trauma^2
  const shakeMag = state.shakeTrauma * state.shakeTrauma * 1.4;
  const shakeOffset: Vec3 =
    shakeMag > 0.01
      ? {
          x: Math.sin(state.time * 53) * shakeMag,
          y: Math.cos(state.time * 67) * shakeMag,
          z: 0,
        }
      : { x: 0, y: 0, z: 0 };

  const boostFovKick = state.player.speed > 62 ? -0.1 : 0;
  const cam: Camera3D = {
    pos: add(state.cameraPos, shakeOffset),
    basis: state.cameraBasis,
    fovScale: 1.18 + boostFovKick,
    charAspect: 0.56,
  };

  renderSkyMarkers(buf, cam);
  renderTerrainGrid(buf, cam);

  // Render Player aircraft in Chase mode
  if (state.cameraMode === 'chase') {
    const p = state.player;
    const visualBasis = rotateBasisLocal(p.basis, p.visualPitch, 0, p.visualRoll);
    renderMesh(buf, PLAYER_JET_MESH, p.pos, visualBasis, cam, {
      scale: 0.95,
      isEnemy: false,
      hitFlash: p.hitFlashTimer > 0,
    });
  }

  // Render Enemies
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    const mesh =
      e.kind === 'heavy' ? HEAVY_MESH : e.kind === 'ace' ? ACE_MESH : SCOUT_MESH;
    renderMesh(buf, mesh, e.pos, e.basis, cam, {
      scale: e.kind === 'heavy' ? 1.2 : 1.05,
      isEnemy: true,
      hitFlash: e.hitFlashTimer > 0,
    });

    // World-to-screen target marker / telegraph / off-screen directional chevrons
    const proj = projectWorldPoint(e.pos, cam, buf.cols, buf.rows, 0.8);
    const dist = Math.round(length(sub(e.pos, state.player.pos)));

    if (proj.visible && proj.x >= 2 && proj.x < buf.cols - 2 && proj.y >= 2 && proj.y < buf.rows - 2) {
      const isLocked = e.id === state.lockTargetId;
      const sx = Math.round(proj.x);
      const sy = Math.round(proj.y);

      if (e.windupTimer > 0) {
        buf.drawText(sx - 4, sy - 2, '[! LOCK]', AsciiColor.Alert);
      } else if (isLocked) {
        const lockedFull = state.lockProgress >= 0.99;
        const col = lockedFull ? AsciiColor.Alert : AsciiColor.Amber;
        buf.plotHud(sx - 3, sy - 1, '+', col);
        buf.plotHud(sx + 3, sy - 1, '+', col);
        buf.plotHud(sx - 3, sy + 1, '+', col);
        buf.plotHud(sx + 3, sy + 1, '+', col);
        buf.drawText(sx - 3, sy + 2, `${dist}m`, col);
      } else if (!e.isDying) {
        buf.plotHud(sx - 2, sy, '[', AsciiColor.Amber);
        buf.plotHud(sx + 2, sy, ']', AsciiColor.Amber);
      }
    } else if (!e.isDying) {
      // Off-screen directional edge chevron
      const toE = normalize(sub(e.pos, cam.pos));
      const rx = dot(toE, cam.basis.right);
      const ry = dot(toE, cam.basis.up);
      const ex = clamp(Math.round(buf.cols * 0.5 + rx * buf.cols * 0.46), 2, buf.cols - 3);
      const ey = clamp(Math.round(buf.rows * 0.5 - ry * buf.rows * 0.44), 2, buf.rows - 3);
      const ch = Math.abs(rx) > Math.abs(ry) ? (rx > 0 ? '>' : '<') : ry > 0 ? '^' : 'v';
      buf.plotHud(ex, ey, ch, e.windupTimer > 0 ? AsciiColor.Alert : AsciiColor.Amber);
    }
  }

  // Render Projectiles
  for (let i = 0; i < state.projectiles.length; i++) {
    const pr = state.projectiles[i];
    if (!pr.active) continue;
    const pHead = projectWorldPoint(pr.pos, cam, buf.cols, buf.rows, 0.8);
    if (!pHead.visible) continue;
    if (pr.isMissile) {
      buf.plot(pHead.x, pHead.y, pHead.z, 'M', AsciiColor.Highlight);
    } else if (pr.fromPlayer) {
      const tailPos = sub(pr.pos, scale(normalize(pr.vel), 6.5));
      const pTail = projectWorldPoint(tailPos, cam, buf.cols, buf.rows, 0.8);
      if (pTail.visible) {
        buf.drawLine(pTail.x, pTail.y, pTail.z, pHead.x, pHead.y, pHead.z, AsciiColor.Highlight, '*');
      } else {
        buf.plot(pHead.x, pHead.y, pHead.z, '*', AsciiColor.Highlight);
      }
    } else {
      buf.plot(pHead.x, pHead.y, pHead.z, 'o', AsciiColor.Alert);
    }
  }

  // Render Particles
  for (let i = 0; i < state.particles.length; i++) {
    const pt = state.particles[i];
    if (!pt.active) continue;
    const proj = projectWorldPoint(pt.pos, cam, buf.cols, buf.rows, 0.8);
    if (proj.visible) {
      buf.plot(proj.x, proj.y, proj.z, pt.ch, pt.color);
    }
  }

  renderFlightHorizonHud(buf, state.player.basis, state.cameraMode === 'cockpit');
}

function renderTitleShowcase(state: GameState, buf: AsciiBuffer): void {
  const angle = state.titleSpinAngle;
  const camRadius = 11.2;
  const camPos: Vec3 = {
    x: Math.sin(angle) * camRadius,
    y: 3.4 + Math.sin(angle * 0.7) * 0.7,
    z: Math.cos(angle) * camRadius,
  };
  const centerBasis = basisFromForward(sub({ x: 0, y: 0, z: 0 }, camPos));
  // Shift look target left along camera right vector so the 3D jet frames cleanly on the right 55%
  const offsetTarget = sub({ x: 0, y: -0.2, z: 0 }, scale(centerBasis.right, 3.3));
  const cam: Camera3D = {
    pos: camPos,
    basis: basisFromForward(sub(offsetTarget, camPos)),
    fovScale: 1.32,
    charAspect: 0.56,
  };

  renderSkyMarkers(buf, cam);
  // Subtle rotating ground grid beneath showcase jet
  const floorCam: Camera3D = {
    pos: { x: camPos.x * 4, y: 42, z: camPos.z * 4 },
    basis: cam.basis,
    fovScale: 1.2,
    charAspect: 0.56,
  };
  renderTerrainGrid(buf, floorCam);

  const jetBasis = rotateBasisLocal(defaultBasis(), 0.08 * Math.sin(angle * 2), 0, 0.22 * Math.cos(angle));
  renderMesh(buf, PLAYER_JET_MESH, { x: 0, y: 0, z: 0 }, jetBasis, cam, {
    scale: 1.15,
    isEnemy: false,
  });
}
