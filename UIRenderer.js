export class UIRenderer {
  constructor(app, assetLoader, config) {
      this.app         = app;
      this.assetLoader = assetLoader;
      this.config      = config;
    
      // базовая ширина, при которой кнопки были созданы
      this.designWidth = 390;
    
    // UI containers
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
    
    this.adContainer = new PIXI.Container();
    this.topNavContainer = new PIXI.Container();
    this.bannerContainer = new PIXI.Container();
    this.uiButtonsContainer = new PIXI.Container();
    this.deadwoodContainer = new PIXI.Container();
    this.dialogContainer = new PIXI.Container();
    this.scoreDisplayContainer = new PIXI.Container();

    // Инициализируем avatarsContainer явно
  this.avatarsContainer = new PIXI.Container();
  this.avatarsContainer.zIndex = 5;
    
    // UI dimensions
    this.adHeight = 0;
    this.navHeight = 0;
    this.bannerHeight = 0;
    
    // UI components
    this.knockButton = null;
    this.meldButton = null;
    this.ginButton = null;
    this.onGinClick = null;
    this.deadwoodText = null;
    this.blueScoreText = null;
    this.redScoreText = null;
    
    
    // Event callbacks
    this.onKnockClick = null;
    this.onMeldClick = null;
    
    // Initialize
    this.init();
  }
  
  init() {
    // Set z-index for proper layering inside UI renderer
    this.adContainer.zIndex = 101;
    this.topNavContainer.zIndex = 101;
    this.bannerContainer.zIndex = 99;
    this.uiButtonsContainer.zIndex = 101;
    this.deadwoodContainer.zIndex = 104;
    this.dialogContainer.zIndex = 200;
    this.scoreDisplayContainer.zIndex = 101;

    // Важное изменение: НЕ добавляем avatarsContainer в this.container
    // this.container.addChild(this.avatarsContainer);
    
    // Add all UI-related containers to the main container of UI renderer.
    this.container.addChild(this.adContainer);
    this.container.addChild(this.topNavContainer);
    this.container.addChild(this.bannerContainer);
    this.container.addChild(this.uiButtonsContainer);
    this.container.addChild(this.dialogContainer);
    this.container.addChild(this.scoreDisplayContainer);

    // Hide dialog by default
    this.dialogContainer.visible = false;
}
  
  // Setup all UI components
  async setupUI() {
    await this.setupGameActions();
    await this.setupAvatars();
    
    // Добавляем отображение deadwood
    this.setupDeadwoodDisplay();
  }

  async setupTopBanner() {
      try {
        const texture = await this.assetLoader.loadTexture('assets/TopBanner.webp');
        const banner  = new PIXI.Sprite(texture);
    
        // Во всю ширину, высоту считаем по пропорции
        banner.originalAspect = texture.height / texture.width;
        banner.width  = this.app.screen.width;
        banner.height = this.app.screen.width * banner.originalAspect;
        banner.x = 0;
        banner.y = 0;
    
        this.bannerContainer.removeChildren();
        this.bannerContainer.addChild(banner);
        this.bannerHeight = banner.height;
        return banner;
      } catch (e) {
        console.warn('Fallback TopBanner', e);
        const g = new PIXI.Graphics();
        g.beginFill(0x0B5D2E);
        g.drawRect(0, 0, this.app.screen.width, 60);
        g.endFill();
        this.bannerContainer.addChild(g);
        this.bannerHeight = 60;
        return g;
      }
    }

    async setupAvatars() {
      try {
        // Load textures for avatars
        const [blueTex, redTex] = await Promise.all([
          this.assetLoader.loadTexture("assets/blue_avatar.webp"),
          this.assetLoader.loadTexture("assets/red_avatar.webp"),
        ]);
      
        // Create avatar sprites
        this.blueAvatar = new PIXI.Sprite(blueTex);
        this.redAvatar = new PIXI.Sprite(redTex);
      
        // Set anchor to the center for proper positioning
        this.blueAvatar.anchor.set(0.5);
        this.redAvatar.anchor.set(0.5);
      
        // Set initial scale
        this.blueAvatar.scale.set(0.2);
        this.redAvatar.scale.set(0.2);
      
        // Position avatars based on screen height
        // For iPhone SE (height < 667px), position avatars closer to the table
        if (this.app.screen.height < 667) {
          // Closer to the table positions for smaller screens
          this.redAvatar.y = this.app.screen.height * 0.30;  // Move red avatar down closer to table
          this.blueAvatar.y = this.app.screen.height * 0.65; // Move blue avatar up closer to table
        } else {
          // Default positions for regular screens
          this.redAvatar.y = this.app.screen.height * 0.23;
          this.blueAvatar.y = this.app.screen.height * 0.7;
        }
        
        // Center horizontally
        this.redAvatar.x = this.app.screen.width / 2;
        this.blueAvatar.x = this.app.screen.width / 2;
      
        // Add avatars to the avatars container inside UI renderer
        this.avatarsContainer.addChild(this.blueAvatar);
        this.avatarsContainer.addChild(this.redAvatar);
      } catch (err) {
        console.warn("Could not load avatars", err);
      }
      }

  
  // Setup score display
  async setupScoreDisplay() {
    const scoreContainer = new PIXI.Container();
    
    // Background
    const bgGraphics = new PIXI.Graphics();
    bgGraphics.lineStyle(2, 0x000000, 0.5);
    bgGraphics.beginFill(0x0B5D2E);
    bgGraphics.drawRoundedRect(0, 0, 250, 60, 20);
    bgGraphics.endFill();
    
    try {
      // Target icon
      const targetIcon = new PIXI.Graphics();
      targetIcon.beginFill(0xFFFDE7);
      targetIcon.drawCircle(0, 0, 15);
      targetIcon.endFill();
      
      // Target details
      targetIcon.lineStyle(2, 0x0B5D2E);
      targetIcon.drawCircle(0, 0, 12);
      targetIcon.drawCircle(0, 0, 8);
      targetIcon.drawCircle(0, 0, 4);
      
      // Arrow
      targetIcon.lineStyle(2, 0xFFFDE7);
      targetIcon.moveTo(0, -18);
      targetIcon.lineTo(0, -25);
      targetIcon.moveTo(-3, -22);
      targetIcon.lineTo(0, -25);
      targetIcon.lineTo(3, -22);
      
      targetIcon.x = 35;
      targetIcon.y = 30;
      
      // Target score text
      const targetText = new PIXI.Text("100", {
        fontFamily: "Arial",
        fontSize: 28,
        fontWeight: "bold",
        fill: 0xFFFDE7
      });
      targetText.anchor.set(0.5);
      targetText.x = 85;
      targetText.y = 30;
      
      // Score boxes
      const blueBox = new PIXI.Graphics();
      blueBox.beginFill(0x3366FF);
      blueBox.drawRect(120, 10, 60, 40);
      blueBox.endFill();
      
      const redBox = new PIXI.Graphics();
      redBox.beginFill(0xE91E63);
      redBox.drawRect(180, 10, 60, 40);
      redBox.endFill();
      
      // Score texts
      this.blueScoreText = new PIXI.Text("0", {
        fontFamily: "Arial",
        fontSize: 28,
        fontWeight: "bold",
        fill: 0xFFFFFF
      });
      this.blueScoreText.anchor.set(0.5);
      this.blueScoreText.x = 150;
      this.blueScoreText.y = 30;
      
      this.redScoreText = new PIXI.Text("0", {
        fontFamily: "Arial",
        fontSize: 28,
        fontWeight: "bold",
        fill: 0xFFFFFF
      });
      this.redScoreText.anchor.set(0.5);
      this.redScoreText.x = 210;
      this.redScoreText.y = 30;
      
      // Add all elements to container
      scoreContainer.addChild(bgGraphics);
      scoreContainer.addChild(targetIcon);
      scoreContainer.addChild(targetText);
      scoreContainer.addChild(blueBox);
      scoreContainer.addChild(redBox);
      scoreContainer.addChild(this.blueScoreText);
      scoreContainer.addChild(this.redScoreText);
    } catch (err) {
      console.warn("Using fallback score display");
      // Fallback score display
      const scoreText = new PIXI.Text("Target: 100   Score: 0 - 0", {
        fontFamily: "Arial",
        fontSize: 20,
        fontWeight: "bold",
        fill: 0xFFFFFF
      });
      scoreText.anchor.set(0.5);
      scoreText.x = 125;
      scoreText.y = 30;
      scoreContainer.addChild(scoreText);
    }
    
    // Position score container
    scoreContainer.x = (this.app.screen.width - 250) / 2;
    scoreContainer.y = this.adHeight + 10;
    
    this.scoreDisplayContainer.removeChildren();
    this.scoreDisplayContainer.addChild(scoreContainer);
    
    return scoreContainer;
  }
  
  // Setup game buttons (settings and new game)
  async setupGameButtons() {
    try {
      // Settings button
      const settingsButton = await this.createButton('assets/settingsButton.webp', 'settings');
      settingsButton.x = this.app.screen.width - 90;
      settingsButton.y = 60;
      
      // New game button
      const addButton = await this.createButton('assets/newGameButton.webp', 'addNew');
      addButton.x = this.app.screen.width - 30;
      addButton.y = 90;
      
      this.uiButtonsContainer.addChild(settingsButton);
      this.uiButtonsContainer.addChild(addButton);
      
      return true;
    } catch (err) {
      console.warn("Failed to set up game buttons");
      return false;
    }
  }
  
  // Create button helper
  // Create button helper (полностью заменить старую функцию)
async createButton(texturePath, type) {
  try {
    // основная попытка загрузить PNG‑иконку
    const texture = await this.assetLoader.loadTexture(texturePath);
    const button  = new PIXI.Sprite(texture);

    // базовый размер, нужен для масштабирования в resize()
    button.baseSize = 55;
    button.width    = button.height = button.baseSize;

    button.anchor.set(0.5);
    button.interactive = true;
    button.buttonMode  = true;
    button.buttonType  = type;

    // обработчики кликов
    if (type === 'settings') {
      button.on('pointerdown', () => console.log('Settings button clicked'));
    } else if (type === 'addNew') {
      button.on('pointerdown', () => console.log('Add new button clicked'));
    } else if (type === 'lightbulb') {
      button.on('pointerdown', () => console.log('Lightbulb button clicked'));
    }

    return button;
  } catch (err) {
    // fallback‑кнопка, если PNG не загрузился
    console.warn(`Creating fallback button for ${type}`, err);

    const fallback = new PIXI.Graphics();
    fallback.baseSize   = 55;              // чтобы тоже масштабировалась
    fallback.buttonType = type;
    fallback.interactive = true;
    fallback.buttonMode  = true;

    fallback.beginFill(0x006400);
    fallback.drawCircle(0, 0, 27);
    fallback.endFill();

    if (type === 'settings') {
      fallback.lineStyle(3, 0xFFFFFF);
      fallback.drawCircle(0, 0, 15);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        fallback.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
        fallback.lineTo(Math.cos(a) * 25, Math.sin(a) * 25);
      }
    } else if (type === 'addNew') {
      fallback.lineStyle(4, 0xFFFFFF);
      fallback.moveTo(-15, 0); fallback.lineTo(15, 0);
      fallback.moveTo(0, -15); fallback.lineTo(0, 15);
    } else if (type === 'lightbulb') {
      fallback.lineStyle(2, 0xFFFFFF);
      fallback.drawCircle(0, -5, 10);
      fallback.moveTo(-5, 5);  fallback.lineTo(5, 5);
      fallback.moveTo(-3, 10); fallback.lineTo(3, 10);
    }

    return fallback;
  }
}

