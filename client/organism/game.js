// Game config and initialization
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

if (!sessionId) {
  alert('Сессия не найдена. Возврат в лобби.');
  window.location.href = '../';
}

const socket = io();

// Local player state
let myRole = 'organism';
let currentStage = 1;
let localDna = 0;
let health = 100;
let maxHealth = 100;
let lastDamageTime = 0;
const DAMAGE_COOLDOWN = 1000; // 1 second immunity after taking damage

// Connect to Session
socket.emit('join-session', { sessionId, role: 'organism' });

// Global state synced from server
let currentWorld = null;
let activeGenome = {};
let activeBlocks = [];
let speedMultiplier = 1.0;
let collectionRadius = 1.0;
let isDead = false;

// Socket Event Receivers
socket.on('session-started', ({ stage, state, world }) => {
  currentStage = stage;
  localDna = state.dna;
  health = state.health;
  maxHealth = state.maxHealth;
  currentWorld = world;
  activeGenome = state.genome;
  activeBlocks = state.activeBlocks;
  speedMultiplier = state.speedMultiplier;
  collectionRadius = state.collectionRadius;

  updateHUD();

  // Hide loading screen
  document.getElementById('waiting-screen').style.display = 'none';

  // Toggle Geneticist status on HUD
  const genStatus = document.getElementById('hud-geneticist-status');
  if (state.geneticistSocketId) {
    genStatus.className = 'status-badge connected';
    genStatus.innerText = 'НА СВЯЗИ';
  } else {
    genStatus.className = 'status-badge disconnected';
    genStatus.innerText = 'ОТКЛЮЧЕН';
  }

  // Start/Restart Phaser Game
  startGame();
});

socket.on('player-disconnected', ({ role }) => {
  if (role === 'geneticist') {
    const genStatus = document.getElementById('hud-geneticist-status');
    genStatus.className = 'status-badge disconnected';
    genStatus.innerText = 'ОТКЛЮЧЕН';
  }
});

socket.on('session-started', ({ state }) => {
  // If geneticist joins later
  const genStatus = document.getElementById('hud-geneticist-status');
  if (state.geneticistSocketId) {
    genStatus.className = 'status-badge connected';
    genStatus.innerText = 'НА СВЯЗИ';
  }
});

socket.on('health-updated', ({ health: newH, maxHealth: newMax, isDead: dead }) => {
  health = newH;
  maxHealth = newMax;
  isDead = dead;
  updateHUD();

  if (phaserGame && phaserGame.scene && phaserGame.scene.scenes[0]) {
    phaserGame.scene.scenes[0].triggerDamageFlash();
  }
});

socket.on('food-collected', ({ foodId, gain, dna, world }) => {
  localDna = dna;
  currentWorld = world;
  updateHUD();

  if (phaserGame && phaserGame.scene && phaserGame.scene.scenes[0]) {
    const scene = phaserGame.scene.scenes[0];
    scene.onFoodCollected(foodId, gain);
  }
});

socket.on('mutation-applied', ({ mutationId, state }) => {
  activeGenome = state.genome;
  activeBlocks = state.activeBlocks;
  speedMultiplier = state.speedMultiplier;
  collectionRadius = state.collectionRadius;
  localDna = state.dna;
  health = state.health;
  maxHealth = state.maxHealth;
  updateHUD();

  if (phaserGame && phaserGame.scene && phaserGame.scene.scenes[0]) {
    const scene = phaserGame.scene.scenes[0];
    scene.onMutationApplied(mutationId);
  }
});

socket.on('next-stage', ({ stage, state, world }) => {
  currentStage = stage;
  localDna = state.dna;
  health = state.health;
  maxHealth = state.maxHealth;
  currentWorld = world;
  activeGenome = state.genome;
  activeBlocks = state.activeBlocks;
  speedMultiplier = state.speedMultiplier;
  collectionRadius = state.collectionRadius;

  updateHUD();

  if (phaserGame && phaserGame.scene && phaserGame.scene.scenes[0]) {
    const scene = phaserGame.scene.scenes[0];
    scene.transitionToNextStage();
  }
});

socket.on('terminal-updated', ({ terminalId, progress, hacked, terminals }) => {
  if (currentWorld) {
    currentWorld.terminals = terminals;
  }
  if (phaserGame && phaserGame.scene && phaserGame.scene.scenes[0]) {
    const scene = phaserGame.scene.scenes[0];
    scene.onTerminalUpdated(terminalId, progress, hacked);
  }
});

