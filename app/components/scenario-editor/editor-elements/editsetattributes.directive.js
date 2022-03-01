'use strict';

/**
 * @ngdoc directive to edit sets with attributes
 * @name irpsimApp.directive:editSetAttributes
 * @description
 * # download
 */
angular.module('irpsimApp')
  .directive('editSetAttributes', function (ScenarioDefinitions, ChartDefaultOptions) {
    return {
      restrict:'E',
      templateUrl: 'components/scenario-editor/editor-elements/editsetattributes.html',
      scope: true,
      link:function (scope) {
        if (scope.print){
          scope.uiStyle = 'print';
        } else {
          scope.uiStyle = 'tabs';
        }

        scope.chartOptions = ChartDefaultOptions;

        var stateTransitions = {
          tabs: 'twoTabs',
          twoTabs: 'table',
          table: 'tabs'
        };
        scope.toggleUIStyle = function(){
          scope.uiStyle = stateTransitions[scope.uiStyle];
        };


        scope.getTableTitle = function(tableName){
          var definition = ScenarioDefinitions.getDefinition(scope.type, scope.scenario.config.modeldefinition, 'tables', tableName);
          return definition.identifier;
        };

        scope.findAttributeDefinition = function(attribute){
          return ScenarioDefinitions.getDefinition(scope.type, scope.scenario.config.modeldefinition, 'attributes',attribute.name);
        };

        var updateState = function(){
          scope.set = scope.scenario.sets[scope.selectedElement.set]; // TODO might be a subset while all results are present in a superset
          scope.definition = ScenarioDefinitions.getDefinition(scope.type, scope.scenario.config.modeldefinition, 'sets', scope.selectedElement.set);
        };
        scope.$watch('selectedElement.set', function(s){
          if(s) {
            updateState();
          }
        });
        scope.$watch('scenario', function(s){
          if(s){
            updateState();
          }
        });
      }
    };
  });
