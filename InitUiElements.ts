import {FixedUiElement} from "./UI/Base/FixedUiElement";
import CheckBox from "./UI/Input/CheckBox";
import {Basemap} from "./UI/BigComponents/Basemap";
import State from "./State";
import LoadFromOverpass from "./Logic/Actors/UpdateFromOverpass";
import {UIEventSource} from "./Logic/UIEventSource";
import {QueryParameters} from "./Logic/Web/QueryParameters";
import StrayClickHandler from "./Logic/Actors/StrayClickHandler";
import SimpleAddUI from "./UI/BigComponents/SimpleAddUI";
import CenterMessageBox from "./UI/CenterMessageBox";
import {AllKnownLayouts} from "./Customizations/AllKnownLayouts";
import UserBadge from "./UI/BigComponents/UserBadge";
import SearchAndGo from "./UI/BigComponents/SearchAndGo";
import GeoLocationHandler from "./Logic/Actors/GeoLocationHandler";
import {LocalStorageSource} from "./Logic/Web/LocalStorageSource";
import {Utils} from "./Utils";
import Svg from "./Svg";
import Link from "./UI/Base/Link";
import * as personal from "./assets/themes/personalLayout/personalLayout.json"
import LayoutConfig from "./Customizations/JSON/LayoutConfig";
import * as L from "leaflet";
import Img from "./UI/Base/Img";
import UserDetails from "./Logic/Osm/OsmConnection";
import Attribution from "./UI/BigComponents/Attribution";
import MetaTagging from "./Logic/MetaTagging";
import AvailableBaseLayers from "./Logic/Actors/AvailableBaseLayers";
import LayerResetter from "./Logic/Actors/LayerResetter";
import FullWelcomePaneWithTabs from "./UI/BigComponents/FullWelcomePaneWithTabs";
import LayerControlPanel from "./UI/BigComponents/LayerControlPanel";
import FeatureSwitched from "./UI/Base/FeatureSwitched";
import ShowDataLayer from "./UI/ShowDataLayer";
import Hash from "./Logic/Web/Hash";
import FeaturePipeline from "./Logic/FeatureSource/FeaturePipeline";
import ScrollableFullScreen from "./UI/Base/ScrollableFullScreen";
import Translations from "./UI/i18n/Translations";
import MapControlButton from "./UI/MapControlButton";
import Combine from "./UI/Base/Combine";
import SelectedFeatureHandler from "./Logic/Actors/SelectedFeatureHandler";
import LZString from "lz-string";
import {LayoutConfigJson} from "./Customizations/JSON/LayoutConfigJson";

export class InitUiElements {


