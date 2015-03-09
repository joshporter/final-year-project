function BoardCtrl ($scope, Board) {
    var vm = this;

    Board.loadSource();
    Board.loadPedals();
    Board.wireUpBoard();

    $scope.samples = Board.getPedal('sample').getFiles();

    vm.play = function() {
        Board.playSample();
    };

    vm.stop = function() {
        Board.stopSample();
    };

    vm.liveInput = function() {
        Board.toggleLiveInput();
    }

}

angular
    .module('Board')
    .controller('BoardCtrl', BoardCtrl);
