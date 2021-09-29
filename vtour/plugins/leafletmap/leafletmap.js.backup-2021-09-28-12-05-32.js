var krpanoplugin = function () {
    window.krpanoPluginsStuff.leafletmap = {};


    var leafletmapPlugin = {};

    leafletmapPlugin.DataProvider = {

        getTimelineValue: undefined, // here will be a get function of {batch: streetview.timeline} or empty object {}

        // relative url where all files are located
        // (for krpano embeding - index.html in another folder)
        firstXML: (function () {
            var scripts = document.getElementsByTagName("script"),
                scrExp = /embedpano.js/,
                source;

            for (var script, i = 0, len = scripts.length; i < len; i++) {
                script = scripts[i];
                //
                //
                if (scrExp.exec(script.src) != null) {
                    source = script.src;
                    break;
                }
            }

            //
            var pathExp = /^(.+\/)[^\/]+\.js/,
                parsed = pathExp.exec(source),
                path;

            if (window.DEBUG) {
                path = '';
            } else {
                path = parsed != null ? parsed[1] : '';
            }

            window.krpanoPluginsStuff.leafletmap.firstXML = path;

            return path;
        })(),

        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // !!! urls are relative to embedpano.js path !!!
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        _actions: {
            mapspots: {
                sectionName: 'mapspots',
                actionNames: {
                    getSpots: 'spots',
                    getBounds: 'bounds'
                },
                url: 'mapspots.php'
            },
            mapspotsJSON: {
                sectionName: 'mapspotsJSON',
                actionNames: {
                    getSpots: 'spots'
                },
                url: 'mapspots.json'
            },
            xml: {
                sectionName: 'xml',
                actionNames: {
                    getXML: 'xml'
                },
                url: 'plugins/leafletmap/xml/leafletmap.xml_'
            },
            leaflet: {
                sectionName: 'leaflet',
                actionNames: {
                    getLeafletJS: 'leaflet-custom.js',
                    getLeafletCSS: 'leaflet.css',
                    getLeafletPluginJS: 'L.Control.Layers.Tree.js',
                    getLeafletPluginCSS: 'L.Control.Layers.Tree.css',
                },
                url: 'plugins/leafletmap/leafletjs/'
            }
        },

        _encodeQueryData: function (data) {
            var ret = [],
                newName;
            for (var name in data)
                if (data.hasOwnProperty(name)) {
                    newName = name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
                    ret.push(encodeURIComponent(newName) + "=" + encodeURIComponent(data[name]));
                }
            return ret.join("&");
        },

        _getData: function (callback, sectionName, actionName, params) {
            // getMapSpots
            var acts = this._actions[sectionName],
                section = acts.sectionName,
                action = acts.actionNames[actionName],
                url = /* this.firstXML 'https://players.applied-streetview.com/Timeline/'*/'http://localhost:3000/' + acts.url;

            var done = function (data) {
                if (callback && data && !data.error) {
                    callback(data);
                }
            };


            var _params = {
                section: section,
                action: action
            };

            window.L.Util.extend(_params, params);

            url += _params.noParams ? '' : '?' + this._encodeQueryData(_params);


            // if we have a function that handles requests to php files
            if (typeof krpanoXhrCallback == 'function') {
                krpanoXhrCallback(url, done);
                return;
            }


            var xmlhttp = new XMLHttpRequest();

            xmlhttp.open("GET", url, true);

            xmlhttp.onreadystatechange = function () {
                if (!(xmlhttp.readyState == 4 && (xmlhttp.status == 200 || xmlhttp.responseText))) {
                    return;
                }

                var data =
                    xmlhttp.responseText &&
                    (xmlhttp.getResponseHeader('Content-Type').indexOf('xml') > -1
                        ? xmlhttp.responseText
                        : JSON.parse(xmlhttp.responseText)
                    );

                done(data);
            };

            xmlhttp.setRequestHeader('Content-Type', 'application/json');
            xmlhttp.send(null);
        },

        getMapspotsByBounds: function (callback, params) {
            window.L.extend(params, this.getTimelineValue());
            this._getData(callback, 'mapspots', 'getSpots', params);
        },

        getDataBounds: function (callback, params) {
            window.L.extend(params, this.getTimelineValue());
            this._getData(callback, 'mapspots', 'getBounds', params);
        },

        getMapspotsJSON: function (callback) {
            this._getData(callback, 'mapspotsJSON', 'getSpots', { noParams: true });
        },

        getXML: function (callback) {
            this._getData(callback, 'xml', 'getXML', { noParams: true });
        },

        getLeafletStuff: function (callback) {

            //load leaflet.js

            var script = document.createElement('script'),
                action = this._actions.leaflet,
                src = this.firstXML + action.url + action.actionNames.getLeafletJS,
                appendTo = document.head;

            if (script.readyState && !script.onload) {
                // IE, Opera
                script.onreadystatechange = function () {
                    if (script.readyState == "loaded" || script.readyState == "complete") {
                        script.onreadystatechange = null;
                        callback();
                    }
                }
            }
            else {
                // Rest
                script.onload = callback;
            }

            script.src = src;
            appendTo.appendChild(script);


            //load leaflet.css

            var link = document.createElement("link"),
                cssURL = this.firstXML + action.url + action.actionNames.getLeafletCSS;
            link.setAttribute("rel", "stylesheet");
            link.setAttribute("type", "text/css");
            link.setAttribute("href", cssURL);
            document.head.appendChild(link);
        }
    };

    window.krpanoPluginsStuff.leafletmap.leafletjsLoadPromise = leafletmapPlugin.promise = new Promise(function (resolve, reject) {
        leafletmapPlugin.DataProvider.getLeafletStuff(resolve);
    });




    leafletmapPlugin.initMap = function (container, krpano, plugin) {

        var
            // load mapspots from disk or server
            isLocalVersion = plugin.environment == "files",

            // array to stores all markers on the map,
            // where "index" for any marker is spot ID
            markers = /*window.markers = */{},

            // holds current mapspot marker
            curMarker = undefined,

            // layer is used to operate all markers at once
            // i.e. show/hide on/from map, change icons, etc
            featureGroup = window.L.featureGroup(),

            getCurSpotLatLng = function () {
                if (krpano.mapspot) {
                    return [+krpano.mapspot.lat, +krpano.mapspot.lng];
                } else {
                    return [0, 0];
                }
            },

            getCurSpotID = function () {
                return krpano.mapspot.id;
            },

            // icons path
            iconUrl = krpano.parsePath("%BASEDIR%") + 'plugins/leafletmap/images/',

            // icon size.
            //
            // set it in plugin options:
            //  - plugin.mapoptions.iconcommonsize - icon for all markers
            //  - plugin.mapoptions.iconcurrentsize - icon for current spot's marker
            //  - plugin.mapoptions.iconhighlightedsize - icon for mouseovered marker
            //
            // !!! don't set value of iconcurrentsize or iconhighlightedsize if it is the same as iconcommonsize
            //
            iconCommonSize = JSON.parse(plugin.mapoptions.iconcommonsize),
            iconCurrentSize = (plugin.mapoptions.iconcurrentsize && JSON.parse(plugin.mapoptions.iconcurrentsize)) || iconCommonSize,
            iconHighlightedSize = (plugin.mapoptions.iconhighlightedsize && JSON.parse(plugin.mapoptions.iconhighlightedsize)) || iconCommonSize,

            mapProviderUrl = plugin.mapoptions.mapproviderurl,
            mapProviderKey = plugin.mapoptions.mapproviderkey,
            mapProviderStyleId = plugin.mapoptions.mapproviderstyleid,
            attributionLine = plugin.mapoptions.attributionline,

            // common icon for markers
            iconCommon = window.L.icon({
                iconUrl: iconUrl + 'leaflet-marker-common.png',
                iconSize: iconCommonSize
            }),

            // icon for current spot marker
            iconCurrent = window.L.icon({
                iconUrl: iconUrl + 'leaflet-marker-current.png',
                iconSize: iconCurrentSize
            }),

            // icon for marker that is mouseovered
            iconHighlighted = window.L.icon({
                iconUrl: iconUrl + 'leaflet-marker-highlighted.png',
                iconSize: iconHighlightedSize
            }),

            // requests mapspots for current map's bounds or by spotID
            // options:
            //   - spotID - requests specific spot
            //   - callback - function to call after adding returned spots to map
            requestMapSpots = function (options) {
                map.whenReady(function () {
                    var callback = options && options.callback && typeof options.callback == "function" ? options.callback : function () { },
                        bounds = map.getBounds(),
                        sw = bounds.getSouthWest(),
                        ne = bounds.getNorthEast(),
                        params = options && options.noParams ? undefined : {
                            curSpotID: getCurSpotID(),
                            zoom: map.getZoom(),
                            lat1: sw.lat,
                            lat2: ne.lat,
                            lng1: sw.lng,
                            lng2: ne.lng
                        };

                    // add additional params from other plugins for spots request
                    // for each plugin (or group) there is a property with params -
                    //  {plugin1: {par1: value1, ...}, plugins2: {...}, ...}
                    // if pluginN.keep == true then params will be kept, erased otherwise
                    var additionalParams = krpano.get('lm.request_spots_params');
                    if (additionalParams) {
                        var name, param;
                        for (name in additionalParams) {
                            if (additionalParams.hasOwnProperty(name)) {
                                window.L.Util.extend(params, additionalParams[name]);
                            }
                            if (!additionalParams[name].keep) {
                                delete krpano.lm.request_spots_params[name];
                            }
                        }
                    }

                    // add plugin list to params
                    var pluginList = ['railway', 'asset'],
                        parPlList = '';
                    for (var pluginName, i = 0; pluginName = pluginList[i]; i++) {
                        if (krpano.plugin.getItem(pluginName)) {
                            parPlList += (parPlList.length ? '_' : '') + pluginName;
                        }
                    }
                    if (parPlList) {
                        params.pl = parPlList;
                    }

                    var bigCallback = function (data) {
                        parseMapSpots(data);
                        callback(data);
                    };

                    if (!isLocalVersion) {
                        leafletmapPlugin.DataProvider.getMapspotsByBounds(bigCallback, params);
                    } else {
                        leafletmapPlugin.DataProvider.getMapspotsJSON(bigCallback);
                    }
                });
            },

            // parses (cache and add to map) returned mapspots
            parseMapSpots = function (spots) {
                for (var marker, spot, i = 0, len = spots.length; spot = spots[i]; i++) {
                    // dont create already existing spot
                    if (marker = markers[spot.id]) {
                        continue;
                    }

                    // create marker and add it to featureGroup
                    marker = window.L.marker([spot.latitude, spot.longitude], {
                        icon: iconCommon
                    }).addTo(featureGroup);

                    // add spot data
                    marker.heading = spot.heading;
                    marker.spotID = spot.id;
                    marker.pano = spot.pano;
                    marker.division = spot.division;
                    marker.subregion = spot.subregion;
                    marker.subdivision = spot.subdivision;
                    marker.rec_time = spot.rec_time;

                    // add marker to storage-object
                    markers[spot.id] = marker;
                }

                skipMarkers();
            },

            // shows markers that dont overlay each other
            // and hides others
            // also show only markers that belong to certain regions from railway plugin
            skipMarkers = function () {

                var minDistance = iconCommonSize[0],
                    dist, marker, curPoint,
                    prevPoint = window.L.point([0, 0]),
                    skipDistanceComparison,
                    curSpotID;

                var railwayFields = krpano.get('lm.request_spots_params.railway'),
                    streetviewPlugin = krpano.plugin.getItem('streetview'),
                    timelineValue = leafletmapPlugin.DataProvider.getTimelineValue().rec_time;


                for (const i in markers) {

                    if (!(marker = markers[i])) { continue; }

                    if (marker && marker.options.icon == iconHighlighted) {
                        marker.setIcon(iconCommon);
                    }

                    //if (!(marker && (isLocalVersion || map.getBounds().contains(marker.getLatLng())))) {
                    if (!marker || isLocalVersion) {
                        continue;
                    }

                    curSpotID = getCurSpotID();

                    // check that mapspot is a member
                    // of current b_atch if streetview.show_timeline==true
                    if (typeof timelineValue != 'undefined' && marker.spotID != curSpotID) {
                        if (marker.rec_time != timelineValue) {
                            /* featureGroup.removeLayer(marker);
                            continue; */
                        }
                    }


                    //TODO: fix
                    // check that mapspot belongs to regions from railway if this plugin exists
                    /* if (railwayFields && marker.spotID != curSpotID) {
                        skipDistanceComparison = false;
                        for (var fieldName in railwayFields) {
                            if (fieldName != 'keep' && railwayFields[fieldName] != marker[fieldName]) {
                                featureGroup.removeLayer(marker);
                                skipDistanceComparison = true;
                                break;
                            }
                        }
                        if (skipDistanceComparison) {
                            continue;
                        }
                    } */

                    curPoint = map.project(marker.getLatLng());
                    dist = prevPoint.distanceTo(curPoint);
                    if (dist > minDistance || marker.spotID == curSpotID) {
                        featureGroup.addLayer(marker);
                        if (dist > minDistance || marker.spotID != curSpotID) {
                            prevPoint = curPoint;
                        }
                    } else {
                        featureGroup.removeLayer(marker);
                    }
                }
            },

            // call this func when spot is changed.
            // it will center map on appropriate marker and change it icon
            newPano = function () {
                if (panMapOnNewPano) {
                    !isLocalVersion && map.delayedCenterChangeOff().once('moveend', function () {
                        setTimeout(function () {
                            map.delayedCenterChangeOn();

                            //TODO: найти место где включать delayedCenter на стартапе
                        }, 100);
                    });
                    map.panTo(getCurSpotLatLng());
                } else {
                    panMapOnNewPano = true;
                    map.delayedCenterChangeOn();
                }

                if (curMarker) {
                    curMarker
                        .setIcon(iconCommon)
                        .setZIndexOffset(0);
                }

                // if we load mapspots from server then request new portion of spots
                // else just set new current marker (all mapspots are already loaded)
                if (!isLocalVersion) {
                    requestMapSpots({
                        callback: selectCurMarker
                    });
                } else {
                    //TODO: refactor (maybe include in one func)
                    selectCurMarker();
                    skipMarkers();
                }
            },

            // sets icon for current marker and updates radar position
            selectCurMarker = function () {
                curMarker = /*window.curMarker =*/ markers[getCurSpotID()];

                if (curMarker) {
                    curMarker
                        .setIcon(iconCurrent)
                        .setZIndexOffset(1000);
                }

                if (radar) {
                    radar.setLatLng(getCurSpotLatLng());
                }

                return !!curMarker;
            };


        /*krpano.get('events').createItem('leafletmap_js_2', {
            onnewpano: function () {
                getCurSpotID() = krpano.mapspot.id;
            }
        });*/


        // add getTimelineValue function to DataProvider:
        // - if streetview.show_timeline="true" then return object with b_atch field to be added
        //   to params of requests
        var streetviewPluginSettings = krpano.plugin.getItem('streetview');
        leafletmapPlugin.DataProvider.getTimelineValue = function () {
            if (streetviewPluginSettings.show_timeline == 'true') {
                var timelineValue = +(streetviewPluginSettings.timeline || 0);
                return { rec_time: timelineValue };
            } else {
                return {};
            }
        };

        var baseTree = [
            {
                label: 'OpenStreeMap',
                children: [
                    {
                        label: 'OSM', layer: window.L.tileLayer(
                            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                            { attribution: null }
                        ), name: 'OpenStreeMap'
                    },
                    {
                        label: 'B&W', layer: window.L.tileLayer(
                            'http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png',
                            { attribution: null }
                        ), name: 'OpenStreeMap <b>B&W</b>'
                    },
                    {
                        label: 'OpenTopoMap', layer: window.L.tileLayer(
                            'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
                            { attribution: null }
                        ), name: 'Topographic - OSM'
                    },
                ]
            },
            {
                label: 'Thunder',
                children: [
                    {
                        label: 'Satellite', layer: window.L.tileLayer(
                            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                            { attribution: null }
                        ), name: "Satellite"
                    },
                    {
                        label: 'Dark', layer: window.L.tileLayer(
                            'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
                            { attribution: null }
                        ), name: "Dark"
                    },
                    {
                        label: 'Light', layer: window.L.tileLayer(
                            'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
                            { attribution: null }
                        ), name: "Light"
                    },
                ]
            },
        ];

        // init map
        var map = /*window.map = */ (isLocalVersion ? window.L.map : window.L.myMap)(container, {
            //center: getCurSpotLatLng(),
            zoom: +plugin.mapoptions.zoom,
            zoomControl: true,
            maxZoom: +plugin.mapoptions.maxzoom,
            keyboard: false, layers: [baseTree[0].children[0].layer],
            isLocalVersion: isLocalVersion
        }).on('zoomend', skipMarkers);


        // set map center depending on startcenter map option
        var startCenterValues = ['startpano', 'data', 'latlng'],
            startCenter = plugin.mapoptions.startcenter || startCenterValues[0],
            startCenterLatLng = startCenter.split(','),
            panMapOnNewPano = true;

        try {
            startCenterLatLng = window.L.latLng(startCenterLatLng[0], startCenterLatLng[1]);
            startCenter = startCenterLatLng || startCenter;
        } catch (e) {

        }

        var panoFromURLExists = !!krpano.get('sv.startup_pano_from_url');
        if (panoFromURLExists || startCenter == startCenterValues[0]) {
            //do nothing here. Map will be moved in onnewpano
            //map.setView(getCurSpotLatLng(), map.getZoom());
        }
        else if (startCenter == startCenterValues[1]) {
            panMapOnNewPano = false;
            var boundsFunc;
            leafletmapPlugin.DataProvider.getDataBounds(
                function (bounds) { // as array
                    // remember bounds to use them when map height is not zero. When
                    // map shows after it was invisible on startup
                    boundsFunc = function () {
                        var options = {
                            paddingTopLeft: [20, 40],
                            paddingBottomRight: [20, 20]
                        };
                        map.fitBounds(bounds, options);
                    };

                    boundsFunc();
                }
            );
        }
        else if (startCenter instanceof window.L.LatLng) {
            panMapOnNewPano = false;
            map.setView(startCenter, map.getZoom());
        }
        else {
            krpano.trace(3, "value of map option 'startcenter' is set uncorrectly. Possible values: \"startpano\", \"data\", \"lat_value, lng_value\"");
            krpano.call("showlog();");
        }



        // init tiles controller and add it to the map
        mapProviderUrl += mapProviderUrl.indexOf('{z}') > -1 ? '' : '{z}/{x}/{y}.png';
        /* window.L.tileLayer(mapProviderUrl, {
            attribution: attributionLine,
            maxNativeZoom: 18,
            maxZoom: +plugin.mapoptions.maxzoom
        }).addTo(map); */


        var action_Plugin = leafletmapPlugin.DataProvider._actions.leaflet;
        let itv = setInterval(() => {
            krpano.trace(2, "Error LayerSwitcher")
            if (!window.L.control.layers.tree) {
                var script_plugin = document.createElement('script'),
                    src_Plugin = leafletmapPlugin.DataProvider.firstXML + action_Plugin.url + action_Plugin.actionNames.getLeafletPluginJS,
                    appendToPlugin = document.head;
                if (script_plugin.readyState && !script_plugin.onload) {
                    script_plugin.onreadystatechange = function () {
                        if (script_plugin.readyState == "loaded" || script_plugin.readyState == "complete") {
                            script_plugin.onreadystatechange = null;
                        }
                    }
                }
                else {
                    script_plugin.onload = (evt) => { };
                }
                script_plugin.src = src_Plugin;
                appendToPlugin.appendChild(script_plugin);


                //load leaflet.css
                var link_Plugin = document.createElement("link"),
                    cssURL_Plugin = leafletmapPlugin.DataProvider.firstXML + action_Plugin.url + action_Plugin.actionNames.getLeafletPluginCSS;
                link_Plugin.setAttribute("rel", "stylesheet");
                link_Plugin.setAttribute("type", "text/css");
                link_Plugin.setAttribute("href", cssURL_Plugin);
                document.head.appendChild(link_Plugin);
            } else {
                window.L.control.layers.tree(baseTree).addTo(map);
                clearInterval(itv);
            }
        }, 1000);


        // add close button on the map
        new window.L.Control.CloseControl({ plugin: plugin })
            .addTo(map);

        // add radar to map
        if (plugin.radar && plugin.radar.visible !== 'false') {
            var opts = window.L.Radar.prototype.options,
                radar = new window.L.KrpanoRadar(undefined, 0, 0, 0, {
                    color: plugin.radar.strokecolor || opts.color,
                    fillColor: plugin.radar.fillcolor || opts.fillColor,
                    krpano: krpano,
                    plugin: plugin
                })
                    .addTo(map);
        }

        // for every marker in featureGroup bind some interaction:
        // - change pano when marker is clicked
        // - highlight marker on mouseover
        //
        // and add all markers to the map
        featureGroup
            .on("click", function (e) {
                krpano.call("streetview_gotopano(" + e.layer.pano + ");");
            })
            .addTo(map);

        if (!krpano.istouchdevice) {
            featureGroup
                .on("mouseover", function (e) {
                    if (e.layer.spotID != getCurSpotID()) {
                        e.layer.setIcon(iconHighlighted);
                        e.layer._bringToFront();
                    }
                })
                .on("mouseout", function (e) {
                    if (e.layer.spotID != getCurSpotID()) {
                        e.layer.setIcon(iconCommon);
                        e.layer._resetZIndex();
                    }
                });
        }


        // update map when cur pano is changed
        krpano.get('events').createItem('leafletmap_js', {
            keep: true,
            onnewpano: function () {
                if (krpano.plugin.getItem('railway')) {
                    if (krpano.get('rw.need_to_request_spots')) {
                        krpano.set('rw.need_to_request_spots', 0);
                        newPano();
                    }

                    if (!window.krpanoPluginsStuff.leafletmap.leafletmapNewPano) {
                        window.krpanoPluginsStuff.leafletmap.leafletmapNewPano = newPano;
                    }
                } else {
                    newPano();
                }
            }
        });

        // in case newpano is fired before plugin initialization
        if (krpano.get('streetview_newpano_fired') && !krpano.plugin.getItem('railway')) {
            newPano();
        }


        // request mapspots on every map movement (for server version)
        // or only once (from disk) for locale version
        if (!isLocalVersion) {
            map.on('delayedCenterChanged', requestMapSpots);
        } else {
            setTimeout(function () {
                requestMapSpots({
                    noParams: true,
                    callback: selectCurMarker
                });
            }, 0);
        }


        // API for other plugins:
        //  - addMarker - function for adding marker to the map (for uses by other plugins),
        //  - setAssetView - set map view so that distance between asset and pano point is
        //      the nearest to distance param (percentage of map container height) and both
        //      points are visible on the map
        var addMarker = function (latlng, icon) {
            if (latlng instanceof window.L.LatLng && icon instanceof window.L.Icon) {
                window.L.marker(latlng, { icon: icon }).addTo(map);
            }
        },
            setAssetView = function (assetLatLng, distance) {
                if (!(assetLatLng instanceof window.L.LatLng && typeof distance == 'number')) {
                    return;
                }

                var WL = window.L,
                    panoLatLng = WL.latLng(+krpano.mapspot.lat, +krpano.mapspot.lng),
                    containerSize = map.getSize(),
                    targetDistance = map.getSize().y * distance / 100,
                    projectedDistance,
                    panoProjected, assetProjected,
                    delta = Number.MAX_VALUE, prevDelta = Number.MAX_VALUE,
                    isSmaller = true;

                // find zoom level
                for (var zoom = map.getMinZoom(), maxZoom = map.getMaxZoom(); zoom <= maxZoom; zoom++) {
                    panoProjected = map.project(panoLatLng, zoom);
                    assetProjected = map.project(assetLatLng, zoom);

                    projectedDistance = panoProjected.distanceTo(assetProjected);
                    delta = Math.abs(projectedDistance - targetDistance);

                    // check that both points will be visible on the map
                    isSmaller = containerSize.contains(panoProjected.subtract(assetProjected));

                    if (delta <= prevDelta && isSmaller) {
                        prevDelta = delta;
                    } else {
                        zoom--;
                        break;
                    }
                }

                // find map center (center of line between to latLng)
                var center;

                panoProjected = map.project(panoLatLng, zoom);
                assetProjected = map.project(assetLatLng, zoom);

                center = panoProjected.subtract(assetProjected).divideBy(2);
                center = panoProjected.subtract(center);
                center = map.unproject(center, zoom);

                // set map view
                map.setView(center, zoom);
            }
        /*,addSetView = function (latlng, percentage) {
            var icon = window.L.icon({
                iconUrl: 'leafletmap/images/leaflet-marker-highlighted.png',
                iconSize: [12,12]
            }),
                latlng = latlng ? window.L.latLng(latlng) : window.L.latLng(46.62955576, 10.92905327);

            addMarker([latlng.lat, latlng.lng], icon);

            setAssetView(latlng, percentage || 50);
        }*/;

        window.L.Util.extend(window.krpanoPluginsStuff.leafletmap, {
            addMarker: addMarker,
            setAssetView: setAssetView,
            requestMapSpots: requestMapSpots
            //,addSetView: addSetView
        });

        // we need this to run when plugin become visible first time
        var firstTimeVisible = !plugin.visible;

        // return and store this function in registerplugin
        // to call it from leafletmap.xml in leafletmap_show_hide_container
        return function () {
            setTimeout(function () {
                if (firstTimeVisible) {
                    // invalidate map size after it's height become more than 0
                    // after plugin become visible
                    !isLocalVersion && map.delayedCenterChangeOff();
                    map.invalidateSize();
                    typeof boundsFunc == "function" && boundsFunc();
                    !isLocalVersion && map.delayedCenterChangeOn();

                    // load mapspots after that
                    if (!isLocalVersion) {
                        requestMapSpots({
                            callback: selectCurMarker
                        });
                    } else {
                        selectCurMarker();
                    }
                }

                firstTimeVisible = false;

                // radar radius depends on map container size
                // so we recalc it every time when plugin become visible
                var radar = krpano.get('events').getItem('radar');
                if (radar) {
                    radar.onresize();
                }
            }, 100);
        };
    };
    leafletmapPlugin.leafletmapIncludeXMLContent = function (krpano) {
        krpano.action.createItem(
            'leafletmap_add_plugin_stuff',
            {
                content:
                    `
                addlayer(leafletmap_btn); 
                set(layer[leafletmap_btn].keep, true); 
                layer[leafletmap_btn].loadstyle("skin_base|skin_glow"); 
                set(layer[leafletmap_btn].crop, "64|128|64|64"); 
                set(layer[leafletmap_btn].align, "left"); 
                set(layer[leafletmap_btn].x, 20); 
                set(layer[leafletmap_btn].scale, "0.5"); 
                set(layer[leafletmap_btn].visible, false); 
                set(layer[leafletmap_btn].ondown2, "leafletmap_show_hide_container();"); 
                set(layer[leafletmap_btn].parent, layer[skin_control_bar]); 
                if (plugin[leafletmap].btn_visible, set(layer[leafletmap_btn].visible, true); ); 
                if (plugin[leafletmap].visible, set(layer[leafletmap_btn].visible, true); ); 
                if (layer[skin_btn_hide], txtadd(layer[skin_btn_hide].onclick, "; leafletmap_move_container();"); ); 
                if (layer[skin_btn_show], txtadd(layer[skin_btn_show].onclick, "; leafletmap_move_container();"); ); 
                if (plugin[streetview].hide_menu == true, copy(plugin[leafletmap].y, plugin[leafletmap].y_closed);); 

            `
            }
        );
        krpano.action.createItem(
            'vr_add_plugin_stuff',
            {
                content:
                    `
                addlayer(skin_btn_VR);
                set(layer[skin_btn_VR].keep, true);
                layer[skin_btn_VR].loadstyle("skin_base|skin_glow");
                set(layer[skin_btn_VR].crop, "64|0|80|64");
                set(layer[skin_btn_VR].align, "bottom");
                set(layer[skin_btn_VR].x, "-140");
                set(layer[skin_btn_VR].y, "4");
                set(layer[skin_btn_VR].scale, "0.5");
                set(layer[skin_btn_VR].visible, true);
                set(layer[skin_btn_VR].onclick, webvr.enterVR(););
                set(layer[skin_btn_VR].parent, layer[skin_control_bar]);
            `
            }
        );

        krpano.action.createItem(
            'leafletmap_move_container',
            {
                content:
                    'if (layer[skin_btn_show].visible == true ' +
                    '   , tween(plugin[leafletmap].y, get(plugin[leafletmap].y_closed), 0.5, easeOutQuint); ' +
                    '   , tween(plugin[leafletmap].y, get(plugin[leafletmap].y_opened), 0.5, easeOutQuint); ' +
                    ');'
            }
        );

        krpano.action.createItem(
            'leafletmap_show_hide_container',
            {
                content:
                    'if(get(plugin[leafletmap].visible), ' +
                    '   set(plugin[leafletmap].visible, false); ' +
                    '   , ' +
                    '   set(plugin[leafletmap].visible, true); ' +
                    '   js( krpanoPluginsStuff.leafletmap.invMapSize () ); ' +
                    ');'
            }
        );
    }

    leafletmapPlugin.promise.then(function () {


        window.L.MyMap = window.L.Map.extend({
            initialize: function (id, options) {
                window.L.Map.prototype.initialize.call(this, id, options);

                if (options && options.isLocalVersion !== true) {
                    var centerChangedTimer,
                        that = this,
                        setTimer = function () {
                            clearTimer();
                            centerChangedTimer = setTimeout(function () {
                                centerChangedTimer = undefined;
                                that.fire("delayedCenterChanged");
                            }, 1000);
                        },
                        clearTimer = function () {
                            if (centerChangedTimer) {
                                clearTimeout(centerChangedTimer);
                                centerChangedTimer = undefined;
                            }
                        };

                    this.delayedCenterChangeOn = function () {
                        if (this.mapListensWithFn('moveend', setTimer, this)) {
                            return this;
                        }

                        this.on('zoomstart', clearTimer, this);
                        this.on('movestart', clearTimer, this);
                        this.on('zoomend', setTimer, this);
                        this.on('moveend', setTimer, this);
                        //
                        return this;
                    };

                    this.delayedCenterChangeOff = function () {
                        this.off('zoomstart', clearTimer, this);
                        this.off('movestart', clearTimer, this);
                        this.off('zoomend', setTimer, this);
                        this.off('moveend', setTimer, this);
                        //
                        return this;
                    };
                }
            },

            mapListensWithFn: function (type, fn, context) {
                var listens = window.L.Map.prototype.listens.call(this);

                if (listens && (context === this)) {
                    var events = this._events || {},
                        typedEvents = events[type];

                    for (var i = 0, len = typedEvents.length; i < len; i++) {
                        if (typedEvents[i].fn === fn) {
                            return true;
                        }
                    }
                } else {
                    return false;
                }
            }
        });

        window.L.myMap = function (id, options) {
            return new window.L.MyMap(id, options);
        };

    });
    // Radar class

    leafletmapPlugin.promise.then(function () {

        window.L.Radar = window.L.Path.extend({
            initialize: function (latlng, radius, viewAngel, fov, options) {
                //WL.Path.prototype.initialize.call(this, options);

                window.L.setOptions(this, options);

                this._latlng = latlng;
                this._radius = radius || 0;
                this._viewAngle = viewAngel || 0;
                this._fov = fov || 0;
            },

            options: {
                fill: true,
                opacity: 0.8,
                weight: 2,
                color: '#fff',
                fillColor: '#333',
                clickable: false
            },

            setLatLng: function (latlng) {
                if (this._latlng instanceof window.L.LatLng && this._latlng.equals(latlng)) {
                    return this;
                }
                this._latlng = window.L.latLng(latlng);
                return this.redraw();
            },

            setRadius: function (radius) {
                if (radius == this._radius) {
                    return this;
                }
                this._radius = radius;
                return this.redraw();
            },

            setViewAngle: function (viewAngle) {
                if (viewAngle == this._viewAngle) {
                    return this;
                }
                this._viewAngle = viewAngle;
                return this.redraw();
            },

            setFov: function (fov) {
                if (fov == this._fov) {
                    return this;
                }
                this._fov = Math.max(Math.min(fov, 180), 1);
                return this.redraw();
            },

            getLatLng: function () {
                return this._latlng;
            },

            getRadius: function () {
                return this._radius;
            },

            getViewAngle: function () {
                return this._viewAngle;
            },

            getFov: function () {
                return this._fov;
            },

            _project: function () {
                if (this._latlng instanceof window.L.LatLng) {
                    this._point = this._map.latLngToLayerPoint(this._latlng);
                }
            },

            _update: function () {
                if (this._map) {
                    this._updatePath();
                }
            },

            _updatePath: function () {
                this._renderer._updateRadar(this);
            },

            _getPoints: function () {
                var p = this._point,
                    r = this._radius,
                    f = this._fov,
                    f2 = Math.round(f / 2),
                    v = this._viewAngle,
                    DEG_TO_RAD = Math.PI / 180,
                    dx, dy, p1, p2, a1, a2;

                a1 = (v - f2) * DEG_TO_RAD;
                dx = Math.cos(a1) * r;
                dy = -Math.sin(a1) * r;
                p1 = p.add([dx, dy])._round();

                a2 = (v + f2) * DEG_TO_RAD;
                dx = Math.cos(a2) * r;
                dy = -Math.sin(a2) * r;
                p2 = p.add([dx, dy])._round();

                return [p, p1, p2, a1, a2];
            },

            _empty: function () {
                if (!this._map) {
                    return false;
                }

                return isNaN(+this._radius) || isNaN(+this._viewAngle) || isNaN(+this._fov) || !(this._latlng instanceof window.L.LatLng);
            }
        });

        window.L.SVG.include({
            _updateRadar: function (layer) {
                if (layer._empty()) {
                    return '';
                }

                var ps = layer._getPoints(),
                    r = layer._radius,
                    p = ps[0],
                    p1 = ps[1],
                    p2 = ps[2];

                var d = layer._empty() ? 'M0 0' :
                    'M' + p.x + ',' + p.y +
                    ' ' + p1.x + ',' + p1.y +
                    'A' + r + ',' + r + ',0,0,0,' +
                    p2.x + ',' + p2.y + ' z';

                this._setPath(layer, d);
            }
        });


        window.L.KrpanoRadar = window.L.Radar.extend({
            initialize: function (latlng, radius, viewAngel, fov, options) {
                window.L.Radar.prototype.initialize.call(this, latlng, radius, viewAngel, fov, options);

                this.options.krpano.get('events').createItem('radar', {
                    keep: true,
                    onviewchanged: window.L.bind(this.setRadarView, this),
                    onresize: window.L.bind(this.setRadarRadius, this)
                });
            },
            setRadarRadius: function () {
                var h = this._mapToAdd.getContainer().offsetHeight || 0,
                    radiusPercent = +this.options.plugin.radar.radiuspercent || 25,
                    newRadius = Math.min(Math.max(h * radiusPercent / 100, 20), 90);
                this.setRadius(newRadius);
            },
            setRadarView: function () {
                this.setViewAngle(-this.options.krpano.sv.heading + 90).setFov(this.options.krpano.view.fov);
            },
            onAdd: function () {
                window.L.Radar.prototype.onAdd.call(this);

                this.setRadarRadius();
            }
        });

    });

    leafletmapPlugin.promise.then(function () {

        window.L.Control.CloseControl = window.L.Control.extend({
            onAdd: function (map) {
                var _container = document.createElement('div');
                _container.setAttribute("id", "closeBtnWrapper");
                _container.setAttribute("style", "margin: 0; cursor: pointer; background-color: white; width: 12px; height: 12px; padding: 3px 0 0 3px;");

                var btn = document.createElement('div');
                btn.setAttribute("id", "closeBtn");
                btn.setAttribute("style", "width: 9px; height: 10px; background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAKCAYAAABmBXS+AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAIGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAAAETSURBVHjaTI4hjsJAGEZfpxIMScU/hgoOQMIMB6iiFyCoApeo60lQhK7hCNxhSsIBMCiqamBaNyt2ye5LvuQln3nRbrcL/GCPx2Pz6+z3ewM4gOhwOASA6/XK6/WydV03RVGY8XjsFosFAFHbtuF8PgNwu914v9/FaDSq5/M5AJvNhiiEYJ7PpzudTgDc73dmsxkA2+0WEbEKaETE5nmO9x6tNd578jxHRCzQRCEEVquVmUwmbjqdfrp5PB50XWcvl0ujsiwzcRy7JEnw3rNer/HekyQJcRy7LMuMUko5rTV931OWJcvlsijLkr7v0VqjlHJKRBiGgaqqSNPUAl9pmtqqqhiGARGB8IcJIfBv5nN8DwCZ6okTYNpcRgAAAABJRU5ErkJggg==')")

                _container.appendChild(btn);

                window.L.DomEvent.addListener(_container, 'click', this.closeBtnClick, this);

                return _container;
            },
            closeBtnClick: function () {
                this.options.plugin.visible = false;
            }
        });


    });

    var krpano = null;  // the krpano and plugin interface objects
    var plugin = null;

    var plugincanvas = null;        // optionally - a canvas object for graphic content
    var plugincanvascontext = null;

    // registerplugin - startup point for the plugin (required)
    // - krpanointerface = krpano interface object
    // - pluginpath = string with the krpano path of the plugin (e.g. "plugin[pluginname]")
    // - pluginobject = the plugin object itself (the same as: pluginobject = krpano.get(pluginpath) )
    this.registerplugin = function (krpanointerface, pluginpath, pluginobject) {
        krpano = /*window.krpano = */ krpanointerface;
        plugin = /*window.plugin = */pluginobject;

        // add plugin graphic content (optionally)
        var havegraphiccontent = true;
        if (havegraphiccontent) // this code here is only an example for how-to add addtional graphical content!
        {
            // register the size of the plugin content
            // e.g. to set the plugin source size to 256x256 pixels:
            //plugin.registercontentsize(parseInt(plugin.width), parseInt(plugin.height));

            // leaflet will use #mapdiv as container for the map
            plugincanvas = document.createElement("div");
            plugincanvas.setAttribute("id", "mapdiv");
            plugincanvas.style.width = "100%";  // automatic scale with parent
            plugincanvas.style.height = "100%";
            plugincanvas.style.border = "2px solid white";

            plugincanvas.onselectstart = function () { return false; };  // fix select mouse cursor

            // the plugin "sprite" variable holds the visible html element
            // - it can be used to add elements or events
            plugin.sprite.appendChild(plugincanvas);


            // initialize map stuff
            leafletmapPlugin.promise.then(function () {
                window.krpanoPluginsStuff.leafletmap.invMapSize = leafletmapPlugin.initMap(plugincanvas, krpano, plugin);

                leafletmapPlugin.leafletmapIncludeXMLContent(krpano);
                // krpano.call("leafletmap_add_plugin_stuff();");
                // krpano.call("vr_add_plugin_stuff();");
            });

        }
    };

    // unloadplugin - end point for the plugin (optionally)
    // - will be called from krpano when the plugin will be removed
    // - everything that was added by the plugin (objects,intervals,...) should be removed here
    this.unloadplugin = function () {
        plugin = null;
        krpano = null;
    };
    // we need this if plugin was invisible on load.
    // Call it in vtourskin.xml on leafletmap_show_hide_container
    window.krpanoPluginsStuff.leafletmap.invMapSize = undefined;
};

