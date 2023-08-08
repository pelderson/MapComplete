/**
 * Fetches a geojson file somewhere and passes it along
 */
import { Store, UIEventSource } from "../../UIEventSource"
import { Utils } from "../../../Utils"
import { FeatureSource } from "../FeatureSource"
import { BBox } from "../../BBox"
import { GeoOperations } from "../../GeoOperations"
import { Feature } from "geojson"
import LayerConfig from "../../../Models/ThemeConfig/LayerConfig"
import { Tiles } from "../../../Models/TileRange"

export default class GeoJsonSource implements FeatureSource {
    public readonly features: Store<Feature[]>
    private readonly seenids: Set<string>
    private readonly idKey?: string

    public constructor(
        layer: LayerConfig,
        options?: {
            zxy?: number | [number, number, number] | BBox
            featureIdBlacklist?: Set<string>
            isActive?: Store<boolean>
        }
    ) {
        if (layer.source.geojsonZoomLevel !== undefined && options?.zxy === undefined) {
            throw "Dynamic layers are not supported. Use 'DynamicGeoJsonTileSource instead"
        }

        this.idKey = layer.source.idKey
        this.seenids = options?.featureIdBlacklist ?? new Set<string>()
        let url = layer.source.geojsonSource.replace("{layer}", layer.id)
        let zxy = options?.zxy
        if (zxy !== undefined) {
            let tile_bbox: BBox
            if (typeof zxy === "number") {
                zxy = Tiles.tile_from_index(zxy)
            }
            if (zxy instanceof BBox) {
                tile_bbox = zxy
            } else {
                const [z, x, y] = zxy
                tile_bbox = BBox.fromTile(z, x, y)
                url = url
                    .replace("{z}", "" + z)
                    .replace("{x}", "" + x)
                    .replace("{y}", "" + y)
            }
            let bounds: Record<"minLat" | "maxLat" | "minLon" | "maxLon", number> = tile_bbox
            if (layer.source.mercatorCrs) {
                bounds = tile_bbox.toMercator()
            }

            url = url
                .replace("{y_min}", "" + bounds.minLat)
                .replace("{y_max}", "" + bounds.maxLat)
                .replace("{x_min}", "" + bounds.minLon)
                .replace("{x_max}", "" + bounds.maxLon)
        }

        const eventsource = new UIEventSource<Feature[]>([])
        if (options?.isActive !== undefined) {
            options.isActive.addCallbackAndRunD(async (active) => {
                if (!active) {
                    return
                }
                this.LoadJSONFrom(url, eventsource, layer)
                    .then((fs) => console.debug("Loaded", fs.length, "features from", url))
                    .catch((err) => console.warn("Could not load ", url, "due to", err))
                return true // data is loaded, we can safely unregister
            })
        } else {
            this.LoadJSONFrom(url, eventsource, layer)
                .then((fs) => console.debug("Loaded", fs.length, "features from", url))
                .catch((err) => console.warn("Could not load ", url, "due to", err))
        }
        this.features = eventsource
    }

    /**
     * Init the download, write into the specified event source for the given layer.
     * Note this method caches the requested geojson for five minutes
     */
    private async LoadJSONFrom(
        url: string,
        eventSource: UIEventSource<Feature[]>,
        layer: LayerConfig,
        options?: {
            maxCacheAgeSec?: number | 300
        }
    ): Promise<Feature[]> {
        const self = this
        let json = await Utils.downloadJsonCached(url, (options?.maxCacheAgeSec ?? 300) * 1000)

        if (json.features === undefined || json.features === null) {
            json.features = []
        }

        if (layer.source.mercatorCrs) {
            json = GeoOperations.GeoJsonToWGS84(json)
        }

        const time = new Date()
        const newFeatures: Feature[] = []
        let i = 0
        let skipped = 0
        for (const feature of json.features) {
            if (feature.geometry.type === "Point") {
                // See https://github.com/maproulette/maproulette-backend/issues/242
                feature.geometry.coordinates = feature.geometry.coordinates.map(Number)
            }
            const props = feature.properties
            for (const key in props) {
                if (props[key] === null) {
                    delete props[key]
                }

                if (typeof props[key] !== "string") {
                    // Make sure all the values are string, it crashes stuff otherwise
                    props[key] = JSON.stringify(props[key])
                }
            }

            if (self.idKey !== undefined) {
                props.id = props[self.idKey]
            }

            if (props.id === undefined) {
                props.id = url + "/" + i
                feature.id = url + "/" + i
                i++
            }
            if (self.seenids.has(props.id)) {
                skipped++
                continue
            }
            self.seenids.add(props.id)

            let freshness: Date = time
            if (feature.properties["_last_edit:timestamp"] !== undefined) {
                freshness = new Date(props["_last_edit:timestamp"])
            }

            newFeatures.push(feature)
        }

        eventSource.setData(newFeatures)
        return newFeatures
    }
}
