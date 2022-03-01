'use strict';

angular.module('irpsimApp')
  .service('Simulations', function ($http, $timeout, $q, ScenarioConfiguration, TimeEstimator, $stateParams) {

    var Simulations = this;

    /*
     ID of the currently loaded results. Needed to make sure that no results get loaded more then one time.
     */
    Simulations.loadedResults = [];

    Simulations.currentSimulation = {
      results: {
        urls: {},
        result: []
      },
      state: {
        id: -1,
        type: null,
        time: {},
        running: false,
        text: '',
        scenario: {}
      },
      desc: {
        businessModelDescription: ''
      }
    };
    var cs = Simulations.currentSimulation;
    var state = cs.state;

    Simulations.getAllSimulations = function () {
      return $q.all([
          $http.get('/backend/simulation/simulations/states?modeldefinition=' + $stateParams.modelDefinitionId, {ignoreLoadingBar: true, hideGrowlMessages: true})//,
          // $http.get('/backend/simulation/simulations/queue', {ignoreLoadingBar: true, hideGrowlMessages: true})
        ])
        .then(function (results) { // TODO use queue order for WAITING jobs, currently broken in the backend
          var simulations = results[0].data;//, queue = results[1].data;
          return simulations.reverse();
        });
    };

    Simulations.stopSimulation = function (id, isDelete) {
      var url = '/backend/simulation/simulations/' + id + '?delete=' + isDelete;
      return $http.delete(url, {ignoreLoadingBar: true});
    };

    function loadAndConvert(url, type, tag) {
      return $http.get(url).then(function (results) {
        return ScenarioConfiguration.convertBetweenApiAndEditableVersion(type, results.data, tag, true);
      });
    }


    function getLstFileUrls(id, n, modelindex) {
      return _.times(n, function (n) {
        return '/backend/simulation/simulations/' + id + '/' + n + '/' + modelindex + '/lstfile';
      });
    }

    function getGDXParameterUrls(id, n, modelindex) {
      return _.times(n, function (n) {
        return '/backend/simulation/simulations/' + id + '/' + n + '/' + modelindex + '/gdxparameterfile';
      });
    }

    function getGDXResultUrls(id, n, modelindex) {
      return _.times(n, function (n) {
        return '/backend/simulation/simulations/' + id + '/' + n + '/' + modelindex + '/gdxresultfile';
      });
    }

    function getCSVUrls(id, n, modelindex) {
      return _.times(n, function (n) {
        return '/backend/simulation/simulations/' + id + '/' + n + '/' + modelindex + '/csvfile';
      });
    }

    /**
     * Generates a list of urls for bulk images request
     * @param {Number} id simulation id
     * @param {Number} n year index
     * @param {Number} modelindex index of the model
     * @returns {Array} list of urls for bulk images request
     */
    function getImagesZipUrls(id, n, modelindex) {
      return _.times(n, function (n) {
        return '/backend/simulation/simulations/' + id + '/' + n + '/' + modelindex + '/bulkImages';
      });
    }

    /**
     * Does a http get request to determine if bulk images are available
     * @param {Number} id simulation id
     * @param {Number} n year index
     * @param {Number} modelindex index of the model
     * @returns {Object} result of http request
     */
    async function checkZipAvailable(id, n, modelindex) {
      if (n > 0) { // Fix for wrong n // TODO: needs further testing
        n -= 1;
      }

      var result = undefined

      try {
        result = await $http.get('/backend/simulation/simulations/' + id + '/' + n + '/' + modelindex + '/bulkImagesExists');
      } catch (err) {
        console.log(err)
      }

      return result
    }

    Simulations.hasAlreadyBeenAdded = function (id) {
      return Simulations.loadedResults.indexOf(id) !== -1;
    };

    Simulations.addResults = function (id, type) {
      if (cs.results && !Simulations.hasAlreadyBeenAdded(id)) {
        Simulations.loadedResults.push(id);
        Simulations.loadResults(id, type).then(function (obj) {
          cs.results.result = ScenarioConfiguration.mergeIntoScenario(cs.results.result, obj.result);
        });
      }
    };

    /*
     Parameters might refer to sets of the input scenario. We need to refer to both when showing
     results. Since all elements have at least one of the tags 'input' or 'output' set, we can still
     refer to them when deciding which parameters to render
     */
    function enrichResults(inputYears, outputYears) {
      _.forEach(outputYears, function (outputYear) {
        _.forEach(inputYears[0].sets, function (s, setName) {
          var out = outputYear.sets[setName];
          // TODO reconstruct necessary set elements from tables, avoids huge number of empty tabs
          if (!out) {
            out = outputYear.sets[setName] = {names: [], values: {}};
          }
          _.forEach(_.difference(s.names, out.names), function (missingName) {
            out.names.push(missingName);
            out.values[missingName] = {};
          });
        });
      });
    }

    Simulations.loadResults = function (id, type, progress) {
      var inProgress = angular.isDefined(progress) ? progress < 1.0 : false;
      return loadAndConvert('/backend/simulation/simulations/' + id + '/results', type, 'output', {ignoreLoadingBar: inProgress}).then(function (results) {
        var urls = [];
        _.forEach(results, async function (result, resultIndex) {
          enrichResults(state.scenario[resultIndex].years, result.years);
          var years = state.scenario[resultIndex].years.length;
          var n = Math.floor(progress * years);
          var zipAvailable = await checkZipAvailable(id, n, resultIndex);

          urls.push({
            // always show link for GDX input file for currently active job.
            gdxparameterfileUrls: getGDXParameterUrls(id, (progress < 1.0)? n+1:n, resultIndex),
            lstfileUrls: getLstFileUrls(id, n, resultIndex), // todo
            csvfileUrls: getCSVUrls(id, n, resultIndex),
            gdxresultfileUrls: getGDXResultUrls(id, n, resultIndex),
            imagesZipUrls: zipAvailable && zipAvailable.data ? getImagesZipUrls(id, n , resultIndex) : []
          });
        });

        var res = {
          result: results,
          urls: urls
        };
        return res;
      });
    };

    Simulations.loadParameterset = function (id, type) {
      return loadAndConvert('/backend/simulation/simulations/' + id + '/parameterset', type, 'input');
    };

    /***************** Submit simulations, collect results ***************************************/

    function runSimulationStatusUpdater(timeoutMS,isInitial) {
      function updateResults(progress) {
        // fetch final results
        Simulations.loadResults(state.id, state.type, progress).then(function (results) {
          cs.results = results;
          _.forEach(results.result, function (result) {
            var outputYears = result.years;
            for (var i = 0; i < outputYears.length; i++) {
              // if these results are intermediate we have average timeseries values once per day
              var cfg = outputYears[i].config;
              if (progress < 1.0) {
                //cfg.timestep = cfg.saveLength * cfg.timestep; // backend sends zeroes
                cfg.timestep = 24;
              }
            }
          });
        });
      }
      if(isInitial){
        updateResults(0.0);
      }

      $timeout(function () {
        $http.get('/backend/simulation/simulations/' + state.id, {ignoreLoadingBar: true}).then(function (response) {
          var d = response.data;
          state.text = d.stateDesc;
          var estimation = state.estimator.update(d.finishedsteps);
          if (state.cancelled) {
            var f = function () {
              state.time = {};
              state.running = false;
              state.text = 'Abgebrochen';
              cs.results.urls = {};
            };
            Simulations.stopSimulation(state.id).then(f).catch(f);
          } else {
            var weHaveProgress = state.time.percentage < estimation.percentage;
            state.time = estimation;
            state.running = d.running || d.state === 'WAITING'; // simulation is running or in waiting list
            // always show at least the link to the GDX input file of the first simulation year
            _.forEach(state.scenario, function (scen,  index) {
              _.set(cs.results, ['urls','gdxparameterfileUrls', index], getGDXParameterUrls(state.id, Math.max(1, Math.floor(estimation.percentage * scen.years.length))));
            });
            if (state.running) {
              if (weHaveProgress) {
                updateResults(estimation.percentage);
                var progressDuration = state.time.now - (state.lastProgress || state.time.now);
                state.lastProgress = state.time.now;
                //console.info('will ask for new progress in',progressDuration/2);
                runSimulationStatusUpdater(Math.max(timeoutMS, progressDuration / 2));
              } else {
                runSimulationStatusUpdater(timeoutMS);
              }
            } else {
              if (d.error) {
                var urls = [];
                _.forEach(state.scenario, function (scen, index) {
                  var n = scen.years.length;
                  urls.push({
                    gdxparameterfileUrls: getGDXParameterUrls(state.id, n, index),
                    lstfileUrls: getLstFileUrls(state.id, n, index)
                  });
                });
                state.time = {};
                state.running = false;
                state.error = true;
                cs.results.urls = urls;
              } else {
                updateResults(estimation.percentage);
              }
            }
          }
        });
      }, timeoutMS);
    }

    Simulations.cancelSimulation = function () {
      Simulations.currentSimulation.state.cancelled = true;
    };

    function getMaximum(scenario) {
      var maximum = 0;
      _.forEach(scenario, function (scen) {
        maximum += scen.years[0].config.simulationlength * scen.years.length;
      });
      return maximum;
    }

    function getStepLength(scenario) {
      var stepLength = 0;
      _.forEach(scenario, function (scen) {
        stepLength += scen.years[0].config.savelength;
      });
      return stepLength;
    }

    Simulations.submitSimulation = function (type, scenario) {
      cs.results = {};
      state.error = false;
      state.type = type;
      state.scenario = scenario;

      var convertedScenario;
      var convertedModels = ScenarioConfiguration.convertBetweenApiAndEditableVersion(type, scenario, 'input', false);
      var models = [];
      convertedModels.forEach(function(convertedModel) {
        models.push({postprocessing: convertedModel.postprocessing, 'years': convertedModel.years});
      });
      convertedScenario = {
        description: scenario.description,
        models: models
      };

      return $http.post('/backend/simulation/simulations?type=' + type + '&onlystart=true', convertedScenario)
        .then(function (response) {
            var simulationID = response.data[0];
            state.id = simulationID;
            state.estimator = TimeEstimator.startEstimation(getMaximum(scenario), getStepLength(scenario));
            state.running = true;
            state.cancelled = false;
            runSimulationStatusUpdater(4000);
            return simulationID;
          },
          function () {
            state.text = 'Fehler beim Start des Simulationslaufes';
            state.running = false;
          });
    };

    Simulations.attachToRunningSimulation = function (type, simulation) {

      if (simulation.description) {
        cs.desc.businessModelDescription = simulation.description.businessModelDescription;
      }
      Simulations.loadedResults = [simulation.id]; // makes sure that this simulation run does not get added for comparison to itself.

      return Simulations.loadParameterset(simulation.id, type).then(function (scenario) {
        cs.results = {};
        state.error = false;
        state.type = type;
        state.scenario = scenario;
        state.id = simulation.id;
        if (!simulation.end) {
          // simulation is still running, attach to it using a running time estimator
          state.estimator = TimeEstimator.startEstimation(getMaximum(scenario), getStepLength(scenario), simulation.start);
        } else {
          // simulation has finished, use a mock time estimator
          state.estimator = {
            update: function () {
              var startTime = new Date(), endTime = new Date();
              startTime.setTime(simulation.start);
              endTime.setTime(simulation.end);
              return {
                toGo: 0,
                start: startTime,
                end: endTime,
                overall: TimeEstimator.getTimeDifference(simulation.end - simulation.start),
                percentage: 1.0
              };
            },
            getProgress: function () {
              return 1.0;
            }
          };
        }
        runSimulationStatusUpdater(1000, true);
      });
    };

    Simulations.changeQueue = function (ids) {
      return $http.put('/backend/simulation/simulations/queue', ids);
    };
  });
