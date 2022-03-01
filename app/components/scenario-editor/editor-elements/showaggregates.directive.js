'use strict';

/**
 * @ngdoc directive to show aggregate results
 * @name irpsimApp.directive:showAggregates
 * @description
 * # download
 */
angular.module('irpsimApp')
  .directive('showAggregates', function ($filter, Simulations) {
    return {
      restrict: 'E',
      scope: {
        aggregates: '<',
        definition: '<'
      },
      templateUrl: 'components/scenario-editor/editor-elements/showaggregates.html',
      link: function (scope) {

        scope.Simulations = Simulations;

        scope.isRelative = true;

        scope.toggleRelative = function(){
          scope.isRelative = !scope.isRelative;
        };

        scope.$watch('aggregates',function(newValue){
          scope.isArray = _.every(newValue,function(v){return Array.isArray(v);});
        }, true);

        scope.getAggregateLabel = function (label) {
          return {
            'sum': 'Summe',
            'min': 'Minimum',
            'max': 'Maximum',
            'avg': 'Durchschnitt'
          }[label];
        };

        var formatNumber = $filter('significantNumber');

        scope.getRenderValue = function(index, value, property, isRelative){
          if(index === 0){
            return formatNumber(value, 2);
          }else if(isRelative){
            var relValue = value - scope.aggregates[property][0];
            var renderValue = formatNumber(relValue, 2);
            if (relValue > 0){
              return '+' + renderValue;
            }else{
              return renderValue;
            }
          }else{
            return formatNumber(value, 2);
          }
        };
        scope.relativeValueStyle = function(index, value, property){
          var style = {
            'text-align': 'right',
            'color': 'black',
            'cursor': scope.isArray? 'pointer':'inherit'
          };
          var relative =  value - scope.aggregates[property][0];
          if(!scope.isRelative){
            return style;
          }else if(relative < 0) {
            style.color='red';
          }else if (relative > 0){
            style.color = 'green';
          }
          return style;
        };
      }
    };
  });
