// v5.2 galaxy rendering: blackbody colour, graphics tiers, ray-traced black hole, HDR bloom.
// No new image assets. The disk, stars, lens and bloom are procedural.
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

const GFX_KEY = 'pstackMap.gfx';
const ADAPT_RES = [1, 0.85, 0.72];
const params = new URLSearchParams(location.search);
let gpuName = '';
function readGpu() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl', { failIfMajorPerformanceCaveat: false });
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch { return ''; }
}
function isWindows() {
  const plat = navigator.userAgentData?.platform || navigator.platform || '';
  return /win/i.test(plat) || /windows/i.test(navigator.userAgent || '');
}
function isIntegratedGpu(name) {
  if (!name) return false;
  if (/swiftshader|llvmpipe|softpipe|microsoft basic render/i.test(name)) return true;
  if (/nvidia|geforce|quadro|\brtx\b|\bgtx\b|radeon\s(rx|pro|r[579])|amd radeon rx/i.test(name)) return false;
  return /intel|uhd graphics|iris|hd graphics|mali|adreno|apple gpu|powervr|videocore/i.test(name);
}
function initialGfx() {
  const q = params.get('gfx');
  if (q === 'high' || q === 'balanced') return q;
  try {
    const s = localStorage.getItem(GFX_KEY);
    if (s === 'high' || s === 'balanced') return s;
  } catch { /* private mode */ }
  gpuName = readGpu();
  if (isWindows() || isIntegratedGpu(gpuName)) return 'balanced';
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
  return (innerWidth < 720 || coarse) ? 'balanced' : 'high';
}
let GFX = initialGfx();
if (!gpuName) gpuName = readGpu();
let adapt = { res: 0, bloom: 0, bh: 0 };
const adaptOff = params.get('adapt') === '0';
const listeners = [];
function emit() { listeners.forEach((fn) => fn(GFX)); }
export function getGfx() { return GFX; }
export function onGfx(fn) { listeners.push(fn); }
export function setGfx(g) {
  if (g !== 'high' && g !== 'balanced') return;
  GFX = g;
  adapt = { res: 0, bloom: 0, bh: 0 };
  try { localStorage.setItem(GFX_KEY, g); } catch { /* private mode */ }
  emit();
}
export function dprOf(renderer) {
  const d = renderer ? renderer.getPixelRatio() : targetPixelRatio();
  return d >= 1.5 ? 2 : 1;
}
export function targetPixelRatio() {
  const cap = GFX === 'high' ? 1.5 : 1;
  const base = Math.min(devicePixelRatio || 1, cap);
  return Math.max(0.5, Math.round(base * ADAPT_RES[adapt.res] * 100) / 100);
}
export function quality(renderer) {
  const high = GFX === 'high';
  const dpr = dprOf(renderer);
  const bhMax = high ? 96 : 56;
  const bhMul = [1, 0.78, 0.58][adapt.bh];
  return {
    high,
    dpr,
    bloomDiv: (high ? 2 : 4) * (adapt.bloom >= 2 ? 2 : 1),
    bloomLv: Math.max(2, (high ? 4 : 3) - (adapt.bloom >= 1 ? 1 : 0)),
    lensHalf: !high,
    stars: high ? 1 : 0.45,
    dust: high ? 1 : 0.6,
    glow: high ? 1 : 0.55,
    gran: high ? 1 : 0,
    bhSteps: Math.max(32, Math.round(bhMax * bhMul)),
    bhStepsMax: bhMax,
    bhScale: 0.5,
    bhLite: high ? 0 : 1,
    msaa: high ? 4 : 2,
    hii: high ? 1 : 0.5,
    spikes: high ? 1 : 0,
    adapt: { res: adapt.res, bloom: adapt.bloom, bh: adapt.bh },
  };
}
let frameAcc = 0;
let frameN = 0;
let frameSpan = 0;
let frameLast = 0;
let frameWindows = 0;
let frameAvg = 0;
let frameLastMs = 0;
function stepDown() {
  if (adapt.res < ADAPT_RES.length - 1) adapt.res += 1;
  else if (adapt.bloom < 2) adapt.bloom += 1;
  else if (adapt.bh < 2) adapt.bh += 1;
  else return false;
  emit();
  return true;
}
export function noteFrame(ms) {
  frameLastMs = ms;
  const now = performance.now();
  if (frameLast) frameSpan += Math.min(80, now - frameLast);
  frameLast = now;
  frameAcc += ms;
  frameN += 1;
  if (frameSpan >= 2000 && frameN >= 8) {
    frameAvg = frameAcc / frameN;
    frameAcc = 0;
    frameN = 0;
    frameSpan = 0;
    frameWindows += 1;
    if (!adaptOff && frameWindows > 1 && frameAvg > 20) stepDown();
  }
  return frameStats();
}
export function frameStats() {
  return {
    last: frameLastMs,
    avg: frameAvg || (frameN ? frameAcc / frameN : frameLastMs),
    adapt: { res: adapt.res, bloom: adapt.bloom, bh: adapt.bh },
    dpr: targetPixelRatio(),
    gpu: gpuName,
    windows: isWindows(),
    integrated: isIntegratedGpu(gpuName),
  };
}

