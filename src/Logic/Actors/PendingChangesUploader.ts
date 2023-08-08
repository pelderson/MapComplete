import { Changes } from "../Osm/Changes"
import Constants from "../../Models/Constants"
import { UIEventSource } from "../UIEventSource"
import { Utils } from "../../Utils"
import { Feature } from "geojson"

export default class PendingChangesUploader {
    private lastChange: Date

    constructor(changes: Changes, selectedFeature: UIEventSource<Feature>) {
        const self = this
        this.lastChange = new Date()
        changes.pendingChanges.addCallback(() => {
            self.lastChange = new Date()

            window.setTimeout(() => {
                const diff = (new Date().getTime() - self.lastChange.getTime()) / 1000
                if (Constants.updateTimeoutSec >= diff - 1) {
                    changes.flushChanges("Flushing changes due to timeout")
                }
            }, Constants.updateTimeoutSec * 1000)
        })

        selectedFeature.stabilized(10000).addCallback((feature) => {
            if (feature === undefined) {
                // The popup got closed - we flush
                changes.flushChanges("Flushing changes due to popup closed")
            }
        })

        if (Utils.runningFromConsole) {
            return
        }

        document.addEventListener("mouseout", (e) => {
            // @ts-ignore
            if (!e.toElement && !e.relatedTarget) {
                changes.flushChanges("Flushing changes due to focus lost")
            }
        })

        document.onfocus = () => {
            changes.flushChanges("OnFocus")
        }

        document.onblur = () => {
            changes.flushChanges("OnFocus")
        }
        try {
            document.addEventListener(
                "visibilitychange",
                () => {
                    changes.flushChanges("Visibility change")
                },
                false
            )
        } catch (e) {
            console.warn("Could not register visibility change listener", e)
        }

        function onunload(e) {
            if (changes.pendingChanges.data.length == 0) {
                return
            }
            changes.flushChanges("onbeforeunload - probably closing or something similar")
            e.preventDefault()
            return "Saving your last changes..."
        }

        window.onbeforeunload = onunload
        // https://stackoverflow.com/questions/3239834/window-onbeforeunload-not-working-on-the-ipad#4824156
        window.addEventListener("pagehide", onunload)
    }
}