socket.on('game-over', ({ endingType }) => {
  // Let Geneticist trigger overlay. Organism will freeze and also show ending.
  isDead = true;
  if (phaserGame) {
    phaserGame.destroy(true);
  }

  let endingTitle = '';
  let endingDesc = '';
  
  if (endingType === 'extinction') {
    endingTitle = 'ГЕНЕТИЧЕСКИЙ КРАХ (ВЫМИРАНИЕ)';
    endingDesc = 'Вы потеряли все жизненные силы. Эволюционная ветвь зашла в тупик.';
  } else if (endingType === 'cyber') {
    endingTitle = 'ФИНАЛ А: ТЕХНО-ТРАНСЦЕНДЕНТНОСТЬ';
    endingDesc = 'Ваш геном оцифрован и загружен в квантовый суперкомпьютер. Плотские оковы сброшены, вы стали бесконечным сетевым сознанием.';
  } else if (endingType === 'nature') {
    endingTitle = 'ФИНАЛ Б: ХРАНИТЕЛЬ БИОСФЕРЫ';
    endingDesc = 'Планета озеленена и возрождена. Вы слились воедино с Великим Симбиотическим Древом, став душой новой дикой природы.';
  } else if (endingType === 'weapon') {
    endingTitle = 'ФИНАЛ В: АБСОЛЮТНЫЙ ХИЩНИК';
    endingDesc = 'Реактор взорван, очищая планету от угроз. Поглотив радиоактивный распад, вы выросли в несокрушимого титана постапокалиптического мира.';
  }

  const overlay = document.createElement('div');
  overlay.className = 'game-over-overlay';
  overlay.innerHTML = `
    <div class="game-over-content">
      <h1 class="ending-title">${endingTitle}</h1>
      <p class="ending-desc">${endingDesc}</p>
      <button class="btn-restart" onclick="window.location.reload()">НАЧАТЬ ЗАНОВО</button>
    </div>
  `;
  document.body.appendChild(overlay);
});

socket.on('error-msg', (msg) => {
  document.getElementById('connection-status-msg').innerText = 'Ошибка: ' + msg;
});

// Update HUD texts
function updateHUD() {
  let stageText = '';
  let targetText = '';

  switch (currentStage) {
    case 1:
      stageText = '1/4 Клетка (Бульон)';
      targetText = 'Собирайте зеленые молекулы белков. Копите ДНК. Опасайтесь красных токсичных спор! Ждите, пока Генетик внедряет мутации.';
      break;
    case 2:
      stageText = '2/4 Водный мир';
      targetText = 'Плавайте в океане. Собирайте синие водоросли. Избегайте медуз (они движутся!). Для перехода на сушу потребуются Плавники и Жабры.';
      break;
    case 3:
      stageText = '3/4 Суша (Рептилия)';
      targetText = 'Исследуйте поверхность. Собирайте желтые плоды. Берегитесь потоков лавы. Генетику необходимо развить ваши Конечности и Мозг.';
      break;
    case 4:
      stageText = '4/4 Разумный Гуманоид';
      targetText = 'Найдите заброшенную базу. Собирайте фиолетовые ядра батарей. Ищите 3 терминала взлома. Дойдите до терминала и Удерживайте ПРОБЕЛ для взлома. Завершите симуляцию!';
      break;
  }

  document.getElementById('hud-stage-name').innerText = stageText;
  document.getElementById('hud-dna-value').innerText = localDna;
  
  const hPercent = Math.max(0, (health / maxHealth) * 100);
  document.getElementById('hud-health-bar').style.width = `${hPercent}%`;
  document.getElementById('hud-health-val').innerText = `${health} / ${maxHealth} HP`;
  document.getElementById('target-desc').innerText = targetText;
}


// Phaser 3 Implementation
let phaserGame = null;

function startGame() {
  if (phaserGame) {
    phaserGame.destroy(true);
  }

  const config = {
    type: Phaser.AUTO,
    parent: 'game-canvas-container',
    width: window.innerWidth,
    height: window.innerHeight,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scene: [EvolutionScene]
  };

  phaserGame = new Phaser.Game(config);
}

// Handle window resizing
window.addEventListener('resize', () => {
  if (phaserGame) {
    phaserGame.scale.resize(window.innerWidth, window.innerHeight);
  }
});


class EvolutionScene extends Phaser.Scene {
  constructor() {
    super('EvolutionScene');
  }

