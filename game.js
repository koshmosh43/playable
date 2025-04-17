// game.js - Main game implementation
import { AssetLoader } from './AssetLoader.js';
import { HandCursor } from './HandCursor.js';
import { GameStateManager } from './GameStateManager.js';
import { UIManager } from './UIManager.js';
import { UIRenderer } from './UIRenderer.js';
import { CardRenderer } from './CardRenderer.js';

// Initialize the game when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Register GSAP plugins
  if (window.gsap && window.PixiPlugin) {
    gsap.registerPlugin(PixiPlugin);
    PixiPlugin.registerPIXI(PIXI);
  }
  
  // Create and initialize the game
  const game = new GinRummyGame();
  game.initialize();
});

class GinRummyGame {
  constructor() {
    // Game configuration
    this.config = {
      cardWidth: 80,
      cardHeight: 120,
      targetScore: 100,
      fanDistance: 30,    // Distance between cards in fan
      fanAngle: -15,       // Maximum fan angle (degrees)
      highlightColor: 0x4CAF50
    };

    // Initial game state
    this.gameState = 'intro';
    this.gameStep = 0;
    this.playerTurn = true;
    this.deckCount = 31;
    this.hasDrawnCard = false;
    this.tutorialShown = false;
    this.deadwood = 58;
    this.playerScore = 0;
    this.opponentScore = 0;
    this.selectedCard = null;
    this.possibleMelds = [];
    this.dealCount = 0;
    this.currentMeld = null;
    this.takeCardTutorial = null;
    this.discardTutorial = null;
    this.takeCardTutorialShown = false;

    // Initialize PixiJS app with correct dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    this.app = new PIXI.Application({
      width: viewportWidth,
      height: viewportHeight,
      backgroundColor: 0x0B5D2E,
      resolution: window.devicePixelRatio || 1,
      antialias: true,
      autoDensity: true
    });

    // Core components
    this.assetLoader = new AssetLoader();
    this.cardManager = { 
      playerCards: [],
      opponentCards: [],
      discardPile: [],
      onCardClick: null,
      calculateDeadwood: this.calculateDeadwood.bind(this)
    };
    
    // Game containers 
    this.containers = {
      main: new PIXI.Container(),
      background: new PIXI.Container(),
    };
    
    // Will initialize these after assets are loaded
    this.uiRenderer = null;
    this.cardRenderer = null;
    this.handCursor = null;
    this.stateManager = null;
    this.uiManager = null;
  }

  sortCardsByValue(cards) {
    // Порядок значений карт (А низкий)
    const valueOrder = {
      'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
    };
    
    // Сортируем карты только по значению
    return [...cards].sort((a, b) => {
      return valueOrder[a.value] - valueOrder[b.value];
    });
  }

  sortCardsWithMelds() {
    // First, identify all possible melds
    this.updatePossibleMelds();
    
    // Create sets to quickly check if a card is in a meld
    const setCardIds = new Set();
    const runCardIds = new Set();
    
    if (this.possibleMelds.sets) {
      this.possibleMelds.sets.forEach(meld => {
        meld.cards.forEach(card => setCardIds.add(card.id));
      });
    }
    
    if (this.possibleMelds.runs) {
      this.possibleMelds.runs.forEach(meld => {
        meld.cards.forEach(card => runCardIds.add(card.id));
      });
    }
    
    // Make a copy of the cards to sort
    const sortedCards = [...this.cardManager.playerCards];
    
    // Custom sorting function to match the EXACT order:
    // 1. Green highlighted cards (runs) first on the left
    // 2. Yellow highlighted cards (sets) immediately after green cards
    // 3. Non-meld cards sorted by value (low to high) with highest on the right
    sortedCards.sort((a, b) => {
      const aInSet = setCardIds.has(a.id);
      const aInRun = runCardIds.has(a.id);
      const bInSet = setCardIds.has(b.id);
      const bInRun = runCardIds.has(b.id);
      
      // Put run cards (green) first
      if (aInRun && !bInRun) return -1;
      if (bInRun && !aInRun) return 1;
      
      // If both are run cards, sort by suit and value
      if (aInRun && bInRun) {
        const suitOrder = {
          'clubs': 0,
          'diamonds': 1,
          'hearts': 2,
          'spades': 3
        };
        
        const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
        if (suitDiff !== 0) return suitDiff;
        
        const valueOrder = {
          'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
          '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
        };
        return valueOrder[a.value] - valueOrder[b.value];
      }
      
      // Put set cards (yellow) immediately after run cards
      if (aInSet && !bInSet && !bInRun) return -1;
      if (bInSet && !aInSet && !aInRun) return 1;
      
      // If both are set cards, sort by value then suit
      if (aInSet && bInSet) {
        const valueOrder = {
          'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
          '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
        };
        
        const valueDiff = valueOrder[a.value] - valueOrder[b.value];
        if (valueDiff !== 0) return valueDiff;
        
        const suitOrder = {
          'clubs': 0,
          'diamonds': 1,
          'hearts': 2,
          'spades': 3
        };
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      
      // For non-meld cards, sort by VALUE (low to high)
      // This ensures highest value cards are to the right
      const valueOrder = {
        'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
        '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
      };
      
      return valueOrder[a.value] - valueOrder[b.value];
    });
    
    return sortedCards;
  }

  preDragCardFromDeck() {
  if (!this.playerTurn || this.gameStep % 2 !== 0) return null;
  
  // Pre-draw a card from the deck to show during dragging
  const newCard = this.drawCardFromDeck();
  this.preDrawnCard = newCard;
  return newCard;
}

  sortCardsBySuitAndRank(cards) {
    // Custom sort order to match the screenshot exactly
    // Cards should be: A♣, 2♣, 3♣, 10♣, 10♦, 10♥, 10♥, 2♠, 5♠, 7♠, 8♠, Q♠
    
    // Custom suit order: clubs first, then diamonds, hearts, spades
    const suitOrder = {
      'clubs': 0,
      'diamonds': 2,  // Changed from previous order
      'hearts': 1,    // Changed from previous order
      'spades': 3
    };
    
    // Card value order
    const valueOrder = {
      'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
    };
    
    return [...cards].sort((a, b) => {
      // First sort by suit
      const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
      if (suitDiff !== 0) return suitDiff;
      
      // Then sort by value within the same suit
      return valueOrder[a.value] - valueOrder[b.value];
    });
  }

  // Initialize the game
  async initialize() {
    try {
      // Add the game canvas to the DOM and set full size
      const gameContainer = document.getElementById('game-container');
      if (gameContainer) {
        gameContainer.appendChild(this.app.view);
        
        // Set canvas to fill the container
        this.app.view.style.width = '100%';
        this.app.view.style.height = '100%';
      }
      
      this.removeLoadingElement();
      
      // Set up containers
      this.setupContainers();
      
      // Load assets with error handling
      try {
        await this.loadAssets();
      } catch (error) {
        console.error('Error loading assets:', error);
        this.showErrorMessage('Error loading game assets. Please refresh.');
        return; // Exit early if we can't load critical assets
      }
      
      // Initialize core components
      this.initializeComponents();
      
      // Set up game
      await this.setupGame();
      
      // Start with intro state
      this.stateManager.changeState('intro');
      
      // Handle window resizing
      window.addEventListener('resize', () => this.resize());
      this.resize();
    } catch (error) {
      console.error('Error initializing game:', error);
      this.showErrorMessage('Failed to initialize game. Please refresh.');
    }
  }

  // Remove loading element
  removeLoadingElement() {
    const el = document.getElementById('loading');
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  // Set up game containers
  setupContainers() {
    // Enable z-index sorting
    this.containers.main.sortableChildren = true;
    this.app.stage.addChild(this.containers.main);
    
    // Background layer
    this.containers.background.zIndex = 0;
    this.containers.main.addChild(this.containers.background);
  }

  // Initialize core components
  initializeComponents() {
    // Create UI and card renderers
    this.uiRenderer   = new UIRenderer(this.app, this.assetLoader, this.config);
    this.cardRenderer = new CardRenderer(this.app, this.assetLoader, this.config);
  
    // Add this line right after creating the cardRenderer
    this.cardRenderer.setDeckDragCallback(this.preDragCardFromDeck.bind(this));
  
    /* --- порядок слоёв ---
      uiRenderer  z‑index 100  (TopBanner, реклама, кнопки и т.д.)
      cardRenderer z‑index  10 (все карты, анимации)
    */
    this.uiRenderer.container.zIndex   = 20;
    this.cardRenderer.container.zIndex = 10;
  
    // Create hand cursor for tutorials
    this.handCursor = new HandCursor(this.app, this.assetLoader);
    
    // Create state manager and UI manager
    this.stateManager = new GameStateManager(this, { 
      uiRenderer: this.uiRenderer, 
      cardRenderer: this.cardRenderer 
    });
    
    this.uiManager = new UIManager(this.app);
  }

  // Load game assets
  async loadAssets() {
    // Show loading screen
    this.showLoadingScreen();
    
    try {
      // Load assets with progress tracking
      await this.assetLoader.loadGameAssets(progress => {
        this.updateLoadingProgress(progress);
      });
      
      // Hide loading screen when done
      this.hideLoadingScreen();
    } catch (error) {
      // If loading fails, hide loading screen and propagate error
      this.hideLoadingScreen();
      throw error;
    }
  }

  // Set up the game
  async setupGame() {
    // Add renderers to main container
    this.containers.main.addChild(this.uiRenderer.container);
    this.containers.main.addChild(this.cardRenderer.container);
    
    // Важное добавление: добавляем avatarsContainer напрямую в main контейнер
    // с низким zIndex, чтобы он был ниже, чем у карт
    this.containers.main.addChild(this.uiRenderer.avatarsContainer);
    
    // Set up background
    await this.setupBackground();
    
    // Set up UI
    await this.uiRenderer.setupUI();
    
    // Set up screens
    await this.setupScreens();
    
    // Initialize game data
    this.initializeGameData();
    
    // Set up event handlers
    this.setupEventHandlers();
}

  // Set up background
  // Updated setupBackground method to center-crop the background image
// Complete replacement for setupBackground method with iPhone SE specific adjustments
async setupBackground() {
  try {
    // Try to load the specified background image first
    const bgTexture = await this.assetLoader.loadTexture('assets/Backgr.webp');
    
    // Create a background sprite that maintains aspect ratio
    const bgSprite = new PIXI.Sprite(bgTexture);
    
    // Calculate the scaling to cover the entire screen while maintaining aspect ratio
    const scaleX = this.app.screen.width / bgTexture.width;
    const scaleY = this.app.screen.height / bgTexture.height;
    const scale = Math.max(scaleX, scaleY); // Use the larger scale to ensure covering
    
    // Apply the calculated scale
    bgSprite.scale.set(scale, scale);
    
    // Center the sprite horizontally
    bgSprite.x = (this.app.screen.width - bgSprite.width) / 2;
    
    // Get device information for very specific adjustments
    const height = this.app.screen.height;
    const width = this.app.screen.width;
    const aspectRatio = width / height;
    
    // Special case for iPhone SE and very small screens
    // iPhone SE has height around 568px and an aspect ratio close to 0.56
    if (height <= 568) {
      // Apply a much larger shift for iPhone SE
      bgSprite.y = (this.app.screen.height - bgSprite.height) / 2 + 180; // Much larger shift down
      console.log("Applied iPhone SE specific positioning");
    }
    // Other small screens
    else if (height < 670) {
      // Intermediate adjustment for small screens
      const cardHeight = this.config.cardHeight || 120;
      bgSprite.y = (this.app.screen.height - bgSprite.height) / 2 + cardHeight;
      console.log("Applied small screen positioning");
    } 
    else {
      // Regular vertical centering for normal screens
      bgSprite.y = (this.app.screen.height - bgSprite.height) / 2;
      console.log("Applied standard positioning");
    }
    
    this.containers.background.removeChildren();
    this.containers.background.addChild(bgSprite);
  } catch (err) {
    console.warn("Using fallback background");
    try {
      // Try the webp version as a second option
      const webpTexture = await this.assetLoader.loadTexture('assets/background.webp');
      
      // Create background sprite with center-crop approach
      const webpSprite = new PIXI.Sprite(webpTexture);
      
      // Calculate the scaling to cover the entire screen while maintaining aspect ratio
      const scaleX = this.app.screen.width / webpTexture.width;
      const scaleY = this.app.screen.height / webpTexture.height;
      const scale = Math.max(scaleX, scaleY); // Use the larger scale to ensure covering
      
      // Apply the calculated scale
      webpSprite.scale.set(scale, scale);
      
      // Center the sprite horizontally
      webpSprite.x = (this.app.screen.width - webpSprite.width) / 2;
      
      // Get device information for very specific adjustments
      const height = this.app.screen.height;
      const width = this.app.screen.width;
      const aspectRatio = width / height;
      
      // Special case for iPhone SE and very small screens
      // iPhone SE has height around 568px and an aspect ratio close to 0.56
      if (height <= 568) {
        // Apply a much larger shift for iPhone SE
        webpSprite.y = (this.app.screen.height - webpSprite.height) / 2 + 180; // Much larger shift down
        console.log("Applied iPhone SE specific positioning (webp)");
      }
      // Other small screens
      else if (height < 670) {
        // Intermediate adjustment for small screens
        const cardHeight = this.config.cardHeight || 120;
        webpSprite.y = (this.app.screen.height - webpSprite.height) / 2 + cardHeight;
        console.log("Applied small screen positioning (webp)");
      } 
      else {
        // Regular vertical centering for normal screens
        webpSprite.y = (this.app.screen.height - webpSprite.height) / 2;
        console.log("Applied standard positioning (webp)");
      }
      
      this.containers.background.removeChildren();
      this.containers.background.addChild(webpSprite);
    } catch (err2) {
      // Create a fallback background if texture loading fails
      const fallbackBg = new PIXI.Graphics();
      fallbackBg.beginFill(0x0B5D2E); // Green table color
      fallbackBg.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
      fallbackBg.endFill();
      
      this.containers.background.removeChildren();
      this.containers.background.addChild(fallbackBg);
    }
  }
}

  // Set up game screens
  async setupScreens() {
    // Set up intro screen
    this.setupIntroScreen();
    
    // Set up dealing screen
    this.setupDealingScreen();
    
    // Set up end screen
    this.setupEndScreen();
  }

  // Set up intro screen
  // Updated setupIntroScreen method to use center-cropping for background
// Updated setupIntroScreen method to use center-cropping for background
setupIntroScreen() {
  const introContainer = new PIXI.Container();
  
  // Загрузка фона
  this.assetLoader.loadTexture('assets/Backgr.webp')
    .then(bgTexture => {
      // Create background sprite with center-crop approach
      const bgSprite = new PIXI.Sprite(bgTexture);
      
      // Calculate the scaling to cover the entire screen while maintaining aspect ratio
      const scaleX = this.app.screen.width / bgTexture.width;
      const scaleY = this.app.screen.height / bgTexture.height;
      const scale = Math.max(scaleX, scaleY); // Use the larger scale to ensure covering
      
      // Apply the calculated scale
      bgSprite.scale.set(scale, scale);
      
      // Center the sprite horizontally
      bgSprite.x = (this.app.screen.width - bgSprite.width) / 2;
      
      // Special positioning for height on small screens like iPhone SE
      const isSmallScreen = this.app.screen.height < 570; // Approximate iPhone SE height threshold
      
      if (isSmallScreen) {
        // Shift down by the height of a card to show better portion of background
        const cardHeight = this.config.cardHeight || 120;
        bgSprite.y = (this.app.screen.height - bgSprite.height) / 2 + cardHeight;
      } else {
        // Regular vertical centering for normal screens
        bgSprite.y = (this.app.screen.height - bgSprite.height) / 2;
      }
      
      introContainer.addChild(bgSprite);
      
      // После загрузки фона загружаем остальные элементы обучения
      this.setupTutorialElements(introContainer);
    })
    .catch(err => {
      console.warn("Could not load background for intro screen", err);
      
      // Запасной фон
      const fallbackBg = new PIXI.Graphics();
      fallbackBg.beginFill(0x0B5D2E);
      fallbackBg.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
      fallbackBg.endFill();
      introContainer.addChild(fallbackBg);
      
      // Загрузка элементов обучения даже при ошибке фона
      this.setupTutorialElements(introContainer);
    });
  
  introContainer.visible = false;
  this.app.stage.addChild(introContainer);
  this.introContainer = introContainer;
}

// Полностью переработанная функция setupTutorialElements в game.js
setupTutorialElements(introContainer) {
  // Enable z-index sorting for the intro container
  introContainer.sortableChildren = true;
  
  // Determine font size based on screen width
  const fontSize = this.app.screen.width < 500 ? 40 : 48;
  
  // Title "Make Set or Run!"
  const titleText = new PIXI.Text("Make SET or RUN!", {
    fontFamily: "Arial",
    fontSize: fontSize,
    fill: 0xFFFFFF,
    fontWeight: 'bold',
    stroke: 0x000000,
    strokeThickness: 3,
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowDistance: 4
  });
  titleText.anchor.set(0.5);
  titleText.position.set(this.app.screen.width / 2, 100);
  titleText.zIndex = 20;  // Set a higher z-index for text
  introContainer.addChild(titleText);
  
  // Card dimensions
  const cardWidth = this.config.cardWidth || 80;
  const cardHeight = this.config.cardHeight || 120;
  const spacing = 50; // Spacing between cards
  
  // Create the main container for all cards
  const cardsContainer = new PIXI.Container();
  cardsContainer.x = this.app.screen.width / 2 - 180; // Center the cards
  cardsContainer.y = 350; // Position vertically
  cardsContainer.zIndex = 10;  // Set z-index for cards
  introContainer.addChild(cardsContainer);

  // Create deck with multiple cards and lower z-index
  const deckContainer = new PIXI.Container();
  // Position the deck slightly to the left as requested
  deckContainer.x = cardsContainer.x + 380 - cardWidth;
  deckContainer.y = cardsContainer.y + 10;
  deckContainer.scale.set(0.9); // Scale down the deck
  // Set lower z-index for the deck to appear behind the cards
  deckContainer.zIndex = 5;  // Lower value to ensure it's behind cards
  introContainer.addChild(deckContainer);

  // Create a stack of 4 cards to represent the deck
  const createDeckStack = () => {
    // Try to load the card back texture
    this.assetLoader.loadTexture('assets/CardBack_Blue.webp')
      .then(texture => {
        // Create 4 cards with slight offset for stack effect
        for (let i = 0; i < 4; i++) {
          const deckCard = new PIXI.Sprite(texture);
          deckCard.width = cardWidth;
          deckCard.height = cardHeight;
          // Small offset for each card to create stack effect
          deckCard.x = -i * 2;
          deckCard.y = -i * 2;
          // Add slight rotation to each card for a natural look
          deckCard.rotation = (Math.random() * 0.04) - 0.02;
          deckContainer.addChild(deckCard);
        }
      })
      .catch(err => {
        // Fallback: create 4 cards with graphics
        console.warn("Could not load card back texture", err);
        
        // Create multiple cards with slight offsets
        for (let i = 0; i < 4; i++) {
          const fallbackDeck = new PIXI.Graphics();
          fallbackDeck.beginFill(0x0000AA);
          fallbackDeck.drawRoundedRect(0, 0, cardWidth, cardHeight, 5);
          fallbackDeck.endFill();
          fallbackDeck.lineStyle(2, 0xFFFFFF);
          fallbackDeck.drawRoundedRect(5, 5, cardWidth - 10, cardHeight - 10, 3);
          
          // Add pattern to card back
          fallbackDeck.lineStyle(1, 0xFFFFFF, 0.5);
          for (let j = 0; j < 5; j++) {
            fallbackDeck.drawRoundedRect(
              15 + j * 5, 
              15 + j * 5, 
              cardWidth - 30 - j * 10, 
              cardHeight - 30 - j * 10, 
              3
            );
          }
          
          // Small offset for each card to create stack effect
          fallbackDeck.x = -i * 2;
          fallbackDeck.y = -i * 2;
          // Add slight rotation to each card for a natural look
          fallbackDeck.rotation = (Math.random() * 0.04) - 0.02;
          
          deckContainer.addChild(fallbackDeck);
        }
      });
  };

  // Create the card stack
  createDeckStack();
  
  // Add instructions text
  const instructionText = new PIXI.Text("Tap cards to play!", {
    fontFamily: "Arial",
    fontSize: 32,
    fill: 0xFFFFFF,
    fontWeight: 'bold',
    stroke: 0x000000,
    strokeThickness: 3,
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowDistance: 2
  });
  instructionText.anchor.set(0.5);
  instructionText.position.set(this.app.screen.width / 2, this.app.screen.height - 100);
  instructionText.zIndex = 20;  // Higher z-index for text
  introContainer.addChild(instructionText);
  
  // Create container for the card row - this will handle proper z-index
  const cardRowContainer = new PIXI.Container();
  cardRowContainer.sortableChildren = true; // Enable sorting by zIndex
  cardsContainer.addChild(cardRowContainer);
  
  // Set up card data for both layouts
  const baseCards = [
    { value: '4', suit: 'spades', position: 0 },
    { value: '6', suit: 'spades', position: 2 },
    { value: '7', suit: 'spades', position: 3 },
    { value: '5', suit: 'hearts', position: 4 },
    { value: '5', suit: 'diamonds', position: 5 }
  ];
  
  // Movable card (5 of spades)
  const movableCard = { value: '5', suit: 'spades' };
  
  // Create a card-holding hand cursor
  const createHandCursor = () => {
    const handContainer = new PIXI.Container();
    handContainer.zIndex = 300; // High z-index to be above everything
    
    // Rest of the hand cursor implementation...
    // Try to load the hand image
    this.assetLoader.loadTexture('assets/hand.webp')
      .then(texture => {
        const handSprite = new PIXI.Sprite(texture);
        handSprite.anchor.set(-0.1, -0.1);
        handSprite.scale.set(0.7);
        handContainer.addChild(handSprite);
      })
      .catch(err => {
        // Create fallback hand graphic
        console.warn("Could not load hand texture", err);
        const handGraphics = new PIXI.Graphics();
        
        // Draw hand in skin tone
        handGraphics.beginFill(0xFFCCBB);
        handGraphics.drawEllipse(20, 30, 15, 25);  // Palm
        handGraphics.drawEllipse(20, 0, 8, 20);    // Finger
        handGraphics.endFill();
        
        // Blue sleeve
        handGraphics.beginFill(0x3366CC);
        handGraphics.drawRoundedRect(0, 50, 40, 20, 5);
        handGraphics.endFill();
        
        handContainer.addChild(handGraphics);
      });
    
    // Position hand under the movable card initially
    handContainer.x = cardsContainer.x + spacing * 1;
    handContainer.y = cardsContainer.y + cardHeight/2;
    handContainer.visible = true;
    
    introContainer.addChild(handContainer);
    return handContainer;
  };
  
  // Create sprites for base cards
  const cardSprites = [];
  
  // Load base card sprites and set up highlights and animations
  Promise.all(baseCards.map(card => {
    const cardPath = `assets/cards/${card.suit}/${card.value}_${card.suit.charAt(0).toUpperCase()}${card.suit.slice(1)}.webp`;
    return this.assetLoader.loadTexture(cardPath)
      .then(texture => {
        const sprite = new PIXI.Sprite(texture);
        sprite.width = cardWidth;
        sprite.height = cardHeight;
        sprite.cardData = card;
        return sprite;
      })
      .catch(err => {
        console.warn(`Could not load card texture for ${card.value} of ${card.suit}`, err);
        return this.createFallbackCard(card);
      });
  }))
  .then(sprites => {
    // Store all base card sprites
    cardSprites.push(...sprites);
    
    // Now create the movable 5♠ card
    const cardPath = `assets/cards/${movableCard.suit}/${movableCard.value}_${movableCard.suit.charAt(0).toUpperCase()}${movableCard.suit.slice(1)}.webp`;
    return this.assetLoader.loadTexture(cardPath)
      .then(texture => {
        const movingCard = new PIXI.Sprite(texture);
        movingCard.width = cardWidth;
        movingCard.height = cardHeight;
        movingCard.cardData = movableCard;
        
        // Создание текста "RUN!" над зелеными картами
        const runText = new PIXI.Text("RUN!", {
          fontFamily: "Arial",
          fontSize: 40,
          fontWeight: "bold",
          fill: 0xFFF8C9, // Кремово-желтый цвет
          stroke: 0x8B4513, // Коричневая обводка
          strokeThickness: 6,
          dropShadow: true,
          dropShadowColor: 0x000000,
          dropShadowDistance: 4
        });
        runText.anchor.set(0.5);
        runText.x = spacing; // Центр 2-й слева карты
        runText.y = -100; // 100 пикселей выше верха карт
        runText.alpha = 1;
        runText.visible = true;
        cardRowContainer.addChild(runText);

        // Создание текста "SET!" над желтыми картами
        const setText = new PIXI.Text("SET!", {
          fontFamily: "Arial",
          fontSize: 40,
          fontWeight: "bold",
          fill: 0xFFF8C9, // Кремово-желтый цвет
          stroke: 0x8B4513, // Коричневая обводка
          strokeThickness: 6,
          dropShadow: true,
          dropShadowColor: 0x000000,
          dropShadowDistance: 4
        });
        setText.anchor.set(0.5);
        setText.x = spacing * 4; // Центр предпоследней карты
        setText.y = -100; // 100 пикселей выше верха карт
        setText.alpha = 0;
        setText.visible = true;
        cardRowContainer.addChild(setText);

        // Создание фильтров для подсветки карт
        const runColorMatrix = new PIXI.filters.ColorMatrixFilter();
        runColorMatrix.tint(0x98FB98, 0.7); // Зеленый оттенок для RUN

        const setColorMatrix = new PIXI.filters.ColorMatrixFilter();
        setColorMatrix.tint(0xFFFE7A, 0.7); // Желтый оттенок для SET
        
        // Create "SET!" and "RUN!" indicators
        const runIndicator = new PIXI.Text("RUN!", {
          fontFamily: "Arial",
          fontSize: 72,
          fontWeight: "bold",
          fill: 0x98FB98,
          stroke: 0x000000,
          strokeThickness: 8,
          dropShadow: true,
          dropShadowColor: 0x000000,
          dropShadowDistance: 4
        });
        runIndicator.anchor.set(0.5);
        runIndicator.position.set(this.app.screen.width / 2, 600);
        runIndicator.alpha = 0;
        introContainer.addChild(runIndicator);
        
        const setIndicator = new PIXI.Text("SET!", {
          fontFamily: "Arial",
          fontSize: 72,
          fontWeight: "bold",
          fill: 0xFFFF00,
          stroke: 0x000000,
          strokeThickness: 8,
          dropShadow: true,
          dropShadowColor: 0x000000,
          dropShadowDistance: 4
        });
        setIndicator.anchor.set(0.5);
        setIndicator.position.set(this.app.screen.width / 2, 600);
        setIndicator.alpha = 0;
        introContainer.addChild(setIndicator);
        
        // Create hand cursor directly in this function
        const handCursor = createHandCursor();
        
        const updateCardZIndices = () => {
          let order = [];
          
          if (showingRun) {
              // Режим "RUN" - карты могут перекрываться в особом порядке
              order = [
                  { card: baseCards[0], zIndex: 0 },  // 4♠ (самая нижняя)
                  { card: baseCards[1], zIndex: 2 },  // 6♠ (над 5♠)
                  { card: movableCard, zIndex: 1 },   // 5♠ (между 4♠ и 6♠)
                  { card: baseCards[2], zIndex: 3 },  // 7♠
                  { card: baseCards[3], zIndex: 4 },  // 5♥
                  { card: baseCards[4], zIndex: 5 }   // 5♦ (самая верхняя)
              ];
          } else {
              // Режим "SET" - последовательные z-индексы без переплетения
              order = [
                  { card: baseCards[0], zIndex: 0 },  // 4♠
                  { card: baseCards[1], zIndex: 1 },  // 6♠
                  { card: baseCards[2], zIndex: 2 },  // 7♠
                  { card: baseCards[3], zIndex: 3 },  // 5♥
                  { card: movableCard, zIndex: 4 },   // 5♠
                  { card: baseCards[4], zIndex: 5 }   // 5♦
              ];
          }
          
          // Находим все карты в контейнере
          const allCards = cardRowContainer.children.filter(child => child.cardData);
          
          // Применяем z-индексы к соответствующим картам
          allCards.forEach(sprite => {
              const match = order.find(item => 
                  item.card.value === sprite.cardData.value && 
                  item.card.suit === sprite.cardData.suit
              );
              
              // Устанавливаем z-индекс, если карта найдена в порядке
              if (match) {
                  sprite.zIndex = match.zIndex;
              }
          });
          
          // Сортируем дочерние элементы контейнера по z-индексу
          cardRowContainer.sortChildren();
        };

        // Функция подсветки карт для комбинации RUN
        const highlightRunCards = () => {
          // Сначала сбрасываем все подсветки
          cardSprites.forEach(sprite => {
            sprite.filters = null;
          });
          movingCard.filters = null;
          
          // Применяем зеленую подсветку к картам RUN (4♠, 5♠, 6♠)
          cardSprites[0].filters = [runColorMatrix]; // 4♠
          movingCard.filters = [runColorMatrix];     // 5♠
          cardSprites[1].filters = [runColorMatrix]; // 6♠
          
          // Обновляем z-индексы карт
          updateCardZIndices();
        };

        // Функция подсветки карт для комбинации SET
        const highlightSetCards = () => {
          // Сначала сбрасываем все подсветки
          cardSprites.forEach(sprite => {
            sprite.filters = null;
          });
          movingCard.filters = null;
          
          // Применяем желтую подсветку к картам SET (три пятерки)
          cardSprites[3].filters = [setColorMatrix]; // 5♥
          movingCard.filters = [setColorMatrix];     // 5♠
          cardSprites[4].filters = [setColorMatrix]; // 5♦
          
          // Обновляем z-индексы карт
          updateCardZIndices();
        };

        /* Расстановка карт веером с обновлением позиций и z‑индексов */
        const arrangeCardsInFan = () => {
          // Параметры для эффекта веера
          const fanAngle = 4;        // угол наклона между картами (в градусах)
          const verticalOffset = 15; // вертикальное смещение
          
          if (showingRun) {
            // Раскладка RUN: порядок должен быть – 4♠, 5♠, 6♠, 7♠, 5♥, 5♦
            // Карты базового набора (baseCards) и движущаяся карта (movableCard) располагаются сразу в финальные позиции
            cardSprites[0].x = spacing * 0;
            cardSprites[0].y = -verticalOffset * 0;
            cardSprites[0].rotation = (-fanAngle * 2) * Math.PI / 180;
            
            // 6♠
            cardSprites[1].x = spacing * 2;
            cardSprites[1].y = -verticalOffset * 2;
            cardSprites[1].rotation = 0;
            
            // 7♠
            cardSprites[2].x = spacing * 3;
            cardSprites[2].y = -verticalOffset * 3;
            cardSprites[2].rotation = (fanAngle) * Math.PI / 180;
            
            // 5♥ – эта карта должна сразу оказаться между 7♠ и 5♦
            cardSprites[3].x = spacing * 4;
            cardSprites[3].y = -verticalOffset * 4;
            cardSprites[3].rotation = (fanAngle * 2) * Math.PI / 180;
            
            // 5♦
            cardSprites[4].x = spacing * 5;
            cardSprites[4].y = -verticalOffset * 5;
            cardSprites[4].rotation = (fanAngle * 3) * Math.PI / 180;
            
            // Движущаяся карта (например, 5♠) позиционируется отдельно.
            // Если она участвует только в RUN‑раскладке, её позиция задаётся так,
            // чтобы не заказывать (перекрывать) другую карту.
            movingCard.x = spacing * 1;
            movingCard.y = -verticalOffset * 1;
            movingCard.rotation = (-fanAngle) * Math.PI / 180;
            
          } else {
            // Раскладка SET: порядок должен быть – 4♠, 6♠, 7♠, 5♥, 5♠, 5♦
            cardSprites[0].x = spacing * 0;
            cardSprites[0].y = -verticalOffset * 0;
            cardSprites[0].rotation = (-fanAngle * 2) * Math.PI / 180;
            
            cardSprites[1].x = spacing * 1;
            cardSprites[1].y = -verticalOffset * 1;
            cardSprites[1].rotation = (-fanAngle) * Math.PI / 180;
            
            cardSprites[2].x = spacing * 2;
            cardSprites[2].y = -verticalOffset * 2;
            cardSprites[2].rotation = 0;
            
            cardSprites[3].x = spacing * 3;
            cardSprites[3].y = -verticalOffset * 3;
            cardSprites[3].rotation = (fanAngle) * Math.PI / 180;
            
            cardSprites[4].x = spacing * 5;
            cardSprites[4].y = -verticalOffset * 5;
            cardSprites[4].rotation = (fanAngle * 3) * Math.PI / 180;
            
            movingCard.x = spacing * 4;
            movingCard.y = -verticalOffset * 4;
            movingCard.rotation = (fanAngle * 2) * Math.PI / 180;
          }
          
          // После того как все карты сразу установили свои координаты, обновляем их z‑индексы
          updateCardZIndices();
        };
        
        // Set up animation states
        let showingRun = true; // Start with RUN
        let isFirstRun = true; // Flag for first run animation
        
        // Function to show RUN layout with synchronized card and hand animations
        const showRunLayout = () => {
          // For RUN: 4♠, 5♠, 6♠, 7♠, 5♥, 5♦
          
          // Create a synchronized timeline for all animations
          const timeline = gsap.timeline({
            onComplete: updateCardZIndices
          });
          
          // If this is first animation, don't move down first - just position cards correctly
          if (isFirstRun) {
            isFirstRun = false;
            
            // Position cards correctly for RUN layout
            cardSprites.forEach((sprite, index) => {
              const pos = baseCards[index].position;
              sprite.x = pos * spacing;
              sprite.y = 0;
              cardRowContainer.addChild(sprite);
            });
            
            // Position moving card at position 1 for RUN layout
            movingCard.x = spacing * 1;
            movingCard.y = 0;
            cardRowContainer.addChild(movingCard);
            
            // Set initial z-indices for RUN layout
            movingCard.zIndex = 1;  // 5♠ (between 4♠ and 6♠)
            cardSprites[0].zIndex = 0;  // 4♠ (lowest)
            cardSprites[1].zIndex = 2;  // 6♠ (above 5♠)
            cardSprites[2].zIndex = 3;  // 7♠
            cardSprites[3].zIndex = 4;  // 5♥
            cardSprites[4].zIndex = 5;  // 5♦ (highest)
            cardRowContainer.sortChildren();
            
            // Position hand cursor under the card
            handCursor.x = cardsContainer.x + spacing * 1;
            handCursor.y = cardsContainer.y + cardHeight/2;
            
            // Применяем подсветку к картам RUN
            highlightRunCards();

            // Настраиваем текст
            runText.x = spacing; // Центр 2-й слева карты
            runText.visible = true;
            runText.alpha = 1;
            setText.visible = false;
            setText.alpha = 0;
            
            // Show RUN indicator
            gsap.timeline()
              .to(runIndicator, {
                alpha: 1,
                scale: 1.2,
                duration: 0.3
              })
              .to(runIndicator, {
                scale: 1,
                duration: 0.2
              })
              .to(runIndicator, {
                alpha: 0,
                duration: 0.3,
                delay: 0.8
              });
          } 
          else {
            // For subsequent animations, move from SET to RUN layout
            // First, synchronously move card and hand down together
            timeline.to([movingCard, handCursor], {
              y: (i, target) => i === 0 ? cardHeight + 30 : cardsContainer.y + cardHeight + 30,
              duration: 0.5,
              ease: "power2.out"
            });
            
            // Move other cards to their RUN positions
            timeline.to([
              cardSprites[1], // 6♠ to position 2
              cardSprites[2], // 7♠ to position 3
              cardSprites[3], // 5♥ to position 4
              cardSprites[4]  // 5♦ to position 5
            ], {
              stagger: 0.05,
              x: (i, target) => spacing * (2 + i),
              duration: 0.4,
              ease: "power2.inOut"
            }, "-=0.3");
            
            // Move card and hand horizontally to position 1
            timeline.to([movingCard, handCursor], {
              x: (i, target) => i === 0 ? spacing * 1 : cardsContainer.x + spacing * 1,
              duration: 0.4,
              ease: "power2.inOut",
              onUpdate: function() {
                // Check if we're halfway through the horizontal movement animation
                if (this.progress() >= 0.5 && movingCard.zIndex !== 1) {
                  // Change z-index for RUN layout halfway through the animation
                  movingCard.zIndex = 1;  // 5♠ (between 4♠ and 6♠)
                  cardSprites[0].zIndex = 0;  // 4♠ (lowest)
                  cardSprites[1].zIndex = 2;  // 6♠ (above 5♠)
                  cardSprites[2].zIndex = 3;  // 7♠
                  cardSprites[3].zIndex = 4;  // 5♥
                  cardSprites[4].zIndex = 5;  // 5♦ (highest)
                  cardRowContainer.sortChildren();
                }
              }
            });
            
            // Move card and hand back up together
            timeline.to([movingCard, handCursor], {
              y: (i, target) => i === 0 ? 0 : cardsContainer.y + cardHeight/2,
              duration: 0.3,
              ease: "power2.out"
            });
            
            // Анимация скрытия текста SET
            timeline.to(setText, {
              alpha: 0,
              duration: 0.3,
              onComplete: () => {
                setText.visible = false;
                
                // Применяем подсветку карт RUN
                highlightRunCards();
              }
            }, "-=0.4");

            // Анимация появления текста RUN
            timeline.to(runText, {
              alpha: 1,
              duration: 0.3,
              onStart: () => {
                runText.visible = true;
                runText.alpha = 0;
                runText.x = spacing; // Центр 2-й слева карты
              }
            }, "-=0.3");
            
            // Show RUN indicator
            timeline.add(() => {
              runIndicator.visible = true;
              runIndicator.alpha = 0;
              runIndicator.scale.set(0.8);
              
              gsap.timeline()
                .to(runIndicator, {
                  alpha: 1,
                  scale: 1.2,
                  duration: 0.3
                })
                .to(runIndicator, {
                  scale: 1,
                  duration: 0.2
                })
                .to(runIndicator, {
                  alpha: 0,
                  duration: 0.3,
                  delay: 0.8
                });
            }, "-=0.3");
          }
        };
        
        // Function to show SET layout with synchronized card and hand animations
        const showSetLayout = () => {
          // For SET: 4♠, 6♠, 7♠, 5♥, 5♠, 5♦
          
          // Create a synchronized timeline for all animations
          const timeline = gsap.timeline({
            onComplete: updateCardZIndices
          });
          
          // Move card and hand down together
          timeline.to([movingCard, handCursor], {
            y: (i, target) => i === 0 ? cardHeight + 30 : cardsContainer.y + cardHeight + 30,
            duration: 0.5,
            ease: "power2.out"
          });
          
          // Move other cards to their SET positions
          timeline.to([
            cardSprites[1], // 6♠ to position 1
            cardSprites[2], // 7♠ to position 2
            cardSprites[3]  // 5♥ to position 3
          ], {
            stagger: 0.05,
            x: (i, target) => spacing * (1 + i),
            duration: 0.4,
            ease: "power2.inOut"
          }, "-=0.3");
          
          // 5♦ to position 5
          timeline.to(cardSprites[4], {
            x: spacing * 5,
            duration: 0.4,
            ease: "power2.inOut"
          }, "-=0.4");
          
          // Move card and hand horizontally to position 4
          timeline.to([movingCard, handCursor], {
            x: (i, target) => i === 0 ? spacing * 4 : cardsContainer.x + spacing * 4,
            duration: 0.4,
            ease: "power2.inOut",
            onUpdate: function() {
              // Check if we're halfway through the horizontal movement animation
              if (this.progress() >= 0.5 && movingCard.zIndex !== 4) {
                // Change z-index for SET layout halfway through the animation
                movingCard.zIndex = 4;  // 5♠ (above 5♥, below 5♦)
                cardSprites[0].zIndex = 0;
                cardSprites[0].zIndex = 0;  // 4♠
                cardSprites[1].zIndex = 1;  // 6♠
                cardSprites[2].zIndex = 2;  // 7♠
                cardSprites[3].zIndex = 3;  // 5♥
                cardSprites[4].zIndex = 5;  // 5♦
                cardRowContainer.sortChildren();
              }
            }
          });
          
          // Move card and hand back up together
          timeline.to([movingCard, handCursor], {
            y: (i, target) => i === 0 ? 0 : cardsContainer.y + cardHeight/2,
            duration: 0.3,
            ease: "power2.out"
          });
          
          // Анимация скрытия текста RUN
          timeline.to(runText, {
            alpha: 0,
            duration: 0.3,
            onComplete: () => {
              runText.visible = false;
              
              // Применяем подсветку карт SET
              highlightSetCards();
            }
          }, "-=0.4");

          // Анимация появления текста SET
          timeline.to(setText, {
            alpha: 1,
            duration: 0.3,
            onStart: () => {
              setText.visible = true;
              setText.alpha = 0;
              setText.x = spacing * 4; // Центр предпоследней карты
            }
          }, "-=0.3");
          
          // Show SET indicator
          timeline.add(() => {
            setIndicator.visible = true;
            setIndicator.alpha = 0;
            setIndicator.scale.set(0.8);
            
            gsap.timeline()
              .to(setIndicator, {
                alpha: 1,
                scale: 1.2,
                duration: 0.3
              })
              .to(setIndicator, {
                scale: 1,
                duration: 0.2
              })
              .to(setIndicator, {
                alpha: 0,
                duration: 0.3,
                delay: 0.8
              });
          }, "-=0.3");
        };
        
        // Show initial RUN layout without animation
        showRunLayout();
        
        // Start alternating between layouts with slight delay for the first transition
        setTimeout(() => {
          // Start alternating animations
          let animationIntervalId = setInterval(() => {
            showingRun = !showingRun;
            if (showingRun) {
              showRunLayout();
            } else {
              showSetLayout();
            }
          }, 4000);
          
          // Store interval ID for cleanup if needed
          this.tutorialAnimationInterval = animationIntervalId;
        }, 1500);
        
        // Make everything interactive
        [cardsContainer, deckContainer].forEach(container => {
          container.interactive = true;
          container.buttonMode = true;
          container.on('pointerdown', () => {
            // Clear the animation interval when starting the game
            if (this.tutorialAnimationInterval) {
              clearInterval(this.tutorialAnimationInterval);
              this.tutorialAnimationInterval = null;
            }
            this.startGame();
          });
        });
      })
      .catch(err => {
        console.error('Failed to load movable card:', err);
      });
  })
  .catch(err => {
    console.error('Error setting up tutorial cards:', err);
  });
}
  
  // Helper method to create a fallback card
  createFallbackCard(cardData) {
    const cardWidth = this.config.cardWidth || 80;
    const cardHeight = this.config.cardHeight || 120;
    
    const graphics = new PIXI.Graphics();
    
    // White card background
    graphics.beginFill(0xFFFFFF);
    graphics.drawRoundedRect(0, 0, cardWidth, cardHeight, 5);
    graphics.endFill();
    
    // Determine color based on suit
    const isRed = cardData.suit === 'hearts' || cardData.suit === 'diamonds';
    const color = isRed ? 0xFF0000 : 0x000000;
    
    // Add card value at top left
    const valueText = new PIXI.Text(cardData.value, {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: color,
      fontWeight: 'bold'
    });
    valueText.position.set(5, 5);
    graphics.addChild(valueText);
    
    // Add suit symbol in center
    let suitSymbol = '♠';
    if (cardData.suit === 'hearts') suitSymbol = '♥';
    else if (cardData.suit === 'diamonds') suitSymbol = '♦';
    else if (cardData.suit === 'clubs') suitSymbol = '♣';
    
    const suitText = new PIXI.Text(suitSymbol, {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: color,
      fontWeight: 'bold'
    });
    suitText.anchor.set(0.5);
    suitText.position.set(cardWidth / 2, cardHeight / 2);
    graphics.addChild(suitText);
    
    // Add reversed value at bottom right
    const valueText2 = new PIXI.Text(cardData.value, {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: color,
      fontWeight: 'bold'
    });
    valueText2.anchor.set(1, 1);
    valueText2.position.set(cardWidth - 5, cardHeight - 5);
    graphics.addChild(valueText2);
    
    return graphics;
  }
  
  
  // Helper method for intro screen content
  setupIntroScreenContent(introContainer) {
    
    // Title text - "Make Set or Run!" to match screenshots
    const introText = new PIXI.Text("Make Set or Run!", {
      fontFamily: "Arial",
      fontSize: 48,
      fill: 0xFFFFFF,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 5,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 3
    });
    introText.anchor.set(0.5);
    introText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
    introContainer.addChild(introText);
    
    // Start button
    this.assetLoader.loadTexture('assets/newGameButton.webp')
      .then(texture => {
        const startButton = new PIXI.Sprite(texture);
        startButton.anchor.set(0.5);
        startButton.x = this.app.screen.width / 2;
        startButton.y = this.app.screen.height / 2 + 100;
        startButton.interactive = true;
        startButton.buttonMode = true;
        startButton.on('pointerdown', () => {
          this.startGame();
        });
        introContainer.addChild(startButton);
      })
      .catch(err => {
        console.warn("Could not load button for intro screen", err);
        // Create fallback button
        const fallbackButton = new PIXI.Graphics();
        fallbackButton.beginFill(0x4CAF50);
        fallbackButton.drawRoundedRect(0, 0, 150, 50, 10);
        fallbackButton.endFill();
        
        const buttonText = new PIXI.Text("Start Game", {
          fontFamily: "Arial",
          fontSize: 20,
          fill: 0xFFFFFF
        });
        buttonText.anchor.set(0.5);
        buttonText.position.set(75, 25);
        
        fallbackButton.addChild(buttonText);
        fallbackButton.position.set(this.app.screen.width / 2 - 75, this.app.screen.height / 2 + 80);
        fallbackButton.interactive = true;
        fallbackButton.buttonMode = true;
        fallbackButton.on('pointerdown', () => {
          this.startGame();
        });
        
        introContainer.addChild(fallbackButton);
      });
  }

  // Set up dealing screen
  setupDealingScreen() {
    const dealingContainer = new PIXI.Container();
    dealingContainer.visible = false;
    this.app.stage.addChild(dealingContainer);
    this.dealingContainer = dealingContainer;
  }

  // Set up end screen
  setupEndScreen() {
    const endContainer = new PIXI.Container();
    
    // Dark overlay
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.8);
    overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    overlay.endFill();
    endContainer.addChild(overlay);
    
    // End text
    const endText = new PIXI.Text("Game Over", {
      fontFamily: "Arial",
      fontSize: 36,
      fill: 0xFFFFFF,
      fontWeight: 'bold'
    });
    endText.anchor.set(0.5);
    endText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 50);
    endContainer.addChild(endText);
    
    // Install button
    this.assetLoader.loadTexture('assets/newGameButton.webp')
      .then(texture => {
        const installButton = new PIXI.Sprite(texture);
        installButton.anchor.set(0.5);
        installButton.x = this.app.screen.width / 2;
        installButton.y = this.app.screen.height / 2 + 50;
        installButton.interactive = true;
        installButton.buttonMode = true;
        installButton.on('pointerdown', () => {
          this.handleInstall();
        });
        endContainer.addChild(installButton);
      })
      .catch(err => {
        console.warn("Could not load button for end screen", err);
        // Create fallback button
        const fallbackButton = new PIXI.Graphics();
        fallbackButton.beginFill(0x4CAF50);
        fallbackButton.drawRoundedRect(0, 0, 150, 50, 10);
        fallbackButton.endFill();
        
        const buttonText = new PIXI.Text("Install App", {
          fontFamily: "Arial",
          fontSize: 20,
          fill: 0xFFFFFF
        });
        buttonText.anchor.set(0.5);
        buttonText.position.set(75, 25);
        
        fallbackButton.addChild(buttonText);
        fallbackButton.position.set(this.app.screen.width / 2 - 75, this.app.screen.height / 2 + 50);
        fallbackButton.interactive = true;
        fallbackButton.buttonMode = true;
        fallbackButton.on('pointerdown', () => {
          this.handleInstall();
        });
        
        endContainer.addChild(fallbackButton);
      });
    
    endContainer.visible = false;
    this.app.stage.addChild(endContainer);
    this.endContainer = endContainer;
  }

  // Update to showTutorial method to make text disappear on interaction
  showTutorial() {
    if (!this.handCursor || !this.cardRenderer || !this.playerTurn) return;
    
    // ДОБАВЛЕНО: не показываем туториал если deadwood <= 10 или у оппонента нет карт
    if (this.deadwood <= 10 || this.cardManager.opponentCards.length === 0) return;
    
    // Позиция колоды
    const deckPosition = {
      x: this.cardRenderer.deckContainer.x + this.config.cardWidth / 2,
      y: this.cardRenderer.deckContainer.y + this.config.cardHeight / 2
    };
    
    const discardPosition = this.cardManager.discardPile.length > 0 ? {
      x: this.cardRenderer.discardContainer.x + this.config.cardWidth / 2,
      y: this.cardRenderer.discardContainer.y + this.config.cardHeight / 2
    } : null;
    
    // Создаем контейнер для элементов туториала
    const titleContainer = new PIXI.Container();
    titleContainer.zIndex = 200;

    titleContainer.interactive = false;
titleContainer.interactiveChildren = false;
    
    // Создаем фон
    const gradientBg = new PIXI.Graphics();
    const bgWidth = this.app.screen.width;
    const bgHeight = 120;
    const bgY = this.app.screen.height * 0.35 - bgHeight/2;
    
    gradientBg.beginFill(0x000000, 0.5);
    gradientBg.drawRect(0, bgY, bgWidth, bgHeight);
    gradientBg.endFill();
    
    titleContainer.addChild(gradientBg);
    
    // Создаем текст подсказки
    const style = {
      fontFamily: "Arial",
      fontSize: this.app.screen.width < 500 ? 36 : 42,
      fontWeight: "bold",
      fill: 0xFFFFFF,
      align: "center",
      stroke: 0x000000,
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 2,
      dropShadowDistance: 2
    };
    
    const titleText = new PIXI.Text("Take a card: Deck or\nshown card", style);
    titleText.anchor.set(0.5);
    titleText.x = this.app.screen.width / 2;
    titleText.y = this.app.screen.height * 0.35;
    
    titleContainer.addChild(titleText);
    this.app.stage.addChild(titleContainer);
    
    // Сохраняем ссылку на туториал
    this.tutorialTitleContainer = titleContainer;
    
    // Вместо вызова startHandAnimation, который не существует,
    // вызываем анимацию руки с использованием handCursor напрямую:
    if (this.handCursor) {
      // Если есть сброс, указываем на сброс и колоду попеременно
      if (discardPosition) {
        // Показываем анимацию руки между колодой и сбросом
        this.handCursor.moveBetween(
          deckPosition.x, deckPosition.y,
          discardPosition.x, discardPosition.y,
          { 
            cycles: 2,
            pauseDuration: 1,
            moveDuration: 1.5,
            onComplete: () => {
              this.handCursor.fade();
            }
          }
        );
      } else {
        // Если нет сброса, просто показываем руку, тапающую по колоде
        this.handCursor.tap(deckPosition.x, deckPosition.y, {
          repeat: 2,
          onComplete: () => {
            this.handCursor.fade();
          }
        });
      }
    }
  }

  // Initialize game data
  initializeGameData() {
    this.cardManager.playerCards = [];
    this.cardManager.opponentCards = [];
    this.cardManager.discardPile = [];
  }

  // Handle Gin action
  handleGin() {
    if (!this.playerTurn || this.deadwood !== 0) return;
    
    
    // Показываем оверлей с логотипом
    if (this.uiRenderer) {
      this.uiRenderer.showPlayNowOverlay();
    }
  
  // Show confirmation dialog
  if (this.uiManager) {
    this.uiManager.createDialog('Gin Confirmation', 'Do you want to call Gin?', 'gin');
  }
}

