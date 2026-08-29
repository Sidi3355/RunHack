import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import type { MetricKey, PoseFrame, PoseSequence } from '../types'
import { LM, METRIC_JOINTS, SKELETON_EDGES } from '../types'

/** world landmarks are y-down; flip into three.js y-up space */
function toVec(p: { x: number; y: number; z: number }): [number, number, number] {
  return [p.x, -p.y, -p.z]
}

/**
 * "Illustrative coaching cue" ghost: shifts the feet horizontally toward the
 * hips to indicate the direction of correction. Not a biomechanical model.
 */
function ghostFrame(frame: PoseFrame): PoseFrame {
  const world = frame.world.map((p) => ({ ...p }))
  for (const [hipI, ids] of [
    [LM.leftHip, [LM.leftAnkle, LM.leftHeel, LM.leftFoot, LM.leftKnee]],
    [LM.rightHip, [LM.rightAnkle, LM.rightHeel, LM.rightFoot, LM.rightKnee]],
  ] as [number, number[]][]) {
    const hipX = world[hipI].x
    for (const i of ids) {
      const factor = i === LM.leftKnee || i === LM.rightKnee ? 0.2 : 0.45
      world[i].x = world[i].x + (hipX - world[i].x) * factor
    }
  }
  return { ...frame, world }
}

function Skeleton({
  frame,
  color,
  emphasis,
  opacity = 1,
}: {
  frame: PoseFrame
  color: string
  emphasis: Set<number> | null
  opacity?: number
}) {
  const bones = useMemo(() => SKELETON_EDGES, [])
  return (
    <group>
      {frame.world.map((p, i) => {
        if (i > 0 && i < 11) return null // skip face detail landmarks
        const isHead = i === 0
        const emphasised = emphasis?.has(i)
        return (
          <mesh key={i} position={toVec(p)}>
            <sphereGeometry args={[isHead ? 0.07 : emphasised ? 0.045 : 0.028, 16, 16]} />
            <meshStandardMaterial
              color={emphasised ? '#22d3ee' : color}
              emissive={emphasised ? '#22d3ee' : color}
              emissiveIntensity={emphasised ? 0.9 : 0.35}
              transparent={opacity < 1}
              opacity={opacity}
            />
          </mesh>
        )
      })}
      {bones.map(([a, b], idx) => {
        const pa = new THREE.Vector3(...toVec(frame.world[a]))
        const pb = new THREE.Vector3(...toVec(frame.world[b]))
        const mid = pa.clone().add(pb).multiplyScalar(0.5)
        const dir = pb.clone().sub(pa)
        const len = dir.length()
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.clone().normalize(),
        )
        const emphasised = emphasis && emphasis.has(a) && emphasis.has(b)
        return (
          <mesh key={idx} position={mid} quaternion={quat}>
            <cylinderGeometry args={[0.014, 0.014, len, 8]} />
            <meshStandardMaterial
              color={emphasised ? '#22d3ee' : color}
              emissive={emphasised ? '#22d3ee' : color}
              emissiveIntensity={emphasised ? 0.8 : 0.25}
              transparent={opacity < 1}
              opacity={opacity}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function AnimatedTwin({
  sequence,
  playing,
  timeRef,
  onTime,
  highlight,
  showGhost,
}: {
  sequence: PoseSequence
  playing: boolean
  timeRef: React.MutableRefObject<number>
  onTime: (t: number) => void
  highlight: MetricKey | null
  showGhost: boolean
}) {
  const [, force] = useState(0)
  useFrame((_, delta) => {
    if (playing) {
      timeRef.current = (timeRef.current + delta) % sequence.duration
      onTime(timeRef.current)
    }
    force((n) => n + 1)
  })
  const frames = sequence.frames
  const t = timeRef.current
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (frames[m].t < t) lo = m + 1
    else hi = m
  }
  const frame = frames[Math.max(0, lo)]
  const emphasis = highlight ? new Set(METRIC_JOINTS[highlight]) : null
  return (
    <group position={[0, 1.05, 0]}>
      <Skeleton frame={frame} color="#c4b5fd" emphasis={emphasis} />
      {showGhost && <Skeleton frame={ghostFrame(frame)} color="#34d399" emphasis={null} opacity={0.35} />}
    </group>
  )
}

export default function Twin3D({
  sequence,
  highlight,
  showGhost,
}: {
  sequence: PoseSequence
  highlight: MetricKey | null
  showGhost: boolean
}) {
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(0)
  const timeRef = useRef(0)

  return (
    <div className="rounded-2xl overflow-hidden border border-line bg-panel">
      <div className="h-[46vh] min-h-[300px] touch-none">
        <Canvas camera={{ position: [1.9, 1.3, 2.6], fov: 45 }}>
          <color attach="background" args={['#0b0b18']} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 2]} intensity={1.2} />
          <Suspense fallback={null}>
            <AnimatedTwin
              sequence={sequence}
              playing={playing}
              timeRef={timeRef}
              onTime={setTime}
              highlight={highlight}
              showGhost={showGhost}
            />
            <Grid
              position={[0, 0, 0]}
              args={[10, 10]}
              cellColor="#26263c"
              sectionColor="#3b3b5c"
              fadeDistance={8}
              infiniteGrid
            />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={1.2} maxDistance={6} target={[0, 1, 0]} />
        </Canvas>
      </div>
      <div className="flex items-center gap-3 p-3 border-t border-line">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="shrink-0 w-11 h-11 rounded-full bg-panel2 border border-line flex items-center justify-center text-lg"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={sequence.duration}
          step={0.01}
          value={time}
          onChange={(e) => {
            timeRef.current = parseFloat(e.target.value)
            setTime(timeRef.current)
            setPlaying(false)
          }}
          className="w-full"
        />
        <span className="shrink-0 text-xs font-mono text-white/50 w-12 text-right">
          {time.toFixed(1)}s
        </span>
      </div>
      <p className="px-3 pb-2 text-[10px] text-white/30">Drag to rotate · pinch/scroll to zoom</p>
    </div>
  )
}
