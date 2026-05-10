

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { fetchPlanets, fetchPlanet, fmt } from './api.js';

const PLANET_VIDEOS = {
  'Sun':     '6tmbeLTHC_0',  
  'Mercury': 'o8CgLFBLRY8',  
  'Venus':   '4hH8P_-LiLs',  
  'Earth':   'EWrXBhPCqTk',  
  'Mars':    'PKRtcvogqDE',  
  'Jupiter': 'WvfS72GJ6Uc',  
  'Saturn':  'xrGAQCq9BMU',  
  'Uranus':  'E8VLQW3C8YQ',  
  'Neptune': 'JfNcuAkBCgs'   
};

const PLANET_SEARCH_TERMS = {
  'Sun':     'NASA Solar Dynamics Observatory sun highlights 4K',
  'Mercury': 'NASA MESSENGER mission Mercury planet flyover',
  'Venus':   'NASA Venus atmosphere DAVINCI mission exploration',
  'Earth':   'NASA ISS Earth time-lapse from orbit HD',
  'Mars':    'NASA Perseverance rover Mars landing descent',
  'Jupiter': 'NASA Juno mission Jupiter flyover animation',
  'Saturn':  'NASA Cassini Grand Finale Saturn rings',
  'Uranus':  'NASA Voyager 2 Uranus encounter planet',
  'Neptune': 'NASA Voyager 2 Neptune encounter flyby'
};

async function validateYouTubeId(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D${videoId}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.title || null;
  } catch {
    return null;
  }
}

const NEBULA_VERT = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_FRAG = `
  varying vec2 vUv;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
  float fbm(vec2 p){float v=0.,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.2;a*=0.5;}return v;}
  void main(){
    vec2 uv=vUv*2.5;
    float n1=fbm(uv+vec2(0.3,1.7)),n2=fbm(uv*1.6+vec2(4.2,0.8)),n3=fbm(uv*0.5+vec2(2.1,3.4));
    vec3 c1=vec3(0.05,0.01,0.16),c2=vec3(0.01,0.05,0.22),c3=vec3(0.15,0.02,0.08),c4=vec3(0.00,0.08,0.14);
    vec3 col=mix(c1,c2,n1); col=mix(col,c3,n2*0.6); col=mix(col,c4,n3*0.35);
    col+=vec3(0.08,0.02,0.16)*smoothstep(0.62,0.88,n1*n2*3.8);
    col+=vec3(0.02,0.05,0.14)*smoothstep(0.55,0.80,n2*n3*3.2);
    col=clamp(col*0.22,0.0,0.08);
    gl_FragColor=vec4(col,1.0);
  }
`;

const ATMO_VERT = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vec4 wPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = wPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * wPos;
  }
`;

const ATMO_FRAG = `
  uniform vec3  glowColor;
  uniform float glowPower;
  uniform float opacity;
  varying vec3  vNormal;
  varying vec3  vWorldPos;
  void main(){
    vec3 v = normalize(cameraPosition - vWorldPos);
    float f = pow(1.0 - abs(dot(normalize(vNormal), v)), glowPower);
    gl_FragColor = vec4(glowColor, f * opacity);
  }
`;

const SUN_VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const SUN_FRAG = `
  uniform float time; varying vec2 vUv;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
  float fbm(vec2 p){float v=0.,a=0.5;for(int i=0;i<6;i++){v+=a*noise(p);p*=2.1;a*=0.5;}return v;}
  void main(){
    vec2 uv=vUv*4.0;
    float n=mix(fbm(uv+vec2(time*.12,time*.07)),fbm(uv*1.8-vec2(time*.05,time*.09)),0.45);
    vec3 dark=vec3(.72,.06,0.),mid=vec3(1.,.42,0.),bright=vec3(1.,.96,.55);
    vec3 col=mix(dark,mid,smoothstep(.22,.60,n)); col=mix(col,bright,smoothstep(.55,.88,n));
    col*=0.62+0.38*smoothstep(.64,.52,fbm(uv*2.5+vec2(time*.015,0.)));
    gl_FragColor=vec4(col,1.0);
  }
