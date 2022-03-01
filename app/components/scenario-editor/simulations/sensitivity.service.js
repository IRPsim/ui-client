'use strict';

angular.module('irpsimApp')
  .service('Sensitivity', function ($q, DataStructures, ScenarioDefinitions, TimeseriesFetcher, Simulations) {

    var Sensitivity = this;

    /**
     * Identify all parameters that should be varied in the next sensitivity analysis.
     * These parameters have a key 'sensitivity' in their value object with two values:
     * The mode (either multiply or add) and an array with the lower and upper factor to use.
     * We use only the first year to identify sensitivity
     * parameters, all the other years have to have the same sensitivity settings!
     *
     * @param {Object} scenario full scenario
     */
    Sensitivity.findParameterLocations = function(scenario) {
      var locations = [];
      var isSensitivityParameter = function(obj, key, path) {
        var found = (key === 'sensitivity') && Array.isArray(obj.range) && obj.range[0] !== obj.range[1];
        if(found){
          path = path.slice();
          path.splice(path.length - 1, 1);
          locations.push(path);
        }
        return found;
      };
      DataStructures.traverseDepthFirst(scenario.years[0], isSensitivityParameter);
      // since we may arrive at the same parameter via different paths (subset hierarchy)
      // we ignore the first two parts of the location ('sets'/'tables' followed by set/table name)
      // Since Javascript does not use a sane equality semantics we return a string, not a subarray
      // so the comparison kind of works...
      // Additional fix for timeseries added, because there only needs the first part to be ignored
      var uniqByLast = _.uniq(locations, function(location) {
        if (location.length) {
          if (location[0] === 'sets' || locations[0] === 'tables') {
            return JSON.stringify(location.slice(2));
          } else if (location[0] === 'timeseries') {
            return JSON.stringify(location.slice(1));
          }

          return JSON.stringify(location);
        }
      });
      return uniqByLast;
    };


    var startDate = new Date('1 1, 2015 00:00:00'), endDate = new Date('12 31, 2015 23:45:00');

    function queryValue(valueOrId,length){
      if(angular.isString(valueOrId)){
        var provider = TimeseriesFetcher.newDetailDataProvider([valueOrId]);
        return provider.fetchData(startDate, endDate, length).then(function(data){
          // remove last dummy value
          data.splice(data.length-1,1);
          var values = _.map(data,function(row){ return row[1][1]; });
          if(length === 1){
            return values[0];
          }else{
            return values;
          }
        });
      }else{
        return $q.when(valueOrId);
      }
    }
    function isScalarParameter(modelType, path, value){
      if(angular.isNumber(value)){
        return true;
      }else{
        var definition, dt;
        switch(path[0]){
          case 'timeseries': return false;
          case 'scalars': return true;
          case 'sets':
            definition = ScenarioDefinitions.getDefinition(modelType, modelType, 'attributes',path[4]); // todo gD
            dt=definition['data-type'];
            return dt[dt.length-1] !=='s';
          case 'tables':
            definition = ScenarioDefinitions.getDefinition(modelType, modelType, 'tables',path[1]); // todo gD
            dt=definition['data-type'];
            return dt[dt.length-1] !=='s';
          default:
            throw new Error('Unbekannter Parametertyp: '+path[0]);
        }
      }
    }

    /*
     Calculates a preview min/max value for a scalar.
     */
    Sensitivity.getPreviewScalar = function (scalar, modifier, mode) {

      if (mode === 'multiply') {
        return scalar * modifier;
      } else if (mode === 'add') {
        return scalar + modifier;
      }
    };

    /**
     * Create all parameter variations possible by splitting the interval `sensitivity` into `steps` different
     * segments. Multiply `value` by each factor.
     * @param {Array | Number} value
     * @param {Array} sensitivity
     * @param {Number} steps
     * @param {String} mode
     */
    function deriveModifiedValues(value, sensitivity, steps){

      var start = sensitivity.range[0], end = sensitivity.range[1];
      var extent = end - start;
      var stepSize = extent/(steps - 1); // we want steps to represent the number of values, not intervals
      return _.map(_.range(start, end+stepSize, stepSize), function(factor){
        if(angular.isNumber(value)){

          if (sensitivity.mode === 'multiply') {
            return value * factor;
          } else if (sensitivity.mode === 'add') {
            return value + factor;
          }


        }else{
          return _.map(value,function(v){

            if (sensitivity.mode === 'multiply') {
              return v * factor;
            } else if (sensitivity.mode === 'add') {
              return v + factor;
            }

          });
        }
      });
    }
    /**
     * Resolve all parameter values that will have to be changed in the derived
     * scenarios. Creates a datastructure containing the derived parameters
     * per location and year.
     *
     * @returns {Object} Object keyed by location index, containing values per parameter year
     */
    function fetchAllParameterValues(years, locations, modelType, steps){
      // create promises for all parameters that should be varied
      // for each year and each parameter, fetch data
      // store parameter path, year index, sensitivity range
      var res = [];
      var queries = [];
      _.forEach(_.range(years.length), function(yearIdx){
        _.forEach(locations, function(path,locationIdx){
          var parameter = _.get(years[0],path);
          var value = parameter.value;

          var sensitivity = parameter.sensitivity;
          var length = isScalarParameter(modelType, path,value)? 1 : years[0].config.simulationlength;
          _.set(res,[locationIdx],{
            values: [],
            path: path,
            sensitivity: sensitivity
          });

          var promise = queryValue(value,length).then(function(value){
            var derivedValues = deriveModifiedValues(value, sensitivity, steps);
            _.set(res,[locationIdx,'values',yearIdx],derivedValues);
          });
          queries.push(promise);
        });
      });
      return $q.all(queries).then(function(){
        return res;
      });
    }

    /*
     Create n^k cartesian variations of the values in each array in arrays.
     */
    function cartesianProductOf(arrays) {
      return Array.prototype.reduce.call(arrays, function(a, b) {
        var ret = [];
        a.forEach(function(a) {
          b.forEach(function(b) {
            ret.push(a.concat([b]));
          });
        });
        return ret;
      }, [[]]);
    }

    /* split all sensitivity ranges into $scope.steps individual ranges,
     then calculate the new value for each parameter
     */
    function lockstepCoordinates(arrays){
      return _.map(arrays[0],function(v,idx){
        return _.map(arrays, idx);
      });
    }

    function deriveDescription(descriptionMaster, idx, length){
      var desc = angular.copy(descriptionMaster);
      desc.businessModelDescription = desc.businessModelDescription + ' (' + (idx+1) + '/' + length + ')';
      return desc;
    }
    /**
     * Derives and starts/queues new scenarios according to the specified parameters. Returns a promise
     * with all started simulation ids.
     * @param {Object} scenario
     * @param {Object} locations
     * @param {String} variationType
     * @param {String} modelType
     * @param {Number} steps
     */
    Sensitivity.createAndStartScenarios = async function(scenario, locations, variationType, steps, modelType, descriptionMaster) {
      var objs = [];

      _.forEach(scenario, function (scen, index) {
        objs.push(fetchAllParameterValues(scen.years, locations[index], modelType, steps));
      });

      return $q.all(objs).then(function (objs) {
        var coordinatesFn = (variationType === 'lockstep') ? lockstepCoordinates : cartesianProductOf;
        var indices = _.range(steps);

        var simulationPromises = _.forEach(objs, function(obj, index) {
          var coordinates = coordinatesFn(_.times(locations[index].length, _.constant(indices)));

          _.map(coordinates, function(coords, variationIdx) {
            var scenarioCopy = angular.copy(scenario);
            scenarioCopy.description = deriveDescription(descriptionMaster, variationIdx, coordinates.length);
            _.forEach(obj,function(o, locIdx) { // has `values` and `path`
              var valueIdx = coords[locIdx];
              var path = o.path.slice();
              path.push('value');
              _.forEach(_.range(scenario[index].years.length), function(yearIdx) {
                _.set(scenarioCopy[index].years[yearIdx], path, o.values[yearIdx][valueIdx]);
              });
            });
            return Simulations.submitSimulation(modelType, scenarioCopy);
          });
        })
        return $q.all(simulationPromises).then(function(simulations){
          return simulations;
        });
      });
    };
  });
