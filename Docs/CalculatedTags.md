Metatags
--------

Metatags are extra tags available, in order to display more data or to give better questions.The are calculated automatically on every feature when the data arrives in the webbrowser. This document gives an overview of the available metatags

### \_lat, \_lon

The latitude and longitude of the point (or centerpoint in the case of a way/area)

### \_surface, \_surface:ha

The surface area of the feature, in square meters and in hectare. Not set on points and ways

### \_country

The country code of the property (with latlon2country)

### \_isOpen, \_isOpen:description

If 'opening\_hours' is present, it will add the current state of the feature (being 'yes' or 'no')

### \_width:needed, \_width:needed:no\_pedestrians, \_width:difference

Legacy for a specific project calculating the needed width for safe traffic on a road. Only activated if 'width:carriageway' is present

### \_direction:simplified, \_direction:leftright

\_direction:simplified turns 'camera:direction' and 'direction' into either 0, 45, 90, 135, 180, 225, 270 or 315, whichever is closest. \_direction:leftright is either 'left' or 'right', which is left-looking on the map or 'right-looking' on the map

### \_now:date, \_now:datetime, \_loaded:date, \_loaded:\_datetime

Adds the time that the data got loaded - pretty much the time of downloading from overpass. The format is YYYY-MM-DD hh:mm, aka 'sortable' aka ISO-8601-but-not-entirely

Calculating tags with Javascript
--------------------------------

In some cases, it is useful to have some tags calculated based on other properties. Some useful tags are available by default (e.g. **lat**, **lon**, **\_country**), as detailed above.

It is also possible to calculate your own tags - but this requires some javascript knowledge.

Before proceeding, some warnings:

*   DO NOT DO THIS AS BEGINNER
*   **Only do this if all other techniques fail**. This should _not_ be done to create a rendering effect, only to calculate a specific value
*   **THIS MIGHT BE DISABLED WITHOUT ANY NOTICE ON UNOFFICIAL THEMES**. As unofficial themes might be loaded from the internet, this is the equivalent of injecting arbitrary code into the client. It'll be disabled if abuse occurs.

In the layer object, add a field **calculatedTags**, e.g.:

"calculatedTags": \[ "\_someKey=javascript-expression", "name=feat.properties.name ?? feat.properties.ref ?? feat.properties.operator", "\_distanceCloserThen3Km=feat.distanceTo( some\_lon, some\_lat) < 3 ? 'yes' : 'no'" \]

The above code will be executed for every feature in the layer. The feature is accessible as **feat** and is an amended geojson object: - **area** contains the surface area (in square meters) of the object - **lat** and **lon** contain the latitude and longitude Some advanced functions are available on **feat** as well:

*   distanceTo
*   overlapWith
*   closest

### distanceTo

Calculates the distance between the feature and a specified point

*   longitude
*   latitude

### overlapWith

Gives a list of features from the specified layer which this feature overlaps with, the amount of overlap in m². The returned value is **{ feat: GeoJSONFeature, overlap: number}**

*   ...layerIds - one or more layer ids of the layer from which every feature is checked for overlap)

### closest

Given either a list of geojson features or a single layer name, gives the single object which is nearest to the feature. In the case of ways/polygons, only the centerpoint is considered.

*   list of features