function SampleSource (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var SampleSource = function() {
        this.output = stage.createGain();
        this.source = null;
        this.sample = null;
    };

    SampleSource.prototype.loadBuffer = function(url) {
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

    SampleSource.prototype.connect = function(target){
        this.output.connect(target);
    };

    SampleSource.prototype.output = function() {
        return this.output;
    };

    SampleSource.prototype.play = function() {
        this.source = stage.createBufferSource();
        this.source.loop = true;
        this.source.buffer = this.sample;

        this.source.connect(this.output);

        this.source.start(0);
    };


    SampleSource.prototype.stop = function() {
        this.source.stop(0);
        this.source = null;
    };

    return SampleSource;
}


angular
    .module('Source')
    .factory('SampleSource', SampleSource);
