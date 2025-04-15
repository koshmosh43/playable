// UIManager.js - Handles UI interactions and dialogs
export class UIManager {
  constructor(app) {
    this.app = app;
    this.dialogContainer = null;
    this.onDialogConfirm = null;
  }

  // Create a confirmation dialog
  createDialog(title, message, type) {
    // Remove existing dialog if any
    if (this.dialogContainer) {
      this.app.stage.removeChild(this.dialogContainer);
    }
    
    // Create new dialog container
    this.dialogContainer = new PIXI.Container();
    this.dialogContainer.interactive = true;
    this.dialogContainer.zIndex = 1000;

    // Semi-transparent background overlay
    const background = new PIXI.Graphics();
    background.beginFill(0x000000, 0.5);
    background.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    background.endFill();
    this.dialogContainer.addChild(background);

    // Dialog box
    const dialogBox = new PIXI.Graphics();
    dialogBox.beginFill(0xFFFFFF);
    dialogBox.drawRoundedRect(
      (this.app.screen.width - 300) / 2, 
      (this.app.screen.height - 200) / 2, 
      300, 
      200, 
      10
    );
    dialogBox.endFill();
    this.dialogContainer.addChild(dialogBox);

    // Dialog title
    const titleText = new PIXI.Text(title, {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0x000000,
      align: 'center'
    });
    titleText.anchor.set(0.5);
    titleText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 70);
    this.dialogContainer.addChild(titleText);

    // Dialog message
    const messageText = new PIXI.Text(message, {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: 0x000000,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 260
    });
    messageText.anchor.set(0.5);
    messageText.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
    this.dialogContainer.addChild(messageText);

    // Confirm button
    const confirmButton = this.createButton('Confirm', true);
    confirmButton.position.set(this.app.screen.width / 2 - 160, this.app.screen.height / 2 + 70);
    confirmButton.on('pointerdown', () => this.closeDialog(true, type));
    this.dialogContainer.addChild(confirmButton);

    // Cancel button
    const cancelButton = this.createButton('Cancel', false);
    cancelButton.position.set(this.app.screen.width / 2 + 10, this.app.screen.height / 2 + 70);
    cancelButton.on('pointerdown', () => this.closeDialog(false, type));
    this.dialogContainer.addChild(cancelButton);

    // Add dialog to stage
    this.app.stage.addChild(this.dialogContainer);
  }

  // Create a button with specified text and style
  createButton(text, isConfirm) {
    const button = new PIXI.Container();
    button.interactive = true;
    button.buttonMode = true;
    
    // Button background
    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(isConfirm ? 0x4CAF50 : 0xF44336);  // Green for confirm, red for cancel
    buttonBg.drawRoundedRect(0, 0, 150, 50, 10);
    buttonBg.endFill();
    button.addChild(buttonBg);
    
    // Button text
    const buttonText = new PIXI.Text(text, {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: 0xFFFFFF,
      align: 'center'
    });
    buttonText.anchor.set(0.5);
    buttonText.position.set(75, 25);
    button.addChild(buttonText);
    
    return button;
  }

  // Add to UIManager.js class