    static InitAll(layoutToUse: LayoutConfig, layoutFromBase64: string, testing: UIEventSource<string>, layoutName: string,
                   layoutDefinition: string = "") {

        if (layoutToUse === undefined) {
            console.log("Incorrect layout")
            new FixedUiElement(`Error: incorrect layout <i>${layoutName}</i><br/><a href='https://${window.location.host}/'>Go back</a>`).AttachTo("centermessage").onClick(() => {
            });
            throw "Incorrect layout"
        }

        console.log("Using layout: ", layoutToUse.id, "LayoutFromBase64 is ", layoutFromBase64);


        State.state = new State(layoutToUse);

        // This 'leaks' the global state via the window object, useful for debugging
        // @ts-ignore
        window.mapcomplete_state = State.state;

        if (layoutToUse.hideFromOverview) {
            State.state.osmConnection.GetPreference("hidden-theme-" + layoutToUse.id + "-enabled").setData("true");
        }

        if (layoutFromBase64 !== "false") {
            State.state.layoutDefinition = layoutDefinition;
            console.log("Layout definition:", Utils.EllipsesAfter(State.state.layoutDefinition, 100))
            if (testing.data !== "true") {
                State.state.osmConnection.OnLoggedIn(() => {
                    State.state.osmConnection.GetLongPreference("installed-theme-" + layoutToUse.id).setData(State.state.layoutDefinition);
                })
            } else {
                console.warn("NOT saving custom layout to OSM as we are tesing -> probably in an iFrame")
            }
        }


        function updateFavs() {
            // This is purely for the personal theme to load the layers there
            const favs = State.state.favouriteLayers.data ?? [];

            layoutToUse.layers.splice(0, layoutToUse.layers.length);
            for (const fav of favs) {
                const layer = AllKnownLayouts.allLayers[fav];
                if (!!layer) {
                    layoutToUse.layers.push(layer);
                }

                for (const layouts of State.state.installedThemes.data) {
                    for (const layer of layouts.layout.layers) {
                        if (typeof layer === "string") {
                            continue;
                        }
                        if (layer.id === fav) {
                            layoutToUse.layers.push(layer);
                        }
                    }
                }
            }
            State.state.layoutToUse.ping();
            State.state.layerUpdater?.ForceRefresh();
        }


        if (layoutToUse.customCss !== undefined) {
            Utils.LoadCustomCss(layoutToUse.customCss);
        }

        InitUiElements.InitBaseMap();

        InitUiElements.OnlyIf(State.state.featureSwitchUserbadge, () => {
            new UserBadge().AttachTo('userbadge');
        });

        InitUiElements.OnlyIf((State.state.featureSwitchSearch), () => {
            new SearchAndGo().AttachTo("searchbox");
        });


        InitUiElements.OnlyIf(State.state.featureSwitchWelcomeMessage, () => {
            InitUiElements.InitWelcomeMessage()
        });

        if ((window != window.top && !State.state.featureSwitchWelcomeMessage.data) || State.state.featureSwitchIframe.data) {
            const currentLocation = State.state.locationControl;
            const url = `${window.location.origin}${window.location.pathname}?z=${currentLocation.data.zoom ?? 0}&lat=${currentLocation.data.lat ?? 0}&lon=${currentLocation.data.lon ?? 0}`;
            new MapControlButton(
                new Link(Svg.pop_out_img, url, true)
                    .SetClass("block w-full h-full p-1.5")
            )
                .AttachTo("messagesbox");
        }

        State.state.osmConnection.userDetails.map((userDetails: UserDetails) => userDetails?.home)
            .addCallbackAndRun(home => {
                if (home === undefined) {
                    return;
                }
                const color = getComputedStyle(document.body).getPropertyValue("--subtle-detail-color")
                const icon = L.icon({
                    iconUrl: Img.AsData(Svg.home_white_bg.replace(/#ffffff/g, color)),
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });
                const marker = L.marker([home.lat, home.lon], {icon: icon})
                marker.addTo(State.state.leafletMap.data)
            });

        const geolocationButton = new FeatureSwitched(
            new MapControlButton(
                new GeoLocationHandler(
                    State.state.currentGPSLocation,
                    State.state.leafletMap
                )),
            State.state.featureSwitchGeolocation);

        const plus = new MapControlButton(
            Svg.plus_ui()
        ).onClick(() => {
            State.state.locationControl.data.zoom++;
            State.state.locationControl.ping();
        })

        const min = new MapControlButton(
            Svg.min_ui()
        ).onClick(() => {
            State.state.locationControl.data.zoom--;
            State.state.locationControl.ping();
        })

        new Combine([plus, min, geolocationButton].map(el => el.SetClass("m-1")))
            .SetClass("flex flex-col")
            .AttachTo("bottom-right");

        if (layoutToUse.id === personal.id) {
            updateFavs();
        }
        InitUiElements.setupAllLayerElements();

        if (layoutToUse.id === personal.id) {
            State.state.favouriteLayers.addCallback(updateFavs);
            State.state.installedThemes.addCallback(updateFavs);
        } else {
            State.state.locationControl.ping();
        }

        // Reset the loading message once things are loaded
        new CenterMessageBox().AttachTo("centermessage");

    }

    static LoadLayoutFromHash(userLayoutParam: UIEventSource<string>) {
        try {
            let hash = location.hash.substr(1);
            const layoutFromBase64 = userLayoutParam.data;
            // layoutFromBase64 contains the name of the theme. This is partly to do tracking with goat counter

            const dedicatedHashFromLocalStorage = LocalStorageSource.Get("user-layout-" + layoutFromBase64.replace(" ", "_"));
            if (dedicatedHashFromLocalStorage.data?.length < 10) {
                dedicatedHashFromLocalStorage.setData(undefined);
            }

            const hashFromLocalStorage = LocalStorageSource.Get("last-loaded-user-layout");
            if (hash.length < 10) {
                hash = dedicatedHashFromLocalStorage.data ?? hashFromLocalStorage.data;
            } else {
                console.log("Saving hash to local storage")
                hashFromLocalStorage.setData(hash);
                dedicatedHashFromLocalStorage.setData(hash);
            }
            
            let json = {}
            try{
               json = JSON.parse(atob(hash));
            } catch (e) {
                // We try to decode with lz-string
                json = JSON.parse( Utils.UnMinify(LZString.decompressFromBase64(hash)))
            }
           
            // @ts-ignore
            const layoutToUse = new LayoutConfig(json, false);
            userLayoutParam.setData(layoutToUse.id);
            return layoutToUse;
        } catch (e) {

            new FixedUiElement("Error: could not parse the custom layout:<br/> " + e).AttachTo("centermessage");
            throw e;
        }
    }

    private static OnlyIf(featureSwitch: UIEventSource<boolean>, callback: () => void) {
        featureSwitch.addCallbackAndRun(() => {

            if (featureSwitch.data) {
                callback();
            }
        });
    }

    private static InitWelcomeMessage() {

        const isOpened = new UIEventSource<boolean>(false);
        const fullOptions = new FullWelcomePaneWithTabs(isOpened);

        // ?-Button on Desktop, opens panel with close-X.
        const help = new MapControlButton(Svg.help_svg());
        //   .SetClass("open-welcome-button block");
        new CheckBox(
            fullOptions
                .SetClass("welcomeMessage")
                .onClick(() => {/*Catch the click*/
                }),
            help
            , isOpened
        ).AttachTo("messagesbox");
        const openedTime = new Date().getTime();
        State.state.locationControl.addCallback(() => {
            if (new Date().getTime() - openedTime < 15 * 1000) {
                // Don't autoclose the first 15 secs when the map is moving
                return;
            }
            isOpened.setData(false);
        })

        State.state.selectedElement.addCallbackAndRun(selected => {
            if (selected !== undefined) {
                isOpened.setData(false);
            }
        })
        isOpened.setData(Hash.hash.data === undefined || Hash.hash.data === "" || Hash.hash.data == "welcome")
    }

    private static InitLayerSelection() {
        InitUiElements.OnlyIf(State.state.featureSwitchLayers, () => {

            const layerControlPanel = new LayerControlPanel(
                State.state.layerControlIsOpened)
                .SetClass("block p-1 rounded-full");
            const checkbox = new CheckBox(
                layerControlPanel,
                new MapControlButton(Svg.layers_svg()),
                State.state.layerControlIsOpened
            )
            const copyrightNotice =
                new ScrollableFullScreen(
                    () => Translations.t.general.attribution.attributionTitle.Clone(),
                    () => new Combine([
                        Translations.t.general.attribution.attributionContent,
                        "<br/>",
                        new Attribution(undefined, undefined, State.state.layoutToUse, undefined)
                    ]),
                    "copyright"
                )

            ;
            const copyrightButton = new CheckBox(
                copyrightNotice,
                new MapControlButton(Svg.osm_copyright_svg()),
                copyrightNotice.isShown
            ).SetClass("p-0.5 md:hidden")

            new Combine([copyrightButton, checkbox])
                .AttachTo("bottom-left");


            State.state.locationControl
                .addCallback(() => {
                    // Close the layer selection when the map is moved
                    checkbox.isEnabled.setData(false);
                    copyrightButton.isEnabled.setData(false);
                });

            State.state.selectedElement.addCallbackAndRun(feature => {
                if (feature !== undefined) {
                    checkbox.isEnabled.setData(false);
                }
            })

        });
    }

    private static InitBaseMap() {

        State.state.availableBackgroundLayers = new AvailableBaseLayers(State.state.locationControl).availableEditorLayers;
        State.state.backgroundLayer = QueryParameters.GetQueryParameter("background",
            State.state.layoutToUse.data.defaultBackgroundId ?? AvailableBaseLayers.osmCarto.id,
            "The id of the background layer to start with")
            .map((selectedId: string) => {
                const available = State.state.availableBackgroundLayers.data;
                for (const layer of available) {
                    if (layer.id === selectedId) {
                        return layer;
                    }
                }
                return AvailableBaseLayers.osmCarto;
            }, [], layer => layer.id);


        new LayerResetter(
            State.state.backgroundLayer, State.state.locationControl,
            State.state.availableBackgroundLayers, State.state.layoutToUse.map((layout: LayoutConfig) => layout.defaultBackgroundId));


        const attr = new Attribution(State.state.locationControl, State.state.osmConnection.userDetails, State.state.layoutToUse,
            State.state.leafletMap);

        const bm = new Basemap("leafletDiv",
            State.state.locationControl,
            State.state.backgroundLayer,
            State.state.LastClickLocation,
            attr
        );
        State.state.leafletMap.setData(bm.map);
        const layout = State.state.layoutToUse.data
        if (layout.lockLocation) {
            const tile = Utils.embedded_tile(layout.startLat, layout.startLon, layout.startZoom - 1)
            const bounds = Utils.tile_bounds(tile.z, tile.x, tile.y)
            // We use the bounds to get a sense of distance for this zoom level
            const latDiff = bounds[0][0] - bounds[1][0]
            const lonDiff = bounds[0][1] - bounds[1][1]
            console.warn("Locking the bounds to ", bounds)
            bm.map.setMaxBounds(
                [[layout.startLat - latDiff, layout.startLon - lonDiff],
                    [layout.startLat + latDiff, layout.startLon + lonDiff],
                ]
            );
            bm.map.setMinZoom(layout.startZoom)
        }

    }

    private static InitLayers() {


        const state = State.state;
        state.filteredLayers =
            state.layoutToUse.map(layoutToUse => {
                const flayers = [];

                for (const layer of layoutToUse.layers) {

                    const isDisplayed = QueryParameters.GetQueryParameter("layer-" + layer.id, "true", "Wether or not layer " + layer.id + " is shown")
                        .map<boolean>((str) => str !== "false", [], (b) => b.toString());
                    const flayer = {
                        isDisplayed: isDisplayed,
                        layerDef: layer
                    }
                    flayers.push(flayer);
                }
                return flayers;
            });

        const updater = new LoadFromOverpass(state.locationControl, state.layoutToUse, state.leafletMap);
        State.state.layerUpdater = updater;
        const source = new FeaturePipeline(state.filteredLayers, updater, state.layoutToUse, state.changes, state.locationControl);

        new ShowDataLayer(source.features, State.state.leafletMap, State.state.layoutToUse);

        new SelectedFeatureHandler(Hash.hash, State.state.selectedElement, source);


    }

    private static setupAllLayerElements() {

        // ------------- Setup the layers -------------------------------

        InitUiElements.InitLayers();
        InitUiElements.InitLayerSelection();


        // ------------------ Setup various other UI elements ------------


        InitUiElements.OnlyIf(State.state.featureSwitchAddNew, () => {

            let presetCount = 0;
            for (const layer of State.state.filteredLayers.data) {
                for (const preset of layer.layerDef.presets) {
                    presetCount++;
                }
            }
            if (presetCount == 0) {
                return;
            }


            const newPointDialogIsShown = new UIEventSource<boolean>(false);
            const addNewPoint = new ScrollableFullScreen(
                () => Translations.t.general.add.title.Clone(),
                () => new SimpleAddUI(newPointDialogIsShown),
                "new",
                newPointDialogIsShown)
            addNewPoint.isShown.addCallback(isShown => {
                if (!isShown) {
                    State.state.LastClickLocation.setData(undefined)
                }
            })

            new StrayClickHandler(
                State.state.LastClickLocation,
                State.state.selectedElement,
                State.state.filteredLayers,
                State.state.leafletMap,
                addNewPoint
            );
        });

        
    }
}