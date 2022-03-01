'use strict';

/**
 * @ngdoc directive to
 * @name irpsimApp.directive:scenarioConfigurator
 * @description
 * #
 */
angular.module('irpsimApp')
  .directive('scenarioConfigurator', function ($q, $timeout, ScenarioDefinitions, ScenarioConfiguration, ScenarioValidation,
                                               ResultSeriesSelector, BackendVersionCache, PullFunction,
                                               Logger, DataStructures, Datasets) {
    return {
      restrict: 'E',
      scope: {
        multiYearScenario: '=scenario',
        type: '@',
        tag: '@',
        print: '<',
        loadedScenarioDescription: '<'
      },
      templateUrl: 'components/scenario-editor/scenario-configurator.html',
      controller: function ($scope) {
        /*jshint camelcase: false */ // the tree component uses non-camel cased names, ignore them
        $scope.readOnly = $scope.tag === 'output';
        $scope.uiStructure = [];
        $scope.treeControl = {};
        $scope.selectedElement = null;
        $scope.breadcrumbs = [];

        /**
         * Get contents for the navigation tree for current node
         */
        function constructBreadCrumbs(node) {
          var arr = [];
          while (node) {
            arr.push(node);
            node = $scope.treeControl.get_parent_branch(node);
          }
          arr.reverse();
          return arr;
        }

        /**
         * Get scenario for selected year
         */
        $scope.findScenario = function () {
          var index = $scope.uiStructure.indexOf($scope.breadcrumbs[0]);
          if (index === -1) {
            return null;
          } else if ($scope.tag === 'output') {
            if (index === 0) {
              return $scope.dummyScenario;
            } else {
              return $scope.multiYearScenario.years[index - 1];
            }
          } else {
            return $scope.multiYearScenario.years[index];
          }
        };
        $scope.lastSelectedYearIndex = -1;

        /**
         * Run when a node is selected
         * @param {*} node selected node
         */
        $scope.onSelect = function (node) {
          $scope.selectedElement = node;
          $scope.breadcrumbs = constructBreadCrumbs(node);
          $scope.scenario = $scope.findScenario();

          if ($scope.multiYearScenario && $scope.selectedElement) {
            // create a list of all timeseries references for our multichart tool
            var index = $scope.uiStructure.indexOf($scope.selectedElement);
            // avoid recreating the list as long as we are currently within the descendants of the currently selected year
            if (index !== $scope.lastSelectedYearIndex) {
              $scope.lastSelectedYearIndex = index;
              if (index === 0) {
                $scope.allTimeseries = ResultSeriesSelector.getSeriesForMultipleYears($scope.multiYearScenario, $scope.type, $scope.tag);
              } else if (index > 0) {
                $scope.allTimeseries = ResultSeriesSelector.getSeriesForOneYear($scope.multiYearScenario.years[index - 1], $scope.type, $scope.tag, $scope.multiYearScenario.years[index - 1].config.modeldefinition);
              }
            }
          }
        };

        /**
         * Get the currently selected node
         * @param {*} node currently selected node
         */
        $scope.selectNode = function (node) {
          if (node) {
            $scope.treeControl.select_branch(node);
          } else {
            // tree component won't notify us if we select a null branch
            $scope.onSelect(null);
          }
        };

      },
      link: function (scope, element, attrs) {
        scope.showFilters = false;

        /**
         * Enables or disables the filter input
         */
        scope.toggleShowFilters = function () {
          scope.showFilters = !scope.showFilters;
        };
        scope.selectedTags = [];

        /**
         * Pin an element (e.g. when pin button is pressed)
         */
        scope.pinSelectedElement = function(){
          scope.pinnedElement = scope.selectedElement;
          scope.pinnedScenario = scope.scenario;
        };

        function isCompatibleWithSelectedTags(selectedTags, otherTags) {
          return _.intersection(selectedTags, otherTags).length === selectedTags.length;
        }

        /**
         * Find all tags defined for each set, table, scalar and timeseries in the given scenario.
         * For sets it recursivly searches for tags on the attribute parameters as well.
         * Only collects tags of elements that are currently visible AND compatible with selectedTags.
         * The result is an array of tags which, when individually selected, will address a non-empty
         * subset of scenario, that is, each tag is compatible with all currently selected tags.
         * @param {Object} structure currently active tree structure
         * @param {Array} selectedTags all currently selected tags
         * @returns {Array} array of all distinct tags as strings
         */
        function findAllCompatibleTags(structure, selectedTags, subModelDefinition) {
          function filterArray(arr) {
            return _.reduce(arr, function (result, child) {
              return _.uniq(result.concat(findAllCompatibleTags(child, selectedTags, subModelDefinition)));
            }, []);
          }

          if (angular.isArray(structure)) {
            return filterArray(structure);
          } else if (structure.type) { // individual content
            var definition = scope.getDefinition(structure, subModelDefinition);
            if (isCompatibleWithSelectedTags(selectedTags, definition.tags)) {
              return definition.tags;
            } else {
              return [];
            }
          } else {
            var res = [];
            if (structure.contents) {
              res = res.concat(filterArray(structure.contents));
            }
            if (structure.children) { //we have children
              res = res.concat(filterArray(structure.children));
            }
            return res;
          }
        }

        /**
         * create a new scenario configuration object where each element
         * contains all the tags that were selected by the user.
         * @param {Object} structure  currently active tree structure
         * @param {Array} selectedTags all selected tags (strings)
         */
        function filterByTags(structure, selectedTags, subModelDefinition) {
          var i;
          function filterArray(arr, parent) {
            for (var i = arr.length - 1; i >= 0; i--) {
              arr[i] = filterByTags(arr[i], selectedTags, subModelDefinition);
            }

            //make a difference between parent object and parent array
            if (angular.isArray(parent)) {
              for (i = 0; i < parent.length; i++) {
                if (!parent[i].filtered) {
                  parent.filtered = false; //just here to make it more readable
                  return parent;
                }
              }
              parent.filtered = true;
              return parent;
            }
          }

          if (angular.isArray(structure)) {
            return filterArray(structure, structure);
          } else if (structure.type) { // individual content
            var definition = scope.getDefinition(structure, subModelDefinition);
            structure.filtered = !isCompatibleWithSelectedTags(selectedTags, definition.tags);
            return structure;
          } else {
            if (structure.contents) { // we have editable attributes/tables/scalars/timeseries
              filterArray(structure.contents, structure);
            }
            if (structure.children) { //we have children
              filterArray(structure.children, structure);
            }
            if (structure.children && structure.children.length > 0) {
              for (i = 0; i < structure.children.length; i++) {
                if (!structure.children[i].filtered) {
                  structure.filtered = false;
                  return structure;
                }
              }
            }
            if (structure.contents && structure.contents.length > 0) {
              for (i = 0; i < structure.contents.length; i++) {
                if (!structure.contents[i].filtered) {
                  structure.filtered = false;
                  return structure;
                }
              }
            }
            structure.filtered = true;
            return structure;
          }
        }

        function findByBreadcrumbs(breadcrumbs, uiStructure) {
          var obj = uiStructure[0];
          for (var i = 0; i < breadcrumbs.length && uiStructure; i++) {
            var b = breadcrumbs[i];
            obj = _.findWhere(uiStructure, {label: b.label});
            if (obj) {
              uiStructure = obj.children;
            } else {
              break;
            }
          }
          return obj;
        }

        function reselectMostRecentNode() {
          /* this needs to occur after at least one digest cycle has run
           * reason: the tree component will try to expand all parent nodes of the
           * selected node via added parent link attributes. These attributes are not set
           * yet.
           */
          $timeout(function () {
            var currentlySelected = findByBreadcrumbs(scope.breadcrumbs, scope.uiStructure);
            scope.selectNode(currentlySelected);
            //scope.selectNode(scope.uiStructure[1].children[0].children[0]);
          }, 0);
        }

        function updateUIStructure(subModelDefinition) {
          var selectedTags = _(scope.selectedTags).pluck('text').concat(attrs.tag).uniq().value();
          scope.uiStructure = filterByTags(scope.uiStructure, selectedTags, subModelDefinition);
          scope.availableTags = findAllCompatibleTags(scope.uiStructure, selectedTags, subModelDefinition);
        }

        scope.tagSelectionChanged = function () {
          updateUIStructure(9999999);
          reselectMostRecentNode();
        };

        scope.query = function (query) {
          query = query.toLowerCase();
          var deferred = $q.defer();
          var results = _.filter(scope.availableTags, function (tag) {
            return tag.toLowerCase().indexOf(query) !== -1;
          });
          deferred.resolve(results);
          return deferred.promise;
        };

        /**
         * Load a scenario from a json file (is called by load button)
         * @param {Object} contents json string from loaded file
         */
        scope.loadFile = function (contents) {
          var parsed = JSON.parse(contents);
          if (parsed.hasOwnProperty('backendversion') && parsed.hasOwnProperty('data')) {
            parsed = ScenarioConfiguration.convertBetweenApiAndEditableVersion(scope.type, parsed.data, scope.tag, true);
          }
          scope.multiYearScenario = parsed[0]; // TODO: temp fix: parsed -> parsed[0];
        };

        /**
         * Save Scenario to json file (is called by save button)
         * @returns {Object} scenario as json
         */
        scope.saveScenarioToFile = function () {
          return {
            backendversion: BackendVersionCache.getVersion(),
            data: ScenarioConfiguration.convertBetweenApiAndEditableVersion(scope.type, scope.multiYearScenario, scope.tag, false)
          };
        };

////////////////// handling of delta year related data ////////////////////////////////////////////////



        function adjustYearlyLabels() {
          if (scope.multiYearScenario && scope.multiYearScenario.years) {
            for (var i = 0; i < scope.multiYearScenario.years.length; i++) {
              var config = scope.multiYearScenario.years[i].config;
              var yearLabel = '(' + config.year.value + ')';
              var prefix;
              if (i === 0) {
                prefix = 'Initiales Jahr ';
              } else if (config.interpolated) {
                prefix = 'Interpoliertes Jahr ';
              } else {
                prefix = 'Stützjahr ';
              }
              scope.uiStructure[(scope.tag === 'output') ? i + 1 : i].label = prefix + yearLabel;
            }
          }
        }

        /*
         Copies scenario flags (expanded + filtered)
         */
        function deepCopyFlags(src, copy) {
          function copyArray(src, copy) {
            for(var i = 0; i < src.length; i++){
              deepCopyFlags(src[i], copy[i]);
            }
          }
          if(!copy){
            return; //FIXME needs more sophisticated logic to really synchronize. Must not assume that both structures are equal
          }
          if (angular.isArray(src)) {
            copyArray(src, copy);
          } else if (src.type) { // individual content
            copy.filtered = src.filtered;
            copy.expanded = src.expanded;
          } else {
            if (src.contents) { // we have editable attributes/tables/scalars/timeseries
              copyArray(src.contents, copy.contents);
            }
            if (src.children) { //we have children
              copyArray(src.children, copy.children);
            }
            copy.filtered = src.filtered;
            copy.expanded = src.expanded;
          }
        }

        scope.$watchCollection('multiYearScenario', function (multiYearScenario) {
          var i;
          if (multiYearScenario && multiYearScenario.years) {
            // to show postprocessing overall we need a dummy scenario with the aggregates data attached
            // because the rest of the UI has the implicit assumption that there is always data for each
            // parameter. Copy the first year for now. We don't need the actual data, but we do need the
            // set names, for example.
            if (multiYearScenario.years.length === 0) {
              scope.dummyScenario = {
                config: '',
                sets: '',
                postprocessing: '',
              };
            } else {
              scope.dummyScenario = {
                config: multiYearScenario.years.length === 0 ? '' : multiYearScenario.years[0].config,
                sets: _.mapValues(multiYearScenario.years[0].sets, function (s) {
                  return {names: s.names, values: _.mapValues(s.values, _.constant({}))};
                }),
                postprocessing: multiYearScenario.postprocessing
              };
            }

            var uiStructure = [];
            var addYear = function (struct, subModelDefinition) {
              struct.push(DataStructures.deepCopy({
                contents: (scope.tag === 'output') ? [{name: '', type: 'multiChart'}] :
                  [{name: 'year', type: 'config'},
                   {name: 'scenario', type: 'config'},
                    {name: 'savelength', type: 'config'},
                    {name: 'optimizationlength', type: 'config'},
                    {name: 'simulationstart', type: 'config'},
                    {name: 'simulationlength', type: 'config'},
                    {name: 'resolution', type: 'config'}],
                children: ScenarioDefinitions.getUIStructure(scope.type, (i === 0 || scope.tag === 'output') ? scope.tag : 'delta', subModelDefinition)
              }));
            };

            var subModelDefinition = multiYearScenario.years[0].config.modeldefinition;
            if (scope.tag === 'input') {
              if (scope.type === 'Basismodell') {
                adjustBasicScenarioSpecifics();
              }
              for (i = 0; i < multiYearScenario.years.length; i++) {

                addYear(uiStructure, subModelDefinition);
              }
              scope.uiStructure = uiStructure;
              loadAndApplyScenarioSets();
            } else { // output
              if (scope.uiStructure.length !== multiYearScenario.years.length + 1) {
                uiStructure.push(DataStructures.deepCopy({
                  label: 'Gesamtergebnis',
                  contents: [{name: '', type: 'multiChart'}],
                  children: ScenarioDefinitions.getUIStructure(scope.type, scope.tag, subModelDefinition)
                }));
                for (i = 0; i < multiYearScenario.years.length; i++) {
                  addYear(uiStructure, subModelDefinition);
                }
                deepCopyFlags(scope.uiStructure, uiStructure);
                scope.uiStructure = uiStructure;
              }
            }
            adjustYearlyLabels();
            updateUIStructure(subModelDefinition);
            reselectMostRecentNode();
            scope.scenario = scope.findScenario() || scope.scenario;
            scope.pinnedScenario = null;
            scope.pinnedElement = null;
          }
        });

        /**
         * Add a new year to the scenario configurator
         */
        scope.addDeltaYear = function () {
          ScenarioConfiguration.addDeltaYear(scope.multiYearScenario, scope.type);
        };

        /**
         * Delete selected year from the scenario editor
         */
        scope.deleteYear = function () {
          var scenario = scope.findScenario();
          var index = scope.multiYearScenario.years.indexOf(scenario);
          if (index > 0) {
            ScenarioConfiguration.deleteDeltaYear(scope.multiYearScenario,index);
          }
        };

        function updateYearDefinition(){
          return {
            identifier: 'Stützjahr',
            type: 'scalar',
            'data-type': 'integer',
            'hideDBSelector': true,
            default: '0',
            description: 'Jahreszahl des Stützjahres',
            tags: ['input', 'output'],
            name: 'year',
            domain: {
              // FIXME need validation only for years after the initial year '>=': _.get(scope,'multiYearScenario.years[0].config.year.value')
            }
          };
        }
        var yearDefinition = updateYearDefinition();
        var scenarioDefinition = {
          identifier:'Vorauswahl Prognoseszenario',
          type:'scalar',
          'data-type': 'prognoseSzenario',
          'hideDBSelector': true,
          default:'',
          description: 'Auswahl des Prognoseszenarios als Vorgabe für alle Parameterselektionen',
          tags: ['input','output'],
          name: 'scenario',
          domain: {}
        };
	      var saveLength = {
          identifier:'Speicherlänge',
          type:'scalar',
          'data-type': 'savelength',
          'hideDBSelector': true,
          default: '0',
          description: 'Definition der Speicherlänge',
          tags: ['input','output'],
          name: 'savelength',
          domain: {}
        };
        var optimizationLength = {
          identifier:'Optimierungshorizont',
          type:'scalar',
          'data-type': 'optimizationLength',
          'hideDBSelector': true,
          default: '0',
          description: 'Definition des Optimierungshorizonts',
          tags: ['input','output'],
          name: 'optimizationlength',
          domain: {}
        };
        var simulationStart = {
          identifier:'Simulationszeitraum Start',
          type:'scalar',
          'data-type': 'simulationstart',
          'hideDBSelector': true,
          default: '0',
          description: 'Definition des Simulationszeitraum Starts',
          tags: ['input','output'],
          name: 'simulationstart',
          domain: {}
        };
        var simulationLength = {
          identifier:'Simulationszeitraum Ende',
          type:'scalar',
          'data-type': 'simulationlength',
          'hideDBSelector': true,
          default: '0',
          description: 'Definition des Simulationszeitraum Endes',
          tags: ['input','output'],
          name: 'simulationlength',
          domain: {}
        };
        var resolution = {
          identifier:'Auflösung',
          type:'scalar',
          'data-type': 'resolution',
          'hideDBSelector': true,
          default: '0',
          description: 'Definition der Auflösung',
          tags: ['input','output'],
          name: 'resolution',
          domain: {}
        };

        var graphDefinition = {tags: ['input','output']};
        var imageDefinition = {tags: ['input','output']};

        /**
         * Get the model definition for a given element
         * @param {*} element current element
         * @param {*} subModelDefinition id of the submodel definition
         * @returns {Number} model definition
         */
        scope.getDefinition = function (element, subModelDefinition) {
          switch (element.type) {
            case 'config':
              if (element.name === 'year') {
                return yearDefinition;
              }else if (element.name === 'scenario') {
                return scenarioDefinition;
              } else if (element.name === 'savelength'){
                return saveLength;
              } else if (element.name === 'simulationlength'){
                return simulationLength;
              } else if (element.name === 'optimizationlength'){
                return optimizationLength;
              } else if (element.name === 'simulationstart'){
                return simulationStart;
              } else if (element.name === 'resolution'){
                return resolution;
              }
              break;
            case 'graph':
              return graphDefinition;
            case 'multiChart':
              return {
                identifier: '',
                'hideDBSelector': true,
                tags: ['output']
              };
            case 'image':
              return imageDefinition;
            default:
              return ScenarioDefinitions.getDefinition(scope.type, subModelDefinition, element.type, element.name);
          }
        };
        // initialize tree
        scope.tagSelectionChanged();

/////////////////// specifics for basic scenario /////////////////////////////////
        /**
         * the current basic scenario has some optimization specific sets that need to be generated by the UI.
         * This function is not applicable to other scenarios/simulation models!
         * Currently, this function generates the members of set_a_total. It ensures that
         * there is a valid entry per currently configured year.
         * FIXME find a way to model this specific behaviour conditionally
         */
        function adjustBasicScenarioSpecifics() {
          if (scope.tag === 'input' && scope.type === 'Basismodell') {
            var scenario = scope.multiYearScenario.years[0];
            var setName = 'set_a_total';
            var years = _.map(scope.multiYearScenario.years, 'config.year.value').sort();
            var n = years[years.length - 1] - years[0] + 1;
            var setNamesShould = _.times(n, function (n) {
              return 'a' + (years[0] + n);
            });
            var setNamesAre = scenario.sets[setName].names;
            // delete members of set_a_total we don't need
            _.difference(setNamesAre, setNamesShould)
              .forEach(function (unneededName) {
                ScenarioConfiguration.removeSetMember(scope.type, scope.multiYearScenario, setName, _.indexOf(setNamesAre, unneededName));
              });
            _.difference(setNamesShould, setNamesAre)
              .forEach(function (missingName) {
                ScenarioConfiguration.addSetMember(scope.type, scope.multiYearScenario, setName, missingName);
              });
            PullFunction.runModelSpecific(scope.multiYearScenario);
          }
        }

        /*
         * Load scenario set for changedYear
         */
        function loadAndApplyScenarioSets() {
          // change in initial year. Since all scenario set elements depend on the initial year only, we need to load the
          // matching scenario set.
          // retrieve defined scenario set from Datasets service
          var scs = scope.multiYearScenario.years;
          var initialYear = scs[0].config.year.value;
          var scenarioSetForYear = Datasets.getScenarioSet(initialYear);
          var i;

          if (scenarioSetForYear) {
            var logs = [];
            for (i = 0; i < scs.length; i++) {
              var newScenario = _.find(scenarioSetForYear, {stelle: scs[i].config.prognoseszenario}) || scenarioSetForYear[0];
              scs[i].config.scenario.values = scenarioSetForYear;
              scs[i].config.scenario.value = newScenario;
              logs.push({
                title: 'Vorauswahl der Prognoseszenarios',
                text: 'Setze Prognoseszenario "' + scs[i].config.scenario.value.name + '" für das Jahr ' + scs[i].config.year.value,
                severity: 'info',
                notify: true
              });
            }
            Logger.combineAndShow(logs);
          } else {
            console.log('scenarioset for year', scenarioSetForYear, scope.scenario);
            var noScenarioSet = {
              values: undefined,
              value: undefined
            };
            scope.scenario.config.scenario = noScenarioSet;
            scope.scenario.config.prognoseszenario = null;
            Logger.addLog({
              title: 'Fehler',
              text: 'Es sind keine Prognoseszenarien für das Bezugsjahr <em><b>' + initialYear + '</b></em> definiert.',
              severity: 'error',
              notify: true
            });
            // set null for all other Stützjahre
            for (i = 0; i < scs.length; i++) {
              scs[i].config.scenario = noScenarioSet;
              scs[i].config.prognoseszenario = null;
            }
          }
        }

        scope.$watch(function () {
          return _.map(_.get(scope, 'multiYearScenario.years'), 'config.year.value');
        }, function (yearsNewArr, yearsOldArr) {
          adjustYearlyLabels();
          yearDefinition = updateYearDefinition();

          if(scope.tag  === 'input') { // we don't need to to run anything for output parameters, these are all read-only
            adjustBasicScenarioSpecifics();
            if(yearsOldArr && yearsOldArr[0] && yearsNewArr && yearsNewArr[0] && yearsOldArr[0] !== yearsNewArr[0]){
              // initial year has changed, load applicable scenario sets and change it in each year
              loadAndApplyScenarioSets();
            }
            if (isArrayOrderChanged(yearsNewArr)) {
              sortYears();
            } else {
              PullFunction.runPullForChangesToYear(scope.multiYearScenario, scope.type, yearsOldArr, yearsNewArr);
            }
          }
        }, true);


//////////////// pull function//////////////////////////////////////////////////////////////////////////////////////////

        function isArrayOrderChanged(array){
          return !_.eq(array, array.slice().sort());
        }

        /**
         * The user has changed a year between other years to a number such that the order of years is not
         * ascending any more. We need to resort the years in scope.multiYearScenario
         */
        function sortYears(){
          var sorted = _.sortBy(scope.multiYearScenario.years,'config.year.value');
          scope.multiYearScenario.years = sorted;
        }

        /**
         * listen for events from our editing elements
         * enforce rules
         * currently emitted by editsinglevalue.directive.js@scope.validateAndBroadcastChange
         */
        scope.$on('valueChanged', function(event, data){
          PullFunction.runModelSpecific(scope.multiYearScenario);
          if(data.definition.name === 'scenario'){
            PullFunction.runPullForChangesToDefaultScenario(scope.multiYearScenario, scope.type, scope.multiYearScenario.years.indexOf(scope.scenario));
            // set stelle of prognoseszenario in scope.scenario configuration
            scope.scenario.config.prognoseszenario = data.value.stelle;
          }else {
            PullFunction.runPullForIndividualParameter(scope.multiYearScenario, scope.type, scope.scenario, data.definition.name);
            return ScenarioValidation.enforceToggles(scope.scenario, data);
          }
        });



//////////////// validation and reactive rules /////////////////////////////////////////////////////////////////////////
        /**
         * Returns a list of validation error strings or null, if there is no veto to the given value change.
         * @param {Object} validationEvent validationEvent
         * @returns {*}
         */
        scope.changeValidator = function (validationEvent) {
          return ScenarioValidation.changeValidator(scope.scenario, scope.type, validationEvent);
        };

        /**
         * editing functions for set elements
         * @param {String} setName name of set
         * @param {Number} index index in set names array
         * @param {String} newName new name for this set element
         * @returns {*}
         */
        scope.renameSetMember = function(setName, index, newName){
          /* make sure we get a name that will be compatible with GAMS conventions:
           * start with letter, may contain numbers, no special characters
           */
          if(!ScenarioConfiguration.isGloballyUnique(scope.type, scope.scenario, scope.selectedElement.set, index,newName)){
            return 'Diese Bezeichung wurde schon verwendet.';
          }else if(/^[a-z][a-z0-9_]*$/gi.test(newName)){
            ScenarioConfiguration.changeSetMember(scope.type, scope.multiYearScenario, setName, index, newName);
            PullFunction.runVerticalPull(scope.multiYearScenario, scope.type, setName, newName);
          }
          else{
            return 'Bitte keine Sonder-/Leerzeichen verwenden.';
          }
        };

        scope.addSetMember = function(name){
          ScenarioConfiguration.addSetMember(scope.type, scope.multiYearScenario, name);
        };

        scope.copySetMember = function(setName,setElementName){
          ScenarioConfiguration.copySetMember(scope.type, scope.multiYearScenario, setName, setElementName);
        };

        scope.removeSetMember = function(name, index){
          ScenarioConfiguration.removeSetMember(scope.type, scope.multiYearScenario, name, index);
        };
      }
    };
  });
