function Board (SampleSource, SharedAudioContext) {
    var stage = SharedAudioContext.getContext();

    var pedalBoard = {
        sample: new SampleSource()
    };

    this.loadSource = function() {
        pedalBoard.sample.loadBuffer('assets/samples/FF.wav');
        console.log(pedalBoard.sample);
    }

    this.loadPedals = function () {
    };

    this.wireUpBoard = function() {
        pedalBoard.sample.connect(stage.destination);
    };

    this.playSample = function() {
        pedalBoard.sample.play();
    }

    this.stopSample = function() {
        pedalBoard.sample.stop();
    }
}
angular
    .module('Board')
    .service('Board', Board);
