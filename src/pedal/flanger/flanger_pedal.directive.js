function flangerPedal (Board) {
    return {
        restrict: 'EA',
        templateUrl: 'templates/flanger.html',
        link: function ($scope, $element) {
            var flanger = Board.getPedal('flanger');

            var speed = $element.find('webaudio-knob#flanger-speed'),
                delay = $element.find('webaudio-knob#flanger-delay'),
                depth = $element.find('webaudio-knob#flanger-depth'),
                feedback = $element.find('webaudio-knob#flanger-feedback'),
                footswitch = $element.find('webaudio-switch#flanger-foot-sw'),
                led = $element.find('.led');

            speed.on('change', function(e) {
                flanger.setSpeed(e.target.value);
            });

            speed.on('dblclick', function() {
                speed.val(parseFloat(0.7));
            });

            delay.on('change', function(e) {
                flanger.setDelay(e.target.value);
            });

            delay.on('dblclick', function() {
                delay.val(parseFloat(0.003));
            });

            depth.on('change', function(e) {
                flanger.setDepth(e.target.value);
            });

            depth.on('dblclick', function() {
                depth.val(parseFloat(0.002));
            });

            feedback.on('change', function(e) {
                flanger.setFeedback(e.target.value);
            });

            feedback.on('dblclick', function() {
                feedback.val(parseFloat(0.6));
            });

            footswitch.on('click', function () {
                led.toggleClass('active');
                flanger.bypass();
            });
        }
    };
}
angular
    .module('Pedal')
    .directive('flangerPedal', flangerPedal);
