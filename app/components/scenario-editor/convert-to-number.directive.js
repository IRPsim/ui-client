'use strict';

/**
 * @ngdoc directive to
 * @name irpsimApp.directive:convertToNumber
 * @description
 * #
 */
angular.module('irpsimApp')
    .directive('convertToNumber', function() {
      return {
        require: 'ngModel',
        link: function(scope, element, attrs, ngModel) {
          ngModel.$parsers.push(function(val) {
            return parseInt(val, 10);
          });
          ngModel.$formatters.push(function(val) {
            return '' + val;
          });
        }
      };
    });
