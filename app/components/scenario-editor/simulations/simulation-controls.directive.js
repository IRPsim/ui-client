'use strict';

/**
 * @ngdoc directive to
 * @name irpsimApp.directive:simulationControls
 * @description
 * #
 */
angular.module('irpsimApp')
  .directive('simulationControls', function (Simulations, localStorageService, $uibModal) {
    return {
      restrict: 'E',
      templateUrl: 'components/scenario-editor/simulations/simulation-controls.html',
      scope: {
        type: '=',
        scenario: '=',
        result: '=',
        description: '='
      },
      link: function (scope) {
        scope.simulation = Simulations.currentSimulation;
        scope.options = [{
            name: 'Geschäftsmodellbeschreibung',
            id: 'businessModelDescription',
            size: 3
          }, {
            name: 'Ausprägung',
            id: 'investmentCustomerSide',
            size: 2
          }, {
            name: 'Parameteraugenmerk',
            id: 'parameterAttention',
            size: 3
          }, {
            name: 'Benutzer',
            id: 'creator',
            size: 2,
            value: localStorageService.get('creator')
          }
        ];

        scope.$watch('description', function(description){
          scope.options[0].value = description.businessModelDescription;
          scope.options[1].value = description.investmentCustomerSide;
          scope.options[2].value = description.parameterAttention;
        });


        scope.allowSimulation = false;

        scope.$watch('options', function (newVal) {
          if (!newVal) {
            return;
          }
          var temp = true;
          for (var i = 0; i < newVal.length; i++) {
            var v = newVal[i].value;
            if (!v || v.length < 1) {
              temp = false;
            }
          }
          scope.allowSimulation = temp;
        }, true);

        function getDescription() {
          var description = {};
          angular.forEach(scope.options, function (option) {
            description[option.id] = option.value;
            if (option.id === 'creator') {
              localStorageService.set(option.id, option.value);
            }
          });
          return description;
        }

        scope.submitSimulation = function () {
          scope.scenario.description = getDescription();
          Simulations.submitSimulation(scope.type, scope.scenario);
        };

        scope.cancelSimulation = function () {
          Simulations.cancelSimulation();
        };

        /**
         * Create derived scenario and start/enqueue them. Attach to the first submitted simulation.
         */
        scope.configureSensitivity = function(){
          $uibModal.open({
            templateUrl: 'components/scenario-editor/simulations/sensitivityconfig.modal.html',
            controller: 'sensitivityConfigCtrl',
            resolve: {
              type: _.constant(scope.type),
              scenario: _.constant(scope.scenario),
              modelType: _.constant(scope.type),
              description: getDescription
            }
          }).result
            .then(function(ids){
              Simulations.attachToRunningSimulation(scope.type,{id: ids[0], start: new Date()});
            });
        };
      }
    };
  });
