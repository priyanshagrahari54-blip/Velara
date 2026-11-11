// ---------------------------------------------------------------------------
// InputManager — keyboard, mouse (pointer-lock OR drag), touch-look.
// Emits actions ('enterCar', 'timeCycle', ...) to the game; exposes .keys.
// Engine module: no gameplay decisions here, only input capture.
// ---------------------------------------------------------------------------

export class InputManager {
  constructor({ canvas, isTouch, isPlaying, getStick, onAction, onLook, onZoom }) {
    this.canvas = canvas;
    this.isTouch = isTouch;
    this.keys = {};
    this.plFailed = false;

    const ACTION_MAP = {
      KeyE: 'enterCar',
      KeyN: 'timeCycle',
      KeyR: 'reloadOrRain', // foot: reload | car: rain toggle
      KeyC: 'camDist',
      KeyM: 'musicToggle',
      KeyT: 'recoverCar',
      KeyK: 'qualityCycle',
      F3: 'debugToggle',
      Digit1: 'weapon1',
      Digit2: 'weapon2',
      Digit3: 'weapon3',
      KeyQ: 'weaponCycle',
      Escape: 'pause',
      KeyP: 'pause',
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'F3') e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (ACTION_MAP[e.code]) {
        if (!isPlaying() && ACTION_MAP[e.code] !== 'pause') return;
        onAction(ACTION_MAP[e.code]);
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });

    // ---------------- pointer lock (desktop) ----------------
    const tryLock = () => {
      if (!isPlaying() || this.isTouch || this.plFailed) return;
      try {
        const p = this.canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => { this.plFailed = true; });
      } catch (err) { this.plFailed = true; }
    };
    this.tryLock = tryLock;
    canvas.addEventListener('click', tryLock);
    document.addEventListener('pointerlockerror', () => { this.plFailed = true; });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (!locked && isPlaying() && !this.isTouch && !this.plFailed) onAction('pause');
    });

    // ---------------- mouse look + fire/aim buttons ----------------
    this.mouse = { fire: false, aim: false };
    this._mouseDown = false;
    window.addEventListener('mousemove', (e) => {
      if (!isPlaying()) return;
      const locked = document.pointerLockElement === this.canvas;
      if (locked || (this._mouseDown && !this.mouse.aim)) onLook(e.movementX || 0, e.movementY || 0);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!isPlaying()) return;
      if (e.button === 0) {
        this._mouseDown = true;
        const locked = document.pointerLockElement === this.canvas;
        if (locked || this.mouse.aim) this.mouse.fire = true; // fire only when aimed/locked
      } else if (e.button === 2) {
        this.mouse.aim = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this._mouseDown = false; this.mouse.fire = false; }
      if (e.button === 2) this.mouse.aim = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => { this.mouse.fire = false; this.mouse.aim = false; });
    window.addEventListener('wheel', (e) => {
      if (!isPlaying()) return;
      onZoom(Math.sign(e.deltaY));
    }, { passive: true });

    // ---------------- touch look (right half of screen) ----------------
    let lookId = null, lx = 0, ly = 0;
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth * 0.42 && lookId === null) {
          lookId = t.identifier; lx = t.clientX; ly = t.clientY;
        }
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookId) {
          onLook((t.clientX - lx) * 1.6, (t.clientY - ly) * 1.6);
          lx = t.clientX; ly = t.clientY;
        }
      }
    }, { passive: true });
    const tEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
    };
    canvas.addEventListener('touchend', tEnd);
    canvas.addEventListener('touchcancel', tEnd);
  }

  isDown(code) { return !!this.keys[code]; }

  /** Combined foot input: keys + virtual stick. */
  footInput() {
    const k = this.keys;
    const stick = this.getStickValue();
    return {
      x: ((k.KeyD || k.ArrowRight) ? 1 : 0) - ((k.KeyA || k.ArrowLeft) ? 1 : 0) + stick.x,
      z: ((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 1 : 0) - stick.y,
      sprint: !!(k.ShiftLeft || k.ShiftRight),
      jump: !!k.Space,
    };
  }

  /** Combined drive input: keys + virtual stick. */
  driveInput(touchAction) {
    const k = this.keys;
    const stick = this.getStickValue();
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    return {
      throttle: clamp(((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 1 : 0) - stick.y),
      steer: clamp(((k.KeyA || k.ArrowLeft) ? 1 : 0) - ((k.KeyD || k.ArrowRight) ? 1 : 0) + stick.x),
      handbrake: !!(k.Space || touchAction),
    };
  }

  getStickValue() { return this._getStick ? this._getStick() : { x: 0, y: 0 }; }
  bindStick(getter) { this._getStick = getter; }
}
