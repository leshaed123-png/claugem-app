// Инструменты агента: файлы, команды, память, самообучение через навыки
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const store = require('./store');

const defs = [
  ['list_dir', 'Показать содержимое папки в рабочей директории', { path: { type: 'string', description: 'Относительный путь, "." для корня' } }, ['path']],
  ['read_file', 'Прочитать текстовый файл', { path: { type: 'string' } }, ['path']],
  ['write_file', 'Создать или перезаписать файл целиком (папки создаются автоматически)', { path: { type: 'string' }, content: { type: 'string' } }, ['path', 'content']],
  ['edit_file', 'Заменить точный фрагмент текста в файле', { path: { type: 'string' }, old: { type: 'string' }, new: { type: 'string' } }, ['path', 'old', 'new']],
  ['run_command', 'Выполнить shell-команду в рабочей директории (npm, git, python и т.д.)', { command: { type: 'string' } }, ['command']],
  ['save_memory', 'Запомнить важный факт о пользователе или проекте навсегда', { note: { type: 'string' } }, ['note']],
  ['create_skill', 'Сохранить новый навык: проверенный способ решать тип задач. Используй после успешного решения нетривиальной задачи', { name: { type: 'string' }, description: { type: 'string', description: 'Когда применять навык, одна строка' }, content: { type: 'string', description: 'Пошаговая инструкция в markdown' } }, ['name', 'description', 'content']],
  ['read_skill', 'Прочитать сохранённый навык по имени', { name: { type: 'string' } }, ['name']]
].map(([name, description, properties, required]) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } }
}));

function resolveInside(workspace, p) {
  if (!workspace) throw new Error('Рабочая папка не выбрана. Выбери её кнопкой слева.');
  const full = path.resolve(workspace, p || '.');
  if (full !== workspace && !full.startsWith(workspace + path.sep)) throw new Error('Путь выходит за пределы рабочей папки');
  return full;
}
const clip = (s, n = 20000) => (s.length > n ? s.slice(0, n) + `\n…[обрезано, всего ${s.length} символов]` : s);

// ctx: { workspace, autoApprove, confirm(text) -> Promise<boolean> }
async function run(name, args, ctx) {
  switch (name) {
    case 'list_dir': {
      const d = resolveInside(ctx.workspace, args.path);
      return fs.readdirSync(d, { withFileTypes: true }).map(e => (e.isDirectory() ? e.name + '/' : e.name)).join('\n') || '(пусто)';
    }
    case 'read_file':
      return clip(fs.readFileSync(resolveInside(ctx.workspace, args.path), 'utf8'));
    case 'write_file': {
      const f = resolveInside(ctx.workspace, args.path);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, args.content);
      return `Записано ${args.content.length} символов в ${args.path}`;
    }
    case 'edit_file': {
      const f = resolveInside(ctx.workspace, args.path);
      const txt = fs.readFileSync(f, 'utf8');
      const count = txt.split(args.old).length - 1;
      if (count !== 1) throw new Error(`Фрагмент найден ${count} раз(а), нужно ровно 1. Уточни old.`);
      fs.writeFileSync(f, txt.replace(args.old, () => args.new));
      return 'Готово';
    }
    case 'run_command': {
      if (!ctx.autoApprove && !(await ctx.confirm(args.command))) return 'Пользователь отклонил команду';
      return new Promise((resolve) => {
        exec(args.command, { cwd: ctx.workspace, timeout: 120000, maxBuffer: 4 * 1024 * 1024, shell: '/bin/zsh' }, (err, stdout, stderr) => {
          resolve(clip(`exit=${err ? err.code ?? 1 : 0}\n${stdout}${stderr ? '\n[stderr]\n' + stderr : ''}`));
        });
      });
    }
    case 'save_memory':
      store.appendMemory(args.note);
      return 'Запомнил';
    case 'create_skill':
      return `Навык сохранён: ${store.writeSkill(args.name, args.description, args.content)}`;
    case 'read_skill':
      return store.readSkill(args.name);
    default:
      throw new Error('Неизвестный инструмент ' + name);
  }
}

module.exports = { defs, run };
