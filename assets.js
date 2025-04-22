export const assets = {
        getAssetUrl: function(path) {
            const cleanPath = path.replace('https://github.com/koshmosh43/playable/tree/main/assets/', '');
      
            return `https://koshmosh43.github.io/playable/assets/${cleanPath}`;
    }
  };