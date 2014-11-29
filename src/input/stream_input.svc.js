function StreamInput (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var StreamInput = function() {
        this.output = stage.createGain();
        this.stream = null;
        this.isStreaming = false;
    };

    StreamInput.prototype.loadStream = function() {
        var self = this;

        navigator.getUserMedia({'audio': true, 'googEchoCancellation': false}, function(stream) {
            self.stream = stage.createMediaStreamSource(stream);
            self.stream.connect(self.output);
        }, function(err) {
            console.error('Guitar stream failed: ' + err);
        });

        this.isStreaming = true;
    };

    StreamInput.prototype.connect = function(target){
        this.output.connect(target);
    };

    StreamInput.prototype.stop = function() {
        this.stream.disconnect();
        this.isStreaming = false;
    };

    return StreamInput;
}


angular
    .module('Input')
    .factory('StreamInput', StreamInput);
