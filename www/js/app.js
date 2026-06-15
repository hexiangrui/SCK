// Main app controller
window._currentTopicId = null;
window._currentSelection = [];
window._showFeedback = false;
window._lastCorrect = false;
window._submitted = false;
window._aiScoring = false; // true when waiting for AI fill-blank score
let TOPIC_INDEX = [];

// ── Init ──
async function init() {
  try {
    const resp = await fetch('data/index.json');
    TOPIC_INDEX = await resp.json();
  } catch(e) {
    TOPIC_INDEX = [];
  }
  // Check API Key on first launch
  if (!AI.hasKey()) {
    UI.show('setup');
  } else {
    UI.show('home');
    UI.renderTopics();
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ── Topic selection ──
window.selectTopic = async function(topicId) {
  window._currentTopicId = topicId;
  const questions = await DataCache.load(topicId);
  // Update question count in index
  const topic = TOPIC_INDEX.find(t => t.id === topicId);
  if (topic) { topic.questionCount = questions.length; UI.renderTopics(); }
  Engine.loadQuestions(topicId, 'practice');
  window.resetQuiz();
  UI.show('quiz');
  UI.renderQuiz(topicId);
};

// ── Mode switching ──
window.switchMode = function(mode) {
  Engine.loadQuestions(window._currentTopicId, mode);
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  window.resetQuiz();
  UI.renderQuiz(window._currentTopicId);
  UI.updateProgress();
};

// ── Answer handling ──
window.selectSingle = function(key) {
  if (window._submitted) return;
  window._currentSelection = [key];
  UI.renderQuestion();
};

window.toggleMulti = function(key) {
  if (window._submitted) return;
  const idx = window._currentSelection.indexOf(key);
  if (idx >= 0) window._currentSelection.splice(idx, 1);
  else window._currentSelection.push(key);
  UI.renderQuestion();
};

window.submitAnswer = function() {
  if (window._currentSelection.length === 0) return;
  const q = Engine.getCurrent();
  if (!q) return;

  // Fill-blank with AI scoring (async)
  if (q.type === 'fill_blank' && AI.hasKey() && !Engine.checkAnswer(q, window._currentSelection)) {
    window._submitted = true;
    window._aiScoring = true;
    UI.renderQuestion(); // show loading state
    Engine.checkAnswerAI(q, window._currentSelection).then(result => {
      window._lastCorrect = result.isCorrect;
      window._showFeedback = true;
      window._aiScoring = false;
      window._aiFeedback = result;
      // Record
      Storage.recordAnswer(window._currentTopicId, result.isCorrect);
      if (!result.isCorrect) Storage.addWrongId(window._currentTopicId, q.id);
      else Storage.removeWrongId(window._currentTopicId, q.id);
      if (Engine.mode === 'exam') Engine.recordExamAnswer(q.id, window._currentSelection, result.isCorrect);
      UI.renderQuestion();
    }).catch(() => {
      window._lastCorrect = false;
      window._showFeedback = true;
      window._aiScoring = false;
      window._aiFeedback = null;
      Storage.recordAnswer(window._currentTopicId, false);
      Storage.addWrongId(window._currentTopicId, q.id);
      UI.renderQuestion();
    });
    return;
  }

  window._submitted = true;
  const isCorrect = Engine.checkAnswer(q, window._currentSelection);
  window._lastCorrect = isCorrect;
  window._showFeedback = true;
  window._aiFeedback = null;

  if (Engine.mode === 'exam') Engine.recordExamAnswer(q.id, window._currentSelection, isCorrect);
  Storage.recordAnswer(window._currentTopicId, isCorrect);
  if (!isCorrect) Storage.addWrongId(window._currentTopicId, q.id);
  else Storage.removeWrongId(window._currentTopicId, q.id);
  UI.renderQuestion();
};

window.submitFill = function() {
  const input = document.getElementById('fill-answer');
  if (!input || !input.value.trim()) return;
  window._currentSelection = [input.value.trim()];
  window.submitAnswer();
};

window.nextQuestion = function() {
  const q = Engine.next();
  window.resetQuiz();
  if (!q) {
    if (Engine.mode === 'exam') {
      UI.showResult();
    } else {
      UI.renderQuiz(window._currentTopicId);
    }
  } else {
    UI.renderQuestion();
    UI.updateProgress();
  }
};

window.resetQuiz = function() {
  window._currentSelection = [];
  window._showFeedback = false;
  window._lastCorrect = false;
  window._submitted = false;
};

// ── Bookmark ──
window.toggleBookmark = function() {
  const q = Engine.getCurrent();
  if (!q) return;
  Storage.toggleBookmark(window._currentTopicId, q.id);
  UI.renderQuestion();
};

// ── Navigation ──
window.goHome = function() {
  window._currentTopicId = null;
  window.resetQuiz();
  UI.show('home');
  UI.renderTopics();
};

window.searchQuestions = function(val) {
  UI.renderTopics(val);
};

// ── Review wrong from result ──
window.reviewWrong = function() {
  Engine.loadQuestions(window._currentTopicId, 'wrong');
  window.resetQuiz();
  UI.show('quiz');
  UI.renderQuiz(window._currentTopicId);
};

// ── Stats navigation (via bottom nav) ──
window.showStats = function() {
  UI.show('stats');
  UI.renderStats();
};

// ── API Key setup ──
window.saveApiKey = function() {
  const input = document.getElementById('api-key-input');
  const key = (input ? input.value : '').trim();
  if (!key) { alert('请输入API Key'); return; }
  AI.saveKey(key);
  UI.show('home');
  UI.renderTopics();
};

window.skipSetup = function() {
  UI.show('home');
  UI.renderTopics();
};

window.showSetup = function() { UI.show('setup'); UI.renderSetup(); };
window.showSettings = function() { UI.show('settings'); UI.renderSettings(); };

window.testApiKey = async function() {
  const msg = document.getElementById('settings-msg');
  msg.textContent = '测试中...';
  msg.style.color = '#5f6368';
  const ok = await AI.testKey();
  msg.textContent = ok ? '✓ 连接成功' : '✗ 连接失败';
  msg.style.color = ok ? '#0d904f' : '#d93025';
};

window.deleteApiKey = function() {
  AI.deleteKey();
  UI.renderSettings();
};

// ── AI Generate ──
window.aiGenerateQuestions = async function() {
  const select = document.getElementById('ai-topic-select');
  const countEl = document.getElementById('ai-question-count');
  const status = document.getElementById('ai-gen-status');
  if (!select || !countEl) return;
  const topicId = select.value;
  const count = parseInt(countEl.value) || 5;
  if (!topicId) { alert('请选择专题'); return; }
  status.textContent = 'AI 正在生成题目...';
  status.style.color = '#1a73e8';
  try {
    const questions = await AI.generateQuestions(topicId, count);
    status.textContent = `✓ 生成完成！${questions.length} 道新题已加入题库`;
    status.style.color = '#0d904f';
    // Merge into active topic if same; update counts
    const topic = TOPIC_INDEX.find(t => t.id === topicId);
    if (topic) {
      const cached = AICache.getQuestions(topicId);
      topic.questionCount = (DataCache.get(topicId)?.length || 0) + cached.length;
    }
  } catch(e) {
    status.textContent = e.message === 'NO_KEY' ? '请先设置API Key' :
                         e.message === 'INVALID_KEY' ? 'API Key无效，请重新设置' : `生成失败: ${e.message}`;
    status.style.color = '#d93025';
  }
};

// ── Settings save ──
window.saveSettingsKey = function() {
  const input = document.getElementById('settings-key-input');
  if (!input || !input.value.trim()) return;
  AI.saveKey(input.value.trim());
  UI.renderSettings();
  const msg = document.getElementById('settings-msg');
  msg.textContent = '✓ 已保存';
  msg.style.color = '#0d904f';
};

// ── Boot ──
document.addEventListener('DOMContentLoaded', init);