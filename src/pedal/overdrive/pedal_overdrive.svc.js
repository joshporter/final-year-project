function Overdrive (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var Overdrive = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.gain = stage.createGain();
        this.waveshaper = stage.createWaveShaper();
        this.lowpass = stage.createBiquadFilter();
        this.highpass = stage.createBiquadFilter();
        this.boost = stage.createBiquadFilter();
        this.cut = stage.createBiquadFilter();
        this.volume = 7.5;
        this.tone = 20;
        this.isBypassed = true;
    };

    Overdrive.prototype.load = function(type) {

        this.gain.gain.value = this.volume;

        this.lowpass.type = "lowpass";
        this.lowpass.frequency.value = 5000;

        this.boost.type = "lowshelf";
        this.boost.frequency.value = 100;
        this.boost.gain.value = 6;

        this.cut.type = "lowshelf";
        this.cut.frequency.value = 100;
        this.cut.gain.value = -6;

        this.waveshaper.curve = this.makeOverdriveCurve(10, type);
        this.waveshaper.oversample = '4x';

        this.highpass.type = "highpass";
        this.highpass.frequency.value = this.tone;

        this.gain.connect(this.lowpass)
        this.lowpass.connect(this.boost);
        this.boost.connect(this.waveshaper);
        this.waveshaper.connect(this.cut);
        this.cut.connect(this.highpass);

        //bypass by default
        this.input.connect(this.output);
    };

    Overdrive.prototype.makeOverdriveCurve = function (amount, type) {
        var k = typeof amount === 'number' ? amount : 10,
            samples = 11025,
            curve = new Float32Array(samples);

        for (var i = 0; i < samples; ++i) {
            curve[i] = this.curveAlgorithm(i * 2 / samples - 1, type, k);
        }

        return curve;
    };

    Overdrive.prototype.curveAlgorithm = function (x, type, k) {
        switch(type) {
            case 'overdrive':
                return (1 + k) * x / (1 + k * Math.abs(x));
        }
    };

    Overdrive.prototype.tanh = function (x) {
        if (x === Infinity) {
            return 1;
        } else if (x === -Infinity) {
            return -1;
        } else {
            return (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x));
        }
    };

    Overdrive.prototype.sign = function (x) {
        x = +x; // convert to a number
        if (x === 0 || isNaN(x))
            return x;
        return x > 0 ? 1 : -1;
    };

    Overdrive.prototype.connect = function(target){
        this.output.connect(target);
    };

    Overdrive.prototype.bypass = function(){
        if(this.isBypassed) {
            this.input.disconnect();
            this.input.connect(this.gain);
            this.highpass.connect(this.output);

            this.isBypassed = false;
        } else {
            this.input.disconnect();
            this.highpass.disconnect();

            this.input.connect(this.output);

            this.isBypassed = true;
        }
    };

    Overdrive.prototype.setVolume = function(volume) {
        this.gain.gain.value = 1.5 * volume;
    };

    Overdrive.prototype.setTone = function(tone) {
        this.highpass.frequency.value = 20 * tone;
    };

    return Overdrive;
}


angular
    .module('Pedal')
    .factory('Overdrive', Overdrive);
