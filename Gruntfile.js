// Generated on 2014-07-21 using generator-angular 0.9.5
'use strict';

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to recursively match all subfolders:
// 'test/spec/**/*.js'

module.exports = function (grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  var serveStatic = require('serve-static');

  // Configurable paths for the application
  var appConfig = {
    app: require('./bower.json').appPath || 'app',
    dist: 'dist'
  };

  var devMiddleware = function (connect) {
    return [
      // Setup the proxy
      require('grunt-connect-proxy-updated/lib/utils').proxyRequest,
      serveStatic('.tmp'),
      connect().use(
        '/bower_components',
        serveStatic('./bower_components')
      ),
      serveStatic(appConfig.app)
    ];
  };

  grunt.loadNpmTasks('grunt-githash');
  grunt.loadNpmTasks('grunt-replace');

  // Define the configuration for all the tasks
  grunt.initConfig({

    // Project settings
    yeoman: appConfig,

    // Watches files for changes and runs tasks based on the changed files
    watch: {
      bower: {
        files: ['bower.json'],
        tasks: ['wiredep']
      },
      js: {
        files: ['<%= yeoman.app %>/components/{,**/}*.js'],
        tasks: ['newer:jshint:all'],
        options: {
          livereload: '<%= connect.options.livereload %>'
        }
      },
      jsTest: {
        files: ['test/spec/{,*/}*.js'],
        tasks: ['newer:jshint:test', 'karma']
      },
      styles: {
        files: ['<%= yeoman.app %>/styles/{,**/}*.css',
                '<%= yeoman.app %>/components/{,**/}*.css'],
        tasks: ['newer:copy:styles', 'autoprefixer']
      },
      gruntfile: {
        files: ['Gruntfile.js']
      },
      livereload: {
        options: {
          livereload: '<%= connect.options.livereload %>'
        },
        files: [
          '<%= yeoman.app %>/{,**/}*.html',
          '.tmp/styles/{,*/}*.css',
          '<%= yeoman.app %>/images/{,*/}*.{png,jpg,jpeg,gif,webp,svg}'
        ]
      }
    },

    // The actual grunt server settings
    connect: {
      options: {
        port: 9000,
        // Change this to '0.0.0.0' to access the server from outside.
        hostname: process.platform === 'linux' ? '0.0.0.0' : 'localhost',
        livereload: 35729
      },
      proxies: [{
        context: '/backend', // the context of the data service
        rewrite: {
          '^/backend[^/]*': ''
        },
        host: 'localhost', // wherever the data service is running
        port: 8282 // the port that the data service is running on
      }],
      livereload: {
        options: {
          open: true,
          middleware: devMiddleware
        }
      },
      debug: {
        options: {
          open: true,
          livereload: false,
          middleware: devMiddleware
        }
      },
      test: {
        options: {
          port: 9001,
          middleware: function (connect) {
            return [
              serveStatic('.tmp'),
              serveStatic('test'),
              connect().use(
                '/bower_components',
                serveStatic('./bower_components')
              ),
              serveStatic(appConfig.app)
            ];
          }
        }
      },
      dist: {
        options: {
          open: true,
          base: '<%= yeoman.dist %>',
          livereload: false,
          middleware: function () {
            return [
              // Setup the proxy
              require('grunt-connect-proxy-updated/lib/utils').proxyRequest,
              serveStatic('./dist')
            ];
          }
        }
      }
    },

    // Make sure code styles are up to par and there are no obvious mistakes
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: {
        src: [
          'Gruntfile.js',
          '<%= yeoman.app %>/components/{,*/}*.js'
        ]
      },
      test: {
        options: {
          jshintrc: 'app/test/.jshintrc'
        },
        src: ['test/spec/{,*/}*.js']
      }
    },

    // Empties folders to start fresh
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '.tmp',
            '<%= yeoman.dist %>/{,*/}*',
            '!<%= yeoman.dist %>/.git*'
          ]
        }]
      },
      server: '.tmp'
    },

    // Add vendor prefixed styles
    autoprefixer: {
      options: {
        browsers: ['last 1 version']
      },
      dist: {
        files: [{
          expand: true,
          cwd: '.tmp/styles/', 
          src: '{,*/}*.css',
          dest: '.tmp/styles/'
        }]
      }
    },

    // Automatically inject Bower components into the app
    wiredep: {
      options: {
        cwd: ''
      },
      app: {
        src: ['<%= yeoman.app %>/index.html'],
        ignorePath:  /\.\.\//,
        exclude: [/tinymce/,/mathjs/] // see [1]
      }
    },

    // Renames files for browser caching purposes
    filerev: {
      // do not revision images! We might refer to them within templates, which get combined into a templatecache BEFORE usemin can replace the image urls.
      // sadly, usemin allows only one useminPrepare/usemin call pair, so we can't have a pipeline 'rename images' -> 'copy templates' -> 'replace image urls' -> 'combine into templatecache'
      //images: {
      //  src :[
      //    '<%= yeoman.dist %>/images/{,*/}*.{png,jpg,jpeg,gif,webp,svg}'
      //  ]
      //},
      dist: {
        src: [
          '<%= yeoman.dist %>/components/{,*/}*.{js,css}',
          '<%= yeoman.dist %>/scripts/{,*/}*.js',
          '<%= yeoman.dist %>/styles/{,*/}*.css'
        ]
      }
    },

    // Reads HTML for usemin blocks to enable smart builds that automatically
    // concat, minify and revision files. Creates configurations in memory so
    // additional tasks can operate on them
    useminPrepare: {
      html: '<%= yeoman.app %>/index.html',
      options: {
        dest: '<%= yeoman.dist %>',
        flow: {
          html: {
            steps: {
              js: ['concat', 'uglifyjs'],
              css: ['cssmin']
            },
            post: {}
          }
        }
      }
    },

    // Performs rewrites based on filerev and the useminPrepare configuration
    usemin: {
      html: ['<%= yeoman.dist %>/**/*.html'],
      css: ['<%= yeoman.dist %>/styles/{,**/}*.css',
            '<%= yeoman.dist %>/components/{,**/}*.css'],
      options: {
        assetsDirs: ['<%= yeoman.dist %>','<%= yeoman.dist %>/images']
      }
    },

    imagemin: {
      dist: {
        files: [{
          expand: true,
          cwd: '<%= yeoman.app %>/images',
          src: '{,*/}*.{png,jpg,jpeg,gif}',
          dest: '<%= yeoman.dist %>/images'
        }]
      }
    },

    svgmin: {
      dist: {
        files: [{
          expand: true,
          cwd: '<%= yeoman.app %>/images',
          src: '{,*/}*.svg',
          dest: '<%= yeoman.dist %>/images'
        }]
      }
    },

    htmlmin: {
      dist: {
        options: {
          collapseWhitespace: true,
          conservativeCollapse: true,
          collapseBooleanAttributes: true,
          removeCommentsFromCDATA: true,
          removeOptionalTags: true
        },
        files: [{
          expand: true,
          cwd: '<%= yeoman.dist %>',
          src: ['*.html'],
          dest: '<%= yeoman.dist %>'
        }]
      }
    },

    // ngAnnotate tries to make the code safe for minification automatically by
    // using the Angular long form for dependency injection. It doesn't work on
    // things like resolve or inject so those have to be done manually.
    ngAnnotate: {
      dist: {
        files: [{
          expand: true,
          cwd: '.tmp/concat/scripts',
          src: '*.js',
          dest: '.tmp/concat/scripts'
        }]
      }
    },

    // Copies remaining files to places other tasks can use
    copy: {
      dist: {
        files: [{
          expand: true,
          dot: true,
          cwd: '<%= yeoman.app %>',
          dest: '<%= yeoman.dist %>',
          src: [
            '*.{ico,png,txt}',
            '.htaccess',
            '*.html',
			      'data/*',
            'images/{,*/}*.{webp}',
            'fonts/*'
          ]
        }, { // see [1]
          expand: true,
          src: 'bower_components/mathjs/dist/math.min.js',
          dest: '<%= yeoman.dist %>'
        }, {
          expand: true,
          cwd: '.tmp/images',
          dest: '<%= yeoman.dist %>/images',
          src: ['generated/*']
        }, {
          expand: true,
          cwd: 'bower_components/bootstrap/dist',
          src: 'fonts/*',
          dest: '<%= yeoman.dist %>'
        }, {
          expand: true,
          dot: true,
          cwd: 'bower_components/font-awesome',
          src: ['fonts/*.*'],
          dest: '<%= yeoman.dist %>'
        }, {
          expand: true,
          dot: true,
          cwd: 'bower_components/angular-ui-grid',
          src: ['ui-grid.ttf', 'ui-grid.woff', 'ui-grid.svg'],
          dest: '<%= yeoman.dist %>/styles/fonts'
        }]
      },
      templates:  {
        expand: true,
        cwd: '<%= yeoman.app %>/components',
        src: '{,**/}*.html',
        dest: '.tmp/components/'
      },
      styles: {
        expand: true,
        cwd: '<%= yeoman.app %>/styles',
        dest: '.tmp/styles/',
        src: '{,**/}*.css'
      }
    },

    // Run some tasks in parallel to speed up the build process
    concurrent: {
      server: [
        'copy:styles'
      ],
      test: [
        'copy:styles'
      ],
      dist: [
        'copy:styles',
        'imagemin',
        'svgmin',
        'autoprefixer',
        'copy:templates'
      ]
    },

    // Test settings
    karma: {
      unit: {
        configFile: 'karma.conf.js',
        singleRun: true
      }
    },

    // Convert Angular HTML view files to JavaScript cached versions
    ngtemplates: {
      dist: {
        options: {
          module: 'irpsimApp',
          htmlmin: '<%= htmlmin.dist.options %>',
          usemin: 'scripts/scripts.js'
        },
        cwd: '<%= yeoman.app %>',
        src: 'components/{,**/}*.html',
        dest: '.tmp/templateCache.js'
      }
    },

    // documentation
    groc: {
      app: ['Readme.md', '<%= yeoman.app %>/**/*.js', '<%= yeoman.app %>/**/*.css'],
      options: {
        out: 'docs/'
      }
    },
    // uglify: {
    //   options: {
    //     beautify : true
    //   }
    // }

    githash: {
      main: {
        options: {},
      }
    },
    getHash: {
      options: {
        commitHash: '<%= githash.main.hash %>'
      }
    },
    replace: {
      dist: {
        options: {
          patterns: [
            {
              match: /<td>(\w+)?<\/td><!--/,
              replacement: '<td><%= githash.main.hash %></td><!--'
            }
          ],
          usePrefix: false
        },
        files: [
          {
            expand: true,
            flatten: true,
            src: ['app/components/scenario-editor/scenario-editor.html'],
            dest: 'app/components/scenario-editor'
          }
        ]
      }
    }
  });

  grunt.registerTask('serve', 'Compile then start a connect web server', function (target) {
    if (target === 'dist') {
      return grunt.task.run([//'build-staging',
        'configureProxies', 'connect:dist:keepalive']);
    }

    grunt.task.run([
      'githash',
      'replace',
      'clean:server',
      'wiredep',
      'concurrent:server',
      'autoprefixer',
      'configureProxies',
      'connect:livereload',
      'watch'
    ]);
  });

  grunt.registerTask('webstorm', 'Compile then start a connect web server. Avoid reloads, use live edit in Webstorm instead', function (target) {
    if (target === 'dist') {
      return grunt.task.run([//'build-staging',
        'configureProxies', 'connect:dist:keepalive']);
    }

    grunt.task.run([
      'clean:server',
      'wiredep',
      'concurrent:server',
      'autoprefixer',
      'configureProxies',
      'connect:debug',
      'watch'
    ]);
  });

  var tasksPrefix = [
    'clean:dist',
    'githash',
    'replace',
    'wiredep',
    'useminPrepare',
    'concurrent:dist',
    'ngtemplates',
    'concat',
  ];
  var tasksSuffix = [
    'ngAnnotate',
    'copy:dist',
    'cssmin',
    'uglify',
    'filerev:dist',
    'usemin',
    'htmlmin'
  ];
  grunt.registerTask('build-production', tasksPrefix.concat(tasksSuffix));
  grunt.registerTask('default', [
    'newer:jshint',
    'build-production'
  ]);
};

/*
 [1] There seems to be a bug in uglifyjs: When minimizing the math.js library the process
 hangs for 15min. To avoid excessive build time we include the library into our own sources
 and side step the problem by manually copying the file to our dist/ folder on builds.
 */
