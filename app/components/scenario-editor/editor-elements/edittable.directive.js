
'use strict';

/**
 * @ngdoc directive to edit tables with scalar/rlm-timeseries values
 * @name irpsimApp.directive:editTable
 * @description
 * # download
 */
angular.module('irpsimApp')
  .directive('editTable', function (ScenarioDefinitions, ChartDefaultOptions) {
    return {
      restrict:'E',
      scope: true,
      templateUrl: 'components/scenario-editor/editor-elements/edittable.html',
      link:function (scope) {
        scope.chartOptions = angular.copy(ChartDefaultOptions);
        scope.chartOptions.unit = scope.definition.unit;
      }
    };
  });

