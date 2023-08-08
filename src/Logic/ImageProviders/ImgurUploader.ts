import { UIEventSource } from "../UIEventSource"
import { Imgur } from "./Imgur"

export default class ImgurUploader {
    public readonly queue: UIEventSource<string[]> = new UIEventSource<string[]>([])
    public readonly failed: UIEventSource<string[]> = new UIEventSource<string[]>([])
    public readonly success: UIEventSource<string[]> = new UIEventSource<string[]>([])
    public maxFileSizeInMegabytes = 10
    private readonly _handleSuccessUrl: (string) => Promise<void>

    constructor(handleSuccessUrl: (string) => Promise<void>) {
        this._handleSuccessUrl = handleSuccessUrl
    }

    public uploadMany(title: string, description: string, files: FileList): void {
        for (let i = 0; i < files.length; i++) {
            this.queue.data.push(files.item(i).name)
        }
        this.queue.ping()

        const self = this
        this.queue.setData([...self.queue.data])
        Imgur.uploadMultiple(
            title,
            description,
            files,
            async function (url) {
                console.log("File saved at", url)
                self.success.data.push(url)
                self.success.ping()
                await self._handleSuccessUrl(url)
            },
            function () {
                console.log("All uploads completed")
            },

            function (failReason) {
                console.log("Upload failed due to ", failReason)
                self.failed.setData([...self.failed.data, failReason])
            }
        )
    }
}
