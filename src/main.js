'use strict';

var stage = require('./stage');
var player = require('./sample-player');
var cabinet = require('./cabinet');
var distortion = require('./distortion');


var play = document.querySelector('.play');
var stop = document.querySelector('.stop');
var bypass = document.querySelector('.bypass');

var inputgain = document.querySelector('.inputgain');
var outputgain = document.querySelector('.outputgain');

player.load('../samples/FF.wav');
cabinet.load('../ir/s-preshigh-16.wav');
distortion.load();

//player.connect(cabinet.input());
//cabinet.connect(stage.destination);

player.connect(distortion.input());
distortion.connect(cabinet.input());
cabinet.connect(stage.destination);

play.onclick = function() {
    player.start();
    play.setAttribute('disabled', 'disabled');
}

stop.onclick = function() {
    player.stop();
    play.removeAttribute('disabled');
}

inputgain.onchange = function(e) {
    distortion.input().gain.value = e.target.value;
}

outputgain.onchange = function(e) {
    distortion.output().gain.output = e.target.value;
}

bypass.onclick = function() {
    player.output = null;
    cabinet.input()
    player.connect(cabinet.input());
}

