angular.module('GtrPedals', [
    'ngRoute',
    'Board'
]);

angular.module('Board', [
    'Input',
    'Pedal',
    'SharedAudioContext'
]);

'use strict';

angular.module('Input', [
    'SharedAudioContext'
]);

angular.module('Pedal', [
    'SharedAudioContext'
]);

'use strict';

angular.module('SharedAudioContext', []);

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
config.$inject = ["$routeProvider", "$locationProvider"];

angular
    .module('GtrPedals')
    .config(config);
function BoardCtrl (Board) {
    var vm = this;

    Board.loadSource();
    Board.loadPedals();
    Board.wireUpBoard();

    vm.play = function() {
        Board.playSample();
    };

    vm.stop = function() {
        Board.stopSample();
    };

    vm.liveInput = function() {
        Board.toggleLiveInput();
    }

}
BoardCtrl.$inject = ["Board"];

angular
    .module('Board')
    .controller('BoardCtrl', BoardCtrl);

function Board($rootScope, FileInput, LineInput, Cabinet, Distortion, Overdrive, Flanger, SharedAudioContext) {
    var stage = SharedAudioContext.getContext(),
        boardInput = stage.createGain();

    var pedals = {
        sample: new FileInput(),
        line: new LineInput(),
        cabinet: new Cabinet(),
        distortion: new Distortion(),
        overdrive: new Overdrive(),
        flanger: new Flanger()
    };

    var samples = [
        'assets/samples/open.wav',
        'assets/samples/chords.wav',
        'assets/samples/everlong.wav',
        'assets/samples/octaves.wav',
        'assets/samples/FF.wav',
        'assets/samples/twiddles.wav'
    ];

    this.loadSource = function () {
        pedals.sample.loadBuffer(samples[3]);
        pedals.sample.connect(boardInput);
    };

    this.loadPedals = function () {
        pedals.cabinet.load('assets/ir/5150.wav');
        pedals.distortion.load('dist3');
        pedals.overdrive.load('overdrive');
        pedals.flanger.load();
    };

    this.wireUpBoard = function () {
        boardInput.connect(pedals.distortion.input);
        pedals.distortion.connect(pedals.overdrive.input);
        pedals.overdrive.connect(pedals.flanger.input);
        pedals.flanger.connect(pedals.cabinet.input);
        pedals.cabinet.connect(stage.destination);
    };

    this.playSample = function () {
        pedals.sample.play();
    };

    this.stopSample = function () {
        pedals.sample.stop();
    };

    this.toggleLiveInput = function () {
        if (!pedals.line.isStreaming) {
            pedals.line.load();
            $rootScope.$on('linein:loaded', function () {
                pedals.line.stream.connect(boardInput);
            });
            pedals.line.isStreaming = true;
        } else {
            pedals.line.stop();
            pedals.line.isStreaming = false;
        }
    };

    this.getPedal = function (effect) {
      return pedals[effect];
    };
}
Board.$inject = ["$rootScope", "FileInput", "LineInput", "Cabinet", "Distortion", "Overdrive", "Flanger", "SharedAudioContext"];
angular
    .module('Board')
    .service('Board', Board);

function FileInput (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var FileInput = function() {
        this.output = stage.createGain();
        this.source = null;
        this.sample = null;
    };

    FileInput.prototype.loadBuffer = function(url) {
        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";

        var loader = this;

        request.onload = function() {
            stage.decodeAudioData(
                request.response,
                function(buffer) {
                    if (!buffer) {
                        alert('error decoding file data: ' + url);
                        return;
                    }
                    loader.sample = buffer;
                },
                function(error) {
                    console.error('decodeAudioData error', error);
                }
            );
        }

        request.onerror = function() {
            alert('BufferLoader: XHR error');
        }

        request.send();
    };

    FileInput.prototype.connect = function(target){
        this.output.connect(target);
    };

    FileInput.prototype.play = function() {
        this.source = stage.createBufferSource();
        this.source.loop = true;
        this.source.buffer = this.sample;

        this.source.connect(this.output);

        this.source.start(0);
    };


    FileInput.prototype.stop = function() {
        this.source.stop();
        this.source.disconnect();
    };

    return FileInput;
}
FileInput.$inject = ["SharedAudioContext"];


angular
    .module('Input')
    .factory('FileInput', FileInput);

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

function LineInput($rootScope, SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var LineInput = function () {
        this.output = stage.createGain();
        this.stream = null;
        this.isStreaming = false;
    };

    LineInput.prototype.load = function () {
        var self = this;

        navigator.getUserMedia({
            "audio": {
                "optional": [
                    {"googEchoCancellation": "false"},
                    {"googAutoGainControl": "false"},
                    {"googNoiseSuppression": "true"},
                    {"googHighpassFilter": "false"}
                ]
            }
        }, function (stream) {
            self.stream = stage.createMediaStreamSource(stream);
            $rootScope.$emit('linein:loaded');
            this.isStreaming = true;
        }, function (err) {
            console.error('Guitar stream failed: ' + err);
        });
    };

    LineInput.prototype.connect = function (target) {
        this.stream.connect(target);
    };

    LineInput.prototype.stop = function () {
        this.stream.disconnect();
        this.isStreaming = false;
    };

    return LineInput;
}
LineInput.$inject = ["$rootScope", "SharedAudioContext"];


angular
    .module('Input')
    .service('LineInput', LineInput);

function SharedAudioContext () {

    var SharedAudioContext = {};

    SharedAudioContext.getContext = function () {
        return this.context || (this.context = new AudioContext);
    };

    return SharedAudioContext;
}
angular
    .module('SharedAudioContext')
    .factory('SharedAudioContext', SharedAudioContext);

function Cabinet (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var Cabinet = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.boost = stage.createGain();
        this.convolver = stage.createConvolver();
    };

    Cabinet.prototype.load = function(irPath) {
        var request = new XMLHttpRequest();
        request.open('GET', irPath, true);
        request.responseType = 'arraybuffer';

        var loader = this;

        request.onload = function () {
            stage.decodeAudioData(request.response, function (buffer) {
                loader.convolver.buffer = buffer;
            }, function (e) {
                if (e) console.log("Cannot load cabinet" + e);
            });
        };

        request.send(null);

        this.input.gain.value = 3;
        this.boost.gain.value = 1;

        this.input.connect(this.convolver);
        this.convolver.connect(this.boost);
        this.boost.connect(this.output);
    };

    Cabinet.prototype.connect = function(target){
        this.output.connect(target);
    };

    return Cabinet;
}
Cabinet.$inject = ["SharedAudioContext"];


angular
    .module('Pedal')
    .factory('Cabinet', Cabinet);

function distortionPedal (Board) {
    return {
        restrict: 'EA',
        templateUrl: 'templates/distortion.html',
        link: function ($scope, $element) {
            const MID_LEVEL = 5.5;
            var distortion = Board.getPedal('distortion');

            var volume = $element.find('webaudio-knob#distortion-volume'),
                tone = $element.find('webaudio-knob#distortion-tone'),
                footswitch = $element.find('webaudio-switch#distortion-foot-sw'),
                led = $element.find('.led');

            volume.on('change', function(e) {
                distortion.setVolume(e.target.value);
            });

            volume.on('dblclick', function() {
                volume.val(MID_LEVEL);
            });

            tone.on('change', function(e) {
                distortion.setTone(e.target.value);
            });

            tone.on('dblclick', function() {
                tone.val(MID_LEVEL);
            });

            footswitch.on('click', function () {
                led.toggleClass('active');
                distortion.bypass();
            });
        }
    };
}
distortionPedal.$inject = ["Board"];
angular
    .module('Pedal')
    .directive('distortionPedal', distortionPedal);

