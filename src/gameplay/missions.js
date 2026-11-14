// ---------------------------------------------------------------------------
// MissionManager v2 (v0.10.0) — "CITY OF SHADOWS" story arc.
// 10-mission campaign: tutorial (M1-4) → Vikram fixer jobs (M5-9) →
// Raja showdown (M10) → free roam. Har mission complete hone par phone
// call se agla mission milta hai (GTA-style).
// Types: pickups / speed / smash / range / goto / timed-run / kill /
//        deliver-damage / wanted-survive.
// ---------------------------------------------------------------------------

const REACH_R = 6.5;      // marker reach radius (m)
const TIMER_FAIL = 45;    // M6 cash-run seconds

export class MissionManager {
  constructor(ui) {
    this.ui = ui;
    this.reset();
  }

  reset() {
    this.index = 1;
    this.speedTimer = 0;
    this.rangeBase = 0;
    this.killBase = -1;
    this.killBase2 = -1;
    this.subPhase = 0;      // multi-phase missions
    this.phaseT = 0;
    this._lastProg = '';
    this._marker = null;    // {x, z} — game isse beacon banata hai
    this.ui.setMission(1, 'Welcome to Velara', 'Collect the glowing ₹ packages — gold dots on the map', '0 / 5');
  }

  _markerAt(game, x, z) {
    this._marker = { x, z };
    game.setMissionMarker && game.setMissionMarker(x, z);
  }

  _clearMarker(game) {
    this._marker = null;
    game.clearMissionMarker && game.clearMissionMarker();
  }

  _complete(game, reward, nextIdx, nextTitle, nextDesc, nextProg, callKey) {
    game.addMoney(reward);
    this._clearMarker(game);
    this.subPhase = 0;
    this.phaseT = 0;
    if (callKey && game.calls) {
      // v0.10.0: busy phone? story call queue — finale kabhi miss nahi hogi
      if (game.calls.state === 'idle') game.calls.call(callKey);
      else game.calls.queue(callKey);
    } else {
      game.calls && game.calls.onMissionComplete();
    }
    this.ui.toast(`✅ MISSION COMPLETE &nbsp; +₹${reward.toLocaleString('en-IN')}`, true, 3600);
    game.audio.blip();
    this.index = nextIdx || 11;
    if (nextIdx) this.ui.setMission(nextIdx, nextTitle, nextDesc, nextProg);
    else this.ui.setMission(0, 'FREE ROAM', 'Sheher tera hai — guns, gaadiyan, gang war, pure freedom', '');
  }

  _pos(game) {
    return game.mode === 'car'
      ? game.activeVehicle.body.position
      : game.player.position;
  }

  _dist(game, x, z) {
    const p = this._pos(game);
    return Math.hypot(p.x - x, p.z - z);
  }