async setupGinButton() {
  // Create the Gin button using the provided asset
  this.ginButton = new PIXI.Container();
  this.ginButton.interactive = true;
  this.ginButton.buttonMode = true;
  
  
  // Load the Gin button texture
  this.assetLoader.loadTexture('assets/Gin_button.webp')
    .then(texture => {
      const ginButtonSprite = new PIXI.Sprite(texture);
      ginButtonSprite.anchor.set(0.5);
      this.ginButton.addChild(ginButtonSprite);
    })
    .catch(err => {
      console.warn("Could not load Gin button asset, using fallback", err);
      // Fallback if asset loading fails
      const ginBg = new PIXI.Graphics();
      ginBg.beginFill(0x2196F3); // Blue color
      ginBg.drawRoundedRect(-60, -20, 120, 40, 10);
      ginBg.endFill();
      
      const ginText = new PIXI.Text("GIN", {
        fontFamily: "Arial",
        fontSize: 20,
        fontWeight: "bold",
        fill: 0xFFFFFF
      });
      ginText.anchor.set(0.5);
      
      this.ginButton.addChild(ginBg);
      this.ginButton.addChild(ginText);
    });
  
  // Position button in the center of the screen at card level, like in the reference screenshot
  this.ginButton.x = this.app.screen.width / 2; // Slight offset to the left for the Gin button
  this.ginButton.y = this.app.screen.height * 0.70; // Position at the level of player's cards
  
  // Initially hide the button
  this.ginButton.visible = false;
  
  // Add click handler
  this.ginButton.on('pointerdown', () => {
    this.showPlayNowOverlay();
  });
  
  // Add button to UI container
  this.uiButtonsContainer.addChild(this.ginButton);
}

