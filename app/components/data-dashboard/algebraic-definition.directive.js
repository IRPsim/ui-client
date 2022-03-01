'use strict';

angular.module('irpsimApp')
  .directive('algebraicDefinition', function ($uibModal, $log, $q, TimeseriesFetcher, ChartDefaultOptions, $http, Datasets, growl) {

    return {
      restrict: 'E',
      templateUrl: 'components/data-dashboard/algebraic-definition.html',
      scope: {
        stammdatum: '<',
        datensatz: '<',
        showOnly: '<',
        closeModal: '&'
      },
      link: function (scope) {
        var promise = scope.datensatz ? $q.when(scope.datensatz) : $http.get('/backend/simulation/stammdaten/' + scope.stammdatum.id + '/algebraicdata').then(_.property('data'));

        promise.then(function (datasets) {
          var currDef = null;
          if (datasets.length === 0) {
            return;
          } else {
            currDef = _.min(datasets, 'jahr');
          }
          scope.formula = currDef.formel;
          scope.startYear = currDef.jahr;

          scope.symbolParams = _.map(currDef.variablenZuordnung, function (val, key) {

            var stammdatum = Datasets.getMasterData(val.stammdatum);

            var fetchdetails;
            if (val.jahr === 0) {
              fetchdetails = 'default';
            } else if (val.jahr === -1) {
              fetchdetails = 'previous';
            } else {
              fetchdetails = 'base';
            }

            return {
              variable: key,
              stammdatum: stammdatum,
              fetchdetails: fetchdetails
            };

          });
        });

        /**
         * Store checkbox values
         */
        scope.cb = {
          forceSave: false // will be true, if the user want to overwrite existing static data for the year by set the checkbox
        };

        /*
         Deactivates the 'Evaluation' button until all necessary information is provided.
         */
        scope.resultSet = false;
        scope.stammdatenSet = false;
        scope.isFormulaConstant = false; // a formula is defined but it does not refer to any variable

        scope.symbolParams = [];


        scope.getDerivedValue = function (property) {
          return Datasets.getValue(_.get(scope, 'stammdatum.parent'), property);
        };

        scope.getMaxYear = function () {

          var p = _.get(scope, 'stammdatum.prognoseHorizont');
          var y = _.get(scope, 'stammdatum.bezugsjahr');

          if (p === null) {
            p = scope.getDerivedValue('prognoseHorizont');
          }

          if (y === null) {
            y = scope.getDerivedValue('bezugsjahr');
          }

          return p + y;
        };

        scope.error = null;

        /**
         * Checks if a symbol (variable) is defined in a function scope. This is needed to determine the input variables of a formula.
         *
         * @param {Object} tree Root node of the tree.
         * @param {String} symbol The symbol which gets checked.
         * @param {Object} parent The current parent node.
         * @returns {boolean} True, if the symbol is defined in a mathjks function scope.
         */
        function isInsideFunctionDef(tree, symbol, parent) {

          if (!parent) {
            return false;
          }

          if (parent.type === 'FunctionAssignmentNode' && parent.params.indexOf(symbol) !== -1) {
            return true;
          }

          var found = false;

          tree.traverse(function (nodeIn, pathIn, parentIn) {
            if (nodeIn === parent) {
              if (isInsideFunctionDef(tree, symbol, parentIn)) {
                found = true;
              }
            }
          });
          return found;
        }

        /*
         Watches the formula for changes. After a change it checks for input variables and puts the result into scope.symbolParams.
         */
        scope.$watch('formula', function (newVal) {
          scope.error = null;
          var nodePar = {};
          try {
            // uses math.js
            nodePar = math.parse(newVal);
          } catch (e) {
            scope.error = e.message || 'Syntaxfehler in der Formel, Grund unbekannt.';
            return;
          }

          var resultSymbols = [];
          var ignoreNodes = [];
          var resultSymbolDefined = false;

          nodePar.traverse(function (node, path, parent) {

            switch (node.type) {
              case 'SymbolNode':
              {
                if (parent && parent.type === 'AssignmentNode' && parent.object.name === 'result') {
                  resultSymbolDefined = true;
                }

                if (parent && parent.type === 'AssignmentNode' && parent.object.name === node.name) {
                  ignoreNodes.push(node);

                } else {
                  var ignored = false;
                  angular.forEach(ignoreNodes, function (val) {
                    if (val.name === node.name) {
                      ignored = true;
                    }
                  });
                  if (!ignored && !isInsideFunctionDef(nodePar, node.name, parent)) {
                    if (resultSymbols.indexOf(node.name) === -1) {
                      resultSymbols.push(node.name);
                    }
                  }
                }
                break;
              }
              default:
                if (parent && parent.type === 'AssignmentNode' && parent.object.name === 'result') {
                  resultSymbolDefined = true;
                }
            }
          });
          scope.resultSet = resultSymbolDefined;
          resultSymbols = _.map(resultSymbols, function (item) {
            return {
              variable: item,
              stammdatum: undefined,
              fetchdetails: 'default'
            };
          });

          // delete old symbols.
          for (var i = 0; i < scope.symbolParams.length; i++) {
            var stillExists = false;
            for (var j = 0; j < resultSymbols.length; j++) {
              if (scope.symbolParams[i].variable === resultSymbols[j].variable) {
                stillExists = true;
              }
            }
            if (!stillExists) {
              scope.symbolParams.splice(i, i + 1);
            }
          }

          // add new symbols.
          angular.forEach(resultSymbols, function (sym) {
            var exists = false;
            for (var i = 0; i < scope.symbolParams.length; i++) {
              if (scope.symbolParams[i].variable === sym.variable) {
                exists = true;
              }
            }
            if (!exists) {
              scope.symbolParams.push(sym);
            }
          });

          scope.stammdatenSet = true;
          for (i = 0; i < scope.symbolParams.length; i++) {
            if (!scope.symbolParams[i].stammdatum) {
              scope.stammdatenSet = false;
            }
          }
          scope.isFormulaConstant = resultSymbolDefined && scope.symbolParams.length === 0;
        });


        /*
         Opens a modal dialog for selecting a stammdatum for a certain variable.
         */
        scope.openSelectStammdatum = function (variable) {
          var modalInstance = $uibModal.open({
            templateUrl: 'components/data-dashboard/stammdaten-selector.modal.html',
            controller: 'stammdatenSelectorModalCtrl',
            size: 'lg',
            resolve: {
              variableName: function () {
                return variable.variable;
              }
            }
          });

          modalInstance.result.then(function (stammdatum) {
            variable.stammdatum = stammdatum;

            // validate user input.
            scope.stammdatenSet = true;
            for (var i = 0; i < scope.symbolParams.length; i++) {
              if (!scope.symbolParams[i].stammdatum) {
                scope.stammdatenSet = false;
              }
            }
          }, function () {
            $log.info('Modal dismissed at: ' + new Date());
          });
        };

        /*
         Watches for changes in scope.symbolParams and calculates the possible scenarios for a calculation.
         */
        scope.$watch('symbolParams', function (newVal) {
          if (!newVal) {
            return;
          }

          scope.possibleScenarios = [];

          for (var i = 0; i < scope.symbolParams.length; i++) {
            var symbol = scope.symbolParams[i];
            if (!symbol.stammdatum) {
              continue;
            }
            var year = Datasets.getValue(symbol.stammdatum, 'bezugsjahr');
            var scenarios = Datasets.getScenarioSet(year).slice();
            scope.possibleScenarios = scope.possibleScenarios.length === 0 ? scenarios : _.intersection(scope.possibleScenarios, scenarios);
          }
        }, true);

        scope.calculateConcreteValues = function () {

          var dataset = {
            jahr: scope.selectedYear,
            szenario: scope.selectedScenario,
            formel: scope.formula,
            stammdatum: scope.stammdatum.id,
            variablenZuordnung: {}
          };

          for (var i = 0; i < scope.symbolParams.length; i++) {
            dataset.variablenZuordnung[scope.symbolParams[i].variable] = {
              stammdatum: scope.symbolParams[i].stammdatum.id
            };

            switch (scope.symbolParams[i].fetchdetails) {
              case 'default' :
                dataset.variablenZuordnung[scope.symbolParams[i].variable].jahr = 0;
                break;
              case 'previous' :
                dataset.variablenZuordnung[scope.symbolParams[i].variable].jahr = -1;
                break;
              case 'base' :
                dataset.variablenZuordnung[scope.symbolParams[i].variable].jahr = Datasets.getValue(scope.symbolParams[i].stammdatum, 'bezugsjahr');
                break;
            }
          }

          $http.put('/backend/simulation/stammdaten/' + scope.stammdatum.id + '/algebraicdata/preview', dataset).then(function (res) {
            scope.previewData = res.data;
          });
        };

        scope.graphOptions = angular.copy(ChartDefaultOptions);
        scope.graphOptions.labels = ['x', 'Ergebnis'];

        scope.saveAlgebraicDataset = function () {

          var dataset = {
            jahr: scope.startYear,
            formel: scope.formula,
            stammdatum: scope.stammdatum.id,
            variablenZuordnung: {}
          };


          for (var i = 0; i < scope.symbolParams.length; i++) {

            dataset.variablenZuordnung[scope.symbolParams[i].variable] = {
              stammdatum: scope.symbolParams[i].stammdatum.id
            };

            switch (scope.symbolParams[i].fetchdetails) {
              case 'default' :
                dataset.variablenZuordnung[scope.symbolParams[i].variable].jahr = 0;
                break;
              case 'previous' :
                dataset.variablenZuordnung[scope.symbolParams[i].variable].jahr = -1;
                break;
              case 'base' :
                dataset.variablenZuordnung[scope.symbolParams[i].variable].jahr = Datasets.getValue(scope.symbolParams[i].stammdatum, 'bezugsjahr');
                break;
            }

          }

          var url = '/backend/simulation/stammdaten/' + scope.stammdatum.id + '/algebraicdata' + (scope.cb.forceSave ? '?force=true':'');

          $http.put(url, dataset)
            .then(function () {
              growl.success('Formel erfolgreich gespeichert!');
              // we have to update Datasets at this point
              Datasets.fetchAll();
              scope.closeModal();
            })
            .catch(function(err) {
              // 409 == we have already static timeseries data
              // the user have to check the force save option
              if (err.status === 409) {
                scope.staticDataAvailable = true;
              }
            });
        };
      }
    };
  });

angular.module('irpsimApp').controller('stammdatenSelectorModalCtrl', function ($scope, $uibModalInstance, variableName) {

  $scope.variable = variableName;

  $scope.selectStammdatum = function (stammdatum) {
    $uibModalInstance.close(stammdatum);
  };

  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
});
