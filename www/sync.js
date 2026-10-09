/* Conti Chiari — sincronizzazione cifrata tra telefoni.
 *
 * Come funziona:
 * - Ogni gruppo online ha una chiave segreta casuale (AES-256). Chi ha la chiave (tramite QR o link) può leggere il gruppo.
 * - Ogni modifica (spesa, persona, pagamento, messaggio...) diventa un'"operazione", cifrata sul telefono con AES-GCM.
 * - L'operazione cifrata viene firmata con la chiave del dispositivo (Schnorr/secp256k1) e inviata a più relay pubblici
 *   della rete Nostr. I relay conservano e inoltrano solo testo cifrato: non possono leggere né modificare nulla.
 * - Ogni telefono riceve le operazioni degli altri e le applica: per ogni oggetto vince la modifica più recente.
 */
(function(){
'use strict';
const KIND = 4321;
const DEFAULT_RELAYS = ['wss://relay.damus.io','wss://nos.lol','wss://relay.primal.net','wss://relay.nostr.band'];
const enc = new TextEncoder(), dec = new TextDecoder();
const subtle = crypto.subtle;
const {schnorr} = window.nobleSecp;

/* ---------- utilità ---------- */
const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => Uint8Array.from(h.match(/../g).map(x => parseInt(x, 16)));
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s)}
function unb64(s){const b=atob(s);return Uint8Array.from(b,c=>c.charCodeAt(0))}
const b64url = bytes => b64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function unb64url(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return unb64(s)}
const sha256 = async data => new Uint8Array(await subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));
const rid = () => hex(crypto.getRandomValues(new Uint8Array(8)));

/* ---------- identità del dispositivo ---------- */
function deviceKeys(store){
  let sk = store.get('sk');
  if(!sk || !/^[0-9a-f]{64}$/.test(sk)){
    sk = hex(window.nobleSecp.utils.randomSecretKey ? window.nobleSecp.utils.randomSecretKey() : crypto.getRandomValues(new Uint8Array(32)));
    store.set('sk', sk);
  }
  return {sk, pk: hex(schnorr.getPublicKey(unhex(sk)))};
}

/* ---------- chiave del gruppo ---------- */
function newGroupKey(){return b64url(crypto.getRandomValues(new Uint8Array(32)))}
async function topicOf(key){return hex(await sha256('conti-chiari/topic/' + key)).slice(0, 32)}
const keyCache = {};
async function aesKey(key){
  if(!keyCache[key]) keyCache[key] = subtle.importKey('raw', unb64url(key), 'AES-GCM', false, ['encrypt','decrypt']);
  return keyCache[key];
}
async function seal(key, obj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({name:'AES-GCM', iv}, await aesKey(key), enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return b64(out);
}
async function open(key, content){
  const raw = unb64(content);
  const pt = await subtle.decrypt({name:'AES-GCM', iv: raw.subarray(0, 12)}, await aesKey(key), raw.subarray(12));
  return JSON.parse(dec.decode(pt));
}

/* ---------- eventi Nostr firmati ---------- */
async function makeEvent(keys, topic, content, ts, expires){
  const tags = [['t', topic]];
  if(expires) tags.push(['expiration', String(Math.ceil(expires / 1000))]);   // i relay che supportano NIP-40 lo cancellano alla scadenza
  const ev = {pubkey: keys.pk, created_at: Math.floor(ts / 1000), kind: KIND, tags, content};
  const id = await sha256(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]));
  ev.id = hex(id);
  ev.sig = hex(await schnorr.signAsync(id, unhex(keys.sk)));
  return ev;
}
async function checkEvent(ev){
  try{
    if(!ev || ev.kind !== KIND || typeof ev.content !== 'string' || !/^[0-9a-f]{64}$/.test(ev.pubkey)) return false;
    const id = hex(await sha256(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content])));
    if(id !== ev.id) return false;
    return await schnorr.verifyAsync(unhex(ev.sig), unhex(ev.id), unhex(ev.pubkey));
  }catch(e){return false}
}

