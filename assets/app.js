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

function Board($rootScope, FileInput, LineInput, Cabinet, Distortion, Overdrive, SharedAudioContext) {
    var stage = SharedAudioContext.getContext(),
        boardInput = stage.createGain();

    var pedals = {
        sample: new FileInput(),
        line: new LineInput(),
        cabinet: new Cabinet(),
        distortion: new Distortion(),
        overdrive: new Overdrive()
    };

    var samples = [
        'assets/samples/open.wav',
        'assets/samples/chords.wav',
        'assets/samples/everlong.wav',
        'assets/samples/octaves.wav',
        'assets/samples/FF.wav',
    ];

    this.loadSource = function () {
        pedals.sample.loadBuffer(samples[1]);
        pedals.sample.connect(boardInput);
    };

    this.loadPedals = function () {
        pedals.cabinet.load('assets/ir/5150.wav');
        pedals.distortion.load('dist3');
        pedals.overdrive.load('overdrive');
    };

    this.wireUpBoard = function () {
        boardInput.connect(pedals.distortion.input);
        pedals.distortion.connect(pedals.overdrive.input);
        pedals.overdrive.connect(pedals.cabinet.input);
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
Board.$inject = ["$rootScope", "FileInput", "LineInput", "Cabinet", "Distortion", "Overdrive", "SharedAudioContext"];
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZHVsZS5qcyIsImJvYXJkL21vZHVsZS5qcyIsImlucHV0L21vZHVsZS5qcyIsInBlZGFsL21vZHVsZS5qcyIsInV0aWxzL21vZHVsZS5qcyIsImNvbmZpZy5qcyIsImJvYXJkL2JvYXJkLmN0cmwuanMiLCJib2FyZC9ib2FyZC5zdmMuanMiLCJpbnB1dC9maWxlX2lucHV0LnN2Yy5qcyIsImlucHV0L2lucHV0X2NvbnRyb2xzLmRpcmVjdGl2ZS5qcyIsImlucHV0L2xpbmVfaW5wdXQuc3ZjLmpzIiwidXRpbHMvc2hhcmVkX2F1ZGlvX2NvbnRleHQuZmFjdG9yeS5qcyIsInBlZGFsL2NhYmluZXQvcGVkYWxfY2FiaW5ldC5zdmMuanMiLCJwZWRhbC9kaXN0b3J0aW9uL2Rpc3RvcnRpb25fcGVkYWwuZGlyZWN0aXZlLmpzIiwicGVkYWwvZGlzdG9ydGlvbi9wZWRhbF9kaXN0b3J0aW9uLnN2Yy5qcyIsInBlZGFsL292ZXJkcml2ZS9vdmVyZHJpdmVfcGVkYWwuZGlyZWN0aXZlLmpzIiwicGVkYWwvb3ZlcmRyaXZlL3BlZGFsX292ZXJkcml2ZS5zdmMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7SUFDQTtJQUNBO0FBQ0E7O0FDSEE7SUFDQTtJQUNBO0lBQ0E7QUFDQTs7QUNKQTs7QUFFQTtJQUNBO0FBQ0E7O0FDSkE7SUFDQTtBQUNBOztBQ0ZBOztBQUVBOztBQ0ZBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO1FBQ0E7WUFDQTtZQUNBLGFBQUEsU0FBQTtZQUNBO1FBQ0E7QUFDQSxDQUFBOzs7QUFFQTtJQUNBO0lBQ0E7QUNmQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7QUFFQSxDQUFBOzs7QUFFQTtJQUNBO0lBQ0EsYUFBQSxTQUFBOztBQ3ZCQTtJQUNBO1FBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7WUFDQTtnQkFDQTtZQUNBO1lBQ0E7UUFDQTtZQUNBO1lBQ0E7UUFDQTtJQUNBOztJQUVBO01BQ0E7SUFDQTtBQUNBLENBQUE7O0FBQ0E7SUFDQTtJQUNBLFVBQUEsS0FBQTs7QUNqRUE7O0lBRUE7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTs7UUFFQTtZQUNBO2dCQUNBO2dCQUNBO29CQUNBO3dCQUNBO3dCQUNBO29CQUNBO29CQUNBO2dCQUNBO2dCQUNBO29CQUNBO2dCQUNBO1lBQ0E7UUFDQTs7UUFFQTtZQUNBO1FBQ0E7O1FBRUE7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7O1FBRUE7SUFDQTs7O0lBR0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsU0FBQTs7QUNsRUE7SUFDQTtRQUNBO1FBQ0E7UUFDQTtZQUNBO2dCQUNBO2dCQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBO1FBQ0E7SUFDQTtBQUNBO0FBQ0E7SUFDQTtJQUNBLFlBQUEsYUFBQTs7QUMzQkE7O0lBRUE7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBOztRQUVBO1lBQ0E7Z0JBQ0E7b0JBQ0E7b0JBQ0E7b0JBQ0E7b0JBQ0E7Z0JBQ0E7WUFDQTtRQUNBO1lBQ0E7WUFDQTtZQUNBO1FBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO0FBQ0EsQ0FBQTs7OztBQUdBO0lBQ0E7SUFDQSxVQUFBLFNBQUE7O0FDOUNBOztJQUVBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBO0FBQ0E7SUFDQTtJQUNBLFVBQUEsa0JBQUE7O0FDWkE7O0lBRUE7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBOztRQUVBOztRQUVBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtZQUNBO1FBQ0E7O1FBRUE7O1FBRUE7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsT0FBQTs7QUM5Q0E7SUFDQTtRQUNBO1FBQ0E7UUFDQTtZQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBO1FBQ0E7SUFDQTtBQUNBLENBQUE7O0FBQ0E7SUFDQTtJQUNBLFlBQUEsZUFBQTs7QUN0Q0E7O0lBRUE7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7O1FBRUE7O1FBRUE7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBOztRQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7WUFDQTs7UUFFQTtZQUNBO1FBQ0E7O1FBRUE7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1lBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7WUFDQTtZQUNBOztZQUVBO1FBQ0E7WUFDQTtZQUNBOztZQUVBOztZQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO0FBQ0EsQ0FBQTs7OztBQUdBO0lBQ0E7SUFDQSxVQUFBLFVBQUE7O0FDbElBO0lBQ0E7UUFDQTtRQUNBO1FBQ0E7WUFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO2dCQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7WUFDQTtRQUNBO0lBQ0E7QUFDQSxDQUFBOztBQUNBO0lBQ0E7SUFDQSxZQUFBLGNBQUE7O0FDdENBOztJQUVBOztJQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBOztRQUVBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7O1FBRUE7WUFDQTtRQUNBOztRQUVBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO2dCQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1lBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7WUFDQTtZQUNBOztZQUVBO1FBQ0E7WUFDQTtZQUNBOztZQUVBOztZQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO0FBQ0EsQ0FBQTs7OztBQUdBO0lBQ0E7SUFDQSxVQUFBLFNBQUEiLCJmaWxlIjoiYXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiYW5ndWxhci5tb2R1bGUoJ0d0clBlZGFscycsIFtcbiAgICAnbmdSb3V0ZScsXG4gICAgJ0JvYXJkJ1xuXSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnQm9hcmQnLCBbXG4gICAgJ0lucHV0JyxcbiAgICAnUGVkYWwnLFxuICAgICdTaGFyZWRBdWRpb0NvbnRleHQnXG5dKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuYW5ndWxhci5tb2R1bGUoJ0lucHV0JywgW1xuICAgICdTaGFyZWRBdWRpb0NvbnRleHQnXG5dKTtcbiIsImFuZ3VsYXIubW9kdWxlKCdQZWRhbCcsIFtcbiAgICAnU2hhcmVkQXVkaW9Db250ZXh0J1xuXSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmFuZ3VsYXIubW9kdWxlKCdTaGFyZWRBdWRpb0NvbnRleHQnLCBbXSk7XG4iLCJmdW5jdGlvbiBjb25maWcoJHJvdXRlUHJvdmlkZXIsICRsb2NhdGlvblByb3ZpZGVyKSB7XG4gICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYTtcbiAgICB3aW5kb3cuQXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuXG4gICAgJGxvY2F0aW9uUHJvdmlkZXIuaHRtbDVNb2RlKHRydWUpO1xuICAgICRyb3V0ZVByb3ZpZGVyXG4gICAgICAgIC53aGVuKCcvJywge1xuICAgICAgICAgICAgdGVtcGxhdGVVcmw6ICcvdGVtcGxhdGVzL2JvYXJkLmh0bWwnLFxuICAgICAgICAgICAgY29udHJvbGxlcjogJ0JvYXJkQ3RybCcsXG4gICAgICAgICAgICBjb250cm9sbGVyQXM6ICd2bSdcbiAgICAgICAgfSk7XG59XG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdHdHJQZWRhbHMnKVxuICAgIC5jb25maWcoY29uZmlnKTsiLCJmdW5jdGlvbiBCb2FyZEN0cmwgKEJvYXJkKSB7XG4gICAgdmFyIHZtID0gdGhpcztcblxuICAgIEJvYXJkLmxvYWRTb3VyY2UoKTtcbiAgICBCb2FyZC5sb2FkUGVkYWxzKCk7XG4gICAgQm9hcmQud2lyZVVwQm9hcmQoKTtcblxuICAgIHZtLnBsYXkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgQm9hcmQucGxheVNhbXBsZSgpO1xuICAgIH07XG5cbiAgICB2bS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIEJvYXJkLnN0b3BTYW1wbGUoKTtcbiAgICB9O1xuXG4gICAgdm0ubGl2ZUlucHV0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIEJvYXJkLnRvZ2dsZUxpdmVJbnB1dCgpO1xuICAgIH1cblxufVxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnQm9hcmQnKVxuICAgIC5jb250cm9sbGVyKCdCb2FyZEN0cmwnLCBCb2FyZEN0cmwpO1xuIiwiZnVuY3Rpb24gQm9hcmQoJHJvb3RTY29wZSwgRmlsZUlucHV0LCBMaW5lSW5wdXQsIENhYmluZXQsIERpc3RvcnRpb24sIE92ZXJkcml2ZSwgU2hhcmVkQXVkaW9Db250ZXh0KSB7XG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKSxcbiAgICAgICAgYm9hcmRJbnB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcblxuICAgIHZhciBwZWRhbHMgPSB7XG4gICAgICAgIHNhbXBsZTogbmV3IEZpbGVJbnB1dCgpLFxuICAgICAgICBsaW5lOiBuZXcgTGluZUlucHV0KCksXG4gICAgICAgIGNhYmluZXQ6IG5ldyBDYWJpbmV0KCksXG4gICAgICAgIGRpc3RvcnRpb246IG5ldyBEaXN0b3J0aW9uKCksXG4gICAgICAgIG92ZXJkcml2ZTogbmV3IE92ZXJkcml2ZSgpXG4gICAgfTtcblxuICAgIHZhciBzYW1wbGVzID0gW1xuICAgICAgICAnYXNzZXRzL3NhbXBsZXMvb3Blbi53YXYnLFxuICAgICAgICAnYXNzZXRzL3NhbXBsZXMvY2hvcmRzLndhdicsXG4gICAgICAgICdhc3NldHMvc2FtcGxlcy9ldmVybG9uZy53YXYnLFxuICAgICAgICAnYXNzZXRzL3NhbXBsZXMvb2N0YXZlcy53YXYnLFxuICAgICAgICAnYXNzZXRzL3NhbXBsZXMvRkYud2F2JyxcbiAgICBdO1xuXG4gICAgdGhpcy5sb2FkU291cmNlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBwZWRhbHMuc2FtcGxlLmxvYWRCdWZmZXIoc2FtcGxlc1sxXSk7XG4gICAgICAgIHBlZGFscy5zYW1wbGUuY29ubmVjdChib2FyZElucHV0KTtcbiAgICB9O1xuXG4gICAgdGhpcy5sb2FkUGVkYWxzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBwZWRhbHMuY2FiaW5ldC5sb2FkKCdhc3NldHMvaXIvNTE1MC53YXYnKTtcbiAgICAgICAgcGVkYWxzLmRpc3RvcnRpb24ubG9hZCgnZGlzdDMnKTtcbiAgICAgICAgcGVkYWxzLm92ZXJkcml2ZS5sb2FkKCdvdmVyZHJpdmUnKTtcbiAgICB9O1xuXG4gICAgdGhpcy53aXJlVXBCb2FyZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgYm9hcmRJbnB1dC5jb25uZWN0KHBlZGFscy5kaXN0b3J0aW9uLmlucHV0KTtcbiAgICAgICAgcGVkYWxzLmRpc3RvcnRpb24uY29ubmVjdChwZWRhbHMub3ZlcmRyaXZlLmlucHV0KTtcbiAgICAgICAgcGVkYWxzLm92ZXJkcml2ZS5jb25uZWN0KHBlZGFscy5jYWJpbmV0LmlucHV0KTtcbiAgICAgICAgcGVkYWxzLmNhYmluZXQuY29ubmVjdChzdGFnZS5kZXN0aW5hdGlvbik7XG4gICAgfTtcblxuICAgIHRoaXMucGxheVNhbXBsZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLnNhbXBsZS5wbGF5KCk7XG4gICAgfTtcblxuICAgIHRoaXMuc3RvcFNhbXBsZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLnNhbXBsZS5zdG9wKCk7XG4gICAgfTtcblxuICAgIHRoaXMudG9nZ2xlTGl2ZUlucHV0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXBlZGFscy5saW5lLmlzU3RyZWFtaW5nKSB7XG4gICAgICAgICAgICBwZWRhbHMubGluZS5sb2FkKCk7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbignbGluZWluOmxvYWRlZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBwZWRhbHMubGluZS5zdHJlYW0uY29ubmVjdChib2FyZElucHV0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcGVkYWxzLmxpbmUuaXNTdHJlYW1pbmcgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVkYWxzLmxpbmUuc3RvcCgpO1xuICAgICAgICAgICAgcGVkYWxzLmxpbmUuaXNTdHJlYW1pbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLmdldFBlZGFsID0gZnVuY3Rpb24gKGVmZmVjdCkge1xuICAgICAgcmV0dXJuIHBlZGFsc1tlZmZlY3RdO1xuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnQm9hcmQnKVxuICAgIC5zZXJ2aWNlKCdCb2FyZCcsIEJvYXJkKTtcbiIsImZ1bmN0aW9uIEZpbGVJbnB1dCAoU2hhcmVkQXVkaW9Db250ZXh0KSB7XG5cbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpO1xuXG4gICAgdmFyIEZpbGVJbnB1dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5zb3VyY2UgPSBudWxsO1xuICAgICAgICB0aGlzLnNhbXBsZSA9IG51bGw7XG4gICAgfTtcblxuICAgIEZpbGVJbnB1dC5wcm90b3R5cGUubG9hZEJ1ZmZlciA9IGZ1bmN0aW9uKHVybCkge1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICByZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcbiAgICAgICAgcmVxdWVzdC5yZXNwb25zZVR5cGUgPSBcImFycmF5YnVmZmVyXCI7XG5cbiAgICAgICAgdmFyIGxvYWRlciA9IHRoaXM7XG5cbiAgICAgICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHN0YWdlLmRlY29kZUF1ZGlvRGF0YShcbiAgICAgICAgICAgICAgICByZXF1ZXN0LnJlc3BvbnNlLFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWxlcnQoJ2Vycm9yIGRlY29kaW5nIGZpbGUgZGF0YTogJyArIHVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9hZGVyLnNhbXBsZSA9IGJ1ZmZlcjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ2RlY29kZUF1ZGlvRGF0YSBlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBhbGVydCgnQnVmZmVyTG9hZGVyOiBYSFIgZXJyb3InKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcXVlc3Quc2VuZCgpO1xuICAgIH07XG5cbiAgICBGaWxlSW5wdXQucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbih0YXJnZXQpe1xuICAgICAgICB0aGlzLm91dHB1dC5jb25uZWN0KHRhcmdldCk7XG4gICAgfTtcblxuICAgIEZpbGVJbnB1dC5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnNvdXJjZSA9IHN0YWdlLmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgICAgICB0aGlzLnNvdXJjZS5sb29wID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zb3VyY2UuYnVmZmVyID0gdGhpcy5zYW1wbGU7XG5cbiAgICAgICAgdGhpcy5zb3VyY2UuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgdGhpcy5zb3VyY2Uuc3RhcnQoMCk7XG4gICAgfTtcblxuXG4gICAgRmlsZUlucHV0LnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc291cmNlLnN0b3AoKTtcbiAgICAgICAgdGhpcy5zb3VyY2UuZGlzY29ubmVjdCgpO1xuICAgIH07XG5cbiAgICByZXR1cm4gRmlsZUlucHV0O1xufVxuXG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdJbnB1dCcpXG4gICAgLmZhY3RvcnkoJ0ZpbGVJbnB1dCcsIEZpbGVJbnB1dCk7XG4iLCJmdW5jdGlvbiBpbnB1dENvbnRyb2xzKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ3RlbXBsYXRlcy9jb250cm9scy5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50KSB7XG4gICAgICAgICAgICB2YXIgc3RhcnQgPSBhbmd1bGFyLmVsZW1lbnQoJy5nbHlwaGljb24tcGxheScpLFxuICAgICAgICAgICAgICAgIHN0b3AgPSBhbmd1bGFyLmVsZW1lbnQoJy5nbHlwaGljb24tc3RvcCcpLFxuICAgICAgICAgICAgICAgIGxpdmVJbnB1dCA9IGFuZ3VsYXIuZWxlbWVudCgnLmdseXBoaWNvbi1yZWNvcmQnKTtcblxuICAgICAgICAgICAgc3RhcnQub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBzdG9wLnByb3AoJ2Rpc2FibGVkJywgZmFsc2UpO1xuICAgICAgICAgICAgICAgIHN0YXJ0LnByb3AoJ2Rpc2FibGVkJywgdHJ1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgc3RvcC5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIHN0YXJ0LnByb3AoJ2Rpc2FibGVkJywgZmFsc2UpO1xuICAgICAgICAgICAgICAgIHN0b3AucHJvcCgnZGlzYWJsZWQnLCB0cnVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBsaXZlSW5wdXQub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBsaXZlSW5wdXQudG9nZ2xlQ2xhc3MoXCJidG4tZGFuZ2VyXCIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0lucHV0JylcbiAgICAuZGlyZWN0aXZlKCdpbnB1dENvbnRyb2xzJywgaW5wdXRDb250cm9scyk7XG4iLCJmdW5jdGlvbiBMaW5lSW5wdXQoJHJvb3RTY29wZSwgU2hhcmVkQXVkaW9Db250ZXh0KSB7XG5cbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpO1xuXG4gICAgdmFyIExpbmVJbnB1dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuc3RyZWFtID0gbnVsbDtcbiAgICAgICAgdGhpcy5pc1N0cmVhbWluZyA9IGZhbHNlO1xuICAgIH07XG5cbiAgICBMaW5lSW5wdXQucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKHtcbiAgICAgICAgICAgIFwiYXVkaW9cIjoge1xuICAgICAgICAgICAgICAgIFwib3B0aW9uYWxcIjogW1xuICAgICAgICAgICAgICAgICAgICB7XCJnb29nRWNob0NhbmNlbGxhdGlvblwiOiBcImZhbHNlXCJ9LFxuICAgICAgICAgICAgICAgICAgICB7XCJnb29nQXV0b0dhaW5Db250cm9sXCI6IFwiZmFsc2VcIn0sXG4gICAgICAgICAgICAgICAgICAgIHtcImdvb2dOb2lzZVN1cHByZXNzaW9uXCI6IFwidHJ1ZVwifSxcbiAgICAgICAgICAgICAgICAgICAge1wiZ29vZ0hpZ2hwYXNzRmlsdGVyXCI6IFwiZmFsc2VcIn1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uIChzdHJlYW0pIHtcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtID0gc3RhZ2UuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc3RyZWFtKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGVtaXQoJ2xpbmVpbjpsb2FkZWQnKTtcbiAgICAgICAgICAgIHRoaXMuaXNTdHJlYW1pbmcgPSB0cnVlO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdHdWl0YXIgc3RyZWFtIGZhaWxlZDogJyArIGVycik7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBMaW5lSW5wdXQucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbiAodGFyZ2V0KSB7XG4gICAgICAgIHRoaXMuc3RyZWFtLmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgTGluZUlucHV0LnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnN0cmVhbS5kaXNjb25uZWN0KCk7XG4gICAgICAgIHRoaXMuaXNTdHJlYW1pbmcgPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIExpbmVJbnB1dDtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnSW5wdXQnKVxuICAgIC5zZXJ2aWNlKCdMaW5lSW5wdXQnLCBMaW5lSW5wdXQpO1xuIiwiZnVuY3Rpb24gU2hhcmVkQXVkaW9Db250ZXh0ICgpIHtcblxuICAgIHZhciBTaGFyZWRBdWRpb0NvbnRleHQgPSB7fTtcblxuICAgIFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb250ZXh0IHx8ICh0aGlzLmNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFNoYXJlZEF1ZGlvQ29udGV4dDtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdTaGFyZWRBdWRpb0NvbnRleHQnKVxuICAgIC5mYWN0b3J5KCdTaGFyZWRBdWRpb0NvbnRleHQnLCBTaGFyZWRBdWRpb0NvbnRleHQpO1xuIiwiZnVuY3Rpb24gQ2FiaW5ldCAoU2hhcmVkQXVkaW9Db250ZXh0KSB7XG5cbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpO1xuXG4gICAgdmFyIENhYmluZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5pbnB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuYm9vc3QgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuY29udm9sdmVyID0gc3RhZ2UuY3JlYXRlQ29udm9sdmVyKCk7XG4gICAgfTtcblxuICAgIENhYmluZXQucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbihpclBhdGgpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgcmVxdWVzdC5vcGVuKCdHRVQnLCBpclBhdGgsIHRydWUpO1xuICAgICAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cbiAgICAgICAgdmFyIGxvYWRlciA9IHRoaXM7XG5cbiAgICAgICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzdGFnZS5kZWNvZGVBdWRpb0RhdGEocmVxdWVzdC5yZXNwb25zZSwgZnVuY3Rpb24gKGJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIGxvYWRlci5jb252b2x2ZXIuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZSkgY29uc29sZS5sb2coXCJDYW5ub3QgbG9hZCBjYWJpbmV0XCIgKyBlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJlcXVlc3Quc2VuZChudWxsKTtcblxuICAgICAgICB0aGlzLmlucHV0LmdhaW4udmFsdWUgPSAzO1xuICAgICAgICB0aGlzLmJvb3N0LmdhaW4udmFsdWUgPSAxO1xuXG4gICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLmNvbnZvbHZlcik7XG4gICAgICAgIHRoaXMuY29udm9sdmVyLmNvbm5lY3QodGhpcy5ib29zdCk7XG4gICAgICAgIHRoaXMuYm9vc3QuY29ubmVjdCh0aGlzLm91dHB1dCk7XG4gICAgfTtcblxuICAgIENhYmluZXQucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbih0YXJnZXQpe1xuICAgICAgICB0aGlzLm91dHB1dC5jb25uZWN0KHRhcmdldCk7XG4gICAgfTtcblxuICAgIHJldHVybiBDYWJpbmV0O1xufVxuXG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdQZWRhbCcpXG4gICAgLmZhY3RvcnkoJ0NhYmluZXQnLCBDYWJpbmV0KTtcbiIsImZ1bmN0aW9uIGRpc3RvcnRpb25QZWRhbCAoQm9hcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvZGlzdG9ydGlvbi5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IE1JRF9MRVZFTCA9IDUuNTtcbiAgICAgICAgICAgIHZhciBkaXN0b3J0aW9uID0gQm9hcmQuZ2V0UGVkYWwoJ2Rpc3RvcnRpb24nKTtcblxuICAgICAgICAgICAgdmFyIHZvbHVtZSA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZGlzdG9ydGlvbi12b2x1bWUnKSxcbiAgICAgICAgICAgICAgICB0b25lID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNkaXN0b3J0aW9uLXRvbmUnKSxcbiAgICAgICAgICAgICAgICBmb290c3dpdGNoID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8tc3dpdGNoI2Rpc3RvcnRpb24tZm9vdC1zdycpLFxuICAgICAgICAgICAgICAgIGxlZCA9ICRlbGVtZW50LmZpbmQoJy5sZWQnKTtcblxuICAgICAgICAgICAgdm9sdW1lLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZGlzdG9ydGlvbi5zZXRWb2x1bWUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2b2x1bWUudmFsKE1JRF9MRVZFTCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdG9uZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGRpc3RvcnRpb24uc2V0VG9uZShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdG9uZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB0b25lLnZhbChNSURfTEVWRUwpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZvb3Rzd2l0Y2gub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGxlZC50b2dnbGVDbGFzcygnYWN0aXZlJyk7XG4gICAgICAgICAgICAgICAgZGlzdG9ydGlvbi5ieXBhc3MoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdQZWRhbCcpXG4gICAgLmRpcmVjdGl2ZSgnZGlzdG9ydGlvblBlZGFsJywgZGlzdG9ydGlvblBlZGFsKTtcbiIsImZ1bmN0aW9uIERpc3RvcnRpb24gKFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuXG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKTtcblxuICAgIHZhciBEaXN0b3J0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmdhaW4gPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlciA9IHN0YWdlLmNyZWF0ZVdhdmVTaGFwZXIoKTtcbiAgICAgICAgdGhpcy5sb3dwYXNzID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5ib29zdCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmN1dCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLnZvbHVtZSA9IDcuNTtcbiAgICAgICAgdGhpcy50b25lID0gMjA7XG4gICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbih0eXBlKSB7XG5cbiAgICAgICAgdGhpcy5nYWluLmdhaW4udmFsdWUgPSB0aGlzLnZvbHVtZTtcblxuICAgICAgICB0aGlzLmxvd3Bhc3MudHlwZSA9IFwibG93cGFzc1wiO1xuICAgICAgICB0aGlzLmxvd3Bhc3MuZnJlcXVlbmN5LnZhbHVlID0gNTAwMDtcblxuICAgICAgICB0aGlzLmJvb3N0LnR5cGUgPSBcImxvd3NoZWxmXCI7XG4gICAgICAgIHRoaXMuYm9vc3QuZnJlcXVlbmN5LnZhbHVlID0gMTAwO1xuICAgICAgICB0aGlzLmJvb3N0LmdhaW4udmFsdWUgPSA2O1xuXG4gICAgICAgIHRoaXMuY3V0LnR5cGUgPSBcImxvd3NoZWxmXCI7XG4gICAgICAgIHRoaXMuY3V0LmZyZXF1ZW5jeS52YWx1ZSA9IDEwMDtcbiAgICAgICAgdGhpcy5jdXQuZ2Fpbi52YWx1ZSA9IC02O1xuXG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5jdXJ2ZSA9IHRoaXMubWFrZURpc3RvcnRpb25DdXJ2ZSgxMCwgdHlwZSk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5vdmVyc2FtcGxlID0gJzR4JztcblxuICAgICAgICB0aGlzLmhpZ2hwYXNzLnR5cGUgPSBcImhpZ2hwYXNzXCI7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MuZnJlcXVlbmN5LnZhbHVlID0gdGhpcy50b25lO1xuXG4gICAgICAgIHRoaXMuZ2Fpbi5jb25uZWN0KHRoaXMubG93cGFzcylcbiAgICAgICAgdGhpcy5sb3dwYXNzLmNvbm5lY3QodGhpcy5ib29zdCk7XG4gICAgICAgIHRoaXMuYm9vc3QuY29ubmVjdCh0aGlzLndhdmVzaGFwZXIpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIuY29ubmVjdCh0aGlzLmN1dCk7XG4gICAgICAgIHRoaXMuY3V0LmNvbm5lY3QodGhpcy5oaWdocGFzcyk7XG5cbiAgICAgICAgLy9ieXBhc3MgYnkgZGVmYXVsdFxuICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5tYWtlRGlzdG9ydGlvbkN1cnZlID0gZnVuY3Rpb24gKGFtb3VudCwgdHlwZSkge1xuICAgICAgICB2YXIgayA9IHR5cGVvZiBhbW91bnQgPT09ICdudW1iZXInID8gYW1vdW50IDogMTAsXG4gICAgICAgICAgICBzYW1wbGVzID0gMTEwMjUsXG4gICAgICAgICAgICBjdXJ2ZSA9IG5ldyBGbG9hdDMyQXJyYXkoc2FtcGxlcyk7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzYW1wbGVzOyArK2kpIHtcbiAgICAgICAgICAgIGN1cnZlW2ldID0gdGhpcy5jdXJ2ZUFsZ29yaXRobShpICogMiAvIHNhbXBsZXMgLSAxLCB0eXBlLCBrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjdXJ2ZTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuY3VydmVBbGdvcml0aG0gPSBmdW5jdGlvbiAoeCwgdHlwZSwgaykge1xuICAgICAgICBzd2l0Y2godHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnZGlzdDEnOlxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgtMC41LCBNYXRoLm1pbigwLjUsIHggKiBrKSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0Mic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCB4ICogaykpO1xuICAgICAgICAgICAgY2FzZSAnZGlzdDMnOlxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgtMC41LCBNYXRoLm1pbigxLjUsIHggKSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0NCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIDIuOCAqIE1hdGgucG93KHgsIDMpICsgTWF0aC5wb3coeCwyKSArIC0xLjEgKiB4IC0gMC41O1xuICAgICAgICAgICAgY2FzZSAnZGlzdDUnOlxuICAgICAgICAgICAgICAgIHJldHVybiAoTWF0aC5leHAoeCkgLSBNYXRoLmV4cCgteCAqIDEuMikpIC8gKE1hdGguZXhwKHgpICsgTWF0aC5leHAoLXgpKTtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3Q2JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50YW5oKHgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLnRhbmggPSBmdW5jdGlvbiAoeCkge1xuICAgICAgICBpZiAoeCA9PT0gSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2UgaWYgKHggPT09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIChNYXRoLmV4cCh4KSAtIE1hdGguZXhwKC14KSkgLyAoTWF0aC5leHAoeCkgKyBNYXRoLmV4cCgteCkpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLnNpZ24gPSBmdW5jdGlvbiAoeCkge1xuICAgICAgICB4ID0gK3g7IC8vIGNvbnZlcnQgdG8gYSBudW1iZXJcbiAgICAgICAgaWYgKHggPT09IDAgfHwgaXNOYU4oeCkpXG4gICAgICAgICAgICByZXR1cm4geDtcbiAgICAgICAgcmV0dXJuIHggPiAwID8gMSA6IC0xO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5ieXBhc3MgPSBmdW5jdGlvbigpe1xuICAgICAgICBpZih0aGlzLmlzQnlwYXNzZWQpIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMuZ2Fpbik7XG4gICAgICAgICAgICB0aGlzLmhpZ2hwYXNzLmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuXG4gICAgICAgICAgICB0aGlzLmlzQnlwYXNzZWQgPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy5oaWdocGFzcy5kaXNjb25uZWN0KCk7XG5cbiAgICAgICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuc2V0Vm9sdW1lID0gZnVuY3Rpb24odm9sdW1lKSB7XG4gICAgICAgIHRoaXMuZ2Fpbi5nYWluLnZhbHVlID0gMS41ICogdm9sdW1lO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5zZXRUb25lID0gZnVuY3Rpb24odG9uZSkge1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IDIwICogdG9uZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERpc3RvcnRpb247XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZmFjdG9yeSgnRGlzdG9ydGlvbicsIERpc3RvcnRpb24pO1xuIiwiZnVuY3Rpb24gb3ZlcmRyaXZlUGVkYWwgKEJvYXJkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL292ZXJkcml2ZS5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IE1JRF9MRVZFTCA9IDUuNTtcbiAgICAgICAgICAgIHZhciBvdmVyZHJpdmUgPSBCb2FyZC5nZXRQZWRhbCgnb3ZlcmRyaXZlJyk7XG5cbiAgICAgICAgICAgIHZhciB2b2x1bWUgPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1rbm9iI292ZXJkcml2ZS12b2x1bWUnKSxcbiAgICAgICAgICAgICAgICB0b25lID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNvdmVyZHJpdmUtdG9uZScpLFxuICAgICAgICAgICAgICAgIGZvb3Rzd2l0Y2ggPSAkZWxlbWVudC5maW5kKCd3ZWJhdWRpby1zd2l0Y2gjb3ZlcmRyaXZlLWZvb3Qtc3cnKSxcbiAgICAgICAgICAgICAgICBsZWQgPSAkZWxlbWVudC5maW5kKCcubGVkJyk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIG92ZXJkcml2ZS5zZXRWb2x1bWUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2b2x1bWUudmFsKE1JRF9MRVZFTCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdG9uZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIG92ZXJkcml2ZS5zZXRUb25lKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0b25lLm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRvbmUudmFsKE1JRF9MRVZFTCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZm9vdHN3aXRjaC5vbignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbGVkLnRvZ2dsZUNsYXNzKCdhY3RpdmUnKTtcbiAgICAgICAgICAgICAgICBvdmVyZHJpdmUuYnlwYXNzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5kaXJlY3RpdmUoJ292ZXJkcml2ZVBlZGFsJywgb3ZlcmRyaXZlUGVkYWwpO1xuIiwiZnVuY3Rpb24gT3ZlcmRyaXZlIChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgT3ZlcmRyaXZlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmdhaW4gPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlciA9IHN0YWdlLmNyZWF0ZVdhdmVTaGFwZXIoKTtcbiAgICAgICAgdGhpcy5sb3dwYXNzID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5ib29zdCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmN1dCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLnZvbHVtZSA9IDcuNTtcbiAgICAgICAgdGhpcy50b25lID0gMjA7XG4gICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgfTtcblxuICAgIE92ZXJkcml2ZS5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKHR5cGUpIHtcblxuICAgICAgICB0aGlzLmdhaW4uZ2Fpbi52YWx1ZSA9IHRoaXMudm9sdW1lO1xuXG4gICAgICAgIHRoaXMubG93cGFzcy50eXBlID0gXCJsb3dwYXNzXCI7XG4gICAgICAgIHRoaXMubG93cGFzcy5mcmVxdWVuY3kudmFsdWUgPSA1MDAwO1xuXG4gICAgICAgIHRoaXMuYm9vc3QudHlwZSA9IFwibG93c2hlbGZcIjtcbiAgICAgICAgdGhpcy5ib29zdC5mcmVxdWVuY3kudmFsdWUgPSAxMDA7XG4gICAgICAgIHRoaXMuYm9vc3QuZ2Fpbi52YWx1ZSA9IDY7XG5cbiAgICAgICAgdGhpcy5jdXQudHlwZSA9IFwibG93c2hlbGZcIjtcbiAgICAgICAgdGhpcy5jdXQuZnJlcXVlbmN5LnZhbHVlID0gMTAwO1xuICAgICAgICB0aGlzLmN1dC5nYWluLnZhbHVlID0gLTY7XG5cbiAgICAgICAgdGhpcy53YXZlc2hhcGVyLmN1cnZlID0gdGhpcy5tYWtlT3ZlcmRyaXZlQ3VydmUoMTAsIHR5cGUpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIub3ZlcnNhbXBsZSA9ICc0eCc7XG5cbiAgICAgICAgdGhpcy5oaWdocGFzcy50eXBlID0gXCJoaWdocGFzc1wiO1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IHRoaXMudG9uZTtcblxuICAgICAgICB0aGlzLmdhaW4uY29ubmVjdCh0aGlzLmxvd3Bhc3MpXG4gICAgICAgIHRoaXMubG93cGFzcy5jb25uZWN0KHRoaXMuYm9vc3QpO1xuICAgICAgICB0aGlzLmJvb3N0LmNvbm5lY3QodGhpcy53YXZlc2hhcGVyKTtcbiAgICAgICAgdGhpcy53YXZlc2hhcGVyLmNvbm5lY3QodGhpcy5jdXQpO1xuICAgICAgICB0aGlzLmN1dC5jb25uZWN0KHRoaXMuaGlnaHBhc3MpO1xuXG4gICAgICAgIC8vYnlwYXNzIGJ5IGRlZmF1bHRcbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5tYWtlT3ZlcmRyaXZlQ3VydmUgPSBmdW5jdGlvbiAoYW1vdW50LCB0eXBlKSB7XG4gICAgICAgIHZhciBrID0gdHlwZW9mIGFtb3VudCA9PT0gJ251bWJlcicgPyBhbW91bnQgOiAxMCxcbiAgICAgICAgICAgIHNhbXBsZXMgPSAxMTAyNSxcbiAgICAgICAgICAgIGN1cnZlID0gbmV3IEZsb2F0MzJBcnJheShzYW1wbGVzKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNhbXBsZXM7ICsraSkge1xuICAgICAgICAgICAgY3VydmVbaV0gPSB0aGlzLmN1cnZlQWxnb3JpdGhtKGkgKiAyIC8gc2FtcGxlcyAtIDEsIHR5cGUsIGspO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGN1cnZlO1xuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLmN1cnZlQWxnb3JpdGhtID0gZnVuY3Rpb24gKHgsIHR5cGUsIGspIHtcbiAgICAgICAgc3dpdGNoKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ292ZXJkcml2ZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuICgxICsgaykgKiB4IC8gKDEgKyBrICogTWF0aC5hYnMoeCkpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIE92ZXJkcml2ZS5wcm90b3R5cGUudGFuaCA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIGlmICh4ID09PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSBpZiAoeCA9PT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gKE1hdGguZXhwKHgpIC0gTWF0aC5leHAoLXgpKSAvIChNYXRoLmV4cCh4KSArIE1hdGguZXhwKC14KSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5zaWduID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgeCA9ICt4OyAvLyBjb252ZXJ0IHRvIGEgbnVtYmVyXG4gICAgICAgIGlmICh4ID09PSAwIHx8IGlzTmFOKHgpKVxuICAgICAgICAgICAgcmV0dXJuIHg7XG4gICAgICAgIHJldHVybiB4ID4gMCA/IDEgOiAtMTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLmJ5cGFzcyA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIGlmKHRoaXMuaXNCeXBhc3NlZCkge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5nYWluKTtcbiAgICAgICAgICAgIHRoaXMuaGlnaHBhc3MuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmhpZ2hwYXNzLmRpc2Nvbm5lY3QoKTtcblxuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBPdmVyZHJpdmUucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgICAgICB0aGlzLmdhaW4uZ2Fpbi52YWx1ZSA9IDEuNSAqIHZvbHVtZTtcbiAgICB9O1xuXG4gICAgT3ZlcmRyaXZlLnByb3RvdHlwZS5zZXRUb25lID0gZnVuY3Rpb24odG9uZSkge1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IDIwICogdG9uZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIE92ZXJkcml2ZTtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdPdmVyZHJpdmUnLCBPdmVyZHJpdmUpO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9