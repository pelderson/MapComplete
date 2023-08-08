import { Store, Stores } from "../../UIEventSource"
import { Tiles } from "../../../Models/TileRange"
import { BBox } from "../../BBox"
import { FeatureSource } from "../FeatureSource"
import FeatureSourceMerger from "../Sources/FeatureSourceMerger"

/***
 * A tiled source which dynamically loads the required tiles at a fixed zoom level.
 * A single featureSource will be initiliased for every tile in view; which will alter be merged into this featureSource
 */
export default class DynamicTileSource extends FeatureSourceMerger {
    constructor(
        zoomlevel: number,
        constructSource: (tileIndex) => FeatureSource,
        mapProperties: {
            bounds: Store<BBox>
            zoom: Store<number>
        },
        options?: {
            isActive?: Store<boolean>
        }
    ) {
        super()
        const loadedTiles = new Set<number>()
        const neededTiles: Store<number[]> = Stores.ListStabilized(
            mapProperties.bounds
                .mapD(
                    (bounds) => {
                        const tileRange = Tiles.TileRangeBetween(
                            zoomlevel,
                            bounds.getNorth(),
                            bounds.getEast(),
                            bounds.getSouth(),
                            bounds.getWest()
                        )
                        if (tileRange.total > 10000) {
                            console.error(
                                "Got a really big tilerange, bounds and location might be out of sync"
                            )
                            return undefined
                        }

                        const needed = Tiles.MapRange(tileRange, (x, y) =>
                            Tiles.tile_index(zoomlevel, x, y)
                        ).filter((i) => !loadedTiles.has(i))
                        if (needed.length === 0) {
                            return undefined
                        }
                        return needed
                    },
                    [options?.isActive, mapProperties.zoom]
                )
                .stabilized(250)
        )

        neededTiles.addCallbackAndRunD((neededIndexes) => {
            for (const neededIndex of neededIndexes) {
                loadedTiles.add(neededIndex)
                super.addSource(constructSource(neededIndex))
            }
        })
    }
}
