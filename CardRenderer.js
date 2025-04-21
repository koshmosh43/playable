export class CardRenderer {
  constructor(app, assetLoader, config) {
    this.app = app;
    this.assetLoader = assetLoader;
    this.config = config;
    this.cardsFlipped = false;
    
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
    this.playerHandContainer.removeChildren();
    
    if (!playerCards || playerCards.length === 0) return;
    
    const total = playerCards.length;
    const spacing = this.config.fanDistance;
    const fanAngle = this.config.fanAngle;
    
    // Create cards in player's hand
    for (let i = 0; i < total; i++) {
      const cardData = playerCards[i];
      
      // Create card sprite
      const sprite = await this.createCardSprite(cardData);
      
      // Set dimensions and anchor
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      sprite.anchor.set(0.5, 0.9); // IMPORTANT: Changed anchor to 0.9 for consistent vertical alignment
      sprite.zIndex = i;
      
      // Calculate position in the fan
      const x = -((total - 1) * spacing / 2) + i * spacing;
      const angleDeg = -(-fanAngle / 2 + (fanAngle / (total - 1)) * i);
      const angleRad = (angleDeg * Math.PI) / 180;
      
      sprite.x = x;
      sprite.y = 0; // FIXED: Set a consistent y position of 0 relative to container
      sprite.rotation = angleRad;
      
      // Highlight cards in melds (keeping existing functionality)
      if (possibleMelds) {
        // Check if card is in any set
        let inSet = false;
        if (possibleMelds.sets) {
          inSet = possibleMelds.sets.some(set => 
            set.cards.some(card => card.id === cardData.id)
          );
        }
        
        // Check if card is in any run
        let inRun = false;
        if (possibleMelds.runs) {
          inRun = possibleMelds.runs.some(run => 
            run.cards.some(card => card.id === cardData.id)
          );
        }
        
        // Apply appropriate highlight
        if (inRun) {
          this.applySpecialHighlight(sprite, 0x98FB98, 0.5); // Green color for run
        } else if (inSet) {
          this.applySpecialHighlight(sprite, 0xFFFE7A, 0.5); // Yellow color for set
        }
      }
      
      // Highlight selected card
      if (selectedCard && selectedCard.id === cardData.id) {
        this.applySelectedHighlight(sprite);
      }
      
      // Add click handler
      sprite.on('pointerdown', () => {
        if (this.onCardClick) {
          this.onCardClick(cardData, 'player');
        }
      });
      
      this.playerHandContainer.addChild(sprite);
    }
    
    // Sort cards by z-index
    this.playerHandContainer.sortChildren();
  }

  

  isOverPlayerHand(position) {
    if (!this.playerHandContainer) return false;
    const bounds = this.playerHandContainer.getBounds();
    const pad = this.config.touchPadding || 60;
    return (
      position.x >= bounds.x - pad &&
      position.x <= bounds.x + bounds.width + pad &&
      position.y >= bounds.y - pad &&
      position.y <= bounds.y + bounds.height + pad
    );
  }
  
  // Apply highlight for selected card with more subtle effect
  applySelectedHighlight(sprite) {
    const filter = new PIXI.filters.ColorMatrixFilter();
    filter.matrix = [1.1,0,0,0,0, 0,1.1,0,0,0, 0,0,1.1,0,0, 0,0,0,1,0];
    sprite.filters = [filter];
    sprite.proj.position.y -= 10;
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
async createCardSprite(cardData, isFaceDown = false) {
  let texture;
  
  try {
    if (isFaceDown || (cardData && cardData.faceDown)) {
      // Карта рубашкой вверх
      texture = await this.assetLoader.loadTexture('assets/CardBack_Blue.webp');
    } else if (cardData && cardData.suit && cardData.value) {
      // Загружаем лицевую сторону
      const suit = cardData.suit;
      const value = cardData.value;
      const frontPath = `assets/cards/${suit}/${value}_${suit.charAt(0).toUpperCase()}${suit.slice(1)}.webp`;
      texture = await this.assetLoader.loadTexture(frontPath);
    } else {
      // Если данных нет, загружаем рубашку
      texture = await this.assetLoader.loadTexture('assets/CardBack_Blue.webp');
    }
  } catch (err) {
    console.warn("Ошибка загрузки текстуры карты:", err);
    texture = PIXI.Texture.WHITE;
  }

  // Создаем обычный спрайт вместо 3D
  const sprite = new PIXI.Sprite(texture);
  
  sprite.anchor.set(0.5);
  sprite.width = this.config.cardWidth;
  sprite.height = this.config.cardHeight;
  sprite.interactive = true;
  sprite.buttonMode = true;
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
applySpecialHighlight(sprite, color, alpha = 0.3) {
  if (!sprite) return;
  
  // Создаем цветовой фильтр
  const colorMatrix = new PIXI.filters.ColorMatrixFilter();
  
  // Специфические настройки для разных цветов подсветки
  if (color === 0x98FB98) { // Зеленый для run
    colorMatrix.matrix[0] = 0.8;  // Уменьшаем красный
    colorMatrix.matrix[6] = 1.3;  // Увеличиваем зеленый
    colorMatrix.matrix[12] = 0.8; // Уменьшаем синий
  } 
  else if (color === 0xFFFE7A) { // Желтый для set
    colorMatrix.matrix[0] = 1.2;  // Увеличиваем красный
    colorMatrix.matrix[6] = 1.2;  // Увеличиваем зеленый
    colorMatrix.matrix[12] = 0.5; // Сильно уменьшаем синий
  }
  
  // Применяем фильтр к карте
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
    
    // Determine starting position
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
    
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + destIndex * anglePerCard;
    const finalRotation = -(rotation * Math.PI / 180);
    
    const finalX = this.playerHandContainer.x - ((totalCards - 1) * spacing / 2) + destIndex * spacing;
    const finalY = this.playerHandContainer.y; // FIXED: Use container Y position directly
    
    // Create sprite for animation
    this.createCardSprite(cardData, false)
      .then(sprite => {
        sprite.anchor.set(0.5, 0.9); // FIXED: Bottom-center anchor
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.cardData = cardData;
        
        // Initial settings
        sprite.x = startX;
        sprite.y = startY;
        sprite.rotation = 0;
        sprite.scale.set(0.9);
        sprite.alpha = 1;
        sprite.zIndex = 200;
        
        // Add to animation container
        this.animationContainer.addChild(sprite);
        
        // Create animation timeline
        const timeline = gsap.timeline({
          onComplete: () => {
            this.animationContainer.removeChild(sprite);
          }
        });
        
        // Calculate arc points
        const midX = startX + (finalX - startX) * 0.5;
        const highPoint = Math.min(startY, finalY) - 100; // High point of the arc
        
        // Check if bezier is available
        if (typeof gsap.getBezierPlugin === 'function' && gsap.getBezierPlugin()) {
          // Use bezier for smooth arc
          timeline.to(sprite, {
            bezier: {
              type: "soft",
              values: [
                { x: startX, y: startY },
                { x: midX, y: highPoint },
                { x: finalX, y: finalY }
              ],
              curviness: 2
            },
            rotation: finalRotation,
            scale: 1.05,
            duration: 0.5,
            ease: "power1.inOut"
          });
        } else {
          // Fallback to two-step animation without bezier
          timeline.to(sprite, {
            x: midX,
            y: highPoint,
            rotation: finalRotation * 0.5,
            scale: 1.05,
            duration: 0.25,
            ease: "power1.out"
          });
          
          timeline.to(sprite, {
            x: finalX,
            y: finalY,
            rotation: finalRotation,
            scale: 1,
            duration: 0.25,
            ease: "power1.in"
          });
        }
      })
      .catch(error => {
        console.error("Error in card take animation:", error);
      });
  }
  
  animateCardFlip(sprite, onComplete) {
    // Сохраняем исходные размеры карты перед анимацией
    const originalWidth = this.config.cardWidth;
    const originalHeight = this.config.cardHeight;
    
    // Сохраняем исходное положение и поворот
    const originalX = sprite.x;
    const originalY = sprite.y;
    const originalRotation = sprite.rotation;
    
    console.log("Переворачиваем карту");
    
    // Используем простую анимацию масштабирования вместо 3D
    gsap.to(sprite.scale, {
      x: 0.01, // Уменьшаем до почти плоского состояния
      duration: 0.2,
      ease: "power1.in",
      onComplete: () => {
        // Меняем текстуру, когда карта "на ребре"
        if (sprite.cardData && sprite.cardData.suit && sprite.cardData.value) {
          const { suit, value } = sprite.cardData;
          const frontPath = `assets/cards/${suit}/${value}_${suit.charAt(0).toUpperCase()}${suit.slice(1)}.webp`;
          
          this.assetLoader.loadTexture(frontPath)
            .then(texture => {
              sprite.texture = texture;
              
              // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Явно восстанавливаем размеры после смены текстуры
              sprite.width = originalWidth;
              sprite.height = originalHeight;
              
              // Возвращаем карту к нормальному размеру с эффектом "пружины"
              gsap.to(sprite.scale, {
                x: 1.0, // Точно 1.0, без увеличения
                y: 1.0, // Важно сохранять и Y-масштаб
                duration: 0.2,
                ease: "back.out(1.5)",
                onComplete: () => {
                  // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Еще раз явно задаем размеры
                  sprite.width = originalWidth;
                  sprite.height = originalHeight;
                  
                  // Восстанавливаем позицию, если она изменилась
                  sprite.x = originalX;
                  sprite.y = originalY;
                  sprite.rotation = originalRotation;
                  
                  if (onComplete) onComplete();
                }
              });
            })
            .catch(err => {
              console.warn("Не удалось загрузить текстуру:", err);
              
              // Восстанавливаем масштаб при ошибке
              sprite.scale.x = 1.0;
              sprite.width = originalWidth;
              sprite.height = originalHeight;
              
              if (onComplete) onComplete();
            });
        } else {
          // Если нет данных карты, просто завершаем анимацию
          sprite.scale.x = 1.0;
          sprite.width = originalWidth;
          sprite.height = originalHeight;
          
          if (onComplete) onComplete();
        }
      }
    });
  }
  
  // Method to flip all player cards simultaneously
  flipPlayerCards(onComplete) {
    // Проверяем флаг для избежания двойного переворота
    if (this.cardsFlipped) {
      console.log("Карты уже были перевернуты, пропускаем");
      if (onComplete) onComplete();
      return;
    }
    
    const cards = this.playerHandContainer.children;
    
    if (!cards || cards.length === 0) {
      if (onComplete) onComplete();
      return;
    }
    
    console.log(`Переворачиваем ${cards.length} карт игрока`);
    
    // Отмечаем, что начали переворачивать карты
    this.cardsFlipped = true;
    
    // Сохраняем исходные позиции для каждой карты
    cards.forEach(sprite => {
      if (sprite) {
        // Сохраняем точные координаты и поворот карты
        sprite.originalPosition = {
          x: sprite.x,
          y: sprite.y,
          rotation: sprite.rotation
        };
      }
    });
    
    // Используем счетчик завершенных анимаций
    let completedCount = 0;
    
    // Функция для проверки завершения всех анимаций
    const checkCompletion = () => {
      completedCount++;
      if (completedCount >= cards.length) {
        console.log("Все карты перевернуты");
        if (onComplete) setTimeout(onComplete, 50);
      }
    };
    
    // Перебираем все карты и запускаем анимацию с задержкой
    cards.forEach((sprite, index) => {
      if (!sprite || !sprite.cardData) {
        checkCompletion();
        return;
      }
      
      setTimeout(() => {
        this.animateCardFlip(sprite, checkCompletion);
      }, index * 80);
    });
  }
  
  resetCardFlipState() {
    this.cardsFlipped = false;
  }

  flipCardWithMotionBlur(cardSprite, cardData, onComplete) {
    // Загружаем текстуру лицевой стороны карты
    const cardPath = `assets/cards/${cardData.suit}/${cardData.value}_${cardData.suit.charAt(0).toUpperCase()}${cardData.suit.slice(1)}.webp`;
    
    // Создаем анимацию с улучшенным визуальным эффектом
    const timeline = gsap.timeline({
      onComplete: () => {
        if (onComplete) onComplete();
      }
    });
    
    this.assetLoader.loadTexture(cardPath)
      .then(texture => {
        // Фаза 1: Сжатие карты по горизонтали (эффект поворота) с ускорением
        timeline.to(cardSprite.scale, {
          x: 0.01, // Почти полностью сжатая карта для лучшего эффекта
          duration: 0.15,
          ease: "power2.in"
        });
        
        // Фаза 2: Замена текстуры на лицевую сторону карты
        timeline.call(() => {
          cardSprite.texture = texture;
        });
        
        // Фаза 3: Расширение карты с эффектом отскока
        timeline.to(cardSprite.scale, {
          x: 1.1, // Небольшое увеличение для эффекта
          duration: 0.15,
          ease: "back.out(1.5)" // Эффект отскока при завершении
        });
        
        // Фаза 4: Возврат к нормальному размеру с небольшой задержкой
        timeline.to(cardSprite.scale, {
          x: 1.0,
          duration: 0.1,
          ease: "power1.out"
        });
        
        // Дополнительный эффект - легкое покачивание карты после переворота
        timeline.to(cardSprite, {
          rotation: cardSprite.rotation + 0.05,
          duration: 0.1,
          yoyo: true,
          repeat: 1,
          ease: "sine.inOut"
        });
      })
      .catch(err => {
        console.warn(`Could not load card texture: ${err}`);
        
        // В случае ошибки создаем запасной вариант карты
        this.createFallbackCardTexture(cardSprite, cardData);
        
        // Простая анимация масштаба как запасной вариант
        timeline.to(cardSprite.scale, {
          x: 1,
          duration: 0.2
        });
      });
  }

  simpleFlipAnimation(cardSprite, cardData, onComplete) {
    // Анимация сжатия (симуляция поворота карты без rotationY)
    gsap.to(cardSprite.scale, {
      x: 0.1, // Почти плоская карта
      duration: 0.2,
      ease: "power1.inOut",
      onComplete: () => {
        // Загружаем текстуру передней стороны карты
        const cardPath = `assets/cards/${cardData.suit}/${cardData.value}_${cardData.suit.charAt(0).toUpperCase()}${cardData.suit.slice(1)}.webp`;
        
        this.assetLoader.loadTexture(cardPath)
          .then(texture => {
            // Заменяем текстуру
            cardSprite.texture = texture;
            
            // Анимация расширения (показ лицевой стороны)
            gsap.to(cardSprite.scale, {
              x: 1,
              duration: 0.2,
              ease: "power1.inOut",
              onComplete: () => {
                // Делаем карту интерактивной после переворота
                cardSprite.interactive = true;
                cardSprite.buttonMode = true;
                cardSprite.on('pointerdown', () => {
                  if (this.onCardClick) {
                    this.onCardClick(cardData, 'player');
                  }
                });
                
                // Вызываем колбэк завершения
                if (onComplete) onComplete();
              }
            });
          })
          .catch(err => {
            console.warn(`Could not load card texture: ${err}`);
            // Создаем запасную текстуру
            this.createFallbackCardTexture(cardSprite, cardData);
            
            // Анимация расширения с запасной текстурой
            gsap.to(cardSprite.scale, {
              x: 1,
              duration: 0.2,
              ease: "power1.inOut",
              onComplete: () => {
                if (onComplete) onComplete();
              }
            });
          });
      }
    });
  }

  animateFlyingCardDealing(playerCards, opponentCards, onComplete) {
    // Flags for tracking
    let wasInterrupted = false;
    let dealingInProgress = true;
    
    // Safety check for input params
    if (!playerCards || !Array.isArray(playerCards) || !opponentCards || !Array.isArray(opponentCards)) {
      console.error("Invalid card arrays in animateFlyingCardDealing");
      if (onComplete) setTimeout(onComplete, 0);
      return;
    }
    
    // Get exact deck position (starting point for all cards)
    const deckX = this.deckContainer.x + this.config.cardWidth / 2;
    const deckY = this.deckContainer.y + this.config.cardHeight / 2;
    
    // Skip handler
    const skipDealingHandler = () => {
      if (dealingInProgress) {
        console.log("Skipping dealing animation...");
        wasInterrupted = true;
        
        // Clear any animation sprites
        this.animationContainer.removeChildren();
        
        // Show final cards immediately
        this.createAndShowFinalCards(playerCards, opponentCards);
        
        // Complete the process
        dealingInProgress = false;
        if (onComplete) onComplete();
        
        this.app.stage.off('pointerdown', skipDealingHandler);
      }
    };
    
    // Allow skipping animation with tap
    this.app.stage.interactive = true;
    this.app.stage.on('pointerdown', skipDealingHandler);
    
    // Clear existing cards
    this.playerHandContainer.removeChildren();
    this.opponentHandContainer.removeChildren();
    
    // Calculate final positions - VERY IMPORTANT for consistency!
    // These positions will be used during and after dealing
    const playerPositions = this.getFinalCardPositions(
      playerCards.length,
      this.playerHandContainer.x,
      this.playerHandContainer.y,
      true
    );
    
    const opponentPositions = this.getFinalCardPositions(
      opponentCards.length,
      this.opponentHandContainer.x,
      this.opponentHandContainer.y,
      false
    );
    
    // Load card back texture once
    this.assetLoader.loadTexture('assets/CardBack_Blue.webp')
      .then(backTexture => {
        // Animation cards array
        const animCards = [];
        
        // Create opponent card animation sprites
        opponentCards.forEach((cardData, index) => {
          // Skip if position data is missing
          if (!opponentPositions[index]) {
            console.warn(`Missing position data for opponent card ${index}`);
            return;
          }
          
          // Create temporary sprite for animation
          const sprite = new PIXI.Sprite(backTexture);
          sprite.anchor.set(0.5, 0.5);
          sprite.width = this.config.cardWidth;
          sprite.height = this.config.cardHeight;
          sprite.x = deckX;
          sprite.y = deckY;
          sprite.rotation = 0;
          sprite.zIndex = 1000 + index;
          
          this.animationContainer.addChild(sprite);
          
          // Store data for animation
          animCards.push({
            sprite: sprite,
            cardData: cardData,
            isPlayer: false,
            finalPos: {
              x: this.opponentHandContainer.x + opponentPositions[index].x,
              y: this.opponentHandContainer.y + opponentPositions[index].y,
              rotation: opponentPositions[index].rotation
            }
          });
        });
        
        // Create player card animation sprites
        playerCards.forEach((cardData, index) => {
          // Skip if position data is missing
          if (!playerPositions[index]) {
            console.warn(`Missing position data for player card ${index}`);
            return;
          }
          
          // Create temporary sprite for animation
          const sprite = new PIXI.Sprite(backTexture);
          sprite.anchor.set(0.5, 0.5);
          sprite.width = this.config.cardWidth;
          sprite.height = this.config.cardHeight;
          sprite.x = deckX;
          sprite.y = deckY;
          sprite.rotation = 0;
          sprite.zIndex = 1000 + opponentCards.length + index;
          
          this.animationContainer.addChild(sprite);
          
          // Store data for animation
          animCards.push({
            sprite: sprite,
            cardData: cardData,
            isPlayer: true,
            finalPos: {
              x: this.playerHandContainer.x + playerPositions[index].x,
              y: this.playerHandContainer.y + playerPositions[index].y,
              rotation: playerPositions[index].rotation
            }
          });
        });
        
        // If no cards to animate, just complete
        if (animCards.length === 0) {
          console.warn("No cards to animate in dealing");
          skipDealingHandler();
          return;
        }
        
        // Delay between cards
        const dealDelay = 0.05;
        
        // Create timeline
        const timeline = gsap.timeline({
          onComplete: () => {
            if (wasInterrupted) return;
            
            // Remove animation sprites
            this.animationContainer.removeChildren();
            
            // Create final cards in their EXACT positions
            this.createFinalCards(
              playerCards, 
              opponentCards, 
              playerPositions, 
              opponentPositions, 
              backTexture,
              () => {
                // Now flip player cards
                this.flipPlayerCards(() => {
                  dealingInProgress = false;
                  this.app.stage.off('pointerdown', skipDealingHandler);
                  if (onComplete) onComplete();
                });
              }
            );
          }
        });
        
        // Animate each card flying directly to its final position
        animCards.forEach((card, i) => {
          timeline.to(card.sprite, {
            x: card.finalPos.x,
            y: card.finalPos.y,
            rotation: card.finalPos.rotation,
            duration: 0.3,
            ease: "power1.out"
          }, i * dealDelay);
        });
      })
      .catch(err => {
        console.error("Error in dealing animation:", err);
        skipDealingHandler();
      });
  }

  getFinalCardPositions(cardCount, containerX, containerY, isPlayer) {
    try {
      // Validate inputs
      if (typeof cardCount !== 'number' || cardCount < 0) {
        console.error("Invalid card count:", cardCount);
        return [];
      }
      
      const positions = [];
      const spacing = this.config.fanDistance || 30;
      const fanAngle = this.config.fanAngle || 10;
      
      // Calculate angles for fan effect
      const anglePerCard = cardCount > 1 ? fanAngle / (cardCount - 1) : 0;
      
      for (let i = 0; i < cardCount; i++) {
        const rotation = -fanAngle/2 + i * anglePerCard;
        const rotationRad = rotation * Math.PI / 180;
        
        // Player's cards face up (eventually), so rotation is reversed
        const finalRotation = isPlayer ? -rotationRad : rotationRad;
        
        // Calculate position in fan
        positions.push({
          x: -((cardCount - 1) * spacing / 2) + i * spacing,
          y: isPlayer ? 0 : Math.sin(rotationRad) * 10, // FIXED: Y should be 0 for player cards
          rotation: finalRotation
        });
      }
      
      return positions;
    } catch (error) {
      console.error("Error in getFinalCardPositions:", error);
      return [];
    }
  }

  calculateFanPositions(cardCount, containerX, containerY, isPlayer) {
    const positions = [];
    const spacing = this.config.fanDistance || 30;
    const fanAngle = this.config.fanAngle || 10;
    
    // Calculate angle between cards
    const anglePerCard = cardCount > 1 ? fanAngle / (cardCount - 1) : 0;
    
    // Calculate positions for each card in the fan
    for (let i = 0; i < cardCount; i++) {
      const rotation = -fanAngle/2 + i * anglePerCard;
      const rotationRad = rotation * Math.PI / 180;
      
      // Calculate x/y offset based on fan position
      const xPos = -((cardCount - 1) * spacing / 2) + i * spacing;
      const yPos = Math.sin(rotationRad) * 10;
      
      // For player cards, flip the rotation direction
      const finalRotation = isPlayer ? -rotationRad : rotationRad;
      
      positions.push({
        x: xPos,
        y: yPos,
        rotation: finalRotation
      });
    }
    
    return positions;
  }
  

  createFinalCardsInContainers(playerCards, opponentCards, playerPositions, opponentPositions, backTexture) {
    // Create opponent cards (all face down)
    opponentCards.forEach((cardData, index) => {
      const sprite = new PIXI.Sprite(backTexture);
      sprite.anchor.set(0.5, 0.9); // Bottom center anchor for fan
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      sprite.x = opponentPositions[index].x;
      sprite.y = opponentPositions[index].y;
      sprite.rotation = opponentPositions[index].rotation;
      sprite.zIndex = index;
      sprite.cardData = cardData;
      
      this.opponentHandContainer.addChild(sprite);
    });
    
    // Create player cards (also face down initially)
    playerCards.forEach((cardData, index) => {
      const sprite = new PIXI.Sprite(backTexture);
      sprite.anchor.set(0.5, 0.9);
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      sprite.x = playerPositions[index].x;
      sprite.y = playerPositions[index].y;
      sprite.rotation = playerPositions[index].rotation;
      sprite.zIndex = index;
      sprite.cardData = cardData;
      
      this.playerHandContainer.addChild(sprite);
    });
  }
  

  // Helper method to create all final card sprites but keep them invisible
  createFinalCards(playerCards, opponentCards, playerPositions, opponentPositions, backTexture, onComplete) {
    try {
      // Validate inputs to prevent null reference errors
      if (!playerCards || !opponentCards || !playerPositions || !opponentPositions || !backTexture) {
        console.error("Missing required parameters in createFinalCards");
        if (onComplete) setTimeout(onComplete, 0);
        return;
      }
      
      // Clear existing cards first
      this.playerHandContainer.removeChildren();
      this.opponentHandContainer.removeChildren();
      
      // Create opponent cards (all face down)
      opponentCards.forEach((cardData, index) => {
        // Validate position data exists for this index
        if (!opponentPositions[index]) {
          console.warn(`Missing position data for opponent card at index ${index}`);
          return; // Skip this card
        }
        
        const pos = opponentPositions[index];
        const sprite = new PIXI.Sprite(backTexture);
        sprite.anchor.set(0.5, 0.9); // Set anchor to bottom-center
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.x = pos.x;
        sprite.y = pos.y; // Keep the original y position
        sprite.rotation = pos.rotation;
        sprite.zIndex = index;
        sprite.cardData = cardData;
        
        this.opponentHandContainer.addChild(sprite);
      });
      
      // Create player cards (initially face down, will flip)
      playerCards.forEach((cardData, index) => {
        // Validate position data exists for this index
        if (!playerPositions[index]) {
          console.warn(`Missing position data for player card at index ${index}`);
          return; // Skip this card
        }
        
        const pos = playerPositions[index];
        const sprite = new PIXI.Sprite(backTexture);
        sprite.anchor.set(0.5, 0.9); // FIXED: Bottom-center anchor
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.x = pos.x;
        sprite.y = 0; // FIXED: Set to 0 relative to container
        sprite.rotation = pos.rotation;
        sprite.zIndex = index;
        sprite.cardData = cardData;
        
        this.playerHandContainer.addChild(sprite);
      });
      
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Error in createFinalCards:", error);
      // Still call onComplete to avoid blocking the game flow
      if (onComplete) setTimeout(onComplete, 0);
    }
  }

createAndShowFinalCards(playerCards, opponentCards) {
  // Calculate positions (same as during normal dealing)
  const playerPositions = this.getFinalCardPositions(
    playerCards.length,
    this.playerHandContainer.x,
    this.playerHandContainer.y,
    true
  );
  
  const opponentPositions = this.getFinalCardPositions(
    opponentCards.length,
    this.opponentHandContainer.x,
    this.opponentHandContainer.y,
    false
  );
  
  // First load back texture
  this.assetLoader.loadTexture('assets/CardBack_Blue.webp')
    .then(backTexture => {
      // Create opponent cards (face down)
      opponentCards.forEach((cardData, index) => {
        const sprite = new PIXI.Sprite(backTexture);
        sprite.anchor.set(0.5, 0.9);
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.x = opponentPositions[index].x;
        sprite.y = opponentPositions[index].y;
        sprite.rotation = opponentPositions[index].rotation;
        sprite.zIndex = index;
        sprite.cardData = cardData;
        
        this.opponentHandContainer.addChild(sprite);
      });
      
      // Now load front textures for player cards
      Promise.all(playerCards.map(card => {
        const cardPath = `assets/cards/${card.suit}/${card.value}_${card.suit.charAt(0).toUpperCase()}${card.suit.slice(1)}.webp`;
        return this.assetLoader.loadTexture(cardPath)
          .then(frontTexture => ({ cardData: card, texture: frontTexture }))
          .catch(err => {
            console.warn(`Error loading card texture:`, err);
            return { cardData: card, texture: null };
          });
      }))
      .then(cardsWithTextures => {
        // Create player cards (face up)
        cardsWithTextures.forEach((item, index) => {
          let sprite;
          
          if (item.texture) {
            sprite = new PIXI.Sprite(item.texture);
          } else {
            // Fallback
            sprite = this.createFallbackCardGraphics(item.cardData, false);
          }
          
          sprite.anchor.set(0.5, 0.9);
          sprite.width = this.config.cardWidth;
          sprite.height = this.config.cardHeight;
          sprite.x = playerPositions[index].x;
          sprite.y = playerPositions[index].y;
          sprite.rotation = playerPositions[index].rotation;
          sprite.zIndex = index;
          sprite.cardData = item.cardData;
          sprite.interactive = true;
          sprite.buttonMode = true;
          
          // Add click handler
          sprite.on('pointerdown', () => {
            if (this.onCardClick) {
              this.onCardClick(item.cardData, 'player');
            }
          });
          
          this.playerHandContainer.addChild(sprite);
        });
      });
    });
}


showAllFinalCards(playerCards, opponentCards) {
  // Clear containers
  this.playerHandContainer.removeChildren();
  this.opponentHandContainer.removeChildren();
  
  // Calculate positions
  const playerPositions = this.calculateFanPositions(
    playerCards.length,
    this.playerHandContainer.x, 
    this.playerHandContainer.y,
    true
  );
  
  const opponentPositions = this.calculateFanPositions(
    opponentCards.length,
    this.opponentHandContainer.x, 
    this.opponentHandContainer.y,
    false
  );
  
  // Create all cards immediately
  this.assetLoader.loadTexture('assets/CardBack_Blue.webp')
    .then(backTexture => {
      // Create opponent cards (face down)
      opponentCards.forEach((cardData, index) => {
        const sprite = new PIXI.Sprite(backTexture);
        sprite.anchor.set(0.5, 0.9);
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.x = opponentPositions[index].x;
        sprite.y = opponentPositions[index].y;
        sprite.rotation = opponentPositions[index].rotation;
        sprite.zIndex = index;
        sprite.cardData = cardData;
        
        this.opponentHandContainer.addChild(sprite);
      });
      
      // Load player card front textures and create front-facing cards
      Promise.all(playerCards.map(card => {
        const cardPath = `assets/cards/${card.suit}/${card.value}_${card.suit.charAt(0).toUpperCase()}${card.suit.slice(1)}.webp`;
        return this.assetLoader.loadTexture(cardPath)
          .then(frontTexture => {
            return {
              cardData: card,
              texture: frontTexture
            };
          })
          .catch(err => {
            console.warn(`Couldn't load texture for ${card.value} of ${card.suit}:`, err);
            return {
              cardData: card,
              texture: null
            };
          });
      }))
      .then(cardDataWithTextures => {
        // Create player cards (face up)
        cardDataWithTextures.forEach((item, index) => {
          let sprite;
          
          if (item.texture) {
            sprite = new PIXI.Sprite(item.texture);
          } else {
            // Fallback if texture loading failed
            sprite = this.createFallbackCardGraphics(item.cardData, false);
          }
          
          sprite.anchor.set(0.5, 0.9);
          sprite.width = this.config.cardWidth;
          sprite.height = this.config.cardHeight;
          sprite.x = playerPositions[index].x;
          sprite.y = playerPositions[index].y;
          sprite.rotation = playerPositions[index].rotation;
          sprite.zIndex = index;
          sprite.cardData = item.cardData;
          sprite.interactive = true;
          sprite.buttonMode = true;
          
          // Add click handler
          sprite.on('pointerdown', () => {
            if (this.onCardClick) {
              this.onCardClick(item.cardData, 'player');
            }
          });
          
          this.playerHandContainer.addChild(sprite);
        });
      });
    });
}


// Helper method to show all the final cards
showFinalCards() {
  [...this.playerHandContainer.children, ...this.opponentHandContainer.children].forEach(card => {
    gsap.to(card, { alpha: 1, duration: 0.2 });
  });
}

// Helper method to calculate card positions in a fan
calculateCardPositions(cards, target) {
  const spacing = this.config.fanDistance || 30;
  const totalCards = cards.length;
  const fanAngle = this.config.fanAngle || 10;
  const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
  
  const containerX = target === 'player' ? this.playerHandContainer.x : this.opponentHandContainer.x;
  const containerY = target === 'player' ? this.playerHandContainer.y : this.opponentHandContainer.y;
  
  return cards.map((cardData, index) => {
    const rotation = -fanAngle/2 + index * anglePerCard;
    const rotationRad = target === 'player' ? -(rotation * Math.PI / 180) : rotation * Math.PI / 180;
    
    return {
      x: -((totalCards - 1) * spacing / 2) + index * spacing,
      y: Math.sin(rotation * Math.PI / 180) * 10,
      rotation: rotationRad
    };
  });
}
  
  // Update the animateDealingCard method - now always deals face down initially
  animateDealingCard(cardData, targetPosition, delay = 0, faceDown = false, onComplete = null) {
  this.createCardSprite(cardData).then(sprite => {
    sprite.proj.euler.y = faceDown ? Math.PI : 0;  // карта перевёрнута или открыта в зависимости от faceDown
    sprite.position.set(this.deckContainer.x, this.deckContainer.y);
    sprite.zIndex = 200;
    this.animationContainer.addChild(sprite);

    // анимация перемещения карты
    gsap.to(sprite, {
      pixi: {
        x: targetPosition.x,
        y: targetPosition.y,
      },
      duration: 0.5,
      delay: delay,
      ease: "power2.out",
      onComplete: () => {
        // 3D переворот карты если это карта игрока
        if (!faceDown) {
          gsap.to(sprite.proj.euler, {
            y: Math.PI * 2, // переворачиваем на 360 градусов для плавного раскрытия
            duration: 0.6,
            ease: "power2.out",
            onComplete: () => {
              if (onComplete) onComplete(sprite);
            }
          });
        } else {
          if (onComplete) onComplete(sprite);
        }
      }
    });
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
    // Player hand - position at the bottom with correct vertical offset
    this.playerHandContainer.x = screenWidth / 2;
    this.playerHandContainer.y = screenHeight - 85; // FIXED: Consistent positioning that matches screenshot 2
    
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