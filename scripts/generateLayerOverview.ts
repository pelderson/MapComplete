import ScriptUtils from "./ScriptUtils"
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs"
import licenses from "../src/assets/generated/license_info.json"
import { LayoutConfigJson } from "../src/Models/ThemeConfig/Json/LayoutConfigJson"
import { LayerConfigJson } from "../src/Models/ThemeConfig/Json/LayerConfigJson"
import Constants from "../src/Models/Constants"
import {
    DetectDuplicateFilters,
    DoesImageExist,
    PrevalidateTheme,
    ValidateLayer,
    ValidateThemeAndLayers,
} from "../src/Models/ThemeConfig/Conversion/Validation"
import { Translation } from "../src/UI/i18n/Translation"
import { TagRenderingConfigJson } from "../src/Models/ThemeConfig/Json/TagRenderingConfigJson"
import PointRenderingConfigJson from "../src/Models/ThemeConfig/Json/PointRenderingConfigJson"
import { PrepareLayer } from "../src/Models/ThemeConfig/Conversion/PrepareLayer"
import { PrepareTheme } from "../src/Models/ThemeConfig/Conversion/PrepareTheme"
import { DesugaringContext } from "../src/Models/ThemeConfig/Conversion/Conversion"
import { Utils } from "../src/Utils"
import Script from "./Script"
import { AllSharedLayers } from "../src/Customizations/AllSharedLayers"

// This scripts scans 'src/assets/layers/*.json' for layer definition files and 'src/assets/themes/*.json' for theme definition files.
// It spits out an overview of those to be used to load them

class LayerOverviewUtils extends Script {
    public static readonly layerPath = "./src/assets/generated/layers/"
    public static readonly themePath = "./src/assets/generated/themes/"

    constructor() {
        super("Reviews and generates the compiled themes")
    }

    private static publicLayerIdsFrom(themefiles: LayoutConfigJson[]): Set<string> {
        const publicThemes = [].concat(...themefiles.filter((th) => !th.hideFromOverview))

        return new Set([].concat(...publicThemes.map((th) => this.extractLayerIdsFrom(th))))
    }

    private static extractLayerIdsFrom(
        themeFile: LayoutConfigJson,
        includeInlineLayers = true
    ): string[] {
        const publicLayerIds = []
        for (const publicLayer of themeFile.layers) {
            if (typeof publicLayer === "string") {
                publicLayerIds.push(publicLayer)
                continue
            }
            if (publicLayer["builtin"] !== undefined) {
                const bi = publicLayer["builtin"]
                if (typeof bi === "string") {
                    publicLayerIds.push(bi)
                    continue
                }
                bi.forEach((id) => publicLayerIds.push(id))
                continue
            }
            if (includeInlineLayers) {
                publicLayerIds.push(publicLayer["id"])
            }
        }
        return publicLayerIds
    }

    shouldBeUpdated(sourcefile: string | string[], targetfile: string): boolean {
        if (!existsSync(targetfile)) {
            return true
        }
        const targetModified = statSync(targetfile).mtime
        if (typeof sourcefile === "string") {
            sourcefile = [sourcefile]
        }

        return sourcefile.some((sourcefile) => statSync(sourcefile).mtime > targetModified)
    }

    writeSmallOverview(
        themes: {
            id: string
            title: any
            shortDescription: any
            icon: string
            hideFromOverview: boolean
            mustHaveLanguage: boolean
            layers: (LayerConfigJson | string | { builtin })[]
        }[]
    ) {
        const perId = new Map<string, any>()
        for (const theme of themes) {
            const keywords: {}[] = []
            for (const layer of theme.layers ?? []) {
                const l = <LayerConfigJson>layer
                keywords.push({ "*": l.id })
                keywords.push(l.title)
                keywords.push(l.description)
            }

            const data = {
                id: theme.id,
                title: theme.title,
                shortDescription: theme.shortDescription,
                icon: theme.icon,
                hideFromOverview: theme.hideFromOverview,
                mustHaveLanguage: theme.mustHaveLanguage,
                keywords: Utils.NoNull(keywords),
            }
            perId.set(theme.id, data)
        }

        const sorted = Constants.themeOrder.map((id) => {
            if (!perId.has(id)) {
                throw "Ordered theme id " + id + " not found"
            }
            return perId.get(id)
        })

        perId.forEach((value) => {
            if (Constants.themeOrder.indexOf(value.id) >= 0) {
                return // actually a continue
            }
            sorted.push(value)
        })

        writeFileSync(
            "./src/assets/generated/theme_overview.json",
            JSON.stringify(sorted, null, "  "),
            { encoding: "utf8" }
        )
    }

