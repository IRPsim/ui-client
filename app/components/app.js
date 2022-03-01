'use strict';

/**
 * @ngdoc overview
 * @name irpsimApp
 * @description
 * # irpsimApp
 *
 * Main module of the application.
 */
angular
  .module('irpsimApp', [
    'ui.grid', // ui-grid.info, tables
    'ui.grid.resizeColumns', // http://ui-grid.info/docs/#/tutorial/204_column_resizing
    'ui.grid.moveColumns', // http://ui-grid.info/docs/#/tutorial/217_column_moving
    'ui.grid.pinning', // http://ui-grid.info/docs/#/tutorial/203_pinning
    'ui.grid.pagination', // http://ui-grid.info/docs/#/tutorial/214_pagination
    'ui.grid.saveState', // http://ui-grid.info/docs/#/tutorial/208_save_state
    'xeditable', // edit in place @ https://vitalets.github.io/angular-xeditable/
    'ngResource',
    'ngSanitize', // to enable adding sanitized html from backend messages via 'ng-bind-html'
    'ngAnimate',
    'ui.router',
    'ui.bootstrap', // bootstrap interactive components
    'ui.bootstrap.progressbar',
    'ui.bootstrap.collapse',
    'angular-loading-bar', // show progress bar on top during ajax requests
    'ngTagsInput', // tags input element
    'angular-growl', // central notifications using 'growl' service
    'angularBootstrapNavTree', // navigation tree
    'LocalStorageModule', // easy use of localStorage
    'ngDraggable', // drag'n'drop suppoer
    'uiCommon', //common components for ui-client and ui-dashboard
    'ngFileUpload', // https://github.com/danialfarid/ng-file-upload
    'TimeseriesAnalysationTool',
    'irpsimApp.toolbar',
    'ngMaterial'

  ])
  .constant('JSZip', JSZip)
  .constant('saveAs', saveAs)
  .config(function ($stateProvider, $urlRouterProvider, $compileProvider) {
    $stateProvider
      .state('/', {
        url: '/',
        templateUrl: 'components/main/main.html',
        controller: 'MainCtrl'
      })
      .state('powerprofiles', {
        url: '/powerprofiles',
        abstract: true,
        template: '<ui-view/>',
        resolve: {
          'Stammdaten': function(Datasets){
            return Datasets.initialDataPromise;
          }
        }
      })
      .state('powerprofiles.rlm-timeseries-test', {
        url: '/rlm-timeseries-test',
        controller: 'TimeseriesTestCtrl',
        templateUrl: 'components/rlm-timeseries/rlm-customers.html'
      })
      .state('data-dashboard', {
        url: '/data-dashboard',
        abstract: true,
        template: '<ui-view/>'
      })
      .state('stammdaten', {
        url: '/stammdaten',
        abstract: true,
        template: '<ui-view/>'
      })
      .state('about', {
        url: '/about',
        templateUrl: 'components/about/about.html'
      })
      .state('stammdaten.stammdaten',{
        url: '/stammdaten',
        controller: 'StammdatenCtrl',
        templateUrl: 'components/stammdaten/stammdaten.html',
        resolve: {
          'Stammdaten': function(Datasets){
            return Datasets.initialDataPromise;
          }
        }
      })
      .state('stammdaten.prognoseszenarien', {
        url: '/prognoseszenarien',
        controller: 'PrognoseszenarienCtrl',
        templateUrl: 'components/stammdaten/prognoseszenarien.html'
      })
      .state('models', {
        url: '/models',
        abstract: true,
        template: '<ui-view/>',
        resolve:{
          'Stammdaten': function(Datasets){
            return Datasets.initialDataPromise;
          },
          'info': function(BackendVersionCache){
            return BackendVersionCache.loadServerVersions();
          }
        }
      })
      .state('models.basic', {
        url: '/modelDefinition/:modelDefinitionId',
        controller: 'ScenarioEditorCtrl',
        controllerAs: 'scenarioEditorCtrl',
        templateUrl: 'components/scenario-editor/scenario-editor.html',
        params: {
          modelDefinitionId: null
        },
        resolve: {
          'modelDefinitions': function (ScenarioDefinitions) {
            return ScenarioDefinitions.getModelDefinitions();
          },
          'modelDefinitionIds': function (modelDefinitions, $stateParams) {
            for (var index = 0; index < modelDefinitions.length; index++) {
              if (modelDefinitions[index].id === parseInt($stateParams.modelDefinitionId)) {
                if (modelDefinitions[index].submodels) {
                  return modelDefinitions[index].submodels;
                } else {
                  return [modelDefinitions[index].id];
                }
              }
            }
          },
          'definitions': function (ScenarioDefinitions, info, Stammdaten, $stateParams, modelDefinitionIds, modelDefinitions) {
            // make sure that this promise got resolved BEFORE the controller gets created.
            if (modelDefinitions && modelDefinitionIds && info && Stammdaten) {
              return ScenarioDefinitions.loadDefinition(parseInt($stateParams.modelDefinitionId), modelDefinitionIds);
            }
          },
          'scenario': function (definitions, ScenarioConfiguration, modelDefinitions, info, Stammdaten, $stateParams) {
            // we need to make sure, that the modelDefinitions got loaded BEFORE we load the configuration
            // because the latter relies on the former. The loading order is undefined.
            if (definitions && modelDefinitions && info && Stammdaten) {
              return ScenarioConfiguration.loadDefaultScenario(parseInt($stateParams.modelDefinitionId));
            }
          },
          'modelType': function ($stateParams) {
            return parseInt($stateParams.modelDefinitionId);
          },
        }
      })
      .state('gdx', {
        url: '/gdx',
        abstract: true,
        template: '<ui-view/>'
      })
      .state('gdx.filter',{
        url: '/filter',
        controller: 'GdxFilterCtrl',
        controllerAs: 'vm',
        templateUrl: 'components/gdx/filter.html',
        params: {
          id: null,
          year: null
        }
      })
      .state('gdx.filterId',{
        url: '/filter/:id',
        controller: 'GdxFilterCtrl',
        controllerAs: 'vm',
        templateUrl: 'components/gdx/filter.html',
        params: {
          id: null,
          year: null
        }
      })
      .state('gdx.filterIdYear',{
        url: '/filter/:id/:year',
        controller: 'GdxFilterCtrl',
        controllerAs: 'vm',
        templateUrl: 'components/gdx/filter.html',
        params: {
          id: null,
          year: null
        }
      });

    $urlRouterProvider.otherwise('/models/modelDefinition/1');
    // make sure we can use blob urls for client side generated data
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|file|javascript|blob):/);
  })
  .run(function ($rootScope, $location, $state) {
    // store current location of the ngrouter into rootscope. Each controller can then access this information at any time.
    $rootScope.$state = $state;
    $rootScope.host = $location.host();
  })
  .run(function (editableOptions) {
    editableOptions.theme = 'bs3'; // bootstrap3 theme. Can be also 'bs2', 'default'
  })
  .config(function (growlProvider) {
    growlProvider.onlyUniqueMessages(true);
    growlProvider.globalTimeToLive({success: 3000, error: 5000, warning: 4000, info: 5000});
    growlProvider.globalDisableCountDown(false);
    growlProvider.globalPosition('top-center');
  })
  .config(function($httpProvider){
    $httpProvider.interceptors.push('growlInterceptorWithoutErrors');

  })
  .config(function (localStorageServiceProvider) {
    localStorageServiceProvider
      .setStorageType('localStorage')
      .setPrefix('irpsim');
  })
  .run(function ($rootScope, growl) {
    $rootScope.$on('$stateChangeError', function () {
      console.warn(arguments);
      growl.warning('Fehler bei Navigation:' + arguments[5]);
    });
  })
  .run(function() {
    // polyfill for IE Object.assign
    // @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Browser_compatibility
      if (typeof Object.assign !== 'function') {
	  // .length of function is 2
	Object.assign = function (target, varArgs) { // jshint ignore:line
        if (target === null) { // TypeError if undefined or null
          throw new TypeError('Cannot convert undefined or null to object');
        }

        var to = Object(target);

        for (var index = 1; index < arguments.length; index++) {
          var nextSource = arguments[index];

          if (nextSource !== null) { // Skip over if undefined or null
            for (var nextKey in nextSource) {
              // Avoid bugs when hasOwnProperty is shadowed
              if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                to[nextKey] = nextSource[nextKey];
              }
            }
          }
        }
        return to;
      };
    }
  });
