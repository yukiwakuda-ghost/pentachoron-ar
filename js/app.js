import { ARScene } from './scene.js';
import { MotionTracker } from './motion.js';
import { StreamRecorder } from './recorder.js';

class App {
  constructor() {
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
    document.getElementById(id)?.classList.add('active');
  }

  initUI() {
    document.getElementById('btn-start').onclick = () => {
      if (this.motion.isPermissionRequired()) {
        this.showScreen('screen-motion');
      } else {
        this.showScreen('screen-camera');
      }
    };

    document.getElementById('btn-motion').onclick = async () => {
      await this.motion.requestPermission();
      this.showScreen('screen-camera');
    };

    document.getElementById('btn-motion-skip').onclick = () => {
      this.showScreen('screen-camera');
    };

    document.getElementById('btn-camera').onclick = async () => {
      await this.startAR();
    };

    document.getElementById('btn-again').onclick = () => {
      this.showScreen('screen-ar');
    };

    document.getElementById('btn-back').onclick = () => {
      this.stopAR();
      this.showScreen('screen-intro');
    };

    document.getElementById('btn-retry').onclick = () => {
      this.showScreen('screen-intro');
    };
  }

  async startAR() {
    try {
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

      if (!this.scene) {
        this.scene = new ARScene(this.canvasElem, this.videoElem);
      }
      this.scene.start();

      this.motion.start((quaternion) => {
        if (this.scene) this.scene.updateCameraPose(quaternion);
      });

      this.setupRecorder();

    } catch (err) {
      console.error(err);
      document.getElementById('error-message').textContent =
        'カメラの起動に失敗しました。Safariの設定でカメラのアクセスを許可してください。';
      this.showScreen('screen-error');
    }
  }

  setupRecorder() {
    this.recorder = new StreamRecorder(this.videoElem, this.canvasElem);
    const recordBtn = document.getElementById('btn-record');
    const timerElem = document.getElementById('hud-timer');
    const cpElem = document.getElementById('composite-progress');

    // ボタンのクリックで録画の開始／途中停止を制御
    recordBtn.onclick = () => {
      if (this.recorder.isRecording) {
        // 手動での停止
        this.recorder.stop();
        return;
      }

      recordBtn.classList.add('recording');

      this.recorder.start(
        // プログレス
        (timeSec, totalSec) => {
          const cur = String(Math.floor(timeSec)).padStart(2, '0');
          const max = String(totalSec).padStart(2, '0');
          timerElem.textContent = `00:${cur} / 00:${max}`;
        },
        // 完了
        async (videoBlob, videoUrl) => {
          recordBtn.classList.remove('recording');
          timerElem.textContent = '00:00 / 00:15';

          cpElem.classList.add('active');
          await new Promise(r => setTimeout(r, 600));
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
    resultVideo.play().catch(() => {});

    const downloadBtn = document.getElementById('btn-download');
    downloadBtn.onclick = async () => {
      const isMp4 = blob.type.includes('mp4');
      const filename = `pentachoron_${Date.now()}.${isMp4 ? 'mp4' : 'webm'}`;
      const file = new File([blob], filename, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Pentachoron 4D AR',
            text: '正五胞体の空間射影'
          });
          return;
        } catch (e) {
          if (e.name !== 'AbortError') console.error(e);
        }
      }

      // フォールバックダウンロード
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    };
  }

  stopAR() {
    if (this.recorder && this.recorder.isRecording) {
      this.recorder.stop();
    }
    this.scene?.stop();
    this.motion.stop();
    this.stream?.getTracks().forEach(t => t.stop());
  }
}

window.addEventListener('DOMContentLoaded', () => new App());