`;

const canvas = document.getElementById('explore-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.65;

const scene = new THREE.Scene();

scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(800, 32, 32),
  new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG,
    side: THREE.BackSide, depthWrite: false,
  })
));

const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 22);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 2.5;
controls.maxDistance = 180;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.9, 0.4, 0.88
);
composer.addPass(bloomPass);

const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.8);
sunLight.position.set(6, 3, 5);
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x334466, 0.35);
fillLight.position.set(-5, -2, -4);
scene.add(fillLight);

const ambientLight = new THREE.AmbientLight(0x111122, 0.8);
scene.add(ambientLight);

const rimLight = new THREE.DirectionalLight(0x2244aa, 0.45);
rimLight.position.set(-22, -12, -22);
scene.add(rimLight);

(function() {
  const spread = 1400;
  function makeLayer(count, size, opacity, palette, dimRange) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random()-.5)*spread;
      pos[i*3+1] = (Math.random()-.5)*spread;
      pos[i*3+2] = (Math.random()-.5)*spread;
      const c = palette[Math.floor(Math.random()*palette.length)];
      const d = dimRange[0] + Math.random()*(dimRange[1]-dimRange[0]);
      col[i*3]=c[0]*d; col[i*3+1]=c[1]*d; col[i*3+2]=c[2]*d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      size, sizeAttenuation:true, vertexColors:true, transparent:true, opacity,
    }));
  }
  scene.add(makeLayer(5000, 0.50, 0.78, [[1,.92,.82],[.82,.90,1],[1,.96,.62],[1,1,1],[.90,.72,.72]], [0.4, 0.9]));
  scene.add(makeLayer(280, 1.25, 0.90, [[1,.95,.85],[.80,.88,1],[1,1,.88],[1,1,1]], [0.75, 1.0]));
  scene.add(makeLayer(35, 2.8, 1.0, [[.72,.84,1],[.88,.94,1],[1,1,.90],[1,.94,.58],[1,.72,.32],[1,.42,.25]], [0.88, 1.0]));
})();

function _rng(seed) {
  let s = (seed * 1664525 + 1013904223) | 0;
  return function() {
    s = Math.imul(s, 1664525) + 1013904223 | 0;
    return (s >>> 0) / 4294967296;
  };
}
function _h(ix, iy) {
  let h = (Math.imul(ix|0, 0x27d4eb2d) ^ Math.imul(iy|0, 0x6ba0f5a7)) | 0;
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function _vn(x, y) {
  const ix=Math.floor(x),iy=Math.floor(y); let fx=x-ix,fy=y-iy;
  fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy);
  return _h(ix,iy)*(1-fx)*(1-fy)+_h(ix+1,iy)*fx*(1-fy)+_h(ix,iy+1)*(1-fx)*fy+_h(ix+1,iy+1)*fx*fy;
}
function _fbm(x,y,oct=5){let v=0,a=0.5,lx=x,ly=y; for(let i=0;i<oct;i++){v+=a*_vn(lx,ly);lx=lx*2.1+1.7;ly=ly*2.1+9.2;a*=0.5;} return v;}
function _clamp(v,lo,hi){return v<lo?lo:v>hi?hi:v;}
function _mix(a,b,t){return a+(b-a)*t;}
function _ss(lo,hi,v){const t=_clamp((v-lo)/(hi-lo),0,1);return t*t*(3-2*t);}

function _pixBase(W, H, SW, SH, fn) {
  const sc=document.createElement('canvas'); sc.width=SW; sc.height=SH;
  const sctx=sc.getContext('2d'); const id=sctx.createImageData(SW,SH); const d=id.data;
  for(let py=0;py<SH;py++) for(let px=0;px<SW;px++){
    const [r,g,b]=fn(px/SW,py/SH);
    const i=(py*SW+px)*4;
    d[i]=_clamp(r*255+.5,0,255)|0; d[i+1]=_clamp(g*255+.5,0,255)|0;
    d[i+2]=_clamp(b*255+.5,0,255)|0; d[i+3]=255;
  }
  sctx.putImageData(id,0,0);
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d');
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.drawImage(sc,0,0,W,H);
  return {c, ctx};
}

function makeMercuryTex(size) {
  const W=size*2, H=size;
  const {c,ctx}=_pixBase(W,H,768,384,(u,v)=>{
    const x=u*6.5, y=v*3.25;
    const n1=_fbm(x,        y,        6);
    const n2=_fbm(x*2.4+3.8,y*2.4+6.1,4);
    const n3=_fbm(x*5.8+9.2,y*5.8+2.4,3);
    const n1c = n1 - 0.5;
    const lum = 0.42 + n1c*0.18 + n2*0.14 + n3*0.06;
    const warmBias = _ss(0.38, 0.68, n1) * 0.032;
    let r = lum + warmBias;
    let g = lum + warmBias*0.45;
    let b = lum - 0.012 + warmBias*0.10;
    
    const cbx=(u-0.528)*3.2, cby=(v-0.330)*3.8; const cbD=Math.sqrt(cbx*cbx+cby*cby);
    const basinFloor = _ss(0.16, 0.0, cbD);
    const montesRim  = _ss(0.26,0.16,cbD) * _ss(0.16,0.26,cbD) * 4.0;
    r=_mix(r, 0.30, basinFloor*0.55); g=_mix(g, 0.26, basinFloor*0.55); b=_mix(b, 0.21, basinFloor*0.55);
    r+=montesRim*0.10; g+=montesRim*0.08; b+=montesRim*0.06;
    const poleFade = 0.90 + 0.10*Math.sin(v*Math.PI);
    r*=poleFade; g*=poleFade; b*=poleFade;
    return [_clamp(r,0,1), _clamp(g,0,1), _clamp(b,0,1)];
  });
  const rng=_rng(9421);

  const bigC=[[0.105,0.42,0.034],[0.275,0.63,0.028],[0.430,0.22,0.032],
    [0.670,0.55,0.024],[0.810,0.30,0.030],[0.360,0.75,0.020],
    [0.740,0.70,0.018],[0.555,0.47,0.022],[0.910,0.58,0.016],
    [0.180,0.80,0.012],[0.480,0.58,0.014],[0.620,0.28,0.016],
    [0.880,0.42,0.020],[0.320,0.40,0.018],[0.710,0.35,0.016]];
  bigC.forEach(([cu,cv,cr])=>{
    const cx=cu*W,cy=cv*H,r=cr*W;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle='rgba(28,18,10,.65)'; ctx.fill();
    ctx.strokeStyle='rgba(185,172,150,.40)'; ctx.lineWidth=r*0.18; ctx.stroke();
  });
  for(let i=0;i<160;i++){
    const cx=rng()*W,cy=rng()*H,r=(W*0.005+rng()*W*0.009);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle='rgba(185,172,150,.36)'; ctx.lineWidth=r*0.26; ctx.stroke();
    const fg=ctx.createRadialGradient(cx,cy,0,cx,cy,r*0.78);
    fg.addColorStop(0,'rgba(28,20,10,.55)'); fg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(cx,cy,r*0.78,0,Math.PI*2); ctx.fill();
  }
  for(let i=0;i<900;i++){
    const r=(0.8+rng()*3.2)*(W/1024);
    ctx.beginPath(); ctx.arc(rng()*W,rng()*H,r,0,Math.PI*2);
    ctx.fillStyle=`rgba(${rng()>.5?'192,180,158':'26,18,9'},.${28+Math.round(rng()*24)})`; ctx.fill();
  }

  const pv=ctx.createLinearGradient(0,0,0,H);
  pv.addColorStop(0,'rgba(0,0,0,.32)'); pv.addColorStop(.18,'rgba(0,0,0,0)');
  pv.addColorStop(.82,'rgba(0,0,0,0)'); pv.addColorStop(1,'rgba(0,0,0,.32)');
  ctx.fillStyle=pv; ctx.fillRect(0,0,W,H);
  return new THREE.CanvasTexture(c);
}

function makeVenusTex(size) {
  const W=size*2, H=size;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d');
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#c49018'); bg.addColorStop(0.25,'#ddb828');
  bg.addColorStop(0.5,'#f0d440'); bg.addColorStop(0.75,'#ddb828'); bg.addColorStop(1,'#c49018');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const bands=[
    {y:0.06,h:0.08,col:'rgba(255,238,120,.28)'},{y:0.14,h:0.06,col:'rgba(140,88,10,.22)'},
    {y:0.20,h:0.10,col:'rgba(255,235,110,.35)'},{y:0.30,h:0.05,col:'rgba(130,82,8,.25)'},
    {y:0.35,h:0.12,col:'rgba(255,240,130,.30)'},{y:0.47,h:0.06,col:'rgba(125,78,6,.28)'},
    {y:0.53,h:0.11,col:'rgba(255,238,118,.32)'},{y:0.64,h:0.06,col:'rgba(135,86,8,.22)'},
    {y:0.70,h:0.10,col:'rgba(255,235,108,.28)'},{y:0.80,h:0.07,col:'rgba(128,80,7,.24)'},
    {y:0.87,h:0.08,col:'rgba(255,236,115,.25)'},
  ];
  bands.forEach(({y,h,col})=>{
    for(let x=0;x<=W;x+=W/24){
      const wy=y*H + Math.sin(x*0.008+y*12)*H*0.018 + Math.sin(x*0.003+y*7)*H*0.012;
      const wh=h*H + Math.sin(x*0.005+y*9)*H*0.010;
      const g=ctx.createLinearGradient(0,wy,0,wy+wh);
      g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.4,col); g.addColorStop(0.6,col); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.fillRect(x,wy,W/24+2,wh);
    }
  });
  ctx.save();
  for(let i=0;i<10;i++){
    const cy=H*(0.36+i*0.028+Math.sin(i*1.4)*0.018);
    const amp=H*0.026; const freq=W/3.8;
    for(let x=0;x<W;x+=W/80){
      const ny=cy+Math.sin(x*Math.PI*2/freq)*amp;
      const bw=H*(0.022+0.010*(i%2));
      const bright=i%2===0;
      const g=ctx.createLinearGradient(0,ny-bw,0,ny+bw);
      g.addColorStop(0,'rgba(0,0,0,0)');
      g.addColorStop(0.5,`rgba(${bright?'255,246,162':'135,90,10'},${bright?0.09:0.06})`);
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.fillRect(x,ny-bw,W/80+1,bw*2);
    }
  }
  ctx.restore();
  [[0,'rgba(100,65,5,.45)','rgba(0,0,0,0)'],[1,'rgba(100,65,5,.45)','rgba(0,0,0,0)']].forEach(([flip,c1,c2])=>{
    const g=ctx.createLinearGradient(0,flip?H:0,0,flip?H*0.72:H*0.28);
    g.addColorStop(0,c1); g.addColorStop(1,c2);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  });
  const sh=ctx.createRadialGradient(W*0.5,H*0.48,0,W*0.5,H*0.48,W*0.42);
  sh.addColorStop(0,'rgba(255,252,210,.38)'); sh.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=sh; ctx.fillRect(0,0,W,H);
  const rng=_rng(7777);
  for(let i=0;i<35;i++){
    const ex=rng()*W, ey=H*(0.2+rng()*0.6);
    const erx=W*(0.030+rng()*0.065), ery=H*(0.022+rng()*0.042);
    const bright=rng()>0.5; const alpha=0.07+rng()*0.10;
    const g=ctx.createRadialGradient(ex,ey,0,ex,ey,erx);
    g.addColorStop(0,`rgba(${bright?'255,246,148':'118,72,6'},${alpha})`);
    g.addColorStop(0.6,`rgba(${bright?'250,240,135':'110,68,5'},${alpha*0.4})`);
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(ex,ey); ctx.scale(1, ery/erx); ctx.translate(-ex,-ey);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(ex,ey,erx,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  return new THREE.CanvasTexture(c);
}

function makeFallbackEarth(size=512) {
  const W=size*2, H=size;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d');

  function poly(pts, fillStyle) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0]*W, pts[0][1]*H);
    for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0]*W, pts[i][1]*H);
    ctx.closePath(); ctx.fillStyle=fillStyle; ctx.fill();
  }

  const ocean=ctx.createLinearGradient(0,0,0,H);
  ocean.addColorStop(0,'#0a3060'); ocean.addColorStop(0.5,'#0e4880'); ocean.addColorStop(1,'#0a3060');
  ctx.fillStyle=ocean; ctx.fillRect(0,0,W,H);
  const shallow=ctx.createRadialGradient(W*0.5,H*0.5,H*0.1,W*0.5,H*0.5,H*0.65);
  shallow.addColorStop(0,'rgba(18,80,140,.35)'); shallow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=shallow; ctx.fillRect(0,0,W,H);

  
  
  poly([[0.060,0.180],[0.110,0.165],[0.155,0.175],[0.185,0.190],[0.210,0.210],
        [0.235,0.245],[0.245,0.285],[0.260,0.315],[0.275,0.350],[0.270,0.390],
        [0.255,0.420],[0.248,0.455],[0.238,0.490],[0.230,0.510],[0.218,0.530],
        [0.205,0.545],[0.195,0.540],[0.198,0.510],[0.210,0.490],[0.215,0.460],
        [0.218,0.430],[0.218,0.400],[0.205,0.375],[0.188,0.355],[0.170,0.345],
        [0.148,0.340],[0.125,0.330],[0.105,0.310],[0.088,0.285],[0.075,0.255],
        [0.065,0.225],[0.058,0.200]],'#2d6e3e');
  poly([[0.000,0.175],[0.040,0.165],[0.060,0.180],[0.055,0.200],[0.030,0.205],[0.000,0.200]],'#2d6e3e');
  
  poly([[0.218,0.530],[0.230,0.510],[0.242,0.525],[0.255,0.540],[0.268,0.558],
        [0.278,0.580],[0.282,0.610],[0.280,0.645],[0.275,0.680],[0.265,0.710],
        [0.250,0.738],[0.232,0.758],[0.215,0.768],[0.200,0.762],[0.188,0.748],
        [0.182,0.730],[0.180,0.705],[0.182,0.675],[0.188,0.645],[0.192,0.610],
        [0.195,0.580],[0.200,0.558],[0.205,0.545],[0.195,0.540]],'#3a7a28');
  
  poly([[0.450,0.200],[0.462,0.190],[0.478,0.185],[0.492,0.188],[0.502,0.200],
        [0.510,0.215],[0.515,0.232],[0.510,0.248],[0.498,0.260],[0.482,0.268],
        [0.468,0.270],[0.455,0.265],[0.444,0.252],[0.440,0.235],[0.445,0.218]],'#5a8838');
  poly([[0.480,0.155],[0.492,0.148],[0.505,0.152],[0.512,0.165],[0.510,0.180],
        [0.502,0.188],[0.492,0.188],[0.480,0.182],[0.475,0.168]],'#4e8030');
  
  poly([[0.448,0.278],[0.462,0.268],[0.478,0.268],[0.492,0.275],[0.505,0.288],
        [0.515,0.305],[0.522,0.330],[0.528,0.360],[0.530,0.395],[0.528,0.428],
        [0.522,0.462],[0.512,0.495],[0.500,0.528],[0.486,0.556],[0.470,0.578],
        [0.454,0.590],[0.440,0.590],[0.428,0.578],[0.420,0.558],[0.415,0.530],
        [0.412,0.498],[0.412,0.462],[0.415,0.428],[0.418,0.392],[0.420,0.355],
        [0.425,0.318],[0.432,0.292]],'#a07828');
  poly([[0.425,0.278],[0.530,0.278],[0.530,0.380],[0.415,0.380]],'rgba(185,145,55,.45)');
  ctx.save(); ctx.globalCompositeOperation='source-atop';
  poly([[0.412,0.380],[0.530,0.380],[0.530,0.530],[0.412,0.530]],'rgba(40,100,28,.30)');
  ctx.restore();
  poly([[0.518,0.270],[0.540,0.268],[0.560,0.275],[0.574,0.290],[0.578,0.315],
        [0.568,0.340],[0.550,0.352],[0.530,0.350],[0.515,0.335],[0.512,0.312],
        [0.514,0.290]],'#c8a840');
  
  poly([[0.510,0.188],[0.535,0.178],[0.562,0.172],[0.595,0.168],[0.632,0.170],
        [0.665,0.178],[0.695,0.188],[0.720,0.200],[0.742,0.215],[0.758,0.232],
        [0.768,0.250],[0.775,0.272],[0.778,0.298],[0.775,0.322],[0.765,0.342],
        [0.748,0.355],[0.728,0.362],[0.705,0.365],[0.680,0.362],[0.655,0.352],
        [0.632,0.338],[0.610,0.325],[0.588,0.318],[0.565,0.320],[0.548,0.332],
        [0.538,0.348],[0.532,0.362],[0.528,0.375],[0.520,0.385],[0.510,0.390],
        [0.498,0.388],[0.488,0.378],[0.482,0.362],[0.480,0.342],[0.482,0.318],
        [0.488,0.295],[0.495,0.272],[0.500,0.252],[0.505,0.230],[0.508,0.210]],'#4a8530');
  poly([[0.578,0.342],[0.598,0.345],[0.615,0.355],[0.622,0.375],[0.618,0.400],
        [0.608,0.422],[0.592,0.435],[0.575,0.435],[0.560,0.420],[0.555,0.398],
        [0.558,0.372],[0.568,0.355]],'#6a9838');
  poly([[0.700,0.350],[0.718,0.345],[0.738,0.348],[0.750,0.360],[0.752,0.378],
        [0.742,0.395],[0.725,0.402],[0.708,0.398],[0.698,0.382],[0.696,0.365]],'#3e8530');
  
  poly([[0.745,0.595],[0.762,0.585],[0.780,0.582],[0.800,0.585],[0.818,0.595],
        [0.830,0.610],[0.835,0.630],[0.832,0.652],[0.820,0.670],[0.802,0.680],
        [0.780,0.682],[0.760,0.675],[0.745,0.660],[0.738,0.642],[0.738,0.622],
        [0.740,0.608]],'#b89040');
  poly([[0.748,0.608],[0.822,0.608],[0.822,0.668],[0.748,0.668]],'rgba(205,155,65,.45)');
  poly([[0.290,0.145],[0.310,0.135],[0.335,0.132],[0.355,0.138],[0.365,0.155],
        [0.358,0.175],[0.338,0.188],[0.315,0.192],[0.295,0.182],[0.285,0.165]],'#ccd8e0');
  const ant=ctx.createLinearGradient(0,H*0.875,0,H);
  ant.addColorStop(0,'rgba(195,210,225,.0)'); ant.addColorStop(0.35,'#c8d8e8'); ant.addColorStop(1,'#dce8f0');
  ctx.fillStyle=ant; ctx.fillRect(0,H*0.875,W,H*0.125);
  const arc=ctx.createLinearGradient(0,0,0,H*0.115);
  arc.addColorStop(0,'#d0dce8'); arc.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=arc; ctx.fillRect(0,0,W,H*0.115);

  const rng=_rng(2345);
  ctx.save(); ctx.globalAlpha=0.06;
  for(let i=0;i<6000;i++){
    const x=rng()*W, y=rng()*H;
    ctx.fillStyle=rng()>0.5?'rgba(0,0,0,1)':'rgba(255,255,255,1)';
    ctx.fillRect(x,y,2,2);
  }
  ctx.restore();

  const mid=ctx.createRadialGradient(W*0.62,H*0.5,H*0.05,W*0.62,H*0.5,H*0.55);
  mid.addColorStop(0,'rgba(0,0,0,0)'); mid.addColorStop(1,'rgba(0,12,32,.22)');
  ctx.fillStyle=mid; ctx.fillRect(0,0,W,H);

  return new THREE.CanvasTexture(c);
}

function makeFallbackCloud(size=256) {
  const W=size*2, H=size;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d'); ctx.clearRect(0,0,W,H);
  const rng=_rng(6666);
  const belts=[
    {cy:0.50, spread:0.055, alpha:0.55},
    {cy:0.38, spread:0.045, alpha:0.38},
    {cy:0.62, spread:0.045, alpha:0.38},
    {cy:0.28, spread:0.060, alpha:0.45},
    {cy:0.72, spread:0.060, alpha:0.45},
    {cy:0.12, spread:0.055, alpha:0.40},
    {cy:0.88, spread:0.055, alpha:0.40},
  ];
  belts.forEach(({cy,spread,alpha})=>{
    for(let i=0;i<300;i++){
      const cx=rng()*W;
      const dy=(rng()-0.5)*spread*H*2;
      const ey=cy*H+dy;
      const rx=W*(0.025+rng()*0.055), ry=H*(0.012+rng()*0.022);
      const a=alpha*(0.4+rng()*0.6);
      ctx.save();
      ctx.translate(cx,ey); ctx.scale(1,ry/rx);
      const g=ctx.createRadialGradient(0,0,0,0,0,rx);
      g.addColorStop(0,`rgba(255,255,255,${a})`);
      g.addColorStop(0.55,`rgba(252,252,255,${a*0.55})`);
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,rx,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  });
  [[0.18,0.30],[0.72,0.28],[0.45,0.72],[0.85,0.68]].forEach(([cu,cv])=>{
    const cx=cu*W, cy=cv*H;
    const r=W*0.055;
    const sg=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    sg.addColorStop(0,'rgba(0,0,0,0)');
    sg.addColorStop(0.25,'rgba(255,255,255,.55)');
    sg.addColorStop(0.65,'rgba(248,248,255,.32)');
    sg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  });
  return new THREE.CanvasTexture(c);
}

function makeMarsTex(size) {
  const W=size*2, H=size;
  const {c,ctx}=_pixBase(W,H,512,256,(u,v)=>{
    const x=u*6, y=v*3;
    const n1=_fbm(x,y,6), n2=_fbm(x*2.3+4,y*2.3+8,5), n3=_fbm(x*5.5+2,y*5.5+6,3);
    let r=0.50+n1*0.36+n2*0.10, g=0.16+n1*0.12+n2*0.05, b=0.05+n1*0.04;
    const thx=(u-0.26)*2.6, thy=(v-0.38)*3.5; const thD=Math.sqrt(thx*thx+thy*thy);
    const tharsis=_ss(0.55,0.0,thD);
    r+=tharsis*0.12; g+=tharsis*0.04;
    const arx=(u-0.46)*2.5, ary=(v-0.32)*4.0; const arD=Math.sqrt(arx*arx+ary*ary);
    const arabia=_ss(0.48,0.0,arD)*_ss(0.5,0.72,n1);
    r+=arabia*0.10; g+=arabia*0.06; b+=arabia*0.03;
    const hx=(u-0.73)*3.5, hy=(v-0.67)*4.0; const hD=Math.sqrt(hx*hx+hy*hy);
    const hellas=_ss(0.22,0.0,hD);
    r=_mix(r,0.28,hellas*0.65); g=_mix(g,0.09,hellas*0.65); b=_mix(b,0.04,hellas*0.65);
    const agx=(u-0.25)*4.5, agy=(v-0.72)*5.0; const agD=Math.sqrt(agx*agx+agy*agy);
    r=_mix(r,0.32,_ss(0.18,0.0,agD)*0.55); g=_mix(g,0.10,_ss(0.18,0.0,agD)*0.55);
    const northCap=_ss(0.055,0.0,v);
    const southCap=_ss(0.945,1.0,v);
    const iceBlend=Math.max(northCap,southCap);
    r=_mix(r,0.85,iceBlend*0.80); g=_mix(g,0.87,iceBlend*0.80); b=_mix(b,0.90,iceBlend*0.80);
    r-=n3*0.05; g-=n3*0.02;
    return [_clamp(r,0,1),_clamp(g,0,1),_clamp(b,0,1)];
  });
  
  
  {
    ctx.save();
    ctx.translate(W*0.375, H*0.465);
    ctx.scale(1, 0.24);
    const vmG = ctx.createRadialGradient(0, 0, 0, 0, 0, W*0.18);
    vmG.addColorStop(0, 'rgba(12,3,1,.62)');
    vmG.addColorStop(0.55, 'rgba(10,2,1,.28)');
    vmG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vmG;
    ctx.beginPath(); ctx.arc(0, 0, W*0.18, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  const omX=W*0.23, omY=H*0.37;
  const omOuter=ctx.createRadialGradient(omX,omY,0,omX,omY,W*0.062);
  omOuter.addColorStop(0,'rgba(205,120,65,.50)'); omOuter.addColorStop(0.5,'rgba(185,98,50,.28)'); omOuter.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=omOuter; ctx.beginPath(); ctx.arc(omX,omY,W*0.062,0,Math.PI*2); ctx.fill();
  const omCaldera=ctx.createRadialGradient(omX-W*0.005,omY-H*0.008,0,omX,omY,W*0.014);
  omCaldera.addColorStop(0,'rgba(22,6,3,.65)'); omCaldera.addColorStop(0.6,'rgba(35,12,5,.40)'); omCaldera.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=omCaldera; ctx.beginPath(); ctx.arc(omX,omY,W*0.018,0,Math.PI*2); ctx.fill();
  const omEsc=ctx.createRadialGradient(omX,omY,W*0.042,omX,omY,W*0.068);
  omEsc.addColorStop(0,'rgba(0,0,0,0)'); omEsc.addColorStop(0.5,'rgba(148,75,30,.22)'); omEsc.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=omEsc; ctx.beginPath(); ctx.arc(omX,omY,W*0.068,0,Math.PI*2); ctx.fill();
  [[W*0.252,H*0.41,W*0.022],[W*0.270,H*0.35,W*0.018],[W*0.235,H*0.32,W*0.016]].forEach(([vx,vy,vr])=>{
    const vg=ctx.createRadialGradient(vx,vy,0,vx,vy,vr);
    vg.addColorStop(0,'rgba(210,125,68,.45)'); vg.addColorStop(0.55,'rgba(188,105,52,.25)'); vg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=vg; ctx.beginPath(); ctx.arc(vx,vy,vr,0,Math.PI*2); ctx.fill();
    const cg=ctx.createRadialGradient(vx,vy,0,vx,vy,vr*0.28);
    cg.addColorStop(0,'rgba(20,5,2,.60)'); cg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(vx,vy,vr*0.28,0,Math.PI*2); ctx.fill();
  });
  const rng=_rng(3141);
  for(let i=0;i<280;i++){
    const r=(1.5+rng()*W*0.012); const cx=rng()*W, cy=rng()*H;
    if(cy<H*0.07||cy>H*0.93) continue;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle=`rgba(${rng()>.6?'195,105,55':'22,6,2'},.${28+Math.round(rng()*28)})`; ctx.fill();
    if(r>W*0.006){ ctx.strokeStyle='rgba(185,100,48,.35)'; ctx.lineWidth=r*0.22; ctx.stroke(); }
  }
  const npEdge=ctx.createLinearGradient(0,0,0,H*0.07);
  npEdge.addColorStop(0,'rgba(210,218,228,.25)'); npEdge.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=npEdge; ctx.fillRect(0,0,W,H*0.07);
  const spEdge=ctx.createLinearGradient(0,H,0,H*0.93);
  spEdge.addColorStop(0,'rgba(205,215,225,.22)'); spEdge.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=spEdge; ctx.fillRect(0,H*0.93,W,H*0.07);
  return new THREE.CanvasTexture(c);
}

function makeJupiterTex(size) {
  const W=size*2, H=size;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d');
  const bands=[
    [0.000,0.050, 195,165,110],
    [0.050,0.038, 235,205,158],
    [0.088,0.032, 148,92,50],
    [0.120,0.045, 225,195,142],
    [0.165,0.040, 130,75,32],
    [0.205,0.068, 238,210,155],
    [0.273,0.055, 118,62,22],
    [0.328,0.075, 215,175,108],
    [0.403,0.048, 108,55,18],
    [0.451,0.060, 228,198,148],
    [0.511,0.042, 125,72,28],
    [0.553,0.055, 220,188,135],
    [0.608,0.038, 132,80,35],
    [0.646,0.042, 212,182,128],
    [0.688,0.040, 145,92,42],
    [0.728,0.038, 200,170,118],
    [0.766,0.234, 165,120,70],
  ];
  bands.forEach(([y,h,r,g,b])=>{
    const py=y*H, ph=h*H;
    const grad=ctx.createLinearGradient(0,py,0,py+ph);
    const rh=r*.90|0, gh=g*.90|0, bh=b*.90|0;
    grad.addColorStop(0,`rgb(${rh},${gh},${bh})`);
    grad.addColorStop(0.15,`rgb(${r},${g},${b})`);
    grad.addColorStop(0.85,`rgb(${r},${g},${b})`);
    grad.addColorStop(1,`rgb(${rh},${gh},${bh})`);
    ctx.fillStyle=grad; ctx.fillRect(0,py,W,ph);
  });
  const rng=_rng(2718);
  bands.forEach(([y,,r,g,b])=>{
    const py=y*H;
    for(let xi=0;xi<W;xi+=W/60){
      const ny=py+Math.sin(xi*0.006+rng()*Math.PI*2)*H*0.009+Math.sin(xi*0.002+rng()*2)*H*0.005;
      const bh=H*0.018;
      const eg=ctx.createLinearGradient(0,ny-bh,0,ny+bh);
      eg.addColorStop(0,'rgba(0,0,0,0)');
      eg.addColorStop(0.5,`rgba(${r*.55|0},${g*.55|0},${b*.55|0},.12)`);
      eg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=eg; ctx.fillRect(xi,ny-bh,W/60+1,bh*2);
    }
  });
  for(let i=0;i<8;i++){
    const fx=W*(i/7.0+rng()*0.04), fy=H*0.336;
    const fg=ctx.createRadialGradient(fx,fy+H*0.038,0,fx,fy+H*0.038,W*0.032);
    fg.addColorStop(0,'rgba(72,40,14,.38)'); fg.addColorStop(0.5,'rgba(68,38,12,.18)'); fg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(fx,fy+H*0.038,W*0.032,0,Math.PI*2); ctx.fill();
  }
  [[0.62,0.555],[0.32,0.565],[0.80,0.558],[0.12,0.561],[0.50,0.572]].forEach(([ou,ov])=>{
    const ox=ou*W,oy=ov*H;
    const wg=ctx.createRadialGradient(ox,oy,0,ox,oy,W*0.028);
    wg.addColorStop(0,'rgba(248,242,228,.88)'); wg.addColorStop(0.45,'rgba(240,232,210,.60)');
    wg.addColorStop(0.75,'rgba(220,210,185,.28)'); wg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(ox,oy); ctx.scale(1, H*0.022/(W*0.028)); ctx.translate(-ox,-oy);
    ctx.fillStyle=wg; ctx.beginPath(); ctx.arc(ox,oy,W*0.028,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
  
  const gx=W*0.32, gy=H*0.428;
  const grsOuter=ctx.createRadialGradient(gx,gy,0,gx,gy,W*0.068);
  grsOuter.addColorStop(0,'rgba(175,48,12,.88)'); grsOuter.addColorStop(0.38,'rgba(192,65,18,.70)');
  grsOuter.addColorStop(0.68,'rgba(168,52,14,.48)'); grsOuter.addColorStop(1,'rgba(0,0,0,0)');
  ctx.save(); ctx.translate(gx,gy); ctx.scale(1,H*0.052/(W*0.068)); ctx.translate(-gx,-gy);
  ctx.fillStyle=grsOuter; ctx.beginPath(); ctx.arc(gx,gy,W*0.068,0,Math.PI*2); ctx.fill();
  ctx.restore();
  
  for(let y=0;y<H;y+=2){
    const n=_vn(y*0.5,0)*0.5+_vn(y*1.2,5)*0.3;
    ctx.fillStyle=`rgba(0,0,0,${n*0.08})`;
    ctx.fillRect(0,y,W,1);
  }
  const pgN=ctx.createLinearGradient(0,0,0,H*0.12);
  pgN.addColorStop(0,'rgba(20,10,4,.48)'); pgN.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=pgN; ctx.fillRect(0,0,W,H*0.12);
  const pgS=ctx.createLinearGradient(0,H,0,H*0.82);
  pgS.addColorStop(0,'rgba(12,6,2,.42)'); pgS.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=pgS; ctx.fillRect(0,H*0.82,W,H*0.18);
  return new THREE.CanvasTexture(c);
}

function makeSaturnBodyTex(size) {
  const W=size*2, H=size;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d');
  const bands=[
    [0.00,0.06,168,142,72],[0.06,0.05,195,168,98],[0.11,0.07,215,188,115],
    [0.18,0.08,228,200,128],[0.26,0.05,198,172,100],[0.31,0.09,232,205,132],
    [0.40,0.06,210,182,108],[0.46,0.08,238,212,138],[0.54,0.05,205,178,105],
    [0.59,0.09,234,210,135],[0.68,0.07,215,188,112],[0.75,0.08,232,208,130],
    [0.83,0.05,202,175,100],[0.88,0.06,218,192,118],[0.94,0.06,160,135,65],
  ];
  bands.forEach(([y,h,r,g,b])=>{
    const py=y*H, ph=h*H;
    const gr=ctx.createLinearGradient(0,py,0,py+ph);
    gr.addColorStop(0,`rgba(${r*.88|0},${g*.88|0},${b*.88|0},1)`);
    gr.addColorStop(0.5,`rgb(${r},${g},${b})`);
    gr.addColorStop(1,`rgba(${r*.88|0},${g*.88|0},${b*.88|0},1)`);
    ctx.fillStyle=gr; ctx.fillRect(0,py,W,ph);
  });
  const rng=_rng(1618);
  for(let yi=0;yi<bands.length;yi++){
    const [by,,br,bg,bb]=bands[yi]; const py=by*H;
    for(let xi=0;xi<W;xi+=W/50){
      const ny=py+Math.sin(xi*0.004+rng()*Math.PI)*H*0.008+Math.sin(xi*0.0012)*H*0.004;
      const bh=H*0.014;
      const eg=ctx.createLinearGradient(0,ny-bh,0,ny+bh);
      eg.addColorStop(0,'rgba(0,0,0,0)');
      eg.addColorStop(0.5,`rgba(${br*.55|0},${bg*.55|0},${bb*.55|0},.08)`);
      eg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=eg; ctx.fillRect(xi,ny-bh,W/50+1,bh*2);
    }
  }
  const hpX=W*0.5, hpY=H*0.06;
  const hpG=ctx.createRadialGradient(hpX,hpY,0,hpX,hpY,W*0.06);
  hpG.addColorStop(0,'rgba(95,62,20,.50)'); hpG.addColorStop(0.6,'rgba(110,75,28,.28)'); hpG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=hpG; ctx.beginPath(); ctx.arc(hpX,hpY,W*0.06,0,Math.PI*2); ctx.fill();
  ctx.save(); ctx.translate(hpX,hpY);
  const hexR=W*0.045;
  for(let i=0;i<6;i++){
    const a0=i*Math.PI/3, a1=(i+1)*Math.PI/3;
    const x0=Math.cos(a0)*hexR, y0=Math.sin(a0)*hexR;
    const x1=Math.cos(a1)*hexR, y1=Math.sin(a1)*hexR;
    const hg=ctx.createLinearGradient(x0,y0,0,0);
    hg.addColorStop(0,'rgba(148,108,42,.0)'); hg.addColorStop(0.7,'rgba(148,108,42,.22)'); hg.addColorStop(1,'rgba(148,108,42,.0)');
    ctx.fillStyle=hg;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(x0,y0); ctx.lineTo(x1,y1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const npvG=ctx.createRadialGradient(hpX,hpY,0,hpX,hpY,W*0.018);
  npvG.addColorStop(0,'rgba(42,28,8,.60)'); npvG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=npvG; ctx.beginPath(); ctx.arc(hpX,hpY,W*0.018,0,Math.PI*2); ctx.fill();
  for(let y=0;y<H;y+=2){
    const n=_vn(y*0.4,0)*0.5+_vn(y*1.1,8)*0.35;
    ctx.fillStyle=`rgba(0,0,0,${n*0.05})`; ctx.fillRect(0,y,W,1);
  }
  const pN=ctx.createLinearGradient(0,0,0,H*0.15);
  pN.addColorStop(0,'rgba(15,8,2,.45)'); pN.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=pN; ctx.fillRect(0,0,W,H*0.15);
  const pS=ctx.createLinearGradient(0,H,0,H*0.85);
  pS.addColorStop(0,'rgba(12,6,2,.40)'); pS.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=pS; ctx.fillRect(0,H*0.85,W,H*0.15);
  return new THREE.CanvasTexture(c);
}

function makeUranusTex(size) {
  const W=size*2, H=size;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d');
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#2ab0b8');
  bg.addColorStop(0.28,'#4ecece');
  bg.addColorStop(0.50,'#62dede');
  bg.addColorStop(0.72,'#4ecece');
  bg.addColorStop(1,'#2ab0b8');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  for(let i=0;i<20;i++){
    const y=(i/20)*H, h=H/20;
    const alpha=(i%2===0)?0.028:0.014;
    ctx.fillStyle=`rgba(0,${i%2?30:0},${i%2?0:25},${alpha})`;
    ctx.fillRect(0,y,W,h);
  }
  const pN=ctx.createLinearGradient(0,0,0,H*0.22);
  pN.addColorStop(0,'rgba(0,60,80,.38)'); pN.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=pN; ctx.fillRect(0,0,W,H*0.22);
  const pS=ctx.createLinearGradient(0,H,0,H*0.78);
  pS.addColorStop(0,'rgba(0,55,75,.35)'); pS.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=pS; ctx.fillRect(0,H*0.78,W,H*0.22);
  const rng=_rng(5555);
  for(let i=0;i<6;i++){
    const sy=H*(0.35+i*0.05+rng()*0.03);
    const amp=H*0.007, freq=W/(2+rng()*2), bh=H*0.010, alpha=0.05+rng()*0.04;
    for(let xi=0; xi<W; xi+=W/80){
      const ny=sy+Math.sin(xi*Math.PI*2/freq+rng()*1.5)*amp;
      const g=ctx.createLinearGradient(0,ny-bh,0,ny+bh);
      g.addColorStop(0,'rgba(0,0,0,0)');
      g.addColorStop(0.5,`rgba(175,248,255,${alpha})`);
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.fillRect(xi,ny-bh,W/80+1,bh*2);
    }
  }
  return new THREE.CanvasTexture(c);
}

function makeNeptuneTex(size) {
  const W=size*2, H=size;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d');
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#0818a8');
  bg.addColorStop(0.3,'#1428cc');
  bg.addColorStop(0.5,'#1830d8');
  bg.addColorStop(0.7,'#1428cc');
  bg.addColorStop(1,'#0818a8');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  for(let i=0;i<14;i++){
    const y=(i/14)*H;
    ctx.fillStyle=`rgba(${i%2?12:0},${i%2?18:10},${i%2?50:24},.22)`;
    ctx.fillRect(0,y,W,H/14);
  }
  
  const gdX=W*0.36, gdY=H*0.40;
  const gdsG=ctx.createRadialGradient(gdX,gdY,0,gdX,gdY,W*0.062);
  gdsG.addColorStop(0,'rgba(4,8,55,.78)'); gdsG.addColorStop(0.5,'rgba(6,12,68,.55)'); gdsG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gdsG; ctx.beginPath(); ctx.ellipse(gdX,gdY,W*0.062,H*0.042,-0.2,0,Math.PI*2); ctx.fill();
  const gdsRing=ctx.createRadialGradient(gdX,gdY,W*0.030,gdX,gdY,W*0.058);
  gdsRing.addColorStop(0,'rgba(0,0,0,0)'); gdsRing.addColorStop(0.45,'rgba(130,162,248,.22)');
  gdsRing.addColorStop(0.75,'rgba(122,152,240,.10)'); gdsRing.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gdsRing; ctx.beginPath(); ctx.arc(gdX,gdY,W*0.058,0,Math.PI*2); ctx.fill();
  const scX=W*0.55, scY=H*0.52;
  const scG=ctx.createRadialGradient(scX,scY,0,scX,scY,W*0.025);
  scG.addColorStop(0,'rgba(200,218,255,.82)'); scG.addColorStop(0.55,'rgba(175,198,255,.52)'); scG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=scG; ctx.beginPath(); ctx.ellipse(scX,scY,W*0.025,H*0.018,0.15,0,Math.PI*2); ctx.fill();
  const ds2X=W*0.68, ds2Y=H*0.52;
  const ds2G=ctx.createRadialGradient(ds2X,ds2Y,0,ds2X,ds2Y,W*0.032);
  ds2G.addColorStop(0,'rgba(5,10,60,.65)'); ds2G.addColorStop(0.55,'rgba(8,14,72,.38)'); ds2G.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=ds2G; ctx.beginPath(); ctx.ellipse(ds2X,ds2Y,W*0.032,H*0.022,-0.12,0,Math.PI*2); ctx.fill();
  const rng=_rng(3333);
  for(let i=0;i<14;i++){
    const sy    = H*(0.25+rng()*0.50);
    const startU= rng()*0.5, spanU=0.12+rng()*0.30;
    const amp   = H*(0.006+rng()*0.008);
    const freq  = W/(2.5+rng()*3);
    const alpha = 0.18+rng()*0.20;
    const phaseOff = rng()*Math.PI*2;
    const hScale   = H*(0.005+rng()*0.005);
    const wScale   = W*0.020;
    const nPts  = Math.max(6, Math.ceil(spanU*W/6));
    for(let k=0; k<=nPts; k++){
      const xi = (startU + k/nPts*spanU)*W;
      const ny = sy + Math.sin(xi*Math.PI*2/freq + phaseOff)*amp;
      ctx.save(); ctx.translate(xi, ny); ctx.scale(wScale, hScale);
      const g = ctx.createRadialGradient(0,0,0,0,0,1);
      g.addColorStop(0,  `rgba(215,228,255,${alpha})`);
      g.addColorStop(0.5,`rgba(200,218,255,${(alpha*0.5).toFixed(3)})`);
      g.addColorStop(1,  'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,1,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
  const npG=ctx.createLinearGradient(0,0,0,H*0.18);
  npG.addColorStop(0,'rgba(2,4,35,.55)'); npG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=npG; ctx.fillRect(0,0,W,H*0.18);
  const spG=ctx.createLinearGradient(0,H,0,H*0.82);
  spG.addColorStop(0,'rgba(2,4,35,.52)'); spG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=spG; ctx.fillRect(0,H*0.82,W,H*0.18);
  return new THREE.CanvasTexture(c);
}

function makeFallbackMoon(size=256) {
  const c=document.createElement('canvas'); c.width=c.height=size;
  const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(size*.38,size*.38,size*.03,size*.5,size*.5,size*.6);
  g.addColorStop(0,'#d0ccc4'); g.addColorStop(.5,'#8e8880'); g.addColorStop(1,'#5c5850');
  ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
  const rng=_rng(4242);
  for(let i=0;i<80;i++){
    const x=rng()*size, y=rng()*size, r=rng()*9+1.5;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,.38)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x-r*.3,y-r*.3,r*.6,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

function makePlanetTex(colorA, colorB, banded = false, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  if (banded) {
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
      ctx.fillRect(0, (i/18)*size, size, size/18);
    }
    const g = ctx.createLinearGradient(0,0,size,0);
    g.addColorStop(0,'rgba(0,0,0,.3)'); g.addColorStop(.5,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.3)');
    ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
  } else {
    const g = ctx.createRadialGradient(size*.38,size*.38,size*.03,size*.5,size*.5,size*.62);
    g.addColorStop(0, colorB); g.addColorStop(.65, colorA); g.addColorStop(1, colorA);
    ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
    for (let i = 0; i < 3200; i++) {
      ctx.beginPath();
      ctx.arc(Math.random()*size, Math.random()*size, Math.random()*3+.4, 0, Math.PI*2);
      ctx.fillStyle=`rgba(0,0,0,${Math.random()*.2})`; ctx.fill();
    }
  }
  return new THREE.CanvasTexture(c);
}

function getPlanetTexFor(name, colorA, colorB, size) {
  switch (name) {
    case 'Jupiter': return makeJupiterTex(size);
    case 'Saturn':  return makeSaturnBodyTex(size);
    case 'Mercury': return makeMercuryTex(size);
    case 'Mars':    return makeMarsTex(size);
    case 'Venus':   return makeVenusTex(size);
    case 'Uranus':  return makeUranusTex(size);
    case 'Neptune': return makeNeptuneTex(size);
    default:        return makePlanetTex(colorA, colorB, false, size);
  }
}

const VISUALS = {
  Sun:     {colorA:'#aa3300',colorB:'#ffbb00',emissive:'#ff6600', shininess:0  },
  Mercury: {colorA:'#6a6455',colorB:'#a09880',emissive:'#0e0b08', shininess:6  },
  Venus:   {colorA:'#c8a020',colorB:'#f0e060',emissive:'#221500', shininess:28 },
  Earth:   {colorA:'#1a5276',colorB:'#27ae60',emissive:'#001018', shininess:60 },
  Mars:    {colorA:'#7a1c00',colorB:'#c1440e',emissive:'#1a0600', shininess:5  },
  Jupiter: {colorA:'#a06030',colorB:'#e8c878',emissive:'#1a0e04', shininess:18 },
  Saturn:  {colorA:'#a89028',colorB:'#e8d880',emissive:'#1a1204', shininess:14 },
  Uranus:  {colorA:'#40b8c0',colorB:'#78e8e8',emissive:'#001818', shininess:32 },
  Neptune: {colorA:'#1020b8',colorB:'#3050d8',emissive:'#000010', shininess:28 },
};

let currentData = null;
let planetMesh = null;
let atmMesh = null;
let ringMesh = null;
let moonPivot = null;
let cloudMesh = null;
let sunUniforms = null;

let autoRotate = true;
let rotSpeed = 1.0;
let atmVisible = true;
let ringsVisible = true;

const reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
if (reducedMotionMQ.matches) {
  autoRotate = false;
  const btn = document.getElementById('btn-rotate');
  if (btn) {
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
  }
}
reducedMotionMQ.addEventListener('change', e => {
  if (e.matches && autoRotate) {
    document.getElementById('btn-rotate')?.dispatchEvent(new Event('click'));
  }
});
let surfaceMode = 'textured'; 

let earthTexCache = null;
let cloudTexCache = null;
let moonTexCache  = null;

function buildSaturnRings(r) {
  const inner = r * 1.28, outer = r * 2.5;
  const geo = new THREE.RingGeometry(inner, outer, 96, 8);
  const pa = geo.attributes.position.array;
  const col = new Float32Array(pa.length);

  for (let i = 0; i < pa.length/3; i++) {
    const x = pa[i*3], y = pa[i*3+1];
    const t = (Math.sqrt(x*x+y*y) - inner) / (outer - inner);
    let d;
    if      (t < 0.45) d = 0.9 - t*0.3;
    else if (t < 0.52) d = 0.05;            
    else if (t < 0.75) d = 0.75-(t-0.52)*0.5;
    else               d = 0.12-(t-0.75)*0.4;
    d = Math.max(0, d);
    col[i*3]  = (0.92+t*.06)*d;
    col[i*3+1]= (0.83-t*.12)*d;
    col[i*3+2]= (0.52-t*.18)*d;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
  }));
  ring.rotation.x = -Math.PI / 2.25;
  return ring;
}

async function loadPlanet(name) {
  const data = await fetchPlanet(name);
  if (!data) {
    console.error('Failed to load planet data for', name);
    return;
  }
  currentData = data;
  console.log('Loading planet:', name, data);

  [planetMesh, atmMesh, ringMesh, moonPivot, cloudMesh].forEach(obj => {
    if (obj) scene.remove(obj);
  });
  planetMesh = atmMesh = ringMesh = moonPivot = cloudMesh = null;
  sunUniforms = null;

  const v = VISUALS[name] || VISUALS.Mercury;
  const R = 5;

  let tex;
  if (name === 'Earth') {
    if (!earthTexCache) earthTexCache = makeFallbackEarth();
    tex = earthTexCache;
  } else {
    tex = getPlanetTexFor(name, v.colorA, v.colorB, 1024);
  }

  let mat;
  if (name === 'Sun') {
    sunUniforms = { time: { value: 0.0 } };
    mat = new THREE.ShaderMaterial({ uniforms: sunUniforms, vertexShader: SUN_VERT, fragmentShader: SUN_FRAG });
  } else if (surfaceMode === 'clay') {
    mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(v.colorA), flatShading: true });
  } else {
    mat = new THREE.MeshPhongMaterial({
      map: tex,
      emissive: new THREE.Color(v.emissive),
      emissiveIntensity: 0.35,
      shininess: v.shininess,
      wireframe: surfaceMode === 'wireframe',
    });
  }

  planetMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), mat);

  if (data.tilt_deg) {
    const t = data.tilt_deg > 90 ? -(data.tilt_deg - 180) : data.tilt_deg;
    planetMesh.rotation.z = THREE.MathUtils.degToRad(t);
  }

  scene.add(planetMesh);

  
  if (data.atmosphere && data.atmosphere_color && name !== 'Sun') {
    atmMesh = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.16, 48, 48),
      new THREE.ShaderMaterial({
        uniforms: {
          glowColor: { value: new THREE.Color(data.atmosphere_color) },
          glowPower: { value: 3.2 },
          opacity:   { value: 0.55 },
        },
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        transparent: true, side: THREE.BackSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    atmMesh.visible = atmVisible;
    scene.add(atmMesh);
  }

  
  if (data.has_rings && name === 'Saturn') {
    ringMesh = buildSaturnRings(R);
    ringMesh.visible = ringsVisible;
    scene.add(ringMesh);
  }
  if (data.has_rings && name === 'Uranus') {
    ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(R*1.45, R*1.8, 64),
      new THREE.MeshBasicMaterial({ color:0x88bbcc, side:THREE.DoubleSide, transparent:true, opacity:.38 })
    );
    ringMesh.rotation.x = -Math.PI/2;
    ringMesh.visible = ringsVisible;
    scene.add(ringMesh);
  }

  
  if (name === 'Earth') {
    if (!cloudTexCache) cloudTexCache = makeFallbackCloud();
    cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(R*1.008, 48, 48),
      new THREE.MeshPhongMaterial({ map: cloudTexCache, transparent: true, opacity: 0.52, depthWrite: false })
    );
    scene.add(cloudMesh);
  }

  
  if (name === 'Earth') {
    if (!moonTexCache) moonTexCache = makeFallbackMoon();
    moonPivot = new THREE.Object3D();
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 32, 32),
      new THREE.MeshPhongMaterial({ map: moonTexCache, shininess: 4 })
    );
    m.position.set(9, 0, 0);
    moonPivot.add(m);
    scene.add(moonPivot);
  }

  updatePanel(data);
  

  document.querySelectorAll('.planet-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.planet === name);
  });

  flyIn();
}

function updatePanel(d) {
  document.getElementById('info-name').textContent = d.name;
  document.getElementById('info-type').textContent = d.type;
  document.getElementById('info-description').textContent = d.description;

  const v = VISUALS[d.name];
  if (v) document.getElementById('info-name').style.color = v.colorB || 'var(--gold)';

  document.getElementById('stat-radius').textContent = `${fmt(d.radius_km)} km`;
  document.getElementById('stat-distance').textContent = d.distance_au === 0 ? 'Centre of system' : `${d.distance_au} AU`;
  document.getElementById('stat-orbital').textContent = d.orbital_period === 0 ? '—' : `${fmt(Math.round(d.orbital_period))} days`;

  const rh = Math.abs(d.rotation_hours);
  const retro = d.rotation_hours < 0 ? ' (retrograde)' : '';
  document.getElementById('stat-rotation').textContent =
    rh >= 24 ? `${(rh/24).toFixed(1)} days${retro}` : `${rh.toFixed(2)} hrs${retro}`;

  document.getElementById('stat-moons').textContent = fmt(d.num_moons);
  document.getElementById('stat-rings').textContent = d.has_rings ? 'Yes' : 'No';
  document.getElementById('stat-tilt').textContent  = `${d.tilt_deg}°`;

  const tempEl = document.getElementById('stat-temp');
  if (tempEl && d.surface_temp_c !== undefined && d.surface_temp_c !== null) {
    const t = d.surface_temp_c;
    const sign = t > 0 ? '+' : '';
    tempEl.textContent = `${sign}${t} °C`;
    tempEl.style.color = t >= 200 ? '#ff8c42'
                       : t >= 0   ? 'var(--gold)'
                       : t >= -100 ? '#a0d0ff'
                       : 'var(--cyan)';
  }

  document.title = `${d.name} - Solar System Explorer`;

  const fb = document.getElementById('fun-fact-box');
  fb.style.display = 'block';
  fb.textContent = d.fun_fact;

  const vidSection = document.getElementById('planet-video-section');
  const frame      = document.getElementById('planet-video-frame');
  const searchBtn  = document.getElementById('planet-video-search');
  const vidTitle   = document.getElementById('planet-video-title');
  const vidWrapper = document.getElementById('planet-video-wrapper');

  const planetName = d.name;
  if (vidTitle) vidTitle.textContent = `NASA Footage - ${planetName}`;

  const query = encodeURIComponent(PLANET_SEARCH_TERMS[planetName] || `NASA ${planetName} space`);
  searchBtn.href = `https://www.youtube.com/results?search_query=${query}`;
  searchBtn.textContent = `Search NASA's ${planetName} footage on YouTube ↗`;

  vidSection.style.display = 'block';

  const videoId = PLANET_VIDEOS[planetName];
  if (!videoId) {
    if (vidWrapper) vidWrapper.style.display = 'none';
    return;
  }

  if (vidWrapper) vidWrapper.style.display = 'block';
  frame.src = '';

  validateYouTubeId(videoId).then(title => {
    
    if (currentData?.name !== planetName) return;
    if (title) {
      frame.src = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
      searchBtn.textContent = `More NASA ${planetName} footage on YouTube ↗`;
    } else {
      if (vidWrapper) vidWrapper.style.display = 'none';
      searchBtn.textContent = `Watch NASA's ${planetName} footage on YouTube ↗`;
    }
  });
}

