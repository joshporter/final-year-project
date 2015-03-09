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
            {name: 'Lead', url: 'assets/samples/twiddles.wav'}
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


angular
    .module('Input')
    .factory('FileInput', FileInput);
