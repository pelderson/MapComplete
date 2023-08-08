import { LayerConfigJson } from "./LayerConfigJson"
import ExtraLinkConfigJson from "./ExtraLinkConfigJson"

import { RasterLayerProperties } from "../../RasterLayerProperties"

/**
 * Defines the entire theme.
 *
 * A theme is the collection of the layers that are shown; the intro text, the icon, ...
 * It more or less defines the entire experience.
 *
 * Most of the fields defined here are metadata about the theme, such as its name, description, supported languages, default starting location, ...
 *
 * The main chunk of the json will however be the 'layers'-array, where the details of your layers are.
 *
 * General remark: a type (string | any) indicates either a fixed or a translatable string.
 */
export interface LayoutConfigJson {
    /**
     * The id of this layout.
     *
     * This is used as hashtag in the changeset message, which will read something like "Adding data with #mapcomplete for theme #<the theme id>"
     * Make sure it is something decent and descriptive, it should be a simple, lowercase string.
     *
     * On official themes, it'll become the name of the page, e.g.
     * 'cyclestreets' which become 'cyclestreets.html'
     */
    id: string

    /**
     * Who helped to create this theme and should be attributed?
     */
    credits?: string

    /**
     * Only used in 'generateLayerOverview': if present, every translation will be checked to make sure it is fully translated.
     *
     * This must be a list of two-letter, lowercase codes which identifies the language, e.g. "en", "nl", ...
     */
    mustHaveLanguage?: string[]

    /**
     * The title, as shown in the welcome message and the more-screen.
     */
    title: string | Record<string, string>

    /**
     * A short description, showed as social description and in the 'more theme'-buttons.
     * Note that if this one is not defined, the first sentence of 'description' is used
     */
    shortDescription?: string | Record<string, string>

    /**
     * The description, as shown in the welcome message and the more-screen
     */
    description: string | Record<string, string>

    /**
     * A part of the description, shown under the login-button.
     */
    descriptionTail?: string | Record<string, string>

    /**
     * The icon representing this theme.
     * Used as logo in the more-screen and (for official themes) as favicon, webmanifest logo, ...
     * Either a URL or a base64 encoded value (which should include 'data:image/svg+xml;base64)
     *
     * Type: icon
     */
    icon: string

    /**
     * Link to a 'social image' which is included as og:image-tag on official themes.
     * Useful to share the theme on social media.
     * See https://www.h3xed.com/web-and-internet/how-to-use-og-image-meta-tag-facebook-reddit for more information$
     *
     * Type: image
     */
    socialImage?: string

    /**
     * Default location and zoom to start.
     * Note that this is barely used. Once the user has visited mapcomplete at least once, the previous location of the user will be used
     */
    startZoom: number
    startLat: number
    startLon: number

    /**
     * When a query is run, the data within bounds of the visible map is loaded.
     * However, users tend to pan and zoom a lot. It is pretty annoying if every single pan means a reloading of the data.
     * For this, the bounds are widened in order to make a small pan still within bounds of the loaded data.
     *
     * IF widenfactor is 1, this feature is disabled. A recommended value is between 1 and 3
     */
    widenFactor?: number
    /**
     * At low zoom levels, overpass is used to query features.
     * At high zoom level, the OSM api is used to fetch one or more BBOX aligning with a slippy tile.
     * The overpassMaxZoom controls the flipoverpoint: if the zoom is this or lower, overpass is used.
     */
    overpassMaxZoom?: 17 | number

    /**
     * When the OSM-api is used to fetch features, it does so in a tiled fashion.
     * These tiles are using a ceratin zoom level, that can be controlled here
     * Default: overpassMaxZoom + 1
     */
    osmApiTileSize?: number

    /**
     * An override applied on all layers of the theme.
     *
     * E.g.: if there are two layers defined:
     * ```
     * "layers":[
     *  {"title": ..., "tagRenderings": [...], "osmSource":{"tags": ...}},
     *  {"title", ..., "tagRenderings", [...], "osmSource":{"tags" ...}}
     * ]
     * ```
     *
     * and overrideAll is specified:
     * ```
     * "overrideAll": {
     *     "osmSource":{"geoJsonSource":"xyz"}
     * }
     * then the result will be that all the layers will have these properties applied and result in:
     * "layers":[
     *  {"title": ..., "tagRenderings": [...], "osmSource":{"tags": ..., "geoJsonSource":"xyz"}},
     *  {"title", ..., "tagRenderings", [...], "osmSource":{"tags" ..., "geoJsonSource":"xyz"}}
     * ]
     * ```
     *
     * If the overrideAll contains a list where the keys starts with a plus, the values will be appended (instead of discarding the old list), for example
     *
     * "overrideAll": {
     *   "+tagRenderings": [ { ... some tagrendering ... }]
     * }
     *
     * In the above scenario, `sometagrendering` will be added at the beginning of the tagrenderings of every layer
     */
    overrideAll?: Partial<any | LayerConfigJson>

    /**
     * The id of the default background. BY default: vanilla OSM
     */
    defaultBackgroundId?: string

    /**
     * Define some (overlay) slippy map tilesources
     */
    tileLayerSources?: (RasterLayerProperties & { defaultState?: true | boolean })[]

