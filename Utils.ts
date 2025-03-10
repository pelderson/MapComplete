import * as $ from "jquery"

export class Utils {

    /**
     * In the 'deploy'-step, some code needs to be run by ts-node.
     * However, ts-node crashes when it sees 'document'. When running from console, we flag this and disable all code where document is needed.
     * This is a workaround and yet another hack
     */
    public static runningFromConsole = false;

    public static readonly assets_path = "./assets/svg/";
    private static knownKeys = ["addExtraTags", "and", "calculatedTags", "changesetmessage", "clustering", "color", "condition", "customCss", "dashArray", "defaultBackgroundId", "description", "descriptionTail", "doNotDownload", "enableAddNewPoints", "enableBackgroundLayerSelection", "enableGeolocation", "enableLayers", "enableMoreQuests", "enableSearch", "enableShareScreen", "enableUserBadge", "freeform", "hideFromOverview", "hideInAnswer", "icon", "iconOverlays", "iconSize", "id", "if", "ifnot", "isShown", "key", "language", "layers", "lockLocation", "maintainer", "mappings", "maxzoom", "maxZoom", "minNeededElements", "minzoom", "multiAnswer", "name", "or", "osmTags", "passAllFeatures", "presets", "question", "render", "roaming", "roamingRenderings", "rotation", "shortDescription", "socialImage", "source", "startLat", "startLon", "startZoom", "tagRenderings", "tags", "then", "title", "titleIcons", "type", "version", "wayHandling", "widenFactor", "width"]
    private static extraKeys = ["nl", "en", "fr", "de", "pt", "es", "name", "phone", "email", "amenity", "leisure", "highway", "building", "yes", "no", "true", "false"]

    static EncodeXmlValue(str) {
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
    }

    /**
     * Gives a clean float, or undefined if parsing fails
     * @param str
     */
    static asFloat(str): number {
        if (str) {
            const i = parseFloat(str);
            if (isNaN(i)) {
                return undefined;
            }
            return i;
        }
        return undefined;
    }

    public static Upper(str: string) {
        return str.substr(0, 1).toUpperCase() + str.substr(1);
    }

    public static TwoDigits(i: number) {
        if (i < 10) {
            return "0" + i;
        }
        return "" + i;
    }

    public static Round(i: number) {
        if (i < 0) {
            return "-" + Utils.Round(-i);
        }
        const j = "" + Math.floor(i * 10);
        if (j.length == 1) {
            return "0." + j;
        }
        return j.substr(0, j.length - 1) + "." + j.substr(j.length - 1, j.length);
    }

    public static Times(f: ((i: number) => string), count: number): string {
        let res = "";
        for (let i = 0; i < count; i++) {
            res += f(i);
        }
        return res;
    }

    static DoEvery(millis: number, f: (() => void)) {
        if (Utils.runningFromConsole) {
            return;
        }
        window.setTimeout(
            function () {
                f();
                Utils.DoEvery(millis, f);
            }
            , millis)
    }

    public static NoNull<T>(array: T[]): T[] {
        const ls: T[] = [];
        for (const t of array) {
            if (t === undefined || t === null) {
                continue;
            }
            ls.push(t);
        }
        return ls;
    }

    public static NoEmpty(array: string[]): string[] {
        const ls: string[] = [];
        for (const t of array) {
            if (t === "") {
                continue;
            }
            ls.push(t);
        }
        return ls;
    }

    public static EllipsesAfter(str: string, l: number = 100) {
        if (str === undefined) {
            return undefined;
        }
        if (str.length <= l) {
            return str;
        }
        return str.substr(0, l - 3) + "...";
    }

    public static Dedup(arr: string[]): string[] {
        if (arr === undefined) {
            return undefined;
        }
        const newArr = [];
        for (const string of arr) {
            if (newArr.indexOf(string) < 0) {
                newArr.push(string);
            }
        }
        return newArr;
    }

    public static MergeTags(a: any, b: any) {
        const t = {};
        for (const k in a) {
            t[k] = a[k];
        }
        for (const k in b) {
            t[k] = b[k];
        }
        return t;
    }

    public static SplitFirst(a: string, sep: string): string[] {
        const index = a.indexOf(sep);
        if (index < 0) {
            return [a];
        }
        return [a.substr(0, index), a.substr(index + sep.length)];
    }

    // Date will be undefined on failure
    public static LoadCustomCss(location: string) {
        const head = document.getElementsByTagName('head')[0];
        const link = document.createElement('link');
        link.id = "customCss";
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = location;
        link.media = 'all';
        head.appendChild(link);
        console.log("Added custom layout ", location)
    }

    static Merge(source: any, target: any) {
        target = JSON.parse(JSON.stringify(target));
        source = JSON.parse(JSON.stringify(source));
        for (const key in source) {
            const sourceV = source[key];
            const targetV = target[key]
            if (typeof sourceV === "object") {
                if (targetV === undefined) {
                    target[key] = sourceV;
                } else {
                    Utils.Merge(sourceV, targetV);
                }

            } else {
                target[key] = sourceV;
            }

        }
        return target;
    }

    static getOrSetDefault<K, V>(dict: Map<K, V>, k: K, v: () => V) {
        let found = dict.get(k);
        if (found !== undefined) {
            return found;
        }
        dict.set(k, v());
        return dict.get(k);

    }

    /**
     * Calculates the tile bounds of the
     * @param z
     * @param x
     * @param y
     * @returns [[lat, lon], [lat, lon]]
     */
    static tile_bounds(z: number, x: number, y: number): [[number, number], [number, number]] {
        return [[Utils.tile2lat(y, z), Utils.tile2long(x, z)], [Utils.tile2lat(y + 1, z), Utils.tile2long(x + 1, z)]]
    }

    /**
     * Return x, y of the tile containing (lat, lon) on the given zoom level
     */
    static embedded_tile(lat: number, lon: number, z: number): { x: number, y: number, z: number } {
        return {x: Utils.lon2tile(lon, z), y: Utils.lat2tile(lat, z), z: z}
    }

    public static MinifyJSON(stringified: string): string {
        stringified = stringified.replace(/\|/g, "||");

        const keys = Utils.knownKeys.concat(Utils.extraKeys);
        for (let i = 0; i < keys.length; i++) {
            const knownKey = keys[i];
            let code = i;
            if (i >= 124) {
                code += 1; // Character 127 is our 'escape' character |
            }
            let replacement = "|" + String.fromCharCode(code)
            stringified = stringified.replace(new RegExp(`\"${knownKey}\":`, "g"), replacement);
        }

        return stringified;
    }

    public static UnMinify(minified: string): string {

        const parts = minified.split("|");
        let result = parts.shift();
        const keys = Utils.knownKeys.concat(Utils.extraKeys);

        for (const part of parts) {
            if (part == "") {
                // Empty string => this was a || originally
                result += "|"
                continue
            }
            const i = part.charCodeAt(0);
            result += "\"" + keys[i] + "\":" + part.substring(1)
        }

        return result;
    }

    private static tile2long(x, z) {
        return (x / Math.pow(2, z) * 360 - 180);
    }

    private static tile2lat(y, z) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
    }

    private static lon2tile(lon, zoom) {
        return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
    }

    private static lat2tile(lat, zoom) {
        return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
    }
}
