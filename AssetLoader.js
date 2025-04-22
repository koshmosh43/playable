/**
 * Asset loader for the Gin Rummy game
 * Optimized for Playable Ads with CORS fixes
 */

import { assets } from './assets.js';

export class AssetLoader {
  constructor() {
    this.textureCache = {};
    this.preloadedAssets = assets || {}; // Use pre-defined assets
  }

  async loadGameAssets(progressCallback) {
    // Critical assets that must load first
    const criticalAssets = [
      { name: 'background', path: 'Backgr.webp' },
      { name: 'cardBack', path: 'CardBack_Blue.webp' },
      { name: 'hand', path: 'hand.webp' }
    ];

    // Initial card assets needed for first display
    const initialCards = [
      { name: 'A_Hearts', path: 'cards/hearts/A_Hearts.webp' },
      { name: 'K_Hearts', path: 'cards/hearts/K_Hearts.webp' },
      { name: 'A_Spades', path: 'cards/spades/A_Spades.webp' },
      { name: 'K_Spades', path: 'cards/spades/K_Spades.webp' },
      { name: 'A_Clubs', path: 'cards/clubs/A_Clubs.webp' },
      { name: 'J_Clubs', path: 'cards/clubs/J_Clubs.webp' },
      { name: 'A_Diamonds', path: 'cards/diamonds/A_Diamonds.webp' },
      { name: 'J_Diamonds', path: 'cards/diamonds/J_Diamonds.webp' }
    ];

    // Secondary assets that can load after critical ones
    const secondaryAssets = [
      { name: 'blueAvatar', path: 'blue_avatar.webp' },
      { name: 'redAvatar', path: 'red_avatar.webp' },
      { name: 'settingsButton', path: 'settingsButton.webp' },
      { name: 'newGameButton', path: 'newGameButton.webp' },
      { name: 'topBanner', path: 'TopBanner.webp' }
    ];

    let loadedCount = 0;
    const totalAssets = criticalAssets.length + initialCards.length + secondaryAssets.length;

    // Load critical assets sequentially to ensure they're available first
    for (const asset of criticalAssets) {
      await this.loadTexture(asset.path);
      loadedCount++;
      progressCallback?.(loadedCount / totalAssets);
    }

    // Load initial cards in parallel for better performance
    await Promise.all(initialCards.map(async asset => {
      await this.loadTexture(asset.path);
      loadedCount++;
      progressCallback?.(loadedCount / totalAssets);
    }));

    // Load secondary assets in parallel
    await Promise.all(secondaryAssets.map(async asset => {
      await this.loadTexture(asset.path);
      loadedCount++;
      progressCallback?.(loadedCount / totalAssets);
    }));

    return this.textureCache;
  }

  async loadTexture(path) {
    // Return cached texture if available
    if (this.textureCache[path]) {
      return this.textureCache[path];
    }

    try {
      let texture;
      let url;

      // Convert GitHub repository URLs to GitHub Pages URLs to avoid CORS issues
      if (path.startsWith('https://koshmosh43.github.io/playable/assets/')) {
        url = path.replace(
          'https://koshmosh43.github.io/playable/assets/',
          'https://koshmosh43.github.io/playable/assets/'
        );
      } 
      // Use preloaded assets if available
      else if (this.preloadedAssets[path]) {
        url = this.preloadedAssets[path];
      }
      // For relative paths, use GitHub Pages URL
      else if (!path.startsWith('http')) {
        url = `https://koshmosh43.github.io/playable/assets/${path}`;
      }
      // Keep as is if it's already a full URL
      else {
        url = path;
      }

      // Load the texture
      texture = await PIXI.Assets.load(url);
      this.textureCache[path] = texture;
      return texture;
    } catch (error) {
      console.warn(`Failed to load texture at path: ${path}`, error);
      // Create fallback texture if loading fails
      const fallbackTexture = this.createFallbackTexture(path);
      this.textureCache[path] = fallbackTexture;
      return fallbackTexture;
    }
  }

  createFallbackTexture(path) {
    console.log(`Creating fallback texture for: ${path}`);

    if (path.includes('CardBack_Blue')) return this.createCardBackFallback();
    if (path.includes('blue_avatar')) return this.createAvatarFallback(0x3366FF);
    if (path.includes('red_avatar')) return this.createAvatarFallback(0xFF3366);
    if (path.includes('hand')) return this.createHandCursorFallback();
    if (path.includes('cards/')) {
      // Extract suit and value from path
      let suit = 'spades';
      let value = 'A';
      
      const suitMatch = path.match(/hearts|diamonds|clubs|spades/);
      if (suitMatch) suit = suitMatch[0];
      
      const valueMatch = path.match(/\/(\w+)_/);
      if (valueMatch) value = valueMatch[1];
      
      return this.createCardFallback(value, suit);
    }
    if (path.includes('background')) return this.createBackgroundFallback();
    if (path.includes('ad')) return this.createAdBannerFallback();

    return PIXI.Texture.WHITE;
  }

  // [The rest of the fallback creation methods remain unchanged]
  
  createBackgroundFallback() {
    // Create simple green background for card table
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0x0B5D2E); // Green card table color
    graphics.drawRect(0, 0, 400, 600);
    graphics.endFill();
    
    // Add pattern for more realism
    graphics.lineStyle(1, 0x094823, 0.5);
    for (let i = 0; i < 20; i++) {
      graphics.moveTo(0, i * 30);
      graphics.lineTo(400, i * 30);
      graphics.moveTo(i * 30, 0);
      graphics.lineTo(i * 30, 600);
    }
    
