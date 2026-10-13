import * as THREE from 'three';import {CSS2DRenderer,CSS2DObject} from 'three/addons/CSS2DRenderer.js';
const qs=new URLSearchParams(location.search);
const cssLink=document.createElement('link');
cssLink.rel='stylesheet';
cssLink.href=new URL('./kitchen.css', import.meta.url).href;
await new Promise((resolve, reject) => { cssLink.onload = resolve; cssLink.onerror = () => reject(new Error('kitchen.css')); document.head.appendChild(cssLink); });
document.body.classList.add('kitchen');
for (const sel of ['#key', '#trail', '#pop', '#labels', '.controls', '#gfxHint']) {
  document.querySelectorAll(sel).forEach((el) => { el.style.display = 'none'; });
}
const searchCol = document.querySelector('#top .search');
if (searchCol) searchCol.style.display = 'none';
const mapHint = document.getElementById('hint');
if (mapHint) { mapHint.removeAttribute('id'); mapHint.style.display = 'none'; }
const sceneEl = document.getElementById('scene');
const cv = document.createElement('canvas');
cv.id = 'c';
sceneEl.appendChild(cv);
document.querySelector('#top .hright').insertAdjacentHTML('afterbegin', '<span class="chip" id="visited">Stations visited <b>0</b> / 27</span><span class="seg" id="pace" role="group" aria-label="Motion"><span role="button" tabindex="0" data-pace="cozy">Cozy</span><span role="button" tabindex="0" data-pace="fast">Fast</span></span>');
document.body.insertAdjacentHTML('beforeend', '<div id="rail"></div><div id="ticket"></div><div id="card"></div><div id="legend"><div><i style="background:#8DAE86"></i>Station · a skill (click to open)</div><div><i style="background:#C98A5A;border-radius:0 0 6px 6px"></i>Mise en place · its references and scripts</div><div><i style="background:#F2C46B"></i>House rules · principles on the wall</div><div><i style="background:#FFF8EC"></i>Ticket · a playbook, fired from the rail</div></div><footer>Click a ticket to fire it · click a station to open it · <b>Esc</b> to step back</footer>');
let G;
try {
  const res = await fetch(new URL('data/graph.json', import.meta.url));
  if (!res.ok) throw new Error('status');
  G = await res.json();
  if (!Array.isArray(G.nodes) || !Array.isArray(G.edges)) throw new Error('shape');
} catch {
  document.getElementById('boot')?.remove();
  const err = document.getElementById('err');
  if (err) { document.getElementById('errReason').textContent = 'The map data is unavailable.'; err.hidden = false; }
  throw new Error('graph unavailable');
}
const N = new Map(G.nodes.map((n) => [n.id, n]));
const textByPath = new Map(G.nodes.filter((n) => typeof n.text === 'string' && n.text && n.path).map((n) => [n.path, n.text]));

const nm=n=>(n.title||n.name).replace(/^principle-/,'').replace(/-/g,' ').replace(/^./,c=>c.toUpperCase());
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
const skills=G.nodes.filter(n=>n.kind==='skill').sort((a,b)=>b.degree.total-a.degree.total);
const router=G.nodes.find(n=>n.kind==='router');const principles=G.nodes.filter(n=>n.kind==='principle');
const playbooks=G.nodes.filter(n=>n.kind==='playbook').sort((a,b)=>b.degree.total-a.degree.total);
const misen=id=>G.nodes.filter(n=>(n.kind==='reference'||n.kind==='script')&&n.owner===id);
const usedIn=id=>G.edges.filter(e=>e.target===id&&N.get(e.source)?.kind==='playbook').map(e=>N.get(e.source));
// deterministic randomness so stills are repeatable
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
// ---------- renderer + orthographic iso camera ----------
const R=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,preserveDrawingBuffer:true});R.setPixelRatio(Math.min(devicePixelRatio,2));R.setClearColor(0,0);
R.outputColorSpace=THREE.SRGBColorSpace;const scene=new THREE.Scene();
const cam=new THREE.OrthographicCamera(-1,1,1,-1,-200,400);const ISO=new THREE.Vector3(1,.95,1).normalize();
let view={c:new THREE.Vector3(0,2.2,-1),h:33};
const LR=new CSS2DRenderer();LR.domElement.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:3';document.body.appendChild(LR.domElement);
function size(){R.setSize(innerWidth,innerHeight);LR.setSize(innerWidth,innerHeight);}size();addEventListener('resize',size);
function place(){const a=innerWidth/innerHeight,h=view.h;cam.left=-h*a/2;cam.right=h*a/2;cam.top=h/2;cam.bottom=-h/2;cam.position.copy(view.c).addScaledVector(ISO,100);cam.lookAt(view.c);
 const panel=(card.style.display==='block'||tkt.style.display==='block')?360:0;cam.setViewOffset(innerWidth,innerHeight,panel/2,-59,innerWidth,innerHeight);cam.updateProjectionMatrix();}
const card=document.getElementById('card'),tkt=document.getElementById('ticket');
// ---------- materials: three canvas matcaps (ceramic, metal, glossy glaze); no lights, no textures beyond these ----------
function mc(stops,spec,streak){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
 let r=g.createRadialGradient(92,80,6,128,128,134);stops.forEach(([o,col])=>r.addColorStop(o,col));g.fillStyle=r;g.fillRect(0,0,256,256);
 if(streak){for(let i=0;i<7;i++){g.fillStyle=`rgba(255,255,255,${.05+.05*(i%3)})`;g.fillRect(0,40+i*28,256,6+(i%2)*6);}}
 if(spec){r=g.createRadialGradient(86,72,0,86,72,spec);r.addColorStop(0,'rgba(255,255,255,.95)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,256,256);}
 r=g.createRadialGradient(190,206,10,180,196,120);r.addColorStop(0,'rgba(80,50,40,.35)');r.addColorStop(1,'rgba(80,50,40,0)');g.fillStyle=r;g.fillRect(0,0,256,256);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const MC=mc([[0,'#FFFFFF'],[.35,'#F3E8D9'],[.75,'#BBA38C'],[1,'#6E5747']],0),MSOFT=mc([[0,'#E3E7EB'],[.3,'#C3CAD1'],[.6,'#8D959E'],[.85,'#A2A9B0'],[1,'#3F454B']],46,true),MS=mc([[0,'#FFFFFF'],[.3,'#D9DEE4'],[.6,'#8D959E'],[.85,'#C7CDD3'],[1,'#4B5157']],46,true),MG=mc([[0,'#FFFFFF'],[.3,'#F6EDE2'],[.7,'#B39C86'],[1,'#5F4A3C']],38);
const M=(col,m=MC)=>new THREE.MeshMatcapMaterial({matcap:m,color:col});const MI=(m=MC)=>new THREE.MeshMatcapMaterial({matcap:m});
// bevelled box: a rounded-rect extrusion with a soft bevel (PlateUp-style "good shapes, no textures")
const RB=new Map();function rbox(w,h,d,r=.07){const k=[w,h,d,r].join();if(RB.has(k))return RB.get(k);r=Math.min(r,w/4,h/4,d/4);
 const s=new THREE.Shape(),x=w/2-r,y=h/2-r,q=r*.6;s.moveTo(-x+q,-y);s.lineTo(x-q,-y);s.quadraticCurveTo(x,-y,x,-y+q);s.lineTo(x,y-q);s.quadraticCurveTo(x,y,x-q,y);s.lineTo(-x+q,y);s.quadraticCurveTo(-x,y,-x,y-q);s.lineTo(-x,-y+q);s.quadraticCurveTo(-x,-y,-x+q,-y);
 const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:4,curveSegments:6});g.translate(0,0,-(d-2*r)/2);g.computeVertexNormals();RB.set(k,g);return g;}
// instanced helper: add(pos, rotY, scale, colour)
function inst(geo,mat,max){const m=new THREE.InstancedMesh(geo,mat,max);m.count=0;scene.add(m);const o={m,add(p,ry=0,s=1,col='#ffffff',rx=0){const i=m.count++;const sc=typeof s==='number'?new THREE.Vector3(s,s,s):s;
 m.setMatrixAt(i,new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,0)),sc));m.setColorAt(i,new THREE.Color(col));return i;}};return o;}
// soft contact shadows: blurred blobs, multiplied onto the floor (fake AO, no shadow maps)
const blobT=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(0,0,0,1)');r.addColorStop(.55,'rgba(0,0,0,.55)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);})();
const blobs=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:blobT,color:'#3A2416',transparent:true,opacity:.42,depthWrite:false}),400);blobs.count=0;blobs.renderOrder=1;scene.add(blobs);
const blob=(x,y,z,w,d,ry=0)=>{blobs.setMatrixAt(blobs.count++,new THREE.Matrix4().compose(new THREE.Vector3(x,y+.012,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),ry),new THREE.Vector3(w,1,d)));};
// ---------- room: irregular floor (notch + chamfer), raised nook with steps, cut-away walls, window ----------
const FLOOR=[[-16,-12],[16,-12],[16,2],[11,2],[11,12],[-10,12],[-16,6]];
const inFloor=(x,z)=>{let c=false;for(let i=0,j=FLOOR.length-1;i<FLOOR.length;j=i++){const [xi,zi]=FLOOR[i],[xj,zj]=FLOOR[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
{const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');const cols=['#E9D7BC','#C9764F'];for(let i=0;i<8;i++)for(let j=0;j<8;j++){g.fillStyle=cols[(i+j)%2];g.fillRect(i*64,j*64,64,64);
  g.fillStyle=`rgba(${(i*7+j*3)%2?255:60},${(i*7+j*3)%2?240:40},${(i*7+j*3)%2?220:30},${.04+((i*5+j*11)%7)*.012})`;g.fillRect(i*64,j*64,64,64);}
 g.strokeStyle='rgba(70,45,30,.3)';g.lineWidth=3;for(let i=0;i<=8;i++){g.beginPath();g.moveTo(i*64,0);g.lineTo(i*64,512);g.stroke();g.beginPath();g.moveTo(0,i*64);g.lineTo(512,i*64);g.stroke();}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/8,1/8);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
 const sh=new THREE.Shape(FLOOR.map(([x,z])=>new THREE.Vector2(x,-z)));const g2=new THREE.ExtrudeGeometry(sh,{depth:.6,bevelEnabled:false});g2.rotateX(-Math.PI/2);g2.translate(0,-.6,0);
 scene.add(new THREE.Mesh(g2,[new THREE.MeshMatcapMaterial({matcap:MC,map:t,color:'#FFF4E4'}),M('#9C6E4C')]));}
const wallM=M('#E6C9A3');const W=(x,y,z,w,h,d,m=wallM)=>{const o=new THREE.Mesh(rbox(w,h,d,.06),m);o.position.set(x,y,z);scene.add(o);return o;};
W(0,4.6,-12.3,32.6,9.2,.6);W(-16.3,4.6,-3,.6,9.2,18.6);W(16.2,.7,-5,.4,1.4,14,M('#D9B98F'));   // back, left, low cut-away half wall on the right
W(0,9.25,-11.95,32.4,.3,.3,M('#9D6B4A'));W(-15.95,9.25,-3,.3,.3,18.4,M('#9D6B4A'));
// splashback tiles (sage, a row of soft bevelled tiles)
{const tl=inst(rbox(.56,.56,.08,.04),MI(MG),420);for(let x=-15.6;x<=5.8;x+=.6)for(let y=2.6;y<=3.9;y+=.6)if(!(x>1.3&&x<5.2&&y>3.6))tl.add(new THREE.Vector3(x,y,-11.97),0,1,(Math.round(x*5+y*3)%5)?'#A9C8BA':'#C2D9CE');
 for(let z=-11.4;z<=5.4;z+=.6)for(let y=2.6;y<=3.9;y+=.6)tl.add(new THREE.Vector3(-15.97,y,z),Math.PI/2,1,(Math.round(z*5+y*3)%5)?'#A9C8BA':'#C2D9CE');}
// window with a warm evening sky, sill plants
{const f=W(3.25,5.3,-11.98,4.1,3.3,.25,M('#F6EEDF'));const sky=new THREE.Mesh(new THREE.PlaneGeometry(3.5,2.7),new THREE.MeshBasicMaterial({map:(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const g=c.getContext('2d');const r=g.createLinearGradient(0,0,0,64);r.addColorStop(0,'#F7B886');r.addColorStop(.6,'#F9D9A8');r.addColorStop(1,'#FCE9C6');g.fillStyle=r;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})()}));sky.position.set(3.25,5.3,-11.84);scene.add(sky);
 W(3.25,5.3,-11.8,.12,2.7,.1,M('#F6EEDF'));W(3.25,5.3,-11.8,3.5,.12,.1,M('#F6EEDF'));W(3.25,3.55,-11.6,4.4,.18,.6,M('#C08A5C'));}
// raised nook (pastry corner): platform, front edge, steps
const NOOK={x0:6,x1:16,z0:-12,z1:-5,h:.9};
W(11,NOOK.h/2,-8.5,10,NOOK.h,7,M('#B07A52'));{const t=inst(rbox(1.25,.3,1,.05),MI(),12);for(let i=0;i<3;i++)t.add(new THREE.Vector3(9.5,.15+i*.3*0,-4.5+.0),0,new THREE.Vector3(2.4,1+i*0,1));}
const steps=[[9.5,.3,-4.55,3,.3,.5],[9.5,.6,-4.85,3,.3,.4]];steps.forEach(s=>W(...s,M('#C99167')));
// ---------- stations: 27 skills on an L-run, the raised nook, a prep island and a peninsula ----------
const MW=2.3,ST=[];
{const S=[];for(let i=0;i<8;i++)S.push({p:new THREE.Vector3(-13.9+i*MW,0,-10.9),ry:0,run:0});
 for(let i=0;i<7;i++)S.push({p:new THREE.Vector3(-14.9,0,-8.4+i*MW),ry:Math.PI/2,run:1});
 for(let i=0;i<4;i++)S.push({p:new THREE.Vector3(7.4+i*MW,NOOK.h,-10.9),ry:0,run:2});
 for(let i=0;i<4;i++)S.push({p:new THREE.Vector3(-9.7+i*MW,0,5.6),ry:0,run:3});   // v2.3: island moved .9 right so the left run's end cabinet has room for its cook
 for(let i=0;i<4;i++)S.push({p:new THREE.Vector3(7.7+i*MW,0,-1.6),ry:0,run:4});
 const C=new THREE.Vector3(0,0,.5);const ord=S.map(s=>({s,d:s.p.distanceTo(C)+(s.run===2?3:0)})).sort((a,b)=>a.d-b.d);
 {const m=S.find(t=>t.run===2&&Math.abs(t.p.x-7.4)<.01);m.p=new THREE.Vector3(15.0,NOOK.h,-6.5);m.ry=-Math.PI/2;}   /* v2.7: the first nook cabinet turns to the nook's open end so the back door is in view; mapping order was fixed above from the original slots */
 skills.forEach((n,k)=>ST.push({n,...ord[k].s}));}
const RUNC=['#8DAE86','#7FA3B5','#E8C27A','#D99A6C','#9CB8AE'];   // paint per run (no meaning): sage, blue-grey, butter nook, apricot island, mint peninsula
const cab=inst(rbox(MW-.1,2.05,1.9,.1),MI(),27),top=inst(rbox(MW+.04,.2,2.12,.06),MI(MG),27),plinth=inst(new THREE.BoxGeometry(MW-.3,.18,1.6),M('#3C2A20'),27);
// v2.3 doors: two sliding leaves on tracks in front of the carcass (no swing arc, so nothing in front of a cabinet can ever be hit).
// carcass front at local z .95 · 20 mm gap · back leaf (fixed, right half) z .97–1.03 · front leaf (slides right over it) z 1.04–1.10 · pull proud to 1.13
const leafG=rbox(.97,1.42,.06,.02);const door=new THREE.InstancedMesh(leafG,MI(),27),doorB=new THREE.InstancedMesh(leafG,MI(),27);scene.add(door,doorB);
const panelG=rbox(.68,.95,.02,.01).clone();panelG.translate(0,0,.035);const dpanel=new THREE.InstancedMesh(panelG,MI(),27),bpanel=new THREE.InstancedMesh(panelG,MI(),27);scene.add(dpanel,bpanel);
const knobG=new THREE.CylinderGeometry(.035,.035,.42,20);knobG.translate(-.38,0,.09);const knob=new THREE.InstancedMesh(knobG,M('#E7C48B',MS),27);scene.add(knob);
const dinner=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.9,1.42),new THREE.MeshBasicMaterial({color:'#2A1C14'}),27);scene.add(dinner);   // the dark inside, revealed as the leaf slides
ST.forEach((s,i)=>{s.q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),s.ry);s.fwd=new THREE.Vector3(0,0,1).applyQuaternion(s.q);s.side=new THREE.Vector3(1,0,0).applyQuaternion(s.q);s.ang=0;s.target=0;
 const c=RUNC[s.run];cab.add(s.p.clone().setY(s.p.y+1.13),s.ry,1,c);top.add(s.p.clone().setY(s.p.y+2.25).addScaledVector(s.fwd,.05),s.ry,1,'#C99167');plinth.add(s.p.clone().setY(s.p.y+.09).addScaledVector(s.fwd,.1),s.ry,1,'#3C2A20');
 door.setColorAt(i,new THREE.Color(c).offsetHSL(0,.02,.05));dpanel.setColorAt(i,new THREE.Color(c).offsetHSL(0,0,-.04));doorB.setColorAt(i,new THREE.Color(c).offsetHSL(0,.02,.02));bpanel.setColorAt(i,new THREE.Color(c).offsetHSL(0,0,-.06));
 blob(...s.p.clone().addScaledVector(s.fwd,.55).toArray(),MW*1.25,3.2,s.ry);});
// v2.5: doors always open on the cook's side. The peninsula is now worked from the room side like every other run (was: cooks behind it, doors in front).
const doorQ=s=>s.q;
function doorM(s,i){const u=s.ang,dq=doorQ(s);const at=(x,z)=>new THREE.Matrix4().compose(s.p.clone().add(new THREE.Vector3(x,1.22,z).applyQuaternion(dq)),dq,new THREE.Vector3(1,1,1));
 const mf=at(-.475+.93*u,1.07),mb=at(.475,1.0);door.setMatrixAt(i,mf);dpanel.setMatrixAt(i,mf);knob.setMatrixAt(i,mf);doorB.setMatrixAt(i,mb);bpanel.setMatrixAt(i,mb);dinner.setMatrixAt(i,at(0,.957));}
