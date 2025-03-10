
# MapComplete

> Let a thousand flowers bloom


MapComplete attempts to be a webversion crossover of StreetComplete and MapContrib. It tries to be just as easy to use as StreetComplete, but it allows to focus on one single theme per instance (e.g. nature, bicycle infrastructure, ...)

The design goals of MapComplete are to be:

- Easy to use, both on web and on mobile
- Easy to deploy (by not having a backend)
- Easy to set up a custom theme
- Easy to fall down the rabbit hole of OSM

The basic functionality is to download some map features from Overpass and then ask certain questions. An answer is sent back to directly to OpenStreetMap.

Furthermore, it shows images present in the `image` tag or, if a `wikidata` or `wikimedia_commons`-tag is present, it follows those to get these images too.

An explicit non-goal of MapComplete is to modify geometries of ways. Although adding a point to a way or splitting a way in two parts might be added one day.


# Creating your own theme

It is possible to quickly make and distribute your own theme - [please read the documentation on how to do this](Docs/Making_Your_Own_Theme.md).

## Examples

- [Buurtnatuur.be](http://buurtnatuur.be), developed for the Belgian [Green party](https://www.groen.be/). They also funded the initial development!
- [Cyclofix](https://pietervdvn.github.io/MapComplete/index.html?layout=cyclofix), further development on [Open Summer of Code](https://summerofcode.be/) funded by [Brussels Mobility](https://mobilite-mobiliteit.brussels/en). Landing page at https://cyclofix.osm.be/
- [Bookcases](https://pietervdvn.github.io/MapComplete/index.html?quests=bookcases#element) cause I like to collect them.
- [Map of Maps](https://pietervdvn.github.io/MapComplete/index.html?layout=maps&z=14&lat=50.650&lon=4.2668#element), after a tweet

There are plenty more. Discover them in the app.

### Statistics

To see statistics, consult [OsmCha](https://osmcha.org/?filters=%7B%22comment%22%3A%5B%7B%22label%22%3A%22%23mapcomplete%22%2C%22value%22%3A%22%23mapcomplete%22%7D%5D%2C%22date__gte%22%3A%5B%7B%22label%22%3A%222020-07-05%22%2C%22value%22%3A%222020-07-05%22%7D%5D%7D) or the [analytics page](https://pietervdvn.goatcounter.com/)

## User journey

MapComplete is set up to lure people into OpenStreetMap and to teach them while they are on the go, step by step.

A typical user journey would be:

0. Oh, this is a cool map of _my specific interest_! There is a lot of data already...

    * The user might discover the explanation about OSM in the second tab
    * The user might share the map and/or embed it in the third tab
    * The user might discover the other themes in the last tab
    
1. The user clicks that big tempting button 'login' in order to answer questions - there's enough of these login buttons... The user creates an account.

2. The user answers a question! Hooray! The user transformed into a __contributor__ now.
    
    * When at least one question is answered (aka: having one changeset on OSM), adding a new point is unlocked
    
3. The user adds a new POI somewhere

    * Note that _all messages_ must be read before being able to add a point.
    * In other words, sending a message to a misbehaving MapComplete user acts as having a **zero-day-block**. This is added deliberately to make sure new users _have_ to read feedback from the community.
    
4. At 50 changesets, the [personal layout](https://pietervdvn.github.io/MapComplete/personal.html) is advertised. The personal theme is a theme where contributors can pick layers from all the offical themes. Note that the personal theme is always available.

5. At 200 changesets, the tags become visible when answering questions and when adding a new point from a preset. This is to give more control to power users and to teach new users the tagging scheme

6. At 250 changesets, the tags get linked to the wiki

7. At 500 changesets, I expect contributors to be power users and to be comfortable with tagging scheme and such. The custom theme generator is unlocked.


## License

GPLv3.0 + recommended pingback.

I love it to see where the project ends up. You are free to reuse the software (under GPL) but, when you have made your own change and are using it, I would like to know about it. Drop me a line, give a pingback in the issues,...  

## Dev

To develop:

0. Make sure you have a recent version of nodejs - at least 12.0, preferably 15
0. Make a fork and clone the repository.
1. Install `npm`. Linux: `sudo apt install npm` (or your favourite package manager), Windows: install nodeJS: https://nodejs.org/en/download/
2. Run `npm install` to install the package dependencies
3. Run `npm run generate` and `npm run generate:editor-layer-index` to generate some additional dependencies
4. Run `npm run start` to host a local testversion at http://localhost:1234/index.html
5. By default, the 'bookcases'-theme is loaded. In order to load another theme, use `layout=themename` or `userlayout=true#<layout configuration>`. Note that the custom URLs (e.g. `bookcases.html`, `aed.html`, ...) _don't_ exist on the development version. (These are automatically generated from a template on the server).

To deploy:

0. `rm -rf dist/` to remove the local build
1. `npm run build`
2. Copy the entire `dist` folder to where you host your website. Visiting `index.html` gives you the website

## Translating MapComplete

Help to translate mapcomplete.

A theme has translations into the preset.json (`assets/themes/themename/themename.json`). To add a translation:

0. Fork this repository
1. Modify `"language"` to contain the new language, e.g. `"language": "nl"` becomes `"language": ["nl", "en"]`
2. Add extra strings to the texts. If it used to be a single-language theme, one can replace the strings, e.g.: `"description": "Welcome to Open Bookcase Map"` to `"description": {"en": "Welcome to Open Bookcase Map", "nl": "Welkom bij de OpenBoekenruilkastenKaart", "fr": "Bienvenue sûr la carte des petites bibliotheques"}`. If the correct language is not found, it'll fallback to another supported language.
3. If you notice missing translations in the core of MapComplete, fork this project, open [the file containing all translations](https://github.com/pietervdvn/MapComplete/blob/master/assets/translations.json), add add a language string there
4. Send a pull request to update the languages, I'll gladly add it! It doesn't have to be a complete translation from the start ;)

## Architecture

### High-level overview

The website is purely static. This means that there is no database here, nor one is needed as all the data is kept in OpenStreetMap, Wikimedia (for images), IMGUR. Settings are saved in the preferences-space of the OSM-website, amended by some local-storage if the user is not logged-in.

When viewing, the data is loaded from overpass. The data is then converted (in the browser) to geojson, which is rendered by Leaflet. 

When a map feature is clicked, a popup shows the information, images and questions that are relevant for that object.
The answers given by the user are sent (after a few seconds) to OpenStreetMap directly - if the user is logged in. If not logged in, the user is prompted to do so. 


The UI-event-source is a class where the entire system is built upon, it acts as an observable object: another object can register for changes to update when needed.


### Searching images

Images are fetched from:

- The OSM `image`, `image:0`, `image:1`, ... tags
- The OSM `wikimedia_commons` tags
- If wikidata is present, the wikidata `P18` (image) claim and, if a commons link is present, the commons images

### Uploading images

Images are uplaoded to imgur, as their API was way easier to handle. The URL is written into the changes

The idea is that once in a while, the images are transfered to wikipedia or that we hook up wikimedia directly (but I need some help in getting their API working).

### Uploading changes

In order to avoid lots of small changesets, a changeset is opened and kept open. The changeset number is saved into the users preferences on OSM.

Whenever a change is made -even adding a single tag- the change is uploaded into this changeset. If that fails, the changeset is probably closed and we open a new changeset.

Note that changesets are closed automatically after one hour of inactivity, so we don't have to worry about closing them. 

### Query parameters

By adding extra query parameters, more options are available to influence:

**test**: If true, 'dryrun' mode is activated. The app will behave as normal, except that changes to OSM will be printed onto the console instead of actually uploaded to osm.org (default value: _false_)

**layout**: The layout to load into MapComplete (default value: _bookcases_)

**userlayout**: undefined (default value: _false_)

**layer-control-toggle**: Wether or not the layer control is shown (default value: _false_)

**tab**: The tab that is shown in the welcome-message. 0 = the explanation of the theme,1 = OSM-credits, 2 = sharescreen, 3 = more themes, 4 = about mapcomplete (user must be logged in and have >200 changesets) (default value: _0_)

**z**: The initial/current zoom level (default value: _1_)

**lat**: The initial/current latitude (default value: _0_)

**lon**: The initial/current longitude of the app (default value: _0_)

**fs-userbadge**: Disables/Enables the userbadge (and thus disables login capabilities) (default value: _true_)

**fs-search**: Disables/Enables the search bar (default value: _true_)

**fs-layers**: Disables/Enables the layer control (default value: _true_)

**fs-add-new**: Disables/Enables the 'add new feature'-popup. (A theme without presets might not have it in the first place) (default value: _true_)

**fs-welcome-message**: undefined (default value: _true_)

**fs-iframe**: Disables/Enables the iframe-popup (default value: _false_)

**fs-more-quests**: Disables/Enables the 'More Quests'-tab in the welcome message (default value: _true_)

**fs-share-screen**: Disables/Enables the 'Share-screen'-tab in the welcome message (default value: _true_)

**fs-geolocation**: Disables/Enables the geolocation button (default value: _true_)

**oauth_token**: Used to complete the login (default value: _undefined_)

**background**: The id of the background layer to start with (default value: _undefined_)

**layer-bookcases**: Wehter or not layer bookcases is shown (default value: _true_) index.ts:104:8

# Privacy

Privacy is important, we try to leak as little information as possible.
All major personal information is handled by OSM.
Geolocation is available on mobile only throught hte device's GPS location (so no geolocation is sent of to google)

TODO: erase cookies of third party websites and API's


# Attributions

Data from OpenStreetMap

Background layer selection: curated by https://github.com/osmlab/editor-layer-index

Images from Wikipedia/Wikimedia

https://commons.wikimedia.org/wiki/File:Camera_font_awesome.svg
Camera Icon, Dave Gandy, CC-BY-SA 3.0

https://commons.wikimedia.org/wiki/File:OOjs_UI_indicator_search-rtl.svg
Search Icon, MIT

https://commons.wikimedia.org/wiki/File:Trash_font_awesome.svg
Trash icon by Dave Gandy, CC-BY-SA
 	
https://commons.wikimedia.org/wiki/File:Home-icon.svg
Home icon by Timothy Miller, CC-BY-SA 3.0

https://commons.wikimedia.org/wiki/File:Map_icons_by_Scott_de_Jonge_-_bicycle-store.svg
Bicycle logo,  	Scott de Jonge

Nature Reserve icon via http://www.onlinewebfonts.com/icon/389579, CC BY 3.0 (@ Эдуард Черных)

Park icon via http://www.onlinewebfonts.com/icon/425974, CC BY 3.0 (@sterankofrank)

Forest icon via https://www.onlinewebfonts.com/icon/498112, CC BY

Statistics icon via https://www.onlinewebfonts.com/icon/197818

Chronometer (on monitoring_station.svg): ANTU chronometer
https://commons.wikimedia.org/w/index.php?title=Antu_chronometer

Fries icon:
https://www.flaticon.com/free-icon/french-fries_1144288

Shower icon (used in 'bike_cleaning.svg'):
https://commons.wikimedia.org/wiki/File:Shower_symbol.svg

Bench icons from StreetComplete: https://github.com/westnordost/StreetComplete/tree/v25.0-beta1/res/graphics/quest%20icons, GPLv3.0


Urinal icon: https://thenounproject.com/term/urinal/1307984/

24/7 icon: https://www.vecteezy.com/vector-art/1394992-24-7-service-and-support-icon-set

Translation-icon: https://commons.wikimedia.org/wiki/File:OOjs_UI_icon_language-ltr.svg

PingPong-table icon: Font Awesome Free 5.2.0 by @fontawesome - https://fontawesome.com