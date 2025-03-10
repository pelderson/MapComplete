import {AllKnownLayouts} from "./Customizations/AllKnownLayouts";
import {FixedUiElement} from "./UI/Base/FixedUiElement";
import {InitUiElements} from "./InitUiElements";
import {QueryParameters} from "./Logic/Web/QueryParameters";
import {UIEventSource} from "./Logic/UIEventSource";
import * as $ from "jquery";
import LayoutConfig from "./Customizations/JSON/LayoutConfig";
import {Utils} from "./Utils";
import MoreScreen from "./UI/BigComponents/MoreScreen";
import State from "./State";
import Combine from "./UI/Base/Combine";
import Translations from "./UI/i18n/Translations";


import CountryCoder from "latlon2country"

import SimpleMetaTagger from "./Logic/SimpleMetaTagger";

// Workaround for a stupid crash: inject the function
SimpleMetaTagger.coder = new CountryCoder("https://pietervdvn.github.io/latlon2country/");


let defaultLayout = ""
// --------------------- Special actions based on the parameters -----------------
// @ts-ignore
if (location.href.startsWith("http://buurtnatuur.be")) {
    // Reload the https version. This is important for the 'locate me' button
    window.location.replace("https://buurtnatuur.be");
}


if (location.href.indexOf("buurtnatuur.be") >= 0) {
    defaultLayout = "buurtnatuur"
}

const customCssQP = QueryParameters.GetQueryParameter("custom-css", "", "If specified, the custom css from the given link will be loaded additionaly");
if (customCssQP.data !== undefined && customCssQP.data !== "") {
    Utils.LoadCustomCss(customCssQP.data);
}


let testing: UIEventSource<string>;
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    testing = QueryParameters.GetQueryParameter("test", "true");
    // Set to true if testing and changes should NOT be saved
    testing.setData(testing.data ?? "true")
    // If you have a testfile somewhere, enable this to spoof overpass
    // This should be hosted independantly, e.g. with `cd assets; webfsd -p 8080` + a CORS plugin to disable cors rules
    // Overpass.testUrl = "http://127.0.0.1:8080/streetwidths.geojson";
} else {
    testing = QueryParameters.GetQueryParameter("test", "false");
}


// ----------------- SELECT THE RIGHT QUESTSET -----------------


const path = window.location.pathname.split("/").slice(-1)[0];
if (path !== "index.html" && path !== "") {
    defaultLayout = path;
    if (path.endsWith(".html")) {
        defaultLayout = path.substr(0, path.length - 5);
    }
    console.log("Using layout", defaultLayout);
}
defaultLayout = QueryParameters.GetQueryParameter("layout", defaultLayout, "The layout to load into MapComplete").data;
let layoutToUse: LayoutConfig = AllKnownLayouts.allSets[defaultLayout.toLowerCase()];


const userLayoutParam = QueryParameters.GetQueryParameter("userlayout", "false");
const layoutFromBase64 = decodeURIComponent(userLayoutParam.data);
document.getElementById('centermessage').innerText = '';
document.getElementById("decoration-desktop").remove();


if (layoutFromBase64.startsWith("http")) {
    const link = layoutFromBase64;
    console.log("Downloading map theme from ", link);
    new FixedUiElement(`Downloading the theme from the <a href="${link}">link</a>...`)
        .AttachTo("centermessage");

    $.ajax({
        url: link,
        success: function (data) {

            try {
                const parsed = JSON.parse(data);
                // Overwrite the id to the wiki:value
                parsed.id = link;
                const layout = new LayoutConfig(parsed, false);
                InitUiElements.InitAll(layout, layoutFromBase64, testing, layoutFromBase64, btoa(data));
            } catch (e) {
                new FixedUiElement(`<a href="${link}">${link}</a> is invalid:<br/>${e}<br/> <a href='https://${window.location.host}/'>Go back</a>")`)
                    .SetClass("clickable")
                    .AttachTo("centermessage");
                console.error("Could not parse the text", data)
                throw e;
            }
        },
    }).fail((_, textstatus, error) => {
        console.error("Could not download the wiki theme:", textstatus, error)
        new FixedUiElement(`<a href="${link}">${link}</a> is invalid:<br/>Could not download - wrong URL?<br/>` +
            error +
            "<a href='https://${window.location.host}/'>Go back</a>")
            .SetClass("clickable")
            .AttachTo("centermessage");
    });

} else if (layoutFromBase64 !== "false") {
    layoutToUse = InitUiElements.LoadLayoutFromHash(userLayoutParam);
    InitUiElements.InitAll(layoutToUse, layoutFromBase64, testing, defaultLayout, location.hash.substr(1));
} else if (layoutToUse !== undefined) {
    // This is the default case: a builtin theme
    InitUiElements.InitAll(layoutToUse, layoutFromBase64, testing, defaultLayout);
} else {
    // We fall through: no theme loaded: just show a few buttons
    State.state = new State(undefined);
    new Combine([new MoreScreen(true),
        Translations.t.general.aboutMapcomplete
    ]).SetClass("block m-5 lg:w-3/4 lg:ml-40")
        .SetStyle("pointer-events: all;")
        .AttachTo("topleft-tools");
}
window.addEventListener('contextmenu', function (e) { // Not compatible with IE < 9
    e.preventDefault();
}, false);
