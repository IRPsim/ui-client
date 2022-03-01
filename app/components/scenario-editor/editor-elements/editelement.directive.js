'use strict';

/**
 * @ngdoc directive to contain arbitrary editing elements
 * @name irpsimApp.directive:editElement
 * @description
 * # download
 */
angular.module('irpsimApp')
  .directive('editElement', function () {
    return {
      restrict:'E',
      scope:{
        heading:'@',
        description:'@',
        callback: '&?'
      },
      transclude: true,
      templateUrl: 'components/scenario-editor/editor-elements/editelement.html',
      link: function(scope){
        scope.id = (''+Math.random()).substr(2);
      }
    };
  });
