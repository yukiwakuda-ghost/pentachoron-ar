// scene.js - Three.jsシーン、カメラ、レンダラ、環境反射、Bloom合成
// カメラ映像を動的キューブマップに焼き込み、金属面（反射プローブ）に反映させる。

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Pentachoron } from './pentachoron.js';
import { TetrahedronCluster, TrianglePoints } from './particles.js';

export class ARScene {
  constructor(canvas, videoElement) {
    this.canvas = canvas;
    this.videoEl = videoElement;

    // Renderer（背景は透過してcamera-videoを透過表示）
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true // 録画/合成用
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
    this.camera.position.set(0, 0, 0);

    // ライト（環境光＋ポイント光でメイン発光を強調）
    this.scene.add(new THREE.AmbientLight(0x333344, 1.0));
    this.keyLight = new THREE.PointLight(0xffffff, 2.5, 8, 2);
    this.scene.add(this.keyLight);

    // === Video Texture（カメラ映像） ===
    // 環境マップとしても使うために EquirectangularReflectionMapping を試みるが、
    // 実際にはビデオを平面テクスチャとして扱い、CubeCameraで動的にキューブ化する。
    this.videoTexture = new THREE.VideoTexture(videoElement);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;

    // === Cube Camera（環境反射プローブ） ===
    // 周辺映像を焼き込むために、まず大きな球面Meshにビデオを貼り、
    // その内側でCubeCameraをレンダリングしてキューブマップを得る。
    this.envSphereGeom = new THREE.SphereGeometry(20, 32, 16);
    this.envSphereGeom.scale(-1, 1, 1); // 内側向き
    this.envSphereMat = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      depthWrite: false
    });
    this.envSphere = new THREE.Mesh(this.envSphereGeom, this.envSphereMat);
    this.envSphere.visible = false; // 通常レンダリングでは非表示、CubeCamera時だけ表示
    this.scene.add(this.envSphere);

    this.cubeRT = new THREE.WebGLCubeRenderTarget(256, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    });
    this.cubeCamera = new THREE.CubeCamera(0.1, 100, this.cubeRT);
    this.scene.add(this.cubeCamera);

    // === Pentachoron本体 ===
    this.pentachoron = new Pentachoron(0.5);
    this.pentachoron.setPosition(0, 0, -1.3);
    this.scene.add(this.pentachoron.group);

    // 反射する内芯球（メタリック）— 4D射影の"核"表現
    const coreGeom = new THREE.IcosahedronGeometry(0.06, 2);
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1.0,
      roughness: 0.15,
      envMap: this.cubeRT.texture,
      envMapIntensity: 1.2
    });
    this.core = new THREE.Mesh(coreGeom, this.coreMat);
    this.pentachoron.group.add(this.core);

    // === パーティクル群 ===
    this.tetraCluster = new TetrahedronCluster(28);
    this.pentachoron.group.add(this.tetraCluster.group);
    this.triPoints = new TrianglePoints(180);
    this.pentachoron.group.add(this.triPoints.points);

    // === Bloom Postprocessing ===
    this._setupComposer();

    // 内部状態
    this.enableRealtimeReflection = true;
    this.cubeUpdateInterval = 3; // フレーム毎
    this.frameCount = 0;
    this.pentaOrigin = new THREE.Vector3(0, 0, -1.3);
    this.pentaTarget = new THREE.Vector3(0, 0, -1.3);
    this.pentaTransitionT = 0;
    this.pentaTransitionD = 5.0;

    this.clock = new THREE.Clock();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _setupComposer() {
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      1.15,   // strength - 白光を強く
      0.55,   // radius
      0.28    // threshold - 明るい部分のみに適用
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setReflectionMode(realtime) {
    this.enableRealtimeReflection = realtime;
    if (!realtime) {
      // 静的環境反射に切り替え（一度だけ焼く）
      this._updateCubeMap();
    }
  }

  _updateCubeMap() {
    // envSphereだけ見せてCubeCameraでキャプチャ
    this.envSphere.visible = true;
    this.pentachoron.group.visible = false;
    this.cubeCamera.update(this.renderer, this.scene);
    this.envSphere.visible = false;
    this.pentachoron.group.visible = true;
  }

  _updatePentachoronPosition(dt) {
    this.pentaTransitionT += dt;
    const p = Math.min(this.pentaTransitionT / this.pentaTransitionD, 1.0);
    // easeInOut
    const e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2)/2;
    const cur = new THREE.Vector3().lerpVectors(this.pentaOrigin, this.pentaTarget, e);
    this.pentachoron.setPosition(cur.x, cur.y, cur.z);
    // キーライトも追従
    this.keyLight.position.set(cur.x, cur.y + 0.3, cur.z + 0.2);

    if (p >= 1.0) {
      this.pentaOrigin.copy(this.pentaTarget);
      // カメラ前方の緩やかな範囲でランダムに次目標を決める
      this.pentaTarget.set(
        THREE.MathUtils.randFloatSpread(1.4),  // -0.7..0.7
        THREE.MathUtils.randFloatSpread(0.9),  // -0.45..0.45
        THREE.MathUtils.randFloat(-1.8, -0.9)
      );
      this.pentaTransitionT = 0;
      this.pentaTransitionD = THREE.MathUtils.randFloat(4.0, 7.0);
    }
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // Pentachoron本体アニメ
    this.pentachoron.update(dt);
    this.tetraCluster.update(dt);
    this.triPoints.update(dt);
    this._updatePentachoronPosition(dt);

    // 環境反射（リアルタイム時のみ間引いて更新）
    if (this.enableRealtimeReflection) {
      this.frameCount++;
      if (this.frameCount % this.cubeUpdateInterval === 0) {
        this._updateCubeMap();
      }
    }

    // 端末の向きに合わせてカメラを回転（deviceOrientationから）
    // →app.jsで直接 this.camera.quaternion をセット

    this.composer.render();
  }

  setCameraOrientation(quaternion) {
    this.camera.quaternion.copy(quaternion);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.renderer.dispose();
    this.cubeRT.dispose();
    this.videoTexture.dispose();
  }
}
