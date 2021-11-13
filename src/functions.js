const LatLon = require('geodesy/latlon-spherical');

module.exports = {
    uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    merge(json, radios = 50) {
        const finalData = json
            .map((e, i) => ({ ...e, objectid_1: i + 1, /* num_ligne: e.num_ligne.replace("07-BIS", "BIS") */ }))

            .reduce((acc, curr) => {
                let pt_globale = new LatLon(curr.latitude, curr.longitude);
                let proches = acc.filter((proche, _index) => {
                    let pt_locale = new LatLon(proche.latitude, proche.longitude);
                    let distance = pt_globale.distanceTo(pt_locale);
                    // check if the survey already exists
                    let existants = acc.reduce((cumul, element) => {
                        let exst = element.points.filter(ee => ee.objectid_1 === curr.objectid_1).length;
                        return cumul + exst;
                    }, 0);
                    if (
                        distance < radios
                        && existants === 0
                        && (
                            curr.aller_reto === proche.aller_reto
                            || curr.aller_reto == ''
                            || proche.aller_reto == ''
                        )
                    ) {
                        proche.points.push(curr);
                        return true;
                    } else {
                        return false;
                    }
                });
                if (proches.length === 0) {
                    acc.push({ ...curr, points: [curr] });
                }
                return acc;
            }, []);


        console.log(
            `${finalData.reduce((a, c) => a + c.points.length - 1, 0)} + ${finalData.length} === ${finalData.length + finalData.reduce((a, c) => a + c.points.length - 1, 0)} || ${json.length}`
        );

        return finalData.sort((e, f) => f.points.length - e.points.length)
            .map((e, i) => {
                let opt = e.points.map(ee => ee.num_ligne.replace('خط', 'ligne')).join('-').split('-').sort()
                    .reduce((acc, cur) => {
                        !acc.includes(cur) && acc.push(cur)
                        return acc;
                    }, [])
                return {
                    ...e,
                    latitude: parseFloat(e.latitude), longitude: parseFloat(e.longitude),
                    num_ligne: opt.sort().join('-'), //e.points.map(mapp).filter(filterr).sort().join('-')
                    // num_lignenew: e.num_ligne.split('-').sort().join('-') //e.points.map(mapp).filter(filterr).sort().join('-')
                };
            })
            .map(e => {
                ["points", "OBJECTID", "FID1", "NEAR_FID", "NEAR_DIST", "NEAR_ANGLE", "Ligne", "Commune_Fr", "Commune_Ar", "Shape_Le_1",
                    "FID_1", "OBJECTID_1", "FID_", "PATH_1", "LATITUDE_1", "LONGITUD_1", "ELEVATIO_1", "NumeroLi_1", "heading", "timestamp",
                    "ordresens", "fid_", "path", "remarks", "rec_time"].forEach(k => {
                        delete e[k]
                    });
                return e;
            })

        /* var filterr = (value, index, selfarray) => {
            let lst = value.split('-');
            letlstsplt = lst
                .filter(k => {
                    let ixt = selfarray.indexOf(k) === index;
                    return ixt;
                });
            return lst.length !== 0;
        } 
        .filter(e => !e.num_lignenew.includes(e.num_ligne)).map(e => ({
            num_lignenew: e.num_lignenew, num_ligne: e.num_ligne
        }))
            .sort((e, f) => f.num_ligne.split('-').length - e.num_ligne.split('-').length)
    
            .filter(e => e.num_ligne.split('-').length === 1).length
            .filter(e => e.num_ligne !== e.LignesOld)
            .filter(e => e.LignesOld !== e.num_ligne && ![" ", "07 BIS"].includes(e.LignesOld))//.map(e => ({LignesOld:e.LignesOld,num_ligne:e.num_ligne}))*/
    },
    newSurveysFun(json) {
        let radios = 15;
        let cercles = [];
        let panos = [];
        // let json = result.body;
        const finalData = json
            // transform the panos and their coordinates en list to add to the db
            // calculating heading, distance to the center, and timestamp
            .map((val, index, arr) => {
                let p1 = new LatLon(val.latitude, val.longitude);
                let next = arr[index + 1];
                let coords = next ? [next.latitude, next.longitude] : [0, 0];
                let pp2 = new LatLon(...coords);
                let heading = p1.bearingTo(pp2);
                let date = new Date("09/04/2021 11:47:26.100 GMT+01:00").getTime();
                return { ...val, heading, timestamp: date + 4 * index * 1000 }
            })
            .reduce((acc, curr) => {
                let p1 = new LatLon(curr.latitude, curr.longitude);
                let label = curr.pano;
                let proches = acc.filter(proche => {
                    let p2 = new LatLon(proche.latitude, proche.longitude);
                    let distance = p1.distanceTo(p2);
                    // check if the survey already exists
                    let _ksd = acc.reduce((cumul, element) => {
                        let exst = element.points.filter(ee => ee.pano === curr.pano).length;
                        return cumul + exst;
                    }, 0);
                    if (radios > distance && _ksd === 0) {
                        // add new pano
                        panos.push({
                            id: uuidv4(),
                            pano: curr.pano,
                            latitude: curr.latitude,
                            longitude: curr.longitude,
                            heading: curr.heading,
                            elevation: curr.elevation,
                            dist: distance,
                            rec_time: curr.REC_TIME,
                            timestamp: curr.timestamp,
                            cercle_id: proche.OBJECTID
                        });
                        cercles.find((val) => val.id == proche.OBJECTID).panoscount++;
                        // add new survey
                        proche.points.push(curr);
                        return true;
                    }
                    return false;
                });
                if (proches.length === 0) {
                    let uuid = uuidv4();
                    curr.OBJECTID = uuid;
                    // push new survey
                    acc.push({ ...curr, points: [] });
                    // push the center of cercle at the new survey
                    // acc.find(ac => ac.pano == label).points.push(curr);
                    // add new cercle
                    cercles.push({
                        id: curr.OBJECTID,
                        latitude: curr.latitude,
                        longitude: curr.longitude,
                        radios,
                        panoscount: 1
                    });
                    // add center of cercle as new pano
                    panos.push({
                        id: uuidv4(),
                        pano: curr.pano,
                        latitude: curr.latitude,
                        longitude: curr.longitude,
                        heading: curr.heading,
                        elevation: curr.elevation,
                        dist: 0,
                        rec_time: curr.REC_TIME,
                        timestamp: curr.timestamp,
                        cercle_id: curr.OBJECTID,
                    });
                }
                return acc;
            }, []);
        cercles = cercles.map((cercle, index, array) => ({
            ...cercle,
            next_pano: index !== array.length - 1 ? array[index + 1].id : null,
            prev_pano: index !== 0 ? array[index - 1].id : null,
            createdat: new Date().getTime(),
            updatedat: new Date().getTime(),
            stampuui: cercle.latitude.toString().replace('.', '') +
                cercle.longitude.toString().replace('.', '')
        }));
        panos = panos.map(element => ({
            ...element,
            createdat: new Date().getTime(),
            updatedat: new Date().getTime(),
            stampuui: element.latitude.toString().replace('.', '') +
                element.longitude.toString().replace('.', '') +
                element.pano
        }));
        return { cercles, panos, finalData };
    }
    /**
     * 
     * @param {JSON[]} json 
     * @returns 
     */
    , ordering(json) {
        return json.reduce((cum, cur) => {
            cur.num_ligne.split('-').forEach(p => {
                if (p in cum) {
                    cum[p].push(cur)
                }
            })
            return cum;
        }, json.reduce((acc, cur) => {
            cur.num_ligne.split('-').forEach(p => {
                if (!(p in acc)) {
                    acc[p] = []
                }
            })
            return acc;
        }, {}))
    }
}