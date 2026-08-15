import * as THREE from 'three';
import { GeometryConstellation } from './pentachoron.js';
import { SparkleParticles } from './particles.js';

export class ARScene {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.video = video;
    this.running = false;
    this.lastTime = performance.now();
    this.fpsCount = 0;
    this.fpsTimer = 0;

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

    // Retina解像度対応
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.0);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();

    // 視点カメラ
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 100);
    this.cameraGroup = new THREE.Group();
    this.cameraGroup.add(this.camera);
    this.scene.add(this.cameraGroup);

    // 空間ワールドアンカー（視界の前方2.0mに配置）
    this.worldGroup = new THREE.Group();
    this.worldGroup.position.set(0, 0, -2.0);
    this.scene.add(this.worldGroup);
  }

  initObjects() {
    // 点、正三角形、正四面体、正五胞体の幾何学クラスター
    this.constellation = new GeometryConstellation();
    this.worldGroup.add(this.constellation.group);

    // 線香花火の松葉散華パーティクル
    this.sparks = new SparkleParticles(800);
    this.worldGroup.add(this.sparks.points);
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
      this.camera.quaternion.copy(quaternion);
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
      const fpsElem = document.getElementById('hud-fps');
      if (fpsElem) fpsElem.textContent = `${fps} fps`;
      this.fpsCount = 0;
      this.fpsTimer = 0;
    }

    // 空間全体のゆっくりとした座標遷移（浮遊）
    const time = now * 0.001;
    this.worldGroup.position.x = Math.sin(time * 0.35) * 0.3;
    this.worldGroup.position.y = Math.cos(time * 0.28) * 0.2 + 0.05;
    this.worldGroup.position.z = -2.0 + Math.sin(time * 0.22) * 0.25;

    // 幾何学体群の更新
    const sparkSources = this.constellation.update(dt, time);

    // 線香花火スパークの更新
    this.sparks.update(dt, sparkSources);

    this.renderer.render(this.scene, this.camera);
  }
}