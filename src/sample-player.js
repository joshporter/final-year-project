'use strict';

var request = new XMLHttpRequest();
var source;

exports.load = function (context, sampleUrl) {
    source = context.createBufferSource();
    request.open('GET', sampleUrl, true);
    request.responseType = 'arraybuffer';
    request.onload = function() {
        context.decodeAudioData(request.response, function(buffer) {
            source.buffer = buffer;
            source.connect(context.destination);
            source.loop = true;
        });
    };

    request.send();
    source.start(0);
};

exports.stop = function() {
    source.stop(0);
};


