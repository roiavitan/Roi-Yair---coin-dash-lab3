/* global Phaser, COIN_DASH */
const HIGH_SCORE_KEY = 'coinDash.highScore';

// localStorage can be unavailable (private mode, blocked storage), so fail soft.
function loadHighScore() {
  try { return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0; } catch (e) { return 0; }
}

function saveHighScore(value) {
  try { localStorage.setItem(HIGH_SCORE_KEY, String(value)); } catch (e) { /* ignore */ }
}

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.highScore = loadHighScore();
    this.finished = false;
    this.shieldActive = false;
    this.shieldEndTime = 0;
    this.nextShieldSpawnTime = this.time.now + Phaser.Math.Between(5000, 15000);
    this.paused = false;
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
    this.shooters = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.lastShooterSpawn = 0;
    this.lastShooterShot = {};
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
    this.physics.add.overlap(this.player, this.projectiles, () => {
      if (this.finished || this.shieldActive) return;
      this.finish('A bullet hit you!');
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.addCapture('SPACE');
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-SPACE', () => this.togglePause());
  }

  togglePause() {
    if (this.finished) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pausedAt = this.time.now;
      this.physics.pause();
      const c = COIN_DASH;
      this.pauseOverlay = this.add.container(c.width / 2, c.height / 2, [
        this.add.rectangle(0, 0, 360, 120, 0x0a1120, 0.9),
        this.add.text(0, -12, 'PAUSED', { font: '40px monospace', color: '#ffffff' }).setOrigin(0.5),
        this.add.text(0, 30, 'Press P or Space to resume',
          { font: '16px monospace', color: '#cbd5e1' }).setOrigin(0.5)
      ]).setDepth(10);
    } else {
      // Push the deadline back so time spent paused doesn't count against the round.
      this.deadline += this.time.now - this.pausedAt;
      this.physics.resume();
      this.pauseOverlay.destroy();
      this.pauseOverlay = null;
    }
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

  spawnShooter() {
    const c = COIN_DASH;
    const side = Math.random() > 0.5 ? 0 : 1;
    let x, y, vx, vy;

    if (side === 0) {
      x = Math.random() > 0.5 ? -20 : c.width + 20;
      y = Phaser.Math.Between(70, c.height - 50);
      vx = side === 0 ? (x < c.width / 2 ? c.shooterSpeed : -c.shooterSpeed) : 0;
      vy = 0;
    } else {
      x = Phaser.Math.Between(50, c.width - 50);
      y = Math.random() > 0.5 ? 44 : c.height + 20;
      vx = 0;
      vy = y < c.height / 2 ? c.shooterSpeed : -c.shooterSpeed;
    }

    const shooter = this.add.rectangle(x, y, 20, 20, c.colors.shooter);
    this.shooters.add(shooter);
    shooter.body.setVelocity(vx, vy);
    shooter.body.setBounce(0, 0);
    this.lastShooterShot[shooter.id] = 0;
  }

  shootProjectile(shooter) {
    const c = COIN_DASH;
    const dx = this.player.x - shooter.x;
    const dy = this.player.y - shooter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      const bullet = this.add.rectangle(shooter.x, shooter.y, 6, 6, c.colors.projectile);
      this.projectiles.add(bullet);
      const speed = c.projectileSpeed;
      bullet.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    }
  }

  update() {
    if (this.finished || this.paused) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);

    const c = COIN_DASH;

    if (this.time.now - this.lastShooterSpawn > c.shooterSpawnInterval) {
      this.spawnShooter();
      this.lastShooterSpawn = this.time.now;
    }

    this.shooters.children.entries.forEach(shooter => {
      if (!this.lastShooterShot[shooter.id]) {
        this.lastShooterShot[shooter.id] = 0;
      }

      if (this.time.now - this.lastShooterShot[shooter.id] > c.shooterShootInterval) {
        this.shootProjectile(shooter);
        this.lastShooterShot[shooter.id] = this.time.now;
      }

      if (shooter.x < -50 || shooter.x > c.width + 50 ||
          shooter.y < 0 || shooter.y > c.height + 50) {
        shooter.destroy();
      }
    });

    this.projectiles.children.entries.forEach(projectile => {
      if (projectile.x < -20 || projectile.x > c.width + 20 ||
          projectile.y < -20 || projectile.y > c.height + 50) {
        projectile.destroy();
      }
    });

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

    this.hud.setText(`Coins: ${this.score}     Best: ${this.highScore}               Time: ${seconds}s`);

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
    const newRecord = this.score > this.highScore;
    if (newRecord) {
      this.highScore = this.score;
      saveHighScore(this.highScore);
      this.hud.setText(this.hud.text.replace(/Best: \d+/, `Best: ${this.highScore}`));
    }
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${newRecord ? 'New best! ' : ''}${this.score} coins collected\nPress R to try again`,
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
