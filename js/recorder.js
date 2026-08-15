/**
 * 15秒間 高精細AR合成キャプチャ & iOS写真アプリ対応動画生成
 */
export class VideoRecorder {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.chunks = [];
    this.duration = 15; // 15秒
  }

  getSupportedMimeType() {
    // iOS Safari 写真アプリ互換の MP4 形式を最優先
    const types = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  }

  start(onProgress, onComplete) {
    if (this.isRecording) return;
    this.isRecording = true;
    this.chunks = [];

    // オフスクリーンの合成用キャンバスを作成
    const compCanvas = document.createElement('canvas');
    const width = this.canvas.width || 1080;
    const height = this.canvas.height || 1920;
    compCanvas.width = width;
    compCanvas.height = height;
    const ctx = compCanvas.getContext('2d', { alpha: false });

    // 毎フレームカメラ映像とThree.jsキャンバスを高精度合成
    let animId;
    const renderComposite = () => {
      if (!this.isRecording) return;
      ctx.drawImage(this.video, 0, 0, width, height);
      ctx.drawImage(this.canvas, 0, 0, width, height);
      animId = requestAnimationFrame(renderComposite);
    };
    renderComposite();

    // 合成キャンバスから 60fps ストリームを抽出
    const stream = compCanvas.captureStream(60);
    const mimeType = this.getSupportedMimeType();

    const options = mimeType ? { mimeType, videoBitsPerSecond: 8000000 } : {};
    this.mediaRecorder = new MediaRecorder(stream, options);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      cancelAnimationFrame(animId);
      const actualType = mimeType || 'video/mp4';
      const blob = new Blob(this.chunks, { type: actualType });
      const url = URL.createObjectURL(blob);
      if (onComplete) onComplete(blob, url);
    };

    this.mediaRecorder.start(100);

    // タイマー更新 (15秒)
    const startTime = performance.now();
    const interval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (onProgress) onProgress(Math.min(elapsed, this.duration), this.duration);

      if (elapsed >= this.duration) {
        clearInterval(interval);
        this.stop();
      }
    }, 100);

    this.timerInterval = interval;
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
}