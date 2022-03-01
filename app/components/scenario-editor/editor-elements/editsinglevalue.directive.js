'use strict';

/**
 * @ngdoc directive to editSingleValue
 * @name irpsimApp.directive:editSingleValue
 * @description
 * # download
 */
angular.module('irpsimApp')
  .directive('editSingleValue', function (ChartDefaultOptions, $uibModal, $log, $timeout, TimeseriesFetcher, Sensitivity, timeSeriesEditorService) {
    return {
      restrict: 'E',
      scope: {
        data: '<',
        location: '<',
        aggregates: '<',
        elementName: '@',
        definition: '<',
        length: '@?',
        timestep: '@?',
        isforprint: '<',
        readOnly: '@',
        seriesGroup: '@?',
        validator: '&',
        baseYear: '@',
        currentYear: '@',
        scenario: '<',
        context: '<'
      },
      templateUrl: 'components/scenario-editor/editor-elements/editsinglevalue.html',
      link: function (scope, element, attrs) {

        scope.Sensitivity = Sensitivity;
        scope.chartOptions = angular.copy(ChartDefaultOptions);

        attrs.$observe('length', function(len){
          scope.length = len;
        });

        var startDate = new Date(2015, 0, 1);
        var endDate = new Date(2015, 11, 31, 23, 59, 59);

        scope.setHandMadeValue = function(value) {
          scope.data.value = value;
        };

        scope.$watch('data', function(newData){
          var newValue = _.get(newData,'value');
          if(newValue === undefined ||
             newValue === null ||
             (Array.isArray(newValue) && _.every(newValue,angular.isUndefined))){
            // no value set
            if(scope.chartOptions) {
              delete scope.chartOptions.labels;
            }
            if(scope.data) {
              delete scope.data.viewValue;
            }
          }else if(Array.isArray(newValue) && _.every(newValue,_.isString)){
            // array of database references
            scope.chartOptions.labels=['Zeit'].concat(newValue);
          }else{
            if(newValue !== undefined){
              var newVal = newValue;
              if (!angular.isString(newVal) ||
                (scope.definition['data-type'] === 'select') ||
                (scope.definition['data-type'] === 'floats') ||
                (scope.definition['data-type'] === 'boolean')) {

                scope.data.viewValue = newVal;
                scope.chartOptions.labels=['Zeit',''];
              } else {
                timeSeriesEditorService.getStammDatenName(newValue).then(function (name) {
                  scope.stammDatenName = name;
                });

                scope.chartOptions.labels=['Zeit',''];
                loadValue(newVal).then(function (result) {
                  scope.data.viewValue = result[0][1][1];
                });
              }
            }
          }
        },true);

        function loadValue(id) {
          var provider = TimeseriesFetcher.newDetailDataProvider([id]);
          startDate.setYear(scope.currentYear);
          endDate.setYear(scope.currentYear);
          return provider.fetchData(startDate, endDate, 1);
        }

        scope.$watch('definition', function (definition) {
          if (!definition) {
            return;
          }
          scope.chartOptions.unit = definition.unit;
        });

        scope.isValidDataTimeseries = function () {
          // if we show 'output' and don't have any value, we should not show the timeseries editor
          var dt = scope.definition['data-type'];
          var isSeries = dt[dt.length - 1] === 's';
          var isDataAvailable = (scope.data && scope.data.value);
          return isSeries && isDataAvailable;
        };

        ////////////////////// enforce rules /////////////////////////////////////////////
        scope.validateAndBroadcastChange = function (value) {
          var data = {
            value: value,
            definition: scope.definition,
            location: scope.location,
            sensitivity: scope.data.sensitivity
          };
          var validationResult = null;
          if (scope.validator) {
            validationResult = scope.validator({validationEvent: data}); // ask for array of validation messages
          }
          if (!validationResult || validationResult.length === 0) {
            scope.broadcastChange(value);
            return null;
          } else {
            return validationResult.join('\n');
          }
        };

        // notify our parents that we have changed our value
        // they might want to run more complex consistency checks
        scope.broadcastChange = function (value) {
          // the code listening to these events may assume that
          // previous two-way bindings were completed. We can assure that by waiting until the current
          // digest was completed at least once.
          $timeout(function () {
            scope.$emit('valueChanged', {
              value: value,
              definition: scope.definition,
              location: scope.location
            });
          });
        };

        attrs.$observe('readOnly', function () {
          //convert to boolean
          scope.readOnly = scope.$eval(attrs.readOnly);
        });

        scope.changeSensitivity = function(value){
          $uibModal.open({
            templateUrl: 'components/scenario-editor/editor-elements/sensitivity.modal.html',
            controller: 'sensitivityCtrl',
            resolve: {
              label: function(){ return scope.definition.identifier; },
              min: function() { return _.get(scope.data, 'sensitivity.range[0]', 1.0); },
              max: function() { return _.get(scope.data, 'sensitivity.range[1]', 1.0); },
              mode: function() {return _.get(scope.data, 'sensitivity.mode', 'multiply'); },
              domain: function() {return scope.definition.domain; },
              value: function () {return scope.definition.domain ? value: null; } // If the domain is set, we need to check sensitivity boundaries twice.
            }
          }).result
            .then(function(res){
              if(res.range[0] === res.range[1] && res.range[0] === 1.0){
                if(scope.data) {
                  delete scope.data.sensitivity;
                }
              }else {
                scope.data.sensitivity = res;
              }
            });
        };

        scope.openScalarFromDB = function () {
          var modalInstance = $uibModal.open({
            templateUrl: 'components/scenario-editor/editor-elements/editsinglevalue.modal.html',
            controller: 'editSingleValueCtrl',
            size: 'lg',
            resolve: {
              subTitle: function () {
                return scope.definition.identifier + '-' + scope.elementName;
              },
              type: function () {
                return scope.definition.name;
              },
              baseYear: function () {
                return scope.baseYear;
              },
              currentYear: function () {
                return scope.currentYear;
              },
              scenario: function () {
                return scope.scenario;
              },
              context: function() {
                return scope.context;
              }
            }
          });

          modalInstance.result.then(function (scalarId) {
            // first, load the real value, then run validation and, if everything checks out, set the new value
            loadValue(scalarId).then(function (result) {
              var value = result[0][1][1];
              if (!scope.validateAndBroadcastChange(value)) {
                scope.data.value = scalarId;
                scope.data.viewValue = value;
              }
            });
          }, function () {
            $log.info('Modal dismissed at: ' + new Date());
          });
        };

        scope.setPrognoseSzenario = function (value) {
          scope.data.value = _.find(scope.data.values, {stelle: value.stelle});
          scope.data.value = value;
          scope.broadcastChange(value);
        };
      }
    };
  });

angular.module('irpsimApp').controller('editSingleValueCtrl', function ($scope, $uibModalInstance, subTitle, type, baseYear, currentYear, scenario) {

  $scope.baseYear = baseYear;
  $scope.currentYear = currentYear;
  $scope.scenario = scenario;
  //title setzen
  $scope.title = subTitle;

  $scope.timeseriesType = type;

  //setzt neue daten bei row select
  $scope.addDatasets = function (scalarname) {
    $uibModalInstance.close(scalarname);
  };

  //Abbrechen
  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
});
