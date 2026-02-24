import { AdditiveBlending, ShaderMaterial } from "three";

export const flowParticleVertexShader = `
attribute vec3 aStart;
attribute vec3 aC1;
attribute vec3 aC2;
attribute vec3 aEnd;
attribute float aPhase;
attribute float aSpeed;
attribute float aOffset;
attribute float aSize;
attribute float aIntensity;
attribute float aVisibility;

uniform float uTime;
uniform float uPointScale;

varying float vIntensity;
varying float vVisibility;
varying float vProgress;

vec3 bezierPoint(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
  float u = 1.0 - t;
  float tt = t * t;
  float uu = u * u;
  float uuu = uu * u;
  float ttt = tt * t;
  return (uuu * p0) + (3.0 * uu * t * p1) + (3.0 * u * tt * p2) + (ttt * p3);
}

vec3 bezierTangent(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
  float u = 1.0 - t;
  return normalize(
    (3.0 * u * u * (p1 - p0)) +
    (6.0 * u * t * (p2 - p1)) +
    (3.0 * t * t * (p3 - p2))
  );
}

void main() {
  float t = fract(aPhase + uTime * aSpeed);
  vec3 pos = bezierPoint(aStart, aC1, aC2, aEnd, t);
  vec3 tangent = bezierTangent(aStart, aC1, aC2, aEnd, t);
  vec3 side = normalize(cross(tangent, vec3(0.0, 0.0, 1.0)));
  if (length(side) < 0.0001) {
    side = normalize(cross(tangent, vec3(0.0, 1.0, 0.0)));
  }
  pos += side * aOffset;
  pos.z += sin((aPhase + uTime) * 6.28318) * 0.08;

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;

  float depth = max(1.0, -mvPos.z);
  gl_PointSize = aSize * uPointScale * (230.0 / depth);

  vIntensity = aIntensity;
  vVisibility = aVisibility;
  vProgress = t;
}
`;

export const flowParticleFragmentShader = `
uniform float uTime;
uniform float uDayMix;
uniform float uGlobalAlpha;

varying float vIntensity;
varying float vVisibility;
varying float vProgress;

void main() {
  vec2 delta = gl_PointCoord - vec2(0.5);
  float radius = length(delta);
  float core = smoothstep(0.5, 0.0, radius);
  if (core < 0.02) {
    discard;
  }

  float pulse = 0.68 + 0.32 * sin(uTime * 2.4 + vProgress * 6.28318);
  vec3 nightA = vec3(0.15, 0.59, 1.0);
  vec3 dayA = vec3(0.12, 0.83, 0.98);
  vec3 nightB = vec3(1.0, 0.44, 0.72);
  vec3 dayB = vec3(1.0, 0.75, 0.28);
  vec3 colorA = mix(nightA, dayA, uDayMix);
  vec3 colorB = mix(nightB, dayB, uDayMix);
  vec3 color = mix(colorA, colorB, pow(vIntensity, 1.1));
  float alpha = core * (0.25 + 0.75 * vIntensity) * vVisibility * pulse * uGlobalAlpha;

  if (alpha < 0.02) {
    discard;
  }
  gl_FragColor = vec4(color * alpha * 1.7, alpha);
}
`;

export function createFlowParticleMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPointScale: { value: 1.0 },
      uDayMix: { value: 0 },
      uGlobalAlpha: { value: 1.0 }
    },
    vertexShader: flowParticleVertexShader,
    fragmentShader: flowParticleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending
  });
}
