'use strict';

angular.module('irpsimApp')

  .service('ResultSeriesSelector', function (ScenarioDefinitions) {

    this.getSeriesForMultipleYears = function (scenario, type, tag) {

      var subModelDefinition = scenario.years[0].config.modeldefinition;

      var allSeries = [];
      if (angular.isDefined(scenario) && angular.isDefined(scenario.years)) {
        scenario['years'].forEach(function (year) {
          allSeries = allSeries.concat(getSeriesForOneYear(year, type, tag, subModelDefinition));
        });
      }
      return _.sortBy(allSeries,'name');
    };

    function maybeAddTimeseries(allSeries, name, reference,index){
      if (reference && reference.value !== undefined && angular.isString(reference.value)) {
        var isIndexDefined = index !== undefined && index !== null;
        allSeries.push({
          name: isIndexDefined? (name+'['+index+']') : name,
          value: reference.value
        });
      }
    }
    var getSeriesForOneYear = function (year, type, tag, subModelDefinition) {
      var def, reference;
      var allSeries = [];
      for (var prop in year.timeseries) {
        def = ScenarioDefinitions.getDefinition(type, subModelDefinition, 'timeseries',prop);
        if(def.tags.indexOf(tag)!==-1) {
          if (year.timeseries.hasOwnProperty(prop)) {
            reference = year.timeseries[prop];
            if(Array.isArray(reference)){
              for (var i = 0; i < reference.length; i++) {
                maybeAddTimeseries(allSeries,prop,reference[i],i);
              }
            }else {
              maybeAddTimeseries(allSeries,prop,reference);
            }
          }
        }
      }
      for (prop in year.sets) {
        if (year.sets.hasOwnProperty(prop)) {
          def = ScenarioDefinitions.getDefinition(type, subModelDefinition, 'sets', prop);
          _(def.attributes)
            .filter(function(a){return a.tags.indexOf(tag)!==-1;})
            .each(function (attr) {
              if (attr['data-type'].charAt(attr['data-type'].length - 1) === 's') {
                var name = attr.name;
                for (var prop2 in year.sets[prop].values) {
                  if (year.sets[prop].values.hasOwnProperty(prop2)) {
                    if (year.sets[prop].values[prop2].hasOwnProperty(attr.name) && year.sets[prop].values[prop2][attr.name].value) {
                      reference = year.sets[prop].values[prop2][attr.name];
                      if(Array.isArray(reference)){
                        for (var i = 0; i < reference.length; i++) {
                          maybeAddTimeseries(allSeries,name,reference[i],i);
                        }
                      }else {
                        maybeAddTimeseries(allSeries,name,reference);
                      }
                    }
                  }
                }
              }
            }).value();
        }
      }
      for (prop in year.tables) {
        if (year.tables.hasOwnProperty(prop)) {

          def = ScenarioDefinitions.getDefinition(type, subModelDefinition, 'tables', prop);
          if (def['data-type'].charAt(def['data-type'].length - 1) === 's' && def.tags.indexOf(tag)!==-1) {
            var name = def.name;
            for (var customerGroup in year.tables[prop].value) {
              if (year.tables[prop].value.hasOwnProperty(customerGroup)) {
                for (var series in year.tables[prop].value[customerGroup]) {
                  if (year.tables[prop].value[customerGroup].hasOwnProperty(series)) {
                    reference = year.tables[prop].value[customerGroup][series];
                    if(Array.isArray(reference)){
                      for (var j = 0; j < reference.length; j++) {
                        maybeAddTimeseries(allSeries,name,reference[j],j);
                      }
                    }else {
                      maybeAddTimeseries(allSeries,name,reference);
                    }
                  }
                }
              }
            }
          }
        }
      }
      return allSeries;
    };

    this.getSeriesForOneYear = function(year, type, tag, subModelDefinition){
      return _.sortBy(getSeriesForOneYear(year,type, tag, subModelDefinition),'name');
    };

    return this;

  });
