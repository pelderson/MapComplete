import { UIEventSource } from "../UIEventSource"
import UserDetails, { OsmConnection } from "./OsmConnection"
import { Utils } from "../../Utils"

export class OsmPreferences {
    public preferences = new UIEventSource<Record<string, string>>({}, "all-osm-preferences")
    private readonly preferenceSources = new Map<string, UIEventSource<string>>()
    private auth: any
    private userDetails: UIEventSource<UserDetails>
    private longPreferences = {}

    constructor(auth, osmConnection: OsmConnection) {
        this.auth = auth
        this.userDetails = osmConnection.userDetails
        const self = this
        osmConnection.OnLoggedIn(() => self.UpdatePreferences())
    }

    /**
     * OSM preferences can be at most 255 chars
     * @param key
     * @param prefix
     * @constructor
     */
    public GetLongPreference(key: string, prefix: string = "mapcomplete-"): UIEventSource<string> {
        if (this.longPreferences[prefix + key] !== undefined) {
            return this.longPreferences[prefix + key]
        }

        const source = new UIEventSource<string>(undefined, "long-osm-preference:" + prefix + key)
        this.longPreferences[prefix + key] = source

        const allStartWith = prefix + key + "-combined"
        const subOptions = { prefix: "" }
        // Gives the number of combined preferences
        const length = this.GetPreference(allStartWith + "-length", "", subOptions)

        if ((allStartWith + "-length").length > 255) {
            throw (
                "This preference key is too long, it has " +
                key.length +
                " characters, but at most " +
                (255 - "-length".length - "-combined".length - prefix.length) +
                " characters are allowed"
            )
        }

        const self = this
        source.addCallback((str) => {
            if (str === undefined || str === "") {
                return
            }
            if (str === null) {
                console.error("Deleting " + allStartWith)
                let count = parseInt(length.data)
                for (let i = 0; i < count; i++) {
                    // Delete all the preferences
                    self.GetPreference(allStartWith + "-" + i, "", subOptions).setData("")
                }
                self.GetPreference(allStartWith + "-length", "", subOptions).setData("")
                return
            }

            let i = 0
            while (str !== "") {
                if (str === undefined || str === "undefined") {
                    throw "Long pref became undefined?"
                }
                if (i > 100) {
                    throw "This long preference is getting very long... "
                }
                self.GetPreference(allStartWith + "-" + i, "", subOptions).setData(
                    str.substr(0, 255)
                )
                str = str.substr(255)
                i++
            }
            length.setData("" + i) // We use I, the number of preference fields used
        })

        function updateData(l: number) {
            if (Object.keys(self.preferences.data).length === 0) {
                // The preferences are still empty - they are not yet updated, so we delay updating for now
                return
            }
            const prefsCount = Number(l)
            if (prefsCount > 100) {
                throw "Length to long"
            }
            let str = ""
            for (let i = 0; i < prefsCount; i++) {
                const key = allStartWith + "-" + i
                if (self.preferences.data[key] === undefined) {
                    console.warn(
                        "Detected a broken combined preference:",
                        key,
                        "is undefined",
                        self.preferences
                    )
                }
                str += self.preferences.data[key] ?? ""
            }

            source.setData(str)
        }

        length.addCallback((l) => {
            updateData(Number(l))
        })
        this.preferences.addCallbackAndRun((_) => {
            updateData(Number(length.data))
        })

        return source
    }

    public GetPreference(
        key: string,
        defaultValue: string = undefined,
        options?: {
            documentation?: string
            prefix?: string
        }
    ): UIEventSource<string> {
        const prefix: string = options?.prefix ?? "mapcomplete-"
        if (key.startsWith(prefix) && prefix !== "") {
            console.trace(
                "A preference was requested which has a duplicate prefix in its key. This is probably a bug"
            )
        }
        key = prefix + key
        key = key.replace(/[:\\\/"' {}.%]/g, "")
        if (key.length >= 255) {
            throw "Preferences: key length to big"
        }
        const cached = this.preferenceSources.get(key)
        if (cached !== undefined) {
            return cached
        }
        if (this.userDetails.data.loggedIn && this.preferences.data[key] === undefined) {
            this.UpdatePreferences()
        }

        const pref = new UIEventSource<string>(
            this.preferences.data[key] ?? defaultValue,
            "osm-preference:" + key
        )
        pref.addCallback((v) => {
            this.UploadPreference(key, v)
        })

        this.preferences.addCallbackD((allPrefs) => {
            const v = allPrefs[key]
            if (v === undefined) {
                return
            }
            pref.setData(v)
        })

        this.preferenceSources.set(key, pref)
        return pref
    }

    public ClearPreferences() {
        let isRunning = false
        const self = this
        this.preferences.addCallback((prefs) => {
            console.log("Cleaning preferences...")
            if (Object.keys(prefs).length == 0) {
                return
            }
            if (isRunning) {
                return
            }
            isRunning = true
            const prefixes = ["mapcomplete-"]
            for (const key in prefs) {
                const matches = prefixes.some((prefix) => key.startsWith(prefix))
                if (matches) {
                    console.log("Clearing ", key)
                    self.GetPreference(key, "", { prefix: "" }).setData("")
                }
            }
            isRunning = false
            return
        })
    }

    private UpdatePreferences() {
        const self = this
        this.auth.xhr(
            {
                method: "GET",
                path: "/api/0.6/user/preferences",
            },
            function (error, value: XMLDocument) {
                if (error) {
                    console.log("Could not load preferences", error)
                    return
                }
                const prefs = value.getElementsByTagName("preference")
                for (let i = 0; i < prefs.length; i++) {
                    const pref = prefs[i]
                    const k = pref.getAttribute("k")
                    const v = pref.getAttribute("v")
                    self.preferences.data[k] = v
                }

                // We merge all the preferences: new keys are uploaded
                // For differing values, the server overrides local changes
                self.preferenceSources.forEach((preference, key) => {
                    const osmValue = self.preferences.data[key]
                    if (osmValue === undefined && preference.data !== undefined) {
                        // OSM doesn't know this value yet
                        self.UploadPreference(key, preference.data)
                    } else {
                        // OSM does have a value - set it
                        preference.setData(osmValue)
                    }
                })

                self.preferences.ping()
            }
        )
    }

    private UploadPreference(k: string, v: string) {
        if (!this.userDetails.data.loggedIn) {
            console.debug(`Not saving preference ${k}: user not logged in`)
            return
        }

        if (this.preferences.data[k] === v) {
            return
        }
        const self = this
        console.debug("Updating preference", k, " to ", Utils.EllipsesAfter(v, 15))

        if (v === undefined || v === "") {
            this.auth.xhr(
                {
                    method: "DELETE",
                    path: "/api/0.6/user/preferences/" + encodeURIComponent(k),
                    options: { header: { "Content-Type": "text/plain" } },
                },
                function (error) {
                    if (error) {
                        console.warn("Could not remove preference", error)
                        return
                    }
                    delete self.preferences.data[k]
                    self.preferences.ping()
                    console.debug("Preference ", k, "removed!")
                }
            )
            return
        }

        this.auth.xhr(
            {
                method: "PUT",
                path: "/api/0.6/user/preferences/" + encodeURIComponent(k),
                options: { header: { "Content-Type": "text/plain" } },
                content: v,
            },
            function (error) {
                if (error) {
                    console.warn(`Could not set preference "${k}"'`, error)
                    return
                }
                self.preferences.data[k] = v
                self.preferences.ping()
                console.debug(`Preference ${k} written!`)
            }
        )
    }
}
