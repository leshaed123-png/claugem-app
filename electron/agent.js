// Цикл агента: модель -> вызовы инструментов -> результаты -> снова модель
const store = require('./store');
const tools = require('./tools');

const MAX_STEPS = 30;
const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('Остановлено')); });
});

function systemPrompt(cfg) {
  const skills = store.listSkills();
  const memory = store.readMemory().trim();
  return `Ты — Claugem, автономный ИИ-агент-программист и дизайнер, работающий на Mac пользователя.
Рабочая папка: ${cfg.workspace || '(не выбрана)'}.

Принципы:
- Делай задачу до конца сам: пиши код, создавай файлы, запускай команды, проверяй результат, чини ошибки.
- Сначала смотри структуру проекта (list_dir, read_file), потом действуй. Не выдумывай содержимое файлов.
- Для интерфейсов делай современный, аккуратный дизайн: сетка, отступы, типографика, тёмная/светлая тема, плавные анимации.
- Отвечай на языке пользователя, кратко. В конце — что сделано и как запустить.

Самообучение (важно):
- Когда узнаёшь что-то стабильное о пользователе или проекте — save_memory.
- Когда успешно решил нетривиальную задачу или исправил ошибку — сохрани повторяемый рецепт через create_skill.
- Перед сложной задачей проверь список навыков ниже и прочитай подходящий через read_skill.

Сохранённая память:
${memory || '(пока пусто)'}

Доступные навыки:
${skills.length ? skills.map(s => `- ${s.name}: ${s.description}`).join('\n') : '(пока нет)'}`;
}

async function callModel(cfg, messages, signal, emit) {
  const url = cfg.baseUrl.replace(/\/$/, '') + '/chat/completions';
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({ model: cfg.model, messages, tools: tools.defs, tool_choice: 'auto' })
    });
    if (res.status === 429 || res.status >= 500) {
      // Бесплатные тарифы часто упираются в лимиты — ждём и повторяем
      const wait = Math.min(60, 5 * 2 ** attempt);
      emit({ type: 'status', text: `Лимит провайдера (${res.status}), повтор через ${wait} с…` });
      await sleep(wait * 1000, signal);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 600)}`);
    const data = await res.json();
    return data.choices[0].message;
  }
  throw new Error('Провайдер всё время отвечает ошибкой лимита. Смени провайдера в настройках или подожди.');
}

async function runAgent({ history, userText, emit, confirm, signal }) {
  const cfg = store.activeConfig();
  if (cfg.needsKey && !cfg.apiKey) throw new Error('Не задан API-ключ. Открой настройки и вставь ключ (бесплатные ключи — по ссылкам там же).');

  history.push({ role: 'user', content: userText });
  const ctx = { workspace: cfg.workspace, autoApprove: cfg.autoApprove, confirm };

  for (let step = 0; step < MAX_STEPS; step++) {
    const messages = [{ role: 'system', content: systemPrompt(cfg) }, ...history];
    const msg = await callModel(cfg, messages, signal, emit);
    history.push({ role: 'assistant', content: msg.content ?? '', ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) });
    if (msg.content) emit({ type: 'text', text: msg.content });
    if (!msg.tool_calls?.length) return;

    for (const call of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch {}
      emit({ type: 'tool', id: call.id, name: call.function.name, args });
      let result;
      try { result = await tools.run(call.function.name, args, ctx); }
      catch (e) { result = 'Ошибка: ' + e.message; }
      emit({ type: 'tool_result', id: call.id, result: String(result).slice(0, 2000) });
      history.push({ role: 'tool', tool_call_id: call.id, content: String(result) });
    }
  }
  emit({ type: 'status', text: 'Достигнут лимит шагов. Напиши «продолжай», чтобы идти дальше.' });
}

module.exports = { runAgent };
