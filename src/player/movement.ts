import type { Point2 } from '../world/layout.ts'

export function movementDelta(strafe: number, forward: number, yaw: number, running: boolean, deltaSeconds: number): Point2 {
  const magnitude = Math.hypot(strafe, forward)
  if (magnitude === 0) return { x: 0, z: 0 }
  const distance = (running ? 5.8 : 3.4) * Math.min(0.1, Math.max(0, deltaSeconds)) / magnitude
  return {
    x: (strafe * Math.cos(yaw) + forward * Math.sin(yaw)) * distance,
    z: (-strafe * Math.sin(yaw) + forward * Math.cos(yaw)) * distance,
  }
}
