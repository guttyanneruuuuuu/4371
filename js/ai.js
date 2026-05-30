// =============================================================
// ai.js - AI対戦相手 (A* でゴールへ向かう / 難易度調整)
// =============================================================
import { astar } from './maze.js';
import { TILE } from './renderer.js';

export const DIFFICULTY = {
  easy:   { speed: 3.6, recalc: 1.2, wander: 0.30, label: 'EASY' },
  normal: { speed: 5.0, recalc: 0.8, wander: 0.12, label: 'NORMAL' },
  hard:   { speed: 6.4, recalc: 0.5, wander: 0.04, label: 'HARD' },
  insane: { speed: 7.6, recalc: 0.3, wander: 0.0,  label: 'INSANE' },
};

export class AIRacer {
  constructor(maze, startCell, goalCell, difficulty = 'normal') {
    this.maze = maze;
    this.goalCell = goalCell;
    this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.x = (startCell[0] + 0.5) * TILE;
    this.z = (startCell[1] + 0.5) * TILE;
    this.path = [];
    this.pathIdx = 0;
    this._recalcTimer = 0;
    this.finished = false;
    this._recalc();
  }

  get gridX() { return Math.floor(this.x / TILE); }
  get gridY() { return Math.floor(this.z / TILE); }

  _recalc() {
    const start = [this.gridX, this.gridY];
    let goal = this.goalCell;
    // wander: たまにわざと間違った中継点を経由（難易度演出）
    if (Math.random() < this.cfg.wander) {
      // ランダムな通路セルへ寄り道
      const { gw, gh, grid } = this.maze;
      for (let tries = 0; tries < 20; tries++) {
        const rx = 1 + Math.floor(Math.random() * (gw - 2));
        const ry = 1 + Math.floor(Math.random() * (gh - 2));
        if (grid[ry][rx] === 0) { goal = [rx, ry]; break; }
      }
    }
    const p = astar(this.maze, start, goal);
    if (p.length > 1) {
      this.path = p;
      this.pathIdx = 1;
    }
  }

  update(dt) {
    if (this.finished) return;
    this._recalcTimer -= dt;
    if (this._recalcTimer <= 0) {
      // 本来のゴールへ向け定期的に再計算
      const start = [this.gridX, this.gridY];
      const p = astar(this.maze, start, this.goalCell);
      if (p.length > 1) { this.path = p; this.pathIdx = 1; }
      this._recalcTimer = this.cfg.recalc;
    }

    if (this.pathIdx >= this.path.length) {
      this._recalc();
      return;
    }

    const target = this.path[this.pathIdx];
    const tx = (target[0] + 0.5) * TILE;
    const tz = (target[1] + 0.5) * TILE;
    let dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    const step = this.cfg.speed * dt;
    if (d <= step) {
      this.x = tx; this.z = tz;
      this.pathIdx++;
    } else {
      this.x += (dx / d) * step;
      this.z += (dz / d) * step;
    }

    // ゴール到達判定
    if (this.gridX === this.goalCell[0] && this.gridY === this.goalCell[1]) {
      this.finished = true;
    }
  }

  /** ゴールまでの残りセル数（HUD進捗用） */
  remainingToGoal() {
    const p = astar(this.maze, [this.gridX, this.gridY], this.goalCell);
    return Math.max(0, p.length - 1);
  }
}
