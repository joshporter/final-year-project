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

function Board($rootScope, FileInput, LineInput, Cabinet, Distortion, Overdrive, Flanger, Chorus, Delay, SharedAudioContext) {
    var stage = SharedAudioContext.getContext(),
        boardInput = stage.createGain();

    var pedals = {
        sample: new FileInput(),
        line: new LineInput(),
        cabinet: new Cabinet(),
        distortion: new Distortion(),
        overdrive: new Overdrive(),
        flanger: new Flanger(),
        chorus: new Chorus(),
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
        pedals.sample.loadBuffer(samples[2]);
        pedals.sample.connect(boardInput);
    };

    this.loadPedals = function () {
        pedals.cabinet.load('assets/ir/5150.wav');
        pedals.distortion.load('dist3');
        pedals.overdrive.load('overdrive');
        pedals.flanger.load();
        pedals.chorus.load();
        pedals.delay.load();
    };

    this.wireUpBoard = function () {
        boardInput.connect(pedals.distortion.input);
        pedals.distortion.connect(pedals.overdrive.input);
        pedals.overdrive.connect(pedals.flanger.input);
        pedals.flanger.connect(pedals.chorus.input);
        pedals.chorus.connect(pedals.delay.input);
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
Board.$inject = ["$rootScope", "FileInput", "LineInput", "Cabinet", "Distortion", "Overdrive", "Flanger", "Chorus", "Delay", "SharedAudioContext"];
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
chorusPedal.$inject = ["Board"];
angular
    .module('Pedal')
    .directive('chorusPedal', chorusPedal);

function Chorus (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var Chorus = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.depth = stage.createGain();
        this.osc = stage.createOscillator();
        this.delay = stage.createDelay();
        this.isBypassed = true;
    };

    Chorus.prototype.load = function() {
        this.osc.type = 'sine';
        this.osc.frequency.value = parseFloat( 3.5 );

        this.delay.delayTime.value = parseFloat( 0.03 );

        this.depth.gain.value = parseFloat( 0.002 );

        this.osc.connect(this.depth);
        this.depth.connect(this.delay.delayTime);

        this.delay.connect(this.output);

        this.osc.start(0);

        this.input.connect(this.output);
    };

    Chorus.prototype.setRate = function(speed) {
        this.osc.frequency.value = parseFloat(speed);
    };

    Chorus.prototype.setDelay = function(delay) {
        this.delay.delayTime.value = parseFloat(delay);
    };

    Chorus.prototype.setDepth = function(depth) {
        this.depth.gain.value = parseFloat(depth);
    };

    Chorus.prototype.bypass = function(){
        if(this.isBypassed) {
            this.input.disconnect();
            this.input.connect(this.delay);
            this.input.connect(this.output);

            this.isBypassed = false;
        } else {
            this.input.disconnect();
            this.input.connect(this.output);

            this.isBypassed = true;
        }
    };

    Chorus.prototype.connect = function(target){
        this.output.connect(target);
    };

    return Chorus;
}
Chorus.$inject = ["SharedAudioContext"];


angular
    .module('Pedal')
    .factory('Chorus', Chorus);

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

        this.delay.connect( this.feedback );
        this.feedback.connect( this.delay );

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
            this.input.connect(this.output);
            this.input.connect(this.delay);
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZHVsZS5qcyIsImJvYXJkL21vZHVsZS5qcyIsImlucHV0L21vZHVsZS5qcyIsInBlZGFsL21vZHVsZS5qcyIsInV0aWxzL21vZHVsZS5qcyIsImNvbmZpZy5qcyIsImJvYXJkL2JvYXJkLmN0cmwuanMiLCJib2FyZC9ib2FyZC5zdmMuanMiLCJpbnB1dC9maWxlX2lucHV0LnN2Yy5qcyIsImlucHV0L2lucHV0X2NvbnRyb2xzLmRpcmVjdGl2ZS5qcyIsImlucHV0L2xpbmVfaW5wdXQuc3ZjLmpzIiwidXRpbHMvc2hhcmVkX2F1ZGlvX2NvbnRleHQuZmFjdG9yeS5qcyIsInBlZGFsL2NhYmluZXQvcGVkYWxfY2FiaW5ldC5zdmMuanMiLCJwZWRhbC9jaG9ydXMvY2hvcnVzX3BlZGFsLmRpcmVjdGl2ZS5qcyIsInBlZGFsL2Nob3J1cy9wZWRhbF9jaG9ydXMuc3ZjLmpzIiwicGVkYWwvZGVsYXkvZGVsYXlfcGVkYWwuZGlyZWN0aXZlLmpzIiwicGVkYWwvZGVsYXkvcGVkYWxfZGVsYXkuc3ZjLmpzIiwicGVkYWwvZGlzdG9ydGlvbi9kaXN0b3J0aW9uX3BlZGFsLmRpcmVjdGl2ZS5qcyIsInBlZGFsL2Rpc3RvcnRpb24vcGVkYWxfZGlzdG9ydGlvbi5zdmMuanMiLCJwZWRhbC9mbGFuZ2VyL2ZsYW5nZXJfcGVkYWwuZGlyZWN0aXZlLmpzIiwicGVkYWwvZmxhbmdlci9wZWRhbF9mbGFuZ2VyLnN2Yy5qcyIsInBlZGFsL292ZXJkcml2ZS9vdmVyZHJpdmVfcGVkYWwuZGlyZWN0aXZlLmpzIiwicGVkYWwvb3ZlcmRyaXZlL3BlZGFsX292ZXJkcml2ZS5zdmMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7SUFDQTtJQUNBO0FBQ0E7O0FDSEE7SUFDQTtJQUNBO0lBQ0E7QUFDQTs7QUNKQTs7QUFFQTtJQUNBO0FBQ0E7O0FDSkE7SUFDQTtBQUNBOztBQ0ZBOztBQUVBOztBQ0ZBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO1FBQ0E7WUFDQTtZQUNBLGFBQUEsU0FBQTtZQUNBO1FBQ0E7QUFDQSxDQUFBOzs7QUFFQTtJQUNBO0lBQ0E7QUNmQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7QUFFQSxDQUFBOzs7QUFFQTtJQUNBO0lBQ0EsYUFBQSxTQUFBOztBQ3ZCQTtJQUNBO1FBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO2dCQUNBO1lBQ0E7WUFDQTtRQUNBO1lBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7TUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsVUFBQSxLQUFBOztBQzNFQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBOztRQUVBOztRQUVBO1lBQ0E7Z0JBQ0E7Z0JBQ0E7b0JBQ0E7d0JBQ0E7d0JBQ0E7b0JBQ0E7b0JBQ0E7Z0JBQ0E7Z0JBQ0E7b0JBQ0E7Z0JBQ0E7WUFDQTtRQUNBOztRQUVBO1lBQ0E7UUFDQTs7UUFFQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTs7UUFFQTtJQUNBOzs7SUFHQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxTQUFBOztBQ2xFQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7Z0JBQ0E7Z0JBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0E7QUFDQTtJQUNBO0lBQ0EsWUFBQSxhQUFBOztBQzNCQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7O1FBRUE7WUFDQTtnQkFDQTtvQkFDQTtvQkFDQTtvQkFDQTtvQkFDQTtnQkFDQTtZQUNBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsU0FBQTs7QUM5Q0E7O0lBRUE7O0lBRUE7UUFDQTtJQUNBOztJQUVBO0FBQ0E7QUFDQTtJQUNBO0lBQ0EsVUFBQSxrQkFBQTs7QUNaQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7O1FBRUE7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7UUFDQTs7UUFFQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxPQUFBOztBQzlDQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7OztZQUdBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxXQUFBOztBQy9DQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTs7UUFFQTs7UUFFQTs7UUFFQTtRQUNBOztRQUVBOztRQUVBOztRQUVBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7WUFDQTs7WUFFQTtRQUNBO1lBQ0E7WUFDQTs7WUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO0FBQ0EsQ0FBQTs7OztBQUdBO0lBQ0E7SUFDQSxVQUFBLE1BQUE7O0FDcEVBO0lBQ0E7UUFDQTtRQUNBO1FBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtnQkFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxVQUFBOztBQ3JDQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBOztZQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7O1lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxLQUFBOztBQ3pEQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtnQkFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxlQUFBOztBQ3RDQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTs7UUFFQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBOztRQUVBO1lBQ0E7UUFDQTs7UUFFQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7O1lBRUE7UUFDQTtZQUNBO1lBQ0E7O1lBRUE7O1lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsVUFBQTs7QUNsSUE7SUFDQTtRQUNBO1FBQ0E7UUFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO2dCQUNBO2dCQUNBO2dCQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBO1FBQ0E7SUFDQTtBQUNBLENBQUE7O0FBQ0E7SUFDQTtJQUNBLFlBQUEsWUFBQTs7QUN2REE7O0lBRUE7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBOztRQUVBOztRQUVBOztRQUVBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBOztRQUVBOztRQUVBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTs7WUFFQTtRQUNBO1lBQ0E7WUFDQTtZQUNBOztZQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsT0FBQTs7QUNoRkE7SUFDQTtRQUNBO1FBQ0E7UUFDQTtZQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBO1FBQ0E7SUFDQTtBQUNBLENBQUE7O0FBQ0E7SUFDQTtJQUNBLFlBQUEsY0FBQTs7QUN0Q0E7O0lBRUE7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7O1FBRUE7O1FBRUE7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBOztRQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7WUFDQTs7UUFFQTtZQUNBO1FBQ0E7O1FBRUE7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7Z0JBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7O1lBRUE7UUFDQTtZQUNBO1lBQ0E7O1lBRUE7O1lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsU0FBQSIsImZpbGUiOiJhcHAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJhbmd1bGFyLm1vZHVsZSgnR3RyUGVkYWxzJywgW1xuICAgICduZ1JvdXRlJyxcbiAgICAnQm9hcmQnXG5dKTtcbiIsImFuZ3VsYXIubW9kdWxlKCdCb2FyZCcsIFtcbiAgICAnSW5wdXQnLFxuICAgICdQZWRhbCcsXG4gICAgJ1NoYXJlZEF1ZGlvQ29udGV4dCdcbl0pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5hbmd1bGFyLm1vZHVsZSgnSW5wdXQnLCBbXG4gICAgJ1NoYXJlZEF1ZGlvQ29udGV4dCdcbl0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ1BlZGFsJywgW1xuICAgICdTaGFyZWRBdWRpb0NvbnRleHQnXG5dKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuYW5ndWxhci5tb2R1bGUoJ1NoYXJlZEF1ZGlvQ29udGV4dCcsIFtdKTtcbiIsImZ1bmN0aW9uIGNvbmZpZygkcm91dGVQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhID0gbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhO1xuICAgIHdpbmRvdy5BdWRpb0NvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQ7XG5cbiAgICAkbG9jYXRpb25Qcm92aWRlci5odG1sNU1vZGUodHJ1ZSk7XG4gICAgJHJvdXRlUHJvdmlkZXJcbiAgICAgICAgLndoZW4oJy8nLCB7XG4gICAgICAgICAgICB0ZW1wbGF0ZVVybDogJy90ZW1wbGF0ZXMvYm9hcmQuaHRtbCcsXG4gICAgICAgICAgICBjb250cm9sbGVyOiAnQm9hcmRDdHJsJyxcbiAgICAgICAgICAgIGNvbnRyb2xsZXJBczogJ3ZtJ1xuICAgICAgICB9KTtcbn1cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0d0clBlZGFscycpXG4gICAgLmNvbmZpZyhjb25maWcpOyIsImZ1bmN0aW9uIEJvYXJkQ3RybCAoQm9hcmQpIHtcbiAgICB2YXIgdm0gPSB0aGlzO1xuXG4gICAgQm9hcmQubG9hZFNvdXJjZSgpO1xuICAgIEJvYXJkLmxvYWRQZWRhbHMoKTtcbiAgICBCb2FyZC53aXJlVXBCb2FyZCgpO1xuXG4gICAgdm0ucGxheSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBCb2FyZC5wbGF5U2FtcGxlKCk7XG4gICAgfTtcblxuICAgIHZtLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgQm9hcmQuc3RvcFNhbXBsZSgpO1xuICAgIH07XG5cbiAgICB2bS5saXZlSW5wdXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgQm9hcmQudG9nZ2xlTGl2ZUlucHV0KCk7XG4gICAgfVxuXG59XG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdCb2FyZCcpXG4gICAgLmNvbnRyb2xsZXIoJ0JvYXJkQ3RybCcsIEJvYXJkQ3RybCk7XG4iLCJmdW5jdGlvbiBCb2FyZCgkcm9vdFNjb3BlLCBGaWxlSW5wdXQsIExpbmVJbnB1dCwgQ2FiaW5ldCwgRGlzdG9ydGlvbiwgT3ZlcmRyaXZlLCBGbGFuZ2VyLCBDaG9ydXMsIERlbGF5LCBTaGFyZWRBdWRpb0NvbnRleHQpIHtcbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpLFxuICAgICAgICBib2FyZElucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuXG4gICAgdmFyIHBlZGFscyA9IHtcbiAgICAgICAgc2FtcGxlOiBuZXcgRmlsZUlucHV0KCksXG4gICAgICAgIGxpbmU6IG5ldyBMaW5lSW5wdXQoKSxcbiAgICAgICAgY2FiaW5ldDogbmV3IENhYmluZXQoKSxcbiAgICAgICAgZGlzdG9ydGlvbjogbmV3IERpc3RvcnRpb24oKSxcbiAgICAgICAgb3ZlcmRyaXZlOiBuZXcgT3ZlcmRyaXZlKCksXG4gICAgICAgIGZsYW5nZXI6IG5ldyBGbGFuZ2VyKCksXG4gICAgICAgIGNob3J1czogbmV3IENob3J1cygpLFxuICAgICAgICBkZWxheTogbmV3IERlbGF5KClcbiAgICB9O1xuXG4gICAgdmFyIHNhbXBsZXMgPSBbXG4gICAgICAgICdhc3NldHMvc2FtcGxlcy9vcGVuLndhdicsXG4gICAgICAgICdhc3NldHMvc2FtcGxlcy9jaG9yZHMud2F2JyxcbiAgICAgICAgJ2Fzc2V0cy9zYW1wbGVzL2V2ZXJsb25nLndhdicsXG4gICAgICAgICdhc3NldHMvc2FtcGxlcy9vY3RhdmVzLndhdicsXG4gICAgICAgICdhc3NldHMvc2FtcGxlcy9GRi53YXYnLFxuICAgICAgICAnYXNzZXRzL3NhbXBsZXMvdHdpZGRsZXMud2F2J1xuICAgIF07XG5cbiAgICB0aGlzLmxvYWRTb3VyY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHBlZGFscy5zYW1wbGUubG9hZEJ1ZmZlcihzYW1wbGVzWzJdKTtcbiAgICAgICAgcGVkYWxzLnNhbXBsZS5jb25uZWN0KGJvYXJkSW5wdXQpO1xuICAgIH07XG5cbiAgICB0aGlzLmxvYWRQZWRhbHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHBlZGFscy5jYWJpbmV0LmxvYWQoJ2Fzc2V0cy9pci81MTUwLndhdicpO1xuICAgICAgICBwZWRhbHMuZGlzdG9ydGlvbi5sb2FkKCdkaXN0MycpO1xuICAgICAgICBwZWRhbHMub3ZlcmRyaXZlLmxvYWQoJ292ZXJkcml2ZScpO1xuICAgICAgICBwZWRhbHMuZmxhbmdlci5sb2FkKCk7XG4gICAgICAgIHBlZGFscy5jaG9ydXMubG9hZCgpO1xuICAgICAgICBwZWRhbHMuZGVsYXkubG9hZCgpO1xuICAgIH07XG5cbiAgICB0aGlzLndpcmVVcEJvYXJkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBib2FyZElucHV0LmNvbm5lY3QocGVkYWxzLmRpc3RvcnRpb24uaW5wdXQpO1xuICAgICAgICBwZWRhbHMuZGlzdG9ydGlvbi5jb25uZWN0KHBlZGFscy5vdmVyZHJpdmUuaW5wdXQpO1xuICAgICAgICBwZWRhbHMub3ZlcmRyaXZlLmNvbm5lY3QocGVkYWxzLmZsYW5nZXIuaW5wdXQpO1xuICAgICAgICBwZWRhbHMuZmxhbmdlci5jb25uZWN0KHBlZGFscy5jaG9ydXMuaW5wdXQpO1xuICAgICAgICBwZWRhbHMuY2hvcnVzLmNvbm5lY3QocGVkYWxzLmRlbGF5LmlucHV0KTtcbiAgICAgICAgcGVkYWxzLmRlbGF5LmNvbm5lY3QocGVkYWxzLmNhYmluZXQuaW5wdXQpO1xuICAgICAgICBwZWRhbHMuY2FiaW5ldC5jb25uZWN0KHN0YWdlLmRlc3RpbmF0aW9uKTtcbiAgICB9O1xuXG4gICAgdGhpcy5wbGF5U2FtcGxlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBwZWRhbHMuc2FtcGxlLnBsYXkoKTtcbiAgICB9O1xuXG4gICAgdGhpcy5zdG9wU2FtcGxlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBwZWRhbHMuc2FtcGxlLnN0b3AoKTtcbiAgICB9O1xuXG4gICAgdGhpcy50b2dnbGVMaXZlSW5wdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghcGVkYWxzLmxpbmUuaXNTdHJlYW1pbmcpIHtcbiAgICAgICAgICAgIHBlZGFscy5saW5lLmxvYWQoKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKCdsaW5laW46bG9hZGVkJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHBlZGFscy5saW5lLnN0cmVhbS5jb25uZWN0KGJvYXJkSW5wdXQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBwZWRhbHMubGluZS5pc1N0cmVhbWluZyA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWRhbHMubGluZS5zdG9wKCk7XG4gICAgICAgICAgICBwZWRhbHMubGluZS5pc1N0cmVhbWluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMuZ2V0UGVkYWwgPSBmdW5jdGlvbiAoZWZmZWN0KSB7XG4gICAgICByZXR1cm4gcGVkYWxzW2VmZmVjdF07XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdCb2FyZCcpXG4gICAgLnNlcnZpY2UoJ0JvYXJkJywgQm9hcmQpO1xuIiwiZnVuY3Rpb24gRmlsZUlucHV0IChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgRmlsZUlucHV0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc2FtcGxlID0gbnVsbDtcbiAgICB9O1xuXG4gICAgRmlsZUlucHV0LnByb3RvdHlwZS5sb2FkQnVmZmVyID0gZnVuY3Rpb24odXJsKSB7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgIHJlcXVlc3Qub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICAgICAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcblxuICAgICAgICB2YXIgbG9hZGVyID0gdGhpcztcblxuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc3RhZ2UuZGVjb2RlQXVkaW9EYXRhKFxuICAgICAgICAgICAgICAgIHJlcXVlc3QucmVzcG9uc2UsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oYnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghYnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbGVydCgnZXJyb3IgZGVjb2RpbmcgZmlsZSBkYXRhOiAnICsgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2FkZXIuc2FtcGxlID0gYnVmZmVyO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignZGVjb2RlQXVkaW9EYXRhIGVycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGFsZXJ0KCdCdWZmZXJMb2FkZXI6IFhIUiBlcnJvcicpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5zZW5kKCk7XG4gICAgfTtcblxuICAgIEZpbGVJbnB1dC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgRmlsZUlucHV0LnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc291cmNlID0gc3RhZ2UuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgICAgIHRoaXMuc291cmNlLmxvb3AgPSB0cnVlO1xuICAgICAgICB0aGlzLnNvdXJjZS5idWZmZXIgPSB0aGlzLnNhbXBsZTtcblxuICAgICAgICB0aGlzLnNvdXJjZS5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICB0aGlzLnNvdXJjZS5zdGFydCgwKTtcbiAgICB9O1xuXG5cbiAgICBGaWxlSW5wdXQucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zb3VyY2Uuc3RvcCgpO1xuICAgICAgICB0aGlzLnNvdXJjZS5kaXNjb25uZWN0KCk7XG4gICAgfTtcblxuICAgIHJldHVybiBGaWxlSW5wdXQ7XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0lucHV0JylcbiAgICAuZmFjdG9yeSgnRmlsZUlucHV0JywgRmlsZUlucHV0KTtcbiIsImZ1bmN0aW9uIGlucHV0Q29udHJvbHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL2NvbnRyb2xzLmh0bWwnLFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBzdGFydCA9IGFuZ3VsYXIuZWxlbWVudCgnLmdseXBoaWNvbi1wbGF5JyksXG4gICAgICAgICAgICAgICAgc3RvcCA9IGFuZ3VsYXIuZWxlbWVudCgnLmdseXBoaWNvbi1zdG9wJyksXG4gICAgICAgICAgICAgICAgbGl2ZUlucHV0ID0gYW5ndWxhci5lbGVtZW50KCcuZ2x5cGhpY29uLXJlY29yZCcpO1xuXG4gICAgICAgICAgICBzdGFydC5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIHN0b3AucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgc3RhcnQucHJvcCgnZGlzYWJsZWQnLCB0cnVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBzdG9wLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgc3RhcnQucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgc3RvcC5wcm9wKCdkaXNhYmxlZCcsIHRydWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGxpdmVJbnB1dC5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIGxpdmVJbnB1dC50b2dnbGVDbGFzcyhcImJ0bi1kYW5nZXJcIik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnSW5wdXQnKVxuICAgIC5kaXJlY3RpdmUoJ2lucHV0Q29udHJvbHMnLCBpbnB1dENvbnRyb2xzKTtcbiIsImZ1bmN0aW9uIExpbmVJbnB1dCgkcm9vdFNjb3BlLCBTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgTGluZUlucHV0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5zdHJlYW0gPSBudWxsO1xuICAgICAgICB0aGlzLmlzU3RyZWFtaW5nID0gZmFsc2U7XG4gICAgfTtcblxuICAgIExpbmVJbnB1dC5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoe1xuICAgICAgICAgICAgXCJhdWRpb1wiOiB7XG4gICAgICAgICAgICAgICAgXCJvcHRpb25hbFwiOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcImdvb2dFY2hvQ2FuY2VsbGF0aW9uXCI6IFwiZmFsc2VcIn0sXG4gICAgICAgICAgICAgICAgICAgIHtcImdvb2dBdXRvR2FpbkNvbnRyb2xcIjogXCJmYWxzZVwifSxcbiAgICAgICAgICAgICAgICAgICAge1wiZ29vZ05vaXNlU3VwcHJlc3Npb25cIjogXCJ0cnVlXCJ9LFxuICAgICAgICAgICAgICAgICAgICB7XCJnb29nSGlnaHBhc3NGaWx0ZXJcIjogXCJmYWxzZVwifVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24gKHN0cmVhbSkge1xuICAgICAgICAgICAgc2VsZi5zdHJlYW0gPSBzdGFnZS5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kZW1pdCgnbGluZWluOmxvYWRlZCcpO1xuICAgICAgICAgICAgdGhpcy5pc1N0cmVhbWluZyA9IHRydWU7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0d1aXRhciBzdHJlYW0gZmFpbGVkOiAnICsgZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIExpbmVJbnB1dC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgICAgICAgdGhpcy5zdHJlYW0uY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBMaW5lSW5wdXQucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3RyZWFtLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgdGhpcy5pc1N0cmVhbWluZyA9IGZhbHNlO1xuICAgIH07XG5cbiAgICByZXR1cm4gTGluZUlucHV0O1xufVxuXG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdJbnB1dCcpXG4gICAgLnNlcnZpY2UoJ0xpbmVJbnB1dCcsIExpbmVJbnB1dCk7XG4iLCJmdW5jdGlvbiBTaGFyZWRBdWRpb0NvbnRleHQgKCkge1xuXG4gICAgdmFyIFNoYXJlZEF1ZGlvQ29udGV4dCA9IHt9O1xuXG4gICAgU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRleHQgfHwgKHRoaXMuY29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQpO1xuICAgIH07XG5cbiAgICByZXR1cm4gU2hhcmVkQXVkaW9Db250ZXh0O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1NoYXJlZEF1ZGlvQ29udGV4dCcpXG4gICAgLmZhY3RvcnkoJ1NoYXJlZEF1ZGlvQ29udGV4dCcsIFNoYXJlZEF1ZGlvQ29udGV4dCk7XG4iLCJmdW5jdGlvbiBDYWJpbmV0IChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgQ2FiaW5ldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmlucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5ib29zdCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5jb252b2x2ZXIgPSBzdGFnZS5jcmVhdGVDb252b2x2ZXIoKTtcbiAgICB9O1xuXG4gICAgQ2FiaW5ldC5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKGlyUGF0aCkge1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsIGlyUGF0aCwgdHJ1ZSk7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcblxuICAgICAgICB2YXIgbG9hZGVyID0gdGhpcztcblxuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHN0YWdlLmRlY29kZUF1ZGlvRGF0YShyZXF1ZXN0LnJlc3BvbnNlLCBmdW5jdGlvbiAoYnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyLmNvbnZvbHZlci5idWZmZXIgPSBidWZmZXI7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgIGlmIChlKSBjb25zb2xlLmxvZyhcIkNhbm5vdCBsb2FkIGNhYmluZXRcIiArIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVxdWVzdC5zZW5kKG51bGwpO1xuXG4gICAgICAgIHRoaXMuaW5wdXQuZ2Fpbi52YWx1ZSA9IDM7XG4gICAgICAgIHRoaXMuYm9vc3QuZ2Fpbi52YWx1ZSA9IDE7XG5cbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMuY29udm9sdmVyKTtcbiAgICAgICAgdGhpcy5jb252b2x2ZXIuY29ubmVjdCh0aGlzLmJvb3N0KTtcbiAgICAgICAgdGhpcy5ib29zdC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgQ2FiaW5ldC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhYmluZXQ7XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZmFjdG9yeSgnQ2FiaW5ldCcsIENhYmluZXQpO1xuIiwiZnVuY3Rpb24gY2hvcnVzUGVkYWwgKEJvYXJkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL2Nob3J1cy5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBjaG9ydXMgPSBCb2FyZC5nZXRQZWRhbCgnY2hvcnVzJyk7XG5cbiAgICAgICAgICAgIHZhciByYXRlID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNjaG9ydXMtcmF0ZScpLFxuICAgICAgICAgICAgICAgIGRlbGF5ID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNjaG9ydXMtZGVsYXknKSxcbiAgICAgICAgICAgICAgICBkZXB0aCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjY2hvcnVzLWRlcHRoJyksXG4gICAgICAgICAgICAgICAgZm9vdHN3aXRjaCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLXN3aXRjaCNjaG9ydXMtZm9vdC1zdycpLFxuICAgICAgICAgICAgICAgIGxlZCA9ICRlbGVtZW50LmZpbmQoJy5sZWQnKTtcblxuXG4gICAgICAgICAgICByYXRlLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgY2hvcnVzLnNldFJhdGUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJhdGUub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmF0ZS52YWwocGFyc2VGbG9hdCgzLjUpKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZWxheS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGNob3J1cy5zZXREZWxheShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZGVsYXkub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZGVsYXkudmFsKHBhcnNlRmxvYXQoMC4wMykpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRlcHRoLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgY2hvcnVzLnNldERlcHRoKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZXB0aC5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBkZXB0aC52YWwocGFyc2VGbG9hdCgwLjAwMikpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZvb3Rzd2l0Y2gub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGxlZC50b2dnbGVDbGFzcygnYWN0aXZlJyk7XG4gICAgICAgICAgICAgICAgY2hvcnVzLmJ5cGFzcygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZGlyZWN0aXZlKCdjaG9ydXNQZWRhbCcsIGNob3J1c1BlZGFsKTtcbiIsImZ1bmN0aW9uIENob3J1cyAoU2hhcmVkQXVkaW9Db250ZXh0KSB7XG5cbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpO1xuXG4gICAgdmFyIENob3J1cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmlucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5kZXB0aCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vc2MgPSBzdGFnZS5jcmVhdGVPc2NpbGxhdG9yKCk7XG4gICAgICAgIHRoaXMuZGVsYXkgPSBzdGFnZS5jcmVhdGVEZWxheSgpO1xuICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgIH07XG5cbiAgICBDaG9ydXMucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5vc2MudHlwZSA9ICdzaW5lJztcbiAgICAgICAgdGhpcy5vc2MuZnJlcXVlbmN5LnZhbHVlID0gcGFyc2VGbG9hdCggMy41ICk7XG5cbiAgICAgICAgdGhpcy5kZWxheS5kZWxheVRpbWUudmFsdWUgPSBwYXJzZUZsb2F0KCAwLjAzICk7XG5cbiAgICAgICAgdGhpcy5kZXB0aC5nYWluLnZhbHVlID0gcGFyc2VGbG9hdCggMC4wMDIgKTtcblxuICAgICAgICB0aGlzLm9zYy5jb25uZWN0KHRoaXMuZGVwdGgpO1xuICAgICAgICB0aGlzLmRlcHRoLmNvbm5lY3QodGhpcy5kZWxheS5kZWxheVRpbWUpO1xuXG4gICAgICAgIHRoaXMuZGVsYXkuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgdGhpcy5vc2Muc3RhcnQoMCk7XG5cbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgQ2hvcnVzLnByb3RvdHlwZS5zZXRSYXRlID0gZnVuY3Rpb24oc3BlZWQpIHtcbiAgICAgICAgdGhpcy5vc2MuZnJlcXVlbmN5LnZhbHVlID0gcGFyc2VGbG9hdChzcGVlZCk7XG4gICAgfTtcblxuICAgIENob3J1cy5wcm90b3R5cGUuc2V0RGVsYXkgPSBmdW5jdGlvbihkZWxheSkge1xuICAgICAgICB0aGlzLmRlbGF5LmRlbGF5VGltZS52YWx1ZSA9IHBhcnNlRmxvYXQoZGVsYXkpO1xuICAgIH07XG5cbiAgICBDaG9ydXMucHJvdG90eXBlLnNldERlcHRoID0gZnVuY3Rpb24oZGVwdGgpIHtcbiAgICAgICAgdGhpcy5kZXB0aC5nYWluLnZhbHVlID0gcGFyc2VGbG9hdChkZXB0aCk7XG4gICAgfTtcblxuICAgIENob3J1cy5wcm90b3R5cGUuYnlwYXNzID0gZnVuY3Rpb24oKXtcbiAgICAgICAgaWYodGhpcy5pc0J5cGFzc2VkKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLmRlbGF5KTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIENob3J1cy5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENob3J1cztcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdDaG9ydXMnLCBDaG9ydXMpO1xuIiwiZnVuY3Rpb24gZGVsYXlQZWRhbCAoQm9hcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvZGVsYXkuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uICgkc2NvcGUsICRlbGVtZW50KSB7XG4gICAgICAgICAgICB2YXIgZGVsYXkgPSBCb2FyZC5nZXRQZWRhbCgnZGVsYXknKTtcblxuICAgICAgICAgICAgdmFyIHRpbWUgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI2RlbGF5LXRpbWUnKSxcbiAgICAgICAgICAgICAgICBmZWVkYmFjayA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZGVsYXktZmVlZGJhY2snKSxcbiAgICAgICAgICAgICAgICBmb290c3dpdGNoID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8tc3dpdGNoI2RlbGF5LWZvb3Qtc3cnKSxcbiAgICAgICAgICAgICAgICBsZWQgPSAkZWxlbWVudC5maW5kKCcubGVkJyk7XG5cbiAgICAgICAgICAgIHRpbWUub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBkZWxheS5zZXRUaW1lKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aW1lLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRpbWUudmFsKHBhcnNlRmxvYXQoMC41KSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZmVlZGJhY2sub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBkZWxheS5zZXRGZWVkYmFjayhlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZmVlZGJhY2sub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZmVlZGJhY2sudmFsKHBhcnNlRmxvYXQoMC43NSkpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZvb3Rzd2l0Y2gub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGxlZC50b2dnbGVDbGFzcygnYWN0aXZlJyk7XG4gICAgICAgICAgICAgICAgZGVsYXkuYnlwYXNzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5kaXJlY3RpdmUoJ2RlbGF5UGVkYWwnLCBkZWxheVBlZGFsKTtcbiIsImZ1bmN0aW9uIERlbGF5IChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgZGVsYXkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5pbnB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuZmVlZGJhY2sgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuZGVsYXkgPSBzdGFnZS5jcmVhdGVEZWxheSgpO1xuICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgIH07XG5cbiAgICBkZWxheS5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmRlbGF5LmRlbGF5VGltZS52YWx1ZSA9IHBhcnNlRmxvYXQoIDAuNSApO1xuICAgICAgICB0aGlzLmZlZWRiYWNrLmdhaW4udmFsdWUgPSBwYXJzZUZsb2F0KCAwLjc1ICk7XG5cbiAgICAgICAgdGhpcy5kZWxheS5jb25uZWN0KCB0aGlzLmZlZWRiYWNrICk7XG4gICAgICAgIHRoaXMuZmVlZGJhY2suY29ubmVjdCggdGhpcy5kZWxheSApO1xuXG4gICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLm91dHB1dCk7XG4gICAgfTtcblxuICAgIGRlbGF5LnByb3RvdHlwZS5zZXRUaW1lID0gZnVuY3Rpb24odGltZSkge1xuICAgICAgICB0aGlzLmRlbGF5LmRlbGF5VGltZS52YWx1ZSA9IHBhcnNlRmxvYXQodGltZSk7XG4gICAgfTtcblxuICAgIGRlbGF5LnByb3RvdHlwZS5zZXRGZWVkYmFjayA9IGZ1bmN0aW9uKGZlZWRiYWNrKSB7XG4gICAgICAgIHRoaXMuZmVlZGJhY2suZ2Fpbi52YWx1ZSA9IHBhcnNlRmxvYXQoZmVlZGJhY2spO1xuICAgIH07XG5cbiAgICBkZWxheS5wcm90b3R5cGUuYnlwYXNzID0gZnVuY3Rpb24oKXtcbiAgICAgICAgaWYodGhpcy5pc0J5cGFzc2VkKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLm91dHB1dCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5kZWxheSk7XG4gICAgICAgICAgICB0aGlzLmRlbGF5LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy5kZWxheS5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGRlbGF5LnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICByZXR1cm4gZGVsYXk7XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZmFjdG9yeSgnRGVsYXknLCBEZWxheSk7XG4iLCJmdW5jdGlvbiBkaXN0b3J0aW9uUGVkYWwgKEJvYXJkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL2Rpc3RvcnRpb24uaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uICgkc2NvcGUsICRlbGVtZW50KSB7XG4gICAgICAgICAgICBjb25zdCBNSURfTEVWRUwgPSA1LjU7XG4gICAgICAgICAgICB2YXIgZGlzdG9ydGlvbiA9IEJvYXJkLmdldFBlZGFsKCdkaXN0b3J0aW9uJyk7XG5cbiAgICAgICAgICAgIHZhciB2b2x1bWUgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI2Rpc3RvcnRpb24tdm9sdW1lJyksXG4gICAgICAgICAgICAgICAgdG9uZSA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZGlzdG9ydGlvbi10b25lJyksXG4gICAgICAgICAgICAgICAgZm9vdHN3aXRjaCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLXN3aXRjaCNkaXN0b3J0aW9uLWZvb3Qtc3cnKSxcbiAgICAgICAgICAgICAgICBsZWQgPSAkZWxlbWVudC5maW5kKCcubGVkJyk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGRpc3RvcnRpb24uc2V0Vm9sdW1lKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB2b2x1bWUub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdm9sdW1lLnZhbChNSURfTEVWRUwpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRvbmUub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBkaXN0b3J0aW9uLnNldFRvbmUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRvbmUub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdG9uZS52YWwoTUlEX0xFVkVMKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmb290c3dpdGNoLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBsZWQudG9nZ2xlQ2xhc3MoJ2FjdGl2ZScpO1xuICAgICAgICAgICAgICAgIGRpc3RvcnRpb24uYnlwYXNzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5kaXJlY3RpdmUoJ2Rpc3RvcnRpb25QZWRhbCcsIGRpc3RvcnRpb25QZWRhbCk7XG4iLCJmdW5jdGlvbiBEaXN0b3J0aW9uIChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgRGlzdG9ydGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmlucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5nYWluID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIgPSBzdGFnZS5jcmVhdGVXYXZlU2hhcGVyKCk7XG4gICAgICAgIHRoaXMubG93cGFzcyA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmhpZ2hwYXNzID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuYm9vc3QgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5jdXQgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy52b2x1bWUgPSA3LjU7XG4gICAgICAgIHRoaXMudG9uZSA9IDIwO1xuICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24odHlwZSkge1xuXG4gICAgICAgIHRoaXMuZ2Fpbi5nYWluLnZhbHVlID0gdGhpcy52b2x1bWU7XG5cbiAgICAgICAgdGhpcy5sb3dwYXNzLnR5cGUgPSBcImxvd3Bhc3NcIjtcbiAgICAgICAgdGhpcy5sb3dwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IDUwMDA7XG5cbiAgICAgICAgdGhpcy5ib29zdC50eXBlID0gXCJsb3dzaGVsZlwiO1xuICAgICAgICB0aGlzLmJvb3N0LmZyZXF1ZW5jeS52YWx1ZSA9IDEwMDtcbiAgICAgICAgdGhpcy5ib29zdC5nYWluLnZhbHVlID0gNjtcblxuICAgICAgICB0aGlzLmN1dC50eXBlID0gXCJsb3dzaGVsZlwiO1xuICAgICAgICB0aGlzLmN1dC5mcmVxdWVuY3kudmFsdWUgPSAxMDA7XG4gICAgICAgIHRoaXMuY3V0LmdhaW4udmFsdWUgPSAtNjtcblxuICAgICAgICB0aGlzLndhdmVzaGFwZXIuY3VydmUgPSB0aGlzLm1ha2VEaXN0b3J0aW9uQ3VydmUoMTAsIHR5cGUpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIub3ZlcnNhbXBsZSA9ICc0eCc7XG5cbiAgICAgICAgdGhpcy5oaWdocGFzcy50eXBlID0gXCJoaWdocGFzc1wiO1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IHRoaXMudG9uZTtcblxuICAgICAgICB0aGlzLmdhaW4uY29ubmVjdCh0aGlzLmxvd3Bhc3MpXG4gICAgICAgIHRoaXMubG93cGFzcy5jb25uZWN0KHRoaXMuYm9vc3QpO1xuICAgICAgICB0aGlzLmJvb3N0LmNvbm5lY3QodGhpcy53YXZlc2hhcGVyKTtcbiAgICAgICAgdGhpcy53YXZlc2hhcGVyLmNvbm5lY3QodGhpcy5jdXQpO1xuICAgICAgICB0aGlzLmN1dC5jb25uZWN0KHRoaXMuaGlnaHBhc3MpO1xuXG4gICAgICAgIC8vYnlwYXNzIGJ5IGRlZmF1bHRcbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUubWFrZURpc3RvcnRpb25DdXJ2ZSA9IGZ1bmN0aW9uIChhbW91bnQsIHR5cGUpIHtcbiAgICAgICAgdmFyIGsgPSB0eXBlb2YgYW1vdW50ID09PSAnbnVtYmVyJyA/IGFtb3VudCA6IDEwLFxuICAgICAgICAgICAgc2FtcGxlcyA9IDExMDI1LFxuICAgICAgICAgICAgY3VydmUgPSBuZXcgRmxvYXQzMkFycmF5KHNhbXBsZXMpO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2FtcGxlczsgKytpKSB7XG4gICAgICAgICAgICBjdXJ2ZVtpXSA9IHRoaXMuY3VydmVBbGdvcml0aG0oaSAqIDIgLyBzYW1wbGVzIC0gMSwgdHlwZSwgayk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3VydmU7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLmN1cnZlQWxnb3JpdGhtID0gZnVuY3Rpb24gKHgsIHR5cGUsIGspIHtcbiAgICAgICAgc3dpdGNoKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3QxJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5tYXgoLTAuNSwgTWF0aC5taW4oMC41LCB4ICogaykpO1xuICAgICAgICAgICAgY2FzZSAnZGlzdDInOlxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgtMSwgTWF0aC5taW4oMSwgeCAqIGspKTtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3QzJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5tYXgoLTAuNSwgTWF0aC5taW4oMS41LCB4ICkpO1xuICAgICAgICAgICAgY2FzZSAnZGlzdDQnOlxuICAgICAgICAgICAgICAgIHJldHVybiAyLjggKiBNYXRoLnBvdyh4LCAzKSArIE1hdGgucG93KHgsMikgKyAtMS4xICogeCAtIDAuNTtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3Q1JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gKE1hdGguZXhwKHgpIC0gTWF0aC5leHAoLXggKiAxLjIpKSAvIChNYXRoLmV4cCh4KSArIE1hdGguZXhwKC14KSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0Nic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudGFuaCh4KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS50YW5oID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgaWYgKHggPT09IEluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIGlmICh4ID09PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAoTWF0aC5leHAoeCkgLSBNYXRoLmV4cCgteCkpIC8gKE1hdGguZXhwKHgpICsgTWF0aC5leHAoLXgpKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5zaWduID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgeCA9ICt4OyAvLyBjb252ZXJ0IHRvIGEgbnVtYmVyXG4gICAgICAgIGlmICh4ID09PSAwIHx8IGlzTmFOKHgpKVxuICAgICAgICAgICAgcmV0dXJuIHg7XG4gICAgICAgIHJldHVybiB4ID4gMCA/IDEgOiAtMTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuYnlwYXNzID0gZnVuY3Rpb24oKXtcbiAgICAgICAgaWYodGhpcy5pc0J5cGFzc2VkKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLmdhaW4pO1xuICAgICAgICAgICAgdGhpcy5oaWdocGFzcy5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaGlnaHBhc3MuZGlzY29ubmVjdCgpO1xuXG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgICAgICB0aGlzLmdhaW4uZ2Fpbi52YWx1ZSA9IDEuNSAqIHZvbHVtZTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuc2V0VG9uZSA9IGZ1bmN0aW9uKHRvbmUpIHtcbiAgICAgICAgdGhpcy5oaWdocGFzcy5mcmVxdWVuY3kudmFsdWUgPSAyMCAqIHRvbmU7XG4gICAgfTtcblxuICAgIHJldHVybiBEaXN0b3J0aW9uO1xufVxuXG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdQZWRhbCcpXG4gICAgLmZhY3RvcnkoJ0Rpc3RvcnRpb24nLCBEaXN0b3J0aW9uKTtcbiIsImZ1bmN0aW9uIGZsYW5nZXJQZWRhbCAoQm9hcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvZmxhbmdlci5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBmbGFuZ2VyID0gQm9hcmQuZ2V0UGVkYWwoJ2ZsYW5nZXInKTtcblxuICAgICAgICAgICAgdmFyIHNwZWVkID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNmbGFuZ2VyLXNwZWVkJyksXG4gICAgICAgICAgICAgICAgZGVsYXkgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI2ZsYW5nZXItZGVsYXknKSxcbiAgICAgICAgICAgICAgICBkZXB0aCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZmxhbmdlci1kZXB0aCcpLFxuICAgICAgICAgICAgICAgIGZlZWRiYWNrID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNmbGFuZ2VyLWZlZWRiYWNrJyksXG4gICAgICAgICAgICAgICAgZm9vdHN3aXRjaCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLXN3aXRjaCNmbGFuZ2VyLWZvb3Qtc3cnKSxcbiAgICAgICAgICAgICAgICBsZWQgPSAkZWxlbWVudC5maW5kKCcubGVkJyk7XG5cbiAgICAgICAgICAgIHNwZWVkLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZmxhbmdlci5zZXRTcGVlZChlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgc3BlZWQub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgc3BlZWQudmFsKHBhcnNlRmxvYXQoMC43MCkpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRlbGF5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZmxhbmdlci5zZXREZWxheShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZGVsYXkub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZGVsYXkudmFsKHBhcnNlRmxvYXQoMC4wMDMpKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZXB0aC5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGZsYW5nZXIuc2V0RGVwdGgoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRlcHRoLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGRlcHRoLnZhbChwYXJzZUZsb2F0KDAuMDAxMykpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZlZWRiYWNrLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZmxhbmdlci5zZXRGZWVkYmFjayhlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZmVlZGJhY2sub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZmVlZGJhY2sudmFsKHBhcnNlRmxvYXQoMC40KSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZm9vdHN3aXRjaC5vbignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbGVkLnRvZ2dsZUNsYXNzKCdhY3RpdmUnKTtcbiAgICAgICAgICAgICAgICBmbGFuZ2VyLmJ5cGFzcygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZGlyZWN0aXZlKCdmbGFuZ2VyUGVkYWwnLCBmbGFuZ2VyUGVkYWwpO1xuIiwiZnVuY3Rpb24gRmxhbmdlciAoU2hhcmVkQXVkaW9Db250ZXh0KSB7XG5cbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpO1xuXG4gICAgdmFyIEZsYW5nZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5pbnB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMud2V0Z2FpbiA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5mZWVkYmFjayA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5kZXB0aCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vc2MgPSBzdGFnZS5jcmVhdGVPc2NpbGxhdG9yKCk7XG4gICAgICAgIHRoaXMuZGVsYXkgPSBzdGFnZS5jcmVhdGVEZWxheSgpO1xuICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMub3NjLnR5cGUgPSAnc2luZSc7XG4gICAgICAgIHRoaXMub3NjLmZyZXF1ZW5jeS52YWx1ZSA9IHBhcnNlRmxvYXQoIDAuNyApO1xuXG4gICAgICAgIHRoaXMuZGVsYXkuZGVsYXlUaW1lLnZhbHVlID0gcGFyc2VGbG9hdCggMC4wMDMgKTtcblxuICAgICAgICB0aGlzLmRlcHRoLmdhaW4udmFsdWUgPSBwYXJzZUZsb2F0KCAwLjAwMTMgKTtcblxuICAgICAgICB0aGlzLmZlZWRiYWNrLmdhaW4udmFsdWUgPSBwYXJzZUZsb2F0KCAwLjQwICk7XG5cbiAgICAgICAgdGhpcy5vc2MuY29ubmVjdCh0aGlzLmRlcHRoKTtcbiAgICAgICAgdGhpcy5kZXB0aC5jb25uZWN0KHRoaXMuZGVsYXkuZGVsYXlUaW1lKTtcblxuICAgICAgICB0aGlzLmRlbGF5LmNvbm5lY3QoIHRoaXMud2V0Z2FpbiApO1xuICAgICAgICB0aGlzLmRlbGF5LmNvbm5lY3QoIHRoaXMuZmVlZGJhY2sgKTtcbiAgICAgICAgdGhpcy5mZWVkYmFjay5jb25uZWN0KCB0aGlzLmlucHV0ICk7XG5cbiAgICAgICAgdGhpcy5vc2Muc3RhcnQoMCk7XG5cbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgRmxhbmdlci5wcm90b3R5cGUuc2V0U3BlZWQgPSBmdW5jdGlvbihzcGVlZCkge1xuICAgICAgICB0aGlzLm9zYy5mcmVxdWVuY3kudmFsdWUgPSBwYXJzZUZsb2F0KHNwZWVkKTtcbiAgICB9O1xuXG4gICAgRmxhbmdlci5wcm90b3R5cGUuc2V0RGVsYXkgPSBmdW5jdGlvbihkZWxheSkge1xuICAgICAgICB0aGlzLmRlbGF5LmRlbGF5VGltZS52YWx1ZSA9IHBhcnNlRmxvYXQoZGVsYXkpO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5zZXREZXB0aCA9IGZ1bmN0aW9uKGRlcHRoKSB7XG4gICAgICAgIHRoaXMuZGVwdGguZ2Fpbi52YWx1ZSA9IHBhcnNlRmxvYXQoZGVwdGgpO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5zZXRGZWVkYmFjayA9IGZ1bmN0aW9uKGZlZWRiYWNrKSB7XG4gICAgICAgIHRoaXMuZmVlZGJhY2suZ2Fpbi52YWx1ZSA9IHBhcnNlRmxvYXQoZmVlZGJhY2spO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5ieXBhc3MgPSBmdW5jdGlvbigpe1xuICAgICAgICBpZih0aGlzLmlzQnlwYXNzZWQpIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMud2V0Z2Fpbik7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QoIHRoaXMuZGVsYXkpO1xuICAgICAgICAgICAgdGhpcy53ZXRnYWluLmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy53ZXRnYWluLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRmxhbmdlci5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIEZsYW5nZXI7XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZmFjdG9yeSgnRmxhbmdlcicsIEZsYW5nZXIpO1xuIiwiZnVuY3Rpb24gb3ZlcmRyaXZlUGVkYWwgKEJvYXJkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL292ZXJkcml2ZS5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IE1JRF9MRVZFTCA9IDUuNTtcbiAgICAgICAgICAgIHZhciBvdmVyZHJpdmUgPSBCb2FyZC5nZXRQZWRhbCgnb3ZlcmRyaXZlJyk7XG5cbiAgICAgICAgICAgIHZhciB2b2x1bWUgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI292ZXJkcml2ZS12b2x1bWUnKSxcbiAgICAgICAgICAgICAgICB0b25lID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNvdmVyZHJpdmUtdG9uZScpLFxuICAgICAgICAgICAgICAgIGZvb3Rzd2l0Y2ggPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1zd2l0Y2gjb3ZlcmRyaXZlLWZvb3Qtc3cnKSxcbiAgICAgICAgICAgICAgICBsZWQgPSAkZWxlbWVudC5maW5kKCcubGVkJyk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIG92ZXJkcml2ZS5zZXRWb2x1bWUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2b2x1bWUudmFsKE1JRF9MRVZFTCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdG9uZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIG92ZXJkcml2ZS5zZXRUb25lKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0b25lLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRvbmUudmFsKE1JRF9MRVZFTCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZm9vdHN3aXRjaC5vbignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbGVkLnRvZ2dsZUNsYXNzKCdhY3RpdmUnKTtcbiAgICAgICAgICAgICAgICBvdmVyZHJpdmUuYnlwYXNzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5kaXJlY3RpdmUoJ292ZXJkcml2ZVBlZGFsJywgb3ZlcmRyaXZlUGVkYWwpO1xuIiwiZnVuY3Rpb24gT3ZlcmRyaXZlIChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgT3ZlcmRyaXZlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmdhaW4gPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlciA9IHN0YWdlLmNyZWF0ZVdhdmVTaGFwZXIoKTtcbiAgICAgICAgdGhpcy5sb3dwYXNzID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5ib29zdCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmN1dCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLnZvbHVtZSA9IDcuNTtcbiAgICAgICAgdGhpcy50b25lID0gMjA7XG4gICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgfTtcblxuICAgIE92ZXJkcml2ZS5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKHR5cGUpIHtcblxuICAgICAgICB0aGlzLmdhaW4uZ2Fpbi52YWx1ZSA9IHRoaXMudm9sdW1lO1xuXG4gICAgICAgIHRoaXMubG93cGFzcy50eXBlID0gXCJsb3dwYXNzXCI7XG4gICAgICAgIHRoaXMubG93cGFzcy5mcmVxdWVuY3kudmFsdWUgPSA1MDAwO1xuXG4gICAgICAgIHRoaXMuYm9vc3QudHlwZSA9IFwibG93c2hlbGZcIjtcbiAgICAgICAgdGhpcy5ib29zdC5mcmVxdWVuY3kudmFsdWUgPSAxMDA7XG4gICAgICAgIHRoaXMuYm9vc3QuZ2Fpbi52YWx1ZSA9IDY7XG5cbiAgICAgICAgdGhpcy5jdXQudHlwZSA9IFwibG93c2hlbGZcIjtcbiAgICAgICAgdGhpcy5jdXQuZnJlcXVlbmN5LnZhbHVlID0gMTAwO1xuICAgICAgICB0aGlzLmN1dC5nYWluLnZhbHVlID0gLTY7XG5cbiAgICAgICAgdGhpcy53YXZlc2hhcGVyLmN1cnZlID0gdGhpcy5tYWtlT3ZlcmRyaXZlQ3VydmUoMTAsIHR5cGUpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIub3ZlcnNhbXBsZSA9ICc0eCc7XG5cbiAgICAgICAgdGhpcy5oaWdocGFzcy50eXBlID0gXCJoaWdocGFzc1wiO1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IHRoaXMudG9uZTtcblxuICAgICAgICB0aGlzLmdhaW4uY29ubmVjdCh0aGlzLmxvd3Bhc3MpXG4gICAgICAgIHRoaXMubG93cGFzcy5jb25uZWN0KHRoaXMuYm9vc3QpO1xuICAgICAgICB0aGlzLmJvb3N0LmNvbm5lY3QodGhpcy53YXZlc2hhcGVyKTtcbiAgICAgICAgdGhpcy53YXZlc2hhcGVyLmNvbm5lY3QodGhpcy5jdXQpO1xuICAgICAgICB0aGlzLmN1dC5jb25uZWN0KHRoaXMuaGlnaHBhc3MpO1xuXG4gICAgICAgIC8vYnlwYXNzIGJ5IGRlZmF1bHRcbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5tYWtlT3ZlcmRyaXZlQ3VydmUgPSBmdW5jdGlvbiAoYW1vdW50LCB0eXBlKSB7XG4gICAgICAgIHZhciBrID0gdHlwZW9mIGFtb3VudCA9PT0gJ251bWJlcicgPyBhbW91bnQgOiAxMCxcbiAgICAgICAgICAgIHNhbXBsZXMgPSAxMTAyNSxcbiAgICAgICAgICAgIGN1cnZlID0gbmV3IEZsb2F0MzJBcnJheShzYW1wbGVzKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNhbXBsZXM7ICsraSkge1xuICAgICAgICAgICAgY3VydmVbaV0gPSB0aGlzLmN1cnZlQWxnb3JpdGhtKGkgKiAyIC8gc2FtcGxlcyAtIDEsIHR5cGUsIGspO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGN1cnZlO1xuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLmN1cnZlQWxnb3JpdGhtID0gZnVuY3Rpb24gKHgsIHR5cGUsIGspIHtcbiAgICAgICAgc3dpdGNoKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ292ZXJkcml2ZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuICgxICsgaykgKiB4IC8gKDEgKyBrICogTWF0aC5hYnMoeCkpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIE92ZXJkcml2ZS5wcm90b3R5cGUudGFuaCA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIGlmICh4ID09PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSBpZiAoeCA9PT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gKE1hdGguZXhwKHgpIC0gTWF0aC5leHAoLXgpKSAvIChNYXRoLmV4cCh4KSArIE1hdGguZXhwKC14KSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5zaWduID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgeCA9ICt4OyAvLyBjb252ZXJ0IHRvIGEgbnVtYmVyXG4gICAgICAgIGlmICh4ID09PSAwIHx8IGlzTmFOKHgpKVxuICAgICAgICAgICAgcmV0dXJuIHg7XG4gICAgICAgIHJldHVybiB4ID4gMCA/IDEgOiAtMTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLmJ5cGFzcyA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIGlmKHRoaXMuaXNCeXBhc3NlZCkge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5nYWluKTtcbiAgICAgICAgICAgIHRoaXMuaGlnaHBhc3MuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmhpZ2hwYXNzLmRpc2Nvbm5lY3QoKTtcblxuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgICAgICB0aGlzLmdhaW4uZ2Fpbi52YWx1ZSA9IDEuNSAqIHZvbHVtZTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5zZXRUb25lID0gZnVuY3Rpb24odG9uZSkge1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IDIwICogdG9uZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIE92ZXJkcml2ZTtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdPdmVyZHJpdmUnLCBPdmVyZHJpdmUpO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9