// app.js - エントリポイント / 画面遷移とパーミッションフロー

import { ARScene } from './scene.js';
import { MotionController } from './motion.js';
import { Recorder } from './recorder.js';

const state = {
  mode: 'realtime',       // 'realtime' | 'composite'
  motionGranted: false,
  cameraStream: null,
  scene: null,
  motion: null,
  recorder: null,
  running: false,
  rafId: null
};

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const screens = {
  intro:   $('screen-intro'),
  motion:  $('screen-motion'),
  camera:  $('screen-camera'),
  ar:      $('screen-ar'),
  result:  $('screen-result'),
  error:   $('screen-error')
};

function show(name) {
  for (const k in screens) screens[k].classList.remove('active');
  screens[name].classList.add('active');
}

function showError(msg) {
  $('error-message').textContent = msg;
  show('error');
}

// ===== モード選択 =====
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
  });
});

// ===== 開始ボタン =====
$('btn-start').addEventListener('click', () => {
  // モーション許可が不要な端末 (Android等) はスキップ
  if (MotionController.isPermissionRequired()) {
    show('motion');
  } else {
    startMotionWithoutPermission();
  }
});

async function startMotionWithoutPermission() {
  state.motion = new MotionController();
  state.motion.start();
  state.motionGranted = true;
  show('camera');
}

// ===== モーションセンサー許可 =====
$('btn-motion').addEventListener('click', async () => {
  state.motion = new MotionController();
  const ok = await state.motion.requestPermission();
  if (ok) {
    state.motion.start();
    state.motionGranted = true;
    show('camera');
  } else {
    showError('モーションセンサーへのアクセスが拒否されました。設定から許可するか、スキップして再度お試しください。');
  }
});
$('btn-motion-skip').addEventListener('click', () => {
  state.motion = new MotionController();
  // 権限なしでも一応 addEventListener はしておく（何も来ない可能性あり）
  state.motion.start();
  show('camera');
});

// ===== カメラ許可 =====
$('btn-camera').addEventListener('click', async () => {
  try {
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.cameraStream = stream;
    const video = $('camera-video');
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    await video.play();
    startAR();
  } catch (e) {
    console.error(e);
    showError('カメラへのアクセスに失敗しました: ' + e.message);
  }
});

// ===== ARスタート =====
function startAR() {
  show('ar');
  $('hud-mode').textContent = 'MODE: ' + (state.mode === 'realtime' ? 'REALTIME' : 'COMPOSITE');

  const canvas = $('three-canvas');
  const video = $('camera-video');

  if (!state.scene) {
    state.scene = new ARScene(canvas, video);
  }
  state.scene.setReflectionMode(state.mode === 'realtime');
  state.running = true;

  // FPS計測
  let fpsFrames = 0, fpsLast = performance.now();

  const loop = () => {
    if (!state.running) return;

    if (state.motion && state.motion.enabled) {
      state.scene.setCameraOrientation(state.motion.getQuaternion());
    }
    state.scene.update();

    fpsFrames++;
    const now = performance.now();
    if (now - fpsLast >= 500) {
      const fps = Math.round((fpsFrames * 1000) / (now - fpsLast));
      $('hud-fps').textContent = fps + ' fps';
      fpsFrames = 0; fpsLast = now;
    }
    state.rafId = requestAnimationFrame(loop);
  };
  loop();
}

// ===== 録画 =====
$('btn-record').addEventListener('click', () => {
  const btn = $('btn-record');
  if (state.recorder && state.recorder.recording) {
    state.recorder.stop();
    btn.classList.remove('recording');
    return;
  }
  const canvas = $('three-canvas');
  const video = $('camera-video');
  state.recorder = new Recorder(video, canvas, {
    duration: 15000,
    mode: state.mode,
    onProgress: (p, phase) => {
      if (phase === 'composite') {
        $('composite-progress').classList.add('active');
        $('cp-percent').textContent = Math.round(p * 100);
      } else {
        const remain = Math.max(0, 15 - Math.floor(p * 15));
        $('hud-timer').textContent =
          `00:${String(15 - remain).padStart(2,'0')} / 00:15`;
      }
    },
    onComplete: ({ blob, url, ext }) => {
      $('composite-progress').classList.remove('active');
      btn.classList.remove('recording');
      $('result-video').src = url;
      $('btn-download').href = url;
      $('btn-download').setAttribute('download', `pentachoron_ar.${ext}`);
      show('result');
      // AR描画は止める（バッテリー節約）
      state.running = false;
      if (state.rafId) cancelAnimationFrame(state.rafId);
    }
  });
  btn.classList.add('recording');
  $('hud-timer').textContent = '00:00 / 00:15';
  state.recorder.start();
});

// ===== 戻る =====
$('btn-back').addEventListener('click', () => {
  cleanup();
  show('intro');
});

$('btn-again').addEventListener('click', () => {
  // ARに戻る
  if (state.scene) {
    state.running = true;
    const loop = () => {
      if (!state.running) return;
      if (state.motion && state.motion.enabled) {
        state.scene.setCameraOrientation(state.motion.getQuaternion());
      }
      state.scene.update();
      state.rafId = requestAnimationFrame(loop);
    };
    loop();
    show('ar');
  } else {
    show('intro');
  }
});

$('btn-retry').addEventListener('click', () => {
  cleanup();
  show('intro');
});

function cleanup() {
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  if (state.recorder && state.recorder.recording) state.recorder.stop();
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(t => t.stop());
    state.cameraStream = null;
  }
  if (state.motion) state.motion.stop();
  if (state.scene) {
    state.scene.dispose();
    state.scene = null;
  }
}

// 初期表示
show('intro');

// 開発時: WebGL未対応チェック
(function checkWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) throw new Error('WebGL unavailable');
  } catch (e) {
    showError('このブラウザはWebGLに対応していません。Safari最新版でご利用ください。');
  }
})();
