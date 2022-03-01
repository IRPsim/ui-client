/**
 * @ngdoc function
 * @name irpsimApp.controller:GdxFilterCtrl
 * @description
 * # GdxFilterCtrl
 * Controller of the irpsimApp. Handles filtering of GDX files.
 */

'use strict';

angular.module('irpsimApp').factory('gdxFilterService', gdxFilterService);

function gdxFilterService($http, $log, growl) {
  var service = {
    getSetIiOptions: getSetIiOptions,
    saveExportConfig: saveExportConfig,
    loadExportConfigs: loadExportConfigs,
    deleteExportConfig: deleteExportConfig,
  };
  return service;

  /**
   * Load possible options for set_ii from the backend
   * @returns {Object} response of the request
   */
  function getSetIiOptions() {
    return $http.get('/backend/simulation/simulations/gdxresultfile/options').then(success).catch(failure);

    function success(response) {
      return response.data;
    }

    function failure(error) {
      growl.error('Fehler beim Laden der Set_II Optionen.');
      $log.debug('Error user: ' + error);
    }
  }

  /**
   * Save a simulation config on the backend
   * @param {String} name Config name
   * @param {String} creator name of the creator
   * @param {Object} data config to save
   * @returns {Object} response of the request
   */
  function saveExportConfig(name, creator, data) {
    var body = {
      'name': name, 'creator': creator, 'data': data
    };
    return $http.put('/backend/simulation/exportconfigurations', body).then(success).catch(failure);

    function success(response) {
      return response.data;
    }

    function failure(error) {
      growl.error('Fehler beim Speichern der Simulations-Konfiguration.');
      $log.debug('Error user: ' + error);
    }
  }

  /**
   * Load a simulation config from the backend
   * @returns {Object} response of the request
   */
  function loadExportConfigs() {
    return $http.get('/backend/simulation/exportconfigurations').then(success).catch(failure);

    function success(response) {
      return response.data;
    }

    function failure(error) {
      growl.error('Fehler beim Laden der Simulations-Konfiguration.');
      $log.debug('Error user: ' + error);
    }
  }

  /**
   * Delete a simulation config on the backend
   * @param {Number} configId id of the simulation config
   * @returns {Object} response of the request
   */
  function deleteExportConfig(configId) {
    return $http.delete('/backend/simulation/exportconfigurations/' + configId).then(success).catch(failure);

    function success(response) {
      return response.data;
    }

    function failure(error) {
      growl.error('Fehler beim Löschen der Simulations-Konfiguration.');
      $log.debug('Error user: ' + error);
    }
  }

}
