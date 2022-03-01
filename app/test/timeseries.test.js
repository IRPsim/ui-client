'use strict';

describe('Service: TimeseriesAggregators + TimeseriesFetcher', function () {

  var timeseriesAggregatorsService, timeseriesFetcher, $httpBackend, $rootScope;

  beforeEach(module('irpsimApp'));

  beforeEach(inject(function (_TimeseriesAggregators_, _TimeseriesFetcher_, _$httpBackend_, _$rootScope_) {
    $httpBackend = _$httpBackend_;
    timeseriesAggregatorsService = _TimeseriesAggregators_;
    timeseriesFetcher = _TimeseriesFetcher_;
    $rootScope = _$rootScope_;
  }));

  function loadBackendData() {
    var data1 = readJSON('app/test/data/chartlogic/timeseries2015_1.json');
    var data2 = readJSON('app/test/data/chartlogic/timeseries2015_2.json');

    var modelDef = readJSON('app/test/data/definition.json');
    var parameterSet = readJSON('app/test/data/parameterset.json');

    var seriesNames = ['1', '2'];

    $httpBackend.whenGET(/\.html$/).respond('');
    $httpBackend.when('GET', '/backend/simulation/datensatz').respond(200, []);
    $httpBackend.when('GET', '/backend/simulation/szenariosets').respond(200, []);
    $httpBackend.when('GET', '/backend/simulation/stammdaten?all=true').respond(200, []);
    $httpBackend.when('GET', '/backend/simulation/generalinformation/versions').respond(200, []);
    $httpBackend.when('GET', '/backend/simulation/szenarien').respond(200, {
      1: {
        date: 1472503803000,
        creator: "System",
        name: "Standardkonfiguration",
        modell: "Basismodell",
        deletable: false,
        description: "Standardszenario für ein Jahr mit einer Kundengruppe - Basismodell_full_year.json",
        id: 1
      }
    });
    $httpBackend.when('GET', '/backend/simulation/szenarien/1').respond(200, parameterSet);
    $httpBackend.when('GET', '/backend/simulation/modeldefinitions/1').respond(200, modelDef);
    $httpBackend.when('GET', '/backend/simulation/modeldefinitions').respond(200, {
      1: {
        id: 1,
        name: "Basismodell.json",
        model: "Basismodell"
      }
    });


    $httpBackend.when('GET',
      '/backend/simulation/stammdaten/concretedata?seriesid=1&seriesid=2&start=01.01.-00:00&end=31.12.-23:59&maxcount=35040')
      .respond(200, {
        1: data1['1'],
        2: data2['2']
      });


    var provider = timeseriesFetcher.newDetailDataProvider(seriesNames);
    return provider.fetchData(new Date(2015, 0, 1), new Date(2015, 11, 31, 23, 59, 59), 35040);
  }

  describe('TimeseriesFetcher:', function() {
    it('Loads data from two datasets BY REFERENCE and converts them for further uses.', function () {

      var fetchResult = readJSON('app/test/data/chartlogic/timeseriesFetcherResult.json');

      loadBackendData().then(function(res) {
        expect(JSON.stringify(res)).toEqual(JSON.stringify(fetchResult));
      });

      $httpBackend.flush();
    });

  });

  describe('TimeseriesAggregators:', function() {
    it('Sum up two datasets.', function () {

      var sumResult = readJSON('app/test/data/chartlogic/sumResult.json');

      loadBackendData().then(function(res) {

        expect(JSON.stringify(timeseriesAggregatorsService.sum().aggregate(res))).toEqual(JSON.stringify(sumResult));
      });

      $httpBackend.flush();
    });

    it('Calculate the average of two datasets.', function () {

      var avgResult = readJSON('app/test/data/chartlogic/averageResult.json');

      loadBackendData().then(function(res) {

        expect(JSON.stringify(timeseriesAggregatorsService.average().aggregate(res))).toEqual(JSON.stringify(avgResult));
      });

      $httpBackend.flush();
    });

    it('Build percentiles for two datasets.', function () {

      var percResult = readJSON('app/test/data/chartlogic/percentileResult.json');

      loadBackendData().then(function(res) {

        expect(JSON.stringify(timeseriesAggregatorsService.percentiles([10, 40, 90]).aggregate(res))).toEqual(JSON.stringify(percResult));
      });

      $httpBackend.flush();
    });
  });
});
