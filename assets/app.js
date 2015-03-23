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
function BoardCtrl ($scope, Board) {
    var vm = this;

    Board.loadSource();
    Board.loadPedals();
    Board.wireUpBoard();

    $scope.samples = Board.getPedal('sample').getFiles();

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
BoardCtrl.$inject = ["$scope", "Board"];

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

    this.loadSource = function () {
        pedals.sample.connect(boardInput);
    };

    this.loadPedals = function () {
        pedals.cabinet.load('assets/ir/5150.wav');
        pedals.distortion.load('dist6');
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

    FileInput.prototype.getFiles = function () {
        return [
            {name: 'Open', url: 'assets/samples/open.wav'},
            {name: 'Chords', url: 'assets/samples/chords.wav'},
            {name: 'Everlong', url: 'assets/samples/everlong.wav'},
            {name: 'Octave Chords', url: 'assets/samples/octaves.wav'},
            {name: 'Foo Fighters', url: 'assets/samples/FF.wav'},
            {name: 'Lead', url: 'assets/samples/twiddles.wav'},
            {name: 'Delay', url: 'assets/samples/delay.wav'}
        ];
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
        link: function ($rootScope, scope, element) {
            var start = angular.element('.glyphicon-play'),
                stop = angular.element('.glyphicon-stop'),
                liveInput = angular.element('.glyphicon-record');

            start.on('click', function(){
                if($rootScope.isLoading){
                    alert('Please load a sample first!');
                    return;
                }
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
                    {"googNoiseSuppression": "false"},
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

function samplesList($rootScope, Board) {
    return {
        restrict: 'E',
        templateUrl: 'templates/samples-list.html',
        link: function ($scope, $element) {
            $rootScope.isLoading = true;

            console.log($element);
            var sample = $element.find('#samples-list');

            sample.on('change', function (e) {
                Board.getPedal('sample').loadBuffer(this.value);

                if ($rootScope.isLoading) {
                    $rootScope.isLoading = false;
                }
            });


        }
    };
}
samplesList.$inject = ["$rootScope", "Board"];
angular
    .module('Input')
    .directive('samplesList', samplesList);

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
                time.val(parseFloat(0.31));
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
        this.delay.delayTime.value = parseFloat( 0.31 );
        this.feedback.gain.value = parseFloat( 0.75 );

        this.feedback.connect(this.delay);

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
                return (1 + k) * x / (1 + k * Math.abs(x));
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

        this.depth.gain.value = parseFloat( 0.0020 );

        this.feedback.gain.value = parseFloat( 0.60 );

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
                return this.tanh(x);
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZHVsZS5qcyIsImJvYXJkL21vZHVsZS5qcyIsImlucHV0L21vZHVsZS5qcyIsInBlZGFsL21vZHVsZS5qcyIsInV0aWxzL21vZHVsZS5qcyIsImNvbmZpZy5qcyIsImJvYXJkL2JvYXJkLmN0cmwuanMiLCJib2FyZC9ib2FyZC5zdmMuanMiLCJpbnB1dC9maWxlX2lucHV0LnN2Yy5qcyIsImlucHV0L2lucHV0X2NvbnRyb2xzLmRpcmVjdGl2ZS5qcyIsImlucHV0L2xpbmVfaW5wdXQuc3ZjLmpzIiwiaW5wdXQvc2FtcGxlc19saXN0LmRpcmVjdGl2ZS5qcyIsInV0aWxzL3NoYXJlZF9hdWRpb19jb250ZXh0LmZhY3RvcnkuanMiLCJwZWRhbC9jYWJpbmV0L3BlZGFsX2NhYmluZXQuc3ZjLmpzIiwicGVkYWwvY2hvcnVzL2Nob3J1c19wZWRhbC5kaXJlY3RpdmUuanMiLCJwZWRhbC9jaG9ydXMvcGVkYWxfY2hvcnVzLnN2Yy5qcyIsInBlZGFsL2RlbGF5L2RlbGF5X3BlZGFsLmRpcmVjdGl2ZS5qcyIsInBlZGFsL2RlbGF5L3BlZGFsX2RlbGF5LnN2Yy5qcyIsInBlZGFsL2Rpc3RvcnRpb24vZGlzdG9ydGlvbl9wZWRhbC5kaXJlY3RpdmUuanMiLCJwZWRhbC9kaXN0b3J0aW9uL3BlZGFsX2Rpc3RvcnRpb24uc3ZjLmpzIiwicGVkYWwvZmxhbmdlci9mbGFuZ2VyX3BlZGFsLmRpcmVjdGl2ZS5qcyIsInBlZGFsL2ZsYW5nZXIvcGVkYWxfZmxhbmdlci5zdmMuanMiLCJwZWRhbC9vdmVyZHJpdmUvb3ZlcmRyaXZlX3BlZGFsLmRpcmVjdGl2ZS5qcyIsInBlZGFsL292ZXJkcml2ZS9wZWRhbF9vdmVyZHJpdmUuc3ZjLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0lBQ0E7SUFDQTtBQUNBOztBQ0hBO0lBQ0E7SUFDQTtJQUNBO0FBQ0E7O0FDSkE7O0FBRUE7SUFDQTtBQUNBOztBQ0pBO0lBQ0E7QUFDQTs7QUNGQTs7QUFFQTs7QUNGQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtRQUNBO1lBQ0E7WUFDQSxhQUFBLFNBQUE7WUFDQTtRQUNBO0FBQ0EsQ0FBQTs7O0FBRUE7SUFDQTtJQUNBO0FDZkE7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRUE7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0FBRUEsQ0FBQTs7O0FBRUE7SUFDQTtJQUNBLGFBQUEsU0FBQTs7QUN6QkE7SUFDQTtRQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO2dCQUNBO1lBQ0E7WUFDQTtRQUNBO1lBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7TUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsVUFBQSxLQUFBOztBQ2pFQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7O1FBRUE7WUFDQTtnQkFDQTtnQkFDQTtvQkFDQTt3QkFDQTt3QkFDQTtvQkFDQTtvQkFDQTtnQkFDQTtnQkFDQTtvQkFDQTtnQkFDQTtZQUNBO1FBQ0E7O1FBRUE7WUFDQTtRQUNBOztRQUVBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBOztRQUVBOztRQUVBO0lBQ0E7OztJQUdBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO0FBQ0EsQ0FBQTs7OztBQUdBO0lBQ0E7SUFDQSxVQUFBLFNBQUE7O0FDOUVBO0lBQ0E7UUFDQTtRQUNBO1FBQ0E7WUFDQTtnQkFDQTtnQkFDQTs7WUFFQTtnQkFDQTtvQkFDQTtvQkFDQTtnQkFDQTtnQkFDQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTtRQUNBO0lBQ0E7QUFDQTtBQUNBO0lBQ0E7SUFDQSxZQUFBLGFBQUE7O0FDL0JBOztJQUVBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTs7UUFFQTtZQUNBO2dCQUNBO29CQUNBO29CQUNBO29CQUNBO29CQUNBO2dCQUNBO1lBQ0E7UUFDQTtZQUNBO1lBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxTQUFBOztBQzlDQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7O1lBRUE7WUFDQTs7WUFFQTtnQkFDQTs7Z0JBRUE7b0JBQ0E7Z0JBQ0E7WUFDQTs7O1FBR0E7SUFDQTtBQUNBLENBQUE7O0FBQ0E7SUFDQTtJQUNBLFlBQUEsV0FBQTs7QUN4QkE7O0lBRUE7O0lBRUE7UUFDQTtJQUNBOztJQUVBO0FBQ0E7QUFDQTtJQUNBO0lBQ0EsVUFBQSxrQkFBQTs7QUNaQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7O1FBRUE7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7UUFDQTs7UUFFQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxPQUFBOztBQzlDQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7OztZQUdBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxXQUFBOztBQy9DQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTs7UUFFQTs7UUFFQTs7UUFFQTtRQUNBOztRQUVBOztRQUVBOztRQUVBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7WUFDQTs7WUFFQTtRQUNBO1lBQ0E7WUFDQTs7WUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO0FBQ0EsQ0FBQTs7OztBQUdBO0lBQ0E7SUFDQSxVQUFBLE1BQUE7O0FDcEVBO0lBQ0E7UUFDQTtRQUNBO1FBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtnQkFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxVQUFBOztBQ3JDQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7O1FBRUE7O1FBRUE7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBOztZQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7O1lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxLQUFBOztBQ3pEQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtnQkFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxlQUFBOztBQ3RDQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTs7UUFFQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBOztRQUVBO1lBQ0E7UUFDQTs7UUFFQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7O1lBRUE7UUFDQTtZQUNBO1lBQ0E7O1lBRUE7O1lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsVUFBQTs7QUNsSUE7SUFDQTtRQUNBO1FBQ0E7UUFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO2dCQUNBO2dCQUNBO2dCQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBO1FBQ0E7SUFDQTtBQUNBLENBQUE7O0FBQ0E7SUFDQTtJQUNBLFlBQUEsWUFBQTs7QUN2REE7O0lBRUE7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBOztRQUVBOztRQUVBOztRQUVBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBOztRQUVBOztRQUVBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTs7WUFFQTtRQUNBO1lBQ0E7WUFDQTtZQUNBOztZQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsT0FBQTs7QUNoRkE7SUFDQTtRQUNBO1FBQ0E7UUFDQTtZQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBO1FBQ0E7SUFDQTtBQUNBLENBQUE7O0FBQ0E7SUFDQTtJQUNBLFlBQUEsY0FBQTs7QUN0Q0E7O0lBRUE7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7O1FBRUE7O1FBRUE7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBOztRQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7WUFDQTs7UUFFQTtZQUNBO1FBQ0E7O1FBRUE7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7Z0JBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7O1lBRUE7UUFDQTtZQUNBO1lBQ0E7O1lBRUE7O1lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsU0FBQSIsImZpbGUiOiJhcHAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJhbmd1bGFyLm1vZHVsZSgnR3RyUGVkYWxzJywgW1xuICAgICduZ1JvdXRlJyxcbiAgICAnQm9hcmQnXG5dKTtcbiIsImFuZ3VsYXIubW9kdWxlKCdCb2FyZCcsIFtcbiAgICAnSW5wdXQnLFxuICAgICdQZWRhbCcsXG4gICAgJ1NoYXJlZEF1ZGlvQ29udGV4dCdcbl0pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5hbmd1bGFyLm1vZHVsZSgnSW5wdXQnLCBbXG4gICAgJ1NoYXJlZEF1ZGlvQ29udGV4dCdcbl0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ1BlZGFsJywgW1xuICAgICdTaGFyZWRBdWRpb0NvbnRleHQnXG5dKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuYW5ndWxhci5tb2R1bGUoJ1NoYXJlZEF1ZGlvQ29udGV4dCcsIFtdKTtcbiIsImZ1bmN0aW9uIGNvbmZpZygkcm91dGVQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhID0gbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhO1xuICAgIHdpbmRvdy5BdWRpb0NvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQ7XG5cbiAgICAkbG9jYXRpb25Qcm92aWRlci5odG1sNU1vZGUodHJ1ZSk7XG4gICAgJHJvdXRlUHJvdmlkZXJcbiAgICAgICAgLndoZW4oJy8nLCB7XG4gICAgICAgICAgICB0ZW1wbGF0ZVVybDogJy90ZW1wbGF0ZXMvYm9hcmQuaHRtbCcsXG4gICAgICAgICAgICBjb250cm9sbGVyOiAnQm9hcmRDdHJsJyxcbiAgICAgICAgICAgIGNvbnRyb2xsZXJBczogJ3ZtJ1xuICAgICAgICB9KTtcbn1cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0d0clBlZGFscycpXG4gICAgLmNvbmZpZyhjb25maWcpOyIsImZ1bmN0aW9uIEJvYXJkQ3RybCAoJHNjb3BlLCBCb2FyZCkge1xuICAgIHZhciB2bSA9IHRoaXM7XG5cbiAgICBCb2FyZC5sb2FkU291cmNlKCk7XG4gICAgQm9hcmQubG9hZFBlZGFscygpO1xuICAgIEJvYXJkLndpcmVVcEJvYXJkKCk7XG5cbiAgICAkc2NvcGUuc2FtcGxlcyA9IEJvYXJkLmdldFBlZGFsKCdzYW1wbGUnKS5nZXRGaWxlcygpO1xuXG4gICAgdm0ucGxheSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBCb2FyZC5wbGF5U2FtcGxlKCk7XG4gICAgfTtcblxuICAgIHZtLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgQm9hcmQuc3RvcFNhbXBsZSgpO1xuICAgIH07XG5cbiAgICB2bS5saXZlSW5wdXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgQm9hcmQudG9nZ2xlTGl2ZUlucHV0KCk7XG4gICAgfVxuXG59XG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdCb2FyZCcpXG4gICAgLmNvbnRyb2xsZXIoJ0JvYXJkQ3RybCcsIEJvYXJkQ3RybCk7XG4iLCJmdW5jdGlvbiBCb2FyZCgkcm9vdFNjb3BlLCBGaWxlSW5wdXQsIExpbmVJbnB1dCwgQ2FiaW5ldCwgRGlzdG9ydGlvbiwgT3ZlcmRyaXZlLCBGbGFuZ2VyLCBDaG9ydXMsIERlbGF5LCBTaGFyZWRBdWRpb0NvbnRleHQpIHtcbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpLFxuICAgICAgICBib2FyZElucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuXG4gICAgdmFyIHBlZGFscyA9IHtcbiAgICAgICAgc2FtcGxlOiBuZXcgRmlsZUlucHV0KCksXG4gICAgICAgIGxpbmU6IG5ldyBMaW5lSW5wdXQoKSxcbiAgICAgICAgY2FiaW5ldDogbmV3IENhYmluZXQoKSxcbiAgICAgICAgZGlzdG9ydGlvbjogbmV3IERpc3RvcnRpb24oKSxcbiAgICAgICAgb3ZlcmRyaXZlOiBuZXcgT3ZlcmRyaXZlKCksXG4gICAgICAgIGZsYW5nZXI6IG5ldyBGbGFuZ2VyKCksXG4gICAgICAgIGNob3J1czogbmV3IENob3J1cygpLFxuICAgICAgICBkZWxheTogbmV3IERlbGF5KClcbiAgICB9O1xuXG4gICAgdGhpcy5sb2FkU291cmNlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBwZWRhbHMuc2FtcGxlLmNvbm5lY3QoYm9hcmRJbnB1dCk7XG4gICAgfTtcblxuICAgIHRoaXMubG9hZFBlZGFscyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLmNhYmluZXQubG9hZCgnYXNzZXRzL2lyLzUxNTAud2F2Jyk7XG4gICAgICAgIHBlZGFscy5kaXN0b3J0aW9uLmxvYWQoJ2Rpc3Q2Jyk7XG4gICAgICAgIHBlZGFscy5vdmVyZHJpdmUubG9hZCgnb3ZlcmRyaXZlJyk7XG4gICAgICAgIHBlZGFscy5mbGFuZ2VyLmxvYWQoKTtcbiAgICAgICAgcGVkYWxzLmNob3J1cy5sb2FkKCk7XG4gICAgICAgIHBlZGFscy5kZWxheS5sb2FkKCk7XG4gICAgfTtcblxuICAgIHRoaXMud2lyZVVwQm9hcmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGJvYXJkSW5wdXQuY29ubmVjdChwZWRhbHMuZGlzdG9ydGlvbi5pbnB1dCk7XG4gICAgICAgIHBlZGFscy5kaXN0b3J0aW9uLmNvbm5lY3QocGVkYWxzLm92ZXJkcml2ZS5pbnB1dCk7XG4gICAgICAgIHBlZGFscy5vdmVyZHJpdmUuY29ubmVjdChwZWRhbHMuZmxhbmdlci5pbnB1dCk7XG4gICAgICAgIHBlZGFscy5mbGFuZ2VyLmNvbm5lY3QocGVkYWxzLmNob3J1cy5pbnB1dCk7XG4gICAgICAgIHBlZGFscy5jaG9ydXMuY29ubmVjdChwZWRhbHMuZGVsYXkuaW5wdXQpO1xuICAgICAgICBwZWRhbHMuZGVsYXkuY29ubmVjdChwZWRhbHMuY2FiaW5ldC5pbnB1dCk7XG4gICAgICAgIHBlZGFscy5jYWJpbmV0LmNvbm5lY3Qoc3RhZ2UuZGVzdGluYXRpb24pO1xuICAgIH07XG5cbiAgICB0aGlzLnBsYXlTYW1wbGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHBlZGFscy5zYW1wbGUucGxheSgpO1xuICAgIH07XG5cbiAgICB0aGlzLnN0b3BTYW1wbGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHBlZGFscy5zYW1wbGUuc3RvcCgpO1xuICAgIH07XG5cbiAgICB0aGlzLnRvZ2dsZUxpdmVJbnB1dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCFwZWRhbHMubGluZS5pc1N0cmVhbWluZykge1xuICAgICAgICAgICAgcGVkYWxzLmxpbmUubG9hZCgpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oJ2xpbmVpbjpsb2FkZWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcGVkYWxzLmxpbmUuc3RyZWFtLmNvbm5lY3QoYm9hcmRJbnB1dCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHBlZGFscy5saW5lLmlzU3RyZWFtaW5nID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZGFscy5saW5lLnN0b3AoKTtcbiAgICAgICAgICAgIHBlZGFscy5saW5lLmlzU3RyZWFtaW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdGhpcy5nZXRQZWRhbCA9IGZ1bmN0aW9uIChlZmZlY3QpIHtcbiAgICAgIHJldHVybiBwZWRhbHNbZWZmZWN0XTtcbiAgICB9O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0JvYXJkJylcbiAgICAuc2VydmljZSgnQm9hcmQnLCBCb2FyZCk7XG4iLCJmdW5jdGlvbiBGaWxlSW5wdXQgKFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuXG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKTtcblxuICAgIHZhciBGaWxlSW5wdXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuc291cmNlID0gbnVsbDtcbiAgICAgICAgdGhpcy5zYW1wbGUgPSBudWxsO1xuICAgIH07XG5cbiAgICBGaWxlSW5wdXQucHJvdG90eXBlLmdldEZpbGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAge25hbWU6ICdPcGVuJywgdXJsOiAnYXNzZXRzL3NhbXBsZXMvb3Blbi53YXYnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQ2hvcmRzJywgdXJsOiAnYXNzZXRzL3NhbXBsZXMvY2hvcmRzLndhdid9LFxuICAgICAgICAgICAge25hbWU6ICdFdmVybG9uZycsIHVybDogJ2Fzc2V0cy9zYW1wbGVzL2V2ZXJsb25nLndhdid9LFxuICAgICAgICAgICAge25hbWU6ICdPY3RhdmUgQ2hvcmRzJywgdXJsOiAnYXNzZXRzL3NhbXBsZXMvb2N0YXZlcy53YXYnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnRm9vIEZpZ2h0ZXJzJywgdXJsOiAnYXNzZXRzL3NhbXBsZXMvRkYud2F2J30sXG4gICAgICAgICAgICB7bmFtZTogJ0xlYWQnLCB1cmw6ICdhc3NldHMvc2FtcGxlcy90d2lkZGxlcy53YXYnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnRGVsYXknLCB1cmw6ICdhc3NldHMvc2FtcGxlcy9kZWxheS53YXYnfVxuICAgICAgICBdO1xuICAgIH07XG5cbiAgICBGaWxlSW5wdXQucHJvdG90eXBlLmxvYWRCdWZmZXIgPSBmdW5jdGlvbih1cmwpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgcmVxdWVzdC5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gXCJhcnJheWJ1ZmZlclwiO1xuXG4gICAgICAgIHZhciBsb2FkZXIgPSB0aGlzO1xuXG4gICAgICAgIHJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzdGFnZS5kZWNvZGVBdWRpb0RhdGEoXG4gICAgICAgICAgICAgICAgcmVxdWVzdC5yZXNwb25zZSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbihidWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFidWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFsZXJ0KCdlcnJvciBkZWNvZGluZyBmaWxlIGRhdGE6ICcgKyB1cmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxvYWRlci5zYW1wbGUgPSBidWZmZXI7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdkZWNvZGVBdWRpb0RhdGEgZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgYWxlcnQoJ0J1ZmZlckxvYWRlcjogWEhSIGVycm9yJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXF1ZXN0LnNlbmQoKTtcbiAgICB9O1xuXG4gICAgRmlsZUlucHV0LnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBGaWxlSW5wdXQucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zb3VyY2UgPSBzdGFnZS5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICAgICAgdGhpcy5zb3VyY2UubG9vcCA9IHRydWU7XG4gICAgICAgIHRoaXMuc291cmNlLmJ1ZmZlciA9IHRoaXMuc2FtcGxlO1xuXG4gICAgICAgIHRoaXMuc291cmNlLmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgIHRoaXMuc291cmNlLnN0YXJ0KDApO1xuICAgIH07XG5cblxuICAgIEZpbGVJbnB1dC5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnNvdXJjZS5zdG9wKCk7XG4gICAgICAgIHRoaXMuc291cmNlLmRpc2Nvbm5lY3QoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIEZpbGVJbnB1dDtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnSW5wdXQnKVxuICAgIC5mYWN0b3J5KCdGaWxlSW5wdXQnLCBGaWxlSW5wdXQpO1xuIiwiZnVuY3Rpb24gaW5wdXRDb250cm9scygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvY29udHJvbHMuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBzY29wZSwgZWxlbWVudCkge1xuICAgICAgICAgICAgdmFyIHN0YXJ0ID0gYW5ndWxhci5lbGVtZW50KCcuZ2x5cGhpY29uLXBsYXknKSxcbiAgICAgICAgICAgICAgICBzdG9wID0gYW5ndWxhci5lbGVtZW50KCcuZ2x5cGhpY29uLXN0b3AnKSxcbiAgICAgICAgICAgICAgICBsaXZlSW5wdXQgPSBhbmd1bGFyLmVsZW1lbnQoJy5nbHlwaGljb24tcmVjb3JkJyk7XG5cbiAgICAgICAgICAgIHN0YXJ0Lm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgaWYoJHJvb3RTY29wZS5pc0xvYWRpbmcpe1xuICAgICAgICAgICAgICAgICAgICBhbGVydCgnUGxlYXNlIGxvYWQgYSBzYW1wbGUgZmlyc3QhJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3RvcC5wcm9wKCdkaXNhYmxlZCcsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBzdGFydC5wcm9wKCdkaXNhYmxlZCcsIHRydWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHN0b3Aub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBzdGFydC5wcm9wKCdkaXNhYmxlZCcsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBzdG9wLnByb3AoJ2Rpc2FibGVkJywgdHJ1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbGl2ZUlucHV0Lm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgbGl2ZUlucHV0LnRvZ2dsZUNsYXNzKFwiYnRuLWRhbmdlclwiKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdJbnB1dCcpXG4gICAgLmRpcmVjdGl2ZSgnaW5wdXRDb250cm9scycsIGlucHV0Q29udHJvbHMpO1xuIiwiZnVuY3Rpb24gTGluZUlucHV0KCRyb290U2NvcGUsIFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuXG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKTtcblxuICAgIHZhciBMaW5lSW5wdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLnN0cmVhbSA9IG51bGw7XG4gICAgICAgIHRoaXMuaXNTdHJlYW1pbmcgPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgTGluZUlucHV0LnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSh7XG4gICAgICAgICAgICBcImF1ZGlvXCI6IHtcbiAgICAgICAgICAgICAgICBcIm9wdGlvbmFsXCI6IFtcbiAgICAgICAgICAgICAgICAgICAge1wiZ29vZ0VjaG9DYW5jZWxsYXRpb25cIjogXCJmYWxzZVwifSxcbiAgICAgICAgICAgICAgICAgICAge1wiZ29vZ0F1dG9HYWluQ29udHJvbFwiOiBcImZhbHNlXCJ9LFxuICAgICAgICAgICAgICAgICAgICB7XCJnb29nTm9pc2VTdXBwcmVzc2lvblwiOiBcImZhbHNlXCJ9LFxuICAgICAgICAgICAgICAgICAgICB7XCJnb29nSGlnaHBhc3NGaWx0ZXJcIjogXCJmYWxzZVwifVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24gKHN0cmVhbSkge1xuICAgICAgICAgICAgc2VsZi5zdHJlYW0gPSBzdGFnZS5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kZW1pdCgnbGluZWluOmxvYWRlZCcpO1xuICAgICAgICAgICAgdGhpcy5pc1N0cmVhbWluZyA9IHRydWU7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0d1aXRhciBzdHJlYW0gZmFpbGVkOiAnICsgZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIExpbmVJbnB1dC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgICAgICAgdGhpcy5zdHJlYW0uY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBMaW5lSW5wdXQucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3RyZWFtLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgdGhpcy5pc1N0cmVhbWluZyA9IGZhbHNlO1xuICAgIH07XG5cbiAgICByZXR1cm4gTGluZUlucHV0O1xufVxuXG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdJbnB1dCcpXG4gICAgLnNlcnZpY2UoJ0xpbmVJbnB1dCcsIExpbmVJbnB1dCk7XG4iLCJmdW5jdGlvbiBzYW1wbGVzTGlzdCgkcm9vdFNjb3BlLCBCb2FyZCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL3NhbXBsZXMtbGlzdC5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuaXNMb2FkaW5nID0gdHJ1ZTtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coJGVsZW1lbnQpO1xuICAgICAgICAgICAgdmFyIHNhbXBsZSA9ICRlbGVtZW50LmZpbmQoJyNzYW1wbGVzLWxpc3QnKTtcblxuICAgICAgICAgICAgc2FtcGxlLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgIEJvYXJkLmdldFBlZGFsKCdzYW1wbGUnKS5sb2FkQnVmZmVyKHRoaXMudmFsdWUpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCRyb290U2NvcGUuaXNMb2FkaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICRyb290U2NvcGUuaXNMb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICB9XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdJbnB1dCcpXG4gICAgLmRpcmVjdGl2ZSgnc2FtcGxlc0xpc3QnLCBzYW1wbGVzTGlzdCk7XG4iLCJmdW5jdGlvbiBTaGFyZWRBdWRpb0NvbnRleHQgKCkge1xuXG4gICAgdmFyIFNoYXJlZEF1ZGlvQ29udGV4dCA9IHt9O1xuXG4gICAgU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRleHQgfHwgKHRoaXMuY29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQpO1xuICAgIH07XG5cbiAgICByZXR1cm4gU2hhcmVkQXVkaW9Db250ZXh0O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1NoYXJlZEF1ZGlvQ29udGV4dCcpXG4gICAgLmZhY3RvcnkoJ1NoYXJlZEF1ZGlvQ29udGV4dCcsIFNoYXJlZEF1ZGlvQ29udGV4dCk7XG4iLCJmdW5jdGlvbiBDYWJpbmV0IChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgQ2FiaW5ldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmlucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5ib29zdCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5jb252b2x2ZXIgPSBzdGFnZS5jcmVhdGVDb252b2x2ZXIoKTtcbiAgICB9O1xuXG4gICAgQ2FiaW5ldC5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKGlyUGF0aCkge1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsIGlyUGF0aCwgdHJ1ZSk7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcblxuICAgICAgICB2YXIgbG9hZGVyID0gdGhpcztcblxuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHN0YWdlLmRlY29kZUF1ZGlvRGF0YShyZXF1ZXN0LnJlc3BvbnNlLCBmdW5jdGlvbiAoYnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyLmNvbnZvbHZlci5idWZmZXIgPSBidWZmZXI7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgIGlmIChlKSBjb25zb2xlLmxvZyhcIkNhbm5vdCBsb2FkIGNhYmluZXRcIiArIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVxdWVzdC5zZW5kKG51bGwpO1xuXG4gICAgICAgIHRoaXMuaW5wdXQuZ2Fpbi52YWx1ZSA9IDM7XG4gICAgICAgIHRoaXMuYm9vc3QuZ2Fpbi52YWx1ZSA9IDE7XG5cbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMuY29udm9sdmVyKTtcbiAgICAgICAgdGhpcy5jb252b2x2ZXIuY29ubmVjdCh0aGlzLmJvb3N0KTtcbiAgICAgICAgdGhpcy5ib29zdC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgQ2FiaW5ldC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhYmluZXQ7XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZmFjdG9yeSgnQ2FiaW5ldCcsIENhYmluZXQpO1xuIiwiZnVuY3Rpb24gY2hvcnVzUGVkYWwgKEJvYXJkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL2Nob3J1cy5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBjaG9ydXMgPSBCb2FyZC5nZXRQZWRhbCgnY2hvcnVzJyk7XG5cbiAgICAgICAgICAgIHZhciByYXRlID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNjaG9ydXMtcmF0ZScpLFxuICAgICAgICAgICAgICAgIGRlbGF5ID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNjaG9ydXMtZGVsYXknKSxcbiAgICAgICAgICAgICAgICBkZXB0aCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjY2hvcnVzLWRlcHRoJyksXG4gICAgICAgICAgICAgICAgZm9vdHN3aXRjaCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLXN3aXRjaCNjaG9ydXMtZm9vdC1zdycpLFxuICAgICAgICAgICAgICAgIGxlZCA9ICRlbGVtZW50LmZpbmQoJy5sZWQnKTtcblxuXG4gICAgICAgICAgICByYXRlLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgY2hvcnVzLnNldFJhdGUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJhdGUub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmF0ZS52YWwocGFyc2VGbG9hdCgzLjUpKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZWxheS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGNob3J1cy5zZXREZWxheShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZGVsYXkub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZGVsYXkudmFsKHBhcnNlRmxvYXQoMC4wMykpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRlcHRoLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgY2hvcnVzLnNldERlcHRoKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZXB0aC5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBkZXB0aC52YWwocGFyc2VGbG9hdCgwLjAwMikpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZvb3Rzd2l0Y2gub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGxlZC50b2dnbGVDbGFzcygnYWN0aXZlJyk7XG4gICAgICAgICAgICAgICAgY2hvcnVzLmJ5cGFzcygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZGlyZWN0aXZlKCdjaG9ydXNQZWRhbCcsIGNob3J1c1BlZGFsKTtcbiIsImZ1bmN0aW9uIENob3J1cyAoU2hhcmVkQXVkaW9Db250ZXh0KSB7XG5cbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpO1xuXG4gICAgdmFyIENob3J1cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmlucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5kZXB0aCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vc2MgPSBzdGFnZS5jcmVhdGVPc2NpbGxhdG9yKCk7XG4gICAgICAgIHRoaXMuZGVsYXkgPSBzdGFnZS5jcmVhdGVEZWxheSgpO1xuICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgIH07XG5cbiAgICBDaG9ydXMucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5vc2MudHlwZSA9ICdzaW5lJztcbiAgICAgICAgdGhpcy5vc2MuZnJlcXVlbmN5LnZhbHVlID0gcGFyc2VGbG9hdCggMy41ICk7XG5cbiAgICAgICAgdGhpcy5kZWxheS5kZWxheVRpbWUudmFsdWUgPSBwYXJzZUZsb2F0KCAwLjAzICk7XG5cbiAgICAgICAgdGhpcy5kZXB0aC5nYWluLnZhbHVlID0gcGFyc2VGbG9hdCggMC4wMDIgKTtcblxuICAgICAgICB0aGlzLm9zYy5jb25uZWN0KHRoaXMuZGVwdGgpO1xuICAgICAgICB0aGlzLmRlcHRoLmNvbm5lY3QodGhpcy5kZWxheS5kZWxheVRpbWUpO1xuXG4gICAgICAgIHRoaXMuZGVsYXkuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgdGhpcy5vc2Muc3RhcnQoMCk7XG5cbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgQ2hvcnVzLnByb3RvdHlwZS5zZXRSYXRlID0gZnVuY3Rpb24oc3BlZWQpIHtcbiAgICAgICAgdGhpcy5vc2MuZnJlcXVlbmN5LnZhbHVlID0gcGFyc2VGbG9hdChzcGVlZCk7XG4gICAgfTtcblxuICAgIENob3J1cy5wcm90b3R5cGUuc2V0RGVsYXkgPSBmdW5jdGlvbihkZWxheSkge1xuICAgICAgICB0aGlzLmRlbGF5LmRlbGF5VGltZS52YWx1ZSA9IHBhcnNlRmxvYXQoZGVsYXkpO1xuICAgIH07XG5cbiAgICBDaG9ydXMucHJvdG90eXBlLnNldERlcHRoID0gZnVuY3Rpb24oZGVwdGgpIHtcbiAgICAgICAgdGhpcy5kZXB0aC5nYWluLnZhbHVlID0gcGFyc2VGbG9hdChkZXB0aCk7XG4gICAgfTtcblxuICAgIENob3J1cy5wcm90b3R5cGUuYnlwYXNzID0gZnVuY3Rpb24oKXtcbiAgICAgICAgaWYodGhpcy5pc0J5cGFzc2VkKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLmRlbGF5KTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIENob3J1cy5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENob3J1cztcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdDaG9ydXMnLCBDaG9ydXMpO1xuIiwiZnVuY3Rpb24gZGVsYXlQZWRhbCAoQm9hcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvZGVsYXkuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uICgkc2NvcGUsICRlbGVtZW50KSB7XG4gICAgICAgICAgICB2YXIgZGVsYXkgPSBCb2FyZC5nZXRQZWRhbCgnZGVsYXknKTtcblxuICAgICAgICAgICAgdmFyIHRpbWUgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI2RlbGF5LXRpbWUnKSxcbiAgICAgICAgICAgICAgICBmZWVkYmFjayA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZGVsYXktZmVlZGJhY2snKSxcbiAgICAgICAgICAgICAgICBmb290c3dpdGNoID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8tc3dpdGNoI2RlbGF5LWZvb3Qtc3cnKSxcbiAgICAgICAgICAgICAgICBsZWQgPSAkZWxlbWVudC5maW5kKCcubGVkJyk7XG5cbiAgICAgICAgICAgIHRpbWUub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBkZWxheS5zZXRUaW1lKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aW1lLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRpbWUudmFsKHBhcnNlRmxvYXQoMC4zMSkpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZlZWRiYWNrLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZGVsYXkuc2V0RmVlZGJhY2soZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZlZWRiYWNrLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGZlZWRiYWNrLnZhbChwYXJzZUZsb2F0KDAuNzUpKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmb290c3dpdGNoLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBsZWQudG9nZ2xlQ2xhc3MoJ2FjdGl2ZScpO1xuICAgICAgICAgICAgICAgIGRlbGF5LmJ5cGFzcygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZGlyZWN0aXZlKCdkZWxheVBlZGFsJywgZGVsYXlQZWRhbCk7XG4iLCJmdW5jdGlvbiBEZWxheSAoU2hhcmVkQXVkaW9Db250ZXh0KSB7XG5cbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpO1xuXG4gICAgdmFyIGRlbGF5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmZlZWRiYWNrID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmRlbGF5ID0gc3RhZ2UuY3JlYXRlRGVsYXkoKTtcbiAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gdHJ1ZTtcbiAgICB9O1xuXG4gICAgZGVsYXkucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5kZWxheS5kZWxheVRpbWUudmFsdWUgPSBwYXJzZUZsb2F0KCAwLjMxICk7XG4gICAgICAgIHRoaXMuZmVlZGJhY2suZ2Fpbi52YWx1ZSA9IHBhcnNlRmxvYXQoIDAuNzUgKTtcblxuICAgICAgICB0aGlzLmZlZWRiYWNrLmNvbm5lY3QodGhpcy5kZWxheSk7XG5cbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgZGVsYXkucHJvdG90eXBlLnNldFRpbWUgPSBmdW5jdGlvbih0aW1lKSB7XG4gICAgICAgIHRoaXMuZGVsYXkuZGVsYXlUaW1lLnZhbHVlID0gcGFyc2VGbG9hdCh0aW1lKTtcbiAgICB9O1xuXG4gICAgZGVsYXkucHJvdG90eXBlLnNldEZlZWRiYWNrID0gZnVuY3Rpb24oZmVlZGJhY2spIHtcbiAgICAgICAgdGhpcy5mZWVkYmFjay5nYWluLnZhbHVlID0gcGFyc2VGbG9hdChmZWVkYmFjayk7XG4gICAgfTtcblxuICAgIGRlbGF5LnByb3RvdHlwZS5ieXBhc3MgPSBmdW5jdGlvbigpe1xuICAgICAgICBpZih0aGlzLmlzQnlwYXNzZWQpIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLmRlbGF5KTtcbiAgICAgICAgICAgIHRoaXMuZGVsYXkuY29ubmVjdCh0aGlzLmZlZWRiYWNrKTtcbiAgICAgICAgICAgIHRoaXMuZGVsYXkuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmRlbGF5LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZGVsYXkucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbih0YXJnZXQpe1xuICAgICAgICB0aGlzLm91dHB1dC5jb25uZWN0KHRhcmdldCk7XG4gICAgfTtcblxuICAgIHJldHVybiBkZWxheTtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdEZWxheScsIERlbGF5KTtcbiIsImZ1bmN0aW9uIGRpc3RvcnRpb25QZWRhbCAoQm9hcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvZGlzdG9ydGlvbi5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IE1JRF9MRVZFTCA9IDUuNTtcbiAgICAgICAgICAgIHZhciBkaXN0b3J0aW9uID0gQm9hcmQuZ2V0UGVkYWwoJ2Rpc3RvcnRpb24nKTtcblxuICAgICAgICAgICAgdmFyIHZvbHVtZSA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZGlzdG9ydGlvbi12b2x1bWUnKSxcbiAgICAgICAgICAgICAgICB0b25lID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNkaXN0b3J0aW9uLXRvbmUnKSxcbiAgICAgICAgICAgICAgICBmb290c3dpdGNoID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8tc3dpdGNoI2Rpc3RvcnRpb24tZm9vdC1zdycpLFxuICAgICAgICAgICAgICAgIGxlZCA9ICRlbGVtZW50LmZpbmQoJy5sZWQnKTtcblxuICAgICAgICAgICAgdm9sdW1lLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZGlzdG9ydGlvbi5zZXRWb2x1bWUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2b2x1bWUudmFsKE1JRF9MRVZFTCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdG9uZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGRpc3RvcnRpb24uc2V0VG9uZShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdG9uZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB0b25lLnZhbChNSURfTEVWRUwpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZvb3Rzd2l0Y2gub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGxlZC50b2dnbGVDbGFzcygnYWN0aXZlJyk7XG4gICAgICAgICAgICAgICAgZGlzdG9ydGlvbi5ieXBhc3MoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdQZWRhbCcpXG4gICAgLmRpcmVjdGl2ZSgnZGlzdG9ydGlvblBlZGFsJywgZGlzdG9ydGlvblBlZGFsKTtcbiIsImZ1bmN0aW9uIERpc3RvcnRpb24gKFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuXG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKTtcblxuICAgIHZhciBEaXN0b3J0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmdhaW4gPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlciA9IHN0YWdlLmNyZWF0ZVdhdmVTaGFwZXIoKTtcbiAgICAgICAgdGhpcy5sb3dwYXNzID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5ib29zdCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmN1dCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLnZvbHVtZSA9IDcuNTtcbiAgICAgICAgdGhpcy50b25lID0gMjA7XG4gICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbih0eXBlKSB7XG5cbiAgICAgICAgdGhpcy5nYWluLmdhaW4udmFsdWUgPSB0aGlzLnZvbHVtZTtcblxuICAgICAgICB0aGlzLmxvd3Bhc3MudHlwZSA9IFwibG93cGFzc1wiO1xuICAgICAgICB0aGlzLmxvd3Bhc3MuZnJlcXVlbmN5LnZhbHVlID0gNTAwMDtcblxuICAgICAgICB0aGlzLmJvb3N0LnR5cGUgPSBcImxvd3NoZWxmXCI7XG4gICAgICAgIHRoaXMuYm9vc3QuZnJlcXVlbmN5LnZhbHVlID0gMTAwO1xuICAgICAgICB0aGlzLmJvb3N0LmdhaW4udmFsdWUgPSA2O1xuXG4gICAgICAgIHRoaXMuY3V0LnR5cGUgPSBcImxvd3NoZWxmXCI7XG4gICAgICAgIHRoaXMuY3V0LmZyZXF1ZW5jeS52YWx1ZSA9IDEwMDtcbiAgICAgICAgdGhpcy5jdXQuZ2Fpbi52YWx1ZSA9IC02O1xuXG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5jdXJ2ZSA9IHRoaXMubWFrZURpc3RvcnRpb25DdXJ2ZSgxMCwgdHlwZSk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5vdmVyc2FtcGxlID0gJzR4JztcblxuICAgICAgICB0aGlzLmhpZ2hwYXNzLnR5cGUgPSBcImhpZ2hwYXNzXCI7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MuZnJlcXVlbmN5LnZhbHVlID0gdGhpcy50b25lO1xuXG4gICAgICAgIHRoaXMuZ2Fpbi5jb25uZWN0KHRoaXMubG93cGFzcylcbiAgICAgICAgdGhpcy5sb3dwYXNzLmNvbm5lY3QodGhpcy5ib29zdCk7XG4gICAgICAgIHRoaXMuYm9vc3QuY29ubmVjdCh0aGlzLndhdmVzaGFwZXIpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIuY29ubmVjdCh0aGlzLmN1dCk7XG4gICAgICAgIHRoaXMuY3V0LmNvbm5lY3QodGhpcy5oaWdocGFzcyk7XG5cbiAgICAgICAgLy9ieXBhc3MgYnkgZGVmYXVsdFxuICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5tYWtlRGlzdG9ydGlvbkN1cnZlID0gZnVuY3Rpb24gKGFtb3VudCwgdHlwZSkge1xuICAgICAgICB2YXIgayA9IHR5cGVvZiBhbW91bnQgPT09ICdudW1iZXInID8gYW1vdW50IDogMTAsXG4gICAgICAgICAgICBzYW1wbGVzID0gMTEwMjUsXG4gICAgICAgICAgICBjdXJ2ZSA9IG5ldyBGbG9hdDMyQXJyYXkoc2FtcGxlcyk7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzYW1wbGVzOyArK2kpIHtcbiAgICAgICAgICAgIGN1cnZlW2ldID0gdGhpcy5jdXJ2ZUFsZ29yaXRobShpICogMiAvIHNhbXBsZXMgLSAxLCB0eXBlLCBrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjdXJ2ZTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuY3VydmVBbGdvcml0aG0gPSBmdW5jdGlvbiAoeCwgdHlwZSwgaykge1xuICAgICAgICBzd2l0Y2godHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnZGlzdDEnOlxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgtMC41LCBNYXRoLm1pbigwLjUsIHggKiBrKSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0Mic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCB4ICogaykpO1xuICAgICAgICAgICAgY2FzZSAnZGlzdDMnOlxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgtMC41LCBNYXRoLm1pbigxLjUsIHggKSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0NCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIDIuOCAqIE1hdGgucG93KHgsIDMpICsgTWF0aC5wb3coeCwyKSArIC0xLjEgKiB4IC0gMC41O1xuICAgICAgICAgICAgY2FzZSAnZGlzdDUnOlxuICAgICAgICAgICAgICAgIHJldHVybiAoTWF0aC5leHAoeCkgLSBNYXRoLmV4cCgteCAqIDEuMikpIC8gKE1hdGguZXhwKHgpICsgTWF0aC5leHAoLXgpKTtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3Q2JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gKDEgKyBrKSAqIHggLyAoMSArIGsgKiBNYXRoLmFicyh4KSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUudGFuaCA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIGlmICh4ID09PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSBpZiAoeCA9PT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gKE1hdGguZXhwKHgpIC0gTWF0aC5leHAoLXgpKSAvIChNYXRoLmV4cCh4KSArIE1hdGguZXhwKC14KSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuc2lnbiA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIHggPSAreDsgLy8gY29udmVydCB0byBhIG51bWJlclxuICAgICAgICBpZiAoeCA9PT0gMCB8fCBpc05hTih4KSlcbiAgICAgICAgICAgIHJldHVybiB4O1xuICAgICAgICByZXR1cm4geCA+IDAgPyAxIDogLTE7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbih0YXJnZXQpe1xuICAgICAgICB0aGlzLm91dHB1dC5jb25uZWN0KHRhcmdldCk7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLmJ5cGFzcyA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIGlmKHRoaXMuaXNCeXBhc3NlZCkge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5nYWluKTtcbiAgICAgICAgICAgIHRoaXMuaGlnaHBhc3MuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmhpZ2hwYXNzLmRpc2Nvbm5lY3QoKTtcblxuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICAgICAgdGhpcy5nYWluLmdhaW4udmFsdWUgPSAxLjUgKiB2b2x1bWU7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLnNldFRvbmUgPSBmdW5jdGlvbih0b25lKSB7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MuZnJlcXVlbmN5LnZhbHVlID0gMjAgKiB0b25lO1xuICAgIH07XG5cbiAgICByZXR1cm4gRGlzdG9ydGlvbjtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdEaXN0b3J0aW9uJywgRGlzdG9ydGlvbik7XG4iLCJmdW5jdGlvbiBmbGFuZ2VyUGVkYWwgKEJvYXJkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL2ZsYW5nZXIuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uICgkc2NvcGUsICRlbGVtZW50KSB7XG4gICAgICAgICAgICB2YXIgZmxhbmdlciA9IEJvYXJkLmdldFBlZGFsKCdmbGFuZ2VyJyk7XG5cbiAgICAgICAgICAgIHZhciBzcGVlZCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZmxhbmdlci1zcGVlZCcpLFxuICAgICAgICAgICAgICAgIGRlbGF5ID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNmbGFuZ2VyLWRlbGF5JyksXG4gICAgICAgICAgICAgICAgZGVwdGggPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI2ZsYW5nZXItZGVwdGgnKSxcbiAgICAgICAgICAgICAgICBmZWVkYmFjayA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZmxhbmdlci1mZWVkYmFjaycpLFxuICAgICAgICAgICAgICAgIGZvb3Rzd2l0Y2ggPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1zd2l0Y2gjZmxhbmdlci1mb290LXN3JyksXG4gICAgICAgICAgICAgICAgbGVkID0gJGVsZW1lbnQuZmluZCgnLmxlZCcpO1xuXG4gICAgICAgICAgICBzcGVlZC5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGZsYW5nZXIuc2V0U3BlZWQoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHNwZWVkLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHNwZWVkLnZhbChwYXJzZUZsb2F0KDAuNykpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRlbGF5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZmxhbmdlci5zZXREZWxheShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZGVsYXkub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZGVsYXkudmFsKHBhcnNlRmxvYXQoMC4wMDMpKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZXB0aC5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGZsYW5nZXIuc2V0RGVwdGgoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRlcHRoLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGRlcHRoLnZhbChwYXJzZUZsb2F0KDAuMDAyKSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZmVlZGJhY2sub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBmbGFuZ2VyLnNldEZlZWRiYWNrKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmZWVkYmFjay5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBmZWVkYmFjay52YWwocGFyc2VGbG9hdCgwLjYpKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmb290c3dpdGNoLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBsZWQudG9nZ2xlQ2xhc3MoJ2FjdGl2ZScpO1xuICAgICAgICAgICAgICAgIGZsYW5nZXIuYnlwYXNzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5kaXJlY3RpdmUoJ2ZsYW5nZXJQZWRhbCcsIGZsYW5nZXJQZWRhbCk7XG4iLCJmdW5jdGlvbiBGbGFuZ2VyIChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgRmxhbmdlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmlucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy53ZXRnYWluID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmZlZWRiYWNrID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmRlcHRoID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm9zYyA9IHN0YWdlLmNyZWF0ZU9zY2lsbGF0b3IoKTtcbiAgICAgICAgdGhpcy5kZWxheSA9IHN0YWdlLmNyZWF0ZURlbGF5KCk7XG4gICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgfTtcblxuICAgIEZsYW5nZXIucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5vc2MudHlwZSA9ICdzaW5lJztcbiAgICAgICAgdGhpcy5vc2MuZnJlcXVlbmN5LnZhbHVlID0gcGFyc2VGbG9hdCggMC43ICk7XG5cbiAgICAgICAgdGhpcy5kZWxheS5kZWxheVRpbWUudmFsdWUgPSBwYXJzZUZsb2F0KCAwLjAwMyApO1xuXG4gICAgICAgIHRoaXMuZGVwdGguZ2Fpbi52YWx1ZSA9IHBhcnNlRmxvYXQoIDAuMDAyMCApO1xuXG4gICAgICAgIHRoaXMuZmVlZGJhY2suZ2Fpbi52YWx1ZSA9IHBhcnNlRmxvYXQoIDAuNjAgKTtcblxuICAgICAgICB0aGlzLm9zYy5jb25uZWN0KHRoaXMuZGVwdGgpO1xuICAgICAgICB0aGlzLmRlcHRoLmNvbm5lY3QodGhpcy5kZWxheS5kZWxheVRpbWUpO1xuXG4gICAgICAgIHRoaXMuZGVsYXkuY29ubmVjdCggdGhpcy53ZXRnYWluICk7XG4gICAgICAgIHRoaXMuZGVsYXkuY29ubmVjdCggdGhpcy5mZWVkYmFjayApO1xuICAgICAgICB0aGlzLmZlZWRiYWNrLmNvbm5lY3QoIHRoaXMuaW5wdXQgKTtcblxuICAgICAgICB0aGlzLm9zYy5zdGFydCgwKTtcblxuICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5zZXRTcGVlZCA9IGZ1bmN0aW9uKHNwZWVkKSB7XG4gICAgICAgIHRoaXMub3NjLmZyZXF1ZW5jeS52YWx1ZSA9IHBhcnNlRmxvYXQoc3BlZWQpO1xuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5zZXREZWxheSA9IGZ1bmN0aW9uKGRlbGF5KSB7XG4gICAgICAgIHRoaXMuZGVsYXkuZGVsYXlUaW1lLnZhbHVlID0gcGFyc2VGbG9hdChkZWxheSk7XG4gICAgfTtcblxuICAgIEZsYW5nZXIucHJvdG90eXBlLnNldERlcHRoID0gZnVuY3Rpb24oZGVwdGgpIHtcbiAgICAgICAgdGhpcy5kZXB0aC5nYWluLnZhbHVlID0gcGFyc2VGbG9hdChkZXB0aCk7XG4gICAgfTtcblxuICAgIEZsYW5nZXIucHJvdG90eXBlLnNldEZlZWRiYWNrID0gZnVuY3Rpb24oZmVlZGJhY2spIHtcbiAgICAgICAgdGhpcy5mZWVkYmFjay5nYWluLnZhbHVlID0gcGFyc2VGbG9hdChmZWVkYmFjayk7XG4gICAgfTtcblxuICAgIEZsYW5nZXIucHJvdG90eXBlLmJ5cGFzcyA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIGlmKHRoaXMuaXNCeXBhc3NlZCkge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy53ZXRnYWluKTtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCggdGhpcy5kZWxheSk7XG4gICAgICAgICAgICB0aGlzLndldGdhaW4uY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLndldGdhaW4uZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBGbGFuZ2VyLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICByZXR1cm4gRmxhbmdlcjtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdGbGFuZ2VyJywgRmxhbmdlcik7XG4iLCJmdW5jdGlvbiBvdmVyZHJpdmVQZWRhbCAoQm9hcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvb3ZlcmRyaXZlLmh0bWwnLFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoJHNjb3BlLCAkZWxlbWVudCkge1xuICAgICAgICAgICAgY29uc3QgTUlEX0xFVkVMID0gNS41O1xuICAgICAgICAgICAgdmFyIG92ZXJkcml2ZSA9IEJvYXJkLmdldFBlZGFsKCdvdmVyZHJpdmUnKTtcblxuICAgICAgICAgICAgdmFyIHZvbHVtZSA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2Ijb3ZlcmRyaXZlLXZvbHVtZScpLFxuICAgICAgICAgICAgICAgIHRvbmUgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI292ZXJkcml2ZS10b25lJyksXG4gICAgICAgICAgICAgICAgZm9vdHN3aXRjaCA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLXN3aXRjaCNvdmVyZHJpdmUtZm9vdC1zdycpLFxuICAgICAgICAgICAgICAgIGxlZCA9ICRlbGVtZW50LmZpbmQoJy5sZWQnKTtcblxuICAgICAgICAgICAgdm9sdW1lLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgb3ZlcmRyaXZlLnNldFZvbHVtZShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdm9sdW1lLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZvbHVtZS52YWwoTUlEX0xFVkVMKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0b25lLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgb3ZlcmRyaXZlLnNldFRvbmUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRvbmUub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdG9uZS52YWwoTUlEX0xFVkVMKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmb290c3dpdGNoLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBsZWQudG9nZ2xlQ2xhc3MoJ2FjdGl2ZScpO1xuICAgICAgICAgICAgICAgIG92ZXJkcml2ZS5ieXBhc3MoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdQZWRhbCcpXG4gICAgLmRpcmVjdGl2ZSgnb3ZlcmRyaXZlUGVkYWwnLCBvdmVyZHJpdmVQZWRhbCk7XG4iLCJmdW5jdGlvbiBPdmVyZHJpdmUgKFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuXG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKTtcblxuICAgIHZhciBPdmVyZHJpdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5pbnB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuZ2FpbiA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy53YXZlc2hhcGVyID0gc3RhZ2UuY3JlYXRlV2F2ZVNoYXBlcigpO1xuICAgICAgICB0aGlzLmxvd3Bhc3MgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5oaWdocGFzcyA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmJvb3N0ID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuY3V0ID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMudm9sdW1lID0gNy41O1xuICAgICAgICB0aGlzLnRvbmUgPSAyMDtcbiAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gdHJ1ZTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24odHlwZSkge1xuXG4gICAgICAgIHRoaXMuZ2Fpbi5nYWluLnZhbHVlID0gdGhpcy52b2x1bWU7XG5cbiAgICAgICAgdGhpcy5sb3dwYXNzLnR5cGUgPSBcImxvd3Bhc3NcIjtcbiAgICAgICAgdGhpcy5sb3dwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IDUwMDA7XG5cbiAgICAgICAgdGhpcy5ib29zdC50eXBlID0gXCJsb3dzaGVsZlwiO1xuICAgICAgICB0aGlzLmJvb3N0LmZyZXF1ZW5jeS52YWx1ZSA9IDEwMDtcbiAgICAgICAgdGhpcy5ib29zdC5nYWluLnZhbHVlID0gNjtcblxuICAgICAgICB0aGlzLmN1dC50eXBlID0gXCJsb3dzaGVsZlwiO1xuICAgICAgICB0aGlzLmN1dC5mcmVxdWVuY3kudmFsdWUgPSAxMDA7XG4gICAgICAgIHRoaXMuY3V0LmdhaW4udmFsdWUgPSAtNjtcblxuICAgICAgICB0aGlzLndhdmVzaGFwZXIuY3VydmUgPSB0aGlzLm1ha2VPdmVyZHJpdmVDdXJ2ZSgxMCwgdHlwZSk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5vdmVyc2FtcGxlID0gJzR4JztcblxuICAgICAgICB0aGlzLmhpZ2hwYXNzLnR5cGUgPSBcImhpZ2hwYXNzXCI7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MuZnJlcXVlbmN5LnZhbHVlID0gdGhpcy50b25lO1xuXG4gICAgICAgIHRoaXMuZ2Fpbi5jb25uZWN0KHRoaXMubG93cGFzcylcbiAgICAgICAgdGhpcy5sb3dwYXNzLmNvbm5lY3QodGhpcy5ib29zdCk7XG4gICAgICAgIHRoaXMuYm9vc3QuY29ubmVjdCh0aGlzLndhdmVzaGFwZXIpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIuY29ubmVjdCh0aGlzLmN1dCk7XG4gICAgICAgIHRoaXMuY3V0LmNvbm5lY3QodGhpcy5oaWdocGFzcyk7XG5cbiAgICAgICAgLy9ieXBhc3MgYnkgZGVmYXVsdFxuICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLm1ha2VPdmVyZHJpdmVDdXJ2ZSA9IGZ1bmN0aW9uIChhbW91bnQsIHR5cGUpIHtcbiAgICAgICAgdmFyIGsgPSB0eXBlb2YgYW1vdW50ID09PSAnbnVtYmVyJyA/IGFtb3VudCA6IDEwLFxuICAgICAgICAgICAgc2FtcGxlcyA9IDExMDI1LFxuICAgICAgICAgICAgY3VydmUgPSBuZXcgRmxvYXQzMkFycmF5KHNhbXBsZXMpO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2FtcGxlczsgKytpKSB7XG4gICAgICAgICAgICBjdXJ2ZVtpXSA9IHRoaXMuY3VydmVBbGdvcml0aG0oaSAqIDIgLyBzYW1wbGVzIC0gMSwgdHlwZSwgayk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3VydmU7XG4gICAgfTtcblxuICAgIE92ZXJkcml2ZS5wcm90b3R5cGUuY3VydmVBbGdvcml0aG0gPSBmdW5jdGlvbiAoeCwgdHlwZSwgaykge1xuICAgICAgICBzd2l0Y2godHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnb3ZlcmRyaXZlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50YW5oKHgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIE92ZXJkcml2ZS5wcm90b3R5cGUudGFuaCA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIGlmICh4ID09PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSBpZiAoeCA9PT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gKE1hdGguZXhwKHgpIC0gTWF0aC5leHAoLXgpKSAvIChNYXRoLmV4cCh4KSArIE1hdGguZXhwKC14KSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5zaWduID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgeCA9ICt4OyAvLyBjb252ZXJ0IHRvIGEgbnVtYmVyXG4gICAgICAgIGlmICh4ID09PSAwIHx8IGlzTmFOKHgpKVxuICAgICAgICAgICAgcmV0dXJuIHg7XG4gICAgICAgIHJldHVybiB4ID4gMCA/IDEgOiAtMTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLmJ5cGFzcyA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIGlmKHRoaXMuaXNCeXBhc3NlZCkge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5nYWluKTtcbiAgICAgICAgICAgIHRoaXMuaGlnaHBhc3MuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmhpZ2hwYXNzLmRpc2Nvbm5lY3QoKTtcblxuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgICAgICB0aGlzLmdhaW4uZ2Fpbi52YWx1ZSA9IDEuNSAqIHZvbHVtZTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5zZXRUb25lID0gZnVuY3Rpb24odG9uZSkge1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IDIwICogdG9uZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIE92ZXJkcml2ZTtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdPdmVyZHJpdmUnLCBPdmVyZHJpdmUpO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9