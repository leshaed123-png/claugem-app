import React, { useEffect, useRef, useState } from 'react';

const api = window.claugem;

const inline = (t) => t.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((p, i) =>
  p.length > 1 && p.startsWith('`') && p.endsWith('`') ? <code key={i}>{p.slice(1, -1)}</code>
  : p.length > 3 && p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p);

function Markdown({ text }) {
  const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g);
  const out = [];
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i].trim()) parts[i].trim().split(/\n{2,}/).forEach((para, j) => out.push(<p key={`${i}-${j}`}>{inline(para)}</p>));
    if (i + 2 < parts.length) out.push(
      <div className="code" key={`c${i}`}>
        <div className="code-head"><span>{parts[i + 1] || 'code'}</span>
          <button onClick={() => navigator.clipboard.writeText(parts[i + 2])}>Копировать</button></div>
        <pre>{parts[i + 2]}</pre>
      </div>);
  }
  return <div className="md">{out}</div>;
}

const ICONS = { run_command: '⌘', write_file: '✎', edit_file: '✎', read_file: '◧', list_dir: '▤', create_skill: '✦', save_memory: '◉', read_skill: '✦' };
function ToolCard({ item }) {
  const [open, setOpen] = useState(false);
  const label = item.args.path || item.args.command || item.args.name || item.args.note || '';
  return (
    <div className={'tool' + (item.result == null ? ' running' : '')} onClick={() => setOpen(!open)}>
      <div className="tool-head">
        <span className="ticon">{ICONS[item.name] || '•'}</span><b>{item.name}</b>
        <span className="tlabel">{String(label).slice(0, 90)}</span>
        <span className="tstate">{item.result == null ? <i className="spin" /> : '✓'}</span>
      </div>
      {open && <pre className="tool-body">{item.result ?? ''}</pre>}
    </div>
  );
}

const shortName = (m) => m.split('/').pop().replace(/:free$/, '');

function ModelPicker({ settings, models, onPick }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const cur = settings.models[settings.provider] || settings.providers[settings.provider].model;
  const list = models.filter((m) => (m.label + m.model).toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(list.map((m) => m.group))];
  return (
    <div className="picker" ref={ref}>
      <button className="pill" onClick={() => setOpen(!open)}>
        <span className="dot" />{shortName(cur)}<span className="chev">▾</span>
      </button>
      {open && (
        <div className="pop">
          <input autoFocus placeholder="Найти модель…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="pop-list">
            {models.length === 0 && <div className="muted pad">Загружаю список моделей…</div>}
            {groups.map((g) => (
              <div key={g}>
                <div className="group">{g}</div>
                {list.filter((m) => m.group === g).map((m) => (
                  <button key={m.provider + m.model} className={'opt' + (m.provider === settings.provider && m.model === cur ? ' on' : '')}
                    onClick={() => { onPick(m); setOpen(false); }}>
                    <span>{shortName(m.model)}{/deepseek/i.test(m.model) && <em className="tag">DeepSeek</em>}</span>
                    {m.locked ? <small>🔑 ключ</small> : <small className="ok">готово</small>}
                  </button>))}
              </div>))}
          </div>
        </div>)}
    </div>
  );
}

