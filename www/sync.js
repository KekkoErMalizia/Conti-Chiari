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
function concat(...arrs){const out=new Uint8Array(arrs.reduce((n,a)=>n+a.length,0));let o=0;for(const a of arrs){out.set(a,o);o+=a.length}return out}
// testo in UTF-8 tagliato a max byte senza spezzare un carattere
function utf8Cut(str, max){let s=String(str||'');let b=enc.encode(s);while(b.length>max){s=s.slice(0,-1);b=enc.encode(s)}return b}
// base58 (alfabeto Bitcoin): solo lettere e cifre, i link restano interi quando si copiano nelle chat
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes){
  const d = [];
  for(const x of bytes){let c=x;for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0}while(c){d.push(c%58);c=(c/58)|0}}
  let s=''; for(const x of bytes){if(x)break;s+='1'}
  for(let j=d.length-1;j>=0;j--)s+=B58[d[j]];
  return s;
}
function unb58(str){
  const b = [];
  for(const ch of str){let c=B58.indexOf(ch);if(c<0)return null;for(let j=0;j<b.length;j++){c+=b[j]*58;b[j]=c&255;c>>=8}while(c){b.push(c&255);c>>=8}}
  for(const ch of str){if(ch!=='1')break;b.push(0)}
  return Uint8Array.from(b.reverse());
}

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
    this.once = {};                    // topic -> {done, eose} (letture singole dei link brevi)
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
    if(m[0] === 'EOSE'){
      // tutti i relay hanno risposto e nessuno ha l'invito: inutile aspettare oltre
      const o = Object.entries(this.once).find(([t]) => m[1] === 'cc-' + t.slice(0, 12));
      if(o && ++o[1].eose >= this.relays.length) setTimeout(() => o[1].done(null), 500);
      return;
    }
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
    if(this.once[tag[1]]){ this.once[tag[1]].done(op); return }
    g.since = Math.max(g.since || 0, ev.created_at);
    this.onOp(g.id, op, ev.pubkey, ev.created_at);
  }
  // legge una sola volta un argomento: il primo contenuto valido, oppure null se non arriva entro ms
  fetchOnce(key, topic, ms){
    return new Promise(res => {
      let tm;
      const done = v => { if(!this.once[topic]) return; clearTimeout(tm); delete this.once[topic]; this.unwatch(topic); res(v) };
      this.once[topic] = {done, eose: 0};
      tm = setTimeout(() => done(null), ms || 15000);
      this.watch('once:' + topic, key, topic, 0);
      this.start();
    });
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
  // formato compatto: chiave pubblica (32 byte) + nome, in base58 (niente «_» o «-» che le chat rovinano)
  return appBase() + '#c=' + b58(concat(unhex(pk), utf8Cut(name, 24)));
}
function parseContact(text){
  text = String(text || '');
  let m = text.match(/(?:^|[#\s?&])c=([1-9A-HJ-NP-Za-km-z]{40,})/);
  if(m){
    const b = unb58(m[1]);
    if(b && b.length >= 32) return {pk: hex(b.subarray(0, 32)), name: dec.decode(b.subarray(32)).slice(0, 24)};
    return null;
  }
  m = text.match(/add=([A-Za-z0-9_-]+)/);   // vecchio formato
  if(!m) return null;
  try{
    const o = JSON.parse(dec.decode(unb64url(m[1])));
    if(o && o.v === 1 && /^[0-9a-f]{64}$/.test(o.p)) return {pk: o.p, name: String(o.n || '').slice(0, 24)};
  }catch(e){}
  return null;
}

/* ---------- inviti ---------- */
const APP_URL = 'https://kekkoermalizia.github.io/Conti-Chiari/';
function appBase(){
  return /^https?:/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname) ? location.origin + location.pathname : APP_URL;
}
// formato compatto: [lunghezza id][id][chiave 32 byte][1 = c'è il proprietario][proprietario 32 byte][nome], in base58
function inviteLink(group){
  const id = enc.encode(group.id).subarray(0, 40), owner = group.sync.owner;
  const parts = [Uint8Array.of(id.length), id, unb64url(group.sync.key), Uint8Array.of(owner ? 1 : 0)];
  if(owner) parts.push(unhex(owner));
  parts.push(utf8Cut(group.name, 24));
  return appBase() + '#g=' + b58(concat(...parts));
}
function parseInvite(text){
  text = String(text || '');
  let m = text.match(/(?:^|[#\s?&])g=([1-9A-HJ-NP-Za-km-z]{40,})/);
  if(m){
    const b = unb58(m[1]);
    if(!b || !b.length) return null;
    let i = 0;
    const idLen = b[i++]; if(!idLen || b.length < 1 + idLen + 33) return null;
    const id = dec.decode(b.subarray(i, i += idLen)), key = b64url(b.subarray(i, i += 32));
    let owner = '';
    if(b[i++] === 1){ if(b.length < i + 32) return null; owner = hex(b.subarray(i, i += 32)) }
    return {id: id.slice(0, 40), name: dec.decode(b.subarray(i)).slice(0, 40), key, owner};
  }
  m = text.match(/join=([A-Za-z0-9_-]+)/);   // vecchio formato
  if(!m) return null;
  try{
    const o = JSON.parse(dec.decode(unb64url(m[1])));
    if(o && o.v === 2 && typeof o.id === 'string' && typeof o.k === 'string' && unb64url(o.k).length === 32) return {id: o.id.slice(0, 40), name: String(o.n || '').slice(0, 40), key: o.k, owner: /^[0-9a-f]{64}$/.test(o.o || '') ? o.o : ''};
  }catch(e){}
  return null;
}

/* ---------- link brevi ---------- */
// Il link condiviso contiene solo un codice di 8 caratteri (…/Conti-Chiari/#Ab3dEf7h). Il link completo (con la chiave
// del gruppo) è salvato sui relay, cifrato con una chiave ricavata dal codice. La derivazione PBKDF2 è lenta di proposito:
// chi copia tutti gli eventi da un relay non può provare a indovinare i codici.
const SHORT_LEN = 8, SHORT_DAYS = 60;
const SHORT_RE = /^[1-9A-HJ-NP-Za-km-z]{8}$/;
function newShortCode(){
  let s = '';
  while(s.length < SHORT_LEN) for(const x of crypto.getRandomValues(new Uint8Array(16))) if(x < 232 && s.length < SHORT_LEN) s += B58[x % 58];
  return s;
}
const shortCache = {};
function shortKeys(code){
  if(!shortCache[code]) shortCache[code] = (async () => {
    const base = await subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('conti-chiari/short-link'), iterations: 200000}, base, 384));
    return {key: b64url(bits.subarray(0, 32)), topic: hex(bits.subarray(32, 48))};
  })();
  return shortCache[code];
}
function shortLink(code){return appBase() + '#' + code}
function parseShort(text){
  text = String(text || '').trim();
  const m = text.match(/^#?([1-9A-HJ-NP-Za-km-z]{8})$/) || text.match(/#([1-9A-HJ-NP-Za-km-z]{8})(?![A-Za-z0-9_=-])/);
  return m && SHORT_RE.test(m[1]) ? m[1] : '';
}
async function publishShort(hub, code, link){
  const {key, topic} = await shortKeys(code), ts = Date.now();
  return hub.publish(key, topic, {t: 'link', ts, exp: ts + SHORT_DAYS * 864e5, l: link});
}
async function resolveShort(hub, code){
  const {key, topic} = await shortKeys(code);
  const op = await hub.fetchOnce(key, topic, 15000);
  return op && op.t === 'link' && typeof op.l === 'string' ? op.l : null;
}

window.CCSync = {newShortCode, shortLink, parseShort, publishShort, resolveShort, Hub, deviceKeys, newGroupKey, topicOf, seal, open, makeEvent, checkEvent, inviteLink, parseInvite, dmChannel, inboxTopic, contactLink, parseContact, rid, KIND, DEFAULT_RELAYS};
})();
