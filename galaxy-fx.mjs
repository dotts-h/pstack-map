// Cheap galaxy shading. The black hole is a painted disk, not a ray march.
// Full-screen bloom exists only for the optional High setting.
import * as THREE from 'three';

export function bbLin(t) {
  const u = (0.860117757 + 1.54118254e-4 * t + 1.28641212e-7 * t * t) / (1 + 8.42420235e-4 * t + 7.08145163e-7 * t * t);
  const v = (0.317398726 + 4.22806245e-5 * t + 4.20481691e-8 * t * t) / (1 - 2.89741816e-5 * t + 1.61456053e-7 * t * t);
  const x = (3 * u) / (2 * u - 8 * v + 4);
  const y = (2 * v) / (2 * u - 8 * v + 4);
  const X = x / y;
  const Z = (1 - x - y) / y;
  const r = Math.max(0, 3.2404542 * X - 1.5371385 - 0.4985314 * Z);
  const g = Math.max(0, -0.969266 * X + 1.8760108 + 0.041556 * Z);
  const b = Math.max(0, 0.0556434 * X - 0.2040259 + 1.0572252 * Z);
  const m = Math.max(r, g, b, 1e-6);
  return new THREE.Color().setRGB(r / m, g / m, b / m, THREE.LinearSRGBColorSpace);
}
export const bbHex = (t) => '#' + bbLin(t).getHexString();
export const ZONE_T = { build: 14000, research: 7000, ship: 4800, fix: 3300, run: 2100 };

function smooth(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

export function bakeDiskTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1;
      const v = ((y + 0.5) / size) * 2 - 1;
      const r = Math.hypot(u, v);
      const a = Math.atan2(v, u);
      let R = 0;
      let G = 0;
      let B = 0;
      let A = 0;
      if (r < 0.155) {
        const edge = smooth(0.11, 0.155, r);
        A = 1;
        R = G = B = edge * 0.02;
      }
      const ring = Math.exp(-((r - 0.188) ** 2) / 0.00055);
      const ringSoft = Math.exp(-((r - 0.188) ** 2) / 0.0045);
      R += ring * 1.35 + ringSoft * 0.55;
      G += ring * 1.05 + ringSoft * 0.38;
      B += ring * 0.55 + ringSoft * 0.16;
      A = Math.max(A, Math.min(1, ring * 0.95 + ringSoft * 0.55));
      if (r > 0.2 && r < 0.86) {
        const rn = (r - 0.2) / 0.66;
        const spiral = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(a * 2 - Math.log(r + 0.15) * 7.5));
        const bands = 0.78 + 0.22 * Math.sin(a * 9 + r * 28);
        const edge = smooth(0, 0.05, rn) * (1 - smooth(0.62, 1, rn));
        const hot = (1 - rn) ** 1.35;
        const I = (0.22 + 1.35 * hot) * spiral * bands * edge;
        R += I * (1.05 + 0.2 * hot);
        G += I * (0.42 + 0.55 * hot);
        B += I * (0.12 + 0.5 * hot * hot);
        A = Math.max(A, Math.min(0.94, edge * (0.28 + 0.62 * hot) * (0.65 + 0.35 * spiral)));
      }
      const halo = Math.exp(-((r - 0.19) ** 2) / 0.09) * (1 - smooth(0.72, 1, r));
      R += halo * 0.22;
      G += halo * 0.12;
      B += halo * 0.04;
      A = Math.max(A, Math.min(0.45, halo * 0.7));
      if (r > 0.98) A *= 1 - smooth(0.98, 1, r);
      const k = (y * size + x) * 4;
      d[k] = Math.min(255, R * 255);
      d[k + 1] = Math.min(255, G * 255);
      d[k + 2] = Math.min(255, B * 255);
      d[k + 3] = Math.min(255, A * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export function createBakedDisk() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    depthTest: true,
    fog: false,
    toneMapped: false,
    uniforms: {
      map: { value: bakeDiskTexture() },
      uTime: { value: 0 },
      dim: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D map;uniform float uTime;uniform float dim;varying vec2 vUv;
void main(){
  vec2 p=vUv-0.5;
  float cs=cos(uTime),sn=sin(uTime);
  vec2 r=vec2(cs*p.x-sn*p.y,sn*p.x+cs*p.y);
  vec4 c=texture2D(map,r+0.5);
  float hole=smoothstep(0.07,0.11,length(p));
  c.rgb*=hole;
  c.rgb*=1.0-dim*0.88;
  c.a*=1.0-dim*0.75;
  if(c.a<0.012) discard;
  gl_FragColor=c;
}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), mat);
  mesh.rotation.x = -Math.PI / 2 + 0.08;
  mesh.renderOrder = 3;
  return { mesh, mat };
}