    writeTheme(theme: LayoutConfigJson) {
        if (!existsSync(LayerOverviewUtils.themePath)) {
            mkdirSync(LayerOverviewUtils.themePath)
        }
        writeFileSync(
            `${LayerOverviewUtils.themePath}${theme.id}.json`,
            JSON.stringify(theme, null, "  "),
            { encoding: "utf8" }
        )
    }

    writeLayer(layer: LayerConfigJson) {
        if (!existsSync(LayerOverviewUtils.layerPath)) {
            mkdirSync(LayerOverviewUtils.layerPath)
        }
        writeFileSync(
            `${LayerOverviewUtils.layerPath}${layer.id}.json`,
            JSON.stringify(layer, null, "  "),
            { encoding: "utf8" }
        )
    }

    getSharedTagRenderings(
        doesImageExist: DoesImageExist,
        bootstrapTagRenderings: Map<string, TagRenderingConfigJson> = null
    ): Map<string, TagRenderingConfigJson> {
        const prepareLayer = new PrepareLayer({
            tagRenderings: bootstrapTagRenderings,
            sharedLayers: null,
            publicLayers: null,
        })

        let path = "assets/layers/questions/questions.json"
        const sharedQuestions = this.parseLayer(doesImageExist, prepareLayer, path)

        const dict = new Map<string, TagRenderingConfigJson>()

        for (const tr of sharedQuestions.tagRenderings) {
            const tagRendering = <TagRenderingConfigJson>tr
            dict.set(tagRendering.id, tagRendering)
        }

        if (dict.size === bootstrapTagRenderings?.size) {
            return dict
        }

        return this.getSharedTagRenderings(doesImageExist, dict)
    }

    checkAllSvgs() {
        const allSvgs = ScriptUtils.readDirRecSync("./src/assets")
            .filter((path) => path.endsWith(".svg"))
            .filter((path) => !path.startsWith("./src/assets/generated"))
        let errCount = 0
        const exempt = [
            "src/assets/SocialImageTemplate.svg",
            "src/assets/SocialImageTemplateWide.svg",
            "src/assets/SocialImageBanner.svg",
            "src/assets/SocialImageRepo.svg",
            "src/assets/svg/osm-logo.svg",
            "src/assets/templates/*",
        ]
        for (const path of allSvgs) {
            if (
                exempt.some((p) => {
                    if (p.endsWith("*") && path.startsWith("./" + p.substring(0, p.length - 1))) {
                        return true
                    }
                    return "./" + p === path
                })
            ) {
                continue
            }

            const contents = readFileSync(path, { encoding: "utf8" })
            if (contents.indexOf("data:image/png;") >= 0) {
                console.warn("The SVG at " + path + " is a fake SVG: it contains PNG data!")
                errCount++
                if (path.startsWith("./src/assets/svg")) {
                    throw "A core SVG is actually a PNG. Don't do this!"
                }
            }
            if (contents.indexOf("<text") > 0) {
                console.warn(
                    "The SVG at " +
                        path +
                        " contains a `text`-tag. This is highly discouraged. Every machine viewing your theme has their own font libary, and the font you choose might not be present, resulting in a different font being rendered. Solution: open your .svg in inkscape (or another program), select the text and convert it to a path"
                )
                errCount++
            }
        }
        if (errCount > 0) {
            throw `There are ${errCount} invalid svgs`
        }
    }

    async main(args: string[]) {
        const forceReload = args.some((a) => a == "--force")

        const licensePaths = new Set<string>()
        for (const i in licenses) {
            licensePaths.add(licenses[i].path)
        }
        const doesImageExist = new DoesImageExist(licensePaths, existsSync)
        const sharedLayers = this.buildLayerIndex(doesImageExist, forceReload)

        const priviliged = new Set<string>(Constants.priviliged_layers)
        sharedLayers.forEach((_, key) => {
            priviliged.delete(key)
        })
        if (priviliged.size > 0) {
            throw (
                "Priviliged layer " +
                Array.from(priviliged).join(", ") +
                " has no definition file, create it at `src/assets/layers/<layername>/<layername.json>"
            )
        }
        const recompiledThemes: string[] = []
        const sharedThemes = this.buildThemeIndex(
            licensePaths,
            sharedLayers,
            recompiledThemes,
            forceReload
        )

        writeFileSync(
            "./src/assets/generated/known_themes.json",
            JSON.stringify({
                themes: Array.from(sharedThemes.values()),
            })
        )

        writeFileSync(
            "./src/assets/generated/known_layers.json",
            JSON.stringify({ layers: Array.from(sharedLayers.values()) })
        )

        if (
            recompiledThemes.length > 0 &&
            !(recompiledThemes.length === 1 && recompiledThemes[0] === "mapcomplete-changes")
        ) {
            // mapcomplete-changes shows an icon for each corresponding mapcomplete-theme
            const iconsPerTheme = Array.from(sharedThemes.values()).map((th) => ({
                if: "theme=" + th.id,
                then: th.icon,
            }))
            const proto: LayoutConfigJson = JSON.parse(
                readFileSync("./assets/themes/mapcomplete-changes/mapcomplete-changes.proto.json", {
                    encoding: "utf8",
                })
            )
            const protolayer = <LayerConfigJson>(
                proto.layers.filter((l) => l["id"] === "mapcomplete-changes")[0]
            )
            const rendering = <PointRenderingConfigJson>protolayer.mapRendering[0]
            rendering.icon["mappings"] = iconsPerTheme
            writeFileSync(
                "./assets/themes/mapcomplete-changes/mapcomplete-changes.json",
                JSON.stringify(proto, null, "  ")
            )
        }

        this.checkAllSvgs()

        new DetectDuplicateFilters().convertStrict(
            {
                layers: ScriptUtils.getLayerFiles().map((f) => f.parsed),
                themes: ScriptUtils.getThemeFiles().map((f) => f.parsed),
            },
            "GenerateLayerOverview:"
        )

        if (AllSharedLayers.getSharedLayersConfigs().size == 0) {
            console.error("This was a bootstrapping-run. Run generate layeroverview again!")
        } else {
            const green = (s) => "\x1b[92m" + s + "\x1b[0m"
            console.log(green("All done!"))
        }
    }

