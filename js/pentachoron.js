import * as THREE from 'three';

/**
 * 4次元正五胞体（5-cell / Pentachoron）
 * 5頂点、10本のエッジ、10面、5胞で構成される4次元単体。
 * 4次元空間での二重回転（Double Rotation）と、線香花火のような白光の極細フィラメントを描画。
 */
export class Pentachoron {
  constructor() {
    this.group = new THREE.Group();

    // 4D 頂点定義（正五胞体の正多胞体座標）
    const r5 = 1 / Math.sqrt(5);
    this.baseVertices4D = [
      [ 1,  1,  1, -r5],
      [ 1, -1, -1, -r5],
      [-1,  1, -1, -r5],
      [-1, -1,  1, -r5],
      [ 0,  0,  0,  4 * r5]
    ].map(v => {
      // 原点中心にスケール正規化
      const len = Math.hypot(...v);
      return v.map(x => (x / len) * 1.35);
    });

    // 10本のエッジ定義 (全頂点間の組み合わせ: 5C2 = 10)
    this.edges = [];
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        this.edges.push([i, j]);
      }
    }

    // 4D 回転角
    this.rotAngles = {
      xy: 0, xz: 0, xw: 0,
      yz: 0, yw: 0, zw: 0
    };

    this.currentVertices3D = [];
    this.initMeshes();
  }

  initMeshes() {
    // 1. エッジ（線香花火の芯となる超高輝度フィラメント線）
    const edgeGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.edges.length * 2 * 3);
    const colors = new Float32Array(this.edges.length * 2 * 3);

    edgeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    edgeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // 線香花火の灼熱白芯マテリアル
    this.edgeMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      linewidth: 1.5
    });

    this.edgeLines = new THREE.LineSegments(edgeGeo, this.edgeMaterial);
    this.group.add(this.edgeLines);

    // 2. 5つの頂点（白熱発光核）
    const vertexGeo = new THREE.BufferGeometry();
    const vPositions = new Float32Array(5 * 3);
    vertexGeo.setAttribute('position', new THREE.BufferAttribute(vPositions, 3));

    // 頂点用グローマテリアル
    const sparkCanvas = this.createVertexSparkTexture();
    const sparkTex = new THREE.CanvasTexture(sparkCanvas);

    const vertexMat = new THREE.PointsMaterial({
      size: 0.35,
      map: sparkTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.vertexPoints = new THREE.Points(vertexGeo, vertexMat);
    this.group.add(this.vertexPoints);
  }

  createVertexSparkTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.2, 'rgba(255, 245, 220, 0.85)');
    g.addColorStop(0.5, 'rgba(100, 220, 255, 0.3)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  update(dt) {
    // 4D空間での滑らかな複合回転速度
    this.rotAngles.xw += dt * 0.45;
    this.rotAngles.yw += dt * 0.35;
    this.rotAngles.zw += dt * 0.25;
    this.rotAngles.xy += dt * 0.15;

    // 4D 回転行列の適用 & 3D透視射影
    const cameraDist4D = 2.4;
    this.currentVertices3D = [];

    const projected = this.baseVertices4D.map(v => {
      let [x, y, z, w] = v;

      // XW 平面回転
      let cos = Math.cos(this.rotAngles.xw), sin = Math.sin(this.rotAngles.xw);
      let x1 = x * cos - w * sin;
      let w1 = x * sin + w * cos;
      x = x1; w = w1;

      // YW 平面回転
      cos = Math.cos(this.rotAngles.yw); sin = Math.sin(this.rotAngles.yw);
      let y1 = y * cos - w * sin;
      let w2 = y * sin + w * cos;
      y = y1; w = w2;

      // ZW 平面回転
      cos = Math.cos(this.rotAngles.zw); sin = Math.sin(this.rotAngles.zw);
      let z1 = z * cos - w * sin;
      let w3 = z * sin + w * cos;
      z = z1; w = w3;

      // 4D → 3D 透視射影 (Stereographic / Perspective Projection)
      const scale = cameraDist4D / (cameraDist4D - w);
      const p3 = new THREE.Vector3(x * scale, y * scale, z * scale);
      this.currentVertices3D.push({ pos: p3, w: w, scale: scale });
      return p3;
    });

    // ジオメトリ頂点位置・カラー更新
    const edgePosAttr = this.edgeLines.geometry.attributes.position;
    const edgeColAttr = this.edgeLines.geometry.attributes.color;
    const vPosAttr = this.vertexPoints.geometry.attributes.position;

    let pIdx = 0;
    let cIdx = 0;

    for (let k = 0; k < this.edges.length; k++) {
      const [i, j] = this.edges[k];
      const vA = projected[i];
      const vB = projected[j];
      const wAvg = (this.currentVertices3D[i].w + this.currentVertices3D[j].w) * 0.5;

      edgePosAttr.array[pIdx++] = vA.x;
      edgePosAttr.array[pIdx++] = vA.y;
      edgePosAttr.array[pIdx++] = vA.z;

      edgePosAttr.array[pIdx++] = vB.x;
      edgePosAttr.array[pIdx++] = vB.y;
      edgePosAttr.array[pIdx++] = vB.z;

      // 4次元深度(w)に応じた明度・色相変調
      // 手前(w大): 超高輝度白熱金 / 奥(w小): 網膜残像シアンブルー
      const t = (wAvg + 1.2) / 2.4;
      const r = THREE.MathUtils.lerp(0.3, 1.0, t);
      const g = THREE.MathUtils.lerp(0.8, 0.98, t);
      const b = THREE.MathUtils.lerp(1.0, 0.9, t);

      for (let n = 0; n < 2; n++) {
        edgeColAttr.array[cIdx++] = r;
        edgeColAttr.array[cIdx++] = g;
        edgeColAttr.array[cIdx++] = b;
      }
    }

    for (let i = 0; i < 5; i++) {
      vPosAttr.array[i * 3] = projected[i].x;
      vPosAttr.array[i * 3 + 1] = projected[i].y;
      vPosAttr.array[i * 3 + 2] = projected[i].z;
    }

    edgePosAttr.needsUpdate = true;
    edgeColAttr.needsUpdate = true;
    vPosAttr.needsUpdate = true;

    return this.currentVertices3D;
  }
}