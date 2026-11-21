---
name: python-script
description: Python-скрипты и CLI
---

1. Python 3.10+, type hints, `if __name__ == "__main__": main()`.
2. CLI — argparse (или typer, если уже в проекте). Явные --help.
3. Файлы — pathlib; JSON/CSV — стандартная библиотека; HTTP — requests/httpx.
4. Ошибки: конкретные except, понятные сообщения, код возврата != 0.
5. Окружение: `python3 -m venv .venv`, requirements.txt.
6. Проверка: запусти на тестовых данных и покажи вывод.
