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
    await this.setupLightbulbButton();
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

  // Position avatars
  // Note: These positions are relative to the UI renderer container.
  // They will appear at the appropriate vertical positions.
  this.redAvatar.x = this.app.screen.width / 2;
  this.redAvatar.y = this.app.screen.height * 0.18;
  this.blueAvatar.x = this.app.screen.width / 2;
  this.blueAvatar.y = this.app.screen.height * 0.765;

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
    
  
  // Setup lightbulb button
  async setupLightbulbButton() {
    try {
      const lightbulbButton = await this.createButton('assets/lightbulb.webp', 'lightbulb');
      lightbulbButton.x = 40;
      lightbulbButton.y = this.app.screen.height * 0.78;
      
      this.uiButtonsContainer.addChild(lightbulbButton);
      
      return lightbulbButton;
    } catch (err) {
      console.warn("Using fallback lightbulb button");
      
      const fallbackButton = new PIXI.Graphics();
      fallbackButton.buttonType = 'lightbulb';
      fallbackButton.interactive = true;
      fallbackButton.buttonMode = true;
      
      fallbackButton.beginFill(0x006400);
      fallbackButton.drawCircle(0, 0, 27);
      fallbackButton.endFill();
      
      fallbackButton.lineStyle(2, 0xFFFFFF);
      fallbackButton.beginFill(0xFFFFFF, 0.5);
      fallbackButton.drawCircle(0, -5, 10);
      fallbackButton.endFill();
      fallbackButton.moveTo(-5, 5);
      fallbackButton.lineTo(5, 5);
      fallbackButton.moveTo(-3, 10);
      fallbackButton.lineTo(3, 10);
      
      fallbackButton.x = 40;
      fallbackButton.y = this.app.screen.height - 60;
      
      this.uiButtonsContainer.addChild(fallbackButton);
      
      return fallbackButton;
    }
  }
  
  // Setup game actions (knock and meld buttons)
  async setupGameActions() {
    // Knock button
    this.knockButton = new PIXI.Container();
    this.knockButton.interactive = true;
    this.knockButton.buttonMode = true;
    
    const knockBg = new PIXI.Graphics();
    knockBg.beginFill(0xFFC107);
    knockBg.drawRoundedRect(0, 0, 120, 40, 10);
    knockBg.endFill();
    
    const knockText = new PIXI.Text("Стук", {
      fontFamily: "Arial",
      fontSize: 18,
      fontWeight: "bold",
      fill: 0x000000
    });
    knockText.anchor.set(0.5);
    knockText.x = 60;
    knockText.y = 20;
    
    this.knockButton.addChild(knockBg);
    this.knockButton.addChild(knockText);
    this.knockButton.x = this.app.screen.width - 140;
    this.knockButton.y = this.app.screen.height - 60;
    
    this.knockButton.on('pointerdown', () => {
      if (this.onKnockClick) this.onKnockClick();
    });
    
    // Meld button
    this.meldButton = new PIXI.Container();
    this.meldButton.interactive = true;
    this.meldButton.buttonMode = true;
    
    const meldBg = new PIXI.Graphics();
    meldBg.beginFill(0x4CAF50);
    meldBg.drawRoundedRect(0, 0, 120, 40, 10);
    meldBg.endFill();
    
    const meldText = new PIXI.Text("Мелд", {
      fontFamily: "Arial",
      fontSize: 18,
      fontWeight: "bold",
      fill: 0xFFFFFF
    });
    meldText.anchor.set(0.5);
    meldText.x = 60;
    meldText.y = 20;
    
    this.meldButton.addChild(meldBg);
    this.meldButton.addChild(meldText);
    this.meldButton.x = this.app.screen.width - 140;
    this.meldButton.y = this.app.screen.height - 110;
    
    this.meldButton.on('pointerdown', () => {
      if (this.onMeldClick) this.onMeldClick();
    });
    
    this.uiButtonsContainer.addChild(this.knockButton);
    this.uiButtonsContainer.addChild(this.meldButton);
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
    dialogBg.beginFill(0xFFF8E1, 0.9);
    dialogBg.moveTo(175, 100);
    dialogBg.lineTo(150, 120);
    dialogBg.lineTo(200, 120);
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
    if (!this.knockButton) return;
    
    if (visible && !this.knockButton.visible) {
      // Показываем кнопку с анимацией
      this.knockButton.visible = true;
      this.knockButton.alpha = 0;
      
      gsap.to(this.knockButton, {
        alpha: 1,
        y: this.knockButton.y - 10,
        duration: 0.3,
        ease: "back.out"
      });
      
      // Добавляем пульсацию для привлечения внимания
      gsap.to(this.knockButton.scale, {
        x: 1.1, y: 1.1,
        duration: 0.8,
        repeat: 2,
        yoyo: true,
        ease: "power1.inOut"
      });
    } else if (!visible && this.knockButton.visible) {
      // Скрываем кнопку с анимацией
      gsap.to(this.knockButton, {
        alpha: 0,
        y: this.knockButton.y + 10,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
          this.knockButton.visible = false;
          this.knockButton.y -= 10; // Восстанавливаем исходную позицию
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
        this.knockButton.x = width - 140;
        this.knockButton.y = height - 60;
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
    
      // Dialog
      if (this.dialogContainer.visible && this.dialogContainer.children[0]) {
        const dialog = this.dialogContainer.children[0];
        dialog.x = (width - 350) / 2;
        dialog.y = (height / 2) - 50;
      }
    }      
}