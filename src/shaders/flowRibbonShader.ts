import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, Texture } from "three";

export const FLOW_COLORS = [
  new Color("#3f88c5"),
  new Color("#00a896"),
  new Color("#f6aa1c"),
  new Color("#f26419")
];

export const flowRibbonVertexShader = `
attribute vec3 aTangent;
attribute float aSide;
attribute float aU;
attribute float aWidth;
attribute vec3 aCuts;
attribute float aV;

varying float vU;
varying vec3 vCuts;
varying float vV;
varying vec3 vWorldPos;

void main() {
  vec3 tangent = normalize(aTangent);
  vec3 up = vec3(0.0, 0.0, 1.0);
  vec3 sideDir = normalize(cross(tangent, up));
  if (length(sideDir) < 0.0001) {
    sideDir = normalize(cross(tangent, vec3(0.0, 1.0, 0.0)));
  }

  vec3 localPos = position + sideDir * aSide * aWidth * 0.5;
  vec4 worldPos = modelMatrix * vec4(localPos, 1.0);

  vU = aU;
  vCuts = aCuts;
  vV = aV;
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const flowRibbonFragmentShader = `
uniform sampler2D uAlphaMask;
uniform vec3 uColors[4];
uniform float uBaseAlpha;
uniform float uHighlight;
uniform float uTime;
uniform float uBrightness;

varying float vU;
varying vec3 vCuts;
varying float vV;
varying vec3 vWorldPos;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

vec3 pickBandColor() {
  vec3 c = uColors[0];
  if (vU > vCuts.x) c = uColors[1];
  if (vU > vCuts.y) c = uColors[2];
  if (vU > vCuts.z) c = uColors[3];
  return c;
}

void main() {
  vec2 uv = vec2(vU * 8.5 + uTime * 0.02, vV + noise(vWorldPos.xy * 0.13) * 0.25);
  float stroke = texture2D(uAlphaMask, uv).r;
  float grain = noise(vWorldPos.xy * 0.4 + vec2(uTime * 0.04, uTime * 0.07));
  float broken = stroke * (0.52 + 0.48 * grain);
  if (broken < 0.2) {
    discard;
  }

  float edge = smoothstep(0.0, 0.05, vU) * (1.0 - smoothstep(0.95, 1.0, vU));
  float highlight = mix(0.25, 1.0, uHighlight);
  float alpha = uBaseAlpha * broken * edge * highlight;
  vec3 color = pickBandColor() * (uBrightness + uHighlight * 1.25);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

export function createFlowRibbonMaterial(alphaMask: Texture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uAlphaMask: { value: alphaMask },
      uColors: { value: FLOW_COLORS },
      uBaseAlpha: { value: 0.65 },
      uHighlight: { value: 0.0 },
      uTime: { value: 0.0 },
      uBrightness: { value: 0.9 }
    },
    vertexShader: flowRibbonVertexShader,
    fragmentShader: flowRibbonFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide
  });
}

