---
name: git-workflow
description: Git: ветки, коммиты, конфликты, откаты
---

1. Работа в ветке: `git switch -c feature/имя`; main не трогать.
2. Коммиты маленькие, сообщение в повелительном наклонении: «Add login form».
3. Перед пушем: `git status`, `git diff --staged`.
4. Конфликт: открой файл, оставь нужное между <<<<<<< ======= >>>>>>>, `git add`, `git rebase --continue`.
5. Откат: незакоммиченное `git restore файл`; последний коммит `git revert HEAD` (безопасно для общих веток).
6. Никогда `push --force` в общую ветку; `--force-with-lease` только в своей.
