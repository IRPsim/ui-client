'use strict';

/**
 * @ngdoc service
 * @name irpsimApp.BackendVersionCache
 * @description
 * # BackendVersionCache
 * Service in the irpsimApp.
 */
angular.module('irpsimApp')
  .service('BackendVersionCache', function ($http, localStorageService) {
    var BackendVersionCache = this;
    var KEY = 'backendversion';

    BackendVersionCache.loadServerVersions = function () {
      return $http.get('/backend/simulation/generalinformation/versions', {cache: true}).then(function (resp) {
        var oldVersion = BackendVersionCache.getVersion();
        var newVersion = resp.data[KEY];
        if (newVersion !== oldVersion) {
          localStorageService.clearAll();// delete all old cached data
        }
        localStorageService.set(KEY, newVersion);
        return resp.data;
      });
    };
    BackendVersionCache.getVersion = function(){
      return localStorageService.get(KEY);
    };

    BackendVersionCache.createKey = function(key){
      var modelVersion = localStorageService.get(KEY);
      if(modelVersion){
        key = modelVersion + '-' + key;
      }
      return key;
    };

    BackendVersionCache.load = function(key){
      return localStorageService.get(key);
    };

    BackendVersionCache.store = function(key, value){
      return localStorageService.set(key, value);
    };

    BackendVersionCache.clear = function(){
      localStorageService.clearAll();
    };
  });
