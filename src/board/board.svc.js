function Board (SampleSource, Cabinet, SharedAudioContext) {
    var stage = SharedAudioContext.getContext();

    var sample = new SampleSource(),
        cabinet = new Cabinet();

    this.loadSource = function() {
        sample.loadBuffer('assets/samples/chords.wav');
    }

    this.loadPedals = function () {
        cabinet.load('assets/ir/s-preshigh-16.wav');
    };

    this.wireUpBoard = function() {
        sample.connect(cabinet.input);
        cabinet.connect(stage.destination);
    };

    this.playSample = function() {
        sample.play();
    }

    this.stopSample = function() {
        sample.stop();
    }
}
angular
    .module('Board')
    .service('Board', Board);
