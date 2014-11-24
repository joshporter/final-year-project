'use strict';

var browserSync = require('browser-sync');

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();

//https://github.com/dickeyxxx/ng-modules/tree/gh-pages/src
//https://medium.com/@dickeyxxx/best-practices-for-building-angular-js-apps-266c1a4a6917
gulp.task('js', ['js:hint'], function() {
    return gulp.src(['src/**/module.js', 'src/**/*.js'])
        .pipe($.plumber())
        .pipe($.sourcemaps.init())
            .pipe($.concat('app.js'))
            .pipe($.ngAnnotate())
            .pipe($.uglify())
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

//// Compile SASS & auto-inject into browsers
//gulp.task('sass', function () {
//    return gulp.src('scss/styles.scss')
//        .pipe(sass({includePaths: ['scss']}))
//        .pipe(gulp.dest('css'))
//        .pipe(browserSync.reload({stream:true}));
//});

gulp.task('browser-sync', function() {
    browserSync({
        server: {
            baseDir: "./"
        },
        browser: "google chrome"
    });
});

// Reload all Browsers
gulp.task('browser-sync:reload', function () {
    browserSync.reload();
});

// Watch task
gulp.task('watch', ['browser-sync'], function () {
    //gulp.watch("scss/*.scss", ['sass']);
    gulp.watch('src/**/*.js', ['js', 'browser-sync:reload']);
    gulp.watch(['templates/*.html', 'index.html'], ['browser-sync:reload']);
});

gulp.task('default', ['js']);
