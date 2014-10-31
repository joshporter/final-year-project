'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();

var browserify = require('browserify');
var browserSync = require('browser-sync');
var source = require('vinyl-source-stream');

gulp.task('js', ['js-hint'], function() {
    return browserify('./src/main', { debug:true })
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(gulp.dest('./app/js/'))
});

gulp.task('js-hint', function () {
    return gulp.src('./src/*.js')
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish'));
});

gulp.task('browser-sync', function() {
    var files = [
        './app/index.html',
        './src/*.js'
    ];

    browserSync(files, {
        server: {
            baseDir: "./app"
        },
        browser: "google chrome"
    });
});

gulp.task('default', ['browser-sync'], function () {
    gulp.watch("./src/*.js", ['js', browserSync.reload]);
});
