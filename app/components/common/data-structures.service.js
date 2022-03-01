'use strict';

/**
 * @ngdoc service
 * @name irpsimApp.DataStructures
 * @description
 * # DataStructures
 * Service in the irpsimApp.
 */
angular.module('irpsimApp')
  .service('DataStructures', function () {
    var DataStructures = this;

    /**
     * Creates a deep copy of obj by serializing and deserializing to a JSON string.
     * If you need something more sophisticated although much slower, use angular.copy.
     * Beware: All attributes that start with a $ will be deleted from the copy!
     * @param {Object} obj object to copy
     */
    DataStructures.deepCopy = function(obj){
      var copied = JSON.parse(JSON.stringify(obj));
      for (var key in copied) {
        // we must not copy angular's special marker fields, they all start with a $
        if(key.length>0 && key[0]==='$'){
          delete copied[key];
        }
      }
      return copied;
    };

    function traverseDepthFirst(obj, isDone, path){
      _.forOwn(obj, function(value, key){
        var newPath = path? path.slice():[];
        newPath.push(key);
        if(isDone(value, key, newPath)){
          return;
        }else {
          if (typeof value === 'object') {
            traverseDepthFirst(value, isDone, newPath);
          }
        }
      });
    }
    DataStructures.traverseDepthFirst = function(obj, isDone){
      return traverseDepthFirst(obj,isDone,[]);
    };
  });
