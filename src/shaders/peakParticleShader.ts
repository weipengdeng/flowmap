import { AdditiveBlending, ShaderMaterial } from "three";

export const peakParticleVertexShader = `
attribute float aStrength;
uniform float uTime;
uniform float uPointScale;

varying float vStrength;

void main() {
  vec3 pos = position;
  pos.z += sin(uTime * 1.8 + position.x * 0.11 + position.y * 0.07) * 0.04;

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;

  float depth = max(1.0, -mvPos.z);
  gl_PointSize = mix(3.0, 9.0, aStrength) * uPointScale * (210.0 / depth);
  vStrength = aStrength;
}
`;

export const peakParticleFragmentShader = `
uniform float uDayMix;
uniform float uGlobalAlpha;
varying float vStrength;

void main() {
  vec2 delta = gl_PointCoord - vec2(0.5);
  float dist = length(delta);
  float alpha = smoothstep(0.5, 0.0, dist);
  if (alpha < 0.02) {
    discard;
  }

  vec3 nightCool = vec3(0.10, 0.42, 0.95);
  vec3 dayCool = vec3(0.23, 0.74, 1.0);
  vec3 nightWarm = vec3(1.0, 0.84, 0.34);
  vec3 dayWarm = vec3(1.0, 0.62, 0.20);
  vec3 cool = mix(nightCool, dayCool, uDayMix);
  vec3 warm = mix(nightWarm, dayWarm, uDayMix);
  vec3 base = mix(cool, warm, pow(vStrength, 1.25));
  float energy = 0.35 + 0.65 * vStrength;
  gl_FragColor = vec4(base * alpha * (1.2 + energy), alpha * energy * uGlobalAlpha);
}
`;

export function createPeakParticleMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPointScale: { value: 1.0 },
      uDayMix: { value: 0 },
      uGlobalAlpha: { value: 1.0 }
    },
    vertexShader: peakParticleVertexShader,
    fragmentShader: peakParticleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending
  });
}