const BBGLSL = `vec3 bb(float t){float u=(0.860117757+1.54118254e-4*t+1.28641212e-7*t*t)/(1.+8.42420235e-4*t+7.08145163e-7*t*t);float v=(0.317398726+4.22806245e-5*t+4.20481691e-8*t*t)/(1.-2.89741816e-5*t+1.61456053e-7*t*t);
 float x=3.*u/(2.*u-8.*v+4.),y=2.*v/(2.*u-8.*v+4.);vec3 X=vec3(x/y,1.,(1.-x-y)/y);vec3 c=max(vec3(0.),mat3(3.2404542,-0.969266,0.0556434,-1.5371385,1.8760108,-0.2040259,-0.4985314,0.041556,1.0572252)*X);return c/max(c.r,max(c.g,c.b));}`;

export const BH_RS = 6 / 2.6;
export const BH_QR = 16;

export function createBlackHole(renderer) {
  const gs = quality(renderer);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    fog: false,
    defines: { STEPS: gs.bhStepsMax, LITE: gs.bhLite },
    uniforms: {
      bhPos: { value: new THREE.Vector3() },
      Rs: { value: BH_RS },
      W2D: { value: new THREE.Matrix3() },
      uTime: { value: 0 },
      uSteps: { value: gs.bhSteps },
      dim: { value: 0 },
      tBg: { value: null },
      res: { value: new THREE.Vector2(1, 1) },
      uVP: { value: new THREE.Matrix4() },
      gain: { value: 0.95 },
      bgOn: { value: 1 },
    },
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform vec3 bhPos;uniform float Rs;uniform mat3 W2D;uniform float uTime;uniform float uSteps;uniform float dim;uniform sampler2D tBg;uniform vec2 res;uniform mat4 uVP;uniform float gain;uniform float bgOn;varying vec3 vW;
${BBGLSL}
float hh(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float nn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hh(i),hh(i+vec3(1,0,0)),f.x),mix(hh(i+vec3(0,1,0)),hh(i+vec3(1,1,0)),f.x),f.y),mix(mix(hh(i+vec3(0,0,1)),hh(i+vec3(1,0,1)),f.x),mix(hh(i+vec3(0,1,1)),hh(i+vec3(1,1,1)),f.x),f.y),f.z);}
const float RIN=3.,ROUT=12.,RB=16.;
vec4 disk(vec3 q,vec3 v){float r=length(q.xz);if(r<RIN||r>ROUT)return vec4(0.);
 float T=6200./.488*pow(r/RIN,-.75)*pow(max(1.-sqrt(RIN/r),0.),.25);
 float beta=sqrt(.5/(r-1.));vec3 vel=beta*normalize(vec3(-q.z,0.,q.x));vec3 n=-normalize(v);float gam=1./sqrt(1.-beta*beta);
 float g=1./(gam*(1.-dot(vel,n)))*sqrt(1.-1./r);
 float ph=atan(q.z,q.x)-uTime*.9*pow(r,-1.5);
 float tur=1.;
 #if LITE==0
 vec3 pc=vec3(cos(ph)*r,sin(ph)*r,r*.35);tur=.55+.75*(nn(pc*1.6)*.6+nn(pc*4.1+3.)*.4);tur*=.8+.4*smoothstep(.3,.7,nn(vec3(r*2.2,0.,0.)));
 #else
 tur=.85+.3*sin(r*5.+ph*2.);
 #endif
 float edge=smoothstep(RIN,RIN+.35,r)*(1.-smoothstep(ROUT*.62,ROUT,r));
 float I=pow(T/6200.,2.2)*pow(g,3.)*tur*edge;
 vec3 c=bb(clamp(T*g,1200.,30000.))*I*gain;
 float a=clamp(edge*(.55+.45*smoothstep(ROUT,RIN,r))*tur,0.,.96);
 return vec4(c,a);}
