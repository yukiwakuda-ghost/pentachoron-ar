import * as THREE from 'three';

/**
 * 4次元正五胞体（5-cell / Pentachoron）
 * 5頂点、10エッジ、10面（正三角形ファセット）、5胞。
 * 3次元空間との交差射影、線香花火フィラメント、ファセット面の明滅を実装。
 */
export class Pentachoron {
  constructor() {
    this.group = new THREE.Group();

    const r5 = 1 / Math.sqrt(5);
    this.baseVertices4D = [
      [ 1,  1,  1, -r5],
      [ 1, -1, -1, -r5],
      [-1,  1, -1, -r5],
      [-1, -1,  1, -r5],
      [ 0,  0,  0,  4 * r5]
    ].map(v => {
      const len = Math.hypot(...v);
      return v.map(x => (x / len) * 0.85);
    });

    // 10本のエッジ
    this.edgeIndices = [];
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        this.edgeIndices.push([i, j]);
      }
    }

    // 10面の正三角形ファセット
    this.faceIndices = [];
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        for (let k = j + 1; k < 5; k++) {
          this.faceIndices.push([i, j, k]);
        }
      }
    }

    this.rot4D = { xw: 0, yw: 0, zw: 0, xy: 0 };
    this.initMeshes();
  }

  initMeshes() {
    // 1. 線香花火のような白色・極細フィラメントエッジ
    const edgeGeo = new THREE.BufferGeometry();
    const edgePos = new Float32Array(this.edgeIndices.length * 2 * 3);
    const edgeCol = new Float32Array(this.edgeIndices.length * 2 * 3);
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
    edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3));

    this.edgeMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    this.edgeLines = new THREE.LineSegments(edgeGeo, this.edgeMat);
    this.group.add(this.edgeLines);

    // 2. 空間で明滅するファセット面（半透明の正四面体セル面）
    const faceGeo = new THREE.BufferGeometry();
    const facePos = new Float32Array(this.faceIndices.length * 3 * 3);
    const faceCol = new Float32Array(this.faceIndices.length * 3 * 3);
    faceGeo.setAttribute('position', new THREE.BufferAttribute(facePos, 3));
    faceGeo.setAttribute('color', new THREE.BufferAttribute(faceCol, 3));

    this.faceMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.faceMesh = new THREE.Mesh(faceGeo, this.faceMat);
    this.group.add(this.faceMesh);

    // 3. 発光頂点（白色光核）
    const vGeo = new THREE.BufferGeometry();
    vGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3));
    const sparkTex = new THREE.CanvasTexture(this.createSparkCoreTexture());
    this.vPoints = new THREE.Points(vGeo, new THREE.PointsMaterial({
      size: 0.22,
      map: sparkTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    this.group.add(this.vPoints);
  }

  createSparkCoreTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.2, '#fff6e0');
    g.addColorStop(0.6, 'rgba(0, 229, 255, 0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  update(dt) {
    this.rot4D.xw += dt * 0.5;
    this.rot4D.yw += dt * 0.38;
    this.rot4D.zw += dt * 0.26;

    const cameraDist4D = 2.2;
    const projected3D = [];
    const raw4D = [];

    // 4D 二重回転 & 3D立体射影
    this.baseVertices4D.forEach(v => {
      let [x, y, z, w] = v;

      let c = Math.cos(this.rot4D.xw), s = Math.sin(this.rot4D.xw);
      let x1 = x * c - w * s; let w1 = x * s + w * c;
      x = x1; w = w1;

      c = Math.cos(this.rot4D.yw); s = Math.sin(this.rot4D.yw);
      let y1 = y * c - w * s; let w2 = y * s + w * c;
      y = y1; w = w2;

      c = Math.cos(this.rot4D.zw); s = Math.sin(this.rot4D.zw);
      let z1 = z * c - w * s; let w3 = z * s + w * c;
      z = z1; w = w3;

      raw4D.push({ x, y, z, w });
      const scale = cameraDist4D / (cameraDist4D - w);
      projected3D.push(new THREE.Vector3(x * scale, y * scale, z * scale));
    });

    // エッジ更新（チリチリとした線香花火の光彩）
    const edgePos = this.edgeLines.geometry.attributes.position.array;
    const edgeCol = this.edgeLines.geometry.attributes.color.array;
    let pIdx = 0, cIdx = 0;

    this.edgeIndices.forEach(([i, j]) => {
      const vA = projected3D[i];
      const vB = projected3D[j];
      const wAvg = (raw4D[i].w + raw4D[j].w) * 0.5;

      // 線香花火の微小なチリチリ振動
      const jitter = (Math.random() - 0.5) * 0.006;

      edgePos[pIdx++] = vA.x + jitter; edgePos[pIdx++] = vA.y + jitter; edgePos[pIdx++] = vA.z;
      edgePos[pIdx++] = vB.x - jitter; edgePos[pIdx++] = vB.y - jitter; edgePos[pIdx++] = vB.z;

      // 4次元深度に応じた超高輝度白色 / 補色シアンのフェード
      const bright = Math.sin(performance.now() * 0.01 + wAvg * 5) * 0.15 + 0.85;
      for (let n = 0; n < 2; n++) {
        edgeCol[cIdx++] = 1.0 * bright;
        edgeCol[cIdx++] = 0.98 * bright;
        edgeCol[cIdx++] = 0.92 * bright;
      }
    });

    // ファセット面の明滅更新
    const facePos = this.faceMesh.geometry.attributes.position.array;
    const faceCol = this.faceMesh.geometry.attributes.color.array;
    let fpIdx = 0, fcIdx = 0;

    this.faceIndices.forEach(([i, j, k], idx) => {
      const pA = projected3D[i], pB = projected3D[j], pC = projected3D[k];
      const wAvg = (raw4D[i].w + raw4D[j].w + raw4D[k].w) / 3;

      facePos[fpIdx++] = pA.x; facePos[fpIdx++] = pA.y; facePos[fpIdx++] = pA.z;
      facePos[fpIdx++] = pB.x; facePos[fpIdx++] = pB.y; facePos[fpIdx++] = pB.z;
      facePos[fpIdx++] = pC.x; facePos[fpIdx++] = pC.y; facePos[fpIdx++] = pC.z;

      // 空間交差時に面がパルス発光
      const pulse = Math.max(0, Math.sin(performance.now() * 0.005 + idx * 1.5 + wAvg * 3));
      for (let n = 0; n < 3; n++) {
        faceCol[fcIdx++] = 0.85 * pulse;
        faceCol[fcIdx++] = 0.95 * pulse;
        faceCol[fcIdx++] = 1.0 * pulse;
      }
    });

    // 頂点位置
    const vPos = this.vPoints.geometry.attributes.position.array;
    projected3D.forEach((p, idx) => {
      vPos[idx * 3] = p.x; vPos[idx * 3 + 1] = p.y; vPos[idx * 3 + 2] = p.z;
    });

    this.edgeLines.geometry.attributes.position.needsUpdate = true;
    this.edgeLines.geometry.attributes.color.needsUpdate = true;
    this.faceMesh.geometry.attributes.position.needsUpdate = true;
    this.faceMesh.geometry.attributes.color.needsUpdate = true;
    this.vPoints.geometry.attributes.position.needsUpdate = true;

    return { vertices: projected3D, faces: this.faceIndices };
  }
}