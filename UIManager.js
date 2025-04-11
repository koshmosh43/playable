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