void main(){vec3 ro=W2D*((cameraPosition-bhPos)/Rs);vec3 rd=normalize(W2D*(vW-cameraPosition));
 float b=dot(ro,rd),c=dot(ro,ro)-RB*RB,h=b*b-c;if(h<0.)discard;
 vec3 p=ro+rd*max(-b-sqrt(h),0.);vec3 v=rd;float imp=length(cross(ro,rd));float h2=imp*imp;
 vec3 col=vec3(0.);float Tr=1.;bool cap=false;float rmin=99.;
 for(int i=0;i<STEPS;i++){if(float(i)>=uSteps)break;float r2=dot(p,p);if(r2<1.){cap=true;break;}float r=sqrt(r2);rmin=min(rmin,r);
  float dt=clamp(.1*r*r/(r+2.),.02,1.);
  vec3 a=-1.5*h2*p/(r2*r2*r);vec3 vn=v+a*dt;vec3 pn=p+vn*dt;
  if(p.y*pn.y<0.){float f=p.y/(p.y-pn.y);vec3 q=mix(p,pn,f);vec4 d=disk(q,vn);col+=Tr*d.rgb*d.a;Tr*=1.-d.a;}
  p=pn;v=vn;if(dot(p,p)>RB*RB*1.0001&&dot(p,v)>0.)break;if(Tr<.03)break;}
 col+=Tr*vec3(1.,.82,.6)*.55*exp(-pow((rmin-1.53)/.035,2.))*(cap?0.:1.);
 vec3 bg=vec3(0.);
 if(!cap&&bgOn>.5){vec3 dW=transpose(W2D)*normalize(v);vec4 cp=uVP*vec4(cameraPosition+dW*3000.,1.);vec2 uv=cp.xy/cp.w*.5+.5;bg=texture2D(tBg,uv).rgb;bg=bg/(1.+bg*1.2);}
 float wb=cap?1.:1.-smoothstep(RB*.3,RB*.78,imp);
 col*=1.-dim*.85;
 gl_FragColor=vec4(col+Tr*bg*wb,1.-Tr*(1.-wb));}`,
  });
  const n = new THREE.Vector3(0, Math.cos(0.08), Math.sin(0.08));
  const x = new THREE.Vector3(1, 0, 0);
  const z = new THREE.Vector3().crossVectors(x, n);
  mat.uniforms.W2D.value.set(x.x, x.y, x.z, n.x, n.y, n.z, z.x, z.y, z.z);
  const size = (2 * BH_QR * BH_RS) / 6;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;
  return { mesh, mat };
}

const NOISE3 = `float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
export const RINGD = `float ringD(float r){if(r<1.45||r>2.2)return 0.;float x=(r-1.45)/.75;float b=.62+.16*sin(x*38.)+.1*sin(x*91.+1.3)+.08*sin(x*217.+.7)+.12*sin(x*13.);b*=smoothstep(0.,.06,x)*smoothstep(1.,.9,x);b*=1.-.85*exp(-pow((x-.62)/.035,2.));return clamp(b,0.,1.);}`;

export const STAR_U = {
  uTime: { value: 0 },
  uGran: { value: 1 },
  uGain: { value: 3.4 },
};
export const PLAN_U = {
  uFocusL: { value: new THREE.Vector3() },
  uFocusLC: { value: new THREE.Color(1, 1, 1) },
  uFocusMix: { value: 0 },
  uAmb: { value: 0.06 },
};