showConfirmationTooltip(message, options = {}) {
  // Remove existing dialog if any
  if (this.dialogContainer) {
    this.app.stage.removeChild(this.dialogContainer);
  }
  
  const {
    position = { x: this.app.screen.width / 2, y: this.app.screen.height / 2 },
    width = 400,
    height = 100,
    showCardIcon = false,
    onConfirm = null,
    onCancel = null
  } = options;
  
  // Create new dialog container
  this.dialogContainer = new PIXI.Container();
  this.dialogContainer.interactive = true;
  this.dialogContainer.zIndex = 1000;

  // Semi-transparent overlay (optional)
  const background = new PIXI.Graphics();
  background.beginFill(0x000000, 0.3);
  background.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
  background.endFill();
  background.interactive = true;
  this.dialogContainer.addChild(background);

  // Create tooltip container
  const tooltipContainer = new PIXI.Container();
  
  // Create tooltip background
  const tooltipBg = new PIXI.Graphics();
  tooltipBg.beginFill(0xFEFBF3); // Cream color from the screenshot
  tooltipBg.lineStyle(2, 0x5C3D2E, 1); // Brown border
  tooltipBg.drawRoundedRect(0, 0, width, height, 20);
  tooltipBg.endFill();
  
  // Create tooltip pointer (triangle)
  tooltipBg.beginFill(0xFEFBF3);
  tooltipBg.lineStyle(2, 0x5C3D2E, 1); // Match border style
  tooltipBg.moveTo(width/2 - 15, height);
  tooltipBg.lineTo(width/2, height + 25);
  tooltipBg.lineTo(width/2 + 15, height);
  tooltipBg.closePath();
  tooltipBg.endFill();
  
  tooltipContainer.addChild(tooltipBg);
  
  // Process message text to insert the card icon if needed
  let finalMessage = message;
  let cardIconPosition = null;
  
  if (showCardIcon) {
    // Find position for card icon in text using placeholder {card_icon}
    finalMessage = message.replace("{card_icon}", "");
    const parts = message.split("{card_icon}");
    if (parts.length > 1) {
      cardIconPosition = {
        before: parts[0],
        after: parts[1]
      };
    }
  }
  
  // Create text in the tooltip
  const tooltipText = new PIXI.Text(finalMessage, {
    fontFamily: "Arial",
    fontSize: 26,
    fontWeight: "bold",
    fill: 0x3D2817, // Dark brown color
    align: "center",
    wordWrap: true,
    wordWrapWidth: width - 40
  });
  tooltipText.anchor.set(0.5, 0.5);
  tooltipText.x = width / 2;
  tooltipText.y = height / 2;
  
  tooltipContainer.addChild(tooltipText);
  
  // Add card icon if needed
  if (showCardIcon && cardIconPosition) {
    // Create card icon graphics - small 3 cards fanned
    const cardIcon = new PIXI.Container();
    cardIcon.scale.set(0.5); // Scale the icon down
    
    // Create 3 small cards
    const cardColors = [0x3B579D, 0xBE3144, 0x3B579D]; // Blue, Red, Blue
    const offsets = [0, 5, 10]; // Offset for fan effect
    
    for (let i = 0; i < 3; i++) {
      const card = new PIXI.Graphics();
      card.beginFill(0xFFFFFF);
      card.lineStyle(1, cardColors[i]);
      card.drawRoundedRect(offsets[i], -offsets[i], 25, 35, 3);
      card.endFill();
      
      // Add suit symbol
      const suitText = new PIXI.Text(i === 1 ? "♦" : "♠", {
        fontFamily: "Arial",
        fontSize: 14,
        fill: cardColors[i]
      });
      suitText.anchor.set(0.5);
      suitText.x = offsets[i] + 12.5;
      suitText.y = -offsets[i] + 17.5;
      card.addChild(suitText);
      
      cardIcon.addChild(card);
    }
    
    // Position card icon correctly based on text measurement
    const beforeTextWidth = tooltipText.context.measureText(cardIconPosition.before).width;
    cardIcon.x = tooltipText.x - tooltipText.width/2 + beforeTextWidth + 15;
    cardIcon.y = tooltipText.y - 5;
    
    tooltipContainer.addChild(cardIcon);
  }
  
  // Center the tooltip on screen
  tooltipContainer.x = position.x - width / 2;
  tooltipContainer.y = position.y - height - 25; // Account for pointer
  
  this.dialogContainer.addChild(tooltipContainer);
  this.app.stage.addChild(this.dialogContainer);
  
  return tooltipContainer;
}

