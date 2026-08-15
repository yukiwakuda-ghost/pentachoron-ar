import { ARScene } from './scene.js';
import { MotionTracker } from './motion.js';
import { VideoRecorder } from './recorder.js';

class App {
  constructor() {
    this.currentScreen = 'screen-intro';
    this.videoElem = document.getElementById('camera-video');
    this.canvasElem = document.getElementById('three-canvas');

    this.scene = null;
    this.motion = new MotionTracker();
    this.recorder = null;
    this.stream = null;

    this.initUI();
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    this.currentScreen = id;
  }

  showError(msg) {
    document.getElementById('error-message').textContent = msg;
    this.showScreen('screen-error');
  }

  initUI() {
    document.getElementById('btn-start').addEventListener('click', () => {
      if (this.motion.isPermissionRequired()) {
        this.showScreen('screen-motion');
      } else {
        this.showScreen('screen-camera');
      }
    });

    document.getElementById('btn-motion').addEventListener('click', async () => {
      await this.motion.requestPermission();
      this.showScreen('screen-camera');
    });

    document.getElementById('btn-motion-skip').addEventListener('click', () => {
      this.showScreen('screen-camera');
    });

    document.getElementById('btn-camera').addEventListener('click', async () => {
      await this.startAR();
    });

    document.getElementById('btn-retry').addEventListener('click', () => {
      this.showScreen('screen-intro');
    });

    document.getElementById('btn-again').addEventListener('click', () => {
      this.showScreen('screen-ar');
    });

    document.getElementById('btn-back').addEventListener('click', () => {
      this.stopAR();
      this.showScreen('screen-intro');
    });
  }

  async startAR() {
    try {
      // 1. 高精細カメラストリームの取得（iOS Safari対応パラメータ）
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 60, min: 30 }
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElem.srcObject = this.stream;
      this.videoElem.setAttribute('playsinline', '');
      this.videoElem.setAttribute('webkit-playsinline', '');
      await this.videoElem.play();

      this.showScreen('screen-ar');

      // 2. Three.jsシーンの初期化
      if (!this.scene) {
        this.scene = new ARScene(this.canvasElem, this.videoElem);
      }
      this.scene.start();

      // 3. モーションセンサー監視の開始
      this.motion.start((quaternion, euler) => {
        if (this.scene) {
          this.scene.updateOrientation(quaternion, euler);
        }
      });

      // 4. レコーダーのセットアップ
      this.recorder = new VideoRecorder(this.videoElem, this.canvasElem);
      this.setupRecorderUI();

    } catch (err) {
      console.error('AR起動エラー:', err);
      this.showError('カメラの起動に失敗しました。Safariの設定でカメラのアクセス権限を「許可」にして再読み込みしてください。\n' + err.message);
    }
  }

  stopAR() {
    if (this.recorder && this.recorder.isRecording) {
      this.recorder.stop();
    }
    if (this.scene) {
      this.scene.stop();
    }
    this.motion.stop();
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.videoElem.srcObject = null;
  }

  setupRecorderUI() {
    const recordBtn = document.getElementById('btn-record');
    const timerElem = document.getElementById('hud-timer');
    const cpElem = document.getElementById('composite-progress');
    const cpPercent = document.getElementById('cp-percent');

    recordBtn.onclick = async () => {
      if (this.recorder.isRecording) return;

      recordBtn.classList.add('recording');
      
      this.recorder.start(
        // プログレス
        (timeSec, totalSec) => {
          const cur = String(Math.floor(timeSec)).padStart(2, '0');
          const max = String(totalSec).padStart(2, '0');
          timerElem.textContent = `00:${cur} / 00:${max}`;
        },
        // 録画完了
        async (videoBlob, videoUrl) => {
          recordBtn.classList.remove('recording');
          timerElem.textContent = '00:00 / 00:15';

          // プログレス演出
          cpElem.classList.add('active');
          for (let p = 0; p <= 100; p += 10) {
            cpPercent.textContent = p;
            await new Promise(r => setTimeout(r, 40));
          }
          cpElem.classList.remove('active');

          this.showResult(videoBlob, videoUrl);
        }
      );
    };
  }

  showResult(blob, url) {
    this.showScreen('screen-result');
    const resultVideo = document.getElementById('result-video');
    resultVideo.src = url;
    resultVideo.load();

    const downloadBtn = document.getElementById('btn-download');

    // iOS 写真アプリ保存 (Web Share API によるネイティブ共有)
    downloadBtn.onclick = async () => {
      const isMp4 = blob.type.includes('mp4');
      const filename = `pentachoron_${Date.now()}.${isMp4 ? 'mp4' : 'webm'}`;
      const file = new File([blob], filename, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Pentachoron AR',
            text: '正五胞体の空間射影'
          });
          return;
        } catch (err) {
          if (err.name !== 'AbortError') console.error('Share error:', err);
        }
      }

      // フォールバック: 通常のダウンロードリンク
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    };
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});