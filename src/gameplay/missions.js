// ---------------------------------------------------------------------------
// MissionManager — sequential mission chain + free roam.
// Gameplay module: reads game state, writes UI through injected ui handle.
// ---------------------------------------------------------------------------

export class MissionManager {
  constructor(ui) {
    this.ui = ui;
    this.index = 1;
    this.speedTimer = 0;
    this.rangeBase = 0;   // targets already hit when M4 started
    this.reset();
  }

  reset() {
    this.index = 1;
    this.speedTimer = 0;
    this.rangeBase = 0;
    this.ui.setMission(1, 'Welcome to Velara', 'Collect the glowing ₹ packages — gold dots on the map', '0 / 5');
  }

  _complete(game, reward, nextIdx, nextTitle, nextDesc, nextProg) {
    game.addMoney(reward);
    this.ui.toast(`✅ MISSION COMPLETE &nbsp; +₹${reward.toLocaleString('en-IN')}`, true, 3600);
    game.audio.blip();
    this.index = nextIdx || 5;
    if (nextIdx) this.ui.setMission(nextIdx, nextTitle, nextDesc, nextProg);
  }

  update(game) {
    if (this.index === 1) {
      this.ui.setMission(1, 'Welcome to Velara', 'Collect the glowing ₹ packages — gold dots on the map',
        `${game.pickupsCollected} / 5`);
      if (game.pickupsCollected >= 5) {
        this._complete(game, 2500, 2, 'Test Driver', 'Get in a car and hit 110 km/h!', '0 km/h');
      }
    } else if (this.index === 2) {
      const kmh = game.mode === 'car' ? game.car.getSpeedKmh() : 0;
      if (kmh > 110) this.speedTimer += 1 / 60;
      else this.speedTimer = Math.max(0, this.speedTimer - 1 / 30);
      this.ui.setMission(2, 'Test Driver', 'Hold 110 km/h in a car!', `${Math.round(kmh)} km/h`);
      if (this.speedTimer > 1.2) {
        this._complete(game, 5000, 3, 'Havoc', 'Smash 8 crates at the stunt plaza (East side)',
          `${game.cratesDestroyed} / 8`);
      }
    } else if (this.index === 3) {
      this.ui.setMission(3, 'Havoc', 'Smash 8 crates at the stunt plaza!', `${game.cratesDestroyed} / 8`);
      if (game.cratesDestroyed >= 8) {
        this.rangeBase = game.rangeHits;
        this._complete(game, 7500, 4, 'Range Ready',
          'Drop 6 targets at the shooting range (red dots, East) — RMB aim, LMB fire', '0 / 6');
      }
    } else if (this.index === 4) {
      const done = Math.min(6, game.rangeHits - this.rangeBase);
      this.ui.setMission(4, 'Range Ready', 'Drop 6 targets at the range — RMB to aim, LMB to fire',
        `${done} / 6`);
      if (done >= 6) {
        this._complete(game, 10000, 0, 'Free Roam',
          'The city is yours — guns, 4 rides, pure freedom...', '');
        this.index = 5;
      }
    }
  }
}
