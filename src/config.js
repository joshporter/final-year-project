function config($routeProvider, $locationProvider) {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    $locationProvider.html5Mode(true);
    $routeProvider
        .when('/', {
            templateUrl: '/templates/board.html',
            controller: 'BoardCtrl',
            controllerAs: 'vm'
        });
}

angular
    .module('GtrPedals')
    .config(config);