/* ---------- collegamento ai relay ---------- */
class Hub{
  constructor(opts){
    this.relays = opts.relays || DEFAULT_RELAYS;
    this.onOp = opts.onOp;             // (groupId, op, pubkey, createdAt) => void
    this.onStatus = opts.onStatus || (()=>{});
    this.onSent = opts.onSent || (()=>{});
    this.keys = opts.keys;
    this.socks = {};                   // url -> {ws, open, retry}
    this.groups = {};                  // topic -> {id, key, since}
    this.seen = new Set();
    this.pending = {};                 // eventId -> event (in attesa di conferma)
  }
  connected(){return Object.values(this.socks).filter(s => s.open).length}
  start(){this.relays.forEach(u => this._connect(u))}
  _connect(url){
    let s = this.socks[url];
    if(s && s.ws && s.ws.readyState < 2) return;
    s = this.socks[url] = s || {retry: 1000};
    let ws;
    try{ ws = new WebSocket(url) }catch(e){ return this._later(url) }
    s.ws = ws; s.open = false;
    ws.onopen = () => {
      s.open = true; s.retry = 1000; this.onStatus(this.connected());
      Object.keys(this.groups).forEach(t => this._req(ws, t));
      Object.values(this.pending).forEach(ev => { try{ ws.send(JSON.stringify(['EVENT', ev])) }catch(e){} });
    };
    ws.onclose = () => { s.open = false; this.onStatus(this.connected()); this._later(url) };
    ws.onerror = () => { try{ws.close()}catch(e){} };
    ws.onmessage = m => this._msg(m.data);
  }
  _later(url){
    const s = this.socks[url]; if(s.timer) return;
    s.timer = setTimeout(() => { s.timer = null; this._connect(url) }, s.retry);
    s.retry = Math.min(s.retry * 2, 60000);
  }
  _req(ws, topic){
    const g = this.groups[topic];
    const filter = {kinds:[KIND], '#t':[topic], limit: 5000};
    if(g.since) filter.since = Math.max(0, g.since - 3600);
    try{ ws.send(JSON.stringify(['REQ', 'cc-' + topic.slice(0, 12), filter])) }catch(e){}
  }
  watch(groupId, key, topic, since){
    const fresh = !this.groups[topic];
    this.groups[topic] = {id: groupId, key, since: since || 0};
    if(fresh) Object.values(this.socks).forEach(s => s.open && this._req(s.ws, topic));
  }
  unwatch(topic){
    delete this.groups[topic];
    Object.values(this.socks).forEach(s => { if(s.open) try{ s.ws.send(JSON.stringify(['CLOSE', 'cc-' + topic.slice(0, 12)])) }catch(e){} });
  }
  async _msg(data){
    let m; try{ m = JSON.parse(data) }catch(e){ return }
    if(m[0] === 'OK' && m[2] === true && this.pending[m[1]]){ delete this.pending[m[1]]; this.onSent(m[1]); return }
    if(m[0] !== 'EVENT' || !m[2]) return;
    const ev = m[2];
    if(this.seen.has(ev.id)) return;
    const tag = (ev.tags || []).find(t => t[0] === 't');
    const g = tag && this.groups[tag[1]];
    if(!g) return;
    this.seen.add(ev.id);
    if(!(await checkEvent(ev))) return;
    // la chiave può dipendere da chi scrive (casella delle richieste di amicizia: chiave ECDH con il mittente)
    let key; try{ key = typeof g.key === 'function' ? await g.key(ev.pubkey) : g.key }catch(e){ return }
    if(!key) return;
    let op; try{ op = await open(key, ev.content) }catch(e){ return }   // chiave sbagliata o dati manomessi
    if(!op || typeof op !== 'object' || typeof op.t !== 'string') return;
    g.since = Math.max(g.since || 0, ev.created_at);
    this.onOp(g.id, op, ev.pubkey, ev.created_at);
  }
  async publish(key, topic, op){
    const ev = await makeEvent(this.keys, topic, await seal(key, op), op.ts || Date.now(), op.exp);
    this.seen.add(ev.id);
    this.pending[ev.id] = ev;
    Object.values(this.socks).forEach(s => { if(s.open) try{ s.ws.send(JSON.stringify(['EVENT', ev])) }catch(e){} });
    return ev;
  }
  resend(events){ events.forEach(ev => { this.pending[ev.id] = ev; this.seen.add(ev.id) }); Object.values(this.socks).forEach(s => { if(s.open) events.forEach(ev => { try{ s.ws.send(JSON.stringify(['EVENT', ev])) }catch(e){} }) }) }
}

