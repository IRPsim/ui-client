'use strict';

angular.module('irpsimApp')
  .controller('sensitivityCtrl', function ($scope, $uibModalInstance, label, min, max, domain, value, mode, ScenarioValidation) {

    $scope.mode = mode;
    $scope.label = label;
    $scope.min = min;
    $scope.max = max;

    $scope.cancel = function () {
      $uibModalInstance.dismiss('cancel');
    };

    $scope.submit = function () {
      if ($scope.form.$valid) {
        $uibModalInstance.close({
          range: [$scope.min, $scope.max],
          mode: $scope.mode
        });
      }
    };

    // This function gets called when the user changes the sensitivity mode (multiply / add)
    $scope.resetVals = function (mo) {

      $scope.maxError = $scope.minError = '';

      if (mo === 'multiply') {
        $scope.min = $scope.max = 1;
      } else if (mo === 'add') {
        $scope.min = $scope.max = 0;
      }
    };

    var modeFuncs = {
      'multiply': function (a, b) {
        return a * b;
      },
      'add': function (a, b) {
        return a + b;
      }
    };

    var modeSign = {
      'multiply': '*',
      'add': '+'
    };

    /**
     * Checks if a numeric value passes the sensitivity test.
     *
     * @param {String|Number} val Value to be checked
     * @param {Number} fac Factor to be applied
     * @returns {string} Contains an error message if it does not pass the test.
     */
    function checkSingleValue(val, fac) {

      for (var key in domain) {
        if (domain.hasOwnProperty(key)) {
          // select the right `compare function` and the right `mode function` and catch if it violates any of the rules
          if (!ScenarioValidation.validationFunctions[key](modeFuncs[$scope.mode](val, fac), domain[key]
            )) {
            return 'Der Sensitivitäts-Wert ' + fac + ' ist unzulässig, da mit ' + val + ' ' + modeSign[$scope.mode] + ' ' +
              fac + ' = ' + modeFuncs[$scope.mode](val, fac) +
              ' die Domain-Regel "' + key + ' ' + domain[key] + '" verletzt wird.';
          }
        }
      }
      return '';
    }

    // This function gets called every time a sensitivity gets changed by a user.
    $scope.isInvalidValue = function (fac) {

      if (!angular.isNumber(fac)) {
        return 'Die Eingabe ist keine Zahl.';
      } else if (!domain) {
        return '';
      }

      // simple numeric value
      if (!angular.isArray(value)) {
        return checkSingleValue(value, fac);

        // timeseries
      } else {
        for (var i = 0; i < value.length; i++) {
          var r = checkSingleValue(value[i], fac);
          if (r.length > 0) {
            return r;
          }
        }
      }

      return '';
    };

    // This function get called when the reset button gets pressed.
    $scope.reset = function () {
      $uibModalInstance.close({
        range: [1, 1],
        mode: 'multiply'
      });
    };
  });
