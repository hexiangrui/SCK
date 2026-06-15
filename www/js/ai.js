// AI Service: DeepSeek API integration for question generation & answer scoring
const AI = {
  API_URL: 'https://api.deepseek.com/v1/chat/completions',
  MODEL: 'deepseek-chat',

  // ── Key management ──
  getKey() { return localStorage.getItem('ds_api_key') || ''; },
  saveKey(key) { localStorage.setItem('ds_api_key', key.trim()); },
  deleteKey() { localStorage.removeItem('ds_api_key'); },
  hasKey() { return !!this.getKey(); },
  async testKey(key) {
    try {
      const resp = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key || this.getKey()}` },
        body: JSON.stringify({ model: this.MODEL, messages: [{ role: 'user', content: '回复"OK"' }], max_tokens: 10 })
      });
      return resp.ok;
    } catch(e) { return false; }
  },

  // ── Build generation prompt ──
  _buildPrompt(topic, count, questionTypes) {
    const typeStr = (questionTypes || ['single_choice','multi_choice','true_false','fill_blank']).join('、');
    return `你是矿山安全规程专家，精通所有金属非金属矿山国家标准和行业规范。

请根据以下规程文件生成${count}道考试题：
${topic.sourceDocuments.join('、')}

要求：
- 题型：${typeStr}
- 难度：中等偏难，覆盖关键条款和易混淆知识点
- 每题必须包含：题目、选项(选择题)、正确答案、详细解析、出处(文档名+条款号+原文引用)
- 返回严格JSON，格式如下：
{"questions":[{"type":"题型","question":"题目","options":[{"key":"A","text":"选项"}],"answer":["A"],"explanation":"解析","source":{"document":"文档名","article":"条款号","quote":"原文引用"}}]}`;
  },

  // ── Call DeepSeek API ──
  async _call(messages, maxTokens = 2048) {
    const key = this.getKey();
    if (!key) throw new Error('NO_KEY');
    const resp = await fetch(this.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: this.MODEL, messages, max_tokens: maxTokens, response_format: { type: 'json_object' } })
    });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('INVALID_KEY');
      throw new Error(`API_ERROR:${resp.status}`);
    }
    const data = await resp.json();
    return JSON.parse(data.choices[0].message.content);
  },

  // ── Generate questions ──
  async generateQuestions(topicId, count = 5, questionTypes = null) {
    const topic = TOPIC_INDEX.find(t => t.id === topicId);
    if (!topic) throw new Error('未找到专题');
    const prompt = this._buildPrompt(topic, count, questionTypes);
    const result = await this._call([
      { role: 'system', content: '你是矿山安全规程专家。严格按照用户要求的JSON格式返回，不要输出任何额外文字。' },
      { role: 'user', content: prompt }
    ], 4096);
    const questions = result.questions || [];
    // Assign unique IDs
    const ts = Date.now();
    questions.forEach((q, i) => {
      q.id = `ai_${topicId}_${ts}_${i}`;
      q.aiGenerated = true;
    });
    AICache.saveQuestions(topicId, questions);
    return questions;
  },

  // ── Score fill-blank answer ──
  async scoreAnswer(questionText, userAnswer, correctAnswers) {
    const result = await this._call([{
      role: 'user',
      content: `你是一名矿山安全规程考官。请评估以下填空题的作答：

题目：${questionText}
标准答案：${correctAnswers.join('；')}
考生答案：${userAnswer}

评分标准：
- 语义完全一致 → score:100, isCorrect:true
- 核心意思对但措辞不同 → score:70-90, isCorrect:true
- 部分正确但不完整 → score:40-60, isCorrect:false
- 明显错误 → score:0-30, isCorrect:false

返回JSON：{"score":数字,"isCorrect":布尔,"feedback":"简短评语(20字内)"}`
    }], 256);
    return result;
  },

  // ── Generate explanation ──
  async generateExplanation(questionText, correctAnswer) {
    const result = await this._call([{
      role: 'user',
      content: `你是矿山安全规程专家。请为以下题目生成详细的解析说明，要求引用具体规程条款。

题目：${questionText}
正确答案：${Array.isArray(correctAnswer) ? correctAnswer.join('、') : correctAnswer}

返回JSON：{"explanation":"详细解析(含条款引用)","source":{"document":"规程名称","article":"条款号","quote":"原文引用"}}`
    }], 1024);
    return result;
  }
};