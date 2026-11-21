---
name: react-ui
description: Создание красивого React-интерфейса (Vite + React)
---

1. `npm create vite@latest` не запускай интерактивно: создай package.json, vite.config.js, index.html, src/main.jsx вручную.
2. Один файл styles.css с CSS-переменными (--bg, --card, --accent, --text, --muted, --line). Тёмная тема по умолчанию, светлая через `prefers-color-scheme`.
3. Сетка: flex/grid, отступы кратны 4/8px, радиусы 10-16px, тонкие границы rgba(255,255,255,.08), мягкие тени.
4. Типографика: системный шрифт, 14-16px текст, заголовки 600-700, межстрочный 1.5.
5. Состояния: hover, focus-visible, disabled, loading, empty, error — реализуй все.
6. Анимации: transition .15s на интерактивных, fade+translateY(6px) при появлении, уважай prefers-reduced-motion.
7. Компоненты малыми функциями; состояние через useState/useReducer; побочные эффекты в useEffect с очисткой.
8. Проверь: `npm run build` без ошибок.
