'use strict';

/**
 * @ngdoc function
 * @name irpsimApp.controller:TimeseriesTestCtrl
 * @description
 * # TimeseriesTestCtrl
 * Controller of the irpsimApp
 */
angular.module('irpsimApp')
  .controller('TimeseriesTestCtrl', function ($scope, $timeout, ChartDefaultOptions){

    $scope.selected = [];
    $scope.visible2D = false;
    $scope.visible3D = false;

    $scope.addDatasets = function(masterData,os){
      for (var i = 0; i < os.length; i++) {
        var o = os[i];
        o.name = masterData.name;
        if($scope.selected.indexOf(o) === -1){
          o.typ = masterData.typ;
          o.bezugsjahr = masterData.bezugsjahr;
          $scope.selected.push(o);
        }
      }
      updateCharts();
    };
    function updateCharts(){
      $scope.graph.seriesNames=[];
      $scope.graph.options.labels=['Zeit'];
      for (var i = 0; i < $scope.selected.length; i++) {
        var o = $scope.selected[i];
        $scope.graph.seriesNames.push(o.seriesid);
        $scope.graph.options.labels.push(o.seriesid);
      }
      $scope.make2DChartReload();
    }

    $scope.removeDataset = function(o){
      var idx = $scope.selected.indexOf(o);
      if(idx !== -1){
        $scope.selected.splice(idx,1);
        updateCharts();
      }
    };

    $scope.graph = {
      seriesNames: [],
      numDataPoints: 100,
      options: angular.copy(ChartDefaultOptions)
    };

    $scope.make2DChartReload = function() {
      $timeout(function(){$scope.$broadcast('visible');});

    };

    $scope.show2DChart = function () {
      $scope.make2DChartReload ();
      $scope.visible2D = !$scope.visible2D;
    };

    $scope.show3DChart = function() {
      $scope.visible3D = !$scope.visible3D;
    };
  });
