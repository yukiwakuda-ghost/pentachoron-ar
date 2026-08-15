import * as THREE from 'three';

/**
 * 点 (0D) → 正三角形 (2D) → 正四面体 (3D) → 正五胞体 (4D)
 * 空間中に点在し、ゆっくり座標遷移しながら現れる幾何学クラスター
 */
export class GeometryConstellation {
  constructor() {
    this.group = new THREE.Group();
    this.items = [];

    this.initPentaChoronMain();
    this.initTetrahedrons();
    this.initTriangles();
    this.initPoints();
  }

  // 1. メイン: 4次元回転・透視射影する正五胞体 (4D 5-cell)
  initPentaChoronMain() {
    const r5 = 1 / Math.sqrt(5);
    this.base4D = [
      [ 1,  1,  1, -r5],
      [ 1, -1, -1, -r5],
      [-1,  1, -1, -r5],
      [-1, -1,  1, -r5],
      [ 0,  0,  0,  4 * r5]
    ].map(v => {
      const len = Math.hypot(...v);
      return v.map(x => (x / len) * 0.95);
    });

    this.pEdges = [];
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        this.pEdges.push([i, j]);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pEdges.length * 2 * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.pEdges.length * 2 * 3), 3));

    // 線香花火のような白色・極細フィラメントマテリアル
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });

    this.pLines = new THREE.LineSegments(geo, mat);
    this.group.add(this.pLines);

    // 頂点の白熱核
    const vGeo = new THREE.BufferGeometry();
    vGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3));
    const sparkTex = new THREE.CanvasTexture(this.createSparkCoreTexture());
    this.pVertices = new THREE.Points(vGeo, new THREE.PointsMaterial({
      size: 0.25,
      map: sparkTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    this.group.add(this.pVertices);

    this.rot4D = { xw: 0, yw: 0, zw: 0 };
  }

  // 2. 空間に点在する正四面体（明滅するファセット面＋鋭いエッジ）
  initTetrahedrons() {
    this.tetraList = [];
    const count = 4;

    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const radius = 0.22 + Math.random() * 0.15;
      const geom = new THREE.TetrahedronGeometry(radius, 0);

      // 明滅する半透明面
      const faceMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        wireframe: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geom, faceMat);
      g.add(mesh);

      // 鋭いエッジライン
      const wireGeom = new THREE.WireframeGeometry(geom);
      const wireMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const wire = new THREE.LineSegments(wireGeom, wireMat);
      g.add(wire);

      // 配置・軌道パラメータ
      const basePos = new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        (Math.random() - 0.5) * 1.8,
        (Math.random() - 0.5) * 1.5
      );

      this.group.add(g);
      this.tetraList.push({
        group: g,
        mesh: mesh,
        wire: wire,
        basePos: basePos,
        speed: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  // 3. 空間に漂うシャープな正三角形 (2D Facets)
  initTriangles() {
    this.triList = [];
    const count = 6;

    for (let i = 0; i < count; i++) {
      const geo = new THREE.BufferGeometry();
      const r = 0.12 + Math.random() * 0.1;
      const verts = new Float32Array([
        0, r, 0,
        -r * 0.866, -r * 0.5, 0,
        r * 0.866, -r * 0.5, 0
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));

      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);

      const basePos = new THREE.Vector3(
        (Math.random() - 0.5) * 2.6,
        (Math.random() - 0.5) * 2.0,
        (Math.random() - 0.5) * 1.8
      );

      this.group.add(mesh);
      this.triList.push({
        mesh: mesh,
        basePos: basePos,
        speed: 0.5 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  // 4. 空間に点在する瞬く光の粒 (0D Points)
  initPoints() {
    const pCount = 50;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(pCount * 3);
    this.pointBasePos = [];

    for (let i = 0; i < pCount; i++) {
      const x = (Math.random() - 0.5) * 3.0;
      const y = (Math.random() - 0.5) * 2.5;
      const z = (Math.random() - 0.5) * 2.2;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      this.pointBasePos.push({ x, y, z, phase: Math.random() * Math.PI * 2 });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sparkTex = new THREE.CanvasTexture(this.createSparkCoreTexture());

    this.pointsCloud = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.08,
      map: sparkTex,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    this.group.add(this.pointsCloud);
  }

  createSparkCoreTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, '#fff6e0');
    g.addColorStop(0.65, 'rgba(0, 229, 255, 0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  update(dt, time) {
    const sparkOrigins = [];

    // --- 1. 正五胞体 4D透視射影更新 ---
    this.rot4D.xw += dt * 0.45;
    this.rot4D.yw += dt * 0.35;
    this.rot4D.zw += dt * 0.25;

    const cameraDist4D = 2.2;
    const projected3D = [];

    this.base4D.forEach(v => {
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

      const scale = cameraDist4D / (cameraDist4D - w);
      const p3 = new THREE.Vector3(x * scale, y * scale, z * scale);
      projected3D.push(p3);
      sparkOrigins.push(p3);
    });

    const edgePos = this.pLines.geometry.attributes.position.array;
    const edgeCol = this.pLines.geometry.attributes.color.array;
    let pIdx = 0, cIdx = 0;

    this.pEdges.forEach(([i, j]) => {
      const vA = projected3D[i];
      const vB = projected3D[j];
      const jitter = (Math.random() - 0.5) * 0.005; // 線香花火の微小チリチリ

      edgePos[pIdx++] = vA.x + jitter; edgePos[pIdx++] = vA.y + jitter; edgePos[pIdx++] = vA.z;
      edgePos[pIdx++] = vB.x - jitter; edgePos[pIdx++] = vB.y - jitter; edgePos[pIdx++] = vB.z;

      for (let n = 0; n < 2; n++) {
        edgeCol[cIdx++] = 1.0;
        edgeCol[cIdx++] = 0.98;
        edgeCol[cIdx++] = 0.92;
      }
    });

    const vPos = this.pVertices.geometry.attributes.position.array;
    projected3D.forEach((p, idx) => {
      vPos[idx * 3] = p.x; vPos[idx * 3 + 1] = p.y; vPos[idx * 3 + 2] = p.z;
    });

    this.pLines.geometry.attributes.position.needsUpdate = true;
    this.pLines.geometry.attributes.color.needsUpdate = true;
    this.pVertices.geometry.attributes.position.needsUpdate = true;

    // --- 2. 正四面体の空間浮遊 & 面の明滅 ---
    this.tetraList.forEach(t => {
      t.group.position.x = t.basePos.x + Math.sin(time * t.speed + t.phase) * 0.25;
      t.group.position.y = t.basePos.y + Math.cos(time * t.speed * 0.8 + t.phase) * 0.2;
      t.group.position.z = t.basePos.z + Math.sin(time * t.speed * 0.6 + t.phase) * 0.2;
      t.group.rotation.x += dt * t.speed * 0.8;
      t.group.rotation.y += dt * t.speed * 1.2;

      // 明滅（呼吸のようなパルス）
      const pulse = Math.pow(Math.sin(time * 2.5 + t.phase) * 0.5 + 0.5, 2);
      t.mesh.material.opacity = 0.15 + pulse * 0.45;
      t.wire.material.opacity = 0.5 + pulse * 0.5;

      if (Math.random() < 0.2) sparkOrigins.push(t.group.position);
    });

    // --- 3. 正三角形の明滅・回転 ---
    this.triList.forEach(tr => {
      tr.mesh.position.x = tr.basePos.x + Math.sin(time * tr.speed + tr.phase) * 0.3;
      tr.mesh.position.y = tr.basePos.y + Math.cos(time * tr.speed * 0.9 + tr.phase) * 0.25;
      tr.mesh.position.z = tr.basePos.z + Math.sin(time * tr.speed * 0.7 + tr.phase) * 0.2;
      tr.mesh.rotation.z += dt * tr.speed;
      tr.mesh.rotation.y += dt * tr.speed * 0.7;

      const pulse = Math.sin(time * 3.0 + tr.phase) * 0.5 + 0.5;
      tr.mesh.material.opacity = 0.1 + pulse * 0.4;
    });

    // --- 4. 点の瞬き ---
    const ptPos = this.pointsCloud.geometry.attributes.position.array;
    this.pointBasePos.forEach((p, idx) => {
      ptPos[idx * 3 + 1] = p.y + Math.sin(time * 1.2 + p.phase) * 0.08;
    });
    this.pointsCloud.geometry.attributes.position.needsUpdate = true;

    return sparkOrigins;
  }
}