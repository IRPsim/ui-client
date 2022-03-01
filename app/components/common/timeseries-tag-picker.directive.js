'use strict';

angular.module('uiCommon')
  .directive('timeseriesTagPicker', function ($http) {

    return {
      restrict: 'E',
      templateUrl: 'components/common/timeseries-tag-picker.html',
      require: 'ngModel',
      scope: {
        placeholder: '@'
      },
      link: function(scope, element, attrs, ngModel) {

        scope.$watch('selectedTags', function(newTags) {

          if(!angular.isDefined(newTags)) {
            return;
          }

          var temp = [];
          for(var i = 0; i < newTags.length; i++) {
            temp.push(newTags[i].text);
          }

          ngModel.$setViewValue(temp);
        }, true);

        scope.query = function (queryString) {
          return $http.get('/backend/simulation/timeseries?maxcount=10&seriesname=' + encodeURIComponent(queryString));
        };
      }
    };
  });
