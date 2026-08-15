import * as THREE from 'three';
import { Pentachoron } from './pentachoron.js';
import { SparkleParticles } from './particles.js';

export class ARScene {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.video = video;
    this.running = false;
    this.lastTime = performance.now();
    this.fpsCount = 0;
    this.fpsTimer = 0;

    this.initThree();
    this.initObjects();
    this.handleResize = this.onResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  initThree() {
    // 1. 完全透過 Renderer の作成（カメラ映像と合成）
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    
    // Retina解像度の鮮明なライン
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0); // 完全に透明

    // 2. シーン & カメラ
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.01,
      100
    );
    this.camera.position.set(0, 0, 3.2);

    // 3. 微細なアンビエントライティング
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
  }

  initObjects() {
    // 正五胞体コアジオメトリ
    this.pentachoron = new Pentachoron();
    this.scene.add(this.pentachoron.group);

    // 散華・火花・網膜残像パーティクル
    this.sparks = new SparkleParticles(800);
    this.scene.add(this.sparks.points);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  updateOrientation(quaternion, euler) {
    // デバイス姿勢をシーンの回転に微細に同期（浮遊安定化）
    if (quaternion) {
      this.pentachoron.group.quaternion.slerp(quaternion, 0.05);
    }
  }

  start() {
    if (this.running) return;
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

    // FPS 計算
    this.fpsCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      const fps = Math.round(this.fpsCount / this.fpsTimer);
      document.getElementById('hud-fps').textContent = `${fps} fps`;
      this.fpsCount = 0;
      this.fpsTimer = 0;
    }

    // 正五胞体の4D回転・射影更新
    const vertices3D = this.pentachoron.update(dt);

    // 頂点とエッジから線香花火の火花を生成
    this.sparks.update(dt, vertices3D);

    // 描画
    this.renderer.render(this.scene, this.camera);
  }
}