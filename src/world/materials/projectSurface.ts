import type { MeshStandardMaterial } from 'three'
import { Color } from 'three'

/** Triplanar sampling keeps world scale without editing shared or UV-less geometry.
 * Existing effect shaders are untouched. Local projection follows animated timber. */
export function projectSurface(material: MeshStandardMaterial, tileMeters: number, terrain: boolean, terrainTint: string, options: { local?: boolean; weathered?: boolean; muted?: boolean } = {}): void {
  const { local = false, weathered = false, muted = false } = options
  material.customProgramCacheKey = () => `pbr-v2:${tileMeters}:${terrain}:${local}:${weathered}:${muted}`
  material.onBeforeCompile = (shader) => {
    shader.uniforms.pbrTileMeters = { value: tileMeters }
    shader.uniforms.pbrTerrainTint = { value: new Color(terrainTint) }
    const varyings = 'varying vec3 pbrPosition;\nvarying vec3 pbrNormal;\n'
    shader.vertexShader = varyings + shader.vertexShader
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        pbrNormal = ${local ? 'normalize(objectNormal)' : 'inverseTransformDirection(transformedNormal, viewMatrix)'};`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        pbrPosition = ${local ? 'transformed * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz))' : '(modelMatrix * vec4(transformed, 1.0)).xyz'};`)
    shader.fragmentShader = varyings + 'uniform float pbrTileMeters;\nuniform vec3 pbrTerrainTint;\n' + shader.fragmentShader
      .replace('#include <map_fragment>', `
        vec3 pbrN = normalize(pbrNormal);
        vec3 pbrSign = step(vec3(0.0), pbrN) * 2.0 - 1.0;
        vec3 pbrWeight = pow(abs(pbrN), vec3(4.0));
        pbrWeight /= dot(pbrWeight, vec3(1.0));
        vec2 pbrX = vec2(-pbrPosition.z * pbrSign.x, pbrPosition.y) / pbrTileMeters;
        vec2 pbrY = vec2(pbrPosition.x, -pbrPosition.z * pbrSign.y) / pbrTileMeters;
        vec2 pbrZ = vec2(pbrPosition.x * pbrSign.z, pbrPosition.y) / pbrTileMeters;
        float pbrMask = ${terrain ? '1.0 - smoothstep(2.2, 3.0, length(pbrPosition.xz - vec2(5.0, 19.0)))' : '1.0'};
        vec3 pbrColor = vec3(1.0);
        if (pbrMask > 0.0) {
          pbrColor = texture2D(map, pbrX).rgb * pbrWeight.x
            + texture2D(map, pbrY).rgb * pbrWeight.y + texture2D(map, pbrZ).rgb * pbrWeight.z;
        }
        ${muted ? 'pbrColor = mix(vec3(dot(pbrColor, vec3(0.2126, 0.7152, 0.0722))), pbrColor, 0.3);' : ''}
        ${weathered ? `
          float pbrWear = 0.5 + 0.5 * sin(pbrPosition.x * 0.73 + pbrPosition.z * 0.4) * sin(pbrPosition.y * 0.43 + pbrPosition.z * 0.6);
          pbrColor *= mix(0.88, 1.04, pbrWear);
          float pbrDamp = (1.0 - smoothstep(0.3, 4.0, pbrPosition.y)) * (0.12 + pbrWear * 0.2);
          pbrColor = mix(pbrColor, pbrColor * vec3(0.7, 0.82, 0.67), pbrDamp);
        ` : ''}
        ${terrain ? '' : 'diffuseColor.rgb *= pbrColor;'}
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${terrain ? 'diffuseColor.rgb = mix(diffuseColor.rgb, pbrColor * pbrTerrainTint, pbrMask);' : ''}`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        if (pbrMask > 0.0) {
          float pbrRoughness = texture2D(roughnessMap, pbrX).g * pbrWeight.x
            + texture2D(roughnessMap, pbrY).g * pbrWeight.y + texture2D(roughnessMap, pbrZ).g * pbrWeight.z;
          roughnessFactor *= mix(1.0, max(0.55, pbrRoughness), pbrMask);
        }
      `)
      .replace('#include <normal_fragment_maps>', `
        if (pbrMask > 0.0) {
        vec3 pbrNX = texture2D(normalMap, pbrX).xyz * 2.0 - 1.0;
        vec3 pbrNY = texture2D(normalMap, pbrY).xyz * 2.0 - 1.0;
        vec3 pbrNZ = texture2D(normalMap, pbrZ).xyz * 2.0 - 1.0;
        pbrNX.xy *= normalScale${local ? '' : ' / max(pbrNX.z, 0.2)'};
        pbrNY.xy *= normalScale${local ? '' : ' / max(pbrNY.z, 0.2)'};
        pbrNZ.xy *= normalScale${local ? '' : ' / max(pbrNZ.z, 0.2)'};
        ${local ? `
        vec2 pbrUv = pbrWeight.x > pbrWeight.y && pbrWeight.x > pbrWeight.z ? pbrX : (pbrWeight.y > pbrWeight.z ? pbrY : pbrZ);
        vec3 pbrMapN = pbrWeight.x > pbrWeight.y && pbrWeight.x > pbrWeight.z ? pbrNX : (pbrWeight.y > pbrWeight.z ? pbrNY : pbrNZ);
        normal = normalize(getTangentFrame(-vViewPosition, normal, pbrUv) * normalize(pbrMapN));
        ` : `
        // Tangent deviations preserve the geometric normal at projection blends.
        vec3 pbrDetail = vec3(0.0, pbrNX.y, -pbrSign.x * pbrNX.x) * pbrWeight.x
          + vec3(pbrNY.x, 0.0, -pbrSign.y * pbrNY.y) * pbrWeight.y
          + vec3(pbrSign.z * pbrNZ.x, pbrNZ.y, 0.0) * pbrWeight.z;
        pbrDetail = mat3(viewMatrix) * pbrDetail;
        normal = normalize(normal + pbrMask * (pbrDetail - normal * dot(pbrDetail, normal)));
        `}
        }
      `)
      .replace('#include <metalnessmap_fragment>', `
        float metalnessFactor = metalness;
        #ifdef USE_METALNESSMAP
          metalnessFactor *= texture2D(metalnessMap, pbrX).b * pbrWeight.x
            + texture2D(metalnessMap, pbrY).b * pbrWeight.y + texture2D(metalnessMap, pbrZ).b * pbrWeight.z;
        #endif
      `)
  }
}
