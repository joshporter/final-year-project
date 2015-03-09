function Chorus (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var Chorus = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.depth = stage.createGain();
        this.osc = stage.createOscillator();
        this.delay = stage.createDelay();
        this.isBypassed = true;
    };

    Chorus.prototype.load = function() {
        this.osc.type = 'sine';
        this.osc.frequency.value = parseFloat( 3.5 );

        this.delay.delayTime.value = parseFloat( 0.03 );

        this.depth.gain.value = parseFloat( 0.002 );

        this.osc.connect(this.depth);
        this.depth.connect(this.delay.delayTime);

        this.delay.connect(this.output);

        this.osc.start(0);

        this.input.connect(this.output);
    };

    Chorus.prototype.setRate = function(speed) {
        this.osc.frequency.value = parseFloat(speed);
    };

    Chorus.prototype.setDelay = function(delay) {
        this.delay.delayTime.value = parseFloat(delay);
    };

    Chorus.prototype.setDepth = function(depth) {
        this.depth.gain.value = parseFloat(depth);
    };

    Chorus.prototype.bypass = function(){
        if(this.isBypassed) {
            this.input.disconnect();
            this.input.connect(this.delay);
            this.input.connect(this.output);

            this.isBypassed = false;
        } else {
            this.input.disconnect();
            this.input.connect(this.output);

            this.isBypassed = true;
        }
    };

    Chorus.prototype.connect = function(target){
        this.output.connect(target);
    };

    return Chorus;
}


angular
    .module('Pedal')
    .factory('Chorus', Chorus);
