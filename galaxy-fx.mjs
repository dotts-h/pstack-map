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

// Cinematic black hole. The v5.2 gold disk and photon ring, marched only
// inside the hole's projected bounds, then upscaled with a bicubic filter.
export const BH_RS = 6 / 2.6;
export const BH_QR = 16;
const BH_STEPS = 128;

const BBGLSL = `vec3 bb(float t){float u=(0.860117757+1.54118254e-4*t+1.28641212e-7*t*t)/(1.+8.42420235e-4*t+7.08145163e-7*t*t);float v=(0.317398726+4.22806245e-5*t+4.20481691e-8*t*t)/(1.-2.89741816e-5*t+1.61456053e-7*t*t);
 float x=3.*u/(2.*u-8.*v+4.),y=2.*v/(2.*u-8.*v+4.);vec3 X=vec3(x/y,1.,(1.-x-y)/y);vec3 c=max(vec3(0.),mat3(3.2404542,-0.969266,0.0556434,-1.5371385,1.8760108,-0.2040259,-0.4985314,0.041556,1.0572252)*X);return c/max(c.r,max(c.g,c.b));}`;

const MARCH_FRAG = `uniform vec3 bhPos;uniform float Rs;uniform mat3 W2D;uniform float uTime;uniform float dim;uniform float uSteps;varying vec3 vW;
${BBGLSL}
float hh(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float nn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hh(i),hh(i+vec3(1,0,0)),f.x),mix(hh(i+vec3(0,1,0)),hh(i+vec3(1,1,0)),f.x),f.y),mix(mix(hh(i+vec3(0,0,1)),hh(i+vec3(1,0,1)),f.x),mix(hh(i+vec3(0,1,1)),hh(i+vec3(1,1,1)),f.x),f.y),f.z);}
const float RIN=3.,ROUT=12.,RB=16.;
vec4 disk(vec3 q,vec3 v){float r=length(q.xz);if(r<RIN||r>ROUT)return vec4(0.);
 float T=6200./.488*pow(r/RIN,-.75)*pow(max(1.-sqrt(RIN/r),0.),.25);
 float beta=sqrt(.5/(r-1.));vec3 vel=beta*normalize(vec3(-q.z,0.,q.x));vec3 n=-normalize(v);float gam=1./sqrt(1.-beta*beta);
 float g=1./(gam*(1.-dot(vel,n)))*sqrt(1.-1./r);
 float ph=atan(q.z,q.x)-uTime*.9*pow(r,-1.5);
 vec3 pc=vec3(cos(ph)*r,sin(ph)*r,r*.35);float tur=.55+.75*(nn(pc*1.6)*.6+nn(pc*4.1+3.)*.4);tur*=.8+.4*smoothstep(.3,.7,nn(vec3(r*2.2,0.,0.)));
 float edge=smoothstep(RIN,RIN+.35,r)*(1.-smoothstep(ROUT*.62,ROUT,r));
 float I=pow(T/6200.,2.2)*pow(g,3.)*tur*edge;
 vec3 c=bb(clamp(T*g,1200.,30000.))*I*.95;
 float a=clamp(edge*(.55+.45*smoothstep(ROUT,RIN,r))*tur,0.,.96);
 return vec4(c,a);}
void main(){vec3 ro=W2D*((cameraPosition-bhPos)/Rs);vec3 rd=normalize(W2D*(vW-cameraPosition));
 float b=dot(ro,rd),c=dot(ro,ro)-RB*RB,h=b*b-c;if(h<0.)discard;
 vec3 p=ro+rd*max(-b-sqrt(h),0.);vec3 v=rd;float imp=length(cross(ro,rd));float h2=imp*imp;
 vec3 col=vec3(0.);float Tr=1.;bool cap=false;float rmin=99.;
 for(int i=0;i<${BH_STEPS};i++){if(float(i)>=uSteps) break;float r2=dot(p,p);if(r2<1.){cap=true;break;}float r=sqrt(r2);rmin=min(rmin,r);
  float dt=clamp(.1*r*r/(r+2.),.02,1.);
  vec3 a=-1.5*h2*p/(r2*r2*r);vec3 vn=v+a*dt;vec3 pn=p+vn*dt;
  if(p.y*pn.y<0.){float f=p.y/(p.y-pn.y);vec3 q=mix(p,pn,f);vec4 d=disk(q,vn);col+=Tr*d.rgb*d.a;Tr*=1.-d.a;}
  p=pn;v=vn;if(dot(p,p)>RB*RB*1.0001&&dot(p,v)>0.)break;if(Tr<.03)break;}
 col+=Tr*vec3(1.,.82,.6)*.55*exp(-pow((rmin-1.53)/.035,2.))*(cap?0.:1.);
 float wb=cap?1.:1.-smoothstep(RB*.3,RB*.78,imp);
 col*=1.-dim*.85;
 gl_FragColor=vec4(col,1.-Tr*(1.-wb));}`;

