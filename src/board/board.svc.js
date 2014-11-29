function Board (FileInput, StreamInput, Cabinet, SharedAudioContext) {
    var stage = SharedAudioContext.getContext(),
        pedalBoardInput = stage.createGain();

    var sample = new FileInput(),
        stream = new StreamInput();
        cabinet = new Cabinet();

    this.loadSource = function() {
        sample.loadBuffer('assets/samples/chords.wav');
    }

    this.loadPedals = function () {
        cabinet.load('assets/ir/s-preshigh-16.wav');
    };

    this.wireUpBoard = function() {
        pedalBoardInput.connect(cabinet.input);
        cabinet.connect(stage.destination);
    };

    this.playSample = function() {
        sample.connect(pedalBoardInput)
        sample.play();
    }

    this.stopSample = function() {
        sample.stop();
    }

    this.toggleLiveInput = function() {
        if(!stream.isStreaming) {
            stream.loadStream();
            stream.connect(pedalBoardInput);
        } else {
            stream.stop();
        }
    }
}
angular
    .module('Board')
    .service('Board', Board);
