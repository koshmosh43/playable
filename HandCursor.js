// HandCursor.js - Cursor for tutorials and animations
export class HandCursor {
  constructor(app, assetLoader) {
    this.app = app;
    this.assetLoader = assetLoader;
    
    // Hand cursor container
    this.container = new PIXI.Container();
    this.container.zIndex = 1000;
    this.container.visible = false;
    
    // Initialize
    this.init();
    
    // Add to stage
    this.app.stage.addChild(this.container);
  }
  
  // Initialize hand cursor
  init() {
    // Try to load hand image from assets
    this.assetLoader.loadTexture('assets/hand.webp')
      .then(texture => {
        // Create hand sprite
        const handSprite = new PIXI.Sprite(texture);
        handSprite.anchor.set(0.2, 0.2); // Position finger tip as pointer
        handSprite.scale.set(0.7);
        
        // Add to container
        this.container.addChild(handSprite);
      })
      .catch(err => {
        console.warn("Could not load hand cursor image, using fallback", err);
        
        // Create a fallback hand graphic
        const handGraphic = new PIXI.Graphics();
        
        // Draw a simple hand shape
        handGraphic.beginFill(0xFFDDCC); // Skin tone
        handGraphic.drawCircle(0, 0, 15); // Palm circle
        handGraphic.drawRoundedRect(-5, -40, 10, 40, 5); // Finger
        handGraphic.endFill();
        
        // Add black outline
        handGraphic.lineStyle(1, 0x000000, 0.5);
        handGraphic.drawCircle(0, 0, 15);
        handGraphic.drawRoundedRect(-5, -40, 10, 40, 5);
        
        // Rotate to point with the finger
        handGraphic.rotation = -Math.PI / 2;
        
        // Add to container
        this.container.addChild(handGraphic);
      });
  }
  
  // Show the hand cursor
  show() {
    this.container.visible = true;
    this.container.alpha = 1;
  }
  
  // Hide the hand cursor
  hide() {
    this.container.visible = false;
  }
  
  // Метод для перемещения между двумя точками
  moveBetween(x1, y1, x2, y2, options = {}) {
    const defaults = {
      cycles: 1,
      pauseDuration: 0.5,
      moveDuration: 1.0,
      onComplete: null
    };
    
    const settings = { ...defaults, ...options };
    
    // Показываем курсор в первой точке
    this.showAt(x1, y1);
    
    // Создаем временную шкалу для движения
    const timeline = gsap.timeline({
      repeat: settings.cycles - 1,
      onComplete: () => {
        if (typeof settings.onComplete === 'function') {
          settings.onComplete();
        }
      }
    });
    
    // Добавляем движение к первой точке и паузу
    timeline.to(this.container, {
      x: x1,
      y: y1,
      duration: settings.moveDuration / 2,
      ease: "power2.inOut"
    });
    
    timeline.to(this.container, {
      pixi: { scale: 1.1 },
      duration: 0.2,
      yoyo: true,
      repeat: 1
    });
    
    timeline.to({}, {
      duration: settings.pauseDuration
    });
    
    // Добавляем движение ко второй точке и паузу
    timeline.to(this.container, {
      x: x2,
      y: y2,
      duration: settings.moveDuration,
      ease: "power2.inOut"
    });
    
    timeline.to(this.container, {
      pixi: { scale: 1.1 },
      duration: 0.2,
      yoyo: true,
      repeat: 1
    });
    
    timeline.to({}, {
      duration: settings.pauseDuration
    });
    
    // Добавляем движение обратно к первой точке
    timeline.to(this.container, {
      x: x1,
      y: y1,
      duration: settings.moveDuration,
      ease: "power2.inOut"
    });
    
    return timeline;
  }
  
