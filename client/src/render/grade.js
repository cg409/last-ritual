// Final colour-grade pass. Clean image by default (no TV noise); grain is an opt-in setting.
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uFear: { value: 0 }, uHurt: { value: 0 }, uWarp: { value: 0 },
    uGrain: { value: 0 }, uVignette: { value: 1 }, uBright: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uFear, uHurt, uWarp, uGrain, uVignette, uBright; varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      uv.x += sin(uv.y * 40. + uTime * 3.) * 0.002 * uWarp;
      vec2 dir = uv - 0.5; float d = length(dir);
      float ab = uFear * 0.004 + uWarp * 0.004;
      vec3 col = ab > 0.0001
        ? vec3(texture2D(tDiffuse, uv + dir * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir * ab).b)
        : texture2D(tDiffuse, uv).rgb;
      col *= uBright;
      float l = dot(col, vec3(.299,.587,.114));
      col = mix(col, vec3(l), 0.22) * vec3(0.92, 0.97, 1.06);
      col = mix(col, col * vec3(1.25, .55, .5), uHurt * smoothstep(.25, .8, d));
      col *= 1. - smoothstep(.5, 1.0, d) * (0.45 + uFear * 0.3) * uVignette;
      col += (rand(uv * 999. + uTime) - .5) * 0.04 * uGrain;
      gl_FragColor = vec4(col, 1.);
    }`,
};
