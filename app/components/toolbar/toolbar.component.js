(function () {
  'use strict';

  /* @ngInject */
  function ToolbarController(toolbarServices) {
    var vm = this;
    vm.modelName = 'IRPopt';

    vm.$onInit = function () {
      toolbarServices.getModelDefinitions().then(function (modelDefinitions) {
        vm.modelDefinitions = modelDefinitions;
      });
    };

    vm.setModelName = function (model) {
      vm.modelName = model.name;
    };

  }

  angular
    .module('irpsimApp.toolbar')
    .component('appToolbar', {
      templateUrl: 'components/toolbar/toolbar.html',
      controller: ToolbarController
    });
})
();