    /**
     * The layers to display.
     *
     * Every layer contains a description of which feature to display - the overpassTags which are queried.
     * Instead of running one query for every layer, the query is fused.
     *
     * Afterwards, every layer is given the list of features.
     * Every layer takes away the features that match with them*, and give the leftovers to the next layers.
     *
     * This implies that the _order_ of the layers is important in the case of features with the same tags;
     * as the later layers might never receive their feature.
     *
     * *layers can also remove 'leftover'-features if the leftovers overlap with a feature in the layer itself
     *
     * Note that builtin layers can be reused. Either put in the name of the layer to reuse, or use {builtin: "layername", override: ...}
     *
     * The 'override'-object will be copied over the original values of the layer, which allows to change certain aspects of the layer
     *
     * For example: If you would like to use layer nature reserves, but only from a specific operator (eg. Natuurpunt) you would use the following in your theme:
     *
     * ```
     * "layer": {
     *  "builtin": "nature_reserve",
     *  "override": {"source":
     *  {"osmTags": {
     *  "+and":["operator=Natuurpunt"]
     *    }
     *   }
     *  }
     * }
     * ```
     *
     * It's also possible to load multiple layers at once, for example, if you would like for both drinking water and benches to start at the zoomlevel at 12, you would use the following:
     *
     * ```
     * "layer": {
     *  "builtin": ["benches", "drinking_water"],
     *  "override": {"minzoom": 12}
     * }
     *```
     */
    layers: (
        | LayerConfigJson
        | string
        | {
              builtin: string | string[]
              override: Partial<LayerConfigJson>
              /**
               * TagRenderings with any of these labels will be removed from the layer.
               * Note that the 'id' and 'group' are considered labels too
               */
              hideTagRenderingsWithLabels?: string[]
          }
    )[]

    /**
     * The URL of a custom CSS stylesheet to modify the layout
     */
    customCss?: string
    /**
     * If set to true, this layout will not be shown in the overview with more themes
     */
    hideFromOverview?: boolean

    /**
     * If set to true, the basemap will not scroll outside of the area visible on initial zoom.
     * If set to [[lon, lat], [lon, lat]], the map will not scroll outside of those bounds.
     * Off by default, which will enable panning to the entire world
     */
    lockLocation?: [[number, number], [number, number]] | number[][]

    /**
     * Adds an additional button on the top-left of the application.
     * This can link to an arbitrary location.
     *
     * Note that {lat},{lon},{zoom}, {language} and {theme} will be replaced
     *
     * Default: {icon: "./assets/svg/pop-out.svg", href: 'https://mapcomplete.osm.be/{theme}.html?lat={lat}&lon={lon}&z={zoom}, requirements: ["iframe","no-welcome-message]},
     *
     */
    extraLink?: ExtraLinkConfigJson

    /**
     * If set to false, disables logging in.
     * The userbadge will be hidden, all login-buttons will be hidden and editing will be disabled
     */
    enableUserBadge?: true | boolean
    /**
     * If false, hides the tab 'share'-tab in the welcomeMessage
     */
    enableShareScreen?: true | boolean
    /**
     * Hides the tab with more themes in the welcomeMessage
     */
    enableMoreQuests?: true | boolean
    /**
     * If false, the layer selection/filter view will be hidden
     * The corresponding URL-parameter is 'fs-filters' instead of 'fs-layers'
     */
    enableLayers?: true | boolean
    /**
     * If set to false, hides the search bar
     */
    enableSearch?: true | boolean
    /**
     * If set to false, the ability to add new points or nodes will be disabled.
     * Editing already existing features will still be possible
     */
    enableAddNewPoints?: true | boolean
    /**
     * If set to false, the 'geolocation'-button will be hidden.
     */
    enableGeolocation?: true | boolean
    /**
     * Enable switching the backgroundlayer.
     * If false, the quickswitch-buttons are removed (bottom left) and the dropdown in the layer selection is removed as well
     */
    enableBackgroundLayerSelection?: true | boolean
    /**
     * If set to true, will show _all_ unanswered questions in a popup instead of just the next one
     */
    enableShowAllQuestions?: false | boolean
    /**
     * If set to true, download button for the data will be shown (offers downloading as geojson and csv)
     */
    enableDownload?: true | boolean
    /**
     * If set to true, exporting a pdf is enabled
     */
    enablePdfDownload?: true | boolean

    /**
     * If true, notes will be loaded and parsed. If a note is an import (as created by the import_helper.html-tool from mapcomplete),
     * these notes will be shown if a relevant layer is present.
     *
     * Default is true for official layers and false for unofficial (sideloaded) layers
     */
    enableNoteImports?: true | boolean

    /**
     * Set one or more overpass URLs to use for this theme..
     */
    overpassUrl?: string | string[]
    /**
     * Set a different timeout for overpass queries - in seconds. Default: 30s
     */
    overpassTimeout?: number

    /**
     * Enables tracking of all nodes when data is loaded.
     * This is useful for the 'ImportWay' and 'ConflateWay'-buttons who need this database.
     *
     * Note: this flag will be automatically set.
     */
    enableNodeDatabase?: boolean
}
