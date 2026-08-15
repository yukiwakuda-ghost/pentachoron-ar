// pentachoron.js - 4D正五胞体（5-cell）の生成と3D射影
// 5個の4次元頂点から辺・面・三角パーティクルを構築し、
// 4D回転→透視射影で3D座標に落とし込む。

import * as THREE from 'three';

// 4次元正五胞体（5-cell / regular simplex）の5頂点。
// R^5内で標準基底 e_i を頂点とし、重心が原点になるように平行移動、
// さらに 4D超平面 (sum=0) 上の直交基底に投影することで、
// すべての辺長が等しい正5胞体を R^4 上で厳密に構成する。
export function pentachoronVertices4D() {
  // e_i - (1/5, 1/5, 1/5, 1/5, 1/5)
  const raw = [];
  for (let i = 0; i < 5; i++) {
    const v = [-0.2, -0.2, -0.2, -0.2, -0.2];
    v[i] += 1.0;
    raw.push(v);
  }
  // 平面 sum(x)=0 の正規直交基底 B (5x4行列)。Gram-Schmidtで取得。
  const basis5 = [];
  const seeds = [
    [1, -1, 0, 0, 0],
    [1, 1, -2, 0, 0],
    [1, 1, 1, -3, 0],
    [1, 1, 1, 1, -4]
  ];
  for (const s of seeds) {
    const n = Math.hypot(...s);
    basis5.push(s.map(x => x / n));
  }
  // 各頂点を 4基底に投影 → R^4 座標
  const out = raw.map(v => basis5.map(b => {
    let d = 0;
    for (let i = 0; i < 5; i++) d += v[i] * b[i];
    return d;
  }));
  return out;
}

// 5C2 = 10本の辺（すべての頂点ペア）
export function pentachoronEdges() {
  const edges = [];
  for (let i = 0; i < 5; i++)
    for (let j = i+1; j < 5; j++)
      edges.push([i, j]);
  return edges;
}

// 5C3 = 10個の三角面
export function pentachoronFaces() {
  const faces = [];
  for (let i = 0; i < 5; i++)
    for (let j = i+1; j < 5; j++)
      for (let k = j+1; k < 5; k++)
        faces.push([i, j, k]);
  return faces;
}

// 4D→3D 透視射影（w軸方向）
export function project4Dto3D(v4, camW = 2.5) {
  const [x, y, z, w] = v4;
  const k = 1.0 / (camW - w);
  return new THREE.Vector3(x * k, y * k, z * k);
}

// 4D回転行列（XW面 / YW面 / ZW面での回転を合成）
// これにより「4次元での回転」が3D投影上でグニャリと変形する動きになる
export function rotate4D(v, aXW, aYW, aZW, aXY = 0) {
  let [x, y, z, w] = v;
  // XW
  let c = Math.cos(aXW), s = Math.sin(aXW);
  [x, w] = [c*x - s*w, s*x + c*w];
  // YW
  c = Math.cos(aYW); s = Math.sin(aYW);
  [y, w] = [c*y - s*w, s*y + c*w];
  // ZW
  c = Math.cos(aZW); s = Math.sin(aZW);
  [z, w] = [c*z - s*w, s*z + c*w];
  // XY (通常の3D回転成分も少しだけ)
  c = Math.cos(aXY); s = Math.sin(aXY);
  [x, y] = [c*x - s*y, s*x + c*y];
  return [x, y, z, w];
}

/**
 * Pentachoron メインオブジェクト
 *  - 10本のエッジをTubeGeometryで発光ラインとして描画
 *  - 10個の面を薄く明滅する半透明パネルとして描画
 *  - 5頂点を光の粒として描画
 */
export class Pentachoron {
  constructor(scale = 0.6) {
    this.scale = scale;
    this.baseVerts = pentachoronVertices4D();
    this.edges = pentachoronEdges();
    this.faces = pentachoronFaces();

    this.group = new THREE.Group();
    this.time = 0;

    // === Edges: 発光ライン ===
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const edgeGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(this.edges.length * 2 * 3);
    edgeGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.edgeLines = new THREE.LineSegments(edgeGeom, this.edgeMaterial);
    this.group.add(this.edgeLines);

    // === Faces: 半透明パネル ===
    this.faceMeshes = [];
    for (let i = 0; i < this.faces.length; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      const m = new THREE.MeshBasicMaterial({
        color: 0xcfefff,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(g, m);
      this.faceMeshes.push(mesh);
      this.group.add(mesh);
    }

    // === Vertices: 光の粒 ===
    const vertGeom = new THREE.BufferGeometry();
    vertGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(15), 3));
    const vertMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.045,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false
    });
    this.vertexPoints = new THREE.Points(vertGeom, vertMat);
    this.group.add(this.vertexPoints);
  }

  update(dt) {
    this.time += dt;
    const t = this.time;

    // 4D回転角
    const aXW = t * 0.35;
    const aYW = t * 0.27;
    const aZW = t * 0.19;
    const aXY = t * 0.05;

    // 各頂点を4D回転→3D射影
    const projected = this.baseVerts.map(v => {
      const r = rotate4D(v, aXW, aYW, aZW, aXY);
      return project4Dto3D(r).multiplyScalar(this.scale);
    });

    // Edges 更新
    const posAttr = this.edgeLines.geometry.attributes.position;
    for (let i = 0; i < this.edges.length; i++) {
      const [a, b] = this.edges[i];
      const va = projected[a], vb = projected[b];
      posAttr.setXYZ(i*2,   va.x, va.y, va.z);
      posAttr.setXYZ(i*2+1, vb.x, vb.y, vb.z);
    }
    posAttr.needsUpdate = true;

    // ラインの明滅（線香花火感）
    this.edgeMaterial.opacity = 0.75 + 0.25 * Math.sin(t * 8.0);

    // Faces 更新＋明滅
    for (let i = 0; i < this.faces.length; i++) {
      const [a, b, c] = this.faces[i];
      const g = this.faceMeshes[i].geometry;
      const p = g.attributes.position;
      const va = projected[a], vb = projected[b], vc = projected[c];
      p.setXYZ(0, va.x, va.y, va.z);
      p.setXYZ(1, vb.x, vb.y, vb.z);
      p.setXYZ(2, vc.x, vc.y, vc.z);
      p.needsUpdate = true;
      // 個別に位相ずれた明滅
      const blink = 0.03 + 0.09 * Math.abs(Math.sin(t * 2.0 + i * 0.7));
      this.faceMeshes[i].material.opacity = blink;
    }

    // Vertices 更新
    const vp = this.vertexPoints.geometry.attributes.position;
    for (let i = 0; i < 5; i++) {
      vp.setXYZ(i, projected[i].x, projected[i].y, projected[i].z);
    }
    vp.needsUpdate = true;
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }
}
