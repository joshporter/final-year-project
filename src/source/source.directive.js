function sampleControls() {
    return {
        restrict: 'EA',
        template: [
            '<button class="play" ng-click="vm.play()">Play</button>',
            '<button class="stop" ng-click="vm.stop()">Stop</button>',
            '<button class="stop">Live Input</button>',
        ].join('')
    };
}
angular
    .module('Source')
    .directive('sampleControls', sampleControls);
