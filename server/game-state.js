/**
 * Game State Manager and Procedural World Generator
 */

// Mutation Catalog
const MUTATIONS = {
  // Stage 1 (Cell)
  flagellum: {
    id: "flagellum",
    name: "Жгутик",
    cost: 10,
    stage: 1,
    description: "Увеличивает скорость перемещения на 30%. Добавляет жгутик.",
    prereq: null,
    effects: { speedMultiplier: 1.3 },
    blockType: "tail"
  },
  membrane: {
    id: "membrane",
    name: "Эластичная мембрана",
    cost: 15,
    stage: 1,
    description: "Снижает получаемый урон от шипов и токсинов на 20%.",
    prereq: null,
    effects: { damageReduction: 0.2 },
    blockType: "shell"
  },
  receptor: {
    id: "receptor",
    name: "Хеморецептор",
    cost: 12,
    stage: 1,
    description: "Увеличивает радиус сбора питательных веществ на 50%.",
    prereq: null,
    effects: { collectionRadius: 1.5 },
    blockType: "sensor"
  },

  // Stage 2 (Aquatic)
  tail_fin: {
    id: "tail_fin",
    name: "Хвостовой плавник",
    cost: 35,
    stage: 2,
    description: "Значительно улучшает скорость плавания. Требует: Жгутик.",
    prereq: "flagellum",
    effects: { speedMultiplier: 1.5 },
    blockType: "tail"
  },
  gills: {
    id: "gills",
    name: "Жабры",
    cost: 30,
    stage: 2,
    description: "Медленно восстанавливает здоровье (1 HP/сек) в воде.",
    prereq: null,
    effects: { regenRate: 1 },
    blockType: "sensor"
  },
  chitin_shell: {
    id: "chitin_shell",
    name: "Хитиновый панцирь",
    cost: 40,
    stage: 2,
    description: "Надежно защищает от укусов хищников. Снижает урон на 30%. Требует: Мембрана.",
    prereq: "membrane",
    effects: { damageReduction: 0.35 },
    blockType: "shell"
  },

  // Stage 3 (Terrestrial)
  amphibian_legs: {
    id: "amphibian_legs",
    name: "Земноводные лапы",
    cost: 60,
    stage: 3,
    description: "Позволяет передвигаться по суше. Скорость +40%. Требует: Хвостовой плавник.",
    prereq: "tail_fin",
    effects: { speedMultiplier: 1.4, canWalk: true },
    blockType: "leg"
  },
  primitive_brain: {
    id: "primitive_brain",
    name: "Первичный мозг",
    cost: 50,
    stage: 3,
    description: "Подсвечивает питательные вещества на радаре Генетика.",
    prereq: "receptor",
    effects: { radarRange: 500 },
    blockType: "brain"
  },
  bone_armor: {
    id: "bone_armor",
    name: "Костяные пластины",
    cost: 70,
    stage: 3,
    description: "Отражает атаки хищников суши. Защита +40%. Требует: Хитиновый панцирь.",
    prereq: "chitin_shell",
    effects: { damageReduction: 0.5 },
    blockType: "shell"
  },

  // Stage 4 (Humanoid)
  bipedalism: {
    id: "bipedalism",
    name: "Прямохождение",
    cost: 110,
    stage: 4,
    description: "Максимальная подвижность и высота прыжка. Требует: Земноводные лапы.",
    prereq: "amphibian_legs",
    effects: { speedMultiplier: 1.7 },
    blockType: "leg"
  },
  cognitive_cortex: {
    id: "cognitive_cortex",
    name: "Кора полушарий",
    cost: 100,
    stage: 4,
    description: "Удваивает получаемые очки ДНК. Требует: Первичный мозг.",
    prereq: "primitive_brain",
    effects: { dnaMultiplier: 2.0 },
    blockType: "brain"
  },
  dermal_armor: {
    id: "dermal_armor",
    name: "Кожаная броня",
    cost: 120,
    stage: 4,
    description: "Повышает максимальное здоровье до 200 HP. Требует: Костяные пластины.",
    prereq: "bone_armor",
    effects: { maxHealth: 200, damageReduction: 0.65 },
    blockType: "shell"
  },
  cyber_interface: {
    id: "cyber_interface",
    name: "Нейроинтерфейс",
    cost: 140,
    stage: 4,
    description: "Позволяет взламывать древние терминалы для Техно-концовки.",
    prereq: "cognitive_cortex",
    effects: { hackSpeed: 2.0 },
    blockType: "sensor"
  }
};

