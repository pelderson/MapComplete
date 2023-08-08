import { LayoutConfigJson } from "../Json/LayoutConfigJson"
import { Utils } from "../../../Utils"
import LineRenderingConfigJson from "../Json/LineRenderingConfigJson"
import { LayerConfigJson } from "../Json/LayerConfigJson"
import { DesugaringStep, Each, Fuse, On } from "./Conversion"
import PointRenderingConfigJson from "../Json/PointRenderingConfigJson"

export class UpdateLegacyLayer extends DesugaringStep<
    LayerConfigJson | string | { builtin; override }
> {
    constructor() {
        super(
            "Updates various attributes from the old data format to the new to provide backwards compatibility with the formats",
            ["overpassTags", "source.osmtags", "tagRenderings[*].id", "mapRendering"],
            "UpdateLegacyLayer"
        )
    }

    convert(
        json: LayerConfigJson,
        context: string
    ): { result: LayerConfigJson; errors: string[]; warnings: string[] } {
        const warnings = []
        if (typeof json === "string" || json["builtin"] !== undefined) {
            // Reuse of an already existing layer; return as-is
            return { result: json, errors: [], warnings: [] }
        }
        let config = { ...json }

        if (config["overpassTags"]) {
            config.source = config.source ?? {
                osmTags: config["overpassTags"],
            }
            config.source["osmTags"] = config["overpassTags"]
            delete config["overpassTags"]
        }

        for (const preset of config.presets ?? []) {
            const preciseInput = preset["preciseInput"]
            if (typeof preciseInput === "boolean") {
                delete preset["preciseInput"]
            } else if (preciseInput !== undefined) {
                delete preciseInput["preferredBackground"]
                console.log("Precise input:", preciseInput)
                preset.snapToLayer = preciseInput.snapToLayer
                delete preciseInput.snapToLayer
                if (preciseInput.maxSnapDistance) {
                    preset.maxSnapDistance = preciseInput.maxSnapDistance
                    delete preciseInput.maxSnapDistance
                }
                if (Object.keys(preciseInput).length == 0) {
                    delete preset["preciseInput"]
                }
            }
        }

        if (config.tagRenderings !== undefined) {
            let i = 0
            for (const tagRendering of config.tagRenderings) {
                i++
                if (
                    typeof tagRendering === "string" ||
                    tagRendering["builtin"] !== undefined ||
                    tagRendering["rewrite"] !== undefined
                ) {
                    continue
                }
                if (tagRendering["id"] === undefined) {
                    if (tagRendering["#"] !== undefined) {
                        tagRendering["id"] = tagRendering["#"]
                        delete tagRendering["#"]
                    } else if (tagRendering["freeform"]?.key !== undefined) {
                        tagRendering["id"] = config.id + "-" + tagRendering["freeform"]["key"]
                    } else {
                        tagRendering["id"] = "tr-" + i
                    }
                }
            }
        }

        if (config.mapRendering === undefined) {
            config.mapRendering = []
            // This is a legacy format, lets create a pointRendering
            let location: ("point" | "centroid")[] = ["point"]
            let wayHandling: number = config["wayHandling"] ?? 0
            if (wayHandling !== 0) {
                location = ["point", "centroid"]
            }
            if (config["icon"] ?? config["label"] !== undefined) {
                const pointConfig = {
                    icon: config["icon"],
                    iconBadges: config["iconOverlays"],
                    label: config["label"],
                    iconSize: config["iconSize"],
                    location,
                    rotation: config["rotation"],
                }
                config.mapRendering.push(pointConfig)
            }

            if (wayHandling !== 1) {
                const lineRenderConfig = <LineRenderingConfigJson>{
                    color: config["color"],
                    width: config["width"],
                    dashArray: config["dashArray"],
                }
                if (Object.keys(lineRenderConfig).length > 0) {
                    config.mapRendering.push(lineRenderConfig)
                }
            }
            if (config.mapRendering.length === 0) {
                throw (
                    "Could not convert the legacy theme into a new theme: no renderings defined for layer " +
                    config.id
                )
            }
        }

        delete config["color"]
        delete config["width"]
        delete config["dashArray"]

        delete config["icon"]
        delete config["iconOverlays"]
        delete config["label"]
        delete config["iconSize"]
        delete config["rotation"]
        delete config["wayHandling"]
        delete config["hideUnderlayingFeaturesMinPercentage"]

        for (const mapRenderingElement of config.mapRendering ?? []) {
            if (mapRenderingElement["iconOverlays"] !== undefined) {
                mapRenderingElement["iconBadges"] = mapRenderingElement["iconOverlays"]
            }
            for (const overlay of mapRenderingElement["iconBadges"] ?? []) {
                if (overlay["badge"] !== true) {
                    warnings.push("Warning: non-overlay element for ", config.id)
                }
                delete overlay["badge"]
            }
        }

        for (const rendering of config.mapRendering ?? []) {
            if (!rendering["iconSize"]) {
                continue
            }
            const pr = <PointRenderingConfigJson>rendering
            let iconSize = pr.iconSize
            console.log("Iconsize is", iconSize)

            if (Object.keys(pr.iconSize).length === 1 && pr.iconSize["render"] !== undefined) {
                iconSize = pr.iconSize["render"]
            }

            if (typeof iconSize === "string")
                if (["bottom", "center", "top"].some((a) => (<string>iconSize).endsWith(a))) {
                    const parts = iconSize.split(",").map((parts) => parts.toLowerCase().trim())
                    pr.anchor = parts.pop()
                    pr.iconSize = parts.join(",")
                }
        }

        for (const rendering of config.mapRendering) {
            for (const key in rendering) {
                if (!rendering[key]) {
                    continue
                }
                if (
                    typeof rendering[key]["render"] === "string" &&
                    Object.keys(rendering[key]).length === 1
                ) {
                    console.log("Rewrite: ", rendering[key])
                    rendering[key] = rendering[key]["render"]
                }
            }
        }

        return {
            result: config,
            errors: [],
            warnings,
        }
    }
}

