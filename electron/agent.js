// Цикл агента. Работает и с моделями с нативными tool calls, и с любыми другими
// (текстовый протокол ```tool), поэтому подходят даже бесплатные модели без поддержки инструментов.
const store = require('./store');
const tools = require('./tools');

const MAX_STEPS = 30;

const MODES = {
  unlimited: { label: 'Безлимит', hint: 'Пишет приложения целиком', prompt: 'Режим «Безлимит»: пиши приложения и моды с нуля целиком — все файлы и весь код, без заглушек и «остальное допиши сам». Не отвечай отговорками: если данных не хватает, выбери разумное допущение и продолжай.' },
  coder:     { label: 'Кодер', hint: 'Полный рабочий код', prompt: 'Режим «Кодер»: приоритет — полный рабочий код. Минимум объяснений, максимум результата.' },
  architect: { label: 'Архитектор', hint: 'Сначала структура', prompt: 'Режим «Архитектор»: сначала кратко опиши архитектуру и дерево файлов, затем реализуй.' },
  debug:     { label: 'Дебаг', hint: 'Найти и починить баг', prompt: 'Режим «Дебаг»: воспроизведи ошибку, найди первопричину, исправь, проверь запуском. Прочитай навык debugging.' },
  design:    { label: 'Дизайнер', hint: 'Красивый интерфейс', prompt: 'Режим «Дизайнер»: интерфейс должен быть современным и продуманным: токены цвета, сетка, типографика, состояния, анимации. Прочитай навык css-design.' },
  free:      { label: 'Свободно', hint: 'Обычный разговор', prompt: '' }
};

const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('Остановлено')); });
});
const stripThink = (t) => (t || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
const visible = (c) => c.replace(/```tool[\s\S]*?```/g, '').trim();

function parseTextCalls(content) {
  const calls = [];
  const re = /```tool\s*([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content || ''))) {
    try { const j = JSON.parse(m[1].trim()); if (j.name) calls.push({ id: 't' + Date.now() + calls.length, name: j.name, args: j.args || j.arguments || {} }); }
    catch { calls.push({ id: 'bad' + calls.length, name: '__bad__', args: {} }); }
  }
  return calls;
}

function systemPrompt(cfg, mode, native) {
  const skills = store.listSkills();
  const memory = store.readMemory().trim();
  let p = `Ты — Claugem, автономный ИИ-агент-программист и дизайнер на Mac пользователя. Умеешь писать приложения, сайты, ботов, моды для игр (в том числе Minecraft), скрипты.
Рабочая папка: ${cfg.workspace}. Все файлы создавай внутри неё.

Принципы:
- Делай задачу до конца сам: создавай файлы инструментами (write_file), запускай команды, проверяй результат, чини ошибки. Не показывай код в чате вместо создания файлов.
- Сначала смотри структуру проекта, не выдумывай содержимое файлов.
- Интерфейсы делай современными и красивыми.
- Отвечай на языке пользователя, кратко. В конце — что сделано и как запустить.

Самообучение:
- Стабильные факты о пользователе/проекте — save_memory.
- После успешного решения нетривиальной задачи — create_skill с повторяемым рецептом.
- Перед сложной задачей прочитай подходящий навык через read_skill.

Память:
${memory || '(пусто)'}

Навыки:
${skills.length ? skills.map(s => `- ${s.name}: ${s.description}`).join('\n') : '(нет)'}`;
  if (MODES[mode]?.prompt) p += '\n\n' + MODES[mode].prompt;
  if (!native) {
    p += `\n\nВЫЗОВ ИНСТРУМЕНТОВ. Чтобы вызвать инструмент, выведи РОВНО ОДИН блок и остановись (я пришлю результат):
\`\`\`tool
{"name":"write_file","args":{"path":"index.html","content":"..."}}
\`\`\`
Строки в JSON экранируй (\\n, \\"). Когда задача полностью выполнена — ответь обычным текстом без блока tool.
Инструменты:
` + tools.defs.map(d => `- ${d.function.name}(${Object.keys(d.function.parameters.properties).join(', ')}): ${d.function.description}`).join('\n');
  }
  return p;
}