// Show tutorial sequence
showTooltip(message, onComplete) {
  
  // Создаем контейнер для подсказки
  const tooltipContainer = new PIXI.Container();
  tooltipContainer.zIndex = 200;
  
  // Фон подсказки (скругленный прямоугольник)
  const tooltipBg = new PIXI.Graphics();
  tooltipBg.beginFill(0x333333, 0.85); // Тёмный фон как в референсе
  tooltipBg.drawRoundedRect(0, 0, 300, 60, 10);
  tooltipBg.endFill();
  
  // Текст подсказки
  const tooltipText = new PIXI.Text(message, {
    fontFamily: "Arial",
    fontSize: 18,
    fontWeight: "bold",
    fill: 0xFFFFFF, // Белый текст как в референсе
    align: "center",
    wordWrap: true,
    wordWrapWidth: 280
  });
  tooltipText.anchor.set(0.5);
  tooltipText.x = 150;
  tooltipText.y = 30;
  
  // Добавляем текст к фону
  tooltipBg.addChild(tooltipText);
  tooltipContainer.addChild(tooltipBg);
  
  // Позиционируем подсказку по центру сверху
  tooltipContainer.x = (this.app.screen.width - 300) / 2;
  tooltipContainer.y = 150; // Выше по центру как в референсе
  
  // Начальная прозрачность и масштаб
  tooltipContainer.alpha = 0;
  
  // Добавляем к сцене
  this.app.stage.addChild(tooltipContainer);
  
  // Анимация появления
  gsap.to(tooltipContainer, {
    alpha: 1,
    duration: 0.3,
    ease: "power2.out"
  });
  
  // Держим подсказку на экране некоторое время
  setTimeout(() => {
    // Анимация исчезновения
    gsap.to(tooltipContainer, {
      alpha: 0,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        // Удаляем подсказку
        this.app.stage.removeChild(tooltipContainer);
        
        // Вызываем коллбэк, если он передан
        if (onComplete) onComplete();
      }
    });
  }, 2500);
}

