'use strict';

/**
 * @ngdoc function
 * @name irpsimApp.controller:GdxFilterCtrl
 * @description
 * # GdxFilterCtrl
 * Controller of the irpsimApp. Handles filtering of GDX files.
 */
angular.module('irpsimApp').controller('GdxFilterCtrl', function ($scope, $stateParams, $filter, $http, $q, Logger, $log, growl, $timeout, $uibModal, JSZip, saveAs, gdxFilterService, $mdDialog) {
  var vm = this; // bind GdxFilterCtrl to vm

  /**
   * Load possible options for set_ii from the backend on init
   */
  this.$onInit = function () {
    gdxFilterService.getSetIiOptions().then(function (resp) {
      vm.setIiOptions = resp.options;
      vm.setIiOptionDefault = resp.options[0];
    });
  };
  $log.debug('GdxFilterCtrl', vm, $stateParams); // check vm and params

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Variables
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  vm.errorLoading = false; // true if parameters cannot be fetched
  vm.errorLoadingForYears = false; // true if errors while loading years of one simulation
  vm.errorLoadingSimulationResults = {};
  vm.exportConfiguration = {timeseries: {}, scalar: {}}; // set configs for chosen parameters by user
  vm.isExporting = false; // if requests are made, set isExporting to true due to disabling the export button
  vm.isLoading = false; // indicate if still requesting parameter list
  vm.isLoadingGdxForYears = false; // true if GDX parameter are requested
  vm.parameters = {}; // results of parameter request
  vm.selParameters = {}; // ngTagsInput selected parameters
  vm.selSimulations = []; // holds selected simulations
  vm.selYears = {}; // holds selected years
  vm.simulationId = $stateParams.id; // bind simulation id to vm
  vm.simulations = []; // holds simulations
  vm.simulationYear = $stateParams.year; // bind year to vm
  vm.years = { // holds possible years of one simulation
    //1: []
  };
  vm.image = null;

  vm.add = add;
  vm.download = download;
  vm.getParameters = getParameters;
  vm.getSimulations = getSimulations;
  vm.getSimulationResults = getSimulationResults;
  vm.initExportConfiguration = initExportConfiguration;
  vm.itemsForParameterSet = itemsForParameterSet;
  vm.onChange = onChange;
  vm.ValidateConfig = ValidateConfig;
  vm.onBeforeSave = onBeforeSave;
  vm.onTagAddedYear = onTagAddedYear;
  vm.onTagRemoved = onTagRemoved;
  vm.onTagRemovedSimulation = onTagRemovedSimulation;
  vm.onTagRemovedYear = onTagRemovedYear;
  vm.remove = remove;
  vm.combination = combination;
  vm.reset = reset;
  vm.setParameterConfig = setParameterConfig;
  vm.takeOver = takeOver;
  vm.simulationConfigSave = simulationConfigSave;
  vm.simulationConfigLoad = simulationConfigLoad;
  vm.hasKeys = hasKeys;

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Private Functions
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Checks if the parameter config is valid.
   * Valid means all setNames have one item.
   * E.g.
   * ["E","EGrid","load_E1"] is valid
   * ["E","EGrid",""] is not valid
   * @param {Array} config looks like ["E","EGrid","load_E1"]
   * @returns {boolean} is whether true or false
   */
  function isValidConfig(configs, simulationId, yearId, parameterName) {
    if (vm.parameters[simulationId][yearId][parameterName].dependencies.length === 0) {
      return true;
    }
    var isValid = true;
    configs.forEach(function (config) {
      config.forEach(function (element) {
        if (element === '') {
          isValid = false;
          return; // leave loop on after set isValid to false
        }
      });
    });
    return isValid;
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // View Model Functions
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Add another parameter configuration for one year.
   * @param {Number} simulationId ID of chosen simulation
   * @param {Number} parameterYearId parameter's year id
   * @param {String} parameterName parameter that should be removed
   * @param {Object} configParameter metadata of selected parameter
   */
  function add(simulationId, parameterYearId, parameterName, configParameter) {
    $log.debug('add function configParameter:', configParameter);
    var newConfigParameter = angular.copy(configParameter);
    newConfigParameter.isEditing = true;
    newConfigParameter.combinationCount = 1;
    newConfigParameter.autoFillIndex = -1;
    newConfigParameter.setIi = vm.setIiOptionDefault;
    var setIdx = 0;
    for (var set in newConfigParameter.sets) {
      var firstCombination = newConfigParameter.sets[set][0];
      newConfigParameter.sets[set] = [];
      newConfigParameter.sets[set].push(firstCombination);
      newConfigParameter.sets[set][0].value = '';
      if (setIdx === 0) {
        newConfigParameter.sets[set][0].disabled = false;
      } else {
        newConfigParameter.sets[set][0].disabled = true;
      }
      setIdx++;
    }
    vm.exportConfiguration[simulationId][parameterYearId][parameterName].push(newConfigParameter);
  }

  function getConfigs(configParameter) {
    var configs = [];
    $log.debug('configParameter', configParameter);
    for (var i = 0; i < configParameter.combinationCount; i++) {
      configs.push([]);
    }
    for (var setName in configParameter.sets) {
      $log.debug(configParameter.sets, setName);
      for (var k = 0; k < configParameter.combinationCount; k++) {
        configs[k].push(configParameter['sets'][setName][k].value);
      }
    }
    return configs;
  }

  function getPutData() {
    var putData = [];
    var noValidConfigForParameter = [];
    var totalConfigsLength = 0;
    for (var simulationId in vm.exportConfiguration) {
      for (var yearId in vm.exportConfiguration[simulationId]) {
        // putData for one simulation and year
        var putDataSimulation = {
          simulationid: simulationId,
          year: yearId,
          modelindex: vm.selYears[simulationId][yearId].modelindex,
          parameters: {}
        };
        // iterate over selected parameters with simulationid and yearid
        for (var parameterName in vm.exportConfiguration[simulationId][yearId]) {
          /* jshint loopfunc:true */
          vm.exportConfiguration[simulationId][yearId][parameterName].forEach(function (configParameter) {
            // raise config counter (used for growl notification and whether doing requests or not)
            totalConfigsLength++;
            // create config structure for backend
            $log.debug('configs', getConfigs(configParameter), isValidConfig(getConfigs(configParameter), simulationId, yearId, parameterName));
            if (isValidConfig(getConfigs(configParameter), simulationId, yearId, parameterName)) {
              putDataSimulation.parameters[parameterName] = {
                'set_ii': configParameter.setIi,
                'combinations': getConfigs(configParameter)
              };
            } else {
              noValidConfigForParameter.push(parameterName);
            }
          });
        }
        // push putDataSimulation to global putData
        putData.push(putDataSimulation);
      }
    }

    return {
      'totalConfigsLength': totalConfigsLength,
      'noValidConfigForParameter': noValidConfigForParameter,
      'putData': putData
    };
  }

  /**
   * Check if an object has any key
   * @param {Object} object: an object test if it has any key
   * @returns {Boolean} true, if any key is present, false if no keys
   */
  function hasKeys(object) {
    return Object.keys(object).length > 0
  }

  /**
   * Get the url and responsetype for a given type of result file
   * @param {String} type the type of the result file
   * @returns {Object} url and responsetype
   */
  function getPutUrl(type) {
    var putUrl = '';
    var responseType = '';
    vm.image = null;
    switch (type) {
      case 'export':
        putUrl = '/backend/simulation/simulations/gdxresultfile/csvalues';
        responseType = 'arraybuffer';
        break;
      case 'comparison':
        putUrl = '/backend/simulation/simulations/gdxresultfile/gegenueberstellung';
        responseType = 'arraybuffer';
        break;
      case 'comparison-preview':
        putUrl = '/backend/simulation/simulations/gdxresultfile/gegenueberstellung/png';
        responseType = 'arraybuffer';
        break;
      case 'cost-revenue':
        putUrl = '/backend/simulation/simulations/gdxresultfile/kostenumsatz';
        responseType = 'arraybuffer';
        break;
      case 'cost-revenue-preview':
        putUrl = '/backend/simulation/simulations/gdxresultfile/kostenumsatz/png';
        responseType = 'arraybuffer';
        break;
      default:
        growl.error('Fehler beim Download!');
    }
    return {'putUrl': putUrl, 'responseType': responseType};
  }

  /**
   *
   * @param {Object} putData url and responsetype
   * @param {String} type the type of the result file
   * @returns {Promise} A Promise of the http request
   */
  function getPromises(putData, type) {
    var promises = [];
    var response = getPutUrl(type);

    if (putData.length > 0) {
      vm.isExporting = true; // disable export button
      promises.push($http.put(response.putUrl, putData, {
        parameterType: 'export',
        responseType: response.responseType
      }));
    }

    return promises;
  }

  /**
   * Generate a zip file for the csv file
   * @param {Object} csvResponses response with csv data
   */
  function generateZip(csvResponses) {
    var zip = new JSZip();
    csvResponses.forEach(function (csv) {
      $log.debug('csv data', csv);
      zip.file(csv.config.parameterType + '.csv', csv.data, {type: 'text/csv;charset=utf-8'});
    });
    // generate archive
    zip.generateAsync({type: 'blob', compression: 'DEFLATE'}).then(function (content) {
      saveAs(content, 'export.zip'); // FileSaver.js
      vm.isExporting = false;// enable export button
    });
  }

  /**
   * Save zip file
   * @param {Object} csvResponses response with csv data
   */
  function saveZip(csvResponses) {
    var blob = new Blob([csvResponses[0].data], { type: 'application/zip' });
    saveAs(blob, 'comparison.zip');
    vm.isExporting = false;// enable export button
  }

  /**
   * Show preview image
   * @param {Object} response response with image data
   */
  function showPreview(response) {
    vm.image = 'data:image/png;base64,' + _arrayBufferToBase64(response[0].data);
    vm.isExporting = false;// enable export button
  }

  /**
   * Convert an image buffer to base64
   * @param {Buffer} buffer image data as buffer
   * @returns {String} base64 image
   */
  function _arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Process response date with different cases
   * @param {Object} response response data
   * @param {String} type the type of the result file
   */
  function processResponse(response, type) {
    $log.debug('response', response);
    switch (type) {
      case 'export':
        generateZip(response);
        break;
      case 'comparison':
        saveZip(response);
        break;
      case 'comparison-preview':
        showPreview(response);
        break;
      case 'cost-revenue':
        saveZip(response);
        break;
      case 'cost-revenue-preview':
        showPreview(response);
        break;
      default:
        growl.error('Fehler beim Download!');
    }
  }

  /**
   * Download the generated file
   * @param {String} type the type of the result file
   */
  function download(type) {
    var resp = getPutData();
    var totalConfigsLength = resp.totalConfigsLength;
    var noValidConfigForParameter = resp.noValidConfigForParameter;
    var putData = resp.putData;

    $log.debug('PUT data', putData);

    // if all configs are invalid, show growl notifcation and don't do any http requests
    if (totalConfigsLength === noValidConfigForParameter.length) {
      growl.warning('Keine gültige Parameter-Konfiguration für einen Export definiert');
      vm.isExporting = false; // enable export button
    } else {

      var promises = getPromises(putData, type);

      $q.all(promises).then(function success(response) {
        processResponse(response, type);

        // show user hints if a parameter config was ignored
        if (noValidConfigForParameter.length > 0) {
          Logger.addLog({
            title: 'Ungültige Parameter-Konfiguration',
            text: noValidConfigForParameter.join('<br>') + '<br> wurde(n) ignoriert.',
            severity: 'warning',
            notify: true
          });
        }
      }, function error() {
        growl.error('Es ist ein Fehler beim Exportieren aufgetreten. Bitte versuchen Sie es erneut.');
        vm.isExporting = false; // enable export button
      });
    }
  }

  function setSimValues(simulationId, selYears, exportConfiguration, selParameters) {
    vm.selYears[simulationId] = JSON.parse(JSON.stringify(selYears)); // create copy of object
    delete vm.parameters[simulationId];
    vm.selYears[simulationId].forEach(function (years) {
      getParameters(simulationId, years.yearIdx, years.modelindex);
    });
    // vm.parameter[simulationId] = JSON.parse(JSON.stringify(parameter)); // create copy of object
    vm.exportConfiguration[simulationId] = JSON.parse(JSON.stringify(exportConfiguration));
    // timeout needed cause of async call before
    setTimeout(function () {
      vm.selParameters[simulationId] = JSON.parse(JSON.stringify(selParameters)); // create copy of object
    }, 1000);
  }

  /**
   * Take over current simulation config for selected years
   * @param {Number} tabId simulation id
   */
  function takeOver(tabId) {
    if (vm.selYears[tabId] === {}) {
      $log.debug('empty year, nothing to copy');
    } else {
      vm.selSimulations.forEach(function (simulation) {
        if (simulation.id !== tabId) {
          setSimValues(simulation.id, vm.selYears[tabId], vm.exportConfiguration[tabId], vm.selParameters[tabId]);
        }
      });
    }
  }

  /**
   * Save simulation config in current selected tab
   * @param {Number} tabId simulation id
   * @param {Event} event click event
   */
  function simulationConfigSave(tabId, event) {
    $mdDialog.show({
      controller: 'GdxConfigSaveCtrl',
      templateUrl: 'components/gdx/config-save.html',
      parent: angular.element(document.body),
      targetEvent: event,
      clickOutsideToClose: true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
      .then(function (answer) {
        gdxFilterService.saveExportConfig(answer.name, answer.creator, {
          selParameters: vm.selParameters[tabId],
          selYears: vm.selYears[tabId],
          exportConfiguration: vm.exportConfiguration[tabId],
        }).then(function () {
          growl.info('Die Konfiguration wurde gespeichert.');
        });
      }, function () {
      });
  }

  /**
   * Load simulation config in current selected tab
   * @param {*} tabId simulation id
   * @param {*} event click event
   */
  function simulationConfigLoad(tabId, event) {
    $mdDialog.show({
      controller: 'GdxConfigLoadCtrl',
      templateUrl: 'components/gdx/config-load.html',
      parent: angular.element(document.body),
      targetEvent: event,
      clickOutsideToClose: true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
      .then(function (answer) {
        console.log('answer', answer);
        var valid = isSelYearsAnwserValid(answer.selYears) ;
        console.log('valid', valid);
        if (valid) {
          setSimValues(tabId, answer.selYears, answer.exportConfiguration, answer.selParameters);

        } else {
          var newSelYears = patchOldConfigurations(answer.selYears)
          setSimValues(tabId, newSelYears, answer.exportConfiguration, answer.selParameters);
        }


      }, function () {
      });
  }

  function isSelYearsAnwserValid(selYears) {
    if (selYears.length === 0 ) {
      return true;
    } else {
      var isValid = true
      selYears.forEach(function (selYear) {
        if(typeof selYear.label === 'undefined' || selYear.label === ''){
            isValid = false;
        }
        if(typeof selYear.id === 'undefined' || selYear.id === ''){
            isValid = false;
        }
        if(typeof selYear.yearIdx === 'undefined' || selYear.yearIdx === '') {
            isValid = false;
        }
        if(typeof selYear.modelindex === 'undefined' || selYear.modelindex === ''){
            isValid = false;
        }
        if (!isValid) {
          return;
        }
      });
      return isValid;
    }
  }

  /**
   * Replaces missing information in years with zeros
   * @param {Object} selYears selected years
   * @returns {Object} patched selected years
   */
  function patchOldConfigurations(selYears) {
    var newSelYears = [];
    selYears.forEach(function (year){
      newSelYears.push({label: year.label + '(' + 0 + ')', id: year.id + '' +  0, yearIdx: 0, modelindex: 0});
    })
    return newSelYears;
  }

  /**
   * Get parameters of GDX file from optimization run with
   * given id and year.
   * @param {Number} simulationId ID of simulation
   * @param {Number} simulationYear year of one simulation
   */
  function getParameters(simulationId, simulationYear, modelindex) {
    if (simulationId !== null && simulationYear !== null) {
      // init simulation id object if it does not exist
      if (!vm.parameters.hasOwnProperty(simulationId)) {
        vm.parameters[simulationId] = {};
      }
      // if not cached, retrieve parameters
      if (!vm.parameters[simulationId].hasOwnProperty(simulationYear)) {
        vm.parameters[simulationId][simulationYear] = {};

        vm.isLoading = true;
        var parameterUrl = '/backend/simulation/simulations/' +
          simulationId +
          '/' +
          simulationYear +
          '/' + modelindex +
          '/gdxcsvparameters';
        $http.get(parameterUrl).then(function (response) {
          $log.debug('parameters', response.data);
          vm.isLoading = false;
          vm.parameters[simulationId][simulationYear] = response.data;
        }, function () {
          vm.errorLoading = true;
          growl.error('Fehler beim Abrufen der Parameter. Bitte versuchen Sie es erneut.');
          // remove added year due to error
          vm.selYears[simulationId].forEach(function (year, yearIdx, yearArr) {
            if (Number(year.id) === Number(simulationYear)) {
              yearArr.splice(yearIdx, 1);
            }
          });
          delete vm.parameters[simulationId][simulationYear];
          // disable loading spinner
          vm.isLoading = false;
        });
      }
    } else {
      Logger.addLog({
        text: 'Simulations-ID und/oder Jahr nicht verfügbar. Extrahieren der Parameter aus GDX nicht möglich.',
        severity: 'error',
        notify: true
      });
    }
  }

  /**
   * Receive all simulations. Used to choose a simulation from ngTagsInput.
   */
  function getSimulations() {
    var simulationsUrl = '/backend/simulation/simulations/states';
    $http.get(simulationsUrl).then(function success(response) {
      $log.debug('simulations', response.data);
      var matchParamSimulationId = false;
      vm.simulations = _.map(response.data, function (s) {
        // set state parameter simulation if available
        if (Number(vm.simulationId) === Number(s.id)) {
          $log.debug('detect match for given state parameter simulation id', s.id, vm.simulationId);
          matchParamSimulationId = true;
          vm.selSimulations.push({
            id: s.id,
            label: s.description.businessModelDescription,
            creator: s.description.creator,
            tagLabel: s.description.businessModelDescription + ' [ID: ' + s.id + ']'
          });
        }
        return {
          id: s.id,
          label: s.description.businessModelDescription,
          creator: s.description.creator,
          tagLabel: s.description.businessModelDescription + ' [ID: ' + s.id + ']'
        };
      }, function error() {
        growl.error('Fehler beim Laden der Jahre für die ausgewählte Simulation.');
      });

      // show growl message if given simulation id does not exist
      if (!matchParamSimulationId && vm.simulationId) {
        growl.info('Die Simulation mit ID ' + vm.simulationId + ' existiert nicht.');
      }

    });
  }

  /**
   * Receive result of selected simulation.
   * Used to extract simulation years and choose from ngTagsInput
   * @param {Number} id simulation id
   */
  function getSimulationResults(id) {
    var simulationResultsUrl = '/backend/simulation/simulations/' + id + '/results';
    $http.get(simulationResultsUrl).then(function success(response) {
      vm.errorLoadingSimulationResults[id] = false;
      // create data structure for ngTagsInput
      var availableYearsForSimulation = [];
      var detectMatchForSimulationIdAndYearId = false;
      _.forEach(response.data.models, function (model, modelindex) {
        model.years.forEach(function (simulationYear, yearIdx) {
          if (simulationYear) {
            // set state parameter year if available (if no simulationYear was set, it will be "null")
            if (vm.simulationYear && Number(vm.simulationYear) === Number(yearIdx) && Number(vm.simulationId) === Number(id)) {
              detectMatchForSimulationIdAndYearId = true;
              $log.debug('detect match for given state parameter simulation year id', yearIdx, vm.simulationYear);
              vm.selYears[id] = [{label: simulationYear.config.year + '(' + modelindex + ')', id: yearIdx + '' + modelindex, yearIdx: yearIdx, modelindex: modelindex}];
              // query parameter for year
              vm.getParameters(id, yearIdx, modelindex);
            }
            availableYearsForSimulation.push({label: simulationYear.config.year + '(' + modelindex + ')', id: yearIdx + '' +  modelindex, yearIdx: yearIdx, modelindex: modelindex});
          }
        });
      });

      if (!detectMatchForSimulationIdAndYearId && vm.simulationId && vm.simulationYear) {
        growl.info('Die Simulation mit ID ' + id + ' besitzt kein Jahr mit ID ' + vm.simulationYear);
      }

      $log.debug('simulation results for id ', id, response.data, availableYearsForSimulation);
      vm.years[id] = availableYearsForSimulation;
    }, function error() {
      vm.errorLoadingSimulationResults[id] = true;
      growl.error('Fehler beim Laden der Simualations-Ergebnisse. Bitte versuchen Sie es erneut.');
    });
  }

  /**
   * The export configuration collects all parameters which should be configured
   * by the user for an export.It holds information about the editing process (disabled),
   * the selected setName item (value) and all possible select setName items (items).
   * @param {Number} simulationId ID of chosen simulation
   * @param {Number} parameterYearId parameter's year id
   * @param {String} parameterName parameter that should be configured
   */
  function initExportConfiguration(simulationId, parameterYearId, parameterName) {
    $log.debug('parameter data', vm.parameters[simulationId][parameterYearId][parameterName], simulationId, parameterYearId, parameterName);

    var hasOnlyOneValue = false;
    if (vm.parameters[simulationId][parameterYearId][parameterName].dependencies[0] && vm.parameters[simulationId][parameterYearId][parameterName].dependencies[0].length === 0) {
      hasOnlyOneValue = true;
    }

    // init exportConfiguration for simulation id
    // debugger
    vm.exportConfiguration[simulationId] = vm.exportConfiguration[simulationId] || {};
    // init exportConfiguration for parameter
    vm.exportConfiguration[simulationId][parameterYearId] = vm.exportConfiguration[simulationId][parameterYearId] || {};

    vm.exportConfiguration[simulationId][parameterYearId][parameterName] = vm.exportConfiguration[simulationId][parameterYearId][parameterName] || [];
    $log.debug('exportConfiguration data', vm.exportConfiguration[simulationId][parameterYearId][parameterName]);
    if (vm.exportConfiguration[simulationId][parameterYearId][parameterName].length === 0) {

      var parameterSetting = {
        label: parameterName,
        isEditing: hasOnlyOneValue ? false : true,
        isValid: false,
        hasOnlyOneValue: hasOnlyOneValue,
        sets: {},
        combinationCount: 1,
        autoFillIndex: -1,
        setIi: vm.setIiOptionDefault,
        scalar: vm.parameters[simulationId][parameterYearId][parameterName].scalar,
      };

      // parameter data from gdx with sets and dependencies
      var pData = vm.parameters[simulationId][parameterYearId][parameterName];

      pData.sets.forEach(function (setName, setIdx) {
        var possibleSetItems = []; // list of all possible set items

        // create list of possible set items
        pData.dependencies.forEach(function (setConfig) {
          if (setConfig[setIdx]) {
            possibleSetItems.push(setConfig[setIdx]);
          }
        });

        // create structure for angular-xeditable select
        parameterSetting['sets'][setName] = [];
        parameterSetting['sets'][setName].push({
          disabled: setIdx === 0 ? false : true,
          value: '',
          items: [],
        })

        ;
      });

      // push to exportConfiguration
      vm.exportConfiguration[simulationId][parameterYearId][parameterName].push(parameterSetting);

    }
  }

  /**
   * Returns all possible items for angular-xeditable select
   * @param {Number} simulationId ID of chosen simulation
   * @param {Number} parameterYearId parameter's year id
   * @param {String} parameterName parameter's name
   * @param {String} setName set for parameter
   * @param {Number} configId index of parameter's config for one year
   */
  function itemsForParameterSet(simulationId, parameterYearId, parameterName, setName, configId, combination) {

    var pData = vm.parameters[simulationId][parameterYearId][parameterName]; // parameter data from gdx with sets and dependencies
    var setIdx = pData.sets.indexOf(setName); // set index, useful to extract possible set items

    // 1. Get current configuration
    // will be required to extract possible value for set
    var currConfig = [];
    for (var s in vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId]['sets']) {
      currConfig.push(vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId]['sets'][s][combination].value);
    }
    $log.debug('currConfig', currConfig);

    // 2. Find matching configs
    var matchConfig = [];
    pData.dependencies.forEach(function (paramConfig) {
      var match = true;
      for (var i = 0; i < setIdx; i++) {
        $log.debug('compare config elements', currConfig, paramConfig, currConfig[i] !== paramConfig[i], i);
        if (currConfig[i] !== paramConfig[i]) {
          match = false;
          $log.debug('leave loop because no match');
          break;
        }
      }
      if (match) {
        matchConfig.push(paramConfig);
      }
    });

    // 3. Extract possible set items for parameter set name
    var possibleSetItems = []; // list of all possible set name items for given parameter set
    matchConfig.forEach(function (c) {
      possibleSetItems.push(c[setIdx]);
    });

    $log.debug('possibleSetItems', possibleSetItems);

    // 4. Create structure for angular-xeditable select
    // set only distinct values for items
    vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId]['sets'][setName][combination].items = _.unique(possibleSetItems);
  }

  function onChange(simulationId, parameterYearId, parameterName, setName, configId, combination, parentIndex) {
    var loopCount = 0;
    for (var s in vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId]['sets']) {
      var set = vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId]['sets'][s][combination];
      if (loopCount <= parentIndex) {
        set.disabled = false;
      } else {
        set.value = '';
        if (loopCount <= parentIndex + 1) {
          set.disabled = false;
        } else {
          set.disabled = true;
        }
      }
      loopCount++;
    }

    vm.ValidateConfig(simulationId, parameterYearId, parameterName, setName, configId);

  }

  function ValidateConfig(simulationId, parameterYearId, parameterName, setName, configId) {
    var isValid = isValidConfig(getConfigs(vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId]), simulationId, parameterYearId, parameterName);
    vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].isValid = isValid;
    if (isValid) {
      growl.success('Parameter <em>' + parameterName + '</em> vollständig konfiguriert');
    }
  }

  /**
   * Validation of user selection for angular-xeditable-select.
   * If nothing was selected show message.
   * @param {String} data
   * @returns {string} msg Message that will be shown if invalid
   */
  function onBeforeSave(value) {
    $log.debug('onBeforeSave', value, typeof (value));
    if (value.length === 0) {
      return 'Bitte Set-Element auswählen';
    }
  }

  /**
   * Triggered if user add a new year.
   * @param {Number} simulationId ID of chosen simulation
   * @param {Object} $tag tag of ngTagsInput
   */
  function onTagAddedYear(simulationId, $tag) {
    $log.debug('onTagAddedYear', simulationId, $tag);
    vm.getParameters(simulationId, $tag.yearIdx, $tag.modelindex);
  }

  /**
   * Remove the removed tag (ngTagsInput) from export configuration object.
   * The export configuration object will be used for building the put data
   * which will be send to export endpoint.
   * @param {Number} simulationId ID of chosen simulation
   * @param {Object} parameterTag tag of ngTagsInput
   */
  function onTagRemoved(simulationId, parameterTag) {
    $log.debug('Removed: parameterName', simulationId, parameterTag);
    // remove parameter from export configuration (do not use it for put request)
    delete vm.exportConfiguration[simulationId][parameterTag.year][parameterTag.label];
    $log.debug('export configuration', vm.exportConfiguration);
  }

  /**
   * Triggered if the user remove a simulation tag.
   * @param {Object} simulationTag tag of ngTagsInput
   */
  function onTagRemovedSimulation(simulationTag) {
    $log.debug('remove simulation', simulationTag);
    // remove parameter list
    delete vm.parameters[simulationTag.id];
    // reset all variables which refers removed simulation
    delete vm.selParameters[simulationTag.id]; // ngTagsInput
    delete vm.years[simulationTag.id]; // all available years for simulation
    delete vm.selYears[simulationTag.id]; // all selected years for selected simulation
    delete vm.exportConfiguration[simulationTag.id]; // data for export
  }

  /**
   * Triggered if the user remove a year tag.
   * @param {Number} simulationId ID of chosen simulation
   * @param {Object} yearTag tag of ngTagsInput
   */
  function onTagRemovedYear(simulationId, yearTag) {
    $log.debug('remove year', simulationId, yearTag);
    // remove parameter list for year
    delete vm.parameters[simulationId][yearTag.id];
    // delete also selected parameters which refers removed year
    if (vm.exportConfiguration[simulationId]) {
      delete vm.exportConfiguration[simulationId][yearTag.id];
    }
    if (vm.selParameters[simulationId]) {
      var removeParameters = [];
      vm.selParameters[simulationId].forEach(function (parameter) {
        if (Number(parameter.year) === Number(yearTag.id)) { // have to convert ist to Number because of ngTagsInput set the yearId as string
          removeParameters.push(parameter);
        }
      });
      $log.debug('remove parameters', removeParameters);
      // iterate over removed parameters
      removeParameters.forEach(function (parameter) {
        var idx = vm.selParameters[simulationId].indexOf(parameter);
        // remove parameter from selected parameter list
        vm.selParameters[simulationId].splice(idx, 1);
      });
    }
  }

  /**
   * Remove a parameter configuration by year.
   * @param {Number} simulationId ID of chosen simulation
   * @param {Number} parameterYearId parameter's year id
   * @param {String} parameterName parameter that should be removed
   * @param {Number} configId index of parameter's config for one year
   */
  function remove(simulationId, parameterYearId, parameterName, configId) {
    vm.exportConfiguration[simulationId][parameterYearId][parameterName].splice(configId, 1);
    // if parameter has no active configuration delete also the selParameter tag and the parameter of exportConfiguration
    if (vm.exportConfiguration[simulationId][parameterYearId][parameterName].length === 0) {
      vm.selParameters[simulationId].forEach(function (parameter, parameterIdx) {
        if (parameterName === parameter.label) {
          vm.selParameters[simulationId].splice(parameterIdx, 1);
        }
      });
      delete vm.exportConfiguration[simulationId][parameterYearId][parameterName];
    }
  }

  /**
   * Add parameter combination by year.
   * @param {Number} simulationId ID of chosen simulation
   * @param {Number} parameterYearId parameter's year id
   * @param {String} parameterName parameter that should be removed
   * @param {Number} configId index of parameter's config for one year
   */
  function combination(simulationId, parameterYearId, parameterName, configId, configParameter) {
    $log.debug('combination', configParameter);
    var setIdx = 0;
    configParameter.isValid = false;
    configParameter.combinationCount++;
    for (var set in configParameter.sets) {
      configParameter.sets[set].push({});
      var index = configParameter.sets[set].length - 1;
      configParameter.sets[set][index].value = '';
      if (setIdx === 0) {
        configParameter.sets[set][index].disabled = false;
      } else {
        configParameter.sets[set][index].disabled = true;
      }
      setIdx++;
    }
  }

  /**
   * Reset a user configuration for one parameter or reset all configurations
   * of a selected simulation.
   * @param {Number} simulationId ID of chosen simulation
   * @param {Object} configParameter metadata of selected parameter
   */
  function reset(simulationId, configParameter) {
    $log.debug('reset function, configParameter:', configParameter);
    if (configParameter) {
      configParameter.isEditing = true;
      configParameter.isValid = false;
      configParameter.combinationCount = 1;
      configParameter.autoFillIndex = -1;
      configParameter.setIi = vm.setIiOptionDefault;
      var setIdx = 0;
      for (var set in configParameter.sets) {
        configParameter.sets[set] = [];
        configParameter.sets[set].push({});
        configParameter.sets[set][0].value = '';
        if (setIdx === 0) {
          configParameter.sets[set][0].disabled = false;
        } else {
          configParameter.sets[set][0].disabled = true;
        }
        setIdx++;
      }
    } else {
      vm.selParameters[simulationId] = [];
      vm.exportConfiguration[simulationId] = {};
    }
  }

  /**
   * Set a given parameter config instead of selecting each set name one by one.
   * @param {Number} simulationId ID of chosen simulation
   * @param {Number} parameterYearId parameter's year id
   * @param {String} parameterName parameter that should be configured
   * @param {Array} config looks like ["E","EGrid","load_E1"]
   * @param {Number} configId index of one possible parameter config
   */
  function setParameterConfig(simulationId, parameterYearId, parameterName, config, configId) {
    $log.debug('parameterName with config', parameterName, config);
    // set all set name items from given config
    var configIndex = 0;

    if (vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].autoFillIndex <
      vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].combinationCount - 1) {
      vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].autoFillIndex++;
    } else {
      vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].autoFillIndex = 0;
    }
    var autoFillIndex = vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].autoFillIndex;

    for (var set in vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].sets) {
      vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].sets[set][autoFillIndex].value = config[configIndex];
      vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].sets[set][autoFillIndex].items = [config[configIndex]];
      vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].sets[set][autoFillIndex].disabled = true;
      configIndex++;
    }

    // set isEditing to false
    vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].isEditing = false;
    // show growl message that parameter is configured
    var isValid = isValidConfig(getConfigs(vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId]), simulationId, parameterYearId, parameterName);
    vm.exportConfiguration[simulationId][parameterYearId][parameterName][configId].isValid = isValid;
    if (isValid) {
      growl.success('Parameter <em>' + parameterName + '</em> vollständig konfiguriert');
    }
  }

});

