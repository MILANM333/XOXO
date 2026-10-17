/**
 * 3-Jug Water Riddle Simulation (8L, 5L, 3L)
 * Supported Targets: 2L, 6L, 1L, 4L, 7L
 */

let jug8 = 0;
let jug5 = 0;
let jug3 = 0;
let targetGoal = 2;

const CAPACITIES = {
  8: 8,
  5: 5,
  3: 3
};

const water8 = document.getElementById('water-8');
const water5 = document.getElementById('water-5');
const water3 = document.getElementById('water-3');
const tapWater = document.getElementById('tap-water');
const resultMsg = document.getElementById('result-message');
const testBtn = document.getElementById('test-btn');
const targetText = document.getElementById('target-text');

function updateUI() {
  water8.style.height = `${(jug8 / 8) * 100}%`;
  water5.style.height = `${(jug5 / 5) * 100}%`;
  water3.style.height = `${(jug3 / 3) * 100}%`;
}

function triggerTapAnimation() {
  tapWater.classList.add('flowing');
  setTimeout(() => {
    tapWater.classList.remove('flowing');
  }, 350);
}

// Transfer helper
function pour(fromJug, toJug) {
  let fromVal = fromJug === 8 ? jug8 : (fromJug === 5 ? jug5 : jug3);
  let toVal = toJug === 8 ? jug8 : (toJug === 5 ? jug5 : jug3);
  let toCap = CAPACITIES[toJug];

  let transfer = Math.min(fromVal, toCap - toVal);

  if (fromJug === 8) jug8 -= transfer;
  else if (fromJug === 5) jug5 -= transfer;
  else if (fromJug === 3) jug3 -= transfer;

  if (toJug === 8) jug8 += transfer;
  else if (toJug === 5) jug5 += transfer;
  else if (toJug === 3) jug3 += transfer;

  updateUI();
  clearResult();
}

// Tap Fill Actions
document.getElementById('fill-8-btn').addEventListener('click', () => {
  triggerTapAnimation();
  jug8 = 8;
  updateUI();
  clearResult();
});

document.getElementById('fill-5-btn').addEventListener('click', () => {
  triggerTapAnimation();
  jug5 = 5;
  updateUI();
  clearResult();
});

document.getElementById('fill-3-btn').addEventListener('click', () => {
  triggerTapAnimation();
  jug3 = 3;
  updateUI();
  clearResult();
});

// Pour Buttons
document.getElementById('pour-8-to-5-btn').addEventListener('click', () => pour(8, 5));
document.getElementById('pour-8-to-3-btn').addEventListener('click', () => pour(8, 3));

document.getElementById('pour-5-to-8-btn').addEventListener('click', () => pour(5, 8));
document.getElementById('pour-5-to-3-btn').addEventListener('click', () => pour(5, 3));

document.getElementById('pour-3-to-8-btn').addEventListener('click', () => pour(3, 8));
document.getElementById('pour-3-to-5-btn').addEventListener('click', () => pour(3, 5));

// Empty Buttons
document.getElementById('empty-8-btn').addEventListener('click', () => {
  jug8 = 0;
  updateUI();
  clearResult();
});

document.getElementById('empty-5-btn').addEventListener('click', () => {
  jug5 = 0;
  updateUI();
  clearResult();
});

document.getElementById('empty-3-btn').addEventListener('click', () => {
  jug3 = 0;
  updateUI();
  clearResult();
});

// Goal selection chips (2, 6, 1, 4, 7)
function setGoal(goal) {
  targetGoal = goal;
  targetText.textContent = `${targetGoal} Liter${targetGoal === 1 ? '' : 's'}`;
  testBtn.textContent = `Test for ${targetGoal} Liter${targetGoal === 1 ? '' : 's'}`;
  clearResult();
}

document.querySelectorAll('.goal-chip[data-goal]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.goal-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    setGoal(parseInt(chip.getAttribute('data-goal'), 10));
  });
});

// Test Button
testBtn.addEventListener('click', () => {
  if (jug8 === targetGoal || jug5 === targetGoal || jug3 === targetGoal) {
    showResult(`🎉 Correct! Exactly ${targetGoal} Liter${targetGoal === 1 ? '' : 's'} measured!`, true);
  } else {
    showResult(`❌ Not ${targetGoal} Liter${targetGoal === 1 ? '' : 's'} yet. Keep trying!`, false);
  }
});

function showResult(text, isSuccess) {
  resultMsg.textContent = text;
  resultMsg.className = isSuccess ? 'result-message success' : 'result-message wrong';
}

function clearResult() {
  resultMsg.textContent = '';
  resultMsg.className = 'result-message';
}

// Reset
document.getElementById('reset-btn').addEventListener('click', () => {
  jug8 = 0;
  jug5 = 0;
  jug3 = 0;
  clearResult();
  updateUI();
});

// Initialize
setGoal(2);
updateUI();
