function Delay (SharedAudioContext) {

    var stage = SharedAudioContext.getContext();

    var delay = function() {
        this.input = stage.createGain();
        this.output = stage.createGain();
        this.feedback = stage.createGain();
        this.delay = stage.createDelay();
        this.isBypassed = true;
    };

    delay.prototype.load = function() {
        this.delay.delayTime.value = parseFloat( 0.5 );
        this.feedback.gain.value = parseFloat( 0.75 );

        this.delay.connect( this.feedback );
        this.feedback.connect( this.delay );

        this.input.connect(this.output);
    };

    delay.prototype.setTime = function(time) {
        this.delay.delayTime.value = parseFloat(time);
    };

    delay.prototype.setFeedback = function(feedback) {
        this.feedback.gain.value = parseFloat(feedback);
    };

    delay.prototype.bypass = function(){
        if(this.isBypassed) {
            this.input.disconnect();
            this.input.connect(this.output);
            this.input.connect(this.delay);
            this.delay.connect(this.output);

            this.isBypassed = false;
        } else {
            this.input.disconnect();
            this.delay.disconnect();
            this.input.connect(this.output);

            this.isBypassed = true;
        }
    };

    delay.prototype.connect = function(target){
        this.output.connect(target);
    };

    return delay;
}


angular
    .module('Pedal')
    .factory('Delay', Delay);
