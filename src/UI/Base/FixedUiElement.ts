import BaseUIElement from "../BaseUIElement"

export class FixedUiElement extends BaseUIElement {
    public readonly content: string

    constructor(html: string) {
        super()
        this.content = html ?? ""
    }

    InnerRender(): string {
        return this.content
    }

    AsMarkdown(): string {
        if (this.HasClass("code")) {
            if (this.content.indexOf("\n") > 0 || this.HasClass("block")) {
                return "\n```\n" + this.content + "\n```\n"
            }
            return "`" + this.content + "`"
        }
        if (this.HasClass("font-bold")) {
            return "*" + this.content + "*"
        }
        return this.content
    }

    protected InnerConstructElement(): HTMLElement {
        const e = document.createElement("span")
        e.innerHTML = this.content
        return e
    }
}
