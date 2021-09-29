var krpanoplugin = function () {
    window.krpanoPluginsStuff = {
        streetview: {}
    };
    var streetviewPlugin = { karpano: null };
    streetviewPlugin.DataProvider = {
        firstXML: undefined,
        _actions: {
            timeline: {
                sectionName: 'timeline',
                actionNames: {
                    getDates: 'dates',
                    pano: 'now'
                },
                url: 'http://localhost:3000/timeline.php'
            }
        },
        _encodeQueryData: function (data) {
            var ret = [],
                newName;
            for (var name in data)
                if (data.hasOwnProperty(name)) {
                    newName = name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
                    ret.push(encodeURIComponent(newName) + '=' + encodeURIComponent(data[name]));
                }
            return ret.join('&');
        },
        _getData: function (callback, sectionName, actionName, params) {
            var acts = this._actions[sectionName],
                section = acts.sectionName,
                action = acts.actionNames[actionName],
                url = this.firstXML + acts.url;
    
            var xmlhttp = new XMLHttpRequest(),
                _params = {
                    section: section,
                    action: action
                };
            streetviewPlugin.Utils.extend(_params, params);
            url += _params.noParams ? '' : '?' + this._encodeQueryData(_params);
    
            if (typeof krpanoXhrCallback == 'function') {
                krpanoXhrCallback(url, callback);
                return;
            }
            xmlhttp.open('GET', url, true);
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
    
                if (callback && data && !data.error) {
                    callback(data);
                }
            };
            xmlhttp.setRequestHeader('Content-Type', 'application/json');
            xmlhttp.send(null);
        },
        getDates: function (callback, params) {
            this._getData(callback, 'timeline', 'getDates', params);
        }
    };
    var local = this;
    var krpano = null;
    var plugin = null;
    var plugincanvas = null;
    var plugincanvascontext = null;
    local.registerplugin = function (krpanointerface, _pluginpath, pluginobject) {
        krpano = krpanointerface;
        streetviewPlugin.karpano = krpanointerface;
        plugin = pluginobject;
        streetviewPlugin.changeLayerOrder();
        var havegraphiccontent = plugin.show_timeline == 'true';
        if (havegraphiccontent) {
            plugin.visible = true;
            plugincanvas = document.createElement('select');
            plugincanvas.setAttribute('id', 'timeline');
            plugincanvas.style.width = '100%';
            plugincanvas.style.height = '100%';
            plugincanvas.onselectstart = function () { return false; };
            plugin.sprite.appendChild(plugincanvas);
            streetviewPlugin.DataProvider.firstXML = ''/* krpano.parsePath('%FIRSTXML%') */;
            streetviewPlugin.init(plugincanvas, krpano, plugin);
        }
    };
    local.unloadplugin = function () {
        plugin = null;
        krpano = null;
    };
    streetviewPlugin.init = function (container, krpano, plugin) {
    
        var parseDates = function (data) {
            var timelineElem = document.getElementById('timeline');
            if (Array.isArray(data)) {
                timelineElem.innerHTML = '';
                let historique = data.map(date => {
                    let datetime = new Date(parseInt(date.timestamp));
                    let localeDate = datetime.toLocaleDateString();
                    let localeTime = datetime.toLocaleTimeString();
                    return {
                        localeDate, localeTime, id: date.id
                    }
                });
    
                let map = new Map(historique.map(({ localeDate }) => [localeDate, { localeDate, times: [] }]));
                for (let { localeTime, id, localeDate } of historique) {
                    map.get(localeDate).times.push({ localeTime, id });
                }
                let result = Array.from(map.values());
    
                result.forEach(res => {
                    /* let group = document.createElement('optgroup');
                    group.setAttribute('label', res.localeDate);
                    res.times.forEach(time => {
                        let option = document.createElement('option');
                        option.value = time.id;
                        option.textContent = time.localeTime;
                        group.appendChild(option);
                    });
                    timelineElem.appendChild(group); */
                    let option = document.createElement('option');
                    option.value = res.times[0].id;
                    option.textContent = res.localeDate;
                    timelineElem.appendChild(option);
                })
                setArrowEnabled();
                container.style.width = '';
                var widthDelta = parseInt(container.offsetWidth) - plugin.width;
                if (widthDelta > 0) {
                    var label = krpano.layer.getItem('streetview_tm_label');
                    var arrowLeft = krpano.layer.getItem('streetview_tm_arrow_left');
                    label.x = +label.x + widthDelta;
                    arrowLeft.x = +arrowLeft.x + widthDelta;
                    plugin.x = +plugin.x + widthDelta;
                } else {
                    container.style.width = '100%';
                }
            }
        },
            setArrowEnabled = function () {
                var that = container;
                if (that.selectedIndex == 0) {
                    krpano.set('layer[streetview_tm_arrow_left].enabled', false);
                    krpano.set('layer[streetview_tm_arrow_left].crop', "128|320|64|64");
                    if (krpano.skin_lockglow == 'streetview_tm_arrow_left') {
                        krpano.set('layer[streetview_tm_arrow_left].hovering', false);
                    }
                } else {
                    krpano.set('layer[streetview_tm_arrow_left].enabled', true);
                    krpano.set('layer[streetview_tm_arrow_left].crop', "128|128|64|64");
                }
    
                if (that.selectedIndex == that.options.length - 1) {
                    krpano.set('layer[streetview_tm_arrow_right].enabled', false);
                    krpano.set('layer[streetview_tm_arrow_right].crop', "128|256|64|64");
                    if (krpano.skin_lockglow == 'streetview_tm_arrow_right') {
                        krpano.set('layer[streetview_tm_arrow_right].hovering', false);
                    }
                } else {
                    krpano.set('layer[streetview_tm_arrow_right].enabled', true);
                    krpano.set('layer[streetview_tm_arrow_right].crop', "128|64|64|64");
                }
            },
            setPrevBatch = function () {
                var that = container;
                if (that.selectedIndex == 0) return;
    
                that.selectedIndex = that.selectedIndex - 1;
    
                that.onchange();
            },
            setNextBatch = function () {
                var that = container;
                if (that.selectedIndex == that.options.length - 1) return;
    
                that.selectedIndex = that.selectedIndex + 1;
    
                that.onchange();
            };
        let sv = streetviewPlugin.karpano.sv;
        var current_pano = sv.startup_pano;
    
        setInterval(() => {
            if (current_pano !== sv.current_pano) {
                current_pano = sv.current_pano;
                if (current_pano !== undefined && current_pano !== null) {
                    streetviewPlugin.DataProvider.getDates(parseDates, { sv: current_pano });
                }
            }
        }, 50);
        container.onchange = function () {
            setArrowEnabled();
            var newBatch = this.options[this.selectedIndex].value;
            krpano.set('plugin[streetview].timeline', newBatch);
            krpano.call('streetview_gotopano(null, null, true);');
        };
        krpanoPluginsStuff.streetview.setPrevBatch = setPrevBatch;
        krpanoPluginsStuff.streetview.setNextBatch = setNextBatch;
        setTimeout(function () {
            if (krpano.device.firefox) {
                var tempContainer = container;
                while ((tempContainer = tempContainer.parentNode) && tempContainer.style) {
                    tempContainer.style.transform = tempContainer.style.transform.replace(/translatez[\\(\\)\\S\\+0-9a-z]+/i, '');
                }
            }
        }, 1000);
    };
    streetviewPlugin.changeLayerOrder = function () {
        try {
            var layers = document.getElementById('krpanoSWFObject').children[0].children[1].children,
                arr = [layers[0], layers[1], layers[2]];
    
            for (var i = 0; i < arr.length; i++) {
    
                var layer = arr[i],
                    zIndex = layer.style.zIndex + '',
                    display = layer.style.display;
    
                if (zIndex && display != 'none') {
                    layer.style.zIndex = 1900 + parseInt(zIndex.slice(2));
                }
    
            }
        }
        catch (e) {
    
        }
    };
    streetviewPlugin.Utils = {
        extend: function (dest) {
            var i, j, len, src;
    
            for (j = 1, len = arguments.length; j < len; j++) {
                src = arguments[j];
                for (i in src) {
                    dest[i] = src[i];
                }
            }
            return dest;
        }
    };
};