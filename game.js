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
    this.deadwood = 58;
    this.playerScore = 0;
    this.opponentScore = 0;
    this.selectedCard = null;
    this.possibleMelds = [];
    this.dealCount = 0;
    this.tutorialShown = false;

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

    /* --- порядок слоёв ---
      uiRenderer  z‑index 100  (TopBanner, реклама, кнопки и т.д.)
      cardRenderer z‑index  10 (все карты, анимации)
    */
    this.uiRenderer.container.zIndex   = 100;
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
  async setupBackground() {
    try {
      const bgTexture = await this.assetLoader.loadTexture('assets/background.webp');
      const bgSprite = new PIXI.Sprite(bgTexture);
      bgSprite.width = this.app.screen.width;
      bgSprite.height = this.app.screen.height;
      
      this.containers.background.removeChildren();
      this.containers.background.addChild(bgSprite);
    } catch (err) {
      console.warn("Using fallback background");
      // Create a fallback background if texture loading fails
      const fallbackBg = new PIXI.Graphics();
      fallbackBg.beginFill(0x0B5D2E);
      fallbackBg.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
      fallbackBg.endFill();
      
      this.containers.background.removeChildren();
      this.containers.background.addChild(fallbackBg);
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
  setupIntroScreen() {
    const introContainer = new PIXI.Container();
    
    // Load banner for intro screen
    this.assetLoader.loadTexture('assets/ad.webp')
      .then(texture => {
        const bannerSprite = new PIXI.Sprite(texture);
        bannerSprite.anchor.set(0.5);
        bannerSprite.x = this.app.screen.width / 2;
        bannerSprite.y = this.app.screen.height / 2 - 100;
        introContainer.addChild(bannerSprite);
      })
      .catch(err => {
        console.warn("Could not load banner for intro screen", err);
      });
    
    // Title text
    const introText = new PIXI.Text("Welcome to Gin Rummy", {
      fontFamily: "Arial",
      fontSize: 32,
      fill: 0xFFFFFF,
      fontWeight: 'bold'
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
    
    introContainer.visible = false;
    this.app.stage.addChild(introContainer);
    this.introContainer = introContainer;
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

  // В game.js заменить метод showTutorial
showTutorial() {
  if (!this.handCursor) return;
  
  // Показываем подсказку о взятии карты из колоды
  this.showTooltip("Tap to draw a card from the deck", () => {
    // Позиционируем курсор над колодой
    const deckPosition = {
      x: this.cardRenderer.deckContainer.x + this.config.cardWidth / 2,
      y: this.cardRenderer.deckContainer.y + this.config.cardHeight / 2
    };
    
    // Анимируем нажатие на колоду
    this.handCursor.tap(deckPosition.x, deckPosition.y, {
      onComplete: () => {
        // Подсветка колоды
        gsap.to(this.cardRenderer.deckContainer.scale, {
          x: 1.1, y: 1.1,
          duration: 0.3,
          repeat: 1,
          yoyo: true
        });
      }
    });
  });
}

  // Initialize game data
  initializeGameData() {
    this.cardManager.playerCards = [];
    this.cardManager.opponentCards = [];
    this.cardManager.discardPile = [];
  }

  // Set up event handlers
  setupEventHandlers() {
    // Card click handler
    this.cardRenderer.setCardClickHandler((card, source) => this.handleCardClick(card, source));

    
    // Dialog confirmation handler
    this.uiManager.onDialogConfirm = (type, confirmed) => {
      if (type === 'knock') this.handleKnockConfirm(confirmed);
      else if (type === 'meld') this.handleMeldConfirm(confirmed);
    };
    
    // Action button handlers
    this.uiRenderer.onKnockClick = () => this.handleKnock();
    this.uiRenderer.onMeldClick = () => this.handleMeld();
  }

  // Start the game
  startGame() {
    console.log('Starting game...');
    
    this.stateManager.changeState('dealing');
    
    // Important: Initialize with empty cards arrays first
    this.cardManager.playerCards = [];
    this.cardManager.opponentCards = [];
    this.cardManager.discardPile = [];
    
    // Update display to show empty hands
    this.updatePlayScreen();
    
    // Then initialize the cards but don't display them yet
    this.initializeCards();
    
    // Now deal them one by one with animation
    this.dealAllCards(() => {
      console.log('Done dealing!');
      this.stateManager.changeState('play');
      this.initializeGame();
      
      // Show tutorial on first game
      if (!this.tutorialShown) {
        setTimeout(() => {
          this.showTutorial();
          this.tutorialShown = true;
        }, 1000);
      }
    });
  }

  // Initialize the cards
  initializeCards() {
    // Clear existing cards first
    this.cardManager.playerCards = [];
    this.cardManager.opponentCards = [];
    this.cardManager.discardPile = [];
    
    // Create a full standard deck of 52 cards
    const fullDeck = this.createShuffledDeck();
    
    // Deal 10 cards to player
    this.cardManager.playerCards = fullDeck.splice(0, 10).map((card, index) => ({
      ...card,
      id: index + 1,
      faceDown: false
    }));
    
    // Deal 10 cards to opponent (face down)
    this.cardManager.opponentCards = fullDeck.splice(0, 10).map((card, index) => ({
      ...card,
      id: 100 + index,
      faceDown: true
    }));
    
    // Set first card for discard pile
    if (fullDeck.length > 0) {
      this.cardManager.discardPile = [{ 
        ...fullDeck.splice(0, 1)[0],
        id: 200,
        faceDown: false
      }];
    }
    
    // ===== Сохраняем остаток колоды для пошаговой раздачи =====
this.preparedDeck = fullDeck;          // очередь карт
this.deckCount    = fullDeck.length;   // визуальный счётчик
this._idCounter   = 300;               // базовый ID для новых карт

    
    console.log("Cards initialized:", {
      player: this.cardManager.playerCards.length,
      opponent: this.cardManager.opponentCards.length,
      discard: this.cardManager.discardPile.length,
      deck: this.deckCount
    });
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

  // В game.js заменить метод dealAllCards
dealAllCards(onComplete) {
  // Сохраняем оригинальные карты
  const originalPlayerCards = [...this.cardManager.playerCards];
  const originalOpponentCards = [...this.cardManager.opponentCards];
  
  // Очищаем визуальное представление 
  this.cardRenderer.playerHandContainer.removeChildren();
  this.cardRenderer.opponentHandContainer.removeChildren();
  
  this.cardManager.playerCards = [];
  this.cardManager.opponentCards = [];
  
  // Создаем чередующуюся последовательность карт
  const sequence = [];
  let playerIndex = 0;
  let opponentIndex = 0;
  
  // Раздаем карты по одной, чередуя между игроком и оппонентом
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

  const dealNext = () => {
    if (sequenceIndex >= sequence.length) {
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
      // Небольшая пауза между картами
      setTimeout(dealNext, 150);
    });
  };

  // Начинаем раздачу
  dealNext();
}
  
  
  // маленький помощник, чтобы брать карту из заранее подготовленной колоды
  drawFromPreparedDeck(faceDown = false) {
    const card = this.preparedDeck.shift();  // preparedDeck сформирован в initializeCards
    return { ...card, id: ++this._idCounter, faceDown };
  }

  // Initialize game state
  initializeGame() {
    console.log('Initializing game state');
    
    // Reset game state
    this.playerTurn = true;
    this.selectedCard = null;
    this.deadwood = 58;
    this.gameStep = 0;
    this.deckCount = 31;
    
    // Update displays - we'll call this right after card initialization
    this.updatePlayScreen();
    // Во время анимации раздачи пропускаем тяжёлые расчёты
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

  // Update possible melds
  updatePossibleMelds() {
    if (!this.cardManager.playerCards) {
      this.possibleMelds = [];
      return;
    }
    
    // Find groups of 3+ cards with same value (sets)
    const valueGroups = this.cardManager.playerCards.reduce((groups, card) => {
      groups[card.value] = groups[card.value] ? [...groups[card.value], card] : [card];
      return groups;
    }, {});
    
    const possibleSets = Object.values(valueGroups).filter(group => group.length >= 3);
    
    // New code: Find runs (sequences of 3+ cards in same suit)
    const suitGroups = this.cardManager.playerCards.reduce((groups, card) => {
      groups[card.suit] = groups[card.suit] ? [...groups[card.suit], card] : [card];
      return groups;
    }, {});
    
    // Helper to convert card values to numeric values for sorting
    const getCardValue = (value) => {
      if (value === 'A') return 1;
      if (value === 'J') return 11;
      if (value === 'Q') return 12;
      if (value === 'K') return 13;
      return parseInt(value);
    };
    
    // Find runs in each suit
    const possibleRuns = [];
    Object.values(suitGroups).forEach(suitCards => {
      if (suitCards.length < 3) return;
      
      // Sort cards by value
      suitCards.sort((a, b) => getCardValue(a.value) - getCardValue(b.value));
      
      // Find sequences
      for (let i = 0; i < suitCards.length - 2; i++) {
        const run = [suitCards[i]];
        let currentValue = getCardValue(suitCards[i].value);
        
        for (let j = i + 1; j < suitCards.length; j++) {
          const nextValue = getCardValue(suitCards[j].value);
          if (nextValue === currentValue + 1) {
            run.push(suitCards[j]);
            currentValue = nextValue;
          } else if (nextValue > currentValue + 1) {
            break;
          }
        }
        
        if (run.length >= 3) {
          possibleRuns.push(run);
        }
      }
    });
    
    // Combine sets and runs for all possible melds
    this.possibleMelds = [...possibleSets, ...possibleRuns];
    
    console.log('Possible melds:', this.possibleMelds);
}

  // Update play screen
  updatePlayScreen() {
    // Update possible melds
    this.updatePossibleMelds();
    
    // Calculate deadwood value
    this.deadwood = this.calculateDeadwood();
    
    // Update UI if renderers are available
    if (this.uiRenderer) {
      this.uiRenderer.updateScores(this.playerScore, this.opponentScore);
      this.uiRenderer.updateDeadwood(this.deadwood);
    }
    
    // Update cards
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
  }

  // Calculate deadwood value
  calculateDeadwood() {
    if (!this.cardManager.playerCards) return 0;
    
    return this.cardManager.playerCards.reduce((sum, card) => {
      if (card.value === 'A') return sum + 1;
      if (['J', 'Q', 'K'].includes(card.value)) return sum + 10;
      return sum + (parseInt(card.value) || 0);
    }, 0);
  }

  // Handle card click
  handleCardClick(card, source) {
    console.log(`Card click from ${source}:`, card);
    
    // Only allow actions during player's turn
    if (!this.playerTurn) return;
    
    // Handle player card selection
    if (source === 'player') {
      this.selectedCard = (this.selectedCard && this.selectedCard.id === card.id) ? null : card;
    }
    // Handle discard pile card take
    else if (source === 'discard' && this.cardManager.discardPile?.length && this.gameStep % 2 === 0) {
      const topCard = this.cardManager.discardPile[this.cardManager.discardPile.length - 1];
      this.cardManager.playerCards.push(topCard);
      this.cardManager.discardPile.pop();
      this.gameStep++;
      
      // Animate with hand cursor if available
      if (this.handCursor && this.cardRenderer) {
        const handPosition = {
          x: this.app.screen.width / 2,
          y: this.app.screen.height - 100
        };
        const discardPosition = {
          x: this.cardRenderer.discardContainer.x + this.config.cardWidth / 2,
          y: this.cardRenderer.discardContainer.y + this.config.cardHeight / 2
        };
        const playerHandPosition = {
          x: this.cardRenderer.playerHandContainer.x,
          y: this.cardRenderer.playerHandContainer.y
        };
        
        this.handCursor.animateDrag(
          handPosition.x, handPosition.y,
          discardPosition.x, discardPosition.y,
          {
            duration: 0.5,
            onComplete: () => {
              this.handCursor.animateDrag(
                discardPosition.x, discardPosition.y,
                playerHandPosition.x, playerHandPosition.y,
                { duration: 0.5 }
              );
            }
          }
        );
      } else if (this.cardRenderer) {
        this.cardRenderer.animateCardTake(topCard, 'discard', this.cardManager.playerCards.length - 1);
      }
      
      if (this.uiRenderer) {
        this.uiRenderer.showDialog("Выберите карту для сброса");
        setTimeout(() => this.uiRenderer.hideDialog(), 2000);
      }
    }
    // Handle deck card take
    else if (source === 'deck' && this.deckCount > 0 && this.gameStep % 2 === 0) {
      const newCard = this.drawCardFromDeck();
      this.cardManager.playerCards.push(newCard);
      this.deckCount--;
      this.gameStep++;
      
      
      // Animate with hand cursor if available
      if (this.handCursor && this.cardRenderer) {
        const handPosition = {
          x: this.app.screen.width / 2,
          y: this.app.screen.height - 100
        };
        const deckPosition = {
          x: this.cardRenderer.deckContainer.x + this.config.cardWidth / 2,
          y: this.cardRenderer.deckContainer.y + this.config.cardHeight / 2
        };
        const playerHandPosition = {
          x: this.cardRenderer.playerHandContainer.x,
          y: this.cardRenderer.playerHandContainer.y
        };
        
        this.handCursor.animateDrag(
          handPosition.x, handPosition.y,
          deckPosition.x, deckPosition.y,
          {
            duration: 0.5,
            onComplete: () => {
              this.handCursor.animateDrag(
                deckPosition.x, deckPosition.y,
                playerHandPosition.x, playerHandPosition.y,
                { duration: 0.5 }
              );
            }
          }
        );
      } else if (this.cardRenderer) {
        this.cardRenderer.animateCardTake(newCard, 'deck', this.cardManager.playerCards.length - 1);
      }
      
      if (this.uiRenderer) {
        this.uiRenderer.showDialog("Выберите карту для сброса");
        setTimeout(() => this.uiRenderer.hideDialog(), 2000);
      }
    }
    
    // Handle card discard if a card is selected and it's the discard phase
    if (this.selectedCard && this.gameStep % 2 === 1) {
      this.handleDiscard();
    }
    
    // Update the play screen
    this.updatePlayScreen();
    
    // Show tutorial hints for first-time players
    const isFirstAction = this.gameStep === 1 && !this.tutorialShown;
    if (isFirstAction && this.uiRenderer && this.handCursor) {
      setTimeout(() => {
        this.uiRenderer.showDialog("Now select a card to discard");
        
        setTimeout(() => {
          this.uiRenderer.hideDialog();
          this.showDiscardHint();
        }, 2000);
      }, 1000);
    }
  }

  // Get suit symbol
  getSuitSymbol(suit) {
    const symbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    return symbols[suit] || suit;
  }

  // Handle card discard
  handleDiscard() {
    if (!this.selectedCard) return;
    
    
    // Animate the discard if renderer is available
    if (this.cardRenderer) {
      this.cardRenderer.animateCardDiscard(
        this.selectedCard,
        this.cardManager.playerCards.findIndex(c => c.id === this.selectedCard.id)
      );
    }
    
    // Update game state
    this.cardManager.playerCards = this.cardManager.playerCards.filter(c => c.id !== this.selectedCard.id);
    this.cardManager.discardPile.push(this.selectedCard);
    this.selectedCard = null;
    this.gameStep++;
    this.playerTurn = false;
    this.deadwood = this.calculateDeadwood();
    
    // Update the play screen
    this.updatePlayScreen();
    
    // AI's turn
    setTimeout(() => this.playOpponentTurn(), 1500);
  }

  // Play opponent's turn
  // В game.js обновить метод playOpponentTurn
playOpponentTurn() {
  // Уменьшаем задержку для playable ad
  setTimeout(() => {
    // AI решает, брать ли из колоды или сброса
    const takeFromDeck = Math.random() < 0.7 || !this.cardManager.discardPile?.length;
    
    if ((takeFromDeck && this.deckCount > 0) || this.cardManager.discardPile?.length) {
      const source = takeFromDeck ? 'deck' : 'discard';
      
      if (takeFromDeck) this.deckCount--;
      
      if (this.cardRenderer) {
        // Анимация взятия карты
        this.cardRenderer.animateOpponentCardTake(source);
        
        // Быстрее сбрасываем для playable ad (было 1000)
        setTimeout(() => {
          this.opponentDiscard();
          
          // Переход хода
          this.playerTurn = true;
          this.updatePlayScreen();
        }, 800);
      }
    } else {
      // Если карты недоступны
      this.playerTurn = true;
      this.updatePlayScreen();
    }
  }, 800); // Уменьшаем задержку (было 1500)
}

  // Opponent discards a card
  opponentDiscard() {
    // Simple AI: discard a random card
    if (!this.cardManager.opponentCards?.length) return;
    
    const discardIndex = Math.floor(Math.random() * this.cardManager.opponentCards.length);
    const discardedCard = this.cardManager.opponentCards.splice(discardIndex, 1)[0];
    
    // Important fix: Set faceDown to false when discarding
    discardedCard.faceDown = false;
    
    if (!this.cardManager.discardPile) {
      this.cardManager.discardPile = [];
    }
    
    this.cardManager.discardPile.push(discardedCard);
    
    if (this.cardRenderer) {
      // Pass the actual card data to the animation
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

  // Handle knock action
  handleKnock() {
    if (!this.playerTurn || !this.uiManager) return;
    this.uiManager.createDialog('Knock Confirmation', 'Do you want to knock?', 'knock');
  }

  // Handle meld action
  handleMeld() {
    if (!this.playerTurn || !this.uiManager) return;
    this.uiManager.createDialog('Meld Confirmation', 'Are you sure you want to meld?', 'meld');
  }

  // Handle knock confirmation
  // В game.js изменить метод handleKnockConfirm
handleKnockConfirm(confirmed) {
  if (confirmed) {
    // Проверяем, является ли это правильным выбором
    const isCorrectChoice = this.deadwood <= 10; // Правильный выбор, если deadwood <= 10
    
    if (isCorrectChoice) {
      // Бонус за правильный выбор
      this.playerScore += 25;
      this.showTooltip("Great choice! +25 points", null);
    } else {
      // Штраф за неправильный выбор
      this.playerScore += 5;
      this.showTooltip("You could have reduced deadwood more!", null);
    }
    
    // Ограничиваем до 3 раздач для playable ad
    if (this.dealCount < 2) {
      // Следующая раздача
      setTimeout(() => {
        this.initializeGame();
        this.startGame();
        this.dealCount++;
      }, 1500);
    } else {
      // Полное завершение на 3-й раздаче
      if (this.stateManager) {
        setTimeout(() => {
          this.stateManager.changeState('end');
          this.updateEndScreen(this.playerScore);
        }, 1000);
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

  // Show tutorial sequence
  showTooltip(message, onComplete) {
    if (!this.app) return;
    
    // Создаем контейнер для подсказки
    const tooltipContainer = new PIXI.Container();
    tooltipContainer.zIndex = 200;
    
    // Фон подсказки (скругленный прямоугольник)
    const tooltipBg = new PIXI.Graphics();
    tooltipBg.beginFill(0x333333, 0.85); // Тёмный фон как в референсе
    tooltipBg.drawRoundedRect(0, 0, 300, 60, 10);
    tooltipBg.endFill();
    
    // Текст подсказки
    const tooltipText = new PIXI.Text(message, {
      fontFamily: "Arial",
      fontSize: 18,
      fontWeight: "bold",
      fill: 0xFFFFFF, // Белый текст как в референсе
      align: "center",
      wordWrap: true,
      wordWrapWidth: 280
    });
    tooltipText.anchor.set(0.5);
    tooltipText.x = 150;
    tooltipText.y = 30;
    
    // Добавляем текст к фону
    tooltipBg.addChild(tooltipText);
    tooltipContainer.addChild(tooltipBg);
    
    // Позиционируем подсказку по центру сверху
    tooltipContainer.x = (this.app.screen.width - 300) / 2;
    tooltipContainer.y = 150; // Выше по центру как в референсе
    
    // Начальная прозрачность и масштаб
    tooltipContainer.alpha = 0;
    
    // Добавляем к сцене
    this.app.stage.addChild(tooltipContainer);
    
    // Анимация появления
    gsap.to(tooltipContainer, {
      alpha: 1,
      duration: 0.3,
      ease: "power2.out"
    });
    
    // Держим подсказку на экране некоторое время
    setTimeout(() => {
      // Анимация исчезновения
      gsap.to(tooltipContainer, {
        alpha: 0,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
          // Удаляем подсказку
          this.app.stage.removeChild(tooltipContainer);
          
          // Вызываем коллбэк, если он передан
          if (onComplete) onComplete();
        }
      });
    }, 2500);
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
    if (!this.handCursor || !this.cardManager.playerCards?.length || !this.cardRenderer) return;
    
    // Показываем подсказку о сбросе карты
    this.showTooltip("Select a high-value card to discard", () => {
      // Находим карту с высоким значением для демонстрации
      const cardValues = this.cardManager.playerCards.map(card => {
        if (card.value === 'A') return 1;
        if (['J', 'Q', 'K'].includes(card.value)) return 10;
        return parseInt(card.value) || 0;
      });
      
      const maxValue = Math.max(...cardValues);
      const suggestedCardIndex = cardValues.indexOf(maxValue);
      
      if (suggestedCardIndex < 0) return;
      
      // Расчет позиции карты
      const spacing = this.config.fanDistance || 30;
      const totalCards = this.cardManager.playerCards.length;
      const cardXPosition = this.cardRenderer.playerHandContainer.x + 
                          (totalCards - 1) * spacing / 2 - 
                          suggestedCardIndex * spacing;
      const cardYPosition = this.cardRenderer.playerHandContainer.y;
      
      // Расчет позиции сброса
      const discardXPosition = this.cardRenderer.discardContainer.x + this.config.cardWidth / 2;
      const discardYPosition = this.cardRenderer.discardContainer.y + this.config.cardHeight / 2;
      
      // Анимация руки перетаскивающей карту в сброс
      this.handCursor.demonstrateCardMove(
        { x: cardXPosition, y: cardYPosition },
        { x: discardXPosition, y: discardYPosition },
        {
          dragDuration: 1.0,
          onComplete: () => {
            // Показываем финальную подсказку
            setTimeout(() => {
              this.showTooltip("Try to create melds of 3+ cards of same rank", null);
              // Завершение туториала
              this.tutorialShown = true;
            }, 500);
          }
        }
      );
    });
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
  resize() {
    // Update renderer size to match window dimensions
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.app.renderer.resize(width, height);
    
    // Resize background
    if (this.containers.background.children[0]) {
      const bg = this.containers.background.children[0];
      bg.width = width;
      bg.height = height;
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
        if (child instanceof PIXI.Text && child.text.includes("Welcome")) {
          child.position.set(width / 2, height / 2);
        } else if (child instanceof PIXI.Sprite) {
          if (child.texture.textureCacheIds && child.texture.textureCacheIds[0]?.includes("ad")) {
            child.position.set(width / 2, height / 2 - 100);
          } else {
            child.position.set(width / 2, height / 2 + 100);
          }
        } else if (child instanceof PIXI.Graphics && child.children[0] instanceof PIXI.Text) {
          child.position.set(width / 2 - 75, height / 2 + 80);
        }
      });
    }
    
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