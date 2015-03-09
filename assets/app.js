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

function Board($rootScope, FileInput, LineInput, Cabinet, Distortion, Overdrive, Flanger, Delay, SharedAudioContext) {
    var stage = SharedAudioContext.getContext(),
        boardInput = stage.createGain();

    var pedals = {
        sample: new FileInput(),
        line: new LineInput(),
        cabinet: new Cabinet(),
        distortion: new Distortion(),
        overdrive: new Overdrive(),
        flanger: new Flanger(),
        delay: new Delay()
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
        pedals.sample.loadBuffer(samples[0]);
        pedals.sample.connect(boardInput);
    };

    this.loadPedals = function () {
        pedals.cabinet.load('assets/ir/5150.wav');
        pedals.distortion.load('dist3');
        pedals.overdrive.load('overdrive');
        pedals.flanger.load();
        pedals.delay.load();
    };

    this.wireUpBoard = function () {
        boardInput.connect(pedals.distortion.input);
        pedals.distortion.connect(pedals.overdrive.input);
        pedals.overdrive.connect(pedals.flanger.input);
        pedals.flanger.connect(pedals.delay.input);
        pedals.delay.connect(pedals.cabinet.input);
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
Board.$inject = ["$rootScope", "FileInput", "LineInput", "Cabinet", "Distortion", "Overdrive", "Flanger", "Delay", "SharedAudioContext"];
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
delayPedal.$inject = ["Board"];
angular
    .module('Pedal')
    .directive('delayPedal', delayPedal);

function Delay (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var delay = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.feedback = stage.createGain();
        this.delay = stage.createDelay();
        this.isBypassed = true;
    };

    delay.prototype.load = function() {
        this.delay.delayTime.value = parseFloat( 0.5 );
        this.feedback.gain.value = parseFloat( 0.75 );

        this.feedback.connect( this.delay );
        this.delay.connect( this.feedback );

        this.input.connect(this.output);
    };

    delay.prototype.setTime = function(time) {
        this.delay.delayTime.value = parseFloat(time);
    };

    delay.prototype.setFeedback = function(feedback) {
        this.feedback.gain.value = parseFloat(feedback);
    };

    delay.prototype.bypass = function(){
        if(this.isBypassed) {
            this.input.disconnect();
            this.input.connect(this.feedback);
            this.delay.connect(this.feedback);
            this.delay.connect(this.output);

            this.isBypassed = false;
        } else {
            this.input.disconnect();
            this.delay.disconnect();
            this.input.connect(this.output);

            this.isBypassed = true;
        }
    };

    delay.prototype.connect = function(target){
        this.output.connect(target);
    };

    return delay;
}
Delay.$inject = ["SharedAudioContext"];


angular
    .module('Pedal')
    .factory('Delay', Delay);

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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZHVsZS5qcyIsImJvYXJkL21vZHVsZS5qcyIsImlucHV0L21vZHVsZS5qcyIsInBlZGFsL21vZHVsZS5qcyIsInV0aWxzL21vZHVsZS5qcyIsImNvbmZpZy5qcyIsImJvYXJkL2JvYXJkLmN0cmwuanMiLCJib2FyZC9ib2FyZC5zdmMuanMiLCJpbnB1dC9maWxlX2lucHV0LnN2Yy5qcyIsImlucHV0L2lucHV0X2NvbnRyb2xzLmRpcmVjdGl2ZS5qcyIsImlucHV0L2xpbmVfaW5wdXQuc3ZjLmpzIiwidXRpbHMvc2hhcmVkX2F1ZGlvX2NvbnRleHQuZmFjdG9yeS5qcyIsInBlZGFsL2NhYmluZXQvcGVkYWxfY2FiaW5ldC5zdmMuanMiLCJwZWRhbC9kZWxheS9kZWxheV9wZWRhbC5kaXJlY3RpdmUuanMiLCJwZWRhbC9kZWxheS9wZWRhbF9kZWxheS5zdmMuanMiLCJwZWRhbC9kaXN0b3J0aW9uL2Rpc3RvcnRpb25fcGVkYWwuZGlyZWN0aXZlLmpzIiwicGVkYWwvZGlzdG9ydGlvbi9wZWRhbF9kaXN0b3J0aW9uLnN2Yy5qcyIsInBlZGFsL2ZsYW5nZXIvZmxhbmdlcl9wZWRhbC5kaXJlY3RpdmUuanMiLCJwZWRhbC9mbGFuZ2VyL3BlZGFsX2ZsYW5nZXIuc3ZjLmpzIiwicGVkYWwvb3ZlcmRyaXZlL292ZXJkcml2ZV9wZWRhbC5kaXJlY3RpdmUuanMiLCJwZWRhbC9vdmVyZHJpdmUvcGVkYWxfb3ZlcmRyaXZlLnN2Yy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtJQUNBO0lBQ0E7QUFDQTs7QUNIQTtJQUNBO0lBQ0E7SUFDQTtBQUNBOztBQ0pBOztBQUVBO0lBQ0E7QUFDQTs7QUNKQTtJQUNBO0FBQ0E7O0FDRkE7O0FBRUE7O0FDRkE7SUFDQTtJQUNBOztJQUVBO0lBQ0E7UUFDQTtZQUNBO1lBQ0EsYUFBQSxTQUFBO1lBQ0E7UUFDQTtBQUNBLENBQUE7OztBQUVBO0lBQ0E7SUFDQTtBQ2ZBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztBQUVBLENBQUE7OztBQUVBO0lBQ0E7SUFDQSxhQUFBLFNBQUE7O0FDdkJBO0lBQ0E7UUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtZQUNBO1FBQ0E7WUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtNQUNBO0lBQ0E7QUFDQSxDQUFBOztBQUNBO0lBQ0E7SUFDQSxVQUFBLEtBQUE7O0FDeEVBOztJQUVBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7O1FBRUE7WUFDQTtnQkFDQTtnQkFDQTtvQkFDQTt3QkFDQTt3QkFDQTtvQkFDQTtvQkFDQTtnQkFDQTtnQkFDQTtvQkFDQTtnQkFDQTtZQUNBO1FBQ0E7O1FBRUE7WUFDQTtRQUNBOztRQUVBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBOztRQUVBOztRQUVBO0lBQ0E7OztJQUdBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO0FBQ0EsQ0FBQTs7OztBQUdBO0lBQ0E7SUFDQSxVQUFBLFNBQUE7O0FDbEVBO0lBQ0E7UUFDQTtRQUNBO1FBQ0E7WUFDQTtnQkFDQTtnQkFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTtRQUNBO0lBQ0E7QUFDQTtBQUNBO0lBQ0E7SUFDQSxZQUFBLGFBQUE7O0FDM0JBOztJQUVBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTs7UUFFQTtZQUNBO2dCQUNBO29CQUNBO29CQUNBO29CQUNBO29CQUNBO2dCQUNBO1lBQ0E7UUFDQTtZQUNBO1lBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxTQUFBOztBQzlDQTs7SUFFQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQTtBQUNBO0lBQ0E7SUFDQSxVQUFBLGtCQUFBOztBQ1pBOztJQUVBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTs7UUFFQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtRQUNBOztRQUVBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO0FBQ0EsQ0FBQTs7OztBQUdBO0lBQ0E7SUFDQSxVQUFBLE9BQUE7O0FDOUNBO0lBQ0E7UUFDQTtRQUNBO1FBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtnQkFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxVQUFBOztBQ3JDQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBOztZQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7O1lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxLQUFBOztBQ3pEQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtnQkFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxlQUFBOztBQ3RDQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTs7UUFFQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBOztRQUVBO1lBQ0E7UUFDQTs7UUFFQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7O1lBRUE7UUFDQTtZQUNBO1lBQ0E7O1lBRUE7O1lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsVUFBQTs7QUNsSUE7SUFDQTtRQUNBO1FBQ0E7UUFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO2dCQUNBO2dCQUNBO2dCQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBO1FBQ0E7SUFDQTtBQUNBLENBQUE7O0FBQ0E7SUFDQTtJQUNBLFlBQUEsWUFBQTs7QUN2REE7O0lBRUE7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBOztRQUVBOztRQUVBOztRQUVBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBOztRQUVBOztRQUVBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTs7WUFFQTtRQUNBO1lBQ0E7WUFDQTtZQUNBOztZQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsT0FBQTs7QUNoRkE7SUFDQTtRQUNBO1FBQ0E7UUFDQTtZQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBO1FBQ0E7SUFDQTtBQUNBLENBQUE7O0FBQ0E7SUFDQTtJQUNBLFlBQUEsY0FBQTs7QUN0Q0E7O0lBRUE7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7O1FBRUE7O1FBRUE7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBOztRQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7WUFDQTs7UUFFQTtZQUNBO1FBQ0E7O1FBRUE7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7Z0JBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7O1lBRUE7UUFDQTtZQUNBO1lBQ0E7O1lBRUE7O1lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsU0FBQSIsImZpbGUiOiJhcHAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJhbmd1bGFyLm1vZHVsZSgnR3RyUGVkYWxzJywgW1xuICAgICduZ1JvdXRlJyxcbiAgICAnQm9hcmQnXG5dKTtcbiIsImFuZ3VsYXIubW9kdWxlKCdCb2FyZCcsIFtcbiAgICAnSW5wdXQnLFxuICAgICdQZWRhbCcsXG4gICAgJ1NoYXJlZEF1ZGlvQ29udGV4dCdcbl0pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5hbmd1bGFyLm1vZHVsZSgnSW5wdXQnLCBbXG4gICAgJ1NoYXJlZEF1ZGlvQ29udGV4dCdcbl0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ1BlZGFsJywgW1xuICAgICdTaGFyZWRBdWRpb0NvbnRleHQnXG5dKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuYW5ndWxhci5tb2R1bGUoJ1NoYXJlZEF1ZGlvQ29udGV4dCcsIFtdKTtcbiIsImZ1bmN0aW9uIGNvbmZpZygkcm91dGVQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhID0gbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhO1xuICAgIHdpbmRvdy5BdWRpb0NvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQ7XG5cbiAgICAkbG9jYXRpb25Qcm92aWRlci5odG1sNU1vZGUodHJ1ZSk7XG4gICAgJHJvdXRlUHJvdmlkZXJcbiAgICAgICAgLndoZW4oJy8nLCB7XG4gICAgICAgICAgICB0ZW1wbGF0ZVVybDogJy90ZW1wbGF0ZXMvYm9hcmQuaHRtbCcsXG4gICAgICAgICAgICBjb250cm9sbGVyOiAnQm9hcmRDdHJsJyxcbiAgICAgICAgICAgIGNvbnRyb2xsZXJBczogJ3ZtJ1xuICAgICAgICB9KTtcbn1cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0d0clBlZGFscycpXG4gICAgLmNvbmZpZyhjb25maWcpOyIsImZ1bmN0aW9uIEJvYXJkQ3RybCAoQm9hcmQpIHtcbiAgICB2YXIgdm0gPSB0aGlzO1xuXG4gICAgQm9hcmQubG9hZFNvdXJjZSgpO1xuICAgIEJvYXJkLmxvYWRQZWRhbHMoKTtcbiAgICBCb2FyZC53aXJlVXBCb2FyZCgpO1xuXG4gICAgdm0ucGxheSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBCb2FyZC5wbGF5U2FtcGxlKCk7XG4gICAgfTtcblxuICAgIHZtLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgQm9hcmQuc3RvcFNhbXBsZSgpO1xuICAgIH07XG5cbiAgICB2bS5saXZlSW5wdXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgQm9hcmQudG9nZ2xlTGl2ZUlucHV0KCk7XG4gICAgfVxuXG59XG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdCb2FyZCcpXG4gICAgLmNvbnRyb2xsZXIoJ0JvYXJkQ3RybCcsIEJvYXJkQ3RybCk7XG4iLCJmdW5jdGlvbiBCb2FyZCgkcm9vdFNjb3BlLCBGaWxlSW5wdXQsIExpbmVJbnB1dCwgQ2FiaW5ldCwgRGlzdG9ydGlvbiwgT3ZlcmRyaXZlLCBGbGFuZ2VyLCBEZWxheSwgU2hhcmVkQXVkaW9Db250ZXh0KSB7XG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKSxcbiAgICAgICAgYm9hcmRJbnB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcblxuICAgIHZhciBwZWRhbHMgPSB7XG4gICAgICAgIHNhbXBsZTogbmV3IEZpbGVJbnB1dCgpLFxuICAgICAgICBsaW5lOiBuZXcgTGluZUlucHV0KCksXG4gICAgICAgIGNhYmluZXQ6IG5ldyBDYWJpbmV0KCksXG4gICAgICAgIGRpc3RvcnRpb246IG5ldyBEaXN0b3J0aW9uKCksXG4gICAgICAgIG92ZXJkcml2ZTogbmV3IE92ZXJkcml2ZSgpLFxuICAgICAgICBmbGFuZ2VyOiBuZXcgRmxhbmdlcigpLFxuICAgICAgICBkZWxheTogbmV3IERlbGF5KClcbiAgICB9O1xuXG4gICAgdmFyIHNhbXBsZXMgPSBbXG4gICAgICAgICdhc3NldHMvc2FtcGxlcy9vcGVuLndhdicsXG4gICAgICAgICdhc3NldHMvc2FtcGxlcy9jaG9yZHMud2F2JyxcbiAgICAgICAgJ2Fzc2V0cy9zYW1wbGVzL2V2ZXJsb25nLndhdicsXG4gICAgICAgICdhc3NldHMvc2FtcGxlcy9vY3RhdmVzLndhdicsXG4gICAgICAgICdhc3NldHMvc2FtcGxlcy9GRi53YXYnLFxuICAgICAgICAnYXNzZXRzL3NhbXBsZXMvdHdpZGRsZXMud2F2J1xuICAgIF07XG5cbiAgICB0aGlzLmxvYWRTb3VyY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHBlZGFscy5zYW1wbGUubG9hZEJ1ZmZlcihzYW1wbGVzWzBdKTtcbiAgICAgICAgcGVkYWxzLnNhbXBsZS5jb25uZWN0KGJvYXJkSW5wdXQpO1xuICAgIH07XG5cbiAgICB0aGlzLmxvYWRQZWRhbHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHBlZGFscy5jYWJpbmV0LmxvYWQoJ2Fzc2V0cy9pci81MTUwLndhdicpO1xuICAgICAgICBwZWRhbHMuZGlzdG9ydGlvbi5sb2FkKCdkaXN0MycpO1xuICAgICAgICBwZWRhbHMub3ZlcmRyaXZlLmxvYWQoJ292ZXJkcml2ZScpO1xuICAgICAgICBwZWRhbHMuZmxhbmdlci5sb2FkKCk7XG4gICAgICAgIHBlZGFscy5kZWxheS5sb2FkKCk7XG4gICAgfTtcblxuICAgIHRoaXMud2lyZVVwQm9hcmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGJvYXJkSW5wdXQuY29ubmVjdChwZWRhbHMuZGlzdG9ydGlvbi5pbnB1dCk7XG4gICAgICAgIHBlZGFscy5kaXN0b3J0aW9uLmNvbm5lY3QocGVkYWxzLm92ZXJkcml2ZS5pbnB1dCk7XG4gICAgICAgIHBlZGFscy5vdmVyZHJpdmUuY29ubmVjdChwZWRhbHMuZmxhbmdlci5pbnB1dCk7XG4gICAgICAgIHBlZGFscy5mbGFuZ2VyLmNvbm5lY3QocGVkYWxzLmRlbGF5LmlucHV0KTtcbiAgICAgICAgcGVkYWxzLmRlbGF5LmNvbm5lY3QocGVkYWxzLmNhYmluZXQuaW5wdXQpO1xuICAgICAgICBwZWRhbHMuY2FiaW5ldC5jb25uZWN0KHN0YWdlLmRlc3RpbmF0aW9uKTtcbiAgICB9O1xuXG4gICAgdGhpcy5wbGF5U2FtcGxlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBwZWRhbHMuc2FtcGxlLnBsYXkoKTtcbiAgICB9O1xuXG4gICAgdGhpcy5zdG9wU2FtcGxlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBwZWRhbHMuc2FtcGxlLnN0b3AoKTtcbiAgICB9O1xuXG4gICAgdGhpcy50b2dnbGVMaXZlSW5wdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghcGVkYWxzLmxpbmUuaXNTdHJlYW1pbmcpIHtcbiAgICAgICAgICAgIHBlZGFscy5saW5lLmxvYWQoKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKCdsaW5laW46bG9hZGVkJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHBlZGFscy5saW5lLnN0cmVhbS5jb25uZWN0KGJvYXJkSW5wdXQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBwZWRhbHMubGluZS5pc1N0cmVhbWluZyA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWRhbHMubGluZS5zdG9wKCk7XG4gICAgICAgICAgICBwZWRhbHMubGluZS5pc1N0cmVhbWluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMuZ2V0UGVkYWwgPSBmdW5jdGlvbiAoZWZmZWN0KSB7XG4gICAgICByZXR1cm4gcGVkYWxzW2VmZmVjdF07XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdCb2FyZCcpXG4gICAgLnNlcnZpY2UoJ0JvYXJkJywgQm9hcmQpO1xuIiwiZnVuY3Rpb24gRmlsZUlucHV0IChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgRmlsZUlucHV0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc2FtcGxlID0gbnVsbDtcbiAgICB9O1xuXG4gICAgRmlsZUlucHV0LnByb3RvdHlwZS5sb2FkQnVmZmVyID0gZnVuY3Rpb24odXJsKSB7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgIHJlcXVlc3Qub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICAgICAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcblxuICAgICAgICB2YXIgbG9hZGVyID0gdGhpcztcblxuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc3RhZ2UuZGVjb2RlQXVkaW9EYXRhKFxuICAgICAgICAgICAgICAgIHJlcXVlc3QucmVzcG9uc2UsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oYnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghYnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbGVydCgnZXJyb3IgZGVjb2RpbmcgZmlsZSBkYXRhOiAnICsgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2FkZXIuc2FtcGxlID0gYnVmZmVyO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignZGVjb2RlQXVkaW9EYXRhIGVycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGFsZXJ0KCdCdWZmZXJMb2FkZXI6IFhIUiBlcnJvcicpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5zZW5kKCk7XG4gICAgfTtcblxuICAgIEZpbGVJbnB1dC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgRmlsZUlucHV0LnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc291cmNlID0gc3RhZ2UuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgICAgIHRoaXMuc291cmNlLmxvb3AgPSB0cnVlO1xuICAgICAgICB0aGlzLnNvdXJjZS5idWZmZXIgPSB0aGlzLnNhbXBsZTtcblxuICAgICAgICB0aGlzLnNvdXJjZS5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICB0aGlzLnNvdXJjZS5zdGFydCgwKTtcbiAgICB9O1xuXG5cbiAgICBGaWxlSW5wdXQucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zb3VyY2Uuc3RvcCgpO1xuICAgICAgICB0aGlzLnNvdXJjZS5kaXNjb25uZWN0KCk7XG4gICAgfTtcblxuICAgIHJldHVybiBGaWxlSW5wdXQ7XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0lucHV0JylcbiAgICAuZmFjdG9yeSgnRmlsZUlucHV0JywgRmlsZUlucHV0KTtcbiIsImZ1bmN0aW9uIGlucHV0Q29udHJvbHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL2NvbnRyb2xzLmh0bWwnLFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBzdGFydCA9IGFuZ3VsYXIuZWxlbWVudCgnLmdseXBoaWNvbi1wbGF5JyksXG4gICAgICAgICAgICAgICAgc3RvcCA9IGFuZ3VsYXIuZWxlbWVudCgnLmdseXBoaWNvbi1zdG9wJyksXG4gICAgICAgICAgICAgICAgbGl2ZUlucHV0ID0gYW5ndWxhci5lbGVtZW50KCcuZ2x5cGhpY29uLXJlY29yZCcpO1xuXG4gICAgICAgICAgICBzdGFydC5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIHN0b3AucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgc3RhcnQucHJvcCgnZGlzYWJsZWQnLCB0cnVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBzdG9wLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgc3RhcnQucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgc3RvcC5wcm9wKCdkaXNhYmxlZCcsIHRydWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGxpdmVJbnB1dC5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIGxpdmVJbnB1dC50b2dnbGVDbGFzcyhcImJ0bi1kYW5nZXJcIik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnSW5wdXQnKVxuICAgIC5kaXJlY3RpdmUoJ2lucHV0Q29udHJvbHMnLCBpbnB1dENvbnRyb2xzKTtcbiIsImZ1bmN0aW9uIExpbmVJbnB1dCgkcm9vdFNjb3BlLCBTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgTGluZUlucHV0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5zdHJlYW0gPSBudWxsO1xuICAgICAgICB0aGlzLmlzU3RyZWFtaW5nID0gZmFsc2U7XG4gICAgfTtcblxuICAgIExpbmVJbnB1dC5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoe1xuICAgICAgICAgICAgXCJhdWRpb1wiOiB7XG4gICAgICAgICAgICAgICAgXCJvcHRpb25hbFwiOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcImdvb2dFY2hvQ2FuY2VsbGF0aW9uXCI6IFwiZmFsc2VcIn0sXG4gICAgICAgICAgICAgICAgICAgIHtcImdvb2dBdXRvR2FpbkNvbnRyb2xcIjogXCJmYWxzZVwifSxcbiAgICAgICAgICAgICAgICAgICAge1wiZ29vZ05vaXNlU3VwcHJlc3Npb25cIjogXCJ0cnVlXCJ9LFxuICAgICAgICAgICAgICAgICAgICB7XCJnb29nSGlnaHBhc3NGaWx0ZXJcIjogXCJmYWxzZVwifVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24gKHN0cmVhbSkge1xuICAgICAgICAgICAgc2VsZi5zdHJlYW0gPSBzdGFnZS5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kZW1pdCgnbGluZWluOmxvYWRlZCcpO1xuICAgICAgICAgICAgdGhpcy5pc1N0cmVhbWluZyA9IHRydWU7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0d1aXRhciBzdHJlYW0gZmFpbGVkOiAnICsgZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIExpbmVJbnB1dC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgICAgICAgdGhpcy5zdHJlYW0uY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBMaW5lSW5wdXQucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3RyZWFtLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgdGhpcy5pc1N0cmVhbWluZyA9IGZhbHNlO1xuICAgIH07XG5cbiAgICByZXR1cm4gTGluZUlucHV0O1xufVxuXG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdJbnB1dCcpXG4gICAgLnNlcnZpY2UoJ0xpbmVJbnB1dCcsIExpbmVJbnB1dCk7XG4iLCJmdW5jdGlvbiBTaGFyZWRBdWRpb0NvbnRleHQgKCkge1xuXG4gICAgdmFyIFNoYXJlZEF1ZGlvQ29udGV4dCA9IHt9O1xuXG4gICAgU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRleHQgfHwgKHRoaXMuY29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQpO1xuICAgIH07XG5cbiAgICByZXR1cm4gU2hhcmVkQXVkaW9Db250ZXh0O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1NoYXJlZEF1ZGlvQ29udGV4dCcpXG4gICAgLmZhY3RvcnkoJ1NoYXJlZEF1ZGlvQ29udGV4dCcsIFNoYXJlZEF1ZGlvQ29udGV4dCk7XG4iLCJmdW5jdGlvbiBDYWJpbmV0IChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgQ2FiaW5ldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmlucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5ib29zdCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5jb252b2x2ZXIgPSBzdGFnZS5jcmVhdGVDb252b2x2ZXIoKTtcbiAgICB9O1xuXG4gICAgQ2FiaW5ldC5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKGlyUGF0aCkge1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsIGlyUGF0aCwgdHJ1ZSk7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcblxuICAgICAgICB2YXIgbG9hZGVyID0gdGhpcztcblxuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHN0YWdlLmRlY29kZUF1ZGlvRGF0YShyZXF1ZXN0LnJlc3BvbnNlLCBmdW5jdGlvbiAoYnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyLmNvbnZvbHZlci5idWZmZXIgPSBidWZmZXI7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgIGlmIChlKSBjb25zb2xlLmxvZyhcIkNhbm5vdCBsb2FkIGNhYmluZXRcIiArIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVxdWVzdC5zZW5kKG51bGwpO1xuXG4gICAgICAgIHRoaXMuaW5wdXQuZ2Fpbi52YWx1ZSA9IDM7XG4gICAgICAgIHRoaXMuYm9vc3QuZ2Fpbi52YWx1ZSA9IDE7XG5cbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMuY29udm9sdmVyKTtcbiAgICAgICAgdGhpcy5jb252b2x2ZXIuY29ubmVjdCh0aGlzLmJvb3N0KTtcbiAgICAgICAgdGhpcy5ib29zdC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgQ2FiaW5ldC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhYmluZXQ7XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZmFjdG9yeSgnQ2FiaW5ldCcsIENhYmluZXQpO1xuIiwiZnVuY3Rpb24gZGVsYXlQZWRhbCAoQm9hcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvZGVsYXkuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uICgkc2NvcGUsICRlbGVtZW50KSB7XG4gICAgICAgICAgICB2YXIgZGVsYXkgPSBCb2FyZC5nZXRQZWRhbCgnZGVsYXknKTtcblxuICAgICAgICAgICAgdmFyIHRpbWUgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI2RlbGF5LXRpbWUnKSxcbiAgICAgICAgICAgICAgICBmZWVkYmFjayA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZGVsYXktZmVlZGJhY2snKSxcbiAgICAgICAgICAgICAgICBmb290c3dpdGNoID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8tc3dpdGNoI2RlbGF5LWZvb3Qtc3cnKSxcbiAgICAgICAgICAgICAgICBsZWQgPSAkZWxlbWVudC5maW5kKCcubGVkJyk7XG5cbiAgICAgICAgICAgIHRpbWUub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBkZWxheS5zZXRUaW1lKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aW1lLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRpbWUudmFsKHBhcnNlRmxvYXQoMC41KSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZmVlZGJhY2sub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBkZWxheS5zZXRGZWVkYmFjayhlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZmVlZGJhY2sub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZmVlZGJhY2sudmFsKHBhcnNlRmxvYXQoMC43NSkpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZvb3Rzd2l0Y2gub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGxlZC50b2dnbGVDbGFzcygnYWN0aXZlJyk7XG4gICAgICAgICAgICAgICAgZGVsYXkuYnlwYXNzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5kaXJlY3RpdmUoJ2RlbGF5UGVkYWwnLCBkZWxheVBlZGFsKTtcbiIsImZ1bmN0aW9uIERlbGF5IChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgZGVsYXkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5pbnB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuZmVlZGJhY2sgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuZGVsYXkgPSBzdGFnZS5jcmVhdGVEZWxheSgpO1xuICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgIH07XG5cbiAgICBkZWxheS5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmRlbGF5LmRlbGF5VGltZS52YWx1ZSA9IHBhcnNlRmxvYXQoIDAuNSApO1xuICAgICAgICB0aGlzLmZlZWRiYWNrLmdhaW4udmFsdWUgPSBwYXJzZUZsb2F0KCAwLjc1ICk7XG5cbiAgICAgICAgdGhpcy5mZWVkYmFjay5jb25uZWN0KCB0aGlzLmRlbGF5ICk7XG4gICAgICAgIHRoaXMuZGVsYXkuY29ubmVjdCggdGhpcy5mZWVkYmFjayApO1xuXG4gICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLm91dHB1dCk7XG4gICAgfTtcblxuICAgIGRlbGF5LnByb3RvdHlwZS5zZXRUaW1lID0gZnVuY3Rpb24odGltZSkge1xuICAgICAgICB0aGlzLmRlbGF5LmRlbGF5VGltZS52YWx1ZSA9IHBhcnNlRmxvYXQodGltZSk7XG4gICAgfTtcblxuICAgIGRlbGF5LnByb3RvdHlwZS5zZXRGZWVkYmFjayA9IGZ1bmN0aW9uKGZlZWRiYWNrKSB7XG4gICAgICAgIHRoaXMuZmVlZGJhY2suZ2Fpbi52YWx1ZSA9IHBhcnNlRmxvYXQoZmVlZGJhY2spO1xuICAgIH07XG5cbiAgICBkZWxheS5wcm90b3R5cGUuYnlwYXNzID0gZnVuY3Rpb24oKXtcbiAgICAgICAgaWYodGhpcy5pc0J5cGFzc2VkKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLmZlZWRiYWNrKTtcbiAgICAgICAgICAgIHRoaXMuZGVsYXkuY29ubmVjdCh0aGlzLmZlZWRiYWNrKTtcbiAgICAgICAgICAgIHRoaXMuZGVsYXkuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmRlbGF5LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZGVsYXkucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbih0YXJnZXQpe1xuICAgICAgICB0aGlzLm91dHB1dC5jb25uZWN0KHRhcmdldCk7XG4gICAgfTtcblxuICAgIHJldHVybiBkZWxheTtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdEZWxheScsIERlbGF5KTtcbiIsImZ1bmN0aW9uIGRpc3RvcnRpb25QZWRhbCAoQm9hcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvZGlzdG9ydGlvbi5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IE1JRF9MRVZFTCA9IDUuNTtcbiAgICAgICAgICAgIHZhciBkaXN0b3J0aW9uID0gQm9hcmQuZ2V0UGVkYWwoJ2Rpc3RvcnRpb24nKTtcblxuICAgICAgICAgICAgdmFyIHZvbHVtZSA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZGlzdG9ydGlvbi12b2x1bWUnKSxcbiAgICAgICAgICAgICAgICB0b25lID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNkaXN0b3J0aW9uLXRvbmUnKSxcbiAgICAgICAgICAgICAgICBmb290c3dpdGNoID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8tc3dpdGNoI2Rpc3RvcnRpb24tZm9vdC1zdycpLFxuICAgICAgICAgICAgICAgIGxlZCA9ICRlbGVtZW50LmZpbmQoJy5sZWQnKTtcblxuICAgICAgICAgICAgdm9sdW1lLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZGlzdG9ydGlvbi5zZXRWb2x1bWUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2b2x1bWUudmFsKE1JRF9MRVZFTCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdG9uZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGRpc3RvcnRpb24uc2V0VG9uZShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdG9uZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB0b25lLnZhbChNSURfTEVWRUwpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZvb3Rzd2l0Y2gub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGxlZC50b2dnbGVDbGFzcygnYWN0aXZlJyk7XG4gICAgICAgICAgICAgICAgZGlzdG9ydGlvbi5ieXBhc3MoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdQZWRhbCcpXG4gICAgLmRpcmVjdGl2ZSgnZGlzdG9ydGlvblBlZGFsJywgZGlzdG9ydGlvblBlZGFsKTtcbiIsImZ1bmN0aW9uIERpc3RvcnRpb24gKFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuXG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKTtcblxuICAgIHZhciBEaXN0b3J0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmdhaW4gPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlciA9IHN0YWdlLmNyZWF0ZVdhdmVTaGFwZXIoKTtcbiAgICAgICAgdGhpcy5sb3dwYXNzID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5ib29zdCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmN1dCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLnZvbHVtZSA9IDcuNTtcbiAgICAgICAgdGhpcy50b25lID0gMjA7XG4gICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbih0eXBlKSB7XG5cbiAgICAgICAgdGhpcy5nYWluLmdhaW4udmFsdWUgPSB0aGlzLnZvbHVtZTtcblxuICAgICAgICB0aGlzLmxvd3Bhc3MudHlwZSA9IFwibG93cGFzc1wiO1xuICAgICAgICB0aGlzLmxvd3Bhc3MuZnJlcXVlbmN5LnZhbHVlID0gNTAwMDtcblxuICAgICAgICB0aGlzLmJvb3N0LnR5cGUgPSBcImxvd3NoZWxmXCI7XG4gICAgICAgIHRoaXMuYm9vc3QuZnJlcXVlbmN5LnZhbHVlID0gMTAwO1xuICAgICAgICB0aGlzLmJvb3N0LmdhaW4udmFsdWUgPSA2O1xuXG4gICAgICAgIHRoaXMuY3V0LnR5cGUgPSBcImxvd3NoZWxmXCI7XG4gICAgICAgIHRoaXMuY3V0LmZyZXF1ZW5jeS52YWx1ZSA9IDEwMDtcbiAgICAgICAgdGhpcy5jdXQuZ2Fpbi52YWx1ZSA9IC02O1xuXG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5jdXJ2ZSA9IHRoaXMubWFrZURpc3RvcnRpb25DdXJ2ZSgxMCwgdHlwZSk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5vdmVyc2FtcGxlID0gJzR4JztcblxuICAgICAgICB0aGlzLmhpZ2hwYXNzLnR5cGUgPSBcImhpZ2hwYXNzXCI7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MuZnJlcXVlbmN5LnZhbHVlID0gdGhpcy50b25lO1xuXG4gICAgICAgIHRoaXMuZ2Fpbi5jb25uZWN0KHRoaXMubG93cGFzcylcbiAgICAgICAgdGhpcy5sb3dwYXNzLmNvbm5lY3QodGhpcy5ib29zdCk7XG4gICAgICAgIHRoaXMuYm9vc3QuY29ubmVjdCh0aGlzLndhdmVzaGFwZXIpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIuY29ubmVjdCh0aGlzLmN1dCk7XG4gICAgICAgIHRoaXMuY3V0LmNvbm5lY3QodGhpcy5oaWdocGFzcyk7XG5cbiAgICAgICAgLy9ieXBhc3MgYnkgZGVmYXVsdFxuICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5tYWtlRGlzdG9ydGlvbkN1cnZlID0gZnVuY3Rpb24gKGFtb3VudCwgdHlwZSkge1xuICAgICAgICB2YXIgayA9IHR5cGVvZiBhbW91bnQgPT09ICdudW1iZXInID8gYW1vdW50IDogMTAsXG4gICAgICAgICAgICBzYW1wbGVzID0gMTEwMjUsXG4gICAgICAgICAgICBjdXJ2ZSA9IG5ldyBGbG9hdDMyQXJyYXkoc2FtcGxlcyk7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzYW1wbGVzOyArK2kpIHtcbiAgICAgICAgICAgIGN1cnZlW2ldID0gdGhpcy5jdXJ2ZUFsZ29yaXRobShpICogMiAvIHNhbXBsZXMgLSAxLCB0eXBlLCBrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjdXJ2ZTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuY3VydmVBbGdvcml0aG0gPSBmdW5jdGlvbiAoeCwgdHlwZSwgaykge1xuICAgICAgICBzd2l0Y2godHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnZGlzdDEnOlxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgtMC41LCBNYXRoLm1pbigwLjUsIHggKiBrKSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0Mic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCB4ICogaykpO1xuICAgICAgICAgICAgY2FzZSAnZGlzdDMnOlxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgtMC41LCBNYXRoLm1pbigxLjUsIHggKSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0NCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIDIuOCAqIE1hdGgucG93KHgsIDMpICsgTWF0aC5wb3coeCwyKSArIC0xLjEgKiB4IC0gMC41O1xuICAgICAgICAgICAgY2FzZSAnZGlzdDUnOlxuICAgICAgICAgICAgICAgIHJldHVybiAoTWF0aC5leHAoeCkgLSBNYXRoLmV4cCgteCAqIDEuMikpIC8gKE1hdGguZXhwKHgpICsgTWF0aC5leHAoLXgpKTtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3Q2JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50YW5oKHgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLnRhbmggPSBmdW5jdGlvbiAoeCkge1xuICAgICAgICBpZiAoeCA9PT0gSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2UgaWYgKHggPT09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIChNYXRoLmV4cCh4KSAtIE1hdGguZXhwKC14KSkgLyAoTWF0aC5leHAoeCkgKyBNYXRoLmV4cCgteCkpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLnNpZ24gPSBmdW5jdGlvbiAoeCkge1xuICAgICAgICB4ID0gK3g7IC8vIGNvbnZlcnQgdG8gYSBudW1iZXJcbiAgICAgICAgaWYgKHggPT09IDAgfHwgaXNOYU4oeCkpXG4gICAgICAgICAgICByZXR1cm4geDtcbiAgICAgICAgcmV0dXJuIHggPiAwID8gMSA6IC0xO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5ieXBhc3MgPSBmdW5jdGlvbigpe1xuICAgICAgICBpZih0aGlzLmlzQnlwYXNzZWQpIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMuZ2Fpbik7XG4gICAgICAgICAgICB0aGlzLmhpZ2hwYXNzLmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy5oaWdocGFzcy5kaXNjb25uZWN0KCk7XG5cbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuc2V0Vm9sdW1lID0gZnVuY3Rpb24odm9sdW1lKSB7XG4gICAgICAgIHRoaXMuZ2Fpbi5nYWluLnZhbHVlID0gMS41ICogdm9sdW1lO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5zZXRUb25lID0gZnVuY3Rpb24odG9uZSkge1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IDIwICogdG9uZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERpc3RvcnRpb247XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZmFjdG9yeSgnRGlzdG9ydGlvbicsIERpc3RvcnRpb24pO1xuIiwiZnVuY3Rpb24gZmxhbmdlclBlZGFsIChCb2FyZCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ3RlbXBsYXRlcy9mbGFuZ2VyLmh0bWwnLFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoJHNjb3BlLCAkZWxlbWVudCkge1xuICAgICAgICAgICAgdmFyIGZsYW5nZXIgPSBCb2FyZC5nZXRQZWRhbCgnZmxhbmdlcicpO1xuXG4gICAgICAgICAgICB2YXIgc3BlZWQgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI2ZsYW5nZXItc3BlZWQnKSxcbiAgICAgICAgICAgICAgICBkZWxheSA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZmxhbmdlci1kZWxheScpLFxuICAgICAgICAgICAgICAgIGRlcHRoID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNmbGFuZ2VyLWRlcHRoJyksXG4gICAgICAgICAgICAgICAgZmVlZGJhY2sgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI2ZsYW5nZXItZmVlZGJhY2snKSxcbiAgICAgICAgICAgICAgICBmb290c3dpdGNoID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8tc3dpdGNoI2ZsYW5nZXItZm9vdC1zdycpLFxuICAgICAgICAgICAgICAgIGxlZCA9ICRlbGVtZW50LmZpbmQoJy5sZWQnKTtcblxuICAgICAgICAgICAgc3BlZWQub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBmbGFuZ2VyLnNldFNwZWVkKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBzcGVlZC5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBzcGVlZC52YWwocGFyc2VGbG9hdCgwLjcwKSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZGVsYXkub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBmbGFuZ2VyLnNldERlbGF5KGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZWxheS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBkZWxheS52YWwocGFyc2VGbG9hdCgwLjAwMykpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRlcHRoLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZmxhbmdlci5zZXREZXB0aChlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZGVwdGgub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZGVwdGgudmFsKHBhcnNlRmxvYXQoMC4wMDEzKSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZmVlZGJhY2sub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBmbGFuZ2VyLnNldEZlZWRiYWNrKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmZWVkYmFjay5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBmZWVkYmFjay52YWwocGFyc2VGbG9hdCgwLjQpKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmb290c3dpdGNoLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBsZWQudG9nZ2xlQ2xhc3MoJ2FjdGl2ZScpO1xuICAgICAgICAgICAgICAgIGZsYW5nZXIuYnlwYXNzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5kaXJlY3RpdmUoJ2ZsYW5nZXJQZWRhbCcsIGZsYW5nZXJQZWRhbCk7XG4iLCJmdW5jdGlvbiBGbGFuZ2VyIChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgRmxhbmdlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmlucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy53ZXRnYWluID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmZlZWRiYWNrID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmRlcHRoID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm9zYyA9IHN0YWdlLmNyZWF0ZU9zY2lsbGF0b3IoKTtcbiAgICAgICAgdGhpcy5kZWxheSA9IHN0YWdlLmNyZWF0ZURlbGF5KCk7XG4gICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgfTtcblxuICAgIEZsYW5nZXIucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5vc2MudHlwZSA9ICdzaW5lJztcbiAgICAgICAgdGhpcy5vc2MuZnJlcXVlbmN5LnZhbHVlID0gcGFyc2VGbG9hdCggMC43ICk7XG5cbiAgICAgICAgdGhpcy5kZWxheS5kZWxheVRpbWUudmFsdWUgPSBwYXJzZUZsb2F0KCAwLjAwMyApO1xuXG4gICAgICAgIHRoaXMuZGVwdGguZ2Fpbi52YWx1ZSA9IHBhcnNlRmxvYXQoIDAuMDAxMyApO1xuXG4gICAgICAgIHRoaXMuZmVlZGJhY2suZ2Fpbi52YWx1ZSA9IHBhcnNlRmxvYXQoIDAuNDAgKTtcblxuICAgICAgICB0aGlzLm9zYy5jb25uZWN0KHRoaXMuZGVwdGgpO1xuICAgICAgICB0aGlzLmRlcHRoLmNvbm5lY3QodGhpcy5kZWxheS5kZWxheVRpbWUpO1xuXG4gICAgICAgIHRoaXMuZGVsYXkuY29ubmVjdCggdGhpcy53ZXRnYWluICk7XG4gICAgICAgIHRoaXMuZGVsYXkuY29ubmVjdCggdGhpcy5mZWVkYmFjayApO1xuICAgICAgICB0aGlzLmZlZWRiYWNrLmNvbm5lY3QoIHRoaXMuaW5wdXQgKTtcblxuICAgICAgICB0aGlzLm9zYy5zdGFydCgwKTtcblxuICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5zZXRTcGVlZCA9IGZ1bmN0aW9uKHNwZWVkKSB7XG4gICAgICAgIHRoaXMub3NjLmZyZXF1ZW5jeS52YWx1ZSA9IHBhcnNlRmxvYXQoc3BlZWQpO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5zZXREZWxheSA9IGZ1bmN0aW9uKGRlbGF5KSB7XG4gICAgICAgIHRoaXMuZGVsYXkuZGVsYXlUaW1lLnZhbHVlID0gcGFyc2VGbG9hdChkZWxheSk7XG4gICAgfTtcblxuICAgIEZsYW5nZXIucHJvdG90eXBlLnNldERlcHRoID0gZnVuY3Rpb24oZGVwdGgpIHtcbiAgICAgICAgdGhpcy5kZXB0aC5nYWluLnZhbHVlID0gcGFyc2VGbG9hdChkZXB0aCk7XG4gICAgfTtcblxuICAgIEZsYW5nZXIucHJvdG90eXBlLnNldEZlZWRiYWNrID0gZnVuY3Rpb24oZmVlZGJhY2spIHtcbiAgICAgICAgdGhpcy5mZWVkYmFjay5nYWluLnZhbHVlID0gcGFyc2VGbG9hdChmZWVkYmFjayk7XG4gICAgfTtcblxuICAgIEZsYW5nZXIucHJvdG90eXBlLmJ5cGFzcyA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIGlmKHRoaXMuaXNCeXBhc3NlZCkge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy53ZXRnYWluKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCggdGhpcy5kZWxheSk7XG4gICAgICAgICAgICB0aGlzLndldGdhaW4uY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLndldGdhaW4uZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICByZXR1cm4gRmxhbmdlcjtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdGbGFuZ2VyJywgRmxhbmdlcik7XG4iLCJmdW5jdGlvbiBvdmVyZHJpdmVQZWRhbCAoQm9hcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvb3ZlcmRyaXZlLmh0bWwnLFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoJHNjb3BlLCAkZWxlbWVudCkge1xuICAgICAgICAgICAgY29uc3QgTUlEX0xFVkVMID0gNS41O1xuICAgICAgICAgICAgdmFyIG92ZXJkcml2ZSA9IEJvYXJkLmdldFBlZGFsKCdvdmVyZHJpdmUnKTtcblxuICAgICAgICAgICAgdmFyIHZvbHVtZSA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2Ijb3ZlcmRyaXZlLXZvbHVtZScpLFxuICAgICAgICAgICAgICAgIHRvbmUgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI292ZXJkcml2ZS10b25lJyksXG4gICAgICAgICAgICAgICAgZm9vdHN3aXRjaCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLXN3aXRjaCNvdmVyZHJpdmUtZm9vdC1zdycpLFxuICAgICAgICAgICAgICAgIGxlZCA9ICRlbGVtZW50LmZpbmQoJy5sZWQnKTtcblxuICAgICAgICAgICAgdm9sdW1lLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgb3ZlcmRyaXZlLnNldFZvbHVtZShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdm9sdW1lLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZvbHVtZS52YWwoTUlEX0xFVkVMKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0b25lLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgb3ZlcmRyaXZlLnNldFRvbmUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRvbmUub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdG9uZS52YWwoTUlEX0xFVkVMKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmb290c3dpdGNoLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBsZWQudG9nZ2xlQ2xhc3MoJ2FjdGl2ZScpO1xuICAgICAgICAgICAgICAgIG92ZXJkcml2ZS5ieXBhc3MoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdQZWRhbCcpXG4gICAgLmRpcmVjdGl2ZSgnb3ZlcmRyaXZlUGVkYWwnLCBvdmVyZHJpdmVQZWRhbCk7XG4iLCJmdW5jdGlvbiBPdmVyZHJpdmUgKFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuXG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKTtcblxuICAgIHZhciBPdmVyZHJpdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5pbnB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuZ2FpbiA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy53YXZlc2hhcGVyID0gc3RhZ2UuY3JlYXRlV2F2ZVNoYXBlcigpO1xuICAgICAgICB0aGlzLmxvd3Bhc3MgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5oaWdocGFzcyA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmJvb3N0ID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuY3V0ID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMudm9sdW1lID0gNy41O1xuICAgICAgICB0aGlzLnRvbmUgPSAyMDtcbiAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gdHJ1ZTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24odHlwZSkge1xuXG4gICAgICAgIHRoaXMuZ2Fpbi5nYWluLnZhbHVlID0gdGhpcy52b2x1bWU7XG5cbiAgICAgICAgdGhpcy5sb3dwYXNzLnR5cGUgPSBcImxvd3Bhc3NcIjtcbiAgICAgICAgdGhpcy5sb3dwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IDUwMDA7XG5cbiAgICAgICAgdGhpcy5ib29zdC50eXBlID0gXCJsb3dzaGVsZlwiO1xuICAgICAgICB0aGlzLmJvb3N0LmZyZXF1ZW5jeS52YWx1ZSA9IDEwMDtcbiAgICAgICAgdGhpcy5ib29zdC5nYWluLnZhbHVlID0gNjtcblxuICAgICAgICB0aGlzLmN1dC50eXBlID0gXCJsb3dzaGVsZlwiO1xuICAgICAgICB0aGlzLmN1dC5mcmVxdWVuY3kudmFsdWUgPSAxMDA7XG4gICAgICAgIHRoaXMuY3V0LmdhaW4udmFsdWUgPSAtNjtcblxuICAgICAgICB0aGlzLndhdmVzaGFwZXIuY3VydmUgPSB0aGlzLm1ha2VPdmVyZHJpdmVDdXJ2ZSgxMCwgdHlwZSk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5vdmVyc2FtcGxlID0gJzR4JztcblxuICAgICAgICB0aGlzLmhpZ2hwYXNzLnR5cGUgPSBcImhpZ2hwYXNzXCI7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MuZnJlcXVlbmN5LnZhbHVlID0gdGhpcy50b25lO1xuXG4gICAgICAgIHRoaXMuZ2Fpbi5jb25uZWN0KHRoaXMubG93cGFzcylcbiAgICAgICAgdGhpcy5sb3dwYXNzLmNvbm5lY3QodGhpcy5ib29zdCk7XG4gICAgICAgIHRoaXMuYm9vc3QuY29ubmVjdCh0aGlzLndhdmVzaGFwZXIpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIuY29ubmVjdCh0aGlzLmN1dCk7XG4gICAgICAgIHRoaXMuY3V0LmNvbm5lY3QodGhpcy5oaWdocGFzcyk7XG5cbiAgICAgICAgLy9ieXBhc3MgYnkgZGVmYXVsdFxuICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLm1ha2VPdmVyZHJpdmVDdXJ2ZSA9IGZ1bmN0aW9uIChhbW91bnQsIHR5cGUpIHtcbiAgICAgICAgdmFyIGsgPSB0eXBlb2YgYW1vdW50ID09PSAnbnVtYmVyJyA/IGFtb3VudCA6IDEwLFxuICAgICAgICAgICAgc2FtcGxlcyA9IDExMDI1LFxuICAgICAgICAgICAgY3VydmUgPSBuZXcgRmxvYXQzMkFycmF5KHNhbXBsZXMpO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2FtcGxlczsgKytpKSB7XG4gICAgICAgICAgICBjdXJ2ZVtpXSA9IHRoaXMuY3VydmVBbGdvcml0aG0oaSAqIDIgLyBzYW1wbGVzIC0gMSwgdHlwZSwgayk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3VydmU7XG4gICAgfTtcblxuICAgIE92ZXJkcml2ZS5wcm90b3R5cGUuY3VydmVBbGdvcml0aG0gPSBmdW5jdGlvbiAoeCwgdHlwZSwgaykge1xuICAgICAgICBzd2l0Y2godHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnb3ZlcmRyaXZlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gKDEgKyBrKSAqIHggLyAoMSArIGsgKiBNYXRoLmFicyh4KSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS50YW5oID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgaWYgKHggPT09IEluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIGlmICh4ID09PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAoTWF0aC5leHAoeCkgLSBNYXRoLmV4cCgteCkpIC8gKE1hdGguZXhwKHgpICsgTWF0aC5leHAoLXgpKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLnNpZ24gPSBmdW5jdGlvbiAoeCkge1xuICAgICAgICB4ID0gK3g7IC8vIGNvbnZlcnQgdG8gYSBudW1iZXJcbiAgICAgICAgaWYgKHggPT09IDAgfHwgaXNOYU4oeCkpXG4gICAgICAgICAgICByZXR1cm4geDtcbiAgICAgICAgcmV0dXJuIHggPiAwID8gMSA6IC0xO1xuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbih0YXJnZXQpe1xuICAgICAgICB0aGlzLm91dHB1dC5jb25uZWN0KHRhcmdldCk7XG4gICAgfTtcblxuICAgIE92ZXJkcml2ZS5wcm90b3R5cGUuYnlwYXNzID0gZnVuY3Rpb24oKXtcbiAgICAgICAgaWYodGhpcy5pc0J5cGFzc2VkKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLmdhaW4pO1xuICAgICAgICAgICAgdGhpcy5oaWdocGFzcy5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaGlnaHBhc3MuZGlzY29ubmVjdCgpO1xuXG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIE92ZXJkcml2ZS5wcm90b3R5cGUuc2V0Vm9sdW1lID0gZnVuY3Rpb24odm9sdW1lKSB7XG4gICAgICAgIHRoaXMuZ2Fpbi5nYWluLnZhbHVlID0gMS41ICogdm9sdW1lO1xuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLnNldFRvbmUgPSBmdW5jdGlvbih0b25lKSB7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MuZnJlcXVlbmN5LnZhbHVlID0gMjAgKiB0b25lO1xuICAgIH07XG5cbiAgICByZXR1cm4gT3ZlcmRyaXZlO1xufVxuXG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdQZWRhbCcpXG4gICAgLmZhY3RvcnkoJ092ZXJkcml2ZScsIE92ZXJkcml2ZSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=