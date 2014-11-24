'use strict';

var stage = require('./stage');

var input,
    output,
    low,
    mid,
    high;


exports.load = function () {
    input = stage.createGain();
    output = stage.createGain();

    low = stage.createBiquadFilter();
    mid = stage.createBiquadFilter();
    high = stage.createBiquadFilter();

    low.type = "lowshelf";
    low.frequency.value = 150;

    mid.type = "peaking";
    mid.frequency.value = 1000;

    high.type = "highshelf";
    high.frequency.value = 10000;

    input.connect(low);
    low.connect(mid);
    mid.connect(high);
    high.connect(output);
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