    private parseLayer(
        doesImageExist: DoesImageExist,
        prepLayer: PrepareLayer,
        sharedLayerPath: string
    ): LayerConfigJson {
        let parsed
        try {
            parsed = JSON.parse(readFileSync(sharedLayerPath, "utf8"))
        } catch (e) {
            throw "Could not parse or read file " + sharedLayerPath
        }
        const context = "While building builtin layer " + sharedLayerPath
        const fixed = prepLayer.convertStrict(parsed, context)

        if (!fixed.source) {
            console.error(sharedLayerPath, "has no source configured:", fixed)
            throw sharedLayerPath + " layer has no source configured"
        }

        if (
            typeof fixed.source !== "string" &&
            fixed.source["osmTags"] &&
            fixed.source["osmTags"]["and"] === undefined
        ) {
            fixed.source["osmTags"] = { and: [fixed.source["osmTags"]] }
        }

        const validator = new ValidateLayer(sharedLayerPath, true, doesImageExist)
        validator.convertStrict(fixed, context)

        return fixed
    }

    private buildLayerIndex(
        doesImageExist: DoesImageExist,
        forceReload: boolean
    ): Map<string, LayerConfigJson> {
        // First, we expand and validate all builtin layers. These are written to src/assets/generated/layers
        // At the same time, an index of available layers is built.
        console.log("------------- VALIDATING THE BUILTIN QUESTIONS ---------------")
        const sharedTagRenderings = this.getSharedTagRenderings(doesImageExist)
        console.log("Shared questions are:", Array.from(sharedTagRenderings.keys()).join(", "))
        console.log("   ---------- VALIDATING BUILTIN LAYERS ---------")
        const state: DesugaringContext = {
            tagRenderings: sharedTagRenderings,
            sharedLayers: AllSharedLayers.getSharedLayersConfigs(),
        }
        const sharedLayers = new Map<string, LayerConfigJson>()
        const prepLayer = new PrepareLayer(state)
        const skippedLayers: string[] = []
        const recompiledLayers: string[] = []
        for (const sharedLayerPath of ScriptUtils.getLayerPaths()) {
            {
                const targetPath =
                    LayerOverviewUtils.layerPath +
                    sharedLayerPath.substring(sharedLayerPath.lastIndexOf("/"))
                if (!forceReload && !this.shouldBeUpdated(sharedLayerPath, targetPath)) {
                    const sharedLayer = JSON.parse(readFileSync(targetPath, "utf8"))
                    sharedLayers.set(sharedLayer.id, sharedLayer)
                    skippedLayers.push(sharedLayer.id)
                    console.log("Loaded " + sharedLayer.id)
                    continue
                }
            }

            const fixed = this.parseLayer(doesImageExist, prepLayer, sharedLayerPath)

            if (sharedLayers.has(fixed.id)) {
                throw "There are multiple layers with the id " + fixed.id
            }

            sharedLayers.set(fixed.id, fixed)
            recompiledLayers.push(fixed.id)

            this.writeLayer(fixed)
        }

        console.log(
            "Recompiled layers " +
                recompiledLayers.join(", ") +
                " and skipped " +
                skippedLayers.length +
                " layers"
        )

        return sharedLayers
    }

