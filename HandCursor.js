// HandCursor.js - Animated hand cursor for interactive hints
export class HandCursor {
    constructor(app, assetLoader) {
      this.app = app;
      this.assetLoader = assetLoader;
      this.container = new PIXI.Container();
      this.container.zIndex = 9999; // Always on top
      this.handSprite = null;
      this.isAnimating = false;
      this.isVisible = false;
      
      // Initialize the hand cursor
      this.initialize();
    }
  
    async initialize() {
      try {
        // Try to load the hand texture
        let handTexture = await this.loadHandTexture();
        
        // Create the hand sprite
        this.handSprite = new PIXI.Sprite(handTexture);
        this.handSprite.anchor.set(0.2, 0.2); // Set anchor near fingertip for better pointing
        this.handSprite.scale.set(0.7);
        this.handSprite.alpha = 0; // Start invisible
        
        this.container.addChild(this.handSprite);
        this.app.stage.addChild(this.container);
        
      } catch (error) {
        console.error("Failed to initialize hand cursor:", error);
        // If we failed to load the texture, create a fallback
        this.createFallbackHand();
      }
    }
    
    async loadHandTexture() {
      try {
        // Try to load the hand.webp texture
        return await this.assetLoader.loadTexture('assets/hand.webp');
      } catch (error) {
        console.warn("Could not load hand.webp, using fallback", error);
        return this.createFallbackHandTexture();
      }
    }
    
    createFallbackHandTexture() {
      // Create a graphics object for hand
      const graphics = new PIXI.Graphics();
      
      // Draw hand shape in skin tone
      graphics.beginFill(0xFFCCBB);
      graphics.drawEllipse(20, 30, 15, 25);  // Palm
      graphics.drawEllipse(20, 0, 8, 20);    // Finger
      graphics.endFill();
      
      // Draw blue sleeve
      graphics.beginFill(0x3366CC);
      graphics.drawRoundedRect(0, 50, 40, 20, 5);
      graphics.endFill();
      
      // Convert to texture using render texture instead of generateCanvasTexture
      const renderTexture = PIXI.RenderTexture.create({ width: 60, height: 80 });
      const renderer = PIXI.autoDetectRenderer();
      renderer.render(graphics, { renderTexture });
      
      return renderTexture;
    }
    
    createFallbackHand() {
      // Create a fallback hand if the asset fails to load
      const graphics = new PIXI.Graphics();
      
      // Draw hand shape in skin tone
      graphics.beginFill(0xFFCCBB);
      graphics.drawEllipse(20, 30, 15, 25);  // Palm
      graphics.drawEllipse(20, 0, 8, 20);    // Finger
      graphics.endFill();
      
      // Draw blue sleeve
      graphics.beginFill(0x3366CC);
      graphics.drawRoundedRect(0, 50, 40, 20, 5);
      graphics.endFill();
      
      this.handSprite = graphics;
      this.handSprite.alpha = 0;
      this.container.addChild(this.handSprite);
    }
    
    // Show hand at specific position
    showAt(x, y, rotation = 0) {
      if (!this.handSprite) return;
      
      // Reset any ongoing animations
      if (this.timeline) {
        this.timeline.kill();
      }
      
      this.handSprite.x = x;
      this.handSprite.y = y;
      this.handSprite.rotation = rotation;
      
      gsap.to(this.handSprite, {
        alpha: 1,
        duration: 0.3,
        ease: "power2.out"
      });
      
      this.isVisible = true;
    }
    
