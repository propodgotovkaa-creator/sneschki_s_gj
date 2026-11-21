"use strict";
const el = id => document.getElementById(id);
const words = {"z": ["Заяц", "Зонт", "Замок", "Забор", "Зуб", "Завод", "Коза", "Ваза", "Роза", "Берёза", "Медуза", "Стрекоза", "Изба", "Пазлы", "Глаза"], "zh": ["Жук", "Жаба", "Жираф", "Жилет", "Жёлудь", "Снежинка", "Ежи", "Лыжи", "Ножи", "Пижама", "Лужа", "Пружина", "Моржи", "Медвежонок", "Баклажан"]};
const pictures = Object.fromEntries(Object.entries(words).map(([group,names]) =>
  [group,names.map((name,i)=>({name,group,src:'assets/'+group+(i+1)+'.jpg'}))]));
const state = {group:"z", count:5, lives:5, score:0,  locked:false};
const random = (a,b) => a + Math.random()*(b-a);
function shuffled(items) {
  const out = items.slice();
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}
function setupChoices(id,select){
  el(id).onclick = event => {
    const choice=event.target.closest("button");
    if(!choice)return;
    for(const b of el(id).children)b.setAttribute("aria-pressed",String(b===choice));
    select(choice.dataset.value);
  };
}
setupChoices("sounds",v=>state.group=v);
setupChoices("counts",v=>state.count=Number(v));
function setScreen(name){
  el("field").dataset.screen=name;
  el("menu").hidden=name!=="menu";el("end").hidden=name!=="end";
  for(const id of ["boards","prompt","hud"])el(id).hidden=name!=="play";
}
function heart(){
  return '<svg class="heart" viewBox="0 0 32 30" aria-hidden="true"><path d="M16 27C11 23 2 17 2 10 2 2 12 0 16 7 21 -1 30 3 30 10 30 16 21 24 16 27Z" fill="#a6c9d4" stroke="#557a88" stroke-width="1.5"/><path d="M4 10C4 4 11 2 15 9M19 7q5-5 8 0" stroke="#fff" fill="none" stroke-width="3" stroke-linecap="round"/></svg>';
}
function updateHud(){
  el("score").textContent=state.score+"/15";
  el("lives").setAttribute("aria-label","Осталось жизней — "+state.lives);
  Array.from(el("lives").children).forEach((h,i)=>h.classList.toggle("spent",i>=state.lives));
}
function start(){
  Object.assign(state,{score:0,lives:state.count,locked:false});
  el("boy").src="assets/boy.png";
  el("prompt").textContent="Найди звук "+(state.group==="z"?"З":"Ж");
  el("lives").innerHTML=heart().repeat(state.count);
  completed.clear();
  bags = {z:[], zh:[]}; recent = []; groupPair = [];
  setScreen("play");updateHud();showNext();
}
const completed = new Set();
let bags, recent, groupPair;
let lastSpot = -1;
let activeBoard = null;
let cycleTimer = 0;
const readingTime = 3000;

function drawCard(){
  // Each pair contains both sounds; each group runs through its own shuffled bag.
  if(!groupPair.length)groupPair = shuffled(["z","zh"]);
  const group = groupPair.pop();
  if(!bags[group].length){
    const pool = shuffled(pictures[group].filter(card => !completed.has(card)));
    bags[group] = [...pool.filter(card => !recent.includes(card)), ...pool.filter(card => recent.includes(card))];
  }
  const card = bags[group].shift();
  recent = [...recent.slice(-5),card];
  return card;
}

function showNext(){
  clearTimeout(cycleTimer);
  if(el("field").dataset.screen !== "play")return;
  const card = drawCard();
  const spots = [0,1,2].filter(spot => spot !== lastSpot);
  lastSpot = shuffled(spots)[0];
  const button = document.createElement("button");
  const picture = new Image();
  picture.src = card.src;
  picture.alt = "";
  picture.draggable = false;
  button.className = "board rising";
  button.setAttribute("aria-label",card.name);
  button.style.left = ([23,50,77][lastSpot] + random(-3,3)) + "%";
  button.style.setProperty("--lean",random(-4,4)+"deg");
  button.append(picture);
  button.onclick = () => shoot(card,button);
  activeBoard = button;
  el("boards").replaceChildren(button);
  cycleTimer = setTimeout(() => lowerBoard(button,showNext), readingTime + 460);
}

