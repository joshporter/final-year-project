'use strict';

var browserSync = require('browser-sync');

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();

gulp.task('js', ['js:hint'], function() {
    return gulp.src(['src/**/module.js', 'src/**/*.js'])
        .pipe($.plumber())
        .pipe($.sourcemaps.init())
            .pipe($.concat('app.js'))
            .pipe($.ngAnnotate())
            //.pipe($.uglify())
        .pipe($.sourcemaps.write())
        .pipe(gulp.dest('assets'));
});

gulp.task('js:hint', function () {
    return gulp.src('src/**/*.js')
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish'));
});

gulp.task('js:watch', ['js'], function () {
    gulp.watch('src/**/*.js', ['js'])
});

// inject css
gulp.task('css', function () {
    return gulp.src('styles/main.css')
        .pipe(browserSync.reload({stream:true}));
});

gulp.task('browser-sync', function() {
    browserSync({
        server: {
            baseDir: "./"
        },
        ghostMode: false,
        open: false
    });
});

// Reload all Browsers
gulp.task('browser-sync:reload', function () {
    browserSync.reload();
});

// Watch task
gulp.task('watch', ['browser-sync'], function () {
    gulp.watch("styles/main.css", ['css']);
    gulp.watch('src/**/*.js', ['js', 'browser-sync:reload']);
    gulp.watch(['templates/*.html', 'index.html'], ['browser-sync:reload']);
});

gulp.task('default', ['js']);
