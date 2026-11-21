---
name: shell-bash
description: Bash/zsh: автоматизация и работа с файлами
---

1. Скрипт начинай с `set -euo pipefail`; переменные в кавычках "$var".
2. Поиск: `grep -rn "текст" .`, `find . -name "*.js" -not -path "./node_modules/*"`.
3. Массовые операции: `for f in *.png; do ...; done`, xargs -0 с find -print0.
4. Проверка перед опасным действием: сначала `echo`/`ls`, потом выполнение.
5. Логи: `tail -f`, `| tee file.log`.
