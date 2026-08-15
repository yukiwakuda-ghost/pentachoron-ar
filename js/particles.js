import * as THREE from 'three';

/**
 * 線香花火の松葉散華 & 網膜残像（Afterimage）パーティクル
 */
export class SparkleParticles {
  constructor(maxCount = 800) {
    this.maxCount = maxCount;
    this.particles = [];

    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(maxCount * 3);
    this.colors = new Float32Array(maxCount * 3);

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const sparkTex = new THREE.CanvasTexture(this.createSparkCanvas());

    this.material = new THREE.PointsMaterial({
      size: 0.14,
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
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, '#fffbf0');
    g.addColorStop(0.7, 'rgba(0, 229, 255, 0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  spawn(pos) {
    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      if (!p.alive) {
        p.alive = true;
        p.pos.copy(pos);

        // 線香花火特有の鋭い線状放射（ランダムな方向へ弾け飛ぶ）
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const spd = 0.3 + Math.random() * 1.5;

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

  update(dt, origins) {
    if (origins && origins.length > 0) {
      origins.forEach(pos => {
        if (Math.random() < 0.45) {
          this.spawn(pos);
        }
      });
    }

    const posArr = this.points.geometry.attributes.position.array;
    const colArr = this.points.geometry.attributes.color.array;

    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      const i3 = i * 3;

      if (p.alive) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.alive = false;
          posArr[i3] = 9999;
          continue;
        }

        p.vel.multiplyScalar(Math.pow(0.18, dt));
        p.vel.y -= 0.25 * dt;
        p.pos.addScaledVector(p.vel, dt);

        posArr[i3] = p.pos.x;
        posArr[i3 + 1] = p.pos.y;
        posArr[i3 + 2] = p.pos.z;

        // 網膜残像：白熱（0.0〜0.4）→ 補色シアン（0.4〜1.0）
        const progress = p.life / p.maxLife;
        if (progress < 0.4) {
          colArr[i3] = 1.0;
          colArr[i3 + 1] = 0.98;
          colArr[i3 + 2] = 0.92;
        } else {
          const fade = (progress - 0.4) / 0.6;
          const a = 1.0 - fade;
          colArr[i3] = (0.05) * a;
          colArr[i3 + 1] = (0.85) * a;
          colArr[i3 + 2] = (1.0) * a; // 補色シアン
        }
      } else {
        posArr[i3] = 9999;
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}