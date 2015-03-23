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


angular
    .module('Input')
    .service('LineInput', LineInput);
