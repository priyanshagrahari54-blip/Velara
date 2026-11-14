// ---------------------------------------------------------------------------
// VELARA CALL SYSTEM (v0.9.0) — user demand: "phone me call bhi rhe gta jaise"
// Mission-giver calls + contacts + random flavor calls. Ringtone synth se,
// incoming banner + subtitles GTA-style. CallSystem game.update se chalta hai.
// ---------------------------------------------------------------------------

const RING_TIMEOUT = 12;      // sec — player ne nahi uthaya to miss
const LINE_TIME = 3.4;        // sec per subtitle line

const CONTACTS = [
  { id: 'vikram', name: 'Vikram — Fixer', color: '#c9a227' },
  { id: 'raja', name: 'Raja — Gang Boss', color: '#b03030' },
  { id: 'mom', name: 'Mom', color: '#3f9d6a' },
  { id: 'unknown', name: 'Unknown', color: '#6a7280' },
];

const LINES = {
  intro: {
    contact: 'vikram',
    lines: [
      'VIKRAM: Badhai ho, kid. Sheher mein aane ke liye.',
      'VIKRAM: Do hi naam yahan bante hain — tera, aur jo kabhi nahi ban paya.',
      'VIKRAM: Purane market mein Raja ke thugs ghus gaye hain. Paise lekar bhaagne ki bimari hai.',
      'VIKRAM: Ungli mat karna — sirf trigger. Cash tera. Phone side mein rakh.',
    ],
  },
  missionDone: {
    contact: 'vikram',
    lines: [
      'VIKRAM: Sun raha hoon. Kaam ke paise account mein.',
      'VIKRAM: Raja ki neend halki ho rahi hai — matlab hum sahi raste par hain.',
      'VIKRAM: Agle kaam ka intezaar kar. Phone jeb mein rakh.',
    ],
  },
  thugKilled: {
    contact: 'raja',
    lines: [
      'RAJA: Sun le — jo aaj market mein gira, wo mera aadmi tha.',
      'RAJA: Aakhri warning. Agle baar goli bolegi, baat nahi.',
    ],
  },
  mom: {
    contact: 'mom',
    lines: [
      'MOM: Beta, khana kha liya? Wahan dhandha kaisa chal raha hai?',
      'MOM: Sona mat bhoolna. Aur police se door rehna!',
    ],
  },
  m5intro: {
    contact: 'vikram',
    lines: [
      'VIKRAM: Range clear, crates todne ki bimari bhi hai... pasand aaya.',
      'VIKRAM: Asli kaam shuru karte hain. Old Street ka mera drop point hai — marker dekho map pe.',
      'VIKRAM: Aa jao, ladke. Cash wahin milta hai.',
    ],
  },
  m6intro: {
    contact: 'vikram',
    lines: [
      'VIKRAM: Ek package uthana hai — sona nahi hai, CASH.',
      'VIKRAM: Raja ke log bhi uske peeche hain. 45 second hain tumhare paas. Marker follow karo.',
    ],
  },
  m7intro: {
    contact: 'vikram',
    lines: [
      'VIKRAM: Package safe. Par Raja ne mera ek aadmi maar diya is baarish mein.',
      'VIKRAM: Old Market mein uske 3 thugs khade hain. Message pahunchao — 3 body. Samjhe?',
    ],
  },
  m8intro: {
    contact: 'vikram',
    lines: [
      'VIKRAM: Wahi gaadi jo tumne uchali hai — usme Vikram ka maal hai.',
      'VIKRAM: Garage tak pahoncho. Gaadi KEVAL tab dega jab damage 45 se neeche hoga. SAMBHAL KE.',
    ],
  },
  m9intro: {
    contact: 'vikram',
    lines: [
      'VIKRAM: Raja gussa hai, police tumhare peeche. Achha hai — ab dono ek saath.',
      'VIKRAM: 2 star chahiye mujhe — police ka dhyaan Raja se hatao. 45 second BACHO, phir paar lagao.',
      'VIKRAM: Zinda wapas aao. Mujhe murda customer se koi matlab nahi.',
    ],
  },
  m10intro: {
    contact: 'raja',
    lines: [
      'RAJA: Bahut ho gaya tamasha. Ab seedhi baat.',
      'RAJA: Old Market. Mere aakhri 6 aadmi. Aa jao agar jaan mein dum hai.',
      'VIKRAM (background): Ye tera din hai, kid. FINISH HIM.',
    ],
  },
  m10done: {
    contact: 'vikram',
    lines: [
      'VIKRAM: ...chup hai poora market. Raja ka raaj khatam.',
      'VIKRAM: Sheher mein ab ek hi naam gunguna jayega.',
      'VIKRAM: Velara tera hai. Call rakhta hoon, kaam kabhi khatam nahi hote.',
    ],
  },
  wrong: {
    contact: 'unknown',
    lines: [
      '???: Haan bolo, kahan pahunchna hai?',
      '???: ...galat number. Phir mat banana.',
    ],
  },
};