export function makeStarMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: { ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), ...STAR_U },
    vertexShader: `varying vec3 vN;varying vec3 vV;varying vec3 vO;varying vec3 vC;varying float vDR;
#include <common>
#include <fog_pars_vertex>
void main(){vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.);vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
 vN=normalize(mat3(viewMatrix)*mat3(modelMatrix)*mat3(instanceMatrix)*normal);vV=-mvPosition.xyz;vO=normal;vC=instanceColor;vDR=length(mvPosition.xyz)/max(length(instanceMatrix[0].xyz),.001);
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime;uniform float uGran;uniform float uGain;varying vec3 vN;varying vec3 vV;varying vec3 vO;varying vec3 vC;varying float vDR;
#include <common>
#include <fog_pars_fragment>
${NOISE3}
void main(){float mu=clamp(dot(normalize(vN),normalize(vV)),0.,1.);float m=1.-mu;
 vec3 I=1.-vec3(.50,.64,.78)*m-vec3(.22,.20,.16)*m*m;
 float g=0.;if(uGran>.5){vec3 q=vO*34.;float c=n3(q+vec3(0.,0.,uTime*.05))*.6+n3(q*2.3-vec3(uTime*.035))*.4;g=(smoothstep(.3,.7,c)-.5)*.26*mu;}
 float lum=max(vC.r,max(vC.g,vC.b));float gain=mix(1.,mix(1.,uGain,smoothstep(8.,70.,vDR)),smoothstep(.25,.65,lum));
 gl_FragColor=vec4(vC*I*(1.+g)*gain,1.);
#include <fog_fragment>
}`,
  });
}

export function makePlanetMaterial(map) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: { ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), map: { value: map }, ...PLAN_U },
    vertexShader: `attribute vec3 aLight;attribute vec3 aLCol;attribute vec4 aRing;
varying vec3 vW;varying vec3 vN;varying vec2 vUv;varying vec3 vC;varying vec3 vL;varying vec3 vLC;varying vec4 vRing;varying vec3 vCen;varying float vRad;
#include <common>
#include <fog_pars_vertex>
void main(){mat4 M=modelMatrix*instanceMatrix;vec4 wp=M*vec4(position,1.);vW=wp.xyz;vCen=(M*vec4(0.,0.,0.,1.)).xyz;vRad=length(M[0].xyz);
 vN=normalize(mat3(M)*normal);vUv=uv;vC=instanceColor;vL=aLight;vLC=aLCol;vRing=aRing;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform sampler2D map;uniform vec3 uFocusL;uniform vec3 uFocusLC;uniform float uFocusMix;uniform float uAmb;
varying vec3 vW;varying vec3 vN;varying vec2 vUv;varying vec3 vC;varying vec3 vL;varying vec3 vLC;varying vec4 vRing;varying vec3 vCen;varying float vRad;
#include <common>
#include <fog_pars_fragment>
${RINGD}
void main(){vec3 Nn=normalize(vN);vec3 Lp=mix(vL,uFocusL,uFocusMix);vec3 LC=mix(vLC,uFocusLC,uFocusMix);vec3 L=normalize(Lp-vW);vec3 V=normalize(cameraPosition-vW);
 vec3 alb=texture2D(map,vUv).rgb*vC;float ndl=dot(Nn,L);
 float lam=max(0.,(ndl+.06)/1.06);lam*=smoothstep(-.06,.12,ndl);
 float sh=1.;if(vRing.w>.5){float dn=dot(L,vRing.xyz);if(abs(dn)>1e-4){float t=dot(vCen-vW,vRing.xyz)/dn;if(t>0.){sh=1.-.8*ringD(length(vW+L*t-vCen)/vRad);}}}
 float nv=max(dot(Nn,V),0.);float rim=pow(1.-nv,2.6);float fwd=.6+.9*pow(max(dot(-V,L),0.),3.);
 vec3 atm=vec3(.32,.52,1.)*rim*smoothstep(-.35,.35,ndl)*fwd*.4;
 vec3 col=alb*LC*lam*sh*1.25+atm*LC+alb*uAmb*(1.+uFocusMix*5.);
 gl_FragColor=vec4(col,1.);
#include <fog_fragment>
}`,
  });
}

export function makeRingMaterial(col) {
  const tint = new THREE.Color(col).lerp(new THREE.Color('#D9CBB4'), 0.55);
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      pC: { value: new THREE.Vector3() },
      pR: { value: 1 },
      lP: { value: new THREE.Vector3() },
      lC: { value: new THREE.Color(1, 1, 1) },
      tint: { value: tint },
      dim: { value: 0 },
    },
    vertexShader: 'varying vec3 vL;varying vec3 vW;void main(){vL=position;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform vec3 pC;uniform float pR;uniform vec3 lP;uniform vec3 lC;uniform vec3 tint;uniform float dim;varying vec3 vL;varying vec3 vW;
