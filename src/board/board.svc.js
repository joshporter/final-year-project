function Board($rootScope, FileInput, LineInput, Cabinet, Distortion, Overdrive, Flanger, Chorus, Delay, SharedAudioContext) {
    var stage = SharedAudioContext.getContext(),
        boardInput = stage.createGain();

    var pedals = {
        sample: new FileInput(),
        line: new LineInput(),
        cabinet: new Cabinet(),
        distortion: new Distortion(),
        overdrive: new Overdrive(),
        flanger: new Flanger(),
        chorus: new Chorus(),
        delay: new Delay()
    };

    this.loadSource = function () {
        pedals.sample.connect(boardInput);
    };

    this.loadPedals = function () {
        pedals.cabinet.load('assets/ir/5150.wav');
        pedals.distortion.load('dist6');
        pedals.overdrive.load('overdrive');
        pedals.flanger.load();
        pedals.chorus.load();
        pedals.delay.load();
    };

    this.wireUpBoard = function () {
        boardInput.connect(pedals.distortion.input);
        pedals.distortion.connect(pedals.overdrive.input);
        pedals.overdrive.connect(pedals.flanger.input);
        pedals.flanger.connect(pedals.chorus.input);
        pedals.chorus.connect(pedals.delay.input);
        pedals.delay.connect(pedals.cabinet.input);
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
