// particles.js - 周囲に散る細かい△と正四面体の光の粒
// メインの正五胞体の周辺で明滅・移動する装飾パーティクル群。

import * as THREE from 'three';

/**
 * TetrahedronCluster - 小さい正四面体をシャープに光らせる粒
 */
export class TetrahedronCluster {
  constructor(count = 24) {
    this.count = count;
    this.group = new THREE.Group();
    this.items = [];

    const baseGeom = new THREE.TetrahedronGeometry(1.0, 0);
    // エッジ（線香花火風の鋭い光）
    const edgeGeom = new THREE.EdgesGeometry(baseGeom);

    for (let i = 0; i < count; i++) {
      const size = THREE.MathUtils.randFloat(0.015, 0.06);
      const scaledEdge = edgeGeom.clone();
      scaledEdge.scale(size, size, size);

      const mat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const line = new THREE.LineSegments(scaledEdge, mat);

      // 大きめの粒には面のちらつきも
      let face = null;
      if (size > 0.035) {
        const fgeom = new THREE.TetrahedronGeometry(size, 0);
        const fmat = new THREE.MeshBasicMaterial({
          color: 0xcfefff,
          transparent: true,
          opacity: 0.15,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        face = new THREE.Mesh(fgeom, fmat);
        line.add(face);
      }

      const item = {
        line,
        face,
        size,
        // 球状にランダム配置
        origin: this._randomInSphere(1.2),
        target: this._randomInSphere(1.2),
        transitionTime: 0,
        transitionDuration: THREE.MathUtils.randFloat(2.0, 5.0),
        rotSpeed: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(1.0),
          THREE.MathUtils.randFloatSpread(1.0),
          THREE.MathUtils.randFloatSpread(1.0)
        ),
        phase: Math.random() * Math.PI * 2,
        blinkSpeed: THREE.MathUtils.randFloat(3.0, 9.0),
        life: Math.random(),
        lifeSpeed: THREE.MathUtils.randFloat(0.2, 0.6)
      };
      line.position.copy(item.origin);
      this.items.push(item);
      this.group.add(line);
    }
  }

  _randomInSphere(radius) {
    const u = Math.random();
    const r = radius * Math.cbrt(u);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
  }

  update(dt) {
    for (const it of this.items) {
      // 位置遷移
      it.transitionTime += dt;
      const p = Math.min(it.transitionTime / it.transitionDuration, 1.0);
      // easeInOut
      const e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2)/2;
      it.line.position.lerpVectors(it.origin, it.target, e);
      if (p >= 1.0) {
        it.origin.copy(it.target);
        it.target.copy(this._randomInSphere(1.2));
        it.transitionTime = 0;
        it.transitionDuration = THREE.MathUtils.randFloat(2.0, 5.0);
      }

      // 回転
      it.line.rotation.x += it.rotSpeed.x * dt;
      it.line.rotation.y += it.rotSpeed.y * dt;
      it.line.rotation.z += it.rotSpeed.z * dt;

      // 明滅
      it.phase += dt * it.blinkSpeed;
      const flicker = 0.4 + 0.6 * Math.abs(Math.sin(it.phase));
      // life サイクル（フェード付き）
      it.life += dt * it.lifeSpeed;
      if (it.life > 1.0) it.life = 0;
      const lifeFade = Math.sin(it.life * Math.PI); // 0→1→0
      it.line.material.opacity = flicker * lifeFade * 0.95;
      if (it.face) {
        it.face.material.opacity = flicker * lifeFade * 0.18;
      }
    }
  }
}

/**
 * TrianglePoints - 極小の△点群（GPUで軽量に）
 * PointsMaterial + カスタムテクスチャで△の形にする。
 */
export class TrianglePoints {
  constructor(count = 180) {
    this.count = count;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = THREE.MathUtils.randFloat(0.4, 1.6);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i*3+2] = r * Math.cos(phi);
      phases[i] = Math.random() * Math.PI * 2;
    }
    this.phases = phases;
    this.basePositions = positions.slice();

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // △形のCanvasテクスチャ
    const tex = this._makeTriangleTexture();

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.06,
      map: tex,
      transparent: true,
      alphaTest: 0.01,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    this.points = new THREE.Points(geom, mat);
    this.time = 0;
  }

  _makeTriangleTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const cx = size/2, cy = size/2, r = size*0.42;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI/2 + i * (Math.PI*2/3);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    // グロー
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,255,255,1.0)');
    grad.addColorStop(0.6, 'rgba(220,240,255,0.6)');
    grad.addColorStop(1.0, 'rgba(180,220,255,0.0)');
    ctx.fillStyle = grad;
    ctx.fill();
    // 縁
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }

  update(dt) {
    this.time += dt;
    const pos = this.points.geometry.attributes.position;
    // ゆらぎ
    for (let i = 0; i < this.count; i++) {
      const bx = this.basePositions[i*3];
      const by = this.basePositions[i*3+1];
      const bz = this.basePositions[i*3+2];
      const ph = this.phases[i];
      const wob = 0.03;
      pos.array[i*3]   = bx + Math.sin(this.time*1.3 + ph) * wob;
      pos.array[i*3+1] = by + Math.cos(this.time*1.1 + ph*1.3) * wob;
      pos.array[i*3+2] = bz + Math.sin(this.time*0.9 + ph*0.7) * wob;
    }
    pos.needsUpdate = true;
    // 全体の明滅
    this.points.material.opacity = 0.6 + 0.4 * Math.abs(Math.sin(this.time*4.0));
  }
}
