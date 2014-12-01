function inputControls() {
    return {
        restrict: 'EA',
        templateUrl: 'templates/controls.html',
        link: function (scope, element) {
            var start = angular.element('.glyphicon-play'),
                stop = angular.element('.glyphicon-stop'),
                liveInput = angular.element('.glyphicon-record');

            start.on('click', function(){
                stop.prop('disabled', false);
                start.prop('disabled', true);
            });

            stop.on('click', function(){
                start.prop('disabled', false);
                stop.prop('disabled', true);
            });

            liveInput.on('click', function(){
                liveInput.toggleClass("btn-danger");
            });
        }
    };
}
angular
    .module('Input')
    .directive('inputControls', inputControls);
