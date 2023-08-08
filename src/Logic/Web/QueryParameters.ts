/**
 * Wraps the query parameters into UIEventSources
 */
import { UIEventSource } from "../UIEventSource"
import Hash from "./Hash"
import { Utils } from "../../Utils"
import doc = Mocha.reporters.doc

export class QueryParameters {
    static defaults: Record<string, string> = {}
    static documentation: Map<string, string> = new Map<string, string>()
    private static order: string[] = ["layout", "test", "z", "lat", "lon"]
    protected static readonly _wasInitialized: Set<string> = new Set()
    protected static readonly knownSources: Record<string, UIEventSource<string>> = {}
    private static initialized = false

    public static GetQueryParameter(
        key: string,
        deflt: string,
        documentation?: string,
        options?: {
            stackOffset?: number
        }
    ): UIEventSource<string> {
        if (!this.initialized) {
            this.init()
        }

        if (Utils.runningFromConsole) {
            const location = Utils.getLocationInCode(-1 + (options?.stackOffset ?? 0))

            documentation +=
                "\n\nThis documentation is defined in the source code at [" +
                location.filename +
                "](" +
                location.markdownLocation +
                ")" +
                "\n\n"
        }

        QueryParameters.documentation.set(key, documentation)
        if (deflt !== undefined) {
            QueryParameters.defaults[key] = deflt
        }
        if (QueryParameters.knownSources[key] !== undefined) {
            return QueryParameters.knownSources[key]
        }
        QueryParameters.addOrder(key)
        const source = new UIEventSource<string>(deflt, "&" + key)
        QueryParameters.knownSources[key] = source
        source.addCallback(() => QueryParameters.Serialize())
        return source
    }

    public static SetDefaultFor(key: string, value: string) {
        if (QueryParameters.defaults[key] === value) {
            return
        }
        QueryParameters.defaults[key] = value
        QueryParameters.Serialize()
    }

    public static GetBooleanQueryParameter(
        key: string,
        deflt: boolean,
        documentation?: string
    ): UIEventSource<boolean> {
        return UIEventSource.asBoolean(
            QueryParameters.GetQueryParameter(key, "" + deflt, documentation, { stackOffset: -1 })
        )
    }

    public static wasInitialized(key: string): boolean {
        this.init()
        return QueryParameters._wasInitialized.has(key)
    }
    public static initializedParameters(): ReadonlyArray<string> {
        return Array.from(QueryParameters._wasInitialized.keys())
    }

    private static addOrder(key) {
        if (this.order.indexOf(key) < 0) {
            this.order.push(key)
        }
    }

    private static init() {
        if (this.initialized) {
            return
        }
        this.initialized = true

        if (Utils.runningFromConsole) {
            return
        }

        if (window?.location?.search) {
            const params = window.location.search.substr(1).split("&")
            for (const param of params) {
                const [key, value] = param.split("=")
                QueryParameters.addOrder(key)
                QueryParameters._wasInitialized.add(key)
                const v = decodeURIComponent(value)
                const source = new UIEventSource<string>(v)
                source.addCallback(() => QueryParameters.Serialize())
                QueryParameters.knownSources[key] = source
            }
        }
    }

    /**
     * Set the query parameters of the page location
     * @constructor
     * @private
     */
    private static Serialize() {
        const parts = []
        for (const key of QueryParameters.order) {
            if (QueryParameters.knownSources[key]?.data === undefined) {
                continue
            }

            if (QueryParameters.knownSources[key].data === "undefined") {
                continue
            }

            if (QueryParameters.knownSources[key].data === QueryParameters.defaults[key]) {
                continue
            }

            parts.push(
                encodeURIComponent(key) +
                    "=" +
                    encodeURIComponent(QueryParameters.knownSources[key].data)
            )
        }
        if (!Utils.runningFromConsole) {
            // Don't pollute the history every time a parameter changes
            try {
                history.replaceState(null, "", "?" + parts.join("&") + Hash.Current())
            } catch (e) {
                console.error(e)
            }
        }
    }

    static ClearAll() {
        for (const name in QueryParameters.knownSources) {
            QueryParameters.knownSources[name].setData(undefined)
        }
        QueryParameters._wasInitialized.clear()
        QueryParameters.order = []
    }
}