class UpdateLegacyTheme extends DesugaringStep<LayoutConfigJson> {
    constructor() {
        super("Small fixes in the theme config", ["roamingRenderings"], "UpdateLegacyTheme")
    }

    convert(
        json: LayoutConfigJson,
        context: string
    ): { result: LayoutConfigJson; errors: string[]; warnings: string[] } {
        const oldThemeConfig = { ...json }

        if (oldThemeConfig.socialImage === "") {
            delete oldThemeConfig.socialImage
        }

        if (oldThemeConfig["roamingRenderings"] !== undefined) {
            if (oldThemeConfig["roamingRenderings"].length == 0) {
                delete oldThemeConfig["roamingRenderings"]
            } else {
                return {
                    result: null,
                    errors: [
                        context +
                            ": The theme contains roamingRenderings. These are not supported anymore",
                    ],
                    warnings: [],
                }
            }
        }

        oldThemeConfig.layers = Utils.NoNull(oldThemeConfig.layers)
        delete oldThemeConfig["language"]
        delete oldThemeConfig["version"]

        if (oldThemeConfig["maintainer"] !== undefined) {
            console.log(
                "Maintainer: ",
                oldThemeConfig["maintainer"],
                "credits: ",
                oldThemeConfig["credits"]
            )
            if (oldThemeConfig.credits === undefined) {
                oldThemeConfig["credits"] = oldThemeConfig["maintainer"]
                delete oldThemeConfig["maintainer"]
            } else if (oldThemeConfig["maintainer"].toLowerCase().trim() === "mapcomplete") {
                delete oldThemeConfig["maintainer"]
            } else if (oldThemeConfig["maintainer"].toLowerCase().trim() === "") {
                delete oldThemeConfig["maintainer"]
            }
        }

        return {
            errors: [],
            warnings: [],
            result: oldThemeConfig,
        }
    }
}

export class FixLegacyTheme extends Fuse<LayoutConfigJson> {
    constructor() {
        super(
            "Fixes a legacy theme to the modern JSON format geared to humans. Syntactic sugars are kept (i.e. no tagRenderings are expandend, no dependencies are automatically gathered)",
            new UpdateLegacyTheme(),
            new On("layers", new Each(new UpdateLegacyLayer()))
        )
    }
}
