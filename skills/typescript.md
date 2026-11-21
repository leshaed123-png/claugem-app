---
name: typescript
description: TypeScript: строгая типизация и типичные ошибки
---

1. tsconfig: strict:true, noUncheckedIndexedAccess:true.
2. Не используй any; unknown + сужение типов; union-типы вместо enum где возможно.
3. Тип данных API описывай через zod-схему и выводи тип z.infer.
4. Дженерики — только когда тип реально меняется.
5. Ошибка «possibly undefined» — проверь значение, а не ставь `!`.
6. Проверка: `npx tsc --noEmit`.
