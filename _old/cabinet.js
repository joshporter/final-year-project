'use strict';
var stage = require('./stage');

var cabinet;
var input;
var output;

exports.load = function (irPath) {
    input = stage.createGain();
    output = stage.createGain();
    cabinet = stage.createConvolver();

    var request = new XMLHttpRequest();
    request.open('GET', irPath, true);
    request.responseType = 'arraybuffer';
    request.onload = function () {
        stage.decodeAudioData(request.response, function (buffer) {
            cabinet.buffer = buffer;
        }, function (e) {
            if (e) console.log("Cannot load cabinet" + e);
        });
    };

    request.send(null);

    input.connect(cabinet);
    cabinet.connect(output);
};

exports.input = function () {
    return input;
};

exports.connect = function (target) {
    output.connect(target);
};
