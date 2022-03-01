angular.module('irpsimApp')
  .directive('stammdatenForm', function (ScenarioDefinitions, Datasets) {
    'use strict';
    return {
      restrict: 'E',
      templateUrl: 'components/stammdaten/stammdaten-form.html',
      scope: {
        data: '<',
        onSave: '&',
        onCancel: '&'
      },
      link: function (scope) {

        scope.resolutions = Datasets.resolutions;
        scope.szenarien = [];
        scope.parameterNames = [];
        scope.parents = _.sortBy(Datasets.data,'name');
        scope.sets = {};

        // set useStandard on load
        scope.useStandard = scope.data.standardszenario;

        ScenarioDefinitions.loadDefinition('all').then(function (definitions) {
          scope.parameterNames = _.sortBy(_.values(Object.assign({}, definitions.scalars, definitions.timeseries, definitions.tables, definitions.attributes)),'name');
          scope.sets = _.sortBy(definitions.sets, 'name');
          // if 'Typ' is a derived value
          scope.typeChanged(scope.getDerivedValue('typ') || scope.data.typ);
        });

        ///////////////////////////////////////////////////////////////////////
        // Scope functions
        ///////////////////////////////////////////////////////////////////////

        scope.$watch('data.setName1', function(newSetName) { // jshint ignore:line
          validSetName1ForParameter();
        });

        scope.$watch('data.setName2', function(newSetName) { // jshint ignore:line
          validSetName2ForParameter();
        });

        function validSetName1ForParameter() {
          var setName = scope.data.setName1 || scope.getDerivedValue('setName1');
          var filteredSet = _.find(scope.filteredSets, function(set) {
            return set.name === setName;
          });
          scope.isValidSetName1 = filteredSet ? true : false;
        }

        function validSetName2ForParameter() {
          var setName = scope.data.setName2 || scope.getDerivedValue('setName2');
          var filteredSet = _.find(scope.filteredSets, function(set) {
            return set.name === setName;
          });
          scope.isValidSetName2 = filteredSet ? true : false;
        }

        scope.typeChanged = function() {
          var filteredSets = [];
          var matchedParameter = _.find(scope.parameterNames, function(parameter) {
            return parameter.name === scope.data.typ;
          });
          if(matchedParameter) {
            matchedParameter.dependencies.forEach(function(setName) {
              var filteredSet = _.find(scope.sets, function(set) {
                return set.name === setName;
              });
              if(filteredSet) {
                // push to filtered Sets
                filteredSets.push(filteredSet);
                // add also subsets if available
                if(filteredSet.subsets.length > 0) {
                  filteredSet.subsets.forEach(function(setName) {
                    var filteredSubSet = _.find(scope.sets, function(set) {
                      return set.name === setName;
                    });
                    if(filteredSubSet) {
                      filteredSets.push(filteredSubSet);
                    }
                  });
                }
              }
            });
          }
          // if no sets matches for parameter show all available sets
          scope.filteredSets = filteredSets.length > 0 ? _.sortBy(filteredSets, 'name') : scope.sets;
          // validate set elements
          validSetName1ForParameter();
          validSetName2ForParameter();
        };

        scope.reloadSzenarioSet = function (bezugsjahr) {

          if (!bezugsjahr) {
            bezugsjahr = scope.getDerivedValue('bezugsjahr');
          }

          scope.loadingSet = true;
          Datasets.loadScenarioSets().then(function (result) {
            if (!angular.isDefined(result)) {
              return;
            }
            scope.szenarien = [];
            for (var i = 0; i < result.length; i++) {
              if (result[i].jahr === parseInt(bezugsjahr)) {
                scope.szenarien = result[i].szenarien;
                scope.loadingSet = false;
              }
            }
            scope.loadingSet = false;

            // If the loaded Stammdatum is only defined for the `Standard` scenario, we must set scope.useStandard to true.
            scope.useStandard = scope.szenarien.length === 0 || scope.data.standardszenario;

          });
        };

        // If a new Stammdatum gets added scope.data.bezugsjahr is undefined.
        // When a reference gets selected we need to reload the possible scenarios for scope.data.parent.bezugsjahr.
        scope.$watch('data.parent', function (p) {
          if (!p) {
            return;
          }

          scope.reloadSzenarioSet(scope.data.bezugsjahr);
        });

        scope.$watch('data.setName1', function (s) {
          if (!s || s.length === 0) {
            scope.data.setElemente1 = [];
          }
        }, true);

        scope.$watch('data.setName2', function (s) {
          if (!s || s.length === 0) {
            scope.data.setElemente2 = [];
          }
        }, true);

        scope.getDerivedValue = function (property) {
          return Datasets.getValue(_.get(scope, 'data.parent'), property);
        };

        scope.hasDerivedValue = function (property) {
          var value = scope.getDerivedValue(property);
          return value !== undefined && value !== null;
        };

        scope.getValue = function (property) {
          return Datasets.getValue(scope.data, property);
        };


        scope.getHorizont = function () {
          return angular.isDefined(scope.getDerivedValue('prognoseHorizont')) ? scope.getDerivedValue('prognoseHorizont') : 'Prognosezeitraum';
        };
        /**
         * Is there any ancestor of the stammdatum with the id given?
         * @param {Object} obj stammdatum
         * @param {String} id id to look for
         */
        function hasAncestor(obj, id) {
          return obj && (obj.id === id || hasAncestor(obj.parent, id));
        }

        scope.noDescendants = function (obj) {
          var id = scope.data.id;
          return !hasAncestor(obj, id);
        };

        /**
         * Create suffix to show if a scenario was inherited from an ancestor.
         * @param {String} s scenario name
         * @returns {string} suffix to signify inherited scenario
         */
        scope.inheritedScenario = function (s) {
          return (scope.data.parent && scope.data.szenarien.indexOf(s) !== -1) ? ' *' : '';
        };

        scope.submit = function () {
          scope.submitted = true;
          if (scope.form.$valid) {

            scope.data.prognoseHorizont = parseInt(scope.data.prognoseHorizont);
            scope.data.bezugsjahr = parseInt(scope.data.bezugsjahr);
            scope.data.standardszenario = scope.useStandard;

            // we create a new object. otherwise ng-repeat will throw errors while getting the text attrib.
            var result = angular.copy(scope.data);

            // the tags directive creates objects with a 'text' key, we are only interested in the text itself
            for (var i = 0; i < scope.data.setElemente1.length; i++) {
              result.setElemente1[i] = scope.data.setElemente1[i].text;
            }
            for (i = 0; i < scope.data.setElemente2.length; i++) {
              result.setElemente2[i] = scope.data.setElemente2[i].text;
            }

            if (scope.editSet1 && _.isEqual(result.setElemente1, scope.parentSetElemente1)) {
              result.setElemente1 = null;
            }
            if (scope.editSet2 && _.isEqual(result.setElemente2, scope.parentSetElemente2)) {
              result.setElemente2 = null;
            }


            scope.onSave({'$data': result});
          }
        };

        scope.getScenarioString = function(scenarios) {

          return _.map(scenarios, function (i) {
            return i.name;
          }).join(', ');
        };

        ///////////////////////////////////////////////////////////////////////
        // Private functions
        ///////////////////////////////////////////////////////////////////////

        function initSzenarioSet(bezugsjahr) {
          scope.loadingSet = true;
          Datasets.loadScenarioSets().then(function (result) {
            if (!angular.isDefined(result)) {
              return;
            }
            scope.szenarien = [];
            for (var i = 0; i < result.length; i++) {
              if (result[i].jahr === parseInt(bezugsjahr)) {
                scope.szenarien = result[i].szenarien;
                scope.loadingSet = false;
              }
            }
            scope.loadingSet = false;
          });
        }

        function externalToEditable(data) {
          var obj = Datasets.cloneMasterData(data);
          for (var i = 0; i < obj.setElemente1.length; i++) {
            obj.setElemente1[i] = {text: obj.setElemente1[i]};
          }
          for (i = 0; i < scope.data.setElemente2.length; i++) {
            obj.setElemente2[i] = {text: obj.setElemente2[i]};
          }
          return obj;
        }

        // init load szenario set
        initSzenarioSet(scope.data.bezugsjahr);
        scope.data = externalToEditable(scope.data);


        scope.makeSet1Editable = function() {

          if (scope.editSet1) {
            scope.editSet1 = false;
            scope.data.setElemente1 = [];
          } else {
            scope.editSet1 = true;
            scope.parentSetElemente1 = scope.getValue('setElemente1');

            scope.data.setElemente1 = _.map(scope.getValue('setElemente1'), function(i) {
              return {
                text: i
              };
            });
          }
        };

        scope.makeSet2Editable = function() {

          if (scope.editSet2) {
            scope.editSet2 = false;
            scope.data.setElemente2 = [];
          } else {
            scope.editSet2 = true;
            scope.parentSetElemente2 = scope.getValue('setElemente2');

            scope.data.setElemente2 = _.map(scope.getValue('setElemente2'), function(i) {
              return {
                text: i
              };
            });
          }
        };

        /**
         * The 'parent' attribute have to be removed before using angular filter with $viewValue.
         * @returns {Function} function item for autocompletion
         */
        scope.removeParent = function() {
          return function(mdat) {
            delete mdat['parent'];
            return mdat;
          };
        };
      }
    };
  });
