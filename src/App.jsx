import React, { useEffect, useRef, useState } from 'react';

const api = window.claugem;

function Markdown({ text }) {
  // Минимальный рендер: блоки кода и абзацы
  const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g);
  const out = [];
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i]) out.push(<p key={i}>{parts[i]}</p>);
    if (i + 2 < parts.length) out.push(
      <div className="code" key={i + 1}>
        <div className="code-head"><span>{parts[i + 1] || 'code'}</span>
          <button onClick={() => navigator.clipboard.writeText(parts[i + 2])}>Копировать</button></div>
        <pre>{parts[i + 2]}</pre>
      </div>
    );
  }
  return <div className="md">{out}</div>;
}

function ToolCard({ item }) {
  const [open, setOpen] = useState(false);
  const icon = { run_command: '⌘', write_file: '✎', edit_file: '✎', read_file: '📄', list_dir: '📁', create_skill: '✦', save_memory: '🧠', read_skill: '✦' }[item.name] || '•';
  const label = item.args.path || item.args.command || item.args.name || item.args.note || '';
  return (
    <div className={'tool ' + (item.result == null ? 'running' : '')} onClick={() => setOpen(!open)}>
      <div className="tool-head"><span className="ticon">{icon}</span><b>{item.name}</b><span className="tlabel">{String(label).slice(0, 80)}</span>
        <span className="tstate">{item.result == null ? '…' : '✓'}</span></div>
      {open && <pre className="tool-body">{item.result ?? ''}</pre>}
    </div>
  );
}

function Settings({ settings, onClose, onSave }) {
  const [provider, setProvider] = useState(settings.provider);
  const [key, setKey] = useState('');
  const [model, setModel] = useState(settings.models[settings.provider] || '');
  const [auto, setAuto] = useState(settings.autoApprove);
  const p = settings.providers[provider];
  const [free, setFree] = useState([]);
  useEffect(() => { if (provider === 'openrouter') api.freeModels().then(setFree); }, [provider]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Настройки</h2>
        <label>Провайдер ИИ</label>
        <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(settings.models[e.target.value] || ''); setKey(''); }}>
          {Object.entries(settings.providers).map(([id, v]) => <option key={id} value={id}>{v.label}</option>)}
        </select>
        {p.needsKey ? (<>
          <label>API-ключ {settings.hasKey[provider] && <em>(сохранён)</em>} · <a onClick={() => api.openUrl(p.keyUrl)}>получить ключ</a></label>
          <input type="password" placeholder={settings.hasKey[provider] ? '•••••••• (оставь пустым, чтобы не менять)' : 'вставь ключ'} value={key} onChange={(e) => setKey(e.target.value)} />
        </>) : <p className="hint">Ключ не нужен. Установи <a onClick={() => api.openUrl(p.keyUrl)}>Ollama</a> и выполни: <code>ollama pull {p.model}</code></p>}
        <label>Модель</label>
        <input list="free-models" placeholder={p.model} value={model} onChange={(e) => setModel(e.target.value)} />
        <datalist id="free-models">{free.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</datalist>
        {provider === 'openrouter' && <p className="hint">Бесплатные модели с поддержкой инструментов ({free.length}), DeepSeek — первыми. Если лимит кончится, Claugem сам переключится на следующую.</p>}
        <label className="check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Выполнять команды без подтверждения</label>
        <div className="row">
          <button className="ghost" onClick={onClose}>Отмена</button>
          <button className="primary" onClick={() => onSave({ provider, autoApprove: auto, models: model ? { [provider]: model } : {}, keys: key ? { [provider]: key } : {} })}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState(null);
  const [skills, setSkills] = useState([]);
  const [items, setItems] = useState([]);   // {kind:'user'|'text'|'tool'|'status'|'error', ...}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    api.getSettings().then((s) => { setSettings(s); if (s.providers[s.provider].needsKey && !s.hasKey[s.provider]) setShowSettings(true); });
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
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [items, confirm]);

  const send = () => {
    const t = input.trim();
    if (!t || busy) return;
    setItems((l) => [...l, { kind: 'user', text: t }]);
    setInput(''); setBusy(true); api.send(t);
  };
  const answer = (ok) => { api.confirm(confirm.id, ok); setConfirm(null); };
  const newChat = () => { api.reset(); setItems([]); };

  if (!settings) return null;
  return (
    <div className="app">
      <aside>
        <div className="drag" />
        <div className="brand">✦ Claugem</div>
        <button className="primary wide" onClick={newChat}>+ Новый чат</button>
        <div className="section">Рабочая папка</div>
        <button className="folder" onClick={async () => setSettings(await api.pickWorkspace())}>
          {settings.workspace ? '📁 ' + settings.workspace.split('/').pop() : 'Выбрать папку…'}
        </button>
        <div className="section">Навыки ({skills.length})</div>
        <div className="skills">{skills.length ? skills.map((s) => <div key={s.name} className="skill" title={s.description}>✦ {s.name}</div>) : <div className="muted">Пока пусто — агент создаст сам, когда научится чему-то новому</div>}</div>
        <div className="spacer" />
        <button className="ghost wide" onClick={() => setShowSettings(true)}>⚙ {settings.providers[settings.provider].label.split(' (')[0]}</button>
      </aside>

      <main>
        <div className="drag top" />
        <div className="chat">
          {items.length === 0 && (
            <div className="hero">
              <h1>Что построим?</h1>
              <p>Выбери папку проекта и опиши задачу. Я пишу код, запускаю команды и учусь на каждой задаче.</p>
              <div className="chips">
                {['Сделай лендинг с красивой анимацией', 'Создай приложение-todo на React', 'Разбери проект и найди баги'].map((s) => <button key={s} onClick={() => setInput(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {items.map((it, i) => it.kind === 'user' ? <div key={i} className="bubble user">{it.text}</div>
            : it.kind === 'text' ? <div key={i} className="bubble bot"><Markdown text={it.text} /></div>
            : it.kind === 'tool' ? <ToolCard key={i} item={it} />
            : <div key={i} className={'note ' + it.kind}>{it.text}</div>)}
          {confirm && (
            <div className="confirm">
              <div>Выполнить команду?</div><code>{confirm.command}</code>
              <div className="row"><button className="ghost" onClick={() => answer(false)}>Отклонить</button><button className="primary" onClick={() => answer(true)}>Выполнить</button></div>
            </div>
          )}
          {busy && !confirm && <div className="typing"><i /><i /><i /></div>}
          <div ref={endRef} />
        </div>
        <div className="composer">
          <textarea rows={1} placeholder="Опиши задачу…  (Enter — отправить, Shift+Enter — перенос)" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          {busy ? <button className="stop" onClick={() => api.stop()}>■</button> : <button className="send" onClick={send} disabled={!input.trim()}>↑</button>}
        </div>
      </main>

      {showSettings && <Settings settings={settings} onClose={() => setShowSettings(false)} onSave={async (p) => { setSettings(await api.setSettings(p)); setShowSettings(false); }} />}
    </div>
  );
}
