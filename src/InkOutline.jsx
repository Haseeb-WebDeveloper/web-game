import { forwardRef, useMemo } from 'react'
import { Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Color } from 'three'

// Screen-space ink outlines — depth edges (silhouettes) + luminance edges (detail),
// the same approach as the reference game's contour pass.
const fragmentShader = /* glsl */ `
  uniform float uMul;
  uniform vec3 uColor;

  float lumAt(const in vec2 p) {
    return dot(texture2D(inputBuffer, p).rgb, vec3(0.299, 0.587, 0.114));
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    vec2 t = texelSize * 1.4;

    float dC = getViewZ(depth);
    float dx = abs(getViewZ(readDepth(uv + vec2(t.x, 0.0))) - dC)
             + abs(getViewZ(readDepth(uv - vec2(t.x, 0.0))) - dC);
    float dy = abs(getViewZ(readDepth(uv + vec2(0.0, t.y))) - dC)
             + abs(getViewZ(readDepth(uv - vec2(0.0, t.y))) - dC);
    float rel = (dx + dy) / max(0.6, abs(dC));
    float edgeD = smoothstep(0.03, 0.09, rel);

    float gx = lumAt(uv + vec2(t.x, 0.0)) - lumAt(uv - vec2(t.x, 0.0));
    float gy = lumAt(uv + vec2(0.0, t.y)) - lumAt(uv - vec2(0.0, t.y));
    float edgeL = smoothstep(0.18, 0.45, sqrt(gx * gx + gy * gy));

    float edge = clamp(max(edgeD, edgeL * 0.7) * uMul, 0.0, 1.0);
    outputColor = vec4(mix(inputColor.rgb, uColor, edge * 0.85), inputColor.a);
  }
`

class InkOutlineEffect extends Effect {
  constructor({ strength = 1.0, color = '#1a1a1a' } = {}) {
    super('InkOutlineEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ['uMul', new Uniform(strength)],
        ['uColor', new Uniform(new Color(color))],
      ]),
    })
  }
}

const InkOutline = forwardRef(function InkOutline(props, ref) {
  const effect = useMemo(() => new InkOutlineEffect(props), [])
  return <primitive object={effect} ref={ref} dispose={null} />
})

export default InkOutline
