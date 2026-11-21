---
name: minecraft-mod
description: Мод для Minecraft Java (Fabric или Forge): структура, предмет, блок, сборка
---

1. Спроси/выбери: Fabric (проще, современнее) и версию Minecraft; по умолчанию Fabric + последняя стабильная версия.
2. Структура Fabric-мода: `build.gradle`, `gradle.properties`, `settings.gradle`, `src/main/resources/fabric.mod.json`, `src/main/java/com/example/modid/ModMain.java`, ресурсы `assets/modid/{lang,models,textures}`.
3. `fabric.mod.json`: id (строчные буквы), version, entrypoints.main -> класс, depends: fabricloader, minecraft, fabric-api.
4. Регистрация: `Registry.register(Registries.ITEM, Identifier.of("modid","name"), new Item(new Item.Settings()))`; блоки — аналогично + BlockItem; вкладка — через ItemGroup.
5. Ресурсы: models/item/name.json (parent item/generated, textures layer0), lang/en_us.json с именами, текстура PNG 16x16.
6. Крафт: JSON в data/modid/recipe/*.json.
7. Сборка: `./gradlew build` -> jar в build/libs; кладётся в папку mods вместе с Fabric API.
8. Версии API меняются между релизами Minecraft — сверяйся с шаблоном fabricmc.net/develop и не выдумывай имена классов.