async setupKnockButton() {
  // Создаем контейнер для кнопки Knock
  this.knockButton = new PIXI.Container();
  this.knockButton.interactive = true;
  this.knockButton.buttonMode = true;
  
  // Пытаемся загрузить внешний ресурс для кнопки Knock (если есть ассет, например, 'assets/Knock_button.webp')
  this.assetLoader.loadTexture('assets/Knock_button.webp')
    .then(texture => {
      // Если ассет успешно загружен – создаем спрайт с нужным якорем
      const knockButtonSprite = new PIXI.Sprite(texture);
      knockButtonSprite.anchor.set(0.5);
      this.knockButton.addChild(knockButtonSprite);
    })
    .catch(err => {
      console.warn("Не удалось загрузить ассет Knock, используется fallback", err);
      // Если ассет не загружен – создаем альтернативную графику
      const knockBg = new PIXI.Graphics();
      // Выбираем, например, насыщенный оранжевый цвет (можно поменять под стиль игры)
      knockBg.beginFill(0xFF5722);
      knockBg.drawRoundedRect(-60, -20, 120, 40, 10);
      knockBg.endFill();

      const knockText = new PIXI.Text("KNOCK", {
        fontFamily: "Arial",
        fontSize: 20,
        fontWeight: "bold",
        fill: 0xFFFFFF
      });
      knockText.anchor.set(0.5);
      
      this.knockButton.addChild(knockBg);
      this.knockButton.addChild(knockText);
    });
  
  // Позиционирование кнопки – подберите координаты согласно правилам игры (пример: справа от центра, на уровне карт)
  this.knockButton.x = this.app.screen.width / 2; // смещение вправо, можно корректировать
  this.knockButton.y = this.app.screen.height * 0.70;    // по уровню игрока (как у Gin кнопки)
  this.knockButton.visible = false;  // изначально скрыта
  
  // Добавляем тот же обработчик клика – по клику запускается PlayNowOverlay
  this.knockButton.on('pointerdown', () => {
    this.showPlayNowOverlay();
  });
  
  // Добавляем кнопку в контейнер UI кнопок (на уровне других кнопок)
  this.uiButtonsContainer.addChild(this.knockButton);
}
  
  // Add this method to UIRenderer.js class
  showGinButton(visible) {
    if (!this.ginButton) {
      // Create the button if it doesn't exist yet
      this.ginButton = new PIXI.Container();
      this.ginButton.interactive = true;
      this.ginButton.buttonMode = true;
      
      // Try to load the Gin button texture
      this.assetLoader.loadTexture('assets/Gin_button.webp')
        .then(texture => {
          const ginButtonSprite = new PIXI.Sprite(texture);
          ginButtonSprite.anchor.set(0.5);
          this.ginButton.addChild(ginButtonSprite);
        })
        .catch(err => {
          console.warn("Could not load Gin button asset, using fallback", err);
          const ginBg = new PIXI.Graphics();
          ginBg.beginFill(0x2196F3); // Blue color
          ginBg.drawRoundedRect(-60, -20, 120, 40, 10);
          ginBg.endFill();
          
          const ginText = new PIXI.Text("GIN", {
            fontFamily: "Arial",
            fontSize: 20,
            fontWeight: "bold",
            fill: 0xFFFFFF
          });
          ginText.anchor.set(0.5);
          
          this.ginButton.addChild(ginBg);
          this.ginButton.addChild(ginText);
        });
      
      // CRITICAL: Remove all old listeners before adding new one
      this.ginButton.removeAllListeners('pointerdown');
      
      // Add click handler that hides button first, then shows overlay
      this.ginButton.on('pointerdown', () => {
        // Stop all animations immediately
        gsap.killTweensOf(this.ginButton);
        gsap.killTweensOf(this.ginButton.scale);
        
        // Hide button with quick fade-out
        gsap.to(this.ginButton, {
          alpha: 0,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => {
            // Hide the button completely
            this.ginButton.visible = false;
            
            // Show play now overlay
            this.showPlayNowOverlay();
          }
        });
      });
      
      // Add to UI container if not already added
      if (!this.uiButtonsContainer.children.includes(this.ginButton)) {
        this.uiButtonsContainer.addChild(this.ginButton);
      }
    }
    
    // Always position at center of screen, slightly to the left
    this.ginButton.x = this.app.screen.width / 2;
    this.ginButton.y = this.app.screen.height / 2;
    
    if (visible && !this.ginButton.visible) {
      // Show button with animation
      this.ginButton.visible = true;
      this.ginButton.alpha = 0;
      
      // Fade in animation
      gsap.to(this.ginButton, {
        alpha: 1,
        duration: 0.3,
        ease: "back.out"
      });
      
      // Subtle float animation
      gsap.to(this.ginButton, {
        y: this.ginButton.y - 5,
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
      
      // Subtle pulse animation
      gsap.to(this.ginButton.scale, {
        x: 1.05, y: 1.05,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    } else if (!visible && this.ginButton.visible) {
      // Stop all animations
      gsap.killTweensOf(this.ginButton);
      gsap.killTweensOf(this.ginButton.scale);
      
      // Hide button with animation
      gsap.to(this.ginButton, {
        alpha: 0,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
          this.ginButton.visible = false;
        }
      });
    }
  }
  

  showPlayNowOverlay() {
    // Hide tutorial elements directly instead of calling hideTutorialElements
    // Find and remove any tutorial text containers from stage
    if (this.app && this.app.stage) {
      // Look through all stage children
      for (let i = this.app.stage.children.length - 1; i >= 0; i--) {
        const child = this.app.stage.children[i];
        // Check if this is a container with tutorial text
        if (child && child.children) {
          const hasTutorialText = child.children.some(grandchild => 
            grandchild instanceof PIXI.Text && 
            grandchild.text && 
            (grandchild.text.includes("Take a card") || 
             grandchild.text.includes("Deck or") ||
             grandchild.text.includes("shown card"))
          );
          
          // If it has tutorial text, remove it
          if (hasTutorialText) {
            this.app.stage.removeChild(child);
          }
        }
      }
    }
    
    // Also reset tutorial flags
    this.takeCardTutorialShown = false;
    
    // Make sure buttons are hidden
    if (this.knockButton && this.knockButton.visible) {
      this.showKnockButton(false);
    }
    
    if (this.ginButton && this.ginButton.visible) {
      this.showGinButton(false);
    }
    
    // Create overlay container with high z-index
    const overlayContainer = new PIXI.Container();
    overlayContainer.zIndex = 1000;
    
    // Semi-transparent background
    const background = new PIXI.Graphics();
    background.beginFill(0x000000, 0.2);
    background.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    background.endFill();
    overlayContainer.addChild(background);
    
    // Try to load the logo
    this.assetLoader.loadTexture('assets/playNow.webp')
      .then(texture => {
        const logo = new PIXI.Sprite(texture);
        logo.anchor.set(0.5);
        logo.x = this.app.screen.width / 2;
        logo.y = this.app.screen.height / 2;
        logo.alpha = 0; // Start with alpha 0 for fade-in
        overlayContainer.addChild(logo);
        
        // Make interactive for click to open URL
        overlayContainer.interactive = true;
        overlayContainer.buttonMode = true;
        overlayContainer.on('pointerdown', () => {
          window.open('https://apps.apple.com/app/gin-rummy-stars-card-game/id1467143758', '_blank');
          this.app.stage.removeChild(overlayContainer);
        });
        
        // Add the overlay to stage first
        this.app.stage.addChild(overlayContainer);
        
        // НОВАЯ АНИМАЦИЯ: аналогичная кнопкам knock/gin
        
        // Fade in animation
        gsap.to(logo, {
          alpha: 1,
          duration: 0.3,
          ease: "back.out"
        });
        
        // Subtle float animation
        gsap.to(logo, {
          y: logo.y - 5,
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
        
        // Subtle pulse animation
        gsap.to(logo.scale, {
          x: 1.05, y: 1.05,
          duration: 1.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
      })
      .catch(error => {
        console.warn("Error loading playNow logo:", error);
        
        // Fallback text
        const fallbackText = new PIXI.Text("PLAY NOW!", {
          fontFamily: "Arial",
          fontSize: 48,
          fontWeight: "bold",
          fill: 0xFFFFFF,
          stroke: 0x000000,
          strokeThickness: 6,
          align: "center"
        });
        
        fallbackText.anchor.set(0.5);
        fallbackText.x = this.app.screen.width / 2;
        fallbackText.y = this.app.screen.height / 2;
        fallbackText.alpha = 0; // Start with alpha 0 for fade-in
        overlayContainer.addChild(fallbackText);
        
        // Make interactive
        overlayContainer.interactive = true;
        overlayContainer.buttonMode = true;
        overlayContainer.on('pointerdown', () => {
          window.open('https://apps.apple.com/app/gin-rummy-stars-card-game/id1467143758', '_blank');
          this.app.stage.removeChild(overlayContainer);
        });
        
        // Add the overlay to stage
        this.app.stage.addChild(overlayContainer);
        
        // НОВАЯ АНИМАЦИЯ для fallback текста
        
        // Fade in animation
        gsap.to(fallbackText, {
          alpha: 1,
          duration: 0.3,
          ease: "back.out"
        });
        
        // Subtle float animation
        gsap.to(fallbackText, {
          y: fallbackText.y - 5,
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
        
        // Subtle pulse animation
        gsap.to(fallbackText.scale, {
          x: 1.05, y: 1.05,
          duration: 1.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
      });
    
    return overlayContainer;
  }
  
  // Setup game actions (knock and meld buttons)
  async setupGameActions() {
    // Создаем кнопки, но не добавляем их в контейнер
    this.knockButton = new PIXI.Container();
    this.onGinClick = null;
    this.meldButton = new PIXI.Container();
    
    // Установим visible = false для обеих кнопок
    this.knockButton.visible = false;
    this.meldButton.visible = false;
    
    
    this.meldButton.on('pointerdown', () => {
      if (this.onMeldClick) this.onMeldClick();
    });
    
    // Кнопки не добавляются в this.uiButtonsContainer
    // this.uiButtonsContainer.addChild(this.knockButton);
    // this.uiButtonsContainer.addChild(this.meldButton);
    
    // Если необходимо вызвать setupGinButton, оставьте эту строку
    await this.setupGinButton();
    await this.setupKnockButton();
  }
  
  createMeldDisplay() {
    // Create container for meld displays
    const meldContainer = new PIXI.Container();
    meldContainer.zIndex = 100;
    
    // Container for RUN! display
    const runDisplay = new PIXI.Container();
    runDisplay.visible = false;
    
    // RUN! text
    const runText = new PIXI.Text("RUN!", {
      fontFamily: "Arial",
      fontSize: 64,
      fontWeight: "bold",
      fill: ["#ffffff", "#a0ffa0"], // Gradient fill for Run (green tint)
      stroke: "#000000",
      strokeThickness: 6,
      dropShadow: true,
      dropShadowColor: "#000000",
      dropShadowBlur: 4,
      dropShadowDistance: 6
    });
    runText.anchor.set(0.5);
    runText.x = 0;
    runText.y = 0;
    runDisplay.addChild(runText);
    
    // Container for SET! display
    const setDisplay = new PIXI.Container();
    setDisplay.visible = false;
    
    // SET! text
    const setText = new PIXI.Text("SET!", {
      fontFamily: "Arial",
      fontSize: 64,
      fontWeight: "bold",
      fill: ["#ffffff", "#ffff80"], // Gradient fill for Set (yellow tint)
      stroke: "#000000",
      strokeThickness: 6,
      dropShadow: true,
      dropShadowColor: "#000000",
      dropShadowBlur: 4,
      dropShadowDistance: 6
    });
    setText.anchor.set(0.5);
    setText.x = 0;
    setText.y = 0;
    setDisplay.addChild(setText);
    
    // Add displays to container
    meldContainer.addChild(runDisplay);
    meldContainer.addChild(setDisplay);
    
    // Position at the bottom center
    meldContainer.x = this.app.screen.width / 2;
    meldContainer.y = this.app.screen.height * 0.65;
    
    // Add to main container
    this.container.addChild(meldContainer);
    
    // Store references
    this.meldContainer = meldContainer;
    this.runDisplay = runDisplay;
    this.setDisplay = setDisplay;
    
    return meldContainer;
  }

  // Show dialog
  showDialog(message) {
    this.dialogContainer.removeChildren();
    
    // Dialog background
    const dialogBg = new PIXI.Graphics();
    dialogBg.beginFill(0xFFF8E1, 0.9);
    dialogBg.drawRoundedRect(0, 0, 350, 100, 20);
    dialogBg.endFill();
    
    // Arrow pointer
    dialogBg.beginFill(0xFFFBF0, 0.9);
dialogBg.moveTo(175, 120); // Вершина треугольника внизу по центру
dialogBg.lineTo(155, 100); // Левый верхний угол
dialogBg.lineTo(195, 100); // Правый верхний угол
dialogBg.closePath();
dialogBg.endFill();
    
    // Dialog text
    const dialogText = new PIXI.Text(message, {
      fontFamily: "Arial",
      fontSize: 20,
      fontWeight: "bold",
      fill: 0x4E342E,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 330
    });
    dialogText.anchor.set(0.5);
    dialogText.x = 175;
    dialogText.y = 45;
    
    dialogBg.addChild(dialogText);
    
    // Position dialog
    dialogBg.x = (this.app.screen.width - 350) / 2;
    dialogBg.y = (this.app.screen.height / 2) + 75;
    
    this.dialogContainer.addChild(dialogBg);
    this.dialogContainer.visible = true;
    
    return dialogBg;
  }
  
  // Hide dialog
  hideDialog() {
    this.dialogContainer.visible = false;
  }
  
  // Update scores
  updateScores(playerScore, opponentScore) {
    if (this.blueScoreText) {
      this.blueScoreText.text = playerScore.toString();
    }
    if (this.redScoreText) {
      this.redScoreText.text = opponentScore.toString();
    }
  }
  
  // Update deadwood
  updateDeadwood(value) {
    if (!this.deadwoodText) return;
    
    // Обновляем текст со значением deadwood
    this.deadwoodText.text = value.toString();
    
    // Добавляем цветовую индикацию
    if (value < 10) {
      // Зеленый - можно делать knock
      this.deadwoodText.style.fill = 0x4CAF50;
    } else {
      // Белый - обычное состояние
      this.deadwoodText.style.fill = 0xFFFFFF;
    }
    
    // Анимация пульсации при низком значении deadwood
    if (value < 10) {
      gsap.to(this.deadwoodText.scale, {
        x: 1.2, y: 1.2,
        duration: 0.5,
        repeat: 1,
        yoyo: true,
        ease: "power1.inOut"
      });
    }
  }

  showKnockButton(visible) {
    // Вспомогательная функция для логирования операций с кнопкой Knock
    const logKnockButtonState = (action) => {
      console.log(`KNOCK Button ${action} - visible: ${visible}`);
    };
  
    if (!this.knockButton) {
      // Create the button if it doesn't exist yet
      logKnockButtonState("initializing");
      this.knockButton = new PIXI.Container();
      this.knockButton.interactive = true;
      this.knockButton.buttonMode = true;
      
      // Try to load the Knock button texture
      this.assetLoader.loadTexture('assets/Knock_button.webp')
        .then(texture => {
          const knockButtonSprite = new PIXI.Sprite(texture);
          knockButtonSprite.anchor.set(0.5);
          this.knockButton.addChild(knockButtonSprite);
          logKnockButtonState("texture loaded");
        })
        .catch(err => {
          console.warn("Could not load Knock button asset, using fallback", err);
          const knockBg = new PIXI.Graphics();
          knockBg.beginFill(0xFF5722); // Orange color
          knockBg.drawRoundedRect(-60, -20, 120, 40, 10);
          knockBg.endFill();
          
          const knockText = new PIXI.Text("KNOCK", {
            fontFamily: "Arial",
            fontSize: 20,
            fontWeight: "bold",
            fill: 0xFFFFFF
          });
          knockText.anchor.set(0.5);
          
          this.knockButton.addChild(knockBg);
          this.knockButton.addChild(knockText);
          logKnockButtonState("fallback created");
        });
      
      // CRITICAL: Remove all old listeners before adding new one
      this.knockButton.removeAllListeners('pointerdown');
      
      // Add click handler that hides button first, then shows overlay
      this.knockButton.on('pointerdown', () => {
        logKnockButtonState("clicked");
        // Stop all animations immediately
        gsap.killTweensOf(this.knockButton);
        gsap.killTweensOf(this.knockButton.scale);
        
        // Hide button with quick fade-out
        gsap.to(this.knockButton, {
          alpha: 0,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => {
            // Hide the button completely
            this.knockButton.visible = false;
            
            // Show play now overlay
            this.showPlayNowOverlay();
          }
        });
      });
      
      // Add to UI container if not already added
      if (!this.uiButtonsContainer.children.includes(this.knockButton)) {
        this.uiButtonsContainer.addChild(this.knockButton);
        logKnockButtonState("added to container");
      }
    }
    
    // Явно устанавливаем позицию кнопки - всегда в центре экрана,
    // немного ниже середины (чтобы была хорошо видна при deadwood <= 10)
    this.knockButton.x = this.app.screen.width / 2;
    this.knockButton.y = this.app.screen.height * 0.7; // Позиционируем кнопку на 70% высоты экрана
    
    // Принудительно применяем видимость в зависимости от параметра
    this.knockButton.visible = visible;
    
    if (visible && this.knockButton.alpha !== 1) {
      // Логирование и отладка
      logKnockButtonState("showing with animation");
      
      // Reset alpha to ensure button is visible
      this.knockButton.alpha = 0;
      
      // Fade in animation
      gsap.to(this.knockButton, {
        alpha: 1,
        duration: 0.3,
        ease: "back.out"
      });
      
      // Subtle float animation
      gsap.to(this.knockButton, {
        y: this.knockButton.y - 5,
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
      
      // Subtle pulse animation
      gsap.to(this.knockButton.scale, {
        x: 1.05, y: 1.05,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    } else if (!visible && this.knockButton.visible) {
      // Логирование и отладка
      logKnockButtonState("hiding with animation");
      
      // Stop all animations
      gsap.killTweensOf(this.knockButton);
      gsap.killTweensOf(this.knockButton.scale);
      
      // Hide button with animation
      gsap.to(this.knockButton, {
        alpha: 0,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
          this.knockButton.visible = false;
          logKnockButtonState("hidden completely");
        }
      });
    }
  }

  setupDeadwoodDisplay() {
    const deadwoodContainer = new PIXI.Container();
    
    // Фон для отображения deadwood
    const bg = new PIXI.Graphics();
    bg.beginFill(0x333333, 0.7);
    bg.drawRoundedRect(0, 0, 150, 50, 15);
    bg.endFill();
    
    // Текст заголовка
    const titleText = new PIXI.Text("Deadwood:", {
      fontFamily: "Arial",
      fontSize: 16,
      fill: 0xFFFFFF,
      fontWeight: "bold"
    });
    titleText.position.set(10, 8);
    
    // Значение deadwood
    this.deadwoodText = new PIXI.Text("0", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xFFFFFF,
      fontWeight: "bold"
    });
    this.deadwoodText.position.set(75, 28);
    this.deadwoodText.anchor.set(0.5, 0.5);
    
    // Добавляем все элементы в контейнер
    deadwoodContainer.addChild(bg);
    deadwoodContainer.addChild(titleText);
    deadwoodContainer.addChild(this.deadwoodText);
    
    // Позиционируем контейнер
    deadwoodContainer.x = this.app.screen.width - 170;
    deadwoodContainer.y = 100;
    
    this.deadwoodContainer.addChild(deadwoodContainer);
    return deadwoodContainer;
  }
  
  
  // Empty implementation of updateGameLog that does nothing
  updateGameLog(entries) {
    // Intentionally left empty - game log has been removed
  }
  
  // Resize UI elements
  resize(width, height) {
      const scale = width / this.designWidth;
      // --- TopBanner во всю ширину ---
      if (this.bannerContainer.children[0]) {
        const topBanner = this.bannerContainer.children[0];
        if (topBanner.originalAspect) {
          topBanner.width  = width;
          topBanner.height = width * topBanner.originalAspect;
          topBanner.x = 0;
          topBanner.y = 0;
          this.bannerHeight = topBanner.height;
        }
      }
    
      // --- Ad banner ---
if (this.adContainer.children[0]) {
  const adBanner = this.adContainer.children[0];
  if (adBanner.originalAspect) {
    adBanner.width  = width * 0.8;
    adBanner.height = adBanner.width * adBanner.originalAspect;

    // Центрируем по горизонтали
    adBanner.x = (width - adBanner.width) / 2;
    // У верхнего края экрана
    adBanner.y = 0;

    this.adHeight = adBanner.height;
  }
}

    
      // Top navigation (не трогаем, если не нужно)
      if (this.topNavContainer.children[0]) {
        const navBar = this.topNavContainer.children[0];
        if (navBar.originalAspect) {
          navBar.width  = width;
          navBar.height = width * navBar.originalAspect;
          navBar.x = 0;
          navBar.y = this.adHeight;
          this.navHeight = navBar.height;
        }
      }
    
      // --- Score display (занимаем треть ширины) ---
      if (this.scoreDisplayContainer.children[0]) {
        const scoreContainer = this.scoreDisplayContainer.children[0];
        const baseWidth  = 250;   // исходная ширина scoreContainer
        const scaleScore = (width / 3) / baseWidth;
        scoreContainer.scale.set(scaleScore);
        
        // центруем по горизонтали
        scoreContainer.x = width / 2 - (baseWidth * scaleScore) / 2;
        // отступ вниз на высоту баннера
        scoreContainer.y = this.bannerHeight - 60;
      }
    
      // --- Кнопки: уменьшаем общий масштаб ещё на 0.8 ---
      const baseScale = (width / this.baseWidth);
      const buttonScale = baseScale * 0.8;
    
      this.uiButtonsContainer.children.forEach(btn => {
          // Шаг 1: Масштаб кнопки
          // Если была baseSize (55 px), просто умножаем
          if (btn.baseSize) {
            btn.width  = btn.baseSize * scale;
            btn.height = btn.baseSize * scale;
          } else {
            btn.scale.set(scale);
          }
        
          // Шаг 2: Зависит от типа
          if (btn.buttonType === 'settings') {
            // ставим её справа, чуть ниже баннера
            // как было раньше: x = width - 90; y=90;
            // теперь умножаем на scale, чтобы сохранять пропорции
            btn.x = width - (90 * scale);
            btn.y = 75 * scale;
          }
          else if (btn.buttonType === 'addNew') {
            // рядом (чуть правее) с settings
            // в старой логике x= width - 30; y= 90;
            btn.x = width - (30 * scale);
            btn.y = 75 * scale;
          }
          else if (btn.buttonType === 'lightbulb') {
            btn.x = 40 * scale;
            // Было: btn.y = this.app.screen.height - 235;
            // Исправляем на:
            btn.y = this.app.screen.height - 210;
          }
        });
    
      // Game action buttons (knock/meld)
      if (this.knockButton) {
        this.knockButton.x = this.app.screen.width / 2;
        this.knockButton.y = this.app.screen.height * 0.7;
      }
      if (this.meldButton) {
        this.meldButton.x = width - 140;
        this.meldButton.y = height - 110;
      }
    
      // Deadwood indicator
      if (this.deadwoodText) {
        this.deadwoodText.x = width - 60;
        this.deadwoodText.y = this.app.screen.height - 210;
      }

      if (this.ginButton) {
        this.ginButton.x = this.app.screen.width / 2;
        this.ginButton.y = this.app.screen.height * 0.7;
      }
    
      // Dialog
      if (this.dialogContainer.visible && this.dialogContainer.children[0]) {
        const dialog = this.dialogContainer.children[0];
        dialog.x = (width - 350) / 2;
        dialog.y = (height / 2) - 50;
      }
    }      
}