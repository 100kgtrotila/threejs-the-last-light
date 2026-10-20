import * as THREE from 'three'

/** Vertex displacement and its analytic normal share the same wave function. */
export function animateOcean(material: THREE.MeshStandardMaterial) {
  const time = { value: 0 }, amplitude = { value: 1 }
  const compile = material.onBeforeCompile
  const cacheKey = material.customProgramCacheKey
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer)
    shader.uniforms.oceanTime = time
    shader.uniforms.oceanAmplitude = amplitude
    shader.vertexShader = `uniform float oceanTime; uniform float oceanAmplitude; varying float oceanHeight;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float waveA = position.x * 0.28 + position.z * 0.17 + oceanTime * 0.65;
        float waveB = position.z * 0.4 - position.x * 0.08 - oceanTime * 0.48;
        transformed.y = (sin(waveA) * 0.13 + sin(waveB) * 0.07) * oceanAmplitude;
        oceanHeight = transformed.y;
      `)
    // A restrained sky-colored reflection floor keeps wave crests legible without an environment map.
    shader.fragmentShader = `varying float oceanHeight;\n${shader.fragmentShader}`
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float crest = smoothstep(0.06, 0.19, oceanHeight);
        totalEmissiveRadiance += vec3(0.012, 0.026, 0.035) * (0.35 + crest * 0.65);`)
      .replace('#include <beginnormal_vertex>', `
        float normalA = position.x * 0.28 + position.z * 0.17 + oceanTime * 0.65;
        float normalB = position.z * 0.4 - position.x * 0.08 - oceanTime * 0.48;
        vec3 objectNormal = normalize(vec3(
          -(cos(normalA) * 0.13 * 0.28 - cos(normalB) * 0.07 * 0.08) * oceanAmplitude,
          1.0,
          -(cos(normalA) * 0.13 * 0.17 + cos(normalB) * 0.07 * 0.4) * oceanAmplitude));
      `)
  }
  material.customProgramCacheKey = () => 'last-light-ocean-v2'
  material.needsUpdate = true
  return {
    time, amplitude,
    dispose: () => {
      material.onBeforeCompile = compile
      material.customProgramCacheKey = cacheKey
      material.needsUpdate = true
    },
  }
}