ST.forEach(doorM);
// island back shelf and stools, peninsula end panel
W(-6.25,1.1,4.35,9.4,2.2,.5,M('#B98258'));{const st=inst(new THREE.CylinderGeometry(.42,.36,.16,40),MI(MG),8),leg=inst(new THREE.CylinderGeometry(.06,.06,1.3,16),MI(MS),8);
 [].forEach(([x,z])=>{st.add(new THREE.Vector3(x,1.35,z),0,1,'#D9604A');leg.add(new THREE.Vector3(x,.65,z),0,1,'#8D959E');blob(x,0,z,1.2,1.2);});}
// glow under lit stations
const glowT=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,214,140,.95)');r.addColorStop(.5,'rgba(255,180,90,.35)');r.addColorStop(1,'rgba(255,170,80,0)');g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);})();
ST.forEach(s=>{const g=new THREE.Mesh(new THREE.PlaneGeometry(MW+1.6,3.6),new THREE.MeshBasicMaterial({map:glowT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));g.rotation.x=-Math.PI/2;g.rotation.z=s.ry;g.position.copy(s.p).setY(s.p.y+.03).addScaledVector(s.fwd,1.5);scene.add(g);s.glow=g;
 const l=document.createElement('div');l.className='lb';l.textContent=s.n.name;const o=new CSS2DObject(l);o.position.copy(s.p).setY(s.p.y+3.05).addScaledVector(s.fwd,.5);scene.add(o);s.lb=l;});
// ---------- mise en place (real data): glazed bowls (references) and steel pots (scripts) on each station's worktop ----------
const BOWLS=[];{const MP=ST.flatMap(s=>misen(s.n.id).map((n,j)=>({s,n,j})));const rim=inst(new THREE.TorusGeometry(.235,.025,10,40).rotateX(Math.PI/2),MI(MG),MP.length+4);const bw=inst(new THREE.CylinderGeometry(.24,.15,.22,36),MI(MG),MP.length+4),fd=inst(new THREE.SphereGeometry(.2,28,16,0,Math.PI*2,0,Math.PI/2),MI(MG),MP.length+4);
 MP.forEach((b,i)=>{const k=b.j%5,r=Math.floor(b.j/5);const p=b.s.p.clone().setY(b.s.p.y+2.47).addScaledVector(b.s.side,-.82+k*.41).addScaledVector(b.s.fwd,-.5+r*.45);
  rim.add(p.clone().setY(p.y+.11),0,1,'#FFFDF8');BOWLS.push({s:b.s,n:b.n,p:p.clone()});bw.add(p,0,1,b.n.kind==='script'?'#B9C0C8':['#F4EDE2','#9EC1B4','#E7B07A','#F2C46B'][i%4]);fd.add(p.clone().setY(p.y+.06),0,new THREE.Vector3(1,.55,1),['#D9604A','#7FA37A','#F2C46B','#B5653E','#E9A23B'][(i*3)%5]);});}
// ---------- the pass: steel island, heat lamps, hanging pan rack, ticket printer, plates ----------
let leaf,PASSLB,RULESLB;const PASS=new THREE.Vector3(0,0,.5);const LAMPS=[],POTS=[],LEAVES=[];
{W(0,1.05,.5,9,2.1,2.6,M('#AEB6BE',MSOFT));W(0,2.2,.5,9.4,.18,3,M('#C9CFD5',MSOFT));
 // v2.4 edge definition: a fine warm-dark outline on the top and body so the pass reads as the hero without glare
 [[0,2.2,.5,9.4,.18,3],[0,1.05,.5,9,2.1,2.6]].forEach(([x,y,z,w,h,d])=>{const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w,h,d)),new THREE.LineBasicMaterial({color:'#4A3B31',transparent:true,opacity:.55}));e.position.set(x,y,z);scene.add(e);});
 W(0,2.07,1.97,9.3,.06,.06,M('#6E5747',MG));W(0,.12,.5,8.6,.24,2.2,M('#3C2A20'));blob(0,0,.7,11,5.2);
 // heat-lamp shelf (the classic pass) on two posts
 W(-4.2,3.3,.1,.14,2.2,.14,M('#B9C0C8',MS));W(4.2,3.3,.1,.14,2.2,.14,M('#B9C0C8',MS));W(0,4.4,.1,8.8,.16,1.1,M('#DDE2E8',MS));
 for(let i=-1;i<=1;i++){const l=new THREE.Mesh(new THREE.CylinderGeometry(.5,.62,.25,48),M('#D9604A',MG));l.position.set(i*2.8,4.22,.1);scene.add(l);
  const g=new THREE.Mesh(new THREE.PlaneGeometry(2.8,2.3),new THREE.MeshBasicMaterial({map:glowT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.26}));g.rotation.x=-Math.PI/2;g.position.set(i*2.8,2.31,.6);scene.add(g);LAMPS.push(g);}
 // pan rack: a copper rail on chains with pans and a ladle
 W(0,9.4,-1.3,5.6,.12,.12,M('#C9824F',MS));[-2.6,2.6].forEach(x=>W(x,10.2,-1.3,.05,1.6,.05,M('#8D959E',MS)));   // v2.4: rack raised and pushed back, three pans
 const pan=inst(new THREE.CylinderGeometry(.55,.45,.14,48),MI(MS),8),hdl=inst(new THREE.BoxGeometry(.1,.9,.06),MI(MS),8);
 [[-1.9,.5,'#C9824F'],[0,.6,'#4B5157'],[1.9,.46,'#C9824F']].forEach(([x,s,c])=>{pan.add(new THREE.Vector3(x,8.2-s*.8,-1.32),0,new THREE.Vector3(s/.55,1,s/.55),c,Math.PI/2);hdl.add(new THREE.Vector3(x,8.9-s*.3,-1.32),0,1,'#5A4434');});
 const l=document.createElement('div');l.className='lb pass';l.textContent='The pass · '+router.name;const o=new CSS2DObject(l);o.position.set(0,5.3,.1);scene.add(o);PASSLB=l;}
const plates=[];for(let i=0;i<8;i++){const p=new THREE.Mesh(new THREE.CylinderGeometry(.48,.36,.08,56),M('#FFFDF8',MG));p.position.set(-3.6+i*1.03,2.34,1.25);p.visible=false;scene.add(p);
 const f=new THREE.Mesh(new THREE.SphereGeometry(.26,32,20,0,Math.PI*2,0,Math.PI/2),M(['#D9604A','#7FA37A','#E9A23B','#B5653E'][i%4],MG));f.scale.y=.7;f.position.y=.04;p.add(f);plates.push(p);}
// ---------- the range: hood, two stoves with simmering pots and steam ----------
const STEAM=[];
{const hood=new THREE.Mesh(new THREE.CylinderGeometry(1.4,2.9,1.9,8,1),M('#C9824F',MS));hood.rotation.y=Math.PI/4;hood.scale.z=.55;hood.position.set(-9.3,6.3,-11.1);scene.add(hood);W(-9.3,8.2,-11.6,1.3,2.2,1,M('#B9764A',MS));
 const rangeSt=ST.filter(s=>s.run===0).sort((a,b)=>a.p.x-b.p.x).slice(1,3);
 rangeSt.forEach((s,k)=>{const y=s.p.y+2.36;const pot=new THREE.Mesh(new THREE.CylinderGeometry(.62,.55,.75,52),M(k?'#4B5157':'#C9824F',MS));pot.position.set(s.p.x+.1,y+.38,s.p.z-.2);scene.add(pot);
  const lid=new THREE.Mesh(new THREE.SphereGeometry(.6,44,16,0,Math.PI*2,0,Math.PI/2.6),M('#D9DEE4',MS));lid.position.set(pot.position.x,y+.76,pot.position.z);scene.add(lid);POTS.push({lid,y0:lid.position.y});STEAM.push(new THREE.Vector3(pot.position.x,y+.95,pot.position.z));});
    // a whisper of steam from the pass pans? no: from the hot plates, kept faint
 STEAM.pop();}
const steamT=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,.9)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const SN=36*STEAM.length,sPos=new Float32Array(SN*3),sLife=new Float32Array(SN).map(()=>rnd());const sGeo=new THREE.BufferGeometry();sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
const sMat=new THREE.PointsMaterial({map:steamT,size:28*R.getPixelRatio(),transparent:true,depthWrite:false,opacity:.16,color:'#FFFFFF',sizeAttenuation:false});const steam=new THREE.Points(sGeo,sMat);scene.add(steam);
// steam curls: each wisp spirals up a slowly drifting helix that widens as it rises, and shrinks to nothing at the top (soft-sprite size is fixed, so it fades by spreading)
function updSteam(dt,T=0){for(let i=0;i<SN;i++){sLife[i]+=dt*.14;if(sLife[i]>1)sLife[i]-=1;const L=sLife[i],o=STEAM[i%STEAM.length],a=L*7+i*2.1+T*.6,r=.12+L*.55;
 sPos.set([o.x+Math.cos(a)*r+Math.sin(T*.35+i)*.15*L,o.y+L*2.6+Math.sin(T*1.3+i)*.05,o.z+Math.sin(a)*r*.7],i*3);}sGeo.attributes.position.needsUpdate=true;}
// ---------- clutter: shelves of jars, house-rule plaques, crates, sacks, plants, rug, cutting boards ----------
{const sh=inst(rbox(1,.14,.7,.04),MI(),12);[[-3.2,4.9],[-3.2,6.4]].forEach(([x,y])=>{sh.add(new THREE.Vector3(x,y,-11.62),0,new THREE.Vector3(7.6,1,1),'#B98258');});sh.add(new THREE.Vector3(11,5.8,-11.62),0,new THREE.Vector3(8.4,1,1),'#B98258');
 const jar=inst(new THREE.CylinderGeometry(.22,.22,.6,32),MI(MG),80),lid=inst(new THREE.CylinderGeometry(.24,.24,.1,32),MI(MS),80);
 const JC=['#F2C46B','#D9604A','#9EC1B4','#E7B07A','#F4EDE2','#7FA37A','#B5653E'];
 [[-6.6,0.4,4.97],[-6.6,0.4,6.47],[7.2,14.6,5.87]].forEach(([a,b,y])=>{for(let x=a;x<b;x+=.52+rnd()*.25){if(rnd()<.15)continue;const h=.7+rnd()*.7;jar.add(new THREE.Vector3(x,y+.3*h,-11.55),0,new THREE.Vector3(1+rnd()*.25,h,1+rnd()*.25),JC[Math.floor(rnd()*JC.length)]);lid.add(new THREE.Vector3(x,y+.6*h+.05,-11.55),0,1,'#C9CED6');}});
 // house rules: a framed plaque per principle on the left wall (data), lit when a ticket uses them
 window.PL=principles.map((n,i)=>({n,p:new THREE.Vector3(-15.92,6.3+Math.floor(i/12)*1.35,-10.4+(i%12)*1.32)}));
 const fr=inst(rbox(.12,1.1,1.12,.03),M('#8A5E40'),PL.length);window.plq=inst(rbox(.06,.86,.9,.02),MI(),PL.length);PL.forEach(x=>{fr.add(x.p,0,1,'#8A5E40');plq.add(x.p.clone().setX(x.p.x+.06),0,1,'#FFF8EC');});
 const l=document.createElement('div');l.className='lb';l.textContent='House rules · '+PL.length;RULESLB=l;const o=new CSS2DObject(l);o.position.set(-15.8,8.9,-3.2);scene.add(o);
 // crates and sacks in the chamfer corner and by the nook
 const cr=inst(rbox(1.2,.9,1.2,.06),MI(),8);[[-12.6,.45,9.4,.2],[-11.3,.45,10.2,-.15],[-12,1.35,9.8,.5]].forEach(([x,y,z,r])=>{cr.add(new THREE.Vector3(x,y,z),r,1,'#C08A5C');if(y<1)blob(x,0,z,2,2,r);});
 const sk=inst(new THREE.SphereGeometry(.6,36,24),MI(),6);[[-14.6,.5,9.2],[-15.1,.45,7.7]].forEach(([x,y,z])=>{sk.add(new THREE.Vector3(x,y,z),rnd()*3,new THREE.Vector3(1,.85,.9),'#E2CFA8');blob(x,0,z,1.7,1.7);});
 // plants: terracotta pots with clusters of leaves (Ooblets: simplified shapes, several greens)
 const pot=inst(new THREE.CylinderGeometry(.42,.32,.7,36),MI(MG),12);leaf=inst(new THREE.IcosahedronGeometry(.42,1),MI(MG),160);
 const PLANT=(x,y,z,s=1,n=9)=>{pot.add(new THREE.Vector3(x,y+.35*s,z),0,s,'#C9764F');if(y<.1)blob(x,0,z,1.6*s,1.6*s);for(let i=0;i<n;i++){const a=i*2.4,r=.25*s*(i%3?1:.3),h=y+.8*s+(i%4)*.22*s;const P=new THREE.Vector3(x+Math.cos(a)*r,h,z+Math.sin(a)*r),S=new THREE.Vector3(.75*s,.55*s,1.05*s);LEAVES.push({i:leaf.add(P,a,S,['#6F9A62','#86B074','#5B8752','#A3C48C'][i%4]),P,a,S,base:new THREE.Vector3(x,y+.6*s,z),k:x*.7+z*.3});}};
 PLANT(-15,0,5.2+3.6,1.5,14);PLANT(1.9,3.65,-11.6,.6,7);PLANT(4.6,3.65,-11.6,.55,6);/* v2.6: nook plant removed for the back-door approach */PLANT(15.2,6.1,-11.5,.6,7);PLANT(15.0,0,3.4,1.1,10);PLANT(-15.2,0,-11.2+.5,0,0);
 // rug runner in the main aisle, cutting boards on a few worktops
 const rug=W(-5.5,.03,-6.6,16,.05,2.2,M('#B5553E'));const rug2=W(-5.5,.035,-6.6,15.4,.05,1.7,M('#D9774F'));
 const cb=inst(rbox(1,.08,.7,.03),MI(),8);ST.filter((s,i)=>i%4===1).forEach(s=>cb.add(s.p.clone().setY(s.p.y+2.39).addScaledVector(s.side,.4).addScaledVector(s.fwd,.35),s.ry+.2,1,'#D9A46C'));}
// floor AO along the walls (soft dark strips)
{const g=document.createElement('canvas');g.width=4;g.height=64;const x=g.getContext('2d');const r=x.createLinearGradient(0,0,0,64);r.addColorStop(0,'rgba(40,24,14,.55)');r.addColorStop(1,'rgba(40,24,14,0)');x.fillStyle=r;x.fillRect(0,0,4,64);const t=new THREE.CanvasTexture(g);
 const ao=(w,d,x0,z0,ry)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.rotation.y=ry;m.position.set(x0,.01,z0);m.renderOrder=1;scene.add(m);};
 ao(32,3,0,-10.5,0);ao(18,3,-14.5,-3,-Math.PI/2);ao(10,2.4,11,-4.8+.05,Math.PI);}
// automations as kitchen timers by the window; agents as chefs (below)
G.nodes.filter(n=>n.kind==='automation').forEach((n,i)=>{const t=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.18,52),M(['#F2C46B','#9EC1B4','#D99A6C','#E8D5BD'][i%4],MG));t.rotation.x=Math.PI/2;t.position.set(-1.1+i*.95,8.2,-11.9);scene.add(t);});
// ---------- chefs: plush, bouncy, each with its own apron colour; walk a grid path between stations ----------
const OBST=[[-17,-12.2,4,-9.55],[-16.2,-10,-13.45,6.7],[-11.1,4.05,-1.4,7.0],[-4.85,-1.05,4.85,2.05],[6.55,-2.8,16.3,-.3],[5.6,-12.5,6.4,-4.8],[6,-5.4,8,-4.6],[11,-5.4,16.3,-4.6],[8.4,-12.5,16.3,-9.55],[13.9,-7.75,16.3,-5.25],[-13.4,8.3,-10.4,10.9],[-16,6.9,-13.9,10],[14.2,2.6,15.8,4.2]];
const PAD=+(qs.get('pad')||.6);   // v2.3: walk clearance = body radius + arm swing (was .35: walks clipped cabinet corners and the pass)
let AVOID=[];   // v2.4: positions of standing chefs, treated as round obstacles while planning a walk
const blocked=(x,z)=>AVOID.some(a=>Math.hypot(a.x-x,a.z-z)<CR*2+.1)||!inFloor(x,z)||x>15.6||OBST.some(([a,b,c,d])=>x>a-PAD&&x<c+PAD&&z>b-PAD&&z<d+PAD);
const groundY=(x,z)=>x>NOOK.x0&&z<NOOK.z1?NOOK.h:(x>8&&x<11&&z<-3.3&&z>=-5.05)?NOOK.h*Math.min(1,(k=>k+Math.min(1,k/.08)/3)(THREE.MathUtils.clamp((-3.3-z)/1.3,0,1))):0;   /* v2.6: ride the step nosings, not the mid-ramp, so bodies clear each riser */
const CS=.5,GX=x=>Math.round((x+16)/CS),GZ=z=>Math.round((z+12)/CS),WX=i=>i*CS-16,WZ=j=>j*CS-12;
function path(a,b){const key=(i,j)=>i*100+j;const s=[GX(a.x),GZ(a.z)],t=[GX(b.x),GZ(b.z)];const prev=new Map([[key(...s),null]]);const Q=[s];
 while(Q.length){const [i,j]=Q.shift();if(i===t[0]&&j===t[1])break;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const ni=i+di,nj=j+dj,k=key(ni,nj);if(prev.has(k))continue;
  if(blocked(WX(ni),WZ(nj))&&!(ni===t[0]&&nj===t[1]))continue;if(di&&dj&&(blocked(WX(i+di),WZ(j))||blocked(WX(i),WZ(j+dj))))continue;prev.set(k,[i,j]);Q.push([ni,nj]);}}
 let c=t,pts=[];if(!prev.has(key(...t)))return [a.clone(),b.clone()];while(c){pts.push(new THREE.Vector3(WX(c[0]),0,WZ(c[1])));c=prev.get(key(...c));}pts.reverse();
 // thin the grid path to corners, then a Catmull-Rom spline (curved walks)
 const k2=[pts[0]];for(let i=1;i<pts.length-1;i++){const d1=pts[i].clone().sub(pts[i-1]),d2=pts[i+1].clone().sub(pts[i]);if(d1.angleTo(d2)>.1)k2.push(pts[i]);}k2.push(pts[pts.length-1]);k2[0]=a.clone().setY(0);k2[k2.length-1]=b.clone().setY(0);
 const k3=[k2[0]];for(let i=1;i<k2.length;i++){const d=k2[i].distanceTo(k2[i-1]);const n=Math.floor(d/1.2);for(let m=1;m<=n;m++)k3.push(k2[i-1].clone().lerp(k2[i],m/(n+1)));k3.push(k2[i]);}return k3;}   // v2.3: densified so the spline can't bow into furniture