showMeldBreakConfirmation(message, callback) {
  // Remove existing dialog if any
  if (this.dialogContainer) {
    this.app.stage.removeChild(this.dialogContainer);
  }
  
  // Create new dialog container
  this.dialogContainer = new PIXI.Container();
  this.dialogContainer.zIndex = 1000;

  // Speech bubble background
  const bubbleBg = new PIXI.Graphics();
  
  // Cream color from the reference
  bubbleBg.beginFill(0xFFFBF0);
  
  // Drop shadow (dark brown with alpha)
  bubbleBg.lineStyle(3, 0x5C3D2E, 0.5);
  
  // Draw rounded rectangle
  bubbleBg.drawRoundedRect(0, 0, 420, 100, 20);
  bubbleBg.endFill();
  
  // Add speech bubble pointer
  bubbleBg.beginFill(0xFFFBF0);
  bubbleBg.lineStyle(3, 0x5C3D2E, 0.5);
  bubbleBg.moveTo(210 - 15, 100);
  bubbleBg.lineTo(210, 120);
  bubbleBg.lineTo(210 + 15, 100);
  bubbleBg.closePath();
  bubbleBg.endFill();

  // Card icon for meld
  const cardIcon = new PIXI.Container();
  
  // Create mini playing cards
  const createMiniCard = (x, y, color, symbol) => {
    const card = new PIXI.Graphics();
    card.beginFill(0xFFFFFF);
    card.lineStyle(1, color);
    card.drawRoundedRect(x, y, 20, 30, 3);
    card.endFill();
    
    const suitText = new PIXI.Text(symbol, {
      fontFamily: "Arial",
      fontSize: 12,
      fill: color
    });
    suitText.anchor.set(0.5);
    suitText.x = x + 10;
    suitText.y = y + 15;
    cardIcon.addChild(card);
    cardIcon.addChild(suitText);
  };
  
  createMiniCard(-15, 0, 0x3B579D, "♠");  // Blue spade
  createMiniCard(-5, -3, 0xBE3144, "♦");   // Red diamond
  createMiniCard(5, -6, 0x3B579D, "♣");    // Blue club
  
  // Message text processing
  const words = message.split(' ');
  const theIndex = words.indexOf('the');
  const meldIndex = words.indexOf('meld?');
  
  // If "the" and "meld?" exist, place icon between them
  if (theIndex !== -1 && meldIndex !== -1) {
    const beforeText = words.slice(0, theIndex + 1).join(' ');
    const afterText = words.slice(theIndex + 1).join(' ');
    
    // Create two text parts
    const beforeTextObj = new PIXI.Text(beforeText + ' ', {
      fontFamily: "Arial",
      fontSize: 24,
      fontWeight: "bold",
      fill: 0x3D2817
    });
    
    const afterTextObj = new PIXI.Text(' ' + afterText, {
      fontFamily: "Arial",
      fontSize: 24,
      fontWeight: "bold",
      fill: 0x3D2817
    });
    
    // Position text
    beforeTextObj.anchor.set(1, 0.5);
    beforeTextObj.x = 210 - 25;
    beforeTextObj.y = 50;
    
    afterTextObj.anchor.set(0, 0.5);
    afterTextObj.x = 210 + 25;
    afterTextObj.y = 50;
    
    // Position card icon
    cardIcon.x = 210;
    cardIcon.y = 50;
    
    // Add to bubble
    bubbleBg.addChild(beforeTextObj);
    bubbleBg.addChild(afterTextObj);
    bubbleBg.addChild(cardIcon);
  } else {
    // Fallback to single text if structure not found
    const messageText = new PIXI.Text(message, {
      fontFamily: "Arial",
      fontSize: 24,
      fontWeight: "bold",
      fill: 0x3D2817,
      align: "center"
    });
    
    messageText.anchor.set(0.5);
    messageText.x = 210;
    messageText.y = 50;
    
    bubbleBg.addChild(messageText);
  }
  
  // Position bubble in the center between table cards and player avatar
  bubbleBg.x = (this.app.screen.width - 420) / 2;
  bubbleBg.y = this.app.screen.height * 0.55 - 120; // Above the player avatar
  
  // Add bubble to dialog container
  this.dialogContainer.addChild(bubbleBg);
  
  // Add to the stage and show
  this.app.stage.addChild(this.dialogContainer);
  
  // Fade in animation
  this.dialogContainer.alpha = 0;
  gsap.to(this.dialogContainer, {
    alpha: 1,
    duration: 0.3,
    ease: "power2.out"
  });
  
  // Setup click events
  bubbleBg.interactive = true;
  bubbleBg.buttonMode = true;
  
  // Yes (confirm) action
  bubbleBg.on('pointerdown', () => {
    gsap.to(this.dialogContainer, {
      alpha: 0,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        this.app.stage.removeChild(this.dialogContainer);
        if (callback) callback(true);
      }
    });
  });
  
  // No (cancel) action when clicking elsewhere
  const backgroundClick = new PIXI.Graphics();
  backgroundClick.beginFill(0x000000, 0.01); // Nearly transparent
  backgroundClick.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
  backgroundClick.endFill();
  backgroundClick.interactive = true;
  
  backgroundClick.on('pointerdown', (event) => {
    event.stopPropagation();
    gsap.to(this.dialogContainer, {
      alpha: 0,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        this.app.stage.removeChild(this.dialogContainer);
        if (callback) callback(false);
      }
    });
  });
  
  // Add background as first child to be behind bubble
  this.dialogContainer.addChildAt(backgroundClick, 0);
}

  // Close dialog and trigger callback
  closeDialog(confirmed, type) {
    if (this.dialogContainer) {
      this.app.stage.removeChild(this.dialogContainer);
      this.dialogContainer = null;
      
      // Trigger callback if provided
      if (this.onDialogConfirm) {
        this.onDialogConfirm(type, confirmed);
      }
    }
  }
}

export default UIManager;