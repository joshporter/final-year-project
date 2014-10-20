(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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


},{"./sample-player":2}],2:[function(require,module,exports){
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



},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbWFpbiIsInNyYy9zYW1wbGUtcGxheWVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdGFnZSA9IG5ldyBBdWRpb0NvbnRleHQoKTtcbnZhciBwbGF5ZXIgPSByZXF1aXJlKCcuL3NhbXBsZS1wbGF5ZXInKTtcblxudmFyIHBsYXkgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucGxheScpO1xudmFyIHN0b3AgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc3RvcCcpO1xuXG5wbGF5Lm9uY2xpY2sgPSBmdW5jdGlvbigpIHtcbiAgICBwbGF5ZXIubG9hZChzdGFnZSwgJy4vYXBwL3NhbXBsZXMvb3Blbi53YXYnKTtcbiAgICBwbGF5LnNldEF0dHJpYnV0ZSgnZGlzYWJsZWQnLCAnZGlzYWJsZWQnKTtcbn1cblxuc3RvcC5vbmNsaWNrID0gZnVuY3Rpb24oKSB7XG4gICAgcGxheWVyLnN0b3AoKTtcbiAgICBwbGF5LnJlbW92ZUF0dHJpYnV0ZSgnZGlzYWJsZWQnKTtcbn1cblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xudmFyIHNvdXJjZTtcblxuZXhwb3J0cy5sb2FkID0gZnVuY3Rpb24gKGNvbnRleHQsIHNhbXBsZVVybCkge1xuICAgIHNvdXJjZSA9IGNvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgcmVxdWVzdC5vcGVuKCdHRVQnLCBzYW1wbGVVcmwsIHRydWUpO1xuICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcbiAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBjb250ZXh0LmRlY29kZUF1ZGlvRGF0YShyZXF1ZXN0LnJlc3BvbnNlLCBmdW5jdGlvbihidWZmZXIpIHtcbiAgICAgICAgICAgIHNvdXJjZS5idWZmZXIgPSBidWZmZXI7XG4gICAgICAgICAgICBzb3VyY2UuY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgICAgICAgIHNvdXJjZS5sb29wID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJlcXVlc3Quc2VuZCgpO1xuICAgIHNvdXJjZS5zdGFydCgwKTtcbn07XG5cbmV4cG9ydHMuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgIHNvdXJjZS5zdG9wKDApO1xufTtcblxuXG4iXX0=
