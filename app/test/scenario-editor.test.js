/*  This site supplies some basic information about testing with angularJS:

    https://docs.angularjs.org/guide/unit-testing

    The ScenarioEditor test checks for the print variable defined on the Controller Object.
 */
describe('Controller: ScenarioEditorCtrl', function () {
  beforeEach(module('irpsimApp'));

  var $controller, $rootScope;

  /*
      Load controller and rootScope provider.
   */
  beforeEach(inject(function (_$controller_, _$rootScope_) {
    // The injector unwraps the underscores (_) from around the parameter names when matching
    $controller = _$controller_;
    $rootScope = _$rootScope_;
  }));

  /*
      Checks ScenarioEditorCtrl.print ot be false.
      TODO: This is an example. It can be deleted after writing more complex test functions.
   */
  describe('Check print bool', function () {
    it('Print bool should be false by default.', function () {

      // Setting dummy values.
      var scenario = {};
      var modelType = 'Basismodell', info = undefined;

      // Create test scope.
      var $scope = $rootScope.$new();
      var controller = $controller('ScenarioEditorCtrl', {$scope: $scope, scenario: scenario, modelType: modelType, info: info});

      expect(controller.print).toEqual(false);
    })
  });
});
