'use strict';

/**
 * @ngdoc directive to
 * @name irpsimApp.directive:scenarioTableEditor
 * @description
 * # download
 */
angular.module('irpsimApp')
  .directive('scenarioTableEditor', function ($log, d3locale, ScenarioConfiguration, growl, localStorageService){
    return {
      restrict: 'E',
      scope: {
        type: '@',
        scenario: '=',
        info: '=',
        loadedScenarioDescription: '='
      },
      templateUrl: 'components/scenario-editor/scenario-table-editor.html',
      link: function (scope){
        scope.filteroptions = {};
        scope._creator = localStorageService.get('creator');

        var fmt = d3locale.timeFormat('%d.%m.%Y %H:%M');
        scope.convertTime = function (ms){
          return fmt(new Date(ms));
        };

        scope.showAdd = false;
        scope.doShowAdd = function(){
          scope.showAdd = !scope.showAdd;
        };

        scope.scenarioTableContent = [];

        function reloadTableData(loadCurrentlyAddedScenario) {
          ScenarioConfiguration.loadScenarioTable(scope.type).then(function (response) {
              scope.scenarioTableContent = response;
              if(loadCurrentlyAddedScenario) {
                var lastAddedScenarioId = Object.keys(response)[Object.keys(response).length-1];
                scope.loadedScenario = response[lastAddedScenarioId];
              }
            }
          );
        }
        scope.deleteScenario = function (scenario){
          ScenarioConfiguration.deleteScenario(scenario.id).then(function (){
            growl.success('Szenario erfolgreich gelöscht.');
            reloadTableData();
          });
        };

        scope.storeScenario = function (creator, name, description){
          localStorageService.set('creator',creator);
          ScenarioConfiguration.storeScenario(creator, name, description, scope.scenario, scope.type).then(function (){
            growl.success('Neues Szenario hinzugefügt.');
            reloadTableData(true);
          });
        };
        scope.loadScenarioEntry = function (scenario){
          var useCache = false;
          ScenarioConfiguration.loadScenario(scope.type, scenario.id, useCache).then(function (data){
            scope.scenario = data;
            scope.loadedScenario = scenario;
            scope.loadedScenarioDescription = {
              scenarioName: scenario.name,
              description: scenario.description
            };
            // TODO find a way to keep distinct parts of the application from needing to know which keys to keep and which to delete
            var unneeded = ['Geladene Simulation','Modellbeschreibung','Ausprägung','Ersteller','Parameteraugenmerk','Geladene Simulation'];
            for (var i = 0; i < unneeded.length; i++) {
              var prop = unneeded[i];
              if(scope.info.hasOwnProperty(prop)) {
                delete(scope.info[prop]);
              }
            }
            scope.info['Geladenes Szenario'] = (scenario.name || '') + (scenario.description?'('+scenario.description+')':'');
            scope.info['Erstellt Am'] = scope.convertTime(scenario.date);
            growl.success('Szenario <em><b>' + scenario.name + '</b></em> erfolgreich geladen!');
          });
        };

        scope.saveScenarioEntry = function (scenario){
          ScenarioConfiguration.saveScenario(scenario.id, scenario.creator, scenario.name, scenario.description, scope.scenario, scope.type).then(function (){
            growl.success('Szenario  <em><b>' + scenario.name + '</b></em> erfolgreich gespeichert.');
          }, function() {
            growl.error('Szenario <em><b>' + scenario.name + '</b></em> konnte nicht gespeichert werden.');
          });
        };

        scope.entryGetsFiltered = function (entry) {

          for (var prop in scope.filteroptions) {
            if (scope.filteroptions.hasOwnProperty(prop)) {
              //if a filter got specified
              if (scope.filteroptions[prop].length > 0) {
                if (!entry || !entry[prop] || entry[prop].indexOf(scope.filteroptions[prop]) === -1) {
                  return false;
                }
              }
            }
          }
          return true;
        };

        reloadTableData();
      }
    };
  });