${RINGD}
void main(){float d=ringD(length(vL.xy));if(d<.01)discard;vec3 L=normalize(lP-vW);vec3 oc=vW-pC;float b=dot(oc,L),c=dot(oc,oc)-pR*pR;float sh=(b<0.&&b*b-c>0.)?.06:1.;
 vec3 V=normalize(cameraPosition-vW);float fs=.45+.8*pow(max(dot(-V,L),0.),4.);gl_FragColor=vec4(tint*lC*d*sh*fs*1.7,d*.78*(1.-dim));}`,
  });
}

export const FIELD_U = { uTime: { value: 0 } };
export function fieldStarMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { pr: { value: Math.min(devicePixelRatio || 1, 1.5) }, op: { value: 1 }, uTime: FIELD_U.uTime },
    vertexShader: 'attribute float sz;attribute vec3 col;attribute float spin;varying vec3 vC;uniform float pr;uniform float uTime;void main(){vC=col;float a=spin*uTime;float c=cos(a),s=sin(a);vec3 p=vec3(c*position.x+s*position.z,position.y,-s*position.x+c*position.z);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=sz*pr;}',
    fragmentShader: 'varying vec3 vC;uniform float op;void main(){vec2 d=gl_PointCoord-.5;float a=exp(-dot(d,d)*14.);if(a<.03)discard;gl_FragColor=vec4(vC*a*op,1.);}',
  });
}

export function createLensMaterial(target) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
    uniforms: {
      tBg: { value: target.texture },
      res: { value: new THREE.Vector2(1, 1) },
      c: { value: new THREE.Vector2() },
      rE: { value: 10 },
      rQ: { value: 50 },
      dim: { value: 0 },
    },
    vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tBg;uniform vec2 res;uniform vec2 c;uniform float rE;uniform float rQ;uniform float dim;
void main(){vec2 p=gl_FragCoord.xy;vec2 d=p-c;float r=max(length(d),.001);if(r>rQ)discard;
 vec2 src=p-d/r*(rE*rE/sqrt(r*r+.36*rE*rE));
 float w=.8*(1.-smoothstep(rQ*.55,rQ,r))*(1.-dim);
 gl_FragColor=vec4(texture2D(tBg,src/res).rgb,w);
 #include <colorspace_fragment>
}`,
  });
}

