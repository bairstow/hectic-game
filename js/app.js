// import via jquery
var helpersLoaded = false;
var displayLoaded = false;
var handlersLoaded = false;
$.getScript("js/helpers.js", function(data) {
  helpersLoaded = true;
  console.log('helpers.js loaded...');
});
$.getScript("js/display.js", function(data) {
  displayLoaded = true;
  console.log('display.js loaded...');
});
$.getScript("js/handlers.js", function(data) {
  handlersLoaded = true;
  console.log('handlers.js loaded...');
});

// data object containing game variables and logic definitions
var game = {
  // game related data
  data: {
    // flag current game status (filling, waiting, moving)
    gameStatus: 'waiting',
    runStatus: 0,
    boardSize: 8,
    selectedPiece: null,
    targetedPiece: null,
    gamePieces: null,
    startTime: null,
    time: 0,
    multiplier: 0,
    score: 0
  },
  // function for generating initial board positions
  generateBoard: function() {
    var newPieces = [];
    _.each(_.range(game.data.boardSize), function(x) {
      var newCol = [];
      _.each(_.range(game.data.boardSize), function(y) {
        var newPiece = {
          category: Math.floor(Math.random() * 6),
        };
        newCol.push(newPiece);
      });
      newPieces.push(newCol);
    });
    game.allPieces(newPieces, game.unmatchPieces);
    return newPieces;
  },
  // function taking all pieces and perform action on each
  allPieces: function(pieces, pieceOperation) {
    _.each(pieces, function(col, x) {
      _.each(col, function(piece, y) {
        pieceOperation(pieces, x, y);
      });
    });
  },
  // piece operation checking match for given position
  checkMatch: function(pieces, pX, pY, selectPos) {
    // removal of pieces requires all parts of match to be flagged so search will be done in all cardinal directions
    // three pieces in a row of the same category constitutes a match.
    var target = pieces[pX][pY];
    var matched = false;
    if (selectPos) {
      target = pieces[selectPos[0]][selectPos[1]];
      console.log('Checking selection at: ', selectPos);
    }
    // search -y direction (up)
    if (pY >= 2 &&
        pieces[pX][pY-1].category === target.category &&
        pieces[pX][pY-2].category === target.category) {
      matched = true;
    }
    // search +x direction (right)
    if (pX < (game.data.boardSize - 2) &&
        pieces[pX+1][pY].category === target.category &&
        pieces[pX+2][pY].category === target.category) {
      matched = true;
    }
    // search +y direction (down)
    if (pY < (game.data.boardSize - 2) &&
        pieces[pX][pY+1].category === target.category &&
        pieces[pX][pY+2].category === target.category) {
      matched = true;
    }
    // search -x direction (left)
    if (pX >= (2) &&
        pieces[pX-1][pY].category === target.category &&
        pieces[pX-2][pY].category === target.category) {
      matched = true;
    }
    // search top-bottom (i.e. target is in the middle)
    if (pY >= 1 && pY < (game.data.boardSize - 1) &&
        pieces[pX][pY-1].category === target.category &&
        pieces[pX][pY+1].category === target.category) {
      matched = true;
    }
    // search left-right
    if (pX >= 1 && pX < (game.data.boardSize - 1) &&
        pieces[pX-1][pY].category === target.category &&
        pieces[pX+1][pY].category === target.category) {
      matched = true;
    }
    // return result based on findings
    if (matched) {
      return true;
    } else {
      return false;
    }
  },
  // piece operation to randomise initial types so no matches to begin
  unmatchPieces: function(pieces, pX, pY) {
    while (game.checkMatch(pieces, pX, pY)) {
      pieces[pX][pY].category = Math.floor(Math.random() * 6);
      pieces[pX][pY].matched = false;
    }
  },
  // find selected piece from gamePieces
  setSelectedPiece: function() {
    game.allPieces(display.gamePieces, function(pieces, pX, pY) {
      if (pieces[pX][pY].getAttribute('data-selected') === 'true') {
        game.data.selectedPiece = [pX, pY];
      }
    });
  },
  // find selected piece from gamePieces
  setTargetedPiece: function() {
    game.allPieces(display.gamePieces, function(pieces, pX, pY) {
      if (pieces[pX][pY].getAttribute('data-targeted') === 'true') {
        game.data.targetedPiece = [pX, pY];
      }
    });
  },
  // run selection logic to see if piece move is valid and if so exchange piece positions
  attemptMovePiece: function() {
    // check move validity. i.e. selection and target must share either row or column
    if (game.data.selectedPiece[0] === game.data.targetedPiece[0] ||
        game.data.selectedPiece[1] === game.data.targetedPiece[1]) {
      // move piece first to check the match then if it fails move it back.
      game.movePiece(game.data.gamePieces, game.data.selectedPiece, game.data.targetedPiece);
      var matched = false;
      game.allPieces(game.data.gamePieces, function(pieces, pX, pY) {
        if (game.checkMatch(pieces, pX, pY)) {
          matched = true;
        }
      });
      if (!matched) {
        // new positions do not form a new match move the piece back to original position
        game.movePiece(game.data.gamePieces, game.data.targetedPiece, game.data.selectedPiece);
      }
    }
    game.clearSelections();
  },
  // cycle through game pieces and build positional list of pieces that are currently matched
  collectMatches: function() {
    var matchList = [];
    game.allPieces(game.data.gamePieces, function(pieces, pX, pY) {
      if (game.checkMatch(pieces, pX, pY)) {
        matchList.push([pX, pY]);
      }
    });
    return matchList;
  },
  // function takes an element that is to be removed from the game board either through
  // a match or by some other game function and the shifts all pieces above the target
  // in the column down and generates a new pieces to fill the empty position at the top
  replacePiece: function(pieces, oldPos) {
    var removedPiece = pieces[oldPos[0]].splice(oldPos[1], 1);
    var newPiece = {
      category: Math.floor(Math.random() * 6),
    };
    pieces[oldPos[0]].unshift(newPiece);
  },
  // function to move a piece to new position and update the displaced pieces in
  // the shared row or column to the new positions
  movePiece: function(pieces, oldPos, newPos) {
    // two seperate handling cases depending on whether the move is in a column or in a row
    // sanity check to catch and return if the selection and target positions are the same
    if (oldPos[0] === newPos[0] && oldPos[1] === newPos[1]) {
      return;
    } else if (oldPos[0] === newPos[0]) {
      // handle column movement first
      // pull selected piece from current position.
      var movingPiece = pieces[oldPos[0]].splice(oldPos[1], 1)[0];
      // push selected piece back to new position
      pieces[oldPos[0]].splice(newPos[1], 0, movingPiece);
    } else {
      // otherwise movement will be in the horizontal
      var movingPiece = pieces[oldPos[0]].splice(oldPos[1], 1)[0];
      var moveDirection = (oldPos[0] < newPos[0] ? 1:-1);
      var currentCol = oldPos[0];
      var targetCol = oldPos[0] + moveDirection;
      // until target column is move the piece in the adjoining column into the vacated position
      while (targetCol !== newPos[0]) {
        // move displaced piece
        var displacedPiece = pieces[targetCol].splice(oldPos[1], 1)[0];
        pieces[currentCol].splice(oldPos[1], 0, displacedPiece);
        // update positioning variables
        targetCol += moveDirection;
        currentCol += moveDirection;
      }
      // target column reached so insert the selected piece at its new position
      var displacedPiece = pieces[targetCol].splice(oldPos[1], 1)[0];
      pieces[currentCol].splice(oldPos[1], 0, displacedPiece);
      pieces[targetCol].splice(oldPos[1], 0, movingPiece);
    }
  },
  clearSelections: function() {
    game.data.selectedPiece = null;
    game.data.targetedPiece = null;
  },
  // function containing game logic to be run on cycle
  updateGameState: function() {
    // initial checks and handling of run status
    if (game.data.runStatus === 0) {
      display.setGameDisabled();
    } else if (game.data.runStatus === 1) {
      display.setGameEnabled();
      var newTS = Date.now();
      var oldTS = game.data.startTime;
      var elapsed = newTS - oldTS;
      console.log('elapsed time: ', elapsed);
      game.data.startTime = newTS;
      game.data.time -= elapsed/1000;
      if (game.data.time < 0) {
        // timer has run out and round has been completed
        game.data.time = 0;
        game.data.multiplier = 0;
        game.data.runStatus = 0;
        handlers.setGameHandlers();
      }
    }
    // filling takes priority over all other game states no piece movement during filling
    if (game.data.gameStatus === 'filling') {
      // while new pieces are being generated loop
      // todo disable player selection
    } else if (game.data.gameStatus === 'waiting' &&
               game.data.selectedPiece &&
               game.data.targetedPiece) {
      // player is moving a piece and matching should be disabled
      game.attemptMovePiece();
      var newMatchPositions = game.collectMatches();
      while (newMatchPositions.length > 0) {
        console.log('New matches found.');
        _.each(newMatchPositions, function(matchPosition) {
          game.replacePiece(game.data.gamePieces, matchPosition);
          // whenever a piece is removed increment the score
          game.data.score += (1 * (1 + game.data.multiplier));
        });
        // increment based on number of matches found (matching more than 2 in a cycle bumps)
        if (newMatchPositions.length > 2) {
          game.data.multiplier += 0.03 * (newMatchPositions.length - 2);
          if (game.data.multiplier > 1) { game.data.multiplier = 1 };
        }
        newMatchPositions = game.collectMatches();
      }
    }
    // decrement the multiplier based on time
    if (game.data.multiplier > 0) {
      game.data.multiplier -= Math.min(0.001, game.data.multiplier);
    }
  },
  startNewRound: function() {
    // set initial conditions
    game.data.startTime = Date.now();
    game.data.time = 30;
    game.data.score = 0;
    game.data.runStatus = 1;
    display.setGameEnabled();
  },
  // group functions calls to be made on page initiation
  init: function() {
      display.setHandles();
      // make sure container is set to full page size.
      display.setContainerHeight();
      display.drawNavBarBorder();
      display.setFooterWidth();
      display.showLandingPage();
      handlers.setStartingHandlers();
      game.data.gamePieces = game.generateBoard();
      display.animate();
  }
};

// wait on script loading and then execute game initiation
var scriptID = null;
var checkScripts = function() {
  if (helpersLoaded && displayLoaded && handlersLoaded) {
    console.log('All scripts loaded.');
    window.clearTimeout(scriptID);
    game.init();
  } else {
    scriptID = window.setTimeout(checkScripts, 200);
    console.log('Waiting on scripts...');
  }
};
// HAX
$(document).ready(function() {
  scriptID = window.setTimeout(checkScripts, 200);
});
