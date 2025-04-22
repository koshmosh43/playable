export class UIRenderer {
  constructor(app, assetLoader, config) {
      this.app         = app;
      this.assetLoader = assetLoader;
      this.config      = config;
    
      this.designWidth = 390;
    
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
    
    this.adContainer = new PIXI.Container();
    this.topNavContainer = new PIXI.Container();
    this.bannerContainer = new PIXI.Container();
    this.uiButtonsContainer = new PIXI.Container();
    this.deadwoodContainer = new PIXI.Container();
    this.dialogContainer = new PIXI.Container();
    this.scoreDisplayContainer = new PIXI.Container();

  this.avatarsContainer = new PIXI.Container();
  this.avatarsContainer.zIndex = 5;
    
    this.adHeight = 0;
    this.navHeight = 0;
    this.bannerHeight = 0;
    
    this.knockButton = null;
    this.meldButton = null;
    this.ginButton = null;
    this.onGinClick = null;
    this.deadwoodText = null;
    this.blueScoreText = null;
    this.redScoreText = null;
    
    
    this.onKnockClick = null;
    this.onMeldClick = null;
    
    this.init();
  }
  
  init() {
    this.adContainer.zIndex = 101;
    this.topNavContainer.zIndex = 101;
    this.bannerContainer.zIndex = 99;
    this.uiButtonsContainer.zIndex = 101;
    this.deadwoodContainer.zIndex = 104;
    this.dialogContainer.zIndex = 200;
    this.scoreDisplayContainer.zIndex = 101;

    this.container.addChild(this.adContainer);
    this.container.addChild(this.topNavContainer);
    this.container.addChild(this.bannerContainer);
    this.container.addChild(this.uiButtonsContainer);
    this.container.addChild(this.dialogContainer);
    this.container.addChild(this.scoreDisplayContainer);

        this.dialogContainer.visible = false;
}
  
    async setupUI() {
    await this.setupGameActions();
    await this.setupAvatars();
    
        this.setupDeadwoodDisplay();
  }

  async setupTopBanner() {
      try {
        const texture = await this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/TopBanner.webp');
        const banner  = new PIXI.Sprite(texture);
    
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
                const [blueTex, redTex] = await Promise.all([
          this.assetLoader.loadTexture("https://koshmosh43.github.io/playable/assets/blue_avatar.webp"),
          this.assetLoader.loadTexture("https://koshmosh43.github.io/playable/assets/red_avatar.webp"),
        ]);
      
                this.blueAvatar = new PIXI.Sprite(blueTex);
        this.redAvatar = new PIXI.Sprite(redTex);
      
                this.blueAvatar.anchor.set(0.5);
        this.redAvatar.anchor.set(0.5);
      
                this.blueAvatar.scale.set(0.2);
        this.redAvatar.scale.set(0.2);
      
                        if (this.app.screen.height < 667) {
                    this.redAvatar.y = this.app.screen.height * 0.30;            this.blueAvatar.y = this.app.screen.height * 0.65;         } else {
                    this.redAvatar.y = this.app.screen.height * 0.23;
          this.blueAvatar.y = this.app.screen.height * 0.7;
        }
        
                this.redAvatar.x = this.app.screen.width / 2;
        this.blueAvatar.x = this.app.screen.width / 2;
      
                this.avatarsContainer.addChild(this.blueAvatar);
        this.avatarsContainer.addChild(this.redAvatar);
      } catch (err) {
        console.warn("Could not load avatars", err);
      }
      }

  
    async setupScoreDisplay() {
    const scoreContainer = new PIXI.Container();
    
        const bgGraphics = new PIXI.Graphics();
    bgGraphics.lineStyle(2, 0x000000, 0.5);
    bgGraphics.beginFill(0x0B5D2E);
    bgGraphics.drawRoundedRect(0, 0, 250, 60, 20);
    bgGraphics.endFill();
    
    try {
            const targetIcon = new PIXI.Graphics();
      targetIcon.beginFill(0xFFFDE7);
      targetIcon.drawCircle(0, 0, 15);
      targetIcon.endFill();
      
            targetIcon.lineStyle(2, 0x0B5D2E);
      targetIcon.drawCircle(0, 0, 12);
      targetIcon.drawCircle(0, 0, 8);
      targetIcon.drawCircle(0, 0, 4);
      
            targetIcon.lineStyle(2, 0xFFFDE7);
      targetIcon.moveTo(0, -18);
      targetIcon.lineTo(0, -25);
      targetIcon.moveTo(-3, -22);
      targetIcon.lineTo(0, -25);
      targetIcon.lineTo(3, -22);
      
      targetIcon.x = 35;
      targetIcon.y = 30;
      
            const targetText = new PIXI.Text("100", {
        fontFamily: "Arial",
        fontSize: 28,
        fontWeight: "bold",
        fill: 0xFFFDE7
      });
      targetText.anchor.set(0.5);
      targetText.x = 85;
      targetText.y = 30;
      
            const blueBox = new PIXI.Graphics();
      blueBox.beginFill(0x3366FF);
      blueBox.drawRect(120, 10, 60, 40);
      blueBox.endFill();
      
      const redBox = new PIXI.Graphics();
      redBox.beginFill(0xE91E63);
      redBox.drawRect(180, 10, 60, 40);
      redBox.endFill();
      
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
      
            scoreContainer.addChild(bgGraphics);
      scoreContainer.addChild(targetIcon);
      scoreContainer.addChild(targetText);
      scoreContainer.addChild(blueBox);
      scoreContainer.addChild(redBox);
      scoreContainer.addChild(this.blueScoreText);
      scoreContainer.addChild(this.redScoreText);
    } catch (err) {
      console.warn("Using fallback score display");
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
    
        scoreContainer.x = (this.app.screen.width - 250) / 2;
    scoreContainer.y = this.adHeight + 10;
    
    this.scoreDisplayContainer.removeChildren();
    this.scoreDisplayContainer.addChild(scoreContainer);
    
    return scoreContainer;
  }
  
    async setupGameButtons() {
    try {
            const settingsButton = await this.createButton('https://koshmosh43.github.io/playable/assets/settingsButton.webp', 'settings');
      settingsButton.x = this.app.screen.width - 90;
      settingsButton.y = 60;
      
            const addButton = await this.createButton('https://koshmosh43.github.io/playable/assets/newGameButton.webp', 'addNew');
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
  
    async createButton(texturePath, type) {
  try {
        const texture = await this.assetLoader.loadTexture(texturePath);
    const button  = new PIXI.Sprite(texture);

        button.baseSize = 55;
    button.width    = button.height = button.baseSize;

    button.anchor.set(0.5);
    button.interactive = true;
    button.buttonMode  = true;
    button.buttonType  = type;

        if (type === 'settings') {
      button.on('pointerdown', () => console.log('Settings button clicked'));
    } else if (type === 'addNew') {
      button.on('pointerdown', () => console.log('Add new button clicked'));
    } else if (type === 'lightbulb') {
      button.on('pointerdown', () => console.log('Lightbulb button clicked'));
    }

    return button;
  } catch (err) {
        console.warn(`Creating fallback button for ${type}`, err);

    const fallback = new PIXI.Graphics();
    fallback.baseSize   = 55;                  fallback.buttonType = type;
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
    this.ginButton = new PIXI.Container();
  this.ginButton.interactive = true;
  this.ginButton.buttonMode = true;
  
  
    this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/Gin_button.webp')
    .then(texture => {
      const ginButtonSprite = new PIXI.Sprite(texture);
      ginButtonSprite.anchor.set(0.5);
      this.ginButton.addChild(ginButtonSprite);
    })
    .catch(err => {
      console.warn("Could not load Gin button asset, using fallback", err);
            const ginBg = new PIXI.Graphics();
      ginBg.beginFill(0x2196F3);       ginBg.drawRoundedRect(-60, -20, 120, 40, 10);
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
  
    this.ginButton.x = this.app.screen.width / 2;   this.ginButton.y = this.app.screen.height * 0.6;   
    this.ginButton.visible = false;
  
    this.ginButton.on('pointerdown', () => {
    this.showPlayNowOverlay();
  });
  
    this.uiButtonsContainer.addChild(this.ginButton);
}

async setupKnockButton() {
    this.knockButton = new PIXI.Container();
  this.knockButton.interactive = true;
  this.knockButton.buttonMode = true;
  
    this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/Knock_button.webp')
    .then(texture => {
            const knockButtonSprite = new PIXI.Sprite(texture);
      knockButtonSprite.anchor.set(0.5);
      knockButtonSprite.scale.set(0.5, 0.5);
      this.knockButton.addChild(knockButtonSprite);
    })
    .catch(err => {
      console.warn("Не удалось загрузить ассет Knock, используется fallback", err);
            const knockBg = new PIXI.Graphics();
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
  
    this.knockButton.x = this.app.screen.width / 2;   this.knockButton.y = this.app.screen.height * 0.6;      this.knockButton.visible = false;    
    this.knockButton.on('pointerdown', () => {
    this.showPlayNowOverlay();
  });
  
    this.uiButtonsContainer.addChild(this.knockButton);
}
  
  showGinButton(visible) {
  if (!this.ginButton) {
    this.ginButton = new PIXI.Container();
    this.ginButton.interactive = true;
    this.ginButton.buttonMode  = true;

        this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/Gin_button.webp')
      .then(texture => {
        const spr = new PIXI.Sprite(texture);
        spr.anchor.set(0.5);
        spr.scale.set(0.2, 0.2);
        this.ginButton.addChild(spr);
      })
      .catch(err => {
        console.warn("Could not load Gin asset, using fallback", err);
        const bg = new PIXI.Graphics();
        bg.beginFill(0x2196F3);
        bg.drawRoundedRect(-60, -20, 120, 40, 10);
        bg.endFill();
        const txt = new PIXI.Text("GIN", {
          fontFamily: "Arial", fontSize: 20, fontWeight: "bold", fill: 0xFFFFFF
        });
        txt.anchor.set(0.5);
        this.ginButton.addChild(bg, txt);
      });

        this.ginButton.removeAllListeners('pointerdown');
    this.ginButton.on('pointerdown', () => {
            if (window.game) {
        window.game.pauseGame = true;
        console.log("Game paused on GIN click");
      }
            gsap.killTweensOf(this.ginButton);
      gsap.killTweensOf(this.ginButton.scale);
            gsap.to(this.ginButton, {
        alpha: 0, scale: 0.4, duration: 0.2, ease: "power2.in",
        onComplete: () => {
          this.ginButton.visible = false;
          this.ginButton.clickProcessing = false;
        }
      });
    });

        this.uiButtonsContainer.addChild(this.ginButton);
  }

    this.ginButton.x       = this.app.screen.width / 2;
  this.ginButton.y       = this.app.screen.height * 0.6;
  this.ginButton.visible = visible;

  if (visible) {
    if (window.game) window.game.pauseGame = true;
        this.ginButton.alpha = 0;
    gsap.to(this.ginButton, { alpha: 1, duration: 0.3, ease: "back.out" });
    gsap.to(this.ginButton.scale, {
      x: 1.05, y: 1.05, duration: 1.2, repeat: -1, yoyo: true, ease: "sine.inOut"
    });
  } else {
    if (window.game) window.game.pauseGame = false;
    gsap.killTweensOf(this.ginButton);
    gsap.killTweensOf(this.ginButton.scale);
    gsap.to(this.ginButton, { alpha: 0, duration: 0.3, ease: "power2.in" });
  }
}


  showPlayNowOverlay() {
    if (this.knockButton && this.knockButton.parent) {
      this.knockButton.parent.removeChild(this.knockButton);
    }
    
    if (this.ginButton && this.ginButton.parent) {
      this.ginButton.parent.removeChild(this.ginButton);
    }
            if (this.app && this.app.stage) {
            for (let i = this.app.stage.children.length - 1; i >= 0; i--) {
        const child = this.app.stage.children[i];
                if (child && child.children) {
          const hasTutorialText = child.children.some(grandchild => 
            grandchild instanceof PIXI.Text && 
            grandchild.text && 
            (grandchild.text.includes("Take a card") || 
             grandchild.text.includes("deck or") ||
             grandchild.text.includes("shown card"))
          );
          
                    if (hasTutorialText) {
            this.app.stage.removeChild(child);
          }
        }
      }
    }
    
        this.takeCardTutorialShown = false;
    
        if (this.knockButton && this.knockButton.visible) {
      this.showKnockButton(false);
    }
    
    if (this.ginButton && this.ginButton.visible) {
      this.showGinButton(false);
    }
    
        const overlayContainer = new PIXI.Container();
    overlayContainer.zIndex = 1000;
    
        const background = new PIXI.Graphics();
    background.beginFill(0x000000, 0.2);
    background.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    background.endFill();
    overlayContainer.addChild(background);
    
        this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/playNow.webp')
      .then(texture => {
        const logo = new PIXI.Sprite(texture);
        logo.anchor.set(0.5);
        logo.x = this.app.screen.width / 2;
        logo.y = this.app.screen.height / 2;
        logo.alpha = 0;         overlayContainer.addChild(logo);
        
                overlayContainer.interactive = true;
        overlayContainer.buttonMode = true;
        overlayContainer.on('pointerdown', () => {
          window.open('https://apps.apple.com/app/gin-rummy-stars-card-game/id1467143758', '_blank');
          this.app.stage.removeChild(overlayContainer);
        });
        
                this.app.stage.addChild(overlayContainer);
        
                
                gsap.to(logo, {
          alpha: 1,
          duration: 0.3,
          ease: "back.out"
        });
        
                gsap.to(logo, {
          y: logo.y - 5,
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
        
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
        fallbackText.alpha = 0;         overlayContainer.addChild(fallbackText);
        
                overlayContainer.interactive = true;
        overlayContainer.buttonMode = true;
        overlayContainer.on('pointerdown', () => {
          window.open('https://apps.apple.com/app/gin-rummy-stars-card-game/id1467143758', '_blank');
          this.app.stage.removeChild(overlayContainer);
        });
        
                this.app.stage.addChild(overlayContainer);
        
                
                gsap.to(fallbackText, {
          alpha: 1,
          duration: 0.3,
          ease: "back.out"
        });
        
                gsap.to(fallbackText, {
          y: fallbackText.y - 5,
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
        
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
  
    async setupGameActions() {
        this.knockButton = new PIXI.Container();
    this.onGinClick = null;
    this.meldButton = new PIXI.Container();
    
        this.knockButton.visible = false;
    this.meldButton.visible = false;
    
    
    this.meldButton.on('pointerdown', () => {
      if (this.onMeldClick) this.onMeldClick();
    });
    
                
        await this.setupGinButton();
    await this.setupKnockButton();
  }
  
  createMeldDisplay() {
        const meldContainer = new PIXI.Container();
    meldContainer.zIndex = 100;
    
        const runDisplay = new PIXI.Container();
    runDisplay.visible = false;
    
        const runText = new PIXI.Text("RUN!", {
      fontFamily: "Arial",
      fontSize: 64,
      fontWeight: "bold",
      fill: ["#ffffff", "#a0ffa0"],       stroke: "#000000",
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
    
        const setDisplay = new PIXI.Container();
    setDisplay.visible = false;
    
        const setText = new PIXI.Text("SET!", {
      fontFamily: "Arial",
      fontSize: 64,
      fontWeight: "bold",
      fill: ["#ffffff", "#ffff80"],       stroke: "#000000",
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
    
        meldContainer.addChild(runDisplay);
    meldContainer.addChild(setDisplay);
    
        meldContainer.x = this.app.screen.width / 2;
    meldContainer.y = this.app.screen.height * 0.65;
    
        this.container.addChild(meldContainer);
    
        this.meldContainer = meldContainer;
    this.runDisplay = runDisplay;
    this.setDisplay = setDisplay;
    
    return meldContainer;
  }

    showDialog(message) {
    this.dialogContainer.removeChildren();
    
        const dialogBg = new PIXI.Graphics();
    dialogBg.beginFill(0xFFF8E1, 0.9);
    dialogBg.drawRoundedRect(0, 0, 350, 100, 20);
    dialogBg.endFill();
    
        dialogBg.beginFill(0xFFFBF0, 0.9);
dialogBg.moveTo(175, 120); dialogBg.lineTo(155, 100); dialogBg.lineTo(195, 100); dialogBg.closePath();
dialogBg.endFill();
    
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
    
        dialogBg.x = (this.app.screen.width - 350) / 2;
    dialogBg.y = (this.app.screen.height / 2) + 75;
    
    this.dialogContainer.addChild(dialogBg);
    this.dialogContainer.visible = true;
    
    return dialogBg;
  }
  
    hideDialog() {
    this.dialogContainer.visible = false;
  }
  
    updateScores(playerScore, opponentScore) {
    if (this.blueScoreText) {
      this.blueScoreText.text = playerScore.toString();
    }
    if (this.redScoreText) {
      this.redScoreText.text = opponentScore.toString();
    }
  }
  
    updateDeadwood(value) {
    if (!this.deadwoodText) return;
    
        this.deadwoodText.text = value.toString();
    
        if (value < 10) {
            this.deadwoodText.style.fill = 0x4CAF50;
    } else {
            this.deadwoodText.style.fill = 0xFFFFFF;
    }
    
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
        
    if (!this.knockButton) {
      this.knockButton = new PIXI.Container();
      this.knockButton.interactive = true;
      this.knockButton.buttonMode = true;
  
            this.assetLoader.loadTexture('https://koshmosh43.github.io/playable/assets/Knock_button.webp')
        .then(texture => {
          const spr = new PIXI.Sprite(texture);
          spr.anchor.set(0.5);
          spr.scale.set(0.33, 0.33);
          this.knockButton.addChild(spr);
        })
        .catch(err => {
          console.warn("Could not load Knock asset, using fallback", err);
          const bg = new PIXI.Graphics();
          bg.beginFill(0xFF5722);
          bg.drawRoundedRect(-20, -7, 40, 14, 4);
          bg.endFill();
          const txt = new PIXI.Text("KNOCK", {
            fontFamily: "Arial", fontSize: 8, fontWeight: "bold", fill: 0xFFFFFF
          });
          txt.anchor.set(0.5);
          this.knockButton.addChild(bg, txt);
        });
  
            this.knockButton.removeAllListeners('pointerdown');
      this.knockButton.on('pointerdown', () => {
                if (this.knockButton.clickProcessing) return;
        this.knockButton.clickProcessing = true;
        
                if (window.game) {
          window.game.pauseGame = true;
        }
        
                gsap.killTweensOf(this.knockButton);
        gsap.killTweensOf(this.knockButton.scale);
        
                gsap.to(this.knockButton, {
          alpha: 0, scale: 0.5, duration: 0.2, ease: "power2.in",
          onComplete: () => {
            this.knockButton.visible = false;
            this.knockButton.clickProcessing = false;
          }
        });
      });
  
            this.uiButtonsContainer.addChild(this.knockButton);
    }
  
        this.knockButton.x = this.app.screen.width / 2;
    this.knockButton.y = this.app.screen.height * 0.6;
    
        if (this.knockButton.visible !== visible) {
      this.knockButton.visible = visible;
      
      if (visible) {
                if (window.game && !window.game.pauseGame) {
          window.game.pauseGame = true;
        }
        
                this.knockButton.alpha = 0;
        gsap.to(this.knockButton, { alpha: 1, duration: 0.3, ease: "back.out" });
        
                if (!this.knockButton.pulsing) {
          this.knockButton.pulsing = true;
          gsap.to(this.knockButton.scale, {
            x: 1.5, y: 1.5, 
            duration: 1.2, 
            repeat: 100, 
            yoyo: true, 
            ease: "sine.inOut",
            onComplete: () => {
              this.knockButton.pulsing = false;
            }
          });
        }
      } else {
                if (window.game && window.game.pauseGame) {
          window.game.pauseGame = false;
        }
        
                gsap.killTweensOf(this.knockButton);
        gsap.killTweensOf(this.knockButton.scale);
        this.knockButton.pulsing = false;
        
                gsap.to(this.knockButton, { 
          alpha: 0, 
          duration: 0.3, 
          ease: "power2.in" 
        });
      }
    }
  }


  setupDeadwoodDisplay() {
    const deadwoodContainer = new PIXI.Container();
    
        const bg = new PIXI.Graphics();
    bg.beginFill(0x333333, 0.7);
    bg.drawRoundedRect(0, 0, 150, 50, 15);
    bg.endFill();
    
        const titleText = new PIXI.Text("Deadwood:", {
      fontFamily: "Arial",
      fontSize: 16,
      fill: 0xFFFFFF,
      fontWeight: "bold"
    });
    titleText.position.set(10, 8);
    
        this.deadwoodText = new PIXI.Text("0", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xFFFFFF,
      fontWeight: "bold"
    });
    this.deadwoodText.position.set(75, 28);
    this.deadwoodText.anchor.set(0.5, 0.5);
    
        deadwoodContainer.addChild(bg);
    deadwoodContainer.addChild(titleText);
    deadwoodContainer.addChild(this.deadwoodText);
    
        deadwoodContainer.x = this.app.screen.width - 170;
    deadwoodContainer.y = 100;
    
    this.deadwoodContainer.addChild(deadwoodContainer);
    return deadwoodContainer;
  }
  
  
    updateGameLog(entries) {
      }
  
    resize(width, height) {
      const scale = width / this.designWidth;
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
    
      if (this.adContainer.children[0]) {
  const adBanner = this.adContainer.children[0];
  if (adBanner.originalAspect) {
    adBanner.width  = width * 0.8;
    adBanner.height = adBanner.width * adBanner.originalAspect;

        adBanner.x = (width - adBanner.width) / 2;
        adBanner.y = 0;

    this.adHeight = adBanner.height;
  }
}

    
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
    
            if (this.scoreDisplayContainer.children[0]) {
        const scoreContainer = this.scoreDisplayContainer.children[0];
        const baseWidth  = 250;           const scaleScore = (width / 3) / baseWidth;
        scoreContainer.scale.set(scaleScore);
        
                scoreContainer.x = width / 2 - (baseWidth * scaleScore) / 2;
                scoreContainer.y = this.bannerHeight - 60;
      }
    
            const baseScale = (width / this.baseWidth);
      const buttonScale = baseScale * 0.8;
    
      this.uiButtonsContainer.children.forEach(btn => {
                              if (btn.baseSize) {
            btn.width  = btn.baseSize * scale;
            btn.height = btn.baseSize * scale;
          } else {
            btn.scale.set(scale);
          }
        
                    if (btn.buttonType === 'settings') {
                                                btn.x = width - (90 * scale);
            btn.y = 75 * scale;
          }
          else if (btn.buttonType === 'addNew') {
                                    btn.x = width - (30 * scale);
            btn.y = 75 * scale;
          }
          else if (btn.buttonType === 'lightbulb') {
            btn.x = 40 * scale;
                                    btn.y = this.app.screen.height - 210;
          }
        });
    
            if (this.knockButton) {
        this.knockButton.x = this.app.screen.width / 2;
        this.knockButton.y = this.app.screen.height * 0.6;
      }
      if (this.meldButton) {
        this.meldButton.x = width - 140;
        this.meldButton.y = height - 110;
      }
    
            if (this.deadwoodText) {
        this.deadwoodText.x = width - 60;
        this.deadwoodText.y = this.app.screen.height - 210;
      }

      if (this.ginButton) {
        this.ginButton.x = this.app.screen.width / 2;
        this.ginButton.y = this.app.screen.height * 0.6;
      }
    
            if (this.dialogContainer.visible && this.dialogContainer.children[0]) {
        const dialog = this.dialogContainer.children[0];
        dialog.x = (width - 350) / 2;
        dialog.y = (height / 2) - 50;
      }
    }      
}