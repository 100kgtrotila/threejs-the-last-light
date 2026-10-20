import * as THREE from 'three'

export class MeshLibrary {
  private readonly geometries = new Map<string, THREE.BufferGeometry>()

  private cached(key: string, create: () => THREE.BufferGeometry): THREE.BufferGeometry {
    const existing = this.geometries.get(key)
    if (existing) return existing
    const geometry = create()
    this.geometries.set(key, geometry)
    return geometry
  }

  mesh(parent: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position: THREE.Vector3Tuple, scale: THREE.Vector3Tuple = [1, 1, 1]): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.position.set(...position)
    mesh.scale.set(...scale)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  box(parent: THREE.Group, name: string, material: THREE.Material, size: THREE.Vector3Tuple, position: THREE.Vector3Tuple): THREE.Mesh {
    return this.mesh(parent, name, this.cached('box', () => new THREE.BoxGeometry(1, 1, 1)), material, position, size)
  }

  cylinder(parent: THREE.Group, name: string, material: THREE.Material, top: number, bottom: number, height: number, position: THREE.Vector3Tuple, sides = 8): THREE.Mesh {
    return this.mesh(parent, name, this.cached(`cylinder:${top}:${bottom}:${height}:${sides}`, () => new THREE.CylinderGeometry(top, bottom, height, sides)), material, position)
  }

  stone(parent: THREE.Group, name: string, material: THREE.Material, position: THREE.Vector3Tuple, scale: THREE.Vector3Tuple): THREE.Mesh {
    return this.mesh(parent, name, this.cached('icosahedron', () => new THREE.IcosahedronGeometry(1, 0)), material, position, scale)
  }

  arch(parent: THREE.Group, name: string, material: THREE.Material, width: number, height: number, depth: number, position: THREE.Vector3Tuple): THREE.Mesh {
    const geometry = this.cached(`arch:${width}:${height}:${depth}`, () => {
      const shape = new THREE.Shape()
      shape.moveTo(-width / 2, 0)
      shape.lineTo(width / 2, 0)
      shape.lineTo(width / 2, height * 0.56)
      shape.quadraticCurveTo(width / 2, height * 0.81, 0, height)
      shape.quadraticCurveTo(-width / 2, height * 0.81, -width / 2, height * 0.56)
      shape.closePath()
      const result = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 })
      result.translate(0, 0, -depth / 2)
      return result
    })
    return this.mesh(parent, name, geometry, material, position)
  }

  cross(parent: THREE.Group, name: string, material: THREE.Material, width: number, height: number, stem: number, arm: number, depth: number, position: THREE.Vector3Tuple): THREE.Mesh {
    const geometry = this.cached(`cross:${width}:${height}:${stem}:${arm}:${depth}`, () => {
      const bottom = height * 0.68 - arm / 2
      const top = bottom + arm
      const points = [
        [-stem / 2, 0], [stem / 2, 0], [stem / 2, bottom], [width / 2, bottom],
        [width / 2, top], [stem / 2, top], [stem / 2, height], [-stem / 2, height],
        [-stem / 2, top], [-width / 2, top], [-width / 2, bottom], [-stem / 2, bottom],
      ]
      const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
      const result = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
      result.translate(0, 0, -depth / 2)
      return result
    })
    return this.mesh(parent, name, geometry, material, position)
  }

  spire(parent: THREE.Group, name: string, material: THREE.Material, radius: number, height: number, position: THREE.Vector3Tuple, sides = 8): THREE.Mesh {
    const geometry = this.cached(`spire:${radius}:${height}:${sides}`, () => {
      const points: number[] = []
      for (let side = 0; side < sides; side += 1) {
        const a = side / sides * Math.PI * 2
        const b = (side + 1) / sides * Math.PI * 2
        points.push(Math.cos(a) * radius, 0, Math.sin(a) * radius, 0, height, 0, Math.cos(b) * radius, 0, Math.sin(b) * radius)
        points.push(0, 0, 0, Math.cos(a) * radius, 0, Math.sin(a) * radius, Math.cos(b) * radius, 0, Math.sin(b) * radius)
      }
      const result = new THREE.BufferGeometry()
      result.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
      result.computeVertexNormals()
      return result
    })
    return this.mesh(parent, name, geometry, material, position)
  }
}

export function disposeWorld(root: THREE.Object3D): void {
  root.removeFromParent()
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      geometries.add(object.geometry)
      const collection = Array.isArray(object.material) ? object.material : [object.material]
      collection.forEach((material) => materials.add(material))
    }
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}
