// =============================================================
// player.js - 一人称プレイヤーの移動・衝突・ヘッドボブ
// =============================================================
import { isWalkable } from './maze.js';
import { TILE } from './renderer.js';

const RADIUS = 1.1;       // 衝突半径
const MOVE_SPEED = 6.5;   // ワールド/秒
const TURN_SPEED = 2.6;   // ラジアン/秒

export class Player {
  constructor(maze, startCell) {
    this.maze = maze;
    const wx = (startCell[0] + 0.5) * TILE;
    const wz = (startCell[1] + 0.5) * TILE;
    this.x = wx;
    this.z = wz;
    this.yaw = 0;
    this.bob = 0;
    this._bobT = 0;
    this.moving = false;
  }

  setMaze(maze) { this.maze = maze; }

  /** グリッドが壁でないか（ワールド座標→グリッド） */
  _solidAt(wx, wz) {
    const gx = Math.floor(wx / TILE);
    const gy = Math.floor(wz / TILE);
    return !isWalkable(this.maze, gx, gy);
  }

  /** 半径を考慮した衝突チェック */
  _collides(wx, wz) {
    // 4方向の代表点で判定（円 vs 格子壁の簡易版）
    const offs = [
      [RADIUS, 0], [-RADIUS, 0], [0, RADIUS], [0, -RADIUS],
      [RADIUS * 0.7, RADIUS * 0.7], [-RADIUS * 0.7, RADIUS * 0.7],
      [RADIUS * 0.7, -RADIUS * 0.7], [-RADIUS * 0.7, -RADIUS * 0.7],
    ];
    for (const [ox, oz] of offs) {
      if (this._solidAt(wx + ox, wz + oz)) return true;
    }
    return false;
  }

  /**
   * 入力で更新
   * @param input { forward:-1..1, strafe:-1..1, turn:-1..1 }
   * @param dt 秒
   */
  update(input, dt) {
    // 回転
    this.yaw -= input.turn * TURN_SPEED * dt;

    const fwd = input.forward * MOVE_SPEED * dt;
    const str = input.strafe * MOVE_SPEED * dt;

    // 進行ベクトル（yaw基準）
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // 前方は -Z 方向を基準
    let dx = (-sin) * fwd + (cos) * str;
    let dz = (-cos) * fwd + (-sin) * str;

    this.moving = Math.abs(fwd) > 0.0001 || Math.abs(str) > 0.0001;

    // 軸ごとにスライド衝突
    if (!this._collides(this.x + dx, this.z)) this.x += dx;
    if (!this._collides(this.x, this.z + dz)) this.z += dz;

    // ヘッドボブ
    if (this.moving) {
      this._bobT += dt * 10;
      this.bob = Math.sin(this._bobT) * 0.12;
    } else {
      this.bob *= 0.9;
    }
  }

  get gridX() { return Math.floor(this.x / TILE); }
  get gridY() { return Math.floor(this.z / TILE); }

  distanceToCell(cell) {
    const cx = (cell[0] + 0.5) * TILE;
    const cz = (cell[1] + 0.5) * TILE;
    return Math.hypot(this.x - cx, this.z - cz);
  }
}
