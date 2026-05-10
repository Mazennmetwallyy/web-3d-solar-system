

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

const SUN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_FRAG = `
  uniform float time;
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }

  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
    return mix(
      mix(hash(i), hash(i+vec2(1,0)), u.x),
      mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x),
      u.y
    );
  }

  float fbm(vec2 p){
    float v=0., a=0.5;
    for(int i=0;i<8;i++){
      v += a*noise(p);
      p = p*2.1 + vec2(1.7, 9.2);
      a *= 0.52;
    }
    return v;
  }

  void main(){
    vec2 uv = vUv * 4.0;
    float n = mix(
      fbm(uv + vec2(time*0.12, time*0.07)),
      fbm(uv*1.8 - vec2(time*0.05, time*0.09)),
      0.45
    );

    float gran = noise(uv * 9.0 + vec2(time*0.28, time*0.22)) * 0.13;
    n += gran;

    vec3 dark   = vec3(0.72, 0.03, 0.0);
    vec3 mid    = vec3(1.0,  0.42, 0.0);
    vec3 bright = vec3(1.0,  0.92, 0.45);
    vec3 hot    = vec3(1.0,  1.0,  0.88);
    vec3 col    = mix(dark, mid,   smoothstep(0.14, 0.48, n));
         col    = mix(col,  bright,smoothstep(0.46, 0.76, n));
         col    = mix(col,  hot,   smoothstep(0.74, 0.95, n));

    float sp1 = fbm(uv * 2.1 + vec2(time * 0.011, 0.0));
    float sp2 = fbm(uv * 3.8 + vec2(0.0, time * 0.007));
    float spotMask = smoothstep(0.68, 0.55, sp1) + smoothstep(0.72, 0.62, sp2) * 0.45;
    col *= 1.0 - spotMask * 0.58;

    vec2 c2 = vUv * 2.0 - 1.0;
    float limb = length(c2);
    col *= 0.68 + 0.32 * (1.0 - smoothstep(0.42, 1.0, limb));

    float limbFade = smoothstep(0.65, 0.98, limb);
    col.r += limbFade * 0.18;
    col.g -= limbFade * 0.08;
    col.b -= limbFade * 0.05;

    gl_FragColor = vec4(col, 1.0);
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
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main(){
    vec3 v = normalize(cameraPosition - vWorldPos);
    float f = pow(1.0 - abs(dot(normalize(vNormal), v)), glowPower);
    gl_FragColor = vec4(glowColor, f * opacity);
  }
`;

