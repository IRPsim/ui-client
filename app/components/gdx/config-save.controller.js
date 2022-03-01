'use strict';

angular.module('irpsimApp').controller('GdxConfigSaveCtrl', function ($scope, $mdDialog) {
  $scope.save = {name: '', creator: ''};

  $scope.cancel = function () {
    $mdDialog.cancel();
  };

  $scope.answer = function () {
    $mdDialog.hide($scope.save);
  };

});