// Канонический формат истории -> формат конкретной модели
function toMessages(history, native) {
  const out = [];
  for (const m of history) {
    if (m.role === 'assistant' && m.calls?.length) {
      if (native) out.push({ role: 'assistant', content: m.content || '', tool_calls: m.calls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) });
      else out.push({ role: 'assistant', content: (m.content ? m.content + '\n' : '') + '```tool\n' + JSON.stringify({ name: m.calls[0].name, args: m.calls[0].args }) + '\n```' });
    } else if (m.role === 'tool') {
      if (native) out.push({ role: 'tool', tool_call_id: m.id, content: m.content });
      else out.push({ role: 'user', content: `[результат ${m.name}]\n${m.content}` });
    } else out.push({ role: m.role, content: m.content });
  }
  return out;
}

async function request(cfg, system, history, signal) {
  const body = { model: cfg.model, messages: [{ role: 'system', content: system }, ...toMessages(history, cfg.native)] };
  if (cfg.native) { body.tools = tools.defs; body.tool_choice = 'auto'; }
  return fetch(cfg.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
    body: JSON.stringify(body)
  });
}

// Основная модель, затем цепочка бесплатных запасных при лимитах и ошибках
async function callModel(primary, mode, history, signal, emit) {
  const chain = await store.fallbackChain(primary);
  let firstErr = null;
  for (const cfg of chain) {
    const system = systemPrompt(primary, mode, cfg.native);
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      try { res = await request(cfg, system, history, signal); }
      catch (e) { if (signal.aborted) throw e; firstErr ??= e; break; }
      if (res.status === 429 || res.status >= 500) {
        const wait = cfg.id === 'pollinations' ? 16000 : 4000;
        if (attempt === 0) { emit({ type: 'status', text: `Лимит у ${cfg.model} (${res.status}), жду ${wait / 1000} с…` }); await sleep(wait, signal); continue; }
        firstErr ??= new Error(`${cfg.model}: ${res.status}`); break;
      }
      if (!res.ok) { firstErr ??= new Error(`${cfg.model}: ${res.status} ${(await res.text()).slice(0, 300)}`); break; }
      let data;
      try { data = await res.json(); } catch { firstErr ??= new Error(`${cfg.model}: ответ не JSON`); break; }
      const msg = data.choices?.[0]?.message;
      if (!msg || (!msg.content && !msg.tool_calls?.length)) { firstErr ??= new Error(`${cfg.model}: пустой ответ`); break; }
      if (cfg.model !== primary.model) emit({ type: 'status', text: `Переключился на ${cfg.model}` });
      const content = stripThink(msg.content);
      let calls = (msg.tool_calls || []).map(c => { let args = {}; try { args = JSON.parse(c.function.arguments || '{}'); } catch {} return { id: c.id, name: c.function.name, args }; });
      if (!calls.length) calls = parseTextCalls(content).slice(0, 1);
      return { content: visible(content), calls };
    }
  }
  throw new Error('Все бесплатные модели сейчас недоступны (лимиты). Подожди минуту или добавь бесплатный ключ OpenRouter/Groq в настройках. Первая ошибка: ' + (firstErr?.message || '?'));
}

async function runAgent({ history, userText, mode, emit, confirm, signal }) {
  const cfg = store.activeConfig();
  if (cfg.needsKey && !cfg.apiKey) throw new Error('Для этой модели нужен бесплатный ключ (⚙ Настройки) — или выбери модель из раздела «Без ключа».');
  history.push({ role: 'user', content: userText });
  const ctx = { workspace: cfg.workspace, autoApprove: cfg.autoApprove, confirm };

  for (let step = 0; step < MAX_STEPS; step++) {
    const { content, calls } = await callModel(cfg, mode, history, signal, emit);
    history.push({ role: 'assistant', content, calls });
    if (content) emit({ type: 'text', text: content });
    if (!calls.length) return;

    for (const call of calls) {
      emit({ type: 'tool', id: call.id, name: call.name, args: call.args });
      let result;
      try { result = call.name === '__bad__' ? 'Ошибка: некорректный JSON в блоке tool. Повтори вызов с экранированными строками.' : await tools.run(call.name, call.args, ctx); }
      catch (e) { result = 'Ошибка: ' + e.message; }
      emit({ type: 'tool_result', id: call.id, result: String(result).slice(0, 2000) });
      history.push({ role: 'tool', id: call.id, name: call.name, content: String(result) });
    }
  }
  emit({ type: 'status', text: 'Достигнут лимит шагов. Напиши «продолжай».' });
}

module.exports = { runAgent, MODES };