const NEBULA_VERT = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_FRAG = `
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p){
    float v=0.,a=0.5;
    for(int i=0;i<6;i++){v+=a*noise(p);p*=2.15;a*=0.5;}
    return v;
  }

  void main(){
    vec2 uv = vUv * 2.8;
    float n1 = fbm(uv + vec2(0.3, 1.7));
    float n2 = fbm(uv*1.6 + vec2(4.2, 0.8));
    float n3 = fbm(uv*0.5 + vec2(2.1, 3.4));
    float n4 = fbm(uv*3.2 + vec2(7.5, 1.2));

    vec3 c1 = vec3(0.02, 0.01, 0.09);
    vec3 c2 = vec3(0.01, 0.02, 0.16);
    vec3 c3 = vec3(0.11, 0.01, 0.06);
    vec3 c4 = vec3(0.00, 0.05, 0.12);

    vec3 col = mix(c1, c2, n1);
         col = mix(col, c3, n2 * 0.52);
         col = mix(col, c4, n3 * 0.28);

    float wisp1 = smoothstep(0.66, 0.92, n1 * n2 * 3.6);
    col += vec3(0.09, 0.02, 0.22) * wisp1;

    float wisp2 = smoothstep(0.63, 0.89, n1 * n2 * 3.9);
    col += vec3(0.12, 0.03, 0.28) * wisp2;

    float arm = smoothstep(0.54, 0.80, n2 * n3 * 3.3);
    col += vec3(0.02, 0.07, 0.18) * arm;

    float gold = smoothstep(0.72, 0.90, n1 * n4 * 4.2);
    col += vec3(0.10, 0.05, 0.01) * gold;

    col = clamp(col * 0.28, 0.0, 0.10);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const PLANET_DATA = [
  { name:'Mercury', r:1.5,  dist:10,  speed:4.74, rotSpeed: 0.017, colorA:'#777777', colorB:'#aaaaaa', emissive:'#3a3025', atmo:false },
  { name:'Venus',   r:2.2,  dist:16,  speed:3.50, rotSpeed:-0.004, colorA:'#b8832a', colorB:'#e8c56c', emissive:'#4a2c00', atmo:true, atmoColor:'#f0d888', atmoOp:0.60 },
  { name:'Earth',   r:2.4,  dist:23,  speed:2.98, rotSpeed: 1.000, colorA:'#1a5276', colorB:'#27ae60', emissive:'#002840', atmo:true, atmoColor:'#4aacff', atmoOp:0.58, realTex:true, hasMoon:true },
  { name:'Mars',    r:1.8,  dist:32,  speed:2.41, rotSpeed: 0.974, colorA:'#7a1c00', colorB:'#c1440e', emissive:'#3a1000', atmo:true, atmoColor:'#ff7733', atmoOp:0.45 },
  { name:'Jupiter', r:5.2,  dist:48,  speed:1.31, rotSpeed: 2.440, colorA:'#7a4a20', colorB:'#e8aa55', emissive:'#302010', atmo:true, atmoColor:'#d4aa7d', atmoOp:0.40, banded:true, hasMoons:[{name:'Io',r:0.55,dist:7.8,speed:2.0,col:'#e8c840'},{name:'Europa',r:0.45,dist:10.5,speed:1.3,col:'#c8bca8'},{name:'Ganymede',r:0.68,dist:14.0,speed:0.8,col:'#a09078'}] },
  { name:'Saturn',  r:4.4,  dist:65,  speed:0.97, rotSpeed: 2.270, colorA:'#b8920e', colorB:'#e8d191', emissive:'#302818', atmo:true, atmoColor:'#e8d5a0', atmoOp:0.35, hasRings:true, hasMoons:[{name:'Titan',r:0.70,dist:10.5,speed:0.6,col:'#d4a050'}] },
  { name:'Uranus',  r:3.0,  dist:80,  speed:0.68, rotSpeed: 1.390, colorA:'#3ec4c4', colorB:'#7de8e8', emissive:'#003838', atmo:true, atmoColor:'#88eeff', atmoOp:0.50, tilt:Math.PI/2 },
  { name:'Neptune', r:2.9,  dist:95,  speed:0.54, rotSpeed: 1.490, colorA:'#1225a0', colorB:'#4b70dd', emissive:'#001040', atmo:true, atmoColor:'#5578ff', atmoOp:0.52 },
];

const TEX_BASE  = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/textures/planets/';
const LENS_BASE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/textures/lensflare/';

const canvas = document.getElementById('solar-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(0, 55, 118);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 12;
controls.maxDistance = 700;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.4, 0.50, 0.82
);
composer.addPass(bloomPass);

let bloomEnabled = true;

const sunLight = new THREE.PointLight(0xfff6e0, 5.0, 900);
scene.add(sunLight);

const fillLight = new THREE.PointLight(0x3366cc, 2.2, 900);
fillLight.position.set(-80, -30, -80);
scene.add(fillLight);

const fillLight2 = new THREE.PointLight(0x442211, 1.8, 900);
fillLight2.position.set(80, 40, 80);
scene.add(fillLight2);

const ambientLight = new THREE.AmbientLight(0x223355, 2.8);
scene.add(ambientLight);

scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(1800, 32, 32),
  new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERT,
    fragmentShader: NEBULA_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
  })
));

function makeAsteroidBelt() {
  const count = 2000;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const innerR = 33, outerR = 40;
  for (let i = 0; i < count; i++) {
    const r = innerR + Math.random() * (outerR - innerR);
    const a = Math.random() * Math.PI * 2;
    pos[i*3]   = Math.cos(a) * r;
    pos[i*3+1] = (Math.random() - 0.5) * 2.8;
    pos[i*3+2] = Math.sin(a) * r;
    const gr = 0.35 + Math.random() * 0.3;
    col[i*3]   = gr + Math.random() * 0.12;
    col[i*3+1] = gr + Math.random() * 0.08;
    col[i*3+2] = gr * 0.82;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.48, sizeAttenuation: true, vertexColors: true,
    transparent: true, opacity: 0.72,
  }));
}

function createStarfield() {
  const spread = 2800;

  function makeLayer(count, size, opacity, palette, dimRange) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * spread;
      pos[i*3+1] = (Math.random() - 0.5) * spread;
      pos[i*3+2] = (Math.random() - 0.5) * spread;
      const c   = palette[Math.floor(Math.random() * palette.length)];
      const dim = dimRange[0] + Math.random() * (dimRange[1] - dimRange[0]);
      col[i*3] = c[0]*dim; col[i*3+1] = c[1]*dim; col[i*3+2] = c[2]*dim;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      size, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity,
    }));
  }

  const bg = makeLayer(9000, 0.52, 0.80,
    [[1,0.92,0.82],[0.82,0.90,1],[1,0.96,0.62],[1,1,1],[0.90,0.72,0.72]],
    [0.4, 0.9]
  );

  const mid = makeLayer(450, 1.35, 0.92,
    [[1,0.95,0.85],[0.80,0.88,1],[1,1,0.88],[1,1,1]],
    [0.75, 1.0]
  );

  const bright = makeLayer(60, 3.0, 1.0,
    [[0.72,0.84,1],[0.88,0.94,1],[1,1,0.90],[1,0.94,0.58],[1,0.72,0.32],[1,0.42,0.25]],
    [0.88, 1.0]
  );

  return [bg, mid, bright];
}
createStarfield().forEach(layer => scene.add(layer));
scene.add(makeAsteroidBelt());

const texLoader = new THREE.TextureLoader();

function loadTexWithFallback(url, fallback) {
  return new Promise(resolve => {
    texLoader.load(url, tex => resolve(tex), undefined, () => {
      console.warn('Could not load texture from CDN, using fallback:', url);
      resolve(fallback);
    });
  });
}

function makePlanetTex(colorA, colorB, banded = false, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  if (banded) {
    
    const numBands = 16;
    for (let i = 0; i < numBands; i++) {
      ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
      ctx.fillRect(0, (i / numBands) * size, size, size / numBands);
    }
    
    const g = ctx.createLinearGradient(0, 0, size, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.3)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  } else {
    const g = ctx.createRadialGradient(size*0.38, size*0.38, size*0.03, size*0.5, size*0.5, size*0.62);
    g.addColorStop(0, colorB);
    g.addColorStop(0.65, colorA);
    g.addColorStop(1, colorA);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    
    for (let i = 0; i < 2400; i++) {
      ctx.beginPath();
      ctx.arc(Math.random()*size, Math.random()*size, Math.random()*2.5+0.3, 0, Math.PI*2);
      ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.22})`;
      ctx.fill();
    }
  }
  return new THREE.CanvasTexture(c);
}

