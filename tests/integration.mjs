// integration.mjs - モジュール依存関係と参照整合性の静的検証
// import/export の整合、Three.js API 呼び出しの typo チェック。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsDir = path.join(root, 'js');

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
const contents = {};
for (const f of files) {
  contents[f] = fs.readFileSync(path.join(jsDir, f), 'utf8');
}

console.log("=== Module import/export integrity ===");

// 各ファイルのexports収集
const exportsMap = {};
for (const f of files) {
  const src = contents[f];
  const exps = new Set();
  const reExport = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g;
  let m;
  while ((m = reExport.exec(src))) exps.add(m[1]);
  // export { A, B }
  const reBrace = /export\s*\{([^}]+)\}/g;
  while ((m = reBrace.exec(src))) {
    m[1].split(',').forEach(n => exps.add(n.trim().split(/\s+as\s+/)[0]));
  }
  exportsMap[f] = exps;
  console.log(`  ${f} exports: ${[...exps].join(', ') || '(none)'}`);
}

// 各ファイルのlocal importsを検証
for (const f of files) {
  const src = contents[f];
  const reImport = /import\s+(?:\*\s+as\s+\w+|\{([^}]+)\}|\w+)\s+from\s+['"](\.\/[^'"]+)['"]/g;
  let m;
  while ((m = reImport.exec(src))) {
    const named = m[1];
    const target = m[2].replace(/^\.\//, '');
    check(`${f} imports './${target}' resolves`, fs.existsSync(path.join(jsDir, target)),
      `missing file ${target}`);
    if (named) {
      const wanted = named.split(',').map(x => x.trim().split(/\s+as\s+/)[0]);
      for (const w of wanted) {
        check(`  ${f} imports {${w}} exists in ${target}`,
          (exportsMap[target] || new Set()).has(w),
          `${w} not exported from ${target}`);
      }
    }
  }
}

console.log("\n=== Three.js API usage sanity ===");
// よくあるtypoをスキャン
const knownAPIs = [
  'WebGLRenderer', 'Scene', 'PerspectiveCamera', 'Vector3', 'Vector2',
  'Quaternion', 'Euler', 'Group', 'Mesh', 'Points', 'LineSegments',
  'BufferGeometry', 'BufferAttribute', 'TetrahedronGeometry', 'IcosahedronGeometry',
  'SphereGeometry', 'EdgesGeometry',
  'MeshBasicMaterial', 'MeshStandardMaterial', 'LineBasicMaterial', 'PointsMaterial',
  'PointLight', 'AmbientLight',
  'VideoTexture', 'CanvasTexture',
  'WebGLCubeRenderTarget', 'CubeCamera',
  'AdditiveBlending', 'DoubleSide',
  'ACESFilmicToneMapping', 'SRGBColorSpace',
  'LinearFilter', 'LinearMipmapLinearFilter',
  'MathUtils', 'Clock'
];
for (const f of files) {
  const src = contents[f];
  const re = /THREE\.(\w+)/g;
  let m;
  const used = new Set();
  while ((m = re.exec(src))) used.add(m[1]);
  for (const u of used) {
    check(`${f} uses THREE.${u}`, knownAPIs.includes(u), `unknown THREE API`);
  }
}

console.log("\n=== HTML/CSS reference check ===");
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const domIds = ['screen-intro','screen-motion','screen-camera','screen-ar','screen-result','screen-error',
  'btn-start','btn-motion','btn-motion-skip','btn-camera','btn-record','btn-back','btn-again','btn-retry',
  'btn-download','camera-video','three-canvas','hud-mode','hud-fps','hud-timer',
  'composite-progress','cp-percent','result-video','error-message'];
for (const id of domIds) {
  check(`index.html contains id="${id}"`, html.includes(`id="${id}"`));
}
// app.js が参照する id が実在するか
const app = contents['app.js'];
const reGetById = /\$\(['"]([^'"]+)['"]\)|getElementById\(['"]([^'"]+)['"]\)/g;
let mm;
while ((mm = reGetById.exec(app))) {
  const id = mm[1] || mm[2];
  check(`app.js references #${id} present in HTML`, html.includes(`id="${id}"`));
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
