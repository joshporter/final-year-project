'use strict';

var stage = require('./stage');

var request = new XMLHttpRequest();
var source;
var output;
var sample;

exports.load = function (sampleUrl) {
    output = stage.createGain();

    request.open('GET', sampleUrl, true);
    request.responseType = 'arraybuffer';

    request.onload = function() {
        stage.decodeAudioData(request.response, function(buffer) {
            exports.setBuffer(buffer);
        });
    };

    request.send(null);
};

exports.connect = function(target){
    output.connect(target.value);
};

exports.output = function() {
    return output;
};

exports.start = function() {
    source = stage.createBufferSource();
    source.loop = true;
    source.buffer = sample;

    source.connect(output);

    source.start(0);
};

exports.setBuffer = function(buffer){
    sample = buffer;
};

exports.stop = function() {
    source.stop(0);
    source = null;
};
