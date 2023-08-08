import { Store, UIEventSource } from "../../Logic/UIEventSource"
import StaticFeatureSource from "../../Logic/FeatureSource/Sources/StaticFeatureSource"
import { SpecialVisualization, SpecialVisualizationState } from "../SpecialVisualization"
import { Feature } from "geojson"
import { MapLibreAdaptor } from "../Map/MapLibreAdaptor"
import SvelteUIElement from "../Base/SvelteUIElement"
import MaplibreMap from "../Map/MaplibreMap.svelte"
import ShowDataLayer from "../Map/ShowDataLayer"
import LayerConfig from "../../Models/ThemeConfig/LayerConfig"
import { GeoOperations } from "../../Logic/GeoOperations"
import { BBox } from "../../Logic/BBox"

export class MinimapViz implements SpecialVisualization {
    funcName = "minimap"
    docs = "A small map showing the selected feature."
    args = [
        {
            doc: "The (maximum) zoomlevel: the target zoomlevel after fitting the entire feature. The minimap will fit the entire feature, then zoom out to this zoom level. The higher, the more zoomed in with 1 being the entire world and 19 being really close",
            name: "zoomlevel",
            defaultValue: "18",
        },
        {
            doc: "(Matches all resting arguments) This argument should be the key of a property of the feature. The corresponding value is interpreted as either the id or the a list of ID's. The features with these ID's will be shown on this minimap. (Note: if the key is 'id', list interpration is disabled)",
            name: "idKey",
            defaultValue: "id",
        },
    ]
    example: "`{minimap()}`, `{minimap(17, id, _list_of_embedded_feature_ids_calculated_by_calculated_tag):height:10rem; border: 2px solid black}`"

    constr(
        state: SpecialVisualizationState,
        tagSource: UIEventSource<Record<string, string>>,
        args: string[],
        feature: Feature,
        layer: LayerConfig
    ) {
        if (state === undefined || feature === undefined || layer.source === undefined) {
            return undefined
        }
        const keys = [...args]
        keys.splice(0, 1)
        const featuresToShow: Store<Feature[]> = state.indexedFeatures.featuresById.map(
            (featuresById) => {
                if (featuresById === undefined) {
                    return []
                }
                const properties = tagSource.data
                const features: Feature[] = []
                for (const key of keys) {
                    const value = properties[key]
                    if (value === undefined || value === null) {
                        continue
                    }

                    let idList = [value]
                    if (Array.isArray(value)) {
                        idList = value
                    } else if (
                        key !== "id" &&
                        typeof value === "string" &&
                        value?.startsWith("[")
                    ) {
                        // This is a list of values
                        idList = JSON.parse(value)
                    }

                    for (const id of idList) {
                        const feature = featuresById.get(id)
                        if (feature === undefined) {
                            console.warn("No feature found for id ", id)
                            continue
                        }
                        features.push(feature)
                    }
                }
                return features
            },
            [tagSource]
        )

        const mlmap = new UIEventSource(undefined)
        const mla = new MapLibreAdaptor(mlmap)

        mla.maxzoom.setData(17)
        let zoom = 18
        if (args[0]) {
            const parsed = Number(args[0])
            if (!isNaN(parsed) && parsed > 0 && parsed < 25) {
                zoom = parsed
            }
        }
        featuresToShow.addCallbackAndRunD((features) => {
            if (features.length === 0) {
                return
            }
            const bboxGeojson = GeoOperations.bbox({ features, type: "FeatureCollection" })
            const [lon, lat] = GeoOperations.centerpointCoordinates(bboxGeojson)
            mla.bounds.setData(BBox.get(bboxGeojson))
            mla.location.setData({ lon, lat })
        })
        mla.zoom.setData(zoom)
        mla.allowMoving.setData(false)
        mla.allowZooming.setData(false)

        ShowDataLayer.showMultipleLayers(
            mlmap,
            new StaticFeatureSource(featuresToShow),
            state.layout.layers
        )

        return new SvelteUIElement(MaplibreMap, { map: mlmap })
            .SetClass("h-40 rounded")
            .SetStyle("overflow: hidden; pointer-events: none;")
    }
}
