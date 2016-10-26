import {Geometry, Mesh, Object3D, Points} from 'three';
import {Color, DoubleSide, MeshPhongMaterial, PointsMaterial, VertexColors} from 'three';

export class GeometryHighlighter {
  constructor(geometry, scene) {
    this.setScene(scene);
    this.setGeometry(geometry);
  }

  setScene(scene) {
    this.scene = scene;
  }

  setGeometry(geometry) {
    this.geometry = geometry;
    this.polygons = geometry.polygons.map(p => new Object3D().add(

        new Mesh(
          Object.assign(new Geometry(), {vertices: geometry.vertices.slice(), faces: p.faces.slice()}),
          new MeshPhongMaterial({color: 0x00ffff, opacity: 0.8, transparent:true, side: DoubleSide})
        ),

        new Points(
          Object.assign(
            new Geometry(),
            {vertices: p.vertices.map(n => geometry.vertices[n])},
            {colors: p.vertices.map((n, i) => new Color(`hsl(${i*(360/p.vertices.length)}, 60%, 50%)`))}
          ),
          new PointsMaterial({vertexColors: VertexColors})
        )
    ));

    this.polygons.forEach(p => {
      p.visible = false;
      this.scene.add(p)
    });
  }

  highlightAll() {
    this.polygons.forEach(p => p.visible = true);
  }

  highlightNone() {
    this.polygons.forEach(p => p.visible = false);
  }

  highlight(n) {
    this.highlightNone();
    this.polygons[n].visible = true;
  }
}
