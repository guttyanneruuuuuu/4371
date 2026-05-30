// =============================================================
// main.js - エントリーポイント (画面遷移 / メニュー / 結果)
// =============================================================
import { Game, MODE } from './game.js';
import { Controls } from './controls.js';
import { DIFFICULTY } from './ai.js';

const $ = (id) => document.getElementById(id);

const screens = {
  menu: $('screen-menu'),
  game: $('screen-game'),
  result: $('screen-result'),
  versusMid: $('screen-versus-mid'),
};

function show(name) {
  for (const k in screens) screens[k].classList.toggle('hidden', k !== name);
}

// HUD
const hudTime = $('hud-time');
const hudMode = $('hud-mode');
const hudGoal = $('hud-goal');
const banner = $('banner');

let game;
let controls;

// ----- 設定値 -----
const state = {
  mode: MODE.AI,
  difficulty: 'normal',
  size: 8,
};

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
}

function showBanner(text, duration = 1400) {
  banner.textContent = text;
  banner.classList.add('show');
  clearTimeout(banner._t);
  banner._t = setTimeout(() => banner.classList.remove('show'), duration);
}

function startGame() {
  game.newGame({
    mode: state.mode,
    difficulty: state.difficulty,
    size: state.size,
  });
  show('game');
  let modeLabel = { solo: 'SOLO', ai: `AI · ${DIFFICULTY[state.difficulty].label}`, versus: 'P1の番' }[state.mode];
  hudMode.textContent = modeLabel;
  const startMsg = state.mode === MODE.VERSUS ? 'プレイヤー1 スタート！' :
    (state.mode === MODE.AI ? 'AIと競争！ よーいドン！' : 'ゴールを目指せ！');
  showBanner(startMsg);
}

function onHud(h) {
  hudTime.textContent = fmtTime(h.elapsed);
  const dCells = Math.round(h.goalDist / 4);
  hudGoal.textContent = `🎯 ${dCells}`;
  if (h.mode === MODE.VERSUS) {
    hudMode.textContent = `P${h.versusTurn}の番`;
  }
}

function onFinish(result) {
  const box = $('result-content');
  let html = '';
  if (result.type === 'solo') {
    html = `
      <div class="res-emoji">🏁</div>
      <h2>クリア！</h2>
      <p class="res-time">${fmtTime(result.time)}</p>
      <p class="res-sub">最短経路: ${result.optimal} マス</p>`;
  } else if (result.type === 'ai') {
    if (result.playerWon) {
      html = `
        <div class="res-emoji">🏆</div>
        <h2 class="win">勝利！</h2>
        <p class="res-time">${fmtTime(result.time)}</p>
        <p class="res-sub">AI(${DIFFICULTY[result.difficulty].label})に勝った！</p>`;
    } else {
      html = `
        <div class="res-emoji">😵</div>
        <h2 class="lose">敗北…</h2>
        <p class="res-sub">AIが先にゴールしました</p>
        <p class="res-sub">難易度を下げて再挑戦！</p>`;
    }
  } else if (result.type === 'versus-end') {
    const w = result.winner;
    const wt = w === 1 ? result.t1 : result.t2;
    html = `
      <div class="res-emoji">${w === 0 ? '🤝' : '🏆'}</div>
      <h2 class="win">${w === 0 ? '引き分け！' : `プレイヤー${w} の勝ち！`}</h2>
      <div class="versus-times">
        <div class="${w===1?'winner':''}">P1<br><b>${fmtTime(result.t1)}</b></div>
        <div class="${w===2?'winner':''}">P2<br><b>${fmtTime(result.t2)}</b></div>
      </div>`;
  }
  box.innerHTML = html;
  show('result');
}

function onVersusMid(p1Time) {
  $('vm-p1-time').textContent = fmtTime(p1Time);
  show('versusMid');
}

// ----- 初期化 -----
window.addEventListener('DOMContentLoaded', () => {
  const refs = {
    canvas: $('gl'),
    minimap: $('minimap'),
    joyBase: $('joy-base'),
    joyKnob: $('joy-knob'),
    lookArea: $('look-area'),
    onHud,
    onFinish,
    onVersusMid,
  };
  game = new Game(refs);
  controls = new Controls(game, refs);

  // モード選択ボタン
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      // AIモードのみ難易度表示
      $('difficulty-row').classList.toggle('hidden', state.mode !== MODE.AI);
    });
  });

  // 難易度
  document.querySelectorAll('[data-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.difficulty = btn.dataset.diff;
      document.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
    });
  });

  // サイズ
  document.querySelectorAll('[data-size]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.size = parseInt(btn.dataset.size, 10);
      document.querySelectorAll('[data-size]').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
    });
  });

  $('btn-start').addEventListener('click', startGame);

  // ゲーム内ボタン
  $('btn-quit').addEventListener('click', () => {
    game.stop();
    show('menu');
  });
  $('btn-pause').addEventListener('click', () => {
    if (game.running) { game.pause(); showBanner('一時停止', 99999); }
    else { game.resume(); banner.classList.remove('show'); }
  });

  // 結果画面
  $('btn-retry').addEventListener('click', () => startGame());
  $('btn-menu').addEventListener('click', () => { game.stop(); show('menu'); });

  // VERSUS 中間画面
  $('btn-vm-next').addEventListener('click', () => {
    game.versus.turn = 2;
    game.versusNextPlayer();
    show('game');
    showBanner('プレイヤー2 スタート！');
  });

  // デフォルト選択
  document.querySelector('[data-mode="ai"]').classList.add('sel');
  document.querySelector('[data-diff="normal"]').classList.add('sel');
  document.querySelector('[data-size="8"]').classList.add('sel');

  show('menu');
});