// Handle Gin confirmation
handleGinConfirm(confirmed) {
  if (confirmed) {
    // Calculate bonus points (25 is standard bonus for Gin)
    const ginBonus = 25;
    
    // Add bonus to player's score
    this.playerScore += ginBonus;
    
    // Show success message
    this.showTooltip(`Gin! Perfect hand with no deadwood. +${ginBonus} bonus points!`, null);
    
    // Check if game should end
    if (this.dealCount < 2) {
      // Move to next deal
      setTimeout(() => {
        this.initializeGame();
        this.startGame();
        this.dealCount++;
      }, 2500);
    } else {
      // End game after 3 deals
      if (this.stateManager) {
        setTimeout(() => {
          this.stateManager.changeState('end');
          this.updateEndScreen(this.playerScore);
        }, 2500);
      }
    }
  }
}

  // Set up event handlers
  // Set up event handlers
setupEventHandlers() {
  // Card click handler
  this.cardRenderer.setCardClickHandler((card, source) => this.handleCardClick(card, source));

  // Dialog confirmation handler
  this.uiManager.onDialogConfirm = (type, confirmed) => {
    if (type === 'knock') this.handleKnockConfirm(confirmed);
    else if (type === 'meld') this.handleMeldConfirm(confirmed);
    else if (type === 'gin') this.handleGinConfirm(confirmed);
  };
  
  // Action button handlers
  this.uiRenderer.onKnockClick = () => this.handleKnock();
  this.uiRenderer.onMeldClick = () => this.handleMeld();
  this.uiRenderer.onGinClick = () => this.handleGin();
  
  // ДОБАВИТЬ ОБРАБОТЧИКИ DRAG-AND-DROP ЗДЕСЬ
  // Setup drag and drop event listeners
  document.addEventListener('cardDragStart', (event) => {
    // Можно добавить логику для начала перетаскивания
    console.log('Card drag started:', event.detail.cardData);
  });

  // Setup drag and drop event listeners
  document.addEventListener('cardDragStart', (event) => {
    // Можно добавить логику для начала перетаскивания
    console.log('Card drag started:', event.detail.cardData);
  });

  document.addEventListener('cardDragEnd', (event) => {
    const { cardData, targetArea, position } = event.detail;
    
    // Если карта брошена на отбой и это допустимое игровое действие
    if (targetArea === 'discard' && this.playerTurn && this.gameStep % 2 === 1) {
      // Обработка сброса карты
      this.selectedCard = cardData;
      console.log('Card dropped on discard:', cardData);
      
      // Check if the card is in a meld
      const meldResult = this.isCardInMeld(cardData);
      if (meldResult) {
        // Ask for confirmation before breaking a meld
        this.showMeldBreakConfirmation(meldResult.meld);
        return;
      }
      
      // Установим флаг, что карта была перетащена
      this.wasDragged = true;
      
      // IMPORTANT: Make sure we're not rendering the card twice
      // by clearing the player hand container before updating
      if (this.cardRenderer) {
        this.cardRenderer.playerHandContainer.removeChildren();
      }
      
      // Process the discard
      this.handleDiscard();
    } else {
      // Если не на отбой, просто возвращаем карту
      console.log('Card dropped elsewhere, returning to hand');
    }
  });
  
  // ДОБАВЬТЕ ОБРАБОТЧИКИ ДЛЯ ВЗЯТИЯ КАРТ ИЗ КОЛОДЫ И СБРОСА
  
  // Обработчик драг-энд-дроп для колоды
  document.addEventListener('deckDrag', (event) => {
    // Если это этап взятия карты
    if (this.playerTurn && this.gameStep % 2 === 0) {
      console.log('Deck card dragged and dropped');
      this.handleDrawFromDeck();
    }
  });
  
  // Обработчик драг-энд-дроп для сброса
  document.addEventListener('discardDrag', (event) => {
    const cardData = event.detail?.cardData;
    // Если это этап взятия карты
    if (this.playerTurn && this.gameStep % 2 === 0 && cardData) {
      console.log('Discard card dragged and dropped');
      this.handleDrawFromDiscard(cardData);
    }
  });
  // Обработчик начала перетаскивания карты из колоды/отбоя
document.addEventListener('cardDragStarted', (event) => {
  const { cardData, source } = event.detail;
  console.log(`Card drag started from ${source}:`, cardData);
});
// Обработчик отпускания перетаскиваемой карты
document.addEventListener('cardDragReleased', (event) => {
  const { cardData, source, targetArea } = event.detail;
  console.log(`Card drag released from ${source} to ${targetArea}:`, cardData);
  
  // Здесь пока ничего не делаем - основная логика в cardAddedToHand
});

// Обработчик успешного добавления карты в руку
document.addEventListener('cardAddedToHand', (event) => {
  const { cardData, source } = event.detail;
  console.log(`Card added to hand from ${source}:`, cardData);
  
  // Handle adding the card based on its source
  if (source === 'deck') {
    // Check if we have a pre-drawn card from dragging
    if (this.preDrawnCard) {
      // Use the pre-drawn card instead of drawing a new one
      this.cardManager.playerCards.push(this.preDrawnCard);
      
      // Sort cards with melds
      this.cardManager.playerCards = this.sortCardsWithMelds();
      
      // Decrease deck count
      this.deckCount--;
      this.gameStep++;
      
      // Set flag that player has drawn a card
      this.hasDrawnCard = true;
      
      // Clear the pre-drawn card reference
      this.preDrawnCard = null;
      
      // Update the game display
      this.updatePlayScreen();
      
      // Wait for animation to complete before showing discard hint
      setTimeout(() => {
        this.showDiscardHint();
      }, 800);
    } else {
      // Fall back to regular method if no pre-drawn card exists
      this.handleDrawFromDeck();
    }
  } else if (source === 'discard') {
    this.handleDrawFromDiscard(cardData);
  }
});
}

  // Start the game
  startGame() {
    console.log('Starting game...');

    if (this.handCursor && this.handCursor.container) {
      this.handCursor.container.visible = false;
    }
  
    if (this.makeMeldText) {
      this.makeMeldText.visible = false;
    }
  
    const prepareAndDeal = () => {
      this.stateManager.changeState('dealing');
  
      // Полностью очищаем текущие карты перед раздачей!
      this.cardManager.playerCards = [];
      this.cardManager.opponentCards = [];
  
      // Отображаем пустые руки перед началом анимации раздачи карт
      this.cardRenderer.updateDisplay({
        playerCards: [],
        opponentCards: [],
        deckCount: this.deckCount,
        discardPile: []
      });
  
      // Инициализируем карты для раздачи (но НЕ отображаем их сразу)
      this.initializeCards();
  
      // Начинаем анимированную раздачу
      this.dealAllCards(() => {
        console.log('Done dealing!');
        this.stateManager.changeState('play');
        this.initializeGame();
  
        if (!this.tutorialShown) {
          setTimeout(() => {
            try {
              if (this.stateManager?.currentState === 'play') {
                this.handleTutorials();
              }
            } catch (err) {
              console.warn("Tutorial error:", err);
              this.tutorialShown = true;
            }
          }, 1000);
        }
      });
    };
  
    if (this.introContainer) {
      gsap.to(this.introContainer, {
        alpha: 0,
        duration: 0.5,
        ease: "power2.in",
        onComplete: () => {
          this.introContainer.visible = false;
          prepareAndDeal();
        }
      });
    } else {
      prepareAndDeal();
    }
  }
  

  // Initialize the cards
  initializeCards() {
    // Clear existing cards first
    this.cardManager.playerCards = [];
    this.cardManager.opponentCards = [];
    this.cardManager.discardPile = [];
    
    // Create exactly the player hand from the screenshots
    // A♣, 2♣, 3♣, 2♦, 5♠, 7♠, 8♠, 10♠, 10♦, Q♠
    const playerCardsData = [
      { value: 'A', suit: 'clubs' },
      { value: '2', suit: 'clubs' },
      { value: '3', suit: 'clubs' },
      { value: '2', suit: 'diamonds' },
      { value: '5', suit: 'clubs' },
      { value: '7', suit: 'spades' },
      { value: '8', suit: 'clubs' },
      { value: '10', suit: 'clubs' },
      { value: '10', suit: 'diamonds' },
      { value: 'Q', suit: 'clubs' }
    ];
    
    // Add id and filename to player cards
    this.cardManager.playerCards = playerCardsData.map((card, index) => ({
      ...card,
      id: index + 1,
      faceDown: false,
      filename: `${card.value}_${card.suit.charAt(0).toUpperCase()}${card.suit.slice(1)}.webp`
    }));
    
    // Create a full standard deck of 52 cards for remaining cards
    const fullDeck = this.createShuffledDeck();
    
    // Remove cards that are already dealt to player
    const usedCardKeys = new Set(this.cardManager.playerCards.map(card => `${card.value}_${card.suit}`));
    const remainingDeck = fullDeck.filter(card => 
      !usedCardKeys.has(`${card.value}_${card.suit}`)
    );
    
    // Pick a card for the initial discard pile
    let initialDiscardCard = null;
    
    // Look for 10 of hearts for discard pile
    const tenOfHeartsIndex = remainingDeck.findIndex(
      card => card.value === '10' && card.suit === 'hearts'
    );
    
    if (tenOfHeartsIndex !== -1) {
      initialDiscardCard = remainingDeck.splice(tenOfHeartsIndex, 1)[0];
    } else {
      // Fallback to a random card
      initialDiscardCard = remainingDeck.splice(0, 1)[0];
    }
    
    // Deal 10 random cards to opponent
    this.cardManager.opponentCards = remainingDeck.splice(0, 10).map((card, index) => ({
      ...card,
      id: 100 + index,
      faceDown: true
    }));
    
    // Set up initial discard card
    this.cardManager.discardPile = [{ 
      ...initialDiscardCard,
      id: 200,
      faceDown: false
    }];
    
    // Save remainder of deck for step-by-step dealing
    this.preparedDeck = remainingDeck;
    this.deckCount = remainingDeck.length;
    this._idCounter = 300;
    
    console.log("Cards initialized:", {
      player: this.cardManager.playerCards.length,
      opponent: this.cardManager.opponentCards.length,
      discard: this.cardManager.discardPile.length,
      deck: this.deckCount
    });
  }

  prepareOpponentCards(remainingDeck, configType) {
    const opponentCards = [];
    
    if (configType === 1) {
      // For screenshot 1, opponent will need to eventually discard 10♥
      // Find or create a specific set of opponent cards
      // To match the screenshot, we need to make sure 10♥ appears in their hand
      
      // First, extract and remove the 10♥ from remainingDeck if it exists
      const tenOfHeartsIndex = remainingDeck.findIndex(
        card => card.value === '10' && card.suit === 'hearts'
      );
      
      if (tenOfHeartsIndex !== -1) {
        const tenOfHearts = remainingDeck.splice(tenOfHeartsIndex, 1)[0];
        opponentCards.push({
          ...tenOfHearts,
          id: 100,
          faceDown: true
        });
      }
    } else {
      // For screenshot 2, opponent will need to eventually discard 7♣
      // Find or create specific cards for opponent
      
      // First, extract and remove the 7♣ from remainingDeck if it exists
      const sevenOfClubsIndex = remainingDeck.findIndex(
        card => card.value === '7' && card.suit === 'clubs'
      );
      
      if (sevenOfClubsIndex !== -1) {
        const sevenOfClubs = remainingDeck.splice(sevenOfClubsIndex, 1)[0];
        opponentCards.push({
          ...sevenOfClubs,
          id: 100,
          faceDown: true
        });
      }
    }
    
    // Add more random cards to opponent's hand to reach 10 total
    while (opponentCards.length < 10 && remainingDeck.length > 0) {
      const card = remainingDeck.splice(0, 1)[0];
      opponentCards.push({
        ...card,
        id: 101 + opponentCards.length,
        faceDown: true
      });
    }
    
    return opponentCards;
  }

  createShuffledDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    // Create a full deck of 52 cards
    const deck = [];
    
    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          value: value,
          suit: suit,
          filename: `${value}_${suit.charAt(0).toUpperCase()}${suit.slice(1)}.webp`
        });
      }
    }
    
    // Shuffle the deck using Fisher-Yates algorithm
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  }

  dealAllCards(onComplete) {
    // НЕ очищаем карты здесь! они уже инициализированы ранее.
    
    // Сохраняем карты, подготовленные в initializeCards()
    const originalPlayerCards = [...this.cardManager.playerCards];
    const originalOpponentCards = [...this.cardManager.opponentCards];
    
    // Но очистим визуальное отображение (руки должны быть пустыми перед анимацией)
    this.cardRenderer.playerHandContainer.removeChildren();
    this.cardRenderer.opponentHandContainer.removeChildren();
    
    // ВАЖНО: очищаем текущие карты, но не трогаем оригиналы (чтобы не было дублей)
    this.cardManager.playerCards = [];
    this.cardManager.opponentCards = [];
    
    const sequence = [];
    let playerIndex = 0;
    let opponentIndex = 0;
    
    while (playerIndex < originalPlayerCards.length || opponentIndex < originalOpponentCards.length) {
      if (playerIndex < originalPlayerCards.length) {
        sequence.push({ 
          target: 'player', 
          card: originalPlayerCards[playerIndex], 
          index: playerIndex 
        });
        playerIndex++;
      }
      if (opponentIndex < originalOpponentCards.length) {
        sequence.push({ 
          target: 'opponent', 
          card: originalOpponentCards[opponentIndex], 
          index: opponentIndex 
        });
        opponentIndex++;
      }
    }
    
    let sequenceIndex = 0;
    let dealingInProgress = true;
    
    // ДОБАВЛЕНО: Флаг, который показывает было ли прервано
    let wasInterrupted = false;
    
    // ДОБАВЛЕНО: Функция для мгновенной раздачи оставшихся карт
    const finishDealingImmediately = () => {
      // Отмечаем, что раздача была прервана
      wasInterrupted = true;
      
      // Раздаем все оставшиеся карты сразу без анимации
      while (sequenceIndex < sequence.length) {
        const { target, card, index } = sequence[sequenceIndex++];
        
        if (target === 'player') {
          this.cardManager.playerCards.push(card);
        } else {
          this.cardManager.opponentCards.push(card);
        }
      }
      
      // Обновляем отображение карт без анимации
      this.updatePlayScreen();
      
      // Завершаем раздачу
      dealingInProgress = false;
      if (onComplete) onComplete();
      
      // Удаляем обработчик клика
      this.app.stage.off('pointerdown', skipDealingHandler);
    };
    
    // ДОБАВЛЕНО: Обработчик клика для пропуска анимации
    const skipDealingHandler = () => {
      if (dealingInProgress) {
        console.log("Skipping dealing animation...");
        finishDealingImmediately();
      }
    };
    
    // ДОБАВЛЕНО: Добавляем обработчик клика на глобальный контейнер
    this.app.stage.interactive = true;
    this.app.stage.on('pointerdown', skipDealingHandler);
    
    const dealNext = () => {
      // Если раздача была прервана, просто выходим из функции
      if (wasInterrupted) return;
      
      if (sequenceIndex >= sequence.length) {
        // Удаляем обработчик клика, когда раздача завершена
        this.app.stage.off('pointerdown', skipDealingHandler);
        dealingInProgress = false;
        
        if (onComplete) onComplete();
        return;
      }
      
      const { target, card, index } = sequence[sequenceIndex++];
      
      if (target === 'player') {
        this.cardManager.playerCards.push(card);
      } else {
        this.cardManager.opponentCards.push(card);
      }
      
      // Анимируем раздачу карты
      this.cardRenderer.animateDealingCard(card, target, index, () => {
        setTimeout(dealNext, 150);
      });
    };
    
    // Начинаем раздачу карт
    dealNext();
  }
  

