/**
 * メモリ枯渇・クラッシュを起こさないリアルタイム高品位ストリームレコーダー
 */
export class StreamRecorder {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.chunks = [];
    this.duration = 15; // 15秒
    this.animId = null;
    this.timerInterval = null;
  }

  getSupportedMimeType() {
    // iOS Safari 写真アプリ互換の MP4 形式を最優先
    const types = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm'
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  }

  start(onProgress, onComplete) {
    if (this.isRecording) return;
    this.isRecording = true;
    this.chunks = [];

    // 合成用キャンバス（一定のメモリサイズで動作）
    const compCanvas = document.createElement('canvas');
    const width = 1080;
    const height = 1920;
    compCanvas.width = width;
    compCanvas.height = height;
    const ctx = compCanvas.getContext('2d', { alpha: false });

    // 毎フレーム：カメラ映像 + 空間への光のバウンス反射 + 3D多面体群 を合成
    const renderLoop = () => {
      if (!this.isRecording) return;

      // 1. 現実空間映像
      ctx.drawImage(this.video, 0, 0, width, height);

      // 2. 空間・壁・床への発光バウンス光（リアルタイム光線反射）
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(
        width * 0.5, height * 0.5, 40,
        width * 0.5, height * 0.5, width * 0.7
      );
      grad.addColorStop(0, 'rgba(255, 248, 230, 0.22)');
      grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.08)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // 3. 高解像度3D幾何学レイヤー
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.canvas, 0, 0, width, height);
      ctx.restore();

      this.animId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    const stream = compCanvas.captureStream(30);
    const mimeType = this.getSupportedMimeType();
    const options = mimeType ? { mimeType, videoBitsPerSecond: 8000000 } : {};

    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      console.warn('MediaRecorder fallback:', e);
      this.mediaRecorder = new MediaRecorder(stream);
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      cancelAnimationFrame(this.animId);
      const actualType = mimeType || 'video/mp4';
      const blob = new Blob(this.chunks, { type: actualType });
      const url = URL.createObjectURL(blob);
      if (onComplete) onComplete(blob, url);
    };

    this.mediaRecorder.start(100);

    const startTime = performance.now();
    this.timerInterval = setInterval(() => {
      if (!this.isRecording) return;
      const elapsed = (performance.now() - startTime) / 1000;
      if (onProgress) onProgress(Math.min(elapsed, this.duration), this.duration);

      if (elapsed >= this.duration) {
        this.stop();
      }
    }, 100);
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
}