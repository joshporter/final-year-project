'use strict';

var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var browserSync = require('browser-sync');

var $ = require('gulp-load-plugins')();

gulp.task('js', ['js-hint'], function() {
    return browserify('./src/main', { debug:true })
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(gulp.dest('./src'))
});

gulp.task('js-hint', function () {
    return gulp.src('./src/*.js')
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish'));
});

gulp.task('browser-sync', function() {
    var files = [
        './index.html',
        './src/*.js'
    ];

    browserSync(files, {
        server: {
            baseDir: "./"
        }
    });
});

gulp.task('default', ['browser-sync'], function () {
    gulp.watch("./src/*.js", ['js', browserSync.reload]);
});