import { TagsFilter } from "../../Logic/Tags/TagsFilter"
import { RegexTag } from "../../Logic/Tags/RegexTag"

export default class SourceConfig {
    public osmTags?: TagsFilter
    public geojsonSource?: string
    public geojsonZoomLevel?: number
    public isOsmCacheLayer: boolean
    public readonly mercatorCrs: boolean
    public readonly idKey: string

    constructor(
        params: {
            mercatorCrs?: boolean
            osmTags?: TagsFilter
            overpassScript?: string
            geojsonSource?: string
            isOsmCache?: boolean
            geojsonSourceLevel?: number
            idKey?: string
        },
        context?: string
    ) {
        let defined = 0
        if (params.osmTags) {
            defined++
        }
        if (params.overpassScript) {
            defined++
        }
        if (params.geojsonSource) {
            defined++
        }
        if (defined == 0) {
            throw `Source: nothing correct defined in the source (in ${context}) (the params are ${JSON.stringify(
                params
            )})`
        }
        if (params.isOsmCache && params.geojsonSource == undefined) {
            console.error(params)
            throw `Source said it is a OSM-cached layer, but didn't define the actual source of the cache (in context ${context})`
        }
        if (params.geojsonSource !== undefined && params.geojsonSourceLevel !== undefined) {
            if (
                !["x", "y", "x_min", "x_max", "y_min", "Y_max"].some(
                    (toSearch) => params.geojsonSource.indexOf(toSearch) > 0
                )
            ) {
                throw `Source defines a geojson-zoomLevel, but does not specify {x} nor {y} (or equivalent), this is probably a bug (in context ${context})`
            }
        }
        if (params.osmTags !== undefined) {
            const optimized = params.osmTags.optimize()
            if (optimized === false) {
                throw (
                    "Error at " +
                    context +
                    ": the specified tags are conflicting with each other: they will never match anything at all.\n" +
                    "\tThe offending tags are: " +
                    params.osmTags.asHumanString(false, false, {}) +
                    "\tThey optmize into 'false' "
                )
            }
            if (optimized === true) {
                throw (
                    "Error at " +
                    context +
                    ": the specified tags are very wide: they will always match everything"
                )
            }
        }
        this.osmTags = params.osmTags ?? new RegexTag("id", /.*/)
        this.geojsonSource = params.geojsonSource
        this.geojsonZoomLevel = params.geojsonSourceLevel
        this.isOsmCacheLayer = params.isOsmCache ?? false
        this.mercatorCrs = params.mercatorCrs ?? false
        this.idKey = params.idKey
    }
}