updateGamePositions() {
  // Get screen dimensions
  const width = this.app.screen.width;
  const height = this.app.screen.height;
  
  // Calculate positions based on screenshot proportions
  
  // Position of deck and discard pile
  const tableCenterY = height * 0.4;
  
  // Deck on the right side
  if (this.cardRenderer) {
    this.cardRenderer.deckContainer.x = width * 0.55;
    this.cardRenderer.deckContainer.y = tableCenterY;
    
    // Discard pile slightly to the left of the center
    this.cardRenderer.discardContainer.x = width * 0.45;
    this.cardRenderer.discardContainer.y = tableCenterY;
    
    // Player hand at the bottom
    this.cardRenderer.playerHandContainer.x = width / 2;
    this.cardRenderer.playerHandContainer.y = height * 0.75;
    
    // Opponent hand at the top
    this.cardRenderer.opponentHandContainer.x = width / 2;
    this.cardRenderer.opponentHandContainer.y = height * 0.25;
  }
  
  // Update the positions for our custom elements
  if (this.handCursor) {
    this.handCursor.container.x = width / 2;
    this.handCursor.container.y = height / 2;
  }
}
  
  
  // маленький помощник, чтобы брать карту из заранее подготовленной колоды
  drawFromPreparedDeck(faceDown = false) {
    const card = this.preparedDeck.shift();  // preparedDeck сформирован в initializeCards
    return { ...card, id: ++this._idCounter, faceDown };
  }

  // Initialize game state
  initializeGame() {
    console.log('Initializing game state');
    this.initializeGSAP();
      
    // Reset game state
    this.playerTurn = true;
    this.selectedCard = null;
    this.deadwood = 58;
    this.gameStep = 0;
    this.deckCount = 31;
    this.hasDrawnCard = false;

    // Отключаем drag-and-drop в начале игры - когда игрок еще не взял карту
  if (this.cardRenderer) {
    this.cardRenderer.enableDragging(false);
  }
  
  // Явно сбрасываем флаги туториала с каждой инициализацией
  this.tutorialShown = false;
    
    // Update displays - we'll call this right after card initialization
    this.updatePlayScreen();
    
    // Setup or update the "Make Set or Run!" text
    if (!this.makeMeldText) {
      this.setupMakeMeldText();
    }
    this.makeMeldText.visible = false; // Всегда скрываем текст
    
    // Update displays - we'll call this right after card initialization
    this.updatePlayScreen();
    
    // During dealing animation, skip heavy calculations
    if (this.stateManager?.currentState !== 'dealing') {
      this.updatePossibleMelds();
    }
      
    // Position cards properly
    if (this.cardRenderer) {
      this.cardRenderer.updatePositions(
        this.uiRenderer?.adHeight || 0,
        this.uiRenderer?.navHeight || 0,
        this.app.screen.width,
        this.app.screen.height
      );
    }
  }

  initializeGSAP() {
    // Проверяем наличие необходимых глобальных объектов
    if (window.gsap && window.PixiPlugin && window.PIXI) {
      // Регистрируем PixiPlugin для работы с PIXI.js
      gsap.registerPlugin(PixiPlugin);
      PixiPlugin.registerPIXI(PIXI);
      
      // Важно: добавляем плагин для 3D трансформаций
      if (window.gsap.config) {
        gsap.config({
          nullTargetWarn: false
        });
      }
      
      // Регистрируем плагин для 3D-вращений, если он доступен
      if (window.CSSPlugin) {
        console.log("CSSPlugin registered successfully");
      }
      
      console.log("GSAP plugins registered successfully");
    } else {
      console.warn("GSAP or PixiPlugin not available, animations may not work correctly");
    }
  }

  // Update possible melds
  updatePossibleMelds() {
    if (!this.cardManager.playerCards || this.cardManager.playerCards.length < 3) {
      this.possibleMelds = { sets: [], runs: [] };
      return;
    }
    
    // Find sets (3+ cards with same value)
    const valueGroups = {};
    this.cardManager.playerCards.forEach(card => {
      if (!valueGroups[card.value]) valueGroups[card.value] = [];
      valueGroups[card.value].push(card);
    });
    
    const possibleSets = [];
    for (const [value, cards] of Object.entries(valueGroups)) {
      if (cards.length >= 3) {
        possibleSets.push({ type: 'set', cards });
      }
    }
    
    // Find runs (sequences of 3+ consecutive cards in the same suit)
    const suitGroups = {};
    this.cardManager.playerCards.forEach(card => {
      if (!suitGroups[card.suit]) suitGroups[card.suit] = [];
      suitGroups[card.suit].push(card);
    });
    
    const valueOrder = {
      'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
    };
    
    const possibleRuns = [];
    for (const [suit, cards] of Object.entries(suitGroups)) {
      if (cards.length < 3) continue;
      
      // Sort cards by value
      const sortedCards = [...cards].sort((a, b) => valueOrder[a.value] - valueOrder[b.value]);
      
      // Find consecutive sequences
      let run = [sortedCards[0]];
      for (let i = 1; i < sortedCards.length; i++) {
        const prevValue = valueOrder[sortedCards[i-1].value];
        const currValue = valueOrder[sortedCards[i].value];
        
        if (currValue === prevValue + 1) {
          run.push(sortedCards[i]);
        } else {
          if (run.length >= 3) {
            possibleRuns.push({ type: 'run', cards: [...run] });
          }
          run = [sortedCards[i]];
        }
      }
      
      if (run.length >= 3) {
        possibleRuns.push({ type: 'run', cards: [...run] });
      }
    }
    
    this.possibleMelds = {
      sets: possibleSets,
      runs: possibleRuns
    };
    
    return this.possibleMelds;
  }

  // Update play screen
  updatePlayScreen() {
    // Обновляем возможные мелды и расчет deadwood
    this.updatePossibleMelds();
    this.deadwood = this.calculateDeadwood();
    
    // Обновляем UI (счет, deadwood и т.д.)
    if (this.uiRenderer) {
      this.uiRenderer.updateScores(this.playerScore, this.opponentScore);
      this.uiRenderer.updateDeadwood(this.deadwood);

      // IMPORTANT: Clear containers before updating to prevent duplicates
  if (this.cardRenderer) {
    this.cardRenderer.playerHandContainer.removeChildren();
    this.cardRenderer.opponentHandContainer.removeChildren();
    this.cardRenderer.discardContainer.removeChildren();
    this.cardRenderer.deckContainer.removeChildren();
  }

      // Управление drag-and-drop в зависимости от состояния игры
  if (this.cardRenderer) {
    // Включаем drag-and-drop только когда ход игрока
    // или когда игрок должен выбрать карту из колоды/сброса или сбросить карту
    const enableDrag = this.playerTurn;
    this.cardRenderer.enableDragging(enableDrag);
  }
      
      // Проверяем, показывать ли кнопки GIN и KNOCK
      const isPlayerTurn = this.playerTurn;
      const isDiscardPhase = this.gameStep % 2 === 1; // Фаза сброса - нечетный шаг
      const isPlayState = this.stateManager?.currentState === 'play';
      
      console.log("Deadwood:", this.deadwood, "Player turn:", isPlayerTurn, 
                  "Discard phase:", isDiscardPhase, "Play state:", isPlayState);
      
      // Показываем кнопку Gin когда deadwood = 0 и это ход игрока 
      // И мы находимся в игровом состоянии (независимо от фазы)
      if (this.deadwood === 0 && isPlayerTurn && isPlayState) {
        console.log("Showing GIN button!");
        this.uiRenderer.showGinButton(true);
      } else {
        this.uiRenderer.showGinButton(false);
      }
      
      // ИЗМЕНЕНО: Показываем кнопку Knock когда 0 < deadwood <= 10, ход игрока 
      // И мы находимся в игровом состоянии (независимо от фазы)
      if (this.deadwood > 0 && this.deadwood <= 10 && isPlayState) {
        console.log("Showing KNOCK button!");
        this.uiRenderer.showKnockButton(true);
      } else {
        this.uiRenderer.showKnockButton(false);
      }
    }
    
    // Обновляем отображение карт
    if (this.cardRenderer) {
      this.cardRenderer.updateDisplay({
        playerCards: this.cardManager.playerCards || [],
        opponentCards: this.cardManager.opponentCards || [],
        discardPile: this.cardManager.discardPile || [],
        deckCount: this.deckCount,
        selectedCard: this.selectedCard,
        possibleMelds: this.possibleMelds,
        playerTurn: this.playerTurn
      });
    }
    // Если у оппонента закончились карты, показываем оверлей
    if (this.cardManager.opponentCards.length === 0) {
      this.uiRenderer.showPlayNowOverlay();
    }
    // ДОБАВЛЕНО: Проверяем условия для скрытия туториала
    // Если у оппонента закончились карты или deadwood <= 10, скрываем подсказку
    if ((this.cardManager.opponentCards.length === 0 || this.deadwood <= 10) && this.tutorialTitleContainer) {
      // Скрываем туториал и удаляем его со сцены
      this.hideTutorialElements();
      
      
    }
  }
  