  create() {
    // Generate all sprites procedurally on the canvas
    this.createDynamicTextures();

    // Set world size according to current stage bounds
    const worldW = currentWorld.width;
    const worldH = currentWorld.height;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    // Draw grid background based on stage
    this.drawBackground(worldW, worldH);

    // Groups
    this.foodsGroup = this.physics.add.group();
    this.hazardsGroup = this.physics.add.group();
    this.terminalsGroup = this.physics.add.staticGroup();

    // Populate elements from the generated world
    this.populateWorld();

    // Create Organism Container
    this.createOrganism();

    // Camera setting
    this.cameras.main.startFollow(this.organismContainer, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.0);

    // Controls setup
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Dynamic environmental particles (ambient soup/dust)
    this.createAmbientParticles(worldW, worldH);

    // Text label for terminals UI
    this.terminalPromptText = this.add.text(0, 0, '', {
      fontFamily: 'Montserrat',
      fontSize: '14px',
      color: '#00e5ff',
      backgroundColor: '#000000bb',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    // Mutation upgrade particle emitter
    this.mutationParticles = this.add.particles(0, 0, 'particle_dust', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.8, end: 0 },
      blendMode: 'ADD',
      lifespan: 800,
      emitting: false
    });

    // Time of last coordinate update send
    this.lastPositionUpdate = 0;
  }

  // Create procedural textures on the fly
  createDynamicTextures() {
    // 1. Particle dust
    const dust = this.textures.createCanvas('particle_dust', 8, 8);
    const ctxDust = dust.context;
    ctxDust.fillStyle = '#ffffff';
    ctxDust.beginPath();
    ctxDust.arc(4, 4, 3, 0, Math.PI * 2);
    ctxDust.fill();
    dust.refresh();

    // 2. Cell Core (bioluminescent green/cyan circle)
    const core = this.textures.createCanvas('cell_core', 64, 64);
    const ctxCore = core.context;
    let grad = ctxCore.createRadialGradient(32, 32, 5, 32, 32, 32);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#8ee8ff');
    grad.addColorStop(0.7, '#1b7bff');
    grad.addColorStop(1, 'rgba(27, 123, 255, 0)');
    ctxCore.fillStyle = grad;
    ctxCore.beginPath();
    ctxCore.arc(32, 32, 32, 0, Math.PI * 2);
    ctxCore.fill();
    core.refresh();

    // 3. Tail Block (Flagellum / Fin)
    const tail = this.textures.createCanvas('block_tail', 40, 20);
    const ctxTail = tail.context;
    ctxTail.fillStyle = '#6bc1b8';
    ctxTail.strokeStyle = '#00ffff';
    ctxTail.lineWidth = 2;
    ctxTail.beginPath();
    ctxTail.moveTo(40, 10);
    ctxTail.quadraticCurveTo(20, 20, 0, 12);
    ctxTail.quadraticCurveTo(10, 10, 0, 8);
    ctxTail.quadraticCurveTo(20, 0, 40, 10);
    ctxTail.fill();
    ctxTail.stroke();
    tail.refresh();

    // 4. Shell Block
    const shell = this.textures.createCanvas('block_shell', 50, 20);
    const ctxShell = shell.context;
    ctxShell.fillStyle = '#ff7b54';
    ctxShell.strokeStyle = '#ff3b00';
    ctxShell.lineWidth = 2;
    ctxShell.beginPath();
    ctxShell.roundRect(0, 0, 50, 20, 8);
    ctxShell.fill();
    ctxShell.stroke();
    shell.refresh();

    // 5. Sensor Block (Receptor)
    const sensor = this.textures.createCanvas('block_sensor', 24, 24);
    const ctxSensor = sensor.context;
    ctxSensor.fillStyle = '#ffe15d';
    ctxSensor.strokeStyle = '#ffd700';
    ctxSensor.lineWidth = 2;
    ctxSensor.beginPath();
    ctxSensor.arc(12, 12, 8, 0, Math.PI * 2);
    ctxSensor.fill();
    ctxSensor.stroke();
    // Drawing connection line
    ctxSensor.strokeStyle = '#fff';
    ctxSensor.beginPath();
    ctxSensor.moveTo(12, 12);
    ctxSensor.lineTo(12, 24);
    ctxSensor.stroke();
    sensor.refresh();

    // 6. Leg Block
    const leg = this.textures.createCanvas('block_leg', 16, 40);
    const ctxLeg = leg.context;
    ctxLeg.fillStyle = '#884a39';
    ctxLeg.strokeStyle = '#ffa500';
    ctxLeg.lineWidth = 2;
    ctxLeg.beginPath();
    ctxLeg.roundRect(0, 0, 16, 40, 6);
    ctxLeg.fill();
    ctxLeg.stroke();
    leg.refresh();

    // 7. Brain Block
    const brain = this.textures.createCanvas('block_brain', 40, 30);
    const ctxBrain = brain.context;
    ctxBrain.fillStyle = '#c780fa';
    ctxBrain.strokeStyle = '#ee82ee';
    ctxBrain.lineWidth = 2;
    ctxBrain.beginPath();
    ctxBrain.roundRect(0, 0, 40, 30, 10);
    ctxBrain.fill();
    ctxBrain.stroke();
    brain.refresh();

    // 8. Foods (Different colors for different stages)
    const foodColors = {
      protein: '#39ff14', // bright green
      algae: '#00e5ff',   // bright cyan
      fruit: '#ffe15d',   // bright yellow
      battery: '#ff00ff'  // glowing purple
    };

    for (const [key, color] of Object.entries(foodColors)) {
      const foodCanvas = this.textures.createCanvas(`food_${key}`, 24, 24);
      const ctxFood = foodCanvas.context;
      let gradFood = ctxFood.createRadialGradient(12, 12, 2, 12, 12, 12);
      gradFood.addColorStop(0, '#ffffff');
      gradFood.addColorStop(0.4, color);
      gradFood.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctxFood.fillStyle = gradFood;
      ctxFood.beginPath();
      ctxFood.arc(12, 12, 12, 0, Math.PI * 2);
      ctxFood.fill();
      foodCanvas.refresh();
    }

    // 9. Hazards
    // Spore
    const spore = this.textures.createCanvas('hazard_spore', 32, 32);
    const ctxSpore = spore.context;
    ctxSpore.fillStyle = '#ff0055';
    ctxSpore.beginPath();
    ctxSpore.arc(16, 16, 10, 0, Math.PI * 2);
    ctxSpore.fill();
    // draw spikes
    ctxSpore.strokeStyle = '#ff0055';
    ctxSpore.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      let angle = (i * Math.PI) / 4;
      ctxSpore.beginPath();
      ctxSpore.moveTo(16, 16);
      ctxSpore.lineTo(16 + Math.cos(angle) * 16, 16 + Math.sin(angle) * 16);
      ctxSpore.stroke();
    }
    spore.refresh();

