'use strict';

angular.module('irpsimApp').factory('timeSeriesEditorService', timeSeriesEditorService);

function timeSeriesEditorService($http, $log) {
  var service = {
    getStammDatenName: getStammDatenName
  };
  return service;

  function getStammDatenName(id) {
    return $http.get('/backend/simulation/datensatz?id=' + id).then(success).catch(failure);

    function success(response) {
      return getStammDatenWithId(response.data[0].stammdatum);
    }

    function failure() {
      return 'Default Datensatz';
    }
  }

  function getStammDatenWithId(id) {
    return $http.get('/backend/simulation/stammdaten/' + id).then(success).catch(failure);

    function success(response) {
      return response.data.name;
    }

    function failure() {
      return 'Default Datensatz';
    }
  }

}
