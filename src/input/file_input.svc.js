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

    FileInput.prototype.output = function() {
        return this.output;
    };

    FileInput.prototype.play = function() {
        this.source = stage.createBufferSource();
        this.source.loop = true;
        this.source.buffer = this.sample;

        this.source.connect(this.output);

        this.source.start(0);
    };


    FileInput.prototype.stop = function() {
        this.source.disconnect();
    };

    return FileInput;
}


angular
    .module('Input')
    .factory('FileInput', FileInput);
