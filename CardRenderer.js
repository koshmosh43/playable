export class CardRenderer {
  constructor(app, assetLoader, config) {
    this.app = app;
    this.assetLoader = assetLoader;
    this.config = config;
    
    // Card containers
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
    
    this.playerHandContainer = new PIXI.Container();
    this.opponentHandContainer = new PIXI.Container();
    this.deckContainer = new PIXI.Container();
    this.discardContainer = new PIXI.Container();
    this.animationContainer = new PIXI.Container();
    
    // Z-indices for correct layering
    this.playerHandContainer.zIndex = 50;
    this.opponentHandContainer.zIndex = 5;
    this.deckContainer.zIndex = 45;
    this.discardContainer.zIndex = 45;
    this.animationContainer.zIndex = 150;
    
    // Enable sorting children by z-index
    this.playerHandContainer.sortableChildren = true;
    this.discardContainer.sortableChildren = true;
    this.deckContainer.sortableChildren = true;
    
    this.init();
  }
  
  init() {
    // Add all containers to main container
    this.container.addChild(this.playerHandContainer);
    this.container.addChild(this.opponentHandContainer);
    this.container.addChild(this.deckContainer);
    this.container.addChild(this.discardContainer);
    this.container.addChild(this.animationContainer);
  }
  
  sortCardsBySuitAndRank(cards) {
    // Suit order: clubs, diamonds, hearts, spades
    const suitOrder = {
      'clubs': 0,
      'diamonds': 1,
      'hearts': 2,
      'spades': 3
    };
    
    // Card value order: A, 2, 3, ..., 10, J, Q, K
    const valueOrder = {
      'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
    };
    
    // Sort by suit first, then by value within each suit
    return [...cards].sort((a, b) => {
      // First sort by suit
      const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
      if (suitDiff !== 0) return suitDiff;
      
      // Then sort by value within the same suit
      return valueOrder[a.value] - valueOrder[b.value];
    });
  }
  
  // Update the card display based on game state
  async updateDisplay(gameState) {
    if (!gameState) return;
    
    // Clear all containers
    this.playerHandContainer.removeChildren();
    this.opponentHandContainer.removeChildren();
    this.deckContainer.removeChildren();
    this.discardContainer.removeChildren();
    
    // Render player cards
    if (gameState.playerCards && gameState.playerCards.length > 0) {
      await this.renderPlayerHand(gameState.playerCards, gameState.selectedCard, gameState.possibleMelds);
    }
    
    // Render opponent cards
    if (gameState.opponentCards && gameState.opponentCards.length > 0) {
      await this.renderOpponentHand(gameState.opponentCards);
    }
    
    // Render deck
    await this.renderDeck(gameState.deckCount);
    
    // Render discard pile
    await this.renderDiscardPile(gameState.discardPile);
  }
  
  // Render player's hand of cards with fan effect
  async renderPlayerHand(playerCards, selectedCard, possibleMelds) {
    if (!playerCards || !playerCards.length) return;

    
    
    // Use cards as is, sorting happens in game.js
    const sortedCards = playerCards;
    
    const spacing = this.config.fanDistance || 30;
    const fanAngle = this.config.fanAngle || 10;
    
    // Create sets for quick lookup of cards in melds
    const setCardIds = new Set();
    const runCardIds = new Set();
    
    // Check possibleMelds format and extract card IDs
    if (possibleMelds) {
      if (possibleMelds.sets && possibleMelds.runs) {
        // New format with sets and runs
        possibleMelds.sets.forEach(meld => {
          meld.cards.forEach(card => setCardIds.add(card.id));
        });
        
        possibleMelds.runs.forEach(meld => {
          meld.cards.forEach(card => runCardIds.add(card.id));
        });
      } else if (Array.isArray(possibleMelds)) {
        // Old format (array of melds)
        possibleMelds.forEach(meld => {
          meld.forEach(card => runCardIds.add(card.id));
        });
      }
    }
    
    // Create card sprites - ALWAYS IN A CONTINUOUS FAN
    for (let index = 0; index < sortedCards.length; index++) {
      const cardData = sortedCards[index];
      const sprite = await this.createCardSprite(cardData, false);
      sprite.zIndex = index;
      
      // Calculate position and rotation in fan
      const totalCards = sortedCards.length;
      const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
      const rotation = -fanAngle/2 + index * anglePerCard;
      
      // Set anchor point
      sprite.anchor.set(0.5, 0.9);
      
      // Determine if this is a special card
      const isSetCard = setCardIds.has(cardData.id);
      const isRunCard = runCardIds.has(cardData.id);
      
      // Regular fan position - CRITICAL: All cards must be in one continuous fan
      let xPos = -((totalCards - 1) * spacing / 2) + index * spacing;
      let yPos = Math.sin(rotation * Math.PI / 180) * 10;
      
      sprite.x = xPos;
      sprite.y = yPos;
      sprite.rotation = -(rotation * Math.PI / 180);
      
      // Interactive properties
      sprite.interactive = true;
      sprite.buttonMode = true;
      sprite.cardData = cardData;
      sprite.on('pointerdown', this.handleCardClick.bind(this, cardData, 'player'));
      
      // Default z-index
      sprite.zIndex = index;
      
      // Apply highlighting based on card type - only if needed
      if (selectedCard && selectedCard.id === cardData.id) {
        // Selected card (Purple highlight)
        this.applySelectedHighlight(sprite);
      } else if (isSetCard) {
        // Set cards (Yellow highlight)
        this.applySpecialHighlight(sprite, 0xFFFE7A, 0.2);
      } else if (isRunCard) {
        // Run cards (Green highlight)
        this.applySpecialHighlight(sprite, 0x98FB98, 0.2);
      }
      
      // Add to container
      this.playerHandContainer.addChild(sprite);
    }
  }
  
  // Apply highlight for selected card with more subtle effect
applySelectedHighlight(sprite) {
  // Create a color matrix filter
  const selectedColorMatrix = new PIXI.filters.ColorMatrixFilter();
  
  // Instead of tint, use subtler matrix adjustments
  // Slightly amplify purple/violet color channels
  selectedColorMatrix.matrix[0] = 1.05; // Red channel (slight boost)
  selectedColorMatrix.matrix[6] = 0.95; // Green channel (slight reduction)
  selectedColorMatrix.matrix[12] = 1.1; // Blue channel (boost)
  
  // Apply the filter
  sprite.filters = [selectedColorMatrix];
  
  // Slightly raise the card
  sprite.y -= 10;
}

// Apply special highlight with more subtle effect
applySpecialHighlight(sprite, color, alpha) {
  if (!sprite) return;
  
  // Create a color matrix filter
  const colorMatrix = new PIXI.filters.ColorMatrixFilter();
  
  // For green highlights (runs) - MORE SATURATED
  if (color === 0x98FB98) {
    colorMatrix.matrix[0] = 0.92;  // Reduce red further
    colorMatrix.matrix[6] = 1.12;  // Boost green more
    colorMatrix.matrix[12] = 0.92; // Reduce blue further
  } 
  // For yellow highlights (sets) - MORE SATURATED
  else if (color === 0xFFFE7A) {
    colorMatrix.matrix[0] = 1.09;  // Boost red more
    colorMatrix.matrix[6] = 1.09;  // Boost green more
    colorMatrix.matrix[12] = 0.80; // Reduce blue significantly more
  }
  // For purple selections - UNCHANGED FROM PREVIOUS
  else if (color === 0x9C27B0) {
    colorMatrix.matrix[0] = 1.05;  // Boost red slightly
    colorMatrix.matrix[6] = 0.95;  // Reduce green
    colorMatrix.matrix[12] = 1.1;  // Boost blue more
  }
  
  // Apply the filter
  sprite.filters = [colorMatrix];
}

  clearAllHighlights() {
    // Clear highlights from all cards in player hand
    if (this.playerHandContainer) {
      this.playerHandContainer.children.forEach(sprite => {
        if (sprite.filters) {
          sprite.filters = null;
        }
      });
    }
  }

  // Add visual feedback when a card is clicked
  enhanceCardClickFeedback(sprite) {
    if (!sprite) return;
    
    // Apply a subtle pop effect
    gsap.timeline()
      .to(sprite.scale, {
        x: 1.1, y: 1.1,
        duration: 0.1,
        ease: "power1.out"
      })
      .to(sprite.scale, {
        x: 1, y: 1,
        duration: 0.1,
        ease: "power1.in"
      });
    
    // Add a ripple effect
    const ripple = new PIXI.Graphics();
    ripple.beginFill(0xFFFFFF, 0.2);
    ripple.drawCircle(0, 0, 30);
    ripple.endFill();
    ripple.x = this.config.cardWidth / 2;
    ripple.y = this.config.cardHeight / 2;
    ripple.alpha = 0.7;
    ripple.scale.set(0.5);
    
    sprite.addChild(ripple);
    
    gsap.to(ripple, {
      alpha: 0,
      scale: 2,
      duration: 0.4,
      ease: "power1.out",
      onComplete: () => {
        sprite.removeChild(ripple);
      }
    });
  }

  // Animate card taking from deck or discard pile
  animateCardTake(cardData, source, destIndex) {
    if (!cardData) return;
    
    // Determine starting position (deck or discard)
    const startX = source === 'deck' 
      ? this.deckContainer.x + this.config.cardWidth / 2
      : this.discardContainer.x + this.config.cardWidth / 2;
    
    const startY = source === 'deck'
      ? this.deckContainer.y + this.config.cardHeight / 2
      : this.discardContainer.y + this.config.cardHeight / 2;
    
    // Calculate final position in player's hand
    const spacing = this.config.fanDistance || 30;
    const totalCards = this.playerHandContainer.children.length;
    const fanAngle = this.config.fanAngle || 10;
    
    // Calculate position for this card in hand
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + destIndex * anglePerCard;
    const finalRotation = -(rotation * Math.PI / 180);
    
    const finalX = this.playerHandContainer.x - ((totalCards - 1) * spacing / 2) + destIndex * spacing;
    const finalY = this.playerHandContainer.y + Math.sin(rotation * Math.PI / 180) * 10;
    
    // Create card sprite for animation
    this.createCardSprite(cardData, false)
      .then(sprite => {
        // Setup sprite
        sprite.anchor.set(0.5, 0.9);
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.cardData = cardData;
        
        // Initial position and settings
        sprite.x = startX;
        sprite.y = startY;
        sprite.rotation = 0;
        sprite.scale.set(0.9);
        sprite.alpha = 1;
        sprite.zIndex = 200;
        
        // Add to animation container
        this.animationContainer.addChild(sprite);
        
        // Create arc animation
        const timeline = gsap.timeline({
          onComplete: () => {
            // Remove animation sprite when complete
            this.animationContainer.removeChild(sprite);
          }
        });
        
        // Calculate arc points
        const midX = startX + (finalX - startX) * 0.5;
        const highPoint = Math.min(startY, finalY) - 150; // High arc point
        
        // First part - moving up along arc
        timeline.to(sprite, {
          x: midX,
          y: highPoint,
          rotation: finalRotation * 0.5,
          scale: 1.1, // Slightly enlarge card at highest point
          duration: 0.4,
          ease: "power1.out"
        });
        
        // Second part - moving down into hand
        timeline.to(sprite, {
          x: finalX,
          y: finalY,
          rotation: finalRotation,
          scale: 1,
          duration: 0.3,
          ease: "power1.in"
        });
      })
      .catch(error => {
        console.error("Error in card take animation:", error);
      });
  }
  
  // Render opponent's hand (face down cards)
  async renderOpponentHand(opponentCards) {
    if (!opponentCards || !opponentCards.length) return;
    
    const spacing = this.config.fanDistance || 30;
    const fanAngle = this.config.fanAngle || 10;
    
    // Create sprites for each card
    for (let index = 0; index < opponentCards.length; index++) {
      const cardData = opponentCards[index];
      const sprite = await this.createCardSprite(cardData, true);
      
      // Calculate position and rotation in fan
      const totalCards = opponentCards.length;
      const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
      const rotation = -fanAngle/2 + index * anglePerCard;
      
      // Set anchor to bottom center for better fan effect
      sprite.anchor.set(0.5, 0.9);
      
      // Position in fan
      sprite.x = (totalCards - 1) * spacing / 2 - index * spacing;
      sprite.y = Math.sin(rotation * Math.PI / 180) * 10;
      sprite.rotation = rotation * Math.PI / 180;
      
      // Set exact fixed dimensions
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      
      this.opponentHandContainer.addChild(sprite);
    }
  }
  
  // Render the deck
  async renderDeck(deckCount) {
    if (!deckCount) deckCount = 0;
    
    const maxVisible = 5;
    const visibleCount = Math.min(deckCount, maxVisible);
    
    // Create sprites for visible deck cards
    for (let i = 0; i < visibleCount; i++) {
      const sprite = await this.createCardSprite({ faceDown: true }, true);
      
      // Offset each card slightly
      sprite.x = 0;
      sprite.y = -3 * i;
      sprite.zIndex = i;
      
      // If this is the top card and deck is not empty, make it interactive
      if (i === visibleCount - 1 && deckCount > 0) {
        // Add card counter
        this.addDeckCounter(sprite, deckCount);
        
        // Make top card interactive
        sprite.interactive = true;
        sprite.buttonMode = true;
        sprite.on('pointerdown', () => {
          this.handleCardClick({ faceDown: true }, 'deck');
        });
      }
      
      this.deckContainer.addChild(sprite);
    }
  }
  
  // Add counter to deck
  addDeckCounter(sprite, deckCount) {
    // Create container for counter
    const countContainer = new PIXI.Container();
    countContainer.zIndex = 999;
    
    const scaleFactor = 5;
    
    // Large ellipse (counter background)
    const ellipse = new PIXI.Graphics();
    ellipse.lineStyle(4, 0xFFFFFF);
    ellipse.beginFill(0x3366CC);
    ellipse.drawEllipse(0, 0, 22 * scaleFactor, 30 * scaleFactor);
    ellipse.endFill();
    
    // Additional outline
    ellipse.lineStyle(4, 0x000000);
    ellipse.drawEllipse(0, 0, 20 * scaleFactor, 28 * scaleFactor);
    
    // Counter text
    const countText = new PIXI.Text(`${deckCount}`, {
      fontFamily: "Arial",
      fontSize: 22 * scaleFactor,
      fontWeight: "bold",
      fill: 0xFFFFFF
    });
    countText.anchor.set(0.5);
    
    countContainer.addChild(ellipse);
    countContainer.addChild(countText);
    
    // Position container in center of card
    countContainer.x = this.config.cardWidth * 2.3;
    countContainer.y = this.config.cardHeight * 2.1;
    
    // Add container to card
    sprite.addChild(countContainer);
  }
  
  // Render the discard pile
  async renderDiscardPile(discardPile) {
    this.discardContainer.removeChildren();
    
    if (discardPile && discardPile.length > 0) {
      // Show all cards in the discard pile, up to 5 maximum
      const visibleDiscards = Math.min(discardPile.length, 5);
      
      // Centered position for all cards in the discard pile
      const centerX = this.config.cardWidth / 2;
      const centerY = this.config.cardHeight / 2;
      
      // Show cards starting from bottom of stack
      for (let i = 0; i < visibleDiscards; i++) {
        const discardIndex = discardPile.length - visibleDiscards + i;
        const discard = discardPile[discardIndex];
        
        const sprite = await this.createCardSprite(discard, false);
        
        // Increase card size
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        
        // Set anchor to center for proper rotation
        sprite.anchor.set(0.5);
        
        // Apply small random rotation and offset for natural look
        // Use seeded random to be more consistent
        const randomRotation = ((i * 137 + 547) % 100) / 500 - 0.1; // Between -0.1 and 0.1
        const randomOffsetX = ((i * 263 + 821) % 10) - 5;           // Between -5 and 5
        const randomOffsetY = ((i * 521 + 347) % 10) - 5;           // Between -5 and 5
        
        // Always center the card with small random variations
        sprite.x = centerX + randomOffsetX;
        sprite.y = centerY + randomOffsetY;
        sprite.rotation = randomRotation;
        
        // Z-index for proper layering
        sprite.zIndex = i;
        
        // Make top card interactive
        if (i === visibleDiscards - 1) {
          sprite.interactive = true;
          sprite.buttonMode = true;
          sprite.on('pointerdown', this.handleCardClick.bind(this, discard, 'discard'));
        }
        
        this.discardContainer.addChild(sprite);
      }
      
      // Sort the discard container children to ensure proper layering
      this.discardContainer.sortChildren();
    } else {
      // Empty discard
      const emptyDiscard = new PIXI.Graphics();
      emptyDiscard.beginFill(0xFFFFFF, 0.2);
      emptyDiscard.drawRoundedRect(0, 0, this.config.cardWidth, this.config.cardHeight, 5);
      emptyDiscard.endFill();
      
      const emptyText = new PIXI.Text("Empty", {
        fontFamily: "Arial",
        fontSize: 16,
        fill: 0xFFFFFF,
        align: 'center'
      });
      emptyText.anchor.set(0.5);
      emptyText.x = this.config.cardWidth * 0.5;
      emptyText.y = this.config.cardHeight * 0.5;
      
      emptyDiscard.addChild(emptyText);
      this.discardContainer.addChild(emptyDiscard);
    }
  }
  
  // Create a card sprite
  async createCardSprite(cardData, isBack) {
    let sprite;
    
    try {
      if (isBack || cardData.faceDown) {
        // Card back
        const cardBackTexture = await this.assetLoader.loadTexture('assets/CardBack_Blue.webp');
        sprite = new PIXI.Sprite(cardBackTexture);
      } else {
        // Card front
        const cardPath = `assets/cards/${cardData.suit}/${cardData.filename}`;
        const cardTexture = await this.assetLoader.loadTexture(cardPath);
        sprite = new PIXI.Sprite(cardTexture);
      }
      
      // Set card dimensions
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
    } catch (error) {
      console.warn("Using fallback card graphics", error);
      sprite = this.createFallbackCardGraphics(cardData, isBack);
    }
    
    // Store card data with sprite
    sprite.cardData = cardData;
    return sprite;
  }
  
  // Create fallback card graphics if texture loading fails
  createFallbackCardGraphics(cardData, isBack) {
    const graphics = new PIXI.Graphics();
    
    if (isBack || cardData.faceDown) {
      // Card back
      graphics.beginFill(0x0000AA);
      graphics.drawRoundedRect(0, 0, this.config.cardWidth, this.config.cardHeight, 5);
      graphics.endFill();
      graphics.lineStyle(2, 0xFFFFFF);
      graphics.drawRoundedRect(5, 5, this.config.cardWidth - 10, this.config.cardHeight - 10, 3);
    } else {
      // Card front
      graphics.beginFill(0xFFFFFF);
      graphics.drawRoundedRect(0, 0, this.config.cardWidth, this.config.cardHeight, 5);
      graphics.endFill();
      
      const isRed = cardData.suit === 'hearts' || cardData.suit === 'diamonds';
      const color = isRed ? 0xFF0000 : 0x000000;
      
      // Value text (top left)
      const valueText = new PIXI.Text(cardData.value, {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: color,
        fontWeight: 'bold'
      });
      valueText.position.set(5, 5);
      graphics.addChild(valueText);
      
      // Suit symbol
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
      
      // Value text (bottom right)
      const valueText2 = new PIXI.Text(cardData.value, {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: color,
        fontWeight: 'bold'
      });
      valueText2.anchor.set(1, 1);
      valueText2.position.set(this.config.cardWidth - 5, this.config.cardHeight - 5);
      graphics.addChild(valueText2);
    }
    
    return graphics;
  }
  
  // Set card click handler
  setCardClickHandler(handler) {
    this.onCardClick = handler;
  }
  
  // Handle card click
  handleCardClick(cardData, source) {
    if (this.onCardClick) {
      this.onCardClick(cardData, source);
    }
  }
  
  // Animate card dealing
  animateDealingCard(cardData, target, index, onComplete) {
    if (!cardData) {
      if (onComplete) onComplete();
      return;
    }
    
    // Use actual deck position
    const deckX = this.deckContainer.x + this.config.cardWidth / 2;
    const deckY = this.deckContainer.y + this.config.cardHeight / 2;
    
    // Determine final position
    let targetContainer, finalX, finalY, finalRotation;
    const spacing = this.config.fanDistance || 30;
    const fanAngle = this.config.fanAngle || 10;
    
    if (target === 'player') {
      targetContainer = this.playerHandContainer;
      const totalCards = 10; // Standard hand size
      const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
      const rotation = -fanAngle/2 + index * anglePerCard;
      
      finalX = -((totalCards - 1) * spacing / 2) + index * spacing;
      finalY = Math.sin(rotation * Math.PI / 180) * 10;
      finalRotation = -(rotation * Math.PI / 180);
    } else {
      targetContainer = this.opponentHandContainer;
      const totalCards = 10;
      const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
      const rotation = -fanAngle/2 + index * anglePerCard;
      
      finalX = (totalCards - 1) * spacing / 2 - index * spacing;
      finalY = Math.sin(rotation * Math.PI / 180) * 10;
      finalRotation = rotation * Math.PI / 180;
    }
    
    // Create card sprite
    this.createCardSprite(cardData, cardData.faceDown)
      .then(sprite => {
        sprite.anchor.set(0.5, 0.9);
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.cardData = cardData;
        
        // Global coordinates
        const startX = deckX;
        const startY = deckY;
        const endX = targetContainer.x + finalX;
        const endY = targetContainer.y + finalY;
        
        // Initial settings
        sprite.x = startX;
        sprite.y = startY;
        sprite.rotation = 0;
        sprite.scale.set(0.9);
        sprite.alpha = 1;
        sprite.zIndex = 200 + index;
        
        this.animationContainer.addChild(sprite);
        
        // Enhanced animation with natural arc
        const timeline = gsap.timeline({
          onComplete: () => {
            this.animationContainer.removeChild(sprite);
            
            // Create permanent sprite in hand
            const permanentSprite = new PIXI.Sprite(sprite.texture);
            permanentSprite.anchor.set(0.5, 0.9);
            permanentSprite.width = this.config.cardWidth;
            permanentSprite.height = this.config.cardHeight;
            permanentSprite.cardData = cardData;
            permanentSprite.x = finalX;
            permanentSprite.y = finalY;
            permanentSprite.rotation = finalRotation;
            permanentSprite.zIndex = index;
            
            if (target === 'player' && !cardData.faceDown) {
              permanentSprite.interactive = true;
              permanentSprite.buttonMode = true;
              permanentSprite.on('pointerdown', this.handleCardClick.bind(this, cardData, 'player'));
            }
            
            targetContainer.addChild(permanentSprite);
            
            if (onComplete) onComplete();
          }
        });
        
        // Calculate intermediate point with arc
        const midX = startX + (endX - startX) * 0.5;
        const midY = startY + (endY - startY) * 0.3 - 30; // Arc upward
        
        // First part - movement to intermediate point
        timeline.to(sprite, {
          x: midX,
          y: midY,
          rotation: finalRotation * 0.3,
          duration: 0.15,
          ease: "power1.out"
        });
        
        // Second part - completing movement
        timeline.to(sprite, {
          x: endX,
          y: endY,
          rotation: finalRotation,
          scale: 1,
          duration: 0.15,
          ease: "power1.in"
        });
      })
      .catch(error => {
        console.error("Error in dealing card animation:", error);
        if (onComplete) onComplete();
      });
  }
  
  // Animate discarding a card
  animateCardDiscard(cardData, sourceIndex) {
    // Starting position in player's hand
    const spacing = this.config.fanDistance || 30;
    const totalCards = this.playerHandContainer.children.length;
    const startX = this.playerHandContainer.x - ((totalCards - 1) * spacing / 2) + sourceIndex * spacing;
    const startY = this.playerHandContainer.y;
    
    // Final position (discard) - ALWAYS CENTER
    const endX = this.discardContainer.x + this.config.cardWidth / 2;
    const endY = this.discardContainer.y + this.config.cardHeight / 2;
    
    // Create card sprite
    this.createCardSprite(cardData, false)
      .then(sprite => {
        // Set anchor to center for proper positioning
        sprite.anchor.set(0.5);
        
        // Set exact dimensions
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        
        // Set initial position
        sprite.x = startX;
        sprite.y = startY;
        sprite.zIndex = 150;
        
        // Add to animation container
        this.animationContainer.addChild(sprite);
        
        // Animate movement while maintaining dimensions
        gsap.to(sprite, {
          duration: 0.5,
          x: endX,
          y: endY,
          ease: "power2.out",
          onComplete: () => {
            // Remove sprite from animation when complete
            this.animationContainer.removeChild(sprite);
          }
        });
      })
      .catch(error => {
        console.error("Error in card discard animation:", error);
      });
  }
  
  // Animate opponent taking a card
  animateOpponentCardTake(source) {
    // Starting position
    const startX = source === 'deck'
      ? this.deckContainer.x + this.config.cardWidth / 2
      : this.discardContainer.x + this.config.cardWidth / 2;
    const startY = source === 'deck'
      ? this.deckContainer.y + this.config.cardHeight / 2
      : this.discardContainer.y + this.config.cardHeight / 2;
    
    // Target position in opponent's hand
    const spacing = this.config.fanDistance || 30;
    const totalCards = this.opponentHandContainer.children.length + 1;
    const endX = this.opponentHandContainer.x + (totalCards - 1) * spacing / 2 - (totalCards - 1) * spacing;
    const endY = this.opponentHandContainer.y;
    
    // Create animation card (face down)
    const cardData = { faceDown: true };
    
    // Create sprite with card back
    this.createCardSprite(cardData, true)
      .then(sprite => {
        // Set exact dimensions
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        
        // Set position
        sprite.x = startX;
        sprite.y = startY;
        sprite.zIndex = 150;
        
        // Add to animation container
        this.animationContainer.addChild(sprite);
        
        // Animate with GSAP
        gsap.to(sprite, {
          duration: 0.5,
          x: endX,
          y: endY,
          ease: "power2.out",
          onComplete: () => {
            this.animationContainer.removeChild(sprite);
          }
        });
      })
      .catch(error => {
        console.error("Error in opponent card take animation:", error);
      });
  }
  
  // Animate opponent card discard
  animateOpponentCardDiscard(cardData, sourceIndex) {
    // Starting position in opponent's hand
    const spacing = this.config.fanDistance || 30;
    const totalCards = this.opponentHandContainer.children.length;
    const startX = this.opponentHandContainer.x + (totalCards - 1) * spacing / 2 - sourceIndex * spacing;
    const startY = this.opponentHandContainer.y;
    
    // Final position (discard)
    const endX = this.discardContainer.x + this.config.cardWidth / 2;
    const endY = this.discardContainer.y + this.config.cardHeight / 2;
    
    // Use provided card data or generate random card
    const cardToUse = cardData || {
      value: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][Math.floor(Math.random() * 13)],
      suit: ['hearts', 'diamonds', 'clubs', 'spades'][Math.floor(Math.random() * 4)],
      filename: null
    };
    
    // Generate filename if missing
    if (!cardToUse.filename && cardToUse.value && cardToUse.suit) {
      cardToUse.filename = `${cardToUse.value}_${cardToUse.suit.charAt(0).toUpperCase()}${cardToUse.suit.slice(1)}.webp`;
    }
    
    // Create both face up and face down card sides
    Promise.all([
      this.createCardSprite(cardToUse, false), // Face up
      this.createCardSprite({...cardToUse, faceDown: true}, true) // Face down
    ]).then(([faceUpCard, faceDownCard]) => {
      // Create container for animation
      const flipContainer = new PIXI.Container();
      flipContainer.x = startX;
      flipContainer.y = startY;
      flipContainer.zIndex = 200;
      
      // Set anchor points to center for proper flipping
      faceUpCard.anchor.set(0.5);
      faceDownCard.anchor.set(0.5);
      
      // CRITICAL: Set fixed dimensions for both card sides
      faceUpCard.width = this.config.cardWidth;
      faceUpCard.height = this.config.cardHeight;
      faceDownCard.width = this.config.cardWidth;
      faceDownCard.height = this.config.cardHeight;
      
      // Position both cards in center of container
      faceUpCard.x = 0;
      faceUpCard.y = 0;
      faceDownCard.x = 0;
      faceDownCard.y = 0;
      
      // Start with back visible
      faceUpCard.visible = false;
      faceDownCard.visible = true;
      faceDownCard.scale.x = 1; // Initial back scale
      faceUpCard.scale.x = 0;  // Initial front scale (compressed)
      
      // Add both card sides to container
      flipContainer.addChild(faceUpCard);
      flipContainer.addChild(faceDownCard);
      this.animationContainer.addChild(flipContainer);
      
      // Create animation with proportion preservation
      const timeline = gsap.timeline({
        onComplete: () => {
          this.animationContainer.removeChild(flipContainer);
        }
      });
      
      // Move to middle point
      timeline.to(flipContainer, {
        x: (startX + endX) / 2,
        y: (startY + endY) / 2,
        duration: 0.3,
        ease: "power2.out"
      });
      
      // Flip card - hide back
      timeline.to(faceDownCard.scale, {
        x: 0,
        duration: 0.15,
        ease: "sine.in",
        onComplete: () => {
          faceDownCard.visible = false;
          faceUpCard.visible = true;
        }
      });
      
      // Show front side
      timeline.to(faceUpCard.scale, {
        x: 1,
        duration: 0.15,
        ease: "sine.out"
      });
      
      // Move to final position
      timeline.to(flipContainer, {
        x: endX,
        y: endY,
        duration: 0.3,
        ease: "power2.in"
      });
    }).catch(error => {
      console.error("Error in card flip animation:", error);
    });
  }
  
  // Position containers on screen
  updatePositions(adHeight, navHeight, screenWidth, screenHeight) {
    // Player hand
    this.playerHandContainer.x = screenWidth / 2;
    this.playerHandContainer.y = screenHeight - this.config.cardHeight + 68;
    
    // Opponent hand
    this.opponentHandContainer.x = screenWidth / 2;
    this.opponentHandContainer.y = adHeight + navHeight + 100;
    
    // Deck
    this.deckContainer.x = screenWidth / 2 - this.config.cardWidth - 20;
    this.deckContainer.y = screenHeight / 2 - this.config.cardHeight / 2;
    
    // Discard pile
    this.discardContainer.x = screenWidth / 2 + 20;
    this.discardContainer.y = screenHeight / 2 - this.config.cardHeight / 2;
  }
}