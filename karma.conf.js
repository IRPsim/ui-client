// Karma configuration
// Generated on Thu Jul 21 2016 13:50:03 GMT+0200 (CEST)

module.exports = function (config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],


    // list of files / patterns to load in the browser
    files: [
      'node_modules/karma-read-json/karma-read-json.js',
      'bower_components/angular/angular.js',
      'bower_components/angular-mocks/angular-mocks.js',
      'bower_components/angular-resource/angular-resource.js',
      'bower_components/angular-ui-grid/ui-grid.js',
      'bower_components/dygraphs/dygraph-combined.js',
      'bower_components/lodash/lodash.js',
      'bower_components/d3/d3.min.js',
      'bower_components/angular-xeditable/dist/js/xeditable.min.js',
      'bower_components/angular-sanitize/angular-sanitize.min.js',
      'bower_components/angular-animate/angular-animate.min.js',
      'bower_components/angular-ui-router/release/angular-ui-router.min.js',
      'bower_components/angular-bootstrap/ui-bootstrap.min.js',
      'bower_components/angular-loading-bar/build/loading-bar.min.js',
      'bower_components/ng-tags-input/ng-tags-input.min.js',
      'bower_components/angular-growl-v2/build/angular-growl.min.js',
      'bower_components/angular-bootstrap-nav-tree/dist/abn_tree_directive.js',
      'bower_components/angular-local-storage/dist/angular-local-storage.min.js',
      'bower_components/ngDraggable/ngDraggable.js',
      'bower_components/ng-file-upload/ng-file-upload-all.min.js',
      'bower_components/ui-common/dist/*.js',
      'bower_components/timeseries-analysation-tool/app/dist/concat-min.js',
      'bower_components/jszip/dist/jszip.js',
      'bower_components/file-saver/dist/FileSaver.js',
      'app/components/app.js',
      'app/components/**/*.service.js',
      'app/**/*.js',
      {
        pattern: 'app/test/data/**/*.json',
        included: false
      }
    ],


    // list of files to exclude
    exclude: [],


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress', 'html', 'json-log'],

    htmlReporter: {
      outputFile: 'app/test/report.html',

      // Optional
      pageTitle: 'IRPsim UI-Client',
      subPageTitle: 'Frontend Test Report',
      groupSuites: true,
      useCompactStyle: true,
      useLegacyStyle: false
    },

    jsonLogReporter: {
      outputPath: 'app/test/JSONlog.json'
    },

    browserNoActivityTimeout: 100000,

    // web server port
    port: 9001,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Chrome'],


    phantomjsLauncher: {
      // Have phantomjs exit if a ResourceError is encountered (useful if karma exits without killing phantom)
      exitOnResourceError: true
    },

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity
  })
};