// Calculate deadwood value
calculateDeadwood() {
  // Начальное логирование для отладки
  console.log("Starting deadwood calculation...");
  
  if (!this.cardManager.playerCards || !this.possibleMelds) {
    console.log("No player cards or possible melds, deadwood = 0");
    return 0;
  }
  
  // Логируем количество карт в руке
  console.log(`Player has ${this.cardManager.playerCards.length} cards`);
  
  // Собираем ID карт, которые уже в мелдах
  const meldCardIds = new Set();
  
  // Проверяем формат possibleMelds и собираем ID карт в мелдах
  if (this.possibleMelds.sets && this.possibleMelds.runs) {
    // Собираем ID карт из сетов
    this.possibleMelds.sets.forEach(meld => {
      console.log(`Found SET meld with ${meld.cards.length} cards`);
      meld.cards.forEach(card => meldCardIds.add(card.id));
    });
    
    // Собираем ID карт из ранов
    this.possibleMelds.runs.forEach(meld => {
      console.log(`Found RUN meld with ${meld.cards.length} cards`);
      meld.cards.forEach(card => meldCardIds.add(card.id));
    });
  } 
  // Для совместимости со старым форматом
  else if (Array.isArray(this.possibleMelds)) {
    console.log("Using legacy meld format");
    this.possibleMelds.forEach(meld => {
      meld.forEach(card => meldCardIds.add(card.id));
    });
  }
  
  // Логируем количество карт в мелдах
  console.log(`Found ${meldCardIds.size} cards in melds`);
  
  // Считаем очки только для карт, которые НЕ входят в мелды
  const deadwoodCards = this.cardManager.playerCards.filter(card => !meldCardIds.has(card.id));
  console.log(`${deadwoodCards.length} cards not in melds (deadwood)`);
  
  // Подсчет суммы очков для свободных карт
  const deadwoodValue = deadwoodCards.reduce((sum, card) => {
    let cardValue = 0;
    
    // Иначе считаем очки по правилам:
    // Туз (A) = 1, картинки (J,Q,K) = 10, остальные = номинал
    if (card.value === 'A') {
      cardValue = 1;
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      cardValue = 10;
    } else {
      cardValue = parseInt(card.value) || 0;
    }
    
    console.log(`Card ${card.value} ${card.suit} = ${cardValue} points`);
    return sum + cardValue;
  }, 0);
  
  console.log(`Total deadwood value: ${deadwoodValue}`);
  return deadwoodValue;
}

  setupMakeMeldText() {
    // Create a container for the text and background
    const textContainer = new PIXI.Container();
    textContainer.zIndex = 100; // Ensure it's above most elements
    
    // Create gradient background
    const gradientBg = new PIXI.Graphics();
    
    // Full screen width 
    const bgWidth = this.app.screen.width;
    // Height for the text band
    const bgHeight = 90;
    
    // Position background vertically where the text will be
    const bgY = this.app.screen.height * 0.2 - bgHeight/2;
    
    // Create horizontal gradient background
    gradientBg.beginFill(0x000000, 0); // Start with transparent
    gradientBg.drawRect(0, bgY, bgWidth * 0.2, bgHeight); // Left transparent portion
    gradientBg.endFill();
    
    gradientBg.beginFill(0x000000, 0.5); // Black with 0.5 opacity (middle)
    gradientBg.drawRect(bgWidth * 0.2, bgY, bgWidth * 0.6, bgHeight); // Middle section with opacity
    gradientBg.endFill();
    
    gradientBg.beginFill(0x000000, 0); // End with transparent
    gradientBg.drawRect(bgWidth * 0.8, bgY, bgWidth * 0.2, bgHeight); // Right transparent portion
    gradientBg.endFill();
    
    textContainer.addChild(gradientBg);
    
    // Create the "Make Set or Run!" text
    const fontSize = this.getFontSizeForTitle ? this.getFontSizeForTitle() : (this.app.screen.width < 500 ? 40 : 48);
    
    const makeMeldText = new PIXI.Text("Make Set or Run !", {
      fontFamily: "Arial",
      fontSize: fontSize,
      fontWeight: "bold",
      fill: 0xFFFFFF,
      stroke: 0x000000,
      strokeThickness: 4,
      align: "center",
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 2
    });
    
    makeMeldText.anchor.set(0.5);
    makeMeldText.x = this.app.screen.width / 2;
    makeMeldText.y = this.app.screen.height * 0.2;
    
    textContainer.addChild(makeMeldText);
    
    // Add to main container
    this.containers.main.addChild(textContainer);
    this.makeMeldText = textContainer; // Store reference to the container
  }

  // Helper method to show/hide the Make Set or Run text
