'use strict';
angular.module('app')
    .config(function ($routeProvider, $locationProvider) {
        $locationProvider.html5Mode(true);
        $routeProvider
            .when('/', {
                templateUrl: '/templates/board.html',
                controller: 'BoardCtrl',
                controllerAs: 'board'
            });
    });
