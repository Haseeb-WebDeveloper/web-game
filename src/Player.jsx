import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { latLon, PLANET_R } from './planet.js'
import { updateNear, isDialogueActive, collectNear, questStore } from './questStore.js'
import { toToon } from './World.jsx'
import { footstep, initAudioOnGesture, pickup } from './audio.js'
import { touchState } from './TouchControls.jsx'
import { playerPos } from './playerPos.js'

// --- Movement tuning ---
// Human-believable speeds: the Mixamo clips were captured at natural pace,
// so game speed must stay close to animation speed or the feet look frantic.
const WALK_SPEED = 3.0
const RUN_SPEED = 6.4
const ACCEL = 13              // gentle ramp-up (~0.4s to full speed)
const BRAKE = 7               // eased stop
// Auto-run: no key to remember. Keep moving and she eases from a walk into a
// run on her own; stopping or a hard turn drops her back to a walk.
const RUN_DELAY = 0.9         // seconds at walking pace before she speeds up
const RUN_RAMP = 1.1          // seconds to blend from walk to full run
const GRAVITY = 30
const JUMP_SPEED = 8.5
const SUBSTEPS = 3            // physics steps per frame — keeps collision stable
const STEP_HEIGHT = 0.6       // auto-climb curbs/ledges/floor seams up to this tall (no jump)

// --- Character capsule ---
const CAPS_RADIUS = 0.32
const CAPS_HEIGHT = 1.65

// --- Camera tuning ---
const CAM_BACK = 6.6
const CAM_PITCH = 0.3   // rest pitch: high vantage so the ground ahead reads past the curve
const CAM_FOV = 45    // narrower lens = flatter horizon, the reference's framing
const CAM_RUN_FOV = 52

// Actual radius of the spawn pavement, measured once the collider exists.
// IntroCamera reads this so the dive ends on the exact in-game camera pose.
export const spawnGround = { r: PLANET_R + 1.2 }

