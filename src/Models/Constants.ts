import { Utils } from "../Utils"
import * as meta from "../../package.json"

export type PriviligedLayerType = (typeof Constants.priviliged_layers)[number]

export default class Constants {
    public static vNumber = meta.version

    public static ImgurApiKey = "7070e7167f0a25a"
    public static readonly mapillary_client_token_v4 =
        "MLY|4441509239301885|b40ad2d3ea105435bd40c7e76993ae85"

    /**
     * API key for Maproulette
     *
     * Currently there is no user-friendly way to get the user's API key.
     * See https://github.com/maproulette/maproulette2/issues/476 for more information.
     * Using an empty string however does work for most actions, but will attribute all actions to the Superuser.
     */
    public static readonly MaprouletteApiKey = ""

    public static defaultOverpassUrls = [
        // The official instance, 10000 queries per day per project allowed
        "https://overpass-api.de/api/interpreter",
        // 'Fair usage'
        "https://overpass.kumi.systems/api/interpreter",
        // Offline: "https://overpass.nchc.org.tw/api/interpreter",
        "https://overpass.openstreetmap.ru/cgi/interpreter",
        // Doesn't support nwr: "https://overpass.openstreetmap.fr/api/interpreter"
    ]

    public static readonly added_by_default = [
        "selected_element",
        "gps_location",
        "gps_location_history",
        "home_location",
        "gps_track",
        "range",
        "last_click",
    ] as const
    /**
     * Special layers which are not included in a theme by default
     */
    public static readonly no_include = [
        "conflation",
        "split_point",
        "split_road",
        "current_view",
        "matchpoint",
        "import_candidate",
        "usersettings",
    ] as const
    /**
     * Layer IDs of layers which have special properties through built-in hooks
     */
    public static readonly priviliged_layers = [
        ...Constants.added_by_default,
        ...Constants.no_include,
    ] as const

    // The user journey states thresholds when a new feature gets unlocked
    public static userJourney = {
        moreScreenUnlock: 1,
        personalLayoutUnlock: 5,
        historyLinkVisible: 10,
        deletePointsOfOthersUnlock: 20,
        tagsVisibleAt: 25,
        tagsVisibleAndWikiLinked: 30,

        mapCompleteHelpUnlock: 50,
        themeGeneratorReadOnlyUnlock: 50,
        themeGeneratorFullUnlock: 500,
        addNewPointWithUnreadMessagesUnlock: 500,

        importHelperUnlock: 5000,
    }
    static readonly minZoomLevelToAddNewPoint = Constants.isRetina() ? 18 : 19
    /**
     * Used by 'PendingChangesUploader', which waits this amount of seconds to upload changes.
     * (Note that pendingChanges might upload sooner if the popup is closed or similar)
     */
    static updateTimeoutSec: number = 30
    /**
     * If the contributor has their GPS location enabled and makes a change,
     * the points visited less then `nearbyVisitTime`-seconds ago will be inspected.
     * The point closest to the changed feature will be considered and this distance will be tracked.
     * ALl these distances are used to calculate a nearby-score
     */
    static nearbyVisitTime: number = 30 * 60
    /**
     * If a user makes a change, the distance to the changed object is calculated.
     * If a user makes multiple changes, all these distances are put into multiple bins, depending on this distance.
     * For every bin, the totals are uploaded as metadata
     */
    static distanceToChangeObjectBins = [25, 50, 100, 500, 1000, 5000, Number.MAX_VALUE]
    static themeOrder = [
        "personal",
        "cyclofix",
        "waste",
        "etymology",
        "food",
        "cafes_and_pubs",
        "playgrounds",
        "hailhydrant",
        "toilets",
        "aed",
        "bookcases",
    ]
    /**
     * Upon initialization, the GPS will search the location.
     * If the location is found within the given timout, it'll automatically fly to it.
     *
     * In seconds
     */
    static zoomToLocationTimeout = 15
    static countryCoderEndpoint: string =
        "https://raw.githubusercontent.com/pietervdvn/MapComplete-data/main/latlon2country"
    public static readonly OsmPreferenceKeyPicturesLicense = "pictures-license"
    /**
     * These are the values that are allowed to use as 'backdrop' icon for a map pin
     */
    private static readonly _defaultPinIcons = [
        "square",
        "circle",
        "none",
        "pin",
        "person",
        "plus",
        "ring",
        "star",
        "teardrop",
        "triangle",
        "crosshair",
    ] as const
    public static readonly defaultPinIcons: string[] = <any>Constants._defaultPinIcons

    private static isRetina(): boolean {
        if (Utils.runningFromConsole) {
            return false
        }
        // The cause for this line of code: https://github.com/pietervdvn/MapComplete/issues/115
        // See https://stackoverflow.com/questions/19689715/what-is-the-best-way-to-detect-retina-support-on-a-device-using-javascript
        return (
            (window.matchMedia &&
                (window.matchMedia(
                    "only screen and (min-resolution: 192dpi), only screen and (min-resolution: 2dppx), only screen and (min-resolution: 75.6dpcm)"
                ).matches ||
                    window.matchMedia(
                        "only screen and (-webkit-min-device-pixel-ratio: 2), only screen and (-o-min-device-pixel-ratio: 2/1), only screen and (min--moz-device-pixel-ratio: 2), only screen and (min-device-pixel-ratio: 2)"
                    ).matches)) ||
            (window.devicePixelRatio && window.devicePixelRatio >= 2)
        )
    }
}
