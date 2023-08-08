import { Changes } from "../../Osm/Changes"
import { OsmNode, OsmRelation, OsmWay } from "../../Osm/OsmObject"
import { IndexedFeatureSource, WritableFeatureSource } from "../FeatureSource"
import { UIEventSource } from "../../UIEventSource"
import { ChangeDescription } from "../../Osm/Actions/ChangeDescription"
import { OsmId, OsmTags } from "../../../Models/OsmFeature"
import { Feature } from "geojson"
import OsmObjectDownloader from "../../Osm/OsmObjectDownloader"

export class NewGeometryFromChangesFeatureSource implements WritableFeatureSource {
    // This class name truly puts the 'Java' into 'Javascript'

    /**
     * A feature source containing exclusively new elements.
     *
     * These elements are probably created by the 'SimpleAddUi' which generates a new point, but the import functionality might create a line or polygon too.
     * Other sources of new points are e.g. imports from nodes
     */
    public readonly features: UIEventSource<Feature[]> = new UIEventSource<Feature[]>([])

    constructor(changes: Changes, allElementStorage: IndexedFeatureSource, backendUrl: string) {
        const seenChanges = new Set<ChangeDescription>()
        const features = this.features.data
        const self = this
        const backend = changes.backend
        changes.pendingChanges.addCallbackAndRunD((changes) => {
            if (changes.length === 0) {
                return
            }

            let somethingChanged = false

            function add(feature) {
                feature.id = feature.properties.id
                features.push(feature)
                somethingChanged = true
            }

            for (const change of changes) {
                if (seenChanges.has(change)) {
                    // Already handled
                    continue
                }
                seenChanges.add(change)

                if (change.tags === undefined) {
                    // If tags is undefined, this is probably a new point that is part of a split road
                    continue
                }

                console.log("Handling pending change")
                if (change.id > 0) {
                    // This is an already existing object
                    // In _most_ of the cases, this means that this _isn't_ a new object
                    // However, when a point is snapped to an already existing point, we have to create a representation for this point!
                    // For this, we introspect the change
                    if (allElementStorage.featuresById.data.has(change.type + "/" + change.id)) {
                        // The current point already exists, we don't have to do anything here
                        continue
                    }
                    console.debug("Detected a reused point")
                    // The 'allElementsStore' does _not_ have this point yet, so we have to create it
                    new OsmObjectDownloader(backend)
                        .DownloadObjectAsync(change.type + "/" + change.id)
                        .then((feat) => {
                            console.log("Got the reused point:", feat)
                            if (feat === "deleted") {
                                throw "Panic: snapping to a point, but this point has been deleted in the meantime"
                            }
                            for (const kv of change.tags) {
                                feat.tags[kv.k] = kv.v
                            }
                            const geojson = feat.asGeoJson()
                            self.features.data.push(geojson)
                            self.features.ping()
                        })
                    continue
                } else if (change.changes === undefined) {
                    // The geometry is not described - not a new point or geometry change, but probably a tagchange to a newly created point
                    // Not something that should be handled here
                    continue
                }

                try {
                    const tags: OsmTags & { id: OsmId & string } = {
                        id: <OsmId & string>(change.type + "/" + change.id),
                    }
                    for (const kv of change.tags) {
                        tags[kv.k] = kv.v
                    }

                    tags["_backend"] = backendUrl

                    switch (change.type) {
                        case "node":
                            const n = new OsmNode(change.id)
                            n.tags = tags
                            n.lat = change.changes["lat"]
                            n.lon = change.changes["lon"]
                            const geojson = n.asGeoJson()
                            add(geojson)
                            break
                        case "way":
                            const w = new OsmWay(change.id)
                            w.tags = tags
                            w.nodes = change.changes["nodes"]
                            w.coordinates = change.changes["coordinates"].map(([lon, lat]) => [
                                lat,
                                lon,
                            ])
                            add(w.asGeoJson())
                            break
                        case "relation":
                            const r = new OsmRelation(change.id)
                            r.tags = tags
                            r.members = change.changes["members"]
                            add(r.asGeoJson())
                            break
                    }
                } catch (e) {
                    console.error("Could not generate a new geometry to render on screen for:", e)
                }
            }
            if (somethingChanged) {
                self.features.ping()
            }
        })
    }
}
