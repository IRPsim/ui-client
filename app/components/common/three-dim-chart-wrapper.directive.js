'use strict';

angular.module('irpsimApp')
  .directive('threeDimChartWrapper', function ($http) {

    return {
      template: '<three-dim-chart data="threeDimData"></three-dim-chart>',
      restrict: 'E',
      scope: { // Isolate scope
        seriesName: '=?'
      },
      link: function (scope) {

        scope.$watch('seriesName', function() {
          if(angular.isDefined(scope.seriesName)) {
            reloadData();
          }
        });

        function reloadData() {
          var url = '/backend/simulation/stammdaten/concretedata?seriesid=' + scope.seriesName;

          $http.get(url).then(function(res) {
            var data = res.data[scope.seriesName];
            var density = parseInt(35040 / data.length);

            // create 1D array
            var heights = [];

            for (var i = 0; i < data.length; i++) {
              for (var j = 0; j < density; j++) {
                heights.push(data[i].avg);
              }
            }

            scope.threeDimData = {
                startDate: new Date('2015-01-01'),
                values: heights,
                stepLength: 900000
            };
          });
        }
      }
    };
  });
