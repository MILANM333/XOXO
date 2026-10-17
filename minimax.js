/**
 * Unbeatable Tic-Tac-Toe Minimax Engine with Rich Introspection
 * Completely rule-based Minimax algorithm with depth penalty and decision tree generation.
 */

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

class MinimaxEngine {
  constructor() {
    this.nodesEvaluated = 0;
  }

  /**
   * Check for winner on board
   * @param {Array<string>} board - 9-element array ('X', 'O', or null/'')
   * @returns {Object|null} - { winner: 'X'|'O'|'TIE', combo: Array<number>|null } or null if ongoing
   */
  checkWinner(board) {
    for (const combo of WINNING_COMBOS) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], combo };
      }
    }

    if (board.every(cell => cell !== null && cell !== '')) {
      return { winner: 'TIE', combo: null };
    }

    return null;
  }

  /**
   * Get available move indices (0-8)
   */
  getAvailableMoves(board) {
    const moves = [];
    for (let i = 0; i < 9; i++) {
      if (!board[i]) moves.push(i);
    }
    return moves;
  }

  /**
   * Recursive minimax implementation
   * @param {Array<string>} board
   * @param {number} depth
   * @param {boolean} isMaximizing
   * @param {string} aiPlayer ('X' or 'O')
   * @param {string} humanPlayer ('X' or 'O')
   * @param {number} alpha
   * @param {number} beta
   * @returns {number} evaluated score
   */
  minimax(board, depth, isMaximizing, aiPlayer, humanPlayer, alpha = -Infinity, beta = Infinity) {
    this.nodesEvaluated++;

    const result = this.checkWinner(board);
    if (result) {
      if (result.winner === aiPlayer) return 10 - depth;
      if (result.winner === humanPlayer) return depth - 10;
      if (result.winner === 'TIE') return 0;
    }

    const availableMoves = this.getAvailableMoves(board);

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of availableMoves) {
        board[move] = aiPlayer;
        const score = this.minimax(board, depth + 1, false, aiPlayer, humanPlayer, alpha, beta);
        board[move] = null;
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break; // Alpha-beta pruning
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const move of availableMoves) {
        board[move] = humanPlayer;
        const score = this.minimax(board, depth + 1, true, aiPlayer, humanPlayer, alpha, beta);
        board[move] = null;
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break; // Alpha-beta pruning
      }
      return minScore;
    }
  }

  /**
   * Compute full evaluation and principal variation for a move
   */
  simulateBestPlay(board, firstMove, aiPlayer, humanPlayer) {
    const tempBoard = [...board];
    tempBoard[firstMove] = aiPlayer;
    const variation = [{ move: firstMove, player: aiPlayer }];

    let currentTurn = humanPlayer;
    let depth = 1;

    while (depth < 9) {
      const winner = this.checkWinner(tempBoard);
      if (winner) break;

      const moves = this.getAvailableMoves(tempBoard);
      if (moves.length === 0) break;

      let bestScore = currentTurn === aiPlayer ? -Infinity : Infinity;
      let chosenMove = moves[0];

      for (const m of moves) {
        tempBoard[m] = currentTurn;
        // Evaluate subsequent move
        const score = this.minimax(
          tempBoard,
          depth,
          currentTurn !== aiPlayer,
          aiPlayer,
          humanPlayer
        );
        tempBoard[m] = null;

        if (currentTurn === aiPlayer) {
          if (score > bestScore) {
            bestScore = score;
            chosenMove = m;
          }
        } else {
          if (score < bestScore) {
            bestScore = score;
            chosenMove = m;
          }
        }
      }

      tempBoard[chosenMove] = currentTurn;
      variation.push({ move: chosenMove, player: currentTurn });
      currentTurn = currentTurn === aiPlayer ? humanPlayer : aiPlayer;
      depth++;
    }

    return variation;
  }

  /**
   * Analyze all candidate moves from current board
   * Returns complete introspective decision metrics
   */
  analyzeBoard(board, aiPlayer, humanPlayer) {
    const startTime = performance.now();
    this.nodesEvaluated = 0;

    const availableMoves = this.getAvailableMoves(board);
    if (availableMoves.length === 0) {
      return null;
    }

    const moveEvaluations = [];

    for (const move of availableMoves) {
      // Test this move
      board[move] = aiPlayer;
      const moveNodesStart = this.nodesEvaluated;
      const score = this.minimax(board, 0, false, aiPlayer, humanPlayer);
      const nodesForMove = this.nodesEvaluated - moveNodesStart;
      board[move] = null;

      // Determine predicted variation / counter-moves
      const variation = this.simulateBestPlay(board, move, aiPlayer, humanPlayer);

      // Natural language explanation based on score and terminal outcome
      let outcomeLabel = 'Draw';
      let outcomeType = 'draw';
      let explanation = '';

      if (score > 0) {
        outcomeLabel = `AI Wins (in ${10 - score} moves)`;
        outcomeType = 'win';
        if (score === 10) {
          explanation = 'Immediate winning move! Completes a 3-in-a-row.';
        } else {
          explanation = `Forces unavoidable win in ${10 - score} ply with optimal play.`;
        }
      } else if (score < 0) {
        outcomeLabel = `Human Advantage (AI loses in ${10 + score} moves)`;
        outcomeType = 'loss';
        explanation = 'Sub-optimal move; allows player to force a win.';
      } else {
        outcomeLabel = 'Draw Guaranteed';
        outcomeType = 'draw';
        if (move === 4) {
          explanation = 'Center control maintains equilibrium and blocks fork paths.';
        } else if ([0, 2, 6, 8].includes(move)) {
          explanation = 'Corner claim establishes balanced perimeter control.';
        } else {
          explanation = 'Edge placement maintains parity and prevents player double-threat.';
        }
      }

      moveEvaluations.push({
        move,
        score,
        normalizedScore: score > 0 ? `+${score}` : `${score}`,
        outcomeLabel,
        outcomeType,
        explanation,
        nodesEvaluated: nodesForMove,
        variation
      });
    }

    // Sort by score descending (highest score = best move for AI)
    moveEvaluations.sort((a, b) => b.score - a.score);

    const highestScore = moveEvaluations[0].score;
    const optimalMoves = moveEvaluations.filter(m => m.score === highestScore);

    // Positional weight: Center (2) > Corners (1) > Edges (0)
    const getPositionalWeight = (m) => {
      if (m === 4) return 2;
      if ([0, 2, 6, 8].includes(m)) return 1;
      return 0;
    };

    // Filter optimal moves that also maximize positional control
    const maxWeight = Math.max(...optimalMoves.map(m => getPositionalWeight(m.move)));
    const topTacticalMoves = optimalMoves.filter(m => getPositionalWeight(m.move) === maxWeight);

    // Pick among best tactical moves with variety
    const selected = topTacticalMoves[Math.floor(Math.random() * topTacticalMoves.length)];

    const elapsedMs = (performance.now() - startTime).toFixed(2);

    return {
      bestMove: selected.move,
      bestScore: selected.score,
      optimalCount: optimalMoves.length,
      allEvaluations: moveEvaluations,
      nodesEvaluated: this.nodesEvaluated,
      elapsedMs,
      selected
    };
  }

  /**
   * Generate shallow decision tree for visualization (up to depth 2 or 3)
   */
  generateDecisionTree(board, aiPlayer, humanPlayer, maxDepth = 2) {
    const buildNode = (currBoard, depth, isMaximizing, moveMade = null) => {
      const winner = this.checkWinner(currBoard);
      const isTerminal = winner !== null || depth >= maxDepth;

      let score = 0;
      if (winner) {
        if (winner.winner === aiPlayer) score = 10 - depth;
        else if (winner.winner === humanPlayer) score = depth - 10;
        else score = 0;
      } else {
        score = this.minimax(currBoard, depth, isMaximizing, aiPlayer, humanPlayer);
      }

      const node = {
        move: moveMade,
        player: isMaximizing ? humanPlayer : aiPlayer,
        depth,
        score,
        winner: winner ? winner.winner : null,
        children: []
      };

      if (!isTerminal && depth < maxDepth) {
        const moves = this.getAvailableMoves(currBoard);
        // Take top 4 moves if too many to keep visual clean
        for (const m of moves) {
          currBoard[m] = isMaximizing ? aiPlayer : humanPlayer;
          node.children.push(buildNode(currBoard, depth + 1, !isMaximizing, m));
          currBoard[m] = null;
        }
      }

      return node;
    };

    return buildNode(board, 0, true, null);
  }
}

// Export for browser and node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MinimaxEngine, WINNING_COMBOS };
}