function Distortion (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var Distortion = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.gain = stage.createGain();
        this.waveshaper = stage.createWaveShaper();
        this.lowpass = stage.createBiquadFilter();
        this.highpass = stage.createBiquadFilter();
        this.boost = stage.createBiquadFilter();
        this.cut = stage.createBiquadFilter();
        this.volume = 7.5;
        this.tone = 20;
        this.isBypassed = true;
    };

    Distortion.prototype.load = function(type) {

        this.gain.gain.value = this.volume;

        this.lowpass.type = "lowpass";
        this.lowpass.frequency.value = 5000;

        this.boost.type = "lowshelf";
        this.boost.frequency.value = 100;
        this.boost.gain.value = 6;

        this.cut.type = "lowshelf";
        this.cut.frequency.value = 100;
        this.cut.gain.value = -6;

        this.waveshaper.curve = this.makeDistortionCurve(10, type);
        this.waveshaper.oversample = '4x';

        this.highpass.type = "highpass";
        this.highpass.frequency.value = this.tone;

        this.gain.connect(this.lowpass)
        this.lowpass.connect(this.boost);
        this.boost.connect(this.waveshaper);
        this.waveshaper.connect(this.cut);
        this.cut.connect(this.highpass);

        //bypass by default
        this.input.connect(this.output);
    };

    Distortion.prototype.makeDistortionCurve = function (amount, type) {
        var k = typeof amount === 'number' ? amount : 10,
            samples = 11025,
            curve = new Float32Array(samples);

        for (var i = 0; i < samples; ++i) {
            curve[i] = this.curveAlgorithm(i * 2 / samples - 1, type, k);
        }

        return curve;
    };

    Distortion.prototype.curveAlgorithm = function (x, type, k) {
        switch(type) {
            case 'dist1':
                return Math.max(-0.5, Math.min(0.5, x * k));
            case 'dist2':
                return Math.max(-1, Math.min(1, x * k));
            case 'dist3':
                return Math.max(-0.5, Math.min(1.5, x ));
            case 'dist4':
                return 2.8 * Math.pow(x, 3) + Math.pow(x,2) + -1.1 * x - 0.5;
            case 'dist5':
                return (Math.exp(x) - Math.exp(-x * 1.2)) / (Math.exp(x) + Math.exp(-x));
            case 'dist6':
                return this.tanh(x);
        }
    };

    Distortion.prototype.tanh = function (x) {
        if (x === Infinity) {
            return 1;
        } else if (x === -Infinity) {
            return -1;
        } else {
            return (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x));
        }
    };

    Distortion.prototype.sign = function (x) {
        x = +x; // convert to a number
        if (x === 0 || isNaN(x))
            return x;
        return x > 0 ? 1 : -1;
    };

    Distortion.prototype.connect = function(target){
        this.output.connect(target);
    };

    Distortion.prototype.bypass = function(){
        if(this.isBypassed) {
            this.input.disconnect();
            this.input.connect(this.gain);
            this.highpass.connect(this.output);

            this.isBypassed = false;
        } else {
            this.input.disconnect();
            this.highpass.disconnect();

            this.input.connect(this.output);

            this.isBypassed = true;
        }
    };

    Distortion.prototype.setVolume = function(volume) {
        this.gain.gain.value = 1.5 * volume;
    };

    Distortion.prototype.setTone = function(tone) {
        this.highpass.frequency.value = 20 * tone;
    };

    return Distortion;
}
Distortion.$inject = ["SharedAudioContext"];


angular
    .module('Pedal')
    .factory('Distortion', Distortion);

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
                speed.val(parseFloat(0.70));
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
                depth.val(parseFloat(0.0013));
            });

            feedback.on('change', function(e) {
                flanger.setFeedback(e.target.value);
            });

            feedback.on('dblclick', function() {
                feedback.val(parseFloat(0.4));
            });

            footswitch.on('click', function () {
                led.toggleClass('active');
                flanger.bypass();
            });
        }
    };
}
flangerPedal.$inject = ["Board"];
angular
    .module('Pedal')
    .directive('flangerPedal', flangerPedal);

function Flanger (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var Flanger = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.wetgain = stage.createGain();
        this.feedback = stage.createGain();
        this.depth = stage.createGain();
        this.osc = stage.createOscillator();
        this.delay = stage.createDelay();
        this.isBypassed = true;
    };

    Flanger.prototype.load = function() {
        this.osc.type = 'sine';
        this.osc.frequency.value = parseFloat( 0.7 );

        this.delay.delayTime.value = parseFloat( 0.003 );

        this.depth.gain.value = parseFloat( 0.0013 );

        this.feedback.gain.value = parseFloat( 0.40 );

        this.osc.connect(this.depth);
        this.depth.connect(this.delay.delayTime);

        this.delay.connect( this.wetgain );
        this.delay.connect( this.feedback );
        this.feedback.connect( this.input );

        this.osc.start(0);

        this.input.connect(this.output);
    };

    Flanger.prototype.setSpeed = function(speed) {
        this.osc.frequency.value = parseFloat(speed);
    };

    Flanger.prototype.setDelay = function(delay) {
        this.delay.delayTime.value = parseFloat(delay);
    };

    Flanger.prototype.setDepth = function(depth) {
        this.depth.gain.value = parseFloat(depth);
    };

    Flanger.prototype.setFeedback = function(feedback) {
        this.feedback.gain.value = parseFloat(feedback);
    };

    Flanger.prototype.bypass = function(){
        if(this.isBypassed) {
            this.input.disconnect();
            this.input.connect(this.wetgain);
            this.input.connect( this.delay);
            this.wetgain.connect(this.output);

            this.isBypassed = false;
        } else {
            this.input.disconnect();
            this.wetgain.disconnect();
            this.input.connect(this.output);

            this.isBypassed = true;
        }
    };

    Flanger.prototype.connect = function(target){
        this.output.connect(target);
    };

    return Flanger;
}
Flanger.$inject = ["SharedAudioContext"];


angular
    .module('Pedal')
    .factory('Flanger', Flanger);

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
overdrivePedal.$inject = ["Board"];
angular
    .module('Pedal')
    .directive('overdrivePedal', overdrivePedal);

