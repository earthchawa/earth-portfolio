export const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWeights[5]; // how much of each shape (sums to 1)
  uniform float uTransit;    // 0 = settled on one shape, up to ~1 mid-morph
  uniform float uWarp;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform vec3 uAir;

  attribute vec3 aShape1;
  attribute vec3 aShape2;
  attribute vec3 aShape3;
  attribute vec3 aShape4;
  attribute float aRandom;
  attribute float aKind;   // 0 land · 1 ocean · 2 orange marker · 3 blue marker

  varying float vAlpha;
  varying vec3 vColor;

  // Staggers each particle a little so shapes dissolve instead of snapping
  float stage(float w) {
    return smoothstep(0.0, 1.0, clamp(w * 1.4 - aRandom * 0.4, 0.0, 1.0));
  }

  void main() {
    // Blend straight from the current shape(s) to the target — never through the ones in between
    float w0 = stage(uWeights[0]);
    float w1 = stage(uWeights[1]);
    float w2 = stage(uWeights[2]);
    float w3 = stage(uWeights[3]);
    float w4 = stage(uWeights[4]);
    vec3 p = (position * w0 + aShape1 * w1 + aShape2 * w2 + aShape3 * w3 + aShape4 * w4)
           / max(w0 + w1 + w2 + w3 + w4, 0.0001);

    p += normalize(p + 0.0001) * uTransit * aRandom * 0.8;

    p.x += sin(uTime * 0.8 + aRandom * 40.0) * 0.025;
    p.y += cos(uTime * 0.6 + aRandom * 30.0) * 0.025;
    p.z += uWarp * aRandom * 6.0;

    float globeW = smoothstep(0.5, 1.0, uWeights[0]);
    float alpha = 1.0;
    float size = 1.0;
    vec3 color = uColor;

    if (aKind > 0.5 && aKind < 1.5) {
      alpha = mix(1.0, 0.3, globeW);               // Ocean: faint blue
      color = mix(uColor, uAir, globeW * 0.85);
    } else if (aKind > 1.5) {
      float pulse = 0.5 + 0.5 * sin(uTime * 2.5);  // Markers: pulsing orange / blue
      alpha = mix(1.0, 1.4, globeW);
      size = mix(1.0, 1.3 + pulse * 0.7, globeW);
      color = mix(uColor, aKind > 2.5 ? uAir : uAccent, globeW);
    }

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.4 + aRandom) * size / max(-mv.z, 0.1);

    vAlpha = (0.3 + aRandom * 0.7) * alpha * smoothstep(0.5, 3.0, -mv.z);
    vColor = color;
  }
`;

export const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.05, d) * vAlpha * uOpacity;
    gl_FragColor = vec4(vColor, a);
  }
`;