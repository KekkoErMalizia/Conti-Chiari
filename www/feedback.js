/* Conti Chiari — suoni, vibrazione, lettura vocale e modalità vista.
   Tutti i suoni sono sintetizzati al momento (Web Audio): nessun file da scaricare. */
(function(){
'use strict';
let ctx = null, master = null;
function audio(){
  if(!ctx){
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
  }
  if(ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const vol = () => (SET.vol ?? 50) / 100;

// mattoncini sonori
function tone(f, start, dur, {type = 'sine', gain = .2, f2 = null, attack = .004} = {}){
  const c = ctx, o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + start;
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if(f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + .02);
}
function noise(start, dur, {gain = .15, freq = 3000, q = .8} = {}){
  const c = ctx, n = Math.ceil(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for(let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime + start;
  s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(master); s.start(t0);
}
function bell(f, start, {gain = .12, dur = .5} = {}){
  [[1, 1], [2.32, .45], [4.25, .25], [6.63, .12]].forEach(([r, a]) => tone(f * r, start, dur / (r > 2 ? 2 : 1), {gain: gain * a, attack: .002}));
}

// un suono diverso per ogni tipo di azione
const SOUNDS = {
  tap:     () => { noise(0, .02, {gain: .1, freq: 4200}); tone(1700, 0, .035, {gain: .05}); },
  tab:     () => { tone(660, 0, .05, {gain: .08, type: 'triangle'}); tone(990, .045, .06, {gain: .07, type: 'triangle'}); },
  toggle:  () => { tone(1250, 0, .03, {gain: .07, type: 'square'}); noise(0, .015, {gain: .06, freq: 6000}); },
  open:    () => { tone(420, 0, .12, {gain: .08, f2: 900}); noise(0, .1, {gain: .04, freq: 1800, q: .6}); },
  close:   () => { tone(900, 0, .11, {gain: .07, f2: 400}); },
  success: () => { tone(1047, 0, .16, {gain: .12, type: 'triangle'}); tone(1319, .08, .22, {gain: .11, type: 'triangle'}); tone(1568, .16, .3, {gain: .09}); },
  delete:  () => { tone(160, 0, .16, {gain: .22, f2: 60}); noise(0, .07, {gain: .08, freq: 900}); },
  undo:    () => { tone(800, 0, .09, {gain: .08, f2: 520, type: 'triangle'}); tone(520, .08, .1, {gain: .07, type: 'triangle'}); },
  pay:     () => { noise(0, .04, {gain: .12, freq: 2500}); bell(2637, .05, {gain: .1, dur: .6}); bell(3520, .14, {gain: .06, dur: .5}); },
  send:    () => { tone(380, 0, .09, {gain: .1, f2: 1300}); },
  receive: () => { tone(1319, 0, .1, {gain: .09}); tone(1760, .09, .16, {gain: .08}); },
  error:   () => { tone(196, 0, .1, {gain: .1, type: 'square'}); tone(185, .13, .14, {gain: .1, type: 'square'}); },
  scan:    () => { [880, 1109, 1319, 1760].forEach((f, i) => tone(f, i * .06, .18, {gain: .08, type: 'triangle'})); },
};
// vibrazioni: durate in ms, moltiplicate per l'intensità (50% = valori base)
const HAPTICS = {
  tap: [8], tab: [12], toggle: [10], open: [14], close: [10], success: [15, 50, 25], delete: [35],
  undo: [12, 40, 12], pay: [10, 35, 10, 35, 45], send: [12], receive: [20, 60, 20], error: [45, 35, 45], scan: [15, 30, 15, 30, 15]
};
function play(type){
  try{
    if(SET.sound !== false && vol() > 0 && SOUNDS[type] && audio()){ master.gain.value = vol() * 1.6; SOUNDS[type](); }
  }catch(e){}
  try{
    const k = (SET.vibInt ?? 50) / 50;
    if(SET.vib !== false && k > 0 && navigator.vibrate && HAPTICS[type]) navigator.vibrate(HAPTICS[type].map((v, i) => i % 2 ? v : Math.max(1, Math.round(v * k))));
  }catch(e){}
}

// ---------- lettura vocale (modalità cecità) ----------
const LOCALES = {it:'it-IT',en:'en-US',es:'es-ES',fr:'fr-FR',de:'de-DE',pt:'pt-PT',nl:'nl-NL',pl:'pl-PL',ro:'ro-RO',sv:'sv-SE',tr:'tr-TR',el:'el-GR',ru:'ru-RU',uk:'uk-UA',ar:'ar-SA',hi:'hi-IN',zh:'zh-CN',ja:'ja-JP',ko:'ko-KR'};
function voiceOn(){ return mode() === 'blind' && 'speechSynthesis' in window; }
function speak(text){
  if(!voiceOn() || !text) return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 300));
    u.lang = LOCALES[LANG] || LANG; u.rate = .6 + (SET.voiceRate ?? 50) / 100 * .9; u.volume = Math.max(.2, vol() * 2 > 1 ? 1 : vol() * 2);
    speechSynthesis.speak(u);
  }catch(e){}
}
function labelOf(el){
  const l = el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) || el.textContent || el.value || el.placeholder;
  return (l || '').replace(/\s+/g, ' ').trim();
}

// ---------- modalità vista ----------
const MODES = ['auto', 'standard', 'low', 'contrast', 'protan', 'deutan', 'tritan', 'mono', 'blind', 'photo'];
function mode(){ return MODES.includes(SET.vision) ? SET.vision : 'auto'; }
function applyVision(){
  const r = document.documentElement, m = mode();
  const sysContrast = matchMedia('(prefers-contrast: more)').matches, sysMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  r.classList.toggle('a-hc', m === 'contrast' || m === 'low' || (m === 'auto' && sysContrast));
  r.classList.toggle('a-big', m === 'low' || m === 'blind');
  r.classList.toggle('a-cb-rg', m === 'protan' || m === 'deutan');
  r.classList.toggle('a-cb-by', m === 'tritan');
  r.classList.toggle('a-mono', m === 'mono');
  r.classList.toggle('a-photo', m === 'photo');
  r.classList.toggle('a-rm', m === 'photo' || m === 'low' || m === 'blind' || ((m === 'auto') && sysMotion));
  // dimensione del testo: cursore 0..100, 50 = normale (0 → 85%, 100 → 160%), +20% in ipovisione e cecità
  const s = SET.textSize ?? 50, z = (s <= 50 ? .85 + s / 50 * .15 : 1 + (s - 50) / 50 * .6) * (m === 'low' || m === 'blind' ? 1.2 : 1);
  document.body.style.zoom = Math.round(z * 100) / 100;
  if(!voiceOn() && 'speechSynthesis' in window) try{ speechSynthesis.cancel() }catch(e){}
}
['(prefers-contrast: more)', '(prefers-reduced-motion: reduce)'].forEach(q => { try{ matchMedia(q).addEventListener('change', applyVision) }catch(e){} });

// ---------- collegamenti automatici ----------
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('button,[role=tab],label.chip,label.btn,.sw,select,input[type=checkbox],input[type=range],summary,.glist button');
  if(!el) return;
  let type = 'tap';
  if(el.getAttribute('role') === 'tab') type = 'tab';
  else if(el.matches('input[type=checkbox],label.chip,.sw,.switch,input[type=range]') || el.closest('.switch,.seg')) type = 'toggle';
  play(type);
}, {capture: true, passive: true});
document.addEventListener('click', e => {
  if(!voiceOn()) return;
  const el = e.target.closest('button,[role=tab],label,a,summary,select,input'); if(el) speak(labelOf(el));
}, true);
document.addEventListener('focusin', e => { if(voiceOn() && e.target.matches('input,select,textarea')) speak(labelOf(e.target)); });
// un errore mostrato in qualsiasi punto dell'app suona e, con la voce, viene letto
new MutationObserver(list => list.forEach(m => {
  const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
  if(el && el.classList && el.classList.contains('err') && el.textContent.trim()){ play('error'); speak(el.textContent); }
})).observe(document.body, {subtree: true, childList: true, characterData: true});

window.FX = {play, speak, applyVision, voiceOn, MODES};
applyVision();
})();
