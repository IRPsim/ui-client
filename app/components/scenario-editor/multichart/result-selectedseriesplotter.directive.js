
angular.module('irpsimApp')
  .directive('resultSelectedseriesplotter', function (ResultSeriesSelector, ChartDefaultOptions) {

    return {
      templateUrl: 'components/scenario-editor/multichart/result-selectedseriesplotter.html',
      restrict: 'E',
      scope: {
        parameters: '=',
        maxLength:'='
      },
      link: function (scope) {
        scope.seriesnames = [];
        scope.options = angular.copy(ChartDefaultOptions);
        scope.options.twoaxisdisplay = true;

        //only axis = 'y1' | axis = 'y2'
        scope.setAxisForSeries = function (series, axis) {
          _.set(scope.options,'series['+series+'].axis',axis);
        };

        scope.changeSelected = function (obj) {
          obj.selected = !obj.selected;
        };

        scope.$watch('parameters', function (newValue) {
          scope.seriesnames = [];

          _.each(newValue, function (obj) {
            if (obj.selected) {
              scope.seriesnames.push(obj.value);
            }
          });
          scope.options.labels = [''].concat(scope.seriesnames);
        }, true);
      }
    };
  });
