'use strict';

/**
 * @ngdoc directive to
 * @name irpsimApp.directive:scenarioPrinter
 * @description
 * #
 */
angular.module('irpsimApp')
  .directive('scenarioPrinter', function ($q, ScenarioDefinitions) {
    return {
      restrict: 'E',
      scope: {
        scenario: '=',
        dummyScenario: '=dummy',
        uiStructure: '=',
        title: '@',
        type: '@',
        tag: '@',
        print: '='
      },
      templateUrl: 'components/scenario-editor/scenario-printer.html',
      controller: function ($scope) {
        $scope.leafElements = [];
        var breadcrumb = []; //contains breadcrumb strings
        $scope.isforprint = true;

        function flattenUiStructure(tree) {
          for (var i = 0; i < tree.length; i++) {
            if (tree[i].children.length > 0) {
              breadcrumb.push(tree[i].label + ' / ');
              flattenUiStructure(tree[i].children);
            }
            else {
              breadcrumb.push(tree[i].label);
              tree[i]['breadcrumb'] = breadcrumb.slice();
              // extract the year to match specific scenario
              // use -1 to match dummy scenario
              if (breadcrumb[0] === 'Gesamtergebnis / '){
                tree[i].year = -1;
              } else {
                tree[i].year = +(breadcrumb[0].slice(-8,-4));
              }
              $scope.leafElements.push(tree[i]);
            }
            breadcrumb.pop();
          }
        }
        $scope.$watch('uiStructure', flattenUiStructure);

        $scope.getDefinition = function(element){
          return ScenarioDefinitions.getDefinition($scope.type, $scope.scenario.years[0].config.modeldefinition, element.type, element.name);
        };

      }
    };
  });
