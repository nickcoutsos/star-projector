import Vue from 'vue';
import vueAsyncComputed from 'vue-async-computed'
import * as three from 'three';
import * as catalogs from './catalogs';
import project from './project';
import './components/preview';

Vue.use(vueAsyncComputed)


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
    },
    connectedStars: [],
    netOptions: {
      disconnectPolygons: false
    },
    starQuery: {
      magnitude: {$lte: 4.75}
    },
    asterismQuery: {
      starCounts: {$elemMatch: {count: {$gt: 3}}}
    }
  },

  created() {
    this.updateAsterisms().then(() => this.updateStars());
  },

  methods: {
    updateAsterisms() {
      return catalogs.loadAsterismCatalog({
        $or: [
          {
            starCounts: {$elemMatch: {count: {$gt: 3}}}
          },
          {name: 'Canis Major'}
        ]
      }).then(
        asterisms => {
          this.availableAsterisms = asterisms;
          this.selectedAsterisms = asterisms.slice();
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
    starQuery() {
      const {filters, connectedStars} = this
      return {
        $or: [
          {magnitude: {$lte: Number(filters.magnitude)}},
          {id: {$in: connectedStars}}
        ]
      }
    },
    asterismQuery() {
      const {selectedAsterisms} = this
      const asterismNames = selectedAsterisms.map(asterism => asterism.name)
      return {
        name: {$in: asterismNames}
      }
    },
    connectedStars() {
      const asterisms = this.selectedAsterisms
      return [
        ...new Set([].concat(
          ...asterisms.map(a => a.stars))
        )
      ]
    }
  },

  asyncComputed: {
    object() {
      return project(
        AVAILABLE_GEOMETRIES[this.selectedGeometry],
        this.starQuery,
        this.asterismQuery,
        this.netOptions
      )
    }
  }
});