    // Hide the hand
    hide() {
      if (!this.handSprite || !this.isVisible) return;
      
      gsap.to(this.handSprite, {
        alpha: 0,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
          this.isVisible = false;
        }
      });
    }
    
    // Animate a drag from source to target
    animateDrag(fromX, fromY, toX, toY, options = {}) {
      if (!this.handSprite) return;
      
      const {
        duration = 1,
        onComplete = null,
        scale = 0.7,
        rotation = 0
      } = options;
      
      this.isAnimating = true;
      this.isVisible = true;
      
      // Create a GSAP timeline
      this.timeline = gsap.timeline({
        onComplete: () => {
          this.isAnimating = false;
          if (onComplete) onComplete();
        }
      });
      
      // Position at start
      this.handSprite.x = fromX;
      this.handSprite.y = fromY;
      this.handSprite.rotation = rotation;
      this.handSprite.scale.set(scale);
      this.handSprite.alpha = 0;
      
      // Animation sequence
      this.timeline
        // Fade in
        .to(this.handSprite, {
          alpha: 1,
          duration: 0.3,
          ease: "power2.out"
        })
        // "Press" effect
        .to(this.handSprite.scale, {
          x: scale * 0.9,
          y: scale * 0.9,
          duration: 0.2,
          ease: "power2.in"
        })
        // Move to destination
        .to(this.handSprite, {
          x: toX,
          y: toY,
          duration: duration,
          ease: "power1.inOut"
        })
        // "Release" effect
        .to(this.handSprite.scale, {
          x: scale,
          y: scale,
          duration: 0.2,
          ease: "back.out(1.5)"
        })
        // Pause briefly
        .to({}, { duration: 0.3 })
        // Fade out
        .to(this.handSprite, {
          alpha: 0,
          duration: 0.3,
          ease: "power2.in",
          onComplete: () => {
            this.isVisible = false;
          }
        });
      
      return this.timeline;
    }
    
    // Demonstrate a card move (show dragging from card to target)
    demonstrateCardMove(fromCardPosition, toPosition, options = {}) {
        const {
          waitBeforeStart = 0.5,
          dragDuration = 1,
          onComplete = null
        } = options;
        
        // Позиция подхода (немного смещена от карты)
        const approachX = fromCardPosition.x - 20;
        const approachY = fromCardPosition.y - 20;
        
        this.isAnimating = true;
        this.isVisible = true;
        
        // Создаем GSAP таймлайн
        this.timeline = gsap.timeline({
          onComplete: () => {
            this.isAnimating = false;
            if (onComplete) onComplete();
          }
        });
        
        // Последовательность анимации
        this.timeline
          // Установка начальной позиции
          .set(this.handSprite, {
            x: approachX - 50,
            y: approachY - 30,
            alpha: 0,
            rotation: -0.1
          })
          // Плавное появление
          .to(this.handSprite, {
            alpha: 1,
            duration: 0.3,
            ease: "power2.out"
          })
          // Ожидание
          .to({}, { duration: waitBeforeStart })
          // Движение к карте
          .to(this.handSprite, {
            x: approachX,
            y: approachY,
            duration: 0.5,
            ease: "power2.inOut"
          })
          // Эффект "нажатия"
          .to(this.handSprite.scale, {
            x: 0.65,
            y: 0.65,
            duration: 0.15,
            ease: "power2.in"
          })
          // Перемещение к точному положению карты
          .to(this.handSprite, {
            x: fromCardPosition.x,
            y: fromCardPosition.y,
            duration: 0.3,
            ease: "power2.inOut"
          })
          // Перетаскивание к месту назначения
          .to(this.handSprite, {
            x: toPosition.x,
            y: toPosition.y,
            duration: dragDuration,
            ease: "power1.inOut"
          })
          // Эффект "отпускания"
          .to(this.handSprite.scale, {
            x: 0.7,
            y: 0.7,
            duration: 0.2,
            ease: "back.out(1.5)"
          })
          // Ожидание
          .to({}, { duration: 0.5 })
          // Исчезновение
          .to(this.handSprite, {
            alpha: 0,
            duration: 0.3,
            ease: "power2.in",
            onComplete: () => {
              this.isVisible = false;
            }
          });
        
        return this.timeline;
      }
      
      // Обновление метода HandCursor.tap для более плавной анимации
      // Замените в HandCursor.js
      tap(x, y, options = {}) {
        const {
          duration = 0.8,
          scale = 0.7,
          onComplete = null
        } = options;
        
        this.isAnimating = true;
        this.isVisible = true;
        
        // Создаем GSAP таймлайн
        this.timeline = gsap.timeline({
          onComplete: () => {
            this.isAnimating = false;
            if (onComplete) onComplete();
          }
        });
        
        // Последовательность анимации
        this.timeline
          // Установка начальной позиции (немного выше цели)
          .set(this.handSprite, {
            x: x,
            y: y - 40,
            alpha: 0,
            scale: scale
          })
          // Плавное появление
          .to(this.handSprite, {
            alpha: 1,
            duration: 0.3,
            ease: "power2.out"
          })
          // Движение вниз (тап)
          .to(this.handSprite, {
            y: y,
            duration: 0.2,
            ease: "power2.in"
          })
          // Эффект нажатия
          .to(this.handSprite.scale, {
            x: scale * 0.8,
            y: scale * 0.8,
            duration: 0.1,
            ease: "power2.in"
          })
          // Эффект отпускания
          .to(this.handSprite.scale, {
            x: scale,
            y: scale,
            duration: 0.2,
            ease: "back.out(1.5)"
          })
          // Движение обратно вверх
          .to(this.handSprite, {
            y: y - 15,
            duration: 0.3,
            ease: "power2.out"
          })
          // Ожидание
          .to({}, { duration: 0.4 })
          // Исчезновение
          .to(this.handSprite, {
            alpha: 0,
            duration: 0.3,
            ease: "power2.in",
            onComplete: () => {
              this.isVisible = false;
            }
          });
        
        return this.timeline;
      }
    
    // Tap animation at specific position
    tap(x, y, options = {}) {
      const {
        duration = 0.8,
        scale = 0.7,
        onComplete = null
      } = options;
      
      this.isAnimating = true;
      this.isVisible = true;
      
      // Create a GSAP timeline
      this.timeline = gsap.timeline({
        onComplete: () => {
          this.isAnimating = false;
          if (onComplete) onComplete();
        }
      });
      
      // Animation sequence
      this.timeline
        // Set initial position (slightly above target)
        .set(this.handSprite, {
          x: x,
          y: y - 30,
          alpha: 0,
          scale: scale
        })
        // Fade in
        .to(this.handSprite, {
          alpha: 1,
          duration: 0.3,
          ease: "power2.out"
        })
        // Move down (tap)
        .to(this.handSprite, {
          y: y,
          duration: 0.2,
          ease: "power2.in"
        })
        // Press effect
        .to(this.handSprite.scale, {
          x: scale * 0.8,
          y: scale * 0.8,
          duration: 0.1,
          ease: "power2.in"
        })
        // Release effect
        .to(this.handSprite.scale, {
          x: scale,
          y: scale,
          duration: 0.2,
          ease: "back.out(1.5)"
        })
        // Move back up
        .to(this.handSprite, {
          y: y - 15,
          duration: 0.3,
          ease: "power2.out"
        })
        // Wait
        .to({}, { duration: 0.2 })
        // Fade out
        .to(this.handSprite, {
          alpha: 0,
          duration: 0.3,
          ease: "power2.in",
          onComplete: () => {
            this.isVisible = false;
          }
        });
      
      return this.timeline;
    }
  }