function Overdrive (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var Overdrive = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.gain = stage.createGain();
        this.waveshaper = stage.createWaveShaper();
        this.lowpass = stage.createBiquadFilter();
        this.highpass = stage.createBiquadFilter();
        this.boost = stage.createBiquadFilter();
        this.cut = stage.createBiquadFilter();
        this.volume = 7.5;
        this.tone = 20;
        this.isBypassed = true;
    };

    Overdrive.prototype.load = function(type) {

        this.gain.gain.value = this.volume;

        this.lowpass.type = "lowpass";
        this.lowpass.frequency.value = 5000;

        this.boost.type = "lowshelf";
        this.boost.frequency.value = 100;
        this.boost.gain.value = 6;

        this.cut.type = "lowshelf";
        this.cut.frequency.value = 100;
        this.cut.gain.value = -6;

        this.waveshaper.curve = this.makeOverdriveCurve(10, type);
        this.waveshaper.oversample = '4x';

        this.highpass.type = "highpass";
        this.highpass.frequency.value = this.tone;

        this.gain.connect(this.lowpass)
        this.lowpass.connect(this.boost);
        this.boost.connect(this.waveshaper);
        this.waveshaper.connect(this.cut);
        this.cut.connect(this.highpass);

        //bypass by default
        this.input.connect(this.output);
    };

    Overdrive.prototype.makeOverdriveCurve = function (amount, type) {
        var k = typeof amount === 'number' ? amount : 10,
            samples = 11025,
            curve = new Float32Array(samples);

        for (var i = 0; i < samples; ++i) {
            curve[i] = this.curveAlgorithm(i * 2 / samples - 1, type, k);
        }

        return curve;
    };

    Overdrive.prototype.curveAlgorithm = function (x, type, k) {
        switch(type) {
            case 'overdrive':
                return (1 + k) * x / (1 + k * Math.abs(x));
        }
    };

    Overdrive.prototype.tanh = function (x) {
        if (x === Infinity) {
            return 1;
        } else if (x === -Infinity) {
            return -1;
        } else {
            return (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x));
        }
    };

    Overdrive.prototype.sign = function (x) {
        x = +x; // convert to a number
        if (x === 0 || isNaN(x))
            return x;
        return x > 0 ? 1 : -1;
    };

    Overdrive.prototype.connect = function(target){
        this.output.connect(target);
    };

    Overdrive.prototype.bypass = function(){
        if(this.isBypassed) {
            this.input.disconnect();
            this.input.connect(this.gain);
            this.highpass.connect(this.output);

            this.isBypassed = false;
        } else {
            this.input.disconnect();
            this.highpass.disconnect();

            this.input.connect(this.output);

            this.isBypassed = true;
        }
    };

    Overdrive.prototype.setVolume = function(volume) {
        this.gain.gain.value = 1.5 * volume;
    };

    Overdrive.prototype.setTone = function(tone) {
        this.highpass.frequency.value = 20 * tone;
    };

    return Overdrive;
}
Overdrive.$inject = ["SharedAudioContext"];