async function lowerBoard(button,after){
  if(button !== activeBoard)return;
  clearTimeout(cycleTimer);
  activeBoard = null;
  button.disabled = true;
  button.classList.add("lowering");
  await button.getAnimations().find(a => a.animationName === "lower")?.finished.catch(()=>{});
  button.remove();
  cycleTimer = setTimeout(after,240);
}
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
async function motion(node,frames,duration,easing="ease-out"){
  const anim=node.animate(frames,{duration:reduced?18:duration,easing});
  await anim.finished.catch(()=>{});
}
function point(node,fx=.5,fy=.5){
  const r=node.getBoundingClientRect(),field=el("field").getBoundingClientRect();
  return {x:r.left-field.left+r.width*fx,y:r.top-field.top+r.height*fy};
}
async function flight(a,b,returning=false){
  const ball = document.createElement("i");
  ball.className = "ball";
  const distance = Math.hypot(b.x-a.x,b.y-a.y);
  const height = el("field").clientHeight;
  const loft = Math.min(height*.23, distance*.31);
  const startScale = returning ? .38 : 1;
  const endScale = returning ? .70 : .49;
  const diameter = el("boy").getBoundingClientRect().width*.155;
  ball.style.width = diameter+"px";
  el("field").append(ball);
  const frames = Array.from({length:33},(_,i)=>{
    const t=i/32;
    // A receding throw covers more screen distance just after release.
    const depth = returning ? t/(1.4-.4*t) : 1.4*t/(1+.4*t);
    const x=a.x+(b.x-a.x)*depth;
    const y=a.y+(b.y-a.y)*depth-4*loft*t*(1-t);
    const scale=startScale+(endScale-startScale)*depth;
    return {transform:`translate(${x}px,${y}px) translate(-50%,-50%) scale(${scale}) rotate(${t*135}deg)`};
  });
  await motion(ball,frames,Math.min(720,430+distance*.30),"linear");
  ball.remove();
}