// ================= v2.1 animation layer =================
// one deterministic clock T drives everything (live, stills and the frame-by-frame recorder); Fast / reduced motion skips it all
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let userFast=qs.get('fast')==='1';
let fast=false,CREW=true;
function applyFast(){fast=userFast||reduceMotion;CREW=!fast;document.body.classList.toggle('fast',fast);document.querySelectorAll('#pace [data-pace]').forEach((el)=>el.classList.toggle('on',el.dataset.pace===(fast?'fast':'cozy')));}
applyFast();
document.getElementById('pace').addEventListener('click',(e)=>{const b=e.target.closest('[data-pace]');if(!b)return;userFast=b.dataset.pace==='fast';applyFast();fx.visible=!fast;});
document.getElementById('pace').addEventListener('keydown',(e)=>{if(e.key!=='Enter'&&e.key!==' ')return;const b=e.target.closest('[data-pace]');if(!b)return;e.preventDefault();b.click();});
const ease={io:u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2,sin:u=>-(Math.cos(Math.PI*u)-1)/2,out:u=>1-Math.pow(1-u,3)};
const cl=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
class Spr{constructor(x=0){this.x=x;this.v=0;}step(t,K,C,dt){this.v+=(K*(t-this.x)-C*this.v)*dt;this.x+=this.v*dt;return this.x;}}
const angDiff=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
// ---------- footstep puffs and landing puffs: one instanced pool of soft discs ----------
const PUFF_N=60,puffM=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:steamT,color:'#FFF3E2',transparent:true,opacity:.6,depthWrite:false}),PUFF_N);puffM.renderOrder=2;scene.add(puffM);
const PUFFS=[];let puffI=0;const puff=(p,size=.5,life=.8,rise=0)=>{PUFFS[puffI]={p:p.clone(),age:0,size,life,rise};puffI=(puffI+1)%PUFF_N;};
const ZERO=new THREE.Matrix4().makeScale(0,0,0);for(let i=0;i<PUFF_N;i++)puffM.setMatrixAt(i,ZERO);
function updPuffs(dt){for(let i=0;i<PUFF_N;i++){const f=PUFFS[i];if(!f){continue;}f.age+=dt/f.life;if(f.age>=1){puffM.setMatrixAt(i,ZERO);PUFFS[i]=null;continue;}
 const s=f.size*(.45+ease.out(f.age)*1.1)*Math.pow(1-f.age,.6);puffM.setMatrixAt(i,new THREE.Matrix4().compose(f.p.clone().setY(f.p.y+.04+f.rise*f.age),new THREE.Quaternion(),new THREE.Vector3(s,1,s)));}puffM.instanceMatrix.needsUpdate=true;}
// ---------- chefs: a small rig with pivots for secondary motion ----------
const CHEFS=[];const APRON=['#F4EDE2','#F4EDE2','#F4EDE2','#6F93B8','#8A6FA8','#4F7CAC','#2F3B45','#B07A2A','#F4EDE2','#F4EDE2'];
function chef(i,label,home,yaw){const g=new THREE.Group();const body=new THREE.Group();g.add(body);const C={i,g,body};
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.5,.55,12,32),M('#FFFDF8'));torso.position.y=1.05;body.add(torso);
 const apP=new THREE.Group();apP.position.set(0,1.32,0);body.add(apP);const apron=new THREE.Mesh(new THREE.CylinderGeometry(.53,.62,.78,40,1,true,-1.1,2.2),M(APRON[i],MG));apron.position.y=-.39;apP.add(apron);
 const hdP=new THREE.Group();hdP.position.y=1.66;body.add(hdP);const head=new THREE.Mesh(new THREE.SphereGeometry(.42,40,28),M('#EBB892'));head.position.y=.29;hdP.add(head);
 [-.15,.15].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.05,16,12),M('#2E2219'));e.position.set(x,.32,.39);hdP.add(e);const hl=new THREE.Mesh(new THREE.SphereGeometry(.016,10,8),new THREE.MeshBasicMaterial({color:'#FFFFFF'}));hl.position.set(x+.017,.345,.435);hdP.add(hl);
  const ck=new THREE.Mesh(new THREE.SphereGeometry(.075,20,12),new THREE.MeshBasicMaterial({color:'#E58E7A',transparent:true,opacity:.5}));ck.scale.set(1,.6,.35);ck.position.set(x*1.55,.2,.37);hdP.add(ck);});
 {const sm=new THREE.Mesh(new THREE.TorusGeometry(.07,.014,8,24,Math.PI*.8),M('#6B3A2C'));sm.rotation.z=Math.PI*1.1;sm.position.set(0,.2,.405);hdP.add(sm);}
 const htP=new THREE.Group();htP.position.y=.62;hdP.add(htP);const hat=new THREE.Mesh(new THREE.CylinderGeometry(.36,.3,.42,36),M('#FFFFFF'));hat.position.y=.14;htP.add(hat);const pf=new THREE.Mesh(new THREE.SphereGeometry(.44,36,20),M('#FFFFFF'));pf.scale.y=.7;pf.position.y=.4;htP.add(pf);
 const arms=[-1,1].map(sd=>{const p=new THREE.Group();p.position.set(sd*.58,1.42,0);body.add(p);const a=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.36,8,16),M('#FFFDF8'));a.position.y=-.27;p.add(a);return p;});
 const legs=[-1,1].map(sd=>{const l=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.3,8,16),M('#3C2A20'));l.position.set(sd*.22,.3,0);g.add(l);return l;});
 // hand-held tools on the right hand: knife (chop), spoon (stir); a plate in both hands (plate)
 const knife=new THREE.Mesh(new THREE.BoxGeometry(.07,.12,.62),M('#D9DEE4',MS));knife.position.set(0,-.58,.25);arms[1].add(knife);
 const spoon=new THREE.Group();const sh=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.8,16),M('#B98258'));sh.rotation.x=Math.PI/2;sh.position.z=.3;spoon.add(sh);spoon.position.y=-.58;arms[1].add(spoon);
 const plate=new THREE.Mesh(new THREE.CylinderGeometry(.42,.32,.07,44),M('#FFFDF8',MG));plate.position.set(0,1.42,.66);body.add(plate);const fo=new THREE.Mesh(new THREE.SphereGeometry(.22,28,16,0,Math.PI*2,0,Math.PI/2),M('#D9604A',MG));fo.position.y=.04;plate.add(fo);
 const mag=new THREE.Group();{const ring=new THREE.Mesh(new THREE.TorusGeometry(.17,.035,14,44),M('#C9824F',MS));ring.position.set(0,0,.62);const gl=new THREE.Mesh(new THREE.CircleGeometry(.16,40),new THREE.MeshBasicMaterial({color:'#CFE6EE',transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false}));gl.position.copy(ring.position);const hd=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.42,16),M('#6B3A2C'));hd.rotation.x=Math.PI/2;hd.position.z=.25;mag.add(ring,gl,hd);mag.position.y=-.58;arms[1].add(mag);}
 const board=new THREE.Group();{const bd=new THREE.Mesh(rbox(.62,.05,.8,.02),M('#B98258'));const pp=new THREE.Mesh(new THREE.BoxGeometry(.5,.012,.62),M('#FFFDF8'));pp.position.y=.032;const cp=new THREE.Mesh(rbox(.24,.05,.08,.015),M('#8D959E',MS));cp.position.set(0,.04,-.36);board.add(bd,pp,cp);[0,1,2].forEach(k=>{const ln=new THREE.Mesh(new THREE.BoxGeometry(.32-k*.06,.004,.025),M('#6F93B8'));ln.position.set(-.04,.041,-.12+k*.13);board.add(ln);});board.position.set(.15,-.62,.35);board.rotation.set(.35,0,-.2);arms[0].add(board);}
 const shd=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.5).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:blobT,color:'#3A2416',transparent:true,opacity:.45,depthWrite:false}));shd.position.y=.015;shd.renderOrder=1;g.add(shd);
 g.position.copy(home);g.rotation.y=yaw;scene.add(g);if(label){const d=document.createElement('div');d.className='lb chef';d.style.setProperty('--dot',APRON[i]);d.textContent=label;C.lbEl=d;const lb=new CSS2DObject(d);lb.position.set(0,3.5,0);g.add(lb);}
 Object.assign(C,{apP,hdP,htP,arms,legs,knife,spoon,plate,mag,board,st:'idle',t:0,ph:i*1.3,v:0,s:0,len:0,curve:null,yawT:yaw,lean:new Spr(),hatX:new Spr(),hatZ:new Spr(),apX:new Spr(),headY:new Spr(),job:null,stride:0,home:home.clone(),phase:i*1.7});
 knife.visible=spoon.visible=plate.visible=mag.visible=board.visible=false;CHEFS.push(C);return C;}
const agents=G.nodes.filter(n=>n.kind==='agent');
// the two agents are labelled swing cooks; two unlabelled commis are decoration (as v2)
chef(0,'poteto-agent',new THREE.Vector3(-4.6,0,-5.6),.6);chef(1,'poteto-agent',new THREE.Vector3(10.6,0,4.6),-.4);   // v2.4: moved off the head chef's line of sight
chef(2,'poteto-agent',new THREE.Vector3(-6.2,0,10.6),2.4)   /* v2.5 parking rule: homes sit >=2.9 m from every work spot */;const HEAD=chef(3,'Poteto Mode · expediter',new THREE.Vector3(5.9,0,3.6),-.4);   /* v2.5: head chef off the pass-peninsula lane */HEAD.htP.scale.set(1.1,2.15,1.1);{const band=new THREE.Mesh(new THREE.TorusGeometry(.33,.035,10,40),M('#D9604A'));band.rotation.x=Math.PI/2;band.position.y=-.02;HEAD.htP.add(band);}   // the head chef (tall toque) glances on: house rules
// v2.4 silhouettes: head chef = tall toque + dark jacket, no apron · reviewer (cook 3) = blue apron, short cap, magnifier on a lanyard · supervisor (house rules) = plum cardigan, flat cap, clipboard
const recolor=(c,col)=>{const t=c.body.children[0];t.material=t.material.clone();t.material.color.set(col);c.arms.forEach(a=>{const m=a.children[0];m.material=m.material.clone();m.material.color.set(col);});};
recolor(HEAD,'#3A3431');HEAD.apP.visible=false;{const bt=new THREE.Mesh(new THREE.SphereGeometry(.05,12,8),M('#E7C48B',MS));[1.25,1.0,.75].forEach(y=>{const b=bt.clone();b.position.set(.16,y,.47);HEAD.body.add(b);});}
if(false){const R2=CHEFS[2];R2.htP.scale.set(1,.55,1);const ly=new THREE.Mesh(new THREE.TorusGeometry(.13,.025,8,24),M('#C9824F',MS));ly.position.set(.18,1.05,.52);R2.body.add(ly);const lc=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.015,24),new THREE.MeshBasicMaterial({color:'#CFE6F2',transparent:true,opacity:.7}));lc.rotation.x=Math.PI/2;lc.position.copy(ly.position);R2.body.add(lc);}
const SUP=chef(4,'Supervisor · house rules',new THREE.Vector3(-9.6,0,-2.4),-1.1);CHEFS.splice(CHEFS.indexOf(SUP),1);recolor(SUP,'#8A6FA8');SUP.htP.scale.set(1.15,.4,1.15);SUP.board.visible=true;SUP.supervisor=true;OBST.push([-10.1,-2.9,-9.1,-1.9]);
const dotG=new THREE.CircleGeometry(.15,14).rotateX(-Math.PI/2);
const CR=1.05;   // chef collision radius: body .5 + arm swing and held tools
const allChefs=()=>(typeof SUP!=='undefined'?[...CHEFS,SUP]:CHEFS).filter(c=>!c.off).concat(typeof GUESTS!=='undefined'?GUESTS.filter(g=>g.on):[]);

// v2.4: an idle cook standing in someone's way steps aside to the nearest free spot clear of the walker's remaining route
function stepAside(o,w,walker){if(!walker)o.asideT=1;const route=[w.g.position.clone()];if(w.st==='walk'&&w.curve)for(let d=w.s;d<=w.len;d+=.3)route.push(w.curve.getPointAt(Math.min(1,d/w.len)));const cands=[];
 for(let dx=-4.5;dx<=4.5;dx+=.5)for(let dz=-4.5;dz<=4.5;dz+=.5){const x=Math.round((o.g.position.x+dx)*2)/2,z=Math.round((o.g.position.z+dz)*2)/2;if(blocked(x,z)||(groundY(x,z)>0&&groundY(x,z)<NOOK.h)||(x>7.5&&x<11.5&&z<-3.4&&z>-5.6))continue;
  if(route.some(q=>Math.hypot(q.x-x,q.z-z)<CR*2+.3))continue;if(allChefs().some(k=>k!==o&&Math.hypot(k.g.position.x-x,k.g.position.z-z)<CR*2+.3))continue;cands.push([Math.hypot(dx,dz),new THREE.Vector3(x,0,z)]);}
 cands.sort((a,b)=>a[0]-b[0]);const wp=w.g.position;for(const [,q] of cands.slice(0,30)){const pts=path(o.g.position,q);if(pts.length<=2&&o.g.position.distanceTo(q)>1.5)continue;const cv=new THREE.CatmullRomCurve3(pts);const L=cv.getLength();let ok=true;for(let d=0;d<=L;d+=.3){const r=cv.getPointAt(Math.min(1,d/L));if(Math.hypot(r.x-wp.x,r.z-wp.z)<CR*2+.2){ok=false;break;}}if(ok){walkTo(o,q,null);return true;}}
 if(!walker){o.asideT=0;w.blockT=-2;}return false;}   /* nothing clear: the walker waits a little longer and tries again */
let REQN=0;
/* v2.5 traffic rule: one travel token. Only one cook crosses the floor at a time (FIFO by request); others hold their wind-up pose,
   then replan from the current world when they get the token. Cooks stepping aside are exempt (they only clear a path). */
const routePts=(o,from)=>{const r=[];if(!o.curve)return [o.g.position];for(let d=from;d<=o.len;d+=.5)r.push(o.curve.getPointAt(Math.min(1,d/o.len)));r.push(o.curve.getPointAt(1));return r;};
const crosses=(A,B)=>A.some(p=>B.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<CR*2+.4));
/* token is per corridor: a cook waits only for earlier cooks whose remaining route comes near its own */
const tokenFree=c=>{if(c.asideT)return true;
 /* exits yield to entries: a waiting finished cook never holds up a cook heading to work, and waits for any working cook whose route crosses its own */
 if(allChefs().some(o=>o!==c&&o.st==='walk'&&crosses([c.g.position],routePts(o,o.s))))return true;   /* I'm standing in a moving cook's lane: go now and clear it */
 const mine=routePts(c,0);return !allChefs().some(o=>o!==c&&!o.asideT&&(o.st==='walk'||(o.st==='antic'&&(o.leaving?(c.leaving&&o.req<c.req):(c.leaving||o.req<c.req))))&&crosses(mine,routePts(o,o.st==='walk'?o.s:0)));};
function walkTo(c,to,job=null){if(job)c.asideT=0;AVOID=allChefs().filter(o=>o!==c&&((o.st!=='walk'&&o.st!=='antic')||o.wait>.3)&&o.g.position.distanceTo(to)>CR*2&&o.g.position.distanceTo(c.g.position)>CR*2).map(o=>o.g.position.clone());let pts=path(c.g.position,to);if(pts.length<=2&&AVOID.length&&c.g.position.distanceTo(to)>1.5){AVOID=[];pts=path(c.g.position,to);}AVOID=[];c.wait=0;c.curve=new THREE.CatmullRomCurve3(pts,false,'centripetal',.5);{const L=c.curve.getLength();let bad=false;for(let d=.3;d<L-.9;d+=.25){const q=c.curve.getPointAt(d/L);if(blocked(q.x,q.z)&&q.distanceTo(pts[0])>.5){bad=true;break;}}if(bad){const cp=new THREE.CurvePath();for(let i=1;i<pts.length;i++)cp.add(new THREE.LineCurve3(pts[i-1],pts[i]));c.curve=cp;}}   /* v2.4: if the smooth spline cuts into a padded obstacle, walk the grid polyline instead */c.len=c.curve.getLength();c.s=0;c.v=0;if(c.st!=='antic'||c.req==null)c.req=++REQN;c.st='antic';c.t=0;c.job=job;c.dest=to.clone();
 if(c.dots)scene.remove(c.dots);const n=Math.max(2,Math.floor(c.len/.5));c.dots=new THREE.InstancedMesh(dotG,new THREE.MeshBasicMaterial({color:APRON[c.i],transparent:true,opacity:.75,depthWrite:false}),n);c.dots.renderOrder=2;
 for(let i=0;i<n;i++){const p=c.curve.getPointAt(i/(n-1));c.dots.setMatrixAt(i,new THREE.Matrix4().makeTranslation(p.x,groundY(p.x,p.z)+.03,p.z));}c.dots.userData.n=n;scene.add(c.dots);}
const VMAX=2.4,ACC=1.5,ANTIC=.38,ARRIVE=.65,WORK=1.8,   /* v2.5: ~40% quicker walks, snappier beats */
 CHOP_HZ=+(qs.get('chop')||1);
