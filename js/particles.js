import * as THREE from 'three';

/**
 * 空間に散る正四面体（Tetrahedron）の光粒 & 松葉状スパーク（線香花火の散華）
 */
export class SparkleParticles {
  constructor(maxCount = 1000) {
    this.maxCount = maxCount;
    this.particles = [];

    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(maxCount * 3);
    this.colors = new Float32Array(maxCount * 3);
    this.sizes = new Float32Array(maxCount);

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const sparkTex = new THREE.CanvasTexture(this.createSparkCanvas());

    this.material = new THREE.PointsMaterial({
      size: 0.12,
      map: sparkTex,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.material);

    for (let i = 0; i < maxCount; i++) {
      this.particles.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.5
      });
    }
  }

  createSparkCanvas() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    // 正四面体のシャープな結晶状ファセット光
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(16, 2);
    ctx.lineTo(28, 26);
    ctx.lineTo(4, 26);
    ctx.closePath();
    ctx.fill();
    return c;
  }

  spawn(pos) {
    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      if (!p.alive) {
        p.alive = true;
        p.pos.copy(pos);

        // 松葉のように鋭角に弾け飛ぶ速度ベクトル
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const spd = 0.3 + Math.random() * 1.4;

        p.vel.set(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ).multiplyScalar(spd);

        p.life = 0;
        p.maxLife = 0.3 + Math.random() * 0.45;
        break;
      }
    }
  }

  update(dt, vertices) {
    if (vertices) {
      vertices.forEach(v => {
        if (Math.random() < 0.4) this.spawn(v);
      });
    }

    const pos = this.points.geometry.attributes.position.array;
    const col = this.points.geometry.attributes.color.array;

    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      const i3 = i * 3;

      if (p.alive) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.alive = false;
          pos[i3] = 9999;
          continue;
        }

        p.vel.multiplyScalar(Math.pow(0.15, dt));
        p.vel.y -= 0.25 * dt; // 微小な重力沈降
        p.pos.addScaledVector(p.vel, dt);

        pos[i3] = p.pos.x; pos[i3 + 1] = p.pos.y; pos[i3 + 2] = p.pos.z;

        // 網膜残像（消失直前に一瞬だけ淡いシアンの補色が浮かぶ）
        const progress = p.life / p.maxLife;
        if (progress < 0.4) {
          col[i3] = 1.0; col[i3 + 1] = 0.98; col[i3 + 2] = 0.95; // 白熱
        } else {
          const fade = (progress - 0.4) / 0.6;
          const a = 1.0 - fade;
          col[i3] = (0.05) * a;
          col[i3 + 1] = (0.85) * a;
          col[i3 + 2] = (1.0) * a; // 補色シアン
        }
      } else {
        pos[i3] = 9999;
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}