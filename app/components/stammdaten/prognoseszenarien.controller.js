'use strict';

/**
 * @ngdoc function
 * @name irpsimApp.controller:PrognoseszenarienCtrl
 * @description
 * # PrognoseszenarienCtrl
 */
angular.module('irpsimApp')
  .controller('PrognoseszenarienCtrl', function ($scope, $http, $log, Datasets, growl) {

    $scope.currYear = new Date().getFullYear();
    $scope.newScenario = [];
    $scope.isEditing = false;

    function reload() {
      $scope.isEditing = false; // enable delete and edit buttons
      Datasets.loadScenarioSets().then(function(result) {
        if (result && result.length > 0) {
          $scope.scenarios = result;
        }
      });
      $scope.newScenario = [];
    }

    reload();

    $scope.deleteScenario = function (set, scenario) {
      for(var i = 0; i < set.editScenarios.length; i++) {
        if (set.editScenarios[i].stelle === scenario.stelle) {
          set.editScenarios.splice(i, 1);
        }
      }
    };
    $scope.addScenario = function (set, scenario) {
      $log.debug('new secnario for set', scenario, set);

      var currYears = _.map(set.szenarien, function(s) {
        return s.stelle;
      });

      var validForm = scenario && scenario.hasOwnProperty('stelle') && scenario.hasOwnProperty('name');
      var stelleAlreadySet = validForm ? currYears.indexOf(scenario.stelle) !== -1 : false;


      if(validForm && !stelleAlreadySet) {
        set.editScenarios.push(angular.copy(scenario));
        $scope.newScenario[set.jahr] = {};
      } else {
        if(!validForm) {
          growl.warning('Stelle und Szenario-Name sind Pflichtfelder');
        }
        if(stelleAlreadySet) {
          growl.warning('Stelle ist für das Bezugsjahr schon vorhanden');
        }
      }
    };

    $scope.removeScenarioSet = function (s) {
      $http.delete('/backend/simulation/szenariosets/' + s.jahr).then(function() {
        reload();
      });
    };

    $scope.editScenarioSet = function (s) {
      $scope.isEditing = true;
      s.edit = true;
      s.editScenarios = angular.copy(s.szenarien);
      s.editYear = s.jahr;
    };

    $scope.cancelChangesForScenarioSet = function (s) {
      delete s.editScenarios;
      delete s.edit;
      $scope.isEditing = false;
    };

    $scope.saveChangesForScenarioSet = function (s) {

      var data = {
        jahr: s.jahr,
        szenarien: []
      };

      for (var i = 0; i < s.editScenarios.length; i++) {
        data.szenarien.push({
          stelle: s.editScenarios[i].stelle,
          name: s.editScenarios[i].name
        });
      }

      $http.put('/backend/simulation/szenariosets', data).then(function() {
        // reset form inputs
        $scope.bezugsjahr = undefined;
        $scope.szenarien = [];

        delete s.editScenarios;
        delete s.edit;

        reload();
      });


    };

    $scope.addScenarios = function(bezugsjahr, szenarien) {
      var data = {
        jahr: bezugsjahr,
        szenarien: []
      };

      for (var i = 0; i < szenarien.length; i++) {
        data.szenarien.push({
          stelle: i + 1,
          name: szenarien[i].text
        });
      }

      $http.put('/backend/simulation/szenariosets', data).then(function() {
        // reset form inputs
        $scope.bezugsjahr = undefined;
        $scope.szenarien = [];
        reload();
      });
    };

    $scope.getScenarioString = function(scenarioset) {
      return _.map(scenarioset.szenarien, function (i) {
        return i.name + ' (' + i.stelle + ')';
      }).join(', ');
    };
  });
