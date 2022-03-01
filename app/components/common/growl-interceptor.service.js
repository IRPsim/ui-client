'use strict';

angular.module('irpsimApp')
  .provider('growlInterceptorWithoutErrors', function() {

    var _messagesKey = 'messages';

    this.$get = function($q, Logger){

      function checkResponse(response) {
        if (response !== undefined && response.data[_messagesKey] && response.data[_messagesKey].length > 0) {
            if (response.config.url.startsWith('/backend/simulation/datensatz?id=')) { // don't show error messages for this request
            } else {
                Logger.addServerLog(response, _messagesKey);
            }
        }
      }

      return {
        'response': function (response) {
          checkResponse(response);
          return response;
        },
        'responseError': function (rejection) {
          checkResponse(rejection);
          return $q.reject(rejection);
        }
      };

    };

    return this;

  });
