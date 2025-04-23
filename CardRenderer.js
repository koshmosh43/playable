export class CardRenderer {
  constructor(app, assetLoader, config) {
    this.app = app;
    this.assetLoader = assetLoader;
    this.config = config;
    this.cardsFlipped = false;
    
    this.isDragEnabled = true;
    this.draggingCard = null;  this.draggingCardSource = null; this.draggingCardData = null;  this.playerHandZone = null;    this.highlightedSource = null;
    
        this.container = new PIXI.Container();
    this.container.sortableChildren = true;
    
    this.playerHandContainer = new PIXI.Container();
    this.opponentHandContainer = new PIXI.Container();
    this.deckContainer = new PIXI.Container();
    this.discardContainer = new PIXI.Container();
    this.animationContainer = new PIXI.Container();
    this.playButtonContainer = new PIXI.Container();
    
        this.playerHandContainer.zIndex = 50;
    this.opponentHandContainer.zIndex = 5;
    this.deckContainer.zIndex = 45;
    this.discardContainer.zIndex = 45;
    this.animationContainer.zIndex = 150;
    this.playButtonContainer.zIndex = 100;
    
        this.playerHandContainer.sortableChildren = true;
    this.discardContainer.sortableChildren = true;
    this.deckContainer.sortableChildren = true;
    
    this.init();
  }
  
  init() {
        this.container.addChild(this.playerHandContainer);
    this.container.addChild(this.opponentHandContainer);
    this.container.addChild(this.deckContainer);
    this.container.addChild(this.discardContainer);
    this.container.addChild(this.animationContainer);
    this.container.addChild(this.playButtonContainer);
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

clearAllHighlights() {
  [this.playerHandContainer,
   this.opponentHandContainer,
   this.deckContainer,
   this.discardContainer].forEach(cont => {
    cont.children.forEach(sprite => {
      sprite.filters = null;
      if (sprite.highlightBar) {
        sprite.removeChild(sprite.highlightBar);
        sprite.highlightBar = null;
      }
    });
  });
}

  
    async updateDisplay(gameState) {
    if (!gameState) return;
    
        this.playerHandContainer.removeChildren();
    this.opponentHandContainer.removeChildren();
    this.deckContainer.removeChildren();
    this.discardContainer.removeChildren();
    
        if (gameState.playerCards && gameState.playerCards.length > 0) {
      await this.renderPlayerHand(gameState.playerCards, gameState.selectedCard, gameState.possibleMelds);
    }
    
        if (gameState.opponentCards && gameState.opponentCards.length > 0) {
      await this.renderOpponentHand(gameState.opponentCards);
    }
    
        await this.renderdeck(gameState.deckCount);
    
        await this.renderDiscardPile(gameState.discardPile);
  }
  
    async renderPlayerHand(playerCards, selectedCard, possibleMelds) {
        this.playerHandContainer.removeChildren();
  
        if (!playerCards || playerCards.length === 0) return;
  
        let cards = [...playerCards];
  
        if (possibleMelds) {
            const runCards = possibleMelds.runs
        ? possibleMelds.runs.flatMap(run => run.cards)
        : [];
      const runIds = new Set(runCards.map(c => c.id));
  
            const setCards = possibleMelds.sets
        ? possibleMelds.sets.flatMap(set => set.cards)
        : [];
      const setIds = new Set(setCards.map(c => c.id));
  
            const meldCards = [];
      const seenMeld = new Set();
      
            runCards.forEach(card => {
        if (!seenMeld.has(card.id)) {
          seenMeld.add(card.id);
          meldCards.push(card);
        }
      });
      
            setCards.forEach(card => {
        if (!seenMeld.has(card.id)) {
          seenMeld.add(card.id);
          meldCards.push(card);
        }
      });
  
            const otherCards = cards.filter(c => !seenMeld.has(c.id));
  
            const valueOrder = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
      const suitOrder  = { clubs:0, diamonds:1, hearts:2, spades:3 };
      otherCards.sort((a, b) => {
        const dv = valueOrder[a.value] - valueOrder[b.value];
        if (dv !== 0) return dv;
        return suitOrder[a.suit] - suitOrder[b.suit];
      });
  
            cards = [...meldCards, ...otherCards];
    }
  
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
  
            if (possibleMelds) {
                const inRun = possibleMelds.runs?.some(run => 
          run.cards.some(c => c.id === cardData.id)
        );
        
        if (inRun) {
                    this.applySpecialHighlight(sprite, 0x98FB98, 0.5);
        } 
        else {
                    const inSet = possibleMelds.sets?.some(set => 
            set.cards.some(c => c.id === cardData.id)
          );
          
          if (inSet) {
                        this.applySpecialHighlight(sprite, 0xFFFE7A, 0.5);
          }
        }
      }
  
            if (selectedCard?.id === cardData.id) {
        this.applySimpleSelectedHighlight(sprite);
      }
      
            if (this.isDragEnabled) {
        this.setupDragAndDrop(sprite, cardData);
      }
      
            sprite.on('pointerdown', () => this.onCardClick?.(cardData, 'player'));
  
      this.playerHandContainer.addChild(sprite);
    }
  
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
  
    applySimpleSelectedHighlight(sprite) {
    
        sprite.y -= 10;
  }

  setupDragAndDrop(sprite, cardData) {
        sprite.removeAllListeners('pointerdown');
    sprite.removeAllListeners('pointermove');
    sprite.removeAllListeners('pointerup');
    sprite.removeAllListeners('pointerupoutside');
    
        let isDragging = false;
    let dragStartData = null;
    let originalZIndex = sprite.zIndex;
    
        sprite.originalPosition = {
      x: sprite.x,
      y: sprite.y,
      rotation: sprite.rotation,
      zIndex: sprite.zIndex,
      scaleX: sprite.scale.x,
      scaleY: sprite.scale.y
    };
    
        sprite.originalHighlightBar = sprite.highlightBar;
    sprite.originalFilters = sprite.filters;
    
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
      
            originalZIndex = sprite.zIndex;
      sprite.zIndex = 1000;
      this.playerHandContainer.sortChildren();
      
            if (sprite.cardData && sprite.cardData.source !== 'deck') {
        sprite.scale.set(0.7);
      }
      
            const isDrawPhase = window.game && window.game.playerTurn && window.game.gameStep % 2 === 0;
      const isDiscardPhase = window.game && window.game.playerTurn && window.game.gameStep % 2 === 1;
      
      sprite.dragPhaseInfo = { isDrawPhase, isDiscardPhase };
      
            const meldType = window.game && 
                      window.game.checkCardInMeld && 
                      sprite.cardData &&
                      window.game.checkCardInMeld(sprite.cardData);
      
            sprite.dragMeldType = meldType;
      
            const dragStartEvent = new CustomEvent('cardDragStart', { 
        detail: { cardData, sprite }
      });
      document.dispatchEvent(dragStartEvent);
    };
    
        const onDragMove = (event) => {
      if (!isDragging) return;
      
            const newPosition = event.data.global;
      const newLocalPos = this.playerHandContainer.toLocal(newPosition);
      sprite.x = newLocalPos.x;
      sprite.y = newLocalPos.y;
      sprite.rotation = 0;
      
            const globalPos = sprite.toGlobal(new PIXI.Point(0, 0));
      const isOverDiscard = this.isOverDiscardPile(globalPos);
      
            const isPlayerCardInDrawPhase = 
        sprite.dragPhaseInfo && 
        sprite.dragPhaseInfo.isDrawPhase && 
        cardData.source !== 'deck' && 
        cardData.source !== 'discard';
      
            const isCardInMeld = sprite.dragMeldType || 
                         (window.game && window.game.checkCardInMeld && 
                         sprite.cardData && window.game.checkCardInMeld(sprite.cardData));
      
            let meldType = null;
      if (isCardInMeld) {
        meldType = typeof isCardInMeld === 'string' ? isCardInMeld : 
                  (sprite.dragMeldType || '');
      }
      
            if (isOverDiscard && !sprite.isOverDiscard) {
        sprite.isOverDiscard = true;
        
                gsap.to(sprite.scale, {
          x: 0.65, y: 0.65,
          duration: 0.2
        });
        
                if (isCardInMeld) {
                              
                    if (window.game && window.game.uiRenderer && !window.game.uiRenderer.dialogVisible) {
                        if (isPlayerCardInDrawPhase) {
              window.game.uiRenderer.showDialog("Take a card from deck\nor\ndiscard pile first!");
            } else {
              window.game.uiRenderer.showDialog(`Cannot discard a card in a ${meldType}!`);
            }
          }
          
                  } else {
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
        
                gsap.to(sprite.scale, {
          x: 0.7, y: 0.7,
          duration: 0.2
        });
        
                if (window.game && window.game.uiRenderer) {
          window.game.uiRenderer.hideDialog();
        }
        
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
    
        const onDragEnd = (event) => {
      if (!isDragging) return;
      isDragging = false;
      
            sprite.isOverDiscard = false;
      
            const globalPos = sprite.toGlobal(new PIXI.Point(0, 0));
      
            const isOverDiscard = this.isOverDiscardPile(globalPos);
      
            const isDrawPhase = sprite.dragPhaseInfo && sprite.dragPhaseInfo.isDrawPhase;
      const isDiscardPhase = sprite.dragPhaseInfo && sprite.dragPhaseInfo.isDiscardPhase;
      
            const isCardInMeld = sprite.dragMeldType || 
                           (window.game && window.game.checkCardInMeld && 
                           sprite.cardData && window.game.checkCardInMeld(sprite.cardData));
      
                                                                  if (isOverDiscard && isDrawPhase && this.draggingCardSource === 'player') {
                                                                      if (window.game && window.game.uiRenderer) {
                                     window.game.uiRenderer.showDialog("Take a card from deck or discard first!");
                                   }
                                                                      this.snapCardBack(sprite, true);
                                   return;
                                 }
      
                  if (isOverDiscard && isDiscardPhase && !isCardInMeld) {
                const dragEndEvent = new CustomEvent('cardDragEnd', { 
          detail: { 
            cardData, 
            sprite, 
            targetArea: 'discard',
            position: globalPos
          }
        });
        document.dispatchEvent(dragEndEvent);
              } else {
                const dragEndEvent = new CustomEvent('cardDragEnd', { 
          detail: { 
            cardData, 
            sprite, 
            targetArea: 'hand',             position: globalPos
          }
        });
        document.dispatchEvent(dragEndEvent);
        
                this.snapCardBack(sprite, true);
      }
    };
    
        sprite.on('pointerdown', (event) => {
      event.stopPropagation();
      sprite.data = event.data;
      onDragStart(event);
    });
    
    sprite.on('pointermove', onDragMove);
    sprite.on('pointerup', onDragEnd);
    sprite.on('pointerupoutside', onDragEnd);
    
        sprite.interactive = true;
    sprite.buttonMode = true;
  }
  

  startCardDragging(cardData, source) {
    console.log(`STARTING DRAG FROM ${source}`, cardData);
  
        gsap.killTweensOf(this.deckContainer.scale);
    gsap.killTweensOf(this.discardContainer.scale);
    this.deckContainer.scale.set(1, 1);     this.discardContainer.scale.set(1, 1);
  
        if (source === 'discard') {
            const discardCount = this.discardContainer.children.length;
      
            if (discardCount > 0) {
                const topCardIndex = discardCount - 1;
        const topCard = this.discardContainer.getChildAt(topCardIndex);
        
                this.discardContainer.removeChildAt(topCardIndex);
        
        console.log('Removed top card from discard pile!');
      }
    }
  
        if (this.draggingCard) return;
    
        this.draggingCardSource = source;
    this.draggingCardData = cardData;
    
        this.createCardSprite(cardData, false).then(sprite => {
      this.draggingCard = sprite;
      
            sprite.anchor.set(0.5);
      sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      sprite.alpha = 1;
      sprite.zIndex = 1000;       
            this.animationContainer.addChild(sprite);
      
            if (source === 'deck') {
        sprite.x = this.deckContainer.x + this.config.cardWidth / 2;
        sprite.y = this.deckContainer.y + this.config.cardHeight / 2;
      } else if (source === 'discard') {
        sprite.x = this.discardContainer.x + this.config.cardWidth / 2;
        sprite.y = this.discardContainer.y + this.config.cardHeight / 2;
      }
      
            window.removeEventListener('mousemove', this.moveCardHandler);
      window.removeEventListener('touchmove', this.moveCardHandler);
      window.removeEventListener('mouseup', this.releaseCardHandler);
      window.removeEventListener('touchend', this.releaseCardHandler);
      
            window.addEventListener('mousemove', this.moveCardHandler);
      window.addEventListener('touchmove', this.moveCardHandler);
      window.addEventListener('mouseup', this.releaseCardHandler);
      window.addEventListener('touchend', this.releaseCardHandler);
      
            document.dispatchEvent(new CustomEvent('cardDragStarted', {
        detail: { cardData, source }
      }));
    }).catch(err => {
      console.error("Error creating dragging card sprite:", err);
    });
  }

  moveCardHandler = (event) => {
    if (!this.draggingCard) return;
  
        let clientX, clientY;
    
    if (event.type === 'touchmove') {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
        const rect = this.app.view.getBoundingClientRect();
    const x = (clientX - rect.left) * (this.app.screen.width / rect.width);
    const y = (clientY - rect.top) * (this.app.screen.height / rect.height);
    
        this.draggingCard.x = x;
    this.draggingCard.y = y;
    
        if (this.draggingCardSource === 'deck') {
            return;
    }
    
        const position = { x, y };
    const isOverDiscard = this.isOverDiscardPile(position);
    const isOverPlayerHand = this.isOverPlayerHand(position);
    
        if ((isOverDiscard || isOverPlayerHand) && this.draggingCard.scale.x > 0.7) {
            gsap.to(this.draggingCard.scale, {
        x: 0.7, 
        y: 0.7,
        duration: 0.2,         ease: "power2.out"
      });
    } 
        else if (!isOverDiscard && !isOverPlayerHand && this.draggingCard.scale.x < 0.7) {
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
  
        gsap.killTweensOf(this.deckContainer.scale);
    gsap.killTweensOf(this.discardContainer.scale);
    this.deckContainer.scale.set(1, 1);
    this.discardContainer.scale.set(1, 1);
  
        let clientX, clientY;
    if (event.type === 'touchend') {
      const touch = event.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
  
        const rect = this.app.view.getBoundingClientRect();
    const x = (clientX - rect.left) * (this.app.screen.width / rect.width);
    const y = (clientY - rect.top) * (this.app.screen.height / rect.height);
    const position = { x, y };
  
        const isOverHand = this.isOverPlayerHand(position);
    const isOverDiscard = this.isOverDiscardPile(position);
  
        const isDrawPhase = window.game && window.game.playerTurn && window.game.gameStep % 2 === 0;
    const isDiscardPhase = window.game && window.game.playerTurn && window.game.gameStep % 2 === 1;
  
        const isCardInMeld = window.game && window.game.checkCardInMeld && 
                        this.draggingCardSource === 'player' &&
                        window.game.checkCardInMeld(this.draggingCardData);
  
        if (isOverDiscard && isDrawPhase && this.draggingCardSource === 'player') {
      console.log("Cannot discard a card during draw phase - returning to hand");
      
            if (this.draggingCard && (!this.draggingCard.originalPosition || this.draggingCard.originalPosition.scaleX === undefined)) {
        this.draggingCard.originalPosition = this.draggingCard.originalPosition || {};
        this.draggingCard.originalPosition.scaleX = 0.53;
        this.draggingCard.originalPosition.scaleY = 0.53;
      }
      
            if (window.game && window.game.uiRenderer) {
        window.game.uiRenderer.showDialog("Take a card from deck or discard first!");
      }
      
            this.returnDraggingCard(isCardInMeld);
      
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
  
        if (isOverDiscard && isDrawPhase) {
            if (window.game && window.game.uiRenderer) {
        window.game.uiRenderer.showDialog("Take a card from deck\nor\ndiscard pile first!");
      }
      
            const wrongPhaseEvent = new CustomEvent('cardDragEnd', { 
        detail: { 
          cardData, 
          sprite, 
          targetArea: 'wrong-phase-discard',
          position: globalPos
        }
      });
      document.dispatchEvent(wrongPhaseEvent);
      
            this.snapCardBack(sprite, false);
      return;
    }
  
        if ((this.draggingCardSource === 'deck' || this.draggingCardSource === 'discard') && isDiscardPhase) {
      console.log("Cannot take a card during discard phase - canceling action");
      
            if (window.game && window.game.uiRenderer) {
        window.game.uiRenderer.showDialog("Discard a card to end your turn!");
      }
      
            if (this.draggingCard) {
        this.animationContainer.removeChild(this.draggingCard);
        this.draggingCard = null;
        this.draggingCardData = null;
        this.draggingCardSource = null;
      }
      
      return;
    }
  
        document.dispatchEvent(new CustomEvent('cardDragReleased', {
      detail: {
        cardData: this.draggingCardData,
        source: this.draggingCardSource,
        targetArea: isOverHand ? 'hand' : (isOverDiscard ? 'discard' : 'none'),
        position
      }
    }));
  
        window.removeEventListener('mousemove', this.moveCardHandler);
    window.removeEventListener('touchmove', this.moveCardHandler);
    window.removeEventListener('mouseup', this.releaseCardHandler);
    window.removeEventListener('touchend', this.releaseCardHandler);
  
        if (isOverHand) {
            gsap.to(this.draggingCard.scale, {
        x: 1.0, y: 1.0,
        duration: 0.15,
        ease: "power2.out",
        onComplete: () => this.addDraggingCardToHand()
      });
    } else if (isOverDiscard) {
            gsap.to(this.draggingCard.scale, {
        x: 1.0, y: 1.0,
        duration: 0.15,
        ease: "power2.out",
        onComplete: () => {
          if (this.draggingCard) {
            this.animationContainer.removeChild(this.draggingCard);
            this.draggingCard = null;
          }
                    this.draggingCardData = null;
          this.draggingCardSource = null;
        }
      });
    } else {
            this.returnDraggingCard();
    }
  }

  returnDraggingCard(useShakeAnimation = true) {
    if (!this.draggingCard) return;
    
        if (!this.draggingCard.originalPosition) {
      this.draggingCard.originalPosition = {
        x: this.draggingCard.x,
        y: this.draggingCard.y,
        rotation: this.draggingCard.rotation,
        zIndex: this.draggingCard.zIndex < 100 ? this.draggingCard.zIndex : 0
      };
    }
  
        this.draggingCard.zIndex = this.draggingCard.originalPosition.zIndex || 0;
    this.playerHandContainer.sortChildren();
    
        let meldType = this.draggingCardData && this.draggingCard.dragMeldType;
    
        if (!meldType && window.game && window.game.checkCardInMeld && this.draggingCardData) {
      meldType = window.game.checkCardInMeld(this.draggingCardData);
    }
    
        let highlightColor = null;
    if (meldType === 'set') {
      highlightColor = 0xFFFE7A;     } else if (meldType === 'run') {
      highlightColor = 0x98FB98;     }
    
        const draggingCard = this.draggingCard;
    const draggingCardData = this.draggingCardData;
    const draggingCardSource = this.draggingCardSource;
    
        if (useShakeAnimation) {
            gsap.timeline()
                .to(this.draggingCard, {
          x: this.draggingCard.originalPosition.x - 15,
          duration: 0.06,
          ease: "power1.inOut"
        })
                .to(this.draggingCard, {
          x: this.draggingCard.originalPosition.x + 15,
          duration: 0.06,
          ease: "power1.inOut"
        })
                .to(this.draggingCard, {
          x: this.draggingCard.originalPosition.x - 8,
          duration: 0.06,
          ease: "power1.inOut"
        })
                .to(this.draggingCard, {
          x: this.draggingCard.originalPosition.x,
          duration: 0.06,
          ease: "power1.inOut",
          onComplete: () => {
                        if (meldType && highlightColor) {
              this.applySpecialHighlight(draggingCard, highlightColor, 0.5);
            }
          }
        })
                .set(this.draggingCard.scale, {
          x: 0.53,
          y: 0.53
        })
                .to(this.draggingCard, {
          x: this.draggingCard.originalPosition.x,
          y: this.draggingCard.originalPosition.y,
          rotation: this.draggingCard.originalPosition.rotation,
          duration: 0.3,
          ease: "back.out",
          onComplete: () => {
                        this.animationContainer.removeChild(draggingCard);
            this.draggingCard = null;
            this.draggingCardData = null;
            this.draggingCardSource = null;
            
                        if (window.game) {
              window.game.updatePlayScreen();
            }
          }
        });
    } else {
            this.draggingCard.scale.set(0.53, 0.53);
      
      gsap.to(this.draggingCard, {
        x: this.draggingCard.originalPosition.x,
        y: this.draggingCard.originalPosition.y,
        rotation: this.draggingCard.originalPosition.rotation,
        duration: 0.3,
        ease: "back.out",
        onComplete: () => {
                    this.animationContainer.removeChild(draggingCard);
          this.draggingCard = null;
          this.draggingCardData = null;
          this.draggingCardSource = null;
          
                    if (window.game) {
            window.game.updatePlayScreen();
          }
        }
      });
    }
  }

addDraggingCardToHand() {
  if (!this.draggingCard || !this.draggingCardData) return;
  
    const newIndex = this.calculateNewCardIndex();
  
    if (this.draggingCardSource === 'discard') {
    console.log("Card added from discard, ensuring it's removed from discard pile");
  }
  
    document.dispatchEvent(new CustomEvent('cardAddedToHand', {
    detail: {
      cardData: this.draggingCardData,
      source: this.draggingCardSource,
      index: newIndex
    }
  }));
  
    this.animationContainer.removeChild(this.draggingCard);
  this.draggingCard = null;
  this.draggingCardData = null;
  this.draggingCardSource = null;
  
      if (window.game) {
        this.playerHandContainer.removeChildren();
    
        window.game.cardManager.playerCards = window.game.sortCardsWithMelds();
    
    console.log("Card add complete - triggering complete redraw of player hand");
    
        setTimeout(() => {
            window.game.updatePlayScreen();
    }, 50);
  } else {
        console.log("Card add complete - triggering redraw");
    setTimeout(() => {
            if (window.game) {
        window.game.updatePlayScreen();
      }
    }, 50);
  }
}

async createCardSprite(cardData, isFaceDown = false) {
  let texture;
  
  try {
    if (isFaceDown || (cardData && cardData.faceDown)) {
            texture = await this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp');
    } else if (cardData && cardData.suit && cardData.value) {
            const suit = cardData.suit;
      const value = cardData.value;
      const frontPath = `https://koshmosh43.github.io/playable/assets/cards/${suit}/${value}_${suit.charAt(0).toUpperCase()}${suit.slice(1)}.webp`;
      texture = await this.assetLoader.loadTexture(frontPath);
    } else {
            texture = await this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp');
    }
  } catch (err) {
    console.warn("Ошибка загрузки текстуры карты:", err);
    texture = PIXI.Texture.WHITE;
  }

    const sprite = new PIXI.Sprite(texture);
  
  sprite.anchor.set(0.5);
  sprite.width = this.config.cardWidth;
  sprite.height = this.config.cardHeight;
  sprite.interactive = true;
  sprite.buttonMode = true;
  sprite.cardData = cardData;
  
  return sprite;
}

createCardBackSprite() {
  const cardWidth = this.config.cardWidth || 80;
  const cardHeight = this.config.cardHeight || 120;
  
    const sprite = new PIXI.Sprite();
  sprite.width = cardWidth;
  sprite.height = cardHeight;
  
    sprite.anchor.set(0.5);
  
    this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp')
    .then(texture => {
      sprite.texture = texture;
    })
    .catch(err => {
      console.warn("Could not load card back texture", err);
            const graphics = new PIXI.Graphics();
      graphics.beginFill(0x0000AA);
      graphics.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 10);
      graphics.endFill();
      
            graphics.lineStyle(2, 0xFFFFFF);
      graphics.drawRoundedRect(-cardWidth/2 + 5, -cardHeight/2 + 5, cardWidth - 10, cardHeight - 10, 6);
      
      const texture = this.app.renderer.generateTexture(graphics);
      sprite.texture = texture;
    });
  
  return sprite;
}

createFallbackCardTexture(sprite, cardData) {
  const cardWidth = this.config.cardWidth || 80;
  const cardHeight = this.config.cardHeight || 120;
  
  const graphics = new PIXI.Graphics();
  
    graphics.beginFill(0xFFFFFF);
  graphics.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 10);
  graphics.endFill();
  
    const isRed = cardData.suit === 'hearts' || cardData.suit === 'diamonds';
  const color = isRed ? 0xFF0000 : 0x000000;
  
    const valueText = new PIXI.Text(cardData.value, {
    fontFamily: 'Arial',
    fontSize: 16,
    fill: color,
    fontWeight: 'bold'
  });
  valueText.position.set(-cardWidth/2 + 5, -cardHeight/2 + 5);
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
  suitText.position.set(0, 0);
  graphics.addChild(suitText);
  
    const valueText2 = new PIXI.Text(cardData.value, {
    fontFamily: 'Arial',
    fontSize: 16,
    fill: color,
    fontWeight: 'bold'
  });
  valueText2.anchor.set(1, 1);
  valueText2.position.set(cardWidth/2 - 5, cardHeight/2 - 5);
  graphics.addChild(valueText2);
  
    const texture = this.app.renderer.generateTexture(graphics);
  sprite.texture = texture;
}

cleanup() {
    if (this.draggingCard) {
    this.animationContainer.removeChild(this.draggingCard);
    this.draggingCard = null;
    this.draggingCardData = null;
    this.draggingCardSource = null;
  }
  
    window.removeEventListener('mousemove', this.moveCardHandler);
  window.removeEventListener('touchmove', this.moveCardHandler);
  window.removeEventListener('mouseup', this.releaseCardHandler);
  window.removeEventListener('touchend', this.releaseCardHandler);
}

calculateNewCardIndex() {
    if (!this.playerHandContainer || !this.playerHandContainer.children) {
    return 0;
  }
  return this.playerHandContainer.children.length;
}


isOverDiscardPile(position) {
  if (!this.discardContainer) return false;
  
    const discardBounds = this.discardContainer.getBounds();
  
    const padding = 30;
  const dropZone = {
    left: discardBounds.x - padding,
    right: discardBounds.x + discardBounds.width + padding,
    top: discardBounds.y - padding,
    bottom: discardBounds.y + discardBounds.height + padding
  };
  
    return (
    position.x >= dropZone.left &&
    position.x <= dropZone.right &&
    position.y >= dropZone.top &&
    position.y <= dropZone.bottom
  );
}

snapCardBack(sprite, useShakeAnimation = true) {
    if (!sprite || !sprite.originalPosition) {
    if (sprite) {
            sprite.originalPosition = {
        x: sprite.x,
        y: sprite.y,
        rotation: sprite.rotation,
        zIndex: sprite.zIndex < 100 ? sprite.zIndex : 0
      };
    } else {
      return;     }
  }

    sprite.zIndex = sprite.originalPosition.zIndex || 0;
  this.playerHandContainer.sortChildren();
  
    let meldType = sprite.dragMeldType;
  
    if (!meldType && window.game && window.game.checkCardInMeld && sprite.cardData) {
    meldType = window.game.checkCardInMeld(sprite.cardData);
  }
  
    let highlightColor = null;
  if (meldType === 'set') {
    highlightColor = 0xFFFE7A;   } else if (meldType === 'run') {
    highlightColor = 0x98FB98;   }
  
    if (useShakeAnimation) {
        gsap.timeline()
            .to(sprite, {
        x: sprite.originalPosition.x - 15,
        duration: 0.06,
        ease: "power1.inOut"
      })
            .to(sprite, {
        x: sprite.originalPosition.x + 15,
        duration: 0.06,
        ease: "power1.inOut"
      })
            .to(sprite, {
        x: sprite.originalPosition.x - 8,
        duration: 0.06,
        ease: "power1.inOut"
      })
            .to(sprite, {
        x: sprite.originalPosition.x,
        duration: 0.06,
        ease: "power1.inOut",
        onComplete: () => {
          if (meldType && sprite.originalHighlightBar) {
                        if (sprite.highlightBar && sprite.highlightBar !== sprite.originalHighlightBar) {
              sprite.removeChild(sprite.highlightBar);
            }
                        sprite.addChild(sprite.originalHighlightBar);
            sprite.highlightBar = sprite.originalHighlightBar;
                        sprite.filters = sprite.originalFilters || null;
          }
        }
      })
            .set(sprite.scale, {
        x: 0.53,
        y: 0.53
      })
            .to(sprite, {
        x: sprite.originalPosition.x,
        y: sprite.originalPosition.y,
        rotation: sprite.originalPosition.rotation,
        duration: 0.3,
        ease: "back.out"
      });
  } else {
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

applySpecialHighlight(sprite, color, alpha = 0.3) {
  if (!sprite) return;

  // if this is your deck/discard pile, don't shift it — but still
  // we only highlight *real* meld cards below
  const isDeckCard    = sprite.parent === this.deckContainer;
  const isDiscardCard = sprite.parent === this.discardContainer;
  if (!isDeckCard && !isDiscardCard) {
    sprite.y -= 12;
  }

  // check: is this card actually in a run or a set?
  const meldType = window.game.checkCardInMeld && window.game.checkCardInMeld(sprite.cardData);
  if (!meldType) {
    // clear any old highlight/filter
    sprite.filters = null;
    if (sprite.highlightBar) {
      sprite.removeChild(sprite.highlightBar);
      sprite.highlightBar = null;
    }
    return;
  }

  // only *now* do we apply our color filter
  const filter = new PIXI.filters.ColorMatrixFilter();
  if (meldType === 'run') {
    filter.matrix[0] = 0.9; filter.matrix[6] = 1.1; filter.matrix[12] = 0.9;
  } else { // 'set'
    filter.matrix[0] = 1.1; filter.matrix[6] = 1.1; filter.matrix[12] = 0.9;
  }
  sprite.filters = [filter];
  
    const bar = new PIXI.Graphics();
  
    const barHeight = 20;   
    const SAFETY_FACTOR = 2.0;
  const barWidth = sprite.width * SAFETY_FACTOR - 20;
  
    const barY = -sprite.height * 0.05;
  
    const cornerRadius = barHeight / 2;
  
    bar.beginFill(color, 0.85);
    bar.drawRoundedRect(
    -sprite.width * (SAFETY_FACTOR - 1) / 2 - 30,     barY,
    barWidth,
    barHeight,
    cornerRadius
  );
  bar.endFill();
  
    sprite.addChild(bar);
  bar.zIndex = 100;   sprite.highlightBar = bar;
}

tempHighlight(sprite, color, alpha = 0.3) {
  if (!sprite) return;
  
    const meldType = sprite.dragMeldType || 
                 (window.game && window.game.checkCardInMeld && 
                 sprite.cardData && window.game.checkCardInMeld(sprite.cardData));
  
    if (!meldType) return;

    sprite._originalHighlightBar = sprite.highlightBar;
  sprite._originalFilters = sprite.filters;
  
    if (sprite.highlightBar) {
    sprite.removeChild(sprite.highlightBar);
    sprite.highlightBar = null;
  }
  
    const colorMatrix = new PIXI.filters.ColorMatrixFilter();
  sprite.filters = [colorMatrix];
  
    const bar = new PIXI.Graphics();
  const barHeight = 20;
  const SAFETY_FACTOR = 2.0;
  const barWidth = sprite.width * SAFETY_FACTOR;
  const barY = sprite.height - barHeight;
  const cornerRadius = barHeight / 2;
  
    bar.beginFill(color, alpha);
  bar.drawRoundedRect(
    -sprite.width * (SAFETY_FACTOR - 1) / 2,
    barY,
    barWidth,
    barHeight,
    cornerRadius
  );
  bar.endFill();
  
    sprite.addChild(bar);
  bar.zIndex = 100;
  sprite.highlightBar = bar;
}

restoreOriginalHighlight(sprite) {
  if (!sprite) return;
  
    const meldType = sprite.dragMeldType || 
                 (window.game && window.game.checkCardInMeld && 
                 sprite.cardData && window.game.checkCardInMeld(sprite.cardData));
  
    if (sprite.highlightBar) {
    sprite.removeChild(sprite.highlightBar);
    sprite.highlightBar = null;
  }
  
    sprite.filters = null;
  
    if (meldType) {
        const color = meldType === 'set' ? 0xFFFE7A : 0x98FB98;
    
        this.applySpecialHighlight(sprite, color, 0.5);
  }
}

clearAllHighlights() {
  if (!this.playerHandContainer) return;

  this.playerHandContainer.children.forEach(sprite => {
    
        sprite.filters = null;

        if (sprite.highlightBar) {
      sprite.removeChild(sprite.highlightBar);
      sprite.highlightBar = null;
    }
  });
}

  setdeckDragCallback(callback) {
    this.deckDragCallback = callback;
  }

    enhanceCardClickFeedback(sprite) {
    if (!sprite) return;
    
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

    animateCardTake(cardData, source, destIndex) {
    if (!cardData) return;
    
        const startX = source === 'deck' 
      ? this.deckContainer.x + this.config.cardWidth / 2
      : this.discardContainer.x + this.config.cardWidth / 2;
    
    const startY = source === 'deck'
      ? this.deckContainer.y + this.config.cardHeight / 2
      : this.discardContainer.y + this.config.cardHeight / 2;
    
        const spacing = this.config.fanDistance || 30;
    const totalCards = this.playerHandContainer.children.length;
    const fanAngle = this.config.fanAngle || 10;
    
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + destIndex * anglePerCard;
    const finalRotation = -(rotation * Math.PI / 180);
    
    const finalX = this.playerHandContainer.x - ((totalCards - 1) * spacing / 2) + destIndex * spacing;
    const finalY = this.playerHandContainer.y;     
        this.createCardSprite(cardData, false)
      .then(sprite => {
        sprite.anchor.set(0.5, 0.9);         sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.cardData = cardData;
        
                sprite.x = startX;
        sprite.y = startY;
        sprite.rotation = 0;
        sprite.scale.set(0.9);
        sprite.alpha = 1;
        sprite.zIndex = 200;
        
                this.animationContainer.addChild(sprite);
        
                const timeline = gsap.timeline({
          onComplete: () => {
            this.animationContainer.removeChild(sprite);
          }
        });
        
                const midX = startX + (finalX - startX) * 0.5;
        const highPoint = Math.min(startY, finalY) - 100;         
                if (typeof gsap.getBezierPlugin === 'function' && gsap.getBezierPlugin()) {
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
        const originalWidth = this.config.cardWidth;
    const originalHeight = this.config.cardHeight;
    
        const originalX = sprite.x;
    const originalY = sprite.y;
    const originalRotation = sprite.rotation;
    
    console.log("Flipping card");
    
        gsap.to(sprite.scale, {
      x: 0.01,       duration: 0.2,
      ease: "power1.in",
      onComplete: () => {
                if (sprite.cardData && sprite.cardData.suit && sprite.cardData.value) {
          const { suit, value } = sprite.cardData;
          const frontPath = `https://koshmosh43.github.io/playable/assets/cards/${suit}/${value}_${suit.charAt(0).toUpperCase()}${suit.slice(1)}.webp`;
          
          this.assetLoader.loadTexture(frontPath)
            .then(texture => {
              sprite.texture = texture;
              
                            sprite.width = originalWidth;
              sprite.height = originalHeight;
              
                            gsap.to(sprite.scale, {
                x: 1.0,                 y: 1.0,                 duration: 0.2,
                ease: "back.out(1.5)",
                onComplete: () => {
                                    sprite.width = originalWidth;
                  sprite.height = originalHeight;
                  
                                    sprite.x = originalX;
                  sprite.y = originalY;
                  sprite.rotation = originalRotation;
                  
                  if (onComplete) onComplete();
                }
              });
            })
            .catch(err => {
              console.warn("Failed to load texture:", err);
              
                            sprite.scale.x = 1.0;
              sprite.width = originalWidth;
              sprite.height = originalHeight;
              
              if (onComplete) onComplete();
            });
        } else {
                    sprite.scale.x = 1.0;
          sprite.width = originalWidth;
          sprite.height = originalHeight;
          
          if (onComplete) onComplete();
        }
      }
    });
  }
  
    flipPlayerCards(onComplete) {
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
    
        this.cardsFlipped = true;
    
        cards.forEach(sprite => {
      if (sprite) {
                sprite.originalPosition = {
          x: sprite.x,
          y: sprite.y,
          rotation: sprite.rotation
        };
      }
    });
    
        let completedCount = 0;
    
        const checkCompletion = () => {
      completedCount++;
      if (completedCount >= cards.length) {
        console.log("Все карты перевернуты");
        if (onComplete) setTimeout(onComplete, 50);
      }
    };
    
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
        const cardPath = `https://koshmosh43.github.io/playable/assets/cards/${cardData.suit}/${cardData.value}_${cardData.suit.charAt(0).toUpperCase()}${cardData.suit.slice(1)}.webp`;
    
        const timeline = gsap.timeline({
      onComplete: () => {
        if (onComplete) onComplete();
      }
    });
    
    this.assetLoader.loadTexture(cardPath)
      .then(texture => {
                timeline.to(cardSprite.scale, {
          x: 0.01,           duration: 0.15,
          ease: "power2.in"
        });
        
                timeline.call(() => {
          cardSprite.texture = texture;
        });
        
                timeline.to(cardSprite.scale, {
          x: 1.1,           duration: 0.15,
          ease: "back.out(1.5)"         });
        
                timeline.to(cardSprite.scale, {
          x: 1.0,
          duration: 0.1,
          ease: "power1.out"
        });
        
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
        
                this.createFallbackCardTexture(cardSprite, cardData);
        
                timeline.to(cardSprite.scale, {
          x: 1,
          duration: 0.2
        });
      });
  }

  simpleFlipAnimation(cardSprite, cardData, onComplete) {
        gsap.to(cardSprite.scale, {
      x: 0.1,       duration: 0.2,
      ease: "power1.inOut",
      onComplete: () => {
                const cardPath = `https://koshmosh43.github.io/playable/assets/cards/${cardData.suit}/${cardData.value}_${cardData.suit.charAt(0).toUpperCase()}${cardData.suit.slice(1)}.webp`;
        
        this.assetLoader.loadTexture(cardPath)
          .then(texture => {
                        cardSprite.texture = texture;
            
                        gsap.to(cardSprite.scale, {
              x: 1,
              duration: 0.2,
              ease: "power1.inOut",
              onComplete: () => {
                                cardSprite.interactive = true;
                cardSprite.buttonMode = true;
                cardSprite.on('pointerdown', () => {
                  if (this.onCardClick) {
                    this.onCardClick(cardData, 'player');
                  }
                });
                
                                if (onComplete) onComplete();
              }
            });
          })
          .catch(err => {
            console.warn(`Could not load card texture: ${err}`);
                        this.createFallbackCardTexture(cardSprite, cardData);
            
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
        let wasInterrupted = false;
    let dealingInProgress = true;
    
        if (!playerCards || !Array.isArray(playerCards) || !opponentCards || !Array.isArray(opponentCards)) {
      console.error("Invalid card arrays in animateFlyingCardDealing");
      if (onComplete) setTimeout(onComplete, 0);
      return;
    }
    
            const deckX = this.deckContainer.x + this.config.cardWidth / 2;
    const deckY = this.deckContainer.y + this.config.cardHeight / 2 + 30;
    
        const skipDealingHandler = () => {
      if (dealingInProgress) {
        console.log("Skipping dealing animation...");
        wasInterrupted = true;
        
                this.animationContainer.removeChildren();
        
                this.createAndShowFinalCards(playerCards, opponentCards);
        
                dealingInProgress = false;
        if (onComplete) onComplete();
        
        this.app.stage.off('pointerdown', skipDealingHandler);
      }
    };
    
        this.app.stage.interactive = true;
    this.app.stage.on('pointerdown', skipDealingHandler);
    
        this.playerHandContainer.removeChildren();
    this.opponentHandContainer.removeChildren();
    
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
    
        this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp')
      .then(backTexture => {
                const animCards = [];
        
                opponentCards.forEach((cardData, index) => {
                    if (!opponentPositions[index]) {
            console.warn(`Missing position data for opponent card ${index}`);
            return;
          }
          
                    const sprite = new PIXI.Sprite(backTexture);
          sprite.anchor.set(0.5, 0.9);           sprite.width = this.config.cardWidth;
          sprite.height = this.config.cardHeight;
          sprite.x = deckX;
          sprite.y = deckY;
          sprite.rotation = 0;
          sprite.zIndex = 1000 + index;
          
          this.animationContainer.addChild(sprite);
          
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
        
                playerCards.forEach((cardData, index) => {
                    if (!playerPositions[index]) {
            console.warn(`Missing position data for player card ${index}`);
            return;
          }
          
                    const sprite = new PIXI.Sprite(backTexture);
          sprite.anchor.set(0.5, 0.9);           sprite.width = this.config.cardWidth;
          sprite.height = this.config.cardHeight;
          sprite.x = deckX;
          sprite.y = deckY;
          sprite.rotation = 0;
          sprite.zIndex = 1000 + opponentCards.length + index;
          
          this.animationContainer.addChild(sprite);
          
                    animCards.push({
            sprite: sprite,
            cardData: cardData,
            isPlayer: true,
            finalPos: {
              x: this.playerHandContainer.x + playerPositions[index].x,
              y: this.playerHandContainer.y,               rotation: playerPositions[index].rotation
            }
          });
        });
        
                if (animCards.length === 0) {
          console.warn("No cards to animate in dealing");
          skipDealingHandler();
          return;
        }
        
                const dealDelay = 0.05;
        
                const timeline = gsap.timeline({
          onComplete: () => {
            if (wasInterrupted) return;
            
                        this.animationContainer.removeChildren();
            
                        this.createFinalCards(
              playerCards, 
              opponentCards, 
              playerPositions, 
              opponentPositions, 
              backTexture,
              () => {
                                this.flipPlayerCards(() => {
                  dealingInProgress = false;
                  this.app.stage.off('pointerdown', skipDealingHandler);
                  if (onComplete) onComplete();
                });
              }
            );
          }
        });
        
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
            if (typeof cardCount !== 'number' || cardCount < 0) {
        console.error("Invalid card count:", cardCount);
        return [];
      }
      
      const positions = [];
      const spacing = this.config.fanDistance || 30;
      const fanAngle = this.config.fanAngle || 10;
      
            const anglePerCard = cardCount > 1 ? fanAngle / (cardCount - 1) : 0;
      
      for (let i = 0; i < cardCount; i++) {
        const rotation = -fanAngle/2 + i * anglePerCard;
        const rotationRad = rotation * Math.PI / 180;
        
                const finalRotation = isPlayer ? -rotationRad : rotationRad;
        
                positions.push({
          x: -((cardCount - 1) * spacing / 2) + i * spacing,
          y: isPlayer ? 0 : Math.sin(rotationRad) * 10,           rotation: finalRotation
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
    
        const anglePerCard = cardCount > 1 ? fanAngle / (cardCount - 1) : 0;
    
        for (let i = 0; i < cardCount; i++) {
      const rotation = -fanAngle/2 + i * anglePerCard;
      const rotationRad = rotation * Math.PI / 180;
      
            const xPos = -((cardCount - 1) * spacing / 2) + i * spacing;
      const yPos = Math.sin(rotationRad) * 10;
      
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
        opponentCards.forEach((cardData, index) => {
      const sprite = new PIXI.Sprite(backTexture);
      sprite.anchor.set(0.5, 0.9);       sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      sprite.x = opponentPositions[index].x;
      sprite.y = opponentPositions[index].y;
      sprite.rotation = opponentPositions[index].rotation;
      sprite.zIndex = index;
      sprite.cardData = cardData;
      
      this.opponentHandContainer.addChild(sprite);
    });
    
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
  

    createFinalCards(playerCards, opponentCards, playerPositions, opponentPositions, backTexture, onComplete) {
    try {
            if (!playerCards || !opponentCards || !playerPositions || !opponentPositions || !backTexture) {
        console.error("Missing required parameters in createFinalCards");
        if (onComplete) setTimeout(onComplete, 0);
        return;
      }
      
            this.playerHandContainer.removeChildren();
      this.opponentHandContainer.removeChildren();
      
            opponentCards.forEach((cardData, index) => {
                if (!opponentPositions[index]) {
          console.warn(`Missing position data for opponent card at index ${index}`);
          return;         }
        
        const pos = opponentPositions[index];
        const sprite = new PIXI.Sprite(backTexture);
        sprite.anchor.set(0.5, 0.9);         sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.x = pos.x;
        sprite.y = pos.y;         sprite.rotation = pos.rotation;
        sprite.zIndex = index;
        sprite.cardData = cardData;
        
        this.opponentHandContainer.addChild(sprite);
      });
      
            playerCards.forEach((cardData, index) => {
                if (!playerPositions[index]) {
          console.warn(`Missing position data for player card at index ${index}`);
          return;         }
        
        const pos = playerPositions[index];
        const sprite = new PIXI.Sprite(backTexture);
        sprite.anchor.set(0.5, 0.9);         sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.x = pos.x;
        sprite.y = 0;         sprite.rotation = pos.rotation;
        sprite.zIndex = index;
        sprite.cardData = cardData;
        
        this.playerHandContainer.addChild(sprite);
      });
      
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Error in createFinalCards:", error);
            if (onComplete) setTimeout(onComplete, 0);
    }
  }

  createAndShowFinalCards(playerCards, opponentCards) {
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
    
        this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp')
      .then(backTexture => {
                opponentCards.forEach((cardData, index) => {
          const sprite = new PIXI.Sprite(backTexture);
          sprite.anchor.set(0.5, 0.9);           sprite.width = this.config.cardWidth;
          sprite.height = this.config.cardHeight;
          sprite.x = opponentPositions[index].x;
          sprite.y = opponentPositions[index].y;
          sprite.rotation = opponentPositions[index].rotation;
          sprite.zIndex = index;
          sprite.cardData = cardData;
          
          this.opponentHandContainer.addChild(sprite);
        });
        
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
                    cardsWithTextures.forEach((item, index) => {
            let sprite;
            
            if (item.texture) {
              sprite = new PIXI.Sprite(item.texture);
            } else {
                            sprite = this.createFallbackCardGraphics(item.cardData, false);
            }
            
            sprite.anchor.set(0.5, 0.9);             sprite.width = this.config.cardWidth;
            sprite.height = this.config.cardHeight;
            sprite.x = playerPositions[index].x;
            sprite.y = 0;             sprite.rotation = playerPositions[index].rotation;
            sprite.zIndex = index;
            sprite.cardData = item.cardData;
            sprite.interactive = true;
            sprite.buttonMode = true;
            
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
    this.playerHandContainer.removeChildren();
  this.opponentHandContainer.removeChildren();
  
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
  
    this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp')
    .then(backTexture => {
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
                cardDataWithTextures.forEach((item, index) => {
          let sprite;
          
          if (item.texture) {
            sprite = new PIXI.Sprite(item.texture);
          } else {
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


showFinalCards() {
  [...this.playerHandContainer.children, ...this.opponentHandContainer.children].forEach(card => {
    gsap.to(card, { alpha: 1, duration: 0.2 });
  });
}

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
  
    animateDealingCard(cardData, targetPosition, delay = 0, faceDown = false, onComplete = null) {
  this.createCardSprite(cardData).then(sprite => {
    sprite.proj.euler.y = faceDown ? Math.PI : 0;      sprite.position.set(this.deckContainer.x, this.deckContainer.y);
    sprite.zIndex = 200;
    this.animationContainer.addChild(sprite);

        gsap.to(sprite, {
      pixi: {
        x: targetPosition.x,
        y: targetPosition.y,
      },
      duration: 0.5,
      delay: delay,
      ease: "power2.out",
      onComplete: () => {
                if (!faceDown) {
          gsap.to(sprite.proj.euler, {
            y: Math.PI * 2,             duration: 0.6,
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

  
    async renderOpponentHand(opponentCards) {
    if (!opponentCards || !opponentCards.length) return;
    
    const spacing = this.config.fanDistance || 30;
    const fanAngle = this.config.fanAngle || 10;
    
        for (let index = 0; index < opponentCards.length; index++) {
      const cardData = opponentCards[index];
      const sprite = await this.createCardSprite(cardData, true);
      
            const totalCards = opponentCards.length;
      const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
      const rotation = -fanAngle/2 + index * anglePerCard;
      
            sprite.anchor.set(0.5, 0.9);
      
            sprite.x = (totalCards - 1) * spacing / 2 - index * spacing;
      sprite.y = Math.sin(rotation * Math.PI / 180) * 10;
      sprite.rotation = rotation * Math.PI / 180;
      
            sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      
      this.opponentHandContainer.addChild(sprite);
    }
  }
  
  async renderdeck(deckCount) {
  if (!deckCount) deckCount = 0;

  const maxVisible = 5;
  const visibleCount = Math.min(deckCount, maxVisible);

    for (let i = 0; i < visibleCount; i++) {
    const sprite = await this.createCardSprite({ faceDown: true }, true);
    sprite.cardData = { source: 'deck' };

    sprite.anchor.set(0.5, 0.5);
    sprite.x = this.config.cardWidth / 2;
    sprite.y = this.config.cardHeight / 2 - 3 * i;
    sprite.zIndex = i;

        if (i === visibleCount - 1 && deckCount > 0) {
      this.adddeckCounter(sprite, deckCount);

      sprite.interactive = true;
      sprite.buttonMode = true;
      sprite.zIndex = 5000;
      sprite.removeAllListeners();

      sprite.on('pointerdown', (event) => {
        event.stopPropagation();

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

  
    adddeckCounter(sprite, deckCount) {
        const countContainer = new PIXI.Container();
    countContainer.zIndex = 999;
    
    const scaleFactor = 5;
    
        const ellipse = new PIXI.Graphics();
    ellipse.lineStyle(4, 0xFFFFFF);
    ellipse.beginFill(0x3366CC);
    ellipse.drawEllipse(0, 0, 22 * scaleFactor, 30 * scaleFactor);
    ellipse.endFill();
    
        ellipse.lineStyle(4, 0x000000);
    ellipse.drawEllipse(0, 0, 20 * scaleFactor, 28 * scaleFactor);
    
        const countText = new PIXI.Text(`${deckCount}`, {
      fontFamily: "Arial",
      fontSize: 22 * scaleFactor,
      fontWeight: "bold",
      fill: 0xFFFFFF
    });
    countText.anchor.set(0.5);
    
    countContainer.addChild(ellipse);
    countContainer.addChild(countText);
    
                countContainer.x = 0;
    countContainer.y = 0;
    
        sprite.addChild(countContainer);
  }

  showDiscardMessage() {
    this.dialogContainer.removeChildren();
    
        const dialogBg = new PIXI.Graphics();
    dialogBg.beginFill(0xFFFBF0, 0.9);     dialogBg.drawRoundedRect(0, 0, 350, 70, 20);     dialogBg.endFill();
    
        const dialogText = new PIXI.Text("Discard a card !", {
      fontFamily: "Arial",
      fontSize: 24,
      fontWeight: "bold",
      fill: 0x4E342E,       align: "center"
    });
    dialogText.anchor.set(0.5);
    dialogText.x = 175;
    dialogText.y = 35;
    
    dialogBg.addChild(dialogText);
    
        dialogBg.x = (this.app.screen.width - 350) / 2;
    dialogBg.y = (this.app.screen.height / 2) - 35;     
    this.dialogContainer.addChild(dialogBg);
    this.dialogContainer.visible = true;
    
    return dialogBg;
  }

  returnCardToHand(cardData) {
        if (this.draggingCard) {
      this.snapCardBack(this.draggingCard);
            this.draggingCard = null;
      this.draggingCardData = null;
      this.draggingCardSource = null;
    }
  }
  
  
    async renderDiscardPile(discardPile) {
    console.log("Rendering discard pile with", discardPile?.length || 0, "cards");
    
        this.discardContainer.removeChildren();
    
    if (!discardPile || discardPile.length === 0) {
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
    
        const visibleDiscards = Math.min(discardPile.length, 5);
    
        const centerX = this.config.cardWidth / 2;
    const centerY = this.config.cardHeight / 2;
    
        const renderedCardIds = new Set();
    
        for (let i = 0; i < visibleDiscards; i++) {
      const discardIndex = discardPile.length - visibleDiscards + i;
      const discard = discardPile[discardIndex];
      
            const cardKey = `${discard.value}_${discard.suit}`;
      if (renderedCardIds.has(cardKey)) {
        console.warn(`Skipping duplicate discard card: ${cardKey}`);
        continue;
      }
      
            renderedCardIds.add(cardKey);
      
      const sprite = await this.createCardSprite(discard, false);
      
            sprite.width = this.config.cardWidth;
      sprite.height = this.config.cardHeight;
      
            sprite.anchor.set(0.5);
      
            const randomRotation = ((i * 137 + 547) % 100) / 500 - 0.1;       const randomOffsetX = ((i * 263 + 821) % 10) - 5;                 const randomOffsetY = ((i * 521 + 347) % 10) - 5;                 
            sprite.x = centerX + randomOffsetX;
      sprite.y = centerY + randomOffsetY;
      sprite.rotation = randomRotation;
      
            sprite.zIndex = i;
      
            if (i === visibleDiscards - 1) {
        sprite.interactive = true;
        sprite.buttonMode = true;
        
                sprite.removeAllListeners();
        
                sprite.on('pointerdown', (event) => {
                    event.stopPropagation();
          
                    this.startCardDragging(discard, 'discard');
        });
      }
      
      this.discardContainer.addChild(sprite);
    }
    
        this.discardContainer.sortChildren();
  }
  
    
  
    createFallbackCardGraphics(cardData, isBack) {
    const graphics = new PIXI.Graphics();
    
    if (isBack || cardData.faceDown) {
            graphics.beginFill(0x0000AA);
      graphics.drawRoundedRect(0, 0, this.config.cardWidth, this.config.cardHeight, 5);
      graphics.endFill();
      graphics.lineStyle(2, 0xFFFFFF);
      graphics.drawRoundedRect(5, 5, this.config.cardWidth - 10, this.config.cardHeight - 10, 3);
    } else {
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
    }
    
    return graphics;
  }
  
    setCardClickHandler(handler) {
    this.onCardClick = handler;
  }
  
    handleCardClick(cardData, source) {
    if (this.onCardClick) {
      this.onCardClick(cardData, source);
    }
  }

  enableDragging(enabled) {
        const forceEnable = this.playerTurn && this.gameStep % 2 === 1 && this.hasDrawnCard;
    
    this.isDragEnabled = enabled || forceEnable;
    
        if (this.isDragEnabled && this.playerHandContainer) {
      console.log("Enabling drag for all player cards - FORCED:", forceEnable);
      
            this.playerHandContainer.children.forEach(sprite => {
        if (sprite && sprite.cardData) {
                    this.setupDragAndDrop(sprite, sprite.cardData);
          
                    sprite.interactive = true;
          sprite.buttonMode = true;
        }
      });
    }
  }
  
    animateCardDiscard(cardData, sourceIndex) {
        const spacing = this.config.fanDistance || 30;
    const totalCards = this.playerHandContainer.children.length;
    const startX = this.playerHandContainer.x - ((totalCards - 1) * spacing / 2) + sourceIndex * spacing;
    const startY = this.playerHandContainer.y;
    
        const fanAngle = this.config.fanAngle || 10;
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + sourceIndex * anglePerCard;
    const startRotation = -(rotation * Math.PI / 180);
    
        const endX = this.discardContainer.x + this.config.cardWidth / 2;
    const endY = this.discardContainer.y + this.config.cardHeight / 2;
    
        if (cardData) {
      delete cardData.highlightBar;
      delete cardData.filters;
    }
    
        this.createCardSprite(cardData, false)
      .then(sprite => {
                sprite.anchor.set(0.5);
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        sprite.cardData = cardData;
        
                sprite.highlightBar = null;
        sprite.filters = null;
        
                sprite.x = startX;
        sprite.y = startY;
        sprite.rotation = startRotation;
        sprite.zIndex = 150;
        
                this.animationContainer.addChild(sprite);
        
                gsap.to(sprite, {
          x: endX,
          y: endY,
          rotation: 0,
          duration: 0.5,
          ease: "power2.inOut",
          onComplete: () => {
                        this.animationContainer.removeChild(sprite);
          }
        });
      })
      .catch(error => {
        console.error("Error in card discard animation:", error);
      });
  }
  
    animateOpponentCardTake(source, newCardIndex) {
        const startX = source === 'deck'
      ? this.deckContainer.x + this.config.cardWidth / 2
      : this.discardContainer.x + this.config.cardWidth / 2;
    const startY = source === 'deck'
      ? this.deckContainer.y + this.config.cardHeight / 2
      : this.discardContainer.y + this.config.cardHeight / 2;
    
        const spacing = this.config.fanDistance || 30;
    const totalCards = this.opponentHandContainer.children.length + 1;
    
        const fanAngle = this.config.fanAngle || 10;
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + newCardIndex * anglePerCard;
    
        const finalX = this.opponentHandContainer.x - ((totalCards - 1) * spacing / 2) + newCardIndex * spacing;
    const finalY = this.opponentHandContainer.y + Math.sin(rotation * Math.PI / 180) * 10;
    const finalRotation = -(rotation * Math.PI / 180);
    
        const cardData = { faceDown: true };
    
        this.createCardSprite(cardData, true)
      .then(sprite => {
        sprite.anchor.set(0.5, 0.9);
        sprite.width = this.config.cardWidth;
        sprite.height = this.config.cardHeight;
        
                sprite.x = startX;
        sprite.y = startY;
        sprite.rotation = 0;
        sprite.zIndex = 150;
        
                this.animationContainer.addChild(sprite);
        
                const timeline = gsap.timeline({
          onComplete: () => {
                        this.animationContainer.removeChild(sprite);
            
                        const permanentSprite = new PIXI.Sprite(sprite.texture);
            permanentSprite.anchor.set(0.5, 0.9);
            permanentSprite.width = this.config.cardWidth;
            permanentSprite.height = this.config.cardHeight;
            permanentSprite.x = finalX;
            permanentSprite.y = finalY;
            permanentSprite.rotation = finalRotation;
            permanentSprite.zIndex = newCardIndex;
            
                        this.opponentHandContainer.addChild(permanentSprite);
            this.opponentHandContainer.sortChildren();
          }
        });
        
                const midX = (startX + finalX) / 2;
        const midY = Math.min(startY, finalY) - 40;         
                timeline.to(sprite, {
          x: midX,
          y: midY,
          rotation: finalRotation / 2,
          duration: 0.25,
          ease: "power2.out"
        });
        
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
        const spacing = this.config.fanDistance || 30;
    const totalCards = this.opponentHandContainer.children.length;
    const startX = this.opponentHandContainer.x + (totalCards - 1) * spacing / 2 - sourceIndex * spacing;
    const startY = this.opponentHandContainer.y;
    
        const fanAngle = this.config.fanAngle || 10;
    const anglePerCard = totalCards > 1 ? fanAngle / (totalCards - 1) : 0;
    const rotation = -fanAngle/2 + (totalCards - 1 - sourceIndex) * anglePerCard;
    const startRotation = rotation * Math.PI / 180;
    
        const endX = this.discardContainer.x + this.config.cardWidth / 2;
    const endY = this.discardContainer.y + this.config.cardHeight / 2;
    
        const cardToUse = cardData || {
      value: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][Math.floor(Math.random() * 13)],
      suit: ['hearts', 'diamonds', 'clubs', 'spades'][Math.floor(Math.random() * 4)],
      filename: null
    };
    
        if (!cardToUse.filename && cardToUse.value && cardToUse.suit) {
      cardToUse.filename = `${cardToUse.value}_${cardToUse.suit.charAt(0).toUpperCase()}${cardToUse.suit.slice(1)}.webp`;
    }
    
        Promise.all([
      this.createCardSprite(cardToUse, false),       this.createCardSprite({...cardToUse, faceDown: true}, true)     ]).then(([faceUpCard, faceDownCard]) => {
            const flipContainer = new PIXI.Container();
      flipContainer.x = startX;
      flipContainer.y = startY;
      flipContainer.zIndex = 200;
      
            faceUpCard.anchor.set(0.5, 0.9);
      faceDownCard.anchor.set(0.5, 0.9);
      
            faceUpCard.width = this.config.cardWidth;
      faceUpCard.height = this.config.cardHeight;
      faceDownCard.width = this.config.cardWidth;
      faceDownCard.height = this.config.cardHeight;
      
            faceUpCard.x = 0;
      faceUpCard.y = 0;
      faceDownCard.x = 0;
      faceDownCard.y = 0;
      
            faceUpCard.visible = false;
      faceDownCard.visible = true;
      
            flipContainer.rotation = startRotation;
      
            flipContainer.addChild(faceUpCard);
      flipContainer.addChild(faceDownCard);
      this.animationContainer.addChild(flipContainer);
      
            const timeline = gsap.timeline({
        onComplete: () => {
                    this.animationContainer.removeChild(flipContainer);
          
                    console.log("Opponent card discard animation completed");
          
                    if (typeof onComplete === 'function') {
            onComplete();
          } else {
            console.warn("No callback provided for opponent card discard animation");
          }
        }
      });
      
            timeline.to(flipContainer, {
        x: (startX + endX) / 2,
        y: (startY + endY) / 2 - 20,         rotation: startRotation / 2,         duration: 0.3,
        ease: "power2.out"
      });
      
                  timeline.to(flipContainer, {
        rotationY: 90,         duration: 0.15,
        ease: "sine.in",
        onUpdate: function() {
                    if (this.progress() >= 0.5 && faceDownCard.visible) {
            faceDownCard.visible = false;
            faceUpCard.visible = true;
          }
        }
      });
      
      timeline.to(flipContainer, {
        rotationY: 180,         duration: 0.15,
        ease: "sine.out"
      });
      
            timeline.to(flipContainer, {
        x: endX,
        y: endY,
        rotation: 0,         duration: 0.3,
        ease: "power2.in"
      });
    }).catch(error => {
      console.error("Error in opponent card discard animation:", error);
    });
  }
  
    updatePositions(adHeight, navHeight, screenWidth, screenHeight) {
        this.playerHandContainer.x = screenWidth / 2;
    this.playerHandContainer.y = screenHeight - 85;

      if (screenHeight < 700) {
    this.playerHandContainer.y = screenHeight - 35;   } else {
    this.playerHandContainer.y = screenHeight - 65;   }
    
        this.opponentHandContainer.x = screenWidth / 2;
    this.opponentHandContainer.y = adHeight + navHeight + 100;
    
            this.deckContainer.x = screenWidth / 2 - this.config.cardWidth - 50;     this.deckContainer.y = screenHeight / 2 - this.config.cardHeight / 2 - 20;     
        this.discardContainer.x = screenWidth / 2 + 50;     this.discardContainer.y = screenHeight / 2 - this.config.cardHeight / 2 - 20;   }
}