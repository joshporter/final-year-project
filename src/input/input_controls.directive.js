function inputControls() {
    var start = angular.element("<button class='btn btn-default glyphicon glyphicon-play' ng-click='vm.play()'></button>"),
        stop =  angular.element("<button class='btn btn-default glyphicon glyphicon-stop' disabled ng-click='vm.stop()'></button>"),
        liveInput = angular.element("<button class='btn btn-default glyphicon glyphicon-record' data-playing ng-click='vm.liveInput()'></button>");

    this.link = function (scope, element) {
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

    return {
        restrict: 'EA',
        replace: true,
        compile: function (tElem) {
            tElem.append(start);
            tElem.append(stop);
            tElem.append(liveInput);

            return link;
        }
    };
}
angular
    .module('Input')
    .directive('inputControls', inputControls);
