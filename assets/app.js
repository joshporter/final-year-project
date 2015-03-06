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

    this.loadSource = function () {
        pedals.sample.loadBuffer('assets/samples/open.wav');
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

    this.getPedals = function () {
      return pedals;
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
distortionPedal.$inject = ["Board"];
angular
    .module('Pedal')
    .directive('distortionPedal', distortionPedal);

function Distortion (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var Distortion = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.waveshaper = stage.createWaveShaper();
        this.lowpass = stage.createBiquadFilter();
        this.highpass = stage.createBiquadFilter();
        this.boost = stage.createBiquadFilter();
        this.cut = stage.createBiquadFilter();
        this.volume = 7.5;
        this.tone = 20;
    };

    Distortion.prototype.load = function(type) {

        this.input.gain.value = this.volume;

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

        this.input.connect(this.lowpass);
        this.lowpass.connect(this.boost);
        this.boost.connect(this.waveshaper);
        this.waveshaper.connect(this.cut);
        this.cut.connect(this.highpass);
        this.highpass.connect(this.output);
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

    Distortion.prototype.setVolume = function(volume) {
        this.input.gain.value = 1.5 * volume;
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZHVsZS5qcyIsImJvYXJkL21vZHVsZS5qcyIsImlucHV0L21vZHVsZS5qcyIsInBlZGFsL21vZHVsZS5qcyIsInV0aWxzL21vZHVsZS5qcyIsImNvbmZpZy5qcyIsImJvYXJkL2JvYXJkLmN0cmwuanMiLCJib2FyZC9ib2FyZC5zdmMuanMiLCJpbnB1dC9maWxlX2lucHV0LnN2Yy5qcyIsImlucHV0L2lucHV0X2NvbnRyb2xzLmRpcmVjdGl2ZS5qcyIsImlucHV0L2xpbmVfaW5wdXQuc3ZjLmpzIiwidXRpbHMvc2hhcmVkX2F1ZGlvX2NvbnRleHQuZmFjdG9yeS5qcyIsInBlZGFsL2NhYmluZXQvcGVkYWxfY2FiaW5ldC5zdmMuanMiLCJwZWRhbC9kaXN0b3J0aW9uL2Rpc3RvcnRpb25fcGVkYWwuZGlyZWN0aXZlLmpzIiwicGVkYWwvZGlzdG9ydGlvbi9wZWRhbF9kaXN0b3J0aW9uLnN2Yy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtJQUNBO0lBQ0E7QUFDQTs7QUNIQTtJQUNBO0lBQ0E7SUFDQTtBQUNBOztBQ0pBOztBQUVBO0lBQ0E7QUFDQTs7QUNKQTtJQUNBO0FBQ0E7O0FDRkE7O0FBRUE7O0FDRkE7SUFDQTtJQUNBOztJQUVBO0lBQ0E7UUFDQTtZQUNBO1lBQ0EsYUFBQSxTQUFBO1lBQ0E7UUFDQTtBQUNBLENBQUE7OztBQUVBO0lBQ0E7SUFDQTtBQ2ZBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztBQUVBLENBQUE7OztBQUVBO0lBQ0E7SUFDQSxhQUFBLFNBQUE7O0FDdkJBO0lBQ0E7UUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO1FBQ0E7WUFDQTtZQUNBO2dCQUNBO1lBQ0E7WUFDQTtRQUNBO1lBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7TUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsVUFBQSxLQUFBOztBQ3REQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7UUFDQTtRQUNBOztRQUVBOztRQUVBO1lBQ0E7Z0JBQ0E7Z0JBQ0E7b0JBQ0E7d0JBQ0E7d0JBQ0E7b0JBQ0E7b0JBQ0E7Z0JBQ0E7Z0JBQ0E7b0JBQ0E7Z0JBQ0E7WUFDQTtRQUNBOztRQUVBO1lBQ0E7UUFDQTs7UUFFQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTs7UUFFQTtJQUNBOzs7SUFHQTtRQUNBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxTQUFBOztBQ2xFQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7Z0JBQ0E7Z0JBQ0E7O1lBRUE7Z0JBQ0E7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtnQkFDQTtZQUNBOztZQUVBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0E7QUFDQTtJQUNBO0lBQ0EsWUFBQSxhQUFBOztBQzNCQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7O1FBRUE7WUFDQTtnQkFDQTtvQkFDQTtvQkFDQTtvQkFDQTtvQkFDQTtnQkFDQTtZQUNBO1FBQ0E7WUFDQTtZQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7QUFDQSxDQUFBOzs7O0FBR0E7SUFDQTtJQUNBLFVBQUEsU0FBQTs7QUM5Q0E7O0lBRUE7O0lBRUE7UUFDQTtJQUNBOztJQUVBO0FBQ0E7QUFDQTtJQUNBO0lBQ0EsVUFBQSxrQkFBQTs7QUNaQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7O1FBRUE7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7UUFDQTs7UUFFQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtBQUNBLENBQUE7Ozs7QUFHQTtJQUNBO0lBQ0EsVUFBQSxPQUFBOztBQzlDQTtJQUNBO1FBQ0E7UUFDQTtRQUNBO1lBQ0E7Z0JBQ0E7Z0JBQ0E7Z0JBQ0E7O1lBRUE7Z0JBQ0E7WUFDQTs7WUFFQTtnQkFDQTtZQUNBOztZQUVBO1lBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBOztZQUVBO2dCQUNBO2dCQUNBO1lBQ0E7UUFDQTtJQUNBO0FBQ0EsQ0FBQTs7QUFDQTtJQUNBO0lBQ0EsWUFBQSxlQUFBOztBQ25DQTs7SUFFQTs7SUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtJQUNBOztJQUVBOztRQUVBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO1lBQ0E7O1FBRUE7WUFDQTtRQUNBOztRQUVBO0lBQ0E7O0lBRUE7UUFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1lBQ0E7Z0JBQ0E7WUFDQTtnQkFDQTtZQUNBO2dCQUNBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO1lBQ0E7UUFDQTtZQUNBO1FBQ0E7WUFDQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtRQUNBO1lBQ0E7UUFDQTtJQUNBOztJQUVBO1FBQ0E7SUFDQTs7SUFFQTtRQUNBO0lBQ0E7O0lBRUE7UUFDQTtJQUNBOztJQUVBO0FBQ0EsQ0FBQTs7OztBQUdBO0lBQ0E7SUFDQSxVQUFBLFVBQUEiLCJmaWxlIjoiYXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiYW5ndWxhci5tb2R1bGUoJ0d0clBlZGFscycsIFtcbiAgICAnbmdSb3V0ZScsXG4gICAgJ0JvYXJkJ1xuXSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnQm9hcmQnLCBbXG4gICAgJ0lucHV0JyxcbiAgICAnUGVkYWwnLFxuICAgICdTaGFyZWRBdWRpb0NvbnRleHQnXG5dKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuYW5ndWxhci5tb2R1bGUoJ0lucHV0JywgW1xuICAgICdTaGFyZWRBdWRpb0NvbnRleHQnXG5dKTtcbiIsImFuZ3VsYXIubW9kdWxlKCdQZWRhbCcsIFtcbiAgICAnU2hhcmVkQXVkaW9Db250ZXh0J1xuXSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmFuZ3VsYXIubW9kdWxlKCdTaGFyZWRBdWRpb0NvbnRleHQnLCBbXSk7XG4iLCJmdW5jdGlvbiBjb25maWcoJHJvdXRlUHJvdmlkZXIsICRsb2NhdGlvblByb3ZpZGVyKSB7XG4gICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYTtcbiAgICB3aW5kb3cuQXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuXG4gICAgJGxvY2F0aW9uUHJvdmlkZXIuaHRtbDVNb2RlKHRydWUpO1xuICAgICRyb3V0ZVByb3ZpZGVyXG4gICAgICAgIC53aGVuKCcvJywge1xuICAgICAgICAgICAgdGVtcGxhdGVVcmw6ICcvdGVtcGxhdGVzL2JvYXJkLmh0bWwnLFxuICAgICAgICAgICAgY29udHJvbGxlcjogJ0JvYXJkQ3RybCcsXG4gICAgICAgICAgICBjb250cm9sbGVyQXM6ICd2bSdcbiAgICAgICAgfSk7XG59XG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdHdHJQZWRhbHMnKVxuICAgIC5jb25maWcoY29uZmlnKTsiLCJmdW5jdGlvbiBCb2FyZEN0cmwgKEJvYXJkKSB7XG4gICAgdmFyIHZtID0gdGhpcztcblxuICAgIEJvYXJkLmxvYWRTb3VyY2UoKTtcbiAgICBCb2FyZC5sb2FkUGVkYWxzKCk7XG4gICAgQm9hcmQud2lyZVVwQm9hcmQoKTtcblxuICAgIHZtLnBsYXkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgQm9hcmQucGxheVNhbXBsZSgpO1xuICAgIH07XG5cbiAgICB2bS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIEJvYXJkLnN0b3BTYW1wbGUoKTtcbiAgICB9O1xuXG4gICAgdm0ubGl2ZUlucHV0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIEJvYXJkLnRvZ2dsZUxpdmVJbnB1dCgpO1xuICAgIH1cblxufVxuXG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnQm9hcmQnKVxuICAgIC5jb250cm9sbGVyKCdCb2FyZEN0cmwnLCBCb2FyZEN0cmwpO1xuIiwiZnVuY3Rpb24gQm9hcmQoJHJvb3RTY29wZSwgRmlsZUlucHV0LCBMaW5lSW5wdXQsIENhYmluZXQsIERpc3RvcnRpb24sIFNoYXJlZEF1ZGlvQ29udGV4dCkge1xuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCksXG4gICAgICAgIGJvYXJkSW5wdXQgPSBzdGFnZS5jcmVhdGVHYWluKCk7XG5cbiAgICB2YXIgcGVkYWxzID0ge1xuICAgICAgICBzYW1wbGU6IG5ldyBGaWxlSW5wdXQoKSxcbiAgICAgICAgbGluZTogbmV3IExpbmVJbnB1dCgpLFxuICAgICAgICBjYWJpbmV0OiBuZXcgQ2FiaW5ldCgpLFxuICAgICAgICBkaXN0b3J0aW9uOiBuZXcgRGlzdG9ydGlvbigpXG4gICAgfTtcblxuICAgIHRoaXMubG9hZFNvdXJjZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLnNhbXBsZS5sb2FkQnVmZmVyKCdhc3NldHMvc2FtcGxlcy9vcGVuLndhdicpO1xuICAgICAgICBwZWRhbHMuc2FtcGxlLmNvbm5lY3QoYm9hcmRJbnB1dCk7XG4gICAgfTtcblxuICAgIHRoaXMubG9hZFBlZGFscyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLmNhYmluZXQubG9hZCgnYXNzZXRzL2lyLzUxNTAud2F2Jyk7XG4gICAgICAgIHBlZGFscy5kaXN0b3J0aW9uLmxvYWQoJ292ZXJkcml2ZScpO1xuICAgIH07XG5cbiAgICB0aGlzLndpcmVVcEJvYXJkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBib2FyZElucHV0LmNvbm5lY3QocGVkYWxzLmRpc3RvcnRpb24uaW5wdXQpO1xuICAgICAgICBwZWRhbHMuZGlzdG9ydGlvbi5jb25uZWN0KHBlZGFscy5jYWJpbmV0LmlucHV0KTtcbiAgICAgICAgcGVkYWxzLmNhYmluZXQuY29ubmVjdChzdGFnZS5kZXN0aW5hdGlvbik7XG4gICAgfTtcblxuICAgIHRoaXMucGxheVNhbXBsZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLnNhbXBsZS5wbGF5KCk7XG4gICAgfTtcblxuICAgIHRoaXMuc3RvcFNhbXBsZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVkYWxzLnNhbXBsZS5zdG9wKCk7XG4gICAgfTtcblxuICAgIHRoaXMudG9nZ2xlTGl2ZUlucHV0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXBlZGFscy5saW5lLmlzU3RyZWFtaW5nKSB7XG4gICAgICAgICAgICBwZWRhbHMubGluZS5sb2FkKCk7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbignbGluZWluOmxvYWRlZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBwZWRhbHMubGluZS5zdHJlYW0uY29ubmVjdChib2FyZElucHV0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcGVkYWxzLmxpbmUuaXNTdHJlYW1pbmcgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVkYWxzLmxpbmUuc3RvcCgpO1xuICAgICAgICAgICAgcGVkYWxzLmxpbmUuaXNTdHJlYW1pbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLmdldFBlZGFscyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBwZWRhbHM7XG4gICAgfTtcbn1cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdCb2FyZCcpXG4gICAgLnNlcnZpY2UoJ0JvYXJkJywgQm9hcmQpO1xuIiwiZnVuY3Rpb24gRmlsZUlucHV0IChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgRmlsZUlucHV0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc2FtcGxlID0gbnVsbDtcbiAgICB9O1xuXG4gICAgRmlsZUlucHV0LnByb3RvdHlwZS5sb2FkQnVmZmVyID0gZnVuY3Rpb24odXJsKSB7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgIHJlcXVlc3Qub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICAgICAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcblxuICAgICAgICB2YXIgbG9hZGVyID0gdGhpcztcblxuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc3RhZ2UuZGVjb2RlQXVkaW9EYXRhKFxuICAgICAgICAgICAgICAgIHJlcXVlc3QucmVzcG9uc2UsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oYnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghYnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbGVydCgnZXJyb3IgZGVjb2RpbmcgZmlsZSBkYXRhOiAnICsgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2FkZXIuc2FtcGxlID0gYnVmZmVyO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignZGVjb2RlQXVkaW9EYXRhIGVycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGFsZXJ0KCdCdWZmZXJMb2FkZXI6IFhIUiBlcnJvcicpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5zZW5kKCk7XG4gICAgfTtcblxuICAgIEZpbGVJbnB1dC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgRmlsZUlucHV0LnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc291cmNlID0gc3RhZ2UuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgICAgIHRoaXMuc291cmNlLmxvb3AgPSB0cnVlO1xuICAgICAgICB0aGlzLnNvdXJjZS5idWZmZXIgPSB0aGlzLnNhbXBsZTtcblxuICAgICAgICB0aGlzLnNvdXJjZS5jb25uZWN0KHRoaXMub3V0cHV0KTtcblxuICAgICAgICB0aGlzLnNvdXJjZS5zdGFydCgwKTtcbiAgICB9O1xuXG5cbiAgICBGaWxlSW5wdXQucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zb3VyY2Uuc3RvcCgpO1xuICAgICAgICB0aGlzLnNvdXJjZS5kaXNjb25uZWN0KCk7XG4gICAgfTtcblxuICAgIHJldHVybiBGaWxlSW5wdXQ7XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ0lucHV0JylcbiAgICAuZmFjdG9yeSgnRmlsZUlucHV0JywgRmlsZUlucHV0KTtcbiIsImZ1bmN0aW9uIGlucHV0Q29udHJvbHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAndGVtcGxhdGVzL2NvbnRyb2xzLmh0bWwnLFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBzdGFydCA9IGFuZ3VsYXIuZWxlbWVudCgnLmdseXBoaWNvbi1wbGF5JyksXG4gICAgICAgICAgICAgICAgc3RvcCA9IGFuZ3VsYXIuZWxlbWVudCgnLmdseXBoaWNvbi1zdG9wJyksXG4gICAgICAgICAgICAgICAgbGl2ZUlucHV0ID0gYW5ndWxhci5lbGVtZW50KCcuZ2x5cGhpY29uLXJlY29yZCcpO1xuXG4gICAgICAgICAgICBzdGFydC5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIHN0b3AucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgc3RhcnQucHJvcCgnZGlzYWJsZWQnLCB0cnVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBzdG9wLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgc3RhcnQucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgc3RvcC5wcm9wKCdkaXNhYmxlZCcsIHRydWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGxpdmVJbnB1dC5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIGxpdmVJbnB1dC50b2dnbGVDbGFzcyhcImJ0bi1kYW5nZXJcIik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnSW5wdXQnKVxuICAgIC5kaXJlY3RpdmUoJ2lucHV0Q29udHJvbHMnLCBpbnB1dENvbnRyb2xzKTtcbiIsImZ1bmN0aW9uIExpbmVJbnB1dCgkcm9vdFNjb3BlLCBTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgTGluZUlucHV0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5zdHJlYW0gPSBudWxsO1xuICAgICAgICB0aGlzLmlzU3RyZWFtaW5nID0gZmFsc2U7XG4gICAgfTtcblxuICAgIExpbmVJbnB1dC5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoe1xuICAgICAgICAgICAgXCJhdWRpb1wiOiB7XG4gICAgICAgICAgICAgICAgXCJvcHRpb25hbFwiOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcImdvb2dFY2hvQ2FuY2VsbGF0aW9uXCI6IFwiZmFsc2VcIn0sXG4gICAgICAgICAgICAgICAgICAgIHtcImdvb2dBdXRvR2FpbkNvbnRyb2xcIjogXCJmYWxzZVwifSxcbiAgICAgICAgICAgICAgICAgICAge1wiZ29vZ05vaXNlU3VwcHJlc3Npb25cIjogXCJ0cnVlXCJ9LFxuICAgICAgICAgICAgICAgICAgICB7XCJnb29nSGlnaHBhc3NGaWx0ZXJcIjogXCJmYWxzZVwifVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24gKHN0cmVhbSkge1xuICAgICAgICAgICAgc2VsZi5zdHJlYW0gPSBzdGFnZS5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kZW1pdCgnbGluZWluOmxvYWRlZCcpO1xuICAgICAgICAgICAgdGhpcy5pc1N0cmVhbWluZyA9IHRydWU7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0d1aXRhciBzdHJlYW0gZmFpbGVkOiAnICsgZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIExpbmVJbnB1dC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgICAgICAgdGhpcy5zdHJlYW0uY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBMaW5lSW5wdXQucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3RyZWFtLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgdGhpcy5pc1N0cmVhbWluZyA9IGZhbHNlO1xuICAgIH07XG5cbiAgICByZXR1cm4gTGluZUlucHV0O1xufVxuXG5cbmFuZ3VsYXJcbiAgICAubW9kdWxlKCdJbnB1dCcpXG4gICAgLnNlcnZpY2UoJ0xpbmVJbnB1dCcsIExpbmVJbnB1dCk7XG4iLCJmdW5jdGlvbiBTaGFyZWRBdWRpb0NvbnRleHQgKCkge1xuXG4gICAgdmFyIFNoYXJlZEF1ZGlvQ29udGV4dCA9IHt9O1xuXG4gICAgU2hhcmVkQXVkaW9Db250ZXh0LmdldENvbnRleHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRleHQgfHwgKHRoaXMuY29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQpO1xuICAgIH07XG5cbiAgICByZXR1cm4gU2hhcmVkQXVkaW9Db250ZXh0O1xufVxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1NoYXJlZEF1ZGlvQ29udGV4dCcpXG4gICAgLmZhY3RvcnkoJ1NoYXJlZEF1ZGlvQ29udGV4dCcsIFNoYXJlZEF1ZGlvQ29udGV4dCk7XG4iLCJmdW5jdGlvbiBDYWJpbmV0IChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgQ2FiaW5ldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmlucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5ib29zdCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5jb252b2x2ZXIgPSBzdGFnZS5jcmVhdGVDb252b2x2ZXIoKTtcbiAgICB9O1xuXG4gICAgQ2FiaW5ldC5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKGlyUGF0aCkge1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsIGlyUGF0aCwgdHJ1ZSk7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcblxuICAgICAgICB2YXIgbG9hZGVyID0gdGhpcztcblxuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHN0YWdlLmRlY29kZUF1ZGlvRGF0YShyZXF1ZXN0LnJlc3BvbnNlLCBmdW5jdGlvbiAoYnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyLmNvbnZvbHZlci5idWZmZXIgPSBidWZmZXI7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgIGlmIChlKSBjb25zb2xlLmxvZyhcIkNhbm5vdCBsb2FkIGNhYmluZXRcIiArIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVxdWVzdC5zZW5kKG51bGwpO1xuXG4gICAgICAgIHRoaXMuaW5wdXQuZ2Fpbi52YWx1ZSA9IDM7XG4gICAgICAgIHRoaXMuYm9vc3QuZ2Fpbi52YWx1ZSA9IDE7XG5cbiAgICAgICAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMuY29udm9sdmVyKTtcbiAgICAgICAgdGhpcy5jb252b2x2ZXIuY29ubmVjdCh0aGlzLmJvb3N0KTtcbiAgICAgICAgdGhpcy5ib29zdC5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgQ2FiaW5ldC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKHRhcmdldCl7XG4gICAgICAgIHRoaXMub3V0cHV0LmNvbm5lY3QodGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhYmluZXQ7XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZmFjdG9yeSgnQ2FiaW5ldCcsIENhYmluZXQpO1xuIiwiZnVuY3Rpb24gZGlzdG9ydGlvblBlZGFsIChCb2FyZCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ3RlbXBsYXRlcy9kaXN0b3J0aW9uLmh0bWwnLFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoJHNjb3BlLCAkZWxlbWVudCkge1xuICAgICAgICAgICAgdmFyIHZvbHVtZSA9ICRlbGVtZW50LmZpbmQoJ3dlYmF1ZGlvLWtub2IjZGlzdG9ydGlvbi12b2x1bWUnKSxcbiAgICAgICAgICAgICAgICB0b25lID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8ta25vYiNkaXN0b3J0aW9uLXRvbmUnKSxcbiAgICAgICAgICAgICAgICBmb290c3dpdGNoID0gJGVsZW1lbnQuZmluZCgnd2ViYXVkaW8tc3dpdGNoI2Rpc3RvcnRpb24tZm9vdC1zdycpLFxuICAgICAgICAgICAgICAgIGxlZCA9ICRlbGVtZW50LmZpbmQoJy5sZWQnKTtcblxuICAgICAgICAgICAgdm9sdW1lLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgQm9hcmQuZ2V0UGVkYWxzKCkuZGlzdG9ydGlvbi5zZXRWb2x1bWUoZS50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZvbHVtZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2b2x1bWUudmFsKHZvbHVtZS5hdHRyKCdtYXgnKS8yKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvL3RvbmUub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIC8vICAgIEJvYXJkLmdldFBlZGFscygpLmRpc3RvcnRpb24uc2V0VG9uZShlLnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICAvL30pO1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vdG9uZS5vbignZGJsY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vICAgIHRvbmUudmFsKHRvbmUuYXR0cignbWF4JykvMik7XG4gICAgICAgICAgICAvL30pO1xuXG4gICAgICAgICAgICBmb290c3dpdGNoLm9uKCdjbGljaycsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgbGVkLnRvZ2dsZUNsYXNzKCdhY3RpdmUnKTtcbiAgICAgICAgICAgICAgICAvL2FkZCBieXBhc3MgZm9yIGF1ZGlvIG5vZGVzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5hbmd1bGFyXG4gICAgLm1vZHVsZSgnUGVkYWwnKVxuICAgIC5kaXJlY3RpdmUoJ2Rpc3RvcnRpb25QZWRhbCcsIGRpc3RvcnRpb25QZWRhbCk7XG4iLCJmdW5jdGlvbiBEaXN0b3J0aW9uIChTaGFyZWRBdWRpb0NvbnRleHQpIHtcblxuICAgIHZhciBzdGFnZSA9IFNoYXJlZEF1ZGlvQ29udGV4dC5nZXRDb250ZXh0KCk7XG5cbiAgICB2YXIgRGlzdG9ydGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmlucHV0ID0gc3RhZ2UuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLm91dHB1dCA9IHN0YWdlLmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy53YXZlc2hhcGVyID0gc3RhZ2UuY3JlYXRlV2F2ZVNoYXBlcigpO1xuICAgICAgICB0aGlzLmxvd3Bhc3MgPSBzdGFnZS5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgICAgdGhpcy5oaWdocGFzcyA9IHN0YWdlLmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAgICB0aGlzLmJvb3N0ID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMuY3V0ID0gc3RhZ2UuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICAgIHRoaXMudm9sdW1lID0gNy41O1xuICAgICAgICB0aGlzLnRvbmUgPSAyMDtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKHR5cGUpIHtcblxuICAgICAgICB0aGlzLmlucHV0LmdhaW4udmFsdWUgPSB0aGlzLnZvbHVtZTtcblxuICAgICAgICB0aGlzLmxvd3Bhc3MudHlwZSA9IFwibG93cGFzc1wiO1xuICAgICAgICB0aGlzLmxvd3Bhc3MuZnJlcXVlbmN5LnZhbHVlID0gNTAwMDtcblxuICAgICAgICB0aGlzLmJvb3N0LnR5cGUgPSBcImxvd3NoZWxmXCI7XG4gICAgICAgIHRoaXMuYm9vc3QuZnJlcXVlbmN5LnZhbHVlID0gMTAwO1xuICAgICAgICB0aGlzLmJvb3N0LmdhaW4udmFsdWUgPSA2O1xuXG4gICAgICAgIHRoaXMuY3V0LnR5cGUgPSBcImxvd3NoZWxmXCI7XG4gICAgICAgIHRoaXMuY3V0LmZyZXF1ZW5jeS52YWx1ZSA9IDEwMDtcbiAgICAgICAgdGhpcy5jdXQuZ2Fpbi52YWx1ZSA9IC02O1xuXG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5jdXJ2ZSA9IHRoaXMubWFrZURpc3RvcnRpb25DdXJ2ZSgxMCwgdHlwZSk7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5vdmVyc2FtcGxlID0gJzR4JztcblxuICAgICAgICB0aGlzLmhpZ2hwYXNzLnR5cGUgPSBcImhpZ2hwYXNzXCI7XG4gICAgICAgIHRoaXMuaGlnaHBhc3MuZnJlcXVlbmN5LnZhbHVlID0gdGhpcy50b25lO1xuXG4gICAgICAgIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLmxvd3Bhc3MpO1xuICAgICAgICB0aGlzLmxvd3Bhc3MuY29ubmVjdCh0aGlzLmJvb3N0KTtcbiAgICAgICAgdGhpcy5ib29zdC5jb25uZWN0KHRoaXMud2F2ZXNoYXBlcik7XG4gICAgICAgIHRoaXMud2F2ZXNoYXBlci5jb25uZWN0KHRoaXMuY3V0KTtcbiAgICAgICAgdGhpcy5jdXQuY29ubmVjdCh0aGlzLmhpZ2hwYXNzKTtcbiAgICAgICAgdGhpcy5oaWdocGFzcy5jb25uZWN0KHRoaXMub3V0cHV0KTtcbiAgICB9O1xuXG4gICAgRGlzdG9ydGlvbi5wcm90b3R5cGUubWFrZURpc3RvcnRpb25DdXJ2ZSA9IGZ1bmN0aW9uIChhbW91bnQsIHR5cGUpIHtcbiAgICAgICAgdmFyIGsgPSB0eXBlb2YgYW1vdW50ID09PSAnbnVtYmVyJyA/IGFtb3VudCA6IDEwLFxuICAgICAgICAgICAgc2FtcGxlcyA9IDExMDI1LFxuICAgICAgICAgICAgY3VydmUgPSBuZXcgRmxvYXQzMkFycmF5KHNhbXBsZXMpO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2FtcGxlczsgKytpKSB7XG4gICAgICAgICAgICBjdXJ2ZVtpXSA9IHRoaXMuY3VydmVBbGdvcml0aG0oaSAqIDIgLyBzYW1wbGVzIC0gMSwgdHlwZSwgayk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3VydmU7XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLmN1cnZlQWxnb3JpdGhtID0gZnVuY3Rpb24gKHgsIHR5cGUsIGspIHtcbiAgICAgICAgc3dpdGNoKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ292ZXJkcml2ZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuICgxICsgaykgKiB4IC8gKDEgKyBrICogTWF0aC5hYnMoeCkpO1xuICAgICAgICAgICAgY2FzZSAnZGlzdDEnOlxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgtMC41LCBNYXRoLm1pbigwLjUsIHggKiBrKSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0Mic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCB4ICogaykpO1xuICAgICAgICAgICAgY2FzZSAnZGlzdDMnOlxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLm1heCgtMC41LCBNYXRoLm1pbigxLjUsIHggKSk7XG4gICAgICAgICAgICBjYXNlICdkaXN0NCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIDIuOCAqIE1hdGgucG93KHgsIDMpICsgTWF0aC5wb3coeCwyKSArIC0xLjEgKiB4IC0gMC41O1xuICAgICAgICAgICAgY2FzZSAnZGlzdDUnOlxuICAgICAgICAgICAgICAgIHJldHVybiAoTWF0aC5leHAoeCkgLSBNYXRoLmV4cCgteCAqIDEuMikpIC8gKE1hdGguZXhwKHgpICsgTWF0aC5leHAoLXgpKTtcbiAgICAgICAgICAgIGNhc2UgJ2Rpc3Q2JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50YW5oKHgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLnRhbmggPSBmdW5jdGlvbiAoeCkge1xuICAgICAgICBpZiAoeCA9PT0gSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2UgaWYgKHggPT09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIChNYXRoLmV4cCh4KSAtIE1hdGguZXhwKC14KSkgLyAoTWF0aC5leHAoeCkgKyBNYXRoLmV4cCgteCkpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIERpc3RvcnRpb24ucHJvdG90eXBlLnNpZ24gPSBmdW5jdGlvbiAoeCkge1xuICAgICAgICB4ID0gK3g7IC8vIGNvbnZlcnQgdG8gYSBudW1iZXJcbiAgICAgICAgaWYgKHggPT09IDAgfHwgaXNOYU4oeCkpXG4gICAgICAgICAgICByZXR1cm4geDtcbiAgICAgICAgcmV0dXJuIHggPiAwID8gMSA6IC0xO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odGFyZ2V0KXtcbiAgICAgICAgdGhpcy5vdXRwdXQuY29ubmVjdCh0YXJnZXQpO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICAgICAgdGhpcy5pbnB1dC5nYWluLnZhbHVlID0gMS41ICogdm9sdW1lO1xuICAgIH07XG5cbiAgICBEaXN0b3J0aW9uLnByb3RvdHlwZS5zZXRUb25lID0gZnVuY3Rpb24odG9uZSkge1xuICAgICAgICB0aGlzLmhpZ2hwYXNzLmZyZXF1ZW5jeS52YWx1ZSA9IDIwICogdG9uZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERpc3RvcnRpb247XG59XG5cblxuYW5ndWxhclxuICAgIC5tb2R1bGUoJ1BlZGFsJylcbiAgICAuZmFjdG9yeSgnRGlzdG9ydGlvbicsIERpc3RvcnRpb24pO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9