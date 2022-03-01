'use strict';

/**
 * @ngdoc directive to edit a time series. Renders a chart and an upload button.
 * @name irpsimApp.directive:timeseriesEditor
 * @description
 * # ...
 */
angular.module('irpsimApp')
  .directive('timeseriesEditor', function (ChartDefaultOptions, $uibModal, $log, $q, $filter, $http, TimeseriesFetcher, Simulations, ScenarioValidation, Logger, timeSeriesEditorService) {
    return {
      restrict: 'E',
      scope: {
        externalData: '=data',
        definition: '<',
        type: '@',
        chartOptions: '<',
        subTitle: '@',
        maxLength: '<',
        timestep: '@?',
        isforprint: '<',
        readOnly: '<',
        seriesGroup: '@?',
        baseYear: '@',
        currentYear: '@',
        scenario: '<',
        onChange: '&',
        onSensitivityClick: '&',
        sensitivity: '=',
        context: '<'
      },
      templateUrl: 'components/scenario-editor/editor-elements/timeserieseditor.html',
      link: function (scope) {

        scope.setTimeseriesReference = function (seriesName) {
          scope.externalData = seriesName;
          scope.series = [seriesName];
          delete scope.data; // remove explicit array of numbers
          if (scope.onChange) {
            scope.onChange({$value: seriesName});
          }
        };
        scope.resetToZero = function () {
          // backend has a standard zero-length timeseries
          scope.setTimeseriesReference('0');
        };
        scope.openFromExcel = function () {
          $uibModal.open({
            templateUrl: 'components/scenario-editor/editor-elements/timeserieseditor.excel.modal.html',
            controller: 'timeseriesEditorCtrlExcel',
            resolve: {
              data: function () {
                if (scope.data) {
                  return $q.when(scope.data);
                } else {
                  return $http({
                    method: 'GET',
                    url: '/backend/simulation/stammdaten/concretedata',
                    params: {
                      seriesid: scope.series
                    }
                  }).then(function (results) {
                    var values = results.data[scope.series[0]];
                    if(values.length > 0) {
                      return _.map(values, 'avg');
                    }else{
                      return [];
                    }
                  });
                }
              },
              maxLength: function () {
                // sort numbers function
                function sortNumber(a,b) {
                  return a - b;
                }
                // allow timeseries length of 1, 12, 8760, 35040 by default
                var allowableLengths = [1,12,52,365,8760,35040];
                // check if maxLengh is a valid number and not already in allowedLengths
                if(!isNaN(Number(scope.maxLength)) && allowableLengths.indexOf(Number(scope.maxLength)) === -1) {
                  // add custom allowed maxLength
                  allowableLengths.push(Number(scope.maxLength));
                }
                return allowableLengths.sort(sortNumber);
              },
              subTitle: function () {
                return scope.subTitle;
              },
              definition: function () {
                return scope.definition;
              }
            }
          }).result.then(function (data) {
            if (_.every(data, function (n) {
                return n === 0;
              })) {
              scope.resetToZero();
            } else {
              scope.data = scope.externalData = data;
              delete scope.series;
              if (scope.onChange) {
                scope.onChange({$value: data});
              }
            }
          }, function () {
            $log.info('ERROR: Modal dismissed at: ' + new Date(), arguments);
          });
        };
        //download series data as .csv
        scope.downloadResultsAsCSV = function () {
          var csvPromise;
          if (scope.data) {
            csvPromise = $q.when(scope.data);
          } else {
            csvPromise = $http({
              method: 'GET',
              url: '/backend/simulation/stammdaten/concretedata',
              params: {
                seriesid: scope.series
              }
            });
          }
          if(csvPromise) {
            csvPromise.then(function success(results) {
              // csv header
              var csvHeader = '';
              Simulations.loadedResults.forEach(function(simualtionId, idx, arr) {
                // add only csv header if series is defined
                if(Object.keys(results.data).indexOf(scope.series[idx]) !== -1) {
                  csvHeader += simualtionId + '-' + scope.series[idx] + '-' + scope.type + ';';
                }
              });
              // add newline \r\n to header
              csvHeader += '\r\n';
              // csv data
              var csvData = [];
              scope.series.forEach(function(seriesId) {
                // csv content
                for (var i = 0; i < results.data[seriesId].length; i++) {
                  if(!csvData[i]) { csvData[i] = []; }
                  csvData[i].push($filter('number')(results.data[seriesId][i].avg));
                }
              });
              // csv data strings per row
              var csvValues = '';
              csvData.forEach(function(row) {
                csvValues += row.join(';') + ';\r\n';
              });
              // download file
              var fileData = csvHeader + csvValues;
              var fileName = scope.seriesGroup.length > 0 ?
                scope.seriesGroup + '-series-' + scope.series.join('-') + '.csv' :
                'series-' + scope.series.join('-') + '.csv';
              var fileMimeType = {type: 'text/csv;charset=utf8'};
              saveAs(new File([fileData], fileName, fileMimeType));
            });
          }
        };
        scope.openFromDB = function () {
          var modalInstance = $uibModal.open({
            templateUrl: 'components/scenario-editor/editor-elements/timeserieseditor.modal.html',
            controller: 'timeseriesEditorCtrl',
            size: 'lg',
            resolve: {
              subTitle: function () {
                return scope.subTitle;
              },
              type: function () {
                return scope.type;
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

          modalInstance.result.then(function (seriesName) {
            scope.setTimeseriesReference(seriesName);
            delete scope.data;
          }, function () {
            $log.info('Modal dismissed at: ' + new Date());
          });
        };
        // length per time step in hours depending on the length of the data array
        var timeStepLengths = {
          1    : 365*24,
          12   : 30*24,
          52   : 7*24,
          365  : 24,
          8760 : 1,
          35040: 0.25
        };
        scope.$watch('externalData', function (externalData) {
          if (!angular.isDefined(externalData)) {
            return;
          }
          if (angular.isString(externalData)) {
            scope.series = [externalData];
            delete scope.data;
          } else if (Array.isArray(externalData)) {
            // if we got an array we either have an array of numeric values or multiple timeseries database references
            if (_.every(externalData, _.isString)) {
              scope.simulationIds = Simulations.loadedResults;
              scope.series = externalData;
              delete scope.data;
            } else {
              scope.data = externalData;
              scope.coarseTimestep = timeStepLengths[externalData.length] || scope.timestep;
              delete scope.series;
            }
          } else {
            throw 'invalid type given as timeseries data:' + (typeof externalData);
          }

          // Check domain rules
          if (scope.series && scope.series.length > 0 && scope.definition.domain) {
            TimeseriesFetcher.newDetailDataProvider(scope.series).fetchData(new Date(2015, 0, 1), new Date(2015, 11, 31, 23, 59, 59), 1).then(function(res) {
              var d = scope.definition.domain;
              for(var i = 0; i < res.length; i++) {
                // min value = res[i][1][0]
                // max value = res[i][1][2]
                for(var key in d) {
                  if (d.hasOwnProperty(key) && d[key]) {
                    for( var t = 0; t <= 2; t += 2) {
                      if (!ScenarioValidation.validationFunctions[key](res[i][1][t], d[key])) {
                        Logger.addLog({
                          severity: 'warning',
                          title: 'Ungültige Zeitreihe',
                          text: 'Die Zeitreihe enthält den ungültigen Wert ' + res[i][1][t] + ' der gegen die Domain-Regel ' + key + ' ' + d[key] + ' verstößt.',
                          notify: true
                        });
                      }
                    }
                  }
                }
              }
            });
          }
        });

        scope.$watch('chartOptions', function (co) {
          if (co) {
            scope.options = angular.merge(angular.copy(ChartDefaultOptions), co);
          }
        });

        scope.$watch('externalData', function (data) {
          if (!Array.isArray(data)) {
            timeSeriesEditorService.getStammDatenName(data).then(function (name) {
              scope.stammDatenName = name;
            });
          }
        });
      }
    };
  });


//modalcontroller steuert buttons
angular.module('irpsimApp').controller('timeseriesEditorCtrl', function ($scope, $uibModalInstance, subTitle, type, baseYear, currentYear, scenario, context) {

  $scope.baseYear = baseYear;
  $scope.currentYear = currentYear;
  $scope.scenario = scenario;
  //title setzen
  $scope.title = subTitle;

  $scope.timeseriesType = type;
  $scope.context = context;
  //setzt neue daten bei row select
  $scope.addDatasets = function (seriesname) {
    $uibModalInstance.close(seriesname);
  };

  //Abbrechen
  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
});

angular.module('irpsimApp').controller('timeseriesEditorCtrlExcel', function ($scope, $filter, $log, $uibModalInstance,
                                                                              data, maxLength, subTitle, definition,
                                                                              ScenarioValidation, saveAs) {
  $scope.definition = definition;

  //title setzten
  $scope.title = subTitle;

  if (angular.isUndefined(maxLength) || isNaN(Number.parseInt(maxLength))) {
    $scope.lengthIsSet = false;
  } else {
    maxLength = angular.isArray(maxLength) ? maxLength : [Number.parseInt(maxLength)];
    $scope.maxLength = maxLength;
    $scope.lengthIsSet = true;
  }

  //anzahl fehlender bzw. ueberschÃ¼ssiger Elemente in den Daten
  $scope.elemToGo = 0;

  //informations
  $scope.info = '';
  $scope.infoItemStatic = [
    {'text': 'Datenstruktur hat die richtige Anzahl an Elementen!', 'item': 1},
    {'text': 'Der Spaltenheader wurde gefunden und entfernt', 'item': 2}
  ];
  //hÃ¤lt InformationsDaten welche vor der ausgabe noch weiter veraendert werden
  $scope.infoItemDynamic = [];

  //button
  $scope.isDisabled = false;

  $scope.rawData = data.join('\n');

  //anzahl der elemente finden und anzeigen
  $scope.countElem = data.length;

  //setzt neue daten beim klick auf ok-button	entfernt alle Strings
  $scope.ok = function () {
    //parsen
    var data = $scope.rawData.split(/\n/);
    var nData = [];

    for (var i = 0; i < data.length; i++) {
      if (isNumeric(data[i])) {
        nData.push(parseFloat(data[i]));
      }
    }
    $uibModalInstance.close(nData);
  };
  function isNumeric(string) { // from https://github.com/jquery/jquery/blob/c869a1ef8a031342e817a2c063179a787ff57239/src/core.js#L214
    return (string - parseFloat(string) + 1) >= 0;
  }

  //wird ausgefuehrt falls die daten manuell im modal geaendert werden
  $scope.changeCount = function () {
    var data = $scope.rawData.split(/\n/);
    var count = data.length;

    var alertMessage = '';

    //Whitespace loeschen um count nicht zu verfaelschen
    for (var i = 0; i < data.length; i++) {
      if (!isNumeric(data[i])) {
        count--;
      }
    }
    $scope.countElem = count;
    var item;
    // Check for domain rules
    if ($scope.definition.domain) {
      var d = $scope.definition.domain;
      for (var key in d) {
        if (d.hasOwnProperty(key)) {

          for (i = 0; i < data.length; i++) {
            if (isNumeric(data[i])) {
              if (!ScenarioValidation.validationFunctions[key](data[i], d[key])) {
                alertMessage = 'Die Zeitreihe enthält den Wert ' + data[i] + ', der die Domain-Bedingung ' + key + ' ' + d[key] + ' verletzt.';
                item = {'text': alertMessage, 'item': 4};
                $scope.infoItemDynamic.push(item);

                $scope.info = $scope.infoItemDynamic[0];
                $scope.infoItemDynamic = [];

                $scope.isDisabled = true;
                return;
              }
            }
          }
        }
      }
    }

    if ($scope.lengthIsSet === true && maxLength.indexOf($scope.countElem) === -1) {
      $scope.isDisabled = true;

      if(maxLength.indexOf($scope.countElem) === -1) {
        alertMessage = 'Die mitgegebene Datenstruktur enthält ' + ($scope.countElem) + ' Element(e). Benötigt werden jedoch entweder ' + maxLength.join(', ') + ' Element(e).';
        item = {'text': alertMessage, 'item': 4};
        $scope.infoItemDynamic.push(item);
        $scope.info = $scope.infoItemDynamic[0];
        $scope.infoItemDynamic = [];
      }
    } else {
      $scope.info = $scope.infoItemStatic[0];  //TODO
      $scope.isDisabled = false;
    }
  };


  //Abbrechen
  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
  // run initial validation
  $scope.changeCount();

  //download series data as .csv
  $scope.downloadCSV = function () {
    // csv header
    var csvData = $scope.definition.name + ';\r\n';
    // csv content
    for (var i = 0; i < data.length; i++) {
      csvData += $filter('number')(data[i]) + ';\r\n';
    }
    // download file
    saveAs(new File([csvData], 'series.csv', {type: 'text/csv;charset=utf8'}));
  };
});
