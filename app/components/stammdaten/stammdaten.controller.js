'use strict';

/**
 * @ngdoc function
 * @name irpsimApp.controller:StammdatenCtrl
 * @description
 * # StammdatenCtrl
 * Controller of the irpsimApp. Handles CRUD for master data
 */
angular.module('irpsimApp')
  .controller('StammdatenCtrl', function ($scope, $filter, $http, $q, Logger, Datasets, Upload, uiGridConstants, localStorageService, $timeout, $uibModal, $log, growl) {

    /**
     * Updates the master data table. Will be called after operations like
     *   - adding new item
     *   - import backup configuration
     *   - import timeseries data
     */
    function refreshData() {
      Datasets.fetchAll().then(function success(Datasets) {

        $scope.tableConfig.data = Datasets.data;
      });
    }

    var CACHE_KEY = 'stammdaten-tabelle';
    $scope.newEntry = null;

    function template(property) {
      return '<div class="ui-grid-cell-contents" title="TOOLTIP">' +
        '<span ng-class="{abstract: row.entity.abstrakt}">' +
        '{{grid.appScope.getView(row.entity,"' + property + '")}}' +
        '</span>' +
        '</div>';
    }

    var resolutionTemplate = '<div class="ui-grid-cell-contents" title="TOOLTIP">' +
      '<span ng-class="{abstract: row.entity.abstrakt}">' +
      '{{grid.appScope.getResolutionString(grid.appScope.getView(row.entity,"zeitintervall"))}}' +
      '</span>' +
      '</div>';

    function arrayTemplate(property) {
      return '<div class="ui-grid-cell-contents" title="TOOLTIP">' +
        '<span ng-class="{abstract: row.entity.abstrakt}">' +
        '{{grid.appScope.joinArray(grid.appScope.getView(row.entity,"' + property + '"))}}' +
        '</span>' +
        '</div>';
    }

    function scenariosTemplate() {
      return '<div class="ui-grid-cell-contents" title="TOOLTIP">' +
        '<span ng-class="{abstract: row.entity.abstrakt}">' +
        '{{grid.appScope.getScenarioString(row.entity)}}' +
        '</span>' +
        '</div>';
    }

    var completeTemplate = '<span class="ui-grid-cell-contents" title="TOOLTIP" ng-class="{abstract: row.entity.abstrakt}" ng-style="{ color: grid.appScope.getFontColor(row.entity) }">' +
      '{{row.entity.abstrakt ? "" : grid.appScope.formatComplete(row.entity)}}' +
      '</span>';

    $scope.tableConfig = {
      enableSorting: true,
      showGridFooter: false,
      showColumnFooter: false,
      enableFiltering: true,
      enableGridMenu: true,
      enablePaginationControls: true,
      paginationPageSizes: [15, 30, 50, 100],
      paginationPageSize: 15,
      enableColumnResizing: true,
      columnDefs: [
        {cellTemplate: template('name'), field: 'name', name: 'Name', enableHiding: false, type: 'string', width: 250},
        {
          cellTemplate: template('typ'),
          field: 'typ',
          name: 'Parametertyp',
          enableHiding: false,
          cellTooltip: true,
          type: 'string',
          width: 150
        },
        {
          cellTemplate: template('bezugsjahr'),
          field: 'bezugsjahr',
          name: 'Bezugsjahr',
          enableHiding: false,
          type: 'number',
          width: 100
        },
        {
          cellTemplate: template('prognoseHorizont'),
          field: 'prognoseHorizont',
          name: 'Prognosehorizont',
          type: 'number',
          width: 100,
          visible: true
        },
        {
          cellTemplate: resolutionTemplate,
          field: 'zeitintervall',
          name: 'Auflösung',
          type: 'number',
          width: 120,
          visible: true
        },
        {
          cellTemplate: completeTemplate,
          field: 'vollstaendig',
          name: 'Vollständigkeit',
          type: 'number',
          width: 120
        },
        {
          cellTemplate: scenariosTemplate('szenarien'),
          field: 'szenarien',
          name: 'Szenarien',
          width: 200,
          visible: true
        },
        {
          cellTemplate: template('verantwortlicherBezugsjahr.name'),
          field: 'verantwortlicherBezugsjahr.name',
          name: 'Verantwortlich Bezugsjahr',
          type: 'string',
          width: 200,
          visible: true
        },
        {
          cellTemplate: template('verantwortlicherBezugsjahr.email'),
          field: 'verantwortlicherBezugsjahr.email',
          name: 'Email Verantwortlich Bezugsjahr',
          cellTooltip: true,
          type: 'string',
          width: 250,
          visible: false
        },
        {
          cellTemplate: template('verantwortlicherPrognosejahr.name'),
          field: 'verantwortlicherPrognosejahr.name',
          name: 'Verantwortlich Prognosen',
          type: 'string',
          width: 200,
          visible: true
        },
        {
          cellTemplate: template('verantwortlicherPrognosejahr.email'),
          field: 'verantwortlicherPrognosejahr.email',
          name: 'Email Verantwortlich Prognosen',
          type: 'string',
          width: 250,
          visible: false
        },
        {
          cellTemplate: template('setName1'),
          field: 'set1',
          name: 'Set 1',
          width: 120,
          visible: false
        },
        {
          cellTemplate: template('setName2'),
          field: 'set2',
          name: 'Set 2',
          width: 120,
          visible: false
        },
        {
          cellTemplate: arrayTemplate('setElemente1'),
          field: 'setElemente1',
          name: 'Setelemente 1',
          width: 200,
          visible: false
        },
        {
          cellTemplate: arrayTemplate('setElemente2'),
          field: 'setElemente2',
          name: 'Setelemente 2',
          width: 200,
          visible: false
        },
        {
          field: 'abstrakt',
          name: 'abstrakt',
          visible: true,
          width: 80
        },
        {
          cellTemplate: 'components/stammdaten/stammdaten-buttons.html',
          name: 'Aktionen',
          width: 200,
          pinnedRight: true
        },
        { field: 'id',
          name: 'ID',
          width:100,
          visible: true
        },
        {
          cellTemplate: template('kommentar'),
          field: 'typ',
          name: 'Kommentar',
          enableHiding: false,
          cellTooltip: true,
          type: 'string',
          width: 150
        }],
      gridMenuCustomItems: [
        {
          icon: 'fa fa-file-text-o',
          title: 'Stammdatum neu anlegen',
          action: function () {
            $scope.openAddingModal();
          },
          order: 210
        },
        {
          icon: 'fa fa-upload',
          title: 'Markierte Stammdaten exportieren',
          action: function () {
            // get all selected rows
            var mdSelected = $scope.gridApi.selection.getSelectedRows();

            // return all selected master data ids
            var mdIds = mdSelected.map(function(row) {
              return row.id;
            });

            // all master data without any reference will be grouped by -1
              var mdGroupByReference = _.groupBy(mdSelected, function(md) { return md.referenz === null ? -1 : md.referenz; });

            // finally open the modal if some master data is selected
            if (mdIds.length > 0) {
              $scope.openExportModal(mdIds, mdGroupByReference);
            } else {
              growl.warning('Es wurden keine Stammdaten selektiert.');
            }
          },
          order: 211
        },
        {
          icon: 'fa fa-floppy-o',
          title: 'Einstellungen der Tabelle im Browser speichern',
          action: function () {
            var state = this.grid.api.saveState.save();
            localStorageService.set(CACHE_KEY, state);
          },
          order: 212
        },
        {
          icon: 'fa fa-download',
          title: 'Stammdaten importieren',
          action: function () {
            var modalInstance = $uibModal.open({
              templateUrl: 'components/stammdaten/stammdaten-import-master-data.modal.html',
              controllerAs: 'vm',
              controller: 'stammdatenModalImportMasterDataCtrl',
              size: 'lg'
            });

            modalInstance.result.then(function () {
              Datasets.fetchAll().then(function success() {
                refreshData();
              });
            }, function () {
              refreshData();
            });
          },
          order: 213
        },
        {
          icon: 'fa fa-file-excel-o',
          title: 'Zeitreihen-Daten für Stammdaten importieren',
          action: function () {
            var modalInstance = $uibModal.open({
              templateUrl: 'components/stammdaten/stammdaten-import-timeseries-data.modal.html',
              controllerAs: 'vm',
              controller: 'stammdatenModalImportTimeseriesDataCtrl',
              size: 'lg'
            });

            modalInstance.result.then(function () {
              Datasets.fetchAll().then(function success() {
                refreshData();
              });
            }, function () {
              refreshData();
            });
          },
          order: 214
        }
      ],
      minRowsToShow: 17,
      enableRowSelection: true,
      onRegisterApi: function (gridApi) {
        $scope.gridApi = gridApi;
        // give the grid a digest cycle to initialize, then set stored state
        $timeout(function () {
          var state = localStorageService.get(CACHE_KEY);
          if (state) {
            gridApi.saveState.restore($scope, state);
          }
        }, 0);
      }
    };

    refreshData();

    // ------------------- view support ------------------------------------------------------
    $scope.getScenarioString = function (stammdatum) {
      if (stammdatum.standardszenario) {
        return 'Standard';
      }

      return $scope.joinArray(_.map(Datasets.getScenarioSet(Datasets.getValue(stammdatum, 'bezugsjahr')), function(i) {
        return i.name;
      }));
    };


    $scope.getView = Datasets.getValue;

    $scope.getFontColor = function (data) {
      var v = $scope.getView(data, 'vollstaendig');
      if (v > 0) {
        if (v === 100) {
          return '#449d44'; // green
        } else {
          return '#f0ad4e'; // yellow
        }
      } else {
        return '#d9534f'; // red
      }
    };

    $scope.formatComplete = function (data) {
      var d = $scope.getView(data, 'vollstaendig');
      return d >= 0 ? $filter('number')(d, 2) + '%' : 'n.a.';
    };

    $scope.joinArray = function (obj) {
      if (Array.isArray(obj)) {
        return obj.join(', ');
      }
    };

    /**
     * Label for time resolutions.
     * @param {String} resolution year, month, day....
     * @returns {*}
     */
    $scope.getResolutionString = function (resolution) {
      var o = _.find(Datasets.resolutions, function (o) {
        return o.value === resolution;
      });
      if (o) {
        return o.label;
      } else {
        return resolution;
      }
    };

    $scope.isComplete = Datasets.isComplete;

    $scope.getExcelLink = function (entry) {
      // create link here so our url renaming logic at build time can find it
      return '/backend/simulation/stammdaten/' + entry.id + '/excel';
    };

    $scope.hasDescendants = Datasets.hasDescendants;

    // ------------------- CRUD ---------------------------------------------------------------
    $scope.onDelete = function (entry) {
      Datasets.delete(entry).then(function () {
        refreshData();
      });
    };

    $scope.onEdit = function (entry) {
      $scope.isEditing = true;
      if (entry) { // change existing entry
        $scope.newEntry = entry;
      } else {
        $scope.newEntry = Datasets.createNewMasterData();
      }

      $scope.openAddingModal($scope.newEntry);
    };

    $scope.onCopy = function (entry) {
      var copy = Datasets.cloneMasterData(entry);
      delete copy.id;
      copy.vollstaendig = 0;
      copy.name = copy.name + ' (Kopie)';
      $scope.isEditing = true;
      $scope.newEntry = copy;
      $scope.openAddingModal($scope.newEntry);
    };

    function showBackendError(response) {
      console.error(response);
      Logger.addLog({
        title: 'Speichern eines Stammdatums',
        text: 'Stammdatum konnte nicht gespeichert werden.',
        severity: 'error',
        notify: true
      });
    }

    function finishEdit() {
      $scope.newEntry = null;
      refreshData();
    }

    $scope.save = function (entry) {
      $scope.isEditing = false;
      /*
       https://github.com/angular-ui/ui-grid/issues/1302#issuecomment-119505180
       there is a bug in ui-grid preventing rerendering of changed row objects
       see pull request https://github.com/angular-ui/ui-grid/pull/4818/commits/2791ac494034d7f61e217ad136caf4b8afdfe2d5
       */
      delete entry.$$hashKey;
      Datasets.save(entry).then(finishEdit, showBackendError);
    };

    $scope.cancel = function () {
      $scope.isEditing = false;
      $scope.newEntry = null;
    };


    $scope.openAddingModal = function (entry) {
      var modalInstance = $uibModal.open({
        templateUrl: 'components/stammdaten/stammdaten-adding.modal.html',
        controller: 'stammdatenModalCtrl',
        size: 'lg',
        resolve: {
          newEntry: function () {
            if (entry) {
              return entry;
            }
            return Datasets.createNewMasterData();
          }
        }
      });

      modalInstance.result.then(function (newEntry) {
        $scope.save(newEntry);
        refreshData();
      }, function () {
        refreshData();
        $log.info('Modal dismissed at: ' + new Date());
      });
    };

    $scope.openExportModal = function (mdIds, mdGroupByReference) {
      var modalInstance = $uibModal.open({
        templateUrl: 'components/stammdaten/stammdaten-export.modal.html',
        controller: 'stammdatenModalExportCtrl',
        size: 'lg',
        resolve: {
          mdIds: function() {
            if(mdIds) {
              return mdIds;
            }
          },
          mdGroupByReference: function() {
            if (mdGroupByReference) {
              return mdGroupByReference;
            }
          }
        }
      });

      modalInstance.result.then(function (ids) {
        // get export file
        $http({
          url: '/backend/simulation/stammdaten/export',
          method: 'GET',
          params: { ids: ids }
        }).then(function success(response) {
          var date = new Date();
          var year = date.getFullYear();
          var month = parseInt(date.getMonth())+1;
          var day = date.getDate();
          // filename depends on selected row length
          var filename;
          if (ids.length === 1) {
            filename = 'Export_von_1_Stammdatum_' + year + '-' + month + '-' + day + '.backup';
          } else {
            filename = 'Export_von_' + ids.length + '_Stammdaten_' + year + '-' + month + '-' + day + '.backup';
          }
          // create blob for download
          var blob = new Blob([JSON.stringify(response.data)], {type: 'text/plain'});
          // download dialog (@see https://github.com/eligrey/FileSaver.js)
          saveAs(blob, filename); // jshint ignore:line
          // show alert
          growl.success('Export erfolgreich');
          // unselect rows
          $scope.gridApi.selection.clearSelectedRows();
        }, function error(err) {
	    console.err(err);
          // error handling for exporting master data
          // unselect rows
          $scope.gridApi.selection.clearSelectedRows();
        });
      }, function () {
        $log.info('Modal dismissed at: ' + new Date());
        // HINT: DISABLED CLEARING ROWS
        // unselect rows
        //$scope.gridApi.selection.clearSelectedRows();
      });
    };

    $scope.defineAlgebraicDataset = function (entry) {
      $uibModal.open({
        templateUrl: 'components/data-dashboard/algebraic-dataset.modal.html',
        controller: 'alegbraicDatasetModalCtrl',
        windowClass: 'extra-large-modal', // self made css class!
        resolve: {
          stammdatum: function () {
            return entry;
          },
          datensatz: function(){
            return $http.get('/backend/simulation/stammdaten/' + entry.id + '/algebraicdata').then(_.property('data'));
          }
        }
      });

    };
  });

