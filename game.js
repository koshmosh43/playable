import { AssetLoader } from './AssetLoader.js';
import { HandCursor } from './HandCursor.js';
import { GameStateManager } from './GameStateManager.js';
import { UIManager } from './UIManager.js';
import { UIRenderer } from './UIRenderer.js';
import { CardRenderer } from './CardRenderer.js';

document.addEventListener('DOMContentLoaded', () => {
    if (window.gsap && window.PixiPlugin) {
    gsap.registerPlugin(PixiPlugin);
    PixiPlugin.registerPIXI(PIXI);
  }
  
    const game = new GinRummyGame();
  game.initialize();
});

export class GinRummyGame {
  constructor() {
        this.config = {
      cardWidth: 80,
      cardHeight: 120,
      targetScore: 100,
      fanDistance: 30,          fanAngle: -15,             highlightColor: 0x4CAF50
    };

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
    this.pauseGame = false;

        const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    this.app = new PIXI.Application({
      width: viewportWidth,
      height: viewportHeight,
      transparent: true,
      resolution: window.devicePixelRatio || 1,
      antialias: true,
      autoDensity: true
    });
    window.game = this;

        this.assetLoader = new AssetLoader();
    this.cardManager = { 
      playerCards: [],
      opponentCards: [],
      discardPile: [],
      onCardClick: null,
      calculateDeadwood: this.calculateDeadwood.bind(this)
    };
    
        this.containers = {
      main: new PIXI.Container(),
      background: new PIXI.Container(),
    };
    
        this.uiRenderer = null;
    this.cardRenderer = null;
    this.handCursor = null;
    this.stateManager = null;
    this.uiManager = null;
  }

  initializeGSAP() {
        if (window.gsap) {
      console.log("GSAP detected");
      
            gsap.config({
        nullTargetWarn: false
      });
      
            if (window.PixiPlugin) {
        console.log("Registering PixiPlugin");
        gsap.registerPlugin(PixiPlugin);
        if (window.PIXI) {
          PixiPlugin.registerPIXI(PIXI);
        }
      }
      
            if (window.BezierPlugin) {
        console.log("Registering BezierPlugin");
        gsap.registerPlugin(BezierPlugin);
      }
    } else {
      console.warn("GSAP not available, animations will not work");
    }
  }

  sortCardsByValue(cards) {
    const valueOrder = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
  };
  
    return [...cards].sort((a, b) => {
    return valueOrder[a.value] - valueOrder[b.value];
  });
}

sortCardsBySuitAndRank(cards) {
    const suitOrder = {
    'clubs': 0,
    'diamonds': 1,
    'hearts': 2,
    'spades': 3
  };
  
    const valueOrder = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
  };
  
    const cardsCopy = [...cards];
  
    const cardsBySuit = {};
  cardsCopy.forEach(card => {
    if (!cardsBySuit[card.suit]) {
      cardsBySuit[card.suit] = [];
    }
    cardsBySuit[card.suit].push(card);
  });
  
    Object.keys(cardsBySuit).forEach(suit => {
    cardsBySuit[suit].sort((a, b) => {
      return valueOrder[a.value] - valueOrder[b.value];
    });
  });
  
    const result = [];
  ['clubs', 'diamonds', 'hearts', 'spades'].forEach(suit => {
    if (cardsBySuit[suit]) {
      result.push(...cardsBySuit[suit]);
    }
  });
  
  return result;
}