const BICUBIC = `vec4 bicubic(sampler2D tex, vec2 uv, vec2 res){
  vec2 q=uv*res-0.5; vec2 f=fract(q); vec2 i=floor(q);
  vec2 w0=f*(-0.5+f*(1.0-0.5*f));
  vec2 w1=1.0+f*f*(-2.5+1.5*f);
  vec2 w2=f*(0.5+f*(2.0-1.5*f));
  vec2 w3=f*f*(-0.5+0.5*f);
  vec2 s0=w0+w1; vec2 s1=w2+w3;
  vec2 f0=w1/max(s0,vec2(1e-4))-1.0;
  vec2 f1=w3/max(s1,vec2(1e-4))+1.0;
  vec2 t0=(i+f0+0.5)/res; vec2 t1=(i+f1+0.5)/res;
  return texture2D(tex,vec2(t0.x,t0.y))*s0.x*s0.y
    +texture2D(tex,vec2(t1.x,t0.y))*s1.x*s0.y
    +texture2D(tex,vec2(t0.x,t1.y))*s0.x*s1.y
    +texture2D(tex,vec2(t1.x,t1.y))*s1.x*s1.y;
}`;

function target(w, h) {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });
}

export function createBoundedBlackHole() {
  const size = (2 * BH_QR * BH_RS) / 6;
  const geo = new THREE.PlaneGeometry(size, size);
  const marchMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    fog: false,
    uniforms: {
      bhPos: { value: new THREE.Vector3() },
      Rs: { value: BH_RS },
      W2D: { value: new THREE.Matrix3() },
      uTime: { value: 0 },
      dim: { value: 0 },
      uSteps: { value: BH_STEPS },
    },
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: MARCH_FRAG,
  });
  const n = new THREE.Vector3(0, Math.cos(0.08), Math.sin(0.08));
  const x = new THREE.Vector3(1, 0, 0);
  const z = new THREE.Vector3().crossVectors(x, n);
  marchMat.uniforms.W2D.value.set(x.x, x.y, x.z, n.x, n.y, n.z, z.x, z.y, z.z);
  const marchMesh = new THREE.Mesh(geo, marchMat);
  marchMesh.frustumCulled = false;
  const marchScene = new THREE.Scene();
  marchScene.add(marchMesh);
  const subCam = new THREE.PerspectiveCamera(40, 1, 0.1, 6000);
  const displayMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      tMarch: { value: null },
      res: { value: new THREE.Vector2(1, 1) },
      win: { value: new THREE.Vector4(0, 0, 1, 1) },
    },
    vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tMarch;uniform vec2 res;uniform vec4 win;