/* ---------- chat private: chiave condivisa tra due dispositivi (ECDH secp256k1) ---------- */
async function dmChannel(sk, peerPk){
  // la coordinata x del punto condiviso è uguale per entrambi; solo i due dispositivi possono calcolarla
  const shared = window.nobleSecp.getSharedSecret(unhex(sk), unhex('02' + peerPk));
  const x = shared.slice(1);
  const material = new Uint8Array(6 + x.length); material.set(enc.encode('cc-dm:')); material.set(x, 6);
  const key = b64url(await sha256(material));
  return {key, topic: await topicOf(key)};
}

/* ---------- rubrica: casella personale e codice contatto ---------- */
// Ogni telefono ascolta la propria «casella» (argomento ricavato dalla sua chiave pubblica). Chi conosce la chiave
// pubblica può scriverci, ma il contenuto è cifrato con la chiave ECDH tra i due dispositivi: lo legge solo il destinatario.
function inboxTopic(pk){return topicOf('inbox:' + pk)}
function contactLink(pk, name){
  const payload = b64url(enc.encode(JSON.stringify({v:1, p: pk, n: String(name || '').slice(0, 24)})));
  const here = /^https?:/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname) ? location.origin + location.pathname : APP_URL;
  return here + '#add=' + payload;
}
function parseContact(text){
  const m = String(text || '').match(/add=([A-Za-z0-9_-]+)/);
  if(!m) return null;
  try{
    const o = JSON.parse(dec.decode(unb64url(m[1])));
    if(o && o.v === 1 && /^[0-9a-f]{64}$/.test(o.p)) return {pk: o.p, name: String(o.n || '').slice(0, 24)};
  }catch(e){}
  return null;
}

/* ---------- inviti ---------- */
const APP_URL = 'https://kekkoermalizia.github.io/Conti-Chiari/';
function inviteLink(group){
  const payload = b64url(enc.encode(JSON.stringify(Object.assign({v:2, id: group.id, n: group.name, k: group.sync.key}, group.sync.owner ? {o: group.sync.owner} : {}))));
  const here = /^https?:/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname) ? location.origin + location.pathname : APP_URL;
  return here + '#join=' + payload;
}
function parseInvite(text){
  const m = String(text || '').match(/join=([A-Za-z0-9_-]+)/);
  if(!m) return null;
  try{
    const o = JSON.parse(dec.decode(unb64url(m[1])));
    if(o && o.v === 2 && typeof o.id === 'string' && typeof o.k === 'string' && unb64url(o.k).length === 32) return {id: o.id.slice(0, 40), name: String(o.n || '').slice(0, 40), key: o.k, owner: /^[0-9a-f]{64}$/.test(o.o || '') ? o.o : ''};
  }catch(e){}
  return null;
}

window.CCSync = {Hub, deviceKeys, newGroupKey, topicOf, seal, open, makeEvent, checkEvent, inviteLink, parseInvite, dmChannel, inboxTopic, contactLink, parseContact, rid, KIND, DEFAULT_RELAYS};
})();
