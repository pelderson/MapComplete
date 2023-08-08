import Combine from "../Base/Combine"
import BaseUIElement from "../BaseUIElement"
import Svg from "../../Svg"
import Link from "../Base/Link"
import { FixedUiElement } from "../Base/FixedUiElement"
import Translations from "../i18n/Translations"
import { Utils } from "../../Utils"
import Img from "../Base/Img"
import { SlideShow } from "../Image/SlideShow"
import { Stores, UIEventSource } from "../../Logic/UIEventSource"
import { OsmConnection } from "../../Logic/Osm/OsmConnection"
import { VariableUiElement } from "../Base/VariableUIElement"

export default class NoteCommentElement extends Combine {
    constructor(comment: {
        date: string
        uid: number
        user: string
        user_url: string
        action: "closed" | "opened" | "reopened" | "commented"
        text: string
        html: string
    }) {
        const t = Translations.t.notes

        let actionIcon: BaseUIElement
        if (comment.action === "opened" || comment.action === "reopened") {
            actionIcon = Svg.note_svg()
        } else if (comment.action === "closed") {
            actionIcon = Svg.resolved_svg()
        } else {
            actionIcon = Svg.speech_bubble_svg()
        }

        let user: BaseUIElement
        if (comment.user === undefined) {
            user = t.anonymous
        } else {
            user = new Link(comment.user, comment.user_url ?? "", true)
        }

        let userinfo = Stores.FromPromise(
            Utils.downloadJsonCached(
                "https://www.openstreetmap.org/api/0.6/user/" + comment.uid,
                24 * 60 * 60 * 1000
            )
        )
        let userImg = new VariableUiElement(
            userinfo.map((userinfo) => {
                const href = userinfo?.user?.img?.href
                if (href !== undefined) {
                    return new Img(href).SetClass("rounded-full w-8 h-8 mr-4")
                }
                return undefined
            })
        )

        const htmlElement = document.createElement("div")
        htmlElement.innerHTML = comment.html
        const images = Array.from(htmlElement.getElementsByTagName("a"))
            .map((link) => link.href)
            .filter((link) => {
                link = link.toLowerCase()
                const lastDotIndex = link.lastIndexOf(".")
                const extension = link.substring(lastDotIndex + 1, link.length)
                return Utils.imageExtensions.has(extension)
            })
        let imagesEl: BaseUIElement = undefined
        if (images.length > 0) {
            const imageEls = images.map((i) =>
                new Img(i).SetClass("w-full block").SetStyle("min-width: 50px; background: grey;")
            )
            imagesEl = new SlideShow(new UIEventSource<BaseUIElement[]>(imageEls)).SetClass("mb-1")
        }

        super([
            new Combine([
                actionIcon.SetClass("mr-4 w-6").SetStyle("flex-shrink: 0"),
                new FixedUiElement(comment.html).SetClass("flex flex-col").SetStyle("margin: 0"),
            ]).SetClass("flex"),
            imagesEl,
            new Combine([userImg, user.SetClass("mr-2"), comment.date]).SetClass(
                "flex justify-end items-center subtle"
            ),
        ])
        this.SetClass("flex flex-col pb-2 mb-2 border-gray-500 border-b")
    }

    public static addCommentTo(
        txt: string,
        tags: UIEventSource<any>,
        state: { osmConnection: OsmConnection }
    ) {
        const comments: any[] = JSON.parse(tags.data["comments"])
        const username = state.osmConnection.userDetails.data.name

        var urlRegex = /(https?:\/\/[^\s]+)/g
        const html = txt.replace(urlRegex, function (url) {
            return '<a href="' + url + '">' + url + "</a>"
        })

        comments.push({
            date: new Date().toISOString(),
            uid: state.osmConnection.userDetails.data.uid,
            user: username,
            user_url: "https://www.openstreetmap.org/user/" + username,
            action: "commented",
            text: txt,
            html: html,
        })
        tags.data["comments"] = JSON.stringify(comments)
        tags.ping()
    }
}
