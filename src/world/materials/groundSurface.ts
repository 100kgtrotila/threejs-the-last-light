import { Color, Vector2 } from 'three'
import type { MeshStandardMaterial } from 'three'
import { WORLD_LAYOUT } from '../layout.ts'

/** One opaque surface, with no overlays: authored path colors drive the worn routes.
 * XZ projection needs no UV edits. Texture sets are shared with the stone props. */
export function projectGround(material: MeshStandardMaterial, stone: MeshStandardMaterial, moss: MeshStandardMaterial): void {
  material.customProgramCacheKey = () => 'environment-ground-v1'
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      groundStone: { value: stone.map }, groundStoneNormal: { value: stone.normalMap }, groundStoneRoughness: { value: stone.roughnessMap },
      groundMoss: { value: moss.map }, groundMossNormal: { value: moss.normalMap }, groundMossRoughness: { value: moss.roughnessMap },
      groundBoundary: { value: new Vector2(WORLD_LAYOUT.visibleBoundary.radiusX, WORLD_LAYOUT.visibleBoundary.radiusZ) },
      groundSoilTint: { value: new Color('#a7b5ba') }, groundStoneTint: { value: new Color('#9aaeb8') }, groundMossTint: { value: new Color('#728778') },
    })
    shader.vertexShader = 'varying vec3 groundPosition;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      groundPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
    shader.fragmentShader = `
      varying vec3 groundPosition;
      uniform sampler2D groundStone, groundStoneNormal, groundStoneRoughness;
      uniform sampler2D groundMoss, groundMossNormal, groundMossRoughness;
      uniform vec2 groundBoundary;
      uniform vec3 groundSoilTint, groundStoneTint, groundMossTint;
    ` + shader.fragmentShader
      .replace('#include <map_fragment>', '')
      .replace('#include <color_fragment>', `
        // terrain.ts encodes dirt routes in the red channel (grass ~0.04, dirt ~0.17).
        float groundPath = smoothstep(0.065, 0.145, vColor.r);
        float groundCoast = smoothstep(0.76, 0.95, length(groundPosition.xz / groundBoundary));
        float groundNoise = 0.5 + 0.5 * sin(groundPosition.x * 0.29 + sin(groundPosition.z * 0.37)) * sin(groundPosition.z * 0.43);
        float groundMossWeight = (1.0 - groundPath) * (1.0 - groundCoast) * smoothstep(0.25, 0.8, groundNoise) * 0.4;
        float groundStoneWeight = max(groundPath * (0.62 + groundNoise * 0.2), groundCoast);
        float groundSoilWeight = 1.0 - groundStoneWeight - groundMossWeight;
        vec2 groundSoilUv = vec2(groundPosition.x, -groundPosition.z) / 2.0;
        vec2 groundStoneUv = vec2(groundPosition.x, -groundPosition.z) / 1.5;
        vec2 groundMossUv = vec2(groundPosition.x, -groundPosition.z) / 3.0;
        vec3 groundColor = vec3(0.0);
        float groundRoughness = 0.0;
        vec3 groundMapNormal = vec3(0.0);
        if (groundSoilWeight > 0.001) {
          groundColor += texture2D(map, groundSoilUv).rgb * groundSoilTint * groundSoilWeight;
          groundRoughness += texture2D(roughnessMap, groundSoilUv).g * groundSoilWeight;
          groundMapNormal += (texture2D(normalMap, groundSoilUv).rgb * 2.0 - 1.0) * groundSoilWeight;
        }
        if (groundStoneWeight > 0.001) {
          groundColor += texture2D(groundStone, groundStoneUv).rgb * groundStoneTint * groundStoneWeight;
          groundRoughness += texture2D(groundStoneRoughness, groundStoneUv).g * groundStoneWeight;
          groundMapNormal += (texture2D(groundStoneNormal, groundStoneUv).rgb * 2.0 - 1.0) * groundStoneWeight;
        }
        if (groundMossWeight > 0.001) {
          groundColor += texture2D(groundMoss, groundMossUv).rgb * groundMossTint * groundMossWeight;
          groundRoughness += texture2D(groundMossRoughness, groundMossUv).g * groundMossWeight;
          groundMapNormal += (texture2D(groundMossNormal, groundMossUv).rgb * 2.0 - 1.0) * groundMossWeight;
        }
        // Restrain saturation and repeated patterns while retaining brighter path silhouettes.
        groundColor = mix(vec3(dot(groundColor, vec3(0.2126, 0.7152, 0.0722))), groundColor, 0.55);
        diffuseColor.rgb = groundColor * mix(0.88, 1.08, groundNoise) * mix(0.8, 1.2, groundPath);
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = max(0.65, groundRoughness);')
      .replace('#include <normal_fragment_maps>', `
        groundMapNormal.xy *= normalScale;
        normal = normalize(getTangentFrame(-vViewPosition, normal, groundSoilUv) * normalize(groundMapNormal));
      `)
  }
}
