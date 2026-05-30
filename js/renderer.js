// =============================================================
// renderer.js - Three.js による3D迷路レンダリング
// 一人称視点 / 動的ライト / ミニマップ用データ提供
// =============================================================
import * as THREE from '../vendor/three.module.js';
import { CELL } from './maze.js';

export const TILE = 4; // 1グリッドセルのワールドサイズ
export const WALL_H = 4.0;

export class MazeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.045);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 200);
    this.camera.position.set(0, WALL_H * 0.45, 0);

    // 環境光 + 手元のトーチライト
    this.ambient = new THREE.AmbientLight(0x33405a, 0.9);
    this.scene.add(this.ambient);

    this.torch = new THREE.PointLight(0xffd9a0, 2.2, TILE * 6, 1.6);
    this.scene.add(this.torch);

    // ゴールを照らす目印用ライト（後で配置）
    this.goalLight = new THREE.PointLight(0x66ffcc, 0.0, TILE * 8, 2);
    this.scene.add(this.goalLight);

    this.mazeGroup = new THREE.Group();
    this.scene.add(this.mazeGroup);

    this.goalMesh = null;
    this.opponentMesh = null;
    this._materials = this._buildMaterials();

    this.handleResize();
  }

  _buildMaterials() {
    // 手続き的なタイル風テクスチャを生成（画像不要 = 静的ホスティングに最適）
    const makeTex = (base, line, size = 128) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      // ノイズ
      const img = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 26;
        img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
      // グリッド線
      ctx.strokeStyle = line;
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    };

    const wallTex = makeTex('#2a3550', 'rgba(120,160,220,0.5)');
    const floorTex = makeTex('#141a26', 'rgba(80,110,160,0.3)');
    const ceilTex = makeTex('#0c111c', 'rgba(60,80,120,0.25)');

    return {
      wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85, metalness: 0.1 }),
      floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95, metalness: 0.05 }),
      ceil: new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1.0, metalness: 0.0 }),
    };
  }

  /** グリッド座標 -> ワールド座標(中心) */
  gridToWorld(gx, gy) {
    return { x: (gx + 0.5) * TILE, z: (gy + 0.5) * TILE };
  }

  buildMaze(maze, goalCell) {
    // 既存をクリア
    while (this.mazeGroup.children.length) {
      const m = this.mazeGroup.children.pop();
      m.geometry?.dispose?.();
    }

    const { grid, gw, gh } = maze;

    // 床と天井（1枚板）
    const floorGeo = new THREE.PlaneGeometry(gw * TILE, gh * TILE);
    const floor = new THREE.Mesh(floorGeo, this._materials.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((gw * TILE) / 2, 0, (gh * TILE) / 2);
    this._materials.floor.map.repeat.set(gw, gh);
    this.mazeGroup.add(floor);

    const ceilGeo = new THREE.PlaneGeometry(gw * TILE, gh * TILE);
    const ceil = new THREE.Mesh(ceilGeo, this._materials.ceil);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set((gw * TILE) / 2, WALL_H, (gh * TILE) / 2);
    this._materials.ceil.map.repeat.set(gw, gh);
    this.mazeGroup.add(ceil);

    // 壁: InstancedMesh でまとめて描画（高速）
    let wallCount = 0;
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++)
        if (grid[y][x] === CELL.WALL) wallCount++;

    const boxGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE);
    const inst = new THREE.InstancedMesh(boxGeo, this._materials.wall, wallCount);
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        if (grid[y][x] === CELL.WALL) {
          dummy.position.set((x + 0.5) * TILE, WALL_H / 2, (y + 0.5) * TILE);
          dummy.updateMatrix();
          inst.setMatrixAt(i++, dummy.matrix);
        }
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    this.mazeGroup.add(inst);

    // ゴール（光る柱）
    const gw_ = this.gridToWorld(goalCell[0], goalCell[1]);
    const goalGeo = new THREE.CylinderGeometry(0.5, 0.8, WALL_H * 0.9, 16);
    const goalMat = new THREE.MeshStandardMaterial({
      color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 1.5, transparent: true, opacity: 0.85,
    });
    this.goalMesh = new THREE.Mesh(goalGeo, goalMat);
    this.goalMesh.position.set(gw_.x, WALL_H * 0.45, gw_.z);
    this.mazeGroup.add(this.goalMesh);

    this.goalLight.position.set(gw_.x, WALL_H * 0.7, gw_.z);
    this.goalLight.intensity = 1.6;

    this.maze = maze;
  }

  /** 対戦相手アバター（光る球） */
  ensureOpponent(color = 0xff5577) {
    if (this.opponentMesh) return;
    const geo = new THREE.SphereGeometry(0.7, 20, 16);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 1.2,
    });
    this.opponentMesh = new THREE.Mesh(geo, mat);
    const halo = new THREE.PointLight(color, 1.0, TILE * 4, 2);
    this.opponentMesh.add(halo);
    this.scene.add(this.opponentMesh);
  }

  setOpponentWorld(x, z, visible) {
    if (!this.opponentMesh) return;
    this.opponentMesh.position.set(x, WALL_H * 0.4, z);
    this.opponentMesh.visible = visible;
  }

  removeOpponent() {
    if (this.opponentMesh) {
      this.scene.remove(this.opponentMesh);
      this.opponentMesh.geometry.dispose();
      this.opponentMesh = null;
    }
  }

  /** プレイヤーの位置と向きでカメラ更新 */
  updateCamera(x, z, yaw, bob = 0) {
    this.camera.position.set(x, WALL_H * 0.45 + bob, z);
    this.camera.rotation.set(0, yaw, 0, 'YXZ');
    this.torch.position.set(x, WALL_H * 0.5, z);
  }

  tick(t) {
    if (this.goalMesh) {
      this.goalMesh.rotation.y = t * 0.001;
      this.goalMesh.material.emissiveIntensity = 1.2 + Math.sin(t * 0.004) * 0.4;
    }
    // トーチのゆらぎ
    this.torch.intensity = 2.0 + Math.sin(t * 0.02) * 0.25 + Math.sin(t * 0.013) * 0.15;
  }

  handleResize() {
    const w = this.canvas.clientWidth || this.canvas.parentElement.clientWidth;
    const h = this.canvas.clientHeight || this.canvas.parentElement.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
