'use strict';

/**
 * @ngdoc directive to
 * @name irpsimApp.directive:hierarchyElement
 * @description
 * #
 */
angular.module('irpsimApp')
  .directive('hierarchyElement', function (ChartDefaultOptions, ScenarioDefinitions, Datasets) {
    return {
      restrict: 'E',
      scope: true,
      templateUrl: 'components/scenario-editor/hierarchyelement.html',
      link: function (scope, element, attributes) {
        scope.chartOptions = angular.copy(ChartDefaultOptions);

        /* We currently use non-isolated scopes to edit optimization scenarios.
           TODO We need to refactor to exclusively use isolated scopes!
           Until then we need this hack to be able to explicitely NOT use a
           reference to selectedElement or scenario from our parent scope
           but rather to an explicitely defined value (needed for the pinned tree selection feature).
           Story: https://www.pivotaltracker.com/story/show/141768719
         */
        if(attributes.selectedElement) {
          scope.$watch(function() {
            // for details see http://stackoverflow.com/a/23846622
            return scope.$parent.$eval(attributes.selectedElement);
          },function(se){
            scope.selectedElement = se;
          });
        }
        if(attributes.scenario) {
          scope.$watch(function() {
            return scope.$parent.$eval(attributes.scenario);
          },function(sc){
            scope.scenario = sc;
          });
        }

        scope.getSetNames = function (setName) {
          return scope.scenario.sets[setName].names;
        };


        var findAttributeAggregates = function(setName, setMemberName,attributeName){
          var res = _.get(scope.scenario, ['postprocessing', 'sets', setName, setMemberName, attributeName]);
          if(res){
            return res;
          }else {
            var d = ScenarioDefinitions.getDefinition(scope.type, scope.scenario.config.modeldefinition, 'sets',setName);
            if (d.supersets.length > 0) {
              for (var i = 0; i < d.supersets.length; i++) {
                var ss = d.supersets[i];
                res = findAttributeAggregates(ss, setMemberName, attributeName);
                if (res) {
                  return res;
                }
              }
            }
          }
        };

        function getSetNamesSafely(setName){
          if(scope.scenario && scope.scenario.sets){
            var s = scope.scenario.sets[setName];
            if(s && s.names){
              return s.names;
            }
          }
          return [];
        }
        function getTableDataSafely(scenario, tableName){
          return ((scenario.tables || {})[tableName] || {}).value;
        }

        function findSetIndex(setName,deps) {
          var idx;
          var setNames = [setName];
          while (setNames.length > 0) {
            setName = setNames[0];
            idx = _.indexOf(deps, setName);
            if (idx !== -1) {
              break;
            }
            setNames.shift(); // remove first entry
            // next, try all supersets
            setNames = setNames.concat(ScenarioDefinitions.getDefinition(scope.type, scope.scenario.config.modeldefinition, 'sets', setName).supersets);
          }
          return idx;
        }

        scope.$watch('selectedElement', function(se){
          if(!_.get(se,'contents')){
            return;
          }

          scope.tables = _(se.contents)
            .filter(scope.definitionWithoutData(se,['tables']))
            .map(function(table){
              var tableName = table.name;
              var definition = ScenarioDefinitions.getDefinition(scope.type, scope.scenario.config.modeldefinition, 'tables',tableName);
              var deps = definition.dependencies;
              // search for correct set, either the current set or any superset
              var idx = findSetIndex(scope.selectedElement.set, deps);
              var otherSetName = deps[1-idx];
              var otherSetsNames = getSetNamesSafely(otherSetName);
              var thisSetsNames = getSetNamesSafely(se.set);
              return {
                thisSetsNames: thisSetsNames,
                otherSetsNames: otherSetsNames,
                otherSet: otherSetName,
                data: getTableDataSafely(scope.scenario, tableName), // in results the table might be temporarily unavailable
                definition: definition,
                ui: table
              };
            })
            .value();
        });
        scope.isTableFiltered = function(table){
          return table.ui.filtered === false;
        };

        scope.index1 = function(table, thisSetsName, otherSetsName){
          var idx = findSetIndex(scope.selectedElement.set, table.definition.dependencies);
          if(idx === 0){
            return thisSetsName;
          }else{
            return otherSetsName;
          }
        };

        scope.index2 = function(table, thisSetsName, otherSetsName){
          var idx = findSetIndex(scope.selectedElement.set, table.definition.dependencies);
          if(idx === 0){
            return otherSetsName;
          }else{
            return thisSetsName;
          }
        };
        function isValue(value){
          return value !== null && value !== undefined;
        }
        /**
         * AngularJS filter function for table objects (see return values of scope.tables). Tests,
         * if there is any entry in a table for a given column. Useful to hide table parameters without
         * data.
         * @param {String} setElementName name of the column
         * @returns {Function} AngularJS filter function
         */
        scope.tableHasAnyDataFor = function(setElementName){
          return function(table){
            var deps = table.definition.dependencies;
            var idx = findSetIndex(scope.selectedElement.set, deps);
            var othersetNames = scope.scenario.sets[deps[1-idx]].names;
            return _.some(othersetNames, function(othersetname){
              return isValue(_.get(table.data,[scope.index1(table,setElementName,othersetname),scope.index2(table,setElementName,othersetname),'value']));
            });
          };
        };

        scope.tableHasData = function(table,thisSetsName){
          return function(otherSetsName) {
            var key1 = scope.index1(table,thisSetsName,otherSetsName);
            var key2 = scope.index2(table,thisSetsName,otherSetsName);
            var location = [key1,key2];
            return isValue(_.get(scope.findAggregates(table.ui),location) || _.get(table.data,location));
          };
        };

        scope.hasAnyAttributeOrTable = function(setElementName){
          var attrFn = scope.definitionWithoutData(scope.selectedElement,['attributes'],setElementName);
          var tableFn = scope.tableHasAnyDataFor(setElementName);
          return _.some(scope.selectedElement.contents,attrFn) || _.some(scope.tables, tableFn);
        };

        /**
         * Find the attribute object of the given attribute of a set element. Might be defined on a superset, though.
         * @param {String} setElement
         * @param {String} attributeName
         * @param {String} set
         * @returns {*}
         */
        scope.findSetAttribute = function(setName, setElement, attributeName){
          var ss = ScenarioDefinitions.getDefinition(scope.type, scope.scenario.config.modeldefinition, 'sets', setName).supersets;
          var valueObj = _.get(scope.scenario.sets[setName] || scope.set,['values',setElement,attributeName]);
          if(valueObj){
            return valueObj;
          }else if(ss.length > 0){
            for (var i = 0; i < ss.length; i++) {
              var superset = ss[i];
              valueObj = scope.findSetAttribute(superset, setElement, attributeName);
              if(valueObj){
                return valueObj;
              }
            }
          }else{
            return null;
          }
        };

        /**
         * Each attribute or timeseries may have aggregated data in the results (obj. with min,max,avg values).
         * Since attributes may be inherited from supersets we need to search the set hierarchy for these
         * aggregation objects.
         * @param {Object} selectedElement
         * @param {String} setMemberName
         * @returns {*} aggregate data if available
         */
        scope.findAggregates = function (selectedElement, setMemberName) {
          var type = selectedElement.type;
          if (type === 'attributes') {
            var d = ScenarioDefinitions.getDefinition(scope.type, scope.scenario.config.modeldefinition, 'attributes',selectedElement.name);
            var setName = d.dependencies[d.dependencies.length -1];
            return findAttributeAggregates(setName, setMemberName, selectedElement.name);
          }
          if (type === 'timeseries') {
            type = 'scalars';
          }
          return _.get(scope.scenario,['postprocessing',type,selectedElement.name]);
        };

        /**
         * We don't want to render labels, tables etc. for missing scenario values.
         * This function creates a filter function that can be used by ng-repeat filters
         * to select rows to render.
         * @param {object} selectedElement obj with members 'name' and 'contentType'
         * @param {object} contentTypes valid content types
         * @param {String} setElementName optionally specify the name of the specific set element
         * @returns {Function} filter function that returns truthy if an element should get renderered
         */
        scope.definitionWithoutData = function(selectedElement, contentTypes, setElementName){
          // the result of postprocessing a timeseries is a scalar
          // so we need to map the contentTypes if we try to locate a postprocessing element
          var type2PPType = {
            'sets': 'sets',
            'attributes':'attributes',
            'tables':'tables',
            'timeseries':'scalars',
            'config':'config'
          };
          return function(contentElement){
            if(contentElement.filtered){
              return false;
            }
            for (var i = 0; i < contentTypes.length; i++) {
              var contentType = contentTypes[i];
              if(contentType !== contentElement.type){
                continue;
              }
              switch(contentType){
                case 'image':
                  return true;
                case 'graph':
                  return true;
                case 'multiChart':
                  return true;
                case 'attributes': // FIXME aggregations for set element attributes may be present in supersets! (bilanzierung/kundenseite/einzeluebersicht)
                  // is there any related postprocessing element?
                  var pp = scope.tag === 'output' && _.get(scope.scenario.postprocessing,['sets',selectedElement.set]);
                  return pp || scope.findSetAttribute(selectedElement.set, setElementName, contentElement.name);
                default:
                  if (contentElement.name === 'savelength' ||
	              contentElement.name === 'optimizationlength' ||
                      contentElement.name === 'simulationlength' ||
                  contentElement.name === 'simulationstart' ||
                  contentElement.name === 'resolution') {
                    return true;
                  }
                  return _.get(scope.scenario[contentType],contentElement.name) || //access directly
                    _.get(scope.scenario,['postprocessing',type2PPType[contentType],contentElement.name]); // or find the equivalent postprocessing item
              }
            }
            return false;
          };
        };

        scope.potentialSetElements = [];

        scope.$watch(function(){
          return _.get(scope,['multiYearScenario','years',0,'config','year','value']);
        }, function(newYear){
          if(newYear) {
            scope.potentialSetElements = Datasets.identifyVerticalPullableElements(newYear);
          }
        });

        // scope.includeSupersets = function(setName){
        //   var setNames = [setName].concat(ScenarioDefinitions.getDefinition(scope.type,'sets', setName).supersets);
        //   return function(candidate){
        //     return _.indexOf(setNames, candidate.set) !== -1;
        //   };
        // };
      }
    };
  });