  update(game) {
    switch (this.index) {

      // ======================= TUTORIAL (M1-4) =======================
      case 1: {
        this.ui.setMission(1, 'Welcome to Velara', 'Collect the glowing ₹ packages — gold dots on the map',
          `${game.pickupsCollected} / 5`);
        if (game.pickupsCollected >= 5) {
          this._complete(game, 2500, 2, 'Test Driver', 'Get in a car and hit 110 km/h!', '0 km/h');
        }
        break;
      }
      case 2: {
        const kmh = game.mode === 'car' ? game.car.getSpeedKmh() : 0;
        if (kmh > 110) this.speedTimer += 1 / 60;
        else this.speedTimer = Math.max(0, this.speedTimer - 1 / 30);
        this.ui.setMission(2, 'Test Driver', 'Hold 110 km/h in a car!', `${Math.round(kmh)} km/h`);
        if (this.speedTimer > 1.2) {
          this._complete(game, 5000, 3, 'Havoc', 'Smash 8 crates at the stunt plaza (East side)',
            `${game.cratesDestroyed} / 8`);
        }
        break;
      }
      case 3: {
        this.ui.setMission(3, 'Havoc', 'Smash 8 crates at the stunt plaza!', `${game.cratesDestroyed} / 8`);
        if (game.cratesDestroyed >= 8) {
          this.rangeBase = game.rangeHits;
          this._complete(game, 7500, 4, 'Range Ready',
            'Drop 6 targets at the shooting range (red dots, East) — RMB aim, LMB fire', '0 / 6');
        }
        break;
      }
      case 4: {
        const done = Math.min(6, game.rangeHits - this.rangeBase);
        this.ui.setMission(4, 'Range Ready', 'Drop 6 targets at the range — RMB to aim, LMB to fire',
          `${done} / 6`);
        if (done >= 6) {
          this._complete(game, 10000, 5, 'The Meet',
            'Vikram bulaa raha hai — uske drop point par jao (map pe marker)', '',
            'm5intro');
        }
        break;
      }

      // ======================= STORY: VIKRAM JOBS =======================
      case 5: {  // THE MEET — goto marker
        if (!this._marker) this._markerAt(game, -108, -64);
        this.ui.setMission(5, 'The Meet', 'Vikram ka drop point (gold marker) — jao',
          `${Math.round(this._dist(game, -108, -64))} m`);
        if (this._dist(game, -108, -64) < REACH_R) {
          this._complete(game, 12000, 6, 'Cash Run',
            'Package uthao (marker) aur 45 sec mein drop par wapas lao!', '', 'm6intro');
        }
        break;
      }
      case 6: {  // CASH RUN — timed collect + deliver
        if (!this._marker) this._markerAt(game, 62, -118);
        const d = this._dist(game, 62, -118);
        if (this.subPhase === 0) {
          this.ui.setMission(6, 'Cash Run', 'Package marker par hai — uthao!', `${Math.round(d)} m`);
          if (d < REACH_R) {
            this.subPhase = 1;
            this.phaseT = TIMER_FAIL;
            this._markerAt(game, -108, -64);   // wapas Vikram drop
            game.ui.toast('📦 Package mila — ab drop par bhaago!', true, 2600);
            game.audio.sfx && game.audio.sfx('pickup', 0.9);
          }
        } else {
          this.phaseT -= 1 / 60;
          const d2 = this._dist(game, -108, -64);
          this.ui.setMission(6, 'Cash Run', 'DROP PAR JAO — timer khatam se pehle!',
            `${Math.ceil(this.phaseT)}s · ${Math.round(d2)} m`);
          if (this.phaseT <= 0) {
            this.ui.toast('❌ Time up — package kho gaya. Dobara try!', false, 3200);
            this.subPhase = 0;
            this._markerAt(game, 62, -118);
            break;
          }
          if (d2 < REACH_R) {
            this._complete(game, 18000, 7, 'Market Message',
              'Raja ke 3 thugs ko Old Market mein niche karo (red dots)', '0 / 3', 'm7intro');
          }
        }
        break;
      }
      case 7: {  // MARKET MESSAGE — kill 3 thugs
        if (!this._marker) this._markerAt(game, -120, -120);
        if (this.killBase < 0) this.killBase = game.gang.kills;   // mission-start snapshot
        const kills = game.gang.kills - this.killBase;
        this.ui.setMission(7, 'Market Message', 'Raja ke thugs (red dots, Old Market) — 3 kaamo',
          `${Math.min(3, kills)} / 3`);
        if (kills >= 3) {
          this._complete(game, 24000, 8, 'Hot Wheels',
            'Gaadi lekar garage marker par pahoncho — DAMAGE 45% se kam!', '', 'm8intro');
        }
        break;
      }
      case 8: {  // HOT WHEELS — deliver with low damage
        if (!this._marker) this._markerAt(game, 24, 14);
        const d = this._dist(game, 24, 14);
        const dmg = game.mode === 'car' ? game.activeVehicle.damage : 100;
        this.ui.setMission(8, 'Hot Wheels', 'Garage (marker) — GAADI MEIN, damage < 45%',
          `${Math.round(d)} m · dmg ${Math.round(dmg)}%`);
        if (d < REACH_R) {
          if (game.mode === 'car' && dmg < 45) {
            this._complete(game, 30000, 9, 'Heat',
              'Police ka dhyaan khincho: 2-star wanted lo, 45s BACHO, phir PAAR lagao', '', 'm9intro');
          } else if (game.mode !== 'car') {
            game.ui.toast('🚗 Gaadi mein baitho pehle!', false, 2200);
          } else {
            game.ui.toast('❌ Damage zyada hai — mechanic ne thoda repair kiya, dobara try!', false, 3000);
            game.activeVehicle.damage = Math.max(0, game.activeVehicle.damage - 30);
          }
        }
        break;
      }
      case 9: {  // HEAT — wanted survive + evade
        const w = game.police.wanted;
        if (this.subPhase === 0) {
          this.ui.setMission(9, 'Heat', 'Police garam karo — 2 STAR chahiye (crime karo)',
            `★ ${'★'.repeat(w)}${'☆'.repeat(Math.max(0, 2 - w))}`);
          if (w >= 2) { this.subPhase = 1; this.phaseT = 45; }
        } else if (this.subPhase === 1) {
          this.phaseT -= 1 / 60;
          this.ui.setMission(9, 'Heat', 'BACHO — 2-star se kam na ho!',
            `${Math.max(0, Math.ceil(this.phaseT))}s · ${'★'.repeat(w)}`);
          if (w < 2) { this.subPhase = 0; game.ui.toast('Stars gir gaye — phir se garam karo!', false, 2600); }
          else if (this.phaseT <= 0) this.subPhase = 2;
        } else {
          this.ui.setMission(9, 'Heat', 'AB PAAR LAGAO — police ko chhodo (wanted 0)',
            `${'★'.repeat(w)} — chhup jao door`);
          if (w === 0) {
            this._complete(game, 40000, 10, 'The Reckoning',
              'Raja ka aakhri squad Old Market mein — 6 thugs NEECHE. Finish this.', '0 / 6', 'm10intro');
          }
        }
        break;
      }
      case 10: { // THE RECKONING — kill 6 (finale)
        if (!this._marker) this._markerAt(game, -120, -120);
        if (this.killBase2 < 0) this.killBase2 = game.gang.kills;   // mission-start snapshot
        const kills = game.gang.kills - this.killBase2;
        this.ui.setMission(10, 'The Reckoning', 'Raja ka squad (Old Market) — 6 kaamo. FINISH.',
          `${Math.min(6, kills)} / 6`);
        if (kills >= 6) {
          this._complete(game, 75000, 0, '', '', '', 'm10done');
        }
        break;
      }

      default:  // 11+ = free roam
        break;
    }
  }
}
