import LayerConfig from "../Models/ThemeConfig/LayerConfig"
import { Utils } from "../Utils"
import known_themes from "../assets/generated/known_layers.json"
import { LayerConfigJson } from "../Models/ThemeConfig/Json/LayerConfigJson"
import { AllKnownLayouts } from "./AllKnownLayouts"
export class AllSharedLayers {
    public static sharedLayers: Map<string, LayerConfig> = AllSharedLayers.getSharedLayers()
    public static getSharedLayersConfigs(): Map<string, LayerConfigJson> {
        const sharedLayers = new Map<string, LayerConfigJson>()
        for (const layer of known_themes.layers) {
            // @ts-ignore
            sharedLayers.set(layer.id, layer)
        }

        return sharedLayers
    }
    private static getSharedLayers(): Map<string, LayerConfig> {
        const sharedLayers = new Map<string, LayerConfig>()
        for (const layer of known_themes.layers) {
            try {
                // @ts-ignore
                const parsed = new LayerConfig(layer, "shared_layers")
                sharedLayers.set(layer.id, parsed)
            } catch (e) {
                if (!Utils.runningFromConsole) {
                    console.error(
                        "CRITICAL: Could not parse a layer configuration!",
                        layer.id,
                        " due to",
                        e
                    )
                }
            }
        }

        return sharedLayers
    }

    public static AllPublicLayers(options?: {
        includeInlineLayers: true | boolean
    }): LayerConfig[] {
        const allLayers: LayerConfig[] = []
        const seendIds = new Set<string>()
        AllSharedLayers.sharedLayers.forEach((layer, key) => {
            seendIds.add(key)
            allLayers.push(layer)
        })
        if (options?.includeInlineLayers ?? true) {
            const publicLayouts = Array.from(AllKnownLayouts.allKnownLayouts.values()).filter(
                (l) => !l.hideFromOverview
            )
            for (const layout of publicLayouts) {
                if (layout.hideFromOverview) {
                    continue
                }
                for (const layer of layout.layers) {
                    if (seendIds.has(layer.id)) {
                        continue
                    }
                    seendIds.add(layer.id)
                    allLayers.push(layer)
                }
            }
        }

        return allLayers
    }
}
