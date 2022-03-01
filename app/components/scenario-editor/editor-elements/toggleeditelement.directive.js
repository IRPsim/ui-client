'use strict';

/**
 * @ngdoc directive to contain arbitrary editing elements
 * @name irpsimApp.directive:editElement
 * @description
 * # download
 */
angular.module('irpsimApp')
  .directive('toggleEditElement', function () {
    return {
      restrict:'E',
      scope:{
        heading:'@',
        description:'@',
        callback: '&'
      },
      transclude: {
        'buttonSlot': '?titleButton'
      },
      templateUrl: 'components/scenario-editor/editor-elements/toggleeditelement.html',
      link: function(scope){
        scope.id = (''+Math.random()).substr(2);
      }
    };
  });
