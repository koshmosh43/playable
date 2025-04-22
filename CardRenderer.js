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
this.highlightedSource = null;
    
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
    // Custom suit order: clubs first, then diamonds, hearts, spades
    const suitOrder = {
      'clubs': 0,
      'diamonds': 1,
      'hearts': 2,
      'spades': 3
    };
    
    // Card value order
    const valueOrder = {
      'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
    };
    
    // Debug the input
    console.log("Sorting cards:", cards.map(c => `${c.value} of ${c.suit}`));
    
    // Make a copy of the array before sorting
    const sortedCards = [...cards].sort((a, b) => {
      // First sort by suit
      const aSuit = a.suit || '';
      const bSuit = b.suit || '';
      
      // Get suit order values with safety checks
      const aSuitOrder = suitOrder[aSuit] !== undefined ? suitOrder[aSuit] : 999;
      const bSuitOrder = suitOrder[bSuit] !== undefined ? suitOrder[bSuit] : 999;
      
      const suitDiff = aSuitOrder - bSuitOrder;
      if (suitDiff !== 0) return suitDiff;
      
      // Then sort by value within the same suit
      const aValue = a.value || '';
      const bValue = b.value || '';
      
      // Get value order with safety checks
      const aValueOrder = valueOrder[aValue] !== undefined ? valueOrder[aValue] : 999;
      const bValueOrder = valueOrder[bValue] !== undefined ? valueOrder[bValue] : 999;
      
      return aValueOrder - bValueOrder;
    });
    
    // Debug the output
    console.log("After sorting:", sortedCards.map(c => `${c.value} of ${c.suit}`));
    
    return sortedCards;
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
    await this.renderdeck(gameState.deckCount);
    
    // Render discard pile
    await this.renderDiscardPile(gameState.discardPile);
  }
  
  // Render player's hand of cards with fan effect
  async renderPlayerHand(playerCards, selectedCard, possibleMelds) {
    // 1) Clear container
    this.playerHandContainer.removeChildren();
  
    // 2) Exit if no cards
    if (!playerCards || playerCards.length === 0) return;
  
    // 3) Start with all cards
    let cards = [...playerCards];
  
    // 4) Build meldCards in the right order
    if (possibleMelds) {
      // 4.1) First all run cards in run order
      const runCards = possibleMelds.runs
        ? possibleMelds.runs.flatMap(run => run.cards)
        : [];
      const runIds = new Set(runCards.map(c => c.id));
  
      // 4.2) Then all set cards, but EXCLUDING those already in runs
      const setCards = possibleMelds.sets
        ? possibleMelds.sets.flatMap(set => set.cards)
        : [];
      const setIds = new Set(setCards.map(c => c.id));
  
      // 4.3) Remove duplicates and maintain order: runs → sets
      const meldCards = [];
      const seenMeld = new Set();
      
      // Add run cards first
      runCards.forEach(card => {
        if (!seenMeld.has(card.id)) {
          seenMeld.add(card.id);
          meldCards.push(card);
        }
      });
      
      // Then add set cards that aren't already in runs
      setCards.forEach(card => {
        if (!seenMeld.has(card.id)) {
          seenMeld.add(card.id);
          meldCards.push(card);
        }
      });
  
      // 4.4) Other cards - those not in any meld
      const otherCards = cards.filter(c => !seenMeld.has(c.id));
  
      // 4.5) Sort other cards by rank (2→A), suit secondary
      const valueOrder = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
      const suitOrder  = { clubs:0, diamonds:1, hearts:2, spades:3 };
      otherCards.sort((a, b) => {
        const dv = valueOrder[a.value] - valueOrder[b.value];
        if (dv !== 0) return dv;
        return suitOrder[a.suit] - suitOrder[b.suit];
      });
  
      // 4.6) Final order: run cards, then set cards, then other cards
      cards = [...meldCards, ...otherCards];
    }
  
    // 5) Calculate spacing/fanAngle and render
    const total = cards.length;
    let spacing = this.config.fanDistance;
    if (total > 10) {
      spacing = Math.max(20, this.config.fanDistance - (total - 10) * 2);
    }
    const fanAngle = this.config.fanAngle;
  
    for (let i = 0; i < total; i++) {
      const cardData = cards[i];
      const sprite = await this.createCardSprite(cardData);
  
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      sprite.anchor.set(0.5, 0.9);
      sprite.zIndex = i;
      sprite.cardData = cardData;
  
      const x = -((total - 1) * spacing / 2) + i * spacing;
      const angleRad = ((-(-fanAngle/2 + (fanAngle/(total-1))*i)) * Math.PI) / 180;
      sprite.x = x;
      sprite.y = 0;
      sprite.rotation = angleRad;
  
      if (i === total - 1) {
        sprite.rightmost = true;
      }
  
      // Highlighting logic - clearly separated for runs and sets
      if (possibleMelds) {
        // Check if card is in a run (green highlight)
        const inRun = possibleMelds.runs?.some(run => 
          run.cards.some(c => c.id === cardData.id)
        );
        
        if (inRun) {
          // Card is in a run - apply green highlight
          this.applySpecialHighlight(sprite, 0x98FB98, 0.5);
        } 
        else {
          // Card is NOT in a run - check if it's in a set
          const inSet = possibleMelds.sets?.some(set => 
            set.cards.some(c => c.id === cardData.id)
          );
          
          if (inSet) {
            // Card is in a set - apply yellow highlight
            this.applySpecialHighlight(sprite, 0xFFFE7A, 0.5);
          }
        }
      }
  
      // Selected card highlighting
      if (selectedCard?.id === cardData.id) {
        this.applySimpleSelectedHighlight(sprite);
      }
      
      // Set up drag and drop
      if (this.isDragEnabled) {
        this.setupDragAndDrop(sprite, cardData);
      }
      
      // Add click handler
      sprite.on('pointerdown', () => this.onCardClick?.(cardData, 'player'));
  
      this.playerHandContainer.addChild(sprite);
    }
  
    // 6) Sort by z-index
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
  applySimpleSelectedHighlight(sprite) {
    // Use a glow filter instead of manipulation that might require projection
    const filter = new PIXI.filters.ColorMatrixFilter();
    filter.matrix = [1.1,0,0,0,0, 0,1.1,0,0,0, 0,0,1.1,0,0, 0,0,0,1,0];
    sprite.filters = [filter];
    
    // Move card up slightly - without using projection
    sprite.y -= 10;
  }

  setupDragAndDrop(sprite, cardData) {
    // Удаляем существующие обработчики, чтобы избежать дублирования
    sprite.removeAllListeners('pointerdown');
    sprite.removeAllListeners('pointermove');
    sprite.removeAllListeners('pointerup');
    sprite.removeAllListeners('pointerupoutside');
    
    // Переменные для отслеживания состояния перетаскивания
    let isDragging = false;
    let dragStartData = null;
    let originalZIndex = sprite.zIndex;
    
    // Сохраняем оригинальные значения для восстановления
    sprite.originalPosition = {
      x: sprite.x,
      y: sprite.y,
      rotation: sprite.rotation,
      zIndex: sprite.zIndex,
      scaleX: sprite.scale.x,
      scaleY: sprite.scale.y
    };
    
    // ВАЖНО: сохраняем ссылки на подсветку и фильтры
    sprite.originalHighlightBar = sprite.highlightBar;
    sprite.originalFilters = sprite.filters;
    
    // Обработчик начала перетаскивания
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
      
      // Сохраняем оригинальный z-index
      originalZIndex = sprite.zIndex;
      sprite.zIndex = 1000;
      this.playerHandContainer.sortChildren();
      
      // Масштабируем для перетаскивания, но сохраняем подсветку
      if (sprite.cardData && sprite.cardData.source !== 'deck') {
        sprite.scale.set(0.7);
      }
      
      // Сохраняем состояние игровой фазы с перетаскиваемыми данными
      const isDrawPhase = window.game && window.game.playerTurn && window.game.gameStep % 2 === 0;
      const isDiscardPhase = window.game && window.game.playerTurn && window.game.gameStep % 2 === 1;
      
      sprite.dragPhaseInfo = { isDrawPhase, isDiscardPhase };
      
      // Сохраняем информацию о типе мелда
      const meldType = window.game && 
                      window.game.checkCardInMeld && 
                      sprite.cardData &&
                      window.game.checkCardInMeld(sprite.cardData);
      
      // Сохраняем тип мелда вместе с другой информацией о перетаскивании
      sprite.dragMeldType = meldType;
      
      // Запускаем событие начала перетаскивания
      const dragStartEvent = new CustomEvent('cardDragStart', { 
        detail: { cardData, sprite }
      });
      document.dispatchEvent(dragStartEvent);
    };
    
    // Обработчик перемещения при перетаскивании
    const onDragMove = (event) => {
      if (!isDragging) return;
      
      // Расчет позиции и перемещение спрайта
      const newPosition = event.data.global;
      const newLocalPos = this.playerHandContainer.toLocal(newPosition);
      sprite.x = newLocalPos.x;
      sprite.y = newLocalPos.y;
      sprite.rotation = 0;
      
      // Проверка, находится ли карта над зоной сброса
      const globalPos = sprite.toGlobal(new PIXI.Point(0, 0));
      const isOverDiscard = this.isOverDiscardPile(globalPos);
      
      // Проверки фазы игры и типа карты
      const isPlayerCardInDrawPhase = 
        sprite.dragPhaseInfo && 
        sprite.dragPhaseInfo.isDrawPhase && 
        cardData.source !== 'deck' && 
        cardData.source !== 'discard';
      
      // Проверяем, является ли карта частью мелда
      const isCardInMeld = sprite.dragMeldType || 
                         (window.game && window.game.checkCardInMeld && 
                         sprite.cardData && window.game.checkCardInMeld(sprite.cardData));
      
      // Определяем тип мелда для правильного цвета
      let meldType = null;
      if (isCardInMeld) {
        meldType = typeof isCardInMeld === 'string' ? isCardInMeld : 
                  (sprite.dragMeldType || '');
      }
      
      // Визуальный отклик при нахождении над отбоем
      if (isOverDiscard && !sprite.isOverDiscard) {
        sprite.isOverDiscard = true;
        
        // Анимация масштаба для всех карт
        gsap.to(sprite.scale, {
          x: 0.65, y: 0.65,
          duration: 0.2
        });
        
        // Логика подсветки в зависимости от типа карты
        if (isCardInMeld) {
          // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Сохраняем оригинальный бар для карт из мелда
          // Просто добавляем текстовую подсказку и НЕ меняем цвет бара
          
          // Если нет диалога и находимся в правильной фазе
          if (window.game && window.game.uiRenderer && !window.game.uiRenderer.dialogVisible) {
            // Показываем соответствующее сообщение
            if (isPlayerCardInDrawPhase) {
              window.game.uiRenderer.showDialog("Take a card from deck\nor\ndiscard pile first!");
            } else {
              window.game.uiRenderer.showDialog(`Cannot discard a card in a ${meldType}!`);
            }
          }
          
          // НЕ меняем бар, сохраняем оригинальный!
        } else {
          // Для обычных карт - никакой подсветки
          if (sprite.filters) {
            sprite.filters = null;
          }
          if (sprite.highlightBar) {
            sprite.removeChild(sprite.highlightBar);
            sprite.highlightBar = null;
          }
        }
      } else if (!isOverDiscard && sprite.isOverDiscard) {
        sprite.isOverDiscard = false;
        
        // Восстанавливаем масштаб
        gsap.to(sprite.scale, {
          x: 0.7, y: 0.7,
          duration: 0.2
        });
        
        // Скрываем диалог, если он был показан
        if (window.game && window.game.uiRenderer) {
          window.game.uiRenderer.hideDialog();
        }
        
        // Для карт не из мелда - очищаем подсветку
        if (!isCardInMeld) {
          if (sprite.filters) {
            sprite.filters = null;
          }
          if (sprite.highlightBar) {
            sprite.removeChild(sprite.highlightBar);
            sprite.highlightBar = null;
          }
        }
      }
    };
    
    // Обработчик окончания перетаскивания
    const onDragEnd = (event) => {
      if (!isDragging) return;
      isDragging = false;
      
      // Сбрасываем состояние подсветки
      sprite.isOverDiscard = false;
      
      // Получаем глобальную позицию спрайта
      const globalPos = sprite.toGlobal(new PIXI.Point(0, 0));
      
      // Проверяем, отпущена ли карта над зоной сброса
      const isOverDiscard = this.isOverDiscardPile(globalPos);
      
      // Проверяем фазу игры
      const isDrawPhase = sprite.dragPhaseInfo && sprite.dragPhaseInfo.isDrawPhase;
      const isDiscardPhase = sprite.dragPhaseInfo && sprite.dragPhaseInfo.isDiscardPhase;
      
      // Проверяем, является ли карта частью мелда
      const isCardInMeld = sprite.dragMeldType || 
                           (window.game && window.game.checkCardInMeld && 
                           sprite.cardData && window.game.checkCardInMeld(sprite.cardData));
      
      // Определяем тип мелда для сообщения
      let meldType = isCardInMeld;
      if (typeof isCardInMeld !== 'string' && isCardInMeld) {
        meldType = sprite.dragMeldType || 'meld';
      }
      
      // УСЛОВИЕ 1: Если пытаемся сбросить карту в фазе взятия
      if (isOverDiscard && isDrawPhase) {
        // Показываем уведомление
        if (window.game && window.game.uiRenderer) {
          window.game.uiRenderer.showDialog("Take a card from deck\nor\ndiscard pile first!");
        }
        
        // Генерируем событие
        const wrongPhaseEvent = new CustomEvent('cardDragEnd', { 
          detail: { 
            cardData, 
            sprite, 
            targetArea: 'wrong-phase-discard',
            position: globalPos
          }
        });
        document.dispatchEvent(wrongPhaseEvent);
        
        // Возвращаем карту в руку - сохраняем оригинальный бар
        this.snapCardBack(sprite, isCardInMeld);
        return;
      }
      
      // УСЛОВИЕ 2: Если пытаемся сбросить карту из мелда
      if (isOverDiscard && isCardInMeld) {
        // Показываем уведомление
        if (window.game && window.game.uiRenderer) {
          window.game.uiRenderer.showDialog(`Cannot discard a card in a ${meldType}!`);
        }
        
        // Генерируем событие
        const meldCardEvent = new CustomEvent('cardDragEnd', { 
          detail: { 
            cardData, 
            sprite, 
            targetArea: 'protected-meld-card',
            position: globalPos,
            meldType: meldType
          }
        });
        document.dispatchEvent(meldCardEvent);
        
        // Возвращаем карту с сохранением оригинального бара
        this.snapCardBack(sprite, true);
        return;
      }
      
      // Стандартная обработка для обычных карт
      const dragEndEvent = new CustomEvent('cardDragEnd', { 
        detail: { 
          cardData, 
          sprite, 
          targetArea: isOverDiscard ? 'discard' : 'hand',
          position: globalPos
        }
      });
      document.dispatchEvent(dragEndEvent);
      
      // Если не сбрасываем на отбой, возвращаем карту в руку
      if (!isOverDiscard) {
        this.snapCardBack(sprite, isCardInMeld);
      }
    };
    
    // Добавляем обработчики событий
    sprite.on('pointerdown', (event) => {
      event.stopPropagation();
      sprite.data = event.data;
      onDragStart(event);
    });
    
    sprite.on('pointermove', onDragMove);
    sprite.on('pointerup', onDragEnd);
    sprite.on('pointerupoutside', onDragEnd);
    
    // Устанавливаем интерактивность карты
    sprite.interactive = true;
    sprite.buttonMode = true;
  }
  

  startCardDragging(cardData, source) {
    console.log(`STARTING DRAG FROM ${source}`, cardData);
  
    // Stop all animations
    gsap.killTweensOf(this.deckContainer.scale);
    gsap.killTweensOf(this.discardContainer.scale);
    this.deckContainer.scale.set(1, 1); // Reset to normal scale - IMPORTANT
    this.discardContainer.scale.set(1, 1);
  
    // MODIFIED: For discard pile, remove the top card immediately when dragging starts
    if (source === 'discard') {
      // Get number of cards in discard pile
      const discardCount = this.discardContainer.children.length;
      
      // If there are cards in discard, remove only the top (last) one
      if (discardCount > 0) {
        // Find the top card in the stack
        const topCardIndex = discardCount - 1;
        const topCard = this.discardContainer.getChildAt(topCardIndex);
        
        // Remove only the top card
        this.discardContainer.removeChildAt(topCardIndex);
        
        console.log('Removed top card from discard pile!');
      }
    }
  
    // If already dragging a card, stop
    if (this.draggingCard) return;
    
    // Save information about the dragged card
    this.draggingCardSource = source;
    this.draggingCardData = cardData;
    
    // Create sprite for dragging
    this.createCardSprite(cardData, false).then(sprite => {
      this.draggingCard = sprite;
      
      // Set up dragging card appearance
      sprite.anchor.set(0.5);
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      sprite.alpha = 1;
      sprite.zIndex = 1000; // Above all other elements
      
      // Add to animation container
      this.animationContainer.addChild(sprite);
      
      // Set initial position based on source
      if (source === 'deck') {
        sprite.x = this.deckContainer.x + this.config.cardWidth / 2;
        sprite.y = this.deckContainer.y + this.config.cardHeight / 2;
      } else if (source === 'discard') {
        sprite.x = this.discardContainer.x + this.config.cardWidth / 2;
        sprite.y = this.discardContainer.y + this.config.cardHeight / 2;
      }
      
      // Remove any previous event handlers
      window.removeEventListener('mousemove', this.moveCardHandler);
      window.removeEventListener('touchmove', this.moveCardHandler);
      window.removeEventListener('mouseup', this.releaseCardHandler);
      window.removeEventListener('touchend', this.releaseCardHandler);
      
      // Set up event handlers
      window.addEventListener('mousemove', this.moveCardHandler);
      window.addEventListener('touchmove', this.moveCardHandler);
      window.addEventListener('mouseup', this.releaseCardHandler);
      window.addEventListener('touchend', this.releaseCardHandler);
      
      // Dispatch drag started event
      document.dispatchEvent(new CustomEvent('cardDragStarted', {
        detail: { cardData, source }
      }));
    }).catch(err => {
      console.error("Error creating dragging card sprite:", err);
    });
  }

  moveCardHandler = (event) => {
    if (!this.draggingCard) return;
  
    // Get cursor/touch coordinates
    let clientX, clientY;
    
    if (event.type === 'touchmove') {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    // Convert screen coordinates to game coordinates
    const rect = this.app.view.getBoundingClientRect();
    const x = (clientX - rect.left) * (this.app.screen.width / rect.width);
    const y = (clientY - rect.top) * (this.app.screen.height / rect.height);
    
    // Update card position
    this.draggingCard.x = x;
    this.draggingCard.y = y;
    
    // MODIFIED: For deck cards, don't scale at all - keep consistent size
    if (this.draggingCardSource === 'deck') {
      // Only update position without scaling
      return;
    }
    
    // For cards from discard or player hand, check if over valid drop areas
    const position = { x, y };
    const isOverDiscard = this.isOverDiscardPile(position);
    const isOverPlayerHand = this.isOverPlayerHand(position);
    
    // Adjust scale based on position
    if ((isOverDiscard || isOverPlayerHand) && this.draggingCard.scale.x > 0.7) {
      // Smoothly reduce scale to normal
      gsap.to(this.draggingCard.scale, {
        x: 0.7, 
        y: 0.7,
        duration: 0.2, // Fast animation for responsiveness
        ease: "power2.out"
      });
    } 
    // If not over discard or hand and already reduced, restore enlarged scale
    else if (!isOverDiscard && !isOverPlayerHand && this.draggingCard.scale.x < 0.7) {
      // Restore enlarged scale
      gsap.to(this.draggingCard.scale, {
        x: 0.65, 
        y: 0.65,
        duration: 0.2,
        ease: "power2.out"
      });
    }
  }


  releaseCardHandler = (event) => {
    if (!this.draggingCard) return;
  
    // Immediately stop any pulse animations
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
  
    // Check where the card was released
    const isOverHand = this.isOverPlayerHand(position);
    const isOverDiscard = this.isOverDiscardPile(position);
  
    // Determine game phase
    const isDrawPhase = window.game && window.game.playerTurn && window.game.gameStep % 2 === 0;
    const isDiscardPhase = window.game && window.game.playerTurn && window.game.gameStep % 2 === 1;
  
    // NEW CONDITION: Check if the card is part of a meld (set or run)
    const isCardInMeld = window.game && window.game.checkCardInMeld && 
                        this.draggingCardSource === 'player' &&
                        window.game.checkCardInMeld(this.draggingCardData);
  
    // CRITICAL CONDITION 1: If player card released on discard during draw phase
    if (isOverDiscard && isDrawPhase && this.draggingCardSource === 'player') {
      console.log("Cannot discard a card during draw phase - returning to hand");
      
      // Сохраняем исходный масштаб, если он не был сохранен
      if (this.draggingCard && (!this.draggingCard.originalPosition || this.draggingCard.originalPosition.scaleX === undefined)) {
        this.draggingCard.originalPosition = this.draggingCard.originalPosition || {};
        this.draggingCard.originalPosition.scaleX = 0.53;
        this.draggingCard.originalPosition.scaleY = 0.53;
      }
      
      // Notify player
      if (window.game && window.game.uiRenderer) {
        window.game.uiRenderer.showDialog("Take a card from deck or discard first!");
      }
      
      // Return card to hand
      this.returnDraggingCard(isCardInMeld);
      
      // Generate event to handle this case
      document.dispatchEvent(new CustomEvent('cardDragReleased', {
        detail: {
          cardData: this.draggingCardData,
          source: this.draggingCardSource,
          targetArea: 'wrong-phase-discard',
          position
        }
      }));
      
      return;
    }
  
    // NEW CONDITION: If card is part of a meld and trying to discard it
    if (isOverDiscard && isDrawPhase) {
      // Показываем уведомление
      if (window.game && window.game.uiRenderer) {
        window.game.uiRenderer.showDialog("Take a card from deck\nor\ndiscard pile first!");
      }
      
      // Генерируем специальное событие
      const wrongPhaseEvent = new CustomEvent('cardDragEnd', { 
        detail: { 
          cardData, 
          sprite, 
          targetArea: 'wrong-phase-discard',
          position: globalPos
        }
      });
      document.dispatchEvent(wrongPhaseEvent);
      
      // Возвращаем карту в руку с анимацией и восстанавливаем масштаб 0.53
      this.snapCardBack(sprite, false);
      return;
    }
  
    // CRITICAL CONDITION 2: If deck/discard card during discard phase
    if ((this.draggingCardSource === 'deck' || this.draggingCardSource === 'discard') && isDiscardPhase) {
      console.log("Cannot take a card during discard phase - canceling action");
      
      // Notify player
      if (window.game && window.game.uiRenderer) {
        window.game.uiRenderer.showDialog("Discard a card to end your turn!");
      }
      
      // Clean up dragging state
      if (this.draggingCard) {
        this.animationContainer.removeChild(this.draggingCard);
        this.draggingCard = null;
        this.draggingCardData = null;
        this.draggingCardSource = null;
      }
      
      return;
    }
  
    // Normal handling for allowed cases
    document.dispatchEvent(new CustomEvent('cardDragReleased', {
      detail: {
        cardData: this.draggingCardData,
        source: this.draggingCardSource,
        targetArea: isOverHand ? 'hand' : (isOverDiscard ? 'discard' : 'none'),
        position
      }
    }));
  
    // Remove event handlers
    window.removeEventListener('mousemove', this.moveCardHandler);
    window.removeEventListener('touchmove', this.moveCardHandler);
    window.removeEventListener('mouseup', this.releaseCardHandler);
    window.removeEventListener('touchend', this.releaseCardHandler);
  
    // Handle animation and cleanup based on target
    if (isOverHand) {
      // If released over hand, animate to final size and add to hand
      gsap.to(this.draggingCard.scale, {
        x: 1.0, y: 1.0,
        duration: 0.15,
        ease: "power2.out",
        onComplete: () => this.addDraggingCardToHand()
      });
    } else if (isOverDiscard) {
      // If released on discard, just clean up dragging state
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
      // If released somewhere else, return card to original position
      this.returnDraggingCard();
    }
  }

  returnDraggingCard(isProtectedMeld = false) {
    if (!this.draggingCard) return;
    
    // Проверяем наличие оригинальной позиции
    if (!this.draggingCard.originalPosition) {
      this.draggingCard.originalPosition = {
        x: this.draggingCard.x,
        y: this.draggingCard.y,
        rotation: this.draggingCard.rotation,
        zIndex: this.draggingCard.zIndex < 100 ? this.draggingCard.zIndex : 0
      };
    }
  
    // Восстанавливаем z-index
    this.draggingCard.zIndex = this.draggingCard.originalPosition.zIndex || 0;
    this.playerHandContainer.sortChildren();
    
    // Проверяем, является ли карта частью мелда
    let meldType = this.draggingCardData && this.draggingCard.dragMeldType;
    
    // Если мелд-тип не сохранен, проверяем через игру
    if (!meldType && window.game && window.game.checkCardInMeld && this.draggingCardData) {
      meldType = window.game.checkCardInMeld(this.draggingCardData);
    }
    
    // Определяем цвет подсветки по типу мелда
    let highlightColor = null;
    if (meldType === 'set') {
      highlightColor = 0xFFFE7A; // Желтый для SET
    } else if (meldType === 'run') {
      highlightColor = 0x98FB98; // Зеленый для RUN
    }
    
    // Сохраняем ссылки для использования в анимации
    const draggingCard = this.draggingCard;
    const draggingCardData = this.draggingCardData;
    const draggingCardSource = this.draggingCardSource;
    
    // ЕДИНАЯ АНИМАЦИЯ для всех карт из мелдов
    if (meldType || isProtectedMeld) {
      // Анимация "тряски" с последующим возвратом
      gsap.timeline()
        // Тряска влево
        .to(this.draggingCard, {
          x: this.draggingCard.originalPosition.x - 15,
          duration: 0.06,
          ease: "power1.inOut"
        })
        // Тряска вправо
        .to(this.draggingCard, {
          x: this.draggingCard.originalPosition.x + 15,
          duration: 0.06,
          ease: "power1.inOut"
        })
        // Тряска влево (меньше)
        .to(this.draggingCard, {
          x: this.draggingCard.originalPosition.x - 8,
          duration: 0.06,
          ease: "power1.inOut"
        })
        // Возврат в центр
        .to(this.draggingCard, {
          x: this.draggingCard.originalPosition.x,
          duration: 0.06,
          ease: "power1.inOut",
          onComplete: () => {
            // Гарантируем правильную подсветку
            if (highlightColor) {
              this.applySpecialHighlight(draggingCard, highlightColor, 0.5);
            }
          }
        })
        // Устанавливаем масштаб мгновенно
        .set(this.draggingCard.scale, {
          x: 0.53,
          y: 0.53
        })
        // Анимируем возврат в исходную позицию
        .to(this.draggingCard, {
          x: this.draggingCard.originalPosition.x,
          y: this.draggingCard.originalPosition.y,
          rotation: this.draggingCard.originalPosition.rotation,
          duration: 0.3,
          ease: "back.out",
          onComplete: () => {
            // Очищаем состояние перетаскивания
            this.animationContainer.removeChild(draggingCard);
            this.draggingCard = null;
            this.draggingCardData = null;
            this.draggingCardSource = null;
            
            // Обновляем отображение
            if (window.game) {
              window.game.updatePlayScreen();
            }
          }
        });
    } else {
      // Для обычных карт - простая анимация возврата
      this.draggingCard.scale.set(0.53, 0.53);
      
      gsap.to(this.draggingCard, {
        x: this.draggingCard.originalPosition.x,
        y: this.draggingCard.originalPosition.y,
        rotation: this.draggingCard.originalPosition.rotation,
        duration: 0.3,
        ease: "back.out",
        onComplete: () => {
          // Очищаем состояние перетаскивания
          this.animationContainer.removeChild(draggingCard);
          this.draggingCard = null;
          this.draggingCardData = null;
          this.draggingCardSource = null;
          
          // Обновляем отображение
          if (window.game) {
            window.game.updatePlayScreen();
          }
        }
      });
    }
  }

// Метод для добавления карты в веер
addDraggingCardToHand() {
  if (!this.draggingCard || !this.draggingCardData) return;
  
  // Calculate where to add the new card in the fan
  const newIndex = this.calculateNewCardIndex();
  
  // If this card is coming from the discard pile, make sure it's completely removed
  if (this.draggingCardSource === 'discard') {
    console.log("Card added from discard, ensuring it's removed from discard pile");
  }
  
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
  
  // IMPROVED: Properly refresh fan layout after adding card
  // Force a complete redraw of the player's hand to ensure proper fan layout
  if (window.game) {
    // First, completely remove all cards from the visual container
    this.playerHandContainer.removeChildren();
    
    // Make sure to update the fan layout when a new card is added
    window.game.cardManager.playerCards = window.game.sortCardsWithMelds();
    
    console.log("Card add complete - triggering complete redraw of player hand");
    
    // Force a slight delay to ensure other processes complete first
    setTimeout(() => {
      // Update the game display to show the new card in the fan
      window.game.updatePlayScreen();
    }, 50);
  } else {
    // Fallback if window.game isn't available
    console.log("Card add complete - triggering redraw");
    setTimeout(() => {
      // Force update to ensure proper display
      if (window.game) {
        window.game.updatePlayScreen();
      }
    }, 50);
  }
}

// Create a sprite for a card (face up)
async createCardSprite(cardData, isFaceDown = false) {
  let texture;
  
  try {
    if (isFaceDown || (cardData && cardData.faceDown)) {
      // Карта рубашкой вверх
      texture = await this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp');
    } else if (cardData && cardData.suit && cardData.value) {
      // Загружаем лицевую сторону
      const suit = cardData.suit;
      const value = cardData.value;
      const frontPath = `https://koshmosh43.github.io/playable/assets/cards/${suit}/${value}_${suit.charAt(0).toUpperCase()}${suit.slice(1)}.webp`;
      texture = await this.assetLoader.loadTexture(frontPath);
    } else {
      // Если данных нет, загружаем рубашку
      texture = await this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp');
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
  this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp')
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

snapCardBack(sprite, isProtectedMeld = false) {
  // Проверяем наличие sprite и originalPosition
  if (!sprite || !sprite.originalPosition) {
    if (sprite) {
      // Создаем значения по умолчанию, если их нет
      sprite.originalPosition = {
        x: sprite.x,
        y: sprite.y,
        rotation: sprite.rotation,
        zIndex: sprite.zIndex < 100 ? sprite.zIndex : 0
      };
    } else {
      return; // Если спрайт не определен, выходим
    }
  }

  // Восстанавливаем оригинальный z-index
  sprite.zIndex = sprite.originalPosition.zIndex || 0;
  this.playerHandContainer.sortChildren();
  
  // Проверяем, является ли карта частью мелда
  let meldType = sprite.dragMeldType;
  
  // Если мелд-тип не сохранен в спрайте, проверяем через игру
  if (!meldType && window.game && window.game.checkCardInMeld && sprite.cardData) {
    meldType = window.game.checkCardInMeld(sprite.cardData);
  }
  
  // Определяем цвет подсветки по типу мелда
  let highlightColor = null;
  if (meldType === 'set') {
    highlightColor = 0xFFFE7A; // Желтый для SET
  } else if (meldType === 'run') {
    highlightColor = 0x98FB98; // Зеленый для RUN
  }
  
  // ЕДИНАЯ АНИМАЦИЯ для всех карт из мелдов
  if (meldType || isProtectedMeld) {
    // Анимация "тряски" с последующим возвратом
    gsap.timeline()
      // Тряска влево
      .to(sprite, {
        x: sprite.originalPosition.x - 15,
        duration: 0.06,
        ease: "power1.inOut"
      })
      // Тряска вправо
      .to(sprite, {
        x: sprite.originalPosition.x + 15,
        duration: 0.06,
        ease: "power1.inOut"
      })
      // Тряска влево (меньше)
      .to(sprite, {
        x: sprite.originalPosition.x - 8,
        duration: 0.06,
        ease: "power1.inOut"
      })
      // Возврат в центр
      .to(sprite, {
        x: sprite.originalPosition.x,
        duration: 0.06,
        ease: "power1.inOut",
        onComplete: () => {
          // Гарантируем правильную подсветку
          if (highlightColor) {
            this.applySpecialHighlight(sprite, highlightColor, 0.5);
          }
        }
      })
      // Устанавливаем масштаб мгновенно
      .set(sprite.scale, {
        x: 0.53,
        y: 0.53
      })
      // Анимируем возврат в исходную позицию
      .to(sprite, {
        x: sprite.originalPosition.x,
        y: sprite.originalPosition.y,
        rotation: sprite.originalPosition.rotation,
        duration: 0.3,
        ease: "back.out"
      });
  } else {
    // Для обычных карт - простая анимация возврата
    sprite.scale.set(0.53, 0.53);
    
    gsap.to(sprite, {
      x: sprite.originalPosition.x,
      y: sprite.originalPosition.y,
      rotation: sprite.originalPosition.rotation,
      duration: 0.3,
      ease: "back.out"
    });
  }
}

// Apply special highlight with more subtle effect
applySpecialHighlight(sprite, color, alpha = 0.3) {
  if (!sprite) return;
  
  // 1) Применяем фильтр общей подсветки для всех карт мелда
  const colorMatrix = new PIXI.filters.ColorMatrixFilter();
  if (color === 0x98FB98) { // Зеленый для RUN
    colorMatrix.matrix[0] = 0.8;
    colorMatrix.matrix[6] = 1.3;
    colorMatrix.matrix[12] = 0.8;
  } else if (color === 0xFFFE7A) { // Желтый для SET
    colorMatrix.matrix[0] = 1.2;
    colorMatrix.matrix[6] = 1.2;
    colorMatrix.matrix[12] = 0.5;
  }
  sprite.filters = [colorMatrix];

  // 2) Удаляем существующую подсветку-бар, если она есть
  if (sprite.highlightBar) {
    sprite.removeChild(sprite.highlightBar);
    sprite.highlightBar = null;
  }
  
  // 3) Проверяем входит ли карта в мелд (run или set)
  // Если не в мелде - не добавляем бар, только общий фильтр
  const meldType = window.game && window.game.checkCardInMeld && 
                  sprite.cardData && window.game.checkCardInMeld(sprite.cardData);
  
  if (!meldType) {
    // Если не мелд - НЕ добавляем бар, только общий фильтр
    return;
  }
  
  // 4) Для карт в мелде - добавляем специальный бар с закругленными углами
  const bar = new PIXI.Graphics();
  
  // Размеры и позиция бара на карте
  const barHeight = 20; // Фиксированная высота бара в пикселях
  
  // Ширина с запасом для полного покрытия
  const SAFETY_FACTOR = 2.0;
  const barWidth = sprite.width * SAFETY_FACTOR;
  
  // Позиция бара в нижней части карты
  const barY = sprite.height - barHeight;
  
  // Радиус скругления углов (половина высоты бара для мягкого скругления)
  const cornerRadius = barHeight / 2;
  
  // Рисуем бар с закругленными углами
  bar.beginFill(color, alpha);
  // Position centered with extra width for full coverage
  bar.drawRoundedRect(
    -sprite.width * (SAFETY_FACTOR - 1) / 2, // center the bar with extra width
    barY,
    barWidth,
    barHeight,
    cornerRadius
  );
  bar.endFill();
  
  // Добавляем бар ПОВЕРХ карты (высокий zIndex)
  sprite.addChild(bar);
  bar.zIndex = 100; // Обеспечиваем что бар поверх других элементов
  sprite.highlightBar = bar;
}

tempHighlight(sprite, color, alpha = 0.3) {
  if (!sprite) return;
  
  // Проверяем, является ли карта частью мелда
  const meldType = sprite.dragMeldType || 
                 (window.game && window.game.checkCardInMeld && 
                 sprite.cardData && window.game.checkCardInMeld(sprite.cardData));
  
  // Если карта не из мелда, не применяем никакой подсветки
  if (!meldType) return;

  // Сохраняем текущую подсветку и фильтры
  sprite._originalHighlightBar = sprite.highlightBar;
  sprite._originalFilters = sprite.filters;
  
  // Удаляем существующую подсветку
  if (sprite.highlightBar) {
    sprite.removeChild(sprite.highlightBar);
    sprite.highlightBar = null;
  }
  
  // Применяем временный фильтр для карт из мелда
  const colorMatrix = new PIXI.filters.ColorMatrixFilter();
  sprite.filters = [colorMatrix];
  
  // Создаем бар только для карт из мелда
  const bar = new PIXI.Graphics();
  const barHeight = 20;
  const SAFETY_FACTOR = 2.0;
  const barWidth = sprite.width * SAFETY_FACTOR;
  const barY = sprite.height - barHeight;
  const cornerRadius = barHeight / 2;
  
  // Рисуем бар с закругленными углами
  bar.beginFill(color, alpha);
  bar.drawRoundedRect(
    -sprite.width * (SAFETY_FACTOR - 1) / 2,
    barY,
    barWidth,
    barHeight,
    cornerRadius
  );
  bar.endFill();
  
  // Добавляем бар для карт из мелда
  sprite.addChild(bar);
  bar.zIndex = 100;
  sprite.highlightBar = bar;
}

restoreOriginalHighlight(sprite) {
  if (!sprite) return;
  
  // Определяем, является ли карта частью мелда
  const meldType = sprite.dragMeldType || 
                 (window.game && window.game.checkCardInMeld && 
                 sprite.cardData && window.game.checkCardInMeld(sprite.cardData));
  
  // Удаляем текущую подсветку
  if (sprite.highlightBar) {
    sprite.removeChild(sprite.highlightBar);
    sprite.highlightBar = null;
  }
  
  // Сбрасываем фильтры
  sprite.filters = null;
  
  // Если карта входит в мелд - применяем соответствующую подсветку
  if (meldType) {
    // Определяем цвет подсветки по типу мелда
    const color = meldType === 'set' ? 0xFFFE7A : 0x98FB98;
    
    // Применяем полную подсветку с баром
    this.applySpecialHighlight(sprite, color, 0.5);
  }
}

clearAllHighlights() {
  if (!this.playerHandContainer) return;

  this.playerHandContainer.children.forEach(sprite => {
    // remove tint
    sprite.filters = null;

    // remove bar if present
    if (sprite.highlightBar) {
      sprite.removeChild(sprite.highlightBar);
      sprite.highlightBar = null;
    }
  });
}

  setdeckDragCallback(callback) {
    this.deckDragCallback = callback;
  }

  // Add visual feedback when a card is clicked
  enhanceCardClickFeedback(sprite) {
    if (!sprite) return;
    
    // Создаем эффект пульсации без изменения размера карты
    const ripple = new PIXI.Graphics();
    ripple.beginFill(0xFFFFFF, 0.2);
    ripple.drawCircle(0, 0, 30);
    ripple.endFill();
    
    // Позиционируем по центру карты
    ripple.x = this.config.cardWidth / 2;
    ripple.y = this.config.cardHeight / 2;
    ripple.alpha = 0.7;
    ripple.scale.set(0.5);
    
    sprite.addChild(ripple);
    
    // Анимируем только кольцо, НЕ меняя размер карты
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
    // Save original dimensions and position before animation
    const originalWidth = this.config.cardWidth;
    const originalHeight = this.config.cardHeight;
    
    // Save original position and rotation
    const originalX = sprite.x;
    const originalY = sprite.y;
    const originalRotation = sprite.rotation;
    
    console.log("Flipping card");
    
    // Use simple scale animation instead of 3D
    gsap.to(sprite.scale, {
      x: 0.01, // Shrink to almost flat state
      duration: 0.2,
      ease: "power1.in",
      onComplete: () => {
        // Change texture when card is "on edge"
        if (sprite.cardData && sprite.cardData.suit && sprite.cardData.value) {
          const { suit, value } = sprite.cardData;
          const frontPath = `https://koshmosh43.github.io/playable/assets/cards/${suit}/${value}_${suit.charAt(0).toUpperCase()}${suit.slice(1)}.webp`;
          
          this.assetLoader.loadTexture(frontPath)
            .then(texture => {
              sprite.texture = texture;
              
              // CRITICAL FIX: Explicitly restore dimensions after texture change
              sprite.width = originalWidth;
              sprite.height = originalHeight;
              
              // Return card to normal size with spring effect
              gsap.to(sprite.scale, {
                x: 1.0, // Exactly 1.0, no enlargement
                y: 1.0, // Important to maintain Y-scale
                duration: 0.2,
                ease: "back.out(1.5)",
                onComplete: () => {
                  // CRITICAL FIX: Set dimensions one more time
                  sprite.width = originalWidth;
                  sprite.height = originalHeight;
                  
                  // Restore position if changed
                  sprite.x = originalX;
                  sprite.y = originalY;
                  sprite.rotation = originalRotation;
                  
                  if (onComplete) onComplete();
                }
              });
            })
            .catch(err => {
              console.warn("Failed to load texture:", err);
              
              // Restore scale on error
              sprite.scale.x = 1.0;
              sprite.width = originalWidth;
              sprite.height = originalHeight;
              
              if (onComplete) onComplete();
            });
        } else {
          // If no card data, just finish animation
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
    const cardPath = `https://koshmosh43.github.io/playable/assets/cards/${cardData.suit}/${cardData.value}_${cardData.suit.charAt(0).toUpperCase()}${cardData.suit.slice(1)}.webp`;
    
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
        const cardPath = `https://koshmosh43.github.io/playable/assets/cards/${cardData.suit}/${cardData.value}_${cardData.suit.charAt(0).toUpperCase()}${cardData.suit.slice(1)}.webp`;
        
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
    // ИЗМЕНЯЕМ СТАРТОВУЮ ПОЗИЦИЮ РАЗДАЧИ
    const deckX = this.deckContainer.x + this.config.cardWidth / 2;
    const deckY = this.deckContainer.y + this.config.cardHeight / 2 + 30;
    
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
    this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp')
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
          sprite.anchor.set(0.5, 0.9); // FIXED: Use bottom-center anchor
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
          sprite.anchor.set(0.5, 0.9); // FIXED: Use bottom-center anchor
          sprite.width = this.config.cardWidth;
          sprite.height = this.config.cardHeight;
          sprite.x = deckX;
          sprite.y = deckY;
          sprite.rotation = 0;
          sprite.zIndex = 1000 + opponentCards.length + index;
          
          this.animationContainer.addChild(sprite);
          
          // Store data for animation - NOTE: Use y=0 for player cards
          animCards.push({
            sprite: sprite,
            cardData: cardData,
            isPlayer: true,
            finalPos: {
              x: this.playerHandContainer.x + playerPositions[index].x,
              y: this.playerHandContainer.y, // FIXED: Use container Y directly
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
    this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp')
      .then(backTexture => {
        // Create opponent cards (face down)
        opponentCards.forEach((cardData, index) => {
          const sprite = new PIXI.Sprite(backTexture);
          sprite.anchor.set(0.5, 0.9); // FIXED: Use bottom-center anchor
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
          const cardPath = `https://koshmosh43.github.io/playable/assets/cards/${card.suit}/${card.value}_${card.suit.charAt(0).toUpperCase()}${card.suit.slice(1)}.webp`;
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
            
            sprite.anchor.set(0.5, 0.9); // FIXED: Use bottom-center anchor
            sprite.width = this.config.cardWidth;
            sprite.height = this.config.cardHeight;
            sprite.x = playerPositions[index].x;
            sprite.y = 0; // FIXED: Use y=0 relative to container
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
  this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp')
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
        const cardPath = `https://koshmosh43.github.io/playable/assets/cards/${card.suit}/${card.value}_${card.suit.charAt(0).toUpperCase()}${card.suit.slice(1)}.webp`;
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
async renderdeck(deckCount) {
  if (!deckCount) deckCount = 0;

  const maxVisible = 5;
  const visibleCount = Math.min(deckCount, maxVisible);

  // Создаём видимые карты колоды
  for (let i = 0; i < visibleCount; i++) {
    const sprite = await this.createCardSprite({ faceDown: true }, true);
    sprite.cardData = { source: 'deck' };

    sprite.anchor.set(0.5, 0.5);
    sprite.x = this.config.cardWidth / 2;
    sprite.y = this.config.cardHeight / 2 - 3 * i;
    sprite.zIndex = i;

    // Верхняя карта – интерактивна
    if (i === visibleCount - 1 && deckCount > 0) {
      this.adddeckCounter(sprite, deckCount);

      sprite.interactive = true;
      sprite.buttonMode = true;
      sprite.zIndex = 5000;
      sprite.removeAllListeners();

      sprite.on('pointerdown', (event) => {
        event.stopPropagation();

        // Останавливаем анимации и сбрасываем масштаб на 60%
        gsap.killTweensOf(this.deckContainer);
        gsap.killTweensOf(this.deckContainer.scale);
        this.deckContainer.scale.set(0.6, 0.6);

        this.deckContainer.children.forEach(card => {
          gsap.killTweensOf(card);
          gsap.killTweensOf(card.scale);
          if (card.filters) card.filters = null;
        });

        const cardToDrag = this.deckDragCallback ? this.deckDragCallback() : null;
        if (cardToDrag) {
          this.startCardDragging(cardToDrag, 'deck');
        } else {
          this.startCardDragging(
            { faceDown: false, value: '?', suit: '?', filename: '' },
            'deck'
          );
        }
      });
    }

    this.deckContainer.addChild(sprite);
  }
}

  
  // Add counter to deck
  adddeckCounter(sprite, deckCount) {
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

  returnCardToHand(cardData) {
    // Если есть текуще перетаскиваемая карта — возвращаем её в руку
    if (this.draggingCard) {
      this.snapCardBack(this.draggingCard);
      // Очищаем состояние перетаскивания
      this.draggingCard = null;
      this.draggingCardData = null;
      this.draggingCardSource = null;
    }
  }
  
  
  // Render the discard pile
  async renderDiscardPile(discardPile) {
    console.log("Rendering discard pile with", discardPile?.length || 0, "cards");
    
    // Explicitly clear the discard container
    this.discardContainer.removeChildren();
    
    if (!discardPile || discardPile.length === 0) {
      // Empty discard pile case
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
      return;
    }
    
    // Show visible cards in discard pile, up to 5 max
    const visibleDiscards = Math.min(discardPile.length, 5);
    
    // Center position for all cards in discard
    const centerX = this.config.cardWidth / 2;
    const centerY = this.config.cardHeight / 2;
    
    // Create an array to track all card IDs that are rendered
    const renderedCardIds = new Set();
    
    // Show cards starting from bottom of stack
    for (let i = 0; i < visibleDiscards; i++) {
      const discardIndex = discardPile.length - visibleDiscards + i;
      const discard = discardPile[discardIndex];
      
      // Skip if this card has already been rendered (prevents duplicates)
      const cardKey = `${discard.value}_${discard.suit}`;
      if (renderedCardIds.has(cardKey)) {
        console.warn(`Skipping duplicate discard card: ${cardKey}`);
        continue;
      }
      
      // Add this card to our tracking set
      renderedCardIds.add(cardKey);
      
      const sprite = await this.createCardSprite(discard, false);
      
      // Set card dimensions
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      
      // Center anchor for proper rotation
      sprite.anchor.set(0.5);
      
      // Add slight random rotation and offset for natural look
      const randomRotation = ((i * 137 + 547) % 100) / 500 - 0.1; // -0.1 to 0.1
      const randomOffsetX = ((i * 263 + 821) % 10) - 5;           // -5 to 5
      const randomOffsetY = ((i * 521 + 347) % 10) - 5;           // -5 to 5
      
      // Always center card with small random variations
      sprite.x = centerX + randomOffsetX;
      sprite.y = centerY + randomOffsetY;
      sprite.rotation = randomRotation;
      
      // Z-index for proper stacking
      sprite.zIndex = i;
      
      // Make top card interactive
      if (i === visibleDiscards - 1) {
        sprite.interactive = true;
        sprite.buttonMode = true;
        
        // Clear previous handlers
        sprite.removeAllListeners();
        
        // Add handler for dragging from discard
        sprite.on('pointerdown', (event) => {
          // Prevent event bubbling
          event.stopPropagation();
          
          // Start dragging card from discard
          this.startCardDragging(discard, 'discard');
        });
      }
      
      this.discardContainer.addChild(sprite);
    }
    
    // Sort for proper z-index
    this.discardContainer.sortChildren();
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
    // Force enable during discard phase
    const forceEnable = this.playerTurn && this.gameStep % 2 === 1 && this.hasDrawnCard;
    
    this.isDragEnabled = enabled || forceEnable;
    
    // If enabling, make sure all cards in player's hand have drag handlers
    if (this.isDragEnabled && this.playerHandContainer) {
      console.log("Enabling drag for all player cards - FORCED:", forceEnable);
      
      // Add drag handlers to all cards in player's hand
      this.playerHandContainer.children.forEach(sprite => {
        if (sprite && sprite.cardData) {
          // Ensure card has proper data for drag operations
          this.setupDragAndDrop(sprite, sprite.cardData);
          
          // Make sure card is interactive
          sprite.interactive = true;
          sprite.buttonMode = true;
        }
      });
    }
  }
  
  // Animate discarding a card
  animateCardDiscard(cardData, sourceIndex) {
    // Начальная позиция в руке игрока
    const spacing = this.config.fanDistance || 30;
    const totalCards = this.playerHandContainer.children.length;
    const startX = this.playerHandContainer.x - ((totalCards - 1) * spacing / 2) + sourceIndex * spacing;
    const startY = this.playerHandContainer.y;
    
    // Рассчитываем начальный поворот
    const fanAngle = this.config.fanAngle || 10;
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + sourceIndex * anglePerCard;
    const startRotation = -(rotation * Math.PI / 180);
    
    // Конечная позиция (отбой)
    const endX = this.discardContainer.x + this.config.cardWidth / 2;
    const endY = this.discardContainer.y + this.config.cardHeight / 2;
    
    // НОВОЕ: Удаляем подсветку из данных карты
    if (cardData) {
      delete cardData.highlightBar;
      delete cardData.filters;
    }
    
    // Создаем спрайт для анимации
    this.createCardSprite(cardData, false)
      .then(sprite => {
        // Настройка спрайта
        sprite.anchor.set(0.5);
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.cardData = cardData;
        
        // НОВОЕ: Убеждаемся, что у спрайта нет подсветки
        sprite.highlightBar = null;
        sprite.filters = null;
        
        // Начальная позиция
        sprite.x = startX;
        sprite.y = startY;
        sprite.rotation = startRotation;
        sprite.zIndex = 150;
        
        // Добавляем в контейнер анимации
        this.animationContainer.addChild(sprite);
        
        // Анимируем движение
        gsap.to(sprite, {
          x: endX,
          y: endY,
          rotation: 0,
          duration: 0.5,
          ease: "power2.inOut",
          onComplete: () => {
            // Удаляем анимационный спрайт
            this.animationContainer.removeChild(sprite);
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
    this.playerHandContainer.y = screenHeight - 85;

    // For smaller screens like iPhone SE, move cards down by 20px
  if (screenHeight < 700) {
    this.playerHandContainer.y = screenHeight - 35; // Was 85, changing to 65 to move down 20px
  } else {
    this.playerHandContainer.y = screenHeight - 65; // Original positioning
  }
    
    // Opponent hand
    this.opponentHandContainer.x = screenWidth / 2;
    this.opponentHandContainer.y = adHeight + navHeight + 100;
    
    // ИЗМЕНЯЕМ КООРДИНАТЫ КОЛОДЫ
    // deck - можно изменить на нужную позицию
    this.deckContainer.x = screenWidth / 2 - this.config.cardWidth - 50; // было -20
    this.deckContainer.y = screenHeight / 2 - this.config.cardHeight / 2 - 20; // было без -20
    
    // Discard pile - также меняем по необходимости
    this.discardContainer.x = screenWidth / 2 + 50; // было +20
    this.discardContainer.y = screenHeight / 2 - this.config.cardHeight / 2 - 20; // было без -20
  }
}