export function createBloom(renderer) {
  renderer.info.autoReset = false;
  let rt = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true });
  const fsScene = new THREE.Scene();
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsq = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)));
  fsq.frustumCulled = false;
  fsScene.add(fsq);
  const fsMat = (frag, u, o = {}) => new THREE.ShaderMaterial({
    uniforms: u,
    depthTest: false,
    depthWrite: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: frag,
    toneMapped: false,
    ...o,
  });
  const mBright = fsMat(`uniform sampler2D t;uniform vec2 px;varying vec2 vUv;
void main(){vec3 c=texture2D(t,vUv).rgb;float l=max(c.r,max(c.g,c.b));float s=smoothstep(0.72,1.05,l);gl_FragColor=vec4(c*s,1.);}`, { t: { value: null }, px: { value: new THREE.Vector2() } });
  const mDown = fsMat('uniform sampler2D t;uniform vec2 px;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*.4;c+=texture2D(t,vUv+px*vec2(-1,-1)).rgb*.15;c+=texture2D(t,vUv+px*vec2(1,-1)).rgb*.15;c+=texture2D(t,vUv+px*vec2(-1,1)).rgb*.15;c+=texture2D(t,vUv+px*vec2(1,1)).rgb*.15;gl_FragColor=vec4(c,1.);}', { t: { value: null }, px: { value: new THREE.Vector2() } });
  const mUp = fsMat('uniform sampler2D t;uniform vec2 px;varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(t,vUv).rgb,1.);}', { t: { value: null }, px: { value: new THREE.Vector2() } }, { blending: THREE.AdditiveBlending, transparent: true });
  const mComp = fsMat(`uniform sampler2D tS;uniform sampler2D tB;uniform float str;varying vec2 vUv;
void main(){gl_FragColor=vec4(texture2D(tS,vUv).rgb+texture2D(tB,vUv).rgb*str,1.);}`, { tS: { value: null }, tB: { value: null }, str: { value: 0.45 } });
  let bl = [];
  const db = new THREE.Vector2();
  const stats = { calls: 0, tris: 0, on: true };
  function size() {
    renderer.getDrawingBufferSize(db);
    rt.setSize(db.x, db.y);
    bl.forEach((t) => t.dispose());
    bl = [];
    let w = Math.max(1, db.x >> 1);
    let h = Math.max(1, db.y >> 1);
    for (let i = 0; i < 3; i++) {
      bl.push(new THREE.WebGLRenderTarget(w, h, { depthBuffer: false }));
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
  }
  function fs(m, t) {
    fsq.material = m;
    renderer.setRenderTarget(t);
    renderer.render(fsScene, fsCam);
  }
  function render(scene, camera) {
    renderer.getDrawingBufferSize(db);
    if (rt.width !== db.x || rt.height !== db.y || !bl.length) size();
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    mBright.uniforms.t.value = rt.texture;
    fs(mBright, bl[0]);
    for (let i = 1; i < bl.length; i++) {
      mDown.uniforms.t.value = bl[i - 1].texture;
      mDown.uniforms.px.value.set(1 / bl[i - 1].width, 1 / bl[i - 1].height);
      fs(mDown, bl[i]);
    }
    for (let i = bl.length - 1; i > 0; i--) {
      mUp.uniforms.t.value = bl[i].texture;
      renderer.autoClear = false;
      fs(mUp, bl[i - 1]);
      renderer.autoClear = true;
    }
    mComp.uniforms.tS.value = rt.texture;
    mComp.uniforms.tB.value = bl[0].texture;
    fs(mComp, null);
    stats.calls = renderer.info.render.calls;
    stats.tris = renderer.info.render.triangles;
    stats.size = [bl[0].width, bl[0].height];
    renderer.info.reset();
    return stats;
  }
  return {
    render,
    stats,
    size: () => (bl[0] ? [bl[0].width, bl[0].height] : null),
  };
}
