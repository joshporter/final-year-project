'use strict';

var stage = require('./stage');

var input,
    output,
    waveshaper,
    boost,
    cut,
    lowpass,
    highpass,
    amount = 10,
    type = 'dist3';

exports.load = function () {
    input = stage.createGain();
    output = stage.createGain();
    waveshaper = stage.createWaveShaper();
    lowpass = stage.createBiquadFilter();
    highpass = stage.createBiquadFilter();
    boost = stage.createBiquadFilter();
    cut = stage.createBiquadFilter();

    input.gain.value = 100;

    lowpass.type = "lowpass";
    lowpass.frequency.value = 5000;

    boost.type = "lowshelf";
    boost.frequency.value = 100;
    boost.gain.value = 6;

    cut.type = "lowshelf";
    cut.frequency.value = 100;
    cut.gain.value = -6;

    waveshaper.curve = this.makeDistortionCurve(amount, type);
    waveshaper.oversample = '4x';

    highpass.type = "highpass";
    highpass.frequency.value = 20;

    input.connect(lowpass);
    lowpass.connect(boost);
    boost.connect(waveshaper);
    waveshaper.connect(cut);
    cut.connect(highpass);
    highpass.connect(output);
};

exports.input = function () {
    return input;
};

exports.output = function () {
    return output;
};

exports.connect = function (target) {
    output.connect(target);
};

exports.makeDistortionCurve = function (amount, type) {
    var k = typeof amount === 'number' ? amount : 10,
        samples = 44100,
        curve = new Float32Array(samples);

    for (var i = 0; i < samples; ++i) {
        curve[i] = this.curveAlgorithm(i * 2 / samples - 1, type, k);
    }

    this.plotWavetable(curve);

    return curve;
};

exports.curveAlgorithm = function (x, type, k) {
    switch(type) {
        case 'overdrive':
            return (1 + k) * x / (1 + k * Math.abs(x));
        case 'dist1':
            return Math.max(-0.5, Math.min(0.5, x * k));
        case 'dist2':
            return Math.max(-1, Math.min(1, x * k));
        case 'dist3':
            return Math.max(-0.5, Math.min(1.5, x * k));
        case 'dist4':
            return this.tanh(4 * Math.sin(x)) / 2;
        case 'dist5':
            return (Math.exp(x) - Math.exp(-x * 1.2)) / (Math.exp(x) + Math.exp(-x));
        case 'dist6':
            return this.tanh(x);
        case 'distortion':
            var q = x * k,
                mix = 1;
            return mix * (this.sign(q) * (1 - Math.exp(-Math.abs(q)))) + (1 - mix) * x;
        case 'cheby':
            return 1 * this.cheby(x, 1) + 0.125 * this.cheby(x, 2) + 1 * this.cheby(x, 3) + 0.26 * this.cheby(x, 4);
    }
};


exports.plotWavetable = function (waveTable) {
    var HEIGHT = 265,
        WIDTH = 400;

    var wv = document.getElementById('waveTable'),
        context = wv.getContext('2d');

    wv.width = WIDTH;
    wv.height = HEIGHT;
    context.fillStyle = 'white';

    var size = 44100,
        barWidth = WIDTH / size;

    for (var i = 0; i < 44100; i++) {
        var value = waveTable[i],
            percent = (value + 1 ) / 2,
            height = HEIGHT * percent,
            offset = HEIGHT - height - 1;

        context.fillRect(i * barWidth, offset, barWidth, 1);
    }

};

exports.cheby = function (x, order) {
    switch (order) {
        case 1:
            return 1;
        case 2:
            return x;
        case 3:
            return 2 * x * x - 1;
        case 4:
            return 4 * Math.pow(x, 3) - 3 * x;
        case 5:
            return 6 * Math.pow(x, 5) - 20 * Math.pow(x, 3) + 5 * x;
        case 6:
            return 32 * Math.pow(x, 6) - 48 * Math.pow(x, 4) + 18 * Math.pow(x, 2) - 1;
        case 7:
            return 64 * Math.pow(x, 7) - 112 * Math.pow(x, 5) + 56 * Math.pow(x, 3) - 7 * x;
    }
};

exports.tanh = function (x) {
    if (x === Infinity) {
        return 1;
    } else if (x === -Infinity) {
        return -1;
    } else {
        return (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x));
    }
};

exports.sign = function (x) {
    x = +x; // convert to a number
    if (x === 0 || isNaN(x))
        return x;
    return x > 0 ? 1 : -1;
};