    // Jellyfish
    const jelly = this.textures.createCanvas('hazard_jellyfish', 48, 48);
    const ctxJelly = jelly.context;
    ctxJelly.fillStyle = 'rgba(255, 0, 127, 0.6)';
    ctxJelly.beginPath();
    ctxJelly.arc(24, 20, 16, Math.PI, 0); // Bell
    ctxJelly.fill();
    ctxJelly.strokeStyle = '#ff007f';
    ctxJelly.lineWidth = 2;
    // Tentacles
    for (let x = 12; x <= 36; x += 6) {
      ctxJelly.beginPath();
      ctxJelly.moveTo(x, 20);
      ctxJelly.quadraticCurveTo(x - 4, 30, x, 44);
      ctxJelly.stroke();
    }
    jelly.refresh();

    // Lava pit (just a glowing circle)
    const lava = this.textures.createCanvas('hazard_lava', 128, 128);
    const ctxLava = lava.context;
    let gradLava = ctxLava.createRadialGradient(64, 64, 10, 64, 64, 64);
    gradLava.addColorStop(0, '#ff3b00');
    gradLava.addColorStop(0.5, '#ff7b00');
    gradLava.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctxLava.fillStyle = gradLava;
    ctxLava.beginPath();
    ctxLava.arc(64, 64, 64, 0, Math.PI * 2);
    ctxLava.fill();
    lava.refresh();

    // Laser Turret
    const laser = this.textures.createCanvas('hazard_laser', 64, 64);
    const ctxLaser = laser.context;
    ctxLaser.fillStyle = '#111';
    ctxLaser.strokeStyle = '#ff0055';
    ctxLaser.lineWidth = 3;
    ctxLaser.beginPath();
    ctxLaser.arc(32, 32, 20, 0, Math.PI * 2);
    ctxLaser.fill();
    ctxLaser.stroke();
    // Inner lens
    ctxLaser.fillStyle = '#ff0055';
    ctxLaser.beginPath();
    ctxLaser.arc(32, 32, 8, 0, Math.PI * 2);
    ctxLaser.fill();
    laser.refresh();