    private buildThemeIndex(
        licensePaths: Set<string>,
        sharedLayers: Map<string, LayerConfigJson>,
        recompiledThemes: string[],
        forceReload: boolean
    ): Map<string, LayoutConfigJson> {
        console.log("   ---------- VALIDATING BUILTIN THEMES ---------")
        const themeFiles = ScriptUtils.getThemeFiles()
        const fixed = new Map<string, LayoutConfigJson>()

        const publicLayers = LayerOverviewUtils.publicLayerIdsFrom(
            themeFiles.map((th) => th.parsed)
        )

        const convertState: DesugaringContext = {
            sharedLayers,
            tagRenderings: this.getSharedTagRenderings(
                new DoesImageExist(licensePaths, existsSync)
            ),
            publicLayers,
        }
        const knownTagRenderings = new Set<string>()
        convertState.tagRenderings.forEach((_, key) => knownTagRenderings.add(key))
        sharedLayers.forEach((layer) => {
            for (const tagRendering of layer.tagRenderings ?? []) {
                if (tagRendering["id"]) {
                    knownTagRenderings.add(layer.id + "." + tagRendering["id"])
                }
                if (tagRendering["labels"]) {
                    for (const label of tagRendering["labels"]) {
                        knownTagRenderings.add(layer.id + "." + label)
                    }
                }
            }
        })

        const skippedThemes: string[] = []
        for (let i = 0; i < themeFiles.length; i++) {
            const themeInfo = themeFiles[i]
            const themePath = themeInfo.path
            let themeFile = themeInfo.parsed

            const targetPath =
                LayerOverviewUtils.themePath + "/" + themePath.substring(themePath.lastIndexOf("/"))
            const usedLayers = Array.from(
                LayerOverviewUtils.extractLayerIdsFrom(themeFile, false)
            ).map((id) => LayerOverviewUtils.layerPath + id + ".json")

            if (!forceReload && !this.shouldBeUpdated([themePath, ...usedLayers], targetPath)) {
                fixed.set(
                    themeFile.id,
                    JSON.parse(
                        readFileSync(LayerOverviewUtils.themePath + themeFile.id + ".json", "utf8")
                    )
                )
                console.log("Skipping", themeFile.id)
                skippedThemes.push(themeFile.id)
                continue
            }
            console.log(`Validating ${i}/${themeFiles.length} '${themeInfo.parsed.id}'`)

            recompiledThemes.push(themeFile.id)

            new PrevalidateTheme().convertStrict(themeFile, themePath)
            try {
                themeFile = new PrepareTheme(convertState).convertStrict(themeFile, themePath)

                new ValidateThemeAndLayers(
                    new DoesImageExist(licensePaths, existsSync, knownTagRenderings),
                    themePath,
                    true,
                    knownTagRenderings
                ).convertStrict(themeFile, themePath)

                if (themeFile.icon.endsWith(".svg")) {
                    try {
                        ScriptUtils.ReadSvgSync(themeFile.icon, (svg) => {
                            const width: string = svg.$.width
                            const height: string = svg.$.height
                            const err = themeFile.hideFromOverview ? console.warn : console.error
                            if (width !== height) {
                                const e =
                                    `the icon for theme ${themeFile.id} is not square. Please square the icon at ${themeFile.icon}` +
                                    ` Width = ${width} height = ${height}`
                                err(e)
                            }

                            const w = parseInt(width)
                            const h = parseInt(height)
                            if (w < 370 || h < 370) {
                                const e: string = [
                                    `the icon for theme ${themeFile.id} is too small. Please rescale the icon at ${themeFile.icon}`,
                                    `Even though an SVG is 'infinitely scaleable', the icon should be dimensioned bigger. One of the build steps of the theme does convert the image to a PNG (to serve as PWA-icon) and having a small dimension will cause blurry images.`,
                                    ` Width = ${width} height = ${height}; we recommend a size of at least 500px * 500px and to use a square aspect ratio.`,
                                ].join("\n")
                                err(e)
                            }
                        })
                    } catch (e) {
                        console.error("Could not read " + themeFile.icon + " due to " + e)
                    }
                }

                this.writeTheme(themeFile)
                fixed.set(themeFile.id, themeFile)
            } catch (e) {
                console.error("ERROR: could not prepare theme " + themePath + " due to " + e)
                throw e
            }
        }

        this.writeSmallOverview(
            Array.from(fixed.values()).map((t) => {
                return {
                    ...t,
                    hideFromOverview: t.hideFromOverview ?? false,
                    shortDescription:
                        t.shortDescription ??
                        new Translation(t.description).FirstSentence().translations,
                    mustHaveLanguage: t.mustHaveLanguage?.length > 0,
                }
            })
        )

        console.log(
            "Recompiled themes " +
                recompiledThemes.join(", ") +
                " and skipped " +
                skippedThemes.length +
                " themes"
        )

        return fixed
    }
}

new LayerOverviewUtils().run()
