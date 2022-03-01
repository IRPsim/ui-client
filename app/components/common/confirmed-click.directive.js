'use strict';

/**
 * @ngdoc service
 * @name irpsimApp.ngConfirmedClick
 * @description
 * # ngConfirmedClick
 * Like ng-click but with user provided explicit confirmation via a modal dialog
 */
angular.module('irpsimApp')
  .directive('ngConfirmedClick', ['$uibModal',function($uibModal) {

      return {
        restrict: 'A',
        scope:{
          ngConfirmedClick:'&',
          ngConfirmedClickMessage: '@'
        },
        link: function(scope, element) {
          element.bind('click', function() {
            var message = scope.ngConfirmedClickMessage || 'Sind Sie sicher?';

            var modalInstance = $uibModal.open({
              // Beware: we directly inject the given text into html, no escaping whatsoever will happen!
              template: '<div class="modal-body">' + message + '</div>' +
               '<div class="modal-footer"><button class="btn btn-primary" ng-click="ok()">Ja</button><button class="btn btn-danger" ng-click="cancel()">Abbrechen</button></div>',
              controller: ['$scope','$uibModalInstance',function($scope, $uibModalInstance) {
                $scope.ok = function () {
                  $uibModalInstance.close();
                };

                $scope.cancel = function () {
                  $uibModalInstance.dismiss('cancel');
                };
              }]
            });
            modalInstance.result.then(function() {
              scope.ngConfirmedClick();
            }, angular.noop);
          });
        }
      };
    }]);
