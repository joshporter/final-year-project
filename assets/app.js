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

function Board($rootScope, FileInput, LineInput, Cabinet, Distortion, SharedAudioContext) {
    var stage = SharedAudioContext.getContext(),
        boardInput = stage.createGain();

    var pedals = {
        sample: new FileInput(),
        line: new LineInput(),
        cabinet: new Cabinet(),
        distortion: new Distortion()
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
        pedals.distortion.load('overdrive');
    };

    this.wireUpBoard = function () {
        boardInput.connect(pedals.distortion.input);
        pedals.distortion.connect(pedals.cabinet.input);
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
Board.$inject = ["$rootScope", "FileInput", "LineInput", "Cabinet", "Distortion", "SharedAudioContext"];
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
            case 'overdrive':
                return (1 + k) * x / (1 + k * Math.abs(x));
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZHVsZS5qcyIsImJvYXJkL21vZHVsZS5qcyIsImlucHV0L21vZHVsZS5qcyIsInBlZGFsL21vZHVsZS5qcyIsInV0aWxzL21vZHVsZS5qcyIsImNvbmZpZy5qcyIsImJvYXJkL2JvYXJkLmN0cmwuanMiLCJib2FyZC9ib2FyZC5zdmMuanMiLCJpbnB1dC9maWxlX2lucHV0LnN2Yy5qcyIsImlucHV0L2lucHV0X2NvbnRyb2xzLmRpcmVjdGl2ZS5qcyIsImlucHV0L2xpbmVfaW5wdXQuc3ZjLmpzIiwidXRpbHMvc2hhcmVkX2F1ZGlvX2NvbnRleHQuZmFjdG9yeS5qcyIsInBlZGFsL2NhYmluZXQvcGVkYWxfY2FiaW5ldC5zdmMuanMiLCJwZWRhbC9kaXN0b3J0aW9uL2Rpc3RvcnRpb25fcGVkYWwuZGlyZWN0aXZlLmpzIiwicGVkYWwvZGlzdG9ydGlvbi9wZWRhbF9kaXN0b3J0aW9uLnN2Yy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtJQUNBO0lBQ0E7QUFDQTs7QUNIQTtJQUNBO0lBQ0E7SUFDQTtBQUNBOztBQ0pBOztBQUVBO0lBQ0E7QUFDQTs7QUNKQTtJQUNBO0FBQ0E7O0FDRkE7O0FBRUE7O0FDRkE7SUFDQTtJQUNBOztJQUVBO0lBQ0E7UUFDQTtZQUNBO1lBQ0EsYUFBQSxTQUFBO1lBQ0E7UUFDQTtBQUNBLENBQUE7OztBQUVBO0lBQ0E7SUFDQTtBQ2ZBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztBQUVBLENBQUE7OztBQUVBO0lBQ0E7SUFDQSxhQUFBLFNBQUE7O0FDdkJBO0lBQ0E7UUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO2dCQUNBO1lBQ0E7WUFDQTtRQUNBO1lBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7TUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsVUFBQSxLQUFBOztBQzlEQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBOztRQUVBOztRQUVBO1lBQ0E7Z0JBQ0E7Z0JBQ0E7b0JBQ0E7d0JBQ0E7d0JBQ0E7b0JBQ0E7b0JBQ0E7Z0JBQ0E7Z0JBQ0E7b0JBQ0E7Z0JBQ0E7WUFDQTtRQUNBOztRQUVBO1lBQ0E7UUFDQTs7UUFFQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTs7UUFFQTtJQUNBOzs7SUFHQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxTQUFBOztBQ2xFQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7Z0JBQ0E7Z0JBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0E7QUFDQTtJQUNBO0lBQ0EsWUFBQSxhQUFBOztBQzNCQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7O1FBRUE7WUFDQTtnQkFDQTtvQkFDQTtvQkFDQTtvQkFDQTtvQkFDQTtnQkFDQTtZQUNBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsU0FBQTs7QUM5Q0E7O0lBRUE7O0lBRUE7UUFDQTtJQUNBOztJQUVBO0FBQ0E7QUFDQTtJQUNBO0lBQ0EsVUFBQSxrQkFBQTs7QUNaQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7O1FBRUE7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7UUFDQTs7UUFFQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxPQUFBOztBQzlDQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtnQkFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxlQUFBOztBQ3RDQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTs7UUFFQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBOztRQUVBO1lBQ0E7UUFDQTs7UUFFQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1FBQ0E7WUFDQTtRQUNBO1lBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7WUFDQTs7WUFFQTtRQUNBO1lBQ0E7WUFDQTs7WUFFQTs7WUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxVQUFBIiwiZmlsZSI6ImFwcC5qcyIsInNvdXJjZXNDb250ZW50IjpbImFuZ3VsYXIubW9kdWxlKCdHdHJQZWRhbHMnLCBbXG4gICAgJ25nUm91dGUnLFxuICAgICdCb2FyZCdcbl0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ0JvYXJkJywgW1xuICAgICdJbnB1dCcsXG4gICAgJ1BlZGFsJyxcbiAgICAnU2hhcmVkQXVkaW9Db250ZXh0J1xuXSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmFuZ3VsYXIubW9kdWxlKCdJbnB1dCcsIFtcbiAgICAnU2hhcmVkQXVkaW9Db250ZXh0J1xuXSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnUGVkYWwnLCBbXG4gICAgJ1NoYXJlZEF1ZGlvQ29udGV4dCdcbl0pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5hbmd1bGFyLm1vZHVsZSgnU2hhcmVkQXVkaW9Db250ZXh0JywgW10pO1xuIiwiZnVuY3Rpb24gY29uZmlnKCRyb3V0ZVByb3ZpZGVyLCAkbG9jYXRpb25Qcm92aWRlcikge1xuICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1vekdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWE7XG4gICAgd2luZG93LkF1ZGlvQ29udGV4dCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtcblxuICAgICRsb2NhdGlvblByb3ZpZGVyLmh0bWw1TW9kZSh0cnVlKTtcbiAgICAkcm91dGVQcm92aWRlclxuICAgICAgICAud2hlbignLycsIHtcbiAgICAgICAgICAgIHRlbXBsYXRlVXJsOiAnL3RlbXBsYXRlcy9ib2FyZC5odG1sJyxcbiAgICAgICAgICAgIGNvbnRyb2xsZXI6ICdCb2FyZEN0cmwnLFxuICAgICAgICAgICAgY29udHJvbGxlckFzOiAndm0nXG4gICAgICAgIH0pO1xufVxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnR3RyUGVkYWxzJylcbiAgICAuY29uZmlnKGNvbmZpZyk7IiwiZnVuY3Rpb24gQm9hcmRDdHJsIChCb2FyZCkge1xuICAgIHZhciB2bSA9IHRoaXM7XG5cbiAgICBCb2FyZC5sb2FkU291cmNlKCk7XG4gICAgQm9hcmQubG9hZFBlZGFscygpO1xuICAgIEJvYXJkLndpcmVVcEJvYXJkKCk7XG5cbiAgICB2bS5wbGF5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIEJvYXJkLnBsYXlTYW1wbGUoKTtcbiAgICB9O1xuXG4gICAgdm0uc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBCb2FyZC5zdG9wU2FtcGxlKCk7XG4gICAgfTtcblxuICAgIHZtLmxpdmVJbnB1dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBCb2FyZC50b2dnbGVMaXZlSW5wdXQoKTtcbiAgICB9XG5cbn1cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0JvYXJkJylcbiAgICAuY29udHJvbGxlcignQm9hcmRDdHJsJywgQm9hcmRDdHJsKTtcbiIsImZ1bmN0aW9uIEJvYXJkKCRyb290U2NvcGUsIEZpbGVJbnB1dCwgTGluZUlucHV0LCBDYWJpbmV0LCBEaXN0b3J0aW9uLCBTaGFyZWRBdWRpb0NvbnRleHQpIHtcbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpLFxuICAgICAgICBib2FyZElucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuXG4gICAgdmFyIHBlZGFscyA9IHtcbiAgICAgICAgc2FtcGxlOiBuZXcgRmlsZUlucHV0KCksXG4gICAgICAgIGxpbmU6IG5ldyBMaW5lSW5wdXQoKSxcbiAgICAgICAgY2FiaW5ldDogbmV3IENhYmluZXQoKSxcbiAgICAgICAgZGlzdG9ydGlvbjogbmV3IERpc3RvcnRpb24oKVxuICAgIH07XG5cbiAgICB2YXIgc2FtcGxlcyA9IFtcbiAgICAgICAgJ2Fzc2V0cy9zYW1wbGVzL29wZW4ud2F2JyxcbiAgICAgICAgJ2Fzc2V0cy9zYW1wbGVzL2Nob3Jkcy53YXYnLFxuICAgICAgICAnYXNzZXRzL3NhbXBsZXMvZXZlcmxvbmcud2F2JyxcbiAgICAgICAgJ2Fzc2V0cy9zYW1wbGVzL29jdGF2ZXMud2F2JyxcbiAgICAgICAgJ2Fzc2V0cy9zYW1wbGVzL0ZGLndhdicsXG4gICAgXTtcblxuICAgIHRoaXMubG9hZFNvdXJjZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLnNhbXBsZS5sb2FkQnVmZmVyKHNhbXBsZXNbMV0pO1xuICAgICAgICBwZWRhbHMuc2FtcGxlLmNvbm5lY3QoYm9hcmRJbnB1dCk7XG4gICAgfTtcblxuICAgIHRoaXMubG9hZFBlZGFscyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLmNhYmluZXQubG9hZCgnYXNzZXRzL2lyLzUxNTAud2F2Jyk7XG4gICAgICAgIHBlZGFscy5kaXN0b3J0aW9uLmxvYWQoJ292ZXJkcml2ZScpO1xuICAgIH07XG5cbiAgICB0aGlzLndpcmVVcEJvYXJkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBib2FyZElucHV0LmNvbm5lY3QocGVkYWxzLmRpc3RvcnRpb24uaW5wdXQpO1xuICAgICAgICBwZWRhbHMuZGlzdG9ydGlvbi5jb25uZWN0KHBlZGFscy5jYWJpbmV0LmlucHV0KTtcbiAgICAgICAgcGVkYWxzLmNhYmluZXQuY29ubmVjdChzdGFnZS5kZXN0aW5hdGlvbik7XG4gICAgfTtcblxuICAgIHRoaXMucGxheVNhbXBsZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLnNhbXBsZS5wbGF5KCk7XG4gICAgfTtcblxuICAgIHRoaXMuc3RvcFNhbXBsZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLnNhbXBsZS5zdG9wKCk7XG4gICAgfTtcblxuICAgIHRoaXMudG9nZ2xlTGl2ZUlucHV0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXBlZGFscy5saW5lLmlzU3RyZWFtaW5nKSB7XG4gICAgICAgICAgICBwZWRhbHMubGluZS5sb2FkKCk7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbignbGluZWluOmxvYWRlZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBwZWRhbHMubGluZS5zdHJlYW0uY29ubmVjdChib2FyZElucHV0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcGVkYWxzLmxpbmUuaXNTdHJlYW1pbmcgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVkYWxzLmxpbmUuc3RvcCgpO1xuICAgICAgICAgICAgcGVkYWxzLmxpbmUuaXNTdHJlYW1pbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLmdldFBlZGFsID0gZnVuY3Rpb24gKGVmZmVjdCkge1xuICAgICAgcmV0dXJuIHBlZGFsc1tlZmZlY3RdO1xuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnQm9hcmQnKVxuICAgIC5zZXJ2aWNlKCdCb2FyZCcsIEJvYXJkKTtcbiIsImZ1bmN0aW9uIEZpbGVJbnB1dCAoU2hhcmVkQXVkaW9Db250ZXh0KSB7XG5cbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpO1xuXG4gICAgdmFyIEZpbGVJbnB1dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5zb3VyY2UgPSBudWxsO1xuICAgICAgICB0aGlzLnNhbXBsZSA9IG51bGw7XG4gICAgfTtcblxuICAgIEZpbGVJbnB1dC5wcm90b3R5cGUubG9hZEJ1ZmZlciA9IGZ1bmN0aW9uKHVybCkge1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICByZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcbiAgICAgICAgcmVxdWVzdC5yZXNwb25zZVR5cGUgPSBcImFycmF5YnVmZmVyXCI7XG5cbiAgICAgICAgdmFyIGxvYWRlciA9IHRoaXM7XG5cbiAgICAgICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHN0YWdlLmRlY29kZUF1ZGlvRGF0YShcbiAgICAgICAgICAgICAgICByZXF1ZXN0LnJlc3BvbnNlLFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWxlcnQoJ2Vycm9yIGRlY29kaW5nIGZpbGUgZGF0YTogJyArIHVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9hZGVyLnNhbXBsZSA9IGJ1ZmZlcjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ2RlY29kZUF1ZGlvRGF0YSBlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBhbGVydCgnQnVmZmVyTG9hZGVyOiBYSFIgZXJyb3InKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcXVlc3Quc2VuZCgpO1xuICAgIH07XG5cbiAgICBGaWxlSW5wdXQucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbih0YXJnZXQpe1xuICAgICAgICB0aGlzLm91dHB1dC5jb25uZWN0KHRhcmdldCk7XG4gICAgfTtcblxuICAgIEZpbGVJbnB1dC5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnNvdXJjZSA9IHN0YWdlLmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgICAgICB0aGlzLnNvdXJjZS5sb29wID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zb3VyY2UuYnVmZmVyID0gdGhpcy5zYW1wbGU7XG5cbiAgICAgICAgdGhpcy5zb3VyY2UuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgdGhpcy5zb3VyY2Uuc3RhcnQoMCk7XG4gICAgfTtcblxuXG4gICAgRmlsZUlucHV0LnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc291cmNlLnN0b3AoKTtcbiAgICAgICAgdGhpcy5zb3VyY2UuZGlzY29ubmVjdCgpO1xuICAgIH07XG5cbiAgICByZXR1cm4gRmlsZUlucHV0O1xufVxuXG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdJbnB1dCcpXG4gICAgLmZhY3RvcnkoJ0ZpbGVJbnB1dCcsIEZpbGVJbnB1dCk7XG4iLCJmdW5jdGlvbiBpbnB1dENvbnRyb2xzKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ3RlbXBsYXRlcy9jb250cm9scy5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50KSB7XG4gICAgICAgICAgICB2YXIgc3RhcnQgPSBhbmd1bGFyLmVsZW1lbnQoJy5nbHlwaGljb24tcGxheScpLFxuICAgICAgICAgICAgICAgIHN0b3AgPSBhbmd1bGFyLmVsZW1lbnQoJy5nbHlwaGljb24tc3RvcCcpLFxuICAgICAgICAgICAgICAgIGxpdmVJbnB1dCA9IGFuZ3VsYXIuZWxlbWVudCgnLmdseXBoaWNvbi1yZWNvcmQnKTtcblxuICAgICAgICAgICAgc3RhcnQub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBzdG9wLnByb3AoJ2Rpc2FibGVkJywgZmFsc2UpO1xuICAgICAgICAgICAgICAgIHN0YXJ0LnByb3AoJ2Rpc2FibGVkJywgdHJ1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgc3RvcC5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIHN0YXJ0LnByb3AoJ2Rpc2FibGVkJywgZmFsc2UpO1xuICAgICAgICAgICAgICAgIHN0b3AucHJvcCgnZGlzYWJsZWQnLCB0cnVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBsaXZlSW5wdXQub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBsaXZlSW5wdXQudG9nZ2xlQ2xhc3MoXCJidG4tZGFuZ2VyXCIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0lucHV0JylcbiAgICAuZGlyZWN0aXZlKCdpbnB1dENvbnRyb2xzJywgaW5wdXRDb250cm9scyk7XG4iLCJmdW5jdGlvbiBMaW5lSW5wdXQoJHJvb3RTY29wZSwgU2hhcmVkQXVkaW9Db250ZXh0KSB7XG5cbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpO1xuXG4gICAgdmFyIExpbmVJbnB1dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuc3RyZWFtID0gbnVsbDtcbiAgICAgICAgdGhpcy5pc1N0cmVhbWluZyA9IGZhbHNlO1xuICAgIH07XG5cbiAgICBMaW5lSW5wdXQucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKHtcbiAgICAgICAgICAgIFwiYXVkaW9cIjoge1xuICAgICAgICAgICAgICAgIFwib3B0aW9uYWxcIjogW1xuICAgICAgICAgICAgICAgICAgICB7XCJnb29nRWNob0NhbmNlbGxhdGlvblwiOiBcImZhbHNlXCJ9LFxuICAgICAgICAgICAgICAgICAgICB7XCJnb29nQXV0b0dhaW5Db250cm9sXCI6IFwiZmFsc2VcIn0sXG4gICAgICAgICAgICAgICAgICAgIHtcImdvb2dOb2lzZVN1cHByZXNzaW9uXCI6IFwidHJ1ZVwifSxcbiAgICAgICAgICAgICAgICAgICAge1wiZ29vZ0hpZ2hwYXNzRmlsdGVyXCI6IFwiZmFsc2VcIn1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uIChzdHJlYW0pIHtcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtID0gc3RhZ2UuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc3RyZWFtKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGVtaXQoJ2xpbmVpbjpsb2FkZWQnKTtcbiAgICAgICAgICAgIHRoaXMuaXNTdHJlYW1pbmcgPSB0cnVlO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdHdWl0YXIgc3RyZWFtIGZhaWxlZDogJyArIGVycik7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBMaW5lSW5wdXQucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbiAodGFyZ2V0KSB7XG4gICAgICAgIHRoaXMuc3RyZWFtLmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgTGluZUlucHV0LnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnN0cmVhbS5kaXNjb25uZWN0KCk7XG4gICAgICAgIHRoaXMuaXNTdHJlYW1pbmcgPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIExpbmVJbnB1dDtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnSW5wdXQnKVxuICAgIC5zZXJ2aWNlKCdMaW5lSW5wdXQnLCBMaW5lSW5wdXQpO1xuIiwiZnVuY3Rpb24gU2hhcmVkQXVkaW9Db250ZXh0ICgpIHtcblxuICAgIHZhciBTaGFyZWRBdWRpb0NvbnRleHQgPSB7fTtcblxuICAgIFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb250ZXh0IHx8ICh0aGlzLmNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFNoYXJlZEF1ZGlvQ29udGV4dDtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdTaGFyZWRBdWRpb0NvbnRleHQnKVxuICAgIC5mYWN0b3J5KCdTaGFyZWRBdWRpb0NvbnRleHQnLCBTaGFyZWRBdWRpb0NvbnRleHQpO1xuIiwiZnVuY3Rpb24gQ2FiaW5ldCAoU2hhcmVkQXVkaW9Db250ZXh0KSB7XG5cbiAgICB2YXIgc3RhZ2UgPSBTaGFyZWRBdWRpb0NvbnRleHQuZ2V0Q29udGV4dCgpO1xuXG4gICAgdmFyIENhYmluZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5pbnB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuYm9vc3QgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuY29udm9sdmVyID0gc3RhZ2UuY3JlYXRlQ29udm9sdmVyKCk7XG4gICAgfTtcblxuICAgIENhYmluZXQucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbihpclBhdGgpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgcmVxdWVzdC5vcGVuKCdHRVQnLCBpclBhdGgsIHRydWUpO1xuICAgICAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cbiAgICAgICAgdmFyIGxvYWRlciA9IHRoaXM7XG5cbiAgICAgICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzdGFnZS5kZWNvZGVBdWRpb0RhdGEocmVxdWVzdC5yZXNwb25zZSwgZnVuY3Rpb24gKGJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIGxvYWRlci5jb252b2x2ZXIuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZSkgY29uc29sZS5sb2coXCJDYW5ub3QgbG9hZCBjYWJpbmV0XCIgKyBlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJlcXVlc3Quc2VuZChudWxsKTtcblxuICAgICAgICB0aGlzLmlucHV0LmdhaW4udmFsdWUgPSAzO1xuICAgICAgICB0aGlzLmJvb3N0LmdhaW4udmFsdWUgPSAxO1xuXG4gICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLmNvbnZvbHZlcik7XG4gICAgICAgIHRoaXMuY29udm9sdmVyLmNvbm5lY3QodGhpcy5ib29zdCk7XG4gICAgICAgIHRoaXMuYm9vc3QuY29ubmVjdCh0aGlzLm91dHB1dCk7XG4gICAgfTtcblxuICAgIENhYmluZXQucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbih0YXJnZXQpe1xuICAgICAgICB0aGlzLm91dHB1dC5jb25uZWN0KHRhcmdldCk7XG4gICAgfTtcblxuICAgIHJldHVybiBDYWJpbmV0O1xufVxuXG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdQZWRhbCcpXG4gICAgLmZhY3RvcnkoJ0NhYmluZXQnLCBDYWJpbmV0KTtcbiIsImZ1bmN0aW9uIGRpc3RvcnRpb25QZWRhbCAoQm9hcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICd0ZW1wbGF0ZXMvZGlzdG9ydGlvbi5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IE1JRF9MRVZFTCA9IDUuNTtcbiAgICAgICAgICAgIHZhciBkaXN0b3J0aW9uID0gQm9hcmQuZ2V0UGVkYWwoJ2Rpc3RvcnRpb24nKTtcblxuICAgICAgICAgICAgdmFyIHZvbHVtZSA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZGlzdG9ydGlvbi12b2x1bWUnKSxcbiAgICAgICAgICAgICAgICB0b25lID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNkaXN0b3J0aW9uLXRvbmUnKSxcbiAgICAgICAgICAgICAgICBmb290c3dpdGNoID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8tc3dpdGNoI2Rpc3RvcnRpb24tZm9vdC1zdycpLFxuICAgICAgICAgICAgICAgIGxlZCA9ICRlbGVtZW50LmZpbmQoJy5sZWQnKTtcblxuICAgICAgICAgICAgdm9sdW1lLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZGlzdG9ydGlvbi5zZXRWb2x1bWUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2b2x1bWUudmFsKE1JRF9MRVZFTCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdG9uZS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGRpc3RvcnRpb24uc2V0VG9uZShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdG9uZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB0b25lLnZhbChNSURfTEVWRUwpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZvb3Rzd2l0Y2gub24oJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGxlZC50b2dnbGVDbGFzcygnYWN0aXZlJyk7XG4gICAgICAgICAgICAgICAgZGlzdG9ydGlvbi5ieXBhc3MoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdQZWRhbCcpXG4gICAgLmRpcmVjdGl2ZSgnZGlzdG9ydGlvblBlZGFsJywgZGlzdG9ydGlvblBlZGFsKTtcbiIsImZ1bmN0aW9uIERpc3RvcnRpb24gKFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuXG4gICAgdmFyIHN0YWdlID0gU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQoKTtcblxuICAgIHZhciBEaXN0b3J0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmdhaW4gPSBzdGFnZS5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlciA9IHN0YWdlLmNyZWF0ZVdhdmVTaGFwZXIoKTtcbiAgICAgICAgdGhpcy5sb3dwYXNzID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5ib29zdCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmN1dCA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLnZvbHVtZSA9IDcuNTtcbiAgICAgICAgdGhpcy50b25lID0gMjA7XG4gICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IHRydWU7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbih0eXBlKSB7XG5cbiAgICAgICAgdGhpcy5nYWluLmdhaW4udmFsdWUgPSB0aGlzLnZvbHVtZTtcblxuICAgICAgICB0aGlzLmxvd3Bhc3MudHlwZSA9IFwibG93cGFzc1wiO1xuICAgICAgICB0aGlzLmxvd3Bhc3MuZnJlcXVlbmN5LnZhbHVlID0gNTAwMDtcblxuICAgICAgICB0aGlzLmJvb3N0LnR5cGUgPSBcImxvd3NoZWxmXCI7XG4gICAgICAgIHRoaXMuYm9vc3QuZnJlcXVlbmN5LnZhbHVlID0gMTAwO1xuICAgICAgICB0aGlzLmJvb3N0LmdhaW4udmFsdWUgPSA2O1xuXG4gICAgICAgIHRoaXMuY3V0LnR5cGUgPSBcImxvd3NoZWxmXCI7XG4gICAgICAgIHRoaXMuY3V0LmZyZXF1ZW5jeS52YWx1ZSA9IDEwMDtcbiAgICAgICAgdGhpcy5jdXQuZ2Fpbi52YWx1ZSA9IC02O1xuXG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5jdXJ2ZSA9IHRoaXMubWFrZURpc3RvcnRpb25DdXJ2ZSgxMCwgdHlwZSk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5vdmVyc2FtcGxlID0gJzR4JztcblxuICAgICAgICB0aGlzLmhpZ2hwYXNzLnR5cGUgPSBcImhpZ2hwYXNzXCI7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MuZnJlcXVlbmN5LnZhbHVlID0gdGhpcy50b25lO1xuXG4gICAgICAgIHRoaXMuZ2Fpbi5jb25uZWN0KHRoaXMubG93cGFzcylcbiAgICAgICAgdGhpcy5sb3dwYXNzLmNvbm5lY3QodGhpcy5ib29zdCk7XG4gICAgICAgIHRoaXMuYm9vc3QuY29ubmVjdCh0aGlzLndhdmVzaGFwZXIpO1xuICAgICAgICB0aGlzLndhdmVzaGFwZXIuY29ubmVjdCh0aGlzLmN1dCk7XG4gICAgICAgIHRoaXMuY3V0LmNvbm5lY3QodGhpcy5oaWdocGFzcyk7XG5cbiAgICAgICAgLy9ieXBhc3MgYnkgZGVmYXVsdFxuICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5vdXRwdXQpO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5tYWtlRGlzdG9ydGlvbkN1cnZlID0gZnVuY3Rpb24gKGFtb3VudCwgdHlwZSkge1xuICAgICAgICB2YXIgayA9IHR5cGVvZiBhbW91bnQgPT09ICdudW1iZXInID8gYW1vdW50IDogMTAsXG4gICAgICAgICAgICBzYW1wbGVzID0gMTEwMjUsXG4gICAgICAgICAgICBjdXJ2ZSA9IG5ldyBGbG9hdDMyQXJyYXkoc2FtcGxlcyk7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzYW1wbGVzOyArK2kpIHtcbiAgICAgICAgICAgIGN1cnZlW2ldID0gdGhpcy5jdXJ2ZUFsZ29yaXRobShpICogMiAvIHNhbXBsZXMgLSAxLCB0eXBlLCBrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjdXJ2ZTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuY3VydmVBbGdvcml0aG0gPSBmdW5jdGlvbiAoeCwgdHlwZSwgaykge1xuICAgICAgICBzd2l0Y2godHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnb3ZlcmRyaXZlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gKDEgKyBrKSAqIHggLyAoMSArIGsgKiBNYXRoLmFicyh4KSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0MSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4KC0wLjUsIE1hdGgubWluKDAuNSwgeCAqIGspKTtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3QyJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5tYXgoLTEsIE1hdGgubWluKDEsIHggKiBrKSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0Myc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4KC0wLjUsIE1hdGgubWluKDEuNSwgeCApKTtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3Q0JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gMi44ICogTWF0aC5wb3coeCwgMykgKyBNYXRoLnBvdyh4LDIpICsgLTEuMSAqIHggLSAwLjU7XG4gICAgICAgICAgICBjYXNlICdkaXN0NSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIChNYXRoLmV4cCh4KSAtIE1hdGguZXhwKC14ICogMS4yKSkgLyAoTWF0aC5leHAoeCkgKyBNYXRoLmV4cCgteCkpO1xuICAgICAgICAgICAgY2FzZSAnZGlzdDYnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnRhbmgoeCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUudGFuaCA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIGlmICh4ID09PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSBpZiAoeCA9PT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gKE1hdGguZXhwKHgpIC0gTWF0aC5leHAoLXgpKSAvIChNYXRoLmV4cCh4KSArIE1hdGguZXhwKC14KSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUuc2lnbiA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIHggPSAreDsgLy8gY29udmVydCB0byBhIG51bWJlclxuICAgICAgICBpZiAoeCA9PT0gMCB8fCBpc05hTih4KSlcbiAgICAgICAgICAgIHJldHVybiB4O1xuICAgICAgICByZXR1cm4geCA+IDAgPyAxIDogLTE7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbih0YXJnZXQpe1xuICAgICAgICB0aGlzLm91dHB1dC5jb25uZWN0KHRhcmdldCk7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLmJ5cGFzcyA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIGlmKHRoaXMuaXNCeXBhc3NlZCkge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmlucHV0LmNvbm5lY3QodGhpcy5nYWluKTtcbiAgICAgICAgICAgIHRoaXMuaGlnaHBhc3MuY29ubmVjdCh0aGlzLm91dHB1dCk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNCeXBhc3NlZCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLmhpZ2hwYXNzLmRpc2Nvbm5lY3QoKTtcblxuICAgICAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICAgICAgdGhpcy5pc0J5cGFzc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICAgICAgdGhpcy5nYWluLmdhaW4udmFsdWUgPSAxLjUgKiB2b2x1bWU7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLnNldFRvbmUgPSBmdW5jdGlvbih0b25lKSB7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MuZnJlcXVlbmN5LnZhbHVlID0gMjAgKiB0b25lO1xuICAgIH07XG5cbiAgICByZXR1cm4gRGlzdG9ydGlvbjtcbn1cblxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5mYWN0b3J5KCdEaXN0b3J0aW9uJywgRGlzdG9ydGlvbik7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=