function Settings({ settings, initialProvider, onClose, onSave }) {
  const keyed = Object.entries(settings.providers).filter(([, v]) => v.needsKey);
  const [provider, setProvider] = useState(initialProvider || keyed[0][0]);
  const [key, setKey] = useState('');
  const [auto, setAuto] = useState(settings.autoApprove);
  const p = settings.providers[provider];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Настройки</h2>
        <p className="hint">Ключи нужны только для моделей из групп с 🔑. Всё из «Без ключа» работает сразу.</p>
        <label>Добавить бесплатный ключ</label>
        <select value={provider} onChange={(e) => { setProvider(e.target.value); setKey(''); }}>
          {keyed.map(([id, v]) => <option key={id} value={id}>{v.label}</option>)}
        </select>
        <input type="password" placeholder={settings.hasKey[provider] ? '•••••••• (сохранён, пусто — не менять)' : 'вставь ключ'} value={key} onChange={(e) => setKey(e.target.value)} />
        <p className="hint"><a onClick={() => api.openUrl(p.keyUrl)}>Получить бесплатный ключ →</a></p>
        <label className="check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Выполнять команды без подтверждения</label>
        <div className="row">
          <button className="ghost" onClick={onClose}>Отмена</button>
          <button className="primary" onClick={() => onSave({ autoApprove: auto, keys: key ? { [provider]: key } : {} })}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

const IDEAS = [
  ['⛏', 'Мод для Minecraft', 'Напиши мод для Minecraft (Fabric): новый предмет «Рубиновый меч» с рецептом крафта'],
  ['🎨', 'Лендинг', 'Сделай красивый лендинг для кофейни с анимациями'],
  ['🤖', 'Telegram-бот', 'Создай Telegram-бота на Python с inline-кнопками и SQLite'],
  ['🐍', 'Игра «Змейка»', 'Сделай игру «Змейка» на HTML5 canvas с рекордами и красивой графикой']
];

export default function App() {
  const [settings, setSettings] = useState(null);
  const [models, setModels] = useState([]);
  const [modes, setModes] = useState([]);
  const [mode, setMode] = useState('unlimited');
  const [skills, setSkills] = useState([]);
  const [items, setItems] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [showSettings, setShowSettings] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.models().then(setModels);
    api.modes().then(setModes);
    api.listSkills().then(setSkills);
    return api.onEvent((ev) => {
      if (ev.type === 'text') setItems((l) => [...l, { kind: 'text', text: ev.text }]);
      else if (ev.type === 'tool') setItems((l) => [...l, { kind: 'tool', id: ev.id, name: ev.name, args: ev.args, result: null }]);
      else if (ev.type === 'tool_result') { setItems((l) => l.map((i) => (i.id === ev.id ? { ...i, result: ev.result } : i))); api.listSkills().then(setSkills); }
      else if (ev.type === 'status') setItems((l) => [...l, { kind: 'status', text: ev.text }]);
      else if (ev.type === 'error') setItems((l) => [...l, { kind: 'error', text: ev.text }]);
      else if (ev.type === 'confirm') setConfirm(ev);
      else if (ev.type === 'done') setBusy(false);
    });
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [items, confirm, busy]);

  const send = (text) => {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setItems((l) => [...l, { kind: 'user', text: t }]);
    setInput(''); setBusy(true); api.send(t, mode);
  };
  const pick = async (m) => {
    if (m.locked) return setShowSettings({ provider: m.provider });
    setSettings(await api.setSettings({ provider: m.provider, models: { [m.provider]: m.model } }));
  };
  const answer = (ok) => { api.confirm(confirm.id, ok); setConfirm(null); };
  const newChat = () => { api.reset(); setItems([]); };

  if (!settings) return null;
  const empty = items.length === 0;
  return (
    <div className="app">
      <div className="aurora"><i /><i /><i /></div>

      <aside>
        <div className="drag" />
        <div className="brand"><span className="logo">✦</span>Claugem</div>
        <button className="primary wide" onClick={newChat}>＋ Новый чат</button>
        <div className="section">Проект</div>
        <button className="folder" title={settings.workspace} onClick={async () => setSettings(await api.pickWorkspace())}>
          <span>▣</span>{settings.workspace.split('/').pop() || '/'}
        </button>
        <div className="section">Навыки · {skills.length}</div>
        <div className="skills">{skills.map((s) => (
          <div key={s.name} className="skill" title={s.description} onClick={() => setInput((v) => `Используй навык ${s.name}. ` + v)}>{s.name}</div>))}</div>
        <div className="spacer" />
        <button className="ghost wide" onClick={() => setShowSettings({})}>⚙ Настройки</button>
      </aside>

      <main>
        <header>
          <div className="drag top" />
          <ModelPicker settings={settings} models={models} onPick={pick} />
        </header>

        <div className="chat">
          {empty && (
            <div className="hero">
              <div className="orb" />
              <h1>Что построим?</h1>
              <p>Опиши задачу — я сам напишу код, создам файлы и проверю результат.</p>
              <div className="ideas">
                {IDEAS.map(([ic, t, prompt]) => (
                  <button key={t} onClick={() => send(prompt)}><span>{ic}</span><b>{t}</b><small>{prompt.slice(0, 54)}…</small></button>))}
              </div>
            </div>)}
          {items.map((it, i) => it.kind === 'user' ? <div key={i} className="bubble user">{it.text}</div>
            : it.kind === 'text' ? <div key={i} className="bubble bot"><Markdown text={it.text} /></div>
            : it.kind === 'tool' ? <ToolCard key={i} item={it} />
            : <div key={i} className={'note ' + it.kind}>{it.text}</div>)}
          {confirm && (
            <div className="confirm">
              <div>Выполнить команду?</div><code>{confirm.command}</code>
              <div className="row"><button className="ghost" onClick={() => answer(false)}>Отклонить</button><button className="primary" onClick={() => answer(true)}>Выполнить</button></div>
            </div>)}
          {busy && !confirm && <div className="typing"><i /><i /><i /></div>}
          <div ref={endRef} />
        </div>

        <div className="dock">
          <div className="modes">{modes.map((m) => (
            <button key={m.id} title={m.hint} className={'cap' + (m.id === mode ? ' on' : '')} onClick={() => setMode(m.id)}>{m.label}</button>))}</div>
          <div className="composer">
            <textarea rows={1} placeholder="Напиши, что создать…" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            {busy ? <button className="stop" onClick={() => api.stop()}>■</button>
              : <button className="send" onClick={() => send()} disabled={!input.trim()}>↑</button>}
          </div>
        </div>
      </main>

      {showSettings && <Settings settings={settings} initialProvider={showSettings.provider} onClose={() => setShowSettings(null)}
        onSave={async (p) => { setSettings(await api.setSettings(p)); api.models().then(setModels); setShowSettings(null); }} />}
    </div>
  );
}