export function createPipeline(renderer) {
  const qs = new URLSearchParams(location.search);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = +(qs.get('exposure') || 0.9);
  renderer.info.autoReset = false;
  const msaa = () => {
    const gs = quality(renderer);
    const n = renderer.getPixelRatio() >= 1.5 ? gs.msaa / 2 : gs.msaa;
    return n < 2 ? 0 : n;
  };
  let rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: msaa(), depthBuffer: true });
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
  const bloom = { th: 1, knee: 0.5, str: +(qs.get('bloom') || 0.55) };
  const mBright = fsMat(`uniform sampler2D t;uniform vec2 px;uniform float th;uniform float knee;varying vec2 vUv;
 vec3 f(vec2 o){vec3 c=texture2D(t,vUv+o*px).rgb;float l=max(c.r,max(c.g,c.b));float s=clamp(l-th+knee,0.,2.*knee);s=s*s/(4.*knee+1e-4);return c*max(s,l-th)/max(l,1e-4);}
 void main(){gl_FragColor=vec4((f(vec2(-1,-1))+f(vec2(1,-1))+f(vec2(-1,1))+f(vec2(1,1)))*.25,1.);}`, { t: { value: null }, px: { value: new THREE.Vector2() }, th: { value: bloom.th }, knee: { value: bloom.knee } });
  const mDown = fsMat('uniform sampler2D t;uniform vec2 px;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*4.;c+=texture2D(t,vUv+px*vec2(-1,-1)).rgb+texture2D(t,vUv+px*vec2(1,-1)).rgb+texture2D(t,vUv+px*vec2(-1,1)).rgb+texture2D(t,vUv+px*vec2(1,1)).rgb;gl_FragColor=vec4(c/8.,1.);}', { t: { value: null }, px: { value: new THREE.Vector2() } });
  const mUp = fsMat(`uniform sampler2D t;uniform vec2 px;varying vec2 vUv;void main(){vec3 c=vec3(0.);
 c+=texture2D(t,vUv+px*vec2(-1,0)).rgb*2.+texture2D(t,vUv+px*vec2(1,0)).rgb*2.+texture2D(t,vUv+px*vec2(0,-1)).rgb*2.+texture2D(t,vUv+px*vec2(0,1)).rgb*2.;
 c+=texture2D(t,vUv+px*vec2(-1,-1)).rgb+texture2D(t,vUv+px*vec2(1,-1)).rgb+texture2D(t,vUv+px*vec2(-1,1)).rgb+texture2D(t,vUv+px*vec2(1,1)).rgb;gl_FragColor=vec4(c/12.,1.);}`, { t: { value: null }, px: { value: new THREE.Vector2() } }, { blending: THREE.AdditiveBlending, transparent: true });
  const mComp = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { tS: { value: null }, tB: { value: null }, str: { value: bloom.str } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform sampler2D tS;uniform sampler2D tB;uniform float str;varying vec2 vUv;
void main(){vec3 c=texture2D(tS,vUv).rgb+texture2D(tB,vUv).rgb*str;gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
gl_FragColor.rgb+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;}`,
  });
  let bl = [];
  const db = new THREE.Vector2();
  let failed = false;
  function sizeBloom() {
    const gs = quality(renderer);
    renderer.getDrawingBufferSize(db);
    const samples = msaa();
    if (rt.samples !== samples) {
      rt.dispose();
      rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples, depthBuffer: true });
    }
    rt.setSize(db.x, db.y);
    bl.forEach((t) => t.dispose());
    bl = [];
    let w = Math.max(1, Math.round(db.x / gs.bloomDiv));
    let h = Math.max(1, Math.round(db.y / gs.bloomDiv));
    for (let i = 0; i < gs.bloomLv; i++) {
      bl.push(new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false }));
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
  }
  function fs(m, t) {
    fsq.material = m;
    renderer.setRenderTarget(t);
    renderer.render(fsScene, fsCam);
  }
  const stats = { calls: 0, tris: 0, tex: 0, geo: 0 };
  function render(scene, camera) {
    if (failed) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      stats.calls = renderer.info.render.calls;
      stats.tris = renderer.info.render.triangles;
      renderer.info.reset();
      return;
    }
    try {
      renderer.getDrawingBufferSize(db);
      if (rt.width !== db.x || rt.height !== db.y || !bl.length) sizeBloom();
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, camera);
      const on = bloom.str > 0 && qs.get('bloom') !== '0';
      if (on && bl.length) {
        mBright.uniforms.t.value = rt.texture;
        mBright.uniforms.px.value.set(1 / db.x, 1 / db.y);
        fs(mBright, bl[0]);
        for (let i = 1; i < bl.length; i++) {
          mDown.uniforms.t.value = bl[i - 1].texture;
          mDown.uniforms.px.value.set(1 / bl[i - 1].width, 1 / bl[i - 1].height);
          fs(mDown, bl[i]);
        }
        for (let i = bl.length - 1; i > 0; i--) {
          mUp.uniforms.t.value = bl[i].texture;
          mUp.uniforms.px.value.set(1 / bl[i].width, 1 / bl[i].height);
          renderer.autoClear = false;
          fs(mUp, bl[i - 1]);
          renderer.autoClear = true;
        }
      }
      mComp.uniforms.tS.value = rt.texture;
      mComp.uniforms.tB.value = bl[0] ? bl[0].texture : rt.texture;
      mComp.uniforms.str.value = on && bl.length ? bloom.str : 0;
      fs(mComp, null);
      stats.calls = renderer.info.render.calls;
      stats.tris = renderer.info.render.triangles;
      stats.tex = renderer.info.memory.textures;
      stats.geo = renderer.info.memory.geometries;
      renderer.info.reset();
    } catch (err) {
      failed = true;
      console.error(err);
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
  }
  return {
    render,
    stats,
    invalidate() { bl.forEach((t) => t.dispose()); bl = []; },
    bloom0: () => (bl[0] ? [bl[0].width, bl[0].height] : null),
    hdr: () => [rt.width, rt.height, rt.samples],
    levels: () => bl.length,
  };
}

export function createBhCache() {
  const bh = createBlackHole();
  const { mesh, mat } = bh;
  mesh.layers.set(2);
  mesh.frustumCulled = false;
  let rt = null;
  const compMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    fog: false,
    toneMapped: false,
    uniforms: { t: { value: null }, res: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D t;uniform vec2 res;void main(){gl_FragColor=texture2D(t,gl_FragCoord.xy/max(res,vec2(1.)));}',
  });
  const quad = new THREE.Mesh(mesh.geometry, compMat);
  quad.frustumCulled = false;
  quad.renderOrder = mesh.renderOrder;
  const db = new THREE.Vector2();
  const prevP = new Float32Array(16);
  const prevCam = new THREE.Vector3();
  const prevQ = new THREE.Quaternion();
  const prevBh = new THREE.Vector3();
  let prevRs = -1;
  let prevDim = -1;
  let prevT = -1;
  let valid = false;
  let failed = false;
  const stats = { cached: false, w: 0, h: 0, steps: 0 };
  const clear = new THREE.Color();
  function remember(camera) {
    prevP.set(camera.projectionMatrix.elements);
    prevCam.copy(camera.position);
    prevQ.copy(camera.quaternion);
    prevBh.copy(mat.uniforms.bhPos.value);
    prevRs = mat.uniforms.Rs.value;
    prevDim = mat.uniforms.dim.value;
    prevT = mat.uniforms.uTime.value;
    valid = true;
  }
  function pxShift(camera, world) {
    const dist = Math.max(camera.position.distanceTo(mat.uniforms.bhPos.value), 1);
    const worldPerPx = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(db.y, 1);
    return world / Math.max(worldPerPx, 1e-6);
  }
  function stale(camera) {
    if (!valid) return true;
    const e = camera.projectionMatrix.elements;
    for (let i = 0; i < 16; i++) if (Math.abs(e[i] - prevP[i]) > 8e-4) return true;
    if (pxShift(camera, camera.position.distanceTo(prevCam)) > 0.8) return true;
    if (camera.quaternion.angleTo(prevQ) > 0.0012) return true;
    if (pxShift(camera, mat.uniforms.bhPos.value.distanceTo(prevBh)) > 0.8) return true;
    if (Math.abs(mat.uniforms.Rs.value - prevRs) > 0.02) return true;
    if (Math.abs(mat.uniforms.dim.value - prevDim) > 0.03) return true;
    if (Math.abs(mat.uniforms.uTime.value - prevT) > 0.09) return true;
    return false;
  }
  function render(renderer, scene, camera) {
    const gs = quality(renderer);
    mat.uniforms.uSteps.value = gs.bhSteps;
    stats.steps = gs.bhSteps;
    mesh.position.copy(quad.position);
    mesh.quaternion.copy(quad.quaternion);
    mesh.scale.copy(quad.scale);
    mesh.visible = quad.visible && quad.scale.x > 0.001;
    if (failed || !mesh.visible) {
      stats.cached = false;
      return;
    }
    renderer.getDrawingBufferSize(db);
    const w = Math.max(2, Math.round(db.x * gs.bhScale));
    const h = Math.max(2, Math.round(db.y * gs.bhScale));
    if (!rt) {
      rt = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
        magFilter: THREE.LinearFilter,
        minFilter: THREE.LinearFilter,
      });
      rt.texture.colorSpace = THREE.NoColorSpace;
      compMat.uniforms.t.value = rt.texture;
    } else if (rt.width !== w || rt.height !== h) {
      rt.setSize(w, h);
      valid = false;
    }
    stats.w = w;
    stats.h = h;
    compMat.uniforms.res.value.copy(db);
    if (!stale(camera)) {
      stats.cached = true;
      return;
    }
    stats.cached = false;
    const prevTarget = renderer.getRenderTarget();
    const prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clear);
    const mask = camera.layers.mask;
    try {
      camera.layers.set(2);
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      renderer.render(scene, camera);
      remember(camera);
    } catch (err) {
      failed = true;
      mesh.layers.set(0);
      quad.visible = false;
      console.error(err);
    } finally {
      camera.layers.mask = mask;
      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(clear, prevAlpha);
    }
  }
  return { mesh, mat, quad, render, stats };
}
