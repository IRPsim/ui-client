'use strict';

/**
 * @ngdoc service
 * @name irpsimApp.ScenarioValidation
 * @description
 * # ScenarioValidation
 * Service in the irpsimApp.
 */
angular.module('irpsimApp')
  .service('ScenarioValidation', function (ScenarioDefinitions, Logger) {
    var ScenarioValidation = this;

    ///////////////////////////// enforce rules /////////////////////////////////////////////////////

    function setBoolean(scenario, targetParameterName, definition, location, booleanValue) {
      var path;
      if (location[0] === 'sets') {
        path = 'sets["' + definition.dependencies[0] + '"].values["' + location[1] + '"]["' + targetParameterName + '"].value';
      } else if (location[0] === 'tables') {
        path = 'tables["' + targetParameterName + '"].value.["' + location[1] + '"]["' + location[2] + '"].value';
      } else if (location[0] === 'scalars') {
        path = 'scalars["' + targetParameterName + '"].value';
      }
      var targetObj = _.get(scenario, path);
      if (angular.isUndefined(targetObj) || targetObj === null) {
        Logger.addLog({
          title: 'Regel: Setze Schalter',
          text: 'Konnte abhängigen Parameter <strong>' + targetParameterName + '</strong> ' + JSON.stringify(location) + ' NICHT auf ' + booleanValue + ' setzen, nicht implementiert!',
          severity: 'warning',
          notify: true
        });
      } else {
        _.set(scenario, path, booleanValue);
        Logger.addLog({
          title: 'Regel: Setze Schalter',
          text: 'Setze abhängigen Parameter <strong>' + targetParameterName + '</strong> ' + JSON.stringify(location) + ' auf ' + booleanValue,
          severity: 'info',
          notify: true
        });
      }
    }

    /**
     * enforce exclusive toggle rules (two pairwise disjunct boolean values.)
     * currently emitted by editsinglevalue.directive.js@scope.validateAndBroadcastChange
     */
    ScenarioValidation.enforceToggles = function (scenario, data) {
      _.each(data.definition.rule, function (rule) {
        if (data.value === rule.if.value) {
          setBoolean(scenario, rule.then.name, data.definition, data.location, rule.then.value);
        }
      });
    };

    /**
     * @param {Object} scenario current model scenario
     * @param {String} type type of the model
     * @param {String} name name of the target parameter
     * @param {Array} sourceDependencies names of dependencies on the parameter of the left side of the rule
     * @param {Array} targetDependencies names of dependencies on the parameter of the right side of the rule
     * @param {Array} sourceLocation cursor for the exact position of the source parameter
     * @param {function} predicateFn predicate test to validate target parameter
     * @param {function} errorMessageSuffixTemplateFn function to create value specific error message suffix
     * @returns {string} error message of null if everything is fine
     */
    function validateValue(scenario, type, name, sourceDependencies, targetDependencies, sourceLocation, predicateFn, errorMessageSuffixTemplateFn) {
      var definition, i, currentValue;
      switch (targetDependencies.length) {
        case 0: // validate a scalar
          currentValue = scenario.scalars[name];
          if (!predicateFn(currentValue)) {
            return name + ' ' + errorMessageSuffixTemplateFn(currentValue);
          }
          break;
        case 1: // validate set attributes
          definition = ScenarioDefinitions.getDefinition(type, scenario.config.modeldefinition, 'attributes', name);
          var theSet = scenario.sets[definition.dependencies[0]];
          var setNames = (targetDependencies[0] === '*') ? theSet.names : [sourceLocation[1 + sourceDependencies.indexOf(targetDependencies[0])]];
          for (i = 0; i < setNames.length; i++) {
            currentValue = theSet.values[setNames[i]][name].value;
            if (!predicateFn(currentValue)) {
              return 'Das Attribut "' + definition.identifier + '" (' + name + ') für ' + setNames[i] + ' ' + errorMessageSuffixTemplateFn(currentValue);
            }
          }
          break;
        case 2: // validate a table
          definition = ScenarioDefinitions.getDefinition(type, scenario.config.modeldefinition, 'tables', name);
          var rows = (targetDependencies[0] === '*') ? scenario.sets[definition.dependencies[0]].names : [sourceLocation[1 + sourceDependencies.indexOf(targetDependencies[0])]];
          var cols = (targetDependencies[1] === '*') ? scenario.sets[definition.dependencies[1]].names : [sourceLocation[1 + sourceDependencies.indexOf(targetDependencies[1])]];
          var table = scenario.tables[name].value;
          for (i = 0; i < rows.length; i++) {
            var row = rows[i];
            for (var j = 0; j < cols.length; j++) {
              var col = cols[j];
              currentValue = table[rows][col].value;
              if (!predicateFn(currentValue)) {
                return 'Der Tabellenwert "' + definition.identifier + '" (' + name + ') für ' + row + ' und ' + col + ' ' + errorMessageSuffixTemplateFn(currentValue);
              }
            }
          }
          break;
      }
    }

    var validationFunctions = {
      '==': function (a, b) {
        return a === b;
      },
      '!=': function (a, b) {
        return a !== b;
      },
      '<=': function (a, b) {
        return a <= b;
      },
      '<': function (a, b) {
        return a < b;
      },
      '>': function (a, b) {
        return a > b;
      },
      '>=': function (a, b) {
        return a >= b;
      },
      'values': function(a,validValues){
        return _.indexOf(validValues,a) !== -1;
      }
    };

    ScenarioValidation.validationFunctions = validationFunctions;

    function bool2German(value) {
      return value ? '"Ja"' : '"Nein"';
    }

    function createFixedValueRule(constraintFn, errorMessage) {
      return {
        type: 'fixedComparison',
        constraint: constraintFn,
        errorMessage: errorMessage
      };
    }

    function createSensitivityFixedValueRule() {
      return {
        type: 'sensitivityComparison',
        constraint: sensitivityCheck
      };
    }

    var sensFuncs = {
      '+': function (a, b) {
        return a + b;
      },
      '*': function (a, b) {
        return a * b;
      }
    };

    /**
     * Domain-Rules with sensitivity.
     *
     * @param {Number} value Value to be checked.
     * @param {Object} definition Param definition.
     * @param {Object} sensitivity Sensitivity object.
     */
    function sensitivityCheck(value, definition, sensitivity) {

      if (!sensitivity) {
        return null;
      }

      // get operator
      var m;
      if (sensitivity.mode === 'multiply') {
        m = '*';
      } else {
        m = '+';
      }

      for (var i = 0; i < sensitivity.range.length; i++) {
        var s = sensitivity.range[i];
        if(definition.domain) {
          if (angular.isDefined(definition.domain['>']) && definition.domain['>'] !== null && sensFuncs[m](s, value) <= definition.domain['>']) {
            return 'Wegen der ' + (i + 1) + '. Sensitivität ' + s + ' wird mit ' + s + ' ' + m + ' ' + value + ' = ' + sensFuncs[m](s, value) +
              ' die exklusive Untergrenze ' + definition.domain['>'] + ' verletzt.';
          }
          if (angular.isDefined(definition.domain['>=']) && definition.domain['>='] !== null && sensFuncs[m](s, value) < definition.domain['>=']) {
            return 'Wegen der ' + (i + 1) + '. Sensitivität ' + s + ' wird mit ' + s + ' ' + m + ' ' + value + ' = ' + sensFuncs[m](s, value) +
              ' die inklusive Untergrenze ' + definition.domain['>='] + ' verletzt.';
          }
          if (angular.isDefined(definition.domain['<']) && definition.domain['<'] !== null && sensFuncs[m](s, value) >= definition.domain['<']) {
            return 'Wegen der ' + (i + 1) + '. Sensitivität ' + s + ' wird mit ' + s + ' ' + m + ' ' + value + ' = ' + sensFuncs[m](s, value) +
              ' die exklusive Obergrenze ' + definition.domain['<'] + ' verletzt.';
          }
          if (angular.isDefined(definition.domain['<=']) && definition.domain['<='] !== null && sensFuncs[m](s, value) > definition.domain['<=']) {
            return 'Wegen der ' + (i + 1) + '. Sensitivität ' + s + ' wird mit ' + s + ' ' + m + ' ' + value + ' = ' + sensFuncs[m](s, value) +
              ' die inklusive Obergrenze ' + definition.domain['<='] + ' verletzt.';
          }
        }
      }
      return null;
    }

    /**
     * Domain-Rules without sensitivity.
     *
     * @param {Object} definition Param definition.
     * @returns {Array}
     */
    function createDomainRangeRules(definition) {
      var validations = [];
      if(definition.domain) {
        if (angular.isDefined(definition.domain['>']) && definition.domain['>'] !== null) {
          validations = validations.concat(createFixedValueRule(_.curry(validationFunctions['<'])(definition.domain['>']), 'Der Wert muss größer als ' + definition.domain['>'] + ' sein.'));
        }
        if (angular.isDefined(definition.domain['>=']) && definition.domain['>='] !== null) {
          validations = validations.concat(createFixedValueRule(_.curry(validationFunctions['<='])(definition.domain['>=']), 'Der Wert muss größer oder gleich ' + definition.domain['>='] + ' sein.'));
        }
        if (angular.isDefined(definition.domain['<']) && definition.domain['<'] !== null) {
          validations = validations.concat(createFixedValueRule(_.curry(validationFunctions['>'])(definition.domain['<']), 'Der Wert muss kleiner als ' + definition.domain['<'] + ' sein.'));
        }
        if (angular.isDefined(definition.domain['<=']) && definition.domain['<='] !== null) {
          validations = validations.concat(createFixedValueRule(_.curry(validationFunctions['>='])(definition.domain['<=']), 'Der Wert muss kleiner oder gleich ' + definition.domain['<='] + ' sein.'));
        }
      }
      return validations;
    }

    ScenarioValidation.changeValidator = function (scenario, type, validationEvent) {
      // TODO validate years: not earlier than the initial year, no duplicates, do not change initial year after other delta years are added (initial year is not a delta year, must stay at the first index in the multiYearScenario.years array)
      var definition = validationEvent.definition;
      var sensitivity = validationEvent.sensitivity;
      var rules = definition.validation || [];
      if (!angular.isArray(rules)) {
        rules = [rules]; //FIXME workaround, should always be an array, ensure in parser?
      }
      return _(rules)
        .concat(createDomainRangeRules(definition))
        .concat(createSensitivityFixedValueRule(definition, sensitivity))
        .map(function (rule) {
          switch (rule.type) {
            case 'sensitivityComparison':
              return rule.constraint(validationEvent.value, definition, sensitivity);
            case 'fixedComparison':
              return !rule.constraint(validationEvent.value) ? rule.errorMessage : null;
            case 'comparison': // compare value to another parameter
              return validateValue(
                scenario,
                type,
                rule.parameters[1].name,
                rule.parameters[0].dependencies,
                rule.parameters[1].dependencies,
                validationEvent.location,
                _.curry(validationFunctions[rule.predicate])(validationEvent.value),
                function (value) {
                  return 'muss einen Wert ' + rule.predicate + ' ' + value + ' haben.';
                });
            case 'if-validation': // complex rule
              if (validationEvent.value === rule.if.value) {
                return validateValue(
                  scenario,
                  type,
                  rule.then.name,
                  rule.if.dependencies,
                  rule.then.dependencies,
                  validationEvent.location,
                  function (b) {
                    return rule.then.value === b;
                  },
                  function (value) {
                    return 'darf nicht den Wert ' + bool2German(value) + ' haben.';
                  });
              }
              break;
          }
        })
        .reject(function (v) {
          return v === null || angular.isUndefined(v);
        })
        .value();
    };
  })
;
