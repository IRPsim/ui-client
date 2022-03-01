'use strict';
angular.module('irpsimApp')
  .directive('graphImage', function ($http, ScenarioConfiguration, Simulations) {
    return {
      restrict: 'E',
      scope: {
        scenario: '=',
        type: '<',
        element: '='
      },
      templateUrl: 'components/scenario-editor/graph-image/graph-image.html',
      link: function (scope) {
        /**
         * Get the graph image for a given scenario
         */
        function init() {
          scope.graphImageGenerating = true;

          var scenarioToConvert = {
            years: [
              scope.scenario
            ]
          };

          var request = undefined

          if (scope.element.image === 'agentGraph') {
            var convertedScenario = ScenarioConfiguration.convertBetweenApiAndEditableVersion(scope.type, scenarioToConvert, 'input', false);
            request = {
              method: 'POST',
              url: '/backend/simulation/graphviz/initGraphPNG',
              header: '{ "Content-Type": "application/json" }',
              responseType: 'blob',
              data: convertedScenario[0]
            };
          } else {
            // TODO: get modelindex and year
            var imageName = scope.element.image;
            var simulationId = Simulations.currentSimulation.state.id;
            var modelIndex = 0; // TODO: Always 0 except opt-act (multimodels)
            var year = scope.scenario.config.year.value;

            request = {
              method: 'GET',
              url: '/backend/simulation/simulations/' + simulationId + '/' + year + '/' + modelIndex + '/' + imageName,
              responseType: 'blob'
            };
          }

          if (request) {
            $http(request).then(function (res) {
              // Use FileReader to generate a data url from the response image
              var reader = new FileReader();
              reader.readAsDataURL(res.data);

              reader.onloadend = function () {
                scope.graphImageGenerating = false;
                scope.graphImage = reader.result;
              }
            }, function (error) {
              console.log(error);
              scope.graphImageGenerating = false;
            })
          }
        }

        /**
         * Provide functionality to the zoom in and out buttons
         * @param {*} type zoom in or out
         */
        scope.zoom = function (type) {
          var image = document.getElementById('graph-image');
          var imageWidth = image.clientWidth;

          if (type === 'out') {
            image.style.width = imageWidth - 100 + 'px';
          } else if (type === 'in') {
            image.style.width = imageWidth + 100 + 'px';
          }
        };

        /**
         * Provide functionality to the download button
         */
        scope.downloadImage = function () {
          // Generate a link and click it to initiate the image download
          var downloadLink = document.createElement('a');
          downloadLink.href = scope.graphImage;
          downloadLink.download = 'image.png';
          downloadLink.click();
        };

        scope.$watch('element', function(newElement){
          scope.graphImage = undefined;
          init();
        });

        // Run the init() function on load
        init();
      }
    }
  });
