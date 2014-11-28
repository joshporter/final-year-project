function BoardCtrl (Board) {
    var vm = this

    Board.loadSource();
    Board.loadPedals();
    Board.wireUpBoard();

    vm.play = function() {
        Board.playSample();
    };

    vm.stop = function() {
        Board.stopSample();
    };

}

angular
    .module('Board')
    .controller('BoardCtrl', BoardCtrl);
