function Distortion (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var Distortion = function() {
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

    Distortion.prototype.load = function(type) {

        this.gain.gain.value = this.volume;

        this.lowpass.type = "lowpass";
        this.lowpass.frequency.value = 5000;

        this.boost.type = "lowshelf";
        this.boost.frequency.value = 100;
        this.boost.gain.value = 6;

        this.cut.type = "lowshelf";
        this.cut.frequency.value = 100;
        this.cut.gain.value = -6;

        this.waveshaper.curve = this.makeDistortionCurve(10, type);
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

    Distortion.prototype.makeDistortionCurve = function (amount, type) {
        var k = typeof amount === 'number' ? amount : 10,
            samples = 11025,
            curve = new Float32Array(samples);

        for (var i = 0; i < samples; ++i) {
            curve[i] = this.curveAlgorithm(i * 2 / samples - 1, type, k);
        }

        return curve;
    };

    Distortion.prototype.curveAlgorithm = function (x, type, k) {
        switch(type) {
            case 'dist1':
                return Math.max(-0.5, Math.min(0.5, x * k));
            case 'dist2':
                return Math.max(-1, Math.min(1, x * k));
            case 'dist3':
                return Math.max(-0.5, Math.min(1.5, x ));
            case 'dist4':
                return 2.8 * Math.pow(x, 3) + Math.pow(x,2) + -1.1 * x - 0.5;
            case 'dist5':
                return (Math.exp(x) - Math.exp(-x * 1.2)) / (Math.exp(x) + Math.exp(-x));
            case 'dist6':
                return (1 + k) * x / (1 + k * Math.abs(x));
        }
    };

    Distortion.prototype.tanh = function (x) {
        if (x === Infinity) {
            return 1;
        } else if (x === -Infinity) {
            return -1;
        } else {
            return (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x));
        }
    };

    Distortion.prototype.sign = function (x) {
        x = +x; // convert to a number
        if (x === 0 || isNaN(x))
            return x;
        return x > 0 ? 1 : -1;
    };

    Distortion.prototype.connect = function(target){
        this.output.connect(target);
    };

    Distortion.prototype.bypass = function(){
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

    Distortion.prototype.setVolume = function(volume) {
        this.gain.gain.value = 1.5 * volume;
    };

    Distortion.prototype.setTone = function(tone) {
        this.highpass.frequency.value = 20 * tone;
    };

    return Distortion;
}


angular
    .module('Pedal')
    .factory('Distortion', Distortion);
