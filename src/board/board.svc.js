function Board ($rootScope, FileInput, LineInput, Cabinet, SharedAudioContext) {
    var stage = SharedAudioContext.getContext(),
        boardInput = stage.createGain();

    var sample = new FileInput(),
        line = new LineInput();
        cabinet = new Cabinet();

    this.loadSource = function() {
        sample.loadBuffer('assets/samples/chords.wav');
        sample.connect(boardInput);
    };

    this.loadPedals = function () {
        cabinet.load('assets/ir/5150.wav');
    };

    this.wireUpBoard = function() {
        boardInput.connect(cabinet.input);
        cabinet.connect(stage.destination);
    };

    this.playSample = function() {
        sample.play();
    };

    this.stopSample = function() {
        sample.stop();
    };

    this.toggleLiveInput = function() {
        if(!line.isStreaming) {
            if(line.isLoaded) {
                line.load();
                $rootScope.$on('linein:loaded', function () {
                    line.stream.connect(boardInput);
                });
            } else {
                line.stream.connect(boardInput);
            }

            line.isStreaming = true;
        } else {
            line.stop();
            line.isStreaming = false;
        }
    }
}
angular
    .module('Board')
    .service('Board', Board);
