// =============================================================
// game.js - ゲーム本体 (状態管理 / ループ / モード)
// =============================================================
import { generateMaze, farthestCell, makeRng } from './maze.js';
import { MazeRenderer, TILE } from './renderer.js';
import { Player } from './player.js';
import { AIRacer, DIFFICULTY } from './ai.js';
import { Minimap } from './minimap.js';

export const MODE = { SOLO: 'solo', AI: 'ai', VERSUS: 'versus' };

export class Game {
  constructor(refs) {
    this.refs = refs; // DOM参照群
    this.renderer = new MazeRenderer(refs.canvas);
    this.minimap = new Minimap(refs.minimap);
    this.running = false;
    this.input = { forward: 0, strafe: 0, turn: 0 };
    this._last = 0;
    this._raf = null;

    this.mode = MODE.SOLO;
    this.difficulty = 'normal';
    this.size = 8; // 論理セル数

    // VERSUS（ローカル交互対戦）用
    this.versus = null;

    this._loop = this._loop.bind(this);
    window.addEventListener('resize', () => {
      this.renderer.handleResize();
    });
  }

  // ---------- セットアップ ----------
  newGame({ mode, difficulty, size, seed }) {
    this.mode = mode;
    this.difficulty = difficulty || this.difficulty;
    this.size = size || this.size;
    this.seed = seed ?? (Math.floor(Math.random() * 1e9));

    const rng = makeRng(this.seed);
    this.maze = generateMaze(this.size, this.size, rng);

    // スタート左上, ゴールは最遠セル
    this.startCell = [1, 1];
    const far = farthestCell(this.maze, this.startCell);
    this.goalCell = far.cell;
    this.optimalLen = far.dist;

    this.renderer.buildMaze(this.maze, this.goalCell);
    this.minimap.setMaze(this.maze);

    this.player = new Player(this.maze, this.startCell);
    // スタート方向を通路の方へ向ける
    this.player.yaw = 0;

    this.startTime = performance.now();
    this.finished = false;
    this.result = null;
    this.steps = 0;

    // モード別初期化
    this.renderer.removeOpponent();
    this.ai = null;
    this.versus = null;

    if (mode === MODE.AI) {
      this.ai = new AIRacer(this.maze, this.startCell, this.goalCell, this.difficulty);
      this.renderer.ensureOpponent(0xff5577);
    } else if (mode === MODE.VERSUS) {
      this.versus = {
        turn: 1,        // 現在プレイ中のプレイヤー番号
        times: [null, null], // [p1, p2]
        recording: true,
      };
    }

    this._startLoop();
    this._emitHud();
  }

  /** VERSUS: 次のプレイヤーへ（プレイヤー位置リセット、同じ迷路） */
  versusNextPlayer() {
    if (!this.versus) return;
    this.player = new Player(this.maze, this.startCell);
    this.player.yaw = 0;
    this.minimap.setMaze(this.maze); // フォグもリセット
    this.startTime = performance.now();
    this.finished = false;
    this.steps = 0;
    this._startLoop();
    this._emitHud();
  }

  // ---------- ループ ----------
  _startLoop() {
    this.running = true;
    if (!this._raf) {
      this._last = performance.now();
      this._raf = requestAnimationFrame(this._loop);
    }
  }
  pause() { this.running = false; }
  resume() { if (!this.running) { this.running = true; this._last = performance.now(); } }
  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _loop(now) {
    this._raf = requestAnimationFrame(this._loop);
    let dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > 0.05) dt = 0.05; // スパイク抑制
    if (!this.running) { this.renderer.render(); return; }

    this.player.update(this.input, dt);

    // 探索 reveal
    this.minimap.reveal(this.player.gridX, this.player.gridY, 2);

    // カメラ
    this.renderer.updateCamera(this.player.x, this.player.z, this.player.yaw, this.player.bob);
    this.renderer.tick(now);

    // AI更新
    if (this.mode === MODE.AI && this.ai) {
      this.ai.update(dt);
      // 視界内なら表示
      this.renderer.setOpponentWorld(this.ai.x, this.ai.z, true);
      if (this.ai.finished && !this.finished) {
        this._finish(false); // AIが先にゴール = 敗北
      }
    }

    // ゴール判定（プレイヤー）
    if (!this.finished && this.player.gridX === this.goalCell[0] && this.player.gridY === this.goalCell[1]) {
      this._finish(true);
    }

    // ミニマップ
    this.minimap.draw(this.player, this.goalCell,
      this.mode === MODE.AI ? this.ai : null);

    this.renderer.render();
    this._emitHud();
  }

  _finish(playerReachedGoal) {
    this.finished = true;
    const elapsed = (performance.now() - this.startTime) / 1000;

    if (this.mode === MODE.VERSUS) {
      const v = this.versus;
      v.times[v.turn - 1] = elapsed;
      if (v.turn === 1) {
        // プレイヤー2の番へ
        this.result = { type: 'versus-mid', p1: elapsed };
        this.pause();
        this.refs.onVersusMid?.(elapsed);
      } else {
        // 両者終了 → 勝敗
        const [t1, t2] = v.times;
        const winner = t1 < t2 ? 1 : (t2 < t1 ? 2 : 0);
        this.result = { type: 'versus-end', t1, t2, winner };
        this.pause();
        this.refs.onFinish?.(this.result);
      }
      return;
    }

    if (this.mode === MODE.AI) {
      const aiWon = !playerReachedGoal;
      this.result = {
        type: 'ai',
        time: elapsed,
        playerWon: playerReachedGoal,
        difficulty: this.difficulty,
      };
    } else {
      this.result = { type: 'solo', time: elapsed, optimal: this.optimalLen };
    }
    this.pause();
    this.refs.onFinish?.(this.result);
  }

  _emitHud() {
    if (!this.refs.onHud) return;
    const elapsed = (performance.now() - this.startTime) / 1000;
    let aiProgress = null;
    let playerProgress = null;
    this.refs.onHud({
      elapsed,
      mode: this.mode,
      versusTurn: this.versus?.turn,
      goalDist: this.player ? this.player.distanceToCell(this.goalCell) : 0,
    });
  }

  // ---------- 入力 ----------
  setInput(partial) { Object.assign(this.input, partial); }
  resetInput() { this.input.forward = 0; this.input.strafe = 0; this.input.turn = 0; }
}
