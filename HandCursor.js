export class HandCursor {
  constructor(app, assetLoader) {
    this.app = app;
    this.assetLoader = assetLoader;
    
        this.container = new PIXI.Container();
    this.container.interactive = false;   this.container.interactiveChildren = false;   this.container.visible = false;
  this.container.zIndex = 1000;
    
        this.init();
    
        this.app.stage.addChild(this.container);
  }
  
    init() {
        this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/hand.webp')
      .then(texture => {
                const handSprite = new PIXI.Sprite(texture);
        handSprite.anchor.set(0.2, 0.2);         handSprite.scale.set(0.7);
        
                this.container.addChild(handSprite);
      })
      .catch(err => {
        console.warn("Could not load hand cursor image, using fallback", err);
        
                const handGraphic = new PIXI.Graphics();
        
                handGraphic.beginFill(0xFFDDCC);         handGraphic.drawCircle(0, 0, 15);         handGraphic.drawRoundedRect(-5, -40, 10, 40, 5);         handGraphic.endFill();
        
                handGraphic.lineStyle(1, 0x000000, 0.5);
        handGraphic.drawCircle(0, 0, 15);
        handGraphic.drawRoundedRect(-5, -40, 10, 40, 5);
        
                handGraphic.rotation = -Math.PI / 2;
        
                this.container.addChild(handGraphic);
      });
  }
  
    show() {
    this.container.visible = true;
    this.container.alpha = 1;
  }
  
    hide() {
    this.container.visible = false;
  }
  
    moveBetween(x1, y1, x2, y2, options = {}) {
    const defaults = {
      cycles: 1,
      pauseDuration: 0.5,
      moveDuration: 1.0,
      onComplete: null
    };
    
    const settings = { ...defaults, ...options };
    
        this.showAt(x1, y1);
    
        const timeline = gsap.timeline({
      repeat: settings.cycles - 1,
      onComplete: () => {
        if (typeof settings.onComplete === 'function') {
          settings.onComplete();
        }
      }
    });
    
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
    
        timeline.to(this.container, {
      x: x1,
      y: y1,
      duration: settings.moveDuration,
      ease: "power2.inOut"
    });
    
    return timeline;
  }
  
    tap(x, y, options = {}) {
    const defaults = {
      scale: 0.9,
      duration: 0.2,
      repeat: 0,
      repeatDelay: 0.5,
      onComplete: null
    };
    
    const settings = { ...defaults, ...options };
    
        this.showAt(x, y);
    
        const timeline = gsap.timeline({
      repeat: settings.repeat,
      repeatDelay: settings.repeatDelay,
      onComplete: () => {
        if (typeof settings.onComplete === 'function') {
          settings.onComplete();
        }
      }
    });
    
        timeline.to(this.container.scale, {
      x: settings.scale,
      y: settings.scale,
      duration: settings.duration,
      ease: "power2.in"
    });
    
        timeline.to(this.container.scale, {
      x: 1,
      y: 1,
      duration: settings.duration,
      ease: "power2.out"
    });
    
    return timeline;
  }
  
    fade(duration = 0.5) {
    gsap.to(this.container, {
      alpha: 0,
      duration: duration,
      ease: "power2.out",
      onComplete: () => {
        this.hide();
        this.container.alpha = 1;       }
    });
  }
  
    showAt(x, y) {
    this.container.x = x;
    this.container.y = y;
    this.container.visible = true;
    this.container.alpha = 1;
  }

    demonstrateCardMove(start, end, options = {}) {
    const {
      travelTime = 1.2,
      startDelay = 0.2,
      dragDuration = 1.0,
      onComplete = null
    } = options;
    
        this.container.visible = true;
    
        this.container.x = start.x;
    this.container.y = start.y;
    this.container.alpha = 0;
    
        const timeline = gsap.timeline({
      onComplete: () => {
        this.fade();
        if (onComplete) onComplete();
      }
    });
    
        timeline.to(this.container, {
      alpha: 1,
      duration: 0.3,
      ease: "power1.out"
    });
    
        timeline.to(this.container.scale, {
      x: 0.9,
      y: 0.9,
      duration: 0.2,
      ease: "power2.in"
    }, "+=0.2");
    
        timeline.to(this.container, {
      x: end.x,
      y: end.y,
      duration: dragDuration,       ease: "power1.inOut"
    }, "+=0.1");
    
        timeline.to(this.container.scale, {
      x: 1.0,
      y: 1.0,
      duration: 0.15,
      ease: "power2.out"
    }, ">");
    
        timeline.to(this.container, {
      alpha: 0,
      duration: 0.3,
      delay: 0.2,
      ease: "power1.in"
    });
  }
  
    animateCardSelection(cardPosition, duration = 1.0) {
        const startX = cardPosition.x;
    const startY = cardPosition.y - 50;
    
    this.showAt(startX, startY);
    
        const timeline = gsap.timeline({
      onComplete: () => {
        this.fade();
      }
    });
    
        timeline.to(this.container, {
      y: cardPosition.y,
      duration: duration / 2,
      ease: "power2.inOut"
    });
    
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
    
        timeline.to({}, {
      duration: 0.2
    });
    
        timeline.to(this.container, {
      y: startY,
      duration: duration / 2,
      ease: "power2.inOut"
    });
    
    return timeline;
  }
}