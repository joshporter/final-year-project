function overdrivePedal (Board) {
    return {
        restrict: 'EA',
        templateUrl: 'templates/overdrive.html',
        link: function ($scope, $element) {
            const MID_LEVEL = 5.5;
            var overdrive = Board.getPedal('overdrive');

            var volume = $element.find('webaudio-knob#overdrive-volume'),
                tone = $element.find('webaudio-knob#overdrive-tone'),
                footswitch = $element.find('webaudio-switch#overdrive-foot-sw'),
                led = $element.find('.led');

            volume.on('change', function(e) {
                overdrive.setVolume(e.target.value);
            });

            volume.on('dblclick', function() {
                volume.val(MID_LEVEL);
            });

            tone.on('change', function(e) {
                overdrive.setTone(e.target.value);
            });

            tone.on('dblclick', function() {
                tone.val(MID_LEVEL);
            });

            footswitch.on('click', function () {
                led.toggleClass('active');
                overdrive.bypass();
            });
        }
    };
}
angular
    .module('Pedal')
    .directive('overdrivePedal', overdrivePedal);