    const renderTexture = PIXI.RenderTexture.create({ width: 400, height: 600 });
    const renderer = PIXI.autoDetectRenderer();
    renderer.render(graphics, { renderTexture });
    
    return renderTexture;
  }

  createAdBannerFallback() {
    // Simple banner for playable ad
    const graphics = new PIXI.Graphics();
    
    // Banner background
    graphics.beginFill(0x666666);
    graphics.drawRect(0, 0, 320, 80);
    graphics.endFill();
    
    // "Gin Rummy" text
    const bannerText = new PIXI.Text("Gin Rummy", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xFFFFFF,
      fontWeight: 'bold'
    });
    bannerText.anchor.set(0.5);
    bannerText.position.set(160, 40);
    graphics.addChild(bannerText);
    
    const renderTexture = PIXI.RenderTexture.create({ width: 320, height: 80 });
    const renderer = PIXI.autoDetectRenderer();
    renderer.render(graphics, { renderTexture });
    
    return renderTexture;
  }

  createCardBackFallback() {
    const graphics = new PIXI.Graphics();
    
    // Blue background with white border
    graphics.beginFill(0x0000AA);
    graphics.drawRoundedRect(0, 0, 60, 80, 5);
    graphics.endFill();
    
    graphics.lineStyle(2, 0xFFFFFF);
    graphics.drawRoundedRect(5, 5, 50, 70, 3);
    
    // Add pattern for nicer card back
    graphics.lineStyle(1, 0xFFFFFF, 0.5);
    for (let i = 0; i < 5; i++) {
      graphics.drawRoundedRect(10 + i * 5, 10 + i * 5, 40 - i * 10, 60 - i * 10, 3);
    }
    
    const renderTexture = PIXI.RenderTexture.create({ width: 60, height: 80 });
    const renderer = PIXI.autoDetectRenderer();
    renderer.render(graphics, { renderTexture });
    
    return renderTexture;
  }

  createAvatarFallback(color) {
    const graphics = new PIXI.Graphics();
    
    // Colored circle
    graphics.beginFill(color);
    graphics.drawRoundedRect(0, 0, 60, 60, 10);
    graphics.endFill();
    
    // Add simple face features
    graphics.lineStyle(2, 0xFFFFFF);
    graphics.drawCircle(20, 25, 5);  // Left eye
    graphics.drawCircle(40, 25, 5);  // Right eye
    graphics.arc(30, 40, 10, 0, Math.PI);  // Smile
    
    const renderTexture = PIXI.RenderTexture.create({ width: 60, height: 60 });
    const renderer = PIXI.autoDetectRenderer();
    renderer.render(graphics, { renderTexture });
    
    return renderTexture;
  }

  createHandCursorFallback() {
    const graphics = new PIXI.Graphics();
    
    // Skin color hand
    graphics.beginFill(0xFFCCBB);
    graphics.drawEllipse(20, 30, 15, 25);  // Palm
    graphics.drawEllipse(20, 0, 8, 20);    // Finger
    graphics.endFill();
    
    // Blue sleeve
    graphics.beginFill(0x3366CC);
    graphics.drawRoundedRect(0, 50, 40, 20, 5);
    graphics.endFill();
    
    const renderTexture = PIXI.RenderTexture.create({ width: 60, height: 80 });
    const renderer = PIXI.autoDetectRenderer();
    renderer.render(graphics, { renderTexture });
    
    return renderTexture;
  }

  createCardFallback(value, suit) {
    const graphics = new PIXI.Graphics();
    
    // White card background
    graphics.beginFill(0xFFFFFF);
    graphics.drawRoundedRect(0, 0, 60, 80, 5);
    graphics.endFill();
    
    // Determine color based on suit
    const isRed = suit === 'hearts' || suit === 'diamonds';
    const color = isRed ? 0xFF0000 : 0x000000;
    
    // Add card value
    const valueText = new PIXI.Text(value, {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: color,
      fontWeight: 'bold'
    });
    valueText.position.set(5, 5);
    graphics.addChild(valueText);
    
    // Add suit symbol
    let suitSymbol = '♠';
    if (suit === 'hearts') suitSymbol = '♥';
    else if (suit === 'diamonds') suitSymbol = '♦';
    else if (suit === 'clubs') suitSymbol = '♣';
    
    const suitText = new PIXI.Text(suitSymbol, {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: color,
      fontWeight: 'bold'
    });
    suitText.anchor.set(0.5);
    suitText.position.set(30, 40);
    graphics.addChild(suitText);
    
    // Add reversed value at bottom right
    const valueText2 = new PIXI.Text(value, {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: color,
      fontWeight: 'bold'
    });
    valueText2.anchor.set(1, 1);
    valueText2.position.set(55, 75);
    graphics.addChild(valueText2);
    
    const renderTexture = PIXI.RenderTexture.create({ width: 60, height: 80 });
    const renderer = PIXI.autoDetectRenderer();
    renderer.render(graphics, { renderTexture });
    
    return renderTexture;
  }
  
  async loadCardOnDemand(value, suit) {
    const filename = `${value}_${suit.charAt(0).toUpperCase()}${suit.slice(1)}.webp`;
    const path = `cards/${suit}/${filename}`;
    
    try {
      return await this.loadTexture(path);
    } catch (error) {
      console.warn(`Failed to load card on demand: ${path}`, error);
      return this.createCardFallback(value, suit);
    }
  }
}