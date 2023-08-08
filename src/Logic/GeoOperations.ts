import { BBox } from "./BBox"
import * as turf from "@turf/turf"
import { AllGeoJSON, booleanWithin, Coord } from "@turf/turf"
import {
    Feature,
    FeatureCollection,
    GeoJSON,
    Geometry,
    LineString,
    MultiLineString,
    MultiPolygon,
    Point,
    Polygon,
    Position,
} from "geojson"
import { Tiles } from "../Models/TileRange"
import { Utils } from "../Utils"

export class GeoOperations {
    private static readonly _earthRadius = 6378137
    private static readonly _originShift = (2 * Math.PI * GeoOperations._earthRadius) / 2

    /**
     * Create a union between two features
     */
    public static union(f0: Feature, f1: Feature): Feature<Polygon | MultiPolygon> | null {
        return turf.union(<any>f0, <any>f1)
    }

    public static intersect(f0: Feature, f1: Feature): Feature<Polygon | MultiPolygon> | null {
        return turf.intersect(<any>f0, <any>f1)
    }

    static surfaceAreaInSqMeters(feature: any) {
        return turf.area(feature)
    }

    /**
     * Converts a GeoJson feature to a point GeoJson feature
     * @param feature
     */
    static centerpoint(feature: any): Feature<Point> {
        const newFeature: Feature<Point> = turf.center(feature)
        newFeature.properties = feature.properties
        newFeature.id = feature.id
        return newFeature
    }

    /**
     * Returns [lon,lat] coordinates
     * @param feature
     */
    static centerpointCoordinates(feature: AllGeoJSON | GeoJSON): [number, number] {
        return <[number, number]>turf.center(<any>feature).geometry.coordinates
    }

    /**
     * Returns the distance between the two points in meters
     * @param lonlat0
     * @param lonlat1
     */
    static distanceBetween(lonlat0: [number, number], lonlat1: [number, number] | Position) {
        return turf.distance(lonlat0, lonlat1, { units: "meters" })
    }

    static convexHull(featureCollection, options: { concavity?: number }) {
        return turf.convex(featureCollection, options)
    }

