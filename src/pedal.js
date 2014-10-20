'use strict';

console.log('test!');

function logChange(e){
    console.log("Knob values: " + e.target.value);
}

var knobs = document.getElementsByTagName('webaudio-knob');
for(var i = 0; i < knobs.length; ++i) {
    knobs[i].addEventListener('change', logChange);
}
