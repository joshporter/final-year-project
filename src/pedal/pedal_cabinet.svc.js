function Cabinet (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var Cabinet = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.boost = stage.createGain();
        this.convolver = stage.createConvolver();
    };

    Cabinet.prototype.load = function(irPath) {
        var request = new XMLHttpRequest();
        request.open('GET', irPath, true);
        request.responseType = 'arraybuffer';

        var loader = this;

        request.onload = function () {
            stage.decodeAudioData(request.response, function (buffer) {
                loader.convolver.buffer = buffer;
            }, function (e) {
                if (e) console.log("Cannot load cabinet" + e);
            });
        };

        request.send(null);

        this.input.gain.value = 3;
        this.boost.gain.value = 1;

        this.input.connect(this.convolver);
        this.convolver.connect(this.boost);
        this.boost.connect(this.output);
    };

    Cabinet.prototype.connect = function(target){
        this.output.connect(target);
    };

    return Cabinet;
}


angular
    .module('Pedal')
    .factory('Cabinet', Cabinet);