    /**
     * Calculates the overlap of 'feature' with every other specified feature.
     * The features with which 'feature' overlaps, are returned together with their overlap area in m²
     *
     * If 'feature' is a LineString, the features in which this feature is (partly) embedded is returned, the overlap length in meter is given
     * If 'feature' is a Polygon, overlapping points and points within the polygon will be returned
     *
     * If 'feature' is a point, it will return every feature the point is embedded in. Overlap will be undefined
     *
     * const polygon = {"type": "Feature","properties": {},"geometry": {"type": "Polygon","coordinates": [[[1.8017578124999998,50.401515322782366],[-3.1640625,46.255846818480315],[5.185546875,44.74673324024678],[1.8017578124999998,50.401515322782366]]]}};
     * const point = {"type": "Feature", "properties": {}, "geometry": { "type": "Point", "coordinates": [2.274169921875, 46.76244305208004]}};
     * const overlap = GeoOperations.calculateOverlap(point, [polygon]);
     * overlap.length // => 1
     * overlap[0].feat == polygon // => true
     * const line = {"type": "Feature","properties": {},"geometry": {"type": "LineString","coordinates": [[3.779296875,48.777912755501845],[1.23046875,47.60616304386874]]}};
     * const lineOverlap = GeoOperations.calculateOverlap(line, [polygon]);
     * lineOverlap.length // => 1
     * lineOverlap[0].overlap // => 156745.3293320278
     * lineOverlap[0].feat == polygon // => true
     * const line0 = {"type": "Feature","properties": {},"geometry": {"type": "LineString","coordinates": [[0.0439453125,47.31648293428332],[0.6591796875,46.77749276376827]]}};
     * const overlap0 = GeoOperations.calculateOverlap(line0, [polygon]);
     * overlap.length // => 1
     */
    static calculateOverlap(feature: any, otherFeatures: any[]): { feat: any; overlap: number }[] {
        const featureBBox = BBox.get(feature)
        const result: { feat: any; overlap: number }[] = []
        if (feature.geometry.type === "Point") {
            const coor = feature.geometry.coordinates
            for (const otherFeature of otherFeatures) {
                if (
                    feature.properties.id !== undefined &&
                    feature.properties.id === otherFeature.properties.id
                ) {
                    continue
                }

                if (otherFeature.geometry === undefined) {
                    console.error("No geometry for feature ", feature)
                    throw "List of other features contains a feature without geometry an undefined"
                }

                if (GeoOperations.inside(coor, otherFeature)) {
                    result.push({ feat: otherFeature, overlap: undefined })
                }
            }
            return result
        }

        if (feature.geometry.type === "LineString") {
            for (const otherFeature of otherFeatures) {
                if (
                    feature.properties.id !== undefined &&
                    feature.properties.id === otherFeature.properties.id
                ) {
                    continue
                }

                const intersection = GeoOperations.calculateInstersection(
                    feature,
                    otherFeature,
                    featureBBox
                )
                if (intersection === null) {
                    continue
                }
                result.push({ feat: otherFeature, overlap: intersection })
            }
            return result
        }

        if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
            for (const otherFeature of otherFeatures) {
                if (
                    feature.properties.id !== undefined &&
                    feature.properties.id === otherFeature.properties.id
                ) {
                    continue
                }

                if (otherFeature.geometry.type === "Point") {
                    if (this.inside(otherFeature, feature)) {
                        result.push({ feat: otherFeature, overlap: undefined })
                    }
                    continue
                }

                // Calculate the surface area of the intersection

                const intersection = this.calculateInstersection(feature, otherFeature, featureBBox)
                if (intersection === null) {
                    continue
                }
                result.push({ feat: otherFeature, overlap: intersection })
            }
            return result
        }
        console.error(
            "Could not correctly calculate the overlap of ",
            feature,
            ": unsupported type"
        )
        return result
    }

    /**
     * Detect wether or not the given point is located in the feature
     *
     * // Should work with a normal polygon
     * const polygon = {"type": "Feature","properties": {},"geometry": {"type": "Polygon","coordinates": [[[1.8017578124999998,50.401515322782366],[-3.1640625,46.255846818480315],[5.185546875,44.74673324024678],[1.8017578124999998,50.401515322782366]]]}};
     * GeoOperations.inside([3.779296875, 48.777912755501845], polygon) // => false
     * GeoOperations.inside([1.23046875, 47.60616304386874], polygon) // => true
     *
     * // should work with a multipolygon and detect holes
     * const multiPolygon = {"type": "Feature", "properties": {},
     *         "geometry": {
     *             "type": "MultiPolygon",
     *             "coordinates": [[
     *                 [[1.8017578124999998,50.401515322782366],[-3.1640625,46.255846818480315],[5.185546875,44.74673324024678],[1.8017578124999998,50.401515322782366]],
     *                 [[1.0107421875,48.821332549646634],[1.329345703125,48.25394114463431],[1.988525390625,48.71271258145237],[0.999755859375,48.86471476180277],[1.0107421875,48.821332549646634]]
     *             ]]
     *         }
     *     };
     * GeoOperations.inside([2.515869140625, 47.37603463349758], multiPolygon) // => true
     * GeoOperations.inside([1.42822265625, 48.61838518688487], multiPolygon) // => false
     * GeoOperations.inside([4.02099609375, 47.81315451752768], multiPolygon) // => false
     */
    public static inside(
        pointCoordinate: [number, number] | Feature<Point>,
        feature: Feature
    ): boolean {
        // ray-casting algorithm based on
        // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

        if (feature.geometry.type === "Point") {
            // The feature that should 'contain' pointCoordinate is a point itself, so it cannot contain anything
            return false
        }

        if (pointCoordinate["geometry"] !== undefined) {
            pointCoordinate = pointCoordinate["geometry"].coordinates
        }

        const x: number = pointCoordinate[0]
        const y: number = pointCoordinate[1]

        if (feature.geometry.type === "MultiPolygon") {
            const coordinatess = feature.geometry.coordinates
            for (const coordinates of coordinatess) {
                // @ts-ignore
                const inThisPolygon = GeoOperations.pointInPolygonCoordinates(x, y, coordinates)
                if (inThisPolygon) {
                    return true
                }
            }
            return false
        }

        if (feature.geometry.type === "Polygon") {
            // @ts-ignore
            return GeoOperations.pointInPolygonCoordinates(x, y, feature.geometry.coordinates)
        }

        throw "GeoOperations.inside: unsupported geometry type " + feature.geometry.type
    }

    static lengthInMeters(feature: any) {
        return turf.length(feature) * 1000
    }

    static buffer(feature: any, bufferSizeInMeter: number) {
        return turf.buffer(feature, bufferSizeInMeter / 1000, {
            units: "kilometers",
        })
    }

    static bbox(feature: Feature | FeatureCollection): Feature<LineString, {}> {
        const [lon, lat, lon0, lat0] = turf.bbox(feature)
        return {
            type: "Feature",
            properties: {},
            geometry: {
                type: "LineString",
                coordinates: [
                    [lon, lat],
                    [lon0, lat],
                    [lon0, lat0],
                    [lon, lat0],
                    [lon, lat],
                ],
            },
        }
    }

    /**
     * Generates the closest point on a way from a given point.
     * If the passed-in geojson object is a polygon, the outer ring will be used as linestring
     *
     *  The properties object will contain three values:
     // - `index`: closest point was found on nth line part,
     // - `dist`: distance between pt and the closest point (in kilometer),
     // `location`: distance along the line between start (of the line) and the closest point.
     * @param way The road on which you want to find a point
     * @param point Point defined as [lon, lat]
     */
    public static nearestPoint(
        way: Feature<LineString>,
        point: [number, number]
    ): Feature<
        Point,
        {
            index: number
            dist: number
            location: number
        }
    > {
        return <any>(
            turf.nearestPointOnLine(<Feature<LineString>>way, point, { units: "kilometers" })
        )
    }

    /**
     * Helper method to reuse the coordinates of the way as LineString.
     * Mostly used as helper for 'nearestPoint'
     * @param way
     */
    public static forceLineString(way: Feature<LineString | Polygon>): Feature<LineString>
    public static forceLineString(
        way: Feature<MultiLineString | MultiPolygon>
    ): Feature<MultiLineString>
    public static forceLineString(
        way: Feature<LineString | MultiLineString | Polygon | MultiPolygon>
    ): Feature<LineString | MultiLineString> {
        if (way.geometry.type === "Polygon") {
            way = { ...way }
            way.geometry = { ...way.geometry }
            way.geometry.type = "LineString"
            way.geometry.coordinates = (<Polygon>way.geometry).coordinates[0]
        } else if (way.geometry.type === "MultiPolygon") {
            way = { ...way }
            way.geometry = { ...way.geometry }
            way.geometry.type = "MultiLineString"
            way.geometry.coordinates = (<MultiPolygon>way.geometry).coordinates[0]
        }

        return <any>way
    }

    public static toCSV(features: any[]): string {
        const headerValuesSeen = new Set<string>()
        const headerValuesOrdered: string[] = []

        function addH(key) {
            if (!headerValuesSeen.has(key)) {
                headerValuesSeen.add(key)
                headerValuesOrdered.push(key)
            }
        }

        addH("_lat")
        addH("_lon")

        const lines: string[] = []

        for (const feature of features) {
            const properties = feature.properties
            for (const key in properties) {
                if (!properties.hasOwnProperty(key)) {
                    continue
                }
                addH(key)
            }
        }
        headerValuesOrdered.sort()
        for (const feature of features) {
            const properties = feature.properties
            let line = ""
            for (const key of headerValuesOrdered) {
                const value = properties[key]
                if (value === undefined) {
                    line += ","
                } else {
                    line += JSON.stringify(value) + ","
                }
            }
            lines.push(line)
        }

        return headerValuesOrdered.map((v) => JSON.stringify(v)).join(",") + "\n" + lines.join("\n")
    }

    //Converts given lat/lon in WGS84 Datum to XY in Spherical Mercator EPSG:900913
    public static ConvertWgs84To900913(lonLat: [number, number]): [number, number] {
        const lon = lonLat[0]
        const lat = lonLat[1]
        const x = (lon * GeoOperations._originShift) / 180
        let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)
        y = (y * GeoOperations._originShift) / 180
        return [x, y]
    }

    //Converts XY point from (Spherical) Web Mercator EPSG:3785 (unofficially EPSG:900913) to lat/lon in WGS84 Datum
    public static Convert900913ToWgs84(lonLat: [number, number]): [number, number] {
        const lon = lonLat[0]
        const lat = lonLat[1]
        const x = (180 * lon) / GeoOperations._originShift
        let y = (180 * lat) / GeoOperations._originShift
        y = (180 / Math.PI) * (2 * Math.atan(Math.exp((y * Math.PI) / 180)) - Math.PI / 2)
        return [x, y]
    }

    public static GeoJsonToWGS84(geojson) {
        return turf.toWgs84(geojson)
    }

    /**
     * Tries to remove points which do not contribute much to the general outline.
     * Points for which the angle is ~ 180° are removed
     * @param coordinates
     * @constructor
     */
    public static SimplifyCoordinates(coordinates: [number, number][]) {
        const newCoordinates = []
        for (let i = 1; i < coordinates.length - 1; i++) {
            const coordinate = coordinates[i]
            const prev = coordinates[i - 1]
            const next = coordinates[i + 1]
            const b0 = turf.bearing(prev, coordinate, { final: true })
            const b1 = turf.bearing(coordinate, next)

            const diff = Math.abs(b1 - b0)
            if (diff < 2) {
                continue
            }
            newCoordinates.push(coordinate)
        }
        return newCoordinates
    }

    /**
     * Calculates line intersection between two features.
     */
    public static LineIntersections(
        feature: Feature<LineString | MultiLineString | Polygon | MultiPolygon>,
        otherFeature: Feature<LineString | MultiLineString | Polygon | MultiPolygon>
    ): [number, number][] {
        return turf
            .lineIntersect(feature, otherFeature)
            .features.map((p) => <[number, number]>p.geometry.coordinates)
    }

    /**
     * Given a list of features, will construct a map of slippy map tile-indices.
     * Features of which the BBOX overlaps with the corresponding slippy map tile are added to the corresponding array
     * @param features
     * @param zoomlevel
     */
    public static spreadIntoBboxes(features: Feature[], zoomlevel: number): Map<number, Feature[]> {
        const perBbox = new Map<number, Feature[]>()

        for (const feature of features) {
            const bbox = BBox.get(feature)
            const tilerange = bbox.expandToTileBounds(zoomlevel).containingTileRange(zoomlevel)
            Tiles.MapRange(tilerange, (x, y) => {
                const tileNumber = Tiles.tile_index(zoomlevel, x, y)
                let newFeatureList = perBbox.get(tileNumber)
                if (newFeatureList === undefined) {
                    newFeatureList = []
                    perBbox.set(tileNumber, newFeatureList)
                }
                newFeatureList.push(feature)
            })
        }

        return perBbox
    }
    public static toGpx(
        locations:
            | Feature<LineString>
            | Feature<Point, { date?: string; altitude?: number | string }>[],
        title?: string
    ) {
        title = title?.trim()
        if (title === undefined || title === "") {
            title = "Uploaded with MapComplete"
        }
        title = Utils.EncodeXmlValue(title)
        const trackPoints: string[] = []
        let locationsWithMeta: Feature<Point, { date?: string; altitude?: number | string }>[]
        if (Array.isArray(locations)) {
            locationsWithMeta = locations
        } else {
            locationsWithMeta = locations.geometry.coordinates.map(
                (p) =>
                    <Feature<Point>>{
                        type: "Feature",
                        properties: {},
                        geometry: {
                            type: "Point",
                            coordinates: p,
                        },
                    }
            )
        }
        for (const l of locationsWithMeta) {
            let trkpt = `    <trkpt lat="${l.geometry.coordinates[1]}" lon="${l.geometry.coordinates[0]}">`
            if (l.properties.date) {
                trkpt += `        <time>${l.properties.date}</time>`
            }
            if (l.properties.altitude) {
                trkpt += `        <ele>${l.properties.altitude}</ele>`
            }
            trkpt += "    </trkpt>"
            trackPoints.push(trkpt)
        }
        const header =
            '<gpx version="1.1" creator="MapComplete.osm.be" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">'
        return (
            header +
            "\n<name>" +
            title +
            "</name>\n<trk><trkseg>\n" +
            trackPoints.join("\n") +
            "\n</trkseg></trk></gpx>"
        )
    }

    public static IdentifieCommonSegments(coordinatess: [number, number][][]): {
        originalIndex: number
        segmentShardWith: number[]
        coordinates: []
    }[] {
        // An edge. Note that the edge might be reversed to fix the sorting condition:  start[0] < end[0] && (start[0] != end[0] || start[0] < end[1])
        type edge = {
            start: [number, number]
            end: [number, number]
            intermediate: [number, number][]
            members: { index: number; isReversed: boolean }[]
        }

        // The strategy:
        // 1. Index _all_ edges from _every_ linestring. Index them by starting key, gather which relations run over them
        // 2. Join these edges back together - as long as their membership groups are the same
        // 3. Convert to results

        const allEdgesByKey = new Map<string, edge>()

        for (let index = 0; index < coordinatess.length; index++) {
            const coordinates = coordinatess[index]
            for (let i = 0; i < coordinates.length - 1; i++) {
                const c0 = coordinates[i]
                const c1 = coordinates[i + 1]
                const isReversed = c0[0] > c1[0] || (c0[0] == c1[0] && c0[1] > c1[1])

                let key: string
                if (isReversed) {
                    key = "" + c1 + ";" + c0
                } else {
                    key = "" + c0 + ";" + c1
                }
                const member = { index, isReversed }
                if (allEdgesByKey.has(key)) {
                    allEdgesByKey.get(key).members.push(member)
                    continue
                }

                let edge: edge
                if (!isReversed) {
                    edge = {
                        start: c0,
                        end: c1,
                        members: [member],
                        intermediate: [],
                    }
                } else {
                    edge = {
                        start: c1,
                        end: c0,
                        members: [member],
                        intermediate: [],
                    }
                }
                allEdgesByKey.set(key, edge)
            }
        }

        // Lets merge them back together!

        let didMergeSomething = false
        let allMergedEdges = Array.from(allEdgesByKey.values())
        const allEdgesByStartPoint = new Map<string, edge[]>()
        for (const edge of allMergedEdges) {
            edge.members.sort((m0, m1) => m0.index - m1.index)

            const kstart = edge.start + ""
            if (!allEdgesByStartPoint.has(kstart)) {
                allEdgesByStartPoint.set(kstart, [])
            }
            allEdgesByStartPoint.get(kstart).push(edge)
        }

        function membersAreCompatible(first: edge, second: edge): boolean {
            // There must be an exact match between the members
            if (first.members === second.members) {
                return true
            }

            if (first.members.length !== second.members.length) {
                return false
            }

            // Members are sorted and have the same length, so we can check quickly
            for (let i = 0; i < first.members.length; i++) {
                const m0 = first.members[i]
                const m1 = second.members[i]
                if (m0.index !== m1.index || m0.isReversed !== m1.isReversed) {
                    return false
                }
            }

            // Allrigth, they are the same, lets mark this permanently
            second.members = first.members
            return true
        }

        do {
            didMergeSomething = false
            // We use 'allMergedEdges' as our running list
            const consumed = new Set<edge>()
            for (const edge of allMergedEdges) {
                // Can we make this edge longer at the end?
                if (consumed.has(edge)) {
                    continue
                }

                console.log("Considering edge", edge)
                const matchingEndEdges = allEdgesByStartPoint.get(edge.end + "")
                console.log("Matchign endpoints:", matchingEndEdges)
                if (matchingEndEdges === undefined) {
                    continue
                }

                for (let i = 0; i < matchingEndEdges.length; i++) {
                    const endEdge = matchingEndEdges[i]

                    if (consumed.has(endEdge)) {
                        continue
                    }

                    if (!membersAreCompatible(edge, endEdge)) {
                        continue
                    }

                    // We can make the segment longer!
                    didMergeSomething = true
                    console.log("Merging ", edge, "with ", endEdge)
                    edge.intermediate.push(edge.end)
                    edge.end = endEdge.end
                    consumed.add(endEdge)
                    matchingEndEdges.splice(i, 1)
                    break
                }
            }

            allMergedEdges = allMergedEdges.filter((edge) => !consumed.has(edge))
        } while (didMergeSomething)

        return []
    }

    /**
     * Removes points that do not contribute to the geometry from linestrings and the outer ring of polygons.
     * Returs a new copy of the feature
     *
     * const feature = {"geometry": {"type": "Polygon","coordinates": [[[4.477944199999975,51.02783550000022],[4.477987899999996,51.027818800000034],[4.478004500000021,51.02783399999988],[4.478025499999962,51.02782489999994],[4.478079099999993,51.027873899999896],[4.47801040000006,51.027903799999955],[4.477964799999972,51.02785709999982],[4.477964699999964,51.02785690000006],[4.477944199999975,51.02783550000022]]]}}
     * const copy = GeoOperations.removeOvernoding(feature)
     * expect(copy.geometry.coordinates[0]).deep.equal([[4.477944199999975,51.02783550000022],[4.477987899999996,51.027818800000034],[4.478004500000021,51.02783399999988],[4.478025499999962,51.02782489999994],[4.478079099999993,51.027873899999896],[4.47801040000006,51.027903799999955],[4.477944199999975,51.02783550000022]])
     */
    static removeOvernoding(feature: any) {
        if (feature.geometry.type !== "LineString" && feature.geometry.type !== "Polygon") {
            throw "Overnode removal is only supported on linestrings and polygons"
        }

        const copy = {
            ...feature,
            geometry: { ...feature.geometry },
        }
        let coordinates: [number, number][]
        if (feature.geometry.type === "LineString") {
            coordinates = [...feature.geometry.coordinates]
            copy.geometry.coordinates = coordinates
        } else {
            coordinates = [...feature.geometry.coordinates[0]]
            copy.geometry.coordinates[0] = coordinates
        }

        // inline replacement in the coordinates list
        for (let i = coordinates.length - 2; i >= 1; i--) {
            const coordinate = coordinates[i]
            const nextCoordinate = coordinates[i + 1]
            const prevCoordinate = coordinates[i - 1]

            const distP = GeoOperations.distanceBetween(coordinate, prevCoordinate)
            if (distP < 0.1) {
                coordinates.splice(i, 1)
                continue
            }

            if (i == coordinates.length - 2) {
                const distN = GeoOperations.distanceBetween(coordinate, nextCoordinate)
                if (distN < 0.1) {
                    coordinates.splice(i, 1)
                    continue
                }
            }

            const bearingN = turf.bearing(coordinate, nextCoordinate)
            const bearingP = turf.bearing(prevCoordinate, coordinate)
            const diff = Math.abs(bearingN - bearingP)
            if (diff < 4) {
                // If the diff is low, this point is hardly relevant
                coordinates.splice(i, 1)
            } else if (360 - diff < 4) {
                // In case that the line is going south, e.g. bearingN = 179, bearingP = -179
                coordinates.splice(i, 1)
            }
        }
        return copy
    }

    /**
     * Takes two points and finds the geographic bearing between them, i.e. the angle measured in degrees from the north line (0 degrees)
     */
    public static bearing(a: Coord, b: Coord): number {
        return turf.bearing(a, b)
    }

    public static along(a: Coord, b: Coord, distanceMeter: number): Coord {
        return turf.along(
            <any>{
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: [a, b],
                },
            },
            distanceMeter,
            { units: "meters" }
        ).geometry.coordinates
    }

    /**
     * Returns 'true' if one feature contains the other feature
     *
     * const pond: Feature<Polygon, any> = {
     *       "type": "Feature",
     *       "properties": {"natural":"water","water":"pond"},
     *       "geometry": {
     *         "type": "Polygon",
     *         "coordinates": [[
     *             [4.362924098968506,50.8435422298544 ],
     *             [4.363272786140442,50.8435219059949 ],
     *             [4.363213777542114,50.8437420806679 ],
     *             [4.362924098968506,50.8435422298544 ]
     *           ]]}}
     * const park: Feature<Polygon, any> =   {
     *       "type": "Feature",
     *       "properties": {"leisure":"park"},
     *       "geometry": {
     *         "type": "Polygon",
     *         "coordinates": [[
     *            [ 4.36073541641235,50.84323737103244 ],
     *            [ 4.36469435691833, 50.8423905305197 ],
     *            [ 4.36659336090087, 50.8458997374786 ],
     *            [ 4.36254858970642, 50.8468007074916 ],
     *            [ 4.36073541641235, 50.8432373710324 ]
     *           ]]}}
     * GeoOperations.completelyWithin(pond, park) // => true
     * GeoOperations.completelyWithin(park, pond) // => false
     */
    static completelyWithin(
        feature: Feature<Geometry, any>,
        possiblyEnclosingFeature: Feature<Polygon | MultiPolygon, any>
    ): boolean {
        return booleanWithin(feature, possiblyEnclosingFeature)
    }

    /**
     * Create an intersection between two features.
     * One or multiple new feature is returned based on 'toSplit', which'll have a geometry that is completely withing boundary
     */
    public static clipWith(toSplit: Feature, boundary: Feature<Polygon>): Feature[] {
        if (toSplit.geometry.type === "Point") {
            const p = <Feature<Point>>toSplit
            if (GeoOperations.inside(<[number, number]>p.geometry.coordinates, boundary)) {
                return [p]
            } else {
                return []
            }
        }

        if (toSplit.geometry.type === "LineString") {
            const splitup = turf.lineSplit(<Feature<LineString>>toSplit, boundary)
            const kept = []
            for (const f of splitup.features) {
                const ls = <Feature<LineString>>f
                if (!GeoOperations.inside(GeoOperations.centerpointCoordinates(f), boundary)) {
                    continue
                }
                f.properties = { ...toSplit.properties }
                kept.push(f)
            }
            return kept
        }
        if (toSplit.geometry.type === "Polygon" || toSplit.geometry.type == "MultiPolygon") {
            const splitup = turf.intersect(<Feature<Polygon>>toSplit, boundary)
            splitup.properties = { ...toSplit.properties }
            return [splitup]
        }
        throw "Invalid geometry type with GeoOperations.clipWith: " + toSplit.geometry.type
    }

    /**
     *
     *
     * const f = (type, feature: Feature) => GeoOperations.featureToCoordinateWithRenderingType(feature, type)
     * const g = geometry => (<Feature> {type: "Feature", properties: {}, geometry})
     * f("point", g({type:"Point", coordinates:[1,2]})) // => [1,2]
     * f("centroid", g({type:"Point", coordinates:[1,2]})) // => undefined
     * f("start", g({type:"Point", coordinates:[1,2]})) // => undefined
     * f("centroid", g({type:"LineString", coordinates:[[1,2], [3,4]]})) // => [2,3]
     * f("centroid", g({type:"Polygon", coordinates:[[[1,2], [3,4], [1,2]]]})) // => [2,3]
     * f("projected_centerpoint", g({type:"LineString", coordinates:[[1,2], [3,4]]})) // => [1.9993137596003214,2.999313759600321]
     * f("start", g({type:"LineString", coordinates:[[1,2], [3,4]]})) // => [1,2]
     * f("end", g({type:"LineString", coordinates:[[1,2], [3,4]]})) // => [3,4]
     *
     */
    public static featureToCoordinateWithRenderingType(
        feature: Feature,
        location: "point" | "centroid" | "start" | "end" | "projected_centerpoint" | string
    ): [number, number] | undefined {
        switch (location) {
            case "point":
                if (feature.geometry.type === "Point") {
                    return <[number, number]>feature.geometry.coordinates
                }
                return undefined
            case "centroid":
                if (feature.geometry.type === "Point") {
                    return undefined
                }
                return GeoOperations.centerpointCoordinates(feature)
            case "projected_centerpoint":
                if (
                    feature.geometry.type === "LineString" ||
                    feature.geometry.type === "MultiLineString"
                ) {
                    const centerpoint = GeoOperations.centerpointCoordinates(feature)
                    const projected = GeoOperations.nearestPoint(
                        <Feature<LineString>>feature,
                        centerpoint
                    )
                    return <[number, number]>projected.geometry.coordinates
                }
                return undefined
            case "start":
                if (feature.geometry.type === "LineString") {
                    return <[number, number]>feature.geometry.coordinates[0]
                }
                return undefined
            case "end":
                if (feature.geometry.type === "LineString") {
                    return <[number, number]>feature.geometry.coordinates.at(-1)
                }
                return undefined
            default:
                throw "Unkown location type: " + location
        }
    }

    /**
     * Constructs all tiles where features overlap with and puts those features in them.
     * Long features (e.g. lines or polygons) which overlap with multiple tiles are referenced in each tile they overlap with
     * @param zoomlevel
     * @param features
     */
    public static slice(zoomlevel: number, features: Feature[]): Map<number, Feature[]> {
        const tiles = new Map<number, Feature[]>()

        for (const feature of features) {
            const bbox = BBox.get(feature)
            Tiles.MapRange(Tiles.tileRangeFrom(bbox, zoomlevel), (x, y) => {
                const i = Tiles.tile_index(zoomlevel, x, y)

                let tiledata = tiles.get(i)
                if (tiledata === undefined) {
                    tiledata = []
                    tiles.set(i, tiledata)
                }
                tiledata.push(feature)
            })
        }

        return tiles
    }

    /**
     * Creates a linestring object based on the outer ring of the given polygon
     *
     * Returns the argument if not a polygon
     * @param p
     */
    public static outerRing<P>(p: Feature<Polygon | LineString, P>): Feature<LineString, P> {
        if (p.geometry.type !== "Polygon") {
            return <Feature<LineString, P>>p
        }
        return {
            type: "Feature",
            properties: p.properties,
            geometry: {
                type: "LineString",
                coordinates: p.geometry.coordinates[0],
            },
        }
    }

    static centerpointCoordinatesObj(geojson: Feature) {
        const [lon, lat] = GeoOperations.centerpointCoordinates(geojson)
        return { lon, lat }
    }

    /**
     * Helper function which does the heavy lifting for 'inside'
     */
    private static pointInPolygonCoordinates(
        x: number,
        y: number,
        coordinates: [number, number][][]
    ): boolean {
        const inside = GeoOperations.pointWithinRing(
            x,
            y,
            /*This is the outer ring of the polygon */ coordinates[0]
        )
        if (!inside) {
            return false
        }
        for (let i = 1; i < coordinates.length; i++) {
            const inHole = GeoOperations.pointWithinRing(
                x,
                y,
                coordinates[i] /* These are inner rings, aka holes*/
            )
            if (inHole) {
                return false
            }
        }
        return true
    }

    private static pointWithinRing(x: number, y: number, ring: [number, number][]) {
        let inside = false
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const coori = ring[i]
            const coorj = ring[j]

            const xi = coori[0]
            const yi = coori[1]
            const xj = coorj[0]
            const yj = coorj[1]

            const intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
            if (intersect) {
                inside = !inside
            }
        }
        return inside
    }

    /**
     * Calculates the intersection between two features.
     * Returns the length if intersecting a linestring and a (multi)polygon (in meters), returns a surface area (in m²) if intersecting two (multi)polygons
     * Returns 0 if both are linestrings
     * Returns null if the features are not intersecting
     */
    private static calculateInstersection(
        feature,
        otherFeature,
        featureBBox: BBox,
        otherFeatureBBox?: BBox
    ): number {
        if (feature.geometry.type === "LineString") {
            otherFeatureBBox = otherFeatureBBox ?? BBox.get(otherFeature)
            const overlaps = featureBBox.overlapsWith(otherFeatureBBox)
            if (!overlaps) {
                return null
            }

            // Calculate the length of the intersection

            let intersectionPoints = turf.lineIntersect(feature, otherFeature)
            if (intersectionPoints.features.length == 0) {
                // No intersections.
                // If one point is inside of the polygon, all points are

                const coors = feature.geometry.coordinates
                const startCoor = coors[0]
                if (this.inside(startCoor, otherFeature)) {
                    return this.lengthInMeters(feature)
                }

                return null
            }
            let intersectionPointsArray = intersectionPoints.features.map((d) => {
                return d.geometry.coordinates
            })

            if (otherFeature.geometry.type === "LineString") {
                if (intersectionPointsArray.length > 0) {
                    return 0
                }
                return null
            }
            if (intersectionPointsArray.length == 1) {
                // We need to add the start- or endpoint of the current feature, depending on which one is embedded
                const coors = feature.geometry.coordinates
                const startCoor = coors[0]
                if (this.inside(startCoor, otherFeature)) {
                    // The startpoint is embedded
                    intersectionPointsArray.push(startCoor)
                } else {
                    intersectionPointsArray.push(coors[coors.length - 1])
                }
            }

            let intersection = turf.lineSlice(
                turf.point(intersectionPointsArray[0]),
                turf.point(intersectionPointsArray[1]),
                feature
            )

            if (intersection == null) {
                return null
            }
            const intersectionSize = turf.length(intersection) // in km
            return intersectionSize * 1000
        }

        if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
            const otherFeatureBBox = BBox.get(otherFeature)
            const overlaps = featureBBox.overlapsWith(otherFeatureBBox)
            if (!overlaps) {
                return null
            }
            if (otherFeature.geometry.type === "LineString") {
                return this.calculateInstersection(
                    otherFeature,
                    feature,
                    otherFeatureBBox,
                    featureBBox
                )
            }

            try {
                const intersection = turf.intersect(feature, otherFeature)
                if (intersection == null) {
                    return null
                }
                return turf.area(intersection) // in m²
            } catch (e) {
                if (e.message === "Each LinearRing of a Polygon must have 4 or more Positions.") {
                    // WORKAROUND TIME!
                    // See https://github.com/Turfjs/turf/pull/2238
                    return null
                }
                throw e
            }
        }
        throw "CalculateIntersection fallthrough: can not calculate an intersection between features"
    }
}
