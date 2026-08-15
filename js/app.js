import { ARScene } from './scene.js';
import { MotionTracker } from './motion.js';
import { OfflineCompositor } from './compositor.js';

class App {
  constructor() {
    this.videoElem = document.getElementById('camera-video');
    this.canvasElem = document.getElementById('three-canvas');
    this.scene = null;
    this.motion = new MotionTracker();
    this.stream = null;
    this.isRecording = false;
    this.recordedFrames = [];
    this.recordDuration = 15; // 15秒間

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

    this.setupRecordHandler();
  }

  async startAR() {
    try {
      // iPhone 17e 最適化: 1080p 60fps バックカメラ
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

      // 3D空間シーンの初期化
      if (!this.scene) {
        this.scene = new ARScene(this.canvasElem, this.videoElem);
      }
      this.scene.start();

      // ワールド空間固定のためのジャイロ追従
      this.motion.start((quaternion) => {
        if (this.scene) this.scene.updateCameraPose(quaternion);
      });

    } catch (err) {
      console.error(err);
      document.getElementById('error-message').textContent =
        'カメラの起動に失敗しました。Safariの設定でカメラを許可してください。';
      this.showScreen('screen-error');
    }
  }

  setupRecordHandler() {
    const recordBtn = document.getElementById('btn-record');
    const timerElem = document.getElementById('hud-timer');
    const cpElem = document.getElementById('composite-progress');
    const cpBar = document.getElementById('cp-bar');
    const cpPercent = document.getElementById('cp-percent');
    const cpStatus = document.getElementById('cp-status-text');

    recordBtn.onclick = async () => {
      if (this.isRecording) return;
      this.isRecording = true;
      recordBtn.classList.add('recording');
      this.recordedFrames = [];

      // 15秒間、カメラフレームと3D状態を同期キャプチャ
      const fps = 30; // 合成用フレームレート
      const totalFrames = this.recordDuration * fps;
      const intervalMs = 1000 / fps;
      let frameCount = 0;

      const captureTimer = setInterval(() => {
        frameCount++;
        const elapsed = (frameCount / fps);
        const cur = String(Math.floor(elapsed)).padStart(2, '0');
        timerElem.textContent = `00:${cur} / 00:15`;

        // フレームデータ（ビデオビットマップ + 空間パラメータ）をストック
        const frameData = this.scene.captureFrameSnapshot();
        this.recordedFrames.push(frameData);

        if (frameCount >= totalFrames) {
          clearInterval(captureTimer);
          this.isRecording = false;
          recordBtn.classList.remove('recording');
          timerElem.textContent = '00:00 / 00:15';

          // オフライン超高品位コンポジット開始
          this.runOfflineComposite();
        }
      }, intervalMs);
    };
  }

  async runOfflineComposite() {
    const cpElem = document.getElementById('composite-progress');
    const cpBar = document.getElementById('cp-bar');
    const cpPercent = document.getElementById('cp-percent');
    const cpStatus = document.getElementById('cp-status-text');

    cpElem.classList.add('active');
    cpBar.style.width = '0%';
    cpPercent.textContent = '0';

    const compositor = new OfflineCompositor(this.scene);

    const { videoBlob, videoUrl } = await compositor.renderHighQualityVideo(
      this.recordedFrames,
      (progress, statusText) => {
        const pct = Math.floor(progress * 100);
        cpBar.style.width = `${pct}%`;
        cpPercent.textContent = pct;
        if (statusText) cpStatus.textContent = statusText;
      }
    );

    cpElem.classList.remove('active');
    this.showResult(videoBlob, videoUrl);
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
      const filename = `pentachoron_4d_${Date.now()}.${isMp4 ? 'mp4' : 'webm'}`;
      const file = new File([blob], filename, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Pentachoron 4D AR',
            text: '4次元正五胞体の空間射影と光線反射'
          });
          return;
        } catch (e) {
          if (e.name !== 'AbortError') console.error(e);
        }
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    };
  }

  stopAR() {
    this.isRecording = false;
    this.scene?.stop();
    this.motion.stop();
    this.stream?.getTracks().forEach(t => t.stop());
  }
}

window.addEventListener('DOMContentLoaded', () => new App());