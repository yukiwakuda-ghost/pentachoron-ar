import * as THREE from 'three';

/**
 * 線香花火の松葉散華 & 網膜残像（Afterimage）パーティクル
 * 
 * 生理的光学現象の再現：
 * 1. 弾けた瞬間: 鋭い白金色（#FFFFFF, #FFF0D0）の微細な光芒
 * 2. 減衰時: エネルギーを失うと同時に、ヒトの網膜の受容体疲労による
 *    補色の残像（淡いコバルトシアン / インディゴ: #00E5FF, #2B44FF）が一瞬浮かび上がって消える。
 */
export class SparkleParticles {
  constructor(maxCount = 900) {
    this.maxCount = maxCount;
    this.particles = [];

    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(maxCount * 3);
    this.colors = new Float32Array(maxCount * 3);
    this.sizes = new Float32Array(maxCount);

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // 高解像度松葉スパークテクスチャ
    const sparkTex = new THREE.CanvasTexture(this.createSparkCanvas());

    this.material = new THREE.PointsMaterial({
      size: 0.18,
      map: sparkTex,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.material);

    // プール初期化
    for (let i = 0; i < maxCount; i++) {
      this.particles.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        baseSize: 0.1
      });
    }
  }

  createSparkCanvas() {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
    g.addColorStop(0.7, 'rgba(77, 226, 255, 0.25)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  spawn(origin, count = 3) {
    let spawned = 0;
    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      if (!p.alive) {
        p.alive = true;
        p.pos.copy(origin.pos);
        
        // 線香花火特有の鋭い線状放射（ランダムな方向へ弾け飛ぶ）
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 0.4 + Math.random() * 1.6;
        
        p.vel.set(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ).multiplyScalar(speed);

        p.life = 0;
        p.maxLife = 0.35 + Math.random() * 0.55; // 0.35〜0.9秒の刹那的な寿命
        p.baseSize = 0.08 + Math.random() * 0.14;

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  update(dt, vertices3D) {
    // 頂点から確率的に線香花火の火花を射出
    if (vertices3D && vertices3D.length > 0) {
      for (const v of vertices3D) {
        if (Math.random() < 0.65) {
          this.spawn(v, 2);
        }
      }
    }

    let activeCount = 0;
    const posArr = this.points.geometry.attributes.position.array;
    const colArr = this.points.geometry.attributes.color.array;

    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      const i3 = i * 3;

      if (p.alive) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.alive = false;
          posArr[i3] = 9999; // 画面外
          continue;
        }

        // 速度減衰（空気抵抗）+ わずかな重力
        p.vel.multiplyScalar(Math.pow(0.2, dt));
        p.vel.y -= 0.3 * dt;
        p.pos.addScaledVector(p.vel, dt);

        posArr[i3] = p.pos.x;
        posArr[i3 + 1] = p.pos.y;
        posArr[i3 + 2] = p.pos.z;

        // 生理的色相変化：白熱光 → 補色シアン残像
        const progress = p.life / p.maxLife; // 0.0 -> 1.0

        let r, g, b;
        if (progress < 0.35) {
          // 初期段階: 灼熱の白金色
          r = 1.0;
          g = 0.98;
          b = 0.92;
        } else {
          // 減衰・消失段階: 補色アフターイメージ（網膜残像シアン・インディゴ）
          const fade = (progress - 0.35) / 0.65;
          const alpha = 1.0 - fade;
          r = THREE.MathUtils.lerp(1.0, 0.05, fade) * alpha;
          g = THREE.MathUtils.lerp(0.98, 0.75, fade) * alpha;
          b = THREE.MathUtils.lerp(0.92, 1.0, fade) * alpha;
        }

        colArr[i3] = r;
        colArr[i3 + 1] = g;
        colArr[i3 + 2] = b;

        activeCount++;
      } else {
        posArr[i3] = 9999;
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}