${BICUBIC}
void main(){
  vec2 uv=(gl_FragCoord.xy-win.xy)/win.zw;
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.) discard;
  vec4 d=bicubic(tMarch,uv,res);
  gl_FragColor=d;
}`,
  });
  const displaySize = size * 1.28;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(displaySize, displaySize), displayMat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  const fsScene = new THREE.Scene();
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsq = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)));
  fsq.frustumCulled = false;
  fsScene.add(fsq);
  const pass = (frag) => new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, px: { value: new THREE.Vector2() } },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: frag,
  });
  const mBright = pass('uniform sampler2D t;uniform vec2 px;varying vec2 vUv;void main(){vec2 h=px;float th=.55;float knee=.2;vec3 acc=vec3(0.);vec2 o[4];o[0]=vec2(-1.,-1.);o[1]=vec2(1.,-1.);o[2]=vec2(-1.,1.);o[3]=vec2(1.,1.);for(int i=0;i<4;i++){vec3 c=texture2D(t,vUv+o[i]*h).rgb;float l=max(c.r,max(c.g,c.b));float s=clamp(l-th+knee,0.,2.*knee);s=s*s/(4.*knee+1e-4);acc+=c*max(s,l-th)/max(l,1e-4);}gl_FragColor=vec4(max(acc*.25,0.),1.);}');
  const mDown = pass('uniform sampler2D t;uniform vec2 px;varying vec2 vUv;void main(){vec2 h=px;vec3 c=texture2D(t,vUv).rgb*4.;c+=texture2D(t,vUv+vec2(-h.x,-h.y)).rgb+texture2D(t,vUv+vec2(h.x,-h.y)).rgb+texture2D(t,vUv+vec2(-h.x,h.y)).rgb+texture2D(t,vUv+vec2(h.x,h.y)).rgb;gl_FragColor=vec4(c/8.,1.);}');
  const mUp = pass('uniform sampler2D t;uniform vec2 px;varying vec2 vUv;void main(){vec2 h=px*.5;vec3 c=texture2D(t,vUv+vec2(-h.x*2.,0.)).rgb;c+=texture2D(t,vUv+vec2(-h.x,h.y)).rgb*2.;c+=texture2D(t,vUv+vec2(0.,h.y*2.)).rgb;c+=texture2D(t,vUv+vec2(h.x,h.y)).rgb*2.;c+=texture2D(t,vUv+vec2(h.x*2.,0.)).rgb;c+=texture2D(t,vUv+vec2(h.x,-h.y)).rgb*2.;c+=texture2D(t,vUv+vec2(0.,-h.y*2.)).rgb;c+=texture2D(t,vUv+vec2(-h.x,-h.y)).rgb*2.;gl_FragColor=vec4(c/12.,1.);}');
  mUp.blending = THREE.AdditiveBlending;
  mUp.transparent = true;
  const mTone = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, tB: { value: null }, str: { value: 0 } },
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
    vertexShader: 'varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform sampler2D tS;varying vec2 vUv;
void main(){
  vec4 s=texture2D(tS,vUv);
  gl_FragColor=s;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb*=gl_FragColor.a;
}`,
  });
  const mAdd = pass(`uniform sampler2D t;uniform sampler2D tB;uniform float str;varying vec2 vUv;
void main(){
  vec4 s=texture2D(t,vUv);
  vec3 g=texture2D(tB,vUv).rgb*str;
  float m=max(g.r,max(g.g,g.b));
  float a=max(s.a,smoothstep(0.03,0.22,m));
  gl_FragColor=vec4(s.rgb+g,a);
}`);
  mAdd.uniforms.tB = { value: null };
  mAdd.uniforms.str = { value: 0 };
  let marchRT = target(2, 2);
  let viewRT = null;
  let glowRT = null;
  let bloomChain = [];
  let key = '';
  let dim = 0;
  const buf = new THREE.Vector2();
  const center = new THREE.Vector3();
  const clear = new THREE.Color();
  const stats = { cached: false, bhSize: [0, 0], bloomSize: null, steps: 0, shader: 0, bloomWork: 0 };
  function blur(renderer, src) {
    const w0 = Math.max(2, src.width >> 1);
    const h0 = Math.max(2, src.height >> 1);
    if (!bloomChain.length || bloomChain[0].width !== w0 || bloomChain[0].height !== h0) {
      bloomChain.forEach((t) => t.dispose());
      bloomChain = [];
      let w = w0;
      let h = h0;
      for (let i = 0; i < 4; i++) {
        bloomChain.push(new THREE.WebGLRenderTarget(w, h, {
          depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter,
        }));
        w = Math.max(1, w >> 1);
        h = Math.max(1, h >> 1);
      }
    }
    const draw = (mat, dest) => {
      fsq.material = mat;
      renderer.setRenderTarget(dest);
      renderer.render(fsScene, fsCam);
    };
    mBright.uniforms.t.value = src.texture;
    mBright.uniforms.px.value.set(1 / src.width, 1 / src.height);
    renderer.autoClear = true;
    draw(mBright, bloomChain[0]);
    for (let i = 1; i < bloomChain.length; i++) {
      mDown.uniforms.t.value = bloomChain[i - 1].texture;
      mDown.uniforms.px.value.set(1 / bloomChain[i - 1].width, 1 / bloomChain[i - 1].height);
      draw(mDown, bloomChain[i]);
    }
    for (let i = bloomChain.length - 1; i > 0; i--) {
      mUp.uniforms.t.value = bloomChain[i].texture;
      mUp.uniforms.px.value.set(1 / bloomChain[i].width, 1 / bloomChain[i].height);
      renderer.autoClear = false;
      draw(mUp, bloomChain[i - 1]);
      renderer.autoClear = true;
    }
    return bloomChain[0];
  }
  function update(renderer, camera, q) {
    mesh.quaternion.copy(camera.quaternion);
    const sc = Math.max(mesh.scale.x, 1e-4);
    const radius = displaySize * 0.5 * sc;
    center.copy(mesh.position);
    const dist = Math.max(camera.position.distanceTo(center), 1e-3);
    const ndc = center.clone().project(camera);
    const fov = (camera.fov * Math.PI) / 180;
    const ny = (radius / dist) / Math.tan(fov / 2);
    const nx = ny / Math.max(camera.aspect, 1e-3);
    const l = Math.max(-1, ndc.x - nx * 1.08);
    const r = Math.min(1, ndc.x + nx * 1.08);
    const b = Math.max(-1, ndc.y - ny * 1.08);
    const t = Math.min(1, ndc.y + ny * 1.08);
    renderer.getDrawingBufferSize(buf);
    const pw = (r - l) * 0.5 * buf.x;
    const ph = (t - b) * 0.5 * buf.y;
    if (ndc.z > 1 || pw < 8 || ph < 8) {
      mesh.visible = false;
      stats.cached = true;
      stats.shader = 0;
      return stats;
    }
    mesh.visible = true;
    displayMat.uniforms.win.value.set((l + 1) * 0.5 * buf.x, (b + 1) * 0.5 * buf.y, Math.max(pw, 1), Math.max(ph, 1));
    const scale = q.bhScale || 0.6;
    const steps = q.bhSteps || 96;
    const tw = THREE.MathUtils.clamp(Math.round(pw * scale), 80, 768);
    const th = THREE.MathUtils.clamp(Math.round(ph * scale), 80, 768);
    const stamp = [
      Math.round(camera.position.x * 20), Math.round(camera.position.y * 20), Math.round(camera.position.z * 20),
      Math.round(camera.quaternion.x * 200), Math.round(camera.quaternion.y * 200), Math.round(camera.quaternion.z * 200),
      Math.round(center.x * 20), Math.round(center.y * 20), Math.round(center.z * 20),
      Math.round(sc * 50), Math.round((q.time || 0) * 4), steps, tw, th, q.bloom ? 1 : 0, Math.round(dim * 20),
      Math.round((camera.view && camera.view.enabled ? camera.view.offsetX : 0) * 2),
      Math.round((camera.view && camera.view.enabled ? camera.view.offsetY : 0) * 2),
    ].join(',');
    const hit = stamp === key && marchRT.width === tw && marchRT.height === th;
    stats.cached = hit;
    stats.steps = steps;
    stats.bhSize = [tw, th];
    stats.shader = hit ? 0 : tw * th * steps;
    if (!hit) {
      if (marchRT.width !== tw || marchRT.height !== th) {
        marchRT.dispose();
        marchRT = target(tw, th);
      }
      marchMat.uniforms.bhPos.value.copy(center);
      marchMat.uniforms.Rs.value = BH_RS * (sc / 6);
      marchMat.uniforms.uTime.value = q.time || 0;
      marchMat.uniforms.dim.value = dim;
      marchMat.uniforms.uSteps.value = steps;
      marchMesh.position.copy(center);
      marchMesh.quaternion.copy(mesh.quaternion);
      marchMesh.scale.copy(mesh.scale);
      marchMesh.updateMatrixWorld();
      subCam.fov = camera.fov;
      subCam.aspect = camera.aspect;
      subCam.near = camera.near;
      subCam.far = camera.far;
      subCam.zoom = camera.zoom;
      subCam.position.copy(camera.position);
      subCam.quaternion.copy(camera.quaternion);
      subCam.updateMatrixWorld();
      const view = camera.view;
      const vx = view && view.enabled ? view.offsetX * (buf.x / view.fullWidth) : 0;
      const vy = view && view.enabled ? view.offsetY * (buf.y / view.fullHeight) : 0;
      subCam.setViewOffset(buf.x, buf.y, vx + (l + 1) * 0.5 * buf.x, vy + (1 - t) * 0.5 * buf.y, Math.max(1, pw), Math.max(1, ph));
      const prev = renderer.getRenderTarget();
      renderer.getClearColor(clear);
      const alpha = renderer.getClearAlpha();
      renderer.setRenderTarget(marchRT);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(marchScene, subCam);
      if (!viewRT || viewRT.width !== tw || viewRT.height !== th) {
        if (viewRT) viewRT.dispose();
        viewRT = new THREE.WebGLRenderTarget(tw, th, {
          depthBuffer: false,
          magFilter: THREE.LinearFilter,
          minFilter: THREE.LinearFilter,
        });
      }
      mTone.uniforms.tS.value = marchRT.texture;
      fsq.material = mTone;
      renderer.setRenderTarget(viewRT);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(fsScene, fsCam);
      let shown = viewRT;
      if (q.bloom) {
        const bloom = blur(renderer, viewRT);
        mAdd.uniforms.t.value = viewRT.texture;
        mAdd.uniforms.tB.value = bloom.texture;
        mAdd.uniforms.str.value = 1.6;
        fsq.material = mAdd;
        if (!glowRT || glowRT.width !== tw || glowRT.height !== th) {
          if (glowRT) glowRT.dispose();
          glowRT = new THREE.WebGLRenderTarget(tw, th, {
            depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter,
          });
        }
        renderer.setRenderTarget(glowRT);
        renderer.clear();
        renderer.render(fsScene, fsCam);
        shown = glowRT;
        stats.bloomSize = [bloom.width, bloom.height];
        stats.bloomWork = bloom.width * bloom.height * 4;
      } else {
        stats.bloomSize = null;
        stats.bloomWork = 0;
      }
      renderer.setRenderTarget(prev);
      renderer.setClearColor(clear, alpha);
      displayMat.uniforms.tMarch.value = shown.texture;
      displayMat.uniforms.res.value.set(tw, th);
      key = stamp;
    }
    return stats;
  }
  return {
    mesh,
    update,
    setDim(d) { dim = d; },
    stats: () => stats,
  };
}