showMakeMeldText(visible) {
  if (this.makeMeldText) {
    this.makeMeldText.visible = visible;
  }
}

  checkAndShowMelds() {
    if (!this.possibleMelds || !this.uiRenderer) return;
    
    // Check for valid sets (3+ cards of same rank)
    if (this.possibleMelds.sets && this.possibleMelds.sets.length > 0) {
      setTimeout(() => {
        this.uiRenderer.showMeldText("SET!");
      }, 500);
      return;
    }
    
    // Check for valid runs (3+ sequential cards of same suit)
    if (this.possibleMelds.runs && this.possibleMelds.runs.length > 0) {
      setTimeout(() => {
        this.uiRenderer.showMeldText("RUN!");
      }, 500);
      return;
    }
  }

  showMeldText(meldType) {
    // Создаем текстовый объект для отображения типа мелда
    const meldText = new PIXI.Text(meldType, {
      fontFamily: "Arial",
      fontSize: 72,
      fontWeight: "bold",
      fill: meldType === "RUN!" ? 0x98FB98 : 0xFFFE7A, // Зеленый для Run, Желтый для Set
      stroke: 0x000000,
      strokeThickness: 8,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 4
    });
    
    // Центрируем текст
    meldText.anchor.set(0.5);
    meldText.x = this.app.screen.width / 2;
    meldText.y = this.app.screen.height / 2 - 100;
    
    // Начальные настройки для анимации
    meldText.alpha = 0;
    meldText.scale.set(0.5);
    
    // Добавляем в контейнер
    this.container.addChild(meldText);
    
    // Анимация появления и исчезновения текста
    gsap.timeline()
      .to(meldText, {
        alpha: 1,
        scale: 1.2,
        duration: 0.3
      })
      .to(meldText, {
        scale: 1,
        duration: 0.2
      })
      .to(meldText, {
        y: meldText.y - 50,
        duration: 1
      })
      .to(meldText, {
        alpha: 0,
        duration: 0.3,
        onComplete: () => {
          this.container.removeChild(meldText);
        }
      });
  }

  showMeldBreakConfirmation(meld) {
    if (!this.uiManager) return;
    
    this.currentMeld = meld;
    
    // Show confirmation tooltip
    this.uiManager.showConfirmationTooltip("Are you sure you want to break the {card_icon} meld?", {
      showCardIcon: true,
      position: { 
        x: this.app.screen.width / 2, 
        y: this.app.screen.height / 2 - 100 
      },
      onConfirm: () => {
        // Allow the meld to be broken
        this.breakMeld(this.currentMeld);
      },
      onCancel: () => {
        // Cancel the meld break
        this.selectedCard = null;
        this.updatePlayScreen();
      }
    });
  }

  // Handle card click
  // Update to handleCardClick method to remove tutorial text on interaction
