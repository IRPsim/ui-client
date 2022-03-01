'use strict';

/**
 * @ngdoc service
 * @name irpsimApp.PullFunction
 * @description
 * # PullFunction
 * Service in the irpsimApp.
 */
angular.module('irpsimApp')
  .service('PullFunction', function (ScenarioDefinitions, Datasets, Logger) {
    var PullFunction = this;

    /**
     * Each timeseries or scalar, be it standalone, in a table or as a set attribute, that is allowed to change
     * in a delta year, automatically gets set to the most appropriate dataset. To do decide, which dataset this should be,
     * the algorithm finds the dataset used in the last year, deduces the master data and forecast scenario associated
     * with it and tries to find the logical successor of this dataset for the given newYear object.
     * @param {object} origYear
     * @param {object} newYear
     * @param {String} modelType
     * @param {String|null} scenario optional explicit scenario name
     * @returns {object} newYear
     */
    PullFunction.pullDatasets = function(origYear, newYear, modelType, scenario){
      //get all parameters that are allowed to change per year
      // if we pull within the same year, we need to touch all parameters, else only parameters that
      // are explicitely declared as 'can be changed in delta years'
      var parameters = ScenarioDefinitions.extractUIParameters(modelType, origYear === newYear? 'input':'delta', newYear.config.modeldefinition);
      var messages = [];
      _.each(parameters, function(parameter){
        messages = messages.concat(pullDataset(origYear, newYear, parameter, scenario));
      });
      Logger.combineAndShow(messages);
      // TODO combine messages to prevent excessive $digest loops due to many parallel timeouts
      return newYear;
    };

    function isDBReference(value){
      return typeof value === 'string';
    }

    function processDataset(oldId, targetObj, parameterName, year, scenario){
      var response = Datasets.findNextLogicalDataset(oldId, year, scenario);
      targetObj['value'] = response.value;
      return {
        title: 'Pullfunktionalität',
        text: parameterName + ': '+response.text,
        severity: response.severity
      };
    }
    /**
     * Each timeseries or scalar, be it standalone, in a table or as a set attribute, that is allowed to change
     * in a delta year, automatically gets set to the most appropriate dataset. To do decide, which dataset this should be,
     * the algorithm finds the dataset used in the last year, deduces the master data and forecast scenario associated
     * with it and tries to find the logical successor of this dataset for the given newYear object.
     * @param {object} origYear
     * @param {object} newYear
     * @param {object} parameter definition of the model parameter that should be adjusted
     * @param {String|null} scenario optional explicit scenario name
     */
    function pullDataset(origYear, newYear, parameter, scenario){
      var old;
      var year = newYear.config.year.value;
      var messages = [];

      switch(parameter.type){
        case 'timeseries':
        case 'scalars':
          old = origYear[parameter.type][parameter.name].value;
          if(isDBReference(old)){
            //find best fitting dataset and replace value
            messages.push(processDataset(old,newYear[parameter.type][parameter.name], parameter.name, year, scenario));
          }
          break;
        case 'attributes':
          var vs = origYear.sets[parameter.set].values;
          _.forOwn(vs,function(obj,setMember){
            old = obj[parameter.name].value;
            if(isDBReference(old)){
              //find best fitting dataset and replace value
              messages.push(processDataset(old, newYear.sets[parameter.set].values[setMember][parameter.name], parameter.name, year, scenario));
            }
          });
          break;
        case 'tables':
          var table = origYear.tables[parameter.name].value;
          _.forOwn(table, function(row,rowKey){
            _.forOwn(row, function(entry,colKey){
              if(isDBReference(entry.value)){
                //find best fitting dataset and replace value
                messages.push(processDataset(entry.value,newYear.tables[parameter.name].value[rowKey][colKey], parameter.name, year, scenario));
              }
            });
          });
          break;
        default:
          messages.push({
            title: 'Mehrjahresszenario',
            text: 'Parametertyp "'+ parameter.type +'" ist unbekannt, Modell möglicherweise inkonsistent!',
            severity: 'error'
          });
      }
      return messages;
    }


    PullFunction.runPullForChangesToYear = function(multiYearScenario, type, yearsOldArr, yearsNewArr){
      if(yearsOldArr.length < 2 || yearsNewArr.length < 2 || yearsNewArr.length !== yearsOldArr.length || yearsOldArr === yearsNewArr){
        return;
      }
      var found = false;

      // year has changed, need to run pull function for all subsequent years
      var scenarios = multiYearScenario.years;
      for (var j = 1; j < yearsNewArr.length; j++) {
        var oldYear = yearsOldArr[j];
        var newYear = yearsNewArr[j];
        if(!found && oldYear !== newYear){
          found = true;
        }
        if(found){
          var oldScenario = scenarios[j-1];
          var newScenario = scenarios[j];
          PullFunction.pullDatasets(oldScenario, newScenario, type, null);
        }
      }
    };

    PullFunction.runPullForChangesToDefaultScenario = function(multiYearScenario, type, idx){
      var years = multiYearScenario.years;
      var scenario = years[idx].config.scenario.value;

      if(years.length === 0){
        return;
      }
      PullFunction.pullDatasets(years[idx], years[idx], type, scenario);
      for (var j = idx + 1; j < years.length ; j++) {
        var newYear = years[j];
        // first, change the scenario for all parameters of the year where the scenario was changed by the user
        newYear.config.scenario.value = scenario; // changed scenario needs to propagate to all following years
        // we found the change index, now start the pull function for all subsequent years
        PullFunction.pullDatasets(years[j-1], newYear, type, scenario);
      }
    };

    /* set_a_total is a special case: each element represents a year, instead of having one value per year.
     * We need to update these members manually! see https://www.pivotaltracker.com/n/projects/1541277/stories/133832027
     */
    PullFunction.runModelSpecific = function(multiYearScenario){
      var sc = multiYearScenario.years[0];
      var custNames = sc.sets['set_side_cust'].names;
      var setATotalNames = sc.sets['set_a_total'].names;
      var table = sc.tables['par_S_DS_growth_absolute'].value;
      var initialYear = sc.config.year.value;
      var optScenario = sc.config.scenario.value;

      for (var i = 0; i < custNames.length; i++) {
        var custName = custNames[i];
        for (var j = 1; j < setATotalNames.length; j++) {
          var setAName = setATotalNames[j-1];
          var nextSetAName = setATotalNames[j];
          var id = table[setAName][custName].value;
          if(isDBReference(id)) {
            var response = Datasets.findNextLogicalDataset(id, initialYear + j, optScenario);
            table[nextSetAName][custName].value = response.value;
          }
        }
      }
    };

    PullFunction.runPullForIndividualParameter = function(multiYearScenario, type, currentScenario, parameterName){
      // run pull function to configure the same timeseries parameter in the following years
      var parameters = ScenarioDefinitions.extractUIParameters(type, 'delta', multiYearScenario.years[0].config.modeldefinition);
      var changedParameterArr = _.filter(parameters,{name:parameterName});
      if(changedParameterArr.length !== 0){ // we may have multiple occurances of a parameter (with different subsets)
        var changedParameter = changedParameterArr[0];
        // find current year
        var allScenarios = multiYearScenario.years;
        var yearIdx = allScenarios.indexOf(currentScenario);
        var messages = [];
        // apply pull for each subsequent year
        if(yearIdx !== -1){
          for(var i=yearIdx; i<allScenarios.length-1; i++) {
            messages = messages.concat(pullDataset(allScenarios[i], allScenarios[i + 1], changedParameter, currentScenario.config.scenario.value));
          }
          Logger.combineAndShow(messages);
        }else{
          console.warn('could not apply pull function, can\'t identify current scenario', currentScenario);
        }
      }
    };

    function equalsAny(arr, string){
      return _.indexOf(arr,string) !== -1;
    }
    /**
     * If we know a setElement name and we have master data with matching filter properties,
     * we preselect all attributes/tables for this set element. This function can be used
     * to define multiple attributes of a single entity (for example all properties of a specific
     * technology).
     *
     * @param {Object} multiYearScenario object with 'years' array
     * @param {String} modelType type of our model
     */
    PullFunction.runVerticalPull = function(multiYearScenario, modelType, setName, setElementName){
      var v = Datasets.getValue;
      var initialScenario = multiYearScenario.years[0];
      var scenario = initialScenario.config.scenario.value;
      var year = initialScenario.config.year.value;
      var potentials = Datasets.identifyVerticalPullableElements(multiYearScenario.years[0].config.year.value);
      var setHierarchy = [setName].concat(ScenarioDefinitions.getDefinition(modelType, multiYearScenario.years[0].config.modeldefinition, 'sets', setName).supersets);
      var preDefined = _(setHierarchy)
        .map(function(s){
          return _.find(potentials,{set:s, member:setElementName});
        })
        .flatten()
        .filter(function(obj){return obj;})
        .value();

      if(preDefined) {
        var inputParameters = ScenarioDefinitions.extractUIParameters(modelType, 'input', multiYearScenario.years[0].config.modeldefinition);
        var deltaParameters = ScenarioDefinitions.extractUIParameters(modelType, 'delta', multiYearScenario.years[0].config.modeldefinition);
        // find all masterdata elements that have at least one filter set
        var potentialMasterdata = _.filter(Datasets.data,function(masterdata){
          return v(masterdata,'bezugsjahr') === year && (v(masterdata,'setName1') || v(masterdata,'setName2'));
        });
        _.each(inputParameters, function (inputParameter) {
          // do not compare set names with just === but rather test all supersets, too
          if (equalsAny(setHierarchy,inputParameter.set)) {
            var applicable =_.filter(potentialMasterdata, function(masterdata){
              return v(masterdata,'typ') === inputParameter.name &&
                ((equalsAny(setHierarchy,v(masterdata,'setName1')) && _.indexOf(v(masterdata,'setElemente1'),setElementName) !== -1) ||
                 (equalsAny(setHierarchy,v(masterdata,'setName2')) && _.indexOf(v(masterdata,'setElemente2'),setElementName) !== -1));
            });
            //TODO error iff table param, but filter misses one entry
            //only one allowed, warn otherwise
            switch (applicable.length){
              case 0:
                // TODO console.log('could not find parameter', inputParameter);
                break;
              case 1:
                var md = applicable[0];
                var datasetId = Datasets.getDataset(md.id, scenario, year);
                if(!datasetId){
                  Logger.addLog({
                    severity: 'warning',
                    'title': 'Fehlender Datensatz',
                    text: 'Laut den Stammdaten sollte automatisch ein Datensatz für das Stammdatum "' + v(md,'name') + ', '+ v(md,'typ')+ ', ' + md['id'] + '" ausgewählt werden, es ist aber keiner für das aktuelle Szenario und Jahr vorhanden!',
                    notify: true
                  });
                }else {
                  switch (inputParameter.type) {
                    case 'attributes':
                      initialScenario.sets[setName].values[setElementName][inputParameter.name].value = datasetId.seriesid;
                      break;
                    case 'tables':
                      var table = initialScenario.tables[inputParameter.name].value;
                      _.forEach(v(md, 'setElemente1'), function (se1) {
                        _.forEach(v(md, 'setElemente2'), function (se2) {
                          var target = _.get(table, [se1, se2]) || _.get(table, [se2, se1]);
                          // we don't have a fixed order of rows columns, so let's just try both orders
                          if (!target) {
                            Logger.addLog({
                              title: 'Interner Fehler',
                              severity: 'error',
                              text: 'Programmierfehler: Es gibt keine Tabelle mit den Beschriftungen ' + se1 + ' und ' + se2 + ', Parameter: ' + inputParameter,
                              notify: true
                            });
                          }
                          target.value = datasetId.seriesid;
                        });
                      });
                      break;
                    default:
                      Logger.addLog({
                        severity: 'error',
                        'title': 'Interner Fehler',
                        text: 'Programmierfehler: Unbekannter Parametertyp in vertikaler Pullfunktion:' + JSON.stringify(inputParameter),
                        notify: true
                      });
                  }
                }
                // run pull only for parameters that are allowed to be changed in delta years
                if (_.find(deltaParameters, inputParameter)) {
                  //console.log('running pull ', inputParameter);
                  PullFunction.runPullForIndividualParameter(multiYearScenario,modelType,initialScenario,inputParameter.name);
                }
                break;
              default:
                Logger.addLog({
                  title: 'Mehrdeutigkeit',
                  severity: 'warning',
                  text: 'Für den Parameter "' + inputParameter.name + '" wurden ' + applicable.length + ' Stammdaten für die vertikale Pullfunktion annotiert. Es ist aber nur maximal EIN Stammdatum zulässig',
                  notify: true
                });
            }
          }
        });
      }
    };
  });
