'use strict';

/**
 * @ngdoc service that gives estimations of remaining time for long running processes
 * @name irpsimApp.factory:TimeEstimator
 * @description
 * # ...
 */
angular.module('irpsimApp')
  .factory('TimeEstimator', function () {

    function getTimeDifference(millis){
      var diff = {};

      diff.hours = Math.floor(millis / 1000 / 60 / 60);
      millis -= diff.hours * 1000 * 60 * 60;

      diff.minutes = Math.floor(millis / 1000 / 60);
      millis -= diff.minutes * 1000 * 60;

      diff.seconds = Math.floor(millis / 1000);

      var hour = '00';
      if (diff.hours > 0){
        hour = String(diff.hours);
      }
      if (hour.length === 1){
        hour = '0' + hour;
      }
      var minutes = '00';
      if (diff.minutes > 0){
        minutes = String(diff.minutes);
      }
      if (minutes.length === 1) {
        minutes = '0' + minutes;
      }
      var seconds = '00';
      if (diff.seconds > 0) {
        seconds = String(diff.seconds);
      }
      if (seconds.length === 1) {
        seconds = '0' + seconds;
      }
      var duration = hour + ':' + minutes + ':' + seconds;
      diff.duration = duration;

      return diff;
    }
    function TimeEstimator(maximum, stepLength, startTime){
      this.startTime = startTime;
      this.percentageDone =0;

      this.update = function(finishedsteps){
        var now = new Date().getTime();
        var duration = now - this.startTime.getTime();
        this.percentageDone = finishedsteps / maximum;
        var percentageToGo = 1 - this.percentageDone;

        var milliSecondsToGo = 0;
        if(this.percentageDone > 0) {
          milliSecondsToGo = duration * (percentageToGo / this.percentageDone);
        }else{
          milliSecondsToGo = duration * maximum/stepLength;
        }
        var doneAt = new Date();
        doneAt.setTime(now + milliSecondsToGo);
        var timeToGo = getTimeDifference(milliSecondsToGo);

        return {
          toGo: timeToGo,
          start: this.startTime,
          end: doneAt,
          overall: getTimeDifference(duration),
          percentage: this.percentageDone,
          now: now
        };
      };
      this.getProgress = function() {
        return this.percentageDone;
      };
    }
    return {
      startEstimation: function(maximum, stepLength, startTime){
        if(!angular.isDefined(startTime)){
          startTime = new Date();
        }else if(angular.isNumber(startTime)){
          startTime = new Date(startTime);
        }
        return new TimeEstimator(maximum, stepLength, startTime);
      },
      getTimeDifference: getTimeDifference
    };
});
