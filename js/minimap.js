// =============================================================
// minimap.js - 2D俯瞰ミニマップ（探索済みのみ表示 = フォグ）
// =============================================================
import { CELL } from './maze.js';
import { TILE } from './renderer.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.explored = null;
  }

  setMaze(maze) {
    this.maze = maze;
    this.explored = Array.from({ length: maze.gh }, () => new Array(maze.gw).fill(false));
  }

  reveal(gx, gy, r = 2) {
    if (!this.explored) return;
    for (let y = gy - r; y <= gy + r; y++) {
      for (let x = gx - r; x <= gx + r; x++) {
        if (x >= 0 && y >= 0 && x < this.maze.gw && y < this.maze.gh) {
          this.explored[y][x] = true;
        }
      }
    }
  }

  draw(player, goalCell, opponent) {
    const { grid, gw, gh } = this.maze;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const cell = Math.min(W / gw, H / gh);
    const ox = (W - cell * gw) / 2;
    const oy = (H - cell * gh) / 2;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,10,16,0.6)';
    ctx.fillRect(0, 0, W, H);

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        if (!this.explored[y][x]) continue;
        if (grid[y][x] === CELL.PATH) {
          ctx.fillStyle = 'rgba(90,130,190,0.55)';
        } else {
          ctx.fillStyle = 'rgba(40,55,85,0.85)';
        }
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }

    // ゴール
    if (this.explored[goalCell[1]][goalCell[0]]) {
      ctx.fillStyle = '#00ffaa';
      ctx.beginPath();
      ctx.arc(ox + (goalCell[0] + 0.5) * cell, oy + (goalCell[1] + 0.5) * cell, cell * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 対戦相手（探索済みセルにいる時だけ）
    if (opponent) {
      const ogx = Math.floor(opponent.x / TILE);
      const ogy = Math.floor(opponent.z / TILE);
      if (this.explored[ogy]?.[ogx]) {
        ctx.fillStyle = '#ff5577';
        ctx.beginPath();
        ctx.arc(ox + (opponent.x / TILE) * cell, oy + (opponent.z / TILE) * cell, cell * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // プレイヤー（向き付き三角）
    const px = ox + (player.x / TILE) * cell;
    const py = oy + (player.z / TILE) * cell;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = '#ffe06a';
    ctx.beginPath();
    ctx.moveTo(0, -cell * 0.9);
    ctx.lineTo(cell * 0.6, cell * 0.7);
    ctx.lineTo(-cell * 0.6, cell * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
