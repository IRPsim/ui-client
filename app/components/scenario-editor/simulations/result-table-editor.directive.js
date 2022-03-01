'use strict';
angular.module('irpsimApp')

  .directive('resultTableEditor', function (d3locale, Simulations, growl, $filter, $http, $stateParams) {
    return {
      restrict: 'E',
      scope: {
        type: '@',
        info: '<',
        result: '<',
        description: '='
      },
      templateUrl: 'components/scenario-editor/simulations/result-table-editor.html',
      link: function (scope) {

        scope.Simulations = Simulations;

        // current status: loading simulations or not?
        scope.loading = false;
        //contains ids
        scope.simulationids = [];

        //contains data returned by backend/simulation/simulations/id
        scope.simulations = [];
        // list of ids in state WAITING
        scope.waitingList = [];

        scope.filteroptions = {};

        /**
         * converts time from ms in something appropriate
         *
         */
        var fmt = d3locale.timeFormat('%d.%m.%Y %H:%M');
        scope.convertTime = function (ms) {
          if(ms) {
            return fmt(new Date(ms));
          } else {
            return null;
          }
        };


        /**
         * (re)loads data for table
         */
        scope.reloadTableData = function () {
          scope.loading = true;
          Simulations.getAllSimulations()
            .then(function (arr){
              return sortSimulationsByWaitingQueue(arr);
            })
            .then(function(simulations){
              scope.simulations = simulations;
              scope.loading = false;
            });
        };

        /**
         * stops simulation
         *
         * @param {number} id id of the running simulation
         *     simulationID
         */
        scope.stopSimulation = function (id,isDelete) {
          Simulations.stopSimulation(id, isDelete).then(function () {
            growl.success('Simulation ' + id + ' wurde '+isDelete?'gelöscht.':'gestoppt.');
            scope.reloadTableData();
          });
        };

        scope.addResults = function(simulation){
          setInfo(simulation,true);
          Simulations.addResults(simulation.id, scope.type);
        };

        function setInfo(simulation,isAdded) { // TODO find a better way to keep distinct parts of the application from needing to know which keys to keep and which to delete
          if (scope.info.hasOwnProperty('Geladenes Szenario')) {
            delete(scope.info['Geladenes Szenario']);
            if (scope.info.hasOwnProperty('Erstellt Am')) {
              delete(scope.info['Erstellt Am']);
            }
          }
          var d = simulation.description;
          scope.description = simulation.description;
          scope.info['Geladene Simulation'] = isAdded ? (scope.info['Geladene Simulation'] +' - '+ simulation.id) : simulation.id;
          scope.info['Modellbeschreibung']  = isAdded ? (scope.info['Modellbeschreibung'] +' - '+d['businessModelDescription']) : d['businessModelDescription'];
          scope.info['Ausprägung']          = isAdded ? (scope.info['Ausprägung'] + ' - ' + d['investmentCustomerSide']) : d['investmentCustomerSide'];
          scope.info['Ersteller']           = isAdded ? (scope.info['Ersteller'] + ' - ' + d['creator']) : d['creator'];
          scope.info['Parameteraugenmerk']  = isAdded ? (scope.info['Parameteraugenmerk'] + ' - ' + d['parameterAttention']) : d['parameterAttention'];
        }

        scope.attachToRunningSimulation = function (simulation) {
          setInfo(simulation);
          Simulations.attachToRunningSimulation(scope.type, simulation);
        };

        /**
         * calculate end time
         *
         * - either fix end time
         * - or return 'Noch nicht abgeschlossen'
         *
         * @param {Object} simulation simulation
         */
        scope.calculateEndTime = function (simulation) {
          if (simulation.end === null) {
            if (scope.checkResult(simulation) === 'running') {
              return 'Noch nicht abgeschlossen.';
            } else {
              return '';
            }

          } else {
            return scope.convertTime(simulation.end);
          }
        };

        /**
         * check simulation status (needed for background color)
         * @param {Object} simulation simulation
         * @returns {*}
         */
        scope.checkResult = function (simulation) {
          if (!simulation.running) {
            if ((simulation.finishedsteps === simulation.simulationsteps) && (simulation.finishedsteps !== 0 && simulation.end !== null)) {
              return 'finished';
            } else if (simulation.error) {
              return 'error';
            }
          } else {
            return 'running';
          }
        };

        /**
         * simple if case needed for template
         *
         * @param {Object} simulation simulation
         * @returns {*}
         */
        scope.calculatePercentage = function (simulation) {
          var todo = simulation.simulationsteps;
          if (todo === 0) {
            return 'Serverantwort nicht zulaessig';
          } else {
            return $filter('number')((simulation.finishedsteps / todo) * 100, 0) + ' %';
          }
        };
        scope.getSimulationLength = function (simulation) {
          if (!simulation.simulationsteps) {
            return 'unbekannt';
          }
          var years = simulation.simulationsteps / 35040;
          if (years < 1) {
            return '< 1 Jahr';
          } else if (years === 1) {
            return '1 Jahr';
          } else {
            return years + ' Jahre';
          }
        };

        scope.replaceCommas = function (input) {
          if (input) {
            return input.replace(/;/g, '\n');
          } else {
            return null;
          }

        };

        scope.entryGetsFiltered = function (entry) {

          for (var prop in scope.filteroptions) {
            if (scope.filteroptions.hasOwnProperty(prop)) {
              //if a filter got specified
              if (scope.filteroptions[prop].length > 0) {
                  if (!entry.description || !entry.description[prop] || entry.description[prop].indexOf(scope.filteroptions[prop]) === -1) {
                    return false;
                  }
              }
            }
          }
          return true;
        };

        scope.onDropComplete = function (newIndex, simulation) {
          if(simulation.state !== 'WAITING'){
            return;
          }
          var arr = scope.simulations;
          var oldIndex = arr.indexOf(simulation);
          arr.splice(newIndex, 0, arr.splice(oldIndex,1)[0]);

          Simulations.changeQueue(_(arr)
            .filter('state','WAITING')
            .pluck('id')
            .reverse()
            .value())
            .then(function(){
              scope.reloadTableData();
            });
        };

        function sortSimulationsByWaitingQueue(arr) {
          var temp = angular.copy(arr);
          var waitingArray = [];

          return $http.get('/backend/simulation/simulations/queue?modeldefinition=' + $stateParams.modelDefinitionId).then(function (response) {
            var meta = response.data;
            for(var i = 0; i < meta.length; i++) {
              for(var j  = 0; j < temp.length; j++) {
                if(temp[j].id === meta[i].id) {
                  waitingArray.push(temp[j]);
                  temp.splice(j, 1);
                }
              }
            }
            return waitingArray.reverse().concat(temp);
          });
        }

        scope.reloadTableData();
      }
    };
  });
