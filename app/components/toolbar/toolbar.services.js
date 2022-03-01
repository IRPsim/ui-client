'use strict';

angular.module('irpsimApp.toolbar').factory('toolbarServices', toolbarServices);

/* @ngInject */
function toolbarServices($http, growl, $log) {

  return {
    getModelDefinitions: getModelDefinitions
  };

  function getModelDefinitions() {
    return $http.get('/backend/simulation/modeldefinitions').then(success).catch(failure);

    function success(response) {
      return response.data;
    }

    function failure(error) {
      growl.error('Fehler beim Laden in toolbar.services');
      $log.debug('Error: ' + error);
      return [];
    }
  }
}