handleCardClick(cardData, source) {
  console.log('Card clicked:', cardData, 'source:', source);
  
  // Remove tutorial elements when any card is clicked
  this.hideTutorialElements(false);
  
  if (source === 'player' && this.playerTurn && this.gameStep % 2 === 0) {
    // Просто добавляем визуальную обратную связь, но не обрабатываем дальше
    if (this.cardRenderer) {
      let clickedSprite = null;
      this.cardRenderer.playerHandContainer.children.forEach(sprite => {
        if (sprite.cardData && sprite.cardData.id === cardData.id) {
          clickedSprite = sprite;
        }
      });
      
      if (clickedSprite) {
        this.cardRenderer.enhanceCardClickFeedback(clickedSprite);
      }
    }
    return; // Выходим из метода, не обрабатывая клик дальше
  }
  
  // Handle based on source and game state
  if (source === 'deck' && this.playerTurn && this.gameStep % 2 === 0) {
    // Player is drawing from deck - explicit user choice
    this.handleDrawFromDeck();
    return;
  }
  
  if (source === 'discard' && this.playerTurn && this.gameStep % 2 === 0) {
    // Player is drawing from discard pile - explicit user choice
    this.handleDrawFromDiscard(cardData);
    return;
  }
  
  if (source === 'player') {
    // Player selecting a card from their hand
    if (this.playerTurn && this.gameStep % 2 === 1) {
      // It's discard phase - select a card to discard
      
      // Check if the card is in a meld
      const meldResult = this.isCardInMeld(cardData);
      if (meldResult) {
        // Ask for confirmation before breaking a meld
        this.showMeldBreakConfirmation(meldResult.meld);
        return;
      }
      
      // Select the card for discard - explicitly hide pass button
      this.selectedCard = cardData;
      
      
      // Update display
      this.updatePlayScreen();
      
      // Schedule the actual discard
      setTimeout(() => {
        this.handleDiscard();
      }, 500);
    }
  }
}

showTakeCardTutorial() {
  // Пропускаем, если полное обучение показано или подсказка уже показана на этом ходу
  // ДОБАВЛЕНО: или если deadwood <= 10 или у оппонента нет карт
  if (this.tutorialShown || this.takeCardTutorialShown || 
      this.deadwood <= 10 || this.cardManager.opponentCards.length === 0) return;
  
  // Показываем подсказку
  this.showTutorial();
}

// Helper method to hide all tutorial elements
hideTutorialElements() {
  // Флаг, чтобы отслеживать была ли удалена подсказка
  let tutorialRemoved = false;
  
  // Ищем и удаляем элементы туториала со сцены
  if (this.app && this.app.stage) {
    for (let i = this.app.stage.children.length - 1; i >= 0; i--) {
      const child = this.app.stage.children[i];
      
      // Проверяем, является ли дочерний элемент контейнером с текстом туториала
      if (child && child.children) {
        const hasTutorialText = child.children.some(grandchild => 
          grandchild instanceof PIXI.Text && 
          grandchild.text && 
          (grandchild.text.includes("Take a card") || 
           grandchild.text.includes("Deck or") ||
           grandchild.text.includes("shown card"))
        );
        
        // Если это контейнер с текстом туториала, удаляем его
        if (hasTutorialText) {
          this.app.stage.removeChild(child);
          tutorialRemoved = true;
          console.log("Removed tutorial text");
        }
      }
    }
  }
  
  // Если у нас есть ссылка на конкретный контейнер с туториалом, удаляем его также
  if (this.tutorialTitleContainer) {
    this.app.stage.removeChild(this.tutorialTitleContainer);
    this.tutorialTitleContainer = null;
    tutorialRemoved = true;
    console.log("Removed tutorialTitleContainer");
  }
  
  // Если у нас есть ссылка на элемент tutorialTitle, удаляем его
  if (this.tutorialTitle) {
    this.app.stage.removeChild(this.tutorialTitle);
    this.tutorialTitle = null;
    tutorialRemoved = true;
    console.log("Removed tutorialTitle");
  }
  
  // Сбрасываем флаги туториала
  this.takeCardTutorialShown = false;
  
  if (tutorialRemoved) {
    console.log("Successfully removed all tutorial elements");
  } else {
    console.log("No tutorial elements found to remove");
  }
}

// Update to handleDrawFromDeck method to remove tutorial text
handleDrawFromDeck() {
  console.log('Player draws from deck');
  
  // Скрываем туториал "Take a card"
  this.hideTutorialElements();
  
  // Только разрешаем, если это фаза взятия
  if (!this.playerTurn || this.gameStep % 2 !== 0) return;
  
  const newCard = this.drawCardFromDeck();
  this.cardManager.playerCards.push(newCard);
  
  // Сортируем карты с мелдами
  this.cardManager.playerCards = this.sortCardsWithMelds();
  
  // Уменьшаем количество карт в колоде
  this.deckCount--;
  this.gameStep++;
  
  // Устанавливаем флаг, что игрок взял карту
  this.hasDrawnCard = true;
  
  // Обновляем экран игры
  this.updatePlayScreen();
  
  // Ждем завершения анимации, прежде чем показывать подсказку сброса
  setTimeout(() => {
    this.showDiscardHint();
  }, 800);
}

