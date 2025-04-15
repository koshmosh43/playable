// GameStateManager.js - Manages game state transitions
export class GameStateManager {
  constructor(game, renderers) {
    this.game = game;
    this.renderers = renderers;
    this.currentState = '';
    
    // Define state transitions
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
          // вызов туториала после перехода в play
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
  
  // Change to a new state
  changeState(newState) {
    // Don't change if already in this state
    if (this.currentState === newState) return;
    
    console.log("Game state changed to:", newState);
    
    // Exit current state
    if (this.currentState && this.states[this.currentState].exit) {
      this.states[this.currentState].exit();
    }
    
    // Update current state
    this.currentState = newState;
    
    // Enter new state
    if (this.states[newState].enter) {
      this.states[newState].enter();
    }
  }
  
  // Show intro screen
  showIntroScreen() {
    if (this.game.introContainer) {
      // Плавно показываем интро-контейнер
      this.game.introContainer.alpha = 0;
      this.game.introContainer.visible = true;
      
      gsap.to(this.game.introContainer, {
        alpha: 1,
        duration: 0.5,
        ease: "power2.out"
      });
    }
  }
  
  // Hide intro screen
  hideIntroScreen() {
    if (this.game.introContainer) {
      this.game.introContainer.visible = false;
    }
  }
  
  // Show dealing screen
  showDealingScreen() {
    if (this.game.dealingContainer) {
      this.game.dealingContainer.visible = true;
    }
  }
  
  // Hide dealing screen
  hideDealingScreen() {
    if (this.game.dealingContainer) {
      this.game.dealingContainer.visible = false;
    }
  }
  
  // Show play screen
  showPlayScreen() {
    // Show main game containers
    this.game.containers.main.visible = true;
    this.game.containers.background.visible = true;
    
    // Show renderer containers
    if (this.renderers.uiRenderer) {
      this.renderers.uiRenderer.container.visible = true;
    }
    if (this.renderers.cardRenderer) {
      this.renderers.cardRenderer.container.visible = true;
    }
  }
  
  // Hide play screen
  hidePlayScreen() {
    // Hide card container (keep UI visible)
    if (this.renderers.cardRenderer) {
      this.renderers.cardRenderer.container.visible = false;
    }
  }
  
  // Show end screen
  showEndScreen() {
    if (this.game.endContainer) {
      this.game.updateEndScreen(this.game.playerScore);
      this.game.endContainer.visible = true;
    }
  }
  
  // Hide end screen
  hideEndScreen() {
    if (this.game.endContainer) {
      this.game.endContainer.visible = false;
    }
  }
}