function makeFallbackEarth(size = 256) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size / 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a5276';
  ctx.fillRect(0, 0, size, size/2);
  
  const blobs = [
    {x:.17,y:.33,rx:.10,ry:.28}, {x:.29,y:.28,rx:.07,ry:.20},
    {x:.51,y:.24,rx:.13,ry:.30}, {x:.67,y:.37,rx:.09,ry:.25},
    {x:.79,y:.55,rx:.07,ry:.13}, {x:.50,y:.68,rx:.09,ry:.10},
    {x:.22,y:.70,rx:.07,ry:.09},
  ];
  ctx.fillStyle = '#27ae60';
  blobs.forEach(b => {
    ctx.beginPath();
    ctx.ellipse(b.x*size, b.y*(size/2), b.rx*size, b.ry*(size/2), 0, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.fillStyle = '#d6eaf8';
  ctx.fillRect(0, 0, size, 10);
  ctx.fillRect(0, size/2-10, size, 10);
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

function makeJupiterTex(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c8883c';
  ctx.fillRect(0, 0, size, size);
  const bands = [
    [0.03,0.06,'#e8b860'],[0.09,0.04,'#7a3210'],[0.13,0.09,'#d4906a'],
    [0.22,0.04,'#6b2a05'],[0.26,0.11,'#e8c080'],[0.37,0.05,'#5a2000'],
    [0.42,0.09,'#c8743c'],[0.51,0.06,'#6a2808'],[0.57,0.09,'#e8a868'],
    [0.66,0.05,'#7a3010'],[0.71,0.08,'#d08048'],[0.79,0.04,'#7a2c0a'],
    [0.83,0.08,'#c8703c'],[0.91,0.06,'#e0a058'],
  ];
  bands.forEach(([y,h,col]) => {
    const py=y*size, ph=h*size;
    const g=ctx.createLinearGradient(0,py-4,0,py+ph+4);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.15,col);
    g.addColorStop(0.85,col); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,py,size,ph);
    for (let i=0;i<10;i++) {
      ctx.beginPath();
      ctx.ellipse(Math.random()*size,py+ph*(Math.random()*.8+.1),Math.random()*28+8,Math.random()*6+2,0,0,Math.PI*2);
      ctx.fillStyle=parseInt(col.slice(1),16)>0x888888?'rgba(60,20,5,.18)':'rgba(200,130,60,.18)';
      ctx.fill();
    }
  });
  const gx=size*.62,gy=size*.46;
  ctx.beginPath(); ctx.ellipse(gx,gy,size*.12,size*.065,0,0,Math.PI*2);
  ctx.fillStyle='rgba(130,30,10,.60)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(gx,gy,size*.09,size*.048,0,0,Math.PI*2);
  ctx.fillStyle='rgba(185,50,20,.75)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(gx-size*.02,gy,size*.04,size*.025,0,0,Math.PI*2);
  ctx.fillStyle='rgba(225,100,55,.50)'; ctx.fill();
  for (let i=0;i<5;i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random()*size,size*(.28+Math.random()*.44),Math.random()*12+4,Math.random()*5+2,0,0,Math.PI*2);
    ctx.fillStyle='rgba(255,248,220,.28)'; ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

function makeSaturnBodyTex(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle='#d4b06a'; ctx.fillRect(0,0,size,size);
  [[0.10,'#e8c878'],[0.22,'#b09040'],[0.35,'#d4b060'],[0.47,'#c09848'],
   [0.56,'#e0c070'],[0.66,'#b08838'],[0.76,'#d0a858'],[0.86,'#e8c070']].forEach(([y,col]) => {
    const py=y*size, h=size*0.07;
    const g=ctx.createLinearGradient(0,py-h/2,0,py+h/2);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.5,col); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,py-h/2,size,h);
  });
  const ng=ctx.createLinearGradient(0,0,0,size*.14);
  ng.addColorStop(0,'rgba(80,55,20,.35)'); ng.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=ng; ctx.fillRect(0,0,size,size*.14);
  const sg=ctx.createLinearGradient(0,size*.86,0,size);
  sg.addColorStop(0,'rgba(0,0,0,0)'); sg.addColorStop(1,'rgba(60,40,15,.35)');
  ctx.fillStyle=sg; ctx.fillRect(0,size*.86,size,size*.14);
  return new THREE.CanvasTexture(c);
}

function makeMercuryTex(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g=ctx.createRadialGradient(size*.4,size*.4,0,size*.5,size*.5,size*.6);
  g.addColorStop(0,'#c4bcb4'); g.addColorStop(.5,'#9a9490'); g.addColorStop(1,'#6a6460');
  ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
  for (let i=0;i<20;i++) {
    const bx=Math.random()*size,by=Math.random()*size,br=Math.random()*55+18;
    const bg=ctx.createRadialGradient(bx,by,0,bx,by,br);
    bg.addColorStop(0,`rgba(${Math.random()>.5?'160,150,140':'78,72,68'},.2)`);
    bg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
  }
  for (let i=0;i<175;i++) {
    const cx=Math.random()*size,cy=Math.random()*size,r=Math.random()*14+1.5;
    if (r>5) { ctx.beginPath(); ctx.arc(cx,cy,r*1.9,0,Math.PI*2); ctx.fillStyle='rgba(195,185,172,.10)'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle=`rgba(28,22,18,${Math.random()*.48+.25})`; ctx.fill();
    if (r>4) { ctx.beginPath(); ctx.arc(cx-r*.3,cy-r*.3,r*.55,0,Math.PI*2); ctx.fillStyle='rgba(205,198,188,.12)'; ctx.fill(); }
  }
  const cX=size*.22,cY=size*.42;
  ctx.beginPath(); ctx.arc(cX,cY,size*.14,0,Math.PI*2); ctx.fillStyle='rgba(42,36,30,.48)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cX,cY,size*.10,0,Math.PI*2); ctx.fillStyle='rgba(88,82,76,.35)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cX,cY,size*.14,0,Math.PI*2);
  ctx.lineWidth=size*.016; ctx.strokeStyle='rgba(182,172,160,.22)'; ctx.stroke();
  return new THREE.CanvasTexture(c);
}