const STAGES = {
  1: { name: "Первичный бульон (Клетка)", width: 2000, height: 2000, dnaToEvolve: 100 },
  2: { name: "Океанские глубины (Рыба)", width: 2400, height: 2000, dnaToEvolve: 250 },
  3: { name: "Выход на сушу (Рептилия)", width: 3000, height: 1600, dnaToEvolve: 500 },
  4: { name: "Венец эволюции (Гуманоид)", width: 2000, height: 2000, dnaToEvolve: 800 }
};

class GameSession {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.organismSocketId = null;
    this.geneticistSocketId = null;
    
    // Core game state
    this.stage = 1;
    this.dna = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.isDead = false;
    
    // Position tracking (updated by organism)
    this.position = { x: 500, y: 500 };
    
    // Upgrades
    this.genome = {}; // e.g. { flagellum: true }
    this.activeBlocks = [
      { type: "core", x: 0, y: 0, color: 0x4d96ff }
    ];

    // Stats history for Geneticist panel charts (limit 30 items)
    this.statsHistory = {
      health: [100],
      dna: [0],
      stages: [1],
      timestamps: [0]
    };
    this.startTime = Date.now();

    // Procedural world content
    this.world = this.generateWorld();
  }

  getStats() {
    // Calculate compound multipliers
    let speedMult = 1.0;
    let damageRed = 0.0;
    let collectRad = 1.0;
    let dnaMult = 1.0;
    let regen = 0;
    
    for (const mutationId in this.genome) {
      if (this.genome[mutationId]) {
        const mut = MUTATIONS[mutationId];
        if (mut.effects.speedMultiplier) speedMult *= mut.effects.speedMultiplier;
        if (mut.effects.damageReduction) damageRed = Math.max(damageRed, mut.effects.damageReduction);
        if (mut.effects.collectionRadius) collectRad *= mut.effects.collectionRadius;
        if (mut.effects.dnaMultiplier) dnaMult *= mut.effects.dnaMultiplier;
        if (mut.effects.regenRate) regen += mut.effects.regenRate;
      }
    }

    return {
      stage: this.stage,
      stageName: STAGES[this.stage].name,
      width: STAGES[this.stage].width,
      height: STAGES[this.stage].height,
      dnaToEvolve: STAGES[this.stage].dnaToEvolve,
      dna: this.dna,
      health: this.health,
      maxHealth: this.genome.dermal_armor ? 200 : 100,
      isDead: this.isDead,
      speedMultiplier: speedMult,
      damageReduction: damageRed,
      collectionRadius: collectRad,
      dnaMultiplier: dnaMult,
      regenRate: regen,
      activeBlocks: this.activeBlocks,
      genome: this.genome
    };
  }

  updateStatsHistory() {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    this.statsHistory.health.push(this.health);
    this.statsHistory.dna.push(this.dna);
    this.statsHistory.stages.push(this.stage);
    this.statsHistory.timestamps.push(elapsed);

    // Keep history length reasonable
    if (this.statsHistory.health.length > 30) {
      this.statsHistory.health.shift();
      this.statsHistory.dna.shift();
      this.statsHistory.stages.shift();
      this.statsHistory.timestamps.shift();
    }
  }

  generateWorld() {
    const stageConf = STAGES[this.stage];
    const foodCount = this.stage === 1 ? 80 : this.stage === 2 ? 60 : this.stage === 3 ? 50 : 40;
    const hazardCount = this.stage === 1 ? 25 : this.stage === 2 ? 35 : this.stage === 3 ? 30 : 25;
    
    const foods = [];
    const hazards = [];
    const terminals = []; // Only for Stage 4

    // Procedural generation of food
    for (let i = 0; i < foodCount; i++) {
      foods.push({
        id: `food_${i}`,
        x: Math.random() * (stageConf.width - 200) + 100,
        y: Math.random() * (stageConf.height - 200) + 100,
        type: this.stage === 1 ? "protein" : this.stage === 2 ? "algae" : this.stage === 3 ? "fruit" : "battery",
        value: this.stage === 1 ? 5 : this.stage === 2 ? 10 : this.stage === 3 ? 15 : 20
      });
    }

    // Procedural generation of hazards
    for (let i = 0; i < hazardCount; i++) {
      hazards.push({
        id: `hazard_${i}`,
        x: Math.random() * (stageConf.width - 300) + 150,
        y: Math.random() * (stageConf.height - 300) + 150,
        type: this.stage === 1 ? "spore" : this.stage === 2 ? "jellyfish" : this.stage === 3 ? "lava" : "laser",
        damage: this.stage === 1 ? 10 : this.stage === 2 ? 15 : this.stage === 3 ? 20 : 25,
        radius: this.stage === 1 ? 30 : this.stage === 2 ? 45 : this.stage === 3 ? 60 : 50,
        // Movement vector for ocean stage jellyfish
        vx: this.stage === 2 ? (Math.random() - 0.5) * 100 : 0,
        vy: this.stage === 2 ? (Math.random() - 0.5) * 100 : 0
      });
    }

    // Stage 4 Terminals (For different endings)
    if (this.stage === 4) {
      terminals.push({
        id: "term_cyber",
        x: 400,
        y: 400,
        label: "Основной Сервер Руин",
        type: "cyber",
        hackProgress: 0,
        hacked: false
      });
      terminals.push({
        id: "term_nature",
        x: 1600,
        y: 400,
        label: "Система Синтеза Биома",
        type: "nature",
        hackProgress: 0,
        hacked: false
      });
      terminals.push({
        id: "term_weapon",
        x: 1000,
        y: 1600,
        label: "Реактор Боевой Станции",
        type: "weapon",
        hackProgress: 0,
        hacked: false
      });
    }

    return {
      width: stageConf.width,
      height: stageConf.height,
      foods,
      hazards,
      terminals
    };
  }

  addBlock(type) {
    // Generate placement relative to core
    // Core is at 0,0. Let's arrange others around it.
    let xOffset = 0;
    let yOffset = 0;
    let color = 0x4d96ff;

    const countOfThisType = this.activeBlocks.filter(b => b.type === type).length;

    switch (type) {
      case "tail":
        xOffset = -30 - countOfThisType * 20;
        yOffset = 0;
        color = 0x6bc1b8;
        break;
      case "shell":
        // Alternate top and bottom
        xOffset = 0;
        yOffset = countOfThisType % 2 === 0 ? -25 : 25;
        color = 0xff7b54;
        break;
      case "sensor":
        xOffset = 25;
        yOffset = countOfThisType % 2 === 0 ? -15 : 15;
        color = 0xffe15d;
        break;
      case "leg":
        xOffset = countOfThisType % 2 === 0 ? -15 : 15;
        yOffset = 30;
        color = 0x884a39;
        break;
      case "brain":
        xOffset = 0;
        yOffset = -30;
        color = 0xc780fa;
        break;
      default:
        xOffset = 0;
        yOffset = 30;
    }

    this.activeBlocks.push({
      type,
      x: xOffset,
      y: yOffset,
      color
    });
  }

  buyMutation(mutationId) {
    const mut = MUTATIONS[mutationId];
    if (!mut) return { success: false, reason: "Mutation not found" };
    if (mut.stage > this.stage) return { success: false, reason: "Stage too low for this mutation" };
    if (this.genome[mutationId]) return { success: false, reason: "Mutation already acquired" };
    if (this.dna < mut.cost) return { success: false, reason: "Not enough DNA" };
    if (mut.prereq && !this.genome[mut.prereq]) {
      return { success: false, reason: `Requires mutation: ${MUTATIONS[mut.prereq].name}` };
    }

    // Deduct cost and apply
    this.dna -= mut.cost;
    this.genome[mutationId] = true;
    
    // Add physical block if defined
    if (mut.blockType) {
      this.addBlock(mut.blockType);
    }

    // Apply special stats adjustments
    if (mutationId === "dermal_armor") {
      this.maxHealth = 200;
      this.health = 200; // Heal fully
    }

    return { success: true, genome: this.genome, dna: this.dna };
  }

  collectFood(foodId) {
    const foodIndex = this.world.foods.findIndex(f => f.id === foodId);
    if (foodIndex === -1) return null;

    const food = this.world.foods[foodIndex];
    this.world.foods.splice(foodIndex, 1);

    // Calculate DNA gain multiplier
    let dnaMult = 1.0;
    if (this.genome.cognitive_cortex) dnaMult *= MUTATIONS.cognitive_cortex.effects.dnaMultiplier;
    
    const gain = Math.round(food.value * dnaMult);
    this.dna += gain;

    // Respawn food block elsewhere to keep world populated
    const stageConf = STAGES[this.stage];
    this.world.foods.push({
      id: `food_${Date.now()}_${Math.random()}`,
      x: Math.random() * (stageConf.width - 200) + 100,
      y: Math.random() * (stageConf.height - 200) + 100,
      type: food.type,
      value: food.value
    });

    return { foodId, gain, currentDna: this.dna };
  }

  takeDamage(amount) {
    if (this.isDead) return 0;
    
    // Apply damage reduction
    let reduction = 0;
    for (const mutationId in this.genome) {
      if (this.genome[mutationId]) {
        const mut = MUTATIONS[mutationId];
        if (mut.effects.damageReduction) reduction = Math.max(reduction, mut.effects.damageReduction);
      }
    }

    const actualDamage = Math.round(amount * (1 - reduction));
    this.health = Math.max(0, this.health - actualDamage);
    
    if (this.health <= 0) {
      this.isDead = true;
    }

    return actualDamage;
  }

  regenerateHealth() {
    if (this.isDead) return;
    let regen = 0;
    for (const mutationId in this.genome) {
      if (this.genome[mutationId]) {
        const mut = MUTATIONS[mutationId];
        if (mut.effects.regenRate) regen += mut.effects.regenRate;
      }
    }

    if (regen > 0) {
      const maxH = this.genome.dermal_armor ? 200 : 100;
      this.health = Math.min(maxH, this.health + regen);
    }
  }

  evolveStage() {
    const req = STAGES[this.stage].dnaToEvolve;
    if (this.dna >= req && this.stage < 4) {
      this.stage += 1;
      this.world = this.generateWorld();
      return { success: true, stage: this.stage };
    }
    return { success: false, reason: "Insufficient DNA or already at max stage" };
  }

  hackTerminal(terminalId) {
    if (this.stage !== 4) return null;
    const term = this.world.terminals.find(t => t.id === terminalId);
    if (!term || term.hacked) return null;

    let hackSpeed = 1.0;
    if (this.genome.cyber_interface) hackSpeed *= MUTATIONS.cyber_interface.effects.hackSpeed;

    term.hackProgress = Math.min(100, term.hackProgress + hackSpeed * 5);
    if (term.hackProgress >= 100) {
      term.hacked = true;
      return { terminalId, hacked: true };
    }
    return { terminalId, hacked: false, progress: term.hackProgress };
  }
}

module.exports = {
  GameSession,
  MUTATIONS,
  STAGES
};
