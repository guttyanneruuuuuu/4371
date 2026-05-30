// =============================================================
// controls.js - スマホ向け操作 (左ジョイスティック移動 / 右スワイプ視点)
// PCはWASD + マウスドラッグ + 矢印にも対応
// =============================================================

export class Controls {
  constructor(game, refs) {
    this.game = game;
    this.refs = refs;
    this._bindJoystick();
    this._bindLook();
    this._bindKeyboard();
  }

  // ----- 左下: 仮想ジョイスティック (移動 + 旋回) -----
  _bindJoystick() {
    const base = this.refs.joyBase;
    const knob = this.refs.joyKnob;
    let active = false, id = null;
    const radius = 55;

    const setKnob = (dx, dy) => {
      const d = Math.hypot(dx, dy);
      const cl = d > radius ? radius / d : 1;
      const kx = dx * cl, ky = dy * cl;
      knob.style.transform = `translate(${kx}px, ${ky}px)`;
      // 前後 = -y, 旋回 = x
      const fy = -ky / radius;   // 上で前進
      const fx = kx / radius;    // 右で右旋回
      this.game.setInput({ forward: fy, turn: fx });
    };

    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      active = true; id = t.identifier ?? 'mouse';
      base._cx = t.clientX; base._cy = t.clientY;
      e.preventDefault();
    };
    const move = (e) => {
      if (!active) return;
      const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];
      const t = touches.find(tt => (tt.identifier ?? 'mouse') === id);
      if (!t) return;
      setKnob(t.clientX - base._cx, t.clientY - base._cy);
      e.preventDefault();
    };
    const end = (e) => {
      const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];
      const t = touches.find(tt => (tt.identifier ?? 'mouse') === id);
      if (!t && e.changedTouches) return;
      active = false; id = null;
      knob.style.transform = 'translate(0,0)';
      this.game.setInput({ forward: 0, turn: 0 });
    };

    base.addEventListener('touchstart', start, { passive: false });
    base.addEventListener('touchmove', move, { passive: false });
    base.addEventListener('touchend', end);
    base.addEventListener('touchcancel', end);
    base.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }

  // ----- 右側: 画面スワイプで視点旋回 + 横移動微調整 -----
  _bindLook() {
    const area = this.refs.lookArea;
    let active = false, id = null, lastX = 0, lastY = 0;
    const SENS = 0.005;

    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      active = true; id = t.identifier ?? 'mouse';
      lastX = t.clientX; lastY = t.clientY;
    };
    const move = (e) => {
      if (!active) return;
      const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];
      const t = touches.find(tt => (tt.identifier ?? 'mouse') === id);
      if (!t) return;
      const dx = t.clientX - lastX;
      lastX = t.clientX; lastY = t.clientY;
      // スワイプ量で一瞬旋回（慣性なし、直接yaw操作）
      this.game.player.yaw -= dx * SENS;
      e.preventDefault();
    };
    const end = () => { active = false; id = null; };

    area.addEventListener('touchstart', start, { passive: false });
    area.addEventListener('touchmove', move, { passive: false });
    area.addEventListener('touchend', end);
    area.addEventListener('touchcancel', end);
    area.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }

  // ----- キーボード (PC) -----
  _bindKeyboard() {
    const keys = {};
    const apply = () => {
      let f = 0, s = 0, t = 0;
      if (keys['w'] || keys['arrowup']) f += 1;
      if (keys['s'] || keys['arrowdown']) f -= 1;
      if (keys['a']) s -= 1;
      if (keys['d']) s += 1;
      if (keys['arrowleft']) t -= 1;
      if (keys['arrowright']) t += 1;
      this.game.setInput({ forward: f, strafe: s, turn: t });
    };
    window.addEventListener('keydown', (e) => {
      keys[e.key.toLowerCase()] = true; apply();
    });
    window.addEventListener('keyup', (e) => {
      keys[e.key.toLowerCase()] = false; apply();
    });
  }
}