    // 10. Cyber Terminal
    const term = this.textures.createCanvas('terminal_sprite', 96, 96);
    const ctxTerm = term.context;
    ctxTerm.fillStyle = '#151b26';
    ctxTerm.strokeStyle = '#00e5ff';
    ctxTerm.lineWidth = 3;
    ctxTerm.beginPath();
    ctxTerm.roundRect(16, 16, 64, 64, 10);
    ctxTerm.fill();
    ctxTerm.stroke();
    // Screen lines
    ctxTerm.fillStyle = '#002233';
    ctxTerm.fillRect(24, 24, 48, 36);
    ctxTerm.strokeStyle = '#00a8ff';
    ctxTerm.lineWidth = 1;
    ctxTerm.beginPath();
    ctxTerm.moveTo(24, 30); ctxTerm.lineTo(72, 30);
    ctxTerm.moveTo(24, 40); ctxTerm.lineTo(72, 40);
    ctxTerm.moveTo(24, 50); ctxTerm.lineTo(72, 50);
    ctxTerm.stroke();
    // Stand
    ctxTerm.fillStyle = '#333';
    ctxTerm.fillRect(40, 80, 16, 12);
    ctxTerm.fillRect(24, 90, 48, 6);
    term.refresh();
  }

  drawBackground(w, h) {
    const bgGraphics = this.add.graphics();
    bgGraphics.fillStyle(0x06070a, 1);
    bgGraphics.fillRect(0, 0, w, h);

    // Draw grid lines
    bgGraphics.lineStyle(1, 0x00e5ff, 0.03);
    const gridSize = 100;
    for (let x = 0; x < w; x += gridSize) {
      bgGraphics.strokeLineShape(new Phaser.Geom.Line(x, 0, x, h));
    }
    for (let y = 0; y < h; y += gridSize) {
      bgGraphics.strokeLineShape(new Phaser.Geom.Line(0, y, w, y));
    }

    // Decorate depending on Stage
    if (currentStage === 3) {
      // Lava cracks or land borders
      bgGraphics.lineStyle(3, 0xff3b00, 0.05);
      for (let i = 0; i < 20; i++) {
        let lx = Math.random() * w;
        let ly = Math.random() * h;
        bgGraphics.strokeCircle(lx, ly, Math.random() * 200 + 100);
      }
    } else if (currentStage === 4) {
      // Scientific floors
      bgGraphics.lineStyle(1.5, 0x00a8ff, 0.05);
      for (let x = 0; x < w; x += 400) {
        bgGraphics.strokeLineShape(new Phaser.Geom.Line(x, 0, x, h));
      }
      for (let y = 0; y < h; y += 400) {
        bgGraphics.strokeLineShape(new Phaser.Geom.Line(0, y, w, y));
      }
    }
  }

  createAmbientParticles(w, h) {
    // Soft floating particles in the background
    this.ambientParticles = [];
    const count = 60;
    for (let i = 0; i < count; i++) {
      const p = this.add.sprite(Math.random() * w, Math.random() * h, 'particle_dust');
      p.setAlpha(Math.random() * 0.4 + 0.1);
      p.setScale(Math.random() * 1.5 + 0.5);
      p.setScrollFactor(0.9); // Parallax effect
      
      let pColor = 0x00e5ff;
      if (currentStage === 3) pColor = 0xffa500;
      else if (currentStage === 4) pColor = 0xff00ff;
      p.setTint(pColor);

      this.ambientParticles.push({
        sprite: p,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20
      });
    }
  }

  createOrganism() {
    // The player cell container
    this.organismContainer = this.add.container(currentWorld.width / 2, currentWorld.height / 2);
    this.physics.world.enable(this.organismContainer);
    
    // Add physics settings
    this.organismBody = this.organismContainer.body;
    this.organismBody.setCollideWorldBounds(true);

    // Assembly visuals from blocks
    this.rebuildOrganismVisuals();
  }

  rebuildOrganismVisuals() {
    // Clear all previous children in container
    this.organismContainer.removeAll(true);

    // Draw active blocks sent by the server state
    activeBlocks.forEach(block => {
      let spriteName = 'cell_core';
      let rotation = 0;

      // Select sprite relative to block type
      switch (block.type) {
        case 'core':
          spriteName = 'cell_core';
          break;
        case 'tail':
          spriteName = 'block_tail';
          rotation = Math.PI; // Face backwards
          break;
        case 'shell':
          spriteName = 'block_shell';
          break;
        case 'sensor':
          spriteName = 'block_sensor';
          break;
        case 'leg':
          spriteName = 'block_leg';
          break;
        case 'brain':
          spriteName = 'block_brain';
          break;
      }

      const spr = this.add.sprite(block.x, block.y, spriteName);
      spr.setTint(block.color);
      spr.rotation = rotation;
      
      // Save block type for animations
      spr.blockType = block.type;
      spr.originalOffset = { x: block.x, y: block.y };

      this.organismContainer.add(spr);
    });

    // Recalculate physics body size based on block boundaries
    let minX = -32, maxX = 32, minY = -32, maxY = 32;
    activeBlocks.forEach(b => {
      minX = Math.min(minX, b.x - 20);
      maxX = Math.max(maxX, b.x + 20);
      minY = Math.min(minY, b.y - 20);
      maxY = Math.max(maxY, b.y + 20);
    });

    const w = maxX - minX;
    const h = maxY - minY;
    this.organismBody.setSize(w, h);
    this.organismBody.setOffset(minX, minY);
  }

  populateWorld() {
    // Clear old lists
    this.foodsGroup.clear(true, true);
    this.hazardsGroup.clear(true, true);
    this.terminalsGroup.clear(true, true);

    // 1. Spawning Foods
    currentWorld.foods.forEach(food => {
      const fSprite = this.physics.add.sprite(food.x, food.y, `food_${food.type}`);
      fSprite.foodId = food.id;
      fSprite.foodType = food.type;
      fSprite.foodValue = food.value;
      
      // Floating pulse animation
      this.tweens.add({
        targets: fSprite,
        scale: 1.25,
        alpha: 0.85,
        duration: 1000 + Math.random() * 500,
        yoyo: true,
        repeat: -1
      });

      this.foodsGroup.add(fSprite);
    });

    // 2. Spawning Hazards
    currentWorld.hazards.forEach(hazard => {
      let sprName = 'hazard_spore';
      if (hazard.type === 'jellyfish') sprName = 'hazard_jellyfish';
      else if (hazard.type === 'lava') sprName = 'hazard_lava';
      else if (hazard.type === 'laser') sprName = 'hazard_laser';

      const hSprite = this.physics.add.sprite(hazard.x, hazard.y, sprName);
      hSprite.hazardId = hazard.id;
      hSprite.damage = hazard.damage;
      
      if (hazard.type === 'lava') {
        hSprite.setAlpha(0.7).setScale(hazard.radius / 64).setImmovable(true);
        hSprite.body.setCircle(hazard.radius - 20);
      } else if (hazard.type === 'spore') {
        hSprite.body.setCircle(15);
        this.tweens.add({
          targets: hSprite,
          angle: 360,
          duration: 4000,
          repeat: -1
        });
      } else if (hazard.type === 'jellyfish') {
        hSprite.body.setCircle(20);
        hSprite.body.setVelocity(hazard.vx, hazard.vy);
        hSprite.body.setCollideWorldBounds(true);
        hSprite.body.setBounce(1);
      } else if (hazard.type === 'laser') {
        hSprite.setImmovable(true);
        // Animate laser turret rotating
        this.tweens.add({
          targets: hSprite,
          angle: 360,
          duration: 6000,
          repeat: -1
        });
      }

      this.hazardsGroup.add(hSprite);
    });

    // 3. Spawning Terminals (only in stage 4)
    if (currentStage === 4 && currentWorld.terminals) {
      currentWorld.terminals.forEach(term => {
        const tSprite = this.add.sprite(term.x, term.y, 'terminal_sprite');
        tSprite.terminalId = term.id;
        tSprite.labelName = term.label;
        tSprite.type = term.type;
        
        // Add physics static
        this.physics.add.existing(tSprite, true);

        // Progress bar graphics overlaying terminal
        const bar = this.add.graphics();
        tSprite.progressBar = bar;
        this.drawTerminalProgressBar(tSprite, term.hackProgress);

        this.terminalsGroup.add(tSprite);
      });
    }
  }

  drawTerminalProgressBar(termSprite, progress) {
    const bar = termSprite.progressBar;
    bar.clear();
    
    // Draw background
    bar.fillStyle(0x000000, 0.7);
    bar.fillRect(termSprite.x - 30, termSprite.y - 65, 60, 6);
    
    // Draw fill
    let barColor = 0x00e5ff;
    if (termSprite.type === 'nature') barColor = 0x39ff14;
    else if (termSprite.type === 'weapon') barColor = 0xff0055;
    
    bar.fillStyle(barColor, 1);
    bar.fillRect(termSprite.x - 30, termSprite.y - 65, 60 * (progress / 100), 6);
    
    // Draw border
    bar.lineStyle(1, 0xffffff, 0.4);
    bar.strokeRect(termSprite.x - 30, termSprite.y - 65, 60, 6);
  }

  update(time, delta) {
    if (isDead || !this.organismContainer) return;

    // 1. Controls & Movement
    let speed = 150 * speedMultiplier;
    let ax = 0;
    let ay = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      ax = -1;
    } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
      ax = 1;
    }

    if (this.cursors.up.isDown || this.wasd.up.isDown) {
      ay = -1;
    } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
      ay = 1;
    }

    // Apply movement physics feel by stage
    if (currentStage === 1 || currentStage === 2) {
      // Fluid environment (acceleration + drag)
      this.organismBody.setDrag(120);
      
      if (ax !== 0 || ay !== 0) {
        // Normalize vector
        const len = Math.sqrt(ax * ax + ay * ay);
        const forceX = (ax / len) * speed * 2;
        const forceY = (ay / len) * speed * 2;
        this.organismBody.setAcceleration(forceX, forceY);
        
        // Rotate body to face velocity direction
        let angle = Math.atan2(forceY, forceX);
        this.organismContainer.rotation = Phaser.Math.Angle.RotateTo(
          this.organismContainer.rotation,
          angle,
          0.05
        );
      } else {
        this.organismBody.setAcceleration(0, 0);
      }
    } else {
      // Land environment (direct velocity + friction animation)
      this.organismBody.setDrag(0);
      this.organismBody.setAcceleration(0, 0);

      if (ax !== 0 || ay !== 0) {
        const len = Math.sqrt(ax * ax + ay * ay);
        const vx = (ax / len) * speed;
        const vy = (ay / len) * speed;
        
        this.organismBody.setVelocity(vx, vy);

        // Turn organism towards facing direction
        let angle = Math.atan2(vy, vx);
        this.organismContainer.rotation = Phaser.Math.Angle.RotateTo(
          this.organismContainer.rotation,
          angle,
          0.1
        );

        // Leg walking animation (sine oscillation)
        this.organismContainer.list.forEach(spr => {
          if (spr.blockType === 'leg') {
            const timeVal = time * 0.015;
            // Alternate leg wiggles
            const factor = spr.originalOffset.x < 0 ? 1 : -1;
            spr.y = spr.originalOffset.y + Math.sin(timeVal) * 5;
            spr.x = spr.originalOffset.x + Math.cos(timeVal) * 3 * factor;
          }
        });
      } else {
        this.organismBody.setVelocity(0, 0);
        
        // Return legs to original position
        this.organismContainer.list.forEach(spr => {
          if (spr.blockType === 'leg') {
            spr.x = spr.originalOffset.x;
            spr.y = spr.originalOffset.y;
          }
        });
      }
    }

    // 2. Ambient Particles Update
    this.ambientParticles.forEach(p => {
      p.sprite.x += p.vx * (delta / 1000);
      p.sprite.y += p.vy * (delta / 1000);

      // Wrap boundaries
      if (p.sprite.x < 0) p.sprite.x = currentWorld.width;
      else if (p.sprite.x > currentWorld.width) p.sprite.x = 0;
      if (p.sprite.y < 0) p.sprite.y = currentWorld.height;
      else if (p.sprite.y > currentWorld.height) p.sprite.y = 0;
    });

    // 3. Socket updates throttle (50ms)
    if (time - this.lastPositionUpdate > 50) {
      socket.emit('organism-update', {
        position: { x: this.organismContainer.x, y: this.organismContainer.y }
      });
      this.lastPositionUpdate = time;
    }

    // 4. Overlap & Collision checks
    this.physics.overlap(this.organismContainer, this.foodsGroup, this.onOverlapFood, null, this);
    this.physics.overlap(this.organismContainer, this.hazardsGroup, this.onOverlapHazard, null, this);

    // 5. Magnet effect (Chemotaxis / Receptor mutation)
    if (activeGenome.receptor) {
      const pullRad = activeGenome.receptor ? 250 * collectionRadius : 80;
      this.foodsGroup.getChildren().forEach(food => {
        const dist = Phaser.Math.Distance.Between(
          this.organismContainer.x,
          this.organismContainer.y,
          food.x,
          food.y
        );
        if (dist < pullRad) {
          // Pull food towards organism
          const angle = Phaser.Math.Angle.Between(
            food.x,
            food.y,
            this.organismContainer.x,
            this.organismContainer.y
          );
          // Pull speed increases as it gets closer
          const pullSpeed = (300 - dist) * 1.5;
          food.body.setVelocity(Math.cos(angle) * pullSpeed, Math.sin(angle) * pullSpeed);
        } else {
          // Stop velocity if out of range
          food.body.setVelocity(0, 0);
        }
      });
    }

    // 6. Terminals proximity and hack triggers
    this.updateTerminalProximity();
  }

  updateTerminalProximity() {
    if (currentStage !== 4) return;
    
    let closestTerminal = null;
    let closestDist = 100; // Activation distance

    this.terminalsGroup.getChildren().forEach(term => {
      const dist = Phaser.Math.Distance.Between(
        this.organismContainer.x,
        this.organismContainer.y,
        term.x,
        term.y
      );
      if (dist < closestDist) {
        closestDist = dist;
        closestTerminal = term;
      }
    });

    if (closestTerminal) {
      const serverTerm = currentWorld.terminals.find(t => t.id === closestTerminal.terminalId);
      
      if (serverTerm.hacked) {
        this.terminalPromptText.setVisible(false);
      } else {
        this.terminalPromptText.setPosition(closestTerminal.x, closestTerminal.y - 85);
        this.terminalPromptText.setText(`[${serverTerm.label}]\nУдерживайте ПРОБЕЛ для дешифровки... (${Math.round(serverTerm.hackProgress)}%)`);
        this.terminalPromptText.setVisible(true);

        if (this.spaceKey.isDown) {
          // Send hack tick to server
          socket.emit('hack-terminal', { terminalId: closestTerminal.terminalId });
          
          // Emit coding particles
          if (Math.random() < 0.3) {
            this.mutationParticles.emitParticleAt(closestTerminal.x, closestTerminal.y - 15);
          }
        }
      }
    } else {
      this.terminalPromptText.setVisible(false);
    }
  }

  onOverlapFood(organism, foodSprite) {
    // Collect food
    socket.emit('collect-food', { foodId: foodSprite.foodId });
    foodSprite.destroy();
  }

  onOverlapHazard(organism, hazardSprite) {
    const now = this.time.now;
    if (now - lastDamageTime > DAMAGE_COOLDOWN) {
      lastDamageTime = now;
      socket.emit('take-damage', {
        amount: hazardSprite.damage,
        reason: this.getDamageReason(hazardSprite.texture.key)
      });
    }
  }

  getDamageReason(key) {
    if (key === 'hazard_spore') return 'Токсичные Споры';
    if (key === 'hazard_jellyfish') return 'Ожог Медузы';
    if (key === 'hazard_lava') return 'Потоки Лавы';
    if (key === 'hazard_laser') return 'Лазерная турель';
    return 'Внешняя Среда';
  }

  onFoodCollected(foodId, gain) {
    // Create floating text animation at current organism position
    const text = this.add.text(
      this.organismContainer.x,
      this.organismContainer.y - 40,
      `+${gain} DNA`,
      { fontFamily: 'Orbitron', fontSize: '16px', color: '#00e5ff', fontStyle: 'bold' }
    ).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: text.y - 50,
      alpha: 0,
      duration: 1000,
      onComplete: () => text.destroy()
    });
  }

  onMutationApplied(mutationId) {
    // Rebuild visual layout
    this.rebuildOrganismVisuals();

    // Trigger green glow burst
    this.mutationParticles.setTint(0x39ff14);
    this.mutationParticles.emitParticle(15, this.organismContainer.x, this.organismContainer.y);
  }

  onTerminalUpdated(terminalId, progress, hacked) {
    this.terminalsGroup.getChildren().forEach(term => {
      if (term.terminalId === terminalId) {
        this.drawTerminalProgressBar(term, progress);
        
        if (hacked) {
          // Play green expansion shockwave
          this.tweens.add({
            targets: term,
            scale: 1.4,
            alpha: 0.5,
            duration: 300,
            yoyo: true
          });
        }
      }
    });
  }

  triggerDamageFlash() {
    // Red color overlay flash
    this.cameras.main.flash(150, 255, 0, 85);
  }

  transitionToNextStage() {
    // Redraw screen backgrounds and groups
    const worldW = currentWorld.width;
    const worldH = currentWorld.height;
    
    // Clear and redraw grid
    this.drawBackground(worldW, worldH);
    
    // Reset bounds
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    // Relocate organism to center
    this.organismContainer.setPosition(worldW / 2, worldH / 2);

    // Rebuild foods/hazards
    this.populateWorld();

    // Redraw ambient soup particles
    this.ambientParticles.forEach(p => p.sprite.destroy());
    this.createAmbientParticles(worldW, worldH);

    // Visual evolutionary flash
    this.cameras.main.flash(500, 255, 255, 255);
    
    this.rebuildOrganismVisuals();
  }
}
