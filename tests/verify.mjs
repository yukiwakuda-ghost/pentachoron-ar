// verify.mjs - コアロジックの単体検証（Three.js非依存部分だけ抽出テスト）
// 4D頂点の対称性・辺長の一様性・射影後の座標範囲を確認する。

function pentachoronVertices4D() {
  const raw = [];
  for (let i = 0; i < 5; i++) {
    const v = [-0.2, -0.2, -0.2, -0.2, -0.2];
    v[i] += 1.0;
    raw.push(v);
  }
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
  return raw.map(v => basis5.map(b => {
    let d = 0;
    for (let i = 0; i < 5; i++) d += v[i] * b[i];
    return d;
  }));
}

function dist4(a, b) {
  let s = 0;
  for (let i = 0; i < 4; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

function project4Dto3D(v4, camW = 2.5) {
  const [x, y, z, w] = v4;
  const k = 1.0 / (camW - w);
  return [x*k, y*k, z*k];
}

function rotate4D(v, aXW, aYW, aZW, aXY = 0) {
  let [x, y, z, w] = v;
  let c = Math.cos(aXW), s = Math.sin(aXW);
  [x, w] = [c*x - s*w, s*x + c*w];
  c = Math.cos(aYW); s = Math.sin(aYW);
  [y, w] = [c*y - s*w, s*y + c*w];
  c = Math.cos(aZW); s = Math.sin(aZW);
  [z, w] = [c*z - s*w, s*z + c*w];
  c = Math.cos(aXY); s = Math.sin(aXY);
  [x, y] = [c*x - s*y, s*x + c*y];
  return [x, y, z, w];
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name}`); fail++; }
}

console.log("=== Pentachoron 4D verification ===");
const V = pentachoronVertices4D();
console.log(`Vertices: ${V.length}`);

// 全10辺の長さが同じか（正五胞体の定義）
const lens = [];
for (let i = 0; i < 5; i++)
  for (let j = i+1; j < 5; j++)
    lens.push(dist4(V[i], V[j]));
const meanL = lens.reduce((a,b)=>a+b,0) / lens.length;
const maxDev = Math.max(...lens.map(l => Math.abs(l - meanL)));
console.log(`  edge count = ${lens.length}, mean length = ${meanL.toFixed(6)}, max dev = ${maxDev.toExponential(3)}`);
check("all 10 edges equal length (regular 5-cell)", maxDev < 1e-6);

// 重心が原点付近
const centroid = [0,0,0,0];
V.forEach(v => v.forEach((c,i) => centroid[i] += c/5));
const cn = Math.hypot(...centroid);
console.log(`  centroid norm = ${cn.toExponential(3)}`);
check("centroid at origin", cn < 1e-9);

// 4D回転してもエッジ長が保存されるか
const R = V.map(v => rotate4D(v, 0.7, 1.1, 0.3, 0.5));
let ok = true;
for (let i = 0; i < 5; i++)
  for (let j = i+1; j < 5; j++) {
    const before = dist4(V[i], V[j]);
    const after  = dist4(R[i], R[j]);
    if (Math.abs(before - after) > 1e-9) ok = false;
  }
check("4D rotation preserves edge lengths", ok);

// 3D射影後の座標範囲チェック
console.log("=== 4D→3D projection sanity ===");
let minC = Infinity, maxC = -Infinity;
for (let step = 0; step < 60; step++) {
  const t = step * 0.05;
  const rot = V.map(v => rotate4D(v, t*0.35, t*0.27, t*0.19, t*0.05));
  const proj = rot.map(v => project4Dto3D(v));
  proj.forEach(p => p.forEach(c => {
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }));
}
console.log(`  projected range: [${minC.toFixed(4)}, ${maxC.toFixed(4)}]`);
check("projected coordinates stay finite and bounded", isFinite(minC) && isFinite(maxC) && maxC - minC < 20);

// パーティクル球面分布のサニティ
console.log("=== Particle spherical distribution ===");
function randomInSphere(radius) {
  const u = Math.random();
  const r = radius * Math.cbrt(u);
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  ];
}
let maxR = 0;
for (let i = 0; i < 5000; i++) {
  const p = randomInSphere(1.2);
  const r = Math.hypot(...p);
  if (r > maxR) maxR = r;
}
console.log(`  max radius in 5000 samples = ${maxR.toFixed(4)} (limit 1.2)`);
check("no particle escapes sphere radius", maxR <= 1.201);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
