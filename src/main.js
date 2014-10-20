'use strict';

var stage = new AudioContext();
var player = require('./sample-player');

var play = document.querySelector('.play');
var stop = document.querySelector('.stop');

play.onclick = function() {
    player.load(stage, './app/samples/open.wav');
    play.setAttribute('disabled', 'disabled');
}

stop.onclick = function() {
    player.stop();
    play.removeAttribute('disabled');
}