/* end of GdxFilterCtrl */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Filter Definitions
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

angular.module('irpsimApp').filter('countConfigurations', function () {
  return function (exportConfiguration) {
    var count = 0;

    for (var sId in exportConfiguration) {
      for (var yId in exportConfiguration[sId]) {
        for (var pName in exportConfiguration[sId][yId]) {
          count += exportConfiguration[sId][yId][pName].length;
        }
      }
    }

    return count; // error
  };
});

angular.module('irpsimApp').filter('countParameter', function () {
  return function (parameters, type) {
    var filteredParameters = [];
    var id = 0; // ngTagsInput need an id if input is an object
    for (var y in parameters) {
      for (var p in parameters[y]) {
        switch (type) {
          case 'timeseries':
            if (!parameters[y][p].scalar) {
              filteredParameters.push({id: id, label: p, year: y});
            }
            id++;
            break;
          case 'scalar':
            if (parameters[y][p].scalar) {
              filteredParameters.push({id: id, label: p, year: y});
            }
            id++;
            break;
        }
      }
    }

    return filteredParameters.length;
  };
});

angular.module('irpsimApp').filter('countSelectedParameters', function () {
  return function (parameters) {
    var count = 0;
    for (var s in parameters) {
      count += parameters[s].length;
    }
    return count;
  };
});

angular.module('irpsimApp').filter('filterParameter', function ($filter) {
  return function (parameters, type, simulationYears) {
    var filteredParameters = [];
    var id = 0; // ngTagsInput need an id if input is an object
    for (var y in parameters) {
      // set label if filter has simulationYears information
      var yearLabel = simulationYears ? $filter('yearLabel')(y, simulationYears) : y;
      for (var p in parameters[y]) {
        var parameterItem = {id: id, label: p, year: y, tagLabel: p + ' [' + yearLabel + ']'};
        filteredParameters.push(parameterItem);
        id++;
      }
    }
    return filteredParameters;
  };
});

angular.module('irpsimApp').filter('yearLabel', function () {
  return function (yearId, simulationYears) {
    var yearLabel = '' + yearId; // fallback
    for (var yIdx in simulationYears) {
      if (simulationYears[yIdx].yearIdx === Number(yearId)) {
        yearLabel = simulationYears[yIdx].label;
        break;
      }
    }
    return '' + yearLabel;
  };
});
