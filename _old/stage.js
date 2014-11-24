'use strict';

'use strict';

var stage = require('./stage'),
    player = require('./sample-player'),
    amp = require('./amp'),
    cabinet = require('./cabinet'),
    distortion = require('./distortion');

var play = document.querySelector('.play');
var stop = document.querySelector('.stop');
var bypass = document.querySelector('.bypass');

player.load('../assets/samples/FF.wav');
cabinet.load('../assets/ir/s-preshigh-16.wav');
distortion.load();
amp.load();

player.connect(cabinet.input());
cabinet.connect(stage.destination);

player.connect(distortion.input());
distortion.connect(amp.input());
amp.connect(cabinet.input());
cabinet.connect(stage.destination);

play.onclick = function() {
    player.start();
    play.setAttribute('disabled', 'disabled');
};

stop.onclick = function() {
    player.stop();
    play.removeAttribute('disabled');
};

module.exports = window.AudioContext && (new window.AudioContext());
