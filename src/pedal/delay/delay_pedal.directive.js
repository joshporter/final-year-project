function delayPedal (Board) {
    return {
        restrict: 'EA',
        templateUrl: 'templates/delay.html',
        link: function ($scope, $element) {
            var delay = Board.getPedal('delay');

            var time = $element.find('webaudio-knob#delay-time'),
                feedback = $element.find('webaudio-knob#delay-feedback'),
                footswitch = $element.find('webaudio-switch#delay-foot-sw'),
                led = $element.find('.led');

            time.on('change', function(e) {
                delay.setTime(e.target.value);
            });

            time.on('dblclick', function() {
                time.val(parseFloat(0.5));
            });

            feedback.on('change', function(e) {
                delay.setFeedback(e.target.value);
            });

            feedback.on('dblclick', function() {
                feedback.val(parseFloat(0.75));
            });

            footswitch.on('click', function () {
                led.toggleClass('active');
                delay.bypass();
            });
        }
    };
}
angular
    .module('Pedal')
    .directive('delayPedal', delayPedal);
