'use strict';

/**
 * @ngdoc directive to
 * @name irpsimApp.directive:download
 * @description
 * # download
 */
angular.module('irpsimApp')
  .directive('stickyHeader', function ($timeout) {
    return {
      restrict:'A',
      compile: function(headerOnlyTable){
        /* we need a width of the first column we can rely on
         * else we would need to constantly synchronize the widths of the first column of both tables
         * 'width' does not work, the column will still get small than the given value if the
         * table gets wide enough.
         */

        headerOnlyTable.find('th:first-child').css('min-width','200px').css('width','200px');

        var tableElement = headerOnlyTable.clone();

        tableElement.removeAttr('sticky-header');
        headerOnlyTable.find('th:not(:first-child),td:not(:first-child)').remove();
        headerOnlyTable.addClass('sticky-header').addClass('hidden-print');
        headerOnlyTable.parent().append(tableElement);

        return {
          post: function(scope,element){
            // this event gets currently broadcasted by editelement.directive.js
            scope.$on('visible',function() {
              $timeout(function(){
                // XXX take care: we NEED JQuery here!!!
                var headerOnlyTable = $(element[0]);
                headerOnlyTable.find('tr th:first-child').each(function (i) {
                  var tableTwoRow = headerOnlyTable.find('+table tr th:first-child').get(i);
                  $(this).height($(tableTwoRow).height());
                  $(this).width($(tableTwoRow).width());
                });
              },0);
            });
          }
        };
      }
    };
  });
