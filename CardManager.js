export class CardManager {
  constructor(config) {
    this.config = config;
    this.playerCards = [];
    this.opponentCards = [];
    this.discardPile = [];
    this.onCardClick = null;
    this.animations = [];
  }

  initialize() {
    this.playerCards = [];
    this.opponentCards = [];
    this.discardPile = [];
  }

  

  drawCardFromdeck() {
    const suits = ['clubs', 'diamonds', 'hearts', 'spades'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const randomSuit = suits[Math.floor(Math.random() * suits.length)];
    const randomValue = values[Math.floor(Math.random() * values.length)];
    return {
      id: Math.floor(Math.random() * 1000) + 200,
      value: randomValue,
      suit: randomSuit,
      filename: `${randomValue}_${randomSuit.charAt(0).toUpperCase()}${randomSuit.slice(1)}.webp`
    };
  }
  
    takeCardFromdeck(isPlayer = true) {
    const newCard = this.drawCardFromdeck();
    
    if (isPlayer) {
      this.playerCards.push(newCard);
      return { card: newCard, index: this.playerCards.length - 1 };
    } else {
            const opponentCard = { ...newCard, faceDown: true };
      this.opponentCards.push(opponentCard);
      return { card: opponentCard, index: this.opponentCards.length - 1 };
    }
  }
  
    takeCardFromDiscard(isPlayer = true) {
    if (this.discardPile.length === 0) return null;
    
    const topCard = this.discardPile.pop();
    
    if (isPlayer) {
      this.playerCards.push(topCard);
      return { card: topCard, index: this.playerCards.length - 1 };
    } else {
            const opponentCard = { ...topCard, faceDown: true };
      this.opponentCards.push(opponentCard);
      return { card: opponentCard, index: this.opponentCards.length - 1 };
    }
  }
  
    discardCardFromHand(cardId, isPlayer = true) {
    let cardIndex = -1;
    let cardToDiscard = null;
    
    if (isPlayer) {
      cardIndex = this.playerCards.findIndex(card => card.id === cardId);
      if (cardIndex === -1) return null;
      
      cardToDiscard = this.playerCards[cardIndex];
      this.playerCards.splice(cardIndex, 1);
    } else {
            if (this.opponentCards.length === 0) return null;
      
      cardIndex = Math.floor(Math.random() * this.opponentCards.length);
      cardToDiscard = this.opponentCards[cardIndex];
      
                  cardToDiscard.faceDown = false;
      
      this.opponentCards.splice(cardIndex, 1);
    }
    
        this.discardPile.push(cardToDiscard);
    
    return { card: cardToDiscard, index: cardIndex };
  }
  
    playOpponentTurn(fromdeck = true) {
        let takenCard;
    
    if (fromdeck) {
      takenCard = this.takeCardFromdeck(false);
    } else {
      takenCard = this.takeCardFromDiscard(false);
    }
    
    if (!takenCard) return null;
    
        const randomCardId = this.opponentCards[Math.floor(Math.random() * this.opponentCards.length)].id;
    const discardedCard = this.discardCardFromHand(randomCardId, false);
    
    return {
      taken: takenCard,
      discarded: discardedCard
    };
  }

  async createCardSprite(cardData, faceDown = false) {
        if (!cardData) {
      console.warn("Invalid cardData: null or undefined");
      return this.createCardBackSprite();
    }
  
        if (faceDown || cardData.faceDown) {
      const backSprite = this.createCardBackSprite();
      backSprite.cardData = cardData;       return backSprite;
    }
  
        if (!cardData.suit || !cardData.value) {
      console.warn("Invalid cardData:", cardData);
      const fallbackSprite = this.createCardBackSprite();
      fallbackSprite.cardData = cardData;
      return fallbackSprite;
    }
  
    try {
            const texture = await this.assetLoader.loadTexture(
        `https://koshmosh43.github.io/playable/assets/cards/${cardData.suit}/${cardData.value}_${cardData.suit.charAt(0).toUpperCase()}${cardData.suit.slice(1)}.webp`
      );
      
      const sprite = new PIXI.projection.Sprite3d(texture);
      sprite.anchor.set(0.5);
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      sprite.interactive = true;
      sprite.buttonMode = true;
      sprite.cardData = cardData;
      return sprite;
    } catch (error) {
      console.warn(`Error loading card texture for ${cardData.value} of ${cardData.suit}:`, error);
      
            const fallbackSprite = new PIXI.projection.Sprite3d(PIXI.Texture.WHITE);
      fallbackSprite.anchor.set(0.5);
      fallbackSprite.width = this.config.cardWidth;
      fallbackSprite.height = this.config.cardHeight;
      fallbackSprite.interactive = true;
      fallbackSprite.buttonMode = true;
      fallbackSprite.cardData = cardData;
      
            this.createFallbackCardTexture(fallbackSprite, cardData);
      
      return fallbackSprite;
    }
  }

  createCardBackGraphics() {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0x0000AA);
    graphics.drawRoundedRect(0, 0, this.config.cardWidth, this.config.cardHeight, 5);
    graphics.endFill();
    graphics.lineStyle(2, 0xFFFFFF);
    graphics.drawRoundedRect(5, 5, this.config.cardWidth - 10, this.config.cardHeight - 10, 3);
    return graphics;
  }

  createCardGraphics(cardData) {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0xFFFFFF);
    graphics.drawRoundedRect(0, 0, this.config.cardWidth, this.config.cardHeight, 5);
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
    suitText.position.set(this.config.cardWidth / 2, this.config.cardHeight / 2);
    graphics.addChild(suitText);
    const valueText2 = new PIXI.Text(cardData.value, {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: color,
      fontWeight: 'bold'
    });
    valueText2.anchor.set(1, 1);
    valueText2.position.set(this.config.cardWidth - 5, this.config.cardHeight - 5);
    graphics.addChild(valueText2);
    return graphics;
  }
  
    createCardFlipAnimation(card, container, from, to, isRevealing = true) {
        return Promise.all([
      this.createCardSprite(card, false, this.assetLoader),        this.createCardSprite({...card, faceDown: true}, true, this.assetLoader)      ]).then(([frontSprite, backSprite]) => {
            frontSprite.anchor.set(0.5);
      backSprite.anchor.set(0.5);
      
            frontSprite.x = this.config.cardWidth / 2;
      frontSprite.y = this.config.cardHeight / 2;
      backSprite.x = this.config.cardWidth / 2;
      backSprite.y = this.config.cardHeight / 2;
      
            if (isRevealing) {
                frontSprite.visible = false;
        backSprite.visible = true;
        frontSprite.scale.x = 0;
        backSprite.scale.x = 1;
      } else {
                frontSprite.visible = true;
        backSprite.visible = false;
        frontSprite.scale.x = 1;
        backSprite.scale.x = 0;
      }
      
            const animContainer = new PIXI.Container();
      animContainer.x = from.x;
      animContainer.y = from.y;
      animContainer.addChild(frontSprite);
      animContainer.addChild(backSprite);
      container.addChild(animContainer);
      
            const timeline = gsap.timeline();
      
            timeline.to(animContainer, {
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
        duration: 0.3,
        ease: "power1.out"
      });
      
      if (isRevealing) {
                timeline.to(backSprite.scale, {
          x: 0,
          duration: 0.2,
          ease: "power1.in",
          onComplete: () => {
            backSprite.visible = false;
            frontSprite.visible = true;
          }
        });
        
        timeline.to(frontSprite.scale, {
          x: 1,
          duration: 0.2,
          ease: "power1.out"
        });
      } else {
                timeline.to(frontSprite.scale, {
          x: 0,
          duration: 0.2,
          ease: "power1.in",
          onComplete: () => {
            frontSprite.visible = false;
            backSprite.visible = true;
          }
        });
        
        timeline.to(backSprite.scale, {
          x: 1,
          duration: 0.2,
          ease: "power1.out"
        });
      }
      
            timeline.to(animContainer, {
        x: to.x,
        y: to.y,
        duration: 0.3,
        ease: "power1.in",
        onComplete: () => {
          container.removeChild(animContainer);
        }
      });
      
      return timeline;
    });
  }

  calculateDeadwood() {
    return this.playerCards.reduce((sum, card) => {
      if (card.value === 'A') return sum + 1;
      if (['J', 'Q', 'K'].includes(card.value)) return sum + 10;
      return sum + (parseInt(card.value) || 0);
    }, 0);
  }
}