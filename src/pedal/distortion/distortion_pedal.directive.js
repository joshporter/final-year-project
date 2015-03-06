function distortionPedal (Board) {
    return {
        restrict: 'EA',
        templateUrl: 'templates/distortion.html',
        link: function ($scope, $element) {
            var volume = $element.find('webaudio-knob#distortion-volume'),
                tone = $element.find('webaudio-knob#distortion-tone'),
                footswitch = $element.find('webaudio-switch#distortion-foot-sw'),
                led = $element.find('.led');

            volume.on('change', function(e) {
                Board.getPedals().distortion.setVolume(e.target.value);
            });

            volume.on('dblclick', function() {
                volume.val(volume.attr('max')/2);
            });

            //tone.on('change', function(e) {
            //    Board.getPedals().distortion.setTone(e.target.value);
            //});
            //
            //tone.on('dblclick', function() {
            //    tone.val(tone.attr('max')/2);
            //});

            footswitch.on('click', function (e) {
                led.toggleClass('active');
                //add bypass for audio nodes
            });
        }
    };
}
angular
    .module('Pedal')
    .directive('distortionPedal', distortionPedal);
