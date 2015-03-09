function samplesList($rootScope, Board) {
    return {
        restrict: 'E',
        templateUrl: 'templates/samples-list.html',
        link: function ($scope, $element) {
            $rootScope.isLoading = true;

            console.log($element);
            var sample = $element.find('#samples-list');

            sample.on('change', function (e) {
                Board.getPedal('sample').loadBuffer(this.value);

                if ($rootScope.isLoading) {
                    $rootScope.isLoading = false;
                }
            });


        }
    };
}
angular
    .module('Input')
    .directive('samplesList', samplesList);