angular.module('irpsimApp').controller('stammdatenModalCtrl', function ($scope, $uibModalInstance, newEntry) {

  $scope.newEntry = newEntry;

  $scope.close = function (newEntry) {
    $uibModalInstance.close(newEntry);
  };

  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
});

angular.module('irpsimApp').controller('stammdatenModalExportCtrl', function ($scope, $http, $uibModalInstance, growl, mdIds, mdGroupByReference, Datasets) {
  // used to solve conflicts (all items excluding -1)
  $scope.mdGroupByReference = mdGroupByReference;

  // holds all master data which will be exported on submit
  $scope.mdSelection = mdGroupByReference[-1] || [];

  //console.log('mdGroupByReference', mdGroupByReference);

  // extract all referenced ids
  var referenceIds = _.uniq(_.without(Object.keys(mdGroupByReference), '-1'));

  // required ids, but not selected by user
  var requiredIds = _.filter(referenceIds, function(id) {
    // reference id is was not selected by user
    if (mdIds.indexOf(Number(id)) === -1) {
      return true;
    } else {
      // was selected, so add all reference master data to mdSelection
      $scope.mdSelection = $scope.mdSelection.concat($scope.mdGroupByReference[Number(id)]);
      return false;
    }
  });

  // get metadata for required ids
  $scope.requiredMds = _.filter(Datasets.data, function(md) {
    return _.contains(requiredIds, ''+md.id); // Object.keys produces strings
  });

  // add required master data for all referenced master data
  $scope.accept = function(md) {
    // check recursive for parents
    function pushParentsToMdSelection(p) {
      //console.log('parent', p);
      if(_.contains($scope.mdSelection, p)) {
        //console.log('master data already inserted, do not recursively check for parents');
      } else {
        // push parent
        $scope.mdSelection.push(p);
        // check for parents
        if(p.parent) {
          // if parent is not already pushed, add it to mdSelection
          //console.log('mdSelection, parent, contains?', $scope.mdSelection, p.parent, _.contains($scope.mdSelection, p.parent));
          if(_.contains($scope.mdSelection, p.parent)) {
            //console.log('already pushed', p.parent);
          } else {
            //console.log('push new parent', p.parent);
            // check if parent has parent (recursive)
            pushParentsToMdSelection(p.parent);
          }
        }
      }
    }

    // remove it from required mds ...
    $scope.requiredMds.splice($scope.requiredMds.indexOf(md), 1);
    // ... and add it to mdSelection


    $scope.mdSelection = $scope.mdSelection.concat($scope.mdGroupByReference[md.id]);

    // push parents deep to mdSelection
    pushParentsToMdSelection(md);
  };

  // reject required master data leads to ignore referenced master data which was selected before by user
  $scope.reject = function(md) {
    // remove it from required mds
    $scope.requiredMds.splice($scope.requiredMds.indexOf(md), 1);
  };

  // on submit do the export
  $scope.export = function() {
    var ids = _.map($scope.mdSelection, function(md) { return md.id; });
    // close modal and set ids
    $uibModalInstance.close(ids);
  };

  // cancel export
  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
});

