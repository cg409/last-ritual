// Tall dead grass patches (camouflage): curved, tapered, colour-varied blades with wind sway (instanced).
import * as THREE from 'three';

export function buildGrass(group, map, density = 1) {
  const blade = new THREE.PlaneGeometry(0.09, 1.25, 1, 5); blade.translate(0, 0.62, 0);
  const bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i), t = y / 1.25;
    bp.setX(i, bp.getX(i) * (1 - t * 0.9));
    bp.setZ(i, t * t * 0.25); // natural curl
  }
  blade.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.95 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 }; mat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);
        float w = sin(uTime*1.4 + wp.x*0.35 + wp.z*0.27) + 0.4*sin(uTime*3.1 + wp.x*1.3);
        transformed.x += w * 0.1 * position.y * position.y;`);
  };
  mat.customProgramCacheKey = () => 'grass-wind';
  const per = (g) => Math.floor(g.r * g.r * 16 * density);
  const count = map.grass.reduce((n, g) => n + per(g), 0);
  const inst = new THREE.InstancedMesh(blade, mat, Math.max(1, count));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  let i = 0;
  for (const g of map.grass) {
    for (let k = 0; k < per(g); k++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * g.r;
      const edge = 1 - (d / g.r) * 0.5; // shorter at the patch edge
      m4.compose(p.set(g.x + Math.cos(a) * d, 0, g.z + Math.sin(a) * d), q.setFromEuler(e.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.35)), s.set(1, (0.7 + Math.random() * 0.7) * edge, 1));
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i++, col.setHSL(0.1 + Math.random() * 0.07, 0.3 + Math.random() * 0.15, 0.1 + Math.random() * 0.09));
    }
  }
  inst.receiveShadow = true;
  group.add(inst);
  group.userData.grassMat = mat;
}