export default function Player({ collidersRef }) {
  const group = useRef()
  const { camera, gl } = useThree()

  // The Messaggera — Hunyuan body auto-rigged on Mixamo. Her GLB carries no
  // clips: the original messaggera.glb animations are retargeted onto her
  // skeleton at load (same trick as the NPCs — only the bone prefix differs).
  const { scene: charScene } = useGLTF('/main-character.glb?v=1')
  const { animations } = useGLTF('/messaggera.glb?v=5')
  // This rig's bone prefix. three.js strips ':' from node names at load,
  // so 'mixamorig:Hips' arrives as 'mixamorigHips' — prefixes are colon-free.
  const prefix = useMemo(() => {
    let p = 'mixamorig'
    charScene.traverse((o) => {
      if (o.isBone && /Hips$/.test(o.name)) p = o.name.slice(0, -4)
    })
    return p
  }, [charScene])
  const mixer = useMemo(() => {
    const m = new THREE.AnimationMixer(charScene)
    // Clips were exported from a 60fps Blender scene but authored at 30fps —
    // halving the mixer clock restores their true speed.
    m.timeScale = 0.5
    return m
  }, [charScene])
  const actions = useMemo(() => {
    const map = {}
    for (const clip of animations) {
      // Retarget: swap the bone prefix onto her skeleton, and strip hip
      // POSITION tracks (root motion) — physics moves her through the world.
      const c = clip.clone()
      c.tracks = c.tracks
        .filter((t) => !/Hips\.position$/i.test(t.name))
        .map((t) => {
          const tt = t.clone()
          tt.name = tt.name.replace(/^mixamorig\d*/, prefix)
          return tt
        })
      map[c.name] = mixer.clipAction(c)
    }
    if (map.Jump) {
      map.Jump.setLoop(THREE.LoopOnce, 1)
      map.Jump.clampWhenFinished = true   // hold the last jump pose until landing
    }
    return map
  }, [animations, mixer, prefix])
  useEffect(() => {
    charScene.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true
        c.frustumCulled = false
        if (c.material) c.material.side = THREE.DoubleSide
        toToon(c)   // anime cel look, matching the world
      }
    })
  }, [charScene])

  // Unlockable outfits: swap the body material's diffuse texture
  const lookRef = useRef({ applied: 0, tex: {} })
  const applyLook = (look) => {
    const LOOK_URLS = { 1: '/look-aurea.jpg', 2: '/look-notte.jpg' }
    charScene.traverse((c) => {
      if (!c.isMesh || !c.material || !/body/i.test(c.material.name)) return
      const cache = lookRef.current.tex
      if (!cache[0]) cache[0] = c.material.map   // remember the original
      if (look > 0 && !cache[look]) {
        const t = new THREE.TextureLoader().load(LOOK_URLS[look])
        t.flipY = false                          // GLTF texture convention
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 8
        if (cache[0]) { t.wrapS = cache[0].wrapS; t.wrapT = cache[0].wrapT }
        cache[look] = t
      }
      c.material.map = cache[look] || cache[0]
      c.material.needsUpdate = true
    })
  }

  const keys = useRef({})
  const state = useMemo(() => ({
    pos: latLon(33, 85, PLANET_R + 1.2),
    vel: new THREE.Vector3(),
    facing: new THREE.Vector3(),
    camFwd: new THREE.Vector3(),   // camera view direction — INDEPENDENT of character facing
    lookPos: new THREE.Vector3(),
    yawInput: 0,
    orbitPitch: CAM_PITCH,
    lastOrbitAt: 0,
    grounded: false,
    wasGrounded: false,
    groundNormal: new THREE.Vector3(),   // contact normal of whatever she stands on
    jumpQueued: false,
    anim: '',
    airTime: 0,        // continuous seconds without ground contact
    speed: 0,
    moveTime: 0,       // how long she's been continuously moving (drives auto-run)
    walkPhase: 0,
    camInit: false,
    raycaster: new THREE.Raycaster(),
    tmp: {
      seg: new THREE.Line3(),
      box: new THREE.Box3(),
      triPoint: new THREE.Vector3(),
      capPoint: new THREE.Vector3(),
      v1: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      v3: new THREE.Vector3(),
      v4: new THREE.Vector3(),
      v5: new THREE.Vector3(),
      v6: new THREE.Vector3(),
      v7: new THREE.Vector3(),
      v8: new THREE.Vector3(),
      seg2: new THREE.Line3(),
      box2: new THREE.Box3(),
      q: new THREE.Quaternion(),
    },
  }), [])

  // Keyboard + mouse-orbit input
  useEffect(() => {
    const down = (e) => {
      keys.current[e.code] = true
      initAudioOnGesture()   // browsers unlock audio on first interaction
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) state.jumpQueued = true
      }
    }
    const up = (e) => { keys.current[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)

    const el = gl.domElement
    const drag = { active: false, x: 0, y: 0 }
    const pd = (e) => { drag.active = true; drag.x = e.clientX; drag.y = e.clientY }
    const pm = (e) => {
      if (!drag.active) return
      state.yawInput += (e.clientX - drag.x)
      state.orbitPitch = THREE.MathUtils.clamp(state.orbitPitch + (e.clientY - drag.y) * 0.004, 0.15, 1.2)
      drag.x = e.clientX; drag.y = e.clientY
      state.lastOrbitAt = performance.now()
    }
    const pu = () => { drag.active = false }
    el.addEventListener('pointerdown', pd)
    window.addEventListener('pointermove', pm)
    window.addEventListener('pointerup', pu)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      el.removeEventListener('pointerdown', pd)
      window.removeEventListener('pointermove', pm)
      window.removeEventListener('pointerup', pu)
    }
  }, [gl, state])

  // Push the capsule out of any geometry it penetrates (BVH shapecast)
  function resolveCapsule(collider, up) {
    const { seg, box, triPoint, capPoint } = state.tmp
    seg.start.copy(state.pos).addScaledVector(up, CAPS_RADIUS)
    seg.end.copy(state.pos).addScaledVector(up, CAPS_HEIGHT - CAPS_RADIUS)
    box.makeEmpty()
    box.expandByPoint(seg.start)
    box.expandByPoint(seg.end)
    box.min.addScalar(-CAPS_RADIUS)
    box.max.addScalar(CAPS_RADIUS)

    collider.geometry.boundsTree.shapecast({
      intersectsBounds: (b) => b.intersectsBox(box),
      intersectsTriangle: (tri) => {
        const dist = tri.closestPointToSegment(seg, triPoint, capPoint)
        if (dist < CAPS_RADIUS) {
          const depth = CAPS_RADIUS - dist
          const dir = capPoint.sub(triPoint).normalize()
          seg.start.addScaledVector(dir, depth)
          seg.end.addScaledVector(dir, depth)
        }
      },
    })

    const newPos = state.tmp.v1.copy(seg.start).addScaledVector(up, -CAPS_RADIUS)
    const delta = state.tmp.v2.copy(newPos).sub(state.pos)
    if (delta.lengthSq() > 1e-10) {
      const dn = delta.normalize()
      const into = state.vel.dot(dn)
      if (into < 0) state.vel.addScaledVector(dn, -into)   // slide along the surface
      if (dn.dot(up) > 0.3) {
        state.grounded = true
        state.groundNormal.copy(dn)
      } else if (into < -0.01) {
        state.wallHit = true   // shoved sideways against a steep face she was moving into
      }
      state.pos.copy(newPos)
    }
  }

  // Push a capsule centred at `p` out of the collider — PURE: no velocity/grounded
  // side effects. Writes the resolved centre back into `p`; writes the push vector
  // (resolved - original) into `outPush`. Used by the step-up probe.
  function depenetrate(collider, p, up, outPush) {
    const { seg2, box2, triPoint, capPoint, v3 } = state.tmp
    v3.copy(p)   // remember the pre-resolve centre
    seg2.start.copy(p).addScaledVector(up, CAPS_RADIUS)
    seg2.end.copy(p).addScaledVector(up, CAPS_HEIGHT - CAPS_RADIUS)
    box2.makeEmpty()
    box2.expandByPoint(seg2.start)
    box2.expandByPoint(seg2.end)
    box2.min.addScalar(-CAPS_RADIUS)
    box2.max.addScalar(CAPS_RADIUS)
    collider.geometry.boundsTree.shapecast({
      intersectsBounds: (b) => b.intersectsBox(box2),
      intersectsTriangle: (tri) => {
        const dist = tri.closestPointToSegment(seg2, triPoint, capPoint)
        if (dist < CAPS_RADIUS) {
          const depth = CAPS_RADIUS - dist
          const dir = capPoint.sub(triPoint).normalize()
          seg2.start.addScaledVector(dir, depth)
          seg2.end.addScaledVector(dir, depth)
        }
      },
    })
    p.copy(seg2.start).addScaledVector(up, -CAPS_RADIUS)   // resolved centre
    if (outPush) outPush.copy(p).sub(v3)
  }

  // When grounded movement is blocked by a low ledge (curb, tile seam, step), climb
  // it the way a real leg would: lift up by STEP_HEIGHT, move forward, drop back down
  // onto the surface. Returns true (and relocates state.pos) only for a genuine small
  // step — a real wall, a gap, or too-high a ledge all bail out.
  function tryStepUp(collider, startPos, up, moveVec) {
    const probe = state.tmp.v4
    const push = state.tmp.v5

    // 1) lift straight up from the pre-move position
    probe.copy(startPos).addScaledVector(up, STEP_HEIGHT)
    depenetrate(collider, probe, up, push)

    // 2) advance by the blocked horizontal move at the raised height
    probe.add(moveVec)
    depenetrate(collider, probe, up, push)
    const pu = push.dot(up)
    const horizSq = push.lengthSq() - pu * pu
    if (horizSq > (STEP_HEIGHT * 0.5) * (STEP_HEIGHT * 0.5)) return false  // wall, not a step

    // 3) drop back down onto the step top
    probe.addScaledVector(up, -(STEP_HEIGHT + 0.05))
    depenetrate(collider, probe, up, push)
    if (push.dot(up) < 0.1) return false   // nothing solid underfoot → a gap, don't step into air

    // accept only a genuine small climb (not a teleport up a wall, not a drop)
    const climbUp = (probe.x - startPos.x) * up.x + (probe.y - startPos.y) * up.y + (probe.z - startPos.z) * up.z
    if (climbUp > STEP_HEIGHT + 0.05 || climbUp < -0.02) return false

    state.pos.copy(probe)
    state.grounded = true
    state.groundNormal.copy(up)
    return true
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    mixer.update(dt)   // drive the animations directly

    const look = questStore.get().look || 0
    if (look !== lookRef.current.applied) {
      lookRef.current.applied = look
      applyLook(look)
    }

    // During the intro/ending the camera belongs elsewhere; she just stands
    if (questStore.get().ending || questStore.get().intro) {
      // Settle her onto the actual pavement while the intro plays, so gameplay
      // starts with her already standing — no drop, no Fall animation.
      if (!state.spawnSnapped && collidersRef.current) {
        const up = state.pos.clone().normalize()
        state.raycaster.set(state.pos.clone().addScaledVector(up, 6), up.clone().negate())
        state.raycaster.far = 14
        state.raycaster.firstHitOnly = true
        const hits = state.raycaster.intersectObject(collidersRef.current, false)
        if (hits.length > 0) {
          state.pos.copy(hits[0].point).addScaledVector(up, 0.02)
          spawnGround.r = state.pos.length()
          state.spawnSnapped = true
        }
      }
      if (state.anim !== 'Idle' && actions.Idle) {
        const prev = actions[state.anim]
        if (prev) prev.fadeOut(0.3)
        actions.Idle.reset().fadeIn(0.3).play()
        state.anim = 'Idle'
      }
      // Place her on the spawn square NOW so the intro dive lands on a character
      // that's already standing there — otherwise the mesh sits at the origin
      // and pops into place on the first gameplay frame.
      if (group.current) {
        const up = state.pos.clone().normalize()
        if (state.facing.lengthSq() === 0) {
          state.facing.set(0, 1, 0).cross(up).normalize()
          state.camFwd.copy(state.facing)
        }
        group.current.position.copy(state.pos)
        const yAxis = up
        const zAxis = state.facing.clone()
        const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()
        group.current.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
        )
      }
      return
    }

    const collider = collidersRef.current
    if (!collider || !group.current) return

    const up = state.tmp.v1.copy(state.pos).normalize().clone()

    if (state.facing.lengthSq() === 0) {
      state.facing.set(0, 1, 0).cross(up).normalize()
      state.camFwd.copy(state.facing)
    }

    // Keep the camera direction tangent to the sphere, then apply mouse orbit
    state.camFwd.sub(up.clone().multiplyScalar(state.camFwd.dot(up))).normalize()
    if (state.yawInput !== 0) {
      state.camFwd.applyQuaternion(state.tmp.q.setFromAxisAngle(up, -state.yawInput * 0.006))
      state.yawInput = 0
    }

    // --- INPUT: keyboard + analog thumbstick ---
    const k = keys.current
    let inY = (k.KeyW || k.ArrowUp ? 1 : 0) + (k.KeyS || k.ArrowDown ? -1 : 0)
    let inX = (k.KeyD || k.ArrowRight ? 1 : 0) + (k.KeyA || k.ArrowLeft ? -1 : 0)
    inX += touchState.x
    inY += touchState.y
    const isMoving = Math.abs(inX) > 0.08 || Math.abs(inY) > 0.08
    if (touchState.jump) { touchState.jump = false; state.jumpQueued = true }

    // Controls are relative to the STABLE camera direction — they never shift mid-walk
    let wish = null
    let inputMag = 1
    if (isMoving) {
      const fwd = state.camFwd.clone()
      const right = new THREE.Vector3().crossVectors(fwd, up)
      wish = fwd.multiplyScalar(inY).add(right.multiplyScalar(inX))
      inputMag = Math.min(1, wish.length())
      wish.normalize()
    }

    // --- AUTO-RUN: continuous movement eases walk -> run, no key needed ---
    if (isMoving && state.wasGrounded) {
      // a hard turn or reversal breaks her stride and resets her to a walk
      if (wish && state.facing.lengthSq() > 0 && wish.dot(state.facing) < 0.2) state.moveTime = 0
      state.moveTime += dt
    } else {
      state.moveTime = 0
    }
    // optional instant sprint — held touch button, or Shift for keyboard users
    if (touchState.run || k.ShiftLeft || k.ShiftRight) state.moveTime = RUN_DELAY + RUN_RAMP
    const runT = THREE.MathUtils.clamp((state.moveTime - RUN_DELAY) / RUN_RAMP, 0, 1)
    const runEase = runT * runT * (3 - 2 * runT)   // smoothstep: walk -> run
    const running = runEase > 0.5

    // --- JUMP ---
    if (state.jumpQueued) {
      if (state.wasGrounded) {
        state.vel.addScaledVector(up, JUMP_SPEED)
        state.jumpedThisFrame = true
      }
      state.jumpQueued = false
    }

    // --- PHYSICS (substepped) ---
    const groundedPrev = state.wasGrounded
    state.grounded = false
    const maxSpeed = (WALK_SPEED + (RUN_SPEED - WALK_SPEED) * runEase) * inputMag
    for (let i = 0; i < SUBSTEPS; i++) {
      const h = dt / SUBSTEPS
      const upN = state.pos.clone().normalize()

      // On the ground, movement is relative to the SURFACE contact normal, not
      // the sphere radial — so walking up a bridge ramp or a hillside follows
      // the slope instead of ramming into it and bleeding all the speed.
      // Steeper than ~57° still counts as a wall; a fresh jump keeps radial.
      const onGround = groundedPrev || state.grounded
      const launching = state.vel.dot(upN) > 0.5
      let nrm = upN
      if (onGround && !launching &&
          state.groundNormal.lengthSq() > 0.5 && state.groundNormal.dot(upN) > 0.55) {
        nrm = state.groundNormal.clone()
      }

      // split velocity into normal (gravity/stick) and tangent (movement)
      const radial = nrm.clone().multiplyScalar(state.vel.dot(nrm))
      const tangent = state.vel.clone().sub(radial)

      if (wish) {
        // steer along the slope surface
        const wishS = wish.clone().sub(nrm.clone().multiplyScalar(wish.dot(nrm))).normalize()
        tangent.addScaledVector(wishS, ACCEL * h)
        if (tangent.length() > maxSpeed) tangent.setLength(maxSpeed)
      } else {
        tangent.multiplyScalar(Math.exp(-BRAKE * h))
        // static friction: when standing on ground with no input, come to a TRUE stop
        if (onGround && tangent.length() < 0.35) tangent.set(0, 0, 0)
      }

      // While grounded: a gentle "stick" to the surface instead of full gravity —
      // full gravity on a slope converts into a downhill slide via the collision
      // push-out, which caused the stop-drift and made the bridge unclimbable.
      if (onGround && state.vel.dot(upN) <= 0.01) {
        radial.copy(nrm).multiplyScalar(-0.6)   // gentle — strong stick leaks sideways on slopes
      } else {
        radial.addScaledVector(upN, -GRAVITY * h)
      }

      state.vel.copy(tangent).add(radial)
      const stepStart = state.tmp.v6.copy(state.pos)
      const intended = state.tmp.v7.copy(state.vel).multiplyScalar(h)
      state.wallHit = false
      state.pos.addScaledVector(state.vel, h)
      resolveCapsule(collider, upN)   // flags state.wallHit when shoved against a steep face

      // STEP-UP: whenever a steep face blocked her while grounded (even a glancing
      // diagonal hit against a curb/tile edge), try to climb it. tryStepUp bails on
      // real walls, gaps, and too-tall ledges, so only genuine small steps go through.
      if (wish && !state.jumpedThisFrame && state.wallHit && (groundedPrev || state.grounded)) {
        intended.addScaledVector(upN, -intended.dot(upN))   // horizontal attempted move
        if (intended.lengthSq() > 1e-6 && tryStepUp(collider, stepStart, upN, intended)) {
          state.vel.copy(tangent).addScaledVector(upN, state.vel.dot(upN))  // keep momentum onto the step
        }
      }
    }

    state.wasGrounded = state.grounded
    playerPos.copy(state.pos)   // publish for ambient life (pigeons scatter, etc.)

    const upNow = state.pos.clone().normalize()
    const radialNow = upNow.clone().multiplyScalar(state.vel.dot(upNow))
    state.speed = state.tmp.v2.copy(state.vel).sub(radialNow).length()

    // --- FACING: turn toward movement with a smooth cap ---
    if (wish) {
      const moveDir = wish.clone()
      if (state.facing.dot(moveDir) < -0.95) {
        moveDir.add(new THREE.Vector3().crossVectors(upNow, moveDir).multiplyScalar(0.3))
      }
      state.facing.lerp(moveDir, 1 - Math.exp(-9 * dt))
      if (state.facing.lengthSq() < 0.01) state.facing.copy(moveDir)
    }
    state.facing.sub(upNow.clone().multiplyScalar(state.facing.dot(upNow))).normalize()

    // --- ANIMATION STATE MACHINE: pick the right clip, crossfade into it ---
    // Grace period: bumps and curb edges drop ground contact for a frame or
    // two — without it the clip flashes Fall/Idle mid-stride and reads as a
    // stutter. Only a REAL fall (>0.12s airborne) switches the animation.
    if (state.wasGrounded) state.airTime = 0
    else state.airTime += dt
    const inDialogue = isDialogueActive()
    let desired
    if (!state.wasGrounded && (state.airTime > 0.12 || state.anim === 'Jump')) {
      // Jump plays once and holds; if we're airborne longer, blend to Fall
      desired = state.anim === 'Jump' && actions.Jump?.isRunning() ? 'Jump' : 'Fall'
    } else if (inDialogue && state.speed < 0.4) {
      desired = 'Talk'
    } else if (state.speed > 0.4 || (isMoving && state.wasGrounded)) {
      desired = state.speed > (WALK_SPEED + RUN_SPEED) / 2 ? 'Run' : 'Walk'
    } else {
      desired = 'Idle'
    }
    if (state.jumpedThisFrame && actions.Jump) desired = 'Jump'

    if (desired !== state.anim && actions[desired]) {
      const prev = actions[state.anim]
      if (prev) prev.fadeOut(0.3)
      actions[desired].reset().fadeIn(0.3).play()
      state.anim = desired
    }
    // Sync animation playback speed to actual movement speed
    // (Mixamo walk covers ~1.5 m/s, run ~4.5 m/s at natural playback)
    if (state.anim === 'Walk' && actions.Walk) actions.Walk.timeScale = Math.max(0.6, state.speed / 1.5)
    if (state.anim === 'Run' && actions.Run) actions.Run.timeScale = Math.max(0.7, state.speed / 4.5)
    state.jumpedThisFrame = false

    // --- QUEST ZONES: tell the quest engine where we are ---
    updateNear(state.pos)
    if (collectNear(state.pos)) pickup()

    // --- APPLY to character mesh ---
    group.current.position.copy(state.pos)
    const zAxis = state.facing.clone()
    const yAxis = upNow.clone()
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()
    group.current.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis))

    // --- CAMERA: independent view direction with "lazy follow" ---
    // The camera NEVER swings because the character turned. It only rotates from:
    //  (a) the mouse, (b) a slow drift toward the direction of travel when moving
    //      sideways — and NOT AT ALL when walking toward the camera.
    state.camFwd.sub(upNow.clone().multiplyScalar(state.camFwd.dot(upNow))).normalize()
    if (state.speed > 0.5 && performance.now() - state.lastOrbitAt > 800) {
      const velDir = state.vel.clone()
        .sub(upNow.clone().multiplyScalar(state.vel.dot(upNow))).normalize()
      const lateral = state.tmp.v1.crossVectors(state.camFwd, velDir).dot(upNow)
      // dead-zone: ignore tiny zigzags from terrain facets — only follow real turns
      if (Math.abs(lateral) > 0.25) {
        const drift = lateral * 1.6 * dt * Math.min(state.speed / WALK_SPEED, 1)
        state.camFwd.applyQuaternion(state.tmp.q.setFromAxisAngle(upNow, drift))
      }
      state.orbitPitch += (CAM_PITCH - state.orbitPitch) * (1 - Math.exp(-1.2 * dt))
    }

    const head = state.pos.clone().addScaledVector(upNow, 1.5)
    let camTarget = state.pos.clone()
      .addScaledVector(state.camFwd, -CAM_BACK * Math.cos(state.orbitPitch))
      .addScaledVector(upNow, 1.1 + CAM_BACK * Math.sin(state.orbitPitch))

    // camera collision: never clip through walls
    const toCam = camTarget.clone().sub(head)
    const camDist = toCam.length()
    toCam.normalize()
    state.raycaster.set(head, toCam)
    state.raycaster.far = camDist
    state.raycaster.firstHitOnly = true
    const hits = state.raycaster.intersectObject(collider, false)
    if (hits.length > 0) {
      camTarget = head.clone().addScaledVector(toCam, Math.max(0.5, hits[0].distance - 0.3))
    }

    // Look at a point on the ground AHEAD of her, not at her chest — the
    // downward gaze pushes the horizon far out so the road ahead is readable.
    const lookTarget = state.pos.clone()
      .addScaledVector(upNow, 0.85)
      .addScaledVector(state.camFwd, 2.6)
    if (!state.camInit) {
      camera.position.copy(camTarget)
      state.lookPos.copy(lookTarget)
      state.camInit = true
    } else {
      camera.position.lerp(camTarget, 1 - Math.exp(-12 * dt))
      state.lookPos.lerp(lookTarget, 1 - Math.exp(-16 * dt))
    }
    camera.up.copy(upNow)
    camera.lookAt(state.lookPos)

    // FOV: gentle push-in during a moment bloom, kick out when running
    const blooming = !!questStore.get().bloom
    const targetFov = blooming ? 37 : running && isMoving ? CAM_RUN_FOV : CAM_FOV
    camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-5 * dt))
    camera.updateProjectionMatrix()

    // --- FOOTSTEPS: one per stride while grounded and moving ---
    if (state.wasGrounded && state.speed > 0.6) {
      state.stepAcc = (state.stepAcc || 0) + dt * state.speed / 0.85
      if (state.stepAcc >= 1) {
        state.stepAcc %= 1
        footstep(state.speed > 4)
      }
    } else {
      state.stepAcc = 0.5
    }
  })

  return (
    <group ref={group}>
      <primitive object={charScene} />
    </group>
  )
}

useGLTF.preload('/messaggera.glb?v=5')   // still the animation source
useGLTF.preload('/main-character.glb?v=1')
