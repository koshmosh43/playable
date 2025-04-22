// Пустой объект assets для начала работы
export const assets = {
    // Базовые URL для GitHub Pages (если нужно)
    getAssetUrl: function(path) {
      // Удаляем GitHub repository path, если он есть
      const cleanPath = path.replace('https://github.com/koshmosh43/playable/tree/main/assets/', '');
      
      // Возвращаем GitHub Pages URL
      return `https://koshmosh43.github.io/playable/assets/${cleanPath}`;
    }
  };