handleDrawFromDiscard(cardData) {
  console.log('Player draws from discard pile');
  
  // Скрываем туториал "Take a card"
  this.hideTutorialElements();
  
  // Только разрешаем, если это фаза взятия
  if (!this.playerTurn || this.gameStep % 2 !== 0) return;
  
  // Берем верхнюю карту из стопки сброса
  const discardCard = this.cardManager.discardPile.pop();
  
  if (!discardCard) return;
  
  // Добавляем в руку игрока
  this.cardManager.playerCards.push(discardCard);
  
  // Сортируем карты с мелдами
  this.cardManager.playerCards = this.sortCardsWithMelds();
  
  // Обновляем состояние игры
  this.gameStep++;
  
  // Устанавливаем флаг, что игрок взял карту
  this.hasDrawnCard = true;
  
  // Обновляем экран игры
  this.updatePlayScreen();
  
  // Ждем завершения анимации, прежде чем показывать подсказку сброса
  setTimeout(() => {
    this.showDiscardHint();
  }, 800);
}

  // Get suit symbol
  getSuitSymbol(suit) {
    const symbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    return symbols[suit] || suit;
  }

  breakMeld(meld) {
    // Implementation of meld breaking logic
    console.log('Breaking meld:', meld);
    // Reset selection
    this.selectedCard = null;
    this.currentMeld = null;
    this.updatePlayScreen();
  }

  checkCardInMeld(card) {
    if (!this.possibleMelds || !card) return null;
    
    // Check in set melds
    if (this.possibleMelds.sets) {
      for (const set of this.possibleMelds.sets) {
        if (set.cards.some(c => c.id === card.id)) {
          return 'set';
        }
      }
    }
    
    // Check in run melds
    if (this.possibleMelds.runs) {
      for (const run of this.possibleMelds.runs) {
        if (run.cards.some(c => c.id === card.id)) {
          return 'run';
        }
      }
    }
    
    return null;
  }

  isCardInMeld(card) {
    // Check if the card is in any meld
    if (!this.possibleMelds || !card) return false;
    
    if (this.possibleMelds.sets && this.possibleMelds.runs) {
      // Check sets
      for (const set of this.possibleMelds.sets) {
        if (set.cards.some(c => c.id === card.id)) {
          return { type: 'set', meld: set };
        }
      }
      
      // Check runs
      for (const run of this.possibleMelds.runs) {
        if (run.cards.some(c => c.id === card.id)) {
          return { type: 'run', meld: run };
        }
      }
    }
    
    return false;
  }

  createHandPointer(container) {
    const handContainer = new PIXI.Container();
    handContainer.zIndex = 1000; // Ensure hand is above everything
    
    // Try to load hand image
    this.assetLoader.loadTexture('assets/hand.webp')
      .then(texture => {
        const handSprite = new PIXI.Sprite(texture);
        handSprite.anchor.set(0.2, 0.2); // Position finger tip as reference point
        handSprite.scale.set(0.7);
        handContainer.addChild(handSprite);
      })
      .catch(err => {
        // Create fallback hand graphic
        console.warn("Could not load hand texture", err);
        const handGraphics = new PIXI.Graphics();
        
        // Draw hand in skin tone
        handGraphics.beginFill(0xFFCCBB);
        handGraphics.drawEllipse(20, 30, 15, 25);  // Palm
        handGraphics.drawEllipse(20, 0, 8, 20);    // Finger
        handGraphics.endFill();
        
        // Blue sleeve
        handGraphics.beginFill(0x3366CC);
        handGraphics.drawRoundedRect(0, 50, 40, 20, 5);
        handGraphics.endFill();
        
        handContainer.addChild(handGraphics);
      });
    
    // Position hand initially (will be moved by the animation)
    handContainer.x = this.app.screen.width / 2; 
    handContainer.y = 500;
    handContainer.rotation = 0.1; // Slight rotation
    handContainer.scale.set(1); // Normal scale initially
    
    // Make hand a bit more interesting by adding subtle animations
    const pulseHand = () => {
      gsap.timeline({ repeat: -1, yoyo: true })
        .to(handContainer, {
          rotation: 0.15,
          duration: 0.8,
          ease: "sine.inOut"
        })
        .to(handContainer, {
          rotation: 0.05,
          duration: 0.8,
          ease: "sine.inOut"
        });
    };
    
    pulseHand();
    
    container.addChild(handContainer);
    return handContainer;
  }

  // Handle card discard
  handleDiscard() {
    if (!this.selectedCard) return;
    
    // Скрываем подсказку сброса карты
    if (this.uiRenderer) {
      this.uiRenderer.hideDialog();
    }
  
    // Отключаем drag-and-drop после сброса карты
    if (this.cardRenderer) {
      this.cardRenderer.enableDragging(false);
    }
      
    // Get the card's original position in the player's hand for animation
    const cardIndex = this.cardManager.playerCards.findIndex(c => c.id === this.selectedCard.id);
    
    // Убираем анимацию, если карта уже была перетащена через drag and drop
    // (анимация будет только если карта была выбрана кликом, а не перетаскиванием)
    const wasDragged = this.wasDragged || false;
    
    if (!wasDragged && this.cardRenderer && cardIndex !== -1) {
      this.cardRenderer.animateCardDiscard(
        this.selectedCard,
        cardIndex
      );
    }
    
    // Сбрасываем флаг перетаскивания
    this.wasDragged = false;
    
    // Обновляем состояние игры
    // CRITICAL CHANGE: First remove the card from playerCards
    this.cardManager.playerCards = this.cardManager.playerCards.filter(c => c.id !== this.selectedCard.id);
    
    // Then add to discard pile
    this.cardManager.discardPile.push(this.selectedCard);
    
    // Update other game state
    this.selectedCard = null;
    this.gameStep++;
    this.playerTurn = false;
    this.deadwood = this.calculateDeadwood();
    
    // Сбрасываем флаг взятия карты при окончании хода
    this.hasDrawnCard = false;
    
    // IMPORTANT: clear the playerHandContainer before updating
    if (this.cardRenderer) {
      this.cardRenderer.playerHandContainer.removeChildren();
    }
    
    // Обновляем экран игры
    this.updatePlayScreen();
    
    // Ход компьютера
    setTimeout(() => this.playOpponentTurn(), 1500);
  }

  createTutorialCards(cards, container, centerX, centerY, highlightColor, highlightAlpha, highlight3Cards = false) {
    const cardWidth = this.config.cardWidth || 80;
    const cardHeight = this.config.cardHeight || 120;
    const spacing = 55; // Spacing between cards
    
    // Calculate starting position to center the cards
    const startX = centerX - ((cards.length - 1) * spacing / 2);
    
    // Create and position cards
    cards.forEach((cardData, index) => {
      // Check if this card should be highlighted (first 3 cards when highlight3Cards is true)
      const shouldHighlight = highlight3Cards ? index < 3 : true;
      
      // Create card container
      const cardContainer = new PIXI.Container();
      
      // Try to load card texture
      const cardPath = `assets/cards/${cardData.suit}/${cardData.value}_${cardData.suit.charAt(0).toUpperCase()}${cardData.suit.slice(1)}.webp`;
      
      this.assetLoader.loadTexture(cardPath)
        .then(texture => {
          const cardSprite = new PIXI.Sprite(texture);
          cardSprite.width = cardWidth;
          cardSprite.height = cardHeight;
          
          // Add highlight if needed
          if (shouldHighlight) {
            const highlight = new PIXI.Graphics();
            highlight.beginFill(highlightColor, highlightAlpha);
            highlight.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 10);
            highlight.endFill();
            
            cardSprite.anchor.set(0.5);
            
            // Add highlight first, then card
            cardContainer.addChild(highlight);
            cardContainer.addChild(cardSprite);
          } else {
            cardSprite.anchor.set(0.5);
            cardContainer.addChild(cardSprite);
          }
        })
        .catch(err => {
          // Fallback card creation if texture load fails
          console.warn(`Could not load card texture for ${cardData.value} of ${cardData.suit}`, err);
          
          // Create card with graphics
          const cardBg = new PIXI.Graphics();
          cardBg.beginFill(0xFFFFFF);
          cardBg.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 10);
          cardBg.endFill();
          
          // Add highlight for first 3 cards
          if (shouldHighlight) {
            const highlight = new PIXI.Graphics();
            highlight.beginFill(highlightColor, highlightAlpha);
            highlight.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 10);
            highlight.endFill();
            cardContainer.addChild(highlight);
          }
          
          cardContainer.addChild(cardBg);
          
          // Determine text color based on suit
          const isRed = cardData.suit === 'hearts' || cardData.suit === 'diamonds';
          const textColor = isRed ? 0xFF0000 : 0x000000;
          
          // Create text for card value
          const valueTopLeft = new PIXI.Text(cardData.value, {
            fontFamily: 'Arial',
            fontSize: 20,
            fill: textColor,
            fontWeight: 'bold'
          });
          valueTopLeft.anchor.set(0, 0);
          valueTopLeft.position.set(-cardWidth/2 + 5, -cardHeight/2 + 5);
          
          const valueBottomRight = new PIXI.Text(cardData.value, {
            fontFamily: 'Arial',
            fontSize: 20,
            fill: textColor,
            fontWeight: 'bold'
          });
          valueBottomRight.anchor.set(1, 1);
          valueBottomRight.position.set(cardWidth/2 - 5, cardHeight/2 - 5);
          
          // Create suit symbol
          let suitSymbol = '♠';
          if (cardData.suit === 'hearts') suitSymbol = '♥';
          else if (cardData.suit === 'diamonds') suitSymbol = '♦';
          else if (cardData.suit === 'clubs') suitSymbol = '♣';
          
          const suitText = new PIXI.Text(suitSymbol, {
            fontFamily: 'Arial',
            fontSize: 30,
            fill: textColor,
            fontWeight: 'bold'
          });
          suitText.anchor.set(0.5);
          suitText.position.set(0, 0);
          
          // Add all elements to card container
          cardContainer.addChild(valueTopLeft);
          cardContainer.addChild(suitText);
          cardContainer.addChild(valueBottomRight);
        });
      
      // Position card
      cardContainer.x = startX + index * spacing;
      cardContainer.y = centerY;
      
      // Make card container interactive
      cardContainer.interactive = true;
      cardContainer.buttonMode = true;
      cardContainer.on('pointerdown', () => this.startGame());
      
      // Add to container
      container.addChild(cardContainer);
    });
  }
  
  // Play opponent's turn
  playOpponentTurn() {
    if (this.cardRenderer) {
      this.cardRenderer.enableDragging(false);
    }
    // Отложенное выполнение
    setTimeout(() => {
      // ИИ решает, брать из колоды или из сброса
      const takeFromDeck = Math.random() < 0.7 || !this.cardManager.discardPile?.length;
      
      if ((takeFromDeck && this.deckCount > 0) || this.cardManager.discardPile?.length) {
        const source = takeFromDeck ? 'deck' : 'discard';
        
        if (takeFromDeck) this.deckCount--;
        
        if (this.cardRenderer) {
          // Анимация взятия карты
          this.cardRenderer.animateOpponentCardTake(source);
          
          // Быстрый сброс для playable ad
          setTimeout(() => {
            this.opponentDiscard();
            
            // Переход хода
            this.playerTurn = true;
            this.gameStep = this.gameStep % 2 === 0 ? this.gameStep : this.gameStep + 1; // Гарантируем четный шаг в начале хода игрока
            this.updatePlayScreen();
            
            // ИЗМЕНЕНО: Проверяем дополнительные условия перед показом туториала
            setTimeout(() => {
              if (this.playerTurn && this.gameStep % 2 === 0 && 
                  this.deadwood > 10 && this.cardManager.opponentCards.length > 0) {
                this.showTutorial();
              }
            }, 500);
            
          }, 800);
        }
      } else {
        // Если карт нет
        this.playerTurn = true;
        this.gameStep = this.gameStep % 2 === 0 ? this.gameStep : this.gameStep + 1; // Гарантируем четный шаг в начале хода игрока
        this.updatePlayScreen();
        
        // ИЗМЕНЕНО: Проверяем дополнительные условия перед показом туториала
        setTimeout(() => {
          if (this.playerTurn && this.gameStep % 2 === 0 && 
              this.deadwood > 10 && this.cardManager.opponentCards.length > 0) {
            this.showTutorial();
          }
        }, 500);
      }
    }, 800);
  }

  // Opponent discards a card
  opponentDiscard() {
    if (!this.cardManager.opponentCards?.length) return;
    
    let discardIndex = -1;
    
    if (this.screenshotConfig === 1) {
      // For screenshot 1, opponent should discard 10♥
      discardIndex = this.cardManager.opponentCards.findIndex(
        card => card.value === '10' && card.suit === 'hearts'
      );
    } else {
      // For screenshot 2, opponent should discard 7♣
      discardIndex = this.cardManager.opponentCards.findIndex(
        card => card.value === '7' && card.suit === 'clubs'
      );
    }
    
    // If target card not found, fall back to random card
    if (discardIndex === -1) {
      discardIndex = Math.floor(Math.random() * this.cardManager.opponentCards.length);
    }
    
    // Get the card to discard
    const discardedCard = this.cardManager.opponentCards.splice(discardIndex, 1)[0];
    
    // Set faceDown to false when discarding
    discardedCard.faceDown = false;
    
    // Initialize discardPile if needed
    if (!this.cardManager.discardPile) {
      this.cardManager.discardPile = [];
    }
    
    // Add to discard pile
    this.cardManager.discardPile.push(discardedCard);
    
    // Animate the discard if renderer is available
    if (this.cardRenderer) {
      this.cardRenderer.animateOpponentCardDiscard(discardedCard, discardIndex);
    }
  }

  drawCardFromDeck() {
    // Get all cards that are currently in play (to avoid duplicates)
    const usedCards = [
      ...this.cardManager.playerCards,
      ...this.cardManager.opponentCards,
      ...this.cardManager.discardPile
    ].map(card => `${card.value}_${card.suit}`);
    
    // Create a full deck
    const fullDeck = this.createShuffledDeck();
    
    // Filter out cards that are already in play
    const availableCards = fullDeck.filter(card => 
      !usedCards.includes(`${card.value}_${card.suit}`)
    );
    
    // Select a random card from available cards
    if (availableCards.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableCards.length);
      const newCard = availableCards[randomIndex];
      
      return {
        id: Math.floor(Math.random() * 1000) + 300, // Unique ID
        value: newCard.value,
        suit: newCard.suit,
        filename: newCard.filename
      };
    }
    
    // Fallback if there are no available cards (shouldn't happen in a real game)
    console.warn("No unique cards available in deck");
    return this.createRandomCard();
  }

  showDiscardPileTutorial() {
    if (!this.stateManager || this.stateManager.currentState !== 'play' || 
        !this.playerTurn || !this.cardManager.discardPile?.length) return;
    
    if (this.handCursor) {
      const discardPos = {
        x: this.cardRenderer.discardContainer.x + this.config.cardWidth/2,
        y: this.cardRenderer.discardContainer.y + this.config.cardHeight/2
      };
      
      // Показываем только анимацию руки, без текстового тултипа
      this.handCursor.tap(discardPos.x, discardPos.y, {
        onComplete: () => {
          // Highlight discard pile
          if (this.cardRenderer.discardContainer.children.length > 0) {
            const topCard = this.cardRenderer.discardContainer.children[
              this.cardRenderer.discardContainer.children.length - 1
            ];
            
            gsap.to(topCard.scale, {
              x: 1.1, y: 1.1,
              duration: 0.3,
              repeat: 1,
              yoyo: true
            });
          }
        }
      });
    }
  }

  // Handle knock action
handleKnock() {
  if (!this.playerTurn || this.deadwood > 10) return;
  
  // Показываем оверлей с логотипом
  if (this.uiRenderer) {
    this.uiRenderer.showPlayNowOverlay();
  }
  
  // Можно оставить или закомментировать диалог подтверждения
  // if (this.uiManager) {
  //   this.uiManager.createDialog('Knock Confirmation', 'Do you want to knock?', 'knock');
  // }
}

  // Handle meld action
  handleMeld() {
    if (!this.playerTurn || !this.uiManager) return;
    this.uiManager.createDialog('Meld Confirmation', 'Are you sure you want to meld?', 'meld');
  }

  showTutorialMessage(message, duration = 3000) {
    if (!this.uiManager) return;
    
    const tutorialText = new PIXI.Text(message, {
      fontFamily: "Arial",
      fontSize: 24,
      fontWeight: "bold",
      fill: 0xFFFFFF,
      stroke: 0x000000,
      strokeThickness: 4,
      align: "center",
      wordWrap: true,
      wordWrapWidth: this.app.screen.width * 0.8
    });
    
    tutorialText.anchor.set(0.5);
    tutorialText.x = this.app.screen.width / 2;
    
    // Изменяем позицию Y, чтобы отображать ниже центра экрана
    // Примерно на 2/3 высоты экрана
    tutorialText.y = this.app.screen.height * 0.67;
    tutorialText.alpha = 0;
    
    this.app.stage.addChild(tutorialText);
    
    // Анимация появления (немного поднимаем текст при появлении)
    gsap.to(tutorialText, {
      alpha: 1,
      y: tutorialText.y - 10, // Небольшой сдвиг вверх для анимации
      duration: 0.5,
      ease: "power2.out",
      onComplete: () => {
        // Держим, затем исчезаем
        setTimeout(() => {
          gsap.to(tutorialText, {
            alpha: 0,
            y: tutorialText.y - 20, // Продолжаем движение вверх при исчезновении
            duration: 0.5,
            ease: "power2.in",
            onComplete: () => {
              this.app.stage.removeChild(tutorialText);
            }
          });
        }, duration);
      }
    });
  }

  handleTutorials() {
    if (this.tutorialShown) return;
    
    // Set of tutorial steps
    const tutorialSteps = [
      {
        message: "Welcome to Gin Rummy! Create Sets (3+ same rank) or Runs (3+ sequence in same suit)",
        delay: 2000,
        duration: 4000
      },
      {
        message: "First, you need to take a card - either from the discard pile or the deck",
        delay: 10000,
        duration: 4000,
        action: () => this.showDiscardPileTutorial() 
      },
      {
        message: "After taking a card, select one to discard and end your turn",
        delay: 18000,
        duration: 4000
      },
      {
        message: "When your deadwood is 10 or less, you can knock to end the hand",
        delay: 24000,
        duration: 4000,
        action: () => this.tutorialShown = true
      }
    ];
    
    // Run through tutorial steps
    // tutorialSteps.forEach((step, index) => {
    //   setTimeout(() => {
    //     this.showTutorialMessage(step.message, step.duration);
    //     if (step.action) step.action();
    //   }, step.delay);
    // });
  }

  // Handle knock confirmation
  // В game.js изменить метод handleKnockConfirm
  handleKnockConfirm(confirmed) {
    if (confirmed) {
      // Проверяем, является ли это правильным выбором (deadwood < 10)
      const isCorrectChoice = this.deadwood < 10;
      
      if (isCorrectChoice) {
        // В настоящей игре Gin Rummy здесь бы вычислялась разница между
        // deadwood игрока и оппонента, и начислялись очки
        // Для playable ad используем упрощенную версию
        
        // Генерируем случайное значение для deadwood оппонента
        const opponentDeadwood = Math.floor(Math.random() * 40) + 20; // От 20 до 59
        
        // Разница в deadwood (минимум 10 очков)
        const deadwoodDifference = Math.max(10, opponentDeadwood - this.deadwood);
        
        // Бонус за выигрыш (разница в deadwood)
        this.playerScore += deadwoodDifference;
        
        // Показываем сообщение с подсчетом очков
        this.showTooltip(`Отлично! Ваш deadwood: ${this.deadwood}, оппонента: ${opponentDeadwood}. +${deadwoodDifference} очков!`, null);
      } else {
        // Если игрок нажал Knock, когда deadwood >= 10 (неправильный выбор)
        // В настоящей игре это привело бы к штрафу
        this.playerScore += 5; // Небольшое количество очков
        this.showTooltip("Нужно уменьшить deadwood до менее 10 перед тем, как делать knock!", null);
      }
      
      // Ограничиваем до 3 раздач для playable ad
      if (this.dealCount < 2) {
        // Следующая раздача
        setTimeout(() => {
          this.initializeGame();
          this.startGame();
          this.dealCount++;
        }, 2500); // Увеличиваем время, чтобы игрок мог прочитать сообщение
      } else {
        // Полное завершение на 3-й раздаче
        if (this.stateManager) {
          setTimeout(() => {
            this.stateManager.changeState('end');
            this.updateEndScreen(this.playerScore);
          }, 2500);
        }
      }
    }
  }

  // Handle meld confirmation
  handleMeldConfirm(confirmed) {
    if (confirmed) {
      this.deadwood = Math.max(this.deadwood - 10, 0);
      this.updatePlayScreen();
    }
  }

  // Handle install action
  handleInstall() {
    window.open('https://apps.apple.com/app/gin-rummy-stars-card-game/id1467143758', '_blank');
  }

  // Update end screen
  // В game.js обновить метод updateEndScreen
