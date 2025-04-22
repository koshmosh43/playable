export class GameStateManager {
  constructor(game, renderers) {
    this.game = game;
    this.renderers = renderers;
    this.currentState = '';
    
        this.states = {
      'intro': {
        enter: () => this.showIntroScreen(),
        exit: () => this.hideIntroScreen()
      },
      'dealing': {
        enter: () => this.showDealingScreen(),
        exit: () => this.hideDealingScreen()
      },
      'play': {
        enter: () => {
          this.showPlayScreen();
          if (this.game.initializeGame) {
            this.game.initializeGame();
          }
                    setTimeout(() => {
            if (!this.game.tutorialShown) {
              this.game.showTutorial();
              this.game.tutorialShown = true;
            }
          }, 500);
        },
        exit: () => this.hidePlayScreen()
      },
      'end': {
        enter: () => this.showEndScreen(),
        exit: () => this.hideEndScreen()
      }
    };
  }
  
    changeState(newState) {
        if (this.currentState === newState) return;
    
    console.log("Game state changed to:", newState);
    
        if (this.currentState && this.states[this.currentState].exit) {
      this.states[this.currentState].exit();
    }
    
        this.currentState = newState;
    
        if (this.states[newState].enter) {
      this.states[newState].enter();
    }
  }
  
    showIntroScreen() {
    if (this.game.introContainer) {
            this.game.introContainer.alpha = 0;
      this.game.introContainer.visible = true;
      
      gsap.to(this.game.introContainer, {
        alpha: 1,
        duration: 0.5,
        ease: "power2.out"
      });
    }
  }
  
    hideIntroScreen() {
    if (this.game.introContainer) {
      this.game.introContainer.visible = false;
    }
  }
  
    showDealingScreen() {
    if (this.game.dealingContainer) {
      this.game.dealingContainer.visible = true;
    }
  }
  
    hideDealingScreen() {
    if (this.game.dealingContainer) {
      this.game.dealingContainer.visible = false;
    }
  }
  
    showPlayScreen() {
        this.game.containers.main.visible = true;
    this.game.containers.background.visible = true;
    
        if (this.renderers.uiRenderer) {
      this.renderers.uiRenderer.container.visible = true;
    }
    if (this.renderers.cardRenderer) {
      this.renderers.cardRenderer.container.visible = true;
    }
  }
  
    hidePlayScreen() {
        if (this.renderers.cardRenderer) {
      this.renderers.cardRenderer.container.visible = false;
    }
  }
  
    showEndScreen() {
    if (this.game.endContainer) {
      this.game.updateEndScreen(this.game.playerScore);
      this.game.endContainer.visible = true;
    }
  }
  
    hideEndScreen() {
    if (this.game.endContainer) {
      this.game.endContainer.visible = false;
    }
  }
}