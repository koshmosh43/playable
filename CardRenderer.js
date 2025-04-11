// CardRenderer.js - Handles card display, animations, and positioning
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
      this.opponentHandContainer.zIndex = 40;
      this.deckContainer.zIndex = 45;
      this.discardContainer.zIndex = 45;
      this.animationContainer.zIndex = 150;
      
      // Enable sorting children by z-index
      this.playerHandContainer.sortableChildren = true;
      this.discardContainer.sortableChildren = true;
      this.deckContainer.sortableChildren = true;
      
      // Initialize
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
      
      const spacing = this.config.fanDistance || 30;
      const fanAngle = this.config.fanAngle || 10;
      
      // New code: Identify cards that are part of possible melds (for green highlighting)
      const meldCardIds = new Set();
      if (possibleMelds && possibleMelds.length > 0) {
        possibleMelds.forEach(meld => {
          meld.forEach(card => meldCardIds.add(card.id));
        });
      }
      
      // Create sprites for each card
      for (let index = 0; index < playerCards.length; index++) {
        const cardData = playerCards[index];
        const sprite = await this.createCardSprite(cardData, false);
        
        // Calculate fan position and rotation
        const totalCards = playerCards.length;
        const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
        const rotation = -fanAngle/2 + index * anglePerCard;
        
        // Set anchor to bottom center for better fan effect
        sprite.anchor.set(0.5, 0.9);
        
        // Position in fan formation
        sprite.x = -((totalCards - 1) * spacing / 2) + index * spacing;
        sprite.y = Math.sin(rotation * Math.PI / 180) * 10;
        sprite.rotation = -(rotation * Math.PI / 180);
        
        // Interactive properties
        sprite.interactive = true;
        sprite.buttonMode = true;
        sprite.cardData = cardData;
        sprite.on('pointerdown', this.handleCardClick.bind(this, cardData, 'player'));
        
        // New code: Default z-index
        sprite.zIndex = index;
        
        // Modified highlighting logic:
        // Check if card is selected (highlight in yellow)
        if (selectedCard && selectedCard.id === cardData.id) {
          const highlight = new PIXI.Graphics();
          highlight.beginFill(0xFFC107, 0.5); // Yellow highlight
          highlight.drawRoundedRect(-this.config.cardWidth/2 - 5, -this.config.cardHeight * 0.9 - 5, 
                                 this.config.cardWidth + 10, this.config.cardHeight + 10, 5);
          highlight.endFill();
          highlight.zIndex = -1;
          sprite.addChild(highlight);
          
          // Raise selected card significantly (30px instead of 20px)
          sprite.y -= 30;
          sprite.zIndex = totalCards + 10; // Make sure it's on top
        }
        // New code: Check if card is part of a possible meld (highlight in green)
        else if (meldCardIds.has(cardData.id)) {
          const highlight = new PIXI.Graphics();
          highlight.beginFill(0x4CAF50, 0.5); // Green highlight
          highlight.drawRoundedRect(-this.config.cardWidth/2 - 5, -this.config.cardHeight * 0.9 - 5, 
                                 this.config.cardWidth + 10, this.config.cardHeight + 10, 5);
          highlight.endFill();
          highlight.zIndex = -1;
          sprite.addChild(highlight);
          
          // Slightly raise meld cards
          sprite.y -= 15;
          sprite.zIndex = totalCards + index; // Above normal cards but below selected
        }
        
        // Add to container
        this.playerHandContainer.addChild(sprite);
      }
  }
    
    // Render opponent's hand (face down cards)
    async renderOpponentHand(opponentCards) {
        if (!opponentCards || !opponentCards.length) return;
        
        const spacing = this.config.fanDistance || 30;
        const fanAngle = this.config.fanAngle || 10;
        
        // Создаем спрайты для каждой карты
        for (let index = 0; index < opponentCards.length; index++) {
          const cardData = opponentCards[index];
          const sprite = await this.createCardSprite(cardData, true);
          
          // Рассчитываем позицию и поворот в веере
          const totalCards = opponentCards.length;
          const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
          const rotation = -fanAngle/2 + index * anglePerCard;
          
          // Устанавливаем якорь к нижнему центру для лучшего веерного эффекта
          sprite.anchor.set(0.5, 0.9);
          
          // Позиционируем в веере
          sprite.x = (totalCards - 1) * spacing / 2 - index * spacing;
          sprite.y = Math.sin(rotation * Math.PI / 180) * 10;
          sprite.rotation = rotation * Math.PI / 180;
          
          // ВАЖНО: Устанавливаем точные фиксированные размеры
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
      
      // Создаем спрайты для видимых карт колоды
      for (let i = 0; i < visibleCount; i++) {
        const sprite = await this.createCardSprite({ faceDown: true }, true);
        
        // Смещаем каждую карту
        sprite.x = 0;
        sprite.y = -3 * i;
        sprite.zIndex = i;
        
        // Если это верхняя карта и колода не пуста, делаем ее интерактивной
        if (i === visibleCount - 1 && deckCount > 0) {
          // Создаем контейнер для счётчика
          const countContainer = new PIXI.Container();
          countContainer.zIndex = 999;
          
          const scaleFactor = 5;
          
          // Большой эллипс (фон счётчика)
          const ellipse = new PIXI.Graphics();
          ellipse.lineStyle(4, 0xFFFFFF);
          ellipse.beginFill(0x3366CC);
          ellipse.drawEllipse(0, 0, 22 * scaleFactor, 30 * scaleFactor);
          ellipse.endFill();
          
          // Дополнительная обводка
          ellipse.lineStyle(4, 0x000000);
          ellipse.drawEllipse(0, 0, 20 * scaleFactor, 28 * scaleFactor);
          
          // Текст счётчика
          const countText = new PIXI.Text(`${deckCount}`, {
            fontFamily: "Arial",
            fontSize: 22 * scaleFactor,
            fontWeight: "bold",
            fill: 0xFFFFFF
          });
          countText.anchor.set(0.5);
          
          countContainer.addChild(ellipse);
          countContainer.addChild(countText);
          
          // Размещаем контейнер по центру карты
          countContainer.x = this.config.cardWidth * 2.3;
          countContainer.y = this.config.cardHeight * 2.1;
          
          // Добавляем контейнер на карту
          sprite.addChild(countContainer);
          
          // Делаем верхнюю карту интерактивной и назначаем обработчик клика
          sprite.interactive = true;
          sprite.buttonMode = true;
          sprite.on('pointerdown', () => {
            this.handleCardClick({ faceDown: true }, 'deck');
          });
        }
        
        this.deckContainer.addChild(sprite);
      }
    }
    
    
    // Render the discard pile
    async renderDiscardPile(discardPile) {
      this.discardContainer.removeChildren();
      
      if (discardPile && discardPile.length > 0) {
        // Показываем до 5 верхних карт в сбросе вместо 3
        const visibleDiscards = Math.min(discardPile.length, 5);
        
        // Паттерн расположения карт - чередуем направление и угол поворота
        const positions = [
          { x: 0, y: 0, rotation: 0 },                // Центральная карта
          { x: 15, y: -3, rotation: 0.1 },            // Слегка вправо
          { x: -12, y: -8, rotation: -0.15 },         // Сильнее влево
          { x: 8, y: -12, rotation: 0.08 },           // Снова вправо
          { x: -18, y: -5, rotation: -0.12 }          // И влево
        ];
        
        // Отображаем карты начиная с самой нижней в стопке
        for (let i = 0; i < visibleDiscards; i++) {
          const discardIndex = discardPile.length - visibleDiscards + i;
          const discard = discardPile[discardIndex];
          
          const sprite = await this.createCardSprite(discard, false);
          
          // Увеличиваем размер карт
          sprite.width = this.config.cardWidth;
          sprite.height = this.config.cardHeight;
          
          // Устанавливаем якорь в центр для правильного поворота
          sprite.anchor.set(0.5);
          
          // Применяем предопределенное положение и поворот
          const pos = positions[i % positions.length];
          sprite.x = this.config.cardWidth/2 + pos.x;
          sprite.y = this.config.cardHeight/2 + pos.y;
          sprite.rotation = pos.rotation;
          
          // Z-индекс для правильного порядка наложения
          sprite.zIndex = i;
          
          // Верхняя карта интерактивная
          if (i === visibleDiscards - 1) {
            sprite.interactive = true;
            sprite.buttonMode = true;
            sprite.on('pointerdown', this.handleCardClick.bind(this, discard, 'discard'));
          }
          
          this.discardContainer.addChild(sprite);
        }
      } else {
        // Пустой сброс
        const emptyDiscard = new PIXI.Graphics();
        emptyDiscard.beginFill(0xFFFFFF, 0.2);
        emptyDiscard.drawRoundedRect(0, 0, this.config.cardWidth * 1.2, this.config.cardHeight * 1.2, 5);
        emptyDiscard.endFill();
        
        const emptyText = new PIXI.Text("Пусто", {
          fontFamily: "Arial",
          fontSize: 16,
          fill: 0xFFFFFF,
          align: 'center'
        });
        emptyText.anchor.set(0.5);
        emptyText.x = this.config.cardWidth * 0.6;
        emptyText.y = this.config.cardHeight * 0.6;
        
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
    
    // Animate card movement
    animateCard(cardData, fromPosition, toPosition, options = {}) {
      const {
        duration = 0.5,
        rotation = 0,
        onComplete = null,
        zIndex = 150,
        showHand = false
      } = options;
      
      this.createCardSprite(cardData, cardData.faceDown)
        .then(sprite => {
          // Set initial position
          sprite.x = fromPosition.x;
          sprite.y = fromPosition.y;
          sprite.zIndex = zIndex;
          
          // Add to animation container
          this.animationContainer.addChild(sprite);
          
          // Animate with GSAP
          gsap.to(sprite, {
            duration,
            x: toPosition.x,
            y: toPosition.y,
            rotation,
            ease: "power2.out",
            onComplete: () => {
              this.animationContainer.removeChild(sprite);
              if (onComplete) onComplete();
            }
          });
        });
    }
    
    // В CardRenderer.js заменить метод animateDealingCard
animateDealingCard(cardData, target, index, onComplete) {
  if (!cardData) {
    if (onComplete) onComplete();
    return;
  }

  // Используем реальную позицию колоды
  const deckX = this.deckContainer.x + this.config.cardWidth / 2;
  const deckY = this.deckContainer.y + this.config.cardHeight / 2;
  
  // Определяем конечную позицию
  let targetContainer, finalX, finalY, finalRotation;
  const spacing = this.config.fanDistance || 30;
  const fanAngle = this.config.fanAngle || 10;
  
  if (target === 'player') {
    targetContainer = this.playerHandContainer;
    const totalCards = 10; // Стандартный размер руки
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
  
  // Создаем спрайт карты
  this.createCardSprite(cardData, cardData.faceDown)
    .then(sprite => {
      sprite.anchor.set(0.5, 0.9);
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      sprite.cardData = cardData;
      
      // Глобальные координаты
      const startX = deckX;
      const startY = deckY;
      const endX = targetContainer.x + finalX;
      const endY = targetContainer.y + finalY;
      
      // Начальные настройки
      sprite.x = startX;
      sprite.y = startY;
      sprite.rotation = 0;
      sprite.scale.set(0.9);
      sprite.alpha = 1;
      sprite.zIndex = 200 + index;
      
      this.animationContainer.addChild(sprite);
      
      // Улучшенная анимация с естественной дугой
      const timeline = gsap.timeline({
        onComplete: () => {
          this.animationContainer.removeChild(sprite);
          
          // Создаем постоянный спрайт в руке
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
      
      // Расчет промежуточной точки с дугой
      const midX = startX + (endX - startX) * 0.5;
      const midY = startY + (endY - startY) * 0.3 - 30; // Дуга вверх
      
      // Первая часть - движение к промежуточной точке
      timeline.to(sprite, {
        x: midX,
        y: midY,
        rotation: finalRotation * 0.3,
        duration: 0.15,
        ease: "power1.out"
      });
      
      // Вторая часть - завершение движения
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
    // Animate taking a card (from deck or discard)
    animateOpponentCardTake(source) {
        // Начальная позиция
        const startX = source === 'deck'
          ? this.deckContainer.x + this.config.cardWidth / 2
          : this.discardContainer.x + this.config.cardWidth / 2;
        const startY = source === 'deck'
          ? this.deckContainer.y + this.config.cardHeight / 2
          : this.discardContainer.y + this.config.cardHeight / 2;
        
        // Целевая позиция в руке оппонента
        const spacing = this.config.fanDistance || 30;
        const totalCards = this.opponentHandContainer.children.length + 1;
        const endX = this.opponentHandContainer.x + (totalCards - 1) * spacing / 2 - (totalCards - 1) * spacing;
        const endY = this.opponentHandContainer.y;
        
        // Создаем спрайт карты (рубашкой вверх)
        this.createCardSprite({ faceDown: true }, true)
          .then(sprite => {
            // Устанавливаем точку привязки в центр
            sprite.anchor.set(0.5);
            
            // Задаем точные размеры
            sprite.width = this.config.cardWidth;
            sprite.height = this.config.cardHeight;
            
            // Устанавливаем начальную позицию
            sprite.x = startX;
            sprite.y = startY;
            sprite.zIndex = 150;
            
            // Добавляем в контейнер анимации
            this.animationContainer.addChild(sprite);
            
            // Анимируем перемещение
            gsap.to(sprite, {
              duration: 0.5,
              x: endX,
              y: endY,
              ease: "power2.out",
              onComplete: () => {
                // Удаляем спрайт из анимации по завершении
                this.animationContainer.removeChild(sprite);
              }
            });
          })
          .catch(error => {
            console.error("Ошибка в анимации взятия карты оппонентом:", error);
          });
      }
    
    // Animate discarding a card
    animateCardDiscard(cardData, sourceIndex) {
        // Начальная позиция в руке игрока
        const spacing = this.config.fanDistance || 30;
        const totalCards = this.playerHandContainer.children.length;
        const startX = this.playerHandContainer.x + (totalCards - 1) * spacing / 2 - sourceIndex * spacing;
        const startY = this.playerHandContainer.y;
        
        // Конечная позиция (сброс)
        const endX = this.discardContainer.x + this.config.cardWidth / 2;
        const endY = this.discardContainer.y + this.config.cardHeight / 2;
        
        // Создаем спрайт карты
        this.createCardSprite(cardData, false)
          .then(sprite => {
            // Устанавливаем точку привязки в центр для правильного размещения
            sprite.anchor.set(0.5);
            
            // Задаем точные размеры
            sprite.width = this.config.cardWidth;
            sprite.height = this.config.cardHeight;
            
            // Устанавливаем начальную позицию
            sprite.x = startX;
            sprite.y = startY;
            sprite.zIndex = 150;
            
            // Добавляем в контейнер анимации
            this.animationContainer.addChild(sprite);
            
            // Анимируем перемещение с сохранением размеров
            gsap.to(sprite, {
              duration: 0.5,
              x: endX,
              y: endY,
              ease: "power2.out",
              onComplete: () => {
                // Удаляем спрайт из анимации по завершении
                this.animationContainer.removeChild(sprite);
              }
            });
          })
          .catch(error => {
            console.error("Ошибка в анимации сброса карты:", error);
          });
      }
    
    // Animate opponent card take
    animateOpponentCardTake(source) {
        // Начальная позиция
        const startX = source === 'deck'
          ? this.deckContainer.x + this.config.cardWidth / 2
          : this.discardContainer.x + this.config.cardWidth / 2;
        const startY = source === 'deck'
          ? this.deckContainer.y + this.config.cardHeight / 2
          : this.discardContainer.y + this.config.cardHeight / 2;
        
        // Целевая позиция в руке оппонента
        const spacing = this.config.fanDistance || 30;
        const totalCards = this.opponentHandContainer.children.length + 1;
        const endX = this.opponentHandContainer.x + (totalCards - 1) * spacing / 2 - (totalCards - 1) * spacing;
        const endY = this.opponentHandContainer.y;
        
        // Создаем карту для анимации
        const cardData = { faceDown: true };
        
        // Создать спрайт с рубашкой карты
        this.createCardSprite(cardData, true)
          .then(sprite => {
            // Устанавливаем точные размеры
            sprite.width = this.config.cardWidth;
            sprite.height = this.config.cardHeight;
            
            // Устанавливаем позицию
            sprite.x = startX;
            sprite.y = startY;
            sprite.zIndex = 150;
            
            // Добавляем в контейнер анимации
            this.animationContainer.addChild(sprite);
            
            // Анимируем с GSAP
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
        // Начальная позиция в руке оппонента
        const spacing = this.config.fanDistance || 30;
        const totalCards = this.opponentHandContainer.children.length;
        const startX = this.opponentHandContainer.x + (totalCards - 1) * spacing / 2 - sourceIndex * spacing;
        const startY = this.opponentHandContainer.y;
        
        // Конечная позиция (сброс)
        const endX = this.discardContainer.x + this.config.cardWidth / 2;
        const endY = this.discardContainer.y + this.config.cardHeight / 2;
        
        // Используем переданные данные карты
        const cardToUse = cardData || {
          value: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][Math.floor(Math.random() * 13)],
          suit: ['hearts', 'diamonds', 'clubs', 'spades'][Math.floor(Math.random() * 4)],
          filename: null
        };
        
        // Генерируем имя файла, если оно отсутствует
        if (!cardToUse.filename && cardToUse.value && cardToUse.suit) {
          cardToUse.filename = `${cardToUse.value}_${cardToUse.suit.charAt(0).toUpperCase()}${cardToUse.suit.slice(1)}.webp`;
        }
        
        // ВАЖНОЕ ИЗМЕНЕНИЕ: Создаем ТОЛЬКО лицевую и обратную стороны одной карты
        Promise.all([
          this.createCardSprite(cardToUse, false), // Лицевая сторона
          this.createCardSprite({...cardToUse, faceDown: true}, true) // Рубашка
        ]).then(([faceUpCard, faceDownCard]) => {
          // Создаем контейнер для анимации
          const flipContainer = new PIXI.Container();
          flipContainer.x = startX;
          flipContainer.y = startY;
          flipContainer.zIndex = 200;
          
          // Устанавливаем якорные точки в центр для правильного переворота
          faceUpCard.anchor.set(0.5);
          faceDownCard.anchor.set(0.5);
          
          // КРИТИЧНО: Фиксируем размеры обеих сторон карты одинаковыми
          faceUpCard.width = this.config.cardWidth;
          faceUpCard.height = this.config.cardHeight;
          faceDownCard.width = this.config.cardWidth;
          faceDownCard.height = this.config.cardHeight;
          
          // Размещаем обе карты в центре контейнера
          faceUpCard.x = 0;
          faceUpCard.y = 0;
          faceDownCard.x = 0;
          faceDownCard.y = 0;
          
          // Начинаем с видимой рубашкой
          faceUpCard.visible = false;
          faceDownCard.visible = true;
          faceDownCard.scale.x = 1; // Начальный масштаб рубашки
          faceUpCard.scale.x = 0;  // Начальный масштаб лицевой (сжата)
          
          // Добавляем обе стороны карты в контейнер
          flipContainer.addChild(faceUpCard);
          flipContainer.addChild(faceDownCard);
          this.animationContainer.addChild(flipContainer);
          
          // Создаем анимацию с сохранением пропорций
          const timeline = gsap.timeline({
            onComplete: () => {
              this.animationContainer.removeChild(flipContainer);
            }
          });
          
          // Перемещаем к средней точке
          timeline.to(flipContainer, {
            x: (startX + endX) / 2,
            y: (startY + endY) / 2,
            duration: 0.3,
            ease: "power2.out"
          });
          
          // Переворачиваем карту - скрываем рубашку
          timeline.to(faceDownCard.scale, {
            x: 0,
            duration: 0.15,
            ease: "sine.in",
            onComplete: () => {
              faceDownCard.visible = false;
              faceUpCard.visible = true;
            }
          });
          
          // Показываем лицевую сторону
          timeline.to(faceUpCard.scale, {
            x: 1,
            duration: 0.15,
            ease: "sine.out"
          });
          
          // Перемещаем в финальную позицию
          timeline.to(flipContainer, {
            x: endX,
            y: endY,
            duration: 0.3,
            ease: "power2.in"
          });
        }).catch(error => {
          console.error("Ошибка в анимации переворота карты:", error);
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