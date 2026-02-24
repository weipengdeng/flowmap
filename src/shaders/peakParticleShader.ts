import { AdditiveBlending, ShaderMaterial } from "three";

export const peakParticleVertexShader = `
attribute float aStrength;
attribute float aActivity;
attribute float aSeed;
attribute vec2 aDrift;

uniform float uTime;
uniform float uPointScale;

varying float vStrength;
varying float vActivity;
varying float vSeed;

void main() {
  float build = smoothstep(0.0, 1.0, aActivity);
  vec3 pos = position;

  // Gather-in behavior: particles start around nearby area and converge into the column.
  pos.xy += aDrift * (1.0 - build);
  pos.z = pos.z * (0.06 + 0.94 * build) + (1.0 - build) * 0.18;

  // Internal micro motion: each particle has its own random trajectory.
  float wobble = pow(aStrength, 1.85);
  float f1 = 0.65 + fract(aSeed * 7.31) * 1.85;
  float f2 = 0.75 + fract(aSeed * 11.17) * 2.05;
  float f3 = 0.85 + fract(aSeed * 5.13) * 2.25;
  float phase = aSeed * 37.0;
  float amp = (0.016 + wobble * 0.07) * (0.45 + 0.55 * build);
  pos.x += sin(uTime * f1 + phase) * amp;
  pos.y += cos(uTime * f2 + phase * 1.31) * amp;
  pos.z += sin(uTime * f3 + phase * 1.91) * amp * 1.35;

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;

  float depth = max(1.0, -mvPos.z);
  float size = mix(2.8, 8.8, aStrength) * (0.3 + 0.7 * build);
  gl_PointSize = size * uPointScale * (210.0 / depth);

  vStrength = aStrength;
  vActivity = build;
  vSeed = aSeed;
}
`;

export const peakParticleFragmentShader = `
uniform float uDayMix;
uniform float uGlobalAlpha;
uniform float uTime;

varying float vStrength;
varying float vActivity;
varying float vSeed;

void main() {
  vec2 delta = gl_PointCoord - vec2(0.5);
  float dist = length(delta);
  float alpha = smoothstep(0.5, 0.0, dist);
  if (alpha < 0.02) {
    discard;
  }

  vec3 nightCool = vec3(0.10, 0.42, 0.95);
  vec3 dayCool = vec3(0.45, 0.85, 1.0);
  vec3 nightWarm = vec3(1.0, 0.84, 0.34);
  vec3 dayWarm = vec3(1.0, 0.93, 0.80);
  vec3 cool = mix(nightCool, dayCool, uDayMix);
  vec3 warm = mix(nightWarm, dayWarm, uDayMix);
  vec3 base = mix(cool, warm, pow(vStrength, 1.22));

  float flicker = 0.9 + 0.1 * sin(uTime * 2.6 + vSeed * 41.0 + dist * 9.5);
  float coreBoost = 1.0 + vStrength * smoothstep(0.2, 0.0, dist) * 1.2;
  float energy = (0.32 + 0.68 * vStrength) * flicker;
  float outAlpha = alpha * energy * vActivity * uGlobalAlpha;

  if (outAlpha < 0.02) {
    discard;
  }
  gl_FragColor = vec4(base * outAlpha * (1.25 + energy) * coreBoost, outAlpha);
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

