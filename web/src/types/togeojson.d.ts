declare module "@mapbox/togeojson" {
  import type { FeatureCollection } from "geojson";
  export function gpx(doc: Document): FeatureCollection;
  export function kml(doc: Document): FeatureCollection;
  const togeojson: { gpx: typeof gpx; kml: typeof kml };
  export default togeojson;
}
