function chorusPedal (Board) {
    return {
        restrict: 'EA',
        templateUrl: 'templates/chorus.html',
        link: function ($scope, $element) {
            var chorus = Board.getPedal('chorus');

            var rate = $element.find('webaudio-knob#chorus-rate'),
                delay = $element.find('webaudio-knob#chorus-delay'),
                depth = $element.find('webaudio-knob#chorus-depth'),
                footswitch = $element.find('webaudio-switch#chorus-foot-sw'),
                led = $element.find('.led');


            rate.on('change', function(e) {
                chorus.setRate(e.target.value);
            });

            rate.on('dblclick', function() {
                rate.val(parseFloat(3.5));
            });

            delay.on('change', function(e) {
                chorus.setDelay(e.target.value);
            });

            delay.on('dblclick', function() {
                delay.val(parseFloat(0.03));
            });

            depth.on('change', function(e) {
                chorus.setDepth(e.target.value);
            });

            depth.on('dblclick', function() {
                depth.val(parseFloat(0.002));
            });

            footswitch.on('click', function () {
                led.toggleClass('active');
                chorus.bypass();
            });
        }
    };
}
angular
    .module('Pedal')
    .directive('chorusPedal', chorusPedal);
