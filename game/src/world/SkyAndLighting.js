// Gradient sky dome with a sun, warm sun light with shadows that follow the player, fog,
// and a day cycle keyed on the hour (golden hour is the city's signature look).
import * as THREE from 'three';

const KEYS = [
  { h: 0, top: '#0b1430', horizon: '#1d2a52', sun: '#6d7fb8', sunI: 0.25, hemi: 0.35, fog: '#1d2a52' },
  { h: 5.5, top: '#1c2a5a', horizon: '#e88a6a', sun: '#ffb08a', sunI: 0.6, hemi: 0.5, fog: '#d99a8a' },
  { h: 8, top: '#3d8fe0', horizon: '#bfe3f5', sun: '#fff1d6', sunI: 2.4, hemi: 0.95, fog: '#c8e4ef' },
  { h: 14, top: '#2f86e0', horizon: '#c6e8f7', sun: '#ffffff', sunI: 2.8, hemi: 1.0, fog: '#cde9f5' },
  { h: 17, top: '#4a7fd0', horizon: '#ffc98a', sun: '#ffcf8a', sunI: 2.6, hemi: 0.85, fog: '#f4c79a' },
  { h: 18.6, top: '#3e5fae', horizon: '#ff8f5a', sun: '#ff9a4d', sunI: 2.3, hemi: 0.7, fog: '#f0a27a' },
  { h: 20, top: '#1d2552', horizon: '#c45b6a', sun: '#ff7a5a', sunI: 0.7, hemi: 0.45, fog: '#8a4f6a' },
  { h: 21.5, top: '#0b1430', horizon: '#26305e', sun: '#6d7fb8', sunI: 0.25, hemi: 0.35, fog: '#26305e' },
  { h: 24, top: '#0b1430', horizon: '#1d2a52', sun: '#6d7fb8', sunI: 0.25, hemi: 0.35, fog: '#1d2a52' },
];

export class SkyAndLighting {
  constructor(scene, renderer) {
    this.scene = scene;
    this.hour = 18.3;
    this.sunDir = new THREE.Vector3();
    this.uniforms = {
      topColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: this.sunDir },
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunColor; uniform vec3 sunDir; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(max(h, 0.0), 0.55));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12);
          col = mix(col, horizonColor * 0.9, smoothstep(0.0, -0.2, vDir.y));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    scene.add(sky);
    this.sky = sky;

    this.hemi = new THREE.HemisphereLight('#bfe0ff', '#c8a878', 0.8);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffd29a', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 10; sc.far = 600;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);
    scene.fog = new THREE.Fog('#f4c79a', 160, 980);
    this.renderer = renderer;
    this.apply();
  }

  setHour(h) { this.hour = ((h % 24) + 24) % 24; this.apply(); }

  apply() {
    const h = this.hour;
    let a = KEYS[0], b = KEYS[1];
    for (let i = 0; i < KEYS.length - 1; i++) if (h >= KEYS[i].h && h <= KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    const t = (h - a.h) / Math.max(0.001, b.h - a.h);
    const mix = (ca, cb) => new THREE.Color(ca).lerp(new THREE.Color(cb), t);
    this.uniforms.topColor.value.copy(mix(a.top, b.top));
    this.uniforms.horizonColor.value.copy(mix(a.horizon, b.horizon));
    this.uniforms.sunColor.value.copy(mix(a.sun, b.sun));
    this.sun.color.copy(mix(a.sun, b.sun));
    this.sun.intensity = a.sunI + (b.sunI - a.sunI) * t;
    this.hemi.intensity = a.hemi + (b.hemi - a.hemi) * t;
    this.hemi.color.copy(mix(a.top, b.top)).lerp(new THREE.Color('#ffffff'), 0.55);
    this.scene.fog.color.copy(mix(a.fog, b.fog));
    // The sun rises in the east over the ocean and sets inland to the west.
    const dayT = (h - 6) / 13.5; // 0 at sunrise, 1 at sunset
    const elev = Math.sin(Math.min(Math.max(dayT, 0), 1) * Math.PI) * 1.05 + 0.1;
    const az = Math.PI * (dayT) ;
    this.sunDir.set(Math.cos(az), Math.max(0.12, Math.sin(elev) * 0.9), 0.35).normalize();
    this.isNight = h < 5.8 || h > 20.4;
  }

  // Keep the shadow camera centred on the action.
  follow(x, z) {
    const d = this.sunDir;
    this.sun.position.set(x + d.x * 300, d.y * 300, z + d.z * 300);
    this.sun.target.position.set(x, 0, z);
    this.sky.position.set(x, 0, z);
  }
}