function updChef(c,T,dt){if(c.off)return;c.t+=dt;if(c.st==='walk'||c.st==='antic'){c.knife.visible=c.spoon.visible=c.mag.visible=false;if(!c.supervisor)c.board.visible=false;}   /* v2.4: tools are picked up on arrival, never carried through the walk */if(!c.liftS)c.liftS=new Spr(0);{const up=false&&(c.st==='arrive'||c.st==='work')?.8:0;c.liftS.step(up,14,6.5,dt);}const b=c.body,A=c.arms;let accel=0,squash=0,hop=0,nod=0,armL=0,armR=0,armRz=0,bodyRz=0,leanT=0;
 // head looks toward the destination while walking, toward the station while working, and idles around otherwise
 let lookYaw=Math.sin(T*.37+c.phase)*.35;
 if(c.st==='antic'&&!tokenFree(c)){c.t=0;c.held=1;if(c.dots)c.dots.visible=false;}else if(c.st==='antic'&&c.held){c.held=0;walkTo(c,c.dest,c.job);}
 if(c.st==='antic'){const u=cl(c.t/ANTIC);squash=Math.sin(Math.PI*u)*.09;leanT=-.14*Math.sin(Math.PI*u);armL=armR=.35*Math.sin(Math.PI*u);
  const tg=c.curve.getTangentAt(0);c.yawT=Math.atan2(tg.x,tg.z);lookYaw=angDiff(c.g.rotation.y,c.yawT);if(u>=1){c.st='walk';c.t=0;}}
 else if(c.st==='walk'){const rem=c.len-c.s;let vt=Math.min(VMAX,Math.sqrt(2*ACC*Math.max(rem,0))+.05);const v0=c.v;
   {const lookOf=o=>o.st==='walk'&&o.curve&&!(o.wait>.3)?o.curve.getPointAt(Math.min(1,(o.s+1.3+(o.v||0)*(o.v||0)/3.6)/o.len)):o.g.position;const look=lookOf(c),me=c.g.position;let blk=null;
    for(const o of allChefs()){if(o===c)continue;const op=o.g.position,ol=lookOf(o),d=Math.hypot(op.x-me.x,op.z-me.z);
     const toward=(op.x-me.x)*(look.x-me.x)+(op.z-me.z)*(look.z-me.z)>0;
     const conflict=Math.hypot(ol.x-look.x,ol.z-look.z)<CR*2+.2||Math.hypot(op.x-look.x,op.z-look.z)<CR*2+.2||(toward&&d<CR*2+.35);if(!conflict)continue;
     const oMoving=o.st==='walk'&&!(o.wait>.3);if(oMoving&&o.i>c.i&&d>CR*2+.05)continue;blk=o;break;}
    if(!blk&&c.job&&c.len-c.s<3)for(const o of allChefs()){if(o===c||!o.dest||!o.job)continue;if(o.dest.distanceTo(c.dest)<CR*2+.1&&(o.st==='arrive'||o.st==='work'||(o.st==='walk'&&(o.len-o.s)<(c.len-c.s)))){blk=o;break;}}
    if(blk&&c.len-c.s<.4&&Math.hypot(blk.g.position.x-c.dest.x,blk.g.position.z-c.dest.z)>CR*2+.05)blk=null;   /* v2.5: a neighbour beside the spot doesn't stop the last few cm */
    if(blk){vt=0;c.wait=(c.wait||0)+dt;c.blockT=(c.blockT||0)+dt;c.jamT=(c.jamT||0)+dt;if(c.blockT>.7&&blk.st==='idle'&&!blk.asideT)stepAside(blk,c);if(c.blockT>.7+c.i*.25&&(blk.v||0)<.3&&c.len-c.s>CR*2.2){const keep=c.job,dst=c.dest;c.wait=1;AVOID=[];const me2=c;walkTo(c,dst,keep);c.st='walk';c.v=0;c.blockT=0;}}else{c.wait=Math.max(0,(c.wait||0)-dt*2);if(c.v>.5){c.blockT=0;c.jamT=0;}}}
   c.v+=cl(vt-c.v,-ACC*2.2*dt,ACC*dt);if(c.backup>0){vt=0;c.v=0;const bs=Math.max(0,c.s-.8*dt),bp=c.curve.getPointAt(bs/c.len);if(!allChefs().some(o=>o!==c&&Math.hypot(o.g.position.x-bp.x,o.g.position.z-bp.z)<CR*2+.05&&Math.hypot(o.g.position.x-bp.x,o.g.position.z-bp.z)<o.g.position.distanceTo(c.g.position)))c.s=bs;c.backup-=.8*dt;if(c.s<=0)c.backup=0;if(c.backup<=0){c.backup=0;c.blockT=-.8;}}   /* v2.4: in a head-on standoff the later cook steps back slowly along its path, then waits */accel=(c.v-v0)/Math.max(dt,1e-4);{const s0=c.s;c.s=Math.min(c.len,c.s+c.v*dt);const np=c.curve.getPointAt(c.s/c.len),me=c.g.position;   /* v2.4 hard rule: never step into another cook's circle (2 × CR); stop and queue instead */
   for(const o of allChefs()){if(o===c)continue;const op=o.g.position,dn=Math.hypot(op.x-np.x,op.z-np.z),d0=Math.hypot(op.x-me.x,op.z-me.z);if(dn<CR*2+.05&&dn<d0){c.s=s0;c.v=0;c.blockT=(c.blockT||0)+dt;c.wait=Math.max(c.wait||0,.4);if(c.blockT>1.3&&c.i>o.i&&!c.backup)c.backup=2;if(c.blockT>.7&&o.st==='idle'&&!o.asideT){stepAside(o,c);}
    if(c.blockT>.7+c.i*.25&&c.len-c.s>CR*2.2){const keep=c.job,dst=c.dest;walkTo(c,dst,keep);c.st='walk';c.v=0;c.blockT=0;c.wait=.4;}break;}}}
  const u=c.s/c.len,p=c.curve.getPointAt(u),tg=c.curve.getTangentAt(u);c.g.position.set(p.x,groundY(p.x,p.z),p.z);c.yawT=Math.atan2(tg.x,tg.z);
  const ahead=c.curve.getPointAt(Math.min(1,u+1.6/c.len));lookYaw=angDiff(c.g.rotation.y,Math.atan2(ahead.x-p.x,ahead.z-p.z))*1.4;
  const k=c.v/VMAX,prev=Math.floor(c.stride/Math.PI);c.stride+=c.v*dt*2.7;const w=c.stride;
  if(Math.floor(w/Math.PI)!==prev){const sd=Math.floor(w/Math.PI)%2?1:-1;puff(c.g.position.clone().add(new THREE.Vector3(sd*.25,0,-.15).applyAxisAngle(new THREE.Vector3(0,1,0),c.g.rotation.y)),.42+.3*k,.7);}
  hop=Math.abs(Math.sin(w))*.15*k;squash=-Math.abs(Math.cos(w))*.04*k;bodyRz=Math.sin(w)*.07*k;leanT=.1*k;
  c.legs[0].position.z=Math.sin(w)*.24*k;c.legs[1].position.z=-Math.sin(w)*.24*k;armL=Math.sin(w)*.75*k;armR=-Math.sin(w)*.75*k;
  if(c.dots){const n=c.dots.userData.n,kk=Math.floor(u*(n-1));for(let i=0;i<=kk;i++)c.dots.setMatrixAt(i,ZERO);c.dots.instanceMatrix.needsUpdate=true;}
  if(c.s>=c.len-1e-3){c.st='arrive';c.t=0;c.v=0;if(c.dots){scene.remove(c.dots);c.dots=null;}if(c.job){c.yawT=c.job.face??c.job.s.ry+Math.PI;c.job.s.target=DOOR_OPEN;}}}
 else if(c.st==='arrive'){const u=cl(c.t/ARRIVE);// follow-through lean, a little hop, then a nod
  const h=cl((u-.1)/.55);hop=Math.sin(Math.PI*h)*.24;squash=(u<.1?Math.sin(Math.PI*u/.1)*.07:0)+(h>=1?Math.sin(Math.PI*cl((u-.65)/.2))*.06:0);
  nod=Math.sin(cl((u-.6)/.4)*Math.PI*2)*.22*(1-u);armL=armR=-Math.sin(Math.PI*h)*.6;c.legs.forEach(l=>l.position.z*=.8);
  if(u>=1){c.st=c.job?'work':'idle';c.t=0;if(c.job)c.job.started=T;}}
 else if(c.st==='work'){const j=c.job,u=cl(c.t/(j.dur||WORK));lookYaw=Math.sin(T*.6)*.16;const env=Math.sin(Math.PI*cl(u*1.15));
  if(j.act==='chop'){c.knife.visible=true;const k=Math.pow(Math.max(0,Math.sin(T*2*Math.PI*CHOP_HZ)),1.4);armR=-1.15+k*.75*env;armL=-.95;nod=.18+k*.05;squash=k*.03*env;}
  else if(j.act==='stir'){c.spoon.visible=true;armR=-1.05+Math.cos(T*1.9)*.18;armRz=Math.sin(T*1.9)*.38;armL=-.4;bodyRz=Math.sin(T*1.9)*.04;nod=.12;}
  else if(j.act==='taste'){c.spoon.visible=true;const ph=(T*.45)%1,up=ease.sin(cl((ph-.35)/.25))*(1-ease.sin(cl((ph-.75)/.2)));armR=-.95-1.25*up+Math.sin(T*1.6)*.05*(1-up);armL=-.3;nod=.2-up*.32;lookYaw=Math.sin(T*.4)*.22*(1-up);}
  else if(j.act==='sketch'){c.board.visible=true;armL=-1.2;armR=-1.05+Math.sin(T*2.2)*.06;armRz=.25+Math.sin(T*1.1)*.18;nod=.26+Math.sin(T*.7)*.04;lookYaw=Math.sin(T*.5)*.1;}
  else if(j.act==='inspect'){c.mag.visible=true;armR=-.95+Math.sin(T*.8)*.06;armRz=.25+Math.sin(T*.7)*.2;armL=-.35;nod=.1+Math.max(0,Math.sin(T*.7))*.08;lookYaw=Math.sin(T*.7)*.22;leanT=.04;}
  else{c.plate.visible=true;const k=Math.sin(Math.PI*u);armL=armR=-1.25+k*.25;hop=k*.05;nod=.1+k*.08;}
  if(u>=1){c.knife.visible=c.spoon.visible=c.mag.visible=c.board.visible=false;c.plate.visible=false;j.s.target=0;launch(j);c.st='done';c.t=0;}}
 else if(c.st==='done'||c.st==='cheer'){const u=cl(c.t/.8);if(c.st==='cheer'){hop=Math.sin(Math.PI*u)*.3;armL=armR=-2.2*Math.sin(Math.PI*u);}else{nod=Math.sin(u*Math.PI*2)*.12*(1-u);}
  if(u>=1)c.st='idle';}
 // idle: breathe, gentle sway, a lazy arm, head wandering
 if(c.st==='idle'){const ph=T+c.phase;squash=Math.sin(ph*1.9)*.02;bodyRz=Math.sin(ph*.6)*.03;armR=-.25+Math.sin(ph*1.3)*.12;armL=Math.sin(ph*.9)*.08;c.legs.forEach(l=>l.position.z*=.9);
  if(c===HEAD&&(job.pid||prev)){const ph=T*.7;   // v2.3 head chef: calm, slow 'calling the order' gestures toward the working station
   const W=job.list.find(J=>J.chef&&J.chef.st!=='idle'&&!J.landed);if(W){const d=W.chef.g.position.clone().sub(c.g.position);lookYaw=cl(angDiff(c.g.rotation.y,Math.atan2(d.x,d.z)),-.9,.9);}
   const call=Math.max(0,Math.sin(ph));armR=-1.35-call*.5;armRz=-.25+Math.sin(ph*.5)*.2;armL=-.35+Math.sin(ph*.5+1)*.12;nod=.04-call*.08;bodyRz=Math.sin(ph*.5)*.03;}}
 if(c.carry){armL=armR=-1.25;nod=Math.max(nod,.08);}
 // body yaw eases toward its target; springs give lean follow-through, hat wobble, apron sway and head turns
 c.g.rotation.y+=angDiff(c.g.rotation.y,c.yawT)*Math.min(1,dt*(c.st==='walk'?5:3.5));
 const lean=c.lean.step(leanT-accel*.07,38,7,dt);b.rotation.x=lean;b.rotation.z=bodyRz;b.position.y=hop;b.scale.set(1+squash*.6,1-squash,1+squash*.6);
 c.hatX.v+=(-accel*.35-(hop>0?0:0))*dt;c.hatX.step(-lean*.9+nod*.3,38,4.2,dt);c.htP.rotation.x=c.hatX.x;c.hatZ.v+=-bodyRz*2*dt*10;c.htP.rotation.z=c.hatZ.step(bodyRz*.6,38,4.2,dt);
 c.apP.rotation.x=c.apX.step(-lean*1.1-c.v*.05,26,2.6,dt);
 c.hdP.rotation.y=c.headY.step(cl(lookYaw,-.9,.9),30,9,dt);c.hdP.rotation.x=nod;
 A[0].rotation.x=armL;A[1].rotation.x=armR;A[1].rotation.z=armRz;}
// ---------- ingredients fly in curved arcs from station to the pass and stack into the dish ----------
const DISH=new THREE.Vector3(0,2.34,1.15);const dishPlate=new THREE.Mesh(new THREE.CylinderGeometry(.66,.5,.09,64),M('#FFFDF8',MG));dishPlate.position.copy(DISH);dishPlate.visible=false;scene.add(dishPlate);
const FOODC=['#E9A23B','#7FA37A','#D9604A','#B5653E','#F2C46B'];const FLY=[],STACK=[];let stackH=.06;
function launch(j){const m=new THREE.Group();const bw=new THREE.Mesh(new THREE.CylinderGeometry(.24,.15,.2,32),M('#F4EDE2',MG));m.add(bw);const fd=new THREE.Mesh(new THREE.SphereGeometry(.22,28,16,0,Math.PI*2,0,Math.PI/2),M(FOODC[j.k%5],MG));fd.scale.y=.6;fd.position.y=.06;m.add(fd);
 const p0=j.s.p.clone().setY(j.s.p.y+2.7).addScaledVector(j.s.fwd,.7);m.position.copy(p0);scene.add(m);const d=p0.distanceTo(DISH);FLY.push({m,j,p0,t:0,dur:1.1+d*.04,h:3.2+d*.18});}
function updFly(dt,T){for(const f of FLY){if(f.done)continue;f.t+=dt;const u=cl(f.t/f.dur),e=ease.sin(u);const end=DISH.clone().setY(DISH.y+stackH+.1);
 const mid=f.p0.clone().lerp(end,.5).setY(Math.max(f.p0.y,end.y)+f.h);const p=new THREE.QuadraticBezierCurve3(f.p0,mid,end).getPoint(e);f.m.position.copy(p);f.m.scale.setScalar(1.45);f.m.rotation.y=e*Math.PI*2;f.tr=(f.tr||0)+dt;if(f.tr>.05){f.tr=0;puff(p.clone().setY(p.y-.15),.32,.55,-.1);}f.m.rotation.z=Math.sin(e*Math.PI)*.5;
 if(u>=1){f.done=true;scene.remove(f.m);landed(f.j,T);}}}
function landed(j,T){const lay=new THREE.Mesh(new THREE.CylinderGeometry(.5-STACK.length*.05,.54-STACK.length*.05,.16,56),M(FOODC[j.k%5],MG));lay.position.copy(DISH).setY(DISH.y+stackH+.08);scene.add(lay);stackH+=.15;
 const sp=new Spr(.2);STACK.push({m:lay,sp});for(let i=0;i<5;i++)puff(DISH.clone().setY(DISH.y+stackH).add(new THREE.Vector3(Math.cos(i*1.26)*.5,0,Math.sin(i*1.26)*.5)),.45,.6,.4);
 j.landed=true;job.landed++;updTicket();if(job.landed===job.list.length)complete(T);}
let garnish=null,orderUp=null,doneAt=-1;
function complete(T){doneAt=T;garnish={m:new THREE.Mesh(new THREE.SphereGeometry(.18,28,20),M('#5B8752',MG)),sp:new Spr(0)};garnish.m.position.copy(DISH).setY(DISH.y+stackH+.12);scene.add(garnish.m);
 const d=document.createElement('div');d.className='orderup';d.textContent='Order up!';orderUp={o:new CSS2DObject(d),d,sp:new Spr(0)};orderUp.o.position.copy(DISH).setY(DISH.y+stackH+1.4);scene.add(orderUp.o);
 CHEFS.forEach(c=>{if(c.st==='idle'||c.st==='done'){c.st='cheer';c.t=0;}});updTicket();}
function updStack(dt,T){STACK.forEach(s=>{const k=s.sp.step(1,60,6,dt);s.m.scale.set(k,Math.max(.2,2-k),k);});
 if(garnish){const k=garnish.sp.step(1,50,5,dt);garnish.m.scale.setScalar(Math.max(0,k));}
 if(orderUp){const k=orderUp.sp.step(1,40,6,dt);orderUp.d.style.transform=`scale(${Math.max(0,k).toFixed(3)})`;orderUp.d.style.opacity=(cl(k*1.5)*(serve&&serve.ph!=='go'?cl(1-serve.t/1.4)*(serve.ph==='pick'?1:0):1)).toFixed(3);}}
// ---------- ambient life: steam (above), pot lids rattling, heat lamps flickering, plants swaying ----------
function updAmbient(T){POTS.forEach((p,k)=>{const b=Math.pow(Math.max(0,Math.sin(T*2.4+k*2.1)),8);p.lid.position.y=p.y0+b*.06;p.lid.rotation.z=Math.sin(T*8+k)*.025*b;p.lid.rotation.x=Math.cos(T*6+k)*.015*b;});
 LAMPS.forEach((g,i)=>g.material.opacity=.64+.035*Math.sin(T*2.9+i*2)+.02*Math.sin(T*7.7+i*5)+(doneAt>0?.16*cl((T-doneAt)/.6):0));
 const R3=new THREE.Matrix4(),q=new THREE.Quaternion(),Y=new THREE.Quaternion();LEAVES.forEach(l=>{const ax=.045*Math.sin(T*.5+l.k),az=.035*Math.sin(T*.39+l.k*1.3);q.setFromEuler(new THREE.Euler(ax,0,az));
  const p=l.P.clone().sub(l.base).applyQuaternion(q).add(l.base);Y.setFromAxisAngle(new THREE.Vector3(0,1,0),l.a).premultiply(q);leaf.m.setMatrixAt(l.i,R3.compose(p,Y,l.S));});leaf.m.instanceMatrix.needsUpdate=true;}
// ---------- doors: damped springs with a slight overshoot ----------
const doorSpr=ST.map(()=>new Spr(0));
function updDoors(dt){ST.forEach((s,i)=>{const sp=doorSpr[i];if(fast){sp.x=s.target;sp.v=0;}else sp.step(s.target,7,5.3,dt);if(Math.abs(sp.x-s.ang)>1e-4||Math.abs(sp.v)>1e-4){s.ang=cl(sp.x,0,1);doorM(s,i);}});
 [door,dpanel,knob,doorB,bpanel,dinner].forEach(m=>m.instanceMatrix.needsUpdate=true);}
// ---------- ticket: print, slide onto the rail, fire ----------
const visited=new Set(JSON.parse(localStorage.getItem('kc.visited')||'[]'));(qs.get('visited')||'').split(',').filter(Boolean).forEach(v=>visited.add(v));
const setVisited=()=>{document.querySelector('#visited b').textContent=[...visited].filter(id=>N.get(id)?.kind==='skill').length;localStorage.setItem('kc.visited',JSON.stringify([...visited]));};
const ICON={skill:'▣',principle:'❖',playbook:'🧾',agent:'☺',script:'⚒',reference:'◡',router:'⬢',automation:'⏲'};
function rail(fire,ghost){const r=document.getElementById('rail');r.innerHTML='';[...playbooks].sort((a,b)=>stepsOf(b.id).length-stepsOf(a.id).length).forEach(p=>{const d=document.createElement('div');d.className='tk'+(p.id===fire?' fire':'')+(p.id===ghost?' ghost':'');d.dataset.id=p.id;
 const n=G.edges.filter(e=>e.source===p.id&&e.mode==='step').length;d.innerHTML=`<span class="n">${esc(p.name)}</span><span class="s">${n?n+' steps':'à la carte'}</span>`;r.appendChild(d);});const f=r.querySelector('.fire');if(f)f.scrollIntoView({inline:'center',block:'nearest'});}
