'use strict';
angular.module('irpsimApp')
  .directive('graph', function ($timeout, Graph) {
    return {
      restrict: 'E',
      scope: {
        scenario: '<',
        graphSpec: '<',
        modelType: '@'
      },
      templateUrl: 'components/scenario-editor/graph/graph.html',
      link: function (scope) {
        scope.id = 'id'+Math.random();

        scope.getIconDataURL = function(iconPath){
          return Graph.getIconDataURL(scope.modelType, iconPath, scope.scenario.config.modeldefinition);
        };
        scope.getShapeDataURL = Graph.getShapeDataURL;
        scope.getDefaultValue = Graph.getDefaultValue;

        scope.toggle = function(type){
          Graph.toggle(scope.graphState, type);
        };

        function createOrUpdateNetwork(state) {
          if(scope.network){
            scope.network.setData(state);
          }else {
            scope.network = new vis.Network(
              document.getElementById(scope.id),
              state,
              {
                interaction: {
                  hover: true
                }
              });
          }
        }

        scope.$watch('graphSpec', function(graphSpec){
          if(graphSpec && scope.graphState && scope.scenario){
            var state = scope.graphState = Graph.createNetwork(scope.modelType, scope.scenario, scope.graphSpec);
            createOrUpdateNetwork(state);
          }
        });

        scope.$watch('scenario', function (scenario) {
          if(scenario) {
            var state = scope.graphState = Graph.createNetwork(scope.modelType, scenario, scope.graphSpec);
            createOrUpdateNetwork(state);
          }
        },true); // we need to watch for any changes in this nested data structure to be able to update our chart if the user renames anything or adds/removes connections

        scope.$on('$destroy', function(){
          if (scope.network) {
            scope.network.destroy();
          }
        });
      }
    };
  });
