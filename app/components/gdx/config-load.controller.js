'use strict';

angular.module('irpsimApp').controller('GdxConfigLoadCtrl', function ($scope, $mdDialog, gdxFilterService) {
  $scope.configs = {};

  this.$onInit = function () {
    gdxFilterService.loadExportConfigs().then(function (resp) {
      $scope.configs = resp;
    });
  };

  $scope.delete = function (configId) {
    gdxFilterService.deleteExportConfig(configId).then(function () {
      delete $scope.configs[configId];
    });
  };

  $scope.load = function (data) {
    $mdDialog.hide(data);
  };

  $scope.cancel = function () {
    $mdDialog.cancel();
  };

});
