'use strict';

angular.module('irpsimApp')
  .controller('sensitivityConfigCtrl', function ($scope, $uibModalInstance, Sensitivity, scenario, modelType, description) {

    $scope.numSimulations = 1;
    $scope.numParameters = 0;

    var locations = [];
    _.forEach(scenario, function (scen) {
      var params = Sensitivity.findParameterLocations(scen);
      locations.push(params);
      $scope.numParameters = $scope.numParameters + params.length;
    });

    $scope.steps = 2;
    $scope.variationType = 'lockstep';

    $scope.$watch(function(){
      return [$scope.steps, $scope.variationType];
    }, function(arr){
      var steps = arr[0], type = arr[1];
      $scope.numSimulations = Math.max(1, (type === 'cross') ? Math.pow(steps, $scope.numParameters) : steps);
    }, true);


    $scope.cancel = function () {
      $uibModalInstance.dismiss('cancel');
    };

    /**
     * create all combinations of parameters, start simulations
     * use the cartesian product or just equidistant steps
     */
    $scope.submit = function() {
      if($scope.form.$valid) {
        var promise = Sensitivity.createAndStartScenarios(scenario, locations, $scope.variationType, $scope.steps, modelType, description);
        $uibModalInstance.close(promise);
      }
    };
});
