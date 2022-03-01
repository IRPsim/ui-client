'use strict';

/**
 * @ngdoc service
 * @name irpsimApp.datasetSelector
 * @description
 * # ngConfirmedClick
 * Like ng-click but with user provided explicit confirmation via a modal dialog
 */
angular.module('irpsimApp')
  .directive('datasetSelector', function ($http, Datasets, ScenarioDefinitions) {

    return {
      restrict: 'E',
      templateUrl: 'components/common/dataset-selector.html',
      scope: {
        onSelect: '&',
        type: '<',
        single: '<',
        baseYear: '@',
        currentYear: '@',
        scenario: '<?', // scenario set element
        context: '<?'
      },
      link: function (scope) {

        scope.masterData = '';
        scope.selected = {
          scenarios: []
        };

        if (scope.type && !scope.baseYear) {
          throw 'Internal usage error: need to specify either BOTH type and baseYear or none!';
        }
        if (scope.type) {
          var baseYear = parseInt(scope.baseYear);
          scope.data = _.filter(Datasets.data, function (obj) {
            return Datasets.getValue(obj, 'typ') === scope.type && Datasets.getValue(obj, 'bezugsjahr') === baseYear;
          });
        } else {
          scope.data = Datasets.data;
        }

        scope.available = {
          objs: [], scenarios: []
        };

        function contains(arr, elem){
          return _.indexOf(arr,elem) !== -1;
        }

        function matchesFilter(userSetName, crntSetName, setElements, userSetElement, modelType){
          var userSetDefinition = ScenarioDefinitions.getDefinition(modelType, modelType, 'sets', userSetName); // todo gD
          var crntSetDefinition = ScenarioDefinitions.getDefinition(modelType, modelType, 'sets', crntSetName); // todo gD
          if(crntSetDefinition.hidden !== true){
            return true; // sets that are not hidden are irrelevant for filters, we allow them
          }
          if(userSetName !== crntSetName && !contains(userSetDefinition.supersets, crntSetName)){
            return true; // set names do not match recursively, no need to filter
          }
          // set is hidden, set names match, so we need to see, if the element name is present
          return contains(setElements, userSetElement);
        }
        /**
         * Loads tags for Stammdaten tags input. Filter all available datasets according to their type, matching
         * filter text and predefined restrictions (set name and set element names).
         */
        scope.loadTags = function (query) {
          return _(scope.data)
            // make all entries unique for ng-repeat
            .map(function (item) {
              var copy = angular.copy(item);
              copy.text = copy.name + ' ' + Datasets.getValue(copy,'typ') + ' ' + Datasets.getValue(copy,'bezugsjahr');
              return copy;
            })
            // get derived values (if necessary) and save them, because we cant call this method in the ng-tab's template
            .map(function (item) {
              item.showTyp = Datasets.getValue(item, 'typ');
              item.showBezugsjahr = Datasets.getValue(item, 'bezugsjahr');
              return item;
            })
            // filter by context
            .filter(function (stammdatum) {
              if(!scope.context || !stammdatum.setName1 || !scope.type){ // no filter context set or master data has no filter sets defined or we are not used to select a specific type
                return true;
              }else{
                var ctx = scope.context;
                // TODO think about allowing supersets in filters
                // var parameterDefinition = ScenarioDefinitions.getDefinition(scope.type,ctx.setName2?'tables':'attributes',scope.type);
                var set1Definition = ScenarioDefinitions.getDefinition(ctx.modelType, ctx.modelType, 'sets', ctx.setName1); // todo gD
                var potentialSets1 = [ctx.setName1].concat(set1Definition.supersets);
                if(!ctx.setName2){// selecting set attribute
                  // we want to match any parameter that is defined on either the current set (ctx.setName1) or any superset of this set
                  return _.some(potentialSets1,function(ctxSetName1){
                    return matchesFilter(stammdatum.setName1, ctxSetName1, stammdatum.setElemente1, ctx.setElement1, ctx.modelType) &&
                           matchesFilter(stammdatum.setName2, ctxSetName1, stammdatum.setElemente2, ctx.setElement1, ctx.modelType);
                  });
                }else{
                  var set2Definition = ScenarioDefinitions.getDefinition(ctx.modelType, ctx.modelType, 'sets', ctx.setName2); // todo gD
                  var potentialSets2 = [ctx.setName2].concat(set2Definition.supersets);
                  // selecting value in a table
                  // the item may have restrictions on one set or restrictions on two sets
                  if(!stammdatum.setName2){
                    return _.some(potentialSets1, function(ctxSetName1){
                      return _.some(potentialSets2, function(ctxSetName2){
                        // try to match either context setName1/2
                        return matchesFilter(stammdatum.setName1, ctxSetName1, stammdatum.setElemente1, ctx.setElement1, ctx.modelType) &&
                               matchesFilter(stammdatum.setName1, ctxSetName2, stammdatum.setElemente1, ctx.setElement2, ctx.modelType);
                      });
                    });
                  }else{ // both sets are defined, two ways to match
                    return _.some(potentialSets1, function(ctxSetName1){
                      return _.some(potentialSets2, function(ctxSetName2){
                        // try to match either context setName1/2
                        return matchesFilter(stammdatum.setName1, ctxSetName1, stammdatum.setElemente1, ctx.setElement1, ctx.modelType) &&
                               matchesFilter(stammdatum.setName1, ctxSetName2, stammdatum.setElemente1, ctx.setElement2, ctx.modelType) &&
                               matchesFilter(stammdatum.setName2, ctxSetName1, stammdatum.setElemente2, ctx.setElement1, ctx.modelType) &&
                               matchesFilter(stammdatum.setName2, ctxSetName2, stammdatum.setElemente2, ctx.setElement2, ctx.modelType);
                      });
                    });

                  }
                }
              }
            })
            // filter by name
            .filter(function (item) {
              return item.name.toLowerCase().indexOf(query.toLowerCase()) !== -1;
            })
            .value();
        };

        /*
         Ng-tags does (!) have a maxtags attribute, but it only sets the form validation to false.
         It does not reject the new tag. This function gets called before adding a new tag and checks if their is already one.
         If there is one it replaces the old one with the new one.
         */
        scope.rejectAddingTooManyTags = function (tag) {
          if (scope.masterData.length >= 1) {
            scope.masterData = [tag];
          }
          return true;
        };

        /*
         Gets called after selecting a Stammdatum.
         */
        scope.selectMasterData = function (tag) {

          // Parse tag output back to Stammdatum object.
          var item = {};
          angular.forEach(scope.data, function (i) {
            if (i.name === tag.name &&
                Datasets.getValue(i,'typ') === Datasets.getValue(tag,'typ') &&
                Datasets.getValue(i,'bezugsjahr') === Datasets.getValue(tag,'bezugsjahr')) {
              item = i;
            }
          });

          scope.selectedMasterData = item;
          var scenarios = Datasets.getScenarioSet(Datasets.getValue(item,'bezugsjahr')).map(function (i) {
            return {
              stelle: i.stelle,
              name: i.name
            };
          });
          scenarios = scenarios.sort();

          // load all scenarios
          scenarios = _.map(scenarios, function (a) {
            return {name: a.name, stelle: a.stelle, notSelectable: true};
          });

          var objs = scope.datasetsForSelectedScenario = Datasets.getDatasets(item.id);

          scope.datasetsForSelectedScenario = _.sortByAll(scope.datasetsForSelectedScenario, ['jahr', 'szenario']);

          // make only those selectable that contain a dataset
          for (var i = 0; i < scenarios.length; i++) {
            for (var t = 0; t < objs.length; t++) {
              if ((objs[t].szenario === scenarios[i].stelle) && (!scope.type || (objs[t].jahr <= parseInt(scope.currentYear)))) {
                scenarios[i].notSelectable = false;
              }
            }
          }
          scope.available = scenarios;
          if(scope.scenario) {
            for (i = 0; i < scenarios.length; i++) {
              var s = scenarios[i];
              if (s.stelle === scope.scenario.stelle) {
                scope.selectedScenario = s;
                scope.onSelectScenario(s);
              }
            }
          }
        };
        scope.selectedYear = {};

        scope.onSelectScenario = function (scenario) {
          scope.implicitSelectedDataset = scope.warnMissingScenario = null;
          //select year implicit if type is set
          if (scope.type) {
            var d = _.filter(scope.datasetsForSelectedScenario, {szenario: scenario.stelle});
            outer:
              for (var i = parseInt(scope.currentYear); i >= parseInt(scope.baseYear); i--) {
                for (var j = 0; j < d.length; j++) {
                  if (d[j].jahr === i) {
                    scope.implicitSelectedDataset = d[j];
                    break outer;
                  }
                }
              }
            if(scope.implicitSelectedDataset) {
              scope.warningImplicitYearSelect = (scope.implicitSelectedDataset.jahr !== parseInt(scope.currentYear));
              scope.warnMissingScenario = false;
            }else{
              scope.warningImplicitYearSelect = null;
              scope.warnMissingScenario = true;
            }
          }
        };

        scope.doSelect = function () {
          // if type is set use implicit year calc
          if (scope.type) {
            scope.onSelect({
              $items: [scope.implicitSelectedDataset],
              $master: scope.selectedMasterData
            });
          } else {
            scope.onSelect({
              $items: scope.selectedYear.data,
              $master: scope.selectedMasterData
            });
          }
        };
      }
    };
  });
