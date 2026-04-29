import { Renderer, writeInst, INST_F } from './renderer';
import * as C from './constants';

type BuildingSize = C.BuildingSize;
interface Building { size: BuildingSize; x: number; y: number; w: number; h: number; hp: number; maxHp: number; score: number; target: boolean; alive: boolean; flash: number; color: readonly [number, number, number]; }
interface Human { x: number; y: number; vx: number; vy: number; alive: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; r: number; g: number; b: number; }
interface Ball { x: number; y: number; vx: number; vy: number; r: number; }

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const wrap = document.getElementById('wrap') as HTMLElement;
const scoreEl = document.getElementById('score-display') as HTMLElement;
const targetEl = document.getElementById('target-display') as HTMLElement;
const destroyEl = document.getElementById('destroy-display') as HTMLElement;
const fuelFill = document.getElementById('life-fill') as HTMLElement;
const title = document.getElementById('title') as HTMLElement;
const result = document.getElementById('result') as HTMLElement;

function applyScale() { wrap.style.transform = `scale(${Math.min(window.innerWidth / C.CANVAS_WIDTH, window.innerHeight / C.CANVAS_HEIGHT)})`; }
window.addEventListener('resize', applyScale); applyScale();

const renderer = new Renderer(canvas);
const buf = new Float32Array(60000 * INST_F);
let buildings: Building[] = [], humans: Human[] = [], particles: Particle[] = [];
let ball: Ball; let pressed = false, started = false, cleared = false, gameOver = false;
let fuel = 100, score = 0, totalBuildings = 0, lastTime = 0;
const targetCountRequired = 3, destructionRequired = 0.8;

function palette(size: BuildingSize): readonly [number, number, number] {
  switch (size) {
    case 'convenience': return [0.30, 0.78, 0.55];
    case 'apartment': return [0.48, 0.58, 0.70];
    case 'train_station': return [0.88, 0.78, 0.48];
    case 'hospital': return [0.88, 0.90, 0.94];
    case 'tower': return [0.45, 0.70, 0.90];
    case 'ramen': return [0.84, 0.32, 0.22];
    case 'shop': return [0.42, 0.62, 0.82];
    case 'garage': return [0.45, 0.45, 0.45];
    case 'townhouse': return [0.72, 0.55, 0.40];
    default: return [0.70, 0.50, 0.34];
  }
}
function makeBuilding(size: BuildingSize, x: number, y: number, target = false): Building { const def = C.BUILDING_DEFS[size]; return { size, x, y, w: def.w, h: def.h, hp: def.hp, maxHp: def.hp, score: def.score, target, alive: true, flash: 0, color: palette(size) }; }

