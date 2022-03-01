'use strict';

angular.module('irpsimApp').controller('alegbraicDatasetModalCtrl', function ($scope, $uibModalInstance, stammdatum, datensatz) {

  $scope.stammdatum = stammdatum;
  $scope.datensatz = datensatz;

  $scope.close = function () {
    $uibModalInstance.close();
  };

  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
});