sortCardsWithMelds() {
    this.updatePossibleMelds();
  
    const runs = this.possibleMelds.runs || [];
  const sets = this.possibleMelds.sets || [];
  
    const cardToMeldMap = new Map();
  
    runs.forEach((run, runIndex) => {
    run.cards.forEach(card => {
      cardToMeldMap.set(card.id, { type: 'run', index: runIndex, cards: run.cards });
    });
  });
  
    sets.forEach((set, setIndex) => {
    set.cards.forEach(card => {
      cardToMeldMap.set(card.id, { type: 'set', index: setIndex, cards: set.cards });
    });
  });
  
    const valueOrder = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
  };
  
    const clubCards = this.cardManager.playerCards.filter(card => 
    card.suit === 'clubs' && card.value !== '9'   ).sort((a, b) => valueOrder[a.value] - valueOrder[b.value]);
  
    const setCards = this.cardManager.playerCards.filter(card => 
    card.value === '5' && card.suit !== 'clubs'
  );
  
    const highClub = this.cardManager.playerCards.find(card => 
    card.suit === 'clubs' && card.value === '9'
  );
  
    const otherCards = this.cardManager.playerCards.filter(card => 
    card.suit !== 'clubs' && 
    !(card.value === '5' && card.suit !== 'clubs') &&
    !(card.suit === 'clubs' && card.value === '9')
  );
  
    const allSortedCards = [
    ...clubCards,                ...setCards,               ];
  
    if (highClub) {
    allSortedCards.push(highClub);
  }
  
    allSortedCards.push(...otherCards);
  
    console.log("Final sorted cards:", allSortedCards.map(c => `${c.value} of ${c.suit}`));
  
  return allSortedCards;
}

  preDragCardFromdeck() {
    if (!this.playerTurn || this.gameStep % 2 !== 0) return null;
    
        const newCard = this.drawCardFromdeck();
    this.preDrawnCard = newCard;
    return newCard;
  }

  sortCardsBySuitAndRank(cards) {
        const suitOrder = {
      'clubs': 0,
      'diamonds': 1,
      'hearts': 2,
      'spades': 3
    };
    
        const valueOrder = {
      'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
    };
    
        console.log("Sorting cards:", cards.map(c => `${c.value} of ${c.suit}`));
    
        const sortedCards = [...cards].sort((a, b) => {
            const aSuit = a.suit || '';
      const bSuit = b.suit || '';
      
            const aSuitOrder = suitOrder[aSuit] !== undefined ? suitOrder[aSuit] : 999;
      const bSuitOrder = suitOrder[bSuit] !== undefined ? suitOrder[bSuit] : 999;
      
      const suitDiff = aSuitOrder - bSuitOrder;
      if (suitDiff !== 0) return suitDiff;
      
            const aValue = a.value || '';
      const bValue = b.value || '';
      
            const aValueOrder = valueOrder[aValue] !== undefined ? valueOrder[aValue] : 999;
      const bValueOrder = valueOrder[bValue] !== undefined ? valueOrder[bValue] : 999;
      
      return aValueOrder - bValueOrder;
    });
    
        console.log("After sorting:", sortedCards.map(c => `${c.value} of ${c.suit}`));
    
    return sortedCards;
  }

    async initialize() {
    this.initializeGSAP();
    try {
            const gameContainer = document.getElementById('game-container');
      if (gameContainer) {
        gameContainer.appendChild(this.app.view);
        
                this.app.view.style.width = '100%';
        this.app.view.style.height = '100%';
      }
      
      this.removeLoadingElement();
      
            this.setupContainers();
      
            try {
        await this.loadAssets();
      } catch (error) {
        console.error('Error loading assets:', error);
        this.showErrorMessage('Error loading game assets. Please refresh.');
        return;       }
      
            this.initializeComponents();

           this.app.view.addEventListener('pointerdown', () => {
        this.handCursor.hide();
        this.uiRenderer.hideDialog();
      });
            document.addEventListener('cardDragStart', () => {
        this.handCursor.hide();
        this.uiRenderer.hideDialog();
      });
      
            await this.setupGame();
      
            this.stateManager.changeState('intro');
      
            window.addEventListener('resize', () => this.resize());
      this.resize();
    } catch (error) {
      console.error('Error initializing game:', error);
      this.showErrorMessage('Failed to initialize game. Please refresh.');
    }
  }

    removeLoadingElement() {
    const el = document.getElementById('loading');
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

    setupContainers() {
        this.containers.main.sortableChildren = true;
    this.app.stage.addChild(this.containers.main);
    
        this.containers.background.zIndex = 0;
    this.containers.main.addChild(this.containers.background);
  }

    initializeComponents() {
        this.uiRenderer   = new UIRenderer(this.app, this.assetLoader, this.config);
    this.cardRenderer = new CardRenderer(this.app, this.assetLoader, this.config);
  
        this.cardRenderer.setdeckDragCallback(this.preDragCardFromdeck.bind(this));
  
    
    this.uiRenderer.container.zIndex   = 20;
    this.cardRenderer.container.zIndex = 10;
  
        this.handCursor = new HandCursor(this.app, this.assetLoader);
    
        this.stateManager = new GameStateManager(this, { 
      uiRenderer: this.uiRenderer, 
      cardRenderer: this.cardRenderer 
    });
    
    this.uiManager = new UIManager(this.app);
  }

    async loadAssets() {
    
    try {
            await this.assetLoader.loadGameAssets(progress => {
        this.updateLoadingProgress(progress);
      });
      
            this.hideLoadingScreen();
    } catch (error) {
            this.hideLoadingScreen();
      throw error;
    }
  }

    async setupGame() {
        this.containers.main.addChild(this.uiRenderer.container);
    this.containers.main.addChild(this.cardRenderer.container);
    
            this.containers.main.addChild(this.uiRenderer.avatarsContainer);
    
        await this.setupBackground();
    
        await this.uiRenderer.setupUI();
    
        await this.setupScreens();
    
        this.initializeGameData();
    
        this.setupEventHandlers();
}

    async setupBackground() {
  try {
        const bgTexture = await this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/Backgr.webp');
    
        const bgSprite = new PIXI.Sprite(bgTexture);
    
        const scaleX = this.app.screen.width / bgTexture.width;
    const scaleY = this.app.screen.height / bgTexture.height;
    const scale = Math.max(scaleX, scaleY);     
        bgSprite.scale.set(scale, scale);
    
        bgSprite.x = (this.app.screen.width - bgSprite.width) / 2;
    
        const height = this.app.screen.height;
    const width = this.app.screen.width;
    const aspectRatio = width / height;
    
            if (height <= 568) {
            bgSprite.y = (this.app.screen.height - bgSprite.height) / 2 + 180;       console.log("Applied iPhone SE specific positioning");
    }
        else if (height < 670) {
            const cardHeight = this.config.cardHeight || 120;
      bgSprite.y = (this.app.screen.height - bgSprite.height) / 2 + cardHeight;
      console.log("Applied small screen positioning");
    } 
    else {
            bgSprite.y = (this.app.screen.height - bgSprite.height) / 2;
      console.log("Applied standard positioning");
    }
    
    this.containers.background.removeChildren();
    this.containers.background.addChild(bgSprite);
  } catch (err) {
    console.warn("Using fallback background");
    try {
            const webpTexture = await this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/background.webp');
      
            const webpSprite = new PIXI.Sprite(webpTexture);
      
            const scaleX = this.app.screen.width / webpTexture.width;
      const scaleY = this.app.screen.height / webpTexture.height;
      const scale = Math.max(scaleX, scaleY);       
            webpSprite.scale.set(scale, scale);
      
            webpSprite.x = (this.app.screen.width - webpSprite.width) / 2;
      
            const height = this.app.screen.height;
      const width = this.app.screen.width;
      const aspectRatio = width / height;
      
                  if (height <= 568) {
                webpSprite.y = (this.app.screen.height - webpSprite.height) / 2 + 180;         console.log("Applied iPhone SE specific positioning (webp)");
      }
            else if (height < 670) {
                const cardHeight = this.config.cardHeight || 120;
        webpSprite.y = (this.app.screen.height - webpSprite.height) / 2 + cardHeight;
        console.log("Applied small screen positioning (webp)");
      } 
      else {
                webpSprite.y = (this.app.screen.height - webpSprite.height) / 2;
        console.log("Applied standard positioning (webp)");
      }
      
      this.containers.background.removeChildren();
      this.containers.background.addChild(webpSprite);
    } catch (err2) {
            const fallbackBg = new PIXI.Graphics();
      fallbackBg.beginFill(0x0B5D2E);       fallbackBg.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
      fallbackBg.endFill();
      
      this.containers.background.removeChildren();
      this.containers.background.addChild(fallbackBg);
    }
  }
}

    async setupScreens() {
        this.setupIntroScreen();
    
        this.setupDealingScreen();
    
        this.setupEndScreen();
  }

  setupIntroScreen() {
    const introContainer = new PIXI.Container();
    
    this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/Backgr.webp')
    .then(bgTexture => {
      // Устанавливаем фон
      const bgSprite = new PIXI.Sprite(bgTexture);
      
      const scaleX = this.app.screen.width / bgTexture.width;
      const scaleY = this.app.screen.height / bgTexture.height;
      const scale = Math.max(scaleX, scaleY);  
      bgSprite.scale.set(scale, scale);
      
      bgSprite.x = (this.app.screen.width - bgSprite.width) / 2;
      
      const isSmallScreen = this.app.screen.height < 570;  
      if (isSmallScreen) {
        const cardHeight = this.config.cardHeight || 120;
        bgSprite.y = (this.app.screen.height - bgSprite.height) / 2 + cardHeight;
      } else {
        bgSprite.y = (this.app.screen.height - bgSprite.height) / 2;
      }
      
      introContainer.addChild(bgSprite);
      
      // Устанавливаем элементы туториала
      this.setupTutorialElements(introContainer);
      
      // Добавляем кнопку Play Now в верхней части экрана, как на скриншоте
      this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/playButton.webp')
      .then(playTexture => {
        const playButton = new PIXI.Sprite(playTexture);
        playButton.anchor.set(0.5);
        
        // Устанавливаем масштаб кнопки так, чтобы она была такого же размера как на скриншоте
        const maxWidth = this.app.screen.width * 0.5;
        const originalScale = Math.min(1, maxWidth / playTexture.width);
        const finalScale = originalScale * 0.6; // Подобран для соответствия скриншоту
        playButton.scale.set(finalScale);
        
        // Позиционируем кнопку вверху экрана как на скриншоте
        playButton.x = this.app.screen.width / 2;
        playButton.y = this.app.screen.height * 0.08; // 20% от высоты экрана
        
        // Делаем кнопку интерактивной
        playButton.interactive = true;
        playButton.buttonMode = true;
        playButton.on('pointerdown', () => {
          window.open('https://apps.apple.com/app/gin-rummy-stars-card-game/id1467143758', '_blank');
        this.app.stage.removeChild(overlayContainer);
        });
        
        // Добавляем кнопку
        introContainer.addChild(playButton);
        
        // Добавляем анимации
        gsap.to(playButton, {
          y: playButton.y - 5,
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
        
        gsap.to(playButton.scale, {
          x: finalScale * 1.05, 
          y: finalScale * 1.05,
          duration: 1.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
      })
      .catch(err => {
        console.warn("Could not load play button, using fallback", err);
        
        // Fallback - создаем кнопку как графику
        const fallbackButton = new PIXI.Graphics();
        fallbackButton.beginFill(0xF39C12); // Оранжевый цвет как на скриншоте
        fallbackButton.drawRoundedRect(0, 0, 180, 60, 15);
        fallbackButton.endFill();
        
        const buttonText = new PIXI.Text("PLAY NOW", {
          fontFamily: "Arial",
          fontSize: 24,
          fill: 0xFFFFFF,
          fontWeight: 'bold'
        });
        buttonText.anchor.set(0.5);
        buttonText.position.set(90, 30);
        
        fallbackButton.addChild(buttonText);
        fallbackButton.position.set(this.app.screen.width / 2 - 90, this.app.screen.height * 0.2 - 30);
        fallbackButton.interactive = true;
        fallbackButton.buttonMode = true;
        fallbackButton.on('pointerdown', () => {
          this.startGame();
        });
        
        introContainer.addChild(fallbackButton);
        
        // Добавляем анимации
        gsap.to(fallbackButton, {
          y: fallbackButton.y - 5,
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
        
        gsap.to(fallbackButton.scale, {
          x: 1.05, 
          y: 1.05,
          duration: 1.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
      });
    })
    .catch(err => {
      console.warn("Could not load background for intro screen", err);
      
      // Fallback background
      const fallbackBg = new PIXI.Graphics();
      fallbackBg.beginFill(0x0B5D2E);
      fallbackBg.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
      fallbackBg.endFill();
      introContainer.addChild(fallbackBg);
      
      // Setup tutorial elements
      this.setupTutorialElements(introContainer);
    });
  
    introContainer.visible = false;
    this.app.stage.addChild(introContainer);
    this.introContainer = introContainer;
  }

setupTutorialElements(introContainer) {
    introContainer.sortableChildren = true;
  
    const fontSize = this.app.screen.width < 500 ? 40 : 48;
  
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
  titleText.zIndex = 20;    introContainer.addChild(titleText);
  
    const cardWidth = this.config.cardWidth || 80;
  const cardHeight = this.config.cardHeight || 120;
  const spacing = 50;   
    const cardsContainer = new PIXI.Container();
  cardsContainer.x = this.app.screen.width / 2 - 180;   cardsContainer.y = 350;   cardsContainer.zIndex = 10;    introContainer.addChild(cardsContainer);

    const deckContainer = new PIXI.Container();
    deckContainer.x = cardsContainer.x + 380 - cardWidth;
  deckContainer.y = cardsContainer.y + 10;
  deckContainer.scale.set(0.9);     deckContainer.zIndex = 5;    introContainer.addChild(deckContainer);

    const createdeckStack = () => {
        this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp')
      .then(texture => {
                for (let i = 0; i < 4; i++) {
          const deckCard = new PIXI.Sprite(texture);
          deckCard.width = cardWidth;
          deckCard.height = cardHeight;
                    deckCard.x = -i * 2;
          deckCard.y = -i * 2;
                    deckCard.rotation = (Math.random() * 0.04) - 0.02;
          deckContainer.addChild(deckCard);
        }
      })
      .catch(err => {
                console.warn("Could not load card back texture", err);
        
                for (let i = 0; i < 4; i++) {
          const fallbackdeck = new PIXI.Graphics();
          fallbackdeck.beginFill(0x0000AA);
          fallbackdeck.drawRoundedRect(0, 0, cardWidth, cardHeight, 5);
          fallbackdeck.endFill();
          fallbackdeck.lineStyle(2, 0xFFFFFF);
          fallbackdeck.drawRoundedRect(5, 5, cardWidth - 10, cardHeight - 10, 3);
          
                    fallbackdeck.lineStyle(1, 0xFFFFFF, 0.5);
          for (let j = 0; j < 5; j++) {
            fallbackdeck.drawRoundedRect(
              15 + j * 5, 
              15 + j * 5, 
              cardWidth - 30 - j * 10, 
              cardHeight - 30 - j * 10, 
              3
            );
          }
          
                    fallbackdeck.x = -i * 2;
          fallbackdeck.y = -i * 2;
                    fallbackdeck.rotation = (Math.random() * 0.04) - 0.02;
          
          deckContainer.addChild(fallbackdeck);
        }
      });
  };

    createdeckStack();
  
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
  instructionText.zIndex = 20;    introContainer.addChild(instructionText);
  
    const cardRowContainer = new PIXI.Container();
  cardRowContainer.sortableChildren = true;   cardsContainer.addChild(cardRowContainer);
  
    const baseCards = [
    { value: '4', suit: 'spades', position: 0 },
    { value: '6', suit: 'spades', position: 2 },
    { value: '7', suit: 'spades', position: 3 },
    { value: '5', suit: 'hearts', position: 4 },
    { value: '5', suit: 'diamonds', position: 5 }
  ];
  
    const movableCard = { value: '5', suit: 'spades' };
  
    const createHandCursor = () => {
    const handContainer = new PIXI.Container();
    handContainer.zIndex = 300;     
            this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/hand.webp')
      .then(texture => {
        const handSprite = new PIXI.Sprite(texture);
        handSprite.anchor.set(-0.1, -0.1);
        handSprite.scale.set(0.7);
        handContainer.addChild(handSprite);
      })
      .catch(err => {
                console.warn("Could not load hand texture", err);
        const handGraphics = new PIXI.Graphics();
        
                handGraphics.beginFill(0xFFCCBB);
        handGraphics.drawEllipse(20, 30, 15, 25);          handGraphics.drawEllipse(20, 0, 8, 20);            handGraphics.endFill();
        
                handGraphics.beginFill(0x3366CC);
        handGraphics.drawRoundedRect(0, 50, 40, 20, 5);
        handGraphics.endFill();
        
        handContainer.addChild(handGraphics);
      });
    
        handContainer.x = cardsContainer.x + spacing * 1;
    handContainer.y = cardsContainer.y + cardHeight/2;
    handContainer.visible = true;
    
    introContainer.addChild(handContainer);
    return handContainer;
  };
  
    const cardSprites = [];
  
    Promise.all(baseCards.map(card => {
    const cardPath = `https://koshmosh43.github.io/playable/assets/cards/${card.suit}/${card.value}_${card.suit.charAt(0).toUpperCase()}${card.suit.slice(1)}.webp`;
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
        cardSprites.push(...sprites);
    
        const cardPath = `https://koshmosh43.github.io/playable/assets/cards/${movableCard.suit}/${movableCard.value}_${movableCard.suit.charAt(0).toUpperCase()}${movableCard.suit.slice(1)}.webp`;
    return this.assetLoader.loadTexture(cardPath)
      .then(texture => {
        const movingCard = new PIXI.Sprite(texture);
        movingCard.width = cardWidth;
        movingCard.height = cardHeight;
        movingCard.cardData = movableCard;
        
                const runText = new PIXI.Text("RUN!", {
          fontFamily: "Arial",
          fontSize: 40,
          fontWeight: "bold",
          fill: 0xFFF8C9,           stroke: 0x8B4513,           strokeThickness: 6,
          dropShadow: true,
          dropShadowColor: 0x000000,
          dropShadowDistance: 4
        });
        runText.anchor.set(0.5);
        runText.x = spacing;         runText.y = -100;         runText.alpha = 1;
        runText.visible = true;
        cardRowContainer.addChild(runText);

                const setText = new PIXI.Text("SET!", {
          fontFamily: "Arial",
          fontSize: 40,
          fontWeight: "bold",
          fill: 0xFFF8C9,           stroke: 0x8B4513,           strokeThickness: 6,
          dropShadow: true,
          dropShadowColor: 0x000000,
          dropShadowDistance: 4
        });
        setText.anchor.set(0.5);
        setText.x = spacing * 4;         setText.y = -100;         setText.alpha = 0;
        setText.visible = true;
        cardRowContainer.addChild(setText);

                const runColorMatrix = new PIXI.filters.ColorMatrixFilter();
runColorMatrix.matrix[0]  = 0.9;
runColorMatrix.matrix[6]  = 1.1;
runColorMatrix.matrix[12] = 0.9;

const setColorMatrix = new PIXI.filters.ColorMatrixFilter();
setColorMatrix.matrix[0]  = 1.1;
setColorMatrix.matrix[6]  = 1.1;
setColorMatrix.matrix[12] = 0.9;
        
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
        
                const handCursor = createHandCursor();
        
        const updateCardZIndices = () => {
          let order = [];
          
          if (showingRun) {
                            order = [
                  { card: baseCards[0], zIndex: 0 },                    { card: baseCards[1], zIndex: 2 },                    { card: movableCard, zIndex: 1 },                     { card: baseCards[2], zIndex: 3 },                    { card: baseCards[3], zIndex: 4 },                    { card: baseCards[4], zIndex: 5 }                 ];
          } else {
                            order = [
                  { card: baseCards[0], zIndex: 0 },                    { card: baseCards[1], zIndex: 1 },                    { card: baseCards[2], zIndex: 2 },                    { card: baseCards[3], zIndex: 3 },                    { card: movableCard, zIndex: 4 },                     { card: baseCards[4], zIndex: 5 }                 ];
          }
          
                    const allCards = cardRowContainer.children.filter(child => child.cardData);
          
                    allCards.forEach(sprite => {
              const match = order.find(item => 
                  item.card.value === sprite.cardData.value && 
                  item.card.suit === sprite.cardData.suit
              );
              
                            if (match) {
                  sprite.zIndex = match.zIndex;
              }
          });
          
                    cardRowContainer.sortChildren();
        };

                const highlightRunCards = () => {
                    cardSprites.forEach(sprite => {
            sprite.filters = null;
          });
          movingCard.filters = null;
          
                    cardSprites[0].filters = [runColorMatrix];           movingCard.filters = [runColorMatrix];               cardSprites[1].filters = [runColorMatrix];           
                    updateCardZIndices();
        };

                const highlightSetCards = () => {
                    cardSprites.forEach(sprite => {
            sprite.filters = null;
          });
          movingCard.filters = null;
          
                    cardSprites[3].filters = [setColorMatrix];           movingCard.filters = [setColorMatrix];               cardSprites[4].filters = [setColorMatrix];           
                    updateCardZIndices();
        };

        
        const arrangeCardsInFan = () => {
                    const fanAngle = 4;                  const verticalOffset = 15;           
          if (showingRun) {
                                    cardSprites[0].x = spacing * 0;
            cardSprites[0].y = -verticalOffset * 0;
            cardSprites[0].rotation = (-fanAngle * 2) * Math.PI / 180;
            
                        cardSprites[1].x = spacing * 2;
            cardSprites[1].y = -verticalOffset * 2;
            cardSprites[1].rotation = 0;
            
                        cardSprites[2].x = spacing * 3;
            cardSprites[2].y = -verticalOffset * 3;
            cardSprites[2].rotation = (fanAngle) * Math.PI / 180;
            
                        cardSprites[3].x = spacing * 4;
            cardSprites[3].y = -verticalOffset * 4;
            cardSprites[3].rotation = (fanAngle * 2) * Math.PI / 180;
            
                        cardSprites[4].x = spacing * 5;
            cardSprites[4].y = -verticalOffset * 5;
            cardSprites[4].rotation = (fanAngle * 3) * Math.PI / 180;
            
                                                movingCard.x = spacing * 1;
            movingCard.y = -verticalOffset * 1;
            movingCard.rotation = (-fanAngle) * Math.PI / 180;
            
          } else {
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
          
                    updateCardZIndices();
        };
        
                let showingRun = true;         let isFirstRun = true;         
                const showRunLayout = () => {
                    
                    const timeline = gsap.timeline({
            onComplete: updateCardZIndices
          });
          
                    if (isFirstRun) {
            isFirstRun = false;
            
                        cardSprites.forEach((sprite, index) => {
              const pos = baseCards[index].position;
              sprite.x = pos * spacing;
              sprite.y = 0;
              cardRowContainer.addChild(sprite);
            });
            
                        movingCard.x = spacing * 1;
            movingCard.y = 0;
            cardRowContainer.addChild(movingCard);
            
                        movingCard.zIndex = 1;              cardSprites[0].zIndex = 0;              cardSprites[1].zIndex = 2;              cardSprites[2].zIndex = 3;              cardSprites[3].zIndex = 4;              cardSprites[4].zIndex = 5;              cardRowContainer.sortChildren();
            
                        handCursor.x = cardsContainer.x + spacing * 1;
            handCursor.y = cardsContainer.y + cardHeight/2;
            
                        highlightRunCards();

                        runText.x = spacing;             runText.visible = true;
            runText.alpha = 1;
            setText.visible = false;
            setText.alpha = 0;
            
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
                                    timeline.to([movingCard, handCursor], {
              y: (i, target) => i === 0 ? cardHeight + 30 : cardsContainer.y + cardHeight + 30,
              duration: 0.5,
              ease: "power2.out"
            });
            
                        timeline.to([
              cardSprites[1],               cardSprites[2],               cardSprites[3],               cardSprites[4]              ], {
              stagger: 0.05,
              x: (i, target) => spacing * (2 + i),
              duration: 0.4,
              ease: "power2.inOut"
            }, "-=0.3");
            
                        timeline.to([movingCard, handCursor], {
              x: (i, target) => i === 0 ? spacing * 1 : cardsContainer.x + spacing * 1,
              duration: 0.4,
              ease: "power2.inOut",
              onUpdate: function() {
                                if (this.progress() >= 0.5 && movingCard.zIndex !== 1) {
                                    movingCard.zIndex = 1;                    cardSprites[0].zIndex = 0;                    cardSprites[1].zIndex = 2;                    cardSprites[2].zIndex = 3;                    cardSprites[3].zIndex = 4;                    cardSprites[4].zIndex = 5;                    cardRowContainer.sortChildren();
                }
              }
            });
            
                        timeline.to([movingCard, handCursor], {
              y: (i, target) => i === 0 ? 0 : cardsContainer.y + cardHeight/2,
              duration: 0.3,
              ease: "power2.out"
            });
            
                        timeline.to(setText, {
              alpha: 0,
              duration: 0.3,
              onComplete: () => {
                setText.visible = false;
                
                                highlightRunCards();
              }
            }, "-=0.4");

                        timeline.to(runText, {
              alpha: 1,
              duration: 0.3,
              onStart: () => {
                runText.visible = true;
                runText.alpha = 0;
                runText.x = spacing;               }
            }, "-=0.3");
            
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
                  delay: 0.5
                });
            }, "-=0.3");
          }
        };
        
                const showSetLayout = () => {
                    
                    const timeline = gsap.timeline({
            onComplete: updateCardZIndices
          });
          
                    timeline.to([movingCard, handCursor], {
            y: (i, target) => i === 0 ? cardHeight + 30 : cardsContainer.y + cardHeight + 30,
            duration: 0.4,
            ease: "power2.out"
          });
          
                    timeline.to([
            cardSprites[1],             cardSprites[2],             cardSprites[3]            ], {
            stagger: 0.05,
            x: (i, target) => spacing * (1 + i),
            duration: 0.4,
            ease: "power2.inOut"
          }, "-=0.3");
          
                    timeline.to(cardSprites[4], {
            x: spacing * 5,
            duration: 0.4,
            ease: "power2.inOut"
          }, "-=0.4");
          
                    timeline.to([movingCard, handCursor], {
            x: (i, target) => i === 0 ? spacing * 4 : cardsContainer.x + spacing * 4,
            duration: 0.4,
            ease: "power2.inOut",
            onUpdate: function() {
                            if (this.progress() >= 0.5 && movingCard.zIndex !== 4) {
                                movingCard.zIndex = 4;                  cardSprites[0].zIndex = 0;
                cardSprites[0].zIndex = 0;                  cardSprites[1].zIndex = 1;                  cardSprites[2].zIndex = 2;                  cardSprites[3].zIndex = 3;                  cardSprites[4].zIndex = 5;                  cardRowContainer.sortChildren();
              }
            }
          });
          
                    timeline.to([movingCard, handCursor], {
            y: (i, target) => i === 0 ? 0 : cardsContainer.y + cardHeight/2,
            duration: 0.3,
            ease: "power2.out"
          });
          
                    timeline.to(runText, {
            alpha: 0,
            duration: 0.3,
            onComplete: () => {
              runText.visible = false;
              
                            highlightSetCards();
            }
          }, "-=0.4");

                    timeline.to(setText, {
            alpha: 1,
            duration: 0.3,
            onStart: () => {
              setText.visible = true;
              setText.alpha = 0;
              setText.x = spacing * 4;             }
          }, "-=0.3");
          
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
        
                showRunLayout();
        
                setTimeout(() => {
                    let animationIntervalId = setInterval(() => {
            showingRun = !showingRun;
            if (showingRun) {
              showRunLayout();
            } else {
              showSetLayout();
            }
          }, 1900);
          
                    this.tutorialAnimationInterval = animationIntervalId;
        }, 0.005);
        
                [cardsContainer, deckContainer].forEach(container => {
          container.interactive = true;
          container.buttonMode = true;
          container.on('pointerdown', () => {
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
  
    createFallbackCard(cardData) {
    const cardWidth = this.config.cardWidth || 80;
    const cardHeight = this.config.cardHeight || 120;
    
    const graphics = new PIXI.Graphics();
    
        graphics.beginFill(0xFFFFFF);
    graphics.drawRoundedRect(0, 0, cardWidth, cardHeight, 5);
    graphics.endFill();
    
        const isRed = cardData.suit === 'hearts' || cardData.suit === 'diamonds';
    const color = isRed ? 0xFF0000 : 0x000000;
    
        const valueText = new PIXI.Text(cardData.value, {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: color,
      fontWeight: 'bold'
    });
    valueText.position.set(5, 5);
    graphics.addChild(valueText);
    
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
  
  
    setupIntroScreenContent(introContainer) {
    
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
    
        this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/newGameButton.webp')
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

    setupDealingScreen() {
    const dealingContainer = new PIXI.Container();
    dealingContainer.visible = false;
    this.app.stage.addChild(dealingContainer);
    this.dealingContainer = dealingContainer;
  }

    setupEndScreen() {
    const endContainer = new PIXI.Container();
    
        const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.8);
    overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    overlay.endFill();
    endContainer.addChild(overlay);
    
        const endText = new PIXI.Text("Game Over", {
      fontFamily: "Arial",
      fontSize: 36,
      fill: 0xFFFFFF,
      fontWeight: 'bold'
    });
    endText.anchor.set(0.5);
    endText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 50);
    endContainer.addChild(endText);
    
  }

    showTutorial() {
    if (!this.handCursor || !this.cardRenderer || !this.playerTurn) return;
    
        if (this.deadwood <= 10 || this.cardManager.opponentCards.length === 0) return;
    
        const discardAnalysis = this.analyzeDiscardPileTopCard();
    
        const highlightDiscard = false;
    
        const deckPosition = {
      x: this.cardRenderer.deckContainer.x + this.config.cardWidth / 2,
      y: this.cardRenderer.deckContainer.y + this.config.cardHeight / 2
    };
    
        const titleContainer = new PIXI.Container();
    titleContainer.zIndex = 200;
    
    titleContainer.interactive = false;
    titleContainer.interactiveChildren = false;
    
        const gradientBg = new PIXI.Graphics();
    const bgWidth = this.app.screen.width;
    const bgHeight = 120;
    const bgY = this.app.screen.height * 0.35 - bgHeight/2 - 50;
    
    gradientBg.beginFill(0x000000, 0.5);
    gradientBg.drawRect(0, bgY, bgWidth, bgHeight);
    gradientBg.endFill();
    
    titleContainer.addChild(gradientBg);
    
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
    const tutorialText = "Take a card: deck\nor shown card!";
    
    const titleText = new PIXI.Text(tutorialText, style);
    titleText.anchor.set(0.5);
    titleText.x = this.app.screen.width / 2;
    titleText.y = this.app.screen.height * 0.35 - 50;
    
    titleContainer.addChild(titleText);
    this.app.stage.addChild(titleContainer);
    
        this.tutorialTitleContainer = titleContainer;
    
        this.highlightCardSource('deck');
    
        this.handCursor.tap(
      deckPosition.x, 
      deckPosition.y, 
      { 
        duration: 1.2,         onComplete: () => {
          this.handCursor.fade();
        }
      }
    );
  }
  
  highlightCardSource(source) {
    if (!this.cardRenderer) return;

        this.removeCardHighlighting();

    const PULSE_deck    = { x: 1.25, y: 1.25, duration: 0.4, repeat: -1, yoyo: true };
    const PULSE_DISCARD = { x: 1.25, y: 1.25, duration: 0.4, repeat: -1, yoyo: true };

    const prepareContainerForPulse = (cont) => {
      if (!cont.__pivotCentered) {
        const prevX = cont.x, prevY = cont.y;
        cont.pivot.set(cont.width/2, cont.height/2);
        cont.x = prevX + cont.pivot.x;
        cont.y = prevY + cont.pivot.y;
        cont.__pivotCentered = true;
      }
      gsap.killTweensOf(cont.scale);
      return cont;
    };

    if (source === 'deck') {
      const cont = prepareContainerForPulse(this.cardRenderer.deckContainer);
            const top = cont.children.at(-1);
      if (top) this.cardRenderer.applySpecialHighlight(top, 0x00FF00, 0.5);
                }

    if (source === 'discard') {
            const deckCont = prepareContainerForPulse(this.cardRenderer.deckContainer);
      deckCont.scale.set(1, 1);

      const cont = prepareContainerForPulse(this.cardRenderer.discardContainer);
      const top = cont.children.at(-1);
      if (top) this.cardRenderer.applySpecialHighlight(top, 0x00FF00, 0.5);

      gsap.to(cont.scale, PULSE_DISCARD);
    }
  }


    initializeGameData() {
    this.cardManager.playerCards = [];
    this.cardManager.opponentCards = [];
    this.cardManager.discardPile = [];
  }

    handleGin() {
    if (!this.playerTurn || this.deadwood !== 0) return;
    
    
        if (this.uiRenderer) {
      this.uiRenderer.showPlayNowOverlay();
    }
  
    if (this.uiManager) {
    this.uiManager.createDialog('Gin Confirmation', 'Do you want to call Gin?', 'gin');
  }
}

handleGinConfirm(confirmed) {
  if (confirmed) {
        const ginBonus = 50;     
        this.playerScore += ginBonus;
    
        this.showTooltip(`Perfect GIN! No deadwood cards. +${ginBonus} bonus points!`, null);
    
        setTimeout(() => {
      if (this.uiRenderer) {
        this.uiRenderer.showPlayNowOverlay();
      }
    }, 1500);
    
        if (this.dealCount < 1) {             setTimeout(() => {
        this.initializeGame();
        this.startGame();
        this.dealCount++;
      }, 2500);
    } else {
            if (this.stateManager) {
        setTimeout(() => {
          this.stateManager.changeState('end');
          this.updateEndScreen(this.playerScore);
        }, 2500);
      }
    }
  }
}

    setupEventHandlers() {
        this.cardRenderer.setCardClickHandler((card, source) => this.handleCardClick(card, source));
  
        this.uiManager.onDialogConfirm = (type, confirmed) => {
      if (type === 'knock') this.handleKnockConfirm(confirmed);
      else if (type === 'meld') this.handleMeldConfirm(confirmed);
      else if (type === 'gin') this.handleGinConfirm(confirmed);
    };
    
        this.uiRenderer.onKnockClick = () => this.handleKnock();
    this.uiRenderer.onMeldClick = () => this.handleMeld();
    this.uiRenderer.onGinClick = () => this.handleGin();
    
        document.addEventListener('cardDragStart', (event) => {
      console.log('Card drag started:', event.detail.cardData);
    });
  
    document.addEventListener('cardDragEnd', (event) => {
      const { cardData, sprite, targetArea, position } = event.detail;
      
            const isDrawPhase = this.playerTurn && this.gameStep % 2 === 0;
      const isDiscardPhase = this.playerTurn && this.gameStep % 2 === 1;
      
            if (targetArea === 'wrong-phase-discard' || (targetArea === 'discard' && isDrawPhase)) {
        console.log("Отмена сброса карты в фазе взятия:", cardData);
        
                if (!this.cardManager.playerCards.some(c => c.id === cardData.id)) {
          console.log("Возвращаем карту в руку игрока:", cardData);
          this.cardManager.playerCards.push(cardData);
        }
        
                this.cardManager.playerCards = this.sortCardsWithMelds();
        
                if (this.cardRenderer) {
                    this.cardRenderer.playerHandContainer.removeChildren();
        }
        
                this.updatePlayScreen();
        
                if (this.uiRenderer) {
          this.uiRenderer.showDialog("Take a card from deck\nor discard pile first!");
        }
        
        return;       }
      
            if (targetArea === 'discard' && isDiscardPhase) {
                this.selectedCard = cardData;
        console.log('Card dropped on discard during discard phase:', cardData);
        
                this.wasDragged = true;
        
                if (this.cardRenderer) {
          this.cardRenderer.playerHandContainer.removeChildren();
        }
        
                this.handleDiscard();
      }
    });
    
        document.addEventListener('deckDrag', (event) => {
            if (this.playerTurn && this.gameStep % 2 === 0) {
        console.log('deck card dragged and dropped');
        this.handleDrawFromdeck();
      }
    });
    
        document.addEventListener('discardDrag', (event) => {
      const cardData = event.detail?.cardData;
            if (this.playerTurn && this.gameStep % 2 === 0 && cardData) {
        console.log('Discard card dragged and dropped');
        this.handleDrawFromDiscard(cardData);
      }
    });
    
        document.addEventListener('cardDragStarted', ({ detail }) => {
      if (detail.source === 'deck' || detail.source === 'discard') {
        this.removeCardHighlighting();
      }
    });
    
        document.addEventListener('cardDragReleased', (event) => {
      const { cardData, source, targetArea } = event.detail;
      
            if (source === 'player' && targetArea === 'wrong-phase-discard') {
        console.log("Wrong phase discard detected - ensuring card returns to player's hand");
        
                if (!this.cardManager.playerCards.some(c => c.id === cardData.id)) {
          console.log("Adding card back to player's hand:", cardData);
          this.cardManager.playerCards.push(cardData);
        }
        
                this.cardManager.playerCards = this.sortCardsWithMelds();
        
                this.updatePlayScreen();
        
                if (this.uiRenderer) {
          this.uiRenderer.showDialog("Take a card from deck\nor discard pile first!");
        }
        if (this.deadwood <= 10 && !this.playerTurn) {
  this.uiRenderer.showKnockButton(true);
}

      }
    });
  
        document.addEventListener('cardAddedToHand', (event) => {
      const { cardData, source } = event.detail;
      console.log(`Card added to hand from ${source}:`, cardData);
      
            this.hideTutorialElements();
      this.removeCardHighlighting();
      
            if (source === 'deck') {
                if (this.preDrawnCard) {
                    this.cardManager.playerCards.push(this.preDrawnCard);
          
                    this.cardManager.playerCards = this.sortCardsWithMelds();
          
                    this.deckCount--;
          this.gameStep++;
          
                    this.hasDrawnCard = true;
          
                    this.preDrawnCard = null;
          
                    if (this.cardRenderer) {
                        this.cardRenderer.playerHandContainer.removeChildren();
          }
          
                    this.updatePlayScreen();
          
                    setTimeout(() => {
            this.showDiscardHint();
          }, 800);
        } else {
                    this.handleDrawFromdeck();
        }
      } else if (source === 'discard') {
                if (!this.cardManager.playerCards.some(c => c.id === cardData.id)) {
          this.cardManager.playerCards.push(cardData);
        }
        
                this.cardManager.playerCards = this.sortCardsWithMelds();
        
                this.gameStep++;
        
                this.hasDrawnCard = true;
        
                if (this.cardRenderer) {
                    this.cardRenderer.playerHandContainer.removeChildren();
        }
        
                this.updatePlayScreen();
        
                setTimeout(() => {
          this.showDiscardHint();
        }, 800);
      }
    });
  }


  removeCardHighlighting() {
    if (this.highlightedSource) {
           if (this.highlightedSource.container) {
       gsap.killTweensOf(this.highlightedSource.container.scale);
       this.highlightedSource.container.scale.set(1, 1);
     }
            if (this.highlightedSource.sprite) {
        gsap.killTweensOf(this.highlightedSource.sprite);
        gsap.killTweensOf(this.highlightedSource.sprite.scale);
        if (this.highlightedSource.sprite.filters) {
          this.highlightedSource.sprite.filters = null;
        }
        this.highlightedSource.sprite.scale.set(1, 1);
      }
      this.highlightedSource = null;
    }
  }

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
  
            this.cardManager.playerCards = [];
      this.cardManager.opponentCards = [];
  
            this.cardRenderer.updateDisplay({
        playerCards: [],
        opponentCards: [],
        deckCount: this.deckCount,
        discardPile: []
      });
  
            this.initializeCards();
  
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
  

    initializeCards() {
        this.cardManager.playerCards = [];
    this.cardManager.opponentCards = [];
    this.cardManager.discardPile = [];
    
                const playerCardsData = [
      { value: '3', suit: 'clubs' },          { value: '4', suit: 'clubs' },          { value: '5', suit: 'clubs' },          { value: '6', suit: 'clubs' },          { value: '5', suit: 'hearts' },         { value: '5', suit: 'diamonds' },        { value: '5', suit: 'spades' },          { value: '9', suit: 'clubs' },           { value: '10', suit: 'diamonds' },       { value: 'K', suit: 'hearts' }         ];
    
        this.cardManager.playerCards = playerCardsData.map((card, index) => ({
      ...card,
      id: index + 1,
      faceDown: false,
      filename: `${card.value}_${card.suit.charAt(0).toUpperCase()}${card.suit.slice(1)}.webp`
    }));
    
        const fulldeck = this.createShuffleddeck();
    
        const usedCardKeys = new Set(this.cardManager.playerCards.map(card => `${card.value}_${card.suit}`));
    const remainingdeck = fulldeck.filter(card => 
      !usedCardKeys.has(`${card.value}_${card.suit}`)
    );
    
        let initialDiscardCard = null;
    
        const queenOfHeartsIndex = remainingdeck.findIndex(
      card => card.value === 'Q' && card.suit === 'hearts'
    );
    
    if (queenOfHeartsIndex !== -1) {
      initialDiscardCard = remainingdeck.splice(queenOfHeartsIndex, 1)[0];
    } else {
            initialDiscardCard = remainingdeck.splice(0, 1)[0];
    }
    
        this.cardManager.opponentCards = remainingdeck.splice(0, 10).map((card, index) => ({
      ...card,
      id: 100 + index,
      faceDown: true
    }));
    
        this.cardManager.discardPile = [{ 
      ...initialDiscardCard,
      id: 200,
      faceDown: false
    }];
    
        this.prepareddeck = remainingdeck;
    this.deckCount = remainingdeck.length;
    this._idCounter = 300;
    
        this.drawCount = 0;
    
    console.log("Cards initialized:", {
      player: this.cardManager.playerCards.length,
      opponent: this.cardManager.opponentCards.length,
      discard: this.cardManager.discardPile.length,
      deck: this.deckCount
    });
  }

  prepareOpponentCards(remainingdeck, configType) {
    const opponentCards = [];
    
    if (configType === 1) {
                        
            const tenOfHeartsIndex = remainingdeck.findIndex(
        card => card.value === '10' && card.suit === 'hearts'
      );
      
      if (tenOfHeartsIndex !== -1) {
        const tenOfHearts = remainingdeck.splice(tenOfHeartsIndex, 1)[0];
        opponentCards.push({
          ...tenOfHearts,
          id: 100,
          faceDown: true
        });
      }
    } else {
                  
            const sevenOfClubsIndex = remainingdeck.findIndex(
        card => card.value === '7' && card.suit === 'clubs'
      );
      
      if (sevenOfClubsIndex !== -1) {
        const sevenOfClubs = remainingdeck.splice(sevenOfClubsIndex, 1)[0];
        opponentCards.push({
          ...sevenOfClubs,
          id: 100,
          faceDown: true
        });
      }
    }
    
        while (opponentCards.length < 10 && remainingdeck.length > 0) {
      const card = remainingdeck.splice(0, 1)[0];
      opponentCards.push({
        ...card,
        id: 101 + opponentCards.length,
        faceDown: true
      });
    }
    
    return opponentCards;
  }

  createShuffleddeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
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
    
        for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  }

  dealAllCards(onComplete) {
        const originalPlayerCards = [...this.cardManager.playerCards];
    const originalOpponentCards = [...this.cardManager.opponentCards];
    
        this.cardManager.playerCards = [];
    this.cardManager.opponentCards = [];
    
        this.cardRenderer.playerHandContainer.removeChildren();
    this.cardRenderer.opponentHandContainer.removeChildren();
    
        let wasInterrupted = false;
    let dealingInProgress = true;
  
        const finishDealingImmediately = () => {
      wasInterrupted = true;
      
            this.cardManager.playerCards = [...originalPlayerCards];
      this.cardManager.opponentCards = [...originalOpponentCards];
      
            this.updatePlayScreen();
      
            dealingInProgress = false;
      if (onComplete) onComplete();
      
            this.app.stage.off('pointerdown', skipDealingHandler);
    };
    
        const skipDealingHandler = () => {
      if (dealingInProgress) {
        console.log("Skipping dealing animation...");
        finishDealingImmediately();
      }
    };
    
        this.app.stage.interactive = true;
    this.app.stage.on('pointerdown', skipDealingHandler);
    
        this.cardRenderer.animateFlyingCardDealing(
      originalPlayerCards, 
      originalOpponentCards,
      () => {
                if (wasInterrupted) {
          if (onComplete) onComplete();
          return;
        }
        
                this.cardManager.playerCards = [...originalPlayerCards];
        this.cardManager.opponentCards = [...originalOpponentCards];
        
                if (this.cardRenderer) {
          this.cardRenderer.flipPlayerCards(() => {
                        this.app.stage.off('pointerdown', skipDealingHandler);
            dealingInProgress = false;
            
                        if (onComplete) onComplete();
          });
        } else {
          this.app.stage.off('pointerdown', skipDealingHandler);
          dealingInProgress = false;
          if (onComplete) onComplete();
        }
      }
    );
  }
  

updateGamePositions() {
    const width = this.app.screen.width;
  const height = this.app.screen.height;
  
    
    const tableCenterY = height * 0.4;
  
    if (this.cardRenderer) {
    this.cardRenderer.deckContainer.x = width * 0.55;
    this.cardRenderer.deckContainer.y = tableCenterY;
    
        this.cardRenderer.discardContainer.x = width * 0.45;
    this.cardRenderer.discardContainer.y = tableCenterY;
    
        this.cardRenderer.playerHandContainer.x = width / 2;
    this.cardRenderer.playerHandContainer.y = height * 0.75;
    
        this.cardRenderer.opponentHandContainer.x = width / 2;
    this.cardRenderer.opponentHandContainer.y = height * 0.25;
  }
  
    if (this.handCursor) {
    this.handCursor.container.x = width / 2;
    this.handCursor.container.y = height / 2;
  }
}
  
  
    drawFromPrepareddeck(faceDown = false) {
    const card = this.prepareddeck.shift();      return { ...card, id: ++this._idCounter, faceDown };
  }

    initializeGame() {
    console.log('Initializing game state');
    this.initializeGSAP();

    if (this.cardRenderer) {
      this.cardRenderer.resetCardFlipState();
    }
      
        this.playerTurn = true;
    this.selectedCard = null;
    this.deadwood = 58;
    this.gameStep = 0;
    this.deckCount = 31;
    this.hasDrawnCard = false;

      if (this.cardRenderer) {
    this.cardRenderer.enableDragging(false);
  }
  
    this.tutorialShown = false;
    
        this.updatePlayScreen();
    
        if (!this.makeMeldText) {
      this.setupMakeMeldText();
    }
    this.makeMeldText.visible = false;     
        this.updatePlayScreen();
    
        if (this.stateManager?.currentState !== 'dealing') {
      this.updatePossibleMelds();
    }
      
        if (this.cardRenderer) {
      this.cardRenderer.updatePositions(
        this.uiRenderer?.adHeight || 0,
        this.uiRenderer?.navHeight || 0,
        this.app.screen.width,
        this.app.screen.height
      );
    }
  }
  

    updatePossibleMelds() {
    if (!this.cardManager.playerCards || this.cardManager.playerCards.length < 2) {
      this.possibleMelds = { sets: [], runs: [] };
      return;
    }
    
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
            const sortedCards = [...cards].sort((a, b) => valueOrder[a.value] - valueOrder[b.value]);
      
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
    
            
        const cardsInRuns = new Set();
    possibleRuns.forEach(run => {
      run.cards.forEach(card => {
        cardsInRuns.add(card.id);
      });
    });
    
        const filteredSets = possibleSets.map(set => {
            const filteredCards = set.cards.filter(card => !cardsInRuns.has(card.id));
      
            return {
        type: 'set',
        cards: filteredCards
      };
    }).filter(set => set.cards.length >= 3);     
        this.possibleMelds = {
      sets: filteredSets,
      runs: possibleRuns
    };
    
    return this.possibleMelds;
  }

    updatePlayScreen() {
        this.ensureUniqueCards();
    
        this.updatePossibleMelds();
    this.deadwood = this.calculateDeadwood();
    
        const previousDeadwood = this._previousDeadwood || 999;
    this._previousDeadwood = this.deadwood;
    
        if (previousDeadwood > 10 && this.deadwood <= 10 && this.playerTurn) {
      console.log("DEADWOOD REACHED ≤10: PAUSING GAME");
      
            this.pauseGame = true;
      
            if (this.uiRenderer) {
        setTimeout(() => {
          this.uiRenderer.showKnockButton(true);
        }, 100);
      }
      
          }
    
        if (this.uiRenderer) {
      this.uiRenderer.updateScores(this.playerScore, this.opponentScore);
      this.uiRenderer.updateDeadwood(this.deadwood);
      
            const isPlayerTurn = this.playerTurn;
      const isPlayState = this.stateManager?.currentState === 'play';
      
            if (this.deadwood === 0 && isPlayerTurn && isPlayState) {
        this.uiRenderer.showGinButton(true);
      } else {
        this.uiRenderer.showGinButton(false);
      }
      
            if (this.deadwood > 0 && this.deadwood <= 10 && isPlayState) {
        this.uiRenderer.showKnockButton(true);
      } else {
        this.uiRenderer.showKnockButton(false);
      }
    }
    
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
      
            const enableDrag = this.playerTurn && !this.pauseGame;
      this.cardRenderer.enableDragging(enableDrag);
    }
    
        if (this.playerTurn && this.gameStep % 2 === 1 && this.hasDrawnCard && !this.pauseGame) {
            if (this.handCursor) {
        this.handCursor.fade();
      }
      
            setTimeout(() => {
        this.showDiscardHint();
      }, 200);
    }
    
        if (this.stateManager?.currentState === 'play' && this.cardRenderer) {
            setTimeout(() => {
        this.cardRenderer.updateDisplay({
          playerCards: this.cardManager.playerCards || [],
          opponentCards: this.cardManager.opponentCards || [],
          discardPile: this.cardManager.discardPile || [],
          deckCount: this.deckCount,
          selectedCard: this.selectedCard,
          possibleMelds: this.possibleMelds,
          playerTurn: this.playerTurn
        });
      }, 100);
    }
  }
  
  
calculateDeadwood() {
  console.log("Starting deadwood calculation...");
  
  if (!this.cardManager.playerCards || !this.possibleMelds) {
    console.log("No player cards or possible melds, deadwood = 0");
    return 0;
  }
  
    console.log(`Player has ${this.cardManager.playerCards.length} cards`);
  
    const meldCardIds = new Set();
  
    if (this.possibleMelds.sets && this.possibleMelds.runs) {
        this.possibleMelds.sets.forEach(meld => {
      console.log(`Found SET meld with ${meld.cards.length} cards`);
      meld.cards.forEach(card => meldCardIds.add(card.id));
    });
    
        this.possibleMelds.runs.forEach(meld => {
      console.log(`Found RUN meld with ${meld.cards.length} cards`);
      meld.cards.forEach(card => meldCardIds.add(card.id));
    });
  } 
    else if (Array.isArray(this.possibleMelds)) {
    console.log("Using legacy meld format");
    this.possibleMelds.forEach(meld => {
      meld.forEach(card => meldCardIds.add(card.id));
    });
  }
  
    console.log(`Found ${meldCardIds.size} cards in melds`);
  
    const deadwoodCards = this.cardManager.playerCards.filter(card => !meldCardIds.has(card.id));
  console.log(`${deadwoodCards.length} cards not in melds (deadwood)`);
  
    let deadwoodValue = deadwoodCards.reduce((sum, card) => {
    let cardValue = 0;
    
            if (['J', 'Q', 'K', 'A'].includes(card.value)) {
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

wouldCardCompleteMeld(card, excludeCard = null) {
  if (!card) return false;
  
    const playerCards = [...this.cardManager.playerCards];
  if (excludeCard) {
    const index = playerCards.findIndex(c => c.id === excludeCard.id);
    if (index !== -1) {
      playerCards.splice(index, 1);
    }
  }
  
    if (!playerCards.some(c => c.id === card.id)) {
    playerCards.push(card);
  }
  
    const valueOrder = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
  };
  
    const valueGroups = {};
  playerCards.forEach(c => {
    if (!valueGroups[c.value]) valueGroups[c.value] = [];
    valueGroups[c.value].push(c);
  });
  
    if (valueGroups[card.value] && valueGroups[card.value].length >= 3) {
    return { type: 'set', cards: valueGroups[card.value] };
  }
  
    const suitGroups = {};
  playerCards.forEach(c => {
    if (!suitGroups[c.suit]) suitGroups[c.suit] = [];
    suitGroups[c.suit].push(c);
  });
  
    if (suitGroups[card.suit] && suitGroups[card.suit].length >= 3) {
        const sortedCards = suitGroups[card.suit].sort((a, b) => 
      valueOrder[a.value] - valueOrder[b.value]
    );
    
        let run = [sortedCards[0]];
    for (let i = 1; i < sortedCards.length; i++) {
      const prevValue = valueOrder[sortedCards[i-1].value];
      const currValue = valueOrder[sortedCards[i].value];
      
      if (currValue === prevValue + 1) {
        run.push(sortedCards[i]);
      } else {
        if (run.length >= 3 && run.some(c => c.id === card.id)) {
          return { type: 'run', cards: [...run] };
        }
        run = [sortedCards[i]];
      }
    }
    
    if (run.length >= 3 && run.some(c => c.id === card.id)) {
      return { type: 'run', cards: [...run] };
    }
  }
  
  return false;
}

getCardMeldPotential(card) {
  if (!card) return 0;
  
  let potential = 0;
  const playerCards = this.cardManager.playerCards;
  
    const valueOrder = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
  };
  
    const sameValueCards = playerCards.filter(c => 
    c.id !== card.id && c.value === card.value
  );
  
    if (sameValueCards.length === 1) potential += 3;
  if (sameValueCards.length >= 2) potential += 8;
  
    const sameSuitCards = playerCards.filter(c => 
    c.id !== card.id && c.suit === card.suit
  );
  
  if (sameSuitCards.length > 0) {
    const cardValue = valueOrder[card.value];
    
        const hasValueMinus1 = sameSuitCards.some(c => valueOrder[c.value] === cardValue - 1);
    const hasValueMinus2 = sameSuitCards.some(c => valueOrder[c.value] === cardValue - 2);
    const hasValuePlus1 = sameSuitCards.some(c => valueOrder[c.value] === cardValue + 1);
    const hasValuePlus2 = sameSuitCards.some(c => valueOrder[c.value] === cardValue + 2);
    
        if (hasValueMinus1 && hasValuePlus1) {
            potential += 10;
    } else if ((hasValueMinus1 && hasValueMinus2) || (hasValuePlus1 && hasValuePlus2)) {
            potential += 8;
    } else if (hasValueMinus1 || hasValuePlus1) {
            potential += 4;
    } else if (hasValueMinus2 || hasValuePlus2) {
            potential += 2;
    }
  }
  
  return potential;
}

findOptimalDiscardCard() {
  if (!this.cardManager.playerCards || this.cardManager.playerCards.length === 0) {
    return null;
  }
  
    const meldCardIds = new Set();
  
  if (this.possibleMelds.sets) {
    this.possibleMelds.sets.forEach(meld => {
      meld.cards.forEach(card => meldCardIds.add(card.id));
    });
  }
  
  if (this.possibleMelds.runs) {
    this.possibleMelds.runs.forEach(meld => {
      meld.cards.forEach(card => meldCardIds.add(card.id));
    });
  }
  
    const nonMeldCards = this.cardManager.playerCards.filter(card => 
    !meldCardIds.has(card.id)
  );
  
  if (nonMeldCards.length === 0) {
            const valueMap = {
      'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10
    };
    
    return [...this.cardManager.playerCards].sort((a, b) => 
      valueMap[b.value] - valueMap[a.value]
    )[0];
  }
  
    const valueMap = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10
  };
  
    const sortedByValue = [...nonMeldCards].sort((a, b) => 
    valueMap[b.value] - valueMap[a.value]
  );
  
    return sortedByValue[0];
}


getCardValue(card) {
  if (card.value === 'A') return 1;
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  return parseInt(card.value) || 0;
}

analyzeDiscardPileTopCard() {
  if (!this.cardManager.discardPile || this.cardManager.discardPile.length === 0) {
    return { useful: false, reason: "No cards in discard pile" };
  }
  
  const topCard = this.cardManager.discardPile[this.cardManager.discardPile.length - 1];
  
    const meldResult = this.wouldCardCompleteMeld(topCard);
  if (meldResult) {
    return { 
      useful: true, 
      reason: `Would complete a ${meldResult.type}`, 
      meldType: meldResult.type 
    };
  }
  
    const potential = this.getCardMeldPotential(topCard);
  if (potential >= 5) {
    return { 
      useful: true, 
      reason: "High meld potential", 
      potential 
    };
  }
  
  return { useful: false, reason: "Low meld potential", potential };
}

  setupMakeMeldText() {
        const textContainer = new PIXI.Container();
    textContainer.zIndex = 100;     
        const gradientBg = new PIXI.Graphics();
    
        const bgWidth = this.app.screen.width;
        const bgHeight = 90;
    
        const bgY = this.app.screen.height * 0.2 - bgHeight/2;
    
        gradientBg.beginFill(0x000000, 0);     gradientBg.drawRect(0, bgY, bgWidth * 0.2, bgHeight);     gradientBg.endFill();
    
    gradientBg.beginFill(0x000000, 0.5);     gradientBg.drawRect(bgWidth * 0.2, bgY, bgWidth * 0.6, bgHeight);     gradientBg.endFill();
    
    gradientBg.beginFill(0x000000, 0);     gradientBg.drawRect(bgWidth * 0.8, bgY, bgWidth * 0.2, bgHeight);     gradientBg.endFill();
    
    textContainer.addChild(gradientBg);
    
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
    
        this.containers.main.addChild(textContainer);
    this.makeMeldText = textContainer;   }

  showMakeMeldText(visible) {
  if (this.makeMeldText) {
    this.makeMeldText.visible = visible;
  }
}

  checkAndShowMelds() {
    if (!this.possibleMelds || !this.uiRenderer) return;
    
        if (this.possibleMelds.sets && this.possibleMelds.sets.length > 0) {
      setTimeout(() => {
        this.uiRenderer.showMeldText("SET!");
      }, 500);
      return;
    }
    
        if (this.possibleMelds.runs && this.possibleMelds.runs.length > 0) {
      setTimeout(() => {
        this.uiRenderer.showMeldText("RUN!");
      }, 500);
      return;
    }
  }

  showMeldText(meldType) {
        const meldText = new PIXI.Text(meldType, {
      fontFamily: "Arial",
      fontSize: 72,
      fontWeight: "bold",
      fill: meldType === "RUN!" ? 0x98FB98 : 0xFFFE7A,       stroke: 0x000000,
      strokeThickness: 8,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 4
    });
    
        meldText.anchor.set(0.5);
    meldText.x = this.app.screen.width / 2;
    meldText.y = this.app.screen.height / 2 - 100;
    
        meldText.alpha = 0;
    meldText.scale.set(0.5);
    
        this.container.addChild(meldText);
    
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
    
        
  }

      handleCardClick(cardData, source) {
        let highlightBar = null;
    let filters = null;
    let originalSprite = null;
    
        if (source === 'player') {
      this.cardRenderer.playerHandContainer.children.forEach(sprite => {
        
        if (sprite.cardData && sprite.cardData.id === cardData.id) {
                    highlightBar = sprite.highlightBar;
          filters = sprite.filters;
          originalSprite = sprite;
        }
      });
    }
    
        if (this.onCardClick) {
      this.onCardClick(cardData, source);
    }
    
            if (source === 'player' && originalSprite) {
            this.cardRenderer.enhanceCardClickFeedback(originalSprite);
      
            setTimeout(() => {
                const meldType = window.game && 
                         window.game.checkCardInMeld && 
                         cardData &&
                         window.game.checkCardInMeld(cardData);
        
        if (meldType === 'set' || meldType === 'run') {
                    const color = meldType === 'set' ? 0xFFFE7A : 0x98FB98;
          
                    if (!originalSprite.highlightBar || originalSprite.highlightBar !== highlightBar) {
            this.applySpecialHighlight(originalSprite, color, 0.5);
          }
        }
      }, 100);
    
    }
  }
  

showTakeCardTutorial() {
      if (this.tutorialShown || this.takeCardTutorialShown || 
      this.deadwood <= 10 || this.cardManager.opponentCards.length === 0) return;
  
    this.showTutorial();
}

hideTutorialElements() {
    let tutorialRemoved = false;
  
    if (this.highlightedSource && this.highlightedSource.sprite) {
        gsap.killTweensOf(this.highlightedSource.sprite);
    gsap.killTweensOf(this.highlightedSource.sprite.scale);
    
        if (this.highlightedSource.sprite.filters) {
      this.highlightedSource.sprite.filters = null;
    }
    
        this.highlightedSource.sprite.scale.set(1, 1);
    
        this.highlightedSource = null;
  }
  
    if (this.app && this.app.stage) {
    for (let i = this.app.stage.children.length - 1; i >= 0; i--) {
      const child = this.app.stage.children[i];
      
            if (child && child.children) {
        const hasTutorialText = child.children.some(grandchild => 
          grandchild instanceof PIXI.Text && 
          grandchild.text && 
          (grandchild.text.includes("Take a card") || 
           grandchild.text.includes("deck or") ||
           grandchild.text.includes("shown card"))
        );
        
                if (hasTutorialText) {
          this.app.stage.removeChild(child);
          tutorialRemoved = true;
          console.log("Removed tutorial text");
        }
      }
    }
  }
  
    if (this.tutorialTitleContainer) {
    this.app.stage.removeChild(this.tutorialTitleContainer);
    this.tutorialTitleContainer = null;
    tutorialRemoved = true;
    console.log("Removed tutorialTitleContainer");
  }
  
    if (this.tutorialTitle) {
    this.app.stage.removeChild(this.tutorialTitle);
    this.tutorialTitle = null;
    tutorialRemoved = true;
    console.log("Removed tutorialTitle");
  }
  
    this.takeCardTutorialShown = false;
  
  if (tutorialRemoved) {
    console.log("Successfully removed all tutorial elements");
  } else {
    console.log("No tutorial elements found to remove");
  }
}

handleDrawFromdeck() {
  console.log('Player draws from deck');
  
    this.hideTutorialElements();
  this.removeCardHighlighting();
  
    if (!this.playerTurn || this.gameStep % 2 !== 0) return;
  
    const newCard = this.preDrawnCard || this.drawCardFromdeck();
  
    if (this.preDrawnCard) {
    this.preDrawnCard = null;
  }
  
  console.log("Drew card from deck:", newCard);
  
    const cardExists = this.isCardInAnyCollection(newCard);
  if (cardExists) {
    console.error("ERROR: Attempting to add a duplicate card:", newCard);
        const replacementCard = this.drawUniqueCardFromdeck();
    console.log("Drew replacement card instead:", replacementCard);
    
        this.cardManager.playerCards.push(replacementCard);
  } else {
        if (this.cardRenderer) {
            const destIndex = this.cardManager.playerCards.length;
      
            this.cardRenderer.animateCardTake(newCard, 'deck', destIndex);
    }
    
        this.cardManager.playerCards.push(newCard);
  }
  
    this.cardManager.playerCards = this.sortCardsWithMelds();
  
    this.deckCount--;
  this.gameStep++;
  
    this.hasDrawnCard = true;
  
    if (this.cardRenderer) {
    this.cardRenderer.enableDragging(true);
    
        this.cardRenderer.playerHandContainer.removeChildren();
  }
  
    setTimeout(() => {
    this.updatePlayScreen();
    
        setTimeout(() => {
      this.showDiscardHint();
    }, 600);
  }, 100);
}

isCardInAnyCollection(card) {
  if (!card) return false;
  
    const cardKey = `${card.value}_${card.suit}`;
  
    const inPlayerHand = this.cardManager.playerCards.some(c => 
    `${c.value}_${c.suit}` === cardKey
  );
  
    const inOpponentHand = this.cardManager.opponentCards.some(c => 
    `${c.value}_${c.suit}` === cardKey
  );
  
    const inDiscardPile = this.cardManager.discardPile.some(c => 
    `${c.value}_${c.suit}` === cardKey
  );
  
  return inPlayerHand || inOpponentHand || inDiscardPile;
}

drawUniqueCardFromdeck() {
    for (let i = 0; i < 10; i++) {
    const card = this.drawCardFromdeck();
    if (!this.isCardInAnyCollection(card)) {
      return card;
    }
    console.log("Drew duplicate card, retrying...");
  }
  
    console.warn("Failed to draw unique card after 10 attempts, creating new card");
  
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  
    for (const suit of suits) {
    for (const value of values) {
      const testCard = { value, suit };
      if (!this.isCardInAnyCollection(testCard)) {
        return {
          id: Math.floor(Math.random() * 100000) + 10000,
          value,
          suit,
          filename: `${value}_${suit.charAt(0).toUpperCase()}${suit.slice(1)}.webp`
        };
      }
    }
  }
  
    return {
    id: Math.floor(Math.random() * 100000) + 10000,
    value: 'A',
    suit: 'hearts',
    filename: `A_Hearts.webp`
  };
}


handleDrawFromDiscard(cardData) {
  console.log('Player draws from discard pile');
  
    this.hideTutorialElements();
  this.removeCardHighlighting();

    if (!this.playerTurn || this.gameStep % 2 !== 0) return;

    if (!this.cardManager.discardPile.length) return;
  
    const discardCard = this.cardManager.discardPile.pop();
  if (!discardCard) return;
  
    const isDuplicate = this.cardManager.playerCards.some(card => 
    card.value === discardCard.value && card.suit === discardCard.suit
  );
  
  if (isDuplicate) {
    console.error('Error: Attempting to add a duplicate card to player hand', discardCard);
        const duplicateIndex = this.cardManager.playerCards.findIndex(card => 
      card.value === discardCard.value && card.suit === discardCard.suit
    );
    
    if (duplicateIndex !== -1) {
      console.log('Removing duplicate card from player hand');
      this.cardManager.playerCards.splice(duplicateIndex, 1);
    }
  }
  
    const uniqueCard = {
    ...discardCard,
    id: discardCard.id || Math.floor(Math.random() * 100000) + 1000
  };
  
  this.cardManager.playerCards.push(uniqueCard);
  this.cardManager.playerCards = this.sortCardsWithMelds();
  
    this.gameStep++;
  this.hasDrawnCard = true;
  this.updatePlayScreen();

    this.trackAllCards();

    setTimeout(() => {
    this.showDiscardHint();
  }, 800);
}

ensureUniqueCards() {
    const seenCards = new Set();
  const duplicates = [];
  
    const checkAndFixArray = (cardsArray, source) => {
    const uniqueCards = [];
    
    cardsArray.forEach(card => {
      const cardKey = `${card.value}_${card.suit}`;
      
      if (seenCards.has(cardKey)) {
        console.warn(`Duplicate card detected in ${source}:`, card);
        duplicates.push({ card, source });
              } else {
        seenCards.add(cardKey);
        uniqueCards.push(card);
      }
    });
    
    return uniqueCards;
  };
  
    this.cardManager.playerCards = checkAndFixArray(this.cardManager.playerCards, 'player hand');
  
    this.cardManager.opponentCards = checkAndFixArray(this.cardManager.opponentCards, 'opponent hand');
  
    this.cardManager.discardPile = checkAndFixArray(this.cardManager.discardPile, 'discard pile');
  
    if (duplicates.length > 0) {
    console.log(`Fixed ${duplicates.length} duplicate cards:`, duplicates);
  }
}

    getSuitSymbol(suit) {
    const symbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    return symbols[suit] || suit;
  }

  breakMeld(meld) {
        console.log('Breaking meld:', meld);
        this.selectedCard = null;
    this.currentMeld = null;
    this.updatePlayScreen();
  }

  checkCardInMeld(card) {
    if (!this.possibleMelds || !card) return null;
    
        if (this.possibleMelds.sets) {
      for (const set of this.possibleMelds.sets) {
        if (set.cards.some(c => c.id === card.id)) {
          return 'set';
        }
      }
    }
    
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
        if (!this.possibleMelds || !card) return false;
    
    if (this.possibleMelds.sets && this.possibleMelds.runs) {
            for (const set of this.possibleMelds.sets) {
        if (set.cards.some(c => c.id === card.id)) {
          return { type: 'set', meld: set };
        }
      }
      
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
    handContainer.zIndex = 1000;     
        this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/hand.webp')
      .then(texture => {
        const handSprite = new PIXI.Sprite(texture);
        handSprite.anchor.set(0.2, 0.2);         handSprite.scale.set(0.7);
        handContainer.addChild(handSprite);
      })
      .catch(err => {
                console.warn("Could not load hand texture", err);
        const handGraphics = new PIXI.Graphics();
        
                handGraphics.beginFill(0xFFCCBB);
        handGraphics.drawEllipse(20, 30, 15, 25);          handGraphics.drawEllipse(20, 0, 8, 20);            handGraphics.endFill();
        
                handGraphics.beginFill(0x3366CC);
        handGraphics.drawRoundedRect(0, 50, 40, 20, 5);
        handGraphics.endFill();
        
        handContainer.addChild(handGraphics);
      });
    
        handContainer.x = this.app.screen.width / 2; 
    handContainer.y = 500;
    handContainer.rotation = 0.1;     handContainer.scale.set(1);     
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

    handleDiscard() {
        if (this.pauseGame) {
      console.log("Game is paused - discard blocked");
      return;
    }
  
    if (!this.selectedCard) return;
    
        const meldType = this.checkCardInMeld(this.selectedCard);
    if (meldType) {
      console.log(`Cannot discard a card that is part of a ${meldType}`);
      
            if (this.uiRenderer) {
        this.uiRenderer.showDialog(`Cannot discard a card in a ${meldType}!`);
      }
      
            this.selectedCard = null;
      return;
    }
      
        if (this.uiRenderer) {
      this.uiRenderer.hideDialog();
    }
  
        if (this.cardRenderer) {
      this.cardRenderer.enableDragging(false);
    }
      
        const cardIndex = this.cardManager.playerCards.findIndex(c => c.id === this.selectedCard.id);
    
        const wasDragged = this.wasDragged || false;
    
        if (this.selectedCard.highlightBar) {
      delete this.selectedCard.highlightBar;
    }
    if (this.selectedCard.filters) {
      delete this.selectedCard.filters;
    }
    
    if (!wasDragged && this.cardRenderer && cardIndex !== -1) {
      this.cardRenderer.animateCardDiscard(
        this.selectedCard,
        cardIndex
      );
    }
    
        this.wasDragged = false;
    
            this.cardManager.playerCards = this.cardManager.playerCards.filter(c => c.id !== this.selectedCard.id);
    
        this.cardManager.discardPile.push(this.selectedCard);
    
        this.selectedCard = null;
    this.gameStep++;
    this.playerTurn = false;
    this.deadwood = this.calculateDeadwood();
    
        this.hasDrawnCard = false;
    
        if (this.cardRenderer) {
      this.cardRenderer.playerHandContainer.removeChildren();
    }
    
        this.updatePlayScreen();
    
        setTimeout(() => this.playOpponentTurn(), 1500);
  }

  createTutorialCards(cards, container, centerX, centerY, highlightColor, highlightAlpha, highlight3Cards = false) {
    const cardWidth = this.config.cardWidth || 80;
    const cardHeight = this.config.cardHeight || 120;
    const spacing = 55;     
        const startX = centerX - ((cards.length - 1) * spacing / 2);
    
        cards.forEach((cardData, index) => {
            const shouldHighlight = highlight3Cards ? index < 3 : true;
      
            const cardContainer = new PIXI.Container();
      
            const cardPath = `https://koshmosh43.github.io/playable/assets/cards/${cardData.suit}/${cardData.value}_${cardData.suit.charAt(0).toUpperCase()}${cardData.suit.slice(1)}.webp`;
      
      this.assetLoader.loadTexture(cardPath)
        .then(texture => {
          const cardSprite = new PIXI.Sprite(texture);
          cardSprite.width = cardWidth;
          cardSprite.height = cardHeight;
          
                    if (shouldHighlight) {
            const highlight = new PIXI.Graphics();
            highlight.beginFill(highlightColor, highlightAlpha);
            highlight.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 10);
            highlight.endFill();
            
            cardSprite.anchor.set(0.5);
            
                        cardContainer.addChild(highlight);
            cardContainer.addChild(cardSprite);
          } else {
            cardSprite.anchor.set(0.5);
            cardContainer.addChild(cardSprite);
          }
        })
        .catch(err => {
                    console.warn(`Could not load card texture for ${cardData.value} of ${cardData.suit}`, err);
          
                    const cardBg = new PIXI.Graphics();
          cardBg.beginFill(0xFFFFFF);
          cardBg.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 10);
          cardBg.endFill();
          
                    if (shouldHighlight) {
            const highlight = new PIXI.Graphics();
            highlight.beginFill(highlightColor, highlightAlpha);
            highlight.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 10);
            highlight.endFill();
            cardContainer.addChild(highlight);
          }
          
          cardContainer.addChild(cardBg);
          
                    const isRed = cardData.suit === 'hearts' || cardData.suit === 'diamonds';
          const textColor = isRed ? 0xFF0000 : 0x000000;
          
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
          
                    cardContainer.addChild(valueTopLeft);
          cardContainer.addChild(suitText);
          cardContainer.addChild(valueBottomRight);
        });
      
            cardContainer.x = startX + index * spacing;
      cardContainer.y = centerY;
      
            cardContainer.interactive = true;
      cardContainer.buttonMode = true;
      cardContainer.on('pointerdown', () => this.startGame());
      
            container.addChild(cardContainer);
    });
  }

  createUniqueCard() {
        const allCards = [
      ...this.cardManager.playerCards,
      ...this.cardManager.opponentCards,
      ...this.cardManager.discardPile
    ];
    
        const usedCombinations = new Set();
    allCards.forEach(card => {
      usedCombinations.add(`${card.value}_${card.suit}`);
    });
    
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    
        let value, suit;
    
    for (suit of suits) {
      for (value of values) {
        if (!usedCombinations.has(`${value}_${suit}`)) {
                    return {
            id: Math.floor(Math.random() * 10000) + 800,
            value,
            suit,
            faceDown: true,
            filename: `${value}_${suit.charAt(0).toUpperCase()}${suit.slice(1)}.webp`
          };
        }
      }
    }
    
            value = values[Math.floor(Math.random() * values.length)];
    suit = suits[Math.floor(Math.random() * suits.length)];
    console.warn("All 52 cards in use - creating card with random variant");
    
    return {
      id: Math.floor(Math.random() * 10000) + 800,
      value,
      suit,
      faceDown: true,
      variant: Math.floor(Math.random() * 1000),       filename: `${value}_${suit.charAt(0).toUpperCase()}${suit.slice(1)}.webp`
    };
  }
  
    playOpponentTurn() {
    if (this.pauseGame) {
      console.log("Game is paused - opponent turn blocked");
      return;
    }
  
    if (this.cardRenderer) {
      this.cardRenderer.enableDragging(false);
    }
    
        const isCardDuplicate = (newCard, collection) => {
      if (!newCard || !collection) return false;
      
            const newCardKey = `${newCard.value}_${newCard.suit}`;
      
            return collection.some(existingCard => 
        `${existingCard.value}_${existingCard.suit}` === newCardKey
      );
    };
    
        setTimeout(() => {
            const takeFromdeck = Math.random() < 0.7 || !this.cardManager.discardPile?.length;
      
      if ((takeFromdeck && this.deckCount > 0) || this.cardManager.discardPile?.length) {
        const source = takeFromdeck ? 'deck' : 'discard';
        
                let newCard;
        if (takeFromdeck) {
                    let attempts = 0;
          let cardFound = false;
          
          while (!cardFound && attempts < 10) {
            newCard = this.drawCardFromdeck();
            newCard.faceDown = true;             
                        if (!isCardDuplicate(newCard, this.cardManager.opponentCards) &&
                !isCardDuplicate(newCard, this.cardManager.playerCards) &&
                !isCardDuplicate(newCard, this.cardManager.discardPile)) {
              cardFound = true;
            }
            
            attempts++;
          }
          
                              if (!cardFound) {
            console.warn("Could not find non-duplicate card after multiple attempts");
            newCard = this.createUniqueCard();
            newCard.faceDown = true;
          }
          
          this.deckCount--;
        } else {
                    newCard = this.cardManager.discardPile.pop();
          newCard.faceDown = true;           
                    if (isCardDuplicate(newCard, this.cardManager.opponentCards)) {
            console.warn("Avoiding duplicate from discard pile");
                        this.cardManager.discardPile.push(newCard);
            
                        newCard = this.drawCardFromdeck();
            newCard.faceDown = true;
            this.deckCount--;
          }
        }
        
                const existingIds = new Set([
          ...this.cardManager.playerCards.map(c => c.id),
          ...this.cardManager.opponentCards.map(c => c.id),
          ...this.cardManager.discardPile.map(c => c.id)
        ]);
        
                while (existingIds.has(newCard.id)) {
          newCard.id = Math.floor(Math.random() * 10000) + 800;
        }
        
                this.cardManager.opponentCards.push(newCard);
        
                const newCardIndex = this.cardManager.opponentCards.length - 1;
        
        if (this.cardRenderer) {
                    this.cardRenderer.animateOpponentCardTake(source, newCardIndex);
          
                    setTimeout(() => {
                        this.updatePlayScreen();
            
                        setTimeout(() => {
              this.opponentDiscard();
              
                            this.playerTurn = true;
              this.gameStep = this.gameStep % 2 === 0 ? this.gameStep : this.gameStep + 1;               this.updatePlayScreen();
              
                            setTimeout(() => {
                if (this.playerTurn && this.gameStep % 2 === 0 && 
                    this.deadwood > 10 && this.cardManager.opponentCards.length > 0) {
                  this.showTutorial();
                }
              }, 500);
            }, 800);           }, 600);         }
      } else {
                this.playerTurn = true;
        this.gameStep = this.gameStep % 2 === 0 ? this.gameStep : this.gameStep + 1;         this.updatePlayScreen();
        
                setTimeout(() => {
          if (this.playerTurn && this.gameStep % 2 === 0 && 
              this.deadwood > 10 && this.cardManager.opponentCards.length > 0) {
            this.showTutorial();
          }
        }, 500);
      }
    }, 800);
  }
  

  trackAllCards() {
        const allCards = [
      ...this.cardManager.playerCards,
      ...this.cardManager.opponentCards,
      ...this.cardManager.discardPile
    ];
    
        const cardTracker = new Map();
    
        allCards.forEach(card => {
      const cardKey = `${card.value}_${card.suit}`;
      if (!cardTracker.has(cardKey)) {
        cardTracker.set(cardKey, []);
      }
      cardTracker.get(cardKey).push(card);
    });
    
        const duplicatedCards = [];
    cardTracker.forEach((cards, key) => {
      if (cards.length > 1) {
        duplicatedCards.push({ key, cards });
      }
    });
    
        if (duplicatedCards.length > 0) {
      console.warn('Duplicate cards detected:', duplicatedCards);
      return duplicatedCards;
    }
    
    return null;
  }

    opponentDiscard() {
    if (!this.cardManager.opponentCards?.length) return;
    
    let discardIndex = -1;
    
    if (this.screenshotConfig === 1) {
            discardIndex = this.cardManager.opponentCards.findIndex(
        card => card.value === '10' && card.suit === 'hearts'
      );
    } else {
            discardIndex = this.cardManager.opponentCards.findIndex(
        card => card.value === '7' && card.suit === 'clubs'
      );
    }
    
        if (discardIndex === -1) {
      discardIndex = Math.floor(Math.random() * this.cardManager.opponentCards.length);
    }
    
        const discardedCard = { ...this.cardManager.opponentCards[discardIndex] };
    
        const isDuplicate = this.cardManager.discardPile.some(c => 
      c.value === discardedCard.value && c.suit === discardedCard.suit
    );
    
    if (isDuplicate) {
      console.error("Error: Opponent trying to discard a card that's already in discard pile");
            const availableIndices = Array.from({ length: this.cardManager.opponentCards.length }, (_, i) => i)
        .filter(i => i !== discardIndex);
      
      if (availableIndices.length > 0) {
                discardIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        discardedCard = { ...this.cardManager.opponentCards[discardIndex] };
      }
    }
    
        discardedCard.faceDown = false;
    
        if (this.cardRenderer) {
                  this.cardRenderer.animateOpponentCardDiscard(
        discardedCard, 
        discardIndex,
        () => {
                    this.cardManager.opponentCards.splice(discardIndex, 1);
          
                    if (!this.cardManager.discardPile) {
            this.cardManager.discardPile = [];
          }
          
                    const uniqueDiscardCard = {
            ...discardedCard,
            id: Math.floor(Math.random() * 100000) + 5000           };
          
          this.cardManager.discardPile.push(uniqueDiscardCard);
          
                    this.trackAllCards();
          
                    this.updatePlayScreen();
        }
      );
    }
  }

  drawCardFromdeck() {
        
    const riggedCards = [
      { value: '7', suit: 'clubs' },
      { value: '8', suit: 'clubs' },
      { value: '2', suit: 'clubs' },
    ];
    if (this.drawCount !== undefined && this.drawCount < riggedCards.length) {
      const riggedCard = riggedCards[this.drawCount++];
      console.log(`Выдаем предопределенную карту: ${riggedCard.value} ${riggedCard.suit}`);
      return {
        id: Math.floor(Math.random() * 1000) + 300,
        value: riggedCard.value,
        suit: riggedCard.suit,
        filename: `${riggedCard.value}_${riggedCard.suit.charAt(0).toUpperCase()}${riggedCard.suit.slice(1)}.webp`
      };
    }
  
        const playerCards   = this.cardManager.playerCards   || [];
    const opponentCards = this.cardManager.opponentCards || [];
    const discardPile   = this.cardManager.discardPile   || [];
  
    const usedKeys = [
      ...playerCards,
      ...opponentCards,
      ...discardPile
    ].map(c => `${c.value}_${c.suit}`);
  
        const fulldeck = this.createShuffleddeck();
  
        const availableCards = fulldeck.filter(card =>
      !usedKeys.includes(`${card.value}_${card.suit}`)
    );
  
    if (availableCards.length > 0) {
      const idx = Math.floor(Math.random() * availableCards.length);
      const { value, suit, filename } = availableCards[idx];
      return {
        id: Math.floor(Math.random() * 1000) + 300,
        value,
        suit,
        filename
      };
    }
  
    console.warn("No unique cards available in deck – возвращаю рандомную");
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
      
            this.handCursor.tap(discardPos.x, discardPos.y, {
        onComplete: () => {
                    if (this.cardRenderer.discardContainer.children.length > 0) {
            const topCard = this.cardRenderer.discardContainer.children[
              this.cardRenderer.discardContainer.children.length - 1
            ];
            
            gsap.to(topCard.scale, {
              x: 0.6, y: 0.6,
              duration: 0.3,
              repeat: 1,
              yoyo: true
            });
          }
        }
      });
    }
  }

  handleKnock() {
  if (!this.playerTurn || this.deadwood > 10) return;
  
    if (this.uiRenderer) {
    this.uiRenderer.showPlayNowOverlay();
  }
  
        }

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
    
            tutorialText.y = this.app.screen.height * 0.67;
    tutorialText.alpha = 0;
    
    this.app.stage.addChild(tutorialText);
    
        gsap.to(tutorialText, {
      alpha: 1,
      y: tutorialText.y - 10,       duration: 0.5,
      ease: "power2.out",
      onComplete: () => {
                setTimeout(() => {
          gsap.to(tutorialText, {
            alpha: 0,
            y: tutorialText.y - 20,             duration: 0.5,
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
    
                              }

      handleKnockConfirm(confirmed) {
    if (confirmed) {
            const isCorrectChoice = true;
      
      if (isCorrectChoice) {
                const opponentDeadwood = Math.floor(Math.random() * 20) + 40;         
                const deadwoodDifference = Math.max(30, opponentDeadwood - this.deadwood);
        
                this.playerScore += deadwoodDifference;
        
                this.showTooltip(`Great! Your deadwood: ${this.deadwood}, opponent's: ${opponentDeadwood}. +${deadwoodDifference} points!`, null);
        
                setTimeout(() => {
          if (this.uiRenderer) {
            this.uiRenderer.showPlayNowOverlay();
          }
        }, 1500);
      }
      
            if (this.dealCount < 1) {
                setTimeout(() => {
          this.initializeGame();
          this.startGame();
          this.dealCount++;
        }, 2500);
      } else {
                if (this.stateManager) {
          setTimeout(() => {
            this.stateManager.changeState('end');
            this.updateEndScreen(this.playerScore);
          }, 2500);
        }
      }
    }
  }

    handleMeldConfirm(confirmed) {
    if (confirmed) {
      this.deadwood = Math.max(this.deadwood - 10, 0);
      this.updatePlayScreen();
    }
  }

    handleInstall() {
    window.open('https://apps.apple.com/app/gin-rummy-stars-card-game/id1467143758', '_blank');
  }

    updateEndScreen(playerScore) {
  if (this.endContainer) {
    this.endContainer.removeChildren();
    
        const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.8);
    overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    overlay.endFill();
    this.endContainer.addChild(overlay);
    
        const endTitle = new PIXI.Text("Game Over", {
      fontFamily: "Arial",
      fontSize: 36,
      fill: 0xFFFFFF,
      fontWeight: 'bold'
    });
    endTitle.anchor.set(0.5);
    endTitle.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 100);
    this.endContainer.addChild(endTitle);
    
        const scoreText = new PIXI.Text(`Your score: ${playerScore}`, {
      fontFamily: "Arial",
      fontSize: 30,
      fill: 0xFFFF00,
      fontWeight: 'bold'
    });
    scoreText.anchor.set(0.5);
    scoreText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 40);
    this.endContainer.addChild(scoreText);
    
        const ctaText = new PIXI.Text("Install full game to play more!", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xFFFFFF
    });
    ctaText.anchor.set(0.5);
    ctaText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 + 20);
    this.endContainer.addChild(ctaText);
    
        this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/newGameButton.webp')
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
        
                gsap.to(installButton.scale, {
          x: 1.1, y: 1.1,
          duration: 0.8,
          repeat: -1,
          yoyo: true
        });
      })
      .catch(err => {
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

  

    showdeckHint() {
    if (!this.handCursor || !this.playerTurn || !this.cardRenderer) return;
    
        const deckPosition = {
      x: this.cardRenderer.deckContainer.x + this.config.cardWidth / 2,
      y: this.cardRenderer.deckContainer.y + this.config.cardHeight / 2
    };
    
        this.handCursor.tap(deckPosition.x, deckPosition.y, {
      onComplete: () => {
                this.showDiscardHint();
      }
    });
  }
  

    showDiscardHint() {
        if (!this.hasDrawnCard) return;
    if (!this.uiRenderer) return;
  
        this.uiRenderer.showGinButton(false);
    this.uiRenderer.showKnockButton(false);
    this.uiRenderer.hideDialog();
  
        if (this.deadwood === 0) {
      this.uiRenderer.showGinButton(true);
            if (this.uiRenderer.ginButton) {
        gsap.to(this.uiRenderer.ginButton.scale, {
          x: 1.2, y: 1.2,
          duration: 0.5,
          repeat: -1,
          yoyo: true,
          ease: "power1.inOut"
        });
      }
      return;
    }
  
        if (this.deadwood > 0 && this.deadwood <= 10) {
      this.uiRenderer.showKnockButton(true);
            if (this.uiRenderer.knockButton) {
        gsap.to(this.uiRenderer.knockButton.scale, {
          x: 1.5, y: 1.5,
          duration: 0.5,
          repeat: 1,
          yoyo: true,
          ease: "power1.inOut"
        });
      }
      return;
    }
  
        this.uiRenderer.showDialog("Drag a card to discard!");
  
        const sprites = this.cardRenderer.playerHandContainer.children;
    let rightmost = null, maxX = -Infinity;
    for (const s of sprites) {
      if (s.x > maxX) {
        maxX = s.x;
        rightmost = s;
      }
    }
    if (rightmost) {
            this.cardRenderer.applySpecialHighlight(rightmost, 0xFF00FF, 0.4);
      gsap.to(rightmost.scale, {
        x: 0.6, y: 0.6,
        duration: 0.2,
        repeat: 3,
        yoyo: true
      });
  
            const worldPos = this.cardRenderer.playerHandContainer.toGlobal(new PIXI.Point(rightmost.x, rightmost.y));
      this.handCursor.showAt(worldPos.x, worldPos.y - 40);
    }
  }

  

    updateLoadingProgress(progress) {
    if (!this.progressBarFill) return;
    
    const progressBarWidth = 300;
    this.progressBarFill.clear();
    this.progressBarFill.beginFill(0x4CAF50);
    this.progressBarFill.drawRoundedRect(0, 0, progress * progressBarWidth, 20, 10);
    this.progressBarFill.endFill();
  }

    hideLoadingScreen() {
    if (this.loadingContainer) {
      this.app.stage.removeChild(this.loadingContainer);
      this.loadingContainer = null;
    }
  }

    showErrorMessage(message) {
    const errorContainer = new PIXI.Container();
    
        const graphics = new PIXI.Graphics();
    graphics.beginFill(0x000000, 0.8);
    graphics.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    graphics.endFill();
    
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

    resize() {
    const width = window.innerWidth;
  const height = window.innerHeight;
  
  this.app.renderer.resize(width, height);
  
    if (this.containers.background.children[0]) {
    const bg = this.containers.background.children[0];
    
        if (bg instanceof PIXI.Sprite && bg.texture) {
            const scaleX = width / bg.texture.width;
      const scaleY = height / bg.texture.height;
      const scale = Math.max(scaleX, scaleY);       
            bg.scale.set(scale, scale);
      
            bg.x = (width - bg.width) / 2;
      
            const isSmallScreen = height < 570;       
      if (isSmallScreen) {
                const cardHeight = this.config.cardHeight || 120;
        bg.y = (height - bg.height) / 2 + cardHeight;
      } else {
                bg.y = (height - bg.height) / 2;
      }
    } 
        else if (bg instanceof PIXI.Graphics) {
      bg.width = width;
      bg.height = height;
    }
  }
  
    if (this.uiRenderer) {
    this.uiRenderer.resize(width, height);
  }
  
    if (this.cardRenderer) {
    this.cardRenderer.updatePositions(
      this.uiRenderer?.adHeight || 0,
      this.uiRenderer?.navHeight || 0,
      width,
      height
    );
  }
  
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
  
    if (this.loadingContainer) {
    this.loadingContainer.children.forEach(child => {
      if (child instanceof PIXI.Graphics && !child.children.length) {
        if (child === this.progressBarFill) {
                    child.position.set((width - 300) / 2, height / 2);
        } else if (child.width > 100) {
                    child.clear();
          child.beginFill(0x000000, 0.7);
          child.drawRect(0, 0, width, height);
          child.endFill();
        } else {
                    child.position.set((width - 300) / 2, height / 2);
        }
      } else if (child instanceof PIXI.Text) {
        child.position.set(width / 2, height / 2 - 30);
      }
    });
  }
}
}