updateEndScreen(playerScore) {
  if (this.endContainer) {
    this.endContainer.removeChildren();
    
    // Тёмный фон
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.8);
    overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    overlay.endFill();
    this.endContainer.addChild(overlay);
    
    // Заголовок
    const endTitle = new PIXI.Text("Game Over", {
      fontFamily: "Arial",
      fontSize: 36,
      fill: 0xFFFFFF,
      fontWeight: 'bold'
    });
    endTitle.anchor.set(0.5);
    endTitle.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 100);
    this.endContainer.addChild(endTitle);
    
    // Информация о счёте
    const scoreText = new PIXI.Text(`Your score: ${playerScore}`, {
      fontFamily: "Arial",
      fontSize: 30,
      fill: 0xFFFF00,
      fontWeight: 'bold'
    });
    scoreText.anchor.set(0.5);
    scoreText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 40);
    this.endContainer.addChild(scoreText);
    
    // Призыв к действию
    const ctaText = new PIXI.Text("Install full game to play more!", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xFFFFFF
    });
    ctaText.anchor.set(0.5);
    ctaText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 + 20);
    this.endContainer.addChild(ctaText);
    
    // Кнопка установки
    this.assetLoader.loadTexture('assets/newGameButton.webp')
      .then(texture => {
        const installButton = new PIXI.Sprite(texture);
        installButton.anchor.set(0.5);
        installButton.x = this.app.screen.width / 2;
        installButton.y = this.app.screen.height / 2 + 100;
        installButton.interactive = true;
        installButton.buttonMode = true;
        installButton.on('pointerdown', () => {
          this.handleInstall();
        });
        this.endContainer.addChild(installButton);
        
        // Пульсация кнопки для привлечения внимания
        gsap.to(installButton.scale, {
          x: 1.1, y: 1.1,
          duration: 0.8,
          repeat: -1,
          yoyo: true
        });
      })
      .catch(err => {
        // Запасной вариант кнопки
        const fallbackButton = new PIXI.Graphics();
        fallbackButton.beginFill(0x4CAF50);
        fallbackButton.drawRoundedRect(0, 0, 180, 60, 10);
        fallbackButton.endFill();
        
        const buttonText = new PIXI.Text("Install Now", {
          fontFamily: "Arial",
          fontSize: 24,
          fill: 0xFFFFFF,
          fontWeight: 'bold'
        });
        buttonText.anchor.set(0.5);
        buttonText.position.set(90, 30);
        
        fallbackButton.addChild(buttonText);
        fallbackButton.position.set(this.app.screen.width / 2 - 90, this.app.screen.height / 2 + 70);
        fallbackButton.interactive = true;
        fallbackButton.buttonMode = true;
        fallbackButton.on('pointerdown', () => {
          this.handleInstall();
        });
        
        this.endContainer.addChild(fallbackButton);
        
        // Пульсация для запасной кнопки
        gsap.to(fallbackButton.scale, {
          x: 1.1, y: 1.1,
          duration: 0.8,
          repeat: -1,
          yoyo: true
        });
      });
    
    this.endContainer.visible = true;
  }
}

  

  // Show hint for drawing from deck
  showDeckHint() {
    if (!this.handCursor || !this.playerTurn || !this.cardRenderer) return;
    
    // Позиция колоды
    const deckPosition = {
      x: this.cardRenderer.deckContainer.x + this.config.cardWidth / 2,
      y: this.cardRenderer.deckContainer.y + this.config.cardHeight / 2
    };
    
    // Демонстрируем нажатие на колоду
    this.handCursor.tap(deckPosition.x, deckPosition.y, {
      onComplete: () => {
        // Подсвечиваем колоду
        if (this.cardRenderer.deckContainer) {
          gsap.to(this.cardRenderer.deckContainer.scale, {
            x: 1.1, y: 1.1,
            duration: 0.3,
            repeat: 1,
            yoyo: true,
            onComplete: () => {
              // После демонстрации колоды показываем подсказку о сбросе
              setTimeout(() => {
                this.showDiscardHint();
              }, 500);
            }
          });
        }
      }
    });
  }
  

  // Show hint for discarding a card
  showDiscardHint() {
    // Only proceed if player has drawn a card this turn
    if (!this.hasDrawnCard) return;
    
    if (!this.handCursor || !this.cardManager.playerCards.length || !this.cardRenderer) return;

    // Add this check: don't show discard hint if deadwood is 10 or less (when KNOCK would be available)
  if (this.deadwood <= 10) {
    // If the discard dialog is already showing, hide it
    if (this.uiRenderer) {
      this.uiRenderer.hideDialog();
    }
    return; // Exit early, don't show the discard hint
  }
    
    // Get all cards that are not in melds
    const setCardIds = new Set();
    const runCardIds = new Set();
    
    if (this.possibleMelds.sets) {
      this.possibleMelds.sets.forEach(meld => {
        meld.cards.forEach(card => setCardIds.add(card.id));
      });
    }
    
    if (this.possibleMelds.runs) {
      this.possibleMelds.runs.forEach(meld => {
        meld.cards.forEach(card => runCardIds.add(card.id));
      });
    }
    
    // Filter out cards that are not in melds
    const nonMeldCards = this.cardManager.playerCards.filter(card => 
      !setCardIds.has(card.id) && !runCardIds.has(card.id)
    );
    
    if (nonMeldCards.length === 0) return;
    
    // Find the card with highest value among non-meld cards
    const valueMap = {
      'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10
    };
    
    // Sort non-meld cards by value (descending)
    nonMeldCards.sort((a, b) => valueMap[b.value] - valueMap[a.value]);
    
    // Get highest value card (first in sorted array)
    const highestCard = nonMeldCards[0];
    
    // Get index of this card in the player's hand
    const cardIndex = this.cardManager.playerCards.findIndex(card => 
      card.id === highestCard.id
    );
    
    // IMPORTANT: Show "Discard a card" message IMMEDIATELY when highlighting the card
    if (this.uiRenderer) {
      // First hide any existing dialogs
      this.uiRenderer.hideDialog();
      
      // Then show the "Discard a card" message
      this.uiRenderer.showDialog("Discard a card !");
    }
    
    // Now highlight this specific card
    if (this.cardRenderer && this.cardRenderer.playerHandContainer.children.length > cardIndex) {
      const cardSprite = this.cardRenderer.playerHandContainer.children[cardIndex];
      
      // Apply special highlight to this card
      this.cardRenderer.applySpecialHighlight(cardSprite, 0x9C27B0, 0.3);
      
      // Make the card stand out slightly
      cardSprite.y -= 10;
      
      // Additional highlight animation
      gsap.to(cardSprite.scale, {
        x: 0.8, y: 0.8, duration: 0.2, repeat: 3, yoyo: true
      });
    }
    
    // Calculate position for hand cursor based on new sorting
    const spacing = this.config.fanDistance || 30;
    const totalCards = this.cardManager.playerCards.length;
    const fanAngle = this.config.fanAngle || 10;
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + cardIndex * anglePerCard;
    
    const cardX = this.cardRenderer.playerHandContainer.x - ((totalCards - 1) * spacing / 2) + cardIndex * spacing;
    const cardY = this.cardRenderer.playerHandContainer.y + Math.sin(rotation * Math.PI / 180) * 10 - 40;
    
    // Calculate discard pile position
    const discardX = this.cardRenderer.discardContainer.x + this.config.cardWidth / 2;
    const discardY = this.cardRenderer.discardContainer.y + this.config.cardHeight / 2;
    
    // Position hand cursor and show animation
    this.handCursor.showAt(cardX, cardY);
    
    // Animate the hand cursor with a short delay
    setTimeout(() => {
      this.handCursor.demonstrateCardMove(
        { x: cardX, y: cardY + 40 },
        { x: discardX, y: discardY },
        { dragDuration: 1.0 }
      );
    }, 500);
  }

  // Show loading screen
  showLoadingScreen() {
    const loadingContainer = new PIXI.Container();
    
    // Background
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0x000000, 0.7);
    graphics.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    graphics.endFill();
    loadingContainer.addChild(graphics);
    
    // Loading text
    const loadingText = new PIXI.Text("Loading Game Assets...", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xFFFFFF
    });
    loadingText.anchor.set(0.5);
    loadingText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 30);
    loadingContainer.addChild(loadingText);
    
    // Progress bar background
    const progressBarWidth = 300;
    const progressBarHeight = 20;
    const progressBarBg = new PIXI.Graphics();
    progressBarBg.beginFill(0x333333);
    progressBarBg.drawRoundedRect(0, 0, progressBarWidth, progressBarHeight, 10);
    progressBarBg.endFill();
    progressBarBg.position.set((this.app.screen.width - progressBarWidth) / 2, this.app.screen.height / 2);
    loadingContainer.addChild(progressBarBg);
    
    // Progress bar fill
    this.progressBarFill = new PIXI.Graphics();
    this.progressBarFill.beginFill(0x4CAF50);
    this.progressBarFill.drawRoundedRect(0, 0, 0, progressBarHeight, 10);
    this.progressBarFill.endFill();
    this.progressBarFill.position.set((this.app.screen.width - progressBarWidth) / 2, this.app.screen.height / 2);
    loadingContainer.addChild(this.progressBarFill);
    
    this.app.stage.addChild(loadingContainer);
    this.loadingContainer = loadingContainer;
  }

  // Update loading progress
  updateLoadingProgress(progress) {
    if (!this.progressBarFill) return;
    
    const progressBarWidth = 300;
    this.progressBarFill.clear();
    this.progressBarFill.beginFill(0x4CAF50);
    this.progressBarFill.drawRoundedRect(0, 0, progress * progressBarWidth, 20, 10);
    this.progressBarFill.endFill();
  }

  // Hide loading screen
  hideLoadingScreen() {
    if (this.loadingContainer) {
      this.app.stage.removeChild(this.loadingContainer);
      this.loadingContainer = null;
    }
  }

  // Show error message
  showErrorMessage(message) {
    const errorContainer = new PIXI.Container();
    
    // Background
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0x000000, 0.8);
    graphics.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    graphics.endFill();
    
    // Error text
    const errorText = new PIXI.Text(message, {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xFF0000,
      fontWeight: 'bold',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: this.app.screen.width - 40
    });
    errorText.anchor.set(0.5);
    errorText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
    
    // Retry button
    const retryButton = new PIXI.Graphics();
    retryButton.beginFill(0x4CAF50);
    retryButton.drawRoundedRect(0, 0, 150, 50, 10);
    retryButton.endFill();
    
    const buttonText = new PIXI.Text("Retry", {
      fontFamily: "Arial",
      fontSize: 20,
      fill: 0xFFFFFF
    });
    buttonText.anchor.set(0.5);
    buttonText.position.set(75, 25);
    
    retryButton.addChild(buttonText);
    retryButton.position.set(this.app.screen.width / 2 - 75, this.app.screen.height / 2 + 60);
    retryButton.interactive = true;
    retryButton.buttonMode = true;
    retryButton.on('pointerdown', () => {
      window.location.reload();
    });
    
    errorContainer.addChild(graphics);
    errorContainer.addChild(errorText);
    errorContainer.addChild(retryButton);
    
    this.app.stage.addChild(errorContainer);
    this.errorContainer = errorContainer;
  }

  // Resize the game
  // Updated resize method to maintain center-cropped background
// Updated resize method to maintain center-cropped background
resize() {
  // Update renderer size to match window dimensions
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  this.app.renderer.resize(width, height);
  
  // Resize background with center-crop approach
  if (this.containers.background.children[0]) {
    const bg = this.containers.background.children[0];
    
    // If it's a sprite (image background), maintain aspect ratio with center-crop
    if (bg instanceof PIXI.Sprite && bg.texture) {
      // Calculate the scaling to cover the entire screen while maintaining aspect ratio
      const scaleX = width / bg.texture.width;
      const scaleY = height / bg.texture.height;
      const scale = Math.max(scaleX, scaleY); // Use the larger scale to ensure covering
      
      // Apply the calculated scale
      bg.scale.set(scale, scale);
      
      // Center the sprite horizontally
      bg.x = (width - bg.width) / 2;
      
      // Special positioning for height on small screens like iPhone SE
      const isSmallScreen = height < 570; // Approximate iPhone SE height threshold
      
      if (isSmallScreen) {
        // Shift down by the height of a card to show better portion of background
        const cardHeight = this.config.cardHeight || 120;
        bg.y = (height - bg.height) / 2 + cardHeight;
      } else {
        // Regular vertical centering for normal screens
        bg.y = (height - bg.height) / 2;
      }
    } 
    // If it's a Graphics object (fallback background), just resize to fill
    else if (bg instanceof PIXI.Graphics) {
      bg.width = width;
      bg.height = height;
    }
  }
  
  // Resize UI elements
  if (this.uiRenderer) {
    this.uiRenderer.resize(width, height);
  }
  
  // Reposition cards
  if (this.cardRenderer) {
    this.cardRenderer.updatePositions(
      this.uiRenderer?.adHeight || 0,
      this.uiRenderer?.navHeight || 0,
      width,
      height
    );
  }
  
  // Update intro screen elements
  if (this.introContainer) {
    this.introContainer.children.forEach(child => {
      if (child instanceof PIXI.Text && child.text.includes("SET or RUN")) {
        child.position.set(width / 2, height * 0.2);
      } else if (child instanceof PIXI.Text && child.text.includes("Tap cards")) {
        child.position.set(width / 2, height - 100);
      } else if (child instanceof PIXI.Container && child.name === "cards-container") {
        child.position.set(width / 2, height / 2);
      }
    });
  }
  
  // Rest of the resize method remains the same...
  
  // Update end screen elements
  if (this.endContainer) {
    this.endContainer.children.forEach(child => {
      if (child instanceof PIXI.Graphics && !child.children.length) {
        child.clear();
        child.beginFill(0x000000, 0.8);
        child.drawRect(0, 0, width, height);
        child.endFill();
      } else if (child instanceof PIXI.Text) {
        child.position.set(width / 2, height / 2 - 50);
      } else if (child instanceof PIXI.Sprite || 
               (child instanceof PIXI.Graphics && child.children.length)) {
        child.position.set(width / 2 - 75, height / 2 + 50);
      }
    });
  }
  
  // Update error message if shown
  if (this.errorContainer) {
    this.errorContainer.children.forEach(child => {
      if (child instanceof PIXI.Graphics && !child.children.length) {
        child.clear();
        child.beginFill(0x000000, 0.8);
        child.drawRect(0, 0, width, height);
        child.endFill();
      } else if (child instanceof PIXI.Text) {
        child.position.set(width / 2, height / 2);
      } else if (child instanceof PIXI.Graphics && child.children.length) {
        child.position.set(width / 2 - 75, height / 2 + 60);
      }
    });
  }
  
  // Update loading screen if shown
  if (this.loadingContainer) {
    this.loadingContainer.children.forEach(child => {
      if (child instanceof PIXI.Graphics && !child.children.length) {
        if (child === this.progressBarFill) {
          // Don't resize the progress fill, just reposition it
          child.position.set((width - 300) / 2, height / 2);
        } else if (child.width > 100) {
          // This is the background
          child.clear();
          child.beginFill(0x000000, 0.7);
          child.drawRect(0, 0, width, height);
          child.endFill();
        } else {
          // This is the progress background
          child.position.set((width - 300) / 2, height / 2);
        }
      } else if (child instanceof PIXI.Text) {
        child.position.set(width / 2, height / 2 - 30);
      }
    });
  }
}
}