//window\.[^=]+\s=\s


/*
leafletmapPlugin.invalidateMapSize = function () {
    window.krpanoPluginsStuff.leafletmap.invMapSize();
};*/

/**
 *
 * Change L. Map class:
 *   fire once "delayedCenterChanged" event on map
 *   if it's center was not changed for 1 second
 *   since last changing (zooming or panning)
 *
 */


/*

 if (WL.Canvas) {
 WL.Canvas.include({
 _updateRadar: function (layer) {
 if (layer._empty()) {
 return;
 }

 var ps = layer._getPoints(),
 p = ps[0],
 p1 = ps[1],
 p2 = ps[2],
 a1 = ps[3],
 a2 = ps[4];

 this._ctx.beginPath();
 this._ctx.moveTo(p.x, p.y);
 this._ctx.lineTo(p1.x, p1.y);
 this._ctx.arc(p.x, p.y, layer._radius, -a1, -a2, true);
 this._ctx.closePath();

 this._fillStroke(this._ctx, layer);

 */
/*if (layer._empty()) { return; }

 var p = layer._point,
 ctx = this._ctx,
 r = layer._radius,
 s = (layer._radiusY || r) / r;

 if (s !== 1) {
 ctx.save();
 ctx.scale(1, s);
 }

 ctx.beginPath();
 ctx.arc(p.x, p.y / s, r, 0, Math.PI * 2, false);

 if (s !== 1) {
 ctx.restore();
 }

 this._fillStroke(ctx, layer);

 }
 });
 }
 */