export class CallSystem {
  constructor(game) {
    this.game = game;
    this.state = 'idle';       // idle | ringing | active | cooldown
    this.contact = null;
    this.lines = [];
    this.lineIdx = 0;
    this.lineT = 0;
    this.ringT = 0;
    this._introDone = false;
    this._flavorT = 75 + Math.random() * 60;   // pehla flavor call ~1.5-2.5 min
    this.callLog = [];
    this._queue = [];       // v0.10.0: busy waqt story calls yahan wait karti hain
  }

  /** v0.10.0 — story call busy aa gayi to queue (cap 8, FIFO). _end ke baad ring hogi. */
  queue(scriptKey) {
    if (!LINES[scriptKey]) return false;
    if (this._queue.length >= 8) this._queue.shift();
    this._queue.push(scriptKey);
    return true;
  }

  /** kisi bhi jagah se naya call trigger (queue nahi — agar busy ho to skip) */
  call(scriptKey, opts = {}) {
    if (this.state !== 'idle') return false;
    const sc = LINES[scriptKey];
    if (!sc) return false;
    this.contact = CONTACTS.find((c) => c.id === sc.contact) || CONTACTS[3];
    this.lines = sc.lines;
    this.lineIdx = 0;
    this.lineT = 0;
    this.ringT = RING_TIMEOUT;
    this.state = 'ringing';
    const ui = this.game.ui;
    ui.showIncomingCall(this.contact, {
      onAnswer: () => this.answer(),
      onDecline: () => this.decline(),
    });
    this.game.audio.startRing && this.game.audio.startRing();
    if (this.game.ui.haptic) this.game.ui.haptic([300, 150, 300]);
    return true;
  }

  answer() {
    if (this.state !== 'ringing') return;
    this.state = 'active';
    this.game.audio.stopRing && this.game.audio.stopRing();
    this.game.audio.sfx && this.game.audio.sfx('ui_click', 0.7);
    this.game.ui.showCallActive(this.contact);
  }

  decline() {
    if (this.state !== 'ringing') return;
    this._end('declined');
  }

  hangUp() {
    if (this.state !== 'active') return;
    this._end('hung up');
  }

  _end(why) {
    this.game.audio.stopRing && this.game.audio.stopRing();
    this.game.ui.hideCall();
    this.callLog.unshift({
      name: this.contact ? this.contact.name : '?',
      when: Math.floor(performance.now() / 1000),
      why,
    });
    this.callLog = this.callLog.slice(0, 8);
    this.state = 'idle';
    this.contact = null;
  }

  /** gang kill hook — Raja gussa */
  onThugKilled() {
    this._thugCalls = (this._thugCalls || 0) + 1;
    if (this._thugCalls === 1) this._pendingRaja = 20;   // pehle kill ke 20s baad
  }

  onMissionComplete() {
    this._pendingMission = 14;
  }

  contactsList() { return CONTACTS; }

  update(dt) {
    // v0.10.0: queued story call — idle hote hi ring
    if (this.state === 'idle' && this._queue.length) this.call(this._queue.shift());

    // scheduled triggers
    if (this._pendingRaja !== undefined && this._pendingRaja > 0) {
      this._pendingRaja -= dt;
      if (this._pendingRaja <= 0 && this.state === 'idle') { this.call('thugKilled'); this._pendingRaja = undefined; }
    }
    if (this._pendingMission !== undefined && this._pendingMission > 0) {
      this._pendingMission -= dt;
      if (this._pendingMission <= 0 && this.state === 'idle') { this.call('missionDone'); this._pendingMission = undefined; }
    }
    // intro call — game start ke 22s baad (ek baar)
    if (!this._introDone) {
      this._introT = (this._introT || 22) - dt;
      if (this._introT <= 0 && this.state === 'idle') { this._introDone = true; this.call('intro'); }
    }
    // flavor calls — 2.5-4 min random
    this._flavorT -= dt;
    if (this._flavorT <= 0) {
      this._flavorT = 150 + Math.random() * 90;
      if (this.state === 'idle') this.call(Math.random() < 0.5 ? 'mom' : 'wrong');
    }

    // ringing — timeout = missed call
    if (this.state === 'ringing') {
      this.ringT -= dt;
      if (this.ringT <= 0) this._end('missed');
    }

    // active — subtitles line by line
    if (this.state === 'active') {
      this.lineT += dt;
      const ui = this.game.ui;
      if (this.lineIdx < this.lines.length) {
        ui.showCallLine(this.lines[this.lineIdx], this.lineIdx, this.lines.length);
        if (this.lineT >= LINE_TIME) {
          this.lineT = 0;
          this.lineIdx++;
        }
      } else {
        this._end('done');
      }
    }
  }
}