function reset() {
  buildings = [makeBuilding('house',-142,-220),makeBuilding('townhouse',-104,-216),makeBuilding('garage',-66,-224),makeBuilding('convenience',-12,-218,true),makeBuilding('house',48,-220),makeBuilding('house',104,-218),makeBuilding('ramen',-132,-118),makeBuilding('shop',-92,-114),makeBuilding('shop',-50,-114),makeBuilding('apartment',12,-128,true),makeBuilding('townhouse',82,-116),makeBuilding('garage',132,-124),makeBuilding('house',-142,-22),makeBuilding('house',-100,-20),makeBuilding('ramen',-52,-24),makeBuilding('train_station',26,-34,true),makeBuilding('shop',106,-22),makeBuilding('house',150,-20),makeBuilding('hospital',-104,88,true),makeBuilding('tower',-12,82,true),makeBuilding('apartment',82,92),makeBuilding('convenience',144,100)];
  humans = []; for (let i=0;i<60;i++) humans.push({ x:-160+Math.random()*320, y:-175+Math.random()*310, vx:(Math.random()*2-1)*18, vy:(Math.random()*2-1)*18, alive:true });
  particles = []; ball = { x:0, y:-210, vx:0, vy:8, r:C.BALL_RADIUS };
  fuel = 100; score = 0; totalBuildings = buildings.length; cleared = false; gameOver = false; started = false;
  title.classList.add('show'); result.classList.remove('show'); updateHud();
}
function activeTargetsDestroyed(){ return buildings.filter(b=>b.target&&!b.alive).length; }
function destructionRatio(){ return (totalBuildings-buildings.filter(b=>b.alive).length)/totalBuildings; }
function updateHud(){ scoreEl.textContent=`SCORE ${score.toLocaleString()}`; targetEl.textContent=`TARGET ${activeTargetsDestroyed()}/${targetCountRequired}`; destroyEl.textContent=`DEST ${Math.floor(destructionRatio()*100)}%`; fuelFill.style.width=`${Math.max(0,Math.min(100,fuel))}%`; }
function circleAabb(cx:number,cy:number,r:number,b:Building){ const left=b.x-b.w/2,right=b.x+b.w/2,bottom=b.y,top=b.y+b.h; const nx=Math.max(left,Math.min(cx,right)),ny=Math.max(bottom,Math.min(cy,top)); const dx=cx-nx,dy=cy-ny; return dx*dx+dy*dy<=r*r; }
function damageBuilding(b:Building){ b.hp-=1; b.flash=.08; ball.vx+=(ball.x-b.x)*.035; ball.vy*=-.72; if(b.hp<=0&&b.alive){ b.alive=false; score+=b.score*(b.target?3:1); fuel=Math.min(100,fuel+(b.target?18:6)); for(let i=0;i<24;i++) particles.push({x:b.x,y:b.y+b.h/2,vx:(Math.random()*2-1)*100,vy:(Math.random()*2-1)*100,life:.45+Math.random()*.25,r:b.color[0],g:b.color[1],b:b.color[2]}); } }
function flipper(left:boolean){ const px=left?-86:86,py=-230,len=C.FLIPPER_W,base=left?-.46:Math.PI+.46,angle=base+(pressed?(left?.9:-.9):0); return {px,py,x2:px+Math.cos(angle)*len,y2:py+Math.sin(angle)*len,left}; }
function resolveFlipper(f:ReturnType<typeof flipper>){ const ax=f.px,ay=f.py,bx=f.x2,by=f.y2,dx=bx-ax,dy=by-ay; const t=Math.max(0,Math.min(1,((ball.x-ax)*dx+(ball.y-ay)*dy)/(dx*dx+dy*dy))); const x=ax+dx*t,y=ay+dy*t,ox=ball.x-x,oy=ball.y-y,d=Math.hypot(ox,oy); if(d<ball.r+4){ const nx=ox/(d||1),ny=oy/(d||1); ball.x=x+nx*(ball.r+4); ball.y=y+ny*(ball.r+4); const power=pressed?11:4; ball.vx+=nx*power+(f.left?3:-3); ball.vy+=ny*power+(pressed?12:3); } }
function update(dt:number){ if(!started||cleared||gameOver)return; fuel-=dt*3.2; if(fuel<=0){ fuel=0; gameOver=true; result.textContent='GAME OVER\nTAP / CLICK TO RETRY'; result.classList.add('show'); updateHud(); return; }
  ball.vy-=C.GRAVITY*55*dt; ball.x+=ball.vx*60*dt; ball.y+=ball.vy*60*dt; ball.vx*=.994; ball.vy*=.994;
  if(ball.x<C.WORLD_MIN_X+ball.r){ball.x=C.WORLD_MIN_X+ball.r;ball.vx=Math.abs(ball.vx)*.72} if(ball.x>C.WORLD_MAX_X-ball.r){ball.x=C.WORLD_MAX_X-ball.r;ball.vx=-Math.abs(ball.vx)*.72} if(ball.y>C.WORLD_MAX_Y-ball.r){ball.y=C.WORLD_MAX_Y-ball.r;ball.vy=-Math.abs(ball.vy)*.72} if(ball.y<C.WORLD_MIN_Y-34){ball.x=0;ball.y=-210;ball.vx=0;ball.vy=8;fuel=Math.max(0,fuel-12)}
  resolveFlipper(flipper(true)); resolveFlipper(flipper(false));
  for(const b of buildings){ if(b.flash>0)b.flash=Math.max(0,b.flash-dt); if(b.alive&&circleAabb(ball.x,ball.y,ball.r,b)) damageBuilding(b); }
  for(const h of humans){ if(!h.alive)continue; h.x+=h.vx*dt; h.y+=h.vy*dt; if(h.x<-165||h.x>165)h.vx*=-1; if(h.y<-185||h.y>145)h.vy*=-1; const dx=h.x-ball.x,dy=h.y-ball.y; if(dx*dx+dy*dy<(ball.r+4)*(ball.r+4)){h.alive=false;score+=10;fuel=Math.min(100,fuel+2);particles.push({x:h.x,y:h.y,vx:0,vy:80,life:.25,r:1,g:.18,b:.12});} }
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.vy-=110*dt} particles=particles.filter(p=>p.life>0);
  if(activeTargetsDestroyed()>=targetCountRequired&&destructionRatio()>=destructionRequired){cleared=true;score+=5000;result.textContent='STAGE CLEAR!\nTAP / CLICK TO RETRY';result.classList.add('show')} updateHud(); }