function makeMarsTex(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const bg=ctx.createLinearGradient(0,0,0,size);
  bg.addColorStop(0,'#c1440e'); bg.addColorStop(.22,'#a83010');
  bg.addColorStop(.50,'#8b2000'); bg.addColorStop(.72,'#a03010'); bg.addColorStop(1,'#b83c10');
  ctx.fillStyle=bg; ctx.fillRect(0,0,size,size);
  for (let i=0;i<85;i++) {
    const bx=Math.random()*size,by=Math.random()*size,br=Math.random()*38+6;
    const bright=Math.random()>.55;
    const bgrad=ctx.createRadialGradient(bx,by,0,bx,by,br);
    bgrad.addColorStop(0,bright?'rgba(195,108,58,.18)':'rgba(48,12,4,.18)');
    bgrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=bgrad; ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
  }
  
  { const STEPS=24;
    for(let i=0;i<=STEPS;i++){
      const t=i/STEPS;
      const px=size*(0.15+t*0.58), py=size*(0.505+Math.sin(t*Math.PI)*0.010);
      ctx.save(); ctx.translate(px,py); ctx.scale(size*0.032, size*0.014);
      const gv=ctx.createRadialGradient(0,0,0,0,0,1);
      gv.addColorStop(0,'rgba(16,5,1,.38)'); gv.addColorStop(0.5,'rgba(16,5,1,.18)'); gv.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gv; ctx.beginPath(); ctx.arc(0,0,1,0,Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.translate(px,py-size*0.018); ctx.scale(size*0.028, size*0.016);
      const gh=ctx.createRadialGradient(0,0,0,0,0,1);
      gh.addColorStop(0,'rgba(200,115,55,.15)'); gh.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gh; ctx.beginPath(); ctx.arc(0,0,1,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
  
  const omX=size*.18,omY=size*.36;
  const omg=ctx.createRadialGradient(omX,omY,0,omX,omY,size*.09);
  omg.addColorStop(0,'rgba(210,128,68,.45)'); omg.addColorStop(.4,'rgba(168,78,32,.25)'); omg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=omg; ctx.beginPath(); ctx.arc(omX,omY,size*.09,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(omX,omY,size*.018,0,Math.PI*2); ctx.fillStyle='rgba(28,8,4,.62)'; ctx.fill();
  
  const ng=ctx.createRadialGradient(size*.5,-size*.04,0,size*.5,0,size*.28);
  ng.addColorStop(0,'rgba(235,245,255,.95)'); ng.addColorStop(.55,'rgba(218,232,248,.58)'); ng.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=ng; ctx.fillRect(0,0,size,size*.25);
  const sg=ctx.createRadialGradient(size*.5,size*1.04,0,size*.5,size,size*.22);
  sg.addColorStop(0,'rgba(235,245,255,.90)'); sg.addColorStop(.48,'rgba(215,230,245,.48)'); sg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=sg; ctx.fillRect(0,size*.78,size,size*.22);
  for (let i=0;i<45;i++) {
    const cx=Math.random()*size,cy=size*(.22+Math.random()*.56),r=Math.random()*8+1.5;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle=`rgba(28,8,4,${Math.random()*.32+.14})`; ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

function makeVenusTex(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g=ctx.createRadialGradient(size*.5,size*.44,0,size*.5,size*.5,size*.62);
  g.addColorStop(0,'#f0d070'); g.addColorStop(.35,'#d49418');
  g.addColorStop(.70,'#b07020'); g.addColorStop(1,'#8a4e14');
  ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
  for (let i=0;i<24;i++) {
    const y=(i/24)*size;
    ctx.beginPath(); ctx.moveTo(0,y);
    for (let x=0;x<=size;x+=6) ctx.lineTo(x,y+Math.sin(x*.018+i*.8)*18+Math.sin(x*.035+i)*8);
    ctx.lineWidth=Math.random()*10+3;
    ctx.strokeStyle=i%2===0?`rgba(192,156,50,${Math.random()*.22+.08})`:`rgba(108,65,15,${Math.random()*.18+.06})`;
    ctx.stroke();
  }
  for (let i=0;i<18;i++) {
    const bx=Math.random()*size,by=Math.random()*size,br=Math.random()*44+12;
    const bg2=ctx.createRadialGradient(bx,by,0,bx,by,br);
    bg2.addColorStop(0,`rgba(255,240,155,${Math.random()*.18+.04})`); bg2.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=bg2; ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

function makeUranusTex(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,size);
  g.addColorStop(0,'#62f0e8'); g.addColorStop(.28,'#48d8d4');
  g.addColorStop(.50,'#52e4e0'); g.addColorStop(.72,'#40c8c4'); g.addColorStop(1,'#34b4bc');
  ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
  for (let i=0;i<14;i++) {
    const h=size/14;
    const bg=ctx.createLinearGradient(0,(i/14)*size,0,(i/14)*size+h);
    const col=i%2?'60,220,215':'18,90,105';
    bg.addColorStop(0,'rgba(0,0,0,0)'); bg.addColorStop(0.5,`rgba(${col},.22)`); bg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=bg; ctx.fillRect(0,(i/14)*size,size,h);
  }
  const ph=ctx.createLinearGradient(0,0,0,size*.3);
  ph.addColorStop(0,'rgba(140,255,252,.40)'); ph.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=ph; ctx.fillRect(0,0,size,size*.3);
  return new THREE.CanvasTexture(c);
}

function makeNeptuneTex(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,size);
  g.addColorStop(0,'#3058e0'); g.addColorStop(.32,'#2040c8');
  g.addColorStop(.50,'#2850d4'); g.addColorStop(.68,'#1838b8'); g.addColorStop(1,'#2a50cc');
  ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
  for (let i=0;i<12;i++) {
    const h=size/12;
    const bg=ctx.createLinearGradient(0,(i/12)*size,0,(i/12)*size+h);
    const col=i%2?'70,120,230':'8,15,80';
    bg.addColorStop(0,'rgba(0,0,0,0)'); bg.addColorStop(0.5,`rgba(${col},.28)`); bg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=bg; ctx.fillRect(0,(i/12)*size,size,h);
  }
  for (let i=0;i<10;i++) {
    const sy=size*(.18+Math.random()*.64);
    ctx.beginPath(); ctx.moveTo(0,sy);
    for (let x=0;x<=size;x+=6) ctx.lineTo(x,sy+Math.sin(x*.04+i*1.8)*14);
    ctx.lineWidth=Math.random()*6+1.5;
    ctx.strokeStyle=`rgba(192,212,255,${Math.random()*.35+.08})`; ctx.stroke();
  }
  const dsX=size*.40,dsY=size*.40;
  ctx.beginPath(); ctx.ellipse(dsX,dsY,size*.09,size*.055,-.18,0,Math.PI*2);
  ctx.fillStyle='rgba(8,14,72,.62)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(dsX+size*.07,dsY-size*.034,size*.034,size*.013,-.18,0,Math.PI*2);
  ctx.fillStyle='rgba(200,214,255,.55)'; ctx.fill();
  ctx.fillStyle='rgba(5,10,55,.30)';
  ctx.fillRect(0,0,size,size*.12); ctx.fillRect(0,size*.88,size,size*.12);
  return new THREE.CanvasTexture(c);
}

const sunUniforms = { time: { value: 0.0 } };

const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(8, 64, 64),
  new THREE.ShaderMaterial({
    uniforms: sunUniforms,
    vertexShader: SUN_VERT,
    fragmentShader: SUN_FRAG,
  })
);
scene.add(sunMesh);

scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(11.5, 48, 48),
  new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0xffaa22) },
      glowPower: { value: 2.0 },
      opacity:   { value: 0.80 },
    },
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    transparent: true, side: THREE.BackSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  })
));

scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(16, 48, 48),
  new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0xff5500) },
      glowPower: { value: 3.5 },
      opacity:   { value: 0.45 },
    },
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    transparent: true, side: THREE.BackSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  })
));

const lensLight = new THREE.PointLight(0xffeecc, 0, 0);
scene.add(lensLight);
const lensflare = new Lensflare();

(function setupLensflare() {
  function makeHaloCanvas(size, alpha) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    g.addColorStop(0, `rgba(255,240,200,${alpha})`);
    g.addColorStop(0.3, `rgba(255,200,100,${alpha*0.6})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  const t0 = makeHaloCanvas(512, 1.0);
  const t1 = makeHaloCanvas(128, 0.7);

  lensflare.addElement(new LensflareElement(t0, 600, 0,   new THREE.Color(0xffcc44)));
  lensflare.addElement(new LensflareElement(t1, 60,  0.6, new THREE.Color(0xffffff)));
  lensflare.addElement(new LensflareElement(t1, 40,  0.75,new THREE.Color(0x8888ff)));
  lensflare.addElement(new LensflareElement(t1, 25,  0.9, new THREE.Color(0xffaa44)));

  
  texLoader.load(`${LENS_BASE}lensflare0.png`, tex => {
    lensflare.elements.length = 0;
    lensflare.addElement(new LensflareElement(tex, 700, 0,   new THREE.Color(0xffcc44)));
    lensflare.addElement(new LensflareElement(tex, 70,  0.6, new THREE.Color(0xffffff)));
    lensflare.addElement(new LensflareElement(tex, 50,  0.75,new THREE.Color(0x8888ff)));
    lensflare.addElement(new LensflareElement(tex, 30,  0.9, new THREE.Color(0xffaa44)));
  });

  lensLight.add(lensflare);
})();

const orbitLines = [];

function addOrbitRing(radius) {
  const pts = 128;
  const pos = new Float32Array(pts * 3);
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    pos[i*3]   = Math.cos(a) * radius;
    pos[i*3+1] = 0;
    pos[i*3+2] = Math.sin(a) * radius;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
    color: 0x223344,
    transparent: true,
    opacity: 0.40,
  }));
  orbitLines.push(line);
  return line;
}

function makeSaturnRings(r) {
  const inner = r * 1.22;   
  const outer = r * 2.62;   

  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = 1024; ringCanvas.height = 1;
  const rctx = ringCanvas.getContext('2d');

  function band(t0, t1, r, g, b, a) {
    const x0 = Math.round(t0 * 1023);
    const x1 = Math.round(t1 * 1023);
    rctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    rctx.fillRect(x0, 0, x1 - x0 + 1, 1);
  }

  band(0.00, 0.28,  90, 72, 45, 0.30);  
  band(0.28, 0.50, 240, 220, 175, 0.95); 
  band(0.50, 0.62, 220, 195, 145, 0.88);
  band(0.62, 0.68,  25,  18,  10, 0.05); 
  band(0.68, 0.88, 190, 165, 120, 0.72); 
  band(0.82, 0.84,  15,  10,   5, 0.06); 
  band(0.84, 0.88, 178, 155, 108, 0.65);
  band(0.88, 0.92,   0,   0,   0, 0.00);
  band(0.92, 1.00, 230, 215, 180, 0.22); 

  for (let i = 0; i < 18; i++) {
    const sx = Math.random() * 900 + 20;
    const sw = Math.random() * 18 + 4;
    rctx.fillStyle = `rgba(255,245,220,${Math.random() * 0.06 + 0.02})`;
    rctx.fillRect(sx, 0, sw, 1);
  }

  const ringTex = new THREE.CanvasTexture(ringCanvas);
  ringTex.wrapS = THREE.ClampToEdgeWrapping;
  ringTex.wrapT = THREE.ClampToEdgeWrapping;

  const geo = new THREE.RingGeometry(inner, outer, 192, 4);

  
  
  
  
  const uvs = geo.attributes.uv.array;
  const pos = geo.attributes.position.array;
  for (let i = 0; i < uvs.length / 2; i++) {
    const x = pos[i*3], y = pos[i*3+1];
    const d = Math.sqrt(x*x + y*y);
    uvs[i*2]   = (d - inner) / (outer - inner);
    uvs[i*2+1] = 0.5;
  }
  geo.attributes.uv.needsUpdate = true;

  const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: ringTex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  }));
  ring.rotation.x = -Math.PI / 2.25;
  return ring;
}

const hoverGlow = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 32),
  new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0xffffff) },
      glowPower: { value: 2.0 },
      opacity:   { value: 0.55 },
    },
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
hoverGlow.visible = false;
scene.add(hoverGlow);

const planets = [];
const allMeshes = [];
const wireToggleMeshes = [];
let earthClouds = null;

async function buildPlanets() {
  const fallbackEarth = makeFallbackEarth();

  
  const fallbackCloud = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    for (let i = 0; i < 600; i++) {
      ctx.beginPath();
      ctx.ellipse(
        Math.random()*256, Math.random()*128,
        Math.random()*18+4, Math.random()*6+2,
        Math.random()*Math.PI, 0, Math.PI*2
      );
      ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.25+0.05})`;
      ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  })();

  const [earthTex, cloudTex] = await Promise.all([
    loadTexWithFallback(`${TEX_BASE}earth_atmos_2048.jpg`, fallbackEarth),
    loadTexWithFallback(`${TEX_BASE}earth_clouds_1024.png`, fallbackCloud),
  ]);



  for (const pd of PLANET_DATA) {
    scene.add(addOrbitRing(pd.dist));

    const tex = pd.realTex ? earthTex : getPlanetTexFor(pd.name, pd.colorA, pd.colorB, 768);

    const shininessMap = {
      Earth: 60, Venus: 35, Jupiter: 22, Saturn: 18,
      Neptune: 28, Uranus: 26, Mars: 12, Mercury: 10,
    };
    const mat = new THREE.MeshPhongMaterial({
      map: tex,
      emissive: new THREE.Color(pd.emissive || '#0a0a1a'),
      emissiveIntensity: 0.55,
      shininess: shininessMap[pd.name] || 18,
      specular: new THREE.Color(pd.name === 'Earth' ? '#224466' : '#111122'),
    });

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(pd.r, 32, 32), mat);
    mesh.userData.planetName = pd.name;
    if (pd.tilt) mesh.rotation.z = pd.tilt;

    wireToggleMeshes.push(mesh);
    allMeshes.push(mesh);

    const pivot = new THREE.Object3D();
    pivot.add(mesh);
    mesh.position.set(pd.dist, 0, 0);

    if (pd.atmo) {
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(pd.r * 1.14, 32, 32),
        new THREE.ShaderMaterial({
          uniforms: {
            glowColor: { value: new THREE.Color(pd.atmoColor) },
            glowPower: { value: 3.8 },
            opacity:   { value: pd.atmoOp },
          },
          vertexShader: ATMO_VERT,
          fragmentShader: ATMO_FRAG,
          transparent: true,
          side: THREE.BackSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      atmo.position.copy(mesh.position);
      pivot.add(atmo);
    }

    if (pd.hasRings) {
      const ring = makeSaturnRings(pd.r);
      ring.position.copy(mesh.position);
      pivot.add(ring);
    }

    if (pd.name === 'Earth') {
      earthClouds = new THREE.Mesh(
        new THREE.SphereGeometry(pd.r * 1.008, 32, 32),
        new THREE.MeshPhongMaterial({
          map: cloudTex,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        })
      );
      earthClouds.position.copy(mesh.position);
      pivot.add(earthClouds);
    }

    
    const moonPivots = [];
    if (pd.hasMoon) {
      
      const moonSubPivot = new THREE.Object3D();
      moonSubPivot.position.copy(mesh.position);
      const luna = new THREE.Mesh(
        new THREE.SphereGeometry(0.60, 20, 20),
        new THREE.MeshPhongMaterial({
          color: 0x9a9488, emissive: new THREE.Color(0x1a1814),
          emissiveIntensity: 0.25, shininess: 4,
        })
      );
      luna.position.set(5.2, 0.4, 0);
      moonSubPivot.add(luna);
      
      const lunaOrbitPts = 64;
      const lOrbPos = new Float32Array(lunaOrbitPts * 3);
      for (let i = 0; i < lunaOrbitPts; i++) {
        const a = (i / lunaOrbitPts) * Math.PI * 2;
        lOrbPos[i*3] = Math.cos(a) * 5.2; lOrbPos[i*3+1] = 0.4; lOrbPos[i*3+2] = Math.sin(a) * 5.2;
      }
      const lOrbGeo = new THREE.BufferGeometry();
      lOrbGeo.setAttribute('position', new THREE.BufferAttribute(lOrbPos, 3));
      moonSubPivot.add(new THREE.LineLoop(lOrbGeo, new THREE.LineBasicMaterial({ color:0x334455, transparent:true, opacity:0.35 })));
      pivot.add(moonSubPivot);
      moonPivots.push({ subPivot: moonSubPivot, speed: 0.85 });
    }
    if (pd.hasMoons) {
      pd.hasMoons.forEach(mDef => {
        const moonSubPivot = new THREE.Object3D();
        moonSubPivot.position.copy(mesh.position);
          moonSubPivot.rotation.y = Math.random() * Math.PI * 2;
        const moonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(mDef.r, 14, 14),
          new THREE.MeshPhongMaterial({
            color: new THREE.Color(mDef.col),
            emissive: new THREE.Color(mDef.col).multiplyScalar(0.15),
            emissiveIntensity: 0.3, shininess: 6,
          })
        );
        moonMesh.position.set(mDef.dist, 0, 0);
        moonSubPivot.add(moonMesh);
        pivot.add(moonSubPivot);
        moonPivots.push({ subPivot: moonSubPivot, speed: mDef.speed });
      });
    }

    scene.add(pivot);
    planets.push({ name: pd.name, mesh, pivot, speed: pd.speed, rotSpeed: pd.rotSpeed, moonPivots });
  }
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = document.getElementById('planet-tooltip');
let hoveredMesh = null;

function getMouseNDC(e) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

canvas.addEventListener('mousemove', e => {
  getMouseNDC(e);
  if (allMeshes.length === 0) return;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(allMeshes);

  if (hits.length > 0) {
    const hit = hits[0].object;
    const pd = PLANET_DATA.find(p => p.name === hit.userData.planetName);
    const wPos = new THREE.Vector3();
    hit.getWorldPosition(wPos);

    hoveredMesh = hit;
    hoverGlow.position.copy(wPos);
    hoverGlow.scale.setScalar((pd?.r || 1) * 1.8);
    hoverGlow.visible = true;

    tooltip.textContent = hit.userData.planetName;
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX + 14) + 'px';
    tooltip.style.top  = (e.clientY - 10) + 'px';
    canvas.style.cursor = 'pointer';
  } else {
    hoverGlow.visible = false;
    hoveredMesh = null;
    tooltip.style.display = 'none';
    canvas.style.cursor = 'default';
  }
});

