'use strict';

/**
 * @ngdoc service
 * @name irpsimApp.ScenarioConfiguration
 * @description
 * # ScenarioConfiguration
 * Service in the irpsimApp.
 */
angular.module('irpsimApp')
  .service('ScenarioConfiguration', function ($http, $q, ScenarioDefinitions, BackendVersionCache, DataStructures, Logger, Datasets, PullFunction, growl) {
    var ScenarioConfiguration = this;

    /**
     * Create a key with model version for the default scenario
     * @param {Number} modelDefinition id of the definition for the model
     * @returns {String} key
     */
    function createKey(modelDefinition){
      return BackendVersionCache.createKey(modelDefinition+'-defaultscenario');
    }

    /**
     * Load the default scenario for the given model definition
     * @param {Number} modelDefinition id of the definition for the model to load
     * @returns {Object} converted scenario
     */
    ScenarioConfiguration.loadDefaultScenario = function (modelDefinition){
      var d = BackendVersionCache.load(createKey(modelDefinition));
      if(d){
        // the set of LEME scenarios may have changed, so we need to set it to the currently valid values
        if (angular.isArray(d)) {
          for (var dataIndex = 0; dataIndex < d.length; dataIndex++) {
            var data = d[dataIndex];
            var scenarioSetNew = Datasets.getScenarioSet(data.years[0].config.year.value);
            _.each(data.years, function (year) {
              if (scenarioSetNew) {
                var sc = year.config.scenario;
                sc.values = scenarioSetNew;
                sc.value = _.find(scenarioSetNew, {stelle: sc.value.stelle}) || scenarioSetNew[0];
              }
            });
          }

        } else {

          var scenarioSet = Datasets.getScenarioSet(d.years[0].config.year.value);
          _.each(d.years, function (year) {
            if (scenarioSet) {
              var sc = year.config.scenario;
              sc.values = scenarioSet;
              sc.value = _.find(scenarioSet, {stelle: sc.value.stelle}) || scenarioSet[0];
            }
          });
        }
        var deferred = $q.defer();
        deferred.resolve(ScenarioConfiguration.convertBetweenApiAndEditableVersion(modelDefinition,d,'input',true));
        return deferred.promise;
      }else {
        return $http.get('/backend/simulation/szenarien?modeldefinition=' + modelDefinition, {cache: true}).then(function (response) {
          for (var idx in response.data) {
            var obj = response.data[idx];
            if (obj['modeldefinition'] === modelDefinition && obj['deletable'] === false) {
              return ScenarioConfiguration.loadScenario(modelDefinition, obj.id);
            }
          }
        }).then(function(scenario){
          BackendVersionCache.store(createKey(modelDefinition), ScenarioConfiguration.convertBetweenApiAndEditableVersion(modelDefinition,scenario,'input',false));
          return scenario;
        });
      }
    };

    /**
     * Load a saved scenario for a given model definition
     * @param {Number} modelDefinition id of the definition for the model to load
     * @param {Number} id id of the model
     * @param {Boolean} cache use cache
     * @returns {Object} converted scenario
     */
    ScenarioConfiguration.loadScenario = function(modelDefinition, id, cache){
      // use cache by default
      var useCache = angular.isDefined(cache) ? cache : true;
      return $http.get('/backend/simulation/szenarien/' + id, {cache: useCache}).then(function (result){
        return ScenarioConfiguration.convertBetweenApiAndEditableVersion(modelDefinition, result.data, 'input', true);
      });
    };

    /////////////// Interaktion mit Backend /////////////////////////////////////////////
    function hasTag(attr, tag) {
      return attr.tags.indexOf(tag) !== -1;
    }

    function coerceValue(definition, value, tag, isApi2Editable, tsLength, msgs, msgPrefix){
      if (isApi2Editable) {
        if((!angular.isDefined(value) || value === null) && tag === 'input'){
          value = getDefaultValue(definition, tsLength);
          if(!definition.hidden) {
            msgs.push((msgPrefix?msgPrefix:'')+definition.name);
          }
        }
        value = {value: (definition['data-type'] === 'boolean') ? (!!value) : value};
      } else {
        if(value === null || !angular.isDefined(value)){
          console.warn('create default value for', definition.name);
          value = getDefaultValue(definition, tsLength);
        }else
        if (definition['data-type'] === 'boolean') {
          value = value.value ? 1.0 : 0.0;
        } else {
          value = value.value;
        }
      }
      return value;
    }

    /**
     * A set may have supersets. The attributes that each member of set should contain
     * are the logical union of all attribute definitions of the current set and each recursive
     * superset.
     * @param {Object} setDef current set definition, may contain a key 'superset'
     */
    function collectAllAttributes(allSetDefinitions, setDef){
      var arr = setDef.attributes.slice();
      for (var i = 0; i < setDef['supersets'].length; i++) {
        var setName = setDef['supersets'][i];
        arr=arr.concat(allSetDefinitions[setName].attributes);
      }
      return arr;
    }

    /**
     * If a set is not abstract, that is, does not have any subsets, we need to
     * add all missing attributes defined either on this set or on any superset.
     *
     * @param {Object} allSetDefinitions
     * @param {Object} setDef
     * @param {Object} setData
     * @param {String} tag
     * @param {boolean} isApi2Editable
     * @param {Number} tsLength
     * @param {Object} msgs
     * @returns {Object} set element with missing attributes added
     */
    function convertSetAttributes(allSetDefinitions, setDef, setData, tag, isApi2Editable, tsLength, msgs){
      var value;
      var result = {};
      var attributes = collectAllAttributes(allSetDefinitions, setDef);
      for (var setMemberKey in setData) {
        result[setMemberKey] = {};
        for (var i = 0; i < attributes.length; i++) {
          var attr = attributes[i];
          if (hasTag(attr, tag)) {
            value = setData[setMemberKey][attr.name];
            value = coerceValue(attr, value, tag, isApi2Editable, tsLength, msgs, 'set ' + setDef.name + '[' + setMemberKey + ']: ');
            result[setMemberKey][attr.name] = value;
          }
        }
      }
      return result;
    }

    /**
     * Remove whitespace from keys in an object
     * @param {Object} obj Object to remove whitespace in keys
     * @returns {Object} Object without whitespace in keys
     */
    function removeWhiteSpaceInKeys(obj){
      return _.mapKeys(obj, function(value,key){
        return key.replace(/ /g,'');
      });
    }

    /**
     * Convert sets between editable and api version
     * @param {Object} definitions scenario definitions
     * @param {Object} data scenario data
     * @param {String} tag input or output
     * @param {Boolean} isApi2Editable convert in api or editable version
     * @param {Number} tsLength
     * @returns {Object} converted set
     */
    function convertSets(definitions, data, tag, isApi2Editable, tsLength){
      var msgs = [];
      var sets = {};
      _.forOwn(definitions.sets, function(setDef, name){
        if (hasTag(setDef, tag)) {
          var setData = data.sets[name];

          var defaults = getDefaultValue(setDef);
          // create set because it is missing from the loaded scenario
          // insert default set members if not present yet (happens if set either did not exist
          // or FSc added new default set elements)
          if (isApi2Editable && tag === 'input') {
            setData =  _.reduce(defaults,function(o,n){
              o[n] = o[n] || {}; return o;
            },setData || {});
            if(!setDef.hidden && !angular.isDefined(setData)) {
              msgs.push('set '+name);
            }
          }

          // ignore the set if the currently loaded data does not contain it
          if(angular.isDefined(setData)) {
            if (isApi2Editable) {
              setData = removeWhiteSpaceInKeys(setData);
              if (setData) {
                // without the if we would still create an empty set even if the previous if was false
                sets[name] = {
                  names: Object.getOwnPropertyNames(setData),
                  values: convertSetAttributes(definitions.sets, setDef, setData, tag, isApi2Editable, tsLength, msgs)
                };
                //we don't have a specific iteration order anyway, by sorting we have at least some semi-stable order
                sets[name].names.sort();
              }
            } else {
              if (setData) {
                sets[name] = convertSetAttributes(definitions.sets, setDef, setData.values, tag, isApi2Editable, tsLength, msgs);
              }
            }
          }
        }
      });
      return {data: sets, messages: msgs};
    }

    /**
     * Convert table between editable and api version
     * @param {Object} definitions scenario definitions
     * @param {Object} data scenario data
     * @param {String} tag input or output
     * @param {Boolean} isApi2Editable convert in api or editable version
     * @param {Number} tsLength
     * @param {Object} allSets
     * @returns {Object} converted table
     */
    function convertTables(definitions, data, tag, isApi2Editable, tsLength, allSets){
      var msgs = [];
      var tables = {};
      _.forOwn(definitions.tables, function(tableDef, tableName){
        if (hasTag(tableDef, tag)) {
          var tableData = data.tables[tableName];

          // create table with default values because it is missing from the loaded scenario
          if (isApi2Editable && tag === 'input') {
            if(!angular.isDefined(tableData)) {
              tableData = {};
              if(!tableDef.hidden) {
                msgs.push('table '+tableName);
              }
            }
            var setNames1 = allSets[tableDef.dependencies[0]].names;
            var setNames2 = allSets[tableDef.dependencies[1]].names;
            for (var i = 0; i < setNames1.length; i++) {
              var rowKey= setNames1[i];
              var m = tableData[rowKey];
              if(!m){
                // missing table row
                m={};
                msgs.push('table '+tableName+'['+rowKey+'][*]');
              }
              tableData[rowKey] = m;
              for (var k = 0; k < setNames2.length; k++) {
                var colKey = setNames2[k];
                var v = m[colKey];
                if(!angular.isDefined(v) || v === null){
                  m[colKey] = getDefaultValue(tableDef, tsLength);
                  msgs.push('table '+tableName+'[*]['+colKey+']');
                }
              }
            }
          }
          var newTable = {}, oldTable;
          if(angular.isDefined(tableData)){
            if (isApi2Editable) {
              tables[tableName] = {value: newTable};
              oldTable = tableData;
            } else {
              tables[tableName] = newTable;
              oldTable = tableData.value;
            }
            // convert all values individually: number to boolean, value to object
            for (var row in oldTable) {
              newTable[row] = {};
              for (var col in oldTable[row]) {
                var value = oldTable[row][col];
                newTable[row][col] = coerceValue(tableDef, value, tag, isApi2Editable, msgs,'table '+tableDef.name+'['+row+']['+col+']: ');
              }
            }
          }
        }
      });
      return {data: tables, messages: msgs};
    }

    /**
     * Convert scalars between editable and api version
     * @param {Object} definitions scenario definitions
     * @param {Object} data scenario data
     * @param {String} tag input or output
     * @param {Boolean} isApi2Editable convert in api or editable version
     * @returns {Object} converted scalars
     */
    function convertScalars(definitions, data, tag, isApi2Editable){
      var msgs = [];
      var scalars = {};
      _.forOwn(definitions.scalars, function(scalarDef, scalarName){
        if (hasTag(scalarDef, tag)) {
          var scalarData = data.scalars[scalarName];

          if (isApi2Editable && !angular.isDefined(scalarData) && tag === 'input') {
            // create default value because it is missing from the loaded scenario
            if(!scalarDef.hidden) {
              scalarData = getDefaultValue(scalarDef);
            }
            if(!scalarDef.hidden) {
              msgs.push('scalar '+scalarName);
            }
          }
          scalars[scalarName] = coerceValue(scalarDef, scalarData, tag, isApi2Editable, msgs, 'scalar ');
        }
      });
      return {data: scalars, messages: msgs};
    }
    function convertTimeSeries(definitions, data, tag, isApi2Editable, tsLength){
      var msgs = [];
      var ts = {};
      _.forOwn(definitions.timeseries, function(tsDef, tsName){
        if (hasTag(tsDef, tag)) {
          var tsData = data.timeseries[tsName];

          // create default timeseries because it is missing from the loaded scenario
          if(isApi2Editable && !angular.isDefined(tsData) && tag === 'input'){
            tsData = getDefaultValue(tsDef, tsLength);
            if(!tsDef.hidden) {
              msgs.push('timeseries '+tsName);
            }
          }
          if(angular.isDefined(tsData)) {
            ts[tsName] = isApi2Editable ? {value: tsData} : ts[tsName] = tsData.value;
          }
        }
      });
      return {data: ts, messages: msgs};
    }

    /**
     * Convert config between editable and api version
     * @param {Object} data scenario data
     * @param {Boolean} isApi2Editable convert in api or editable version
     * @param {Object} scenarioSet
     * @returns {Object}
     */
    function convertConfig(data, isApi2Editable, scenarioSet){
      var msgs = [];
      var config = DataStructures.deepCopy(data.config);
      var year = config.year;

      if(isApi2Editable){
        if(!angular.isDefined(year) || year === null){
          year = new Date().getFullYear()+1;
          msgs.push('year');
        }
        config.year={value:year};

        if (angular.isDefined(scenarioSet)) {
          // INFO 2017-02-07
          // The "prognoseszenario" stelle is now be saved to the config. For pre-set the "prognosezenario" to the ui,
          // we have to find the scenario in "scenarioSet" by "stelle" (id). Older saved scenarios, do not have an saved
          // "prognoseszenario". In this case we fall back to the former reaction of the ui (select the first scenario
          // in "scenarioSet".
          config.scenario = {
            value: _.find(scenarioSet, {stelle: config.prognoseszenario}) || scenarioSet[0],
            values: scenarioSet
          };
        } else {
          growl.info('Für das angegebene Bezugsjahr ist das Szenarioset leer. Bitte definieren Sie es unter "Stammdaten/Prognoseszenarien"');
          config.scenario = {
            value: undefined,
            values: undefined
          };
        }

      }else{
        config.year=year.value;
        delete config.scenario;
      }
      return {data: config, messages: msgs};
    }

    /* ensure that all set member names are present in their respective supersets
     * recursive checks will be done within addSetMember.
     */
    function ensureSupersetConsistency(definitions, result) {
      var setDefs = _.values(definitions.sets);
      // poor man's topological sort
      setDefs.sort(function(arr1,arr2){
        return arr2['supersets'].length - arr1['supersets'].length;
      });
      _.forEach(setDefs, function (setDef) {
        var setName = setDef['name'];
        var superSets = setDef['supersets'];
        for (var i = 0; i < superSets.length; i++) {
          var ss = superSets[i];
          var ssNames = result.sets[ss].names;
          var setNames = result.sets[setName].names;
          for (var j = 0; j < setNames.length; j++) {
            var setMemberName = setNames[j];
            var setElement = result.sets[setName].values[setMemberName];
            if (ssNames.indexOf(setMemberName) === -1) {
              // add to parent set
              ssNames.push(setMemberName);
            }
            // set reference to leaf set element in super set
            result.sets[ss].values[setMemberName] = setElement;
          }
        }
      });
    }

    /**
     * Convert an individual scenario between api and editable version
     * @param {Object} data scenario data
     * @param {Object} modelDefinition id of the model definition
     * @param {Number} subModelDefinition id of the submodel definition
     * @param {String} tag input or output
     * @param {Boolean} isApi2Editable convert in api or editable version
     * @param {Object} scenarioSet
     * @returns {Object} converted scenario
     */
    function convertIndividualScenario(data, modelDefinition, subModelDefinition, tag, isApi2Editable, scenarioSet) {
      var timeseriesLength = data.config.simulationlength;
      var definitions = ScenarioDefinitions.getDefinition(modelDefinition, subModelDefinition);
      var sets = convertSets(definitions, data, tag, isApi2Editable, timeseriesLength);
      var tables = convertTables(definitions, data, tag, isApi2Editable, timeseriesLength, sets.data);
      var scalars = convertScalars(definitions, data, tag, isApi2Editable);
      var timeseries = convertTimeSeries(definitions, data, tag, isApi2Editable, timeseriesLength);
      var config =convertConfig(data, isApi2Editable, scenarioSet);

      var result = {
        config: config.data,
        scalars: scalars.data,
        sets: sets.data,
        tables: tables.data,
        timeseries: timeseries.data
      };
      if(tag === 'input' && isApi2Editable) {
        ensureSupersetConsistency(definitions, result, modelDefinition);
      }
      // collect all warning messages
      var message = _([config, sets, tables, scalars, timeseries])
        .map('messages')
        .flatten()
        .join('</li><li>');

      // Message fills whole screen height, only use it for debugging
      /* if (message.length > 0) {
        Logger.addLog({
          title: 'Szenarioverwaltung',
          text: 'Fehlende Parameter wurden ergänzt: <ul><li>' + message + '</li></ul>',
          severity: 'warning',
          notify: true
        });
      } */

      if (data.postprocessing) {
        /* inputs don't have any postprocessing elements
         If we would add a null value here by blindly copying postprocessing we will get problems later on
         when merging results and input scenarios (null value for postprocessing overwrites
         postprocessing value in the results)
         */
        result.postprocessing = data.postprocessing;
      }
      return result;
    }

    /**
     * The data format provided by the API is not the best for editing. We need predictable orders of set members,
     * explicit lookup of relationships, internal set member ids for cross referencing changes (if a set member name
     * changes, we need to ensure correct updates in all linked tables. If the name is also the id, we don't know any
     * more which set member links to which table row/column).
     * Rückkonvertierung der Modellkonfiguration in die vom Backend erwartete Form.
     *
     * @param {String} type Name der Modellvariante
     * @param {Object} data Von der API geladene Konfiguration, Belegung des Modells mit konkreten Werten
     * @param {String} tag 'input' or 'output'
     * @param {boolean} isApi2Editable conversion direction: from API to editable or the reverse transformation?
     */
    ScenarioConfiguration.convertBetweenApiAndEditableVersion = function(modelDefinition, data, tag, isApi2Editable){
      console.log(modelDefinition)
      if (typeof data.models !== 'undefined') {
        // console.log('V2');
        return this.convertBetweenApiAndEditableVersionV2(modelDefinition, data, tag, isApi2Editable);
      } else {
        // console.log('V3');
        var parsed = (Array.isArray(data)) ? data : [data];//JSON.parse(angular.toJson(data)) : JSON.parse(angular.toJson([data])) ;
        return this.convertBetweenApiAndEditableVersionV3(modelDefinition, parsed, tag, isApi2Editable);;
      }
    };

    /**
     * Use version 2 of the converter
     * @param {Number} modelDefinition id of the model definition
     * @param {Object} dataInput scenario data
     * @param {String} tag input or output
     * @param {Boolean} isApi2Editable convert in api or editable version
     * @returns {Object} converted scenario
     */
    ScenarioConfiguration.convertBetweenApiAndEditableVersionV2 = function (modelDefinition, dataInput, tag, isApi2Editable) {
      var response = [];

      for (var modelIndex = 0; modelIndex < dataInput.models.length; modelIndex++) {
        var years, currentYear, i;
        var res = {};
        var data = dataInput.models[modelIndex];
        var subModelDefinition = dataInput.models[modelIndex].years[0].config.modeldefinition;
        if (isApi2Editable) {
          years = [];

          if (data.years[0] !== null) {
            var scenarioSet = Datasets.getScenarioSet(data.years[0].config.year);
            for (i = 0; i < data.years.length; i++) {
              currentYear = data.years[i];
              if (currentYear) {
                years.push(convertIndividualScenario(currentYear, modelDefinition, subModelDefinition, tag, isApi2Editable, scenarioSet));
              }
            }
          }
          res.years = years;
          if (tag === 'input') {
            /* If this is an input scenario with multiple years, we need to make sure,
             * that all parameters that can not be changed in a delta year (as specified
             * by the ui specification for 'delta') are the same as in the initial year.
             * We ensure this by replacing all of these objects with references to the original
             * parameter objects of the initial year.
             */
            res = consolidateDeltaYears(res, modelDefinition);
            // console.log(res);
          }
        } else {
          years = [];
          var firstYear = data.years[0].config.year.value;
          for (var j = 0; j < data.years.length; j++) {
            currentYear = convertIndividualScenario(data.years[j], modelDefinition, subModelDefinition, tag, isApi2Editable);
            years[currentYear.config.year - firstYear] = currentYear;
          }
          res.years = years;
          res.description = data.description;
        }
        res.years = years;
        if (data.postprocessing) { // todo
          res.postprocessing = data.postprocessing;
        }
        response.push(res);
      }
      return response;
    };

    /**
     * Use version 2 of the converter
     * @param {*} modelDefinition id of the model definition
     * @param {*} dataInput scenario data
     * @param {*} tag input or output
     * @param {*} isApi2Editable convert in api or editable version
     * @returns {Object} converted scenario
     */
    ScenarioConfiguration.convertBetweenApiAndEditableVersionV3 = function (modelDefinition, dataInput, tag, isApi2Editable) {
      var response = [];

      for (var modelIndex = 0; modelIndex < dataInput.length; modelIndex++) {
        var years, currentYear, i;
        var res = {};
        var data = dataInput[modelIndex];
        var subModelDefinition = dataInput[modelIndex].years[0].config.modeldefinition;
        if (isApi2Editable) {
          years = [];

          if (data.years[0] !== null) {
            var scenarioSet = Datasets.getScenarioSet(data.years[0].config.year);
            for (i = 0; i < data.years.length; i++) {
              currentYear = data.years[i];
              if (currentYear) {
                years.push(convertIndividualScenario(currentYear, modelDefinition, subModelDefinition, tag, isApi2Editable, scenarioSet));
              }
            }
          }
          res.years = years;
          if (tag === 'input') {
            /* If this is an input scenario with multiple years, we need to make sure,
             * that all parameters that can not be changed in a delta year (as specified
             * by the ui specification for 'delta') are the same as in the initial year.
             * We ensure this by replacing all of these objects with references to the original
             * parameter objects of the initial year.
             */
            res = consolidateDeltaYears(res, modelDefinition);
            // console.log(res);
          }
        } else {
          years = [];
          var firstYear = data.years[0].config.year.value;
          for (var j = 0; j < data.years.length; j++) {
            currentYear = convertIndividualScenario(data.years[j], modelDefinition, subModelDefinition, tag, isApi2Editable);
            years[currentYear.config.year - firstYear] = currentYear;
          }
          res.years = years;
          res.description = data.description;
        }
        res.years = years;
        if (data.postprocessing) { // todo
          res.postprocessing = data.postprocessing;
        }
        response.push(res);
      }
      return response;
    };

    ////////////////////// function for loading multiple results ///////////////////////////////////////////

    function asflatArray(obj1, obj2){
      var arr = Array.isArray(obj1)? obj1.slice():[obj1];
      arr.push(obj2);
      return arr;
    }

    function mergeMatching(leafDetectorFn, crnt, next){
      var res = Array.isArray(crnt)? []:{};
      DataStructures.traverseDepthFirst(crnt,function(value,key, path){
        var isLeaf = (leafDetectorFn(value,key) ||
                     (Array.isArray(value) && _.every(value,function(v){return leafDetectorFn(v,key);})));
        _.set(res,path,isLeaf ? asflatArray(value,_.get(next,path)) : value);
        return isLeaf;
      });
      return res;
    }

    function isPostprocessingObj (o, k){
      return angular.isNumber(o) && _.some(['min','max','avg','sum'],function(v){return k === v;});
    }
    function isValue(o,k){ // all backend results are string references to timeseries in the database
      return angular.isString(o) && k === 'value';
    }

    ScenarioConfiguration.mergeIntoScenario = function(crntScenario, newScenario){
      return {
        config: angular.copy(crntScenario.config),
        postprocessing: mergeMatching(isPostprocessingObj,crntScenario.postprocessing, newScenario.postprocessing),
        years: _.map(crntScenario.years,function(crntYear,yearIdx){
          var next = newScenario.years[yearIdx];
          return {
            config: angular.copy(crntYear.config),
            postprocessing: mergeMatching(isPostprocessingObj, crntYear.postprocessing, next.postprocessing),
            sets: mergeMatching(isValue,crntYear.sets, next.sets),
            scalars: mergeMatching(isValue,crntYear.scalars, next.scalars),
            tables: mergeMatching(isValue,crntYear.tables, next.tables),
            timeseries: mergeMatching(isValue,crntYear.timeseries, next.timeseries)
          };
        })
      };
    };

    ///////////////////////////////////////////////////////////////////////////////////////

    ScenarioConfiguration.loadScenarioTable = function (modelDefinition){
      return $http.get('/backend/simulation/szenarien?modeldefinition=' + modelDefinition).then(function (response){
        var content = [];
        for (var idx in response.data) {
          var obj = response.data[idx];
            content.push(obj);
        }
        return content;
      });
    };

    /**
     * Store a scenario on the backend
     * @param {String} creator name of person who created the entry
     * @param {String} name name of the entry
     * @param {String} description description of the entry
     * @param {*} scenario scenario data
     * @param {*} type type of the simulation model
     * @returns {Promise}
     */
    ScenarioConfiguration.storeScenario = function (creator, name, description, scenario, type){
      scenario =  ScenarioConfiguration.convertBetweenApiAndEditableVersion(type, scenario, 'input', false);
      scenario = {'models': scenario};
      return $http.put('/backend/simulation/szenarien', {creator: creator, name: name, description: description, data: scenario});
    };

    /**
     * Delete a scenario on the backend
     * @param {Number} id id of the scenario
     * @returns {Promise}
     */
    ScenarioConfiguration.deleteScenario = function (id){
      return $http.delete('/backend/simulation/szenarien/' + id);
    };

    /**
     * Save a changed and existing scenario on the backend
     * @param {Number} id id of the scenario
     * @param {*} creator name of person who created the entry
     * @param {*} name name of the entry
     * @param {*} description description of the entry
     * @param {*} scenario scenario data
     * @param {*} type type of the simulation model
     * @returns {Promise}
     */
    ScenarioConfiguration.saveScenario = function(id, creator, name, description, scenario, type){
      scenario =  ScenarioConfiguration.convertBetweenApiAndEditableVersion(type, scenario, 'input', false);
      scenario = {'models': scenario};
      return $http.put('/backend/simulation/szenarien/' + id, {creator: creator, name: name, description: description, data: scenario});
    };


    /**
     *
     * @param {Object} initialYear scenario object of the first year
     * @param {Number} currentYear year number of the new delta year
     * @param {Array} differingParameters list of parameters that may be changed in the delta year. all other parameters need to be references to the initial year's scenario
     * @returns {{config: *, sets: *, tables: *, scalars: {}, timeseries: {}}}
     */
    function createReferencingCopy(initialYear, currentYear, differingParameters) {
      var TRUE = _.constant(true);
      var res = {
        config: currentYear.config, // reference current year's value directly
        sets: _.transform(initialYear.sets, function(res, v, k){
          res[k]={
            names: _.clone(v.names),
            values: _.transform(v.values,function(res2,v2,k2){
              res2[k2]= _.pick(v2, TRUE);
            })
          };
        }),
        tables: _.transform(initialYear.tables, function(tables, table, k){
          tables[k]={
            value: _.pick(table.value,TRUE)
          };
        }),
        scalars: _.pick(initialYear.scalars, TRUE), //shallow copy of object
        timeseries: _.pick(initialYear.timeseries, TRUE) //shallow copy of object
      };
      // replace all shallow references to changeable parameters with copies so the user can change them independently
      _.each(differingParameters, function(parameter){
        switch(parameter.type){
          case 'timeseries':
          case 'scalars':
            res[parameter.type][parameter.name] = currentYear[parameter.type][parameter.name];
            break;
          case 'attributes':
            var s = res.sets[parameter.set].values;
            _.forOwn(s,function(v,setMember){
              v[parameter.name] = currentYear.sets[parameter.set].values[setMember][parameter.name];
            });
            break;
          case 'tables':
            res.tables[parameter.name]=currentYear.tables[parameter.name];
            break;
          default:
            Logger.addLog({
              title: 'Mehrjahresszenario',
              text: 'Parametertyp '+ parameter.type +' ist unbekannt, Modell möglicherweise inkonsistent!',
              severity: 'error',
              notify: true
            });
            break;
        }
      });
      return res;
    }

    /**
     * Each year which is not the initial year may only be changed in aspects given by the respective ui structure.
     * For example, in the basic scenario in IRPsim within each delta year the user may only change environmental and
     * market related parameters, all other parameter should stay in sync with the initial year.
     * This function ensures that all unchangeable parameters are references to the same parameter in the initial year.
     * @param {object} multiYearScenario externally set scenario
     * @param {Array} differingParameters objects that describe parameters that can be changed in delta years
     * @param {Number} index optional index of year to process, if undefined will consolidate all delta years
     */
    function consolidateDeltaYears(multiYearScenario, modelDefinition, index) {
      var initialYear = multiYearScenario.years[0];
      var subModelDefinition = initialYear.config.modeldefinition;
      var differingParameters = ScenarioDefinitions.extractUIParameters(modelDefinition, 'delta', subModelDefinition);
      if(angular.isNumber(index)){
        multiYearScenario.years[index] = createReferencingCopy(initialYear, multiYearScenario.years[index], differingParameters);
      }else {
        for (var i = 1; i < multiYearScenario.years.length; i++) {
          var currentYear = multiYearScenario.years[i];
          multiYearScenario.years[i] = createReferencingCopy(initialYear, currentYear, differingParameters);
        }
      }
      return multiYearScenario;
    }

    /**
     *
     * @param {Object} initialYearScenario full scenario configuration for the first year
     * @param {number} thisYear number of the delta year to create
     * @returns {Object} scenario configuration for new delta year.
     */
    function createDeltaYearFrom(initialYearScenario, thisYear) {
      var newYear = DataStructures.deepCopy(initialYearScenario);
      newYear.config.year.value = thisYear;
      return newYear;
    }

    /**
     * Copy the last year and add the copy to the scenario. Makes sure to automatically
     * select the correct datasets to use, according to the master data of the previous year
     * and the year number of the current one.
     * @param {Object} multiYearScenario the scenario we need to add a year to
     * @param {String} type model type, needed to find correct parameter definitions
     */
    ScenarioConfiguration.addDeltaYear = function (multiYearScenario, type) {
      var years = multiYearScenario.years;
      var n = years.length;
      if(n>0) {
        var lastYear = years[n - 1];
        var newYear = createDeltaYearFrom(lastYear, lastYear.config.year.value + 1);
        PullFunction.pullDatasets(lastYear, newYear, type);
        multiYearScenario.years.push(newYear);
        multiYearScenario.years = years.slice();//shallow copy of array so our 'watchCollection' gets notified
        consolidateDeltaYears(multiYearScenario, type, years.length - 1);
      }
    };

    ScenarioConfiguration.deleteDeltaYear = function (multiYearScenario, index) {
      if (index > 0) {
        multiYearScenario.years.splice(index, 1);
        multiYearScenario.years = multiYearScenario.years.slice(); // make sure our watcher sees the change
      }
    };

    var counter = 1;
    var ROW = 0, COLUMN = 1;

    function getDefaultValue(definition, timeseriesLength){
      var dataType = definition['data-type'];
      var value = definition.default;
      if(!angular.isDefined(definition.default) || definition.default === null){
        switch(dataType) {
          case 'boolean':
          case 'float':
          case 'integer':
            value=0;
            break;
          case 'string':
            value='changeme';
            break;
          case 'timeseriess': // all these instances should better be hidden!
            Logger.addLog({
              title: 'Szenarioverwaltung',
              text: 'Parameter '+definition.name +' sollte besser im Modell als nicht sichtbar markiert werden.!',
              severity: 'warning',
              notify: true
            });
            break;
          case 'floats':
          case 'integers':
            value = 0;
            break;
        }
      }else{
        value = DataStructures.deepCopy(definition.default);
      }
      if (dataType[dataType.length-1]==='s') {
        // backend has one special timeseries stored for this common case
        if(timeseriesLength === 35040){
          value = '0';
        }else {
          var arr = [];
          for (var i = 0; i < timeseriesLength; i++) {
            arr.push(value);
          }
          value = arr;
        }
      }
      return value;
    }

    /**
     * Walk the current input scenario and call the different callbacks for all elements
     * that need to be modified if a set member gets changed: The set itself and columns/rows in tables
     * that depend on this set.
     *
     * @param {String} type type of the simulation model
     * @param {Object} scenario scenario configuration
     * @param {String} setName name of the set to manipulate
     * @param {Function} setCallback callback to manipulate set
     * @param {Function} tableRowCallback callback to manipulate table (current set is a row in this table)
     * @param {Function} tableColumnCallback callback to manipulate table (current set is a column in this table)
     */
    function dotoSetMember(type, scenario, setName, setCallback, tableRowCallback, tableColumnCallback){
      var definitions = ScenarioDefinitions.getDefinition(type, scenario.config.modeldefinition);
      var setDefinition = ScenarioDefinitions.getDefinition(type, scenario.config.modeldefinition, 'sets', setName);
      var setData = scenario.sets[setName];

      //set sets
      setCallback(setData, setDefinition);
      //set tables
      _.forOwn(definitions.tables,function (tableDef){
        // we only work with input parameters
        if (tableDef.tags.indexOf('input') === -1) {
          return;
        }
        var dependencyIndex = tableDef.dependencies.indexOf(setName);
        if (dependencyIndex > -1) {
          var table = scenario.tables[tableDef.name].value;
          // need to update table because set has changed
          // question is: do we need a new row or a new column?
          switch (dependencyIndex) {
            case ROW:
              tableRowCallback(table, tableDef);
              break;
            case COLUMN:
              for(var row in table){
                if(table.hasOwnProperty(row)){
                  tableColumnCallback(table[row], tableDef);
                }
              }
              break;
          }
        }
      });
    }

    function makeSetElementNameUnique(type, scenario, setName, elementName){
      var index = scenario.sets[setName].names.indexOf(elementName);
      // make sure new name is unique!
      var nextName = elementName;
      while(!ScenarioConfiguration.isGloballyUnique(type, scenario, setName, index, nextName)){
        nextName = 'Klon_von_' + nextName;
      }
      return nextName;
    }
    /**
     * Copy a set member.
     * @param {String} type type of the simulation model
     * @param {Object} scenario scenario configuration
     * @param {String} setName name of the set to manipulate
     * @param {String} copyName name of the set member to be copied
     * @param {String} newName new set member name
     */
    ScenarioConfiguration.copySetMember = function(type, multiYearScenario, setName, copyName, newName){
      var subModelDefinition = multiYearScenario.years[0].config.modeldefinition;
      newName = makeSetElementNameUnique(type, multiYearScenario.years[0], setName, newName || copyName);
      var copy;
      var cbSet = function (setData) {
        if(!copy){
          copy = DataStructures.deepCopy(setData.values[copyName]);
        }
        setData.names.push(newName);
        setData.values[newName] = copy;
      };
      var cbRow = function (table) { table[newName] = DataStructures.deepCopy(table[copyName]); };
      var cbColumn = function (row) { row[newName] = DataStructures.deepCopy(row[copyName]); };

      _.each(multiYearScenario.years,function(scenario) {
        dotoSetMember(type, scenario, setName, cbSet, cbRow, cbColumn);
        // change entry in all supersets
        var superSets = ScenarioDefinitions.getDefinition(type, subModelDefinition, 'sets', setName).supersets;
        for (var i = 0; i < superSets.length; i++) {
          dotoSetMember(type, scenario, superSets[i], cbSet, cbRow, cbColumn);
        }
        var subSets = ScenarioDefinitions.getDefinition(type, subModelDefinition, 'sets', setName).subsets;
        for (i = 0; i < subSets.length; i++) {
          var ss = subSets[i];
          var index = scenario.sets[ss].names.indexOf(copyName); // the index of this element in the subset will probably be different
          if (index !== -1) { // we found the subset the element was originally defined in
            dotoSetMember(type, scenario, ss, cbSet, cbRow, cbColumn);
          }
        }
      });
    };

    /**
     * Add a new set member, use default values for all dependant parameters.
     * @param {String} type type of the simulation model
     * @param {Object} scenario scenario configuration for multiple years
     * @param {String} setName name of the set to manipulate
     * @param {String} newName new set member name
     */
    ScenarioConfiguration.addSetMember = function (type, multiYearScenario, setName, newName){
      var subModelDefinition = multiYearScenario.years[0].config.modeldefinition;
      _.each(multiYearScenario.years,function(scenario){
        function createDefaultRow(tableDef){
          var columnNames = scenario.sets[tableDef.dependencies[COLUMN]].names;
          var row = {};
          for (var i = 0; i < columnNames.length; i++) {
            row[columnNames[i]] = {
              value: getDefaultValue(tableDef, scenario.config.simulationlength)
            };
          }
          return row;
        }
        if(!newName) {
          newName = setName + counter++;
        }
        var entry = {}; // needs to be defined in the outer scope, so it can be reused for later calls to cbSet for supersets
        var cbSet = function (setData, setDefinition) {
          setData.names.push(newName);
          // only add attributes if this set is a "leaf", i.e. it does not have any subsets
          if(setDefinition.subsets.length === 0) {
            // add default values for all own and inherited attributes
            var attributes = collectAllAttributes(ScenarioDefinitions.getDefinition(type, subModelDefinition, 'sets'), setDefinition);
            for (var i = 0; i < attributes.length; i++) {
              var attr = attributes[i];
              entry[attr.name] = {
                value: getDefaultValue(attr, scenario.config.simulationlength)
              };
            }
          }
          setData.values[newName] = entry;
        };
        var cbRow = function (table, tableDef) {
          table[newName] = createDefaultRow(tableDef); };
        var cbColumn = function (row, tableDef) { row[newName] = {value: getDefaultValue(tableDef, scenario.config.simulationlength)}; };
        dotoSetMember(type, scenario, setName, cbSet, cbRow, cbColumn);
        // change entry in all supersets
        var superSets = ScenarioDefinitions.getDefinition(type, subModelDefinition,'sets',setName).supersets;
        for(var i = 0;i < superSets.length;i++){
          dotoSetMember(type, scenario, superSets[i], cbSet, cbRow, cbColumn);
        }
      });
    };


    /**
     * Rename a set member or delete it if no new name is given as parameter.
     * @param {String} type type of the simulation model
     * @param {Object} scenario scenario configuration
     * @param {String} setName name of the set to manipulate
     * @param {Number} index numeric index of the set member to be changed
     * @param {String || null} newName new set member name or null if it should be deleted
     */
    ScenarioConfiguration.changeSetMember = function (type, multiYearScenario, setName, index, newName){
      var subModelDefinition = multiYearScenario.years[0].config.modeldefinition;
      _.each(multiYearScenario.years,function(scenario){
        var idx = index;
        var oldName = null, ss, i;
        var setElement;
        var cbSet = function (setData) {
          oldName = setData.names[idx];
          // update set member attributes
          if (newName) {
            if(!setElement){
              setElement = setData.values[oldName];
            }
            setData.values[newName] = setElement;
            setData.names[idx] = newName;
          } else {
            setData.names.splice(idx, 1);
          }
          delete setData.values[oldName];
        };
        var cbRow = function (table) {
          // if we are deleting entries, newName is undefined
          // if this set gets references in multiple years (which happens if the ui specification says, we can't
          // change this table in successive years) it will already be changed in the first year
          // in this case when renaming entries in successive years the old property is already gone.
          if (newName && table[oldName] !== undefined) {
            table[newName] = table[oldName];
          }
          delete table[oldName];
        };
        var cbColumn = function (row) {
          // see explanation in cbRow
          if (newName && row[oldName] !== undefined) {
            row[newName] = row[oldName];
          }
          delete row[oldName];
        };
        dotoSetMember(type, scenario, setName, cbSet, cbRow, cbColumn);
        // change entry in all super-/subsets
        var superSets = ScenarioDefinitions.getDefinition(type, subModelDefinition,'sets', setName).supersets;
        var subSets = ScenarioDefinitions.getDefinition(type, subModelDefinition,'sets', setName).subsets;
        for (i = 0; i < superSets.length; i++) {
          ss = superSets[i];
          idx = scenario.sets[ss].names.indexOf(oldName); // the index of this element in the superset will probably be different
          dotoSetMember(type, scenario, ss, cbSet, cbRow, cbColumn);
        }
        for (i = 0; i < subSets.length; i++) {
          ss = subSets[i];
          idx = scenario.sets[ss].names.indexOf(oldName); // the index of this element in the subset will probably be different
          dotoSetMember(type, scenario, ss, cbSet, cbRow, cbColumn);
        }
      });
      return newName;
    };
    /**
     * Delete a set member.
     * @param {String} type type of the simulation model
     * @param {Object} scenario scenario configuration
     * @param {String} setName name of the set to manipulate
     * @param {integer} memberIndex numeric index of the set member to be changed
     */
    ScenarioConfiguration.removeSetMember = function (type, scenario, setName, memberIndex){
      return ScenarioConfiguration.changeSetMember(type, scenario, setName, memberIndex);
    };


    ScenarioConfiguration.isGloballyUnique = function(type, scenario, setName, index, newName){
      var def = ScenarioDefinitions.getDefinition(type, scenario.config.modeldefinition, 'sets', setName);
      for (var s in scenario.sets) {
        var names = scenario.sets[s].names;
        var isSuperSet = def.supersets.indexOf(s) !== -1;
        var isSubSet = def.subsets.indexOf(s) !== -1;
        for (var i = 0; i < names.length; i++) { // TODO name may be present in a subset!
          var name = names[i];
          if(name !== newName){ // different element name
            continue;
          }
          if(s === setName && index !== i){ // same set, different element
            return false;
          }
           if(s !== setName && (!isSuperSet || !isSubSet)){ // different set, no super set, no subset, same element
            return false;
          }
        }
      }
      return true;
    };
  });
