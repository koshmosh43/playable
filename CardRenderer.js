export class CardRenderer {
  constructor(app, assetLoader, config) {
    this.app = app;
    this.assetLoader = assetLoader;
    this.config = config;
    this.isDragEnabled = true;
    this.draggingCard = null;  // Текущая перетаскиваемая карта
this.draggingCardSource = null; // Источник карты (deck/discard)
this.draggingCardData = null;  // Данные карты
this.playerHandZone = null;    // Зона веера карт игрока
    
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
    
    // Clear all containers - IMPORTANT: This ensures we don't get duplicates
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
      
      // Store original position for drag and drop
      sprite.originalPosition = { x: xPos, y: yPos, rotation: -(rotation * Math.PI / 180) };
      
      // Make card interactive - DRAG AND DROP SUPPORT
      sprite.interactive = true;
      sprite.buttonMode = true;
      sprite.cardData = cardData;
      
      // Add drag and drop functionality
      this.setupDragAndDrop(sprite, cardData);
      
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

  isOverPlayerHand(position) {
    if (!this.playerHandContainer) return false;
    
    // Получаем границы контейнера с веером карт
    const handBounds = this.playerHandContainer.getBounds();
    
    // Расширяем зону для удобства использования
    const padding = 60; // Увеличиваем до 60 (было 50) для лучшего эффекта
    const handZone = {
      left: handBounds.x - padding,
      right: handBounds.x + handBounds.width + padding,
      top: handBounds.y - padding * 1.5, // Делаем зону шире сверху для удобства
      bottom: handBounds.y + handBounds.height + padding
    };
    
    // Сохраняем зону веера для дальнейшего использования
    this.playerHandZone = handZone;
    
    // Проверяем, находится ли позиция внутри зоны веера
    return (
      position.x >= handZone.left &&
      position.x <= handZone.right &&
      position.y >= handZone.top &&
      position.y <= handZone.bottom
    );
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

setupDragAndDrop(sprite, cardData) {
  // Variables to track dragging state
  let isDragging = false;
  let dragStartData = null;
  let originalZIndex = sprite.zIndex;
  
  // Event handlers
  const onDragStart = (event) => {
    if (!this.isDragEnabled) return;
    
    isDragging = true;
    dragStartData = {
      x: event.data.global.x,
      y: event.data.global.y,
      spriteX: sprite.x,
      spriteY: sprite.y,
      spriteRotation: sprite.rotation
    };
    
    // Bring the card to the front while dragging
    originalZIndex = sprite.zIndex;
    sprite.zIndex = 1000;
    this.playerHandContainer.sortChildren();
    
    // Enlarge card slightly for better visibility
    sprite.scale.set(0.7);
    
    // Apply visual feedback that indicates dragging
    this.applySelectedHighlight(sprite);
    
    // Emit custom event that game can listen to
    const dragStartEvent = new CustomEvent('cardDragStart', { 
      detail: { cardData, sprite }
    });
    document.dispatchEvent(dragStartEvent);
  };
  
  const onDragMove = (event) => {
    if (!isDragging) return;
    
    // Calculate the new position based on the mouse/touch movement
    const newPosition = event.data.global;
    
    // Convert global coordinates to local container coordinates
    const newLocalPos = this.playerHandContainer.toLocal(newPosition);
    
    // Update sprite position
    sprite.x = newLocalPos.x;
    sprite.y = newLocalPos.y;
    
    // Keep the card upright while dragging
    sprite.rotation = 0;
    
    // ВАЖНОЕ ДОБАВЛЕНИЕ: Проверить, находится ли карта над отбоем
    // Преобразуем локальные координаты в глобальные для проверки
    const globalPos = sprite.toGlobal(new PIXI.Point(0, 0));
    const isOverDiscard = this.isOverDiscardPile(globalPos);
    
    // Если карта над отбоем, плавно уменьшаем ее до нормального размера
    // if (isOverDiscard && sprite.scale.x > 1.0) {
    //   // Плавно уменьшаем масштаб до нормального (1.0)
    //   gsap.to(sprite.scale, {
    //     x: 0.6, 
    //     y: 0.6,
    //     duration: 0.6, // Быстрая анимация для отзывчивости
    //     ease: "power2.out"
    //   });
    // } 
    // Если карта не над отбоем и уже уменьшена, возвращаем увеличенный размер
  //   else if (!isOverDiscard && sprite.scale.x < 1.29) {
  //     // Возвращаем увеличенный масштаб
  //     gsap.to(sprite.scale, {
  //       x: 0.8, 
  //       y: 0.8,
  //       duration: 0.5,
  //       ease: "power2.out"
  //     });
  //   }
  };
  
  const onDragEnd = (event) => {
    if (!isDragging) return;
    isDragging = false;
    
    // Get the sprite's global position
    const globalPos = sprite.toGlobal(new PIXI.Point(0, 0));
    
    // Check if the card was dropped over discard pile
    const isOverDiscard = this.isOverDiscardPile(globalPos);
    
    // Emit custom event that game can listen to
    const dragEndEvent = new CustomEvent('cardDragEnd', { 
      detail: { 
        cardData, 
        sprite, 
        targetArea: isOverDiscard ? 'discard' : 'hand',
        position: globalPos
      }
    });
    document.dispatchEvent(dragEndEvent);
    
    // Let the game handle the rest - it will decide what to do
    // If game doesn't handle it, the card will snap back
    this.snapCardBack(sprite);
  };
  
  // Add event listeners
  sprite
    .on('pointerdown', (event) => {
      event.stopPropagation();
      sprite.data = event.data;
      onDragStart(event);
    })
    .on('pointermove', onDragMove)
    .on('pointerup', onDragEnd)
    .on('pointerupoutside', onDragEnd);
}

startCardDragging(cardData, source) {
  console.log(`STARTING DRAG FROM ${source}`, cardData);

  // Остановить все анимации
  gsap.killTweensOf(this.deckContainer.scale);
  gsap.killTweensOf(this.discardContainer.scale);
  this.deckContainer.scale.set(1, 1);
  this.discardContainer.scale.set(1, 1);

  // ИСПРАВЛЕНИЕ: Удаляем ТОЛЬКО верхнюю карту из отбоя, а не всю стопку
  if (source === 'discard') {
    // Получаем количество карт в отбое
    const discardCount = this.discardContainer.children.length;
    
    // Если в отбое есть карты, удаляем только верхнюю (последнюю)
    if (discardCount > 0) {
      // Находим верхнюю (последнюю) карту в стопке
      const topCardIndex = discardCount - 1;
      const topCard = this.discardContainer.getChildAt(topCardIndex);
      
      // Удаляем только верхнюю карту
      this.discardContainer.removeChildAt(topCardIndex);
      
      console.log('Removed only the top card from discard pile!');
    }
  }

  // Если уже перетаскиваем карту, прекращаем
  if (this.draggingCard) return;
  
  // Сохраняем информацию о перетаскиваемой карте
  this.draggingCardSource = source;
  this.draggingCardData = cardData;
  
  // Создаем спрайт карты для перетаскивания
  this.createCardSprite(cardData, false).then(sprite => {
    this.draggingCard = sprite;
    
    // Настраиваем внешний вид перетаскиваемой карты
    sprite.anchor.set(0.5);
    sprite.width = this.config.cardWidth;
    sprite.height = this.config.cardHeight;
    sprite.alpha = 1;
    sprite.zIndex = 1000; // Поверх всех остальных элементов
    
    // Добавляем в контейнер анимаций
    this.animationContainer.addChild(sprite);
    
    // Определяем начальную позицию в зависимости от источника
    if (source === 'deck') {
      sprite.x = this.deckContainer.x + this.config.cardWidth / 2;
      sprite.y = this.deckContainer.y + this.config.cardHeight / 2;
    } else if (source === 'discard') {
      sprite.x = this.discardContainer.x + this.config.cardWidth / 2;
      sprite.y = this.discardContainer.y + this.config.cardHeight / 2;
    }
    
    // Удаляем предыдущие обработчики, если они были
    window.removeEventListener('mousemove', this.moveCardHandler);
    window.removeEventListener('touchmove', this.moveCardHandler);
    window.removeEventListener('mouseup', this.releaseCardHandler);
    window.removeEventListener('touchend', this.releaseCardHandler);
    
    // Устанавливаем обработчики событий
    window.addEventListener('mousemove', this.moveCardHandler);
    window.addEventListener('touchmove', this.moveCardHandler);
    window.addEventListener('mouseup', this.releaseCardHandler);
    window.addEventListener('touchend', this.releaseCardHandler);
    
    // Вызываем событие начала перетаскивания
    document.dispatchEvent(new CustomEvent('cardDragStarted', {
      detail: { cardData, source }
    }));
  }).catch(err => {
    console.error("Error creating dragging card sprite:", err);
  });
}

moveCardHandler = (event) => {
  if (!this.draggingCard) return;
  
  // Получаем координаты курсора/касания
  let clientX, clientY;
  
  if (event.type === 'touchmove') {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }
  
  // Конвертируем координаты экрана в координаты внутри игры
  const rect = this.app.view.getBoundingClientRect();
  const x = (clientX - rect.left) * (this.app.screen.width / rect.width);
  const y = (clientY - rect.top) * (this.app.screen.height / rect.height);
  
  // Обновляем позицию карты
  this.draggingCard.x = x;
  this.draggingCard.y = y;
  
  // ВАЖНОЕ ИЗМЕНЕНИЕ: Проверяем, находится ли карта над отбоем ИЛИ над веером игрока
  const position = { x, y };
  const isOverDiscard = this.isOverDiscardPile(position);
  const isOverPlayerHand = this.isOverPlayerHand(position);
  
  // Если карта над отбоем или над веером, плавно уменьшаем ее до нормального размера
  if ((isOverDiscard || isOverPlayerHand) && this.draggingCard.scale.x > 1.0) {
    // Плавно уменьшаем масштаб до нормального (1.0)
    gsap.to(this.draggingCard.scale, {
      x: 0.7, 
      y: 0.7,
      duration: 0.2, // Быстрая анимация для отзывчивости
      ease: "power2.out"
    });
  } 
  // Если карта НЕ над отбоем И НЕ над веером и уже уменьшена, возвращаем увеличенный размер
  else if (!isOverDiscard && !isOverPlayerHand && this.draggingCard.scale.x < 1.29) {
    // Возвращаем увеличенный масштаб
    gsap.to(this.draggingCard.scale, {
      x: 0.65, 
      y: 0.65,
      duration: 0.2,
      ease: "power2.out"
    });
  }
};

// CardRenderer.js

releaseCardHandler = (event) => {
  if (!this.draggingCard) return;

  // Immediately stop any pulsing animations and reset container scales
  gsap.killTweensOf(this.deckContainer.scale);
  gsap.killTweensOf(this.discardContainer.scale);
  this.deckContainer.scale.set(1, 1);
  this.discardContainer.scale.set(1, 1);

  // Get release coordinates
  let clientX, clientY;
  if (event.type === 'touchend') {
    const touch = event.changedTouches[0];
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  // Convert screen coordinates to game coordinates
  const rect = this.app.view.getBoundingClientRect();
  const x = (clientX - rect.left) * (this.app.screen.width / rect.width);
  const y = (clientY - rect.top) * (this.app.screen.height / rect.height);
  const position = { x, y };

  // Check where the card was dropped
  const isOverHand = this.isOverPlayerHand(position);
  const isOverDiscard = this.isOverDiscardPile(position);

  // Notify game logic about the drag and drop event
  document.dispatchEvent(new CustomEvent('cardDragReleased', {
    detail: {
      cardData: this.draggingCardData,
      source: this.draggingCardSource,
      targetArea: isOverHand ? 'hand' : (isOverDiscard ? 'discard' : 'none'),
      position
    }
  }));

  // Remove event listeners
  window.removeEventListener('mousemove', this.moveCardHandler);
  window.removeEventListener('touchmove', this.moveCardHandler);
  window.removeEventListener('mouseup', this.releaseCardHandler);
  window.removeEventListener('touchend', this.releaseCardHandler);

  // Handle animation and cleanup based on drop target
  if (isOverHand) {
    // If dropped over hand, animate to final size and add to hand
    gsap.to(this.draggingCard.scale, {
      x: 1.0, y: 1.0,
      duration: 0.15,
      ease: "power2.out",
      onComplete: () => this.addDraggingCardToHand()
    });
  } else if (isOverDiscard) {
    // If dropped on discard pile, just clean up the dragging state
    gsap.to(this.draggingCard.scale, {
      x: 1.0, y: 1.0,
      duration: 0.15,
      ease: "power2.out",
      onComplete: () => {
        if (this.draggingCard) {
          this.animationContainer.removeChild(this.draggingCard);
          this.draggingCard = null;
        }
        // Game will handle updating its state based on the cardDragReleased event
        this.draggingCardData = null;
        this.draggingCardSource = null;
      }
    });
  } else {
    // If dropped elsewhere, return card to original position
    this.returnDraggingCard();
  }
};


returnDraggingCard() {
  if (!this.draggingCard) return;
  
  // Определяем конечную позицию в зависимости от источника
  let targetX, targetY;
  if (this.draggingCardSource === 'deck') {
    targetX = this.deckContainer.x + this.config.cardWidth / 2;
    targetY = this.deckContainer.y + this.config.cardHeight / 2;
  } else if (this.draggingCardSource === 'discard') {
    targetX = this.discardContainer.x + this.config.cardWidth / 2;
    targetY = this.discardContainer.y + this.config.cardHeight / 2;
  }
  
  // Анимируем возврат карты
  gsap.to(this.draggingCard, {
    x: targetX,
    y: targetY,
    scale: 1,
    duration: 0.3,
    ease: "power2.inOut",
    onComplete: () => {
      // Удаляем карту после возврата
      if (this.draggingCard) {
        this.animationContainer.removeChild(this.draggingCard);
        this.draggingCard = null;
        this.draggingCardData = null;
        this.draggingCardSource = null;
      }
    }
  });
}

// 7. Метод для добавления карты в веер
addDraggingCardToHand() {
  if (!this.draggingCard || !this.draggingCardData) return;
  
  // Calculate where to add the new card in the fan
  const newIndex = this.calculateNewCardIndex();
  
  // Trigger event to notify the game that card was added to hand
  document.dispatchEvent(new CustomEvent('cardAddedToHand', {
    detail: {
      cardData: this.draggingCardData,
      source: this.draggingCardSource,
      index: newIndex
    }
  }));
  
  // Clean up the dragging card
  this.animationContainer.removeChild(this.draggingCard);
  this.draggingCard = null;
  this.draggingCardData = null;
  this.draggingCardSource = null;
}

// Create a sprite for a card (face up)
createCardSprite(cardData) {
  if (!cardData) return null;
  
  const cardWidth = this.config.cardWidth || 80;
  const cardHeight = this.config.cardHeight || 120;
  
  // Try to load card texture
  const sprite = new PIXI.Sprite();
  sprite.width = cardWidth;
  sprite.height = cardHeight;
  
  // Set anchor to center for better rotation
  sprite.anchor.set(0.5);
  
  const cardPath = `assets/cards/${cardData.suit}/${cardData.value}_${cardData.suit.charAt(0).toUpperCase()}${cardData.suit.slice(1)}.webp`;
  
  this.assetLoader.loadTexture(cardPath)
    .then(texture => {
      sprite.texture = texture;
    })
    .catch(err => {
      console.warn(`Could not load card texture for ${cardData.value} of ${cardData.suit}`, err);
      // Create fallback card
      this.createFallbackCardTexture(sprite, cardData);
    });
  
  // Store card data reference
  sprite.cardData = cardData;
  
  return sprite;
}

// Create a sprite for card back (face down)
createCardBackSprite() {
  const cardWidth = this.config.cardWidth || 80;
  const cardHeight = this.config.cardHeight || 120;
  
  // Create sprite
  const sprite = new PIXI.Sprite();
  sprite.width = cardWidth;
  sprite.height = cardHeight;
  
  // Set anchor to center for better rotation
  sprite.anchor.set(0.5);
  
  // Try to load card back texture
  this.assetLoader.loadTexture('assets/CardBack_Blue.webp')
    .then(texture => {
      sprite.texture = texture;
    })
    .catch(err => {
      console.warn("Could not load card back texture", err);
      // Create fallback card back
      const graphics = new PIXI.Graphics();
      graphics.beginFill(0x0000AA);
      graphics.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 10);
      graphics.endFill();
      
      // Add pattern to card back
      graphics.lineStyle(2, 0xFFFFFF);
      graphics.drawRoundedRect(-cardWidth/2 + 5, -cardHeight/2 + 5, cardWidth - 10, cardHeight - 10, 6);
      
      const texture = this.app.renderer.generateTexture(graphics);
      sprite.texture = texture;
    });
  
  return sprite;
}

// Create fallback card texture when card asset fails to load
createFallbackCardTexture(sprite, cardData) {
  const cardWidth = this.config.cardWidth || 80;
  const cardHeight = this.config.cardHeight || 120;
  
  const graphics = new PIXI.Graphics();
  
  // White card background
  graphics.beginFill(0xFFFFFF);
  graphics.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 10);
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
  valueText.position.set(-cardWidth/2 + 5, -cardHeight/2 + 5);
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
  suitText.position.set(0, 0);
  graphics.addChild(suitText);
  
  // Add reversed value at bottom right
  const valueText2 = new PIXI.Text(cardData.value, {
    fontFamily: 'Arial',
    fontSize: 16,
    fill: color,
    fontWeight: 'bold'
  });
  valueText2.anchor.set(1, 1);
  valueText2.position.set(cardWidth/2 - 5, cardHeight/2 - 5);
  graphics.addChild(valueText2);
  
  // Generate texture from graphics
  const texture = this.app.renderer.generateTexture(graphics);
  sprite.texture = texture;
}

cleanup() {
  // Clear any dragging state
  if (this.draggingCard) {
    this.animationContainer.removeChild(this.draggingCard);
    this.draggingCard = null;
    this.draggingCardData = null;
    this.draggingCardSource = null;
  }
  
  // Remove event listeners
  window.removeEventListener('mousemove', this.moveCardHandler);
  window.removeEventListener('touchmove', this.moveCardHandler);
  window.removeEventListener('mouseup', this.releaseCardHandler);
  window.removeEventListener('touchend', this.releaseCardHandler);
}

// 8. Вспомогательный метод для расчёта позиции новой карты в веере
calculateNewCardIndex() {
  // По умолчанию добавляем карту в конец веера
  if (!this.playerHandContainer || !this.playerHandContainer.children) {
    return 0;
  }
  return this.playerHandContainer.children.length;
}


isOverDiscardPile(position) {
  if (!this.discardContainer) return false;
  
  // Get discard container bounds
  const discardBounds = this.discardContainer.getBounds();
  
  // Enlarge the drop zone a bit for ease of use
  const padding = 30;
  const dropZone = {
    left: discardBounds.x - padding,
    right: discardBounds.x + discardBounds.width + padding,
    top: discardBounds.y - padding,
    bottom: discardBounds.y + discardBounds.height + padding
  };
  
  // Check if position is within drop zone
  return (
    position.x >= dropZone.left &&
    position.x <= dropZone.right &&
    position.y >= dropZone.top &&
    position.y <= dropZone.bottom
  );
}

snapCardBack(sprite) {
  // Restore original z-index
  sprite.zIndex = sprite.zIndex < 100 ? sprite.zIndex : sprite.originalPosition.zIndex || sprite.zIndex;
  this.playerHandContainer.sortChildren();
  
  // ИЗМЕНЕНО: Плавная анимация возврата к исходному масштабу
  gsap.to(sprite.scale, {
    x: 0.6,
    y: 0.6,
    duration: 0.25,
    ease: "power2.out"
  });
  
  // Clear any highlights
  if (sprite.filters) {
    sprite.filters = null;
  }
  
  // Animate back to original position
  gsap.to(sprite, {
    x: sprite.originalPosition.x,
    y: sprite.originalPosition.y,
    rotation: sprite.originalPosition.rotation,
    duration: 0.3,
    ease: "back.out"
  });
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

  setDeckDragCallback(callback) {
    this.deckDragCallback = callback;
  }

  // Add visual feedback when a card is clicked
  enhanceCardClickFeedback(sprite) {
    if (!sprite) return;
    
    // Сохраняем оригинальные размеры
    const originalScaleX = sprite.scale.x;
    const originalScaleY = sprite.scale.y;
    const originalX = sprite.x;
    const originalY = sprite.y;
    
    // Apply a subtle pop effect
    gsap.timeline()
      .to(sprite.scale, {
        x: originalScaleX * 0.8, 
        y: originalScaleY * 0.8,
        duration: 0.4,
        ease: "power1.out"
      })
      .to(sprite.scale, {
        x: originalScaleX, 
        y: originalScaleY,
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
    
    // Определяем начальную позицию
    const startX = source === 'deck' 
      ? this.deckContainer.x + this.config.cardWidth / 2
      : this.discardContainer.x + this.config.cardWidth / 2;
    
    const startY = source === 'deck'
      ? this.deckContainer.y + this.config.cardHeight / 2
      : this.discardContainer.y + this.config.cardHeight / 2;
    
    // Расчет конечной позиции в руке игрока
    const spacing = this.config.fanDistance || 30;
    const totalCards = this.playerHandContainer.children.length;
    const fanAngle = this.config.fanAngle || 10;
    
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + destIndex * anglePerCard;
    const finalRotation = -(rotation * Math.PI / 180);
    
    const finalX = this.playerHandContainer.x - ((totalCards - 1) * spacing / 2) + destIndex * spacing;
    const finalY = this.playerHandContainer.y + Math.sin(rotation * Math.PI / 180) * 10;
    
    // Создаем спрайт для анимации
    this.createCardSprite(cardData, false)
      .then(sprite => {
        sprite.anchor.set(0.5, 0.9);
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.cardData = cardData;
        
        // Начальные настройки
        sprite.x = startX;
        sprite.y = startY;
        sprite.rotation = 0;
        sprite.scale.set(0.9);
        sprite.alpha = 1;
        sprite.zIndex = 200;
        
        // Добавляем в контейнер анимации
        this.animationContainer.addChild(sprite);
        
        // Создаем анимацию по дуге
        const timeline = gsap.timeline({
          onComplete: () => {
            this.animationContainer.removeChild(sprite);
          }
        });
        
        // Расчет точек дуги
        const midX = startX + (finalX - startX) * 0.5;
        const highPoint = Math.min(startY, finalY) - 100; // Высокая точка дуги
        
        // Первая часть анимации - движение вверх по дуге
        timeline.to(sprite, {
          x: midX,
          y: highPoint,
          rotation: finalRotation * 0.5,
          scale: 1.05, // Небольшое увеличение в высшей точке
          duration: 0.3,
          ease: "power1.out"
        });
        
        // Вторая часть - движение вниз в руку
        timeline.to(sprite, {
          x: finalX,
          y: finalY,
          rotation: finalRotation,
          scale: 1,
          duration: 0.2,
          ease: "power1.in"
        });
      })
      .catch(error => {
        console.error("Error in card take animation:", error);
      });
  }

  animateCardFlip(cardSprite, cardData, onComplete) {
    // We need to replace the card back texture with the card front texture
    const timeline = gsap.timeline({
      onComplete: () => {
        if (onComplete) onComplete();
      }
    });
    
    // 1. Animate card scale to create flip effect
    timeline.to(cardSprite.scale, {
      x: 0.1, // Almost flat
      duration: 0.3,
      ease: "power1.inOut"
    });
    
    // 2. When card is flat, replace texture and prepare for flip back
    timeline.call(() => {
      // Load and set the front texture
      const cardPath = `assets/cards/${cardData.suit}/${cardData.value}_${cardData.suit.charAt(0).toUpperCase()}${cardData.suit.slice(1)}.webp`;
      
      this.assetLoader.loadTexture(cardPath)
        .then(texture => {
          cardSprite.texture = texture;
        })
        .catch(err => {
          console.warn(`Could not load card texture: ${err}`);
          this.createFallbackCardTexture(cardSprite, cardData);
        });
    });
    
    // 3. Flip back to reveal front
    timeline.to(cardSprite.scale, {
      x: 1,
      duration: 0.3,
      ease: "power1.inOut"
    });
  }
  
  // Method to flip all player cards simultaneously
  flipPlayerCards(onComplete) {
    const playerCards = this.playerHandContainer.children;
    
    if (playerCards.length === 0) {
      if (onComplete) onComplete();
      return;
    }
    
    let flippedCount = 0;
    
    // Setup sound for card flip (if available)
    let flipSound = null;
    try {
      flipSound = new Audio('assets/sounds/card_flip.mp3');
      flipSound.volume = 0.3;
    } catch (e) {
      console.warn("Could not load flip sound:", e);
    }
    
    // Play flip sound once
    if (flipSound) {
      try {
        flipSound.play().catch(e => console.warn("Could not play flip sound:", e));
      } catch (e) {
        console.warn("Error playing flip sound:", e);
      }
    }
    
    // Flip each card with a slight stagger
    for (let i = 0; i < playerCards.length; i++) {
      const cardSprite = playerCards[i];
      const cardData = cardSprite.cardData;
      
      if (!cardData) continue;
      
      // Flip with staggered timing - quicker for multiple cards
      setTimeout(() => {
        this.animateCardFlip(cardSprite, cardData, () => {
          flippedCount++;
          if (flippedCount === playerCards.length && onComplete) {
            onComplete();
          }
        });
      }, i * 50); // 50ms stagger between card flips
    }
  }
  
  // Update the animateDealingCard method - now always deals face down initially
  animateDealingCard(cardData, target, index, onComplete) {
    // Calculate deck center position
    const deckX = this.deckContainer.x + this.config.cardWidth / 2;
    const deckY = this.deckContainer.y + this.config.cardHeight / 2;
  
    // Determine which hand container to deal into
    const container = target === 'player' ? this.playerHandContainer : this.opponentHandContainer;
    
    // Compute total cards after dealing this one
    const spacing = this.config.fanDistance || 30;
    const totalCards = container.children.length + 1;
    
    // Final X, Y inside the fan
    const finalX = container.x - ((totalCards - 1) * spacing / 2) + index * spacing;
    const finalY = container.y;
    
    // Compute final rotation based on fan
    const fanAngle = this.config.fanAngle || 10;
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + index * anglePerCard;
    const finalRotation = rotation * Math.PI / 180;
  
    // Important change: always create face down sprite initially for both player and opponent
    this.assetLoader.loadTexture('assets/CardBack_Blue.webp')
      .then(backTexture => {
        // Create card sprite with back texture
        const sprite = new PIXI.Sprite(backTexture);
        sprite.anchor.set(0.5, 0.5);
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.x = deckX;
        sprite.y = deckY;
        sprite.alpha = 1;
        sprite.zIndex = 200 + index;
        
        // Store card data for future reference (needed for flip)
        sprite.cardData = cardData;
        
        this.animationContainer.addChild(sprite);
  
        // Create the dealing animation
        const timeline = gsap.timeline({
          onComplete: () => {
            // Remove animation sprite
            this.animationContainer.removeChild(sprite);
            
            // Create the permanent card in player's/opponent's hand (still face down at this point)
            const permanentSprite = new PIXI.Sprite(backTexture);
            permanentSprite.anchor.set(0.5, 0.9);
            permanentSprite.width = this.config.cardWidth;
            permanentSprite.height = this.config.cardHeight;
            permanentSprite.x = finalX;
            permanentSprite.y = finalY;
            permanentSprite.rotation = finalRotation;
            permanentSprite.zIndex = index;
            
            // Store card data (needed for flip later)
            permanentSprite.cardData = cardData;
            
            // Add interactive behavior only for player cards - but only after they're flipped
            if (target === 'player') {
              permanentSprite.interactive = false; // Will be enabled after flip
            }
            
            // Add to appropriate container
            container.addChild(permanentSprite);
            
            if (onComplete) onComplete();
          }
        });
  
        // Duration calculation - vary slightly by index for natural effect
        const baseDuration = 0.4;
        const durationVariance = index * 0.01; // Very slight increase for each card
        const moveDuration = baseDuration + durationVariance;
        
        // Calculate arc path
        const midX = deckX + (finalX - deckX) * 0.5;
        const arcHeight = -50; // How high above straight line the arc goes
        const midY = Math.min(deckY, finalY) + arcHeight;
        
        // 1. First animate scale to feel like "picking up" the card
        timeline.to(sprite.scale, {
          x: 1.05, y: 1.05, 
          duration: 0.1,
          ease: "power1.out"
        });
        
        // 2. Move card in arc to final position
        timeline.to(sprite, {
          bezier: {
            type: "soft",
            values: [
              { x: deckX, y: deckY },
              { x: midX, y: midY },
              { x: finalX, y: finalY }
            ]
          },
          rotation: finalRotation,
          duration: moveDuration,
          ease: "power1.inOut"
        });
        
        // Add a small bounce at the end for realism
        timeline.to(sprite.scale, {
          x: 0.95, y: 0.95,
          duration: 0.1,
          ease: "power1.in"
        }, "-=0.05");
        
        timeline.to(sprite.scale, {
          x: 1, y: 1,
          duration: 0.1,
          ease: "power1.out"
        });
      })
      .catch(err => {
        console.error("Error in dealing card animation:", err);
        if (onComplete) onComplete();
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
      
      // Set anchor to center for proper scaling animations
      sprite.anchor.set(0.5, 0.5);
      
      // Position card at center of deck, with slight offset for stacking
      sprite.x = this.config.cardWidth / 2;
      sprite.y = this.config.cardHeight / 2 - 3 * i;
      sprite.zIndex = i;
      
      // If this is the top card and deck is not empty, make it interactive
      // Make top card interactive
      if (i === visibleCount - 1 && deckCount > 0) {
        // Add card counter
        this.addDeckCounter(sprite, deckCount);
        
        // Make top card interactive
        sprite.interactive = true;
        sprite.buttonMode = true;
        sprite.zIndex = 5000;
        
        // Очищаем все предыдущие обработчики
        sprite.removeAllListeners();
        
        // Replace this entire handler:
        sprite.on('pointerdown', (event) => {
          // Предотвращаем всплытие события
          event.stopPropagation();
          
          // Get a real card from the game if callback is available
          const cardToDrag = this.deckDragCallback ? this.deckDragCallback() : null;
          
          if (cardToDrag) {
            // Start dragging with the real card data
            this.startCardDragging(cardToDrag, 'deck');
          } else {
            // Fallback to placeholder if no callback or it returns null
            this.startCardDragging({ faceDown: false, value: '?', suit: '?', filename: '' }, 'deck');
          }
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
    // Since we've already set the card's anchor to center (0.5, 0.5),
    // setting x,y to 0,0 will position the counter at the card's center
    countContainer.x = 0;
    countContainer.y = 0;
    
    // Add container to card
    sprite.addChild(countContainer);
  }

  showDiscardMessage() {
    this.dialogContainer.removeChildren();
    
    // Dialog background - use a design that matches the screenshot
    const dialogBg = new PIXI.Graphics();
    dialogBg.beginFill(0xFFFBF0, 0.9); // Light cream color
    dialogBg.drawRoundedRect(0, 0, 350, 70, 20); // Thinner dialog to match screenshot
    dialogBg.endFill();
    
    // Dialog text - match the style from screenshot
    const dialogText = new PIXI.Text("Discard a card !", {
      fontFamily: "Arial",
      fontSize: 24,
      fontWeight: "bold",
      fill: 0x4E342E, // Dark brown color
      align: "center"
    });
    dialogText.anchor.set(0.5);
    dialogText.x = 175;
    dialogText.y = 35;
    
    dialogBg.addChild(dialogText);
    
    // Position dialog in the center of the table
    dialogBg.x = (this.app.screen.width - 350) / 2;
    dialogBg.y = (this.app.screen.height / 2) - 35; // Center vertically on the table
    
    this.dialogContainer.addChild(dialogBg);
    this.dialogContainer.visible = true;
    
    return dialogBg;
  }
  
  // Render the discard pile
  async renderDiscardPile(discardPile) {
    console.log("Rendering discard pile with", discardPile?.length || 0, "cards");
    
    // Явно очищаем контейнер дисканта при каждом рендере
    this.discardContainer.removeChildren();
    
    if (discardPile && discardPile.length > 0) {
      // Показываем все карты в отбое, до 5 штук максимум
      const visibleDiscards = Math.min(discardPile.length, 5);
      
      // Отцентрированная позиция для всех карт в отбое
      const centerX = this.config.cardWidth / 2;
      const centerY = this.config.cardHeight / 2;
      
      // Показываем карты, начиная с низа стопки
      for (let i = 0; i < visibleDiscards; i++) {
        const discardIndex = discardPile.length - visibleDiscards + i;
        const discard = discardPile[discardIndex];
        
        const sprite = await this.createCardSprite(discard, false);
        
        // Увеличиваем размер карты
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        
        // Устанавливаем якорь в центр для правильного вращения
        sprite.anchor.set(0.5);
        
        // Добавляем небольшой случайный поворот и смещение для естественного вида
        const randomRotation = ((i * 137 + 547) % 100) / 500 - 0.1; // От -0.1 до 0.1
        const randomOffsetX = ((i * 263 + 821) % 10) - 5;           // От -5 до 5
        const randomOffsetY = ((i * 521 + 347) % 10) - 5;           // От -5 до 5
        
        // Всегда центрируем карту с небольшими случайными вариациями
        sprite.x = centerX + randomOffsetX;
        sprite.y = centerY + randomOffsetY;
        sprite.rotation = randomRotation;
        
        // Z-индекс для правильного наложения
        sprite.zIndex = i;
        
        // Делаем верхнюю карту интерактивной
        if (i === visibleDiscards - 1) {
          sprite.interactive = true;
          sprite.buttonMode = true;
          
          // Очищаем все предыдущие обработчики
          sprite.removeAllListeners();
          
          // Добавляем обработчик клика для начала перетаскивания
          sprite.on('pointerdown', (event) => {
            // Предотвращаем всплытие события
            event.stopPropagation();
            
            // Начинаем перетаскивание карты из отбоя
            this.startCardDragging(discard, 'discard');
          });
        }
        
        this.discardContainer.addChild(sprite);
      }
      
      // Сортируем дочерние элементы контейнера отбоя для правильного наложения
      this.discardContainer.sortChildren();
    } else {
      // Пустой отбой
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

  enableDragging(enabled) {
    this.isDragEnabled = enabled;
  }
  
// Animate dealing a card with 3D bend and natural arc flight
animateDealingCard(cardData, target, index, onComplete) {
  // Calculate deck center position
  const deckX = this.deckContainer.x + this.config.cardWidth / 2;
  const deckY = this.deckContainer.y + this.config.cardHeight / 2;

  // Determine which hand container to deal into
  const container = target === 'player' ? this.playerHandContainer : this.opponentHandContainer;
  
  // Compute total cards after dealing this one
  const spacing = this.config.fanDistance || 30;
  const totalCards = container.children.length + 1;
  
  // Final X, Y inside the fan
  const finalX = container.x - ((totalCards - 1) * spacing / 2) + index * spacing;
  const finalY = container.y;
  
  // Compute final rotation based on fan
  const fanAngle = this.config.fanAngle || 10;
  const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
  const rotation = -fanAngle / 2 + index * anglePerCard;
  const finalRotation = rotation * Math.PI / 180;

  // Create a temporary sprite for animation
  this.createCardSprite(cardData, cardData.faceDown)
    .then(sprite => {
      sprite.anchor.set(0.5, 0.5);
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      sprite.x = deckX;
      sprite.y = deckY;
      sprite.alpha = 1;
      sprite.zIndex = 200 + index;
      this.animationContainer.addChild(sprite);

      // Build timeline with SLOWED DOWN durations
      const timeline = gsap.timeline({
        onComplete: () => {
          // Remove temp sprite
          this.animationContainer.removeChild(sprite);
          
          // Create permanent sprite in target container
          const perm = new PIXI.Sprite(sprite.texture);
          perm.anchor.set(0.5, 0.9);
          perm.width = this.config.cardWidth;
          perm.height = this.config.cardHeight;
          perm.x = finalX;
          perm.y = finalY;
          perm.rotation = finalRotation;
          perm.zIndex = index;
          
          if (target === 'player' && !cardData.faceDown) {
            perm.interactive = true;
            perm.buttonMode = true;
            perm.on('pointerdown', this.handleCardClick.bind(this, cardData, 'player'));
          }
          
          container.addChild(perm);
          if (onComplete) onComplete();
        }
      });

      // 1) Initial slight scaledown for preparation
      timeline.to(sprite.scale, {
        x: 0.95, y: 0.95,
        duration: 0.15,
        ease: "power1.in"
      });

      // 2) 3D bend before flight - MORE PRONOUNCED
      if (window.CSSPlugin) {
        timeline.to(sprite, {
          rotationY: target === 'player' ? -Math.PI / 6 : Math.PI / 6, // MORE rotation (1/6 instead of 1/8)
          duration: 0.2, // SLOWER (0.2 instead of 0.1)
          ease: "power1.in"
        });
        timeline.to(sprite, {
          rotationY: 0,
          duration: 0.25, // SLOWER (0.25 instead of 0.15)
          ease: "power1.out"
        });
      } else {
        // Fallback: simulate bend via scale - MORE PRONOUNCED
        timeline.to(sprite.scale, {
          x: 1.15, // MORE stretch (1.15 instead of 1.1)
          y: 0.85, // MORE squeeze (0.85 instead of 0.9)
          duration: 0.2, // SLOWER
          yoyo: true,
          repeat: 1,
          ease: "power1.inOut"
        });
      }

      // 3) Arc flight with MULTIPLE points for smoother path
      // Calculate bezier control points for a natural arc
      const controlPoints = [
        { x: deckX, y: deckY }, // Starting point
        { x: deckX + (finalX - deckX) * 0.25, y: deckY - 20 }, // First control point
        { x: deckX + (finalX - deckX) * 0.5, y: Math.min(deckY, finalY) - 80 }, // Highest point in arc
        { x: deckX + (finalX - deckX) * 0.75, y: finalY - 20 }, // Third control point
        { x: finalX, y: finalY } // End point
      ];
      
      // Add bezier path animation - SLOWER
      timeline.to(sprite, {
        bezier: {
          type: "soft", 
          values: controlPoints,
          curviness: 2 // Higher value = more curved path
        },
        duration: 0.7, // MUCH SLOWER (0.7 instead of 0.2)
        ease: "power1.inOut"
      }, "-=0.2"); // Slight overlap with previous animation

      // 4) Add gradual rotation during flight to match final fan position
      timeline.to(sprite, {
        rotation: finalRotation,
        duration: 0.7, // Match bezier duration
        ease: "power1.inOut"
      }, "-=0.7"); // Run in parallel with bezier
      
      // 5) Scale to final size 
      timeline.to(sprite.scale, {
        x: 1.0, y: 1.0,
        duration: 0.6, // Match bezier duration
        ease: "power1.inOut"
      }, "-=0.7"); // Run in parallel with bezier
    })
    .catch(err => {
      console.error("Error in dealing card animation:", err);
      if (onComplete) onComplete();
    });
}

  
  // Animate discarding a card
  animateCardDiscard(cardData, sourceIndex) {
    // Начальная позиция в руке игрока
    const spacing = this.config.fanDistance || 30;
    const totalCards = this.playerHandContainer.children.length;
    const startX = this.playerHandContainer.x - ((totalCards - 1) * spacing / 2) + sourceIndex * spacing;
    const startY = this.playerHandContainer.y;
    
    // Фанангл для начального поворота
    const fanAngle = this.config.fanAngle || 10;
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + sourceIndex * anglePerCard;
    const startRotation = -(rotation * Math.PI / 180);
    
    // Конечная позиция (отбой) - ЦЕНТР отбоя
    const endX = this.discardContainer.x + this.config.cardWidth / 2;
    const endY = this.discardContainer.y + this.config.cardHeight / 2;
    
    // Создаем спрайт карты для анимации
    this.createCardSprite(cardData, false)
      .then(sprite => {
        // Настройка спрайта
        sprite.anchor.set(0.5);
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.cardData = cardData;
        
        // Начальная позиция
        sprite.x = startX;
        sprite.y = startY;
        sprite.rotation = startRotation;
        sprite.zIndex = 150;
        
        // Добавляем в контейнер анимации
        this.animationContainer.addChild(sprite);
        
        // Анимируем движение в отбой
        gsap.to(sprite, {
          x: endX,
          y: endY,
          rotation: 0, // Выравниваем карту горизонтально
          duration: 0.5,
          ease: "power2.inOut",
          onComplete: () => {
            // Удаляем анимационный спрайт
            this.animationContainer.removeChild(sprite);
            
            // Здесь мы НЕ добавляем карту в отбой, это должно быть сделано в game.js
            // после завершения анимации
          }
        });
      })
      .catch(error => {
        console.error("Error in card discard animation:", error);
      });
  }
  
  // Animate opponent taking a card
  animateOpponentCardTake(source, newCardIndex) {
    // Начальная позиция
    const startX = source === 'deck'
      ? this.deckContainer.x + this.config.cardWidth / 2
      : this.discardContainer.x + this.config.cardWidth / 2;
    const startY = source === 'deck'
      ? this.deckContainer.y + this.config.cardHeight / 2
      : this.discardContainer.y + this.config.cardHeight / 2;
    
    // Конечная позиция в руке оппонента
    const spacing = this.config.fanDistance || 30;
    const totalCards = this.opponentHandContainer.children.length + 1;
    
    // Calculate fan parameters (similar to renderOpponentHand)
    const fanAngle = this.config.fanAngle || 10;
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + newCardIndex * anglePerCard;
    
    // Calculate final position in the fan
    const finalX = this.opponentHandContainer.x - ((totalCards - 1) * spacing / 2) + newCardIndex * spacing;
    const finalY = this.opponentHandContainer.y + Math.sin(rotation * Math.PI / 180) * 10;
    const finalRotation = -(rotation * Math.PI / 180);
    
    // Создаем карту для анимации (всегда рубашкой вверх для оппонента)
    const cardData = { faceDown: true };
    
    // Создаем спрайт
    this.createCardSprite(cardData, true)
      .then(sprite => {
        sprite.anchor.set(0.5, 0.9);
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        
        // Начальные настройки
        sprite.x = startX;
        sprite.y = startY;
        sprite.rotation = 0;
        sprite.zIndex = 150;
        
        // Добавляем в контейнер анимации
        this.animationContainer.addChild(sprite);
        
        // Анимация по дуге
        const timeline = gsap.timeline({
          onComplete: () => {
            // Remove the animated sprite
            this.animationContainer.removeChild(sprite);
            
            // Create a permanent card sprite in opponent's hand
            const permanentSprite = new PIXI.Sprite(sprite.texture);
            permanentSprite.anchor.set(0.5, 0.9);
            permanentSprite.width = this.config.cardWidth;
            permanentSprite.height = this.config.cardHeight;
            permanentSprite.x = finalX;
            permanentSprite.y = finalY;
            permanentSprite.rotation = finalRotation;
            permanentSprite.zIndex = newCardIndex;
            
            // Add to opponent's hand container
            this.opponentHandContainer.addChild(permanentSprite);
            this.opponentHandContainer.sortChildren();
          }
        });
        
        // Промежуточная точка дуги
        const midX = (startX + finalX) / 2;
        const midY = Math.min(startY, finalY) - 40; // Дуга вверх
        
        // Анимация к промежуточной точке
        timeline.to(sprite, {
          x: midX,
          y: midY,
          rotation: finalRotation / 2,
          duration: 0.25,
          ease: "power2.out"
        });
        
        // Анимация к конечной точке
        timeline.to(sprite, {
          x: finalX,
          y: finalY,
          rotation: finalRotation,
          duration: 0.25,
          ease: "power2.in"
        });
      })
      .catch(error => {
        console.error("Error in opponent card take animation:", error);
      });
  }
  
 animateOpponentCardDiscard(cardData, sourceIndex, onComplete) {
    // Начальная позиция в руке оппонента
    const spacing = this.config.fanDistance || 30;
    const totalCards = this.opponentHandContainer.children.length;
    const startX = this.opponentHandContainer.x + (totalCards - 1) * spacing / 2 - sourceIndex * spacing;
    const startY = this.opponentHandContainer.y;
    
    // Расчет начального поворота исходя из положения в веере
    const fanAngle = this.config.fanAngle || 10;
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + (totalCards - 1 - sourceIndex) * anglePerCard;
    const startRotation = rotation * Math.PI / 180;
    
    // Конечная позиция (отбой)
    const endX = this.discardContainer.x + this.config.cardWidth / 2;
    const endY = this.discardContainer.y + this.config.cardHeight / 2;
    
    // Используем предоставленные данные карты или генерируем случайную
    const cardToUse = cardData || {
      value: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][Math.floor(Math.random() * 13)],
      suit: ['hearts', 'diamonds', 'clubs', 'spades'][Math.floor(Math.random() * 4)],
      filename: null
    };
    
    // Генерируем filename если отсутствует
    if (!cardToUse.filename && cardToUse.value && cardToUse.suit) {
      cardToUse.filename = `${cardToUse.value}_${cardToUse.suit.charAt(0).toUpperCase()}${cardToUse.suit.slice(1)}.webp`;
    }
    
    // Создаем обе стороны карты для эффекта переворота
    Promise.all([
      this.createCardSprite(cardToUse, false), // Лицо карты
      this.createCardSprite({...cardToUse, faceDown: true}, true) // Рубашка
    ]).then(([faceUpCard, faceDownCard]) => {
      // Создаем контейнер для анимации
      const flipContainer = new PIXI.Container();
      flipContainer.x = startX;
      flipContainer.y = startY;
      flipContainer.zIndex = 200;
      
      // Настраиваем якоря в центр для корректного поворота
      faceUpCard.anchor.set(0.5, 0.9);
      faceDownCard.anchor.set(0.5, 0.9);
      
      // Задаем фиксированные размеры
      faceUpCard.width = this.config.cardWidth;
      faceUpCard.height = this.config.cardHeight;
      faceDownCard.width = this.config.cardWidth;
      faceDownCard.height = this.config.cardHeight;
      
      // Начальная позиция обеих карт в центре контейнера
      faceUpCard.x = 0;
      faceUpCard.y = 0;
      faceDownCard.x = 0;
      faceDownCard.y = 0;
      
      // Начинаем с рубашкой видимой
      faceUpCard.visible = false;
      faceDownCard.visible = true;
      
      // Поворачиваем контейнер согласно исходному положению в веере
      flipContainer.rotation = startRotation;
      
      // Добавляем карты в контейнер
      flipContainer.addChild(faceUpCard);
      flipContainer.addChild(faceDownCard);
      this.animationContainer.addChild(flipContainer);
      
      // Создаем анимацию в 3 этапа
      const timeline = gsap.timeline({
        onComplete: () => {
          // Remove animation container
          this.animationContainer.removeChild(flipContainer);
          
          // Log that animation completed
          console.log("Opponent card discard animation completed");
          
          // Ensure callback is called
          if (typeof onComplete === 'function') {
            onComplete();
          } else {
            console.warn("No callback provided for opponent card discard animation");
          }
        }
      });
      
      // 1. Движение к середине пути
      timeline.to(flipContainer, {
        x: (startX + endX) / 2,
        y: (startY + endY) / 2 - 20, // Небольшая дуга
        rotation: startRotation / 2, // Постепенный поворот
        duration: 0.3,
        ease: "power2.out"
      });
      
      // 2. Эффект переворота карты
      // Вместо изменения scale.x, используем rotationY для более реалистичного 3D-эффекта
      timeline.to(flipContainer, {
        rotationY: 90, // Поворачиваем на 90 градусов (ребро карты)
        duration: 0.15,
        ease: "sine.in",
        onUpdate: function() {
          // Когда достигаем половины поворота (около 90 градусов)
          if (this.progress() >= 0.5 && faceDownCard.visible) {
            faceDownCard.visible = false;
            faceUpCard.visible = true;
          }
        }
      });
      
      timeline.to(flipContainer, {
        rotationY: 180, // Завершаем поворот до 180 градусов (лицо карты)
        duration: 0.15,
        ease: "sine.out"
      });
      
      // 3. Движение к отбою и финальное выравнивание
      timeline.to(flipContainer, {
        x: endX,
        y: endY,
        rotation: 0, // Финальное выравнивание
        duration: 0.3,
        ease: "power2.in"
      });
    }).catch(error => {
      console.error("Error in opponent card discard animation:", error);
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