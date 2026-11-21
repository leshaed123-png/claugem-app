---
name: swiftui-app
description: Нативное macOS/iOS приложение на SwiftUI
---

1. Структура: App (@main), Views, Models (struct, Codable), ViewModels (ObservableObject / @Observable).
2. Состояние: @State локально, @StateObject/@Observable для моделей, @Environment для общих.
3. Навигация: NavigationSplitView на Mac, NavigationStack на iOS.
4. Асинхронность: async/await, `Task {}`, @MainActor для UI.
5. Хранение: SwiftData или UserDefaults/Codable в JSON; секреты — Keychain.
6. Стиль: материалы `.ultraThinMaterial`, SF Symbols, системные цвета, анимации `withAnimation(.spring)`.
7. Проверка сборки: `xcodebuild -scheme X build`.
