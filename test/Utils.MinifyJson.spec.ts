import { Utils } from "../src/Utils"
import LZString from "lz-string"
import { describe, expect, it } from "vitest"

const example = {
    id: "bookcases",
    maintainer: "MapComplete",
    version: "2020-08-29",
    language: ["en", "nl", "de", "fr"],
    title: {
        en: "Open Bookcase Map",
        nl: "Open Boekenruilkastenkaart",
        de: "Öffentliche Bücherschränke Karte",
        fr: "Carte des microbibliothèques",
    },
    description: {
        en: "A public bookcase is a small streetside cabinet, box, old phone boot or some other objects where books are stored. Everyone can place or take a book. This map aims to collect all these bookcases. You can discover new bookcases nearby and, with a free OpenStreetMap account, quickly add your favourite bookcases.",
        nl: "Een boekenruilkast is een kastje waar iedereen een boek kan nemen of achterlaten. Op deze kaart kan je deze boekenruilkasten terugvinden en met een gratis OpenStreetMap-account, ook boekenruilkasten toevoegen of informatie verbeteren",
        de: "Ein öffentlicher Bücherschrank ist ein kleiner Bücherschrank am Straßenrand, ein Kasten, eine alte Telefonzelle oder andere Gegenstände, in denen Bücher aufbewahrt werden. Jeder kann ein Buch hinstellen oder mitnehmen. Diese Karte zielt darauf ab, all diese Bücherschränke zu sammeln. Sie können neue Bücherschränke in der Nähe entdecken und mit einem kostenlosen OpenStreetMap-Account schnell Ihre Lieblingsbücherschränke hinzufügen.",
        fr: "Une microbibliothèques, également appelée boite à livre, est un élément de mobilier urbain (étagère, armoire, etc) dans lequel sont stockés des livres et autres objets en accès libre. Découvrez les boites à livres prêt de chez vous, ou ajouter en une nouvelle à l'aide de votre compte OpenStreetMap.",
    },
    icon: "./assets/themes/bookcases/bookcase.svg",
    socialImage: null,
    startLat: 0,
    startLon: 0,
    startZoom: 1,
    widenFactor: 0.05,
    roamingRenderings: [],
    layers: ["public_bookcase"],
}

describe("Utils", () => {
    describe("Minify-json", () => {
        it("should work in two directions", () => {
            const str = JSON.stringify({ title: "abc", and: "xyz", render: "somevalue" })
            const minified = Utils.MinifyJSON(str)
            const restored = Utils.UnMinify(minified)
            expect(str).toBe(restored)
        })
        it("should minify and restore the bookcase example", () => {
            const str = JSON.stringify(example, null, 0)
            const minified = Utils.MinifyJSON(str)
            const restored = Utils.UnMinify(minified)
            expect(str).toBe(restored)
        })
        it("should LZ-compress a theme", () => {
            const str = JSON.stringify(example, null, 0)
            const minified = LZString.compressToBase64(Utils.MinifyJSON(str))
            const restored = Utils.UnMinify(LZString.decompressFromBase64(minified))
            expect(str).toBe(restored)
        })
        it("shoud be able to decode the LZ-compression of a theme", () => {
            const str = JSON.stringify(example, null, 0)
            const minified = LZString.compressToBase64(str)
            const restored = LZString.decompressFromBase64(minified)
            expect(str).toBe(restored)
        })
    })
})
