// A real 3D icosahedron (d20) built from 20 triangular faces. Rather than hand-
// tuning 20 transforms, we derive each face's placement mathematically from the
// icosahedron's vertices (golden-ratio coordinates) and emit an exact matrix3d.
// The faces carry no numbers — the rolled 0–99 value is overlaid by DiceGame —
// so it reads as a D&D die without misrepresenting our 0–99 outcome space.

const PHI = (1 + Math.sqrt(5)) / 2
const R = 56 // circumradius in px (≈112px across)
const L = 100 // face element local size in px

// 12 icosahedron vertices.
const RAW: number[][] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
]
// 20 faces as vertex-index triplets (standard icosphere base mesh).
const FACES: number[][] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
]

const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: number[], b: number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (a: number[]) => {
  const m = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / m, a[1] / m, a[2] / m]
}

const SCALE = R / Math.hypot(1, PHI)
const VERTS = RAW.map((v) => v.map((c) => c * SCALE))
const LIGHT = unit([-0.3, -0.65, 0.7]) // from upper-front (CSS y is down)

type Face = { transform: string; fill: string }

// Map the face element's local plane (corners (0,0),(L,0),(0,L)) onto the 3D
// triangle b0,b1,b2 with an affine matrix3d; the out-of-plane axis maps to the
// outward normal so backface culling hides the far side.
const FACE_DATA: Face[] = FACES.map(([i, j, k]) => {
  const b0 = VERTS[i], b1 = VERTS[j], b2 = VERTS[k]
  const ud = sub(b1, b0)
  const vd = sub(b2, b0)
  let nd = unit(cross(ud, vd))
  const centroid = [(b0[0] + b1[0] + b2[0]) / 3, (b0[1] + b1[1] + b2[1]) / 3, (b0[2] + b1[2] + b2[2]) / 3]
  if (dot(nd, centroid) < 0) nd = [-nd[0], -nd[1], -nd[2]]

  const m = [
    ud[0] / L, ud[1] / L, ud[2] / L, 0,
    vd[0] / L, vd[1] / L, vd[2] / L, 0,
    nd[0], nd[1], nd[2], 0,
    b0[0], b0[1], b0[2], 1,
  ].map((n) => Number(n.toFixed(4)))

  // Bake simple directional lighting into the fill so the solid reads as faceted.
  const f = 0.45 + 0.95 * Math.max(0, dot(nd, LIGHT))
  const base = [40, 52, 78]
  const [r, g, b] = base.map((c) => Math.min(255, Math.round(c * f)))
  return { transform: `matrix3d(${m.join(',')})`, fill: `rgb(${r},${g},${b})` }
})

/** Phase color/glow and the tumble are driven by `className` (e.g. "gold spin-d20"). */
export function DiceShape({ className = '' }: { className?: string }) {
  return (
    <div className={`d20 ${className}`} aria-hidden>
      {FACE_DATA.map((face, idx) => (
        <svg key={idx} className="d20-face" viewBox={`0 0 ${L} ${L}`} style={{ transform: face.transform }}>
          <polygon points={`0,0 ${L},0 0,${L}`} style={{ fill: face.fill }} />
        </svg>
      ))}
    </div>
  )
}