  // Метод для "тапа" (нажатия) на элемент
  tap(x, y, options = {}) {
    const defaults = {
      scale: 0.9,
      duration: 0.2,
      repeat: 0,
      repeatDelay: 0.5,
      onComplete: null
    };
    
    const settings = { ...defaults, ...options };
    
    // Показываем курсор в указанной точке
    this.showAt(x, y);
    
    // Создаем анимацию нажатия
    const timeline = gsap.timeline({
      repeat: settings.repeat,
      repeatDelay: settings.repeatDelay,
      onComplete: () => {
        if (typeof settings.onComplete === 'function') {
          settings.onComplete();
        }
      }
    });
    
    // Анимация нажатия вниз (сжатие)
    timeline.to(this.container.scale, {
      x: settings.scale,
      y: settings.scale,
      duration: settings.duration,
      ease: "power2.in"
    });
    
    // Анимация нажатия вверх (возврат к исходному размеру)
    timeline.to(this.container.scale, {
      x: 1,
      y: 1,
      duration: settings.duration,
      ease: "power2.out"
    });
    
    return timeline;
  }
  
  // Метод для плавного исчезновения курсора
  fade(duration = 0.5) {
    gsap.to(this.container, {
      alpha: 0,
      duration: duration,
      ease: "power2.out",
      onComplete: () => {
        this.hide();
        this.container.alpha = 1; // Сбрасываем альфу для следующего использования
      }
    });
  }
  
  // Метод для показа курсора в определенной точке
  showAt(x, y) {
    this.container.x = x;
    this.container.y = y;
    this.container.visible = true;
    this.container.alpha = 1;
  }

  // Demonstrate moving a card
  demonstrateCardMove(from, to, options = {}) {
    const defaults = {
      dragDuration: 1.0,
      dragEase: "power2.inOut",
      onComplete: null
    };
    
    const settings = { ...defaults, ...options };
    
    // Show hand at starting position
    this.showAt(from.x, from.y);
    
    // Create animation
    const timeline = gsap.timeline({
      onComplete: () => {
        if (typeof settings.onComplete === 'function') {
          settings.onComplete();
        }
      }
    });
    
    // "Press" down on card
    timeline.to(this.container.scale, {
      x: 0.9,
      y: 0.9,
      duration: 0.2,
      ease: "power2.in"
    });
    
    // Small pause to simulate grabbing
    timeline.to({}, {
      duration: 0.1
    });
    
    // "Drag" the card to the destination
    timeline.to(this.container, {
      x: to.x,
      y: to.y,
      duration: settings.dragDuration,
      ease: settings.dragEase
    });
    
    // "Release" the card
    timeline.to(this.container.scale, {
      x: 1,
      y: 1,
      duration: 0.2,
      ease: "power2.out"
    });
    
    // Fade out the hand
    timeline.to(this.container, {
      alpha: 0,
      duration: 0.5,
      onComplete: () => {
        this.hide();
        this.container.alpha = 1;
      }
    });
    
    return timeline;
  }
  
  // Helper method for tutorial animations
  animateCardSelection(cardPosition, duration = 1.0) {
    // Position cursor above the card
    const startX = cardPosition.x;
    const startY = cardPosition.y - 50;
    
    this.showAt(startX, startY);
    
    // Create animation timeline
    const timeline = gsap.timeline({
      onComplete: () => {
        this.fade();
      }
    });
    
    // Move down to card
    timeline.to(this.container, {
      y: cardPosition.y,
      duration: duration / 2,
      ease: "power2.inOut"
    });
    
    // Tap animation
    timeline.to(this.container.scale, {
      x: 0.9,
      y: 0.9,
      duration: 0.2,
      ease: "power2.in"
    });
    
    timeline.to(this.container.scale, {
      x: 1,
      y: 1,
      duration: 0.2,
      ease: "power2.out"
    });
    
    // Small pause
    timeline.to({}, {
      duration: 0.2
    });
    
    // Move back up
    timeline.to(this.container, {
      y: startY,
      duration: duration / 2,
      ease: "power2.inOut"
    });
    
    return timeline;
  }
}