// =============================================================
// maze.js - 迷路生成 & 探索アルゴリズム
// 静的ホスティング対応 / 依存なし
// =============================================================

export const CELL = {
  WALL: 1,
  PATH: 0,
};

/**
 * 迷路生成 (Recursive Backtracker / 深さ優先)
 * 出力は (2*w+1) x (2*h+1) のグリッド。1=壁, 0=通路
 * @param {number} cols 論理セル列数
 * @param {number} rows 論理セル行数
 * @param {function} rng 乱数生成器 (0..1)
 * @returns {{grid:number[][], cols:number, rows:number, gw:number, gh:number}}
 */
export function generateMaze(cols, rows, rng = Math.random) {
  const gw = cols * 2 + 1;
  const gh = rows * 2 + 1;
  // 全部壁で初期化
  const grid = Array.from({ length: gh }, () => new Array(gw).fill(CELL.WALL));

  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const stack = [];

  const startC = 0, startR = 0;
  visited[startR][startC] = true;
  grid[startR * 2 + 1][startC * 2 + 1] = CELL.PATH;
  stack.push([startC, startR]);

  const dirs = [
    [0, -1], // 上
    [1, 0],  // 右
    [0, 1],  // 下
    [-1, 0], // 左
  ];

  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    // 未訪問の隣接セル
    const neighbors = [];
    for (const [dc, dr] of dirs) {
      const nc = c + dc, nr = r + dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && !visited[nr][nc]) {
        neighbors.push([nc, nr, dc, dr]);
      }
    }
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const [nc, nr, dc, dr] = neighbors[Math.floor(rng() * neighbors.length)];
    // 壁を壊す
    grid[r * 2 + 1 + dr][c * 2 + 1 + dc] = CELL.PATH;
    grid[nr * 2 + 1][nc * 2 + 1] = CELL.PATH;
    visited[nr][nc] = true;
    stack.push([nc, nr]);
  }

  // ループ追加（少しだけ壁を壊して複数経路を作り探索を面白くする）
  const extraOpen = Math.floor((cols * rows) * 0.06);
  for (let i = 0; i < extraOpen; i++) {
    const x = 1 + Math.floor(rng() * (gw - 2));
    const y = 1 + Math.floor(rng() * (gh - 2));
    if (grid[y][x] === CELL.WALL) {
      // 上下 or 左右が通路で挟まれている壁のみ開放
      const h = grid[y][x - 1] === CELL.PATH && grid[y][x + 1] === CELL.PATH;
      const v = grid[y - 1][x] === CELL.PATH && grid[y + 1][x] === CELL.PATH;
      if (h || v) grid[y][x] = CELL.PATH;
    }
  }

  return { grid, cols, rows, gw, gh };
}

/** グリッド座標が通行可能か */
export function isWalkable(maze, gx, gy) {
  if (gx < 0 || gy < 0 || gx >= maze.gw || gy >= maze.gh) return false;
  return maze.grid[gy][gx] === CELL.PATH;
}

/**
 * A* 経路探索 (グリッド座標)
 * @returns {Array<[number,number]>} スタートからゴールまでのセル列（含端点）。到達不可なら []
 */
export function astar(maze, start, goal) {
  const key = (x, y) => y * maze.gw + x;
  const open = new Map(); // key -> node
  const startNode = { x: start[0], y: start[1], g: 0, f: 0, parent: null };
  startNode.f = heuristic(start, goal);
  open.set(key(start[0], start[1]), startNode);
  const closed = new Set();

  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (open.size) {
    // f最小ノード
    let current = null;
    for (const node of open.values()) {
      if (!current || node.f < current.f) current = node;
    }
    if (current.x === goal[0] && current.y === goal[1]) {
      return reconstruct(current);
    }
    open.delete(key(current.x, current.y));
    closed.add(key(current.x, current.y));

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx, ny = current.y + dy;
      if (!isWalkable(maze, nx, ny)) continue;
      const k = key(nx, ny);
      if (closed.has(k)) continue;
      const g = current.g + 1;
      let node = open.get(k);
      if (!node) {
        node = { x: nx, y: ny, g, f: 0, parent: current };
        node.f = g + heuristic([nx, ny], goal);
        open.set(k, node);
      } else if (g < node.g) {
        node.g = g;
        node.f = g + heuristic([nx, ny], goal);
        node.parent = current;
      }
    }
  }
  return [];
}

function heuristic(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function reconstruct(node) {
  const path = [];
  let cur = node;
  while (cur) {
    path.push([cur.x, cur.y]);
    cur = cur.parent;
  }
  return path.reverse();
}

/** BFSで全セルへの距離マップ（最遠ゴール選定などに使う） */
export function bfsDistances(maze, start) {
  const dist = Array.from({ length: maze.gh }, () => new Array(maze.gw).fill(-1));
  const q = [[start[0], start[1]]];
  dist[start[1]][start[0]] = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let head = 0;
  while (head < q.length) {
    const [x, y] = q[head++];
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (isWalkable(maze, nx, ny) && dist[ny][nx] === -1) {
        dist[ny][nx] = dist[y][x] + 1;
        q.push([nx, ny]);
      }
    }
  }
  return dist;
}

/** start から最も遠い通路セルを返す（ゴール配置用） */
export function farthestCell(maze, start) {
  const dist = bfsDistances(maze, start);
  let best = start, bestD = -1;
  for (let y = 0; y < maze.gh; y++) {
    for (let x = 0; x < maze.gw; x++) {
      if (dist[y][x] > bestD) {
        bestD = dist[y][x];
        best = [x, y];
      }
    }
  }
  return { cell: best, dist: bestD };
}

/** シード付き乱数 (mulberry32) */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
