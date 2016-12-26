import Vue from 'vue';
import * as three from 'three';
import * as catalogs from './catalogs';
import project from './project';
import './components/preview';


const AVAILABLE_GEOMETRIES = {
  Tetrahedron: new three.TetrahedronGeometry(),
  Cube: new three.BoxGeometry(1, 1, 1),
  Octahedron: new three.OctahedronGeometry(),
  Dodecaheron: new three.DodecahedronGeometry(),
  Icosahedron: new three.IcosahedronGeometry()
};

new Vue({
  el: '#app',
  data: {
    selectedStars: [],
    selectedAsterisms: [],
    selectedGeometry: 'Dodecaheron',
    availableStars: [],
    availableAsterisms: [],
    availableGeometries: [
      'Tetrahedron',
      'Cube',
      'Octahedron',
      'Dodecaheron',
      'Icosahedron'
    ],
    filters: {
      magnitude: 4.75,
      selectedAsterisms: []
    }
  },

  created() {
    this.updateAsterisms().then(() => this.updateStars());
  },

  methods: {
    updateAsterisms() {
      return catalogs.loadAsterismCatalog({
        starCounts: {$elemMatch: {count: {$gt: 3}}}
      }).then(
        asterisms => {
          this.availableAsterisms = asterisms;
          this.selectedAsterisms = asterisms.map(({name}) => name);
        }
      );
    },

    updateStars() {
      let connectedStars = [...new Set([].concat(...this.availableAsterisms.map(a => a.stars)))];
      return catalogs.loadStarCatalog({
        $or: [
          {magnitude: {$lte: Number(this.filters.magnitude)}},
          {id: {$in: connectedStars}}
        ]
      }).then(stars => {
        console.log(`loaded ${stars.length} stars`);
        return this.availableStars = stars;
      });
    }
  },

  watch: {
    'filters.magnitude'() {
      this.updateStars();
    }
  },

  computed: {
    object() {
      return project(
        AVAILABLE_GEOMETRIES[this.selectedGeometry],
        this.availableStars,
        this.availableStars.length > 0 ? this.availableAsterisms : []
      );
    }
  }
});