function shatter(at,diameter){
  const field=el("field");
  const puff=document.createElement("i");
  puff.className="snow-puff";
  puff.style.cssText=`left:${at.x}px;top:${at.y}px;width:${diameter*2.8}px`;
  field.append(puff);
  motion(puff,[{transform:"translate(-50%,-50%) scale(.26)",opacity:.85},{transform:"translate(-50%,-57%) scale(1.5)",opacity:0}],320).then(()=>puff.remove());
  for(let i=0;i<24;i++){
    const fragment=document.createElement("i");
    fragment.className="snow-chip";
    const size=diameter*(i<8?random(.14,.32):random(.045,.13));
    fragment.style.cssText=`width:${size}px;height:${size*random(.7,1.2)}px;left:${at.x}px;top:${at.y}px`;
    field.append(fragment);
    const angle=random(0,Math.PI*2),speed=diameter*random(.75,2.25);
    const dx=Math.cos(angle)*speed,dy=Math.sin(angle)*speed-diameter*.8;
    const spin=random(-210,210);
    const frames=Array.from({length:13},(_,j)=>{
      const t=j/12;
      return {transform:`translate(${dx*t}px,${dy*t+diameter*2.1*t*t}px) rotate(${spin*t}deg) scale(${1-.33*t})`,opacity:Math.min(1,(1-t)*2)};
    });
    motion(fragment,frames,random(360,620),"linear").then(()=>fragment.remove());
  }
}
function burst(p,flags=false){
  for(let i=0;i<(flags?45:14);i++){
    const bit=document.createElement("i");bit.className=flags?"flag":"dust";
    bit.style.left=p.x+"px";bit.style.top=p.y+"px";
    if(flags && i%3)bit.style.background=["#c67545","#6e957f","#e5b450","#8db5ce"][i%4];
    else if(flags)bit.className="dust";
    el("field").append(bit);
    const dx=random(-1,1)*(flags?el("field").clientWidth*.48:44);
    const dy=flags?random(70,220):random(12,48);
    motion(bit,[{transform:"translate(0,0)",opacity:1},{transform:'translate('+dx*.58+'px,'+-dy+'px) rotate(65deg)',opacity:1,offset:.55},{transform:'translate('+dx+'px,'+(flags?52:-dy*.25)+'px) rotate(150deg)',opacity:0}],flags?1450:380).then(()=>bit.remove());
  }
}
async function shoot(card,button){
  if(state.locked || button !== activeBoard || el("field").dataset.screen!=="play")return;
  clearTimeout(cycleTimer);
  state.locked=true;
  const boy=el("boy");
  for(const animation of button.getAnimations()){
    if(animation.animationName==="surface")animation.finish();
    else animation.pause();
  }
  const target=point(button.querySelector("img"));
  await motion(boy,[{transform:"rotate(0)"},{transform:"rotate(-7deg)",offset:.55},{transform:"rotate(4deg)"}],180);
  const hand=point(boy,.90,.04);
  const diameter=boy.getBoundingClientRect().width*.155;
  boy.src="assets/throw.png";
  await flight(hand,target);
  shatter(target,diameter*.6);
  const correct=card.group===state.group;
  if(correct){
    completed.add(card);state.score++;updateHud();el("announce").textContent=card.name+". Верно! "+state.score+" из 15.";
    await motion(button.querySelector("img"),[{rotate:"0deg"},{rotate:"-7deg"},{rotate:"4deg"},{rotate:"0deg"}],210);
    await lowerBoard(button, () => state.score===15 ? finish(true) : showNext());
  }else{
    const hat=point(boy,.46,.16);
    await flight(target,hat,true);shatter(hat,diameter*.78);
    state.lives--;updateHud();el("announce").textContent=card.name+". Попробуй другую картинку. Жизней — "+state.lives;
    await motion(boy,[{transform:"rotate(0)"},{transform:"rotate(-5deg)"},{transform:"rotate(3deg)"},{transform:"rotate(0)"}],270);
    if(state.lives===0)finish(false);else await lowerBoard(button,showNext);
  }
  if(el("field").dataset.screen==="play")boy.src="assets/boy.png";
  state.locked=false;
}
function finish(won){
  clearTimeout(cycleTimer);activeBoard=null;el("boards").replaceChildren();
  setScreen("end");el("boy").src="assets/"+(won?"win":"lose")+".png";
  el("ending").textContent=won?"Ура! Крепость покорена!":"Снежки закончились!";
  el("summary").textContent=won?"15 точных попаданий!":"Попробуем ещё раз?";
  el("remaining").textContent=won?"Осталось жизней — "+state.lives:"Попадания — "+state.score+"/15";
  el("again").textContent=won?"Играть ещё":"Попробовать снова";el("again").focus();
  if(won){burst(point(el("field"),.64,.53),true);}
}
el("rulesButton").onclick=()=>el("rules").showModal();
el("play").onclick=start;el("again").onclick=start;
el("back").onclick=()=>{setScreen("menu");el("boy").src="assets/boy.png";el("play").focus();};
for(let i=0;i<40;i++){
  const flake=document.createElement("i");flake.className="flake";flake.style.left=random(-3,100)+"%";
  const size=random(1,4)+"px";flake.style.width=size;flake.style.height=size;
  flake.style.animationDuration=random(5,12)+"z";flake.style.animationDelay=-random(0,12)+"z";el("snow").append(flake);
}
for(const src of [...Object.values(pictures).flat().map(c=>c.src),"assets/win.png","assets/lose.png","assets/throw.png"]){new Image().src=src;}
