'use strict';

/**
 * @ngdoc function
 * @name irpsimApp.controller:ScenarioEditorCtrl
 * @description
 * # ScenarioEditorCtrl
 * Controller of the irpsimApp
 */
angular.module('irpsimApp')
  .controller('ScenarioEditorCtrl', function ($timeout, $scope, $http, ScenarioDefinitions,
                                              ScenarioConfiguration, scenario, modelType, Simulations,
                                              info, Logger, PrintService, BackendVersionCache, modelDefinitions, modelDefinitionIds){
    var ScenarioEditorCtrl = this;
    //using controllerAs syntax
    ScenarioEditorCtrl.print = false;
    ScenarioEditorCtrl.type = modelType;
    ScenarioEditorCtrl.modelDefinitions = modelDefinitions;
    ScenarioEditorCtrl.modelDefinitionIds = modelDefinitionIds;
    Simulations.currentSimulation.state.scenario = scenario;
    ScenarioEditorCtrl.scenario = scenario;
    ScenarioEditorCtrl.results = [];
    ScenarioEditorCtrl.activeTab = 0;
    ScenarioEditorCtrl.info = info;
    ScenarioEditorCtrl.loadedScenarioDescription = {
        scenarioName: '',
        description: '',
    };
    ScenarioEditorCtrl.description = {};
    ScenarioEditorCtrl.paramnames = [];

    setName();

    $scope.$watch(function(){ return Simulations.currentSimulation.results.result;}, function(results){
      ScenarioEditorCtrl.activeTab = 0;
      ScenarioEditorCtrl.results = results;
    });
    $scope.$watch(function(){ return Simulations.currentSimulation.state.scenario;}, function(scenario){
      ScenarioEditorCtrl.activeTab = 0;
      ScenarioEditorCtrl.scenario = scenario;
      ScenarioEditorCtrl.results = [];
    });

      $scope.$watch(function () {
          return Simulations.currentSimulation.desc.businessModelDescription;
      }, function (desc) {
          ScenarioEditorCtrl.loadedScenarioDescription = {
              scenarioName: '',
              description: desc,
          };
      });


    $scope.logs = Logger.getLogs();
    $scope.maxRows = 50;

    $scope.clearLog = function(type){
      Logger.clearLog(type);
      $scope.logs = Logger.getLogs();
    };
    $scope.removeLogEntry = function(id){
      Logger.removeLogEntry(id);
      $scope.logs = Logger.getLogs();
    };

    $scope.clearLocalStorage = function(){
      BackendVersionCache.clear();
      window.location.reload(true);
    };

    // needed, cause their is no other way to access this.print inside of doPrint()
    var setPrint = angular.bind(this, function (bool) {ScenarioEditorCtrl.print = bool;});

    /**
     * calls window.print().
     *
     */
    $scope.togglePrint = function (){
      setPrint(!ScenarioEditorCtrl.print);

      if (ScenarioEditorCtrl.print){
        $timeout(function(){
          PrintService.print();
        },2000);
      }
    };
    /**
     * Use uploaded file contents as ui structure/metadata.
     * @param {String} text from json file
     */
    $scope.setUIStructure = function(text){
      var json = JSON.parse(text);
      ScenarioDefinitions.useDevelopUIStructure(modelType, json);
    };

    $scope.getModelNames = function (id) {
      var name = '';
      ScenarioEditorCtrl.modelDefinitions.forEach(function (resp) {
        if (resp.id === id) {
          name = resp.name;
        }
      });
      return name;
    };


    function setName() {
      ScenarioEditorCtrl.modelDefinitions.forEach(function(resp){
        if (resp.id === ScenarioEditorCtrl.type) {
          ScenarioEditorCtrl.modelName = resp.name;
        }
      });
    }

//     // do not commit these next lines uncommented!
//     Simulations.loadParameterset(717, modelType)
//       .then(function(input){
//         Simulations.currentSimulation.state.scenario = input;
//        // return Simulations.loadResults(300,modelType);
//       })
//       .then(function(res){
//         Simulations.currentSimulation.results = res;
//         Simulations.addResults(301,modelType);
//       });
  });