const stOf=new Map(ST.map((s,i)=>[s.n.id,i]));const front=s=>s.p.clone().addScaledVector(s.fwd,1.55);
const DOOR_OPEN=1;const DOOR_MAX=s=>1;   // slide fraction: 0 closed, 1 fully open (hard stop, critically damped, no overshoot)   // v2.2: ~81°, door stays inside its own station edge; spring overshoot clamped at 1.52
// v2.2 · what each real step looks like (pstack skill id → chef action; principles → the head chef glances on)
{const dbG=rbox(MW-.3,.8,1.1,.06);[].forEach(s=>{const m=new THREE.Mesh(dbG,M('#9A6A45',MG));m.userData.walkable=true;m.position.copy(s.p).setY(.4).addScaledVector(s.fwd,-2.5);m.rotation.y=s.ry;scene.add(m);blob(m.position.x,0,m.position.z,MW+.4,1.8);});}
const DUCK=[];
const duckH=p=>{let h=0;DUCK.forEach(d=>{const ax=cl((MW/2+.15-Math.abs(p.x-d.x))/.35),az=cl((.55-Math.abs(p.z-d.z))/.35);h=Math.max(h,.8*ease.sin(Math.min(ax,az)));});return h;};   // the chefs step up onto the raised duckboards
const ACT_OF={how:'taste',why:'taste',recall:'taste','figure-it-out':'taste',teach:'taste','poteto-help':'taste',reflect:'taste',
 architect:'sketch','make-bot-ui':'sketch','technical-writing':'sketch',
 interrogate:'inspect','blast-radius':'inspect','benchmark-checklist':'inspect','show-me-your-work':'inspect',correct:'inspect','create-verification-skill':'inspect','maintain-verification-skill':'inspect',bro:'inspect'};
const actOf=s=>ACT_OF[s.n.id]||(rangeIds.has(s.n.id)?'stir':'chop');
const ACT_LINE={taste:'Tasting and inspecting',sketch:'Sketching on the board',inspect:'Inspecting the plate',chop:'Cooking',stir:'Cooking'};
const CAPTION={   // v2.3: plain, friendly words for every skill, paraphrased from its real description in graph.json
 how:'Reads through the code to learn how this part works today, before anything gets changed.',
 why:'Digs into why it was built this way: the history, the trade-offs and the reasons behind it.',
 architect:'Sketches the shapes, types and layout first, then keeps an eye on things while the code fills in.',
 arena:'Cooks a few versions of the same dish side by side, keeps the best one and borrows the good bits from the rest.',
 interrogate:'Tries hard to poke holes in the work, from several angles, to find what was missed.',
 'blast-radius':'Checks what else this change could break, and proves it is safe by actually running it.',
 'benchmark-checklist':'Double-checks a speed measurement is fair and repeatable before anyone trusts the number.',
 'show-me-your-work':'Keeps a simple notebook of every decision (what, why, and the proof) so it can be reviewed later.',
 tdd:'Writes a small test that fails first, then the code that makes it pass.',
 swarm:'Sends several helpers out at once, waits for them all, and gathers one report.',
 unslop:'Tidies the writing so it reads like a person wrote it, not a machine.',
 'no-comments':'Asks a strict reviewer to flag unneeded code comments, then fixes the ones that should go.',
 'typescript-best-practices':'Follows good TypeScript habits while reading and editing the code.',
 teach:'Explains the work plainly, so a person really understands it.',
 recall:'Rebuilds the recent context from notes and history so nothing gets lost.',
 reflect:'Looks back over the session for lessons and turns each one into a concrete improvement.',
 'figure-it-out':'Plans a big, careful job step by step when no ready-made recipe fits.',
 'poteto-help':'Helps pick the right skill or recipe for the task at hand.',
 'technical-writing':'Writes clear, well-structured docs that are easy to follow.',
 'make-bot-ui':'Builds a small page with buttons that can wake a helper bot.',
 'automate-me':'Captures your working style as a skill so helpers can follow it.',
 'setup-pstack':'Chooses which models handle which job, and how hard each one should think.',
 ketchup:'Catches you up on everything that happened, in plain words.',
 correct:'Finds mistakes that keep repeating and makes them impossible to make again.',
 'create-verification-skill':'Builds a checker that uses the app the way a real person would.',
 'maintain-verification-skill':'Keeps that checker honest as the app changes.',
 bro:'Says the last message again in plain, everyday words.'};
const caption=n=>CAPTION[n.id]||'Works through this step of the recipe.';
// the corner station (back run meets the left run): its chef steps 1.3 along the run so they don't stand in front of the left run's end cabinet
const WORK_D=+(qs.get('wd')||2.3);   // chef stands centred, clear of the door tracks and pull (front at local z 1.13)
const CORNER=new THREE.Vector3(-12.72,0,-7.6);   // v2.4: the two corner stations share one reserved spot, facing the corner; cooks take turns
const workSpot=s=>(s.run===0&&s.p.x<-13)||(s.run===1&&s.p.z<-8)?{p:CORNER.clone(),face:s.run===0?2.75:-1.57}:false?0:{p:s.p.clone().addScaledVector(s.fwd,WORK_D).addScaledVector(s.side,s.run===0&&s.p.x<-13?1.3:0),face:s.ry+Math.PI};
const job={pid:null,steps:[],list:[],landed:0};
function ticketHTML(){const p=N.get(job.pid);const ready=doneAt>0;return `<div class="k">${job.served?'Served · ticket closed':ready?'Order up · ready':'Order up · fired'}</div><h3>${esc(p.name)}</h3><div class="d">${esc(p.description||'')}</div><ol>${job.steps.map(e=>{const n=N.get(e.target);const J=job.list.find(j=>j.e===e);
 const st=J?(J.landed?'done':J.chef?'now':''):(job.landed>=job.list.filter(j=>j.e.order<=e.order).length&&job.started?'done':'');
 const where={skill:'station',principle:'house rule',playbook:'side ticket',agent:'swing cook',script:'tool',reference:'prep',router:'the pass'}[n.kind]||n.kind;
 return `<li class="${st}"><span class="o">${st==='done'?'✓':e.order}</span><span class="ic">${ICON[n.kind]||'·'}</span><span>${esc(nm(n))}</span><span class="w">${esc(where)}</span></li>`;}).join('')}</ol>
 <div class="f"><button class="btn g">Back</button><button class="btn">${ready?'Back to the rail':'Next step ▸'}</button></div>`;}
function updTicket(){if(!job.pid)return;tkt.innerHTML=ticketHTML();job.list.forEach(J=>{J.badge.className='badge'+(J.landed?' done':J.chef?'':' next');J.s.glow.material.opacity=J.landed?.45:J.chef&&J.chef.st==='work'?1:J.chef?.6:.18;});}
function fire(pid){job.pid=pid;job.started=true;rail(pid);job.steps=G.edges.filter(e=>e.source===pid&&e.mode==='step').sort((a,b)=>a.order-b.order);
 job.list=job.steps.filter(e=>N.get(e.target).kind==='skill'&&stOf.has(e.target)).map((e,k)=>({e,k,s:ST[stOf.get(e.target)]}));
 job.list.forEach(J=>{J.act=actOf(J.s);const b=document.createElement('div');b.className='badge next';b.textContent=J.e.order;const o=new CSS2DObject(b);o.position.copy(J.s.p).setY(J.s.p.y+4.2).addScaledVector(J.s.fwd,.5);scene.add(o);J.badge=b;J.s.lb.classList.remove('dim');});
 ST.forEach(s=>{if(!job.list.some(J=>J.s===s))s.lb.classList.add('dim');});
 job.steps.forEach(e=>{const n=N.get(e.target);if(n.kind==='principle'){const i=principles.indexOf(n);if(i>=0){plq.m.setColorAt(i,new THREE.Color('#F2C46B'));}}});plq.m.instanceColor.needsUpdate=true;
 job.rules=job.steps.filter(e=>N.get(e.target).kind==='principle').length;dishPlate.visible=true;tkt.style.display='block';document.getElementById('legend').style.display='none';updTicket();
 if(fast){job.list.forEach(J=>{J.landed=true;job.landed++;const lay=new THREE.Mesh(new THREE.CylinderGeometry(.5-STACK.length*.05,.54-STACK.length*.05,.16,56),M(FOODC[J.k%5],MG));lay.position.copy(DISH).setY(DISH.y+stackH+.08);scene.add(lay);stackH+=.15;STACK.push({m:lay,sp:new Spr(1)});});complete(0);}}
const rangeIds=new Set(ST.filter(s=>s.run===0).sort((a,b)=>a.p.x-b.p.x).slice(1,3).map(s=>s.n.id));
function dispatch(J,T){if(CREW)crewIn(J);const free=CHEFS.filter(c=>c!==HEAD&&!c.resume&&!c.leaving&&!c.off&&(!CREW||!job.pid||c.fresh)).filter(c=>!c.job||c.st==='idle'&&c.job.landed);free.sort((a,b)=>a.g.position.distanceTo(front(J.s))-b.g.position.distanceTo(front(J.s)));const c=free[0];if(!c)return;J.chef=c;c.fresh=0;const ws=workSpot(J.s);J.face=ws.face;walkTo(c,ws.p,J);updTicket();}
// printing slip (DOM): feeds out of the printer at the rail's right end, then glides along a curve into its slot
const slip=document.createElement('div');slip.className='tk slip';document.body.appendChild(slip);slip.style.display='none';
function updPrint(T,tP){const el=[...document.querySelectorAll('#rail .tk')].find(d=>d.dataset.id===job.wantPid);if(!el)return;const r=el.getBoundingClientRect();
 const u1=cl((T-tP)/1.4),u2=cl((T-tP-1.4)/1.1);if(T<tP||u2>=1){slip.style.display='none';if(u2>=1)el.classList.remove('ghost');return;}
 slip.style.display='block';slip.innerHTML=el.innerHTML;const x0=innerWidth-150,y0=66;const e=ease.io(u2);const x=x0+(r.left-x0)*e,y=y0+(r.top-y0)*e+Math.sin(Math.PI*e)*26;
 const feed=ease.out(u1);slip.style.left=x+'px';slip.style.top=y+'px';slip.style.clipPath=`inset(0 0 ${((1-feed)*100).toFixed(1)}% 0)`;slip.style.transform=`rotate(${(Math.sin(T*9)*(u1<1?.6:0)+Math.sin(Math.PI*e)*-3).toFixed(2)}deg)`;}
// ---------- station open (kept from v2) ----------
function openStation(id,quiet){const i=stOf.get(id);const s=ST[i];s.target=DOOR_OPEN;s.glow.material.opacity=.85;visited.add(id);setVisited();const n=s.n,mp=misen(id),ui=usedIn(id);
 card.innerHTML=`<div class="k">Station · recipe card</div><h3>${esc(n.name)}</h3>${fileLink(n,"Open skill file")}<p>${esc(n.description||'')}</p><h4>Mise en place · ${mp.length}</h4><div class="bowls">${mp.length?mp.map((m,j)=>`<span class="bowl ${j>2?'smudge':''}">${esc(m.name)}</span>`).join(''):'<span style="font-size:12px;color:#6B5644">Nothing prepped: this station works from the recipe alone.</span>'}</div>
 <h4>Goes into · ${ui.length} dishes</h4><div class="dish">${ui.slice(0,6).map((p,j)=>`<span class="${visited.has(p.id)||j<2?'':'smudge'}">${esc(p.name)}</span>`).join('')}</div><div class="hint">Smudged lines clear as you visit those stations and tickets.</div>`;
 card.innerHTML+=detHTML(n);card.style.display='block';document.getElementById('legend').style.display='none';if(!quiet)view={c:s.p.clone().setY(s.p.y+2).addScaledVector(s.fwd,1.6),h:16};ST.forEach(t=>t.lb.classList.toggle('dim',t!==s));
 if(!fast&&!quiet){const c=CHEFS.slice().sort((a,b)=>a.g.position.distanceTo(front(s))-b.g.position.distanceTo(front(s)))[0];walkTo(c,front(s).addScaledVector(s.side,.9));}}
function closeStation(){card.style.display='none';ST.forEach(s=>{if(!job.list.some(J=>J.s===s&&J.chef&&!J.landed))s.target=0;if(s.lb)s.lb.classList.remove('dim');});if(tkt.style.display!=='block'){const lg=document.getElementById('legend');if(lg)lg.style.display='';}if(!sess&&!prev){const home=new THREE.Vector3(0,2.2,-1);if(fast)view={c:home,h:33};else zoomTo(home,33,3);}}
// ---------- timeline + loop ----------
// ?auto=<playbook id>: idle → the ticket prints (tP) → slides onto the rail → fires (tF) → each skill step pulls a chef, staggered → work → ingredient arcs → dish completes
const AUTO=qs.get('auto'),tP=+(qs.get('tp')||1.3),tF=tP+2.6;
rail(null,AUTO);setVisited();if(AUTO){job.wantPid=AUTO;}
if(qs.get('fire'))fire(qs.get('fire'));
let T=0,panelX=0;const EVENTS=[];
let lastDt=1/60;function step(dt){T+=dt;lastDt=dt;
 if(AUTO&&!fast){if(!job.pid&&T>=tF)fire(AUTO);if(job.pid)job.list.forEach((J,k)=>{if(!J.chef&&T>=tF+.35+k*.4)dispatch(J,T);});}
 if(AUTO&&fast&&!job.pid){fire(AUTO);}
 if(!fast){CHEFS.forEach(c=>{updChef(c,T,dt);c.g.position.y=Math.max(groundY(c.g.position.x,c.g.position.z),duckH(c.g.position));});updFly(dt,T);updStack(dt,T);updPuffs(dt);updAmbient(T);updSteam(dt,T);if(AUTO)updPrint(T,tP);}
 if(!fast)updExtra(dt,T);else{updLabels();updHint();updVisited();updSession(dt,T);updModal(dt);}   /* fast / reduced motion: no motion, but tickets and sessions still run to Order up */updDoors(dt);if(job.pid)job.list.forEach(J=>{const g=J.s.glow.material;const tgt=J.landed?.45:J.chef&&J.chef.st==='work'?1:J.chef?.55:.18;g.opacity+=(tgt-g.opacity)*Math.min(1,dt*3);});
 // the panel slides in; the camera's view offset follows it smoothly (subject stays centred, TASTE 15)
 const want=(card.style.display==='block'||tkt.style.display==='block')?360:0;panelX=fast?want:panelX+(want-panelX)*Math.min(1,dt*2.2);
 if(tkt.style.display==='block'&&!prev){const k=fast?1:ease.out(cl(panelX/360));tkt.style.opacity=k;tkt.style.transform=`translateX(${(1-k)*40}px)`;}}
let camE=null;window.__camSnap=()=>{camE=null;};
function render(){if(qs.get('view')==='wide'){view.c.set(5,1.5,-1.5);view.h=24;}   /* recording view: pass, back door and most stations in frame */if(!camE||fast||qs.get('freeze'))camE={c:view.c.clone(),h:view.h};else{const k=1-Math.exp(-(lastDt||1/60)*5);camE.c.lerp(view.c,k);camE.h+=(view.h-camE.h)*k;}   /* v2.5: gentle camera ease */
 const a=innerWidth/innerHeight,h=camE.h;cam.left=-h*a/2;cam.right=h*a/2;cam.top=h/2;cam.bottom=-h/2;cam.position.copy(camE.c).addScaledVector(ISO,100);cam.lookAt(camE.c);
 cam.setViewOffset(innerWidth,innerHeight,panelX/2,-59,innerWidth,innerHeight);cam.updateProjectionMatrix();R.render(scene,cam);LR.render(scene,cam);updBubble();}
// ---------- v2.2: served moment, zoom + level of detail, focused session replay ----------
const DEMO=qs.get('demo'),SESS_Q=qs.get('session'),ZQ=qs.get('zoom');let SESSION=null;
// served: after "Order up!" a free chef lifts the whole dish off the pass and carries it out on a curved path; the pass clears
let serve=null;const OUT=new THREE.Vector3(2.6,0,7.4);   // v2.4: service hatch just in front of the pass (short walk-out)
W(2.6,.02,8.3,2.4,.04,1.3,M('#E9A23B',MG));W(2.6,.05,8.3,1.9,.04,.85,M('#F6D88E',MG));
function updServe(dt,T){if(doneAt<0||fast)return;
 if(!serve&&T>doneAt+2.4){const c=CHEFS.filter(c=>c.st==='idle'&&c!==HEAD&&!c.off).sort((a,b)=>a.g.position.distanceTo(DISH)-b.g.position.distanceTo(DISH))[0];if(!c)return;
  const g=new THREE.Group();g.position.copy(DISH);scene.add(g);[dishPlate,...STACK.map(s=>s.m),garnish&&garnish.m].filter(Boolean).forEach(m=>{m.position.sub(DISH);g.add(m);});
  serve={c,g,ph:'go',t:0};c.job=null;walkTo(c,new THREE.Vector3(DISH.x,0,DISH.z+1.7));}
 if(!serve)return;const S=serve,c=S.c;S.t+=dt;
 if(S.ph==='go'&&c.st==='idle'&&S.t>.5){S.ph='pick';S.t=0;c.yawT=Math.PI;c.carry=true;S.from=S.g.position.clone();}
 const hand=()=>c.g.localToWorld(new THREE.Vector3(0,1.5,.72)).sub(new THREE.Vector3(0,.0,0)).setY(c.g.position.y+1.5);
 if(S.ph==='pick'){const u=ease.io(cl(S.t/1.4));S.g.position.lerpVectors(S.from,hand(),u).y+=Math.sin(Math.PI*u)*.35;if(orderUp)orderUp.d.style.opacity=(1-u).toFixed(3);
  if(u>=1){S.ph='carry';S.t=0;walkTo(c,OUT);}}
 if(S.ph==='carry'){S.g.position.copy(hand());if(S.t>.5&&c.st==='idle'){S.ph='gone';S.t=0;}}
 if(S.ph==='gone'){S.g.position.copy(hand());const k=1-ease.io(cl(S.t/1.2));S.g.scale.setScalar(Math.max(.001,k));if(k<=0&&!S.done){S.done=true;S.g.visible=false;c.carry=false;job.served=true;updTicket();}}}
// zoom: a calm log-space tween of the ortho height; the centre glides on a gentle arc; the subject stays centred in the visible area (card + header accounted for in render)
let tween=null;function zoomTo(c,h,dur=5){tween={c0:view.c.clone(),h0:view.h,c1:c.clone(),h1:h,t:0,dur};}
function updZoom(dt){if(!tween)return;tween.t+=dt;const u=ease.io(cl(tween.t/tween.dur));view.h=Math.exp(Math.log(tween.h0)+(Math.log(tween.h1)-Math.log(tween.h0))*u);
 const c=new THREE.Vector3().lerpVectors(tween.c0,tween.c1,u);c.y+=Math.sin(Math.PI*u)*.6;view.c=c;if(u>=1)tween=null;}
// level of detail: overview shows the 8 busiest stations; the rest fade in by mid zoom; at close zoom the focused station's prep bowls get labels and the card shows details
const TOP=new Set(ST.slice().sort((a,b)=>((b.n.degree||{}).total||0)-((a.n.degree||{}).total||0)).slice(0,8).map(s=>s.n.id));let focusS=null,bowlLb=[];
function setFocus(s){focusS=s;bowlLb.forEach(o=>scene.remove(o));bowlLb=BOWLS.filter(b=>b.s===s).map(b=>{const d=document.createElement('div');d.className='lb bowl';d.textContent=nm(b.n);const o=new CSS2DObject(d);o.position.copy(b.p).setY(b.p.y+.02).addScaledVector(b.s.fwd,.32);scene.add(o);o.d=d;return o;});}
function updLOD(){const h=view.h,mid=cl((26-h)/5),close=cl((12.5-h)/2.5);
 ST.forEach(s=>{if(s.lb.classList.contains('off')){s.lb.style.opacity=0;return;}const base=1;s.lb.style.opacity=(base*(s.lb.classList.contains('dim')?.55:1)*(focusS&&close>0&&s!==focusS?1-close*.7:1)).toFixed(3);});
 bowlLb.forEach(o=>{o.d.style.opacity=close.toFixed(3);o.d.style.transform+=` scale(${(.85+.15*close).toFixed(3)})`;});
 const det=card.querySelector('.det');if(det){det.style.opacity=close.toFixed(3);det.style.maxHeight=(close*220).toFixed(0)+'px';}}
const detHTML=n=>`<div class="det"><h4>Details</h4><dl><dt>File</dt><dd>${esc(n.path||'—')}</dd><dt>Length</dt><dd>${esc(n.lines||'—')} lines</dd><dt>Owner</dt><dd>${esc(n.owner&&n.owner!=='None'?n.owner:'unowned')}</dd><dt>Links</dt><dd>${(n.degree||{}).in||0} in · ${(n.degree||{}).out||0} out</dd><dt>Prep step</dt><dd>${esc(ACT_LINE[actOf(ST[stOf.get(n.id)])])}</dd></dl></div>`;
// demo=zoom: overview → slow zoom onto one station → its card slides in → a chef arrives behind the counter → door opens → works
let demoJ=null;const DF={};
function updDemo(dt,T){if(DEMO!=='zoom')return;const s=ST[stOf.get(qs.get('st')||'interrogate')];const ws=workSpot(s);const fc=s.p.clone().setY(s.p.y+1.9).addScaledVector(s.fwd,-.3);
 if(!demoJ&&T>=1.2){demoJ={s,k:0,act:actOf(s),dur:999,face:ws.face,e:{order:1}};const c=CHEFS.filter(c=>c!==HEAD).sort((a,b)=>a.g.position.distanceTo(ws.p)-b.g.position.distanceTo(ws.p))[0];demoJ.chef=c;walkTo(c,ws.p,demoJ);}
 if(!DF.place){DF.place=1;const c=CHEFS.filter(c=>c!==HEAD).sort((a,b)=>a.g.position.distanceTo(ws.p)-b.g.position.distanceTo(ws.p))[0];c.g.position.copy(ws.p).addScaledVector(s.side,s.run===4?-4.6:-3.4).addScaledVector(s.fwd,s.run===4?0:.6);c.g.rotation.y=c.yawT=s.ry;}
 if(T>=1&&!DF.z){DF.z=1;const H={mid:17,close:9}[ZQ]||+ZQ||9;zoomTo(fc,H,ZQ==='mid'?4:5);setFocus(s);}
 if(T>=3&&!DF.card){DF.card=1;openStation(s.n.id,true);s.target=0;}}
// session (replay): a focused, TV-style walk through one ticket; the camera follows each step's chef with slow cuts; a lower third narrates
const lt=document.createElement('div');lt.id='lt';document.body.appendChild(lt);lt.style.display='none';let sess=null;
// ---------- v2.3 session: preview a ticket (zoom in, Play button) → play → TV-style replay ----------
const ORDER={taste:'taste it and check how it works',sketch:'sketch the plan first',inspect:'inspect the plate closely',chop:'start cooking',stir:'start cooking'};
const ACT_LINE2=ACT_LINE;let prev=null;
function fileLink(n,label='Open file'){return n&&n.path?`<a href="#" class="flink" data-file="${esc(n.path)}">${esc(label)} <span>↗</span></a>`:'';}
function stepsOf(pid){return G.edges.filter(e=>e.source===pid&&e.mode==='step').sort((a,b)=>a.order-b.order);}
// clicking a rail ticket (or ?session=<id>): the ticket grows out of the rail into the side panel and the camera eases onto the pass
function openPreview(pid){if(sess)return;const p=N.get(pid);const el=[...document.querySelectorAll('#rail .tk')].find(d=>d.dataset.id===pid);const r0=el?el.getBoundingClientRect():null;
 document.querySelectorAll('#rail .tk').forEach(d=>d.classList.toggle('fire',d.dataset.id===pid));
 tkt.innerHTML=`<div class="k">Ticket · ready to cook</div><h3>${esc(p.name)}</h3><div class="d">${esc(p.description||'')}</div>${fileLink(p,'Open playbook file')}<ol>${stepsOf(pid).map(e=>{const n=N.get(e.target);return `<li><span class="o">${e.order}</span><span class="ic">${ICON[n.kind]||'·'}</span><span>${esc(nm(n))}</span></li>`}).join('')}</ol><div class="f"><button class="btn g" id="pvBack">Back</button><button class="btn play" id="pvPlay">▶ Play session</button></div>`;
 tkt.style.display='block';document.getElementById('legend').style.display='none';prev={pid,t:0,r0};zoomTo(DISH.clone().setY(2),14,3.2);
 document.getElementById('pvPlay').onclick=()=>playSession(pid);document.getElementById('pvBack').onclick=closePreview;}
function closePreview(){prev=null;tkt.style.display='none';document.getElementById('legend').style.display='';document.querySelectorAll('#rail .tk').forEach(d=>d.classList.remove('fire'));zoomTo(new THREE.Vector3(0,2.2,-1),33,3);}
function updPreview(dt){if(!prev||sess)return;prev.t+=dt;const u=ease.io(cl(prev.t/1.1));const r1=tkt.getBoundingClientRect();
 if(prev.r0&&r1.width){const sx=prev.r0.width/r1.width,sy=prev.r0.height/r1.height,dx=prev.r0.left-r1.left,dy=prev.r0.top-r1.top;
  tkt.style.transformOrigin='0 0';tkt.style.transform=`translate(${(dx*(1-u)).toFixed(1)}px,${(dy*(1-u)).toFixed(1)}px) scale(${(sx+(1-sx)*u).toFixed(4)},${(sy+(1-sy)*u).toFixed(4)})`;tkt.style.opacity=cl(.4+u).toFixed(3);}}
function playSession(pid){const b=document.getElementById('pvPlay');if(b)b.classList.add('press');prev=null;tkt.style.transform='';SESSION=pid;startSession();}
document.getElementById('rail').addEventListener('click',e=>{const d=e.target.closest('.tk');if(d&&!sess)openPreview(d.dataset.id);});
function startSession(){sess={t0:T,i:-1,cut:T,key:''};fire(SESSION);job.list.forEach(J=>J.dur=2.0);   /* v2.5: snappier work beats */document.body.classList.add('sess');lt.style.display='block';}
function updSession(dt,T){
 if(!sess){if(SESS_Q&&!prev&&!DF.pv){DF.pv=1;if(DEMO==='session'){if(T>=1)openPreview(SESS_Q);else DF.pv=0;}else openPreview(SESS_Q);}
  if(DEMO==='session'&&prev&&prev.t>=1.5)playSession(SESS_Q);updPreview(dt);return;}
 const L=job.list,i=L.findIndex(J=>!J.landed);{const k=L.findIndex(J=>!J.chef&&!J.landed);if(k>=0&&(k===0?T>sess.t0+.5:(L[k-1].landed||(L[k-1].chef&&T-L[k-1].dT>1.2)))){L[k].dT=T;dispatch(L[k],T);}}   /* v2.5: the next cook sets off while the previous one is working */
 const J=L[i>=0?i:L.length-1];const done=i<0;
 if(J&&J.chef&&sess.i!==i){sess.i=i;sess.cut=T;}if(done&&sess.i!==-2){sess.i=-2;sess.cut=T;}if(job.served&&sess.i!==-3){sess.i=-3;sess.cut=T;}
 let fc,h;if(done){if(serve&&!serve.done){fc=serve.c.g.position.clone().setY(2);h=10;}else if(job.served){fc=DISH.clone().setY(2);h=16;}else{fc=DISH.clone();h=11;}}else if(J.chef){const cp=J.chef.g.position;fc=cp.clone().lerp(J.s.p,.45).setY(J.s.p.y+1.8);h=J.chef.st==='work'?7.2:9.5;}else{fc=DISH.clone();h=12;}
 const k=1-Math.exp(-dt*.9);view.c.lerp(fc,k);view.h=Math.exp(Math.log(view.h)+(Math.log(h)-Math.log(view.h))*k);
 const n=done?null:N.get(J.e.target),el=T-sess.t0,mm=String(Math.floor(el/60)).padStart(2,'0'),ss=String(Math.floor(el%60)).padStart(2,'0');
 const head=done?(job.served?'Served':'Order up!'):nm(n);const cap=done?(job.served?'The dish has left the pass. Every step on the ticket is done.':'Every step is in. The dish is plated and waiting on the pass.'):`${ACT_LINE[J.act]} · ${caption(n)}`;
 const key=[head,cap,done?L.length:i+1,mm+ss].join('|');
 if(key!==sess.key){const first=!sess.key;sess.key=key;
  if(first)lt.innerHTML=`<div class="bar"><span class="live">● Session</span><span class="pb">${esc(nm(N.get(SESSION)))}</span><span class="ct"></span><span class="tm"></span></div><div class="ttl"></div><div class="cap"></div><div class="fl"></div>${job.rules?`<div class="rules">House rules watching: ${job.rules} · the head chef keeps an eye on them</div>`:''}<div class="ctl"><button class="btn g" id="ltReplay">↺ Replay</button><button class="btn g" id="ltExit">Exit</button></div>`;
  if(first){document.getElementById('ltReplay').onclick=()=>{const u=new URLSearchParams(location.search);u.set('session',SESSION);location.search=u;};document.getElementById('ltExit').onclick=()=>{const u=new URLSearchParams(location.search);u.delete('session');u.delete('demo');u.set('theme','kitchen');location.search=u;};}
  lt.querySelector('.ct').textContent=`Step ${done?L.length:i+1} / ${L.length}`;lt.querySelector('.tm').textContent=`${mm}:${ss}`;
  lt.querySelector('.ttl').textContent=head;lt.querySelector('.cap').textContent=cap;lt.querySelector('.fl').innerHTML=fileLink(done?N.get(SESSION):n,done?'Open playbook file':'Open skill file');}
 const fade=cl((T-sess.cut)/1.2).toFixed(3);lt.querySelector('.ttl').style.opacity=fade;lt.querySelector('.cap').style.opacity=fade;}
const U=G.upstream;
const aboutDt=new Date(U.commitDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
document.getElementById('about').innerHTML=`<p>A map of how the pstack skills library fits together: workflows, the tools and rules they use, and the docs behind them.</p>
  <dl><dt>Version</dt><dd>pstack ${esc(U.version)}</dd><dt>Data from</dt><dd>${esc(aboutDt)}</dd><dt>Commit</dt><dd><a href="${esc(U.url+'/commit/'+U.commit)}" style="font-family:var(--font-mono)">${esc(U.commitShort)}</a></dd>
  <dt>Source</dt><dd><a href="${esc(U.url+'/tree/'+U.commit+'/'+U.pluginPath)}">cursor/plugins</a></dd><dt>License</dt><dd><a href="${esc(U.licenseUrl)}">MIT</a> · © Lauren Tan</dd></dl>`;
const ab=document.getElementById('aboutBtn');
ab.onclick=()=>{const o=document.getElementById('about').classList.toggle('open');ab.setAttribute('aria-expanded',String(o));};
document.getElementById('srcLink').href=`${U.url}/tree/${U.commit}/${U.pluginPath}`;
document.getElementById('licLink').href=U.licenseUrl;
const themePick=document.getElementById('themePick');
if(themePick){themePick.value='kitchen';themePick.onchange=()=>{const params=new URLSearchParams(location.search);params.delete('shape');params.set('theme',themePick.value);location.search=params.toString();};}
const brandWord=document.getElementById('brandWord');
if(brandWord)brandWord.innerHTML='pstack <em>kitchen</em>';
document.title='pstack kitchen';
function md(src){let fm='';const m=src.match(/^---\n([\s\S]*?)\n---\n?/);if(m){fm=`<pre class="fm">${esc(m[1])}</pre>`;src=src.slice(m[0].length);}
 const inl=s=>esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|\W)\*([^*\n]+)\*/g,'$1<i>$2</i>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<u title="$2">$1</u>');
 const out=[];let list=null,code=null,para=[];const flush=()=>{if(para.length){out.push(`<p>${inl(para.join(' '))}</p>`);para=[];}if(list){out.push(`</${list}>`);list=null;}};
 for(const l of src.split('\n')){if(code!==null){if(/^\s*```/.test(l)){out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);code=null;}else code.push(l);continue;}
  if(/^\s*```/.test(l)){flush();code=[];continue;}let h=l.match(/^(#{1,4})\s+(.*)/);if(h){flush();out.push(`<h${h[1].length+1}>${inl(h[2])}</h${h[1].length+1}>`);continue;}
  let li=l.match(/^\s*([-*]|\d+\.)\s+(.*)/);if(li){if(para.length){out.push(`<p>${inl(para.join(' '))}</p>`);para=[];}const t=/\d/.test(li[1])?'ol':'ul';if(list!==t){if(list)out.push(`</${list}>`);out.push(`<${t}>`);list=t;}out.push(`<li>${inl(li[2])}</li>`);continue;}
  if(/^\s*\|/.test(l)){flush();out.push(`<pre class="tb">${esc(l)}</pre>`);continue;}
  if(!l.trim()){flush();continue;}if(list){flush();}para.push(l.trim());}
 if(code!==null)out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);flush();return fm+out.join('');}
const modal=document.createElement('div');modal.id='modal';modal.innerHTML=`<div class="scrim"></div><div class="box" role="dialog" aria-modal="true" aria-labelledby="mTitle"><div class="mh"><div><div class="k">Original file</div><h3 id="mTitle"></h3><div class="pth"></div></div><button class="x" aria-label="Close">✕</button></div><div class="mb" tabindex="0"></div></div>`;document.body.appendChild(modal);let lastFocus=null,modalT=-1;
function openFile(path){lastFocus=document.activeElement;const txt=textByPath.get(path);modal.querySelector('#mTitle').textContent=path.split('/').slice(-2).join('/');modal.querySelector('.pth').textContent=path;
 modal.querySelector('.mb').innerHTML=txt!=null?md(txt):`<p class="miss">The file is not in the map data. Path: <code>${esc(path)}</code></p>`;
 modal.style.display='block';modalT=0;if(qs.get('freeze')||fast){modalT=9;modal.style.opacity=1;}modal.querySelector('.x').focus();}
function closeFile(){modal.style.display='none';modalT=-1;if(lastFocus&&lastFocus.focus)lastFocus.focus();}
modal.querySelector('.x').onclick=closeFile;modal.querySelector('.scrim').onclick=closeFile;
addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();
  if(document.getElementById('about').classList.contains('open')){document.getElementById('aboutBtn').click();return;}
  if(modal.style.display==='block'){closeFile();return;}
  if(card.style.display==='block'){closeStation();return;}
  if(prev){closePreview();return;}
  return;}
 if(modal.style.display!=='block'||e.key!=='Tab')return;const f=[...modal.querySelectorAll('button,[tabindex="0"],a[href]')];const a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}});
document.addEventListener('click',e=>{const a=e.target.closest('[data-file]');if(a){e.preventDefault();openFile(a.dataset.file);}});
function updModal(dt){if(modalT<0)return;modalT+=dt;const u=ease.out(cl(modalT/.5));modal.style.opacity=u.toFixed(3);modal.querySelector('.box').style.transform=`translateY(${((1-u)*14).toFixed(1)}px)`;}
if(qs.get('open'))openStation(qs.get('open'));if(qs.get('file'))setTimeout(()=>openFile(qs.get('file')),50);
// ---------- head chef: a corner by the pass, tall hat, slow gestures; a speech bubble carries the current order ----------
const bub=document.createElement('div');bub.id='bub';document.body.appendChild(bub);let bubKey='';
function orderText(){if(!job.pid)return prev?`<b>${esc(nm(N.get(prev.pid)))}</b> is on the rail. Ready when you are.`:'';const t=`<b>${esc(nm(N.get(job.pid)))}</b>`;
 if(job.served)return `${t} · Served. Lovely work, everyone.`;if(doneAt>0)return `${t} · Order up! Take it out, please.`;
 const L=job.list,i=L.findIndex(J=>!J.landed);if(i<0)return `${t} · Plating now.`;const J=L[i];return `${t} · Step ${i+1} of ${L.length}: ${esc(nm(N.get(J.e.target)))}, ${ORDER[J.act]}.`;}
const HV=new THREE.Vector3();
function updBubble(){const html=orderText();if(!html||fast){bub.style.display='none';return;}if(html!==bubKey){bubKey=html;bub.innerHTML=html;}bub.style.display='block';
 HV.copy(HEAD.g.position).setY(HEAD.g.position.y+4.15).project(cam);const w=bub.offsetWidth,hh=bub.offsetHeight;let x=(HV.x+1)/2*innerWidth-w/2,y=(1-HV.y)/2*innerHeight-hh-10;
 const maxX=innerWidth-panelX-w-16,cx=Math.min(Math.max(16,x),maxX),cy=Math.min(Math.max(128,y),innerHeight-hh-(sess?250:40));bub.classList.toggle('pinned',Math.abs(cx-x)>2||Math.abs(cy-y)>2);
 bub.style.left=cx.toFixed(1)+'px';bub.style.top=cy.toFixed(1)+'px';}

// ================= crew: fresh poteto-agent cooks per step, guest chefs for interrogate/arena, Comment Sicko sends a plate back =================
const C_BACK=new THREE.Vector3(5.0,0,-10.7),C_IN=new THREE.Vector3(.4,0,8.6),C_OUT=new THREE.Vector3(4.8,0,8.6),FAR=new THREE.Vector3(40,0,40);
const LINE=()=>CHEFS.filter(c=>c!==HEAD);
function offstage(c){c.off=1;c.leaving=0;c.g.visible=false;c.g.position.copy(FAR);c.st='idle';c.curve=null;if(c.sicko)unSicko(c);}
function onstage(c,J){c.off=0;c.g.visible=true;c.g.position.copy(C_IN);c.g.rotation.y=c.yawT=Math.PI;c.st='idle';c.t=0;c.job=null;c.v=0;c.wait=0;c.blockT=0;c.req=null;c.fresh=1;}
let crewStarted=null;
function crewIn(J){if(crewStarted!==job.pid){crewStarted=job.pid;LINE().forEach(offstage);}
 if(allChefs().some(o=>Math.hypot(o.g.position.x-C_IN.x,o.g.position.z-C_IN.z)<CR*2+.3))return;const c=LINE().find(c=>c.off);if(c){onstage(c,J);if(/no-comments/.test(J.s.n.id))mkSicko(c);}}
function mkSicko(c){c.sicko=1;c.badge.visible=true;if(c.lbEl)c.lbEl.textContent='Comment Sicko';}
function unSicko(c){c.sicko=0;c.badge.visible=false;if(c.lbEl)c.lbEl.textContent='poteto-agent';}
// guests: other-model subagents in coloured jackets, standing still beside the station while it fires
const GCOL=['#3F7F8C','#3F7F8C','#2E6470'];   /* guest models share one teal; the judge is a deeper teal with a gold collar */var GUESTS=[0,1,2].map(k=>{const g=chef(5+k,'guest',FAR.clone(),0);CHEFS.splice(CHEFS.indexOf(g),1);recolor(g,GCOL[k]);g.apP.visible=false;g.htP.scale.set(1,.6,1);g.g.visible=false;g.on=false;g.pop=new Spr(0);return g;});
let guestJob=null;
function guestSpots(J,n){const ws=workSpot(J.s);const out=[];const others=allChefs();for(let r=2.4;r<5.2&&out.length<n;r+=.4)for(let a=0;a<Math.PI*2&&out.length<n;a+=Math.PI/10){const x=ws.p.x+Math.cos(a)*r,z=ws.p.z+Math.sin(a)*r;if(blocked(x,z)||Math.hypot(x-C_IN.x,z-C_IN.z)<3||Math.hypot(x-C_OUT.x,z-C_OUT.z)<3)continue;const q=new THREE.Vector3(x,0,z);if(others.concat(out.map(p=>({g:{position:p}}))).some(o=>Math.hypot(o.g.position.x-x,o.g.position.z-z)<CR*2+1))continue;out.push(q);}return out;}
function guestsOn(J){const id=J.s.n.id;const roles=/interrogate/.test(id)?['guest reviewer','guest reviewer']:/arena/.test(id)?['guest runner','guest runner','guest judge · different family from the expediter']:null;if(!roles)return;const sp=guestSpots(J,roles.length);sp.forEach((p,k)=>{const g=GUESTS[k];g.on=true;g.g.visible=true;g.g.position.copy(p);g.st='idle';g.t=0;const ws=workSpot(J.s).p;g.g.rotation.y=g.yawT=Math.atan2(ws.x-p.x,ws.z-p.z);g.pop.x=0;g.pop.v=0;if(g.lbEl)g.lbEl.textContent=roles[k];});guestJob=J;}
function guestsOff(){GUESTS.forEach(g=>{g.on=false;g.g.visible=false;g.g.position.copy(FAR);});guestJob=null;}
// Comment Sicko: when its plate lands, the previous plate is sent back along an arc to its own station
const BACK=[];function sendBack(J){const prev=job.list.filter(x=>x.landed&&x!==J).pop();if(!prev)return;const m=new THREE.Mesh(new THREE.CylinderGeometry(.42,.32,.07,32),M('#FFFDF8',MG));const p0=DISH.clone().setY(DISH.y+stackH),p1=prev.s.p.clone().setY(prev.s.p.y+2.45).addScaledVector(prev.s.fwd,.5);m.position.copy(p0);scene.add(m);
 const d=document.createElement('div');d.className='lb';d.textContent='sent back';const o=new CSS2DObject(d);o.position.set(0,.6,0);m.add(o);BACK.push({m,o,p0,p1,t:0});}
function updCrew(dt,T){if(!CREW||!job.pid)return;
 LINE().forEach(c=>{if(c.off)return;if(c.leaving){if(c.exitT!=null||(c.st==='idle'&&Math.hypot(c.g.position.x-C_BACK.x,c.g.position.z-C_BACK.z)<1)){c.exitT=(c.exitT||0)+dt;const u=cl(c.exitT/1.1);c.g.rotation.y=c.yawT=Math.PI;c.g.position.z=C_BACK.z-ease.io(u)*1.9;c.g.position.x+=(C_BACK.x-c.g.position.x)*Math.min(1,dt*6);if(u>=1){c.exitT=null;offstage(c);}}return;}   /* through the open back door; the wall hides them */
  if(!c.leaving&&crewStarted===job.pid&&c.job&&c.job.landed&&c.st==='idle'&&c.t>.4&&doneAt<0){c.leaving=1;walkTo(c,C_BACK.clone());}
  if(c.job&&c.job.chef===c&&c.st==='work'&&!guestJob&&!c.job.gDone){c.job.gDone=1;guestsOn(c.job);}
  if(c.sicko&&c.job&&c.job.landed&&!c.job.sent){c.job.sent=1;sendBack(c.job);}});
 if(guestJob&&guestJob.landed)guestsOff();
 GUESTS.forEach(g=>{if(!g.on)return;g.pop.step(1,30,8,dt);g.g.scale.setScalar(Math.max(.01,g.pop.x));updChef(g,T,dt);g.g.position.y=groundY(g.g.position.x,g.g.position.z);});
 for(const b of BACK){if(b.done)continue;b.t+=dt;const u=cl(b.t/1.4),e=ease.sin(u);const mid=b.p0.clone().lerp(b.p1,.5);mid.y=Math.max(b.p0.y,b.p1.y)+2.6;b.m.position.copy(new THREE.QuadraticBezierCurve3(b.p0,mid,b.p1).getPoint(e));b.m.rotation.z=Math.sin(e*Math.PI)*.6;if(u>=1&&b.t>2.4){b.done=1;b.m.remove(b.o);scene.remove(b.m);}}}
window.__bd=()=>BD.a.x;
// v2.6: two more poteto-agents in the back room, so a fresh cook is free while others walk out
[8,9].forEach(i=>{const c=chef(i,'poteto-agent',FAR.clone(),0);c.off=1;c.g.visible=false;});
// v2.6 uniforms: poteto-agents in one terracotta jacket; Comment Sicko adds a small plum badge; judge gets a gold collar
const AGENT_JK='#C4583F';LINE().forEach(c=>{recolor(c,AGENT_JK);const b=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.04,20),M('#5B3A6B',MG));b.rotation.x=Math.PI/2;b.position.set(-.2,1.3,.5);b.visible=false;c.body.add(b);c.badge=b;});
{const j=GUESTS[2];const col=new THREE.Mesh(new THREE.TorusGeometry(.36,.05,10,32),M('#E2B65A',MS));col.rotation.x=Math.PI/2;col.position.y=1.62;j.body.add(col);}
// v2.6 back door on the nook wall (x=16): frame + leaf that swings open while a cook is near it
const BD={leaf:null,a:new Spr(0)};{const g=new THREE.Group();g.rotation.y=Math.PI/2;g.position.set(4.85,0,-11.94);scene.add(g);
 [[0,1.45,-.78,.14,2.95,.16],[0,1.45,.78,.14,2.95,.16],[0,2.92,0,.14,.14,1.72]].forEach(([x,y,z,w,h,d])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M('#8A5A3B'));m.position.set(x,y,z);g.add(m);});
 const back=new THREE.Mesh(new THREE.BoxGeometry(.02,2.8,1.4),new THREE.MeshBasicMaterial({color:'#1F1712'}));back.position.set(.05,1.4,0);g.add(back);
 const hinge=new THREE.Group();hinge.position.set(-.05,0,-.7);g.add(hinge);const leaf=new THREE.Mesh(rbox(.08,2.8,1.38,.02),M('#A8694A'));leaf.position.set(0,1.4,.69);hinge.add(leaf);
 const kn=new THREE.Mesh(new THREE.SphereGeometry(.06,12,8),M('#E7C48B',MS));kn.position.set(-.08,1.35,1.2);hinge.add(kn);BD.leaf=hinge;}
function updBackDoor(dt){const near=LINE().some(c=>!c.off&&c.leaving&&Math.hypot(c.g.position.x-C_BACK.x,c.g.position.z-C_BACK.z)<3.2);BD.a.step(near?1:0,40,11,dt);BD.leaf.rotation.y=BD.a.x*1.45;}
function updExtra(dt,T){updBackDoor(dt);updFX(dt,T);updCrew(dt,T);updChef(SUP,T,dt);updLabels();updHint();updVisited();updDoorsDemo(dt,T);updDemo(dt,T);updSession(dt,T);updZoom(dt);updServe(dt,T);updLOD();updModal(dt);}

if(qs.get('doors'))ST.forEach(s=>s.target=DOOR_OPEN);if(qs.get('view')){const [x,y,z,h]=qs.get('view').split(',').map(Number);view={c:new THREE.Vector3(x,y,z),h};}
// ---------- v2.3 clip test (?cliptest=1): sweeps every door through its full travel and checks it against everything around it ----------
// Door sample points: a 5×5×2 grid over each door part's geometry box (leaf, inset panel, knob), pushed through that station's instance matrix.
// Obstacles: every other mesh's world box (cabinets, counter tops, neighbours' doors, props, bowls, walls), the station's own carcass (local test), label anchors, and every chef's body parts.
const DOOR_PARTS=()=>[door,dpanel,knob,doorB,bpanel];
function doorPts(i){const out=[],M4=new THREE.Matrix4();DOOR_PARTS().forEach(m=>{m.geometry.computeBoundingBox();const b=m.geometry.boundingBox;m.getMatrixAt(i,M4);
 for(let a=0;a<5;a++)for(let c=0;c<5;c++)for(let d=0;d<2;d++)out.push(new THREE.Vector3(b.min.x+(b.max.x-b.min.x)*a/4,b.min.y+(b.max.y-b.min.y)*c/4,d?b.max.z:b.min.z).applyMatrix4(M4));});return out;}
const OWN=new Set();function staticBoxes(){const out=[];const own=[door,dpanel,knob,doorB,bpanel,dinner,cab.m,top.m,plinth.m];
 scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh&&false)return;let ch=o;while(ch){if(CHEFS.some(c=>c.g===ch))return;ch=ch.parent;}
  const mat=o.material;if(mat&&(mat.blending===THREE.AdditiveBlending||mat.depthWrite===false))return;   // glows, blob shadows, decals: not solid
  if(o.isInstancedMesh){o.geometry.computeBoundingBox();const M4=new THREE.Matrix4();for(let k=0;k<o.count;k++){o.getMatrixAt(k,M4);const b=o.geometry.boundingBox.clone().applyMatrix4(M4);if(b.isEmpty())continue;out.push({b,what:o===cab.m?'cabinet':o===top.m?'counter top':own.includes(o)?'door/plinth':'inst:'+o.geometry.type+'['+b.getSize(new THREE.Vector3()).toArray().map(v=>v.toFixed(2))+']',k:own.includes(o)?k:-1,m:o});}}
  else{const b=new THREE.Box3().setFromObject(o);if(b.max.y<.05||b.max.y-b.min.y<.1)return;   // floor slabs, rugs   // floor slabs
   out.push({b,what:(o.geometry&&o.geometry.type||'mesh')+'['+b.getSize(new THREE.Vector3()).toArray().map(v=>v.toFixed(2))+'] @'+b.getCenter(new THREE.Vector3()).toArray().map(v=>v.toFixed(1)),k:-1,m:o});}});return out;}
function chefBoxes(){const out=[];CHEFS.concat(GUESTS.filter(g=>g.on).map(g=>(g.g.updateMatrixWorld(true),g))).forEach(c=>c.g.traverse(o=>{if(o.isMesh&&o.visible&&o.geometry.type!=='PlaneGeometry'&&o.geometry.type!=='CircleGeometry'||o.isMesh&&o.visible&&o.parent!==c.g&&o.geometry.type==='CircleGeometry'){let v=true,p=o;while(p){if(!p.visible)v=false;p=p.parent;}if(v)out.push({b:new THREE.Box3().setFromObject(o),c,g:o.geometry.type});}}));return out;}
const inCarcass=(s,p)=>{const l=p.clone().sub(s.p).applyQuaternion(s.q.clone().invert());return Math.abs(l.x)<1.1-1e-3&&l.y>.1&&l.y<2.15&&l.z<.95-1e-3&&l.z>-.95;};
function clipFrame(STB,where,tag,log,onlyMoving){const CB=chefBoxes();ST.forEach((s,i)=>{if(onlyMoving&&s.ang<1e-3)return;const P=doorPts(i);
 for(const p of P){if(inCarcass(s,p)){log.push({st:s.n.id,ang:+s.ang.toFixed(3),hit:'own carcass',tag});return;}
  for(const o of STB){if(o.k===i)continue;if(o.b.containsPoint(p)){log.push({st:s.n.id,ang:+s.ang.toFixed(3),hit:o.what+(o.k>=0?' #'+ST[o.k].n.id:''),tag});return;}}
  for(const o of CB){if(o.b.containsPoint(p)){log.push({st:s.n.id,ang:+s.ang.toFixed(3),hit:'chef '+o.c.i+' ('+o.c.st+') '+o.g+' @'+p.toArray().map(v=>v.toFixed(2)),tag});return;}}
  for(const t of ST){const a=t.p.clone().setY(t.p.y+3.05).addScaledVector(t.fwd,.5);if(a.distanceTo(p)<.05){log.push({st:s.n.id,ang:+s.ang.toFixed(3),hit:'label anchor',tag});return;}}}});}
// phase A: for every station, chefs pose at that station's work spot and both neighbours'; the door runs through its whole travel

// parts as vertical cylinders (centre + largest horizontal half-extent): avoids false hits from the empty corners of axis-aligned boxes when chefs pass diagonally
const partHit=(x,y)=>{if(x.max.y<y.min.y||y.max.y<x.min.y)return false;const cx=(x.min.x+x.max.x)/2,cz=(x.min.z+x.max.z)/2,dx=(y.min.x+y.max.x)/2,dz=(y.min.z+y.max.z)/2;const rx=Math.max(x.max.x-x.min.x,x.max.z-x.min.z)/2,ry=Math.max(y.max.x-y.min.x,y.max.z-y.min.z)/2;return Math.hypot(cx-dx,cz-dz)<rx+ry;};
function chefPairs(log,tag){const B=new Map();chefBoxes().forEach(o=>{if(!B.has(o.c))B.set(o.c,[]);B.get(o.c).push(o.b.clone().expandByScalar(-.03));});if(typeof SUP!=='undefined'){SUP.g.updateMatrixWorld(true);const a=[];SUP.g.traverse(m=>{if(m.isMesh&&m.visible&&m.geometry&&!/Plane|Circle/.test(m.geometry.type))a.push(new THREE.Box3().setFromObject(m).expandByScalar(-.03));});B.set(SUP,a);}
 const cs=[...B.keys()];for(let a=0;a<cs.length;a++)for(let b=a+1;b<cs.length;b++){if(cs[a].g.position.distanceTo(cs[b].g.position)>4)continue;if(B.get(cs[a]).some(x=>B.get(cs[b]).some(y=>partHit(x,y)))){log.push({st:'(chefs)',ang:0,hit:`chef ${cs[a].i} (${cs[a].st}) x chef ${cs[b].i} (${cs[b].st}) at ${cs[a].g.position.toArray().map(v=>v.toFixed(1))}`,tag});}}}
const ORIENT=[];window.__orient=()=>ORIENT;
function clipSweep(){const log=[];const STB=staticBoxes();const free=CHEFS.filter(c=>c!==HEAD);const keep=CHEFS.map(c=>[c.g.position.clone(),c.g.rotation.y,c.st,c.job]);
 ST.forEach((s,i)=>{CHEFS.forEach(c=>{c.g.position.copy(c.home);c.st='idle';c.job=null;c.g.updateMatrixWorld(true);});const nb=ST.filter(t=>t!==s&&workSpot(t).p.distanceTo(s.p)<4.2&&workSpot(t).p.distanceTo(workSpot(s).p)>CR*2+.1).sort((a,b)=>a.p.distanceTo(s.p)-b.p.distanceTo(s.p)).slice(0,2);[s,...nb].forEach((t,k)=>{const c=free[k];if(!c)return;const ws=workSpot(t);c.g.position.copy(ws.p);c.g.position.y=Math.max(groundY(c.g.position.x,c.g.position.z),duckH(c.g.position));c.g.rotation.y=c.yawT=ws.face;c.job={s:t,act:actOf(t),dur:999,face:ws.face,k:0,e:{order:1}};c.st='work';c.t=1;
   for(let f=0;f<30;f++)updChef(c,f/30*3.1,1/30);c.g.position.y=Math.max(groundY(c.g.position.x,c.g.position.z),duckH(c.g.position));c.g.updateMatrixWorld(true);});
  chefPairs(log,'stand '+s.n.id);
  {const n=new THREE.Vector3(0,0,1).applyQuaternion(doorQ(s)).setY(0).normalize(),ws=workSpot(s),dc=s.p.clone().addScaledVector(n,1.07),d=ws.p.clone().sub(dc).setY(0).normalize(),f=new THREE.Vector3(Math.sin(ws.face),0,Math.cos(ws.face));
   const a1=n.dot(d),a2=-n.dot(f);if(a1<=.7||a2<=.7)log.push({st:s.n.id,ang:0,hit:`orientation: door normal·to-spot=${a1.toFixed(2)}, cook facing·door=${a2.toFixed(2)} (both must be >0.7)`,tag:'orient'});ORIENT.push([s.n.id,+a1.toFixed(2),+a2.toFixed(2)]);}
  // chef bodies at their spots vs solid geometry (cabinets, tops, walls, props): a chef must never stand inside furniture
  {const cs=[s,...nb].map((t,k)=>free[k]).filter(Boolean);chefBoxes().filter(o=>cs.includes(o.c)&&/Capsule|Sphere|Cylinder/.test(o.g)&&o.b.getSize(new THREE.Vector3()).y>.3).forEach(o=>{const b=o.b.clone().expandByScalar(-.04);for(const x of STB){if(x.b.intersectsBox(b)){log.push({st:s.n.id,ang:0,hit:'chef '+o.c.i+' body inside '+x.what+(x.k>=0?' #'+ST[x.k].n.id:''),tag:'stand'});break;}}});}
  for(let a=0;a<=20;a++){s.ang=DOOR_MAX(s)*a/20;doorM(s,i);clipFrame(STB,'',`sweep ${a}/20`,log,false);}s.ang=0;doorM(s,i);});
 CHEFS.forEach((c,k)=>{c.g.position.copy(keep[k][0]);c.g.rotation.y=keep[k][1];c.st=keep[k][2];c.job=keep[k][3];c.knife.visible=c.spoon.visible=c.plate.visible=c.mag.visible=c.board.visible=false;});return log;}
// phase B: the real session for a playbook, frame by frame at 30 fps: walking, arriving, working and serving chefs against every moving or open door
function clipSession(secs){const log=[];const STB=staticBoxes();for(let f=0;f<secs*30;f++){for(let k=0;k<4;k++)step(1/120);CHEFS.forEach(c=>c.g.updateMatrixWorld(true));clipFrame(STB,'',`t=${T.toFixed(2)}`,log,true);chefPairs(log,`t=${T.toFixed(2)}`);if(qs.get('dbg')&&T>+qs.get('dbg')&&T<+qs.get('dbg')+2.5&&f%3===0)log.push({st:'dbg',ang:0,hit:CHEFS.slice(0,3).map(c=>c.i+':'+c.st+' '+c.g.position.x.toFixed(2)+','+c.g.position.z.toFixed(2)+' v'+(c.v||0).toFixed(2)+' w'+(c.wait||0).toFixed(1)+' ->'+(c.dest?c.dest.x.toFixed(1)+','+c.dest.z.toFixed(1):'')).join(' | '),tag:'t='+T.toFixed(2)});
  if(f%3===0)chefBoxes().filter(o=>/Capsule/.test(o.g)&&o.b.getSize(new THREE.Vector3()).y>.6&&o.c.exitT==null).forEach(o=>{const b=o.b.clone().expandByScalar(-.04);for(const x of STB){if(x.m&&x.m.userData.walkable)continue;if(x.b.intersectsBox(b)){log.push({st:'(walk)',ang:0,hit:'chef '+o.c.i+' ('+o.c.st+') at '+o.c.g.position.toArray().map(v=>v.toFixed(2))+' body inside '+x.what+(x.k>=0?' #'+ST[x.k].n.id:''),tag:`t=${T.toFixed(2)}`});break;}}});}if(qs.get('auto')||qs.get('session')){const stuck=allChefs().filter(c=>c.st==='walk'&&(c.wait||0)>.2);if(doneAt<0||stuck.length)log.push({st:'(end)',ang:0,hit:`run did not finish cleanly: doneAt=${doneAt.toFixed?doneAt.toFixed(1):doneAt}, waiting cooks: ${stuck.map(c=>c.i).join(',')||'none'}`,tag:'end'});}return log;}
window.__clip=(secs)=>{const t0=performance.now();const A=clipSweep();const B=secs?clipSession(secs):[];return {sweep:A.length,session:B.length,ms:Math.round(performance.now()-t0),first:A.concat(B).slice(0,40),byStation:Object.entries(A.concat(B).reduce((m,x)=>(m[x.st]=(m[x.st]||0)+1,m),{}))};};

// close-up rig for the door contact sheets: station i's door at slide u, a chef working at its spot, camera framed on the front
window.__ev=s=>eval(s);window.__doorShot=(i,u)=>{camE=null;ST.forEach((t,k)=>{t.ang=t.target=0;doorSpr[k].x=0;doorSpr[k].v=0;doorM(t,k);});const s=ST[i];s.ang=s.target=u;doorSpr[i].x=u;doorM(s,i);[door,dpanel,knob,doorB,bpanel,dinner].forEach(m=>m.instanceMatrix.needsUpdate=true);
 const c=CHEFS[0];CHEFS.forEach(o=>{if(o!==HEAD){o.g.position.copy(o.home);o.g.position.y=Math.max(groundY(o.g.position.x,o.g.position.z),duckH(o.g.position));}});const ws=workSpot(s);c.g.position.copy(ws.p);c.g.position.y=Math.max(groundY(c.g.position.x,c.g.position.z),duckH(c.g.position));c.g.rotation.y=c.yawT=ws.face;c.job={s,act:actOf(s),dur:999,face:ws.face,k:0,e:{order:1}};c.st='work';c.t=1;
 for(let f=0;f<30;f++)updChef(c,2+f/30,1/30);c.g.position.y=Math.max(groundY(c.g.position.x,c.g.position.z),duckH(c.g.position));
 view={c:s.p.clone().setY(s.p.y+1.3).addScaledVector(s.fwd,1.3),h:+(qs.get('dh')||5.2)};panelX=0;card.style.display='none';tkt.style.display='none';render();return s.n.id;};

// ?demo=doors: three cooks step up to three peninsula stations in turn; each sliding door opens as its cook arrives; the camera drifts slowly along
const DD={};function updDoorsDemo(dt,T){if(DEMO!=='doors')return;const P=ST.filter(s=>s.run===4).sort((a,b)=>a.p.x-b.p.x).slice(0,3);const cs=CHEFS.filter(c=>c!==HEAD).slice(0,3);
 if(!DD.init){DD.init=1;P.forEach((s,k)=>{const c=cs[k],w=workSpot(s).p;c.g.position.set(w.x+.9,0,w.z+2.3);c.g.rotation.y=c.yawT=Math.PI;}); /* v2.5: each cook waits a step behind its own station, then walks in (no crossing) */}
 P.forEach((s,k)=>{if(!DD[k]&&T>=.6+k*2.4){DD[k]=1;const c=cs[k],ws=workSpot(s);const J={s,act:actOf(s),dur:999,face:ws.face,k,e:{order:k+1}};J.chef=c;walkTo(c,ws.p,J);}});
 const u=ease.sin(cl(T/13));view.c=P[0].p.clone().lerp(P[2].p,.5+.5*(u-.5)).setY(1.6).addScaledVector(P[0].fwd,.6);view.h=7.6;}

// ================= v2.4 quick sketch: calm labels, hover, game feel =================
// labels: by default only the active ticket's stations + the pass; everything else on hover or when zoomed in. Cook tags on hover or while working.
let hoverS=null,hoverC=null;const ndc=new THREE.Vector3();const scr=v=>{ndc.copy(v).project(cam);return [(ndc.x+1)/2*innerWidth,(1-ndc.y)/2*innerHeight];};
cv.addEventListener('pointermove',e=>{let best=70,bs=null;ST.forEach(s=>{const [x,y]=scr(s.p.clone().setY(s.p.y+2.2));const d=Math.hypot(x-e.clientX,y-e.clientY);if(d<best){best=d;bs=s;}});hoverS=bs;
 let bc=null,b2=55;[...CHEFS,SUP,...GUESTS.filter(g=>g.on)].filter(c=>!c.off).forEach(c=>{const [x,y]=scr(c.g.position.clone().setY(1.6));const d=Math.hypot(x-e.clientX,y-e.clientY);if(d<b2){b2=d;bc=c;}});hoverC=bc;});
cv.addEventListener('click',e=>{let best=70,bs=null;ST.forEach(s=>{const [x,y]=scr(s.p.clone().setY(s.p.y+2.2));const d=Math.hypot(x-e.clientX,y-e.clientY);if(d<best){best=d;bs=s;}});if(bs)openStation(bs.n.id);});
const activeIds=()=>{const pid=job.pid||(prev&&prev.pid)||(sess&&sess.pid);return new Set(pid?stepsOf(pid).map(e=>e.target):[]);};
function updLabels(){const rl=document.getElementById('rail'),fe=rl.querySelector('.tk.fire');rl.classList.toggle('has-fire',!!fe);if(fe&&fe!==rl._f){rl._f=fe;fe.scrollIntoView({inline:'center',block:'nearest'});}const A=activeIds(),zoomed=view.h<11&&qs.get('view')!=='wide';ST.forEach(s=>{if(!s.lb)return;const on=A.has(s.n.id)||s===hoverS||s===focusS||zoomed||qs.get('labels')==='all';s.lb.classList.toggle('off',!on);s.lb.classList.toggle('act',A.has(s.n.id));});
 [...CHEFS,SUP,...GUESTS].forEach(c=>{if(c.lbEl)c.lbEl.classList.toggle('off',c!==hoverC); });if(T>1.2)document.body.classList.add('lbready');
 if(RULESLB)RULESLB.classList.toggle('off',!(zoomed||(hoverS&&hoverS.run===1)||hoverC===SUP));}
// game feel: first-step hint, squash on every click, stations-visited reward
const hint=document.createElement('div');hint.id='hint';document.body.appendChild(hint);let hinted=!!localStorage.getItem('kc.started');
function updHint(){let txt='',x=0,y=0;if(sess||job.pid){hint.style.opacity=0;return;}
 if(prev){const b=document.getElementById('pvPlay');if(b){const r=b.getBoundingClientRect();txt='② Press Play to watch it cook';x=tkt.getBoundingClientRect().left-16;y=r.top+r.height/2;hint.className='left';}}
 else if(!hinted||qs.get('hint')){const t=document.querySelector('#rail .tk');if(t){const r=t.getBoundingClientRect();txt='① Pick a ticket to start cooking';x=r.left+r.width/2;y=r.bottom+14;hint.className='down';}}
 hint.style.opacity=txt?1:0;if(txt){hint.textContent=txt;hint.style.left=x+'px';hint.style.top=y+'px';}}
document.addEventListener('pointerdown',e=>{const el=e.target.closest('.tk,.btn,.chip,.flink,button,.seg span');if(el){el.classList.remove('squash');void el.offsetWidth;el.classList.add('squash');}
 else if(e.target===cv){const t=document.createElement('div');t.className='tap';t.style.left=e.clientX+'px';t.style.top=e.clientY+'px';document.body.appendChild(t);setTimeout(()=>t.remove(),520);}
 if(e.target.closest('#rail .tk')){hinted=true;localStorage.setItem('kc.started','1');}},true);
{const v=document.getElementById('visited');v.insertAdjacentHTML('beforeend','<i class="bar"><i></i></i>');}
let lastVis=-1;function updVisited(){const n=[...visited].filter(id=>N.get(id)?.kind==='skill').length;const v=document.getElementById('visited');v.querySelector('.bar i').style.width=(n/27*100)+'%';
 if(lastVis>=0&&n>lastVis){v.classList.remove('pop');void v.offsetWidth;v.classList.add('pop');const t=document.createElement('div');t.className='toast';t.textContent='+1 station visited';document.body.appendChild(t);setTimeout(()=>t.remove(),1800);}lastVis=n;}

// ================= v2.5 VFX: one soft-sprite particle pool (single draw call), all skipped in fast / reduced-motion =================
const FXN=700,fP=new Float32Array(FXN*3),fC=new Float32Array(FXN*3),fA=new Float32Array(FXN),fS=new Float32Array(FXN);const fV=new Float32Array(FXN*3),fL=new Float32Array(FXN),fM=new Float32Array(FXN),fK=new Uint8Array(FXN),fZ=new Float32Array(FXN*2),fO=new Float32Array(FXN*3);let fI=0;
const fG=new THREE.BufferGeometry();fG.setAttribute('position',new THREE.BufferAttribute(fP,3));fG.setAttribute('color',new THREE.BufferAttribute(fC,3));fG.setAttribute('alpha',new THREE.BufferAttribute(fA,1));fG.setAttribute('size',new THREE.BufferAttribute(fS,1));
const fMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pr:{value:R.getPixelRatio()}},vertexShader:'attribute float alpha;attribute float size;attribute vec3 color;varying float va;varying vec3 vc;uniform float pr;void main(){va=alpha;vc=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size*pr;}',
 fragmentShader:'varying float va;varying vec3 vc;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.15,d)*va;if(a<.01)discard;gl_FragColor=vec4(vc,a);}'});
const fx=new THREE.Points(fG,fMat);fx.frustumCulled=false;fx.renderOrder=5;fx.visible=!fast;scene.add(fx);
const FXK={steam:{life:2.6,s:[16,44],a:.32,c:'#FFFFFF',g:0,drag:.4},ember:{life:1.1,s:[11,4],a:1,c:'#FFB35A',c2:'#E2553A',g:-1.2,drag:.6},sparkle:{life:1.3,s:[9,0],a:1,c:'#FFE08A',c2:'#FFFFFF',g:-2.2,drag:1.2}};
const FXKEYS=Object.keys(FXK);const _c=new THREE.Color(),_c2=new THREE.Color();
function emit(kind,p,n=1,spd=.6,up=0){if(fast)return;const K=FXKEYS.indexOf(kind);for(let k=0;k<n;k++){const i=fI=(fI+1)%FXN;fK[i]=K;fL[i]=0;fM[i]=FXK[kind].life*(.75+rnd()*.5);
 const a=rnd()*Math.PI*2,e=rnd()*spd;fO[i*3]=p.x;fO[i*3+1]=p.y;fO[i*3+2]=p.z;fP[i*3]=p.x;fP[i*3+1]=p.y;fP[i*3+2]=p.z;fV[i*3]=Math.cos(a)*e;fV[i*3+1]=up+rnd()*spd*.5;fV[i*3+2]=Math.sin(a)*e;fZ[i*2]=rnd()*6;fZ[i*2+1]=.6+rnd()*.8;}}
function updFX(dt,T){allChefs().forEach(c=>{});if(fast){fx.visible=false;return;}for(let i=0;i<FXN;i++){if(fL[i]>=fM[i]){fA[i]=0;continue;}const K=FXK[FXKEYS[fK[i]]];fL[i]+=dt;const u=fL[i]/fM[i];
  const dr=Math.exp(-K.drag*dt);fV[i*3]*=dr;fV[i*3+2]*=dr;fV[i*3+1]=fV[i*3+1]*dr+K.g*dt;
  fP[i*3]+=fV[i*3]*dt;fP[i*3+1]+=fV[i*3+1]*dt;fP[i*3+2]+=fV[i*3+2]*dt;
  if(K===FXK.steam){const w=fZ[i*2]+T*fZ[i*2+1];fP[i*3]+=Math.sin(w)*.25*dt*(.3+u);fP[i*3+2]+=Math.cos(w*1.3)*.25*dt*(.3+u);}   // soft curl
  fS[i]=K.s[0]+(K.s[1]-K.s[0])*u;const fade=K===FXK.steam?Math.sin(Math.PI*u):1-u;fA[i]=K.a*fade*(K===FXK.sparkle?.6+.4*Math.sin(fL[i]*30+fZ[i*2]):1);
  _c.set(K.c);if(K.c2){_c2.set(K.c2);_c.lerp(_c2,u);}fC[i*3]=_c.r;fC[i*3+1]=_c.g;fC[i*3+2]=_c.b;}
 ['position','color','alpha','size'].forEach(k=>fG.attributes[k].needsUpdate=true);
 // emitters
 const r=x=>dt*x>rnd();
 POTS.forEach(o=>{const p=o.lid.position;if(r(5))emit('steam',p.clone().setY(p.y+.25),1,.12,.55);if(r(4))emit('ember',new THREE.Vector3(p.x+(rnd()-.5)*1.1,p.y-.6,p.z+(rnd()-.5)*.8),1,.4,1.1);});
 // glow pulse on stations being worked
 job.list&&job.list.forEach(J=>{if(J.s&&J.s.glow){const k=J.chef&&!J.landed?1+.07*Math.sin(T*4.2):1;J.s.glow.scale.set(k,k,1);}});
 // dish complete: sparkle burst + 'ding' bell (visual only)
 if(doneAt>0&&!FXdone){FXdone=1;emit('sparkle',DISH.clone().setY(DISH.y+.9),46,2.4,2.2);ding();}if(doneAt<0)FXdone=0;}
let FXdone=0;function ding(){if(fast)return;const d=document.createElement('div');d.className='ding';d.innerHTML='<span class="bell">🛎</span><i></i><i></i><i></i>';document.body.appendChild(d);const v=DISH.clone().setY(DISH.y+3);v.project(cam);d.style.left=((v.x+1)/2*innerWidth)+'px';d.style.top=((1-v.y)/2*innerHeight)+'px';setTimeout(()=>d.remove(),1700);}
const pre=+(qs.get('t')||0);for(let k=0;k<Math.round(pre*60);k++)step(1/60);
window.__step=(dt)=>{const n=Math.max(1,Math.round(dt*120));for(let i=0;i<n;i++)step(dt/n);render();};window.__T=()=>T;window.__eye=()=>CHEFS.map(c=>{const h=c.hdP.children[0].getWorldPosition(new THREE.Vector3()),e=c.hdP.children[1].getWorldPosition(new THREE.Vector3());return [c.st,e.sub(h).normalize().toArray().map(v=>+v.toFixed(2)),c.hdP.children.length]});window.__dbg=()=>CHEFS.map(c=>[c.st,c.g.rotation.y,c.body.rotation.toArray().slice(0,3),c.hdP.rotation.toArray().slice(0,3),c.g.position.y]);window.__srv=()=>[doneAt,serve&&serve.ph];window.__ch=()=>CHEFS.map(c=>[c.st,+c.g.position.x.toFixed(2),+c.g.position.z.toFixed(2),+c.g.rotation.y.toFixed(2)]);window.__sp=id=>{const s=ST[stOf.get(id)];return [s.ry,s.fwd.toArray(),s.side.toArray(),workSpot(s).p.toArray()]};window.__st=()=>ST.map(s=>[s.n.id,s.run,+s.p.x.toFixed(1),+s.p.z.toFixed(1)]);window.__jobs=()=>job.list.map(J=>[J.s.n.id,J.chef?.i,J.chef?+J.chef.len.toFixed(1):0,J.chef?.st,J.landed]);window.__info=()=>({calls:R.info.render.calls,tris:R.info.render.triangles,T,done:doneAt});
function markReady(){if(window.__ready)return;window.__ready=true;document.getElementById('boot')?.remove();}
if(qs.get('rec')){render();window.__settled=true;markReady();}else{
 let t0=performance.now(),n=0,raf=0;
 const fr=t=>{if(document.hidden){raf=0;return;}const dt=Math.min(.05,(t-t0)/1000);t0=t;if(!qs.get('freeze'))step(dt);render();if(++n>20)window.__settled=true;markReady();if(!document.hidden)raf=requestAnimationFrame(fr);else raf=0;};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else if(!raf){t0=performance.now();raf=requestAnimationFrame(fr);}});
 if(!document.hidden)raf=requestAnimationFrame(fr);}
