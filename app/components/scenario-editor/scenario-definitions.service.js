'use strict';

/**
 * @ngdoc service
 * @name irpsimApp.ScenarioDefinitions
 * @description
 * # ScenarioDefinitions
 * Service in the irpsimApp.
 */
angular.module('irpsimApp')
  .service('ScenarioDefinitions', function (TimeEstimator, $http, localStorageService, $q, BackendVersionCache){
    var ScenarioDefinitions = this;

    ////////////// Metadata of scenario /////////////////////////////////////
    var definitions = {};

    function createKey(modelDefinition){
      return BackendVersionCache.createKey(modelDefinition+'-definition');
    }

    /**
     * Store metadata for this scenario type into localstorage as well as into a local variable
     * to avoid the cost of derserializing a JSON string on each access.
     * @param {String} type scenario type
     * @param {Object} definition meta data of a scenario type. Has keys 'sets', 'tables', 'timeseries', 'scalars', 'attributes'
     */
    function cacheDefinition(modelDefinition, definition){
      localStorageService.set(createKey(modelDefinition),definition);
      definitions[modelDefinition] = definition;
    }

    function getDefinition(modelDefinition){
      // accessing localStorageService means parsing a JSON string each time
      // so we use an additional cache to avoid this cost
      return definitions[modelDefinition] || localStorageService.get(createKey(modelDefinition));
    }
    ScenarioDefinitions.getUIStructure = function(modelDefinition, tag, subModelDefinition) {
      return getDefinition(modelDefinition)[subModelDefinition].specifications[tag];
    };

    ScenarioDefinitions.loadDefinition = function (modelDefinition, modelDefinitionIds){
      var d = BackendVersionCache.load(createKey(modelDefinition));
      if(d){
        cacheDefinition(modelDefinition,d);
        var deferred = $q.defer();
        deferred.resolve(d);
        return deferred.promise;
      } else {
        return loadDefinitionsInternal(modelDefinition, modelDefinitionIds);
      }
    };

    ScenarioDefinitions.getModelDefinitions = function () {
      return $http.get('/backend/simulation/modeldefinitions').then(function (response) {
          return response.data;
      });
    };

    function extractAttributeDefinitions(def) {
      return _.transform(def.definitions.sets, function (o, s) {
        var attrs = s.attributes;
        for (var i = 0; i < attrs.length; i++) {
          var attr = attrs[i];
          o[attr.name] = attr;
        }
      }, {});
    }

    function loadDefinitionsInternal(modelDefinition, modelDefinitionIds) {
      if (modelDefinition === 'all') {
        return $http.get('/backend/simulation/modeldefinitions?all=true').then(function (defResponse) {

          var def = {};
          angular.forEach(defResponse.data, function (data) {
            def = angular.merge(def, data.data);
          });
          def.definitions.attributes = extractAttributeDefinitions(def);
          cacheDefinition(modelDefinition, def);
          return def.definitions;
        });
      } else {
        var promises = [];
        angular.forEach(modelDefinitionIds, function (modelDefinionId) {
          promises.push($http.get('/backend/simulation/modeldefinitions/' + modelDefinionId));
        });
        return $q.all(promises).then(function (defResponses) {
          var defObject = {};
          angular.forEach(defResponses, function (defResponse, index) {
            var def = defResponse.data;
            def.definitions.attributes = extractAttributeDefinitions(def);
            defObject[modelDefinitionIds[index]] = def;
          });
          cacheDefinition(modelDefinition, defObject);
          return defObject;
        });
      }
    }

    /**
     * For development time: Allow upload of ui specs and use them temporarily instead of the one we were served
     * by the backend.
     * @param {String} modelType type of the model
     * @param {Object} structure same type as all other specs
     */
    ScenarioDefinitions.useDevelopUIStructure = function(modelType, structure){
      structure.definitions.attributes = extractAttributeDefinitions(structure);
      definitions[modelType] = structure;
    };

     /**
     * Suche nach passender UI-Beschreibung eines Datenelementes.
     * @param {String} modelType Name der Modellvariante
     * @param {String} elementType Typ des Konstrukts (sets, tables, timeseries, scalars)
     * @param {String} name Bezeichner des konkreten Konstrukts
     * @returns {*} UI-Definition des gesuchten Objekts oder null
     */
    ScenarioDefinitions.getDefinition = function (modelDefinition, subModelDefinition, elementType, name) {
      var definition = getDefinition(modelDefinition);
      var defs = definition[subModelDefinition].definitions;
      if(!elementType){
        return defs;
      }else if(!name) {
        return defs[elementType];
      }else{
        return defs[elementType][name];
      }
    };

    ////////////// Manipulation of currently loaded parameters //////////////////////////

    function extractParameters(ui,currentSet) {
      var res = [];
      if (angular.isArray(ui)) {
        res = ui.reduce(function (arr, ui) {
          return arr.concat(extractParameters(ui, currentSet));
        }, []);
      } else if (ui.type && ui.name) {
        res.push({type: ui.type, name: ui.name, set:currentSet});
      } else if (ui.children) {
        res = res.concat(extractParameters(ui.children, ui.set || currentSet));
      } else if (ui.contents) {
        res = res.concat(extractParameters(ui.contents, ui.set || currentSet));
      } else {
        console.error('can\'t walk data structure', ui);
      }
      return res;
    }

    ScenarioDefinitions.extractUIParameters = function (modelDefinition, uiSpecType, subModelDefinition){
      return _.uniq(extractParameters(ScenarioDefinitions.getUIStructure(modelDefinition, uiSpecType, subModelDefinition)),function(p){ return ''+p.name+'/'+p.type; });
    };

    ScenarioDefinitions.getIcons = function(modelType, subModelDefinition){
      return getDefinition(modelType)[subModelDefinition].icons;
    };

  });
