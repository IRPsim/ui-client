'use strict';

/**
 * @ngdoc directive to edit sets in a tabset
 * @name irpsimApp.directive:setAttributesTab
 * @description
 * # download
 */
angular.module('irpsimApp')
  .directive('setAttributesTab', function ($timeout) {
    return {
      restrict: 'E',
      templateUrl: 'components/scenario-editor/editor-elements/editsettabset.html',
      scope: true,
      link: function (scope) {

        scope.tabs = [];
        scope.onTabSelected = function(){
          // notify charts after this digesting cycle has finished, enable them to rerender themselves
          $timeout(function(){scope.$broadcast('visible');});
        };

        scope.$watch('set', function(set){
          if(set){
            scope.tabs = [];
            for (var i = 0; i < set.names.length; i++) {
              scope.tabs.push({active:i===0});
            }
          }
        });

        scope.addMember = function(){
          scope.addSetMember(scope.definition.name);
          scope.tabs.push({active:true});
        };
      }
    };
  });
