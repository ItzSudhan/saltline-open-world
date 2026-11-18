// Third-person camera: mouse orbit on foot with an over-the-shoulder aim, a chase cam that swings
// behind the car while driving, speed-based field of view, wall avoidance and impact shake.
import * as THREE from 'three';
import { clamp, wrapAngle } from '../core/Random.js';

export class CameraRig {
  constructor(camera, game) {
    this.camera = camera;
    this.game = game;
    this.yaw = 0;
    this.pitch = 0.22;
    this.dist = 5;
    this.lastMouse = 10;
    this.shakeAmt = 0;
    this.target = new THREE.Vector3();
    this.forwardVec = new THREE.Vector3();
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  snapBehind(heading) { this.yaw = heading; }

  update(dt) {
    const { input, player } = this.game;
    const sens = 0.0026;
    if (input.mouseDX || input.mouseDY) this.lastMouse = 0;
    this.lastMouse += dt;
    this.yaw -= input.mouseDX * sens;
    this.pitch = clamp(this.pitch + input.mouseDY * sens, -0.35, 1.1);

    const v = player.vehicle;
    let tx, ty, tz, dist, shoulder = 0;
    if (v) {
      tx = v.x; ty = 1.6; tz = v.z;
      if (this.lastMouse > 1.2) {
        const behind = v.speed < -2 ? v.heading + Math.PI : v.heading;
        this.yaw += wrapAngle(behind - this.yaw) * Math.min(1, dt * 3.2);
        this.pitch += (0.2 - this.pitch) * Math.min(1, dt * 2);
      }
      dist = 8.5 + Math.min(4, Math.abs(v.speed) * 0.08);
    } else {
      tx = player.x; ty = 1.55; tz = player.z;
      dist = player.aiming ? 2.6 : 4.6;
      shoulder = player.aiming ? 0.75 : 0.35;
    }
    this.dist += (dist - this.dist) * Math.min(1, dt * 6);
    this.target.set(tx, ty, tz);

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fx = Math.sin(this.yaw) * cp, fz = Math.cos(this.yaw) * cp;
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    this.forwardVec.set(fx, -sp, fz).normalize();
    let d = this.dist;
    // Pull in when a wall is between the player and the camera.
    const ox = tx + rx * shoulder, oz = tz + rz * shoulder;
    const hit = this.game.collision.raycast(ox, ty, oz, -fx / cp, sp / cp * 0, -fz / cp, d * cp + 0.5);
    if (hit < d * cp + 0.5) d = Math.max(1.2, (hit - 0.6) / cp);
    let cx = ox - fx * d, cy = ty + sp * d + 0.25, cz = oz - fz * d;
    if (cy < 0.4) cy = 0.4;
    if (this.shakeAmt > 0) {
      const s = this.shakeAmt * 0.35;
      cx += (Math.random() - 0.5) * s; cy += (Math.random() - 0.5) * s; cz += (Math.random() - 0.5) * s;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    }
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(cx + this.forwardVec.x * 10, cy + this.forwardVec.y * 10 + (v ? 0.05 : 0), cz + this.forwardVec.z * 10);
    const fov = v ? 62 + Math.min(14, Math.abs(v.speed) * 0.32) : player.aiming ? 52 : 60;
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();
  }

  // Free camera for the title screen and staged shots.
  orbit(t, cx, cz, radius, height) {
    const a = t * 0.05;
    this.camera.position.set(cx + Math.cos(a) * radius, height, cz + Math.sin(a) * radius);
    this.camera.lookAt(cx, 10, cz);
  }
}
