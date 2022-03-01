'use strict';

/**
 * @ngdoc service
 * @name irpsimApp.Logger
 * @description
 * # Logger
 * Service in the irpsimApp.
 */
angular.module('irpsimApp')
  .service('Logger', function (growl) {
    var Logger = this;
    Logger.sendNotification = sendNotification;

    var logId = 0;
    var logs = [];

    /**
     * @param {Object} entry A logentry object with the keys 'severity', 'title' and 'text'
     */
    Logger.addLog = function(entry){
      var log = {
        date: new Date(),
        id: logId++,
        count: 1,
        title: entry.title,
        text: entry.text,
        severity: entry.severity || 'error', // possible values: error, warning, info, success
        notify: entry.notify || false // optionally show growl notifications
      };
      var isAmended = false;
      if(logs.length > 0){
        // TO avoid an excessively long list of identical messages, we rather change a counter
        var lastEntry = logs[logs.length-1];
        if(lastEntry.title === log.title && lastEntry.text === log.text && lastEntry.severity === log.severity){
          log.count+=lastEntry.count;
          logs.splice(logs.length-1,1);
          // do not show notifications for many equal successive messages, but show them if the last message was more then 5s ago
          isAmended = log.date.getTime() - lastEntry.date.getTime() > 5000;
        }
      }
      if(!isAmended && entry.notify){
        Logger.sendNotification(log);
      }
      logs.push(log);
    };

    // convenience method to add server logs more easily
    Logger.addServerLog = function(response, key){
      response.data[key].forEach(function(msg){
        Logger.addLog({
          title: msg.title,
          text: msg.text,
          severity: msg.severity,
          notify: response.config.hideGrowlMessages ? false : true
        });
      });
    };

    /**
     * Groups messages according to severity, then shows them. Use this function
     * if you have many individual messages. Since growl2 will use $timeouts for each message's
     * countdown we may have excessively many $digest cycles (one per message per second), which
     * may hurt the performance.
     *
     * @param {Array} messages individual objects used to call #addServerLog or #addLog
     */
    Logger.combineAndShow = function(messages){
      var bySeverity = _.groupBy(_.reject(messages,_.isEmpty),'severity');
      _.mapValues(bySeverity,function(msgs,severity){
        var combined = {
          title: _(msgs).map('title').reject(_.isEmpty).uniq().join('/'),
          severity: severity,
          text: msgs.length+' Meldungen: <br>' +
          _(msgs)
            .pluck('text')
            .reject(_.isEmpty)
            .groupBy(_.identity)
            .map(function(arr,text){ return text + (arr.length>1?(' ('+arr.length+'x)'):''); })
            .join('<br>'),
          notify: true
        };
        Logger.addLog(combined);
      });
    };

    Logger.getLogs = function(){
      return logs;
    };

    Logger.clearLog = function(type){
      if(type){
        _.remove(logs,{severity: type});
        logs = logs.slice();
      }else {
        logs = [];
      }
    };

    Logger.removeLogEntry = function(id){
      _.remove(logs, function(n){
        return n.id === id;
      });
    };

    function sendNotification (log){
      var severity = log.severity;
      if(severity){
        severity = severity.toLowerCase();
      }
      switch (severity){
      case 'error':
        growl.error(log.text,log);
        break;
      case 'warning':
        growl.warning(log.text,log);
        break;
      case 'info':
        growl.info(log.text,log);
        break;
      case 'success':
        growl.success(log.text,log);
        break;
      }
    }
  });