angular.module('irpsimApp').controller('stammdatenModalImportMasterDataCtrl', function ($scope, $http, $uibModalInstance, growl, Upload) {

  var vm = this;

  vm.validFile = false;
  vm.isUploading = false;

  // function isZip(file) {
  //   var mimeTypesZip = [
  //     'application/octet-stream',
  //     'multipart/x-zip',
  //     'application/zip',
  //     'application/zip-compressed',
  //     'application/x-zip-compressed'
  //   ];
  //
  //   return mimeTypesZip.indexOf(file.type) !== -1;
  // }

  vm.isLargeFile = function(file) {
    if(file) {
      return file.size / 1024 / 1024 > 100;
    } else {
      return false;
    }
  };

  vm.humanFileSize = function(bytes, si) {
    var thresh = si ? 1000 : 1024;
    if(Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    var units =
      si ? ['kB','MB','GB','TB','PB','EB','ZB','YB']
        : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while(Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1)+' '+units[u];
  };

  vm.import = function() {
    var f = $scope.importFile;
    var fileExtension = f && f.name.split('.')[f.name.split('.').length-1] || null;
    if (['json', 'sds', 'zip'].includes(fileExtension)) {
      vm.isUploading = true;
      f.error = false;
      Upload.upload({
        url: '/backend/simulation/stammdaten/export',
        method: 'PUT',
        data: {file: f},
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      }).then(function () {
        vm.isUploading = false;
        f.success = true;
        f.progress = 100.0;
        $uibModalInstance.close();
      }, function (error) {
        vm.isUploading = false;
        f.success = false;
        f.error = true;
        f.message = _.get(error.data, 'messages[0].text');
      }, function (evt) {
        f.progress = parseInt(100.0 * evt.loaded / evt.total);
        if(f.progress === 100.0) {
          growl.info('Übertragungs zum Server erfolgreich. Verarbeitung läuft...');
        }
      });
    }
  };

  vm.cancel = function() {
    $uibModalInstance.dismiss('cancel');
  };

  $scope.$watch('importFile', function(newFile) {
    vm.validFile = newFile instanceof File ? true : false; // jshint ignore:line
    if(vm.isLargeFile(newFile)) {
      growl.warning('Bitte laden Sie ihren Stammdatenimport als ZIP-Archiv hoch.');
    }
  });

});

angular.module('irpsimApp').controller('stammdatenModalImportTimeseriesDataCtrl', function ($scope, $uibModalInstance, Upload) {

  var vm = this;

  $scope.$watch('files', function (newFiles) {
    if (newFiles && newFiles.length) {
      for (var i = 0; i < newFiles.length; i++) {
        upload(newFiles[i]);
      }
    }
  });

  function upload(fileContents) {

    if (!angular.isDefined(fileContents) || (fileContents === null)) {
      return;
    }

    Upload.upload({
      url: '/backend/simulation/stammdaten/excel',
      method: 'PUT',
      data: {file: fileContents},
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    }).then(function () {
      fileContents.success = true;
      fileContents.progress = 100.0;
    }, function (error) {
      console.log(error);
      fileContents.success = false;
      fileContents.message = _.get(error.data, 'messages[0].text');
    }, function (evt) {
      fileContents.progress = parseInt(50.0 * evt.loaded / evt.total);
    });
  }

  vm.cancel = function() {
    $uibModalInstance.dismiss('cancel');
  };
});
