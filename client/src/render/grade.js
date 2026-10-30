// Final colour-grade pass. Clean image by default (no TV noise); grain is an opt-in setting.
// uPoison: Poison Bloom trap — swimming, doubled, blurred sight with a sickly green tint.
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uFear: { value: 0 }, uHurt: { value: 0 }, uWarp: { value: 0 },
    uGrain: { value: 0 }, uVignette: { value: 1 }, uBright: { value: 1 }, uPoison: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uFear, uHurt, uWarp, uGrain, uVignette, uBright, uPoison; varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      uv.x += sin(uv.y * 40. + uTime * 3.) * 0.002 * uWarp;
      uv += vec2(sin(uv.y * 6. + uTime * 1.7), cos(uv.x * 5. + uTime * 1.3)) * 0.012 * uPoison; // the world swims
      vec2 dir = uv - 0.5; float d = length(dir);
      float ab = uFear * 0.004 + uWarp * 0.004 + uPoison * 0.01;
      vec3 col = ab > 0.0001
        ? vec3(texture2D(tDiffuse, uv + dir * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir * ab).b)
        : texture2D(tDiffuse, uv).rgb;
      if (uPoison > 0.001) { // blur + a ghosted double image drifting around
        vec3 acc = col; float r = 0.006 * uPoison;
        for (int i = 0; i < 8; i++) { float a = float(i) * 0.785; acc += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * r).rgb; }
        acc /= 9.;
        vec3 ghost = texture2D(tDiffuse, uv + vec2(sin(uTime * 0.9), cos(uTime * 0.7)) * 0.025 * uPoison).rgb;
        col = mix(col, mix(acc, ghost, 0.35), uPoison);
        col *= mix(vec3(1.), vec3(0.8, 1.05, 0.7), uPoison);
      }
      col *= uBright;
      float l = dot(col, vec3(.299,.587,.114));
      col = mix(col, vec3(l), 0.22) * vec3(0.92, 0.97, 1.06);
      col = mix(col, col * vec3(1.25, .55, .5), uHurt * smoothstep(.25, .8, d));
      col *= 1. - smoothstep(.5, 1.0, d) * (0.45 + uFear * 0.3 + uPoison * 0.3) * uVignette;
      col += (rand(uv * 999. + uTime) - .5) * 0.04 * uGrain;
      gl_FragColor = vec4(col, 1.);
    }`,
};