function drawRoads(n:number){ for(const y of [-170,-70,30,140]){writeInst(buf,n++,0,y,360,14,.20,.20,.20,1); for(let x=-160;x<=160;x+=42)writeInst(buf,n++,x,y,18,2,.75,.72,.45,.75)} writeInst(buf,n++,0,-260,360,60,.12,.20,.12,1); return n; }
function drawBuilding(n:number,b:Building){ const alpha=b.alive?1:.22,c=b.flash>0?[1,1,1] as const:b.color; writeInst(buf,n++,b.x,b.y+b.h/2,b.w,b.h,c[0],c[1],c[2],alpha); writeInst(buf,n++,b.x,b.y+b.h-4,Math.max(4,b.w-6),3,b.target?1:.08,b.target?.82:.08,b.target?.12:.08,alpha); if(b.alive&&b.target){writeInst(buf,n++,b.x,b.y-2,b.w+5,2,1,.82,.12,1);writeInst(buf,n++,b.x,b.y+b.h+2,b.w+5,2,1,.82,.12,1);writeInst(buf,n++,b.x-b.w/2-2,b.y+b.h/2,2,b.h+6,1,.82,.12,1);writeInst(buf,n++,b.x+b.w/2+2,b.y+b.h/2,2,b.h+6,1,.82,.12,1)} if(b.alive&&b.maxHp>1)for(let i=0;i<b.hp;i++)writeInst(buf,n++,b.x-b.w/2+5+i*5,b.y+b.h+7,3,3,1,.2,.15,1); return n; }
function drawFlipper(n:number,left:boolean){ const f=flipper(left),cx=(f.px+f.x2)/2,cy=(f.py+f.y2)/2,angle=Math.atan2(f.y2-f.py,f.x2-f.px); writeInst(buf,n++,cx,cy,C.FLIPPER_W,8,1,.82,.12,1,angle); return n; }
function render(){ renderer.updateProjection(0); renderer.drawBackground(.14,.20,.28,.08,.06,.04); let n=0; n=drawRoads(n); for(const b of buildings)n=drawBuilding(n,b); for(const h of humans)if(h.alive)writeInst(buf,n++,h.x,h.y,C.HUMAN_W,C.HUMAN_H,1,.82,.52,1); for(const p of particles)writeInst(buf,n++,p.x,p.y,4,4,p.r,p.g,p.b,Math.max(0,p.life*2)); n=drawFlipper(n,true); n=drawFlipper(n,false); writeInst(buf,n++,ball.x,ball.y,ball.r*2,ball.r*2,1,.22,.10,1,0,1); writeInst(buf,n++,ball.x-5,ball.y+5,6,6,1,.75,.55,1,0,1); renderer.drawInstances(buf,n); }
function loop(now:number){ const dt=Math.min(.033,(now-lastTime)/1000||0); lastTime=now; update(dt); render(); requestAnimationFrame(loop); }
function startOrRestart(){ if(!started||cleared||gameOver){ reset(); started=true; title.classList.remove('show'); result.classList.remove('show'); } pressed=true; }
window.addEventListener('mousedown',startOrRestart); window.addEventListener('mouseup',()=>{pressed=false}); window.addEventListener('touchstart',e=>{e.preventDefault();startOrRestart()},{passive:false}); window.addEventListener('touchend',e=>{e.preventDefault();pressed=false},{passive:false}); window.addEventListener('keydown',e=>{if(!e.repeat)startOrRestart()}); window.addEventListener('keyup',()=>{pressed=false});
reset(); requestAnimationFrame(t=>{lastTime=t;requestAnimationFrame(loop)});
