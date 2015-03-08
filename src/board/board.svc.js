function Board($rootScope, FileInput, LineInput, Cabinet, Distortion, SharedAudioContext) {
    var stage = SharedAudioContext.getContext(),
        boardInput = stage.createGain();

    var pedals = {
        sample: new FileInput(),
        line: new LineInput(),
        cabinet: new Cabinet(),
        distortion: new Distortion()
    };

    var samples = [
        'assets/samples/open.wav',
        'assets/samples/chords.wav',
        'assets/samples/everlong.wav',
        'assets/samples/octaves.wav',
        'assets/samples/FF.wav',
    ];

    this.loadSource = function () {
        pedals.sample.loadBuffer(samples[1]);
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

    this.getPedal = function (effect) {
      return pedals[effect];
    };
}
angular
    .module('Board')
    .service('Board', Board);
