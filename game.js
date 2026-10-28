/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.shieldActive = false;
    this.shieldEndTime = 0;
    this.nextShieldSpawnTime = this.time.now + Phaser.Math.Between(5000, 15000);
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.shieldAura = this.add.circle(this.player.x, this.player.y, 35, c.colors.shield);
    this.shieldAura.setAlpha(0);
    this.shieldAura.setStrokeStyle(3, c.colors.shield);
    this.shieldAura.setFillStyle(null);
    this.shieldTimer = this.add.text(c.width - 18, 12, '', {
      font: '18px monospace',
      color: c.colors.shield,
      align: 'right'
    }).setOrigin(1, 0);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.shield = this.add.circle(-100, -100, 11, c.colors.shield);
    this.physics.add.existing(this.shield);
    this.shield.body.setCircle(11);
    this.shield.setActive(false);
    this.shield.setVisible(false);
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.shield, () => {
      if (this.finished || !this.shield.active) return;
      this.activateShield();
      this.shield.setActive(false);
      this.shield.setVisible(false);
      this.nextShieldSpawnTime = this.time.now + Phaser.Math.Between(5000, 15000);
    });
    this.physics.add.overlap(this.player, this.drones, () => {
      if (this.finished || this.shieldActive) return;
      this.finish('A drone caught you!');
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
  }

  placeCoin() {
    const c = COIN_DASH;
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  placeShield() {
    const c = COIN_DASH;
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.shield.setPosition(x, y);
    this.shield.body.reset(x, y);
    this.shield.setActive(true);
    this.shield.setVisible(true);
  }

  activateShield() {
    const c = COIN_DASH;
    this.shieldActive = true;
    this.shieldEndTime = this.time.now + c.shieldDuration;
    this.player.setFillStyle(c.colors.playerShielded);
    this.shieldAura.setAlpha(0.4);
  }

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));

    this.shieldAura.setPosition(this.player.x, this.player.y);

    if (this.shieldActive && this.time.now >= this.shieldEndTime) {
      this.shieldActive = false;
      this.player.setFillStyle(COIN_DASH.colors.player);
      this.shieldAura.setAlpha(0);
    }

    if (!this.shieldActive && this.time.now >= this.nextShieldSpawnTime && !this.shield.active) {
      this.placeShield();
    }

    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s`);

    if (this.shieldActive) {
      const shieldSeconds = Math.ceil((this.shieldEndTime - this.time.now) / 1000);
      this.shieldTimer.setText(`SHIELD: ${shieldSeconds}s`);
    } else {
      this.shieldTimer.setText('');
    }

    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nPress R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});
