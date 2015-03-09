function Flanger (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var Flanger = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.wetgain = stage.createGain();
        this.feedback = stage.createGain();
        this.depth = stage.createGain();
        this.osc = stage.createOscillator();
        this.delay = stage.createDelay();
        this.isBypassed = true;
    };

    Flanger.prototype.load = function() {
        this.osc.type = 'sine';
        this.osc.frequency.value = parseFloat( 0.7 );

        this.delay.delayTime.value = parseFloat( 0.003 );

        this.depth.gain.value = parseFloat( 0.0013 );

        this.feedback.gain.value = parseFloat( 0.40 );

        this.osc.connect(this.depth);
        this.depth.connect(this.delay.delayTime);

        this.delay.connect( this.wetgain );
        this.delay.connect( this.feedback );
        this.feedback.connect( this.input );

        this.osc.start(0);

        this.input.connect(this.output);
    };

    Flanger.prototype.setSpeed = function(speed) {
        this.osc.frequency.value = parseFloat(speed);
    };

    Flanger.prototype.setDelay = function(delay) {
        this.delay.delayTime.value = parseFloat(delay);
    };

    Flanger.prototype.setDepth = function(depth) {
        this.depth.gain.value = parseFloat(depth);
    };

    Flanger.prototype.setFeedback = function(feedback) {
        this.feedback.gain.value = parseFloat(feedback);
    };

    Flanger.prototype.bypass = function(){
        if(this.isBypassed) {
            this.input.disconnect();
            this.input.connect(this.wetgain);
            this.input.connect( this.delay);
            this.wetgain.connect(this.output);

            this.isBypassed = false;
        } else {
            this.input.disconnect();
            this.wetgain.disconnect();
            this.input.connect(this.output);

            this.isBypassed = true;
        }
    };

    Flanger.prototype.connect = function(target){
        this.output.connect(target);
    };

    return Flanger;
}


angular
    .module('Pedal')
    .factory('Flanger', Flanger);