canvas.addEventListener('click', e => {
  getMouseNDC(e);
  if (allMeshes.length === 0) return;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(allMeshes);
  if (hits.length > 0) {
    const name = hits[0].object.userData.planetName;
    window.location.href = `explore.html?planet=${encodeURIComponent(name)}`;
  }
});

canvas.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none';
  canvas.style.cursor = 'default';
  hoverGlow.visible = false;
  hoveredMesh = null;
});

let audioCtx = null;
let audioOn = false;

function startAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.08, audioCtx.currentTime);
    master.connect(audioCtx.destination);

    [40, 60.5, 80.8, 121].forEach(f => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filt = audioCtx.createBiquadFilter();
      osc.type = f < 70 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      gain.gain.value = 0.14 + Math.random() * 0.1;
      filt.type = 'lowpass';
      filt.frequency.value = 280;
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(master);
      osc.start();
    });

    
    const lfo = audioCtx.createOscillator();
    const lg  = audioCtx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06;
    lg.gain.value = 0.03;
    lfo.connect(lg);
    lg.connect(master.gain);
    lfo.start();
  } else {
    audioCtx.resume();
  }
  audioOn = true;
}

function stopAudio() {
  if (audioCtx) audioCtx.suspend();
  audioOn = false;
}

let animSpeed = 1.0;
let paused    = false;
let wireframe = false;
let orbitsOn  = true;
let labelsOn  = true;
let elapsed   = 0;

const reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
if (reducedMotionMQ.matches) {
  paused = true;
  const btn = document.getElementById('btn-pause');
  if (btn) {
    btn.innerHTML = '<span aria-hidden="true">▶</span> Resume Orbits';
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.add('active');
  }
}
reducedMotionMQ.addEventListener('change', e => {
  if (e.matches && !paused) {
    document.getElementById('btn-pause')?.dispatchEvent(new Event('click'));
  }
});

document.getElementById('speed-slider').addEventListener('input', e => {
  animSpeed = parseFloat(e.target.value);
  document.getElementById('speed-display').textContent = animSpeed.toFixed(1) + '×';
});

document.getElementById('btn-pause').addEventListener('click', () => {
  paused = !paused;
  const btn = document.getElementById('btn-pause');
  btn.innerHTML = paused
    ? '<span aria-hidden="true">▶</span> Resume Orbits'
    : '<span aria-hidden="true">⏸</span> Pause Orbits';
  btn.setAttribute('aria-pressed', String(paused));
  btn.classList.toggle('active', paused);
});

document.getElementById('btn-orbits').addEventListener('click', () => {
  orbitsOn = !orbitsOn;
  orbitLines.forEach(l => l.visible = orbitsOn);
  const btn = document.getElementById('btn-orbits');
  btn.classList.toggle('active', orbitsOn);
  btn.setAttribute('aria-pressed', String(orbitsOn));
});

document.getElementById('btn-wireframe').addEventListener('click', () => {
  wireframe = !wireframe;
  wireToggleMeshes.forEach(m => m.material.wireframe = wireframe);
  const btn = document.getElementById('btn-wireframe');
  btn.classList.toggle('active', wireframe);
  btn.setAttribute('aria-pressed', String(wireframe));
});

document.getElementById('btn-bloom').addEventListener('click', () => {
  bloomEnabled = !bloomEnabled;
  bloomPass.enabled = bloomEnabled;
  const btn = document.getElementById('btn-bloom');
  btn.classList.toggle('active', bloomEnabled);
  btn.setAttribute('aria-pressed', String(bloomEnabled));
});

document.getElementById('btn-sunlight').addEventListener('click', () => {
  sunLight.visible = !sunLight.visible;
  const btn = document.getElementById('btn-sunlight');
  btn.classList.toggle('active', sunLight.visible);
  btn.setAttribute('aria-pressed', String(sunLight.visible));
});

document.getElementById('btn-ambient').addEventListener('click', () => {
  ambientLight.visible = !ambientLight.visible;
  const btn = document.getElementById('btn-ambient');
  btn.classList.toggle('active', ambientLight.visible);
  btn.setAttribute('aria-pressed', String(ambientLight.visible));
});

document.getElementById('btn-audio').addEventListener('click', () => {
  if (audioOn) {
    stopAudio();
    document.getElementById('btn-audio').innerHTML = '<span aria-hidden="true">🔇</span> Space Ambience';
    document.getElementById('btn-audio').classList.remove('active');
    document.getElementById('btn-audio').setAttribute('aria-pressed', 'false');
  } else {
    startAudio();
    document.getElementById('btn-audio').innerHTML = '<span aria-hidden="true">🔊</span> Space Ambience';
    document.getElementById('btn-audio').classList.add('active');
    document.getElementById('btn-audio').setAttribute('aria-pressed', 'true');
  }
});

document.getElementById('btn-labels')?.addEventListener('click', () => {
  labelsOn = !labelsOn;
  if (!labelsOn) planetLabels.forEach(({ el }) => el.style.display = 'none');
  const btn = document.getElementById('btn-labels');
  btn.classList.toggle('active', labelsOn);
  btn.setAttribute('aria-pressed', String(labelsOn));
});

document.getElementById('btn-reset-cam').addEventListener('click', () => {
  camera.position.set(0, 55, 118);
  controls.target.set(0, 0, 0);
  controls.update();
});

document.getElementById('panel-toggle-btn').addEventListener('click', () => {
  document.getElementById('controls-panel').classList.toggle('open');
});

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
});

const loadScreen = document.getElementById('loading-screen');
const loadMsg = document.getElementById('loading-msg');
const messages = [
  'Loading textures…',
  'Calculating orbits…',
  'Building starfield…',
  'Compiling shaders…',
  'Almost ready…',
];
let msgI = 0;
const msgTimer = setInterval(() => {
  msgI = (msgI + 1) % messages.length;
  loadMsg.textContent = messages[msgI];
}, 420);

setTimeout(() => {
  clearInterval(msgTimer);
  loadScreen.classList.add('fade-out');
  setTimeout(() => loadScreen.style.display = 'none', 900);
}, 2600);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (!paused) {
    elapsed += delta * animSpeed * 0.4;
    sunMesh.rotation.y += delta * 0.04;
    sunUniforms.time.value = elapsed;

    planets.forEach(p => {
      p.pivot.rotation.y = elapsed * (p.speed * 0.015);
      p.mesh.rotation.y += delta * animSpeed * p.rotSpeed * 0.45;
      if (p.moonPivots && p.moonPivots.length > 0) {
        p.moonPivots.forEach(mp => {
          mp.subPivot.rotation.y += delta * animSpeed * mp.speed * 0.4;
        });
      }
    });

    if (earthClouds) earthClouds.rotation.y += delta * animSpeed * 0.42;
  }

  if (hoveredMesh) {
    const wp = new THREE.Vector3();
    hoveredMesh.getWorldPosition(wp);
    hoverGlow.position.copy(wp);
  }

  updateLabels();
  controls.update();
  bloomEnabled ? composer.render() : renderer.render(scene, camera);
}

const labelContainer = document.getElementById('planet-labels');
const planetLabels = [];   

function buildLabels() {
  planets.forEach(p => {
    const el = document.createElement('div');
    el.className = 'planet-label';
    el.textContent = p.name;
    el.dataset.planet = p.name;
    el.addEventListener('click', () => {
      window.location.href = `explore.html?planet=${encodeURIComponent(p.name)}`;
    });
    labelContainer.appendChild(el);
    planetLabels.push({ el, mesh: p.mesh });
  });
}

const _scrVec = new THREE.Vector3();
function updateLabels() {
  if (!labelsOn) return;
  planetLabels.forEach(({ el, mesh }) => {
    mesh.getWorldPosition(_scrVec);
    _scrVec.project(camera);

    const x = (_scrVec.x *  0.5 + 0.5) * window.innerWidth;
    const y = (_scrVec.y * -0.5 + 0.5) * window.innerHeight;

    const offscreen = _scrVec.z > 1 || x < -80 || x > window.innerWidth + 80
                      || y < -40 || y > window.innerHeight + 40;
    el.style.display = offscreen ? 'none' : 'block';
    if (!offscreen) {
      el.style.left = x + 'px';
      el.style.top  = (y - 28) + 'px';
    }
  });
}

buildPlanets().then(() => {
  buildLabels();
  animate();
}).catch(err => {
  console.error('buildPlanets failed:', err);
  animate();
});
