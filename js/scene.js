import * as THREE from 'three';
import { Pentachoron } from './pentachoron.js';
import { SparkleParticles } from './particles.js';

export class ARScene {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.video = video;
    this.running = false;
    this.lastTime = performance.now();

    this.initScene();
    this.initObjects();
    this.onResize();
    window.addEventListener('resize', this.onResize.bind(this));
  }

  initScene() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();

    // カメラ（ワールド座標系を浮遊するためのリグ）
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 100);
    this.cameraGroup = new THREE.Group();
    this.cameraGroup.add(this.camera);
    this.scene.add(this.cameraGroup);

    // 現実空間に配置される固定アンカー
    this.worldAnchor = new THREE.Group();
    this.worldAnchor.position.set(0, 0.1, -1.8); // 視界の1.8m前方に固定
    this.scene.add(this.worldAnchor);
  }

  initObjects() {
    // 1. 正五胞体（断面射影・線香花火フィラメント・明滅面）
    this.pentachoron = new Pentachoron();
    this.worldAnchor.add(this.pentachoron.group);

    // 2. 空間に散る正四面体の光粒 & 松葉スパーク
    this.sparks = new SparkleParticles(1000);
    this.worldAnchor.add(this.sparks.points);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  updateCameraPose(quaternion) {
    if (quaternion) {
      // 端末の向きに連動（オブジェクトが部屋の中に本当に留まっている体験）
      this.camera.quaternion.copy(quaternion);
    }
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.animate();
  }

  stop() {
    this.running = false;
  }

  animate() {
    if (!this.running) return;
    requestAnimationFrame(this.animate.bind(this));

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.updateWorld(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateWorld(dt) {
    // 空間内をゆっくり漂う軌道遷移
    const time = performance.now() * 0.001;
    this.worldAnchor.position.x = Math.sin(time * 0.3) * 0.25;
    this.worldAnchor.position.y = Math.cos(time * 0.25) * 0.15 + 0.05;
    this.worldAnchor.position.z = -1.8 + Math.sin(time * 0.2) * 0.2;

    const data3D = this.pentachoron.update(dt);
    this.sparks.update(dt, data3D.vertices, data3D.faces);
  }

  captureFrameSnapshot() {
    // ビデオフレームをオフスクリーンCanvasにバックアップ
    const vCanvas = document.createElement('canvas');
    vCanvas.width = 1080;
    vCanvas.height = 1920;
    const vCtx = vCanvas.getContext('2d');
    vCtx.drawImage(this.video, 0, 0, vCanvas.width, vCanvas.height);

    return {
      videoImage: vCanvas,
      camQuat: this.camera.quaternion.clone(),
      anchorPos: this.worldAnchor.position.clone(),
      timeSec: performance.now() * 0.001
    };
  }
}