let camAnim = {
  active: false, t: 0, duration: 1.2,
  from: new THREE.Vector3(),
  to:   new THREE.Vector3(),
};

function moveCamTo(pos, dur = 1.0) {
  camAnim.from.copy(camera.position);
  camAnim.to.copy(pos);
  camAnim.t = 0;
  camAnim.duration = dur;
  camAnim.active = true;
  controls.enabled = false;
}

function flyIn() {
  moveCamTo(new THREE.Vector3(
    (Math.random() - 0.5) * 8,
    (Math.random() - 0.5) * 8,
    90 + Math.random() * 20
  ), 1.5);
  setTimeout(() => moveCamTo(new THREE.Vector3(0, 0, 22), 1.0), 1500);
}

document.getElementById('cam-front').addEventListener('click', () => moveCamTo(new THREE.Vector3(0, 0, 22)));
document.getElementById('cam-top').addEventListener('click',   () => moveCamTo(new THREE.Vector3(0, 22, 0.001)));
document.getElementById('cam-side').addEventListener('click',  () => moveCamTo(new THREE.Vector3(22, 0, 0)));
document.getElementById('cam-flyIn').addEventListener('click', flyIn);

document.getElementById('btn-wireframe').addEventListener('click', () => {
  const cycle = ['textured', 'wireframe', 'clay'];
  surfaceMode = cycle[(cycle.indexOf(surfaceMode) + 1) % cycle.length];

  const labels = { textured:'🔲 Wireframe', wireframe:'🏺 Clay Mode', clay:'🌍 Textured' };
  const btn = document.getElementById('btn-wireframe');
  btn.innerHTML = `<span aria-hidden="true">${labels[surfaceMode].split(' ')[0]}</span> ${labels[surfaceMode].slice(2)}`;
  btn.classList.toggle('active', surfaceMode !== 'textured');
  btn.setAttribute('aria-pressed', String(surfaceMode !== 'textured'));

  if (currentData) loadPlanet(currentData.name);
});

document.getElementById('btn-rotate').addEventListener('click', () => {
  autoRotate = !autoRotate;
  const btn = document.getElementById('btn-rotate');
  btn.classList.toggle('active', autoRotate);
  btn.setAttribute('aria-pressed', String(autoRotate));
});

document.getElementById('btn-atmosphere').addEventListener('click', () => {
  atmVisible = !atmVisible;
  if (atmMesh) atmMesh.visible = atmVisible;
  const btn = document.getElementById('btn-atmosphere');
  btn.classList.toggle('active', atmVisible);
  btn.setAttribute('aria-pressed', String(atmVisible));
});

document.getElementById('btn-rings').addEventListener('click', () => {
  ringsVisible = !ringsVisible;
  if (ringMesh) ringMesh.visible = ringsVisible;
  const btn = document.getElementById('btn-rings');
  btn.classList.toggle('active', ringsVisible);
  btn.setAttribute('aria-pressed', String(ringsVisible));
});

document.getElementById('btn-light-on').addEventListener('click', () => {
  sunLight.visible = true;
  document.getElementById('btn-light-on').classList.add('active');
  document.getElementById('btn-light-off').classList.remove('active');
});
document.getElementById('btn-light-off').addEventListener('click', () => {
  sunLight.visible = false;
  document.getElementById('btn-light-on').classList.remove('active');
  document.getElementById('btn-light-off').classList.add('active');
});

document.getElementById('rot-speed-slider').addEventListener('input', e => {
  rotSpeed = parseFloat(e.target.value);
  document.getElementById('rot-speed-display').textContent = rotSpeed.toFixed(1) + '×';
});

document.getElementById('panel-toggle-btn').addEventListener('click', () =>
  document.getElementById('planet-selector').classList.toggle('open'));
document.getElementById('info-toggle-btn').addEventListener('click', () =>
  document.getElementById('info-panel').classList.toggle('open'));

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

let planetNames = [];

async function buildPlanetList() {
  const planets = await fetchPlanets();
  planetNames = planets.map(p => p.name);

  const list = document.getElementById('planet-list');
  planets.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'planet-nav-btn';
    btn.dataset.planet = p.name;
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-label', `Load ${p.name}`);

    const dot = document.createElement('span');
    dot.className = 'planet-dot';
    dot.style.background = p.color_hex || '#888';
    dot.setAttribute('aria-hidden', 'true');

    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(p.name));
    btn.addEventListener('click', () => loadPlanet(p.name));
    list.appendChild(btn);
  });
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (planetNames.length === 0 || !currentData) return;

  const idx = planetNames.indexOf(currentData.name);
  if (idx === -1) return;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    loadPlanet(planetNames[(idx + 1) % planetNames.length]);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    loadPlanet(planetNames[(idx - 1 + planetNames.length) % planetNames.length]);
  }
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const time = clock.elapsedTime;

  if (autoRotate && planetMesh) {
    planetMesh.rotation.y += delta * rotSpeed * 0.35;
  }

  if (cloudMesh && autoRotate) cloudMesh.rotation.y += delta * rotSpeed * 0.12;
  if (sunUniforms) sunUniforms.time.value = time;
  if (moonPivot && autoRotate) moonPivot.rotation.y += delta * 0.5;

  
  if (atmMesh && atmVisible) {
    const isGasGiant = currentData && (currentData.type === 'Gas Giant' || currentData.type === 'Ice Giant');
    const amp = isGasGiant ? 0.006 : 0.004;
    const s = 1.0 + Math.sin(time * 0.3) * amp;
    atmMesh.scale.setScalar(s);
  }

  if (camAnim.active) {
    camAnim.t += delta / camAnim.duration;
    const t = Math.min(camAnim.t, 1.0);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(camAnim.from, camAnim.to, ease);
    controls.target.set(0, 0, 0);
    if (t >= 1.0) {
      camAnim.active = false;
      controls.enabled = true;
    }
  }

  controls.update();
  composer.render();
}

function _dismissLoadingScreen() {
  const ls = document.getElementById('loading-screen');
  if (!ls) return;
  setTimeout(() => { ls.classList.add('fade-out'); setTimeout(() => ls.style.display = 'none', 900); }, 400);
}

function _showErr(msg) {
  let d = document.getElementById('_dbg_err');
  if (!d) {
    d = document.createElement('div');
    d.id = '_dbg_err';
    d.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9999;background:#900;color:#fff;padding:12px 20px;border-radius:6px;font-size:13px;max-width:80%;word-break:break-all;';
    document.body.appendChild(d);
  }
  d.textContent = msg;
}

async function init() {
  try {
    await buildPlanetList();
  } catch(e) {
    _showErr('buildPlanetList error: ' + e.message);
    console.error('buildPlanetList failed:', e);
  }

  const params = new URLSearchParams(window.location.search);
  const target = params.get('planet') || 'Earth';
  try {
    await loadPlanet(target);
  } catch(e) {
    _showErr('loadPlanet error: ' + e.message);
    console.error('loadPlanet failed:', e);
  }

  _dismissLoadingScreen();
  animate();
}

init().catch(e => _showErr('init error: ' + e.message));
