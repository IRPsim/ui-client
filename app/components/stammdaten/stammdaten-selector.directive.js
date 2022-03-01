'use strict';

/**
 * @ngdoc service
 * @name irpsimApp.stammdatenSelector
 */
angular.module('irpsimApp')
  .directive('stammdatenSelector', function (Datasets) {

    return {
      restrict: 'E',
      templateUrl: 'components/stammdaten/stammdaten-selector.html',
      scope: {
        onSelect: '&',
        single: '<',
        hideAbstract: '='
      },
      link: function (scope) {

        scope.masterData = '';
        scope.data = Datasets.data;

        /*
          Filter abstract Stammdaten if desired.
         */
        if (scope.hideAbstract) {
          scope.data = _.filter(scope.data, function(item) {
            return !item.abstrakt;
          });
        }


        /*
         Loads tags for Stammdaten tags input.
         */
        scope.loadTags = function (query) {

          var data = _.map(scope.data, function (item,idx) {
            return {
              idx: idx,
              text: item.name + ' ' + item.typ + ' ' + item.bezugsjahr,
              name: item.name,
              typ: item.typ,
              bezugsjahr: item.bezugsjahr
            };
          });
          if (query && query.length > 0) {
            query = query.toLowerCase();
          }

          return _.filter(data, function (item) {
            return item.name.toLowerCase().indexOf(query) !== -1;
          });
        };

        /*
         Gets calles after a Stammdatum got selected. It triggers the onSelect function!
         */
        scope.selectMasterData = function (tags) {

          var tag = tags[0];
          var item = {};
          angular.forEach(scope.data, function (i) {
            if (i.name === tag.name && i.typ === tag.typ && i.bezugsjahr === tag.bezugsjahr) {
              item = i;
            }
          });

          scope.onSelect({stammdatum: item});
        };


        /*
         Ng-tags does (!) have a maxtags attribute, but it only sets the form validation to false.
         It does not reject the new tag. This function gets called before adding a new tag and checks if their is already one.
         If there is one it replaces the old one with the new one.
         */
        scope.rejectAddingTooManyTags = function (tag) {
          if (scope.masterData.length >= 1) {
            scope.masterData = [tag];
          }
          return true;
        };

      }
    };
  });