angular
    .module('Pedal')
    .factory('Overdrive', Overdrive);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZHVsZS5qcyIsImJvYXJkL21vZHVsZS5qcyIsImlucHV0L21vZHVsZS5qcyIsInBlZGFsL21vZHVsZS5qcyIsInV0aWxzL21vZHVsZS5qcyIsImNvbmZpZy5qcyIsImJvYXJkL2JvYXJkLmN0cmwuanMiLCJib2FyZC9ib2FyZC5zdmMuanMiLCJpbnB1dC9maWxlX2lucHV0LnN2Yy5qcyIsImlucHV0L2lucHV0X2NvbnRyb2xzLmRpcmVjdGl2ZS5qcyIsImlucHV0L2xpbmVfaW5wdXQuc3ZjLmpzIiwidXRpbHMvc2hhcmVkX2F1ZGlvX2NvbnRleHQuZmFjdG9yeS5qcyIsInBlZGFsL2NhYmluZXQvcGVkYWxfY2FiaW5ldC5zdmMuanMiLCJwZWRhbC9kaXN0b3J0aW9uL2Rpc3RvcnRpb25fcGVkYWwuZGlyZWN0aXZlLmpzIiwicGVkYWwvZGlzdG9ydGlvbi9wZWRhbF9kaXN0b3J0aW9uLnN2Yy5qcyIsInBlZGFsL2ZsYW5nZXIvZmxhbmdlcl9wZWRhbC5kaXJlY3RpdmUuanMiLCJwZWRhbC9mbGFuZ2VyL3BlZGFsX2ZsYW5nZXIuc3ZjLmpzIiwicGVkYWwvb3ZlcmRyaXZlL292ZXJkcml2ZV9wZWRhbC5kaXJlY3RpdmUuanMiLCJwZWRhbC9vdmVyZHJpdmUvcGVkYWxfb3ZlcmRyaXZlLnN2Yy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtJQUNBO0lBQ0E7QUFDQTs7QUNIQTtJQUNBO0lBQ0E7SUFDQTtBQUNBOztBQ0pBOztBQUVBO0lBQ0E7QUFDQTs7QUNKQTtJQUNBO0FBQ0E7O0FDRkE7O0FBRUE7O0FDRkE7SUFDQTtJQUNBOztJQUVBO0lBQ0E7UUFDQTtZQUNBO1lBQ0EsYUFBQSxTQUFBO1lBQ0E7UUFDQTtBQUNBLENBQUE7OztBQUVBO0lBQ0E7SUFDQTtBQ2ZBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztBQUVBLENBQUE7OztBQUVBO0lBQ0E7SUFDQSxhQUFBLFNBQUE7O0FDdkJBO0lBQ0E7UUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtZQUNBO1FBQ0E7WUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtNQUNBO0lBQ0E7QUFDQSxDQUFBOztBQUNBO0lBQ0E7SUFDQSxVQUFBLEtBQUE7O0FDckVBOztJQUVBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7O1FBRUE7WUFDQTtnQkFDQTtnQkFDQTtvQkFDQTt3QkFDQTt3QkFDQTtvQkFDQTtvQkFDQTtnQkFDQTtnQkFDQTtvQkFDQTtnQkFDQTtZQUNBO1FBQ0E7O1FBRUE7WUFDQTtRQUNBOztRQUVBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBOztRQUVBOztRQUVBO0lBQ0E7OztJQUdBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO0FBQ0EsQ0FBQTs7OztBQUdBO0lBQ0E7SUFDQSxVQUFBLFNBQUE7O0FDbEVBO0lBQ0E7UUFDQTtRQUNBO1FBQ0E7WUFDQTtnQkFDQTtnQkFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTtRQUNBO0lBQ0E7QUFDQTtBQUNBO0lBQ0E7SUFDQSxZQUFBLGFBQUE7O0FDM0JBOztJQUVBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTs7UUFFQTtZQUNBO2dCQUNBO29CQUNBO29CQUNBO29CQUNBO29CQUNBO2dCQUNBO1lBQ0E7UUFDQTtZQUNBO1lBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxTQUFBOztBQzlDQTs7SUFFQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQTtBQUNBO0lBQ0E7SUFDQSxVQUFBLGtCQUFBOztBQ1pBOztJQUVBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTs7UUFFQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtRQUNBOztRQUVBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO0FBQ0EsQ0FBQTs7OztBQUdBO0lBQ0E7SUFDQSxVQUFBLE9BQUE7O0FDOUNBO0lBQ0E7UUFDQTtRQUNBO1FBQ0E7WUFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO2dCQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7WUFDQTtRQUNBO0lBQ0E7QUFDQSxDQUFBOztBQUNBO0lBQ0E7SUFDQSxZQUFBLGVBQUE7O0FDdENBOztJQUVBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBOztRQUVBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7O1FBRUE7WUFDQTtRQUNBOztRQUVBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1FBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7WUFDQTs7WUFFQTtRQUNBO1lBQ0E7WUFDQTs7WUFFQTs7WUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxVQUFBOztBQ2xJQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxZQUFBOztBQ3ZEQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7O1FBRUE7O1FBRUE7O1FBRUE7O1FBRUE7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7O1FBRUE7O1FBRUE7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBOztZQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7O1lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxPQUFBOztBQ2hGQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtnQkFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxjQUFBOztBQ3RDQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTs7UUFFQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBOztRQUVBO1lBQ0E7UUFDQTs7UUFFQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtnQkFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1FBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7WUFDQTs7WUFFQTtRQUNBO1lBQ0E7WUFDQTs7WUFFQTs7WUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxTQUFBIiwiZmlsZSI6ImFwcC5qcyIsInNvdXJjZXNDb250ZW50IjpbImFuZ3VsYXIubW9kdWxlKCdHdHJQZWRhbHMnLCBbXG4gICAgJ25nUm91dGUnLFxuICAgICdCb2FyZCdcbl0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ0JvYXJkJywgW1xuICAgICdJbnB1dCcsXG4gICAgJ1BlZGFsJyxcbiAgICAnU2hhcmVkQXVkaW9Db250ZXh0J1xuXSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmFuZ3VsYXIubW9kdWxlKCdJbnB1dCcsIFtcbiAgICAnU2hhcmVkQXVkaW9Db250ZXh0J1xuXSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnUGVkYWwnLCBbXG4gICAgJ1NoYXJlZEF1ZGlvQ29udGV4dCdcbl0pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5hbmd1bGFyLm1vZHVsZSgnU2hhcmVkQXVkaW9Db250ZXh0JywgW10pO1xuIiwiZnVuY3Rpb24gY29uZmlnKCRyb3V0ZVByb3ZpZGVyLCAkbG9jYXRpb25Qcm92aWRlcikge1xuICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1vekdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWE7XG4gICAgd2luZG93LkF1ZGlvQ29udGV4dCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtcblxuICAgICRsb2NhdGlvblByb3ZpZGVyLmh0bWw1TW9kZSh0cnVlKTtcbiAgICAkcm91dGVQcm92aWRlclxuICAgICAgICAud2hlbignLycsIHtcbiAgICAgICAgICAgIHRlbXBsYXRlVXJsOiAnL3RlbXBsYXRlcy9ib2FyZC5odG1sJyxcbiAgICAgICAgICAgIGNvbnRyb2xsZXI6ICdCb2FyZEN0cmwnLFxuICAgICAgICAgICAgY29udHJvbGxlckFzOiAndm0nXG4gICAgICAgIH0pO1xufVxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnR3RyUGVkYWxzJylcbiAgICAuY29uZmlnKGNvbmZpZyk7IiwiZnVuY3Rpb24gQm9hcmRDdHJsIChCb2FyZCkge1xuICAgIHZhciB2bSA9IHRoaXM7XG5cbiAgICBCb2FyZC5sb2FkU291cmNlKCk7XG4gICAgQm9hcmQubG9hZFBlZGFscygpO1xuICAgIEJvYXJkLndpcmVVcEJvYXJkKCk7XG5cbiAgICB2bS5wbGF5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIEJvYXJkLnBsYXlTYW1wbGUoKTtcbiAgICB9O1xuXG4gICAgdm0uc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBCb2FyZC5zdG9wU2FtcGxlKCk7XG4gICAgfTtcblxuICAgIHZtLmxpdmVJbnB1dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBCb2FyZC50b2dnbGVMaXZlSW5wdXQoKTtcbiAgICB9XG5cbn1cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0JvYXJkJylcbiAgICAuY29udHJvbGxlcignQm9hcmRDdHJsJywgQm9hcmRDdHJsKTtcbiIsImZ1bmN0aW9uIEJvYXJkKCRyb290U2NvcGUsIEZpbGVJbnB1dCwgTGluZUlucHV0LCBDYWJpbmV0LCBEaXN0b3J0aW9uLCBPdmVyZHJpdmUsIEZsYW5nZXIsIFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCksXG4gICAgICAgIGJvYXJkSW5wdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG5cbiAgICB2YXIgcGVkYWxzID0ge1xuICAgICAgICBzYW1wbGU6IG5ldyBGaWxlSW5wdXQoKSxcbiAgICAgICAgbGluZTogbmV3IExpbmVJbnB1dCgpLFxuICAgICAgICBjYWJpbmV0OiBuZXcgQ2FiaW5ldCgpLFxuICAgICAgICBkaXN0b3J0aW9uOiBuZXcgRGlzdG9ydGlvbigpLFxuICAgICAgICBvdmVyZHJpdmU6IG5ldyBPdmVyZHJpdmUoKSxcbiAgICAgICAgZmxhbmdlcjogbmV3IEZsYW5nZXIoKVxuICAgIH07XG5cbiAgICB2YXIgc2FtcGxlcyA9IFtcbiAgICAgICAgJ2Fzc2V0cy9zYW1wbGVzL29wZW4ud2F2JyxcbiAgICAgICAgJ2Fzc2V0cy9zYW1wbGVzL2Nob3Jkcy53YXYnLFxuICAgICAgICAnYXNzZXRzL3NhbXBsZXMvZXZlcmxvbmcud2F2JyxcbiAgICAgICAgJ2Fzc2V0cy9zYW1wbGVzL29jdGF2ZXMud2F2JyxcbiAgICAgICAgJ2Fzc2V0cy9zYW1wbGVzL0ZGLndhdicsXG4gICAgICAgICdhc3NldHMvc2FtcGxlcy90d2lkZGxlcy53YXYnXG4gICAgXTtcblxuICAgIHRoaXMubG9hZFNvdXJjZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLnNhbXBsZS5sb2FkQnVmZmVyKHNhbXBsZXNbM10pO1xuICAgICAgICBwZWRhbHMuc2FtcGxlLmNvbm5lY3QoYm9hcmRJbnB1dCk7XG4gICAgfTtcblxuICAgIHRoaXMubG9hZFBlZGFscyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLmNhYmluZXQubG9hZCgnYXNzZXRzL2lyLzUxNTAud2F2Jyk7XG4gICAgICAgIHBlZGFscy5kaXN0b3J0aW9uLmxvYWQoJ2Rpc3QzJyk7XG4gICAgICAgIHBlZGFscy5vdmVyZHJpdmUubG9hZCgnb3ZlcmRyaXZlJyk7XG4gICAgICAgIHBlZGFscy5mbGFuZ2VyLmxvYWQoKTtcbiAgICB9O1xuXG4gICAgdGhpcy53aXJlVXBCb2FyZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgYm9hcmRJbnB1dC5jb25uZWN0KHBlZGFscy5kaXN0b3J0aW9uLmlucHV0KTtcbiAgICAgICAgcGVkYWxzLmRpc3RvcnRpb24uY29ubmVjdChwZWRhbHMub3ZlcmRyaXZlLmlucHV0KTtcbiAgICAgICAgcGVkYWxzLm92ZXJkcml2ZS5jb25uZWN0KHBlZGFscy5mbGFuZ2VyLmlucHV0KTtcbiAgICAgICAgcGVkYWxzLmZsYW5nZXIuY29ubmVjdChwZWRhbHMuY2FiaW5ldC5pbnB1dCk7XG4gICAgICAgIHBlZGFscy5jYWJpbmV0LmNvbm5lY3Qoc3RhZ2UuZGVzdGluYXRpb24pO1xuICAgIH07XG5cbiAgICB0aGlzLnBsYXlTYW1wbGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHBlZGFscy5zYW1wbGUucGxheSgpO1xuICAgIH07XG5cbiAgICB0aGlzLnN0b3BTYW1wbGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHBlZGFscy5zYW1wbGUuc3RvcCgpO1xuICAgIH07XG5cbiAgICB0aGlzLnRvZ2dsZUxpdmVJbnB1dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCFwZWRhbHMubGluZS5pc1N0cmVhbWluZykge1xuICAgICAgICAgICAgcGVkYWxzLmxpbmUubG9hZCgpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oJ2xpbmVpbjpsb2FkZWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcGVkYWxzLmxpbmUuc3RyZWFtLmNvbm5lY3QoYm9hcmRJbnB1dCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHBlZGFscy5saW5lLmlzU3RyZWFtaW5nID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZGFscy5saW5lLnN0b3AoKTtcbiAgICAgICAgICAgIHBlZGFscy5saW5lLmlzU3RyZWFtaW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdGhpcy5nZXRQZWRhbCA9IGZ1bmN0aW9uIChlZmZlY3QpIHtcbiAgICAgIHJldHVybiBwZWRhbHNbZWZmZWN0XTtcbiAgICB9O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0JvYXJkJylcbiAgICAuc2VydmljZSgnQm9hcmQnLCBCb2FyZCk7XG4iLCJmdW5jdGlvbiBGaWxlSW5wdXQgKFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuXG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKTtcblxuICAgIHZhciBGaWxlSW5wdXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuc291cmNlID0gbnVsbDtcbiAgICAgICAgdGhpcy5zYW1wbGUgPSBudWxsO1xuICAgIH07XG5cbiAgICBGaWxlSW5wdXQucHJvdG90eXBlLmxvYWRCdWZmZXIgPSBmdW5jdGlvbih1cmwpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgcmVxdWVzdC5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gXCJhcnJheWJ1ZmZlclwiO1xuXG4gICAgICAgIHZhciBsb2FkZXIgPSB0aGlzO1xuXG4gICAgICAgIHJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzdGFnZS5kZWNvZGVBdWRpb0RhdGEoXG4gICAgICAgICAgICAgICAgcmVxdWVzdC5yZXNwb25zZSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbihidWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFidWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFsZXJ0KCdlcnJvciBkZWNvZGluZyBmaWxlIGRhdGE6ICcgKyB1cmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxvYWRlci5zYW1wbGUgPSBidWZmZXI7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdkZWNvZGVBdWRpb0RhdGEgZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgYWxlcnQoJ0J1ZmZlckxvYWRlcjogWEhSIGVycm9yJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXF1ZXN0LnNlbmQoKTtcbiAgICB9O1xuXG4gICAgRmlsZUlucHV0LnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBGaWxlSW5wdXQucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zb3VyY2UgPSBzdGFnZS5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICAgICAgdGhpcy5zb3VyY2UubG9vcCA9IHRydWU7XG4gICAgICAgIHRoaXMuc291cmNlLmJ1ZmZlciA9IHRoaXMuc2FtcGxlO1xuXG4gICAgICAgIHRoaXMuc291cmNlLmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgIHRoaXMuc291cmNlLnN0YXJ0KDApO1xuICAgIH07XG5cblxuICAgIEZpbGVJbnB1dC5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnNvdXJjZS5zdG9wKCk7XG4gICAgICAgIHRoaXMuc291cmNlLmRpc2Nvbm5lY3QoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIEZpbGVJbnB1dDtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnSW5wdXQnKVxuICAgIC5mYWN0b3J5KCdGaWxlSW5wdXQnLCBGaWxlSW5wdXQpO1xuIiwiZnVuY3Rpb24gaW5wdXRDb250cm9scygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvY29udHJvbHMuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCkge1xuICAgICAgICAgICAgdmFyIHN0YXJ0ID0gYW5ndWxhci5lbGVtZW50KCcuZ2x5cGhpY29uLXBsYXknKSxcbiAgICAgICAgICAgICAgICBzdG9wID0gYW5ndWxhci5lbGVtZW50KCcuZ2x5cGhpY29uLXN0b3AnKSxcbiAgICAgICAgICAgICAgICBsaXZlSW5wdXQgPSBhbmd1bGFyLmVsZW1lbnQoJy5nbHlwaGljb24tcmVjb3JkJyk7XG5cbiAgICAgICAgICAgIHN0YXJ0Lm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgc3RvcC5wcm9wKCdkaXNhYmxlZCcsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBzdGFydC5wcm9wKCdkaXNhYmxlZCcsIHRydWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHN0b3Aub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBzdGFydC5wcm9wKCdkaXNhYmxlZCcsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBzdG9wLnByb3AoJ2Rpc2FibGVkJywgdHJ1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbGl2ZUlucHV0Lm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgbGl2ZUlucHV0LnRvZ2dsZUNsYXNzKFwiYnRuLWRhbmdlclwiKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdJbnB1dCcpXG4gICAgLmRpcmVjdGl2ZSgnaW5wdXRDb250cm9scycsIGlucHV0Q29udHJvbHMpO1xuIiwiZnVuY3Rpb24gTGluZUlucHV0KCRyb290U2NvcGUsIFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuXG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKTtcblxuICAgIHZhciBMaW5lSW5wdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLnN0cmVhbSA9IG51bGw7XG4gICAgICAgIHRoaXMuaXNTdHJlYW1pbmcgPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgTGluZUlucHV0LnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSh7XG4gICAgICAgICAgICBcImF1ZGlvXCI6IHtcbiAgICAgICAgICAgICAgICBcIm9wdGlvbmFsXCI6IFtcbiAgICAgICAgICAgICAgICAgICAge1wiZ29vZ0VjaG9DYW5jZWxsYXRpb25cIjogXCJmYWxzZVwifSxcbiAgICAgICAgICAgICAgICAgICAge1wiZ29vZ0F1dG9HYWluQ29udHJvbFwiOiBcImZhbHNlXCJ9LFxuICAgICAgICAgICAgICAgICAgICB7XCJnb29nTm9pc2VTdXBwcmVzc2lvblwiOiBcInRydWVcIn0sXG4gICAgICAgICAgICAgICAgICAgIHtcImdvb2dIaWdocGFzc0ZpbHRlclwiOiBcImZhbHNlXCJ9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCBmdW5jdGlvbiAoc3RyZWFtKSB7XG4gICAgICAgICAgICBzZWxmLnN0cmVhbSA9IHN0YWdlLmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRlbWl0KCdsaW5laW46bG9hZGVkJyk7XG4gICAgICAgICAgICB0aGlzLmlzU3RyZWFtaW5nID0gdHJ1ZTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignR3VpdGFyIHN0cmVhbSBmYWlsZWQ6ICcgKyBlcnIpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgTGluZUlucHV0LnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24gKHRhcmdldCkge1xuICAgICAgICB0aGlzLnN0cmVhbS5jb25uZWN0KHRhcmdldCk7XG4gICAgfTtcblxuICAgIExpbmVJbnB1dC5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zdHJlYW0uZGlzY29ubmVjdCgpO1xuICAgICAgICB0aGlzLmlzU3RyZWFtaW5nID0gZmFsc2U7XG4gICAgfTtcblxuICAgIHJldHVybiBMaW5lSW5wdXQ7XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0lucHV0JylcbiAgICAuc2VydmljZSgnTGluZUlucHV0JywgTGluZUlucHV0KTtcbiIsImZ1bmN0aW9uIFNoYXJlZEF1ZGlvQ29udGV4dCAoKSB7XG5cbiAgICB2YXIgU2hhcmVkQXVkaW9Db250ZXh0ID0ge307XG5cbiAgICBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udGV4dCB8fCAodGhpcy5jb250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCk7XG4gICAgfTtcblxuICAgIHJldHVybiBTaGFyZWRBdWRpb0NvbnRleHQ7XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnU2hhcmVkQXVkaW9Db250ZXh0JylcbiAgICAuZmFjdG9yeSgnU2hhcmVkQXVkaW9Db250ZXh0JywgU2hhcmVkQXVkaW9Db250ZXh0KTtcbiIsImZ1bmN0aW9uIENhYmluZXQgKFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuXG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKTtcblxuICAgIHZhciBDYWJpbmV0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmJvb3N0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmNvbnZvbHZlciA9IHN0YWdlLmNyZWF0ZUNvbnZvbHZlcigpO1xuICAgIH07XG5cbiAgICBDYWJpbmV0LnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24oaXJQYXRoKSB7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgIHJlcXVlc3Qub3BlbignR0VUJywgaXJQYXRoLCB0cnVlKTtcbiAgICAgICAgcmVxdWVzdC5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuXG4gICAgICAgIHZhciBsb2FkZXIgPSB0aGlzO1xuXG4gICAgICAgIHJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc3RhZ2UuZGVjb2RlQXVkaW9EYXRhKHJlcXVlc3QucmVzcG9uc2UsIGZ1bmN0aW9uIChidWZmZXIpIHtcbiAgICAgICAgICAgICAgICBsb2FkZXIuY29udm9sdmVyLmJ1ZmZlciA9IGJ1ZmZlcjtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGUpIGNvbnNvbGUubG9nKFwiQ2Fubm90IGxvYWQgY2FiaW5ldFwiICsgZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXF1ZXN0LnNlbmQobnVsbCk7XG5cbiAgICAgICAgdGhpcy5pbnB1dC5nYWluLnZhbHVlID0gMztcbiAgICAgICAgdGhpcy5ib29zdC5nYWluLnZhbHVlID0gMTtcblxuICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5jb252b2x2ZXIpO1xuICAgICAgICB0aGlzLmNvbnZvbHZlci5jb25uZWN0KHRoaXMuYm9vc3QpO1xuICAgICAgICB0aGlzLmJvb3N0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuICAgIH07XG5cbiAgICBDYWJpbmV0LnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2FiaW5ldDtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdDYWJpbmV0JywgQ2FiaW5ldCk7XG4iLCJmdW5jdGlvbiBkaXN0b3J0aW9uUGVkYWwgKEJvYXJkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL2Rpc3RvcnRpb24uaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uICgkc2NvcGUsICRlbGVtZW50KSB7XG4gICAgICAgICAgICBjb25zdCBNSURfTEVWRUwgPSA1LjU7XG4gICAgICAgICAgICB2YXIgZGlzdG9ydGlvbiA9IEJvYXJkLmdldFBlZGFsKCdkaXN0b3J0aW9uJyk7XG5cbiAgICAgICAgICAgIHZhciB2b2x1bWUgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI2Rpc3RvcnRpb24tdm9sdW1lJyksXG4gICAgICAgICAgICAgICAgdG9uZSA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZGlzdG9ydGlvbi10b25lJyksXG4gICAgICAgICAgICAgICAgZm9vdHN3aXRjaCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLXN3aXRjaCNkaXN0b3J0aW9uLWZvb3Qtc3cnKSxcbiAgICAgICAgICAgICAgICBsZWQgPSAkZWxlbWVudC5maW5kKCcubGVkJyk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGRpc3RvcnRpb24uc2V0Vm9sdW1lKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB2b2x1bWUub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdm9sdW1lLnZhbChNSURfTEVWRUwpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRvbmUub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBkaXN0b3J0aW9uLnNldFRvbmUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRvbmUub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdG9uZS52YWwoTUlEX0xFVkVMKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmb290c3dpdGNoLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBsZWQudG9nZ2xlQ2xhc3MoJ2FjdGl2ZScpO1xuICAgICAgICAgICAgICAgIGRpc3RvcnRpb24uYnlwYXNzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5kaXJlY3RpdmUoJ2Rpc3RvcnRpb25QZWRhbCcsIGRpc3RvcnRpb25QZWRhbCk7XG4iLCJmdW5jdGlvbiBEaXN0b3J0aW9uIChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgRGlzdG9ydGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmlucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5nYWluID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIgPSBzdGFnZS5jcmVhdGVXYXZlU2hhcGVyKCk7XG4gICAgICAgIHRoaXMubG93cGFzcyA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmhpZ2hwYXNzID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuYm9vc3QgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5jdXQgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy52b2x1bWUgPSA3LjU7XG4gICAgICAgIHRoaXMudG9uZSA9IDIwO1xuICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24odHlwZSkge1xuXG4gICAgICAgIHRoaXMuZ2Fpbi5nYWluLnZhbHVlID0gdGhpcy52b2x1bWU7XG5cbiAgICAgICAgdGhpcy5sb3dwYXNzLnR5cGUgPSBcImxvd3Bhc3NcIjtcbiAgICAgICAgdGhpcy5sb3dwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IDUwMDA7XG5cbiAgICAgICAgdGhpcy5ib29zdC50eXBlID0gXCJsb3dzaGVsZlwiO1xuICAgICAgICB0aGlzLmJvb3N0LmZyZXF1ZW5jeS52YWx1ZSA9IDEwMDtcbiAgICAgICAgdGhpcy5ib29zdC5nYWluLnZhbHVlID0gNjtcblxuICAgICAgICB0aGlzLmN1dC50eXBlID0gXCJsb3dzaGVsZlwiO1xuICAgICAgICB0aGlzLmN1dC5mcmVxdWVuY3kudmFsdWUgPSAxMDA7XG4gICAgICAgIHRoaXMuY3V0LmdhaW4udmFsdWUgPSAtNjtcblxuICAgICAgICB0aGlzLndhdmVzaGFwZXIuY3VydmUgPSB0aGlzLm1ha2VEaXN0b3J0aW9uQ3VydmUoMTAsIHR5cGUpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIub3ZlcnNhbXBsZSA9ICc0eCc7XG5cbiAgICAgICAgdGhpcy5oaWdocGFzcy50eXBlID0gXCJoaWdocGFzc1wiO1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IHRoaXMudG9uZTtcblxuICAgICAgICB0aGlzLmdhaW4uY29ubmVjdCh0aGlzLmxvd3Bhc3MpXG4gICAgICAgIHRoaXMubG93cGFzcy5jb25uZWN0KHRoaXMuYm9vc3QpO1xuICAgICAgICB0aGlzLmJvb3N0LmNvbm5lY3QodGhpcy53YXZlc2hhcGVyKTtcbiAgICAgICAgdGhpcy53YXZlc2hhcGVyLmNvbm5lY3QodGhpcy5jdXQpO1xuICAgICAgICB0aGlzLmN1dC5jb25uZWN0KHRoaXMuaGlnaHBhc3MpO1xuXG4gICAgICAgIC8vYnlwYXNzIGJ5IGRlZmF1bHRcbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUubWFrZURpc3RvcnRpb25DdXJ2ZSA9IGZ1bmN0aW9uIChhbW91bnQsIHR5cGUpIHtcbiAgICAgICAgdmFyIGsgPSB0eXBlb2YgYW1vdW50ID09PSAnbnVtYmVyJyA/IGFtb3VudCA6IDEwLFxuICAgICAgICAgICAgc2FtcGxlcyA9IDExMDI1LFxuICAgICAgICAgICAgY3VydmUgPSBuZXcgRmxvYXQzMkFycmF5KHNhbXBsZXMpO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2FtcGxlczsgKytpKSB7XG4gICAgICAgICAgICBjdXJ2ZVtpXSA9IHRoaXMuY3VydmVBbGdvcml0aG0oaSAqIDIgLyBzYW1wbGVzIC0gMSwgdHlwZSwgayk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3VydmU7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLmN1cnZlQWxnb3JpdGhtID0gZnVuY3Rpb24gKHgsIHR5cGUsIGspIHtcbiAgICAgICAgc3dpdGNoKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3QxJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5tYXgoLTAuNSwgTWF0aC5taW4oMC41LCB4ICogaykpO1xuICAgICAgICAgICAgY2FzZSAnZGlzdDInOlxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgtMSwgTWF0aC5taW4oMSwgeCAqIGspKTtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3QzJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5tYXgoLTAuNSwgTWF0aC5taW4oMS41LCB4ICkpO1xuICAgICAgICAgICAgY2FzZSAnZGlzdDQnOlxuICAgICAgICAgICAgICAgIHJldHVybiAyLjggKiBNYXRoLnBvdyh4LCAzKSArIE1hdGgucG93KHgsMikgKyAtMS4xICogeCAtIDAuNTtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3Q1JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gKE1hdGguZXhwKHgpIC0gTWF0aC5leHAoLXggKiAxLjIpKSAvIChNYXRoLmV4cCh4KSArIE1hdGguZXhwKC14KSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0Nic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudGFuaCh4KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS50YW5oID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgaWYgKHggPT09IEluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIGlmICh4ID09PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAoTWF0aC5leHAoeCkgLSBNYXRoLmV4cCgteCkpIC8gKE1hdGguZXhwKHgpICsgTWF0aC5leHAoLXgpKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5zaWduID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgeCA9ICt4OyAvLyBjb252ZXJ0IHRvIGEgbnVtYmVyXG4gICAgICAgIGlmICh4ID09PSAwIHx8IGlzTmFOKHgpKVxuICAgICAgICAgICAgcmV0dXJuIHg7XG4gICAgICAgIHJldHVybiB4ID4gMCA/IDEgOiAtMTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuYnlwYXNzID0gZnVuY3Rpb24oKXtcbiAgICAgICAgaWYodGhpcy5pc0J5cGFzc2VkKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLmdhaW4pO1xuICAgICAgICAgICAgdGhpcy5oaWdocGFzcy5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaGlnaHBhc3MuZGlzY29ubmVjdCgpO1xuXG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgICAgICB0aGlzLmdhaW4uZ2Fpbi52YWx1ZSA9IDEuNSAqIHZvbHVtZTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuc2V0VG9uZSA9IGZ1bmN0aW9uKHRvbmUpIHtcbiAgICAgICAgdGhpcy5oaWdocGFzcy5mcmVxdWVuY3kudmFsdWUgPSAyMCAqIHRvbmU7XG4gICAgfTtcblxuICAgIHJldHVybiBEaXN0b3J0aW9uO1xufVxuXG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdQZWRhbCcpXG4gICAgLmZhY3RvcnkoJ0Rpc3RvcnRpb24nLCBEaXN0b3J0aW9uKTtcbiIsImZ1bmN0aW9uIGZsYW5nZXJQZWRhbCAoQm9hcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvZmxhbmdlci5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBmbGFuZ2VyID0gQm9hcmQuZ2V0UGVkYWwoJ2ZsYW5nZXInKTtcblxuICAgICAgICAgICAgdmFyIHNwZWVkID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNmbGFuZ2VyLXNwZWVkJyksXG4gICAgICAgICAgICAgICAgZGVsYXkgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI2ZsYW5nZXItZGVsYXknKSxcbiAgICAgICAgICAgICAgICBkZXB0aCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZmxhbmdlci1kZXB0aCcpLFxuICAgICAgICAgICAgICAgIGZlZWRiYWNrID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNmbGFuZ2VyLWZlZWRiYWNrJyksXG4gICAgICAgICAgICAgICAgZm9vdHN3aXRjaCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLXN3aXRjaCNmbGFuZ2VyLWZvb3Qtc3cnKSxcbiAgICAgICAgICAgICAgICBsZWQgPSAkZWxlbWVudC5maW5kKCcubGVkJyk7XG5cbiAgICAgICAgICAgIHNwZWVkLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZmxhbmdlci5zZXRTcGVlZChlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgc3BlZWQub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgc3BlZWQudmFsKHBhcnNlRmxvYXQoMC43MCkpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRlbGF5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZmxhbmdlci5zZXREZWxheShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZGVsYXkub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZGVsYXkudmFsKHBhcnNlRmxvYXQoMC4wMDMpKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZXB0aC5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGZsYW5nZXIuc2V0RGVwdGgoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRlcHRoLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGRlcHRoLnZhbChwYXJzZUZsb2F0KDAuMDAxMykpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZlZWRiYWNrLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZmxhbmdlci5zZXRGZWVkYmFjayhlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZmVlZGJhY2sub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZmVlZGJhY2sudmFsKHBhcnNlRmxvYXQoMC40KSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZm9vdHN3aXRjaC5vbignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbGVkLnRvZ2dsZUNsYXNzKCdhY3RpdmUnKTtcbiAgICAgICAgICAgICAgICBmbGFuZ2VyLmJ5cGFzcygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZGlyZWN0aXZlKCdmbGFuZ2VyUGVkYWwnLCBmbGFuZ2VyUGVkYWwpO1xuIiwiZnVuY3Rpb24gRmxhbmdlciAoU2hhcmVkQXVkaW9Db250ZXh0KSB7XG5cbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpO1xuXG4gICAgdmFyIEZsYW5nZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5pbnB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMud2V0Z2FpbiA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5mZWVkYmFjayA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5kZXB0aCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vc2MgPSBzdGFnZS5jcmVhdGVPc2NpbGxhdG9yKCk7XG4gICAgICAgIHRoaXMuZGVsYXkgPSBzdGFnZS5jcmVhdGVEZWxheSgpO1xuICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMub3NjLnR5cGUgPSAnc2luZSc7XG4gICAgICAgIHRoaXMub3NjLmZyZXF1ZW5jeS52YWx1ZSA9IHBhcnNlRmxvYXQoIDAuNyApO1xuXG4gICAgICAgIHRoaXMuZGVsYXkuZGVsYXlUaW1lLnZhbHVlID0gcGFyc2VGbG9hdCggMC4wMDMgKTtcblxuICAgICAgICB0aGlzLmRlcHRoLmdhaW4udmFsdWUgPSBwYXJzZUZsb2F0KCAwLjAwMTMgKTtcblxuICAgICAgICB0aGlzLmZlZWRiYWNrLmdhaW4udmFsdWUgPSBwYXJzZUZsb2F0KCAwLjQwICk7XG5cbiAgICAgICAgdGhpcy5vc2MuY29ubmVjdCh0aGlzLmRlcHRoKTtcbiAgICAgICAgdGhpcy5kZXB0aC5jb25uZWN0KHRoaXMuZGVsYXkuZGVsYXlUaW1lKTtcblxuICAgICAgICB0aGlzLmRlbGF5LmNvbm5lY3QoIHRoaXMud2V0Z2FpbiApO1xuICAgICAgICB0aGlzLmRlbGF5LmNvbm5lY3QoIHRoaXMuZmVlZGJhY2sgKTtcbiAgICAgICAgdGhpcy5mZWVkYmFjay5jb25uZWN0KCB0aGlzLmlucHV0ICk7XG5cbiAgICAgICAgdGhpcy5vc2Muc3RhcnQoMCk7XG5cbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgRmxhbmdlci5wcm90b3R5cGUuc2V0U3BlZWQgPSBmdW5jdGlvbihzcGVlZCkge1xuICAgICAgICB0aGlzLm9zYy5mcmVxdWVuY3kudmFsdWUgPSBwYXJzZUZsb2F0KHNwZWVkKTtcbiAgICB9O1xuXG4gICAgRmxhbmdlci5wcm90b3R5cGUuc2V0RGVsYXkgPSBmdW5jdGlvbihkZWxheSkge1xuICAgICAgICB0aGlzLmRlbGF5LmRlbGF5VGltZS52YWx1ZSA9IHBhcnNlRmxvYXQoZGVsYXkpO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5zZXREZXB0aCA9IGZ1bmN0aW9uKGRlcHRoKSB7XG4gICAgICAgIHRoaXMuZGVwdGguZ2Fpbi52YWx1ZSA9IHBhcnNlRmxvYXQoZGVwdGgpO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5zZXRGZWVkYmFjayA9IGZ1bmN0aW9uKGZlZWRiYWNrKSB7XG4gICAgICAgIHRoaXMuZmVlZGJhY2suZ2Fpbi52YWx1ZSA9IHBhcnNlRmxvYXQoZmVlZGJhY2spO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5ieXBhc3MgPSBmdW5jdGlvbigpe1xuICAgICAgICBpZih0aGlzLmlzQnlwYXNzZWQpIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMud2V0Z2Fpbik7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QoIHRoaXMuZGVsYXkpO1xuICAgICAgICAgICAgdGhpcy53ZXRnYWluLmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy53ZXRnYWluLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRmxhbmdlci5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIEZsYW5nZXI7XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZmFjdG9yeSgnRmxhbmdlcicsIEZsYW5nZXIpO1xuIiwiZnVuY3Rpb24gb3ZlcmRyaXZlUGVkYWwgKEJvYXJkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL292ZXJkcml2ZS5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IE1JRF9MRVZFTCA9IDUuNTtcbiAgICAgICAgICAgIHZhciBvdmVyZHJpdmUgPSBCb2FyZC5nZXRQZWRhbCgnb3ZlcmRyaXZlJyk7XG5cbiAgICAgICAgICAgIHZhciB2b2x1bWUgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI292ZXJkcml2ZS12b2x1bWUnKSxcbiAgICAgICAgICAgICAgICB0b25lID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNvdmVyZHJpdmUtdG9uZScpLFxuICAgICAgICAgICAgICAgIGZvb3Rzd2l0Y2ggPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1zd2l0Y2gjb3ZlcmRyaXZlLWZvb3Qtc3cnKSxcbiAgICAgICAgICAgICAgICBsZWQgPSAkZWxlbWVudC5maW5kKCcubGVkJyk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIG92ZXJkcml2ZS5zZXRWb2x1bWUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2b2x1bWUudmFsKE1JRF9MRVZFTCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdG9uZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIG92ZXJkcml2ZS5zZXRUb25lKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0b25lLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRvbmUudmFsKE1JRF9MRVZFTCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZm9vdHN3aXRjaC5vbignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbGVkLnRvZ2dsZUNsYXNzKCdhY3RpdmUnKTtcbiAgICAgICAgICAgICAgICBvdmVyZHJpdmUuYnlwYXNzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5kaXJlY3RpdmUoJ292ZXJkcml2ZVBlZGFsJywgb3ZlcmRyaXZlUGVkYWwpO1xuIiwiZnVuY3Rpb24gT3ZlcmRyaXZlIChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgT3ZlcmRyaXZlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmdhaW4gPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlciA9IHN0YWdlLmNyZWF0ZVdhdmVTaGFwZXIoKTtcbiAgICAgICAgdGhpcy5sb3dwYXNzID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5ib29zdCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmN1dCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLnZvbHVtZSA9IDcuNTtcbiAgICAgICAgdGhpcy50b25lID0gMjA7XG4gICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgfTtcblxuICAgIE92ZXJkcml2ZS5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKHR5cGUpIHtcblxuICAgICAgICB0aGlzLmdhaW4uZ2Fpbi52YWx1ZSA9IHRoaXMudm9sdW1lO1xuXG4gICAgICAgIHRoaXMubG93cGFzcy50eXBlID0gXCJsb3dwYXNzXCI7XG4gICAgICAgIHRoaXMubG93cGFzcy5mcmVxdWVuY3kudmFsdWUgPSA1MDAwO1xuXG4gICAgICAgIHRoaXMuYm9vc3QudHlwZSA9IFwibG93c2hlbGZcIjtcbiAgICAgICAgdGhpcy5ib29zdC5mcmVxdWVuY3kudmFsdWUgPSAxMDA7XG4gICAgICAgIHRoaXMuYm9vc3QuZ2Fpbi52YWx1ZSA9IDY7XG5cbiAgICAgICAgdGhpcy5jdXQudHlwZSA9IFwibG93c2hlbGZcIjtcbiAgICAgICAgdGhpcy5jdXQuZnJlcXVlbmN5LnZhbHVlID0gMTAwO1xuICAgICAgICB0aGlzLmN1dC5nYWluLnZhbHVlID0gLTY7XG5cbiAgICAgICAgdGhpcy53YXZlc2hhcGVyLmN1cnZlID0gdGhpcy5tYWtlT3ZlcmRyaXZlQ3VydmUoMTAsIHR5cGUpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIub3ZlcnNhbXBsZSA9ICc0eCc7XG5cbiAgICAgICAgdGhpcy5oaWdocGFzcy50eXBlID0gXCJoaWdocGFzc1wiO1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IHRoaXMudG9uZTtcblxuICAgICAgICB0aGlzLmdhaW4uY29ubmVjdCh0aGlzLmxvd3Bhc3MpXG4gICAgICAgIHRoaXMubG93cGFzcy5jb25uZWN0KHRoaXMuYm9vc3QpO1xuICAgICAgICB0aGlzLmJvb3N0LmNvbm5lY3QodGhpcy53YXZlc2hhcGVyKTtcbiAgICAgICAgdGhpcy53YXZlc2hhcGVyLmNvbm5lY3QodGhpcy5jdXQpO1xuICAgICAgICB0aGlzLmN1dC5jb25uZWN0KHRoaXMuaGlnaHBhc3MpO1xuXG4gICAgICAgIC8vYnlwYXNzIGJ5IGRlZmF1bHRcbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5tYWtlT3ZlcmRyaXZlQ3VydmUgPSBmdW5jdGlvbiAoYW1vdW50LCB0eXBlKSB7XG4gICAgICAgIHZhciBrID0gdHlwZW9mIGFtb3VudCA9PT0gJ251bWJlcicgPyBhbW91bnQgOiAxMCxcbiAgICAgICAgICAgIHNhbXBsZXMgPSAxMTAyNSxcbiAgICAgICAgICAgIGN1cnZlID0gbmV3IEZsb2F0MzJBcnJheShzYW1wbGVzKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNhbXBsZXM7ICsraSkge1xuICAgICAgICAgICAgY3VydmVbaV0gPSB0aGlzLmN1cnZlQWxnb3JpdGhtKGkgKiAyIC8gc2FtcGxlcyAtIDEsIHR5cGUsIGspO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGN1cnZlO1xuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLmN1cnZlQWxnb3JpdGhtID0gZnVuY3Rpb24gKHgsIHR5cGUsIGspIHtcbiAgICAgICAgc3dpdGNoKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ292ZXJkcml2ZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuICgxICsgaykgKiB4IC8gKDEgKyBrICogTWF0aC5hYnMoeCkpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIE92ZXJkcml2ZS5wcm90b3R5cGUudGFuaCA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIGlmICh4ID09PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSBpZiAoeCA9PT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gKE1hdGguZXhwKHgpIC0gTWF0aC5leHAoLXgpKSAvIChNYXRoLmV4cCh4KSArIE1hdGguZXhwKC14KSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5zaWduID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgeCA9ICt4OyAvLyBjb252ZXJ0IHRvIGEgbnVtYmVyXG4gICAgICAgIGlmICh4ID09PSAwIHx8IGlzTmFOKHgpKVxuICAgICAgICAgICAgcmV0dXJuIHg7XG4gICAgICAgIHJldHVybiB4ID4gMCA/IDEgOiAtMTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLmJ5cGFzcyA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIGlmKHRoaXMuaXNCeXBhc3NlZCkge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5nYWluKTtcbiAgICAgICAgICAgIHRoaXMuaGlnaHBhc3MuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmhpZ2hwYXNzLmRpc2Nvbm5lY3QoKTtcblxuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgICAgICB0aGlzLmdhaW4uZ2Fpbi52YWx1ZSA9IDEuNSAqIHZvbHVtZTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5zZXRUb25lID0gZnVuY3Rpb24odG9uZSkge1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IDIwICogdG9uZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIE92ZXJkcml2ZTtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdPdmVyZHJpdmUnLCBPdmVyZHJpdmUpO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9