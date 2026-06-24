window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error caught:", message, "at", source, lineno, colno, error);
  let logBox = document.getElementById('terminal-log-box');
  if (logBox) {
    let row = document.createElement('div');
    row.className = 'log-row danger';
    row.innerText = "[КРИТИЧЕСКАЯ ОШИБКА] " + message + " (Строка: " + lineno + ":" + colno + ")";
    logBox.appendChild(row);
    logBox.scrollTop = logBox.scrollHeight;
  }
  let errBanner = document.getElementById('current-era-title');
  if (errBanner) {
    errBanner.innerText = "ОШИБКА: " + message;
    errBanner.style.color = "#ef4444";
  }
  return false;
};

// ==========================================
// CASTLE-FORGE: MEDIEVAL DUNGEON CRAWLER ENGINE (2D REALTIME EVOLUTION)
// ==========================================

const WORLD_SIZE = 2000;
const TILE_SIZE = 100;
const GRID_ROWS = 20;
const GRID_COLS = 20;
let soundEnabled = true;

// MEDIEVAL CASTLE MAP DATA
// 1 = Stone Wall, 2 = Stone Pillar, 0 = Empty Space
let MAP_DATA = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
  [1,0,2,0,1,0,2,2,0,0,1,0,2,2,0,0,2,2,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,1],
  [1,0,2,2,0,0,1,0,2,2,0,0,1,0,2,2,0,2,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,0,1],
  [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,1],
  [1,0,2,0,1,0,2,2,0,0,1,0,2,2,0,0,1,0,2,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1],
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1],
  [1,0,2,2,0,0,2,0,1,0,2,2,0,0,1,0,2,2,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1],
  [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
  [1,0,2,0,0,0,2,2,0,0,0,0,2,2,0,0,2,2,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// STATE MANAGEMENT
const state = {
  dna: 40,
  gold: 0,
  crystals: 0,       // 💎 Crystal shop currency
  guardsDefeated: 0,
  generation: 1,
  stage: 1, // 1: Слизень, 2: Детеныш, 3: Зверь, 4: Человек/рыцарь
  level: 1, // Dungeon Floor Depth
  autopilot: false,
  activeGeneId: null,
  transitionFade: 0,
  transitionDirection: 0,
  activeSkin: 'default',    // crystal shop cosmetic skin
  dnaBoostEnd: 0,           // ticks when x2 DNA bonus expires
  deathShield: false,       // one-time death protection
  relics: {
    crown: false,
    shield: false,
    boots: false,
    elixir: false,
    ring: false,
    amulet: false
  },
  
  // Real life DNA genes
  genes: {
    rubisco: false,  // Torches glow photosynthesis
    cox1: false,     // Mitochondria stamina
    ldha: false,     // Glycolysis sprint upgrade
    col1a1: false,   // Collagen size & segments
    acta1: false,    // Actin muscles speed
    chit1: false,    // Chitin armor scales
    shh: false,      // Sonic hedgehog claws / fire spit
    opn1lw: false,   // Opsin dark vision glow
    mbp: false,      // Myelin neural network expansion
    foxp2: false     // Social summoning helpers (bats)
  }
};

// Intercept state.gold, state.dna, and state.crystals modifications for juice and amulet relics
let _dna = 40;
let _gold = 0;
let _crystals = 0;
delete state.dna;
delete state.gold;
delete state.crystals;

Object.defineProperty(state, 'dna', {
  get() { return _dna; },
  set(val) {
    if (val === 40 && _dna === 40) {
      _dna = 40;
      return;
    }
    let diff = val - _dna;
    if (diff > 0 && state.relics && state.relics.amulet) {
      diff = Math.round(diff * 1.5);
    }
    // Crystal shop DNA boost: x2 all gains
    if (diff > 0 && state.dnaBoostEnd && state.dnaBoostEnd > 0) {
      diff = diff * 2;
    }
    _dna = _dna + diff;
    
    if (diff !== 0 && typeof gameActive !== 'undefined' && gameActive && typeof player !== 'undefined' && typeof particles !== 'undefined') {
      particles.push({
        x: player.x + (Math.random() - 0.5) * 14,
        y: player.y - player.size - 12,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -1.2 - Math.random() * 0.8,
        size: 0,
        color: '#a855f7',
        life: 40,
        isExclamation: true,
        text: (diff > 0 ? "+" : "") + diff + " DNA"
      });
    }
  },
  configurable: true,
  enumerable: true
});

Object.defineProperty(state, 'gold', {
  get() { return _gold; },
  set(val) {
    if (val === 0 && _gold === 0) {
      _gold = 0;
      return;
    }
    let diff = val - _gold;
    if (diff > 0 && state.relics && state.relics.amulet) {
      diff = Math.round(diff * 1.5);
    }
    _gold = _gold + diff;
    
    if (diff !== 0 && typeof gameActive !== 'undefined' && gameActive && typeof player !== 'undefined' && typeof particles !== 'undefined') {
      particles.push({
        x: player.x + (Math.random() - 0.5) * 14,
        y: player.y - player.size - 12,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -1.2 - Math.random() * 0.8,
        size: 0,
        color: '#facc15',
        life: 40,
        isExclamation: true,
        text: (diff > 0 ? "+" : "") + diff + " 🪙"
      });
    }
  },
  configurable: true,
  enumerable: true
});

Object.defineProperty(state, 'crystals', {
  get() { return _crystals; },
  set(val) {
    let diff = val - _crystals;
    _crystals = val;
    
    if (diff !== 0 && typeof gameActive !== 'undefined' && gameActive && typeof player !== 'undefined' && typeof particles !== 'undefined') {
      particles.push({
        x: player.x + (Math.random() - 0.5) * 14,
        y: player.y - player.size - 12,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -1.2 - Math.random() * 0.8,
        size: 0,
        color: '#38bdf8',
        life: 40,
        isExclamation: true,
        text: (diff > 0 ? "+" : "") + diff + " 💎"
      });
    }
  },
  configurable: true,
  enumerable: true
});

const STAGES = {
  1: { title: "Послушник (Novice)", stage: "Recruit / Slime", color: "rgba(168, 85, 247, 0.4)", text: "Вы - беглый рекрут, подвергшийся ДНК-мутациям. Избегайте рыцарей и собирайте еду." },
  2: { title: "Гоблин (Goblin)", stage: "Goblin Form", color: "rgba(34, 197, 94, 0.5)", text: "Мутация превратила вас в ловкого Гоблина. Вы проворны, быстры и вооружены кинжалом." },
  3: { title: "Зверочеловек (Beastman)", stage: "Feral Beastman", color: "rgba(249, 115, 22, 0.6)", text: "Ваша ДНК дичает, превращая вас в свирепого Зверочеловека. Вы сильны и покрыты густым мехом." },
  4: { title: "Рыцарь (Knight)", stage: "Steel Paladin", color: "rgba(226, 232, 240, 0.8)", text: "Вы эволюционировали в совершенного Рыцаря в тяжелых латах с огненным великим мечом!" }
};

// UPGRADES CONFIG (GOLD COSTS)
const UPGRADE_COSTS = {
  hp: 15,
  speed: 20,
  damage: 25,
  vision: 10
};

// ==========================================
// WEB AUDIO SYNTHESIZER
// ==========================================
const synth = {
  ctx: null,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
      console.warn("Web Audio API not supported");
    }
  },
  playEat() {
    if (!soundEnabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    let osc = this.ctx.createOscillator();
    let gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(950, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  },
  playChestOpen() {
    if (!soundEnabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    let osc = this.ctx.createOscillator();
    let gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(320, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  },
  playFire() {
    if (!soundEnabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    let osc = this.ctx.createOscillator();
    let gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(250, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  },
  playDamage() {
    if (!soundEnabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    let osc = this.ctx.createOscillator();
    let gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(25, this.ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.07, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  },
  playMutate() {
    if (!soundEnabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    let osc = this.ctx.createOscillator();
    let gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1300, this.ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.32);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.32);
  },
  playEvolve() {
    if (!soundEnabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    let now = this.ctx.currentTime;
    let notes = [196.00, 246.94, 293.66, 392.00, 493.88];
    notes.forEach((freq, i) => {
      let osc = this.ctx.createOscillator();
      let gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.03, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.65);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.65);
    });
  },
  playStairsDescend() {
    if (!soundEnabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    let now = this.ctx.currentTime;
    let notes = [293.66, 261.63, 220.00, 196.00, 146.83];
    notes.forEach((freq, i) => {
      let osc = this.ctx.createOscillator();
      let gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.15);
      gain.gain.setValueAtTime(0.04, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.5);
    });
  },
  playVictorySong() {
    if (!soundEnabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    let now = this.ctx.currentTime;
    // Heroic arpeggio notes: C4, G4, C5, E5, G5, C6 (extended final chord)
    let arpeggio = [261.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    arpeggio.forEach((freq, i) => {
      let osc = this.ctx.createOscillator();
      let gain = this.ctx.createGain();
      osc.type = i === arpeggio.length - 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      
      let duration = i === arpeggio.length - 1 ? 2.5 : 0.8;
      gain.gain.setValueAtTime(0.04, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + duration);
    });
  }
};

// ==========================================
// NEURAL NETWORK ARTIFICIAL BRAIN
// ==========================================
class NeuralNetwork {
  constructor(inputSize, hiddenSize, outputSize) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;

    this.weightsIH = [];
    for (let i = 0; i < this.hiddenSize; i++) {
      this.weightsIH[i] = [];
      for (let j = 0; j < this.inputSize; j++) {
        this.weightsIH[i][j] = Math.random() * 2 - 1;
      }
    }

    this.weightsHO = [];
    for (let i = 0; i < this.outputSize; i++) {
      this.weightsHO[i] = [];
      for (let j = 0; j < this.hiddenSize; j++) {
        this.weightsHO[i][j] = Math.random() * 2 - 1;
      }
    }

    this.biasH = new Array(this.hiddenSize).fill(0).map(() => Math.random() * 2 - 1);
    this.biasO = new Array(this.outputSize).fill(0).map(() => Math.random() * 2 - 1);
  }

  predict(inputs) {
    let hidden = [];
    for (let i = 0; i < this.hiddenSize; i++) {
      let sum = this.biasH[i];
      for (let j = 0; j < this.inputSize; j++) {
        sum += inputs[j] * this.weightsIH[i][j];
      }
      hidden[i] = Math.tanh(sum);
    }

    let outputs = [];
    for (let i = 0; i < this.outputSize; i++) {
      let sum = this.biasO[i];
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += hidden[j] * this.weightsHO[i][j];
      }
      outputs[i] = Math.tanh(sum);
    }

    return { hidden, outputs };
  }

  clone() {
    let clone = new NeuralNetwork(this.inputSize, this.hiddenSize, this.outputSize);
    for (let i = 0; i < this.hiddenSize; i++) {
      clone.weightsIH[i] = [...this.weightsIH[i]];
    }
    for (let i = 0; i < this.outputSize; i++) {
      clone.weightsHO[i] = [...this.weightsHO[i]];
    }
    clone.biasH = [...this.biasH];
    clone.biasO = [...this.biasO];
    return clone;
  }

  mutate(rate = 0.15, amount = 0.25) {
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.inputSize; j++) {
        if (Math.random() < rate) this.weightsIH[i][j] = Math.max(-1, Math.min(1, this.weightsIH[i][j] + (Math.random() * 2 - 1) * amount));
      }
      if (Math.random() < rate) this.biasH[i] = Math.max(-1, Math.min(1, this.biasH[i] + (Math.random() * 2 - 1) * amount));
    }
    for (let i = 0; i < this.outputSize; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        if (Math.random() < rate) this.weightsHO[i][j] = Math.max(-1, Math.min(1, this.weightsHO[i][j] + (Math.random() * 2 - 1) * amount));
      }
      if (Math.random() < rate) this.biasO[i] = Math.max(-1, Math.min(1, this.biasO[i] + (Math.random() * 2 - 1) * amount));
    }
  }
}

function findBFSPath(startCol, startRow, targetCol, targetRow) {
  if (startCol === targetCol && startRow === targetRow) {
    return [];
  }
  
  if (startCol < 0 || startCol >= GRID_COLS || startRow < 0 || startRow >= GRID_ROWS ||
      targetCol < 0 || targetCol >= GRID_COLS || targetRow < 0 || targetRow >= GRID_ROWS) {
    return null;
  }
  
  let queue = [[startCol, startRow]];
  let parent = {};
  let visited = new Set();
  visited.add(`${startCol},${startRow}`);
  
  let found = false;
  
  while (queue.length > 0) {
    let [c, r] = queue.shift();
    if (c === targetCol && r === targetRow) {
      found = true;
      break;
    }
    
    let dirs = [
      [0, -1], [1, 0], [0, 1], [-1, 0]
    ];
    for (let [dc, dr] of dirs) {
      let nc = c + dc;
      let nr = r + dr;
      if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
        let cell = MAP_DATA[nr][nc];
        if (cell === 0 || (nc === targetCol && nr === targetRow)) {
          let key = `${nc},${nr}`;
          if (!visited.has(key)) {
            visited.add(key);
            parent[key] = `${c},${r}`;
            queue.push([nc, nr]);
          }
        }
      }
    }
  }
  
  if (!found) return null;
  
  let path = [];
  let curr = `${targetCol},${targetRow}`;
  while (curr !== `${startCol},${startRow}`) {
    let [c, r] = curr.split(',').map(Number);
    path.push({ col: c, row: r });
    curr = parent[curr];
  }
  path.reverse();
  return path;
}

// ==========================================
// ORGANISM CLASS (PLAYER, GUARDS, RATS)
// ==========================================
class Organism {
  constructor(x, y, isPlayer = false, type = 'slime', parentBrain = null) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = Math.random() * Math.PI * 2;
    this.isPlayer = isPlayer;
    this.type = type; 
    
    // Upgrade levels for player
    this.statLevels = { hp: 0, speed: 0, damage: 0, vision: 0 };
    
    // Real-time neural emotional states
    this.alertLevel = 0;
    this.excitementLevel = 0;
    this.intellectPulse = 0;
    
    // Procedural morphology properties
    this.limbs = [];
    this.bodySegmentsProfile = [];
    this.hornLength = 0;
    this.eyeCount = 0;
    this.eyeOffsetAngle = 0.5;
    
    // Base Attributes
    let lvl = (typeof state !== 'undefined' && state.level) ? state.level : 1;
    this.baseSize = isPlayer ? 12 :
                    (type === 'boss' ? Math.min(32, 16 * (1 + (lvl - 1) * 0.12)) :
                    (type === 'orc' ? Math.min(16, 9 * (1 + (lvl - 1) * 0.08)) :
                    (type === 'halberdier' ? Math.min(15, 7.5 * (1 + (lvl - 1) * 0.08)) :
                    (type === 'alchemist' ? Math.min(12, 6 * (1 + (lvl - 1) * 0.07)) :
                    (type === 'goblin' ? Math.min(10, 5 * (1 + (lvl - 1) * 0.08)) :
                    (type === 'vampire' ? Math.min(13, 7 * (1 + (lvl - 1) * 0.07)) :
                    (type === 'shaman' ? Math.min(12, 6 * (1 + (lvl - 1) * 0.07)) :
                    ((type === 'guard' || type === 'mage' || type === 'bomber') ? Math.min(14, 7 * (1 + (lvl - 1) * 0.08)) : 4))))))));
    this.sizeScale = 1.0;
    let hpScale = Math.pow(1.8, lvl - 1);
    let dmgScale = Math.pow(1.6, lvl - 1);
    if (lvl === 2) {
      hpScale = 1.25;
      dmgScale = 1.2;
    } else if (lvl === 3) {
      hpScale = 3.6;  // Restored and buffed from 3.24 as requested
      dmgScale = 2.8; // Restored and buffed from 2.56 as requested
    } else if (lvl >= 4) {
      hpScale = 2.6;  // Reduced from 5.832 to make final level more fair and beatable
      dmgScale = 2.0; // Reduced from 4.096 to make final level more fair and beatable
    }
    
    let mobHpScale = hpScale;
    let mobDmgScale = dmgScale;
    if (lvl === 2 && type === 'halberdier') {
      mobHpScale = 1.05;
      mobDmgScale = 1.05;
    }
    
    let mageHpBase = (type === 'mage' && lvl === 2) ? 16 : 24;

    let bossHpBase = 180;
    if (type === 'boss') {
      if (lvl === 2) bossHpBase = 180 * 1.5;
      else if (lvl === 3) bossHpBase = 180 * 1.7;
      else if (lvl >= 4) bossHpBase = 180 * 2.0;
    }

    this.health = type === 'boss' ? Math.round(bossHpBase * 2.5 * mobHpScale) :
                  (type === 'orc' ? Math.round(48 * 2.5 * mobHpScale) :
                  (type === 'halberdier' ? Math.round(42 * 2.5 * mobHpScale) :
                  (type === 'alchemist' ? Math.round(25 * 2.5 * mobHpScale) :
                  (type === 'guard' ? Math.round(30 * 2.5 * mobHpScale) :
                  (type === 'mage' ? Math.round(mageHpBase * 2.5 * mobHpScale) :
                  (type === 'bomber' ? Math.round(18 * 2.5 * mobHpScale) :
                  (type === 'goblin' ? Math.round(20 * 2.5 * mobHpScale) :
                  (type === 'vampire' ? Math.round(20 * 2.5 * mobHpScale) : // Nerfed from 35 to 20
                  (type === 'shaman' ? Math.round(22 * 2.5 * mobHpScale) :
                  (type === 'rat' ? Math.round(12 * 2.5 * mobHpScale) : 100))))))))));
    this.maxHealth = this.health;
    this.energy = 95;
    this.maxEnergy = 100;
    this.evolveProgress = 0;
    
    this.speed = type === 'boss' ? 1.05 :
                 (type === 'goblin' ? 1.40 :
                 (type === 'orc' ? 0.75 :
                 (type === 'halberdier' ? 0.90 :
                 (type === 'alchemist' ? 1.10 :
                 (type === 'vampire' ? 1.30 :
                 (type === 'shaman' ? 0.80 :
                 (type === 'guard' ? 0.85 :
                 (type === 'mage' ? 0.90 :
                 (type === 'bomber' ? 1.25 : 1.45)))))))));
    this.acceleration = type === 'boss' ? 0.08 : 0.08;
    this.armor = 0;
    this.damage = type === 'boss' ? Math.round(10 * 2.5 * mobDmgScale) :
                  (type === 'orc' ? Math.round(7 * 2.5 * mobDmgScale) :
                  (type === 'halberdier' ? Math.round(8 * 2.5 * mobDmgScale) :
                  (type === 'alchemist' ? 0 :
                  (type === 'guard' ? Math.round(4 * 2.5 * mobDmgScale) :
                  (type === 'mage' ? Math.round(6 * 2.5 * mobDmgScale) :
                  (type === 'goblin' ? Math.round(3 * 2.5 * mobDmgScale) :
                  (type === 'vampire' ? Math.round(5 * 2.5 * mobDmgScale) :
                  (type === 'shaman' ? Math.round(4 * 2.5 * mobDmgScale) :
                  (type === 'bomber' ? 0 :
                  (type === 'rat' ? Math.round(2 * 2.5) : 100))))))))));
    this.visionRadius = type === 'boss' ? 320 : 240;
    this.mitochondria = false;
    this.photosynthesis = false;
    
    // Boss & Alert States
    this.bossState = 'patrol';
    this.spinTimer = 0;
    this.spinActive = false;
    this.shieldActive = false;
    this.rageTimer = 0;
    this.rageWarnTimer = 0;
    this.alertCooldown = 0;
    
    // Movement structures
    this.wiggleTimer = Math.random() * 100;
    this.segments = [];
    this.updateSegmentCount();
    
    // Neural Network
    let inputs = 10;
    let hNodes = 4;
    let oNodes = 2;
    
    this.brain = parentBrain ? parentBrain.clone() : new NeuralNetwork(inputs, hNodes, oNodes);
    
    if (this.isPlayer) {
      this.applyPlayerGenes();
    }
    
    // Visual Colors
    if (this.isPlayer) {
      this.color = '#00f0ff';
    } else if (type === 'boss') {
      this.color = '#f59e0b'; // Gold Boss
    } else if (type === 'guard') {
      this.color = '#ef4444';
    } else {
      this.color = '#a1a1aa'; // Rat gray
    }
    
    this.sprinting = false;
    this.sprintTimer = 0;
    this.sprintCooldown = 0;
    this.lastPrediction = { inputs: new Array(inputs).fill(0), hidden: new Array(hNodes).fill(0), outputs: new Array(oNodes).fill(0) };
  }
  
  applyPlayerGenes() {
    let hNodes = state.genes.mbp ? 6 : 4;
    if (this.brain && this.brain.hiddenSize !== hNodes) {
      this.brain = new NeuralNetwork(10, hNodes, 2);
    }
    
    // Gene-based modifiers
    this.sizeScale = state.stage === 1 ? 1.0 : (state.stage === 2 ? 1.2 : (state.stage === 3 ? 1.4 : 1.7));
    if (state.genes.col1a1) this.sizeScale += 0.35;
    
    // Snappy, highly noticeable Speed upgrades!
    this.speed = 1.85 + (this.statLevels.speed * 0.40); // Slightly faster at start
    this.acceleration = 0.08 * (this.speed / 1.4); // Scale acceleration proportionally
    if (state.genes.acta1) {
      this.speed += 0.8; // Increased from 0.55 to 0.8
      this.acceleration += 0.04;
    }
    
    this.armor = state.genes.chit1 ? 0.4 : 0.0;
    
    // Noticeable Damage upgrades!
    this.damage = (state.stage >= 2 ? 12 : 5) + (this.statLevels.damage * 6); // Increased from 2 to 6!
    if (state.genes.shh) this.damage += 15; // Increased from 8 to 15
    
    // Noticeable Light Aura upgrades!
    this.visionRadius = 240 + (this.statLevels.vision * 60); // Increased from 20 to 60!
    if (state.genes.opn1lw) this.visionRadius += 180; // Increased from 150 to 180
    
    this.photosynthesis = state.genes.rubisco;
    this.mitochondria = state.genes.cox1;
    
    // Relics and Health calculations
    let baseMaxHealth = 100 + (this.statLevels.hp * 30);
    if (state.genes.col1a1) baseMaxHealth += 50;
    // Feral Overlord synergy: +100 Max Health
    if (state.genes.col1a1 && state.genes.acta1) baseMaxHealth += 100;
    
    this.maxEnergy = state.stage >= 3 ? 150 : 100;
    if (state.relics) {
      if (state.relics.elixir) {
        baseMaxHealth *= 1.40;
      }
      if (state.relics.ring) {
        this.maxEnergy += 50;
      }
    }
    this.maxHealth = Math.round(baseMaxHealth);
    
    if (state.relics) {
      if (state.relics.crown) {
        this.damage *= 1.5;
      }
      if (state.relics.shield) {
        this.armor += 0.25;
      }
      if (state.relics.boots) {
        this.speed *= 1.40;
        this.acceleration *= 1.40;
      }
    }
    // Speed cap: prevent synergy stacking above 3.2
    if (this.speed > 3.2) this.speed = 3.2;
    if (this.acceleration > 0.22) this.acceleration = 0.22;
    
    this.updateSegmentCount();
    
    // Run AI morphogenesis model generator!
    this.generateNeuralMorphology();
  }
  
  updateSegmentCount() {
    let count = 0;
    if (this.isPlayer) {
      count = 0; // No segments or tail for player (Knight gets a custom waving vector cape)
    } else if (this.type === 'rat') {
      count = 1; // tail for rats
    } else {
      count = 0; // no tail/segments for guards, mages, bombers, orcs, goblins, bosses
    }
    
    this.segments = [];
    for (let i = 0; i < count; i++) {
      this.segments.push({ x: this.x, y: this.y });
    }
  }
  
  generateNeuralMorphology() {
    if (!this.isPlayer) return;
    
    // We use the neural network weights to generate a unique creature phenotype!
    // We run a feedforward pass with the active genes as inputs to determine body shapes.
    let geneInputs = [
      state.genes.rubisco ? 1 : -1,
      state.genes.cox1 ? 1 : -1,
      state.genes.ldha ? 1 : -1,
      state.genes.col1a1 ? 1 : -1,
      state.genes.acta1 ? 1 : -1,
      state.genes.chit1 ? 1 : -1,
      state.genes.shh ? 1 : -1,
      state.genes.opn1lw ? 1 : -1,
      state.genes.mbp ? 1 : -1,
      state.genes.foxp2 ? 1 : -1
    ];
    
    // Make sure brain is initialized
    if (!this.brain) return;
    
    // Pad inputs to match input size (10 nodes)
    let paddedInputs = new Array(this.brain.inputSize).fill(0);
    for (let i = 0; i < geneInputs.length && i < paddedInputs.length; i++) {
      paddedInputs[i] = geneInputs[i];
    }
    
    // Predict outputs from the current brain weights
    let prediction = this.brain.predict(paddedInputs);
    let h = prediction.hidden; // array of activations
    let o = prediction.outputs; // array of activations
    
    // Decode neural activations into physical body properties:
    // 1. Segment count (only Stage 4 Knight has a short 3-segment cape, stages 1-3 have NO tail/cape segments!)
    let segmentCount = 0;
    
    // 2. Body fatness / bulging shape (calculated per segment)
    this.bodySegmentsProfile = [];
    for (let i = 0; i < segmentCount; i++) {
      let relativePos = i / (segmentCount || 1);
      let neuralScale = 1.0 + (h[1] || 0) * 0.25 * Math.sin(relativePos * Math.PI);
      this.bodySegmentsProfile.push(neuralScale);
    }
    
    // 3. Legs/appendages generation (stage 2+)
    this.limbs = [];
    if (state.stage >= 2 && segmentCount > 0) {
      let legPairs = state.stage === 2 ? 1 : (state.stage === 3 ? 2 : 2);
      if (state.genes.acta1) legPairs += 1;
      
      for (let p = 0; p < legPairs; p++) {
        let attachSeg = Math.floor(1 + p * (segmentCount / (legPairs + 1)));
        if (attachSeg < segmentCount) {
          let legLen = 15 + ((o[0] || 0) + 1) * 8 + (state.genes.acta1 ? 8 : 0);
          this.limbs.push({ segmentIndex: attachSeg, side: 1, length: legLen, type: 'leg' });
          this.limbs.push({ segmentIndex: attachSeg, side: -1, length: legLen, type: 'leg' });
        }
      }
    }
    
    // 4. Wings generation (stage 4, or stages 2-3 with foxp2)
    if (state.stage === 4 || (state.stage === 2 && state.genes.foxp2) || (state.stage === 3 && state.genes.foxp2)) {
      let wingLen = (state.stage === 2 ? 20 : state.stage === 3 ? 30 : 35) + ((o[1] || 0) + 1) * 15;
      this.limbs.push({ segmentIndex: 0, side: 1, length: wingLen, type: 'wing' });
      this.limbs.push({ segmentIndex: 0, side: -1, length: wingLen, type: 'wing' });
    }
    
    // 5. Horn count and length (stage 3+)
    this.hornLength = 0;
    if (state.stage >= 3) {
      this.hornLength = 6 + (h[2] || 0) * 4 + (state.genes.shh ? 4 : 0);
    }
    
    // 6. Eyes profile
    this.eyeCount = state.genes.opn1lw ? 2 : 0;
    this.eyeOffsetAngle = 0.5 + (h[3] || 0) * 0.15; // neural eye placement angle!
    
    // 7. AI Generated Appearance Decodings (ears length, beast fur color, cape color, glow color)
    this.earsLength = 6 + ((o[0] || 0) + 1) * 8; // pointed ears: 6px to 22px
    this.beastFurColor = (h[1] || 0) > 0 ? '#b45309' : '#d97706'; // brown or orange
    this.capeColor = (h[2] || 0) > 0 ? '#991b1b' : '#1e3a8a'; // crimson red or royal blue
    this.glowColor = (o[1] || 0) > 0 ? '#fbbf24' : '#22d3ee'; // golden or cyan glow
    
    // Rebuild segment coordinates array based on count
    let count = segmentCount;
    this.segments = [];
    for (let i = 0; i < count; i++) {
      this.segments.push({ x: this.x, y: this.y });
    }
    
    // Log synthesis info!
    let genInfo = `[ИИ-Сборка] Морфогенез завершен: ${segmentCount} сегм., ${this.limbs.filter(l=>l.type==='leg').length} лап.`;
    logRow(genInfo, "adapt");
  }
  
  get health() {
    return this._health;
  }
  set health(val) {
    let oldVal = this._health;
    this._health = val;
    let diff = val - oldVal;
    if (oldVal !== undefined && Math.abs(diff) >= 1.0 && typeof gameActive !== 'undefined' && gameActive) {
      let txt = "";
      let color = "#fff";
      if (diff < 0) {
        txt = Math.round(Math.abs(diff)).toString();
        color = this.isPlayer ? "#ef4444" : "#f97316";
      } else {
        txt = "+" + Math.round(diff).toString();
        color = "#22d3ee";
      }
      
      if (typeof particles !== 'undefined') {
        particles.push({
          x: this.x + (Math.random() - 0.5) * 8,
          y: this.y - this.size - 6,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1.0 - Math.random() * 0.8,
          size: 0,
          color: color,
          life: 30,
          isExclamation: true,
          text: txt
        });
      }
    }
  }

  get size() {
    return this.baseSize * this.sizeScale;
  }
  
  update(dtRatio, worldFood, worldCreatures) {
    if (typeof player !== 'undefined' && this === player) {
      this.isPlayer = true;
      if (this.type === 'boss') {
        this.type = 'slime';
      }
    } else {
      this.isPlayer = false;
      if (this.maxHealth >= 300) {
        this.type = 'boss';
      } else if (this.type === 'boss') {
        this.type = 'guard';
      }
    }
    if (this.sprintCooldown > 0) this.sprintCooldown = Math.max(0, this.sprintCooldown - dtRatio);
    if (this.alertCooldown > 0) this.alertCooldown = Math.max(0, this.alertCooldown - dtRatio);
    
    if (this.sprinting) {
      this.sprintTimer -= dtRatio;
      if (this.sprintTimer <= 0) this.sprinting = false;
    }
    
    // Update sensory emotional levels and spawn tail sparks for players
    if (this.isPlayer) {
      // Find closest guard, boss, goblin, or orc
      let closestGuard = null;
      let minGuardDist = Infinity;
      for (let c of worldCreatures) {
        if (c.type === 'guard' || c.type === 'boss' || c.type === 'goblin' || c.type === 'orc' || c.type === 'vampire' || c.type === 'shaman') {
          let d = Math.hypot(c.x - this.x, c.y - this.y);
          if (d < minGuardDist) {
            minGuardDist = d;
            closestGuard = c;
          }
        }
      }
      
      // Alert level based on guard distance (0 to 1)
      if (closestGuard && minGuardDist < this.visionRadius) {
        this.alertLevel = 1.0 - minGuardDist / this.visionRadius;
      } else {
        this.alertLevel = Math.max(0, this.alertLevel - 0.05 * dtRatio); // Smooth decay
      }
      
      // Excitement level based on speed & sprint
      let speedMag = Math.hypot(this.vx, this.vy);
      let targetExcitement = Math.min(1.0, speedMag / (this.speed * 1.5));
      if (this.sprinting) targetExcitement = 1.0;
      this.excitementLevel += (targetExcitement - this.excitementLevel) * 0.1 * dtRatio; // Smooth interpolate
      
      // Intellect pulse frequency modulated by brain activity
      let brainSum = 0;
      if (this.lastPrediction && this.lastPrediction.hidden) {
        brainSum = this.lastPrediction.hidden.reduce((sum, val) => sum + Math.abs(val), 0) / this.lastPrediction.hidden.length;
      }
      let pulseFreq = 0.003 + brainSum * 0.012;
      this.intellectPulse = Math.sin(Date.now() * pulseFreq) * 0.5 + 0.5;

      // Dragon tail/cape flame sparks emitter
      if (state.stage === 4) {
        let excitement = this.excitementLevel;
        let alert = this.alertLevel;
        
        let spawnChance = (0.2 + excitement * 0.5) * dtRatio;
        if (Math.random() < spawnChance) {
          let backX = this.x - Math.cos(this.angle) * this.size * 1.5;
          let backY = this.y - Math.sin(this.angle) * this.size * 1.5;
          particles.push({
            x: backX + (Math.random() - 0.5) * 8,
            y: backY + (Math.random() - 0.5) * 8,
            vx: -Math.cos(this.angle) * (1.5 + excitement * 2.0) + (Math.random() - 0.5) * 1.5,
            vy: -Math.sin(this.angle) * (1.5 + excitement * 2.0) + (Math.random() - 0.5) * 1.5,
            size: Math.random() * 3.5 + 1.5 + alert * 2.0,
            color: alert > 0.4 ? 'rgba(255, 42, 109, 0.75)' : 'rgba(255, 106, 0, 0.75)',
            life: 20 + Math.random() * 15
          });
        }
      }
    }

    // Choose control type
    if (this.isPlayer) {
      // Always run neural predictions for the player to update sensor states and graph!
      this.runNeuralAutopilot(worldFood, worldCreatures, dtRatio);
    } else if (this.type === 'boss') {
      this.runBossAI(worldCreatures);
    } else if (this.type === 'guard') {
      this.runGuardAI(worldCreatures);
    } else if (this.type === 'halberdier') {
      this.runHalberdierAI(worldCreatures);
    } else if (this.type === 'alchemist') {
      this.runAlchemistAI(worldCreatures);
    } else if (this.type === 'mage') {
      this.runMageAI(worldCreatures);
    } else if (this.type === 'bomber') {
      this.runBomberAI(worldCreatures);
    } else if (this.type === 'rat') {
      this.runRatAI(worldCreatures);
    } else if (this.type === 'goblin') {
      this.runGoblinAI(worldCreatures);
    } else if (this.type === 'orc') {
      this.runOrcAI(worldCreatures);
    } else if (this.type === 'vampire') {
      this.runVampireAI(worldCreatures);
    } else if (this.type === 'shaman') {
      this.runShamanAI(worldCreatures);
    } else {
      this.runNeuralAutopilot(worldFood, worldCreatures, dtRatio);
    }
    
    // Physics
    this.x += this.vx * dtRatio;
    this.y += this.vy * dtRatio;
    this.vx *= Math.pow(0.88, dtRatio);
    this.vy *= Math.pow(0.88, dtRatio);
    
    // Trail tracking (for ghost dash effect)
    if (!this.trail) this.trail = [];
    this.trail.push({ x: this.x, y: this.y, angle: this.angle });
    if (this.trail.length > 5) {
      this.trail.shift();
    }
    
    // Collision against walls
    checkWallCollisions(this);
    
    // Wiggling chain physics
    if (this.segments.length > 0) {
      this.segments[0].x = this.x;
      this.segments[0].y = this.y;
      
      let speedMag = Math.hypot(this.vx, this.vy);
      this.wiggleTimer += (speedMag * 0.16 + 0.04) * dtRatio;
      
      for (let i = 1; i < this.segments.length; i++) {
        let prev = this.segments[i - 1];
        let curr = this.segments[i];
        
        let dx = curr.x - prev.x;
        let dy = curr.y - prev.y;
        let dist = Math.hypot(dx, dy);
        let targetDist = this.size * 0.65;
        
        let wave = Math.sin(this.wiggleTimer - i * 0.7) * 1.6;
        let perpX = -dy / (dist || 1) * wave;
        let perpY = dx / (dist || 1) * wave;
        
        if (dist > 0) {
          curr.x = prev.x + (dx / dist) * targetDist + perpX * 0.1 * dtRatio;
          curr.y = prev.y + (dy / dist) * targetDist + perpY * 0.1 * dtRatio;
        }
      }
    }
    
    // Metabolic decays
    if (this.isPlayer) {
      // COX1 balanced: good but not overwhelming
      let staminaDrain = (this.mitochondria ? 0.009 : 0.010) * dtRatio;
      // x2 DNA boost also gives slight energy regen
      if (state.dnaBoostEnd > 0) state.dnaBoostEnd--;
      this.energy = Math.max(0, this.energy - staminaDrain);
      if (this.energy <= 0) {
        this.health = Math.max(0, this.health - 0.22 * dtRatio);
        if (this.health <= 0) triggerDeath();
      }
      
      // Near torch photosynthesis
      if (this.photosynthesis) {
        let nearTorch = false;
        for (let t of torches) {
          if (Math.hypot(this.x - t.x, this.y - t.y) < 130) {
            nearTorch = true;
            break;
          }
        }
        if (nearTorch) {
          // RuBisCO balanced: slow regen, requires sustained proximity
          this.energy = Math.min(this.maxEnergy, this.energy + 0.04 * dtRatio);
          this.health = Math.min(this.maxHealth, this.health + 0.015 * dtRatio);
        }
      }
    }
  }
  
  runNeuralAutopilot(worldFood, worldCreatures, dtRatio = 1.0) {
    let inputs = new Array(this.brain.inputSize).fill(0);
    
    // 1. Raycast sensors (N, E, S, W)
    let maxRay = 200;
    inputs[0] = castRay(this.x, this.y, 0, -1, maxRay) / maxRay;
    inputs[1] = castRay(this.x, this.y, 1, 0, maxRay) / maxRay;
    inputs[2] = castRay(this.x, this.y, 0, 1, maxRay) / maxRay;
    inputs[3] = castRay(this.x, this.y, -1, 0, maxRay) / maxRay;
    
    // 2. Find closest target (Moss, Cheese or unopened chest)
    let closestTarget = null;
    let minTargetDist = Infinity;
    for (let f of worldFood) {
      let d = Math.hypot(f.x - this.x, f.y - this.y);
      if (d < minTargetDist) {
        minTargetDist = d;
        closestTarget = f;
      }
    }
    // Drones and player also seek unopened chests
    for (let ch of chests) {
      if (!ch.open) {
        let d = Math.hypot(ch.x - this.x, ch.y - this.y);
        if (d < minTargetDist) {
          minTargetDist = d;
          closestTarget = ch;
        }
      }
    }
    
    if (closestTarget && minTargetDist < this.visionRadius) {
      let dx = closestTarget.x - this.x;
      let dy = closestTarget.y - this.y;
      let rotX = dx * Math.cos(-this.angle) - dy * Math.sin(-this.angle);
      let rotY = dx * Math.sin(-this.angle) + dy * Math.cos(-this.angle);
      inputs[4] = rotX / this.visionRadius;
      inputs[5] = rotY / this.visionRadius;
    }
    
    // 3. Find closest threat (Guard)
    let closestThreat = null;
    let minThreatDist = Infinity;
    for (let c of worldCreatures) {
      if (c.type === 'guard') {
        let d = Math.hypot(c.x - this.x, c.y - this.y);
        if (d < minThreatDist) {
          minThreatDist = d;
          closestThreat = c;
        }
      }
    }
    
    if (closestThreat && minThreatDist < this.visionRadius) {
      let dx = closestThreat.x - this.x;
      let dy = closestThreat.y - this.y;
      let rotX = dx * Math.cos(-this.angle) - dy * Math.sin(-this.angle);
      let rotY = dx * Math.sin(-this.angle) + dy * Math.cos(-this.angle);
      inputs[6] = rotX / this.visionRadius;
      inputs[7] = rotY / this.visionRadius;
    }
    
    inputs[8] = this.energy / this.maxEnergy;
    inputs[9] = this.health / this.maxHealth;
    
    // Predict
    let prediction = this.brain.predict(inputs);
    this.lastPrediction = { inputs, hidden: prediction.hidden, outputs: prediction.outputs };
    
    let steer = prediction.outputs[0];
    let thrust = (prediction.outputs[1] + 1) / 2;
    
    // Only apply neural physics and steering directly to player if autopilot is active, or if not the player at all!
    if (this.isPlayer && state.autopilot) {
      // ─── AUTOPILOT: BFS pathfinding with caching ───
      // Cache BFS every 30 ticks to avoid massive CPU cost every frame
      if (!this._apCache) this._apCache = { path: null, targetCand: null, timer: 0 };
      this._apCache.timer = (this._apCache.timer || 0) - 1;

      if (this._apCache.timer <= 0) {
        this._apCache.timer = 30;
        let startCol = Math.floor(this.x / TILE_SIZE);
        let startRow = Math.floor(this.y / TILE_SIZE);
        let candidates = [];
        if (typeof relicPickups !== 'undefined') {
          for (let rp of relicPickups) candidates.push({ x: rp.x, y: rp.y, type: 'relic', priority: 6 });
        }
        if (typeof lootItems !== 'undefined') {
          for (let item of lootItems) candidates.push({ x: item.x, y: item.y, type: 'loot', priority: 4 });
        }
        if (typeof chests !== 'undefined') {
          for (let ch of chests) if (!ch.open) candidates.push({ x: ch.x, y: ch.y, type: 'chest', priority: 5 });
        }
        if (worldFood) {
          for (let f of worldFood) candidates.push({ x: f.x, y: f.y, type: 'food', priority: 2 });
        }
        let bestScore = Infinity, bestPath = null, bestCandidate = null;
        for (let cand of candidates) {
          let tCol = Math.floor(cand.x / TILE_SIZE);
          let tRow = Math.floor(cand.y / TILE_SIZE);
          let path = findBFSPath(startCol, startRow, tCol, tRow);
          if (path) {
            let score = path.length - (cand.priority * 3);
            if (score < bestScore) { bestScore = score; bestCandidate = cand; bestPath = path; }
          }
        }
        this._apCache.path = bestPath;
        this._apCache.targetCand = bestCandidate;
      }

      // Auto open nearby chests
      if (typeof openNearbyChest === 'function') openNearbyChest();

      let bestPath = this._apCache.path;
      let bestCandidate = this._apCache.targetCand;
      
      // 1. Check for nearby enemies first
      let closestEnemy = null, minEnemyDist = Infinity;
      if (typeof bots !== 'undefined') {
        for (let bot of bots) {
          if (bot.health > 0) {
            let d = Math.hypot(bot.x - this.x, bot.y - this.y);
            if (d < minEnemyDist) { minEnemyDist = d; closestEnemy = bot; }
          }
        }
      }
      
      let desiredAngle = null;
      let isChasingEnemy = false;
      
      if (closestEnemy && minEnemyDist < 160) {
        // Target and attack the enemy!
        desiredAngle = Math.atan2(closestEnemy.y - this.y, closestEnemy.x - this.x);
        isChasingEnemy = true;
        if (ticks % 5 === 0) {
          if (typeof window.performPlayerAttack === 'function') {
            window.performPlayerAttack(desiredAngle);
          }
        }
      } else if (bestCandidate) {
        // No enemies nearby, target the BFS candidate
        let targetX = bestCandidate.x;
        let targetY = bestCandidate.y;
        if (bestPath && bestPath.length > 0) {
          targetX = bestPath[0].col * TILE_SIZE + 50;
          targetY = bestPath[0].row * TILE_SIZE + 50;
        }
        desiredAngle = Math.atan2(targetY - this.y, targetX - this.x);
      }
      
      // If we have a target (enemy or food)
      if (desiredAngle !== null) {
        let angleDiff = desiredAngle - this.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        
        this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.18);
        
        let thrustVal = Math.abs(angleDiff) < 0.9 ? 1.0 : 0.35;
        let accel = this.acceleration;
        let maxSpd = this.speed;
        
        // Sprint only when energy high enough, long path, no nearby enemy
        if (!isChasingEnemy && bestPath && bestPath.length > 5 && this.energy > 65 && !this.sprinting) {
          this.activateSprint();
        }
        
        if (this.sprinting) {
          let dashMult = state.genes.ldha ? 2.0 : 1.4;
          accel *= dashMult;
          maxSpd *= dashMult;
        }
        
        this.vx += Math.cos(this.angle) * thrustVal * accel * dtRatio;
        this.vy += Math.sin(this.angle) * thrustVal * accel * dtRatio;
        
        let currentSpeed = Math.hypot(this.vx, this.vy);
        if (currentSpeed > maxSpd) {
          this.vx = (this.vx / currentSpeed) * maxSpd;
          this.vy = (this.vy / currentSpeed) * maxSpd;
        }
      }
    } else if (!this.isPlayer) {
      // Neural autopilot for non-player bots
      this.angle += steer * 0.08;
      
      let accel = this.acceleration;
      let maxSpd = this.speed;
      if (this.sprinting) {
        let dashSpeedMult = state.genes.ldha ? 2.2 : 1.5;
        accel *= (dashSpeedMult * 1.5);
        maxSpd *= dashSpeedMult;
      }
      
      this.vx += Math.cos(this.angle) * thrust * accel * dtRatio;
      this.vy += Math.sin(this.angle) * thrust * accel * dtRatio;
      
      let currentSpeed = Math.hypot(this.vx, this.vy);
      if (currentSpeed > maxSpd) {
        this.vx = (this.vx / currentSpeed) * maxSpd;
        this.vy = (this.vy / currentSpeed) * maxSpd;
      }
    }
  }
  
  runHalberdierAI(worldCreatures) {
    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (playerTarget && playerTarget.health > 0) {
      let d = Math.hypot(playerTarget.x - this.x, playerTarget.y - this.y);
      if (d < 260) {
        this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
        
        // Halberdier moves into lunge range (50-70px)
        let lvl = (typeof state !== 'undefined' && state.level) ? state.level : 1;
        let backAwayDist = (lvl === 2) ? 42 : 65;
        if (d > backAwayDist) {
          this.vx += Math.cos(this.angle) * this.acceleration * 1.25;
          this.vy += Math.sin(this.angle) * this.acceleration * 1.25;
        } else {
          this.vx -= Math.cos(this.angle) * this.acceleration * 0.4;
          this.vy -= Math.sin(this.angle) * this.acceleration * 0.4;
        }
        
        // Attack logic (extended reach)
        if (d < 75 && Math.random() < 0.035) {
          if (playerTarget.sprinting) return; // Immune to halberd sweep while sprinting/dashing
          let dmg = this.damage;
          if (playerTarget.armor > 0) dmg *= (1 - playerTarget.armor);
          playerTarget.health -= dmg;
          synth.playDamage();
          
          // Large knockback from Halberd!
          playerTarget.vx += Math.cos(this.angle) * 7.5;
          playerTarget.vy += Math.sin(this.angle) * 7.5;
          
          logRow(`🔱 Алебардщик нанес вам размашистый удар! Урон: ${dmg.toFixed(0)}`, 'danger');
          if (playerTarget.health <= 0) triggerDeath();
        }
        return;
      }
    }
    
    if (Math.random() < 0.035) this.angle += (Math.random() - 0.5) * 1.6;
    this.vx += Math.cos(this.angle) * this.acceleration * 0.7;
    this.vy += Math.sin(this.angle) * this.acceleration * 0.7;
    
    let spd = Math.hypot(this.vx, this.vy);
    if (spd > this.speed) {
      this.vx = (this.vx / spd) * this.speed;
      this.vy = (this.vy / spd) * this.speed;
    }
  }

  runAlchemistAI(worldCreatures) {
    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (playerTarget && playerTarget.health > 0) {
      let d = Math.hypot(playerTarget.x - this.x, playerTarget.y - this.y);
      if (d < 320) {
        this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
        
        // Alchemist tries to stay at range 180-240px
        if (d < 170) {
          this.vx -= Math.cos(this.angle) * this.acceleration * 1.2;
          this.vy -= Math.sin(this.angle) * this.acceleration * 1.2;
        } else if (d > 230) {
          this.vx += Math.cos(this.angle) * this.acceleration * 0.85;
          this.vy += Math.sin(this.angle) * this.acceleration * 0.85;
        }
        
        // Cooldown between flask lobs
        if (!this.flaskTimer) this.flaskTimer = 0;
        if (this.flaskTimer > 0) this.flaskTimer--;
        
        if (this.flaskTimer <= 0 && d < 280) {
          this.flaskTimer = 160 + Math.floor(Math.random() * 60); // 3-4 seconds cooldown
          throwToxicFlask(this.x, this.y, playerTarget.x, playerTarget.y, this);
        }
        return;
      }
    }
    
    if (Math.random() < 0.035) this.angle += (Math.random() - 0.5) * 1.6;
    this.vx += Math.cos(this.angle) * this.acceleration * 0.6;
    this.vy += Math.sin(this.angle) * this.acceleration * 0.6;
    
    let spd = Math.hypot(this.vx, this.vy);
    if (spd > this.speed) {
      this.vx = (this.vx / spd) * this.speed;
      this.vy = (this.vy / spd) * this.speed;
    }
  }

  runMageAI(worldCreatures) {
    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (playerTarget && playerTarget.health > 0) {
      let d = Math.hypot(playerTarget.x - this.x, playerTarget.y - this.y);
      if (d < 300) {
        // Face player
        this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
        
        // Evade player fireballs
        for (let fb of fireballs) {
          if (!fb.owner) { // Player's fireball has no owner
            let dist = Math.hypot(fb.x - this.x, fb.y - this.y);
            if (dist < 120) {
              // Projectile flight direction
              let fbAngle = Math.atan2(fb.vy, fb.vx);
              // Choose a side to dodge
              let dodgeSide = (Math.sin(this.x + this.y) > 0) ? Math.PI/2 : -Math.PI/2;
              let evadeAngle = fbAngle + dodgeSide;
              // Lateral dash impulse
              this.vx += Math.cos(evadeAngle) * this.acceleration * 3.5;
              this.vy += Math.sin(evadeAngle) * this.acceleration * 3.5;
              
              // Spawn magic dodge particles
              if (Math.random() < 0.25) {
                particles.push({
                  x: this.x,
                  y: this.y,
                  vx: (Math.random() - 0.5) * 1.5,
                  vy: (Math.random() - 0.5) * 1.5,
                  size: Math.random() * 3 + 1.5,
                  color: '#c084fc',
                  life: 12
                });
              }
              break;
            }
          }
        }
        
        // Back away if player gets too close
        if (d < 140) {
          this.vx -= Math.cos(this.angle) * this.acceleration * 1.1;
          this.vy -= Math.sin(this.angle) * this.acceleration * 1.1;
        } else if (d > 220) {
          // Move slightly closer if too far
          this.vx += Math.cos(this.angle) * this.acceleration * 0.7;
          this.vy += Math.sin(this.angle) * this.acceleration * 0.7;
        }
        
        // Shoot magic poison bolt every 80 frames (slower rate of fire)
        if (ticks % 80 === 0 && d < 280) {
          fireballs.push({
            x: this.x + Math.cos(this.angle) * this.size,
            y: this.y + Math.sin(this.angle) * this.size,
            vx: Math.cos(this.angle) * 3.2,
            vy: Math.sin(this.angle) * 3.2,
            size: 4.5,
            owner: this // enemy caster owner
          });
          synth.playFire();
        }
      }
    }
  }

  runBomberAI(worldCreatures) {
    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (playerTarget && playerTarget.health > 0) {
      let d = Math.hypot(playerTarget.x - this.x, playerTarget.y - this.y);
      
      // Face player
      this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
      
      // Charge fast at player
      this.vx += Math.cos(this.angle) * this.acceleration * 1.6;
      this.vy += Math.sin(this.angle) * this.acceleration * 1.6;
      
      // Explode when close
      if (d < this.size + playerTarget.size + 12) {
        createExplosion(this.x, this.y, '#22c55e', 20); // Toxic green explosion
        synth.playDamage();
        
        let levelFactor = state.level === 2 ? 0.20 : (state.level - 1) * 0.40;
        let dmg = 22 * (1 + levelFactor);
        if (playerTarget.armor > 0) dmg *= (1 - playerTarget.armor);
        playerTarget.health -= dmg;
        
        playerTarget.vx += Math.cos(this.angle) * 7.5;
        playerTarget.vy += Math.sin(this.angle) * 7.5;
        
        logRow(`💥 Чумная крыса-камикадзе взорвалась рядом с вами! Нанесено: ${dmg.toFixed(0)} урона!`, "danger");
        if (playerTarget.health <= 0) triggerDeath();
        
        let idx = bots.indexOf(this);
        if (idx !== -1) bots.splice(idx, 1);
      }
    }
  }

  runGoblinAI(worldCreatures) {
    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (playerTarget && playerTarget.health > 0) {
      let d = Math.hypot(playerTarget.x - this.x, playerTarget.y - this.y);
      this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
      
      if (d < 50) {
        // Attack
        this.vx += Math.cos(this.angle) * this.acceleration * 1.5;
        this.vy += Math.sin(this.angle) * this.acceleration * 1.5;
      } else {
        // Fast zig-zag approach
        let wiggle = Math.sin(ticks * 0.15) * 0.45;
        this.vx += Math.cos(this.angle + wiggle) * this.acceleration * 1.4;
        this.vy += Math.sin(this.angle + wiggle) * this.acceleration * 1.4;
      }
    }
  }

  runOrcAI(worldCreatures) {
    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (playerTarget && playerTarget.health > 0) {
      let d = Math.hypot(playerTarget.x - this.x, playerTarget.y - this.y);
      this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
      
      // Check frenzy
      let inFrenzy = this.health < this.maxHealth * 0.5;
      let spdMult = inFrenzy ? 1.7 : 1.0;
      
      this.vx += Math.cos(this.angle) * this.acceleration * 1.15 * spdMult;
      this.vy += Math.sin(this.angle) * this.acceleration * 1.15 * spdMult;
    }
  }

  runVampireAI(worldCreatures) {
    // Vampire: teleports close to player and drains health on contact
    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (!playerTarget || playerTarget.health <= 0) return;

    let d = Math.hypot(playerTarget.x - this.x, playerTarget.y - this.y);
    this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);

    // Shadow blink towards player every 3–4 seconds
    if (!this.vampireBlinkTimer) this.vampireBlinkTimer = 0;
    this.vampireBlinkTimer--;
    if (this.vampireBlinkTimer <= 0 && d > 80) {
      this.vampireBlinkTimer = 180 + Math.floor(Math.random() * 60);
      // Purple blink particles
      for (let i = 0; i < 10; i++) {
        particles.push({
          x: this.x + (Math.random() - 0.5) * 20,
          y: this.y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          size: Math.random() * 3 + 1.5,
          color: 'rgba(124,58,237,0.8)',
          life: 18
        });
      }
      // Teleport adjacent to player
      let ta = Math.random() * Math.PI * 2;
      this.x = playerTarget.x + Math.cos(ta) * (playerTarget.size + this.size + 8);
      this.y = playerTarget.y + Math.sin(ta) * (playerTarget.size + this.size + 8);
    }

    // Drain health on close contact
    if (d < this.size + playerTarget.size + 5) {
      if (ticks % 12 === 0) {
        let dmg = 3.5 * (1 + (state.level - 1) * 0.15); // Nerfed base damage & multiplier
        if (playerTarget.armor > 0) dmg *= (1 - playerTarget.armor);
        playerTarget.health -= dmg;
        // Heal vampire a little
        this.health = Math.min(this.maxHealth, this.health + dmg * 0.25);
        // Red drain particles
        for (let i = 0; i < 4; i++) {
          particles.push({
            x: playerTarget.x + (Math.random() - 0.5) * 15,
            y: playerTarget.y + (Math.random() - 0.5) * 15,
            vx: (this.x - playerTarget.x) * 0.05,
            vy: (this.y - playerTarget.y) * 0.05,
            size: Math.random() * 2.5 + 1,
            color: 'rgba(220,38,38,0.7)',
            life: 14
          });
        }
        logRow('🧛 Вампир высасывает вашу жизненную силу! -' + dmg.toFixed(0) + ' HP', 'danger');
        if (playerTarget.health <= 0) triggerDeath();
      }
    }

    // Hover near player
    if (d > 60) {
      this.vx += Math.cos(this.angle) * this.acceleration * 1.2;
      this.vy += Math.sin(this.angle) * this.acceleration * 1.2;
    } else {
      this.vx *= 0.92; this.vy *= 0.92;
    }
    let spd = Math.hypot(this.vx, this.vy);
    if (spd > this.speed * 1.3) {
      this.vx = (this.vx / spd) * this.speed * 1.3;
      this.vy = (this.vy / spd) * this.speed * 1.3;
    }
  }

  runShamanAI(worldCreatures) {
    // Shaman: stays at medium range, lobs poison projectiles
    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (!playerTarget || playerTarget.health <= 0) return;

    let d = Math.hypot(playerTarget.x - this.x, playerTarget.y - this.y);
    this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);

    let preferDist = 180;
    if (d < preferDist - 30) {
      // Back away
      this.vx -= Math.cos(this.angle) * this.acceleration * 1.1;
      this.vy -= Math.sin(this.angle) * this.acceleration * 1.1;
    } else if (d > preferDist + 30) {
      // Move closer
      this.vx += Math.cos(this.angle) * this.acceleration * 0.9;
      this.vy += Math.sin(this.angle) * this.acceleration * 0.9;
    } else {
      // Strafe sideways
      let strafeAngle = this.angle + Math.PI / 2;
      this.vx += Math.cos(strafeAngle) * this.acceleration * 0.6;
      this.vy += Math.sin(strafeAngle) * this.acceleration * 0.6;
    }

    // Fire poison bolt every 2.5 seconds
    let shamanRate = Math.max(40, 150 - state.level * 10);
    if (ticks % shamanRate === 0 && d < 300) {
      fireballs.push({
        x: this.x + Math.cos(this.angle) * this.size,
        y: this.y + Math.sin(this.angle) * this.size,
        vx: Math.cos(this.angle) * 3.0,
        vy: Math.sin(this.angle) * 3.0,
        size: 5,
        color: '#22c55e',
        isPoison: true,
        owner: this
      });
    }

    let spd = Math.hypot(this.vx, this.vy);
    if (spd > this.speed) {
      this.vx = (this.vx / spd) * this.speed;
      this.vy = (this.vy / spd) * this.speed;
    }
  }

  runGuardAI(worldCreatures) {
    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (playerTarget && playerTarget.health > 0) {
      let d = Math.hypot(playerTarget.x - this.x, playerTarget.y - this.y);
      if (d < 240) {
        this.alertAllies(worldCreatures);
        
        // Flank/surround mechanic: Calculate position on a circle around the player
        let guardsChasing = bots.filter(b => b.type === 'guard');
        let myIndex = guardsChasing.indexOf(this);
        if (myIndex === -1) myIndex = 0;
        
        // Distribute flank target angles dynamically based on how many guards are active
        let surroundAngle = (myIndex * (Math.PI * 2)) / Math.max(1, guardsChasing.length) + (Date.now() * 0.0006);
        let surroundDist = 12; // stay close to hit player
        
        let tx = playerTarget.x + Math.cos(surroundAngle) * surroundDist;
        let ty = playerTarget.y + Math.sin(surroundAngle) * surroundDist;
        
        let targetAngle = Math.atan2(ty - this.y, tx - this.x);
        this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x); // face player directly
        
        this.vx += Math.cos(targetAngle) * this.acceleration * 1.35;
        this.vy += Math.sin(targetAngle) * this.acceleration * 1.35;
        return;
      }
    }
    
    if (Math.random() < 0.035) this.angle += (Math.random() - 0.5) * 1.6;
    this.vx += Math.cos(this.angle) * this.acceleration * 0.7;
    this.vy += Math.sin(this.angle) * this.acceleration * 0.7;
    
    let spd = Math.hypot(this.vx, this.vy);
    if (spd > this.speed) {
      this.vx = (this.vx / spd) * this.speed;
      this.vy = (this.vy / spd) * this.speed;
    }
  }

  alertAllies(worldCreatures) {
    if (this.alertCooldown && this.alertCooldown > 0) return;
    this.alertCooldown = 180; // 3 seconds cooldown
    
    logRow("⚔️ Стражник кричит: «Тревога! Нарушитель в замке!»", "danger");
    
    // Shout sound wave particles
    for (let r = 10; r <= 80; r += 15) {
      particles.push({
        x: this.x,
        y: this.y,
        vx: 0,
        vy: 0,
        size: r,
        color: 'rgba(239, 68, 68, 0.08)',
        life: 15,
        isRing: true
      });
    }

    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (!playerTarget) return;

    // Alert nearby guards (within 400px)
    for (let other of bots) {
      if (other !== this && (other.type === 'guard' || other.type === 'boss')) {
        let dist = Math.hypot(other.x - this.x, other.y - this.y);
        if (dist < 400) {
          other.angle = Math.atan2(playerTarget.y - other.y, playerTarget.x - other.x);
          other.vx += Math.cos(other.angle) * other.acceleration * 2.0;
          other.vy += Math.sin(other.angle) * other.acceleration * 2.0;
          
          // Draw warning exclamation above them
          particles.push({
            x: other.x,
            y: other.y - other.size - 8,
            vx: 0,
            vy: -0.5,
            size: 2,
            color: '#ef4444',
            life: 25,
            isExclamation: true
          });
        }
      }
    }
  }

  runBossAI(worldCreatures) {
    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (!playerTarget || playerTarget.health <= 0) {
      this.bossState = 'patrol';
      this.shieldActive = false;
      this.spinActive = false;
      this.rageWarnTimer = 0;
      return;
    }

    let d = Math.hypot(playerTarget.x - this.x, playerTarget.y - this.y);

    // Update timers
    if (this.rageWarnTimer > 0) this.rageWarnTimer--;
    if (this.spinTimer > 0) {
      this.spinTimer--;
      if (this.spinTimer <= 0) {
        this.spinActive = false;
        this.bossState = 'chase';
      }
    }
    if (this.rageTimer > 0) this.rageTimer--;

    let level = (typeof state !== 'undefined' && state.level) ? state.level : 1;
    let speedScale = level === 2 ? 1.04 : 1 + (level - 1) * 0.08;
    let dmgScale   = level === 2 ? 1.08 : 1 + (level - 1) * 0.18;

    let phase = level <= 1 ? 1 : level === 2 ? 2 : level === 3 ? 3 : 4;

    if (phase === 1) {
      // ----------------------------------------------------
      // FLOOR 1: CHIEF WARDEN (Shield blocks front, spawns guards)
      // ----------------------------------------------------
      // Spawn guards helper
      if (ticks % 360 === 0 && d < 400) {
        let guardsAround = bots.filter(b => b.type === 'guard' || b.type === 'halberdier').length;
        if (guardsAround < 3) {
          let a = Math.random() * Math.PI * 2;
          let gx = this.x + Math.cos(a) * 60;
          let gy = this.y + Math.sin(a) * 60;
          bots.push(new Organism(gx, gy, false, Math.random() < 0.35 ? 'halberdier' : 'guard'));
          logRow("🛡️ Начальник стражи призвал подкрепление!", "warning");
          createExplosion(gx, gy, '#ef4444', 8);
        }
      }

      if (this.bossState === 'spin') {
        this.spinActive = true;
        this.shieldActive = false;
        
        if (ticks % 4 === 0 && d < 65) {
          let dmg = 9 * dmgScale;
          if (playerTarget.armor > 0) dmg *= (1 - playerTarget.armor);
          playerTarget.health -= dmg;
          playerTarget.vx += Math.cos(Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x)) * 3.5;
          playerTarget.vy += Math.sin(Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x)) * 3.5;
          synth.playDamage();
          logRow("Вы попали под круговую атаку Начальника стражи! Урон: " + dmg.toFixed(0), "danger");
          if (playerTarget.health <= 0) triggerDeath();
        }
        
        let targetAngle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
        this.angle = targetAngle;
        this.vx += Math.cos(this.angle) * this.acceleration * 0.45;
        this.vy += Math.sin(this.angle) * this.acceleration * 0.45;
        return;
      }

      // Trigger spin attack
      let spinRange = 160;
      if (d < spinRange && this.rageTimer <= 0 && this.bossState !== 'spin') {
        if (this.rageWarnTimer === 0) {
          this.rageWarnTimer = 40;
          logRow("Начальник стражи замахивается для кругового удара!", "danger");
        } else if (this.rageWarnTimer === 1) {
          this.bossState = 'spin';
          this.spinTimer = 90;
          this.rageTimer = 180;
        }
        this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
        return;
      }

      if (d < 300) {
        this.bossState = 'chase';
        this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
        // Constantly hold shield when close to player
        if (d < 150) {
          this.shieldActive = true;
        } else {
          this.shieldActive = false;
        }
        let chaseSpd = (this.shieldActive ? 0.6 : 1.35) * speedScale;
        this.vx += Math.cos(this.angle) * this.acceleration * chaseSpd;
        this.vy += Math.sin(this.angle) * this.acceleration * chaseSpd;
      } else {
        this.bossState = 'patrol';
        this.shieldActive = false;
        if (Math.random() < 0.02) this.angle += (Math.random() - 0.5) * 1.5;
        this.vx += Math.cos(this.angle) * this.acceleration * 0.6;
        this.vy += Math.sin(this.angle) * this.acceleration * 0.6;
      }

      let spd = Math.hypot(this.vx, this.vy);
      let maxSpd = (this.bossState === 'chase' ? 1.45 : 0.85) * speedScale;
      if (this.shieldActive) maxSpd = 0.65 * speedScale;
      if (spd > maxSpd) {
        this.vx = (this.vx / spd) * maxSpd;
        this.vy = (this.vy / spd) * maxSpd;
      }

    } else if (phase === 2) {
      // ----------------------------------------------------
      // FLOOR 2: GOBLIN KING (Throws dagger fan, spawns bombers)
      // ----------------------------------------------------
      this.shieldActive = false;
      this.spinActive = false;

      // Spawn kamikaze minions
      if (ticks % 420 === 0 && d < 400) {
        let minions = bots.filter(b => b.type === 'bomber' || b.type === 'goblin').length;
        if (minions < 4) {
          let a = Math.random() * Math.PI * 2;
          let gx = this.x + Math.cos(a) * 60;
          let gy = this.y + Math.sin(a) * 60;
          bots.push(new Organism(gx, gy, false, Math.random() < 0.45 ? 'bomber' : 'goblin'));
          logRow("💣 Гоблинский Король призвал приспешников-камикадзе!", "warning");
          createExplosion(gx, gy, '#eab308', 8);
        }
      }

      if (d < 350) {
        this.bossState = 'chase';
        this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);

        // Throw dagger fan
        if (this.rageTimer <= 0 && Math.random() < 0.015) {
          let targetAngle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
          for (let offset = -2; offset <= 2; offset++) {
            let a = targetAngle + offset * 0.22;
            fireballs.push({
              x: this.x + Math.cos(a) * this.size,
              y: this.y + Math.sin(a) * this.size,
              vx: Math.cos(a) * 6.5,
              vy: Math.sin(a) * 6.5,
              size: 4.5,
              owner: this
            });
          }
          synth.playFire();
          logRow("🗡️ Гоблинский Король бросает веер кинжалов!", "warning");
          this.rageTimer = 150;
        }

        // Keep distance, back away if player is too close
        if (d < 110) {
          this.vx -= Math.cos(this.angle) * this.acceleration * 1.3;
          this.vy -= Math.sin(this.angle) * this.acceleration * 1.3;
        } else {
          this.vx += Math.cos(this.angle) * this.acceleration * 0.95 * speedScale;
          this.vy += Math.sin(this.angle) * this.acceleration * 0.95 * speedScale;
        }
      } else {
        this.bossState = 'patrol';
        if (Math.random() < 0.02) this.angle += (Math.random() - 0.5) * 1.5;
        this.vx += Math.cos(this.angle) * this.acceleration * 0.6;
        this.vy += Math.sin(this.angle) * this.acceleration * 0.6;
      }

      let spd = Math.hypot(this.vx, this.vy);
      let maxSpd = (this.bossState === 'chase' ? 1.6 : 0.9) * speedScale;
      if (spd > maxSpd) {
        this.vx = (this.vx / spd) * maxSpd;
        this.vy = (this.vy / spd) * maxSpd;
      }

    } else if (phase === 3) {
      // ----------------------------------------------------
      // FLOOR 3: ALCHEMICAL BEAST (Charge, leaves poison puddles, throws toxic flasks)
      // ----------------------------------------------------
      this.shieldActive = false;

      // SpinActive represents Beast Charge/Dash!
      if (this.bossState === 'spin') {
        this.spinActive = true;
        
        // Spawn green poison particles
        if (ticks % 2 === 0) {
          particles.push({
            x: this.x + (Math.random() - 0.5) * this.size,
            y: this.y + (Math.random() - 0.5) * this.size,
            vx: -Math.cos(this.angle) * 2 + (Math.random() - 0.5) * 1.5,
            vy: -Math.sin(this.angle) * 2 + (Math.random() - 0.5) * 1.5,
            size: Math.random() * 4 + 2,
            color: 'rgba(34, 197, 94, 0.65)',
            life: 20
          });
        }

        // Leave acid puddles behind
        if (ticks % 4 === 0) {
          acidPuddles.push({
            x: this.x,
            y: this.y,
            size: 24,
            life: 140,
            isPlayerAcid: false
          });
        }

        // Crash damage
        if (ticks % 5 === 0 && d < this.size + playerTarget.size + 10) {
          let dmg = 18 * dmgScale;
          if (playerTarget.armor > 0) dmg *= (1 - playerTarget.armor);
          playerTarget.health -= dmg;
          playerTarget.vx += Math.cos(this.angle) * 6.5;
          playerTarget.vy += Math.sin(this.angle) * 6.5;
          synth.playDamage();
          logRow("💥 Алхимический Зверь протаранил вас! Урон: " + dmg.toFixed(0), "danger");
          if (playerTarget.health <= 0) triggerDeath();
        }

        // Move fast in direct line
        this.vx += Math.cos(this.angle) * this.acceleration * 2.8;
        this.vy += Math.sin(this.angle) * this.acceleration * 2.8;
        
        let spd = Math.hypot(this.vx, this.vy);
        let maxSpd = this.speed * 2.2;
        if (spd > maxSpd) {
          this.vx = (this.vx / spd) * maxSpd;
          this.vy = (this.vy / spd) * maxSpd;
        }
        return;
      }

      if (d < 300) {
        this.bossState = 'chase';
        
        // Decide charge or toxic flasks throw
        if (this.rageTimer <= 0 && this.rageWarnTimer === 0) {
          if (d > 130 && Math.random() < 0.02) {
            this.rageWarnTimer = 30;
            logRow("🗿 Алхимический Зверь готовится к тарану!", "warning");
            this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
          } else if (Math.random() < 0.025) {
            // Throw 3 toxic flasks
            let targetAngle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
            for (let offset = -1; offset <= 1; offset++) {
              let a = targetAngle + offset * 0.3;
              let tx = playerTarget.x + Math.cos(a + Math.PI/2) * (offset * 40);
              let ty = playerTarget.y + Math.sin(a + Math.PI/2) * (offset * 40);
              throwToxicFlask(this.x, this.y, tx, ty, this);
            }
            logRow("🧪 Алхимический Зверь разбрасывает ядовитые колбы!", "danger");
            this.rageTimer = 160;
          }
        } else if (this.rageWarnTimer === 1) {
          // Trigger Charge!
          this.bossState = 'spin';
          this.spinTimer = 65; // Charge for ~1s
          this.rageTimer = 180; // Cooldown 3s
        }

        if (this.rageWarnTimer > 0) {
          // Rotate towards player slowly during telegraph
          let desiredAngle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
          let diff = desiredAngle - this.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.angle += diff * 0.05;
          this.vx *= 0.85;
          this.vy *= 0.85;
        } else {
          this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
          this.vx += Math.cos(this.angle) * this.acceleration * 0.85;
          this.vy += Math.sin(this.angle) * this.acceleration * 0.85;
        }
      } else {
        this.bossState = 'patrol';
        if (Math.random() < 0.02) this.angle += (Math.random() - 0.5) * 1.5;
        this.vx += Math.cos(this.angle) * this.acceleration * 0.6;
        this.vy += Math.sin(this.angle) * this.acceleration * 0.6;
      }

      let spd = Math.hypot(this.vx, this.vy);
      let maxSpd = (this.bossState === 'chase' ? 1.05 : 0.65) * speedScale;
      if (spd > maxSpd) {
        this.vx = (this.vx / spd) * maxSpd;
        this.vy = (this.vy / spd) * maxSpd;
      }

    } else {
      // ----------------------------------------------------
      // FLOOR 4: ABYSS PALADIN (Blinks behind player, circle fireballs, reflects fireballs)
      // ----------------------------------------------------
      this.spinActive = false;

      // Shield active for 200 ticks (3.3s), inactive for 250 ticks (4.1s)
      let cycle = ticks % 450;
      this.shieldActive = (cycle < 200);

      // Reflect player fireballs ONLY when shield is active
      if (this.shieldActive) {
        for (let fb of fireballs) {
          if (fb.owner && fb.owner.isPlayer) {
            let distToFb = Math.hypot(fb.x - this.x, fb.y - this.y);
            if (distToFb < 120) {
              fb.owner = this;
              let angleToPlayer = Math.atan2(playerTarget.y - fb.y, playerTarget.x - fb.x);
              fb.vx = Math.cos(angleToPlayer) * 8.0;
              fb.vy = Math.sin(angleToPlayer) * 8.0;
              
              // Visual sparks
              for (let k = 0; k < 5; k++) {
                particles.push({
                  x: fb.x,
                  y: fb.y,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
                  size: Math.random() * 3 + 1,
                  color: '#c084fc',
                  life: 15
                });
              }
              logRow("🔮 Паладин отразил ваш снаряд!", "warning");
            }
          }
        }
      }

      if (d < 500) {
        this.bossState = 'chase';
        this.angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);

        // Blink teleport behind player
        if (this.rageTimer <= 0 && Math.random() < 0.012) {
          for (let k = 0; k < 12; k++) {
            particles.push({
              x: this.x + (Math.random() - 0.5) * 25,
              y: this.y + (Math.random() - 0.5) * 25,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 3,
              size: Math.random() * 3 + 1.5,
              color: 'rgba(168, 85, 247, 0.8)',
              life: 20
            });
          }
          
          let tpAngle = playerTarget.angle + Math.PI + (Math.random() - 0.5) * 0.5;
          let tpDist = 70 + Math.random() * 30;
          let newX = playerTarget.x + Math.cos(tpAngle) * tpDist;
          let newY = playerTarget.y + Math.sin(tpAngle) * tpDist;
          
          this.x = newX;
          this.y = newY;
          checkWallCollisions(this);
          
          for (let k = 0; k < 12; k++) {
            particles.push({
              x: this.x + (Math.random() - 0.5) * 25,
              y: this.y + (Math.random() - 0.5) * 25,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 3,
              size: Math.random() * 3 + 1.5,
              color: 'rgba(168, 85, 247, 0.8)',
              life: 20
            });
          }
          synth.playFire();
          logRow("🔮 Абсолютный Паладин телепортировался вам за спину!", "danger");
          this.rageTimer = 220; // Cooldown
        }

        // Circular wave of fireballs
        if (ticks % 380 === 0 && d < 400) {
          let numBolts = 12;
          for (let bi = 0; bi < numBolts; bi++) {
            let a = (bi / numBolts) * Math.PI * 2;
            fireballs.push({
              x: this.x,
              y: this.y,
              vx: Math.cos(a) * 5.0,
              vy: Math.sin(a) * 5.0,
              size: 5.5,
              owner: this
            });
          }
          synth.playFire();
          logRow("🔥 Абсолютный Паладин выпускает круговую волну огня!", "danger");
        }

        this.vx += Math.cos(this.angle) * this.acceleration * 1.15 * speedScale;
        this.vy += Math.sin(this.angle) * this.acceleration * 1.15 * speedScale;
      } else {
        this.bossState = 'patrol';
        if (Math.random() < 0.02) this.angle += (Math.random() - 0.5) * 1.5;
        this.vx += Math.cos(this.angle) * this.acceleration * 0.6;
        this.vy += Math.sin(this.angle) * this.acceleration * 0.6;
      }

      let spd = Math.hypot(this.vx, this.vy);
      let maxSpd = (this.bossState === 'chase' ? 1.5 : 0.8) * speedScale;
      if (spd > maxSpd) {
        this.vx = (this.vx / spd) * maxSpd;
        this.vy = (this.vy / spd) * maxSpd;
      }
    }
  }
  
  runRatAI(worldCreatures) {
    let playerTarget = worldCreatures.find(c => c.isPlayer);
    if (playerTarget) {
      let d = Math.hypot(playerTarget.x - this.x, playerTarget.y - this.y);
      if (d < 170) {
        let runAngle = Math.atan2(this.y - playerTarget.y, this.x - playerTarget.x);
        this.angle = runAngle;
        this.vx += Math.cos(this.angle) * this.acceleration * 1.6;
        this.vy += Math.sin(this.angle) * this.acceleration * 1.6;
        return;
      }
    }
    
    if (Math.random() < 0.06) this.angle += (Math.random() - 0.5) * 1.4;
    this.vx += Math.cos(this.angle) * this.acceleration * 0.65;
    this.vy += Math.sin(this.angle) * this.acceleration * 0.65;
    
    let spd = Math.hypot(this.vx, this.vy);
    if (spd > this.speed) {
      this.vx = (this.vx / spd) * this.speed;
      this.vy = (this.vy / spd) * this.speed;
    }
  }
  
  steerTowards(tx, ty) {
    let targetAngle = Math.atan2(ty - this.y, tx - this.x);
    let diff = targetAngle - this.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    
    this.angle += diff * 0.16;
    
    let accel = this.acceleration;
    let maxSpd = this.speed;
    if (this.sprinting) {
      let dashSpeedMult = state.genes.ldha ? 2.2 : 1.5;
      accel *= (dashSpeedMult * 1.5);
      maxSpd *= dashSpeedMult;
    }
    
    this.vx += Math.cos(this.angle) * accel;
    this.vy += Math.sin(this.angle) * accel;
    
    let currentSpeed = Math.hypot(this.vx, this.vy);
    if (currentSpeed > maxSpd) {
      this.vx = (this.vx / currentSpeed) * maxSpd;
      this.vy = (this.vy / currentSpeed) * maxSpd;
    }
  }
  
  activateSprint() {
    if (this.isPlayer && !this.sprinting && this.sprintCooldown === 0) {
      // Basic dash works for everyone!
      let cost = state.genes.ldha ? 4 : 8; // LDHA is more efficient
      if (this.energy > cost) {
        this.sprinting = true;
        this.sprintTimer = 20; 
        this.sprintCooldown = state.genes.ldha ? 35 : 90; // Much shorter cooldown with LDHA
        this.energy = Math.max(0, this.energy - cost);
        
        // Find movement direction to apply dash impulse
        let moveX = 0;
        let moveY = 0;
        if (typeof keys !== 'undefined') {
          if (keys['KeyW'] || keys['ArrowUp']) moveY = -1;
          if (keys['KeyS'] || keys['ArrowDown']) moveY = 1;
          if (keys['KeyA'] || keys['ArrowLeft']) moveX = -1;
          if (keys['KeyD'] || keys['ArrowRight']) moveX = 1;
        }
        
        let impulseAngle = this.angle; // default to aiming direction
        if (moveX !== 0 || moveY !== 0) {
          impulseAngle = Math.atan2(moveY, moveX); // dash in movement direction
        }
        
        // Instant speed boost!
        let impulsePower = state.genes.ldha ? 13.5 : 9.5;
        this.vx = Math.cos(impulseAngle) * impulsePower;
        this.vy = Math.sin(impulseAngle) * impulsePower;
        
        // Dash particle tail / sparks
        let dashColor = state.genes.ldha ? 'rgba(34, 211, 238, 0.75)' : 'rgba(245, 158, 11, 0.75)'; // cyan/amber
        for (let i = 0; i < 12; i++) {
          particles.push({
            x: this.x + (Math.random() - 0.5) * this.size,
            y: this.y + (Math.random() - 0.5) * this.size,
            vx: -Math.cos(impulseAngle) * 4.0 + (Math.random() - 0.5) * 3,
            vy: -Math.sin(impulseAngle) * 4.0 + (Math.random() - 0.5) * 3,
            size: Math.random() * 3.5 + 1.5,
            color: dashColor,
            life: 14 + Math.random() * 8
          });
        }
        
        // Exclamation tag above player
        particles.push({
          x: this.x,
          y: this.y - this.size - 10,
          vx: 0,
          vy: -0.5,
          size: 0,
          color: '#facc15',
          life: 25,
          isExclamation: true,
          text: 'РЫВОК!'
        });
        
        synth.playFire(); // Play dash sound
      }
    }
  }
  
  draw(ctx) {
    if (typeof player !== 'undefined' && this === player) {
      this.isPlayer = true;
      if (this.type === 'boss') {
        this.type = 'slime';
      }
    } else {
      this.isPlayer = false;
      if (this.maxHealth >= 300) {
        this.type = 'boss';
      } else if (this.type === 'boss') {
        this.type = 'guard';
      }
    }
    
    // Draw creature drop shadow on floor
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.size * 0.35, this.size * 0.95, this.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw ghost trail if sprinting
    if (this.sprinting && this.trail && this.trail.length > 0) {
      ctx.save();
      for (let i = 0; i < this.trail.length; i++) {
        let pt = this.trail[i];
        let alpha = (i + 1) * 0.08; // fade out older positions
        ctx.fillStyle = this.isPlayer ? `rgba(245, 158, 11, ${alpha})` : `rgba(239, 68, 68, ${alpha})`; // Amber for player, red for bots
        
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.size * 0.95, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    
    // Draw mental mind aura for the player (pulsing bio-electric shield)
    if (this.isPlayer) {
      let brainActivity = 0;
      if (this.lastPrediction && this.lastPrediction.hidden) {
        brainActivity = this.lastPrediction.hidden.reduce((sum, val) => sum + Math.abs(val), 0) / this.lastPrediction.hidden.length;
      }
      
      let alert = this.alertLevel || 0;
      let auraRadius = this.size * (1.55 + brainActivity * 0.5 + alert * 0.4);
      let auraGlow = ctx.createRadialGradient(this.x, this.y, this.size * 0.65, this.x, this.y, auraRadius);
      
      // Blue-cyan aura if calm, pink-magenta aura if alert
      let rR = Math.floor(alert * 239 + (1 - alert) * 34);
      let rG = Math.floor(alert * 68 + (1 - alert) * 211);
      let rB = Math.floor(alert * 68 + (1 - alert) * 238);
      
      let alpha = 0.16 + brainActivity * 0.22;
      auraGlow.addColorStop(0, `rgba(${rR}, ${rG}, ${rB}, ${alpha})`);
      auraGlow.addColorStop(0.5, `rgba(${rR}, ${rG}, ${rB}, ${alpha * 0.35})`);
      auraGlow.addColorStop(1, `rgba(${rR}, ${rG}, ${rB}, 0)`);
      
      ctx.save();
      ctx.fillStyle = auraGlow;
      ctx.beginPath();
      ctx.arc(this.x, this.y, auraRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Subtle neural network connection pulses in the aura
      ctx.strokeStyle = `rgba(${rR}, ${rG}, ${rB}, ${alpha * 0.45})`;
      ctx.lineWidth = 0.8;
      let timeFactor = Date.now() * 0.002;
      for (let k = 0; k < 3; k++) {
        let pulseRad = this.size * (1.1 + k * 0.35 + Math.sin(timeFactor + k) * 0.15);
        if (pulseRad < auraRadius) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, pulseRad, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    
    // 1. Draw wings from generated limbs (stage 4)
    if (this.isPlayer) {
      let wings = this.limbs ? this.limbs.filter(l => l.type === 'wing') : [];
      for (let wing of wings) {
        let excitement = this.excitementLevel || 0;
        let alert = this.alertLevel || 0;
        
        let flapFreq = 0.9 + excitement * 2.2;
        let flap = Math.sin(this.wiggleTimer * flapFreq) * 0.55 + 0.2;
        
        let rR = Math.floor(alert * 255);
        let rG = Math.floor((1 - alert) * 240);
        let rB = Math.floor((1 - alert) * 255 + alert * 109);
        
        ctx.fillStyle = `rgba(${rR}, ${rG}, ${rB}, ${0.28 + excitement * 0.15})`;
        ctx.strokeStyle = `rgb(${rR}, ${rG}, ${rB})`;
        ctx.lineWidth = 2.5 + excitement * 1.5;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        let wAngle = (Math.PI / 2.1 + flap) * wing.side;
        let lx = Math.cos(wAngle) * wing.length;
        let ly = Math.sin(wAngle) * wing.length;
        ctx.lineTo(lx, ly);
        ctx.lineTo(-Math.cos(0) * (this.size * 0.8), -Math.sin(0) * (this.size * 0.8));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
      }
    }
    
    // 2. Draw segments from tail to neck
    if (this.segments.length > 0) {
      if (this.isPlayer && state.stage === 4) {
        // Flowing velvet cape for the knight player (3 segments)
        for (let i = this.segments.length - 1; i >= 0; i--) {
          let seg = this.segments[i];
          let segSize = this.size * (1.1 - (i / this.segments.length) * 0.35);
          
          ctx.fillStyle = this.capeColor || '#991b1b';
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, segSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else if (!this.isPlayer) {
        // Draw normal bot segments (rats tail or guard armor folds)
        for (let i = this.segments.length - 1; i >= 0; i--) {
          let seg = this.segments[i];
          let segSize = this.size * (1 - (i / this.segments.length) * 0.45);
          
          ctx.fillStyle = this.color;
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, segSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#050508';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    
    // 3. Draw head
    if (this.isPlayer) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      
      let stage = state.stage || 1;
      
      let brainActivity = 0;
      if (this.lastPrediction && this.lastPrediction.hidden) {
        brainActivity = this.lastPrediction.hidden.reduce((sum, val) => sum + Math.abs(val), 0) / this.lastPrediction.hidden.length;
      }
      // Pulsing deformation factor based on brain activity and time
      let neuralDeformX = 1.0 + Math.sin(Date.now() * 0.012) * 0.07 * brainActivity;
      let neuralDeformY = 1.0 + Math.cos(Date.now() * 0.012) * 0.07 * brainActivity;
      
      if (stage === 1) {
        // ==========================================
        // STAGE 1: AMORPHOUS SLIME — blob creature
        // ==========================================
        let t = Date.now() * 0.003;
        let skinColor = state.activeSkin !== 'default' ? this.color : (state.genes.rubisco ? '#4ade80' : '#7dd3fc');
        let shadowCol = state.activeSkin !== 'default' ? (this.glowColor || this.color) : (state.genes.rubisco ? '#16a34a' : '#0ea5e9');

        // Pulsing blob body
        ctx.shadowBlur = 12;
        ctx.shadowColor = shadowCol;
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        // Wobbly ellipse using 8 bezier points
        let r = this.size;
        let wx = r * (1.15 + Math.sin(t * 1.1) * 0.12) * neuralDeformX;
        let wy = r * (0.95 + Math.cos(t * 0.9) * 0.10) * neuralDeformY;
        ctx.ellipse(0, 0, wx, wy, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Dark outline
        ctx.strokeStyle = '#0c4a6e';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Highlight sheen (top-left)
        let hl = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 0, -r * 0.3, -r * 0.35, r * 0.5);
        hl.addColorStop(0, 'rgba(255,255,255,0.35)');
        hl.addColorStop(1, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = hl;
        ctx.beginPath();
        ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.5, r * 0.4, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Chitin bumps
        if (state.genes.chit1) {
          ctx.fillStyle = '#0e7490';
          for (let i = 0; i < 3; i++) {
            let bx = (i - 1) * r * 0.4;
            ctx.beginPath();
            ctx.arc(bx, -r * 0.6, r * 0.18, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Eyes — two big round eyes on front-right
        let ex = r * 0.35;
        // Eye whites
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + 2, -r * 0.22, r * 0.32, 0, Math.PI * 2);
        ctx.arc(ex + 2, r * 0.22, r * 0.32, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = state.genes.shh ? '#dc2626' : '#1e3a5f';
        ctx.beginPath();
        ctx.arc(ex + 4, -r * 0.22, r * 0.16, 0, Math.PI * 2);
        ctx.arc(ex + 4, r * 0.22, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
        // Pupil shine
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + 5, -r * 0.27, r * 0.06, 0, Math.PI * 2);
        ctx.arc(ex + 5, r * 0.17, r * 0.06, 0, Math.PI * 2);
        ctx.fill();

        // Mouth — wavy grin
        ctx.strokeStyle = '#0c4a6e';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(ex - 1, r * 0.45);
        ctx.quadraticCurveTo(ex + 5, r * 0.6, ex + 1, r * 0.5);
        ctx.stroke();

        // SHH: sharp tooth protruding
        if (state.genes.shh) {
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.moveTo(ex, r * 0.44);
          ctx.lineTo(ex + 5, r * 0.56);
          ctx.lineTo(ex + 1, r * 0.46);
          ctx.closePath();
          ctx.fill();
        }

        // Tentacle-arms waving
        let arm1Angle = Math.sin(t * 1.5) * 0.5;
        let arm2Angle = Math.cos(t * 1.5) * 0.5;
        ctx.strokeStyle = skinColor;
        ctx.lineWidth = r * 0.32;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.2);
        ctx.quadraticCurveTo(-r * 1.0, -r * 0.7 + Math.sin(t) * r * 0.2, -r * 1.3, -r * 0.5 + Math.sin(t) * r * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, r * 0.2);
        ctx.quadraticCurveTo(-r * 1.0, r * 0.7 + Math.cos(t) * r * 0.2, -r * 1.3, r * 0.5 + Math.cos(t) * r * 0.3);
        ctx.stroke();
        ctx.lineCap = 'butt';

      } else if (stage === 2) {
        // ==========================================
        // STAGE 2: GOBLIN — small sneaky creature
        // ==========================================
        let t = Date.now() * 0.003;
        let skinGreen = state.activeSkin !== 'default' ? this.color : '#4ade80';
        let darkGreen = state.activeSkin !== 'default' ? (this.glowColor || this.color) : '#15803d';
        let swinging = this.excitementLevel > 0.7;

        // Body — hunched oval torso
        ctx.fillStyle = state.activeSkin !== 'default' ? this.color : (state.genes.acta1 ? '#22c55e' : '#86efac');
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.6;
        let bw = state.genes.acta1 ? this.size * 1.3 : this.size * 1.05;
        ctx.beginPath();
        ctx.ellipse(0, 0, bw * neuralDeformX, this.size * 0.85 * neuralDeformY, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Leather vest straps
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-this.size * 0.3, -this.size * 0.6);
        ctx.lineTo(this.size * 0.1, this.size * 0.6);
        ctx.moveTo(this.size * 0.1, -this.size * 0.6);
        ctx.lineTo(-this.size * 0.2, this.size * 0.6);
        ctx.stroke();

        // Chitin spines on back
        if (state.genes.chit1) {
          ctx.fillStyle = '#166534';
          for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(-this.size * 0.7, s * this.size * 0.3 - 2);
            ctx.lineTo(-this.size * 1.15, s * this.size * 0.35);
            ctx.lineTo(-this.size * 0.7, s * this.size * 0.3 + 2);
            ctx.closePath(); ctx.fill();
          }
        }

        // Arms — green skinny
        ctx.fillStyle = '#86efac';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.4;
        // Left arm up
        ctx.beginPath();
        ctx.arc(-this.size * 0.5, -this.size * 0.8, this.size * 0.35, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Right arm
        ctx.beginPath();
        ctx.arc(-this.size * 0.5, this.size * 0.8, this.size * 0.35, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Head — round, bright green
        let hx = this.size * 0.38;
        ctx.fillStyle = skinGreen;
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(hx, 0, this.size * 0.8, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Big Pointy Ears
        ctx.fillStyle = skinGreen;
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.2;
        // Top ear
        ctx.beginPath();
        ctx.moveTo(hx - this.size * 0.35, -this.size * 0.55);
        ctx.lineTo(hx - this.size * 1.0, -this.size * 1.05);
        ctx.lineTo(hx + this.size * 0.05, -this.size * 0.38);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Inner ear
        ctx.fillStyle = '#fca5a5';
        ctx.beginPath();
        ctx.moveTo(hx - this.size * 0.3, -this.size * 0.5);
        ctx.lineTo(hx - this.size * 0.75, -this.size * 0.85);
        ctx.lineTo(hx, -this.size * 0.38);
        ctx.closePath(); ctx.fill();
        // Bottom ear
        ctx.fillStyle = skinGreen;
        ctx.strokeStyle = '#14532d';
        ctx.beginPath();
        ctx.moveTo(hx - this.size * 0.35, this.size * 0.55);
        ctx.lineTo(hx - this.size * 1.0, this.size * 1.05);
        ctx.lineTo(hx + this.size * 0.05, this.size * 0.38);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fca5a5';
        ctx.beginPath();
        ctx.moveTo(hx - this.size * 0.3, this.size * 0.5);
        ctx.lineTo(hx - this.size * 0.75, this.size * 0.85);
        ctx.lineTo(hx, this.size * 0.38);
        ctx.closePath(); ctx.fill();

        // Big nose — bulbous
        ctx.fillStyle = darkGreen;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(hx + this.size * 0.4, 0, this.size * 0.22, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Nostril dots
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(hx + this.size * 0.35, -this.size * 0.07, this.size * 0.05, 0, Math.PI * 2);
        ctx.arc(hx + this.size * 0.35, this.size * 0.07, this.size * 0.05, 0, Math.PI * 2);
        ctx.fill();

        // Yellow eyes with red pupils
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(hx + this.size * 0.05, -this.size * 0.28, this.size * 0.18, 0, Math.PI * 2);
        ctx.arc(hx + this.size * 0.05, this.size * 0.28, this.size * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(hx + this.size * 0.09, -this.size * 0.28, this.size * 0.09, 0, Math.PI * 2);
        ctx.arc(hx + this.size * 0.09, this.size * 0.28, this.size * 0.09, 0, Math.PI * 2);
        ctx.fill();

        // Fangs
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(hx + this.size * 0.15, this.size * 0.4);
        ctx.lineTo(hx + this.size * 0.25, this.size * 0.6);
        ctx.lineTo(hx + this.size * 0.05, this.size * 0.42);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(hx + this.size * 0.28, this.size * 0.4);
        ctx.lineTo(hx + this.size * 0.38, this.size * 0.6);
        ctx.lineTo(hx + this.size * 0.18, this.size * 0.42);
        ctx.closePath(); ctx.fill();

        // Club weapon
        ctx.save();
        ctx.translate(this.size * 0.55, this.size * 0.9);
        let wAngle = swinging ? Math.sin(t * 8) * 1.3 : -0.3;
        ctx.rotate(wAngle);
        // Handle
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, 2); ctx.stroke();
        // Club head
        ctx.fillStyle = '#92400e';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(24, 3, 7, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Nails on club
        ctx.fillStyle = '#cbd5e1';
        for (let n of [[-2,-4],[2,-5],[5,-2],[4,4],[0,6]]) {
          ctx.beginPath(); ctx.arc(24 + n[0], 3 + n[1], 1.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.lineCap = 'butt';
        ctx.restore();

        // SHH extra claws
        if (state.genes.shh) {
          ctx.strokeStyle = '#d1fae5';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-this.size * 0.5, -this.size * 1.15);
          ctx.lineTo(-this.size * 0.65, -this.size * 1.4);
          ctx.moveTo(-this.size * 0.35, -this.size * 1.15);
          ctx.lineTo(-this.size * 0.5, -this.size * 1.4);
          ctx.stroke();
        }

      } else if (stage === 3) {
        // ==========================================
        // STAGE 3: BEASTMAN — feral predator
        // ==========================================
        let t = Date.now() * 0.003;
        let fur = state.activeSkin !== 'default' ? this.color : (this.beastFurColor || '#b45309');
        let darkFur = state.activeSkin !== 'default' ? (this.glowColor || this.color) : '#78350f';
        let swinging = this.excitementLevel > 0.75;

        // Body — broad, muscular torso
        let muscleMult = state.genes.acta1 ? 1.4 : 1.2;
        ctx.fillStyle = fur;
        ctx.strokeStyle = darkFur;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * muscleMult * neuralDeformX, this.size * 0.95 * neuralDeformY, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Fur texture strokes on body
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1.0;
        for (let i = 0; i < 5; i++) {
          let fy = (i - 2) * this.size * 0.35;
          ctx.beginPath();
          ctx.moveTo(-this.size * 0.8, fy);
          ctx.quadraticCurveTo(-this.size * 0.4, fy - this.size * 0.12, 0, fy);
          ctx.stroke();
        }

        // Chitin armor plates on chest
        if (state.genes.chit1) {
          ctx.fillStyle = '#1e1b4b';
          ctx.strokeStyle = '#7c3aed';
          ctx.lineWidth = 1.2;
          for (let s of [-1, 0, 1]) {
            ctx.beginPath();
            ctx.ellipse(s * this.size * 0.3, 0, this.size * 0.18, this.size * 0.28, 0.1, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
          }
        }

        // Massive arms with claws
        ctx.fillStyle = fur;
        ctx.strokeStyle = darkFur;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(-this.size * 0.45, -this.size * 0.9, this.size * 0.48, 0, Math.PI * 2);
        ctx.arc(-this.size * 0.45, this.size * 0.9, this.size * 0.48, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Claws on both arms (SHH: bigger/glowing)
        let clawColor = state.genes.shh ? '#fde68a' : '#f8fafc';
        let clawGlow = state.genes.shh ? '#f59e0b' : null;
        if (clawGlow) { ctx.shadowBlur = 8; ctx.shadowColor = clawGlow; }
        ctx.strokeStyle = clawColor;
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        for (let s of [-1, 1]) {
          for (let j = 0; j < 3; j++) {
            let baseX = -this.size * 0.45 - this.size * 0.4;
            let baseY = s * (this.size * 0.9 + (j - 1) * this.size * 0.28);
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.lineTo(baseX - this.size * 0.3, baseY + s * this.size * 0.15);
            ctx.stroke();
          }
        }
        ctx.shadowBlur = 0;
        ctx.lineCap = 'butt';

        // Head — large beast skull
        let hx = this.size * 0.38;
        ctx.fillStyle = fur;
        ctx.strokeStyle = darkFur;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(hx, 0, this.size * 0.82, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Wolf Ears
        ctx.fillStyle = darkFur;
        for (let s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(hx - this.size * 0.25, s * this.size * 0.55);
          ctx.lineTo(hx - this.size * 0.8, s * this.size * 1.05);
          ctx.lineTo(hx - this.size * 0.05, s * this.size * 0.5);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = darkFur; ctx.lineWidth = 1.0; ctx.stroke();
          // Inner ear pink
          ctx.fillStyle = '#fca5a5';
          ctx.beginPath();
          ctx.moveTo(hx - this.size * 0.22, s * this.size * 0.52);
          ctx.lineTo(hx - this.size * 0.6, s * this.size * 0.88);
          ctx.lineTo(hx - this.size * 0.08, s * this.size * 0.48);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = darkFur;
        }

        // Horns (stage 3 morphology)
        if (this.hornLength && this.hornLength > 0) {
          let hLen = Math.min(this.hornLength, 14);
          ctx.strokeStyle = '#1c1917';
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(hx - this.size * 0.2, -this.size * 0.7);
          ctx.lineTo(hx + this.size * 0.1, -this.size * 0.7 - hLen);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(hx - this.size * 0.2, this.size * 0.7);
          ctx.lineTo(hx + this.size * 0.1, this.size * 0.7 + hLen);
          ctx.stroke();
          ctx.lineCap = 'butt';
        }

        // Glowing red eyes
        ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(hx + this.size * 0.1, -this.size * 0.28, this.size * 0.2, 0, Math.PI * 2);
        ctx.arc(hx + this.size * 0.1, this.size * 0.28, this.size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e3a5f';
        ctx.beginPath();
        ctx.arc(hx + this.size * 0.14, -this.size * 0.28, this.size * 0.1, 0, Math.PI * 2);
        ctx.arc(hx + this.size * 0.14, this.size * 0.28, this.size * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Muzzle with fangs
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(hx + this.size * 0.5, 0, this.size * 0.28, this.size * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        // Fangs
        ctx.fillStyle = '#f8fafc';
        if (state.genes.shh) {
          ctx.beginPath();
          ctx.moveTo(hx + this.size * 0.42, this.size * 0.16);
          ctx.lineTo(hx + this.size * 0.52, this.size * 0.38);
          ctx.lineTo(hx + this.size * 0.32, this.size * 0.18);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(hx + this.size * 0.55, this.size * 0.12);
          ctx.lineTo(hx + this.size * 0.65, this.size * 0.34);
          ctx.lineTo(hx + this.size * 0.45, this.size * 0.14);
          ctx.closePath(); ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(hx + this.size * 0.5, this.size * 0.06, this.size * 0.06, 0, Math.PI * 2);
          ctx.arc(hx + this.size * 0.5, -this.size * 0.06, this.size * 0.06, 0, Math.PI * 2);
          ctx.fill();
        }

        // Weapon: savage longsword / bone axe
        ctx.save();
        ctx.translate(this.size * 0.6, this.size * 0.95);
        let wA = swinging ? Math.sin(t * 7) * 1.4 : -0.2;
        ctx.rotate(wA);
        // Blade
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -3.5);
        ctx.lineTo(28, -2);
        ctx.lineTo(30, 0);
        ctx.lineTo(28, 2);
        ctx.lineTo(0, 3.5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Crossguard
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(2, -7); ctx.lineTo(2, 7); ctx.stroke();
        // Grip
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(2, 0); ctx.stroke();
        ctx.lineCap = 'butt';
        // SHH fire effect on blade
        if (state.genes.shh) {
          ctx.shadowBlur = 14; ctx.shadowColor = '#f97316';
          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(5, -1); ctx.lineTo(28, -1); ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.restore();

      } else {
        // ==========================================
        // STAGE 4: STEEL KNIGHT / WAR PALADIN
        // ==========================================
        let t = Date.now() * 0.003;
        let swinging = this.excitementLevel > 0.7;
        let armorColor = state.activeSkin !== 'default' ? this.color : (state.genes.chit1 ? '#1e1b4b' : '#94a3b8');
        let accentColor = state.activeSkin !== 'default' ? (this.glowColor || this.color) : (state.genes.chit1 ? '#a855f7' : '#f59e0b');
        let alert = this.alertLevel || 0;

        // Waving vector cape (flowing behind, wide cloak)
        let capeColor = state.genes.chit1 ? '#4c1d95' : '#991b1b';
        ctx.fillStyle = capeColor;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-this.size * 0.3, -this.size * 0.65);
        ctx.lineTo(-this.size * 0.3, this.size * 0.65);
        let wave = Math.sin(Date.now() * 0.008) * 0.12 * this.size;
        ctx.lineTo(-this.size * 1.45, this.size * 0.85 + wave);
        ctx.lineTo(-this.size * 1.45, -this.size * 0.85 + wave);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Torso — full plate armor
        ctx.fillStyle = armorColor;
        ctx.strokeStyle = state.genes.chit1 ? '#7c3aed' : '#64748b';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * 1.2 * neuralDeformX, this.size * 0.92 * neuralDeformY, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Chest plate detail lines
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-this.size * 0.15, -this.size * 0.65);
        ctx.lineTo(-this.size * 0.15, this.size * 0.65);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-this.size * 0.5, -this.size * 0.2);
        ctx.quadraticCurveTo(0, -this.size * 0.35, this.size * 0.2, -this.size * 0.2);
        ctx.moveTo(-this.size * 0.5, this.size * 0.2);
        ctx.quadraticCurveTo(0, this.size * 0.35, this.size * 0.2, this.size * 0.2);
        ctx.stroke();

        // Shoulder pauldrons
        ctx.fillStyle = state.genes.chit1 ? '#312e81' : '#cbd5e1';
        ctx.strokeStyle = state.genes.chit1 ? '#7c3aed' : '#475569';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(-this.size * 0.55, -this.size * 0.88, this.size * 0.45, 0, Math.PI * 2);
        ctx.arc(-this.size * 0.55, this.size * 0.88, this.size * 0.45, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Chitin spikes on shoulders
        if (state.genes.chit1) {
          ctx.fillStyle = '#4c1d95';
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 1.0;
          for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(-this.size * 0.65, s * this.size * 0.88 - 3);
            ctx.lineTo(-this.size * 1.15, s * this.size * 1.2);
            ctx.lineTo(-this.size * 0.45, s * this.size * 0.88 + 3);
            ctx.closePath(); ctx.fill(); ctx.stroke();
          }
        }

        // Helmet — visored great helm
        let hx = this.size * 0.38;
        // Helmet base
        ctx.fillStyle = state.genes.chit1 ? '#1e1b4b' : '#94a3b8';
        ctx.strokeStyle = state.genes.chit1 ? '#7c3aed' : '#64748b';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(hx, 0, this.size * 0.82, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Helmet visor slot
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(hx + this.size * 0.15, -this.size * 0.28);
        ctx.quadraticCurveTo(hx + this.size * 0.65, -this.size * 0.2, hx + this.size * 0.65, 0);
        ctx.quadraticCurveTo(hx + this.size * 0.65, this.size * 0.2, hx + this.size * 0.15, this.size * 0.28);
        ctx.closePath();
        ctx.fill();

        // Glowing visor slit
        let visorCol = alert > 0.4 ? '#ef4444' : (state.genes.mbp ? '#22d3ee' : accentColor);
        ctx.shadowBlur = 12; ctx.shadowColor = visorCol;
        ctx.fillStyle = visorCol;
        ctx.beginPath();
        ctx.moveTo(hx + this.size * 0.2, -this.size * 0.18);
        ctx.quadraticCurveTo(hx + this.size * 0.58, -this.size * 0.12, hx + this.size * 0.58, 0);
        ctx.quadraticCurveTo(hx + this.size * 0.58, this.size * 0.12, hx + this.size * 0.2, this.size * 0.18);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;

        // MBP lightning spark on visor
        if (state.genes.mbp) {
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1.2;
          ctx.shadowBlur = 8; ctx.shadowColor = '#22d3ee';
          ctx.beginPath();
          let vx2 = hx + this.size * 0.45;
          ctx.moveTo(vx2, -this.size * 0.05);
          ctx.lineTo(vx2 + 4 + Math.random() * 4, Math.random() * this.size * 0.08 - 0.04);
          ctx.lineTo(vx2 + 8 + Math.random() * 4, this.size * 0.05);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Helmet crest / plume
        let plumeColor = state.genes.chit1 ? '#d946ef' : '#ef4444';
        ctx.fillStyle = plumeColor;
        ctx.shadowBlur = 6; ctx.shadowColor = plumeColor;
        ctx.beginPath();
        ctx.moveTo(hx - this.size * 0.5, -this.size * 0.1);
        ctx.quadraticCurveTo(hx - this.size * 1.3, -this.size * 0.65, hx - this.size * 1.7, -this.size * 0.28);
        ctx.quadraticCurveTo(hx - this.size * 1.2, this.size * 0.05, hx - this.size * 0.5, this.size * 0.1);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Shield (left side, slightly rotated)
        ctx.save();
        ctx.translate(-this.size * 0.25, -this.size * 1.05);
        ctx.rotate(0.4);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = state.genes.chit1 ? '#a855f7' : '#e2e8f0';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-8, -5); ctx.lineTo(8, -5);
        ctx.lineTo(9, 5);
        ctx.quadraticCurveTo(0, 14, -9, 5);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Shield emblem
        ctx.strokeStyle = state.genes.chit1 ? '#d946ef' : '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -3); ctx.lineTo(0, 8);
        ctx.moveTo(-5, 2); ctx.lineTo(5, 2);
        ctx.stroke();
        ctx.restore();

        // Greatsword (right hand)
        ctx.save();
        ctx.translate(this.size * 0.55, this.size * 0.95);
        let kwa = swinging ? Math.sin(t * 7) * 1.4 : -0.15;
        ctx.rotate(kwa);
        // Grip
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(0, 0); ctx.stroke();
        // Pommel
        ctx.fillStyle = accentColor;
        ctx.beginPath(); ctx.arc(-14, 0, 4.5, 0, Math.PI * 2); ctx.fill();
        // Crossguard
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(1, -8); ctx.lineTo(1, 8); ctx.stroke();
        // Blade body
        let swordFlame = state.genes.shh;
        ctx.fillStyle = swordFlame ? '#fb923c' : '#e2e8f0';
        ctx.strokeStyle = swordFlame ? '#dc2626' : '#94a3b8';
        ctx.lineWidth = 1.5;
        if (swordFlame) { ctx.shadowBlur = 18; ctx.shadowColor = '#ef4444'; }
        ctx.beginPath();
        ctx.moveTo(2, -5); ctx.lineTo(34, -1.5); ctx.lineTo(38, 0); ctx.lineTo(34, 1.5); ctx.lineTo(2, 5);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Blade fuller line
        ctx.strokeStyle = swordFlame ? '#fbbf24' : '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(33, 0); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineCap = 'butt';
        ctx.restore();
      } // end stage 4

      ctx.restore(); // close player translate/rotate
    } else if (this.type === 'boss') {

      // BOSS DRAWING (scales with state.level)
      // ==========================================
      let lvl = (typeof state !== 'undefined' && state.level) ? state.level : 1;
      let bossPhase = Math.min(lvl, 4);

      // --- Shared glow aura ---
      let bossGlow = 55 + Math.sin(Date.now() * 0.008) * 12;
      let bossAuraColor = bossPhase === 1 ? 'rgba(239,68,68,' :
                          bossPhase === 2 ? 'rgba(34,197,94,' :
                          bossPhase === 3 ? 'rgba(168,85,247,' : 'rgba(236,72,153,';
      let grad = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, bossGlow);
      grad.addColorStop(0, bossAuraColor + '0.38)');
      grad.addColorStop(1, bossAuraColor + '0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, bossGlow, 0, Math.PI * 2);
      ctx.fill();

      if (bossPhase === 1) {
        // CHIEF WARDEN
        ctx.fillStyle = '#1e293b'; // Slate armor
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444'; // Red borders
        ctx.lineWidth = 3;
        ctx.stroke();

        // Warden Golden Crown / Helmet Plume
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        let cx = this.x, cy = this.y - this.size + 3;
        ctx.moveTo(cx - 8, cy); ctx.lineTo(cx - 10, cy - 8);
        ctx.lineTo(cx - 4, cy - 3); ctx.lineTo(cx, cy - 10);
        ctx.lineTo(cx + 4, cy - 3); ctx.lineTo(cx + 10, cy - 8);
        ctx.lineTo(cx + 8, cy); ctx.closePath(); ctx.fill();

        // Red Glowing Eyes
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(this.x + Math.cos(this.angle + 0.25) * this.size * 0.7, this.y + Math.sin(this.angle + 0.25) * this.size * 0.7, 2.5, 0, Math.PI * 2);
        ctx.arc(this.x + Math.cos(this.angle - 0.25) * this.size * 0.7, this.y + Math.sin(this.angle - 0.25) * this.size * 0.7, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Heavy Shield
        if (this.shieldActive) {
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size + 4, this.angle - 0.7, this.angle + 0.7);
          ctx.stroke();
        }

        // Sword
        if (this.spinActive) {
          let sa = (Date.now() * 0.025) % (Math.PI * 2);
          ctx.strokeStyle = '#f97316'; ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x + Math.cos(sa) * 52, this.y + Math.sin(sa) * 52);
          ctx.stroke();
        } else {
          let swx = this.x + Math.cos(this.angle + 1.2) * this.size * 0.9;
          let swy = this.y + Math.sin(this.angle + 1.2) * this.size * 0.9;
          ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(swx, swy);
          ctx.lineTo(swx + Math.cos(this.angle + 0.4) * 22, swy + Math.sin(this.angle + 0.4) * 22);
          ctx.stroke();
        }

      } else if (bossPhase === 2) {
        // GOBLIN KING
        ctx.fillStyle = '#15803d'; // Green skin
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#facc15'; // Gold borders
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // King Crown
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        let cx = this.x, cy = this.y - this.size + 4;
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx - 9, cy - 7);
        ctx.lineTo(cx - 3, cy - 3); ctx.lineTo(cx, cy - 9);
        ctx.lineTo(cx + 3, cy - 3); ctx.lineTo(cx + 9, cy - 7);
        ctx.lineTo(cx + 7, cy); ctx.closePath(); ctx.fill();

        // Glowing orange eyes
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(this.x + Math.cos(this.angle + 0.3) * this.size * 0.65, this.y + Math.sin(this.angle + 0.3) * this.size * 0.65, 2.0, 0, Math.PI * 2);
        ctx.arc(this.x + Math.cos(this.angle - 0.3) * this.size * 0.65, this.y + Math.sin(this.angle - 0.3) * this.size * 0.65, 2.0, 0, Math.PI * 2);
        ctx.fill();

        // Golden Dagger
        let swx = this.x + Math.cos(this.angle + 1.1) * this.size * 0.95;
        let swy = this.y + Math.sin(this.angle + 1.1) * this.size * 0.95;
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.moveTo(swx, swy);
        ctx.lineTo(swx + Math.cos(this.angle + 0.35) * 20, swy + Math.sin(this.angle + 0.35) * 20);
        ctx.stroke();

      } else if (bossPhase === 3) {
        // ALCHEMICAL BEAST
        ctx.fillStyle = '#4c1d95'; // Purple body
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#22c55e'; // Acid green border
        ctx.lineWidth = this.spinActive ? 4.5 : 2.5;
        ctx.stroke();

        // Glowing green biological lines
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(this.x - this.size * 0.4, this.y - this.size * 0.3);
        ctx.lineTo(this.x + this.size * 0.4, this.y + this.size * 0.3);
        ctx.moveTo(this.x - this.size * 0.4, this.y + this.size * 0.3);
        ctx.lineTo(this.x + this.size * 0.4, this.y - this.size * 0.3);
        ctx.stroke();

        // Fangs / Horns
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(this.angle + 0.4) * this.size, this.y + Math.sin(this.angle + 0.4) * this.size);
        ctx.lineTo(this.x + Math.cos(this.angle + 0.5) * (this.size + 8), this.y + Math.sin(this.angle + 0.5) * (this.size + 8));
        ctx.lineTo(this.x + Math.cos(this.angle + 0.6) * this.size, this.y + Math.sin(this.angle + 0.6) * this.size);
        ctx.moveTo(this.x + Math.cos(this.angle - 0.4) * this.size, this.y + Math.sin(this.angle - 0.4) * this.size);
        ctx.lineTo(this.x + Math.cos(this.angle - 0.5) * (this.size + 8), this.y + Math.sin(this.angle - 0.5) * (this.size + 8));
        ctx.lineTo(this.x + Math.cos(this.angle - 0.6) * this.size, this.y + Math.sin(this.angle - 0.6) * this.size);
        ctx.closePath();
        ctx.fill();

      } else {
        // ABYSS PALADIN
        ctx.fillStyle = '#09090b'; // Black void metal
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c084fc'; // Purple borders
        ctx.lineWidth = 3.5;
        ctx.shadowBlur = 15; ctx.shadowColor = '#c084fc';
        ctx.stroke(); ctx.shadowBlur = 0;

        // Glowing visor slit
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        let vx = this.x + Math.cos(this.angle) * (this.size * 0.4);
        let vy = this.y + Math.sin(this.angle) * (this.size * 0.4);
        ctx.moveTo(vx - Math.sin(this.angle) * 6, vy + Math.cos(this.angle) * 6);
        ctx.lineTo(vx + Math.sin(this.angle) * 6, vy - Math.cos(this.angle) * 6);
        ctx.stroke();

        // Orbiting dark runes
        let orbit = (Date.now() * 0.0035) % (Math.PI * 2);
        for (let i = 0; i < 4; i++) {
          let oa = orbit + i * (Math.PI / 2);
          ctx.fillStyle = '#d8b4fe';
          ctx.beginPath();
          ctx.arc(this.x + Math.cos(oa) * (this.size + 14), this.y + Math.sin(oa) * (this.size + 14), 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Greatsword
        let swx = this.x + Math.cos(this.angle + 1.25) * this.size * 0.9;
        let swy = this.y + Math.sin(this.angle + 1.25) * this.size * 0.9;
        ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 5;
        ctx.shadowBlur = 10; ctx.shadowColor = '#a855f7';
        ctx.beginPath();
        ctx.moveTo(swx, swy);
        ctx.lineTo(swx + Math.cos(this.angle + 0.3) * 28, swy + Math.sin(this.angle + 0.3) * 28);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw reflecting barrier shield if active
        if (this.shieldActive) {
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 4.5;
          ctx.shadowBlur = 20; ctx.shadowColor = '#a855f7';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size + 12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Boss health bar
      let bBarW = this.size * 3.5;
      let bBarH = 6;
      let bBx = this.x - bBarW / 2;
      let bBy = this.y - this.size - 16;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(bBx, bBy, bBarW, bBarH);
      let bHp = Math.max(0, this.health / this.maxHealth);
      let bColor = bossPhase === 1 ? '#ef4444' : bossPhase === 2 ? '#22c55e' : bossPhase === 3 ? '#a855f7' : '#c084fc';
      ctx.fillStyle = bColor;
      ctx.fillRect(bBx, bBy, bBarW * bHp, bBarH);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.5;
      ctx.strokeRect(bBx, bBy, bBarW, bBarH);

      // Boss name label
      let bNames = ['Начальник стражи', 'Гоблинский Король', 'Алхимический Зверь', 'Абсолютный Паладин'];
      ctx.fillStyle = bColor;
      ctx.font = 'bold 10px Montserrat';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 5; ctx.shadowColor = bColor;
      ctx.fillText((bNames[bossPhase - 1] || bNames[3]) + ' [Ур.' + lvl + ']', this.x, bBy - 3);
      ctx.shadowBlur = 0;

      // Rage warning
      if (this.rageWarnTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 13px Montserrat';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 8; ctx.shadowColor = '#ef4444';
        let warnText = bossPhase === 1 ? '! КРУГОВАЯ АТАКА !' : bossPhase === 2 ? '! ВЕЕР КИНЖАЛОВ !' : bossPhase === 3 ? '! РАЗГОН !' : '!! ТЕЛЕПОРТ !!';
        ctx.fillText(warnText, this.x, this.y - this.size - 22);
        ctx.shadowBlur = 0;
      }

    } else if (this.type === 'guard') {
      // Knight Model
      // Body Armor
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
      ctx.fill();
      
      // Iron Visor line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(this.angle + 0.5) * this.size, this.y + Math.sin(this.angle + 0.5) * this.size);
      ctx.lineTo(this.x + Math.cos(this.angle - 0.5) * this.size, this.y + Math.sin(this.angle - 0.5) * this.size);
      ctx.stroke();
      
      // Draw Shield on left side
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      let sx = this.x + Math.cos(this.angle - 1.2) * (this.size * 0.9);
      let sy = this.y + Math.sin(this.angle - 1.2) * (this.size * 0.9);
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Draw Sword on right side (slashes when attacking)
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      let swx = this.x + Math.cos(this.angle + 1.2) * (this.size * 0.9);
      let swy = this.y + Math.sin(this.angle + 1.2) * (this.size * 0.9);
      ctx.beginPath();
      ctx.moveTo(swx, swy);
      ctx.lineTo(swx + Math.cos(this.angle + 0.4) * 14, swy + Math.sin(this.angle + 0.4) * 14);
      ctx.stroke();
      
      // Red eyes inside visor
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(this.x + Math.cos(this.angle + 0.25) * (this.size*0.75), this.y + Math.sin(this.angle + 0.25) * (this.size*0.75), 1.5, 0, Math.PI * 2);
      ctx.arc(this.x + Math.cos(this.angle - 0.25) * (this.size*0.75), this.y + Math.sin(this.angle - 0.25) * (this.size*0.75), 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'mage') {
      // Mage Model (Purple robe, wizard staff)
      ctx.fillStyle = '#581c87'; // Dark purple robe
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#c084fc'; // Purple highlight border
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Glowing purple eyes
      ctx.fillStyle = '#f3e8ff';
      ctx.beginPath();
      ctx.arc(this.x + Math.cos(this.angle + 0.25) * (this.size*0.7), this.y + Math.sin(this.angle + 0.25) * (this.size*0.7), 2.0, 0, Math.PI * 2);
      ctx.arc(this.x + Math.cos(this.angle - 0.25) * (this.size*0.7), this.y + Math.sin(this.angle - 0.25) * (this.size*0.7), 2.0, 0, Math.PI * 2);
      ctx.fill();
      
      // Wizard staff on right side
      ctx.strokeStyle = '#78350f'; // wood staff
      ctx.lineWidth = 2.5;
      let stx = this.x + Math.cos(this.angle + 1.2) * (this.size * 0.9);
      let sty = this.y + Math.sin(this.angle + 1.2) * (this.size * 0.9);
      ctx.beginPath();
      ctx.moveTo(stx, sty);
      ctx.lineTo(stx + Math.cos(this.angle + 0.4) * 18, sty + Math.sin(this.angle + 0.4) * 18);
      ctx.stroke();
      
      // Staff crystal
      let crystalAngle = this.angle + 0.4;
      let cx = stx + Math.cos(crystalAngle) * 18;
      let cy = sty + Math.sin(crystalAngle) * 18;
      ctx.fillStyle = '#a855f7'; // magical purple crystal
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#c084fc';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (this.type === 'bomber') {
      // Bomber Model (Toxic green rat with a ticking fuse bomb on its back)
      ctx.fillStyle = '#14532d'; // Dark green rat body
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.size*1.3, this.size, this.angle, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#22c55e'; // neon green border
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Glowing toxic green eyes
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(this.x + Math.cos(this.angle + 0.35) * (this.size*1.0), this.y + Math.sin(this.angle + 0.35) * (this.size*1.0), 1.8, 0, Math.PI * 2);
      ctx.arc(this.x + Math.cos(this.angle - 0.35) * (this.size*1.0), this.y + Math.sin(this.angle - 0.35) * (this.size*1.0), 1.8, 0, Math.PI * 2);
      ctx.fill();
      
      // Bomb fuse on its back
      ctx.fillStyle = '#0f172a'; // Slate bomb casing
      ctx.strokeStyle = '#ef4444'; // Red glowing details
      ctx.lineWidth = 1.0;
      let bx = this.x - Math.cos(this.angle) * (this.size * 0.7);
      let by = this.y - Math.sin(this.angle) * (this.size * 0.7);
      ctx.beginPath();
      ctx.arc(bx, by, this.size * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Glowing fuse wire
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      let fuseLen = this.size * 0.9;
      let fuseAngle = this.angle + Math.PI + Math.sin(Date.now() * 0.02) * 0.35;
      ctx.lineTo(bx + Math.cos(fuseAngle) * fuseLen, by + Math.sin(fuseAngle) * fuseLen);
      ctx.stroke();
      
      // Spark
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(bx + Math.cos(fuseAngle) * fuseLen, by + Math.sin(fuseAngle) * fuseLen, 2.0 + Math.sin(Date.now() * 0.05) * 1.0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'rat') {
      // Rat Model
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.size*1.3, this.size, this.angle, 0, Math.PI*2);
      ctx.fill();
      
      // Little pink ears
      ctx.fillStyle = '#fda4af';
      let ex1 = this.x + Math.cos(this.angle - 0.8) * (this.size * 0.7);
      let ey1 = this.y + Math.sin(this.angle - 0.8) * (this.size * 0.7);
      let ex2 = this.x + Math.cos(this.angle + 0.8) * (this.size * 0.7);
      let ey2 = this.y + Math.sin(this.angle + 0.8) * (this.size * 0.7);
      ctx.beginPath();
      ctx.arc(ex1, ey1, 2.5, 0, Math.PI*2);
      ctx.arc(ex2, ey2, 2.5, 0, Math.PI*2);
      ctx.fill();
    } else if (this.type === 'goblin') {
      // Goblin Enemy Model
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Body (ragged clothes)
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size * 1.1, this.size * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#050508';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Head
      ctx.fillStyle = '#22c55e'; // Goblin green skin
      ctx.beginPath();
      ctx.arc(this.size * 0.4, 0, this.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pointed ears
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.1, -this.size * 0.55);
      ctx.lineTo(-this.size * 0.6, -this.size * 0.95);
      ctx.lineTo(this.size * 0.1, -this.size * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-this.size * 0.1, this.size * 0.55);
      ctx.lineTo(-this.size * 0.6, this.size * 0.95);
      ctx.lineTo(this.size * 0.1, this.size * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Yellow eyes
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(this.size * 0.55, -this.size * 0.2, 1.5, 0, Math.PI * 2);
      ctx.arc(this.size * 0.55, this.size * 0.2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Dagger
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(this.size * 0.5, this.size * 0.7);
      ctx.lineTo(this.size * 0.5 + 10, this.size * 0.7 + 3);
      ctx.stroke();

      ctx.restore();

    } else if (this.type === 'orc') {
      // Orc Enemy Model
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      let inFrenzy = this.health < this.maxHealth * 0.5;

      // Frenzy rage glow
      if (inFrenzy) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ef4444';
      }

      // Torso (heavy leather/hide armor)
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size * 1.2, this.size * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = inFrenzy ? '#ef4444' : '#050508';
      ctx.lineWidth = inFrenzy ? 2 : 1.2;
      ctx.stroke();

      // Orc shoulders
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(-this.size * 0.4, -this.size * 0.8, this.size * 0.4, 0, Math.PI * 2);
      ctx.arc(-this.size * 0.4, this.size * 0.8, this.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Head
      ctx.fillStyle = '#14532d'; // Dark green orc skin
      ctx.beginPath();
      ctx.arc(this.size * 0.45, 0, this.size * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Jaw with tusks
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.size * 0.8, -this.size * 0.2, 1.2, 0, Math.PI * 2);
      ctx.arc(this.size * 0.8, this.size * 0.2, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Iron helmet
      ctx.fillStyle = '#4b5563';
      ctx.beginPath();
      ctx.arc(this.size * 0.35, 0, this.size * 0.78, Math.PI * 0.7, Math.PI * 1.3);
      ctx.fill();

      // Glowing red eyes
      ctx.fillStyle = inFrenzy ? '#ff0000' : '#f97316';
      ctx.beginPath();
      ctx.arc(this.size * 0.6, -this.size * 0.25, 2, 0, Math.PI * 2);
      ctx.arc(this.size * 0.6, this.size * 0.25, 2, 0, Math.PI * 2);
      ctx.fill();

      // Heavy axe
      ctx.strokeStyle = '#4b5563'; // wood handle
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.size * 0.4, this.size * 0.8);
      ctx.lineTo(this.size * 0.4 + 16, this.size * 0.8 + 5);
      ctx.stroke();

      // Axe blade
      ctx.fillStyle = '#9ca3af';
      ctx.beginPath();
      let ax = this.size * 0.4 + 16;
      let ay = this.size * 0.4 + 8;
      ctx.moveTo(ax - 2, ay - 6);
      ctx.lineTo(ax + 8, ay - 10);
      ctx.lineTo(ax + 8, ay + 10);
      ctx.lineTo(ax - 2, ay + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      // Frenzy steam particles
      if (inFrenzy && ticks % 8 === 0) {
        particles.push({
          x: this.x + (Math.random() - 0.5) * this.size,
          y: this.y - this.size,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1.2,
          size: Math.random() * 3 + 1.5,
          color: 'rgba(239, 68, 68, 0.4)',
          life: 20
        });
      }
    } else if (this.type === 'vampire') {
      // VAMPIRE: Dark-cloaked creature with bat wings
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Cloak body
      ctx.fillStyle = '#1c0a24';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size * 1.1, this.size * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Bat wings (flap with time)
      let flap = Math.sin(Date.now() * 0.007) * 0.6;
      ctx.fillStyle = 'rgba(76,29,149,0.7)';
      for (let s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-this.size * 0.4, s * this.size * (1.2 + flap), -this.size * 1.2, s * this.size * (0.5 + flap));
        ctx.lineTo(-this.size * 0.3, s * this.size * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Pale face
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(this.size * 0.4, 0, this.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4c1d95';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Red glowing eyes
      ctx.fillStyle = '#dc2626';
      ctx.shadowBlur = 8; ctx.shadowColor = '#dc2626';
      ctx.beginPath();
      ctx.arc(this.size * 0.55, -this.size * 0.18, 1.8, 0, Math.PI * 2);
      ctx.arc(this.size * 0.55, this.size * 0.18, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Fangs
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(this.size * 0.75, -this.size * 0.06);
      ctx.lineTo(this.size * 0.8, -this.size * 0.16);
      ctx.lineTo(this.size * 0.68, -this.size * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(this.size * 0.75, this.size * 0.06);
      ctx.lineTo(this.size * 0.8, this.size * 0.16);
      ctx.lineTo(this.size * 0.68, this.size * 0.04);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

    } else if (this.type === 'shaman') {
      // SHAMAN: Tribal spellcaster with glowing bone staff
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Robes (animal hide)
      ctx.fillStyle = '#713f12';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size * 1.05, this.size * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Skull mask
      ctx.fillStyle = '#fafaf9';
      ctx.beginPath();
      ctx.arc(this.size * 0.38, 0, this.size * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hollow eye sockets
      ctx.fillStyle = '#0c0a09';
      ctx.beginPath();
      ctx.arc(this.size * 0.52, -this.size * 0.2, this.size * 0.16, 0, Math.PI * 2);
      ctx.arc(this.size * 0.52, this.size * 0.2, this.size * 0.16, 0, Math.PI * 2);
      ctx.fill();

      // Glowing hex rune on chest
      let runeGlow = 0.4 + Math.sin(Date.now() * 0.006) * 0.4;
      ctx.fillStyle = `rgba(34, 197, 94, ${runeGlow})`;
      ctx.shadowBlur = 6 + runeGlow * 8; ctx.shadowColor = '#22c55e';
      ctx.beginPath();
      ctx.arc(-this.size * 0.1, 0, this.size * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Bone staff
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.size * 0.4, this.size * 0.8);
      ctx.lineTo(this.size * 0.4 + 18, this.size * 0.8 + 5);
      ctx.stroke();
      // Skull tip
      ctx.fillStyle = '#fafaf9';
      ctx.beginPath();
      ctx.arc(this.size * 0.4 + 20, this.size * 0.8 + 5.5, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

    } else if (this.type === 'halberdier') {
      // HALBERDIER: Heavy iron plate armor, large silver-bladed halberd
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Heavy body armor (metallic plate armor)
      ctx.fillStyle = '#1e293b'; // Slate dark iron
      ctx.strokeStyle = '#64748b'; // Steel trim
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Plume on helmet (bright crimson/red)
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(-this.size * 0.6, 0, this.size * 0.5, this.size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iron visor (straight heavy horizontal grate)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(this.size * 0.2, -this.size * 0.4, this.size * 0.2, this.size * 0.8);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      // Visor slits
      ctx.beginPath();
      ctx.moveTo(this.size * 0.2, -this.size * 0.2); ctx.lineTo(this.size * 0.4, -this.size * 0.2);
      ctx.moveTo(this.size * 0.2, 0); ctx.lineTo(this.size * 0.4, 0);
      ctx.moveTo(this.size * 0.2, this.size * 0.2); ctx.lineTo(this.size * 0.4, this.size * 0.2);
      ctx.stroke();

      // Glowing red threat eyes behind slits
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(this.size * 0.3, -this.size * 0.15, 1.2, 0, Math.PI * 2);
      ctx.arc(this.size * 0.3, this.size * 0.15, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Halberd Weapon (slashes/lunges)
      // Long shaft (dark wooden staff extending forward)
      ctx.strokeStyle = '#451a03'; // Brown wood
      ctx.lineWidth = 2.5;
      
      // Dynamic reach with walking swing
      let walkingSwing = Math.sin(Date.now() * 0.008) * 3;
      let shaftLen = 42 + walkingSwing;
      ctx.beginPath();
      ctx.moveTo(this.size * 0.4, this.size * 0.6);
      ctx.lineTo(shaftLen, this.size * 0.6);
      ctx.stroke();

      // Silver axe blade / spearhead on top
      ctx.fillStyle = '#cbd5e1'; // Silver blade
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2;
      
      // Spearhead point
      ctx.beginPath();
      ctx.moveTo(shaftLen, this.size * 0.6 - 2);
      ctx.lineTo(shaftLen + 14, this.size * 0.6); // tip
      ctx.lineTo(shaftLen, this.size * 0.6 + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Axe blade (curved moon blade on one side)
      ctx.beginPath();
      ctx.moveTo(shaftLen - 6, this.size * 0.6);
      ctx.quadraticCurveTo(shaftLen - 2, this.size * 0.6 - 12, shaftLen + 4, this.size * 0.6 - 14); // Axe tip
      ctx.lineTo(shaftLen - 1, this.size * 0.6 - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Spike hook on the opposite side
      ctx.beginPath();
      ctx.moveTo(shaftLen - 5, this.size * 0.6);
      ctx.lineTo(shaftLen - 12, this.size * 0.6 + 8);
      ctx.lineTo(shaftLen - 2, this.size * 0.6 + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();

    } else if (this.type === 'alchemist') {
      // ALCHEMIST: Plague doctor cloak, bird-like beak mask, toxic flask
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Dark hooded cloak
      ctx.fillStyle = '#0f172a'; // Black/dark grey robe
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Plague Doctor Beak Mask
      ctx.fillStyle = '#f5f5f4'; // Off-white leather
      ctx.strokeStyle = '#a8a29e';
      ctx.lineWidth = 1.2;
      
      // Draw beak pointing forward
      ctx.beginPath();
      ctx.moveTo(this.size * 0.3, -this.size * 0.35);
      ctx.lineTo(this.size * 1.35, 0); // Beak tip
      ctx.lineTo(this.size * 0.3, this.size * 0.35);
      ctx.quadraticCurveTo(this.size * 0.1, 0, this.size * 0.3, -this.size * 0.35);
      ctx.fill();
      ctx.stroke();

      // Round glass goggles on the mask
      ctx.fillStyle = '#b45309'; // Amber/bronze rims
      ctx.beginPath();
      ctx.arc(this.size * 0.45, -this.size * 0.25, 2.5, 0, Math.PI * 2);
      ctx.arc(this.size * 0.45, this.size * 0.25, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#67e8f9'; // Cyan glass
      ctx.beginPath();
      ctx.arc(this.size * 0.45, -this.size * 0.25, 1.5, 0, Math.PI * 2);
      ctx.arc(this.size * 0.45, this.size * 0.25, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Toxic Flask in hand
      // Hand holding green potion
      ctx.fillStyle = '#22c55e'; // Green fluid glow
      ctx.shadowBlur = 6; ctx.shadowColor = '#22c55e';
      ctx.beginPath();
      ctx.arc(this.size * 0.5, this.size * 0.8, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Bottle neck
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(this.size * 0.5 - 1.5, this.size * 0.8 - 7, 3, 3);

      ctx.restore();

    } else {
      // Player Hatchling/Drake/Dragon Models
      let alert = this.alertLevel || 0;
      let excitement = this.excitementLevel || 0;
      
      // Shift base color dynamically on alert (turns red/pink)
      let rR = Math.floor(alert * 255);
      let rG = Math.floor((1 - alert) * 240);
      let rB = Math.floor((1 - alert) * 255 + alert * 109);
      ctx.fillStyle = `rgb(${rR}, ${rG}, ${rB})`;
      
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#050508';
      ctx.lineWidth = 1.5 + excitement * 1.5;
      ctx.stroke();
      
      // AI Generated Horns
      if (this.hornLength > 0) {
        let alert = this.alertLevel || 0;
        let hornScale = 1.0 + alert * 0.8;
        
        ctx.fillStyle = alert > 0.4 ? '#ffffff' : '#ff2a6d';
        let hx1 = this.x + Math.cos(this.angle + 1.2) * (this.size * 0.8);
        let hy1 = this.y + Math.sin(this.angle + 1.2) * (this.size * 0.8);
        let hx2 = this.x + Math.cos(this.angle - 1.2) * (this.size * 0.8);
        let hy2 = this.y + Math.sin(this.angle - 1.2) * (this.size * 0.8);
        
        ctx.beginPath();
        ctx.moveTo(hx1, hy1);
        ctx.lineTo(hx1 + Math.cos(this.angle + 1.8) * (this.hornLength * hornScale), hy1 + Math.sin(this.angle + 1.8) * (this.hornLength * hornScale));
        ctx.lineTo(hx1 - Math.cos(this.angle) * 3, hy1 - Math.sin(this.angle) * 3);
        
        ctx.moveTo(hx2, hy2);
        ctx.lineTo(hx2 + Math.cos(this.angle - 1.8) * (this.hornLength * hornScale), hy2 + Math.sin(this.angle - 1.8) * (this.hornLength * hornScale));
        ctx.lineTo(hx2 - Math.cos(this.angle) * 3, hy2 - Math.sin(this.angle) * 3);
        ctx.fill();
      }
      
      // AI Generated Eyes placement
      if (this.eyeCount > 0) {
        let excitement = this.excitementLevel || 0;
        let alert = this.alertLevel || 0;
        let eyeRad = 3.5 + excitement * 1.5;
        let eyeOffsetAngle = this.eyeOffsetAngle || 0.5;
        
        ctx.fillStyle = alert > 0.5 ? '#ff2a6d' : '#ffffff';
        let ex1 = this.x + Math.cos(this.angle + eyeOffsetAngle) * (this.size * 0.7);
        let ey1 = this.y + Math.sin(this.angle + eyeOffsetAngle) * (this.size * 0.7);
        let ex2 = this.x + Math.cos(this.angle - eyeOffsetAngle) * (this.size * 0.7);
        let ey2 = this.y + Math.sin(this.angle - eyeOffsetAngle) * (this.size * 0.7);
        
        ctx.beginPath();
        ctx.arc(ex1, ey1, eyeRad, 0, Math.PI * 2);
        ctx.arc(ex2, ey2, eyeRad, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        let pupilSize = 1.5 - excitement * 0.5;
        ctx.arc(ex1 + Math.cos(this.angle)*1, ey1 + Math.sin(this.angle)*1, pupilSize, 0, Math.PI * 2);
        ctx.arc(ex2 + Math.cos(this.angle)*1, ey2 + Math.sin(this.angle)*1, pupilSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Draw Health Bar above mobs (rats and guards)
    if (!this.isPlayer) {
      let barW = this.size * 2.2;
      let barH = 3.5;
      let bx = this.x - barW / 2;
      let by = this.y - this.size - 9;
      
      // Draw background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(bx, by, barW, barH);
      
      // Draw health fill
      let hpPct = Math.max(0, this.health / this.maxHealth);
      ctx.fillStyle = this.type === 'guard' ? '#ef4444' : '#22c55e'; // Red for guards, green for rats
      ctx.fillRect(bx, by, barW * hpPct, barH);
      
      // Draw border
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, by, barW, barH);
    }
    
    ctx.restore();
  }
}

// ==========================================
// MAGNETIC LOOT ITEM CLASS
// ==========================================
class LootItem {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'gold', 'dna'
    this.size = type === 'gold' ? 3.5 : 4.0;
    this.color = type === 'gold' ? '#facc15' : '#00f0ff';
    
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 3.5 + 2.0;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 250; // Decays if ignored
  }
  
  update(dtRatio, playerEntity) {
    // Magnetize to player when close (<150px)
    let d = Math.hypot(playerEntity.x - this.x, playerEntity.y - this.y);
    if (d < 150) {
      let pull = 0.28;
      let angle = Math.atan2(playerEntity.y - this.y, playerEntity.x - this.x);
      this.vx += Math.cos(angle) * pull * dtRatio;
      this.vy += Math.sin(angle) * pull * dtRatio;
    }
    
    this.x += this.vx * dtRatio;
    this.y += this.vy * dtRatio;
    this.vx *= Math.pow(0.91, dtRatio);
    this.vy *= Math.pow(0.91, dtRatio);
    
    checkWallCollisions(this);
    this.life -= dtRatio;
  }
  
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.color;
    
    ctx.beginPath();
    if (this.type === 'gold') {
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    } else {
      // Diamond DNA Gem
      ctx.moveTo(this.x, this.y - this.size);
      ctx.lineTo(this.x + this.size, this.y);
      ctx.lineTo(this.x, this.y + this.size);
      ctx.lineTo(this.x - this.size, this.y);
      ctx.closePath();
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ==========================================
// BAT HELPER CLASS (DRONES FOR FOXP2 GENE)
// ==========================================
class BatHelper {
  constructor(x, y, owner) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.owner = owner;
    this.size = 6;
    this.angle = Math.random() * Math.PI * 2;
    this.carrying = null; // null or 'spore', 'cheese', 'potion', 'gold', 'dna'
    this.speed = 2.5;
    this.acceleration = 0.15;
    this.wingWiggle = 0;
  }

  update(dtRatio, foodList) {
    this.wingWiggle += 0.25 * dtRatio;
    
    // If not carrying anything, seek closest food or loot item
    if (!this.carrying) {
      let closest = null;
      let minDist = 300; // Search radius for bats
      
      // Search food
      for (let f of foodList) {
        let d = Math.hypot(f.x - this.x, f.y - this.y);
        if (d < minDist) {
          minDist = d;
          closest = { type: 'food', item: f };
        }
      }
      
      // Search loot items
      for (let l of lootItems) {
        let d = Math.hypot(l.x - this.x, l.y - this.y);
        if (d < minDist) {
          minDist = d;
          closest = { type: 'loot', item: l };
        }
      }
      
      if (closest) {
        // Fly to target
        let targetX = closest.item.x;
        let targetY = closest.item.y;
        let angle = Math.atan2(targetY - this.y, targetX - this.x);
        this.angle = angle;
        this.vx += Math.cos(this.angle) * this.acceleration * dtRatio;
        this.vy += Math.sin(this.angle) * this.acceleration * dtRatio;
        
        // If close, pick up
        let distToTarget = Math.hypot(targetX - this.x, targetY - this.y);
        if (distToTarget < 15) {
          if (closest.type === 'food') {
            let idx = foodList.indexOf(closest.item);
            if (idx !== -1) {
              this.carrying = closest.item.type;
              foodList.splice(idx, 1);
              spawnFood();
            }
          } else {
            let idx = lootItems.indexOf(closest.item);
            if (idx !== -1) {
              this.carrying = closest.item.type; // 'gold' or 'dna'
              lootItems.splice(idx, 1);
            }
          }
          synth.playEat();
        }
      } else {
        // Hover near owner
        let targetX = this.owner.x + Math.sin(Date.now() * 0.003 + (this.x * 0.05)) * 40;
        let targetY = this.owner.y + Math.cos(Date.now() * 0.003 + (this.y * 0.05)) * 40;
        let angle = Math.atan2(targetY - this.y, targetX - this.x);
        this.angle = angle;
        this.vx += Math.cos(this.angle) * this.acceleration * dtRatio;
        this.vy += Math.sin(this.angle) * this.acceleration * dtRatio;
      }
    } else {
      // Return to owner
      let angle = Math.atan2(this.owner.y - this.y, this.owner.x - this.x);
      this.angle = angle;
      this.vx += Math.cos(this.angle) * this.acceleration * dtRatio;
      this.vy += Math.sin(this.angle) * this.acceleration * dtRatio;
      
      let distToOwner = Math.hypot(this.owner.x - this.x, this.owner.y - this.y);
      if (distToOwner < this.owner.size + 10) {
        // Deposit resources
        if (this.carrying === 'potion') {
          this.owner.health = Math.min(this.owner.maxHealth, this.owner.health + 25);
          this.owner.energy = Math.min(this.owner.maxEnergy, this.owner.energy + 10);
          state.dna += 4;
          logRow("Летучая мышь принесла зелье здоровья!", "gain");
        } else if (this.carrying === 'spore' || this.carrying === 'cheese') {
          this.owner.energy = Math.min(this.owner.maxEnergy, this.owner.energy + 12);
          this.owner.evolveProgress = Math.min(100, this.owner.evolveProgress + 2.5);
          state.dna += 2;
          logRow(`Летучая мышь принесла еду: ${this.carrying === 'cheese' ? 'сыр' : 'мох'}`, "gain");
        } else if (this.carrying === 'gold') {
          state.gold += 10;
          logRow("Летучая мышь принесла золото (+10)", "gain");
        } else if (this.carrying === 'dna') {
          state.dna += 12;
          logRow("Летучая мышь принесла ДНК-эссенцию (+12 ДНК)", "adapt");
        }
        
        synth.playEat();
        this.carrying = null;
      }
    }
    
    // Move physics
    this.x += this.vx * dtRatio;
    this.y += this.vy * dtRatio;
    this.vx *= Math.pow(0.85, dtRatio);
    this.vy *= Math.pow(0.85, dtRatio);
    
    checkWallCollisions(this);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    
    // Draw bat helper body
    ctx.fillStyle = '#1e1b4b'; // Deep violet/dark color
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size * 1.2, this.size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Glowing eyes
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(this.size * 0.6, -1.5, 1, 0, Math.PI * 2);
    ctx.arc(this.size * 0.6, 1.5, 1, 0, Math.PI * 2);
    ctx.fill();
    
    // Flapping wings
    let wingFlap = Math.sin(this.wingWiggle) * this.size * 1.5;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-this.size * 0.5, -this.size * 1.8 + wingFlap * 0.3);
    ctx.lineTo(-this.size * 1.6, -this.size * 1.4 + wingFlap);
    ctx.lineTo(-this.size * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-this.size * 0.5, this.size * 1.8 - wingFlap * 0.3);
    ctx.lineTo(-this.size * 1.6, this.size * 1.4 - wingFlap);
    ctx.lineTo(-this.size * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    
    // Draw carried item if any
    if (this.carrying) {
      let itemColor = '#22c55e';
      if (this.carrying === 'potion') itemColor = '#ef4444';
      else if (this.carrying === 'cheese' || this.carrying === 'gold') itemColor = '#facc15';
      else if (this.carrying === 'dna') itemColor = '#00f0ff';
      
      ctx.fillStyle = itemColor;
      ctx.beginPath();
      ctx.arc(this.size * 0.8, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

// ==========================================
// COLLISION PHYSICS FOR DUNGEON WALLS
// ==========================================
function checkWallCollisions(entity) {
  let r = entity.size;
  let minCol = Math.floor((entity.x - r) / TILE_SIZE);
  let maxCol = Math.floor((entity.x + r) / TILE_SIZE);
  let minRow = Math.floor((entity.y - r) / TILE_SIZE);
  let maxRow = Math.floor((entity.y + r) / TILE_SIZE);
  
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
        let cell = MAP_DATA[row][col];
        if (cell === 1 || cell === 2) {
          let wallL = col * TILE_SIZE;
          let wallR = wallL + TILE_SIZE;
          let wallT = row * TILE_SIZE;
          let wallB = wallT + TILE_SIZE;
          
          let closestX = Math.max(wallL, Math.min(entity.x, wallR));
          let closestY = Math.max(wallT, Math.min(entity.y, wallB));
          
          let dx = entity.x - closestX;
          let dy = entity.y - closestY;
          let dist = Math.hypot(dx, dy);
          
          if (dist < r && dist > 0) {
            entity.x = closestX + (dx / dist) * r;
            entity.y = closestY + (dy / dist) * r;
            
            let angle = Math.atan2(dy, dx);
            let spd = Math.hypot(entity.vx, entity.vy);
            entity.vx = Math.cos(angle) * spd * 0.3;
            entity.vy = Math.sin(angle) * spd * 0.3;
          }
        }
      }
    }
  }
}

function castRay(x, y, dx, dy, maxDist) {
  let step = 6;
  let curr = 0;
  let cx = x;
  let cy = y;
  while (curr < maxDist) {
    cx += dx * step;
    cy += dy * step;
    curr += step;
    
    let col = Math.floor(cx / TILE_SIZE);
    let row = Math.floor(cy / TILE_SIZE);
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return curr;
    let cell = MAP_DATA[row][col];
    if (cell === 1 || cell === 2) return curr;
  }
  return maxDist;
}

// Global rooms and relics lists
let rooms = [];
let relicPickups = [];
let portal = null;

// RELIC PICKUP ENTITY CLASS
class RelicPickup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'crown', 'shield', 'boots'
    this.size = 10;
    
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 2.5 + 1.0;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }
  
  update(dtRatio) {
    this.x += this.vx * dtRatio;
    this.y += this.vy * dtRatio;
    this.vx *= Math.pow(0.92, dtRatio);
    this.vy *= Math.pow(0.92, dtRatio);
    checkWallCollisions(this);
  }
  
  draw(ctx) {
    // Glowing aura
    let glow = 20 + Math.sin(Date.now() * 0.01) * 5;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, glow, 0, Math.PI * 2);
    ctx.fill();

    // Icon
    ctx.fillStyle = '#facc15';
    ctx.font = '16px Montserrat';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let icon = this.type === 'crown' ? '👑' : (this.type === 'shield' ? '🛡️' : '🥾');
    ctx.fillText(icon, this.x, this.y);
  }
}

// PROCEDURAL DUNGEON MAP GENERATOR
function generateDungeonMap() {
  // 1. Fill MAP_DATA with walls (1)
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      MAP_DATA[r][c] = 1;
    }
  }

  // 2. Define rooms: {x, y, w, h} in tile coordinates (Procedural AI layout)
  rooms = [];
  rooms.push({ x: 1, y: 1, w: 4, h: 4 }); // Start room (top-left)
  
  let attempts = 0;
  while (rooms.length < 9 && attempts < 250) {
    attempts++;
    let rw = 2 + Math.floor(Math.random() * 3); // width 2-4
    let rh = 2 + Math.floor(Math.random() * 3); // height 2-4
    let rx = 1 + Math.floor(Math.random() * 14); // col 1-14
    let ry = 1 + Math.floor(Math.random() * 14); // row 1-14
    
    let overlaps = false;
    // Keep distance from start and boss room areas
    if (rx < 6 && ry < 6) overlaps = true;
    if (rx + rw > 14 && ry + rh > 14) overlaps = true;
    
    for (let r of rooms) {
      if (!(rx + rw < r.x || rx > r.x + r.w || ry + rh < r.y || ry > r.y + r.h)) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps) {
      rooms.push({ x: rx, y: ry, w: rw, h: rh });
    }
  }
  
  // Sort intermediate rooms by distance to create sequential corridors flowing top-left to bottom-right
  let startRoom = rooms[0];
  let intermediates = rooms.slice(1);
  intermediates.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  rooms = [startRoom, ...intermediates, { x: 15, y: 15, w: 4, h: 4 }]; // Boss room (bottom-right)

  // Carve rooms
  rooms.forEach(room => {
    for (let r = room.y; r < room.y + room.h; r++) {
      for (let c = room.x; c < room.x + room.w; c++) {
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
          MAP_DATA[r][c] = 0;
        }
      }
    }
    
    // Add decorative pillars (2) in rooms larger than 3x3
    if (room.w >= 4 && room.h >= 4) {
      let cx = Math.floor(room.x + room.w / 2);
      let cy = Math.floor(room.y + room.h / 2);
      if (room !== rooms[0] && room !== rooms[rooms.length - 1]) { // Not in start or boss room
        MAP_DATA[cy][cx] = 2;
      }
    }
  });

  // Helper to carve corridors between center of rooms
  function carveCorridor(x1, y1, x2, y2) {
    let x = x1;
    let y = y1;
    while (x !== x2) {
      MAP_DATA[y][x] = 0;
      x += (x2 > x ? 1 : -1);
    }
    while (y !== y2) {
      MAP_DATA[y][x] = 0;
      y += (y2 > y ? 1 : -1);
    }
  }

  // Connect rooms sequentially to ensure path exists from start to end
  for (let i = 0; i < rooms.length - 1; i++) {
    let r1 = rooms[i];
    let r2 = rooms[i + 1];
    let cx1 = Math.floor(r1.x + r1.w / 2);
    let cy1 = Math.floor(r1.y + r1.h / 2);
    let cx2 = Math.floor(r2.x + r2.w / 2);
    let cy2 = Math.floor(r2.y + r2.h / 2);
    carveCorridor(cx1, cy1, cx2, cy2);
  }

  // 3. Generate torches procedurally
  torches = [];
  rooms.forEach((room) => {
    let tx = (room.x + 1) * TILE_SIZE;
    let ty = room.y * TILE_SIZE + 10; // near top wall
    torches.push({ x: tx, y: ty });
    
    if (room.w >= 4) {
      let tx2 = (room.x + room.w - 1) * TILE_SIZE;
      torches.push({ x: tx2, y: ty });
    }
  });

  // 4. Generate chests procedurally (12 normal + 1 Royal)
  chests = [];
  let chestCount = 0;
  for (let i = 1; i < rooms.length - 1; i++) {
    let r = rooms[i];
    let cx = r.x * TILE_SIZE + 35;
    let cy = r.y * TILE_SIZE + 35;
    chests.push({ x: cx, y: cy, open: false, isRoyal: false });
    chestCount++;
    
    if (r.w >= 4 && chestCount < 12) {
      let cx2 = (r.x + r.w - 1) * TILE_SIZE + 65;
      let cy2 = (r.y + r.h - 1) * TILE_SIZE + 65;
      chests.push({ x: cx2, y: cy2, open: false, isRoyal: false });
      chestCount++;
    }
  }
  
  while (chestCount < 12) {
    let rIdx = 1 + Math.floor(Math.random() * (rooms.length - 2));
    let r = rooms[rIdx];
    let cx = r.x * TILE_SIZE + Math.floor(Math.random() * (r.w - 1)) * TILE_SIZE + 50;
    let cy = r.y * TILE_SIZE + Math.floor(Math.random() * (r.h - 1)) * TILE_SIZE + 50;
    if (!chests.some(c => Math.hypot(c.x - cx, c.y - cy) < 40)) {
      chests.push({ x: cx, y: cy, open: false, isRoyal: false });
      chestCount++;
    }
  }

  // Royal chest behind the Boss at bottom-right
  let bossRoom = rooms[rooms.length - 1];
  chests.push({ 
    x: (bossRoom.x + bossRoom.w - 1) * TILE_SIZE + 50, 
    y: (bossRoom.y + bossRoom.h - 1) * TILE_SIZE + 50, 
    open: false, 
    isRoyal: true 
  });
}

// COLLECT RELIC FUNCTION
function collectRelic(type) {
  if (state.relics[type]) {
    logRow("Вы уже владеете этой реликвией!", "sys");
    return;
  }
  
  state.relics[type] = true;
  player.applyPlayerGenes();
  synth.playEvolve();
  
  let name = "";
  if (type === 'crown') name = "Корона Силы (+50% урона)";
  else if (type === 'shield') name = "Щит Титана (+25% к броне)";
  else if (type === 'boots') name = "Сапоги Ветра (+40% к скорости)";
  
  logRow(`💍 Вы обрели легендарную реликвию: ${name}!`, "gain");
  updateHUD();
}

// SHIELD DAMAGE REDUCTION CALCULATOR
function calculateDamageBlocked(bot, baseDamage) {
  if (bot.type === 'boss' && bot.shieldActive) {
    let angleToPlayer = Math.atan2(player.y - bot.y, player.x - bot.x);
    let diff = angleToPlayer - bot.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    
    // Front cone of 90 degrees
    if (Math.abs(diff) < Math.PI / 2) {
      logRow("🛡️ Щит Босса заблокировал 70% урона!", "danger");
      
      // Blue block sparks
      for (let k = 0; k < 4; k++) {
        particles.push({
          x: bot.x + Math.cos(bot.angle) * bot.size,
          y: bot.y + Math.sin(bot.angle) * bot.size,
          vx: Math.cos(bot.angle) * 1.5 + (Math.random() - 0.5) * 2,
          vy: Math.sin(bot.angle) * 1.5 + (Math.random() - 0.5) * 2,
          size: Math.random() * 3 + 1,
          color: '#38bdf8',
          life: 15
        });
      }
      return baseDamage * 0.3; // 70% blocked
    }
  }
  return baseDamage;
}

// PARTICLE EXPLOSION GENERATOR
function createExplosion(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 4 + 2;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 3 + 1.5,
      color: color,
      life: 20 + Math.random() * 15
    });
  }
}

function throwToxicFlask(x, y, tx, ty, owner) {
  let dx = tx - x;
  let dy = ty - y;
  let dist = Math.hypot(dx, dy);
  
  let flyTime = Math.max(30, Math.min(70, Math.round(dist / 3.2)));
  let vx = dx / flyTime;
  let vy = dy / flyTime;
  
  acidFlasks.push({
    x: x,
    y: y,
    tx: tx,
    ty: ty,
    vx: vx,
    vy: vy,
    life: flyTime,
    maxLife: flyTime,
    owner: owner
  });
}

// ==========================================
// INIT Castle-Forge Lifecycle
// ==========================================
let drones = [];
let lootItems = [];
let bots = [];
let food = [];
let torches = [];
let particles = [];
let fireballs = [];
let chests = [];
let acidFlasks = [];
let acidPuddles = [];
let gameCanvas, gameCtx;
let brainCanvas, brainCtx;
let player;
let mouseX = 0, mouseY = 0;
let keys = {};
let gameActive = false;
let ticks = 0;
let lastTime = 0;


function initSimulation() {
  gameCanvas = document.getElementById('game-canvas');
  gameCtx = gameCanvas.getContext('2d');
  
  brainCanvas = document.getElementById('brain-canvas');
  brainCtx = brainCanvas.getContext('2d');
  
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);
  
  window.addEventListener('keydown', (e) => {
    // Prevent default scroll/actions
    if (['Space', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    
    keys[e.code] = true;
    
    if (e.code === 'Space') {
      player.activateSprint();
    }
    
    if (e.code === 'KeyE') {
      openNearbyChest();
    }
  });
  
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  
  gameCanvas.addEventListener('mousemove', (e) => {
    let rect = gameCanvas.getBoundingClientRect();
    let zoom = state.genes.opn1lw ? 0.85 : 1.15;
    let camX = player.x - gameCanvas.width / (2 * zoom);
    let camY = player.y - gameCanvas.height / (2 * zoom);
    mouseX = (e.clientX - rect.left) / zoom + camX;
    mouseY = (e.clientY - rect.top) / zoom + camY;
  });
  
function performPlayerAttack(clickAngle) {
  if (player.health <= 0 || !gameActive) return;
  player.angle = clickAngle;
  
  // 1. Shoot Fireball if player has SHH and is Stage 3+
  let shotFire = false;
  if (state.genes.shh && state.stage >= 3 && player.energy > 5) {
    let fireballCost = state.level >= 2 ? 1.5 : 3;
    player.energy = Math.max(0, player.energy - fireballCost);
    fireballs.push({
      x: player.x + Math.cos(player.angle) * player.size,
      y: player.y + Math.sin(player.angle) * player.size,
      vx: Math.cos(player.angle) * 7.5,
      vy: Math.sin(player.angle) * 7.5,
      size: 5.5,
      owner: player
    });
    synth.playFire();
    
    // Fire sparks
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: player.x + Math.cos(player.angle) * player.size,
        y: player.y + Math.sin(player.angle) * player.size,
        vx: -Math.cos(player.angle) * 1.5 + (Math.random() - 0.5) * 2,
        vy: -Math.sin(player.angle) * 1.5 + (Math.random() - 0.5) * 2,
        size: Math.random() * 2 + 1,
        color: '#ff6a00',
        life: 15
      });
    }
    shotFire = true;
  }
  
  // 2. Melee Attack / Bite (always available)
  if (!shotFire || (state.genes.shh && state.stage >= 3)) {
    // Melee attack costs a tiny bit of energy (reduced from lvl 2+)
    let meleeCost = state.level >= 2 ? 0.3 : 0.8;
    if (player.energy > meleeCost || state.autopilot) {
      player.energy = Math.max(0, player.energy - (state.autopilot ? 0 : meleeCost));
      
      // visual bite trigger (excitement goes to 1.0)
      player.excitementLevel = 1.0;
      
      let hitAny = false;
      // Check bots in cone
      for (let i = bots.length - 1; i >= 0; i--) {
        let bot = bots[i];
        let d = Math.hypot(bot.x - player.x, bot.y - player.y);
        
        if (d < player.size + bot.size + 28) {
          let enemyAngle = Math.atan2(bot.y - player.y, bot.x - player.x);
          let diff = enemyAngle - clickAngle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          
          if (Math.abs(diff) < 1.1 || state.autopilot) {
            // Melee Hit!
            let dmg = calculateDamageBlocked(bot, player.damage);
            bot.health -= dmg;
            hitAny = true;
            
            // Feral Overlord: Lifesteal (+2 HP) on melee hits
            if (state.genes.col1a1 && state.genes.acta1) {
              player.health = Math.min(player.maxHealth, player.health + 2.0);
              // Green cross sparkles
              if (Math.random() < 0.35) {
                particles.push({
                  x: player.x + (Math.random() - 0.5) * player.size,
                  y: player.y + (Math.random() - 0.5) * player.size,
                  vx: (Math.random() - 0.5) * 0.4,
                  vy: -0.6 - Math.random() * 0.6,
                  size: 2,
                  color: '#22c55e',
                  life: 14
                });
              }
            }
            
            // Spawn blood/shield sparks
            let pColor = bot.type === 'boss' ? '#f59e0b' : (bot.type === 'guard' || bot.type === 'halberdier' ? '#ef4444' : '#fda4af');
            for (let k = 0; k < 6; k++) {
              particles.push({
                x: bot.x,
                y: bot.y,
                vx: Math.cos(enemyAngle) * 2.5 + (Math.random() - 0.5) * 3,
                vy: Math.sin(enemyAngle) * 2.5 + (Math.random() - 0.5) * 3,
                size: Math.random() * 3 + 1.5,
                color: pColor,
                life: 20
              });
            }
            
            // Knockback
            let kb = bot.type === 'boss' ? 1.5 : 4.0; // boss has knockback resistance
            bot.vx += Math.cos(enemyAngle) * kb;
            bot.vy += Math.sin(enemyAngle) * kb;
            
            let botNameLog = bot.type === 'boss' ? 'Босса' : (bot.type === 'guard' ? 'стражника' : (bot.type === 'halberdier' ? 'алебардщика' : (bot.type === 'alchemist' ? 'алхимика' : (bot.type === 'goblin' ? 'гоблина' : (bot.type === 'orc' ? 'орка' : 'крысу')))));
            logRow(`Вы ударили ${botNameLog}! Урон: ${dmg.toFixed(0)}`, "gain");
            
            // Handle death
            if (bot.health <= 0) {
              if (bot.type === 'boss') {
                handleBossDeath(bot, 'melee');
              } else if (bot.type === 'guard') {
                state.guardsDefeated++;
                state.dna += 10;
                state.gold += 10;
                logRow("Рыцарь замка уничтожен! +10 ДНК, +10 золота.", "gain");
                food.push({ x: bot.x, y: bot.y, type: 'cheese', size: 6.0 });
              } else if (bot.type === 'halberdier') {
                state.guardsDefeated++;
                state.dna += 14;
                state.gold += 12;
                logRow("Алебардщик уничтожен! +14 ДНК, +12 золота.", "gain");
                food.push({ x: bot.x, y: bot.y, type: 'cheese', size: 6.0 });
              } else if (bot.type === 'alchemist') {
                state.dna += 15;
                state.gold += 12;
                logRow("Алхимик-отравитель уничтожен! +15 ДНК, +12 золота.", "gain");
                food.push({ x: bot.x, y: bot.y, type: 'potion', size: 5.5 });
              } else if (bot.type === 'mage') {
                state.dna += 12;
                state.gold += 12;
                logRow("Маг замка уничтожен! +12 ДНК, +12 золота.", "gain");
                food.push({ x: bot.x, y: bot.y, type: 'potion', size: 5.5 });
              } else if (bot.type === 'bomber') {
                state.dna += 8;
                state.gold += 8;
                logRow("Чумная крыса-камикадзе уничтожена до взрыва! +8 ДНК, +8 золота.", "gain");
                food.push({ x: bot.x, y: bot.y, type: 'spore', size: 4.0 });
              } else if (bot.type === 'goblin') {
                state.dna += 8;
                state.gold += 6;
                logRow('Гоблин-разбойник побежден! +8 ДНК, +6 золота.', 'gain');
                food.push({ x: bot.x, y: bot.y, type: 'cheese', size: 4.5 });
              } else if (bot.type === 'orc') {
                state.dna += 15;
                state.gold += 12;
                logRow('Орк-берсерк побежден! +15 ДНК, +12 золота.', 'gain');
                food.push({ x: bot.x, y: bot.y, type: 'potion', size: 5.5 });
              } else if (bot.type === 'vampire') {
                state.dna += 18;
                state.gold += 14;
                logRow('🧛 Вампир уничтожен! +18 ДНК, +14 золота.', 'gain');
                lootItems.push(new LootItem(bot.x, bot.y, 'gold'));
              } else if (bot.type === 'shaman') {
                state.dna += 14;
                state.gold += 11;
                logRow('💀 Шаман повержен! +14 ДНК, +11 золота.', 'gain');
                food.push({ x: bot.x, y: bot.y, type: 'potion', size: 5.5 });
              } else {
                player.energy = Math.min(player.maxEnergy, player.energy + 18);
                player.evolveProgress = Math.min(100, player.evolveProgress + 6.0);
                state.dna += 2;
                state.gold += 2;
                logRow('Вы съели крысу! +2 золота.', 'gain');
                setTimeout(spawnRat, 4000);
              }
              bots.splice(i, 1);
            }
          }
        }
      }
      
      if (hitAny) {
        synth.playEat();
      } else {
        // Play miss sound / whoosh
        if (soundEnabled && synth.ctx) {
          let osc = synth.ctx.createOscillator();
          let gain = synth.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(350, synth.ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(100, synth.ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.02, synth.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, synth.ctx.currentTime + 0.1);
          osc.connect(gain);
          gain.connect(synth.ctx.destination);
          osc.start();
          osc.stop(synth.ctx.currentTime + 0.1);
        }
      }
    }
  }
}

window.performPlayerAttack = performPlayerAttack;

  gameCanvas.addEventListener('mousedown', (e) => {
    synth.init();
    if (player.health <= 0 || !gameActive) return;
    
    let clickAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
    performPlayerAttack(clickAngle);
  });
  generateDungeonMap();
  
  resetEcosystem();
  saveGame();
  gameActive = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
  logRow("[ИНФО] Вход в замок выполнен. Сбор золота открывает мутации!", "sys");
}

function resetEcosystem(keepPlayer = false) {
  portal = null;
  generateDungeonMap();
  relicPickups = [];
  let lvl = state.level || 1;
  
  if (!keepPlayer || !player) {
    player = new Organism(150, 150, true, 'slime');
  } else {
    // Just reposition player to the center of the first room
    let startRoom = rooms[0];
    player.x = startRoom.x * TILE_SIZE + Math.floor(startRoom.w / 2) * TILE_SIZE + 50;
    player.y = startRoom.y * TILE_SIZE + Math.floor(startRoom.h / 2) * TILE_SIZE + 50;
    player.vx = 0;
    player.vy = 0;
    player.applyPlayerGenes();
  }
  
  bots = [];
  // Spawn normal guards, mages, bombers in middle rooms (rooms 1 to rooms.length - 2)
  for (let i = 1; i < rooms.length - 1; i++) {
    let r = rooms[i];
    let cx = r.x * TILE_SIZE + Math.floor(r.w / 2) * TILE_SIZE + 50;
    let cy = r.y * TILE_SIZE + Math.floor(r.h / 2) * TILE_SIZE + 50;
    
    let enemyType = 'guard';
    if (lvl === 2) {
      let roll = Math.random();
      if (roll < 0.20) enemyType = 'mage';
      else if (roll < 0.40) enemyType = 'goblin';
      else if (roll < 0.60) enemyType = 'halberdier';
    } else if (lvl >= 3) {
      let roll = Math.random();
      if (roll < 0.12) enemyType = 'mage';
      else if (roll < 0.24) enemyType = 'bomber';
      else if (roll < 0.36) enemyType = 'goblin';
      else if (roll < 0.48) enemyType = 'orc';
      else if (roll < 0.60) enemyType = 'halberdier';
      else if (roll < 0.72) enemyType = 'alchemist';
      else if (roll < 0.85 && lvl >= 4) enemyType = 'vampire';
      else if (lvl >= 4) enemyType = 'shaman';
    }
    bots.push(new Organism(cx, cy, false, enemyType));
  }
  
  // Spawn the Dread Lord Boss in the center of the Boss room (rooms[rooms.length - 1])
  let bossRoom = rooms[rooms.length - 1];
  let bx = bossRoom.x * TILE_SIZE + Math.floor(bossRoom.w / 2) * TILE_SIZE + 50;
  let by = bossRoom.y * TILE_SIZE + Math.floor(bossRoom.h / 2) * TILE_SIZE + 50;
  if (lvl === 3) {
    // Spawn two bosses for Level 3 as requested
    bots.push(new Organism(bx - 50, by - 50, false, 'boss'));
    bots.push(new Organism(bx + 50, by + 50, false, 'boss'));
  } else {
    bots.push(new Organism(bx, by, false, 'boss'));
  }
  
  // Spawn extra guards/mages/bombers at higher floors to scale difficulty
  let extraSpawns = Math.min(5, lvl - 1);
  for (let k = 0; k < extraSpawns; k++) {
    let rIdx = 1 + Math.floor(Math.random() * (rooms.length - 2));
    let r = rooms[rIdx];
    let cx = r.x * TILE_SIZE + Math.floor(r.w / 2) * TILE_SIZE + 50;
    let cy = r.y * TILE_SIZE + Math.floor(r.h / 2) * TILE_SIZE + 50;
    
    let enemyType = 'guard';
    if (lvl === 2) {
      let roll = Math.random();
      if (roll < 0.25) enemyType = 'mage';
      else if (roll < 0.50) enemyType = 'goblin';
      else if (roll < 0.75) enemyType = 'halberdier';
    } else if (lvl >= 3) {
      let roll = Math.random();
      if (roll < 0.20) enemyType = 'mage';
      else if (roll < 0.40) enemyType = 'bomber';
      else if (roll < 0.55) enemyType = 'goblin';
      else if (roll < 0.70) enemyType = 'orc';
      else if (roll < 0.85) enemyType = 'halberdier';
      else enemyType = 'alchemist';
    }
    bots.push(new Organism(cx, cy, false, enemyType));
  }
  
  for (let i = 0; i < 8; i++) spawnRat();
  
  food = [];
  for (let i = 0; i < 45; i++) spawnFood();
  
  recreateDrones();
  
  lootItems = [];
  fireballs = [];
  particles = [];
  updateHUD();
  showBossAnnouncement(lvl);
}

function showBossAnnouncement(lvl) {
  let bossName = "";
  let bossDesc = "";
  if (lvl === 1) {
    bossName = "Гигантский Слизень-Громила";
    bossDesc = "Огромная мутировавшая масса, поглощающая всё на своем пути.";
  } else if (lvl === 2) {
    bossName = "Лорд-Алхимик Равенхольд";
    bossDesc = "Создатель токсичных испарений, забрасывающий врагов склянками с ядом.";
  } else if (lvl === 3) {
    bossName = "Рыцари-Командоры Гвардии";
    bossDesc = "Два грозных командира гвардии в тяжелой латунной броне. Будьте предельно осторожны!";
  } else if (lvl === 4) {
    bossName = "Абсолютный Паладин";
    bossDesc = "Сильнейший воин королевства. Владеет блинк-телепортацией и круговыми ударами.";
  } else {
    bossName = `Древний Страж Эволюции (Ранг ${lvl})`;
    bossDesc = "Невероятно сильное существо, порожденное алхимическими отходами замка.";
  }
  
  // Log announcement in the chat log
  logRow(`👑 ВНИМАНИЕ: На этом этаже обитает босс: ${bossName}!`, "danger");
  logRow(`📖 Описание: ${bossDesc}`, "sys");
  
  // Create HTML screen announcement
  let banner = document.createElement('div');
  banner.id = 'boss-announcement-banner';
  banner.className = 'boss-intro-banner';
  banner.innerHTML = `
    <div class="boss-intro-content">
      <span class="boss-warning-tag">⚠️ КУЛЬМИНАЦИЯ ЭТАЖА ${lvl} ⚠️</span>
      <h1 class="boss-intro-title">${bossName}</h1>
      <p class="boss-intro-desc">${bossDesc}</p>
    </div>
  `;
  
  let container = document.getElementById('canvas-container');
  if (container) {
    // Remove existing banner if any
    let old = document.getElementById('boss-announcement-banner');
    if (old) old.remove();
    
    container.appendChild(banner);
    
    // Auto remove after 4.5 seconds
    setTimeout(() => {
      banner.classList.add('fade-out');
      setTimeout(() => banner.remove(), 800);
    }, 4000);
  }
}

function spawnRat() {
  while (true) {
    let col = Math.floor(Math.random() * GRID_COLS);
    let row = Math.floor(Math.random() * GRID_ROWS);
    if (MAP_DATA[row][col] === 0) {
      bots.push(new Organism(col * TILE_SIZE + 50, row * TILE_SIZE + 50, false, 'rat'));
      break;
    }
  }
}

function spawnFood() {
  while (true) {
    let col = Math.floor(Math.random() * GRID_COLS);
    let row = Math.floor(Math.random() * GRID_ROWS);
    if (MAP_DATA[row][col] === 0) {
      let fx = col * TILE_SIZE + Math.random() * 60 + 20;
      let fy = row * TILE_SIZE + Math.random() * 60 + 20;
      let type = 'spore'; 
      let rand = Math.random();
      if (rand < 0.3) type = 'cheese';
      else if (rand < 0.4) type = 'potion';
      food.push({ x: fx, y: fy, type, size: type === 'potion' ? 5.5 : 4.0 });
      break;
    }
  }
}

function openNearbyChest() {
  let closestC = null;
  let minDist = Infinity;
  for (let ch of chests) {
    if (!ch.open) {
      let d = Math.hypot(ch.x - player.x, ch.y - player.y);
      if (d < minDist) {
        minDist = d;
        closestC = ch;
      }
    }
  }
  
  if (closestC && minDist < 65) {
    closestC.open = true;
    synth.playChestOpen();
    
    if (closestC.isRoyal) {
      logRow("🌟 Вы открыли Королевский Сундук! Добыча рассыпалась на полу.", "gain");
      state.gold += 40;
      state.dna += 60;
      state.crystals += 10;
      
      if (state.level >= 4) {
        // On level 4, Royal Chest gives huge bonus but does NOT end the game
        // Victory only triggers after defeating the Final Boss and stepping through the portal
        state.gold += 80;
        state.dna += 80;
        state.crystals += 20;
        logRow("👑 КОРОЛЕВСКИЙ КЛАД! Огромный бонус получен. Но финальный босс ещё стоит на пути!", "adapt");
      }
      
      // Spawn Relic!
      let relicTypes = ['crown', 'shield', 'boots', 'elixir', 'ring', 'amulet'];
      let rType = relicTypes[Math.floor(Math.random() * relicTypes.length)];
      relicPickups.push(new RelicPickup(closestC.x, closestC.y, rType));
      logRow("👑 На полу появилась легендарная реликвия! Подойдите, чтобы забрать её.", "adapt");
      
      // Spawn extra magnetic loot
      for (let i = 0; i < 5; i++) {
        lootItems.push(new LootItem(closestC.x, closestC.y, 'gold'));
      }
      for (let i = 0; i < 2; i++) {
        lootItems.push(new LootItem(closestC.x, closestC.y, 'dna'));
      }
    } else {
      state.crystals += 5;
      logRow("Вы открыли сундук! Добыча рассыпалась на полу. +5 💎", "gain");
      
      if (Math.random() < 0.30) {
        let relicTypes = ['crown', 'shield', 'boots', 'elixir', 'ring', 'amulet'];
        let rType = relicTypes[Math.floor(Math.random() * relicTypes.length)];
        relicPickups.push(new RelicPickup(closestC.x, closestC.y, rType));
        logRow("🎁 В сундуке оказалась скрытая реликвия! Подберите её.", "adapt");
      }
      
      // Spawn magnetic loot coins and gems
      let coinCount = 1 + Math.floor(Math.random() * 2); // 1-2 coins
      for (let i = 0; i < coinCount; i++) {
        lootItems.push(new LootItem(closestC.x, closestC.y, 'gold'));
      }
      
      let gemCount = 1; // 1 DNA gem
      for (let i = 0; i < gemCount; i++) {
        lootItems.push(new LootItem(closestC.x, closestC.y, 'dna'));
      }
    }
  }
}

function startFloorTransition() {
  if (state.transitionDirection !== 0) return;
  state.transitionDirection = 1; // fade out to black
  synth.playStairsDescend();
}

function goToNextFloorLevel() {
  startFloorTransition();
}

function resizeCanvases() {
  let gContainer = document.getElementById('canvas-container');
  if (gameCanvas) {
    gameCanvas.width = gContainer.clientWidth;
    gameCanvas.height = gContainer.clientHeight;
  }
  let bContainer = brainCanvas.parentElement;
  if (brainCanvas) {
    brainCanvas.width = bContainer.clientWidth;
    brainCanvas.height = bContainer.clientHeight;
  }
}

// ==========================================
// LOOP UPDATES
// ==========================================
function gameLoop(timestamp) {
  if (!gameActive) return;
  if (!timestamp) timestamp = performance.now();
  
  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  
  if (dt > 0.1) dt = 0.1; // Cap dt to avoid teleport bugs on tab switch
  
  updatePhysics(dt);
  drawScene();
  
  ticks++;
  if (ticks % 5 === 0) {
    updateHUD();
    drawBrainGraph();
  }
  
  requestAnimationFrame(gameLoop);
}

function updatePhysics(dt) {
  let dtRatio = dt * 60;
  
  // Transition Fade logic
  if (state.transitionDirection === 1) {
    state.transitionFade += dt / 1.5;
    if (state.transitionFade >= 1.0) {
      state.transitionFade = 1.0;
      state.transitionDirection = -1;
      
      state.level++;
      portal = null;
      logRow(`🌀 Вы спустились на Этаж ${state.level}! Подземелье перестроилось, мобы стали сильнее!`, "sys");
      resetEcosystem(true);
      saveGame();
      updateHUD();
    }
  } else if (state.transitionDirection === -1) {
    state.transitionFade -= dt / 1.5;
    if (state.transitionFade <= 0.0) {
      state.transitionFade = 0.0;
      state.transitionDirection = 0;
    }
  }
  
  if (state.transitionDirection !== 0) {
    player.vx = 0;
    player.vy = 0;
    return;
  }
  
  if (typeof player.fireShieldCd === 'undefined') player.fireShieldCd = 0;
  player.fireShieldCd = Math.max(0, player.fireShieldCd - dtRatio);
  
  // Toxic Rogue: drop poison puddles during sprint
  if (player.sprinting && state.genes.ldha && state.genes.chit1) {
    if (ticks % 4 === 0) {
      acidPuddles.push({
        x: player.x,
        y: player.y,
        size: 24,
        life: 150,
        isPlayerAcid: true
      });
    }
  }

  // Move player
  if (!state.autopilot) {
    let moveX = 0;
    let moveY = 0;
    if (keys['KeyW'] || keys['ArrowUp']) moveY = -1;
    if (keys['KeyS'] || keys['ArrowDown']) moveY = 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveX = -1;
    if (keys['KeyD'] || keys['ArrowRight']) moveX = 1;
    
    // Always aim towards the mouse
    player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    
    if (moveX !== 0 || moveY !== 0) {
      let len = Math.hypot(moveX, moveY);
      let dx = moveX / len;
      let dy = moveY / len;
      
      let accel = player.acceleration;
      let maxSpd = player.speed;
      
      // Toxic Rogue synergy speed bonus (+15%)
      if (state.genes.ldha && state.genes.chit1) {
        accel *= 1.15;
        maxSpd *= 1.15;
      }
      
      if (player.sprinting) {
        let dashSpeedMult = state.genes.ldha ? 2.2 : 1.5;
        accel *= (dashSpeedMult * 1.5);
        maxSpd *= dashSpeedMult;
      }
      
      player.vx += dx * accel * dtRatio;
      player.vy += dy * accel * dtRatio;
      
      let currentSpeed = Math.hypot(player.vx, player.vy);
      if (currentSpeed > maxSpd) {
        player.vx = (player.vx / currentSpeed) * maxSpd;
        player.vy = (player.vy / currentSpeed) * maxSpd;
      }
    }
  }
  
  player.update(dtRatio, food, [player, ...bots]);
  
  // Portal collision check
  if (portal && portal.active) {
    let distToPortal = Math.hypot(player.x - portal.x, player.y - portal.y);
    if (distToPortal < player.size + 20) {
      let aliveBosses = bots.filter(b => b.type === 'boss' && b.health > 0).length;
      if (aliveBosses === 0) {
        if (state.level >= 4) {
          triggerVictory();
        } else {
          startFloorTransition();
        }
      } else {
        if (!state.lastBossWarningTime || Date.now() - state.lastBossWarningTime > 2500) {
          logRow(`⚠️ Лестница заблокирована! Вы должны победить всех боссов на этом этаже (${aliveBosses} осталось)!`, "warning");
          state.lastBossWarningTime = Date.now();
        }
      }
    }
  }

  // Relic-based player updates (HP / Energy regeneration)
  if (state.relics) {
    if (state.relics.elixir) {
      player.health = Math.min(player.maxHealth, player.health + 0.02 * dtRatio); // ~1.2 HP per second
    }
    if (state.relics.ring) {
      player.energy = Math.min(player.maxEnergy, player.energy + 0.08 * dtRatio); // ~4.8 Energy per second
    }
  }
  
  // Bats helper drones
  for (let b of drones) {
    b.update(dtRatio, food);
    // Magnetize to loot items too
    for (let i = lootItems.length - 1; i >= 0; i--) {
      let item = lootItems[i];
      let d = Math.hypot(item.x - b.x, item.y - b.y);
      if (d < 120) {
        let pull = 0.28;
        let angle = Math.atan2(b.x - item.x, b.y - item.y); // Pull item towards drone
        item.vx += Math.cos(angle) * pull * dtRatio;
        item.vy += Math.sin(angle) * pull * dtRatio;
      }
    }
  }
  
  // Loot items physics
  for (let i = lootItems.length - 1; i >= 0; i--) {
    let item = lootItems[i];
    item.update(dtRatio, player);
    
    // Collection
    let d = Math.hypot(item.x - player.x, item.y - player.y);
    if (d < player.size + item.size + 2) {
      if (item.type === 'gold') {
        state.gold += 5;
        logRow("Собрано золото (+5)", "gain");
      } else {
        state.dna += 12;
        logRow("Усвоена ДНК-эссенция (+12 ДНК)", "adapt");
      }
      synth.playEat();
      lootItems.splice(i, 1);
      continue;
    }
    
    // Auto decay
    if (item.life <= 0) lootItems.splice(i, 1);
  }
  
  // Fireballs
  for (let i = fireballs.length - 1; i >= 0; i--) {
    let fb = fireballs[i];
    fb.x += fb.vx * dtRatio;
    fb.y += fb.vy * dtRatio;
    
    let col = Math.floor(fb.x / TILE_SIZE);
    let row = Math.floor(fb.y / TILE_SIZE);
    let hit = false;
    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
      let cell = MAP_DATA[row][col];
      if (cell === 1 || cell === 2) hit = true;
    } else {
      hit = true;
    }
    
    if (hit) {
      createExplosion(fb.x, fb.y, '#ff6a00');
      fireballs.splice(i, 1);
      continue;
    }
    
    if (fb.owner && fb.owner.isPlayer) {
      // Player fireball: hits guards, boss, mages, bombers, goblins, orcs, halberdiers, alchemists
      let hitBot = false;
      for (let bot of bots) {
        if ((bot.type === 'guard' || bot.type === 'boss' || bot.type === 'mage' || bot.type === 'bomber' || bot.type === 'goblin' || bot.type === 'orc' || bot.type === 'vampire' || bot.type === 'shaman' || bot.type === 'halberdier' || bot.type === 'alchemist') && Math.hypot(fb.x - bot.x, fb.y - bot.y) < bot.size + fb.size) {
          let dmg = calculateDamageBlocked(bot, 35);
          // Swarm Lord check (+50% fireball damage)
          if (state.genes.foxp2 && state.genes.mbp && state.genes.opn1lw) dmg *= 1.5;
          bot.health -= dmg;
          
          // Fire Knight check: ignite enemy
          if (state.genes.shh && state.genes.rubisco) {
            bot.burnTimer = 240; // 4 seconds burn
          }
          
          createExplosion(fb.x, fb.y, '#ff2a6d');
          synth.playDamage();
          
          if (bot.health <= 0) {
            let idx = bots.indexOf(bot);
            if (idx !== -1) bots.splice(idx, 1);
            if (bot.type === 'boss') {
              handleBossDeath(bot, 'fireball');
            } else if (bot.type === 'guard') {
              state.guardsDefeated++;
              state.dna += 10;
              state.gold += 10;
              logRow("Рыцарь замка уничтожен! +10 ДНК, +10 золота.", "gain");
              food.push({ x: bot.x, y: bot.y, type: 'cheese', size: 6.0 });
            } else if (bot.type === 'halberdier') {
              state.guardsDefeated++;
              state.dna += 14;
              state.gold += 12;
              logRow("Алебардщик уничтожен! +14 ДНК, +12 золота.", "gain");
              food.push({ x: bot.x, y: bot.y, type: 'cheese', size: 6.0 });
            } else if (bot.type === 'alchemist') {
              state.dna += 15;
              state.gold += 12;
              logRow("Алхимик-отравитель уничтожен! +15 ДНК, +12 золота.", "gain");
              food.push({ x: bot.x, y: bot.y, type: 'potion', size: 5.5 });
            } else if (bot.type === 'mage') {
              state.dna += 12;
              state.gold += 12;
              logRow("Маг замка уничтожен! +12 ДНК, +12 золота.", "gain");
              food.push({ x: bot.x, y: bot.y, type: 'potion', size: 5.5 });
            } else if (bot.type === 'bomber') {
              state.dna += 8;
              state.gold += 8;
              logRow("Чумная крыса-камикадзе уничтожена до взрыва! +8 ДНК, +8 золота.", "gain");
              food.push({ x: bot.x, y: bot.y, type: 'spore', size: 4.0 });
            } else if (bot.type === 'goblin') {
              state.dna += 8;
              state.gold += 6;
              logRow('Гоблин-разбойник побежден! +8 ДНК, +6 золота.', 'gain');
              food.push({ x: bot.x, y: bot.y, type: 'cheese', size: 4.5 });
            } else if (bot.type === 'orc') {
              state.dna += 15;
              state.gold += 12;
              logRow('Орк-берсерк побежден! +15 ДНК, +12 золота.', 'gain');
              food.push({ x: bot.x, y: bot.y, type: 'potion', size: 5.5 });
            } else if (bot.type === 'vampire') {
              state.dna += 18;
              state.gold += 14;
              logRow('🧛 Вампир уничтожен! +18 ДНК, +14 золота.', 'gain');
              lootItems.push(new LootItem(bot.x, bot.y, 'gold'));
            } else if (bot.type === 'shaman') {
              state.dna += 14;
              state.gold += 11;
              logRow('💀 Шаман повержен! +14 ДНК, +11 золота.', 'gain');
              food.push({ x: bot.x, y: bot.y, type: 'potion', size: 5.5 });
            }
          }
          fireballs.splice(i, 1);
          hitBot = true;
          break;
        }
      }
      if (hitBot) continue;
    } else {
      // Enemy fireball: hits player
      if (Math.hypot(fb.x - player.x, fb.y - player.y) < player.size + fb.size) {
        if (player.sprinting) {
          // Visual dodge indicator
          createExplosion(fb.x, fb.y, '#eab308', 5);
          fireballs.splice(i, 1);
          continue;
        }
        let isRanged = fb.owner && (fb.owner.type === 'mage' || fb.owner.type === 'shaman');
        let dmg = fb.owner ? fb.owner.damage * (isRanged ? 1.25 : 2.5) : 15;
        if (player.armor > 0) dmg *= (1 - player.armor);
        player.health -= dmg;
        if (state.genes.shh && state.genes.rubisco && player.fireShieldCd === 0 && !fb.isShieldSpit) {
          triggerFireShieldBlast();
        }
        createExplosion(fb.x, fb.y, '#a855f7'); // magical purple explosion
        synth.playDamage();
        
        // Spawn blood particles
        for (let k = 0; k < 6; k++) {
          particles.push({
            x: player.x,
            y: player.y,
            vx: fb.vx * 0.4 + (Math.random() - 0.5) * 3,
            vy: fb.vy * 0.4 + (Math.random() - 0.5) * 3,
            size: Math.random() * 3 + 1.5,
            color: '#ef4444',
            life: 20
          });
        }
        
        logRow(`✨ Магический снаряд мага поразил вас! Нанесено: ${dmg.toFixed(0)} урона!`, "danger");
        if (player.health <= 0) triggerDeath();
        
        fireballs.splice(i, 1);
        continue;
      }
    }
  }
  
  // Update relic pickups
  for (let i = relicPickups.length - 1; i >= 0; i--) {
    let rp = relicPickups[i];
    rp.update(dtRatio);
    
    let d = Math.hypot(rp.x - player.x, rp.y - player.y);
    if (d < player.size + rp.size + 4) {
      collectRelic(rp.type);
      relicPickups.splice(i, 1);
    }
  }
  
  // Guard, Boss, Goblin and Orc damage on player
  for (let i = bots.length - 1; i >= 0; i--) {
    let bot = bots[i];
    bot.update(dtRatio, food, [player, ...bots]);
    
    // Fire Knight burn tick logic
    if (bot.burnTimer && bot.burnTimer > 0) {
      bot.burnTimer -= dtRatio;
      let burnDmg = 0.055 * dtRatio;
      bot.health -= burnDmg;
      
      if (Math.random() < 0.15 * dtRatio) {
        particles.push({
          x: bot.x + (Math.random() - 0.5) * bot.size,
          y: bot.y + (Math.random() - 0.5) * bot.size,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.8 - Math.random() * 0.5,
          size: Math.random() * 2.2 + 0.8,
          color: '#f97316',
          life: 12
        });
      }
      
      if (bot.health <= 0) {
        // Handle death
        if (bot.type === 'boss') {
          handleBossDeath(bot, 'burn');
        } else {
          state.guardsDefeated++;
          state.dna += 10;
          state.gold += 10;
          state.crystals += 5;
          logRow("Моб погиб в пламени! +10 ДНК, +10 золота, +5 💎.", "gain");
          food.push({ x: bot.x, y: bot.y, type: 'cheese', size: 6.0 });
        }
        bots.splice(i, 1);
        continue;
      }
    }
    
    if (bot.type === 'guard' || bot.type === 'boss' || bot.type === 'goblin' || bot.type === 'orc' || bot.type === 'halberdier' || bot.type === 'rat') {
      let d = Math.hypot(player.x - bot.x, player.y - bot.y);
      if (d < player.size + bot.size + 6) {
        if (player.sprinting) continue; // Immune to contact damage while sprinting
        // Attack cooldown per bot to prevent spam
        if (!bot.attackCd) bot.attackCd = 0;
        bot.attackCd = Math.max(0, bot.attackCd - dtRatio);
        if (bot.attackCd <= 0) {
          bot.attackCd = 28; // ~0.5 second cooldown at 60fps
          let dmg = bot.damage;
          if (player.armor > 0) dmg *= (1 - player.armor);
          
          player.health -= dmg;
          if (state.genes.shh && state.genes.rubisco && player.fireShieldCd === 0) {
            triggerFireShieldBlast();
          }
          synth.playDamage();
          
          player.vx += Math.cos(bot.angle) * 4.5;
          player.vy += Math.sin(bot.angle) * 4.5;
          
          if (state.genes.shh) {
            // SHH thorns: cooldown per bot so it doesn't spam every hit
            if (!bot.thornCd) bot.thornCd = 0;
            bot.thornCd = Math.max(0, bot.thornCd - dtRatio);
            if (bot.thornCd <= 0) {
              bot.thornCd = 45; // ~0.75 sec cooldown
              bot.health -= 12;
              logRow('Шипы SHH! Атакующий ранен на 12 урона.', 'gain');
            }
          }
          
          const botNames = { boss: 'Босс', guard: 'Стражник замка', goblin: 'Гоблин-разбойник', orc: 'Орк-берсерк', halberdier: 'Алебардщик', rat: 'Крыса' };
          let botName = botNames[bot.type] || bot.type;
          logRow(`${botName} ударил вас! Нанесено урона: ${dmg.toFixed(0)}`, 'danger');
          if (player.health <= 0) triggerDeath();
        }
      }
    }

    // AI is now dispatched via Organism.update() for all mob types
  }
  
  // Eating moss/cheese
  for (let i = food.length - 1; i >= 0; i--) {
    let f = food[i];
    let d = Math.hypot(f.x - player.x, f.y - player.y);
    if (d < player.size + f.size + 2) {
      if (f.type === 'potion') {
        player.health = Math.min(player.maxHealth, player.health + 25);
        player.energy = Math.min(player.maxEnergy, player.energy + 10);
        state.dna += 4;
        logRow("Вы выпили зелье здоровья!", "gain");
      } else {
        player.energy = Math.min(player.maxEnergy, player.energy + 12);
        player.evolveProgress = Math.min(100, player.evolveProgress + 2.5);
        state.dna += 2;
      }
      synth.playEat();
      food.splice(i, 1);
      spawnFood();
      continue;
    }
  }
  
  // Eat rats
  for (let i = bots.length - 1; i >= 0; i--) {
    let bot = bots[i];
    if (bot.type === 'rat') {
      let d = Math.hypot(bot.x - player.x, bot.y - player.y);
      if (d < player.size + bot.size + 2) {
        let dmg = player.damage;
        bot.health -= dmg;
        synth.playEat();
        
        if (bot.health <= 0) {
          bots.splice(i, 1);
          player.energy = Math.min(player.maxEnergy, player.energy + 18);
          player.evolveProgress = Math.min(100, player.evolveProgress + 6.0);
          state.dna += 3;
          state.gold += 3;
          logRow("Вы съели крысу! +3 золота.", "gain");
          setTimeout(spawnRat, 4000);
        }
      }
    }
  }
  
  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx * dtRatio;
    p.y += p.vy * dtRatio;
    p.life -= dtRatio;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = acidFlasks.length - 1; i >= 0; i--) {
    let f = acidFlasks[i];
    f.x += f.vx * dtRatio;
    f.y += f.vy * dtRatio;
    f.life -= dtRatio;
    
    // Check collision with walls (MAP_DATA)
    let gridX = Math.floor(f.x / TILE_SIZE);
    let gridY = Math.floor(f.y / TILE_SIZE);
    let hitWall = false;
    if (gridX >= 0 && gridX < GRID_COLS && gridY >= 0 && gridY < GRID_ROWS) {
      if (MAP_DATA[gridY][gridX] === 1) {
        hitWall = true;
      }
    }
    
    if (f.life <= 0 || hitWall) {
      // Explode and create acid puddle
      acidPuddles.push({
        x: f.x,
        y: f.y,
        size: 32 + Math.random() * 16,
        life: 300 + Math.random() * 100,
        maxLife: 400
      });
      
      // Spawn acid splash particles
      createExplosion(f.x, f.y, '#22c55e', 12);
      
      // Remove flask
      acidFlasks.splice(i, 1);
    }
  }

  // Acid Puddles (damage over time)
  if (!player.acidLogTimer) player.acidLogTimer = 0;
  player.acidLogTimer = Math.max(0, player.acidLogTimer - dtRatio);

  for (let i = acidPuddles.length - 1; i >= 0; i--) {
    let puddle = acidPuddles[i];
    puddle.life -= dtRatio;
    
    // Check if player stands in puddle
    let d = Math.hypot(player.x - puddle.x, player.y - puddle.y);
    if (d < player.size + puddle.size) {
      // Apply periodic damage
      let dmg = 0.3 * dtRatio;
      if (player.armor > 0) dmg *= (1 - player.armor);
      player.health -= dmg;
      
      // Spawn tiny green bubbling particles
      if (Math.random() < 0.25 * dtRatio) {
        particles.push({
          x: player.x + (Math.random() - 0.5) * player.size,
          y: player.y + (Math.random() - 0.5) * player.size,
          vx: (Math.random() - 0.5) * 1.0,
          vy: -1.0 - Math.random() * 1.5,
          size: Math.random() * 2 + 1,
          color: '#22c55e',
          life: 15
        });
      }
      
      if (player.acidLogTimer <= 0) {
        player.acidLogTimer = 45; // limit log spam to once per 0.75s
        logRow("⚠️ Кислотная лужа разъедает здоровье! -15 HP/сек", "danger");
      }
      
      if (player.health <= 0) triggerDeath();
    }
    
    if (puddle.life <= 0) {
      acidPuddles.splice(i, 1);
    }
  }
}

function drawScene() {
  if (!gameCtx) return;
  if (!window.loggedPlayerState && typeof player !== 'undefined' && player) {
    window.loggedPlayerState = true;
    logRow(`[ТЕСТ] Игрок: x=${Math.round(player.x)}, y=${Math.round(player.y)}, size=${Math.round(player.size)}, hp=${player.health}, color=${player.color}, stage=${state.stage}`, "sys");
  }
  
  let level = (typeof state !== 'undefined' && state.level) ? state.level : 1;
  
  // Theme Colors
  let bgColors = ['#090a0f', '#070b08', '#0c0707', '#0e0d0a'];
  gameCtx.fillStyle = bgColors[Math.min(level - 1, 3)];
  gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
  
  let zoom = state.genes.opn1lw ? 0.85 : 1.15;
  
  gameCtx.save();
  gameCtx.translate(gameCanvas.width / 2, gameCanvas.height / 2);
  gameCtx.scale(zoom, zoom);
  gameCtx.translate(-player.x, -player.y);
  
  // Light flicker logic for player's vision radius
  let lightRad = player.visionRadius * (1.0 + Math.sin(Date.now() * 0.0075) * 0.028);

  // ==========================================
  // PASS 1: FLOORS, DECORATIONS, AND SHADOWS
  // ==========================================
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      let cell = MAP_DATA[row][col];
      let x = col * TILE_SIZE;
      let y = row * TILE_SIZE;
      
      if (cell === 0 || cell === 2) {
        if (level === 2) {
          // Green moss floor
          gameCtx.fillStyle = '#08140c';
          gameCtx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          gameCtx.strokeStyle = '#050a06';
          gameCtx.lineWidth = 1;
        } else if (level === 3) {
          // Crimson lava floor
          gameCtx.fillStyle = '#140808';
          gameCtx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          gameCtx.strokeStyle = '#0b0404';
          gameCtx.lineWidth = 1;
        } else if (level >= 4) {
          // White marble floor
          gameCtx.fillStyle = '#f1f5f9';
          gameCtx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          gameCtx.strokeStyle = '#cbd5e1';
          gameCtx.lineWidth = 1;
        } else {
          // Grey stone floor (brightened slightly for better visibility under torchlight)
          gameCtx.fillStyle = '#181922';
          gameCtx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          gameCtx.strokeStyle = '#252733';
          gameCtx.lineWidth = 1;
        }
        
        let tileSize = TILE_SIZE / 4;
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            let tx = x + c * tileSize;
            let ty = y + r * tileSize;
            
            // Subtle slate texture variation
            let hash = (row * 7 + col * 13 + r * 31 + c * 47) % 3;
            if (level === 2) {
              if (hash === 0) gameCtx.fillStyle = '#0a1a0f';
              else if (hash === 1) gameCtx.fillStyle = '#07120a';
              else gameCtx.fillStyle = '#0d2013';
            } else if (level === 3) {
              if (hash === 0) gameCtx.fillStyle = '#1a0a0a';
              else if (hash === 1) gameCtx.fillStyle = '#120707';
              else gameCtx.fillStyle = '#200d0d';
            } else if (level >= 4) {
              if (hash === 0) gameCtx.fillStyle = '#f8fafc';
              else if (hash === 1) gameCtx.fillStyle = '#f1f5f9';
              else gameCtx.fillStyle = '#e2e8f0';
            } else {
              if (hash === 0) gameCtx.fillStyle = '#1d1f28';
              else if (hash === 1) gameCtx.fillStyle = '#171920';
              else gameCtx.fillStyle = '#22242e';
            }
            
            gameCtx.fillRect(tx, ty, tileSize, tileSize);
            gameCtx.strokeRect(tx, ty, tileSize, tileSize);
            
            // Theme decorations on floor
            if (level === 2) {
              // Glowing toxic mushrooms
              let mushroomHash = (row * 17 + col * 31 + r * 13 + c * 7) % 25;
              if (mushroomHash === 0) {
                gameCtx.fillStyle = '#22c55e'; // cap
                gameCtx.beginPath();
                gameCtx.arc(tx + tileSize/2, ty + tileSize/2 - 2, 2.5, Math.PI, 0);
                gameCtx.fill();
                gameCtx.fillStyle = '#e2e8f0'; // stem
                gameCtx.fillRect(tx + tileSize/2 - 0.75, ty + tileSize/2 - 2, 1.5, 3);
              }
            } else if (level === 3) {
              // Lava cracks
              let lavaHash = (row * 13 + col * 19 + r * 7 + c * 3) % 18;
              if (lavaHash === 0) {
                gameCtx.strokeStyle = '#ef4444';
                gameCtx.lineWidth = 1.2;
                gameCtx.beginPath();
                gameCtx.moveTo(tx + 2, ty + tileSize - 2);
                gameCtx.lineTo(tx + tileSize - 2, ty + 2);
                gameCtx.stroke();
              }
            } else if (level >= 4) {
              // Royal red carpet pattern
              let carpetHash = (row * 3 + col * 7) % 5;
              if (carpetHash === 0 && cell === 0) {
                gameCtx.fillStyle = '#7f1d1d';
                gameCtx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
                gameCtx.strokeStyle = '#eab308';
                gameCtx.lineWidth = 0.5;
                gameCtx.strokeRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
              }
            } else {
              // Aged stone cracks
              let crackHash = (row * 9 + col * 17 + r * 5 + c * 11) % 18;
              if (crackHash === 0) {
                gameCtx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
                gameCtx.beginPath();
                gameCtx.moveTo(tx + 4, ty + 4);
                gameCtx.lineTo(tx + 12, ty + 13);
                gameCtx.lineTo(tx + 18, ty + 15);
                gameCtx.stroke();
              }
            }
          }
        }
      }
    }
  }

  // Draw Raycasted Shadows from Columns (cell === 2)
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (MAP_DATA[row][col] === 2) {
        let cx = col * TILE_SIZE + TILE_SIZE / 2;
        let cy = row * TILE_SIZE + TILE_SIZE / 2;
        let d = Math.hypot(cx - player.x, cy - player.y);
        
        if (d < lightRad && d > 10) {
          let R = 27; // column physical radius
          let dx = cx - player.x;
          let dy = cy - player.y;
          
          // Perpendicular tangent vector
          let px = -dy / d;
          let py = dx / d;
          
          let p1x = cx + R * px;
          let p1y = cy + R * py;
          let p2x = cx - R * px;
          let p2y = cy - R * py;
          
          let d1x = p1x - player.x;
          let d1y = p1y - player.y;
          let len1 = Math.hypot(d1x, d1y);
          let p1_ext_x = p1x + (d1x / len1) * 900;
          let p1_ext_y = p1y + (d1y / len1) * 900;
          
          let d2x = p2x - player.x;
          let d2y = p2y - player.y;
          let len2 = Math.hypot(d2x, d2y);
          let p2_ext_x = p2x + (d2x / len2) * 900;
          let p2_ext_y = p2y + (d2y / len2) * 900;
          
          // Draw shadow polygon on floor
          gameCtx.fillStyle = 'rgba(3, 3, 5, 0.85)';
          gameCtx.beginPath();
          gameCtx.moveTo(p1x, p1y);
          gameCtx.lineTo(p2x, p2y);
          gameCtx.lineTo(p2_ext_x, p2_ext_y);
          gameCtx.lineTo(p1_ext_x, p1_ext_y);
          gameCtx.closePath();
          gameCtx.fill();
        }
      }
    }
  }

  // Draw Acid Puddles
  if (typeof acidPuddles !== 'undefined') {
    for (let puddle of acidPuddles) {
      let alpha = Math.min(0.65, puddle.life / 40);
      gameCtx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
      gameCtx.strokeStyle = `rgba(74, 222, 128, ${alpha})`;
      gameCtx.lineWidth = 1.5;
      
      gameCtx.beginPath();
      let timeFactor = Date.now() * 0.003;
      let r1 = puddle.size * (0.9 + Math.sin(timeFactor) * 0.05);
      let r2 = puddle.size * 0.75 * (0.9 + Math.cos(timeFactor + 1) * 0.05);
      gameCtx.ellipse(puddle.x, puddle.y, r1, r2, timeFactor * 0.1, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.stroke();
      
      // Bubbling
      gameCtx.fillStyle = `rgba(187, 247, 208, ${alpha * 0.8})`;
      for (let k = 0; k < 3; k++) {
        let bx = puddle.x + Math.sin(timeFactor + k * 2) * (puddle.size * 0.5);
        let by = puddle.y + Math.cos(timeFactor * 0.85 + k * 1.5) * (puddle.size * 0.4);
        let bSize = 1.5 + Math.sin(timeFactor * 2.5 + k) * 0.8;
        if (bSize > 0.5) {
          gameCtx.beginPath();
          gameCtx.arc(bx, by, bSize, 0, Math.PI * 2);
          gameCtx.fill();
        }
      }
    }
  }

  // ==========================================
  // PASS 2: WALLS, PILLARS, AND ENTITIES
  // ==========================================
  
  // Chests Models
  for (let ch of chests) {
    if (ch.open) {
      if (ch.isRoyal) {
        gameCtx.fillStyle = '#78350f'; 
        gameCtx.fillRect(ch.x - 18, ch.y - 2, 36, 14);
        
        let coinGlow = 18 + Math.sin(Date.now() * 0.01) * 4;
        let grad = gameCtx.createRadialGradient(ch.x, ch.y - 4, 1, ch.x, ch.y - 4, coinGlow);
        grad.addColorStop(0, 'rgba(250, 204, 21, 0.85)');
        grad.addColorStop(1, 'rgba(250, 204, 21, 0.0)');
        gameCtx.fillStyle = grad;
        gameCtx.beginPath();
        gameCtx.arc(ch.x, ch.y - 4, coinGlow, 0, Math.PI*2);
        gameCtx.fill();
        
        gameCtx.fillStyle = '#b45309';
        gameCtx.fillRect(ch.x - 18, ch.y - 14, 36, 10);
        gameCtx.fillStyle = '#facc15';
        gameCtx.fillRect(ch.x - 14, ch.y - 14, 4, 10);
        gameCtx.fillRect(ch.x + 10, ch.y - 14, 4, 10);
      } else {
        gameCtx.fillStyle = '#542008'; 
        gameCtx.fillRect(ch.x - 14, ch.y - 2, 28, 12);
        
        let coinGlow = 10 + Math.sin(Date.now() * 0.01) * 3;
        let grad = gameCtx.createRadialGradient(ch.x, ch.y - 4, 1, ch.x, ch.y - 4, coinGlow);
        grad.addColorStop(0, 'rgba(250, 204, 21, 0.7)');
        grad.addColorStop(1, 'rgba(250, 204, 21, 0.0)');
        gameCtx.fillStyle = grad;
        gameCtx.beginPath();
        gameCtx.arc(ch.x, ch.y - 4, coinGlow, 0, Math.PI*2);
        gameCtx.fill();
        
        gameCtx.fillStyle = '#78350f';
        gameCtx.fillRect(ch.x - 14, ch.y - 12, 28, 8);
        gameCtx.fillStyle = '#eab308';
        gameCtx.fillRect(ch.x - 10, ch.y - 12, 3, 8);
        gameCtx.fillRect(ch.x + 7, ch.y - 12, 3, 8);
      }
    } else {
      if (ch.isRoyal) {
        gameCtx.fillStyle = '#b45309'; // Dark gold base
        gameCtx.fillRect(ch.x - 18, ch.y - 10, 36, 20);
        
        gameCtx.fillStyle = '#facc15'; // Bright Gold bands
        gameCtx.fillRect(ch.x - 14, ch.y - 10, 4, 20);
        gameCtx.fillRect(ch.x + 10, ch.y - 10, 4, 20);
        
        gameCtx.fillStyle = '#0f172a';
        gameCtx.fillRect(ch.x - 3, ch.y - 2, 6, 8); // Large lock
      } else {
        gameCtx.fillStyle = '#78350f'; 
        gameCtx.fillRect(ch.x - 14, ch.y - 10, 28, 20);
        
        gameCtx.fillStyle = '#eab308';
        gameCtx.fillRect(ch.x - 10, ch.y - 10, 3, 20);
        gameCtx.fillRect(ch.x + 7, ch.y - 10, 3, 20);
        
        gameCtx.fillStyle = '#0f172a';
        gameCtx.fillRect(ch.x - 2, ch.y - 2, 4, 6);
      }
      
      let d = Math.hypot(ch.x - player.x, ch.y - player.y);
      if (d < 65) {
        gameCtx.fillStyle = '#ffffff';
        gameCtx.font = 'bold 8px Montserrat';
        gameCtx.textAlign = 'center';
        gameCtx.fillText(ch.isRoyal ? "[E] Открыть Королевский Сундук" : "[E] Открыть сундук", ch.x, ch.y - 16);
      }
    }
  }
  
  // Loot items
  for (let item of lootItems) item.draw(gameCtx);
  
  // Relic pickups
  for (let rp of relicPickups) rp.draw(gameCtx);
  
  // Spiral Stairs (transition exit portal)
  if (portal && portal.active) {
    let aliveBosses = bots.filter(b => b.type === 'boss' && b.health > 0).length;
    let isLocked = aliveBosses > 0;
    
    gameCtx.fillStyle = '#1e293b';
    gameCtx.beginPath();
    gameCtx.arc(portal.x, portal.y, 35, 0, Math.PI * 2);
    gameCtx.fill();
    
    // Stone frame (red glow if locked)
    if (isLocked) {
      gameCtx.shadowBlur = 15;
      gameCtx.shadowColor = '#ef4444';
      gameCtx.strokeStyle = '#ef4444';
      gameCtx.lineWidth = 4.0;
    } else {
      gameCtx.strokeStyle = '#475569';
      gameCtx.lineWidth = 3.5;
    }
    gameCtx.stroke();
    gameCtx.shadowBlur = 0; // reset
    
    // Spiral segments
    gameCtx.strokeStyle = isLocked ? '#450a0a' : '#0f172a';
    gameCtx.lineWidth = 2.0;
    for (let k = 0; k < 8; k++) {
      let angle = k * (Math.PI / 4) + (Date.now() * (isLocked ? 0.0001 : 0.0005));
      gameCtx.fillStyle = isLocked ? `rgba(69, 10, 10, ${1 - k * 0.12})` : `rgba(15, 23, 42, ${1 - k * 0.12})`;
      gameCtx.beginPath();
      gameCtx.moveTo(portal.x, portal.y);
      gameCtx.arc(portal.x, portal.y, 35, angle, angle + Math.PI / 4);
      gameCtx.closePath();
      gameCtx.fill();
      gameCtx.stroke();
    }

    if (isLocked) {
      // Draw padlock emoji inside the portal
      gameCtx.fillStyle = '#ef4444';
      gameCtx.font = '16px sans-serif';
      gameCtx.textAlign = 'center';
      gameCtx.textBaseline = 'middle';
      gameCtx.fillText('🔒', portal.x, portal.y);
      gameCtx.textBaseline = 'alphabetic'; // reset
    }
    
    // Draw help text
    let dist = Math.hypot(player.x - portal.x, player.y - portal.y);
    if (dist < 80) {
      if (isLocked) {
        gameCtx.fillStyle = '#f87171';
        gameCtx.font = 'bold 8px Montserrat';
        gameCtx.textAlign = 'center';
        gameCtx.fillText(`Лестница заблокирована! Боссов осталось: ${aliveBosses}`, portal.x, portal.y - 42);
      } else {
        gameCtx.fillStyle = '#ffffff';
        gameCtx.font = 'bold 8px Montserrat';
        gameCtx.textAlign = 'center';
        gameCtx.fillText("Спуститься по винтовой лестнице", portal.x, portal.y - 42);
      }
    }
  }
  
  // Food
  for (let f of food) {
    if (f.type === 'cheese') {
      gameCtx.fillStyle = '#facc15';
      gameCtx.beginPath();
      gameCtx.moveTo(f.x, f.y);
      gameCtx.arc(f.x, f.y, f.size, 0, Math.PI * 1.5);
      gameCtx.closePath();
      gameCtx.fill();
    } else if (f.type === 'potion') {
      gameCtx.fillStyle = '#ef4444';
      gameCtx.beginPath();
      gameCtx.arc(f.x, f.y + 2, f.size - 2, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.fillStyle = '#ffffff';
      gameCtx.fillRect(f.x - 1.5, f.y - 4, 3, 4);
    } else {
      // Bread loaf
      gameCtx.fillStyle = '#b45309';
      gameCtx.beginPath();
      gameCtx.ellipse(f.x, f.y, f.size * 1.35, f.size * 0.9, 0.45, 0, Math.PI * 2);
      gameCtx.fill();
      
      gameCtx.strokeStyle = '#d97706';
      gameCtx.lineWidth = 1.0;
      gameCtx.beginPath();
      gameCtx.moveTo(f.x - 3, f.y - 2);
      gameCtx.lineTo(f.x - 1, f.y + 2);
      gameCtx.moveTo(f.x, f.y - 2);
      gameCtx.lineTo(f.x + 2, f.y + 2);
      gameCtx.stroke();
    }
  }
  
  // Fireballs
  for (let fb of fireballs) {
    gameCtx.fillStyle = '#ff6a00';
    gameCtx.shadowBlur = 10;
    gameCtx.shadowColor = '#ff6a00';
    gameCtx.beginPath();
    gameCtx.arc(fb.x, fb.y, fb.size, 0, Math.PI * 2);
    gameCtx.fill();
    gameCtx.shadowBlur = 0;
  }

  // Flying Acid Flasks
  if (typeof acidFlasks !== 'undefined') {
    for (let f of acidFlasks) {
      let t = f.maxLife - f.life;
      let ratio = Math.max(0, Math.min(1, t / f.maxLife));
      let arcY = f.y - Math.sin(ratio * Math.PI) * 45;
      let angle = ratio * Math.PI * 4;
      
      gameCtx.save();
      gameCtx.translate(f.x, arcY);
      gameCtx.rotate(angle);
      
      gameCtx.fillStyle = '#22c55e';
      gameCtx.strokeStyle = '#e2e8f0';
      gameCtx.lineWidth = 1.5;
      gameCtx.shadowBlur = 5;
      gameCtx.shadowColor = '#22c55e';
      
      gameCtx.beginPath();
      gameCtx.arc(0, 3, 5, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.stroke();
      gameCtx.shadowBlur = 0;
      
      gameCtx.fillStyle = '#e2e8f0';
      gameCtx.fillRect(-1.5, -5, 3, 5);
      gameCtx.fillStyle = '#78350f';
      gameCtx.fillRect(-2.0, -7, 4, 2);
      
      gameCtx.restore();
    }
  }

  // Walls and Pillars (rendered on top of shadows)
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      let cell = MAP_DATA[row][col];
      let x = col * TILE_SIZE;
      let y = row * TILE_SIZE;
      
      if (cell === 1) {
        // Brick walls (themed colors)
        if (level === 2) gameCtx.fillStyle = '#102214'; // lock/moss green wall
        else if (level === 3) gameCtx.fillStyle = '#221010'; // obsidian/lavic wall
        else if (level >= 4) gameCtx.fillStyle = '#2d2613'; // golden wall
        else gameCtx.fillStyle = '#333545'; // standard gray wall (brightened slightly for visibility)
        
        gameCtx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        
        let rowH = TILE_SIZE / 4;
        let brickW = TILE_SIZE / 2;
        gameCtx.strokeStyle = level === 2 ? '#08120a' : level === 3 ? '#100505' : level >= 4 ? '#181206' : '#1d1f2b';
        gameCtx.lineWidth = 2.0;
        
        for (let r = 0; r < 4; r++) {
          let ty = y + r * rowH;
          gameCtx.beginPath();
          gameCtx.moveTo(x, ty);
          gameCtx.lineTo(x + TILE_SIZE, ty);
          gameCtx.stroke();
          
          let offset = (r % 2) * (brickW / 2);
          for (let bx = -brickW; bx <= TILE_SIZE + brickW; bx += brickW) {
            let cx = x + bx + offset;
            if (cx >= x && cx <= x + TILE_SIZE) {
              gameCtx.beginPath();
              gameCtx.moveTo(cx, ty);
              gameCtx.lineTo(cx, ty + rowH);
              gameCtx.stroke();
            }
          }
        }
        
        gameCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        gameCtx.lineWidth = 1;
        for (let r = 0; r < 4; r++) {
          let ty = y + r * rowH;
          let offset = (r % 2) * (brickW / 2);
          for (let bx = -brickW; bx <= TILE_SIZE + brickW; bx += brickW) {
            let cx = x + bx + offset;
            if (cx >= x && cx < x + TILE_SIZE) {
              gameCtx.beginPath();
              gameCtx.moveTo(cx + 2, ty + 2);
              gameCtx.lineTo(cx + brickW - 2, ty + 2);
              gameCtx.stroke();
            }
          }
        }
        
        gameCtx.strokeStyle = level === 2 ? '#0b160e' : level === 3 ? '#140a0a' : level >= 4 ? '#1d170b' : '#111218';
        gameCtx.lineWidth = 1.5;
        gameCtx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        
      } else if (cell === 2) {
        // Massive Pillars
        let cx = x + TILE_SIZE / 2;
        let cy = y + TILE_SIZE / 2;
        
        // Base plinth
        gameCtx.fillStyle = level === 2 ? '#1b2c1f' : level === 3 ? '#2c1b1b' : level >= 4 ? '#3f3821' : '#262835';
        gameCtx.strokeStyle = level === 2 ? '#0a120c' : level === 3 ? '#120a0a' : level >= 4 ? '#1c160b' : '#0c0d12';
        gameCtx.lineWidth = 2.0;
        
        gameCtx.beginPath();
        gameCtx.arc(cx, cy, 38, 0, Math.PI * 2);
        gameCtx.fill();
        gameCtx.stroke();
        
        // Secondary base
        gameCtx.fillStyle = level === 2 ? '#102214' : level === 3 ? '#221010' : level >= 4 ? '#2d2613' : '#1c1e28';
        gameCtx.beginPath();
        gameCtx.arc(cx, cy, 32, 0, Math.PI * 2);
        gameCtx.fill();
        gameCtx.stroke();
        
        // Main shaft gradient
        let colGrad = gameCtx.createRadialGradient(cx - 7, cy - 7, 3, cx, cy, 27);
        if (level === 2) {
          colGrad.addColorStop(0, '#22c55e'); 
          colGrad.addColorStop(0.6, '#0f2c18'); 
          colGrad.addColorStop(1, '#051008');
        } else if (level === 3) {
          colGrad.addColorStop(0, '#ef4444'); 
          colGrad.addColorStop(0.6, '#2d0f0f'); 
          colGrad.addColorStop(1, '#100505');
        } else if (level >= 4) {
          colGrad.addColorStop(0, '#fbbf24'); 
          colGrad.addColorStop(0.6, '#3d3013'); 
          colGrad.addColorStop(1, '#171205');
        } else {
          colGrad.addColorStop(0, '#383d4f'); 
          colGrad.addColorStop(0.6, '#181922'); 
          colGrad.addColorStop(1, '#090a0d');
        }
        
        gameCtx.fillStyle = colGrad;
        gameCtx.beginPath();
        gameCtx.arc(cx, cy, 27, 0, Math.PI * 2);
        gameCtx.fill();
        gameCtx.stroke();
        
        // Grooves
        gameCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        gameCtx.lineWidth = 1.5;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          let sx = cx + Math.cos(a) * 19;
          let sy = cy + Math.sin(a) * 19;
          let ex = cx + Math.cos(a) * 26;
          let ey = cy + Math.sin(a) * 26;
          gameCtx.beginPath();
          gameCtx.moveTo(sx, sy);
          gameCtx.lineTo(ex, ey);
          gameCtx.stroke();
        }
      }
    }
  }

  // Torches (themed flames)
  for (let t of torches) {
    let glow = 80 + Math.sin(Date.now() * 0.009) * 15;
    let radGrad = gameCtx.createRadialGradient(t.x, t.y, 2, t.x, t.y, glow);
    let torchColorStr = level === 2 ? '34, 197, 94' : level === 3 ? '168, 85, 247' : level >= 4 ? '240, 246, 252' : '255, 110, 0';
    radGrad.addColorStop(0, `rgba(${torchColorStr}, 0.25)`);
    radGrad.addColorStop(0.5, `rgba(${torchColorStr}, 0.06)`);
    radGrad.addColorStop(1, `rgba(${torchColorStr}, 0.0)`);
    gameCtx.fillStyle = radGrad;
    gameCtx.beginPath();
    gameCtx.arc(t.x, t.y, glow, 0, Math.PI * 2);
    gameCtx.fill();
    
    // Bracket
    gameCtx.fillStyle = '#1e293b';
    gameCtx.fillRect(t.x - 3, t.y - 2, 6, 12);
    gameCtx.fillStyle = '#475569';
    gameCtx.fillRect(t.x - 5, t.y - 4, 10, 3);
    
    let time = Date.now();
    let pulseX = Math.sin(time * 0.015) * 1.0;
    let pulseY = Math.sin(time * 0.02) * 1.5;
    
    // Flickering flames
    if (level === 2) {
      // Acid green flame
      gameCtx.fillStyle = '#16a34a';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x + pulseX, t.y - 5, 4.5, 7.5 + pulseY, 0, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.fillStyle = '#4ade80';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x + pulseX * 0.5, t.y - 4, 2.5, 4.5 + pulseY * 0.5, 0, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.fillStyle = '#fffdf5';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x, t.y - 3, 1.2, 2.2, 0, 0, Math.PI * 2);
      gameCtx.fill();
    } else if (level === 3) {
      // Purple void flame
      gameCtx.fillStyle = '#7c3aed';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x + pulseX, t.y - 5, 4.5, 7.5 + pulseY, 0, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.fillStyle = '#c084fc';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x + pulseX * 0.5, t.y - 4, 2.5, 4.5 + pulseY * 0.5, 0, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.fillStyle = '#fffdf5';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x, t.y - 3, 1.2, 2.2, 0, 0, Math.PI * 2);
      gameCtx.fill();
    } else if (level >= 4) {
      // White sacred flame
      gameCtx.fillStyle = '#cbd5e1';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x + pulseX, t.y - 5, 4.5, 7.5 + pulseY, 0, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.fillStyle = '#f8fafc';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x + pulseX * 0.5, t.y - 4, 2.5, 4.5 + pulseY * 0.5, 0, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.fillStyle = '#ffffff';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x, t.y - 3, 1.2, 2.2, 0, 0, Math.PI * 2);
      gameCtx.fill();
    } else {
      // Standard orange flame
      gameCtx.fillStyle = '#ea580c';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x + pulseX, t.y - 5, 4.5, 7.5 + pulseY, 0, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.fillStyle = '#fbbf24';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x + pulseX * 0.5, t.y - 4, 2.5, 4.5 + pulseY * 0.5, 0, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.fillStyle = '#fffdf5';
      gameCtx.beginPath();
      gameCtx.ellipse(t.x, t.y - 3, 1.2, 2.2, 0, 0, Math.PI * 2);
      gameCtx.fill();
    }
    
    if (Math.random() < 0.05) {
      particles.push({
        x: t.x + (Math.random() - 0.5) * 4,
        y: t.y - 8,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.8 - Math.random() * 1.2,
        size: Math.random() * 1.5 + 0.8,
        color: level === 2 ? '#22c55e' : level === 3 ? '#a855f7' : level >= 4 ? '#cbd5e1' : '#f97316',
        life: 15 + Math.random() * 15
      });
    }
  }
  
  // Bots and player
  for (let bot of bots) bot.draw(gameCtx);
  for (let b of drones) b.draw(gameCtx);
  player.draw(gameCtx);
  
  // Darkness fog mask — draw on offscreen canvas to avoid erasing main canvas pixels
  if (!window.lightCanvas) {
    window.lightCanvas = document.createElement('canvas');
    window.lightCtx = window.lightCanvas.getContext('2d');
  }
  if (window.lightCanvas.width !== gameCanvas.width || window.lightCanvas.height !== gameCanvas.height) {
    window.lightCanvas.width = gameCanvas.width;
    window.lightCanvas.height = gameCanvas.height;
  }
  
  let lCtx = window.lightCtx;
  lCtx.fillStyle = 'rgba(3, 3, 5, 0.94)';
  lCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
  
  lCtx.globalCompositeOperation = 'destination-out';
  let cx = gameCanvas.width / 2;
  let cy = gameCanvas.height / 2;
  let screenLightRad = lightRad * zoom;
  
  // Punch light hole for player
  let fogGrad = lCtx.createRadialGradient(cx, cy, screenLightRad * 0.38, cx, cy, screenLightRad);
  fogGrad.addColorStop(0, 'rgba(0,0,0,1)');
  fogGrad.addColorStop(0.65, 'rgba(0,0,0,0.88)');
  fogGrad.addColorStop(1, 'rgba(0,0,0,0)');
  lCtx.fillStyle = fogGrad;
  lCtx.beginPath();
  lCtx.arc(cx, cy, screenLightRad, 0, Math.PI * 2);
  lCtx.fill();
  
  // Punch light holes for torches (aesthetic enhancement)
  for (let t of torches) {
    let tx = (t.x - player.x) * zoom + cx;
    let ty = (t.y - player.y) * zoom + cy;
    let tGlow = (80 + Math.sin(Date.now() * 0.009) * 15) * zoom;
    if (tx >= -tGlow && tx <= gameCanvas.width + tGlow && ty >= -tGlow && ty <= gameCanvas.height + tGlow) {
      let torchGrad = lCtx.createRadialGradient(tx, ty, tGlow * 0.1, tx, ty, tGlow);
      torchGrad.addColorStop(0, 'rgba(0,0,0,0.75)');
      torchGrad.addColorStop(0.5, 'rgba(0,0,0,0.2)');
      torchGrad.addColorStop(1, 'rgba(0,0,0,0)');
      lCtx.fillStyle = torchGrad;
      lCtx.beginPath();
      lCtx.arc(tx, ty, tGlow, 0, Math.PI * 2);
      lCtx.fill();
    }
  }
  
  lCtx.globalCompositeOperation = 'source-over';
  
  // Render the lighting mask onto the main screen
  gameCtx.save();
  gameCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to screen space
  gameCtx.drawImage(window.lightCanvas, 0, 0);
  gameCtx.restore();
  
  // Particles
  for (let p of particles) {
    if (p.isRing) {
      gameCtx.strokeStyle = p.color;
      gameCtx.lineWidth = 2;
      gameCtx.beginPath();
      gameCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      gameCtx.stroke();
    } else if (p.isExclamation) {
      gameCtx.fillStyle = p.color;
      gameCtx.font = 'bold 9px Montserrat';
      gameCtx.textAlign = 'center';
      gameCtx.fillText(p.text || "!", p.x, p.y);
    } else {
      gameCtx.fillStyle = p.color;
      gameCtx.beginPath();
      gameCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      gameCtx.fill();
    }
  }
  
  gameCtx.restore(); // camera end
  
  // ==========================================
  // HUD LAYER: BLACK TRANSITION OVERLAY
  // ==========================================
  if (state.transitionFade > 0) {
    gameCtx.fillStyle = `rgba(0, 0, 0, ${state.transitionFade})`;
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
  }

  // ==========================================
  // HUD LAYER: DYNAMIC CIRCULAR MINIMAP
  // ==========================================
  if (player.health > 0) {
    let mx = gameCanvas.width - 80;
    let my = 80;
    let mr = 60;
    
    gameCtx.save();
    
    // Minimap border
    gameCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    gameCtx.beginPath();
    gameCtx.arc(mx, my, mr, 0, Math.PI * 2);
    gameCtx.fill();
    gameCtx.strokeStyle = '#334155';
    gameCtx.lineWidth = 3;
    gameCtx.stroke();
    
    // Clip contents to circular map
    gameCtx.beginPath();
    gameCtx.arc(mx, my, mr - 2, 0, Math.PI * 2);
    gameCtx.clip();
    
    let cellW = (mr * 2) / GRID_COLS;
    let cellH = (mr * 2) / GRID_ROWS;
    
    // Render floors and pillars
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        let cell = MAP_DATA[r][c];
        if (cell === 0) {
          gameCtx.fillStyle = 'rgba(30, 41, 59, 0.6)';
          gameCtx.fillRect(mx - mr + c * cellW, my - mr + r * cellH, cellW, cellH);
        } else if (cell === 2) {
          gameCtx.fillStyle = '#475569';
          gameCtx.fillRect(mx - mr + c * cellW, my - mr + r * cellH, cellW, cellH);
        }
      }
    }
    
    // Render exit stairs
    if (portal && portal.active) {
      let ptx = mx - mr + (portal.x / (GRID_COLS * TILE_SIZE)) * (mr * 2);
      let pty = my - mr + (portal.y / (GRID_ROWS * TILE_SIZE)) * (mr * 2);
      gameCtx.fillStyle = '#a855f7';
      gameCtx.beginPath();
      gameCtx.arc(ptx, pty, 4, 0, Math.PI * 2);
      gameCtx.fill();
    }
    
    // Render chests
    for (let ch of chests) {
      if (!ch.open) {
        let cx = mx - mr + (ch.x / (GRID_COLS * TILE_SIZE)) * (mr * 2);
        let cy = my - mr + (ch.y / (GRID_ROWS * TILE_SIZE)) * (mr * 2);
        gameCtx.fillStyle = ch.isRoyal ? '#facc15' : '#eab308';
        gameCtx.beginPath();
        gameCtx.arc(cx, cy, 3, 0, Math.PI * 2);
        gameCtx.fill();
      }
    }
    
    // Render creatures and bosses
    for (let bot of bots) {
      let bx = mx - mr + (bot.x / (GRID_COLS * TILE_SIZE)) * (mr * 2);
      let by = my - mr + (bot.y / (GRID_ROWS * TILE_SIZE)) * (mr * 2);
      if (bot.type === 'boss') {
        let pulse = 4.5 + Math.sin(Date.now() * 0.012) * 1.5;
        gameCtx.fillStyle = '#f59e0b';
        gameCtx.beginPath();
        gameCtx.arc(bx, by, pulse, 0, Math.PI * 2);
        gameCtx.fill();
        gameCtx.strokeStyle = '#ef4444';
        gameCtx.lineWidth = 1.2;
        gameCtx.stroke();
      } else if (bot.type !== 'rat') {
        gameCtx.fillStyle = '#ef4444';
        gameCtx.beginPath();
        gameCtx.arc(bx, by, 2.5, 0, Math.PI * 2);
        gameCtx.fill();
      }
    }
    
    // Render player
    let px = mx - mr + (player.x / (GRID_COLS * TILE_SIZE)) * (mr * 2);
    let py = my - mr + (player.y / (GRID_ROWS * TILE_SIZE)) * (mr * 2);
    gameCtx.fillStyle = '#22c55e';
    gameCtx.beginPath();
    gameCtx.arc(px, py, 4, 0, Math.PI * 2);
    gameCtx.fill();
    
    gameCtx.restore();
  }
}

// ==========================================
// RENDER BIO-RADAR
// ==========================================
let radarSweepAngle = 0;

function drawBrainGraph() {
  if (!brainCtx || !player) return;
  
  brainCtx.clearRect(0, 0, brainCanvas.width, brainCanvas.height);
  
  let w = brainCanvas.width;
  let h = brainCanvas.height;
  let cx = w / 2;
  let cy = h / 2;
  let maxRadarDist = 200; // Distance mapped to the edge of the radar
  let radarRadius = Math.min(w, h) * 0.45;
  
  // 1. Draw Radar Background
  brainCtx.shadowBlur = 0; // Clear shadow
  
  // Concentric grid circles
  brainCtx.strokeStyle = 'rgba(249, 115, 22, 0.15)'; // Orange accent color matching the style
  brainCtx.lineWidth = 1;
  for (let r = 0.25; r <= 1.0; r += 0.25) {
    brainCtx.beginPath();
    brainCtx.arc(cx, cy, radarRadius * r, 0, Math.PI * 2);
    brainCtx.stroke();
    
    // Tiny distance labels
    if (r < 1.0) {
      brainCtx.fillStyle = 'rgba(249, 115, 22, 0.4)';
      brainCtx.font = '8px Share Tech Mono';
      brainCtx.textAlign = 'center';
      brainCtx.fillText(Math.round(maxRadarDist * r) + "m", cx, cy - radarRadius * r + 9);
    }
  }
  
  // Crosshairs
  brainCtx.beginPath();
  brainCtx.moveTo(cx - radarRadius, cy);
  brainCtx.lineTo(cx + radarRadius, cy);
  brainCtx.moveTo(cx, cy - radarRadius);
  brainCtx.lineTo(cx, cy + radarRadius);
  brainCtx.stroke();
  
  // Outer ring
  brainCtx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
  brainCtx.lineWidth = 2;
  brainCtx.beginPath();
  brainCtx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
  brainCtx.stroke();
  
  // 2. Draw Scanning Sweep Line and Trail
  radarSweepAngle += 0.04;
  if (radarSweepAngle > Math.PI * 2) radarSweepAngle -= Math.PI * 2;
  
  // Sweep trail
  let trailSegments = 30;
  for (let i = 0; i < trailSegments; i++) {
    let alpha = (1 - (i / trailSegments)) * 0.15;
    let angle = radarSweepAngle - (i * 0.02);
    brainCtx.strokeStyle = `rgba(249, 115, 22, ${alpha})`;
    brainCtx.lineWidth = 1.5;
    brainCtx.beginPath();
    brainCtx.moveTo(cx, cy);
    brainCtx.lineTo(cx + Math.cos(angle) * radarRadius, cy + Math.sin(angle) * radarRadius);
    brainCtx.stroke();
  }
  
  // Lead sweep line
  brainCtx.strokeStyle = 'rgba(251, 146, 60, 0.8)';
  brainCtx.lineWidth = 2;
  brainCtx.beginPath();
  brainCtx.moveTo(cx, cy);
  brainCtx.lineTo(cx + Math.cos(radarSweepAngle) * radarRadius, cy + Math.sin(radarSweepAngle) * radarRadius);
  brainCtx.stroke();
  
  // 3. Draw Objects (Relative to Player)
  let detectedCount = 0;
  let closestEnemyDist = Infinity;
  let closestEnemyName = "Не обнаружено";
  
  // Function to convert absolute position to relative radar coordinates (North is Up)
  function getRadarCoords(objX, objY) {
    let dx = objX - player.x;
    let dy = objY - player.y;
    let dist = Math.hypot(dx, dy);
    
    // North is Up, East is Right
    let angleToObj = Math.atan2(dy, dx);
    
    if (dist <= maxRadarDist) {
      let rDist = (dist / maxRadarDist) * radarRadius;
      return {
        x: cx + Math.cos(angleToObj) * rDist,
        y: cy + Math.sin(angleToObj) * rDist,
        dist: dist,
        inRadar: true
      };
    }
    return { inRadar: false, dist: dist };
  }
  
  // Draw Food (Green)
  if (typeof food !== 'undefined') {
    for (let f of food) {
      let rc = getRadarCoords(f.x, f.y);
      if (rc.inRadar) {
        detectedCount++;
        brainCtx.fillStyle = '#22c55e';
        brainCtx.shadowColor = '#22c55e';
        brainCtx.shadowBlur = 4;
        brainCtx.beginPath();
        brainCtx.arc(rc.x, rc.y, 3, 0, Math.PI * 2);
        brainCtx.fill();
      }
    }
  }
  
  // Draw Chests (Gold)
  if (typeof chests !== 'undefined') {
    for (let ch of chests) {
      if (!ch.open) {
        let rc = getRadarCoords(ch.x, ch.y);
        if (rc.inRadar) {
          detectedCount++;
          brainCtx.fillStyle = '#eab308';
          brainCtx.shadowColor = '#eab308';
          brainCtx.shadowBlur = 4;
          brainCtx.beginPath();
          brainCtx.arc(rc.x, rc.y, 4, 0, Math.PI * 2);
          brainCtx.fill();
        }
      }
    }
  }
  
  // Draw Relics and Loot
  if (typeof relicPickups !== 'undefined') {
    for (let rp of relicPickups) {
      let rc = getRadarCoords(rp.x, rp.y);
      if (rc.inRadar) {
        detectedCount++;
        brainCtx.fillStyle = '#eab308';
        brainCtx.shadowColor = '#eab308';
        brainCtx.shadowBlur = 4;
        brainCtx.beginPath();
        brainCtx.arc(rc.x, rc.y, 4, 0, Math.PI * 2);
        brainCtx.fill();
      }
    }
  }
  if (typeof lootItems !== 'undefined') {
    for (let item of lootItems) {
      let rc = getRadarCoords(item.x, item.y);
      if (rc.inRadar) {
        detectedCount++;
        brainCtx.fillStyle = '#eab308';
        brainCtx.shadowColor = '#eab308';
        brainCtx.shadowBlur = 4;
        brainCtx.beginPath();
        brainCtx.arc(rc.x, rc.y, 3, 0, Math.PI * 2);
        brainCtx.fill();
      }
    }
  }
  
  // Draw Enemies (Red)
  if (typeof bots !== 'undefined') {
    for (let bot of bots) {
      if (bot.health > 0) {
        let rc = getRadarCoords(bot.x, bot.y);
        if (rc.dist < closestEnemyDist) {
          closestEnemyDist = rc.dist;
          closestEnemyName = `${bot.type.toUpperCase()} (${Math.round(rc.dist)}m)`;
        }
        if (rc.inRadar) {
          detectedCount++;
          brainCtx.fillStyle = '#ef4444';
          brainCtx.shadowColor = '#ef4444';
          brainCtx.shadowBlur = 5;
          brainCtx.beginPath();
          brainCtx.arc(rc.x, rc.y, bot.type === 'boss' ? 5.5 : 3.5, 0, Math.PI * 2);
          brainCtx.fill();
        }
      }
    }
  }
  
  // Reset shadow
  brainCtx.shadowBlur = 0;
  
  // Draw Player Marker in Center (rotated by player.angle)
  brainCtx.save();
  brainCtx.translate(cx, cy);
  brainCtx.rotate(player.angle);
  
  brainCtx.fillStyle = '#ffffff';
  brainCtx.strokeStyle = '#f97316';
  brainCtx.lineWidth = 1.5;
  brainCtx.beginPath();
  // Drawing pointing to the right (which represents 0 radians)
  brainCtx.moveTo(6, 0);
  brainCtx.lineTo(-5, -5);
  brainCtx.lineTo(-2, 0);
  brainCtx.lineTo(-5, 5);
  brainCtx.closePath();
  brainCtx.fill();
  brainCtx.stroke();
  brainCtx.restore();
  
  // 4. Update Telemetry UI
  let elCoords = document.getElementById('tel-coords');
  let elThreat = document.getElementById('tel-threat');
  let elObjects = document.getElementById('tel-objects');
  
  if (elCoords) {
    elCoords.innerText = `X: ${Math.round(player.x)}, Y: ${Math.round(player.y)}`;
  }
  if (elThreat) {
    elThreat.innerText = closestEnemyName;
    if (closestEnemyDist < 120) {
      elThreat.style.color = '#ef4444';
    } else {
      elThreat.style.color = '#ffa852';
    }
  }
  if (elObjects) {
    elObjects.innerText = detectedCount;
  }
}

// ==========================================
// UPGRADES STATS LOGIC
// ==========================================
function upgradeStat(type) {
  synth.init();
  if (player.health <= 0 || !gameActive) return;
  
  let cost = UPGRADE_COSTS[type] + player.statLevels[type] * 15;
  if (state.gold >= cost) {
    state.gold -= cost;
    player.statLevels[type]++;
    
    player.applyPlayerGenes();
    
    if (type === 'hp') {
      let oldMax = player.maxHealth;
      player.applyPlayerGenes();
      let diff = player.maxHealth - oldMax;
      player.health = Math.min(player.maxHealth, player.health + diff);
      logRow(`Характеристика ЖИВУЧЕСТЬ повышена! Макс. здоровье увеличен: ${player.maxHealth} HP.`, "gain");
    } else if (type === 'speed') {
      logRow(`Характеристика МЫШЦЫ повышена! Существо ускорилось до ${(player.speed * 100).toFixed(0)}.`, "gain");
    } else if (type === 'damage') {
      logRow(`Характеристика ЧЕЛЮСТИ повышена! Сила укуса увеличилась до ${player.damage} DP.`, "gain");
    } else if (type === 'vision') {
      logRow(`Характеристика АУРА СВЕТА повышена!  Радиус обзора увеличен: ${player.visionRadius}px.`, "gain");
    }
    
    synth.playMutate();
    updateHUD();
  }
}

// ==========================================
// TELEMETRY SYNC
// ==========================================
function updateHUD() {
  if (!player) return;
  
  // Health & Satiety progress
  document.getElementById('val-health').innerText = `${player.health.toFixed(0)} / ${player.maxHealth.toFixed(0)}`;
  document.getElementById('bar-health').style.width = `${(player.health / player.maxHealth) * 100}%`;
  
  document.getElementById('val-energy').innerText = `${player.energy.toFixed(0)} / ${player.maxEnergy.toFixed(0)}`;
  document.getElementById('bar-energy').style.width = `${(player.energy / player.maxEnergy) * 100}%`;
  
  document.getElementById('val-evolve').innerText = `${player.evolveProgress.toFixed(0)}%`;
  document.getElementById('bar-evolve').style.width = `${player.evolveProgress}%`;
  
  document.getElementById('dna-points').innerText = state.dna;
  let goldPointsEl = document.getElementById('gold-points');
  if (goldPointsEl) goldPointsEl.innerText = state.gold;
  let crystalEl = document.getElementById('crystal-points');
  if (crystalEl) crystalEl.innerText = state.crystals;
  
  // Apply cosmetic skin tint to player glowColor
  if (player) {
    if (state.activeSkin === 'skin_ice') { player.glowColor = '#7dd3fc'; player.color = '#bfdbfe'; }
    else if (state.activeSkin === 'skin_fire') { player.glowColor = '#f97316'; player.color = '#fbbf24'; }
    else if (state.activeSkin === 'skin_shadow') { player.glowColor = '#a855f7'; player.color = '#4c1d95'; }
    else { player.glowColor = '#00f0ff'; player.color = '#00f0ff'; }
  }
  
  // Evolution Stage details
  let stageConfig = STAGES[state.stage];
  document.getElementById('current-era-title').innerText = stageConfig.title;
  document.getElementById('creature-stage').innerText = stageConfig.stage;
  
  // Real-time specs
  document.getElementById('spec-size').innerText = `${player.sizeScale.toFixed(2)}x`;
  document.getElementById('spec-speed').innerText = (player.speed * 100).toFixed(0);
  document.getElementById('spec-armor').innerText = `${(player.armor * 100).toFixed(0)}%`;
  
  let dmgVal = state.genes.shh ? `${player.damage} DP (Fire Spit)` : `${player.damage} DP (Bite)`;
  document.getElementById('spec-damage').innerText = dmgVal;
  
  document.getElementById('spec-vision').innerText = `${player.visionRadius}px`;
  document.getElementById('spec-drones').innerText = `${drones.length} / ${state.genes.foxp2 ? 2 : 0}`;
  
  // Dungeon Report
  document.getElementById('eco-guards').innerText = state.guardsDefeated;
  document.getElementById('eco-gold').innerText = state.gold;
  document.getElementById('eco-generation').innerText = state.generation;
  if (document.getElementById('eco-level')) {
    document.getElementById('eco-level').innerText = state.level;
  }
  document.getElementById('eco-count').innerText = bots.length + 1;
  
  // Update synergies panel
  updateSynergiesHUD();
  
  // Flash evolve button
  let btnEvolve = document.getElementById('btn-evolve');
  if (player.evolveProgress >= 100 && state.stage < 4) {
    btnEvolve.classList.remove('hidden');
  } else {
    btnEvolve.classList.add('hidden');
  }
  
  let types = ['hp', 'speed', 'damage', 'vision'];
  types.forEach(t => {
    let cost = UPGRADE_COSTS[t] + player.statLevels[t] * 15;
    let costSpan = document.getElementById(`upg-cost-${t}`);
    if (costSpan) costSpan.innerText = cost;
    
    // Disable/Enable buttons dynamically based on gold
    let btn = costSpan.parentElement;
    if (btn) {
      if (state.gold < cost) {
        btn.disabled = true;
      } else {
        btn.disabled = false;
      }
    }
  });
  
  // DNA Matrix Grid coloring
  let geneIds = ['rubisco', 'cox1', 'ldha', 'col1a1', 'acta1', 'chit1', 'shh', 'opn1lw', 'mbp', 'foxp2'];
  geneIds.forEach(id => {
    let el = document.getElementById(`gene-${id}`);
    if (el) {
      let costEl = el.querySelector('.gene-cost');
      if (costEl) {
        costEl.innerText = `${GENE_CATALOG[id].cost} ДНК`;
      }
      if (state.genes[id]) {
        el.className = 'gene-item purchased';
      } else if (state.dna < GENE_CATALOG[id].cost) {
        el.className = 'gene-item unaffordable';
      } else {
        el.className = 'gene-item';
      }
    }
  });
  
  // Light area warning banners
  let nearTorch = false;
  for (let t of torches) {
    if (Math.hypot(player.x - t.x, player.y - t.y) < 130) {
      nearTorch = true;
      break;
    }
  }
  
  let bannerT = document.getElementById('sun-banner');
  if (state.genes.rubisco && nearTorch) {
    bannerT.classList.remove('hidden');
  } else {
    bannerT.classList.add('hidden');
  }
  
  let bannerK = document.getElementById('vent-banner');
  if (player.y > 1400) {
    bannerK.classList.remove('hidden');
  } else {
    bannerK.classList.add('hidden');
  }
  
  // Relics HUD update
  let relicsContainer = document.getElementById('creature-relics');
  if (relicsContainer) {
    relicsContainer.innerHTML = '';
    let hasAny = false;
    
    let names = {
      crown: { icon: '👑', name: 'Корона Силы', desc: '+50% к урону' },
      shield: { icon: '🛡️', name: 'Щит Титана', desc: '+25% к броне' },
      boots: { icon: '🥾', name: 'Сапоги Ветра', desc: '+40% к скорости' },
      elixir: { icon: '🧪', name: 'Эликсир Жизни', desc: '+40% макс HP, регенерация HP' },
      ring: { icon: '⚡', name: 'Грозовое Кольцо', desc: '+50 макс энергии, регенерация энергии' },
      amulet: { icon: '🧿', name: 'Сердце Пустоты', desc: '+50% к сбору золота и ДНК' }
    };
    
    for (let r in state.relics) {
      if (state.relics[r]) {
        hasAny = true;
        let item = document.createElement('div');
        item.className = 'relic-icon-hud';
        item.innerHTML = names[r].icon;
        item.title = `${names[r].name}: ${names[r].desc}`;
        relicsContainer.appendChild(item);
      }
    }
    
    if (!hasAny) {
      relicsContainer.innerHTML = '<span id="no-relics-text" style="color: var(--text-muted); font-size: 11px;">Нет реликвий</span>';
    }
  }
}

const GENE_CATALOG = {
  rubisco: {
    name: 'RuBisCO (Углеродная фиксация)',
    fact: 'Древнейший растительный фермент. В фантастическом контексте позволяет усваивать тепловую энергию горения.',
    bonus: 'Светосинтез: стоя близко к горящим настенным факелам, существо греется и восстанавливает Сытость (+0.18 ед/кадр).',
    cost: 160
  },
  cox1: {
    name: 'COX1 (Митохондрии / Аэробное дыхание)',
    fact: 'Позволяет эффективно генерировать молекулы АТФ. Существенно снижает утомляемость мышц.',
    bonus: 'Выносливость: расход энергии на перемещение снижен на 45%. Регенерация здоровья ускорена.',
    cost: 220
  },
  ldha: {
    name: 'LDHA (Гликолиз / Спринт)',
    fact: 'Фермент быстрого расщепления сахаров при взрывных нагрузках без кислорода.',
    bonus: 'Сверх-Рывок (Даш): увеличивает дальность и скорость спринта, уменьшая время перезарядки (Space).',
    cost: 150
  },
  col1a1: {
    name: 'COL1A1 (Коллаген / Структурный каркас)',
    fact: 'Формирует прочные нити соединительных тканей. Необходим для удерживания многоклеточных масс.',
    bonus: 'Морфогенетический объем: существо получает +2 сегмента тела, увеличивается на 35% и приобретает +50 максимального здоровья.',
    cost: 240
  },
  acta1: {
    name: 'ACTA1 (Актин / Сократительные волокна)',
    fact: 'Формирует скелетные мышечные волокна для механического сгибания конечностей.',
    bonus: 'Мышечная подвижность: общая скорость перемещения увеличивается на 40%.',
    cost: 200
  },
  chit1: {
    name: 'CHIT1 (Кератин / Хитиновая чешуя)',
    fact: 'Служит защитным экзоскелетом у членистоногих и чешуйчатых рептилий.',
    bonus: 'Чешуйчатый доспех: блокирует 40% урона от мечей рыцарей. Вокруг сегментов существа отрисовываются щитки.',
    cost: 280
  },
  shh: {
    name: 'SHH (Sonic Hedgehog / Claws & Fangs)',
    fact: 'Белок эмбрионального развития. Координирует рост когтей, клыков и желез.',
    bonus: 'Огненный плевок: на стадиях «Зверь» и «Дракон» заменяет клик мыши на дальнобойный выстрел огненным шаром (урон 35 стражу).',
    cost: 350
  },
  opn1lw: {
    name: 'OPN1LW (Опсин / Кошачий глаз)',
    fact: 'Обеспечивает зрение в темных спектрах за счет улавливания рассеянных фотонов.',
    bonus: 'Кошачье зрение: убирает темноту подземелий вокруг существа (увеличивает радиус света вдвое) и отдаляет камеру на 25%.',
    cost: 180
  },
  mbp: {
    name: 'MBP (Миелин / Нервная скорость)',
    fact: 'Обеспечивает высокую скорость проводимости импульсов по аксонам нервной системы.',
    bonus: 'Умный автопилот: нейросеть получает 2 дополнительных скрытых узла, повышая точность навигации по коридорам.',
    cost: 250
  },
  foxp2: {
    name: 'FOXP2 (Социальная коммуникация)',
    fact: 'Регулирует речевые и когнические связи у животных.',
    bonus: 'Рой нетопырей: призывает двух ручных летучих мышей, которые летают рядом, собирают ДНК-мох и приносят ресурсы хозяину.',
    cost: 450
  }
};

// ==========================================
// SYNERGIES MODALS & DATA
// ==========================================
function openSynergiesModal() {
  let fireKnightActive = state.genes.shh && state.genes.rubisco;
  let toxicRogueActive = state.genes.ldha && state.genes.chit1;
  let feralOverlordActive = state.genes.col1a1 && state.genes.acta1;
  let swarmLordActive = state.genes.foxp2 && state.genes.mbp && state.genes.opn1lw;

  updateSynergyUI('syn-status-fire-knight', fireKnightActive);
  updateSynergyUI('syn-status-toxic-rogue', toxicRogueActive);
  updateSynergyUI('syn-status-feral-overlord', feralOverlordActive);
  updateSynergyUI('syn-status-swarm-lord', swarmLordActive);

  document.getElementById('synergies-modal').style.display = 'flex';
  synth.init();
}

function updateSynergyUI(elementId, isActive) {
  let el = document.getElementById(elementId);
  if (!el) return;
  if (isActive) {
    el.innerText = "АКТИВЕН";
    el.style.color = "#22c55e"; // bright green
  } else {
    el.innerText = "НЕАКТИВЕН";
    el.style.color = "#ef4444"; // bright red
  }
}

function closeSynergiesModal() {
  document.getElementById('synergies-modal').style.display = 'none';
}

function updateSynergiesHUD() {
  let container = document.getElementById('creature-synergies');
  if (!container) return;
  
  container.innerHTML = '';
  let active = [];
  
  if (state.genes.shh && state.genes.rubisco) {
    active.push({ name: '🔥 Огненный Рыцарь', desc: 'Fire Knight' });
  }
  if (state.genes.ldha && state.genes.chit1) {
    active.push({ name: '🤢 Ядовитый Разбойник', desc: 'Toxic Rogue' });
  }
  if (state.genes.col1a1 && state.genes.acta1) {
    active.push({ name: '🐺 Хищный Мастер', desc: 'Feral Overlord' });
  }
  if (state.genes.foxp2 && state.genes.mbp && state.genes.opn1lw) {
    active.push({ name: '🦇 Владыка Роя', desc: 'Swarm Lord' });
  }
  
  if (active.length === 0) {
    container.innerHTML = '<span id="no-synergies-text" style="color: var(--text-muted); font-size: 11px;">Нет активных классов</span>';
  } else {
    for (let syn of active) {
      let div = document.createElement('div');
      div.className = 'synergy-tag';
      div.innerHTML = `<strong>${syn.name}</strong> <span>(${syn.desc})</span>`;
      container.appendChild(div);
    }
  }
}

function recreateDrones() {
  drones = [];
  if (state.genes.foxp2) {
    // Swarm Lord check (FoxP2 + MBP + Opn1LW)
    let maxDrones = (state.genes.foxp2 && state.genes.mbp && state.genes.opn1lw) ? 4 : 2;
    for (let k = 0; k < maxDrones; k++) {
      let ox = (k % 2 === 0 ? -22 : 22) * (k < 2 ? 1 : 1.8);
      let oy = (k < 2 ? -22 : 22);
      drones.push(new BatHelper(player.x + ox, player.y + oy, player));
    }
  }
}

function triggerFireShieldBlast() {
  player.fireShieldCd = 240; // 4 seconds cooldown
  logRow("🔥 Огненный щит вспыхнул от удара! Волна пламени расходится во все стороны!", "gain");
  
  // Launch 8 fireballs in a circle
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    fireballs.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(a) * 6.0,
      vy: Math.sin(a) * 6.0,
      size: 4.5,
      owner: player,
      isShieldSpit: true // Prevent infinite trigger loop
    });
  }
  
  // Spawn fiery ring particles
  for (let i = 0; i < 20; i++) {
    let pa = Math.random() * Math.PI * 2;
    let pSpeed = 1.5 + Math.random() * 3.5;
    particles.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(pa) * pSpeed,
      vy: Math.sin(pa) * pSpeed,
      size: Math.random() * 3.5 + 2.0,
      color: '#ea580c',
      life: 25 + Math.random() * 10
    });
  }
  synth.playFire();
}

// ==========================================
// MODAL CLICKS & EVENTS
// ==========================================
function selectGene(id) {
  state.activeGeneId = id;
  let g = GENE_CATALOG[id];
  
  document.getElementById('modal-gene-name').innerText = g.name;
  document.getElementById('modal-gene-symbol').innerText = `Ген: ${id.toUpperCase()}`;
  document.getElementById('modal-gene-bio-fact').innerHTML = `<strong>Биологическая роль:</strong> ${g.fact}`;
  document.getElementById('modal-gene-gameplay').innerHTML = `<strong>Gameplay-эффект:</strong> ${g.bonus}`;
  document.getElementById('modal-gene-cost').innerText = g.cost;
  
  let statusText = document.getElementById('modal-gene-status');
  let buyBtn = document.getElementById('btn-buy-mutation');
  
  if (state.genes[id]) {
    statusText.innerHTML = "Статус: <strong style='color:#00f0ff'>МУТИРОВАЛ</strong>";
    buyBtn.disabled = true;
    buyBtn.innerText = "ГЕН АКТИВЕН";
  } else if (state.dna < g.cost) {
    statusText.innerHTML = "Статус: <strong style='color:#ef4444'>НЕДОСТАТОЧНО ДНК</strong>";
    buyBtn.disabled = true;
    buyBtn.innerText = "ТРЕБУЕТСЯ ДНК";
  } else {
    statusText.innerHTML = "Статус: <strong style='color:#ffb700'>ГОТОВ К МУТАЦИИ</strong>";
    buyBtn.disabled = false;
    buyBtn.innerText = "МУТИРОВАТЬ ГЕН";
  }
  
  document.getElementById('gene-modal').style.display = 'flex';
  synth.init();
}

function buySelectedMutation() {
  let id = state.activeGeneId;
  let g = GENE_CATALOG[id];
  
  if (state.dna >= g.cost && !state.genes[id]) {
    state.dna -= g.cost;
    state.genes[id] = true;
    
    player.applyPlayerGenes();
    
    // Automatically rebuild drones in case Swarm Lord is activated
    recreateDrones();
    
    if (id === 'mbp') {
      logRow("Ген MBP изменен. Нейросеть автопилота расширена до 6 скрытых нейронов.", "adapt");
    } else if (id === 'col1a1') {
      player.health = Math.min(player.maxHealth, player.health + 50);
      logRow("Ген COL1A1 изменен. Существо увеличилось и вырастило длинный хвост.", "adapt");
    } else if (id === 'acta1') {
      logRow("Ген ACTA1 изменен. Скорость перемещения существенно возросла.", "adapt");
    } else if (id === 'chit1') {
      logRow("Ген CHIT1 изменен. Слой хитиновой чешуи защищает от мечей рыцарей.", "adapt");
    } else if (id === 'shh') {
      logRow("Ген SHH изменен. Клик мыши активирует огненный плевок.", "adapt");
    } else if (id === 'opn1lw') {
      logRow("Ген OPN1LW изменен. Область видимости в темноте значительно возросла.", "adapt");
    } else if (id === 'foxp2') {
      logRow("Ген FOXP2 изменен. На помощь прилетели летучие мыши.", "adapt");
    } else if (id === 'rubisco') {
      logRow("Ген RuBisCO изменен. Тепло факелов дает сытость.", "adapt");
    } else if (id === 'cox1') {
      logRow("Ген COX1 изменен. Снижена скорость утомляемости при беге.", "adapt");
    }
    
    synth.playMutate();
    closeGeneModal();
    updateHUD();
  }
}

function closeGeneModal() {
  document.getElementById('gene-modal').style.display = 'none';
}

function closeIntro() {
  document.getElementById('intro-screen').style.display = 'none';
  synth.init();
  initSimulation();
}

function toggleAutopilot() {
  state.autopilot = !state.autopilot;
  document.getElementById('autopilot-status').innerText = state.autopilot ? "ВКЛ" : "ВЫКЛ";
  let btn = document.getElementById('btn-autopilot');
  if (state.autopilot) {
    btn.className = 'control-btn pulse-glow-cyan';
    logRow("[СИСТЕМА] Переход на нейросетевое управление.", "sys");
  } else {
    btn.className = 'control-btn';
    logRow("[СИСТЕМА] Возвращено ручное управление.", "sys");
  }
  synth.init();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById('btn-sound').firstElementChild.firstElementChild.innerText = soundEnabled ? "ВКЛ" : "ВЫКЛ";
  synth.init();
}

function triggerEvolution() {
  if (player.evolveProgress >= 100 && state.stage < 4) {
    state.stage++;
    state.generation++;
    portal = null;
    
    player.evolveProgress = 0;
    player.health = player.maxHealth;
    player.energy = player.maxEnergy;
    
    state.dna += 35;
    
    let conf = STAGES[state.stage];
    logRow(`✨ ЭВОЛЮЦИОННЫЙ СКАЧОК! Вы развились в: ${conf.title}. +35 ДНК.`, "gain");
    logRow(conf.text, "sys");
    
    player.applyPlayerGenes();
    
    synth.playEvolve();
    
    bots = [];
    // Spawn normal guards, mages, bombers in middle rooms (rooms 1 to rooms.length - 2)
    for (let i = 1; i < rooms.length - 1; i++) {
      let r = rooms[i];
      let cx = r.x * TILE_SIZE + Math.floor(r.w / 2) * TILE_SIZE + 50;
      let cy = r.y * TILE_SIZE + Math.floor(r.h / 2) * TILE_SIZE + 50;
      
      let enemyType = 'guard';
      let lvl = state.level || 1;
      if (lvl === 2) {
        let roll = Math.random();
        if (roll < 0.20) enemyType = 'mage';
        else if (roll < 0.40) enemyType = 'goblin';
        else if (roll < 0.60) enemyType = 'halberdier';
      } else if (lvl >= 3) {
        let roll = Math.random();
        if (roll < 0.12) enemyType = 'mage';
        else if (roll < 0.24) enemyType = 'bomber';
        else if (roll < 0.36) enemyType = 'goblin';
        else if (roll < 0.48) enemyType = 'orc';
        else if (roll < 0.60) enemyType = 'halberdier';
        else if (roll < 0.72) enemyType = 'alchemist';
      }
      bots.push(new Organism(cx, cy, false, enemyType));
    }
    
    // Spawn the Dread Lord Boss in the center of the Boss room (rooms[rooms.length - 1])
    let bossRoom = rooms[rooms.length - 1];
    let bx = bossRoom.x * TILE_SIZE + Math.floor(bossRoom.w / 2) * TILE_SIZE + 50;
    let by = bossRoom.y * TILE_SIZE + Math.floor(bossRoom.h / 2) * TILE_SIZE + 50;
    let lvl = state.level || 1;
    if (lvl === 3) {
      bots.push(new Organism(bx - 50, by - 50, false, 'boss'));
      bots.push(new Organism(bx + 50, by + 50, false, 'boss'));
    } else {
      bots.push(new Organism(bx, by, false, 'boss'));
    }

    let extraSpawns = (state.stage >= 3 ? 2 : 0) + Math.min(3, lvl - 1);
    for (let k = 0; k < extraSpawns; k++) {
      let rIdx = 1 + Math.floor(Math.random() * (rooms.length - 2));
      let r = rooms[rIdx];
      let cx = r.x * TILE_SIZE + Math.floor(r.w / 2) * TILE_SIZE + 50;
      let cy = r.y * TILE_SIZE + Math.floor(r.h / 2) * TILE_SIZE + 50;
      
      let enemyType = 'guard';
      if (lvl === 2) {
        let roll = Math.random();
        if (roll < 0.25) enemyType = 'mage';
        else if (roll < 0.50) enemyType = 'goblin';
        else if (roll < 0.75) enemyType = 'halberdier';
      } else if (lvl >= 3) {
        let roll = Math.random();
        if (roll < 0.20) enemyType = 'mage';
        else if (roll < 0.40) enemyType = 'bomber';
        else if (roll < 0.55) enemyType = 'goblin';
        else if (roll < 0.70) enemyType = 'orc';
        else if (roll < 0.85) enemyType = 'halberdier';
        else enemyType = 'alchemist';
      }
      bots.push(new Organism(cx, cy, false, enemyType));
    }
    
    for (let i = 0; i < 8; i++) spawnRat();
    
    updateHUD();
  }
}

function triggerDeath() {
  // Death Shield: one-time protection from the crystal shop
  if (state.deathShield) {
    state.deathShield = false;
    player.health = player.maxHealth * 0.25;
    player.energy = player.maxEnergy * 0.5;
    logRow('🛡️ Щит Смерти сработал! Вы остались живы с 25% здоровья.', 'gain');
    return;
  }
  gameActive = false;
  let btnLoad = document.getElementById('btn-load-save');
  if (btnLoad) {
    btnLoad.style.display = localStorage.getItem('evolutio_savegame') ? 'inline-block' : 'none';
  }
  document.getElementById('death-overlay').classList.remove('hidden');
  synth.playDamage();
}

function handleBossDeath(bossBot, source) {
  state.guardsDefeated += 5;
  state.dna += 50;
  state.gold += 50;
  if (source === 'burn') {
    state.crystals += 25;
  }
  createExplosion(bossBot.x, bossBot.y, '#f59e0b', 30);
  
  // Check if any other bosses are still alive
  let otherBosses = bots.filter(b => b !== bossBot && b.type === 'boss' && b.health > 0).length;
  if (otherBosses === 0) {
    if (source === 'burn') {
      logRow("👑 Королевский Босс сгорел в пламени! Путь к сокровищам свободен! +50 ДНК, +50 золота, +25 💎.", "gain");
    } else {
      logRow("👑 Королевский Босс повержен! Путь к сокровищам свободен! +50 ДНК, +50 золота.", "gain");
    }
    portal = { x: bossBot.x, y: bossBot.y, active: true };
  } else {
    logRow(`👑 Один из Боссов повержен! Осталось победить еще ${otherBosses} босса(ов) для открытия прохода!`, "warning");
  }
}

function showVictoryCinematic(endingType, onComplete) {
  // Create or reuse the cinematic overlay
  let el = document.getElementById('victory-cinematic');
  if (!el) {
    el = document.createElement('div');
    el.id = 'victory-cinematic';
    document.body.appendChild(el);
  }

  const cfg = {
    god: {
      color: '#a855f7', label: '⚗️  АПОФЕОЗ  ⚗️',
      main: 'БОГ ЭВОЛЮЦИИ', sub: 'Геном преступил границы природы',
      lines: ['Вы вобрали в себя больше мутаций,', 'чем выдерживает само бытие.', 'Эволюция завершена. Вознесение достигнуто.']
    },
    nature: {
      color: '#10b981', label: '🌿  ЧИСТЫЙ ПУТЬ  🌿',
      main: 'ВОЗВРАЩЕНИЕ К ИСТОКАМ', sub: 'Природный отбор завершён',
      lines: ['Без мутаций. Без артефактов.', 'Лишь воля к выживанию.', 'Природа выбрала вас.']
    },
    balanced: {
      color: '#f59e0b', label: '👑  ПОБЕДА  👑',
      main: 'КОРОНАЦИЯ ЭВОЛЮЦИИ', sub: 'Баланс силы и мудрости достигнут',
      lines: ['Замок пал. Паладин повержен.', 'Ваш вид занял тронный зал.', 'Новая эпоха начинается.']
    }
  };

  const c = cfg[endingType] || cfg.balanced;

  el.innerHTML = `
    <div class="vc-line vc-line-small" id="vc1" style="color:${c.color}aa;">${c.label}</div>
    <div class="vc-separator" id="vcsep1" style="background:${c.color};"></div>
    <div class="vc-line vc-line-main" id="vc2" style="color:${c.color};">${c.main}</div>
    <div class="vc-line vc-line-sub" id="vc3">${c.sub}</div>
    <div class="vc-separator" id="vcsep2" style="background:${c.color}55;"></div>
    ${c.lines.map((l,i) => `<div class="vc-line" id="vcl${i}" style="font-size:clamp(11px,1.3vw,14px);color:#cbd5e1;margin:4px 0;letter-spacing:1px;">${l}</div>`).join('')}
  `;

  // Show overlay
  el.classList.add('show');

  // Stagger each line in
  const ids = ['vc1','vcsep1','vc2','vc3','vcsep2',...c.lines.map((_,i)=>'vcl'+i)];
  ids.forEach((id, i) => {
    setTimeout(() => {
      const node = document.getElementById(id);
      if (node) node.classList.add('appear');
      if (id === 'vc2') { const n = document.getElementById('vc2'); if(n) n.classList.add('glow'); }
    }, 300 + i * 350);
  });

  // After all lines shown, wait then fade out and call onComplete
  const totalDelay = 300 + ids.length * 350 + 1800;
  setTimeout(() => {
    el.style.transition = 'opacity 1.4s ease';
    el.style.opacity = '0';
    setTimeout(() => {
      el.style.display = 'none';
      if (onComplete) onComplete();
    }, 1400);
  }, totalDelay);
}

function triggerVictory() {
  gameActive = false;
  
  let activeGenesCount = Object.values(state.genes).filter(v => v).length;
  let speciesTitle = "Совершенный Организм";
  let speciesDesc = "Ваша ДНК достигла баланса силы и интеллекта.";
  
  if (state.genes.shh && state.genes.chit1) {
    speciesTitle = "Бронированный Пожиратель Пламени";
    speciesDesc = "Слияние прочной хитиновой брони и способности извергать огонь сделало вас неуязвимым владыкой подземелья.";
  } else if (state.genes.ldha && state.genes.acta1) {
    speciesTitle = "Ртутный Сверххищник";
    speciesDesc = "Сверхбыстрый метаболизм и развитые мышечные волокна превратили вас в молниеносную тень, разрывающую врагов за секунды.";
  } else if (state.genes.rubisco && state.genes.opn1lw) {
    speciesTitle = "Светоносный Хищник Глубин";
    speciesDesc = "Вы научились поглощать энергию света факелов и видеть сквозь абсолютную тьму, доминируя в полумраке замка.";
  } else if (state.genes.foxp2 && state.genes.mbp) {
    speciesTitle = "Король Разума Улья";
    speciesDesc = "Развитая нервная система и призыв летучих мышей-помощников создали коллективный разум, сокрушивший стражу.";
  } else if (activeGenesCount >= 7) {
    speciesTitle = "Химера Высшего Порядка";
    speciesDesc = "Вы вобрали в себя слишком много мутаций, превратившись в нестабильное, но невероятно могущественное и опасное божество.";
  }

  let chronicleParts = [];
  if (state.genes.rubisco) chronicleParts.push("🌱 <strong>Свет во мраке</strong>: Ваша способность к фотосинтезу (RuBisCO) позволила вам поглощать тепло факелов. Замок больше не является холодным склепом — вы наполнили его жизненным светом, превратив древние залы в процветающую био-экосистему.");
  if (state.genes.shh) chronicleParts.push("🔥 <strong>Очищающий огонь</strong>: Благодаря железам извержения пламени (Sonic Hedgehog), вы испепелили трон жестокого короля. Тронный зал превратился в пепел, а огонь ваших вен теперь будет вечно согревать новые поколения вашего вида.");
  if (state.genes.chit1) chronicleParts.push("🛡️ <strong>Несокрушимый оплот</strong>: Прочная хитиновая чешуя сделала вас неуязвимым для оружия королевских паладинов. Ваши потомки унаследуют эту броню, и ни один клинок смертных больше не сможет причинить вреда вашей расе.");
  if (state.genes.ldha || state.genes.acta1) chronicleParts.push("⚡ <strong>Буря подземелья</strong>: Сверхмощные мышечные волокна и гликолиз позволили вам перемещаться быстрее ветра. В легендах людей вы останетесь стремительной молнией, пролетевшей сквозь залы замка и сокрушившей вековую тиранию.");
  if (state.genes.opn1lw) chronicleParts.push("👁️ <strong>Всевидящее oko</strong>: Ваше ночное зрение, дарованное геном OPN1LW, позволило вам видеть во тьме. Вы ушли в самые глубокие пещеры под замком, чтобы основать подземную империю под присмотром ваших всевидящих глаз.");
  if (state.genes.foxp2) chronicleParts.push("🦇 <strong>Улей нетопырей</strong>: Вы подчинили себе летучих мышей замка. Ваша верная стая разнесла весть о вашей победе по всему миру, провозглашая рождение нового Владыки Роя.");
  if (state.genes.mbp) chronicleParts.push("🧠 <strong>Высший разум</strong>: Нейронная сеть вашего мозга развилась до невероятного уровня. Вы осознали суть алхимических процессов и теперь сами управляете ходом эволюции.");
  if (chronicleParts.length === 0) chronicleParts.push("🐌 <strong>Путь адаптации</strong>: Без явных боевых мутаций вы смогли преодолеть все препятствия благодаря упорству и природным инстинктам выживания.");

  let chronicleHtml = chronicleParts.map(p => '<p style="font-size:11px;line-height:1.4;color:#cbd5e1;margin:0 0 10px 0;border-bottom:1px dashed rgba(255,255,255,0.05);padding-bottom:6px;">' + p + '</p>').join('');

  // === ОПРЕДЕЛЯЕМ ТИП КОНЦОВКИ ===
  // Концовка 1 "Бог Эволюции": 7+ мутаций ИЛИ три мощных гена одновременно
  // Концовка 2 "Возвращение к истокам": 0-2 мутации (чистый выживший)  
  // Концовка 3 "Коронация Эволюции": 3-6 мутаций (балансный путь)
  let endingType = 'balanced';
  if (activeGenesCount >= 7 || (state.genes.shh && state.genes.chit1 && state.genes.ldha)) {
    endingType = 'god';
  } else if (activeGenesCount <= 2) {
    endingType = 'nature';
  }

  const ENDINGS = {
    god: {
      title: "БОГ ЭВОЛЮЦИИ",
      subtitle: "Апофеоз Генома",
      color: "#a855f7",
      glow: "rgba(168,85,247,0.5)",
      bg: "rgba(15,5,30,0.97)",
      icon: "⚗️",
      epicText: "МУТАЦИЯ ЗАВЕРШЕНА. ВОЗНЕСЕНИЕ ДОСТИГНУТО.",
      quoteColor: "#a855f7",
      quoteBg: "rgba(168,85,247,0.08)",
      textColor: "#c4b5fd",
      quote: "«Эволюция — это не конечная точка. Это сам путь. Но сегодня вы достигли её горизонта и шагнули за него.»",
      p1text: () => `Вы вобрали в себя <strong style="color:#e9d5ff;">${activeGenesCount} мутаций</strong> — столь колоссальное количество генетических изменений, что ваша ДНК перестала подчиняться законам природы. Вы больше не существо. Вы — <strong style="color:#f0abfc;">живая алхимическая реакция</strong>, непрекращающийся процесс, сама суть эволюции в физическом воплощении.`,
      p2: "Когда Абсолютный Паладин пал, замок содрогнулся. Стены лопнули, выпуская наружу споры ваших генов. Каждый камень заразился вашей ДНК. Из трещин полезли организмы с вашим геномом. <strong style='color:#e9d5ff;'>Эволюция больше не случайна — теперь вы её архитектор.</strong>",
      p3: "Через сто лет, когда новые существа откопают руины замка, они найдут лишь одну надпись на стенах: <em style='color:#f0abfc;'>«Здесь родился Бог Эволюции. И он ушёл дальше.»</em>"
    },
    nature: {
      title: "ВОЗВРАЩЕНИЕ К ИСТОКАМ",
      subtitle: "Чистый Путь Выживания",
      color: "#10b981",
      glow: "rgba(16,185,129,0.5)",
      bg: "rgba(5,20,10,0.97)",
      icon: "🌿",
      epicText: "ПРИРОДНЫЙ ОТБОР ЗАВЕРШЁН. ВЫ — ИСТИННЫЙ ВЫЖИВШИЙ.",
      quoteColor: "#10b981",
      quoteBg: "rgba(16,185,129,0.08)",
      textColor: "#6ee7b7",
      quote: "«Истинная эволюция — не в количестве мутаций, а в способности выжить с тем, что дала природа.»",
      p1text: () => `Вы прошли весь замок с <strong style="color:#a7f3d0;">${activeGenesCount <= 1 ? 'минимальными изменениями генома' : 'почти нетронутой ДНК'}</strong>. Никаких дополнительных органов, никаких искусственных усилений — лишь чистый природный инстинкт, доставшийся вам от миллионов поколений предков.`,
      p2: "После победы над Паладином вы вышли из замка и растворились в лесу за его стенами. Алхимики искали вас неделями, но нашли только следы. <strong style='color:#a7f3d0;'>Природный отбор работает медленно, но безошибочно</strong> — и вы тому живое доказательство.",
      p3: "Ваш вид начал тихую экспансию в леса. Без чужеродных генов, без мутагенных артефактов — <em style='color:#a7f3d0;'>только естественный путь эволюции, верный и неумолимый.</em> Через тысячи лет ваши потомки унаследуют мир."
    },
    balanced: {
      title: "КОРОНАЦИЯ ЭВОЛЮЦИИ",
      subtitle: "Баланс Силы и Мудрости",
      color: "#f59e0b",
      glow: "rgba(245,158,11,0.5)",
      bg: "rgba(15,10,5,0.97)",
      icon: "👑",
      epicText: "ГЕНЕТИЧЕСКИЙ КОДЕКС ЗАПЕЧАТАН. ЗАМОК ЗАВОЁВАН.",
      quoteColor: "#f59e0b",
      quoteBg: "rgba(245,158,11,0.08)",
      textColor: "#fcd34d",
      quote: "«Эволюция — это компромисс. Слишком мало изменений — ты жертва. Слишком много — ты монстр. Ты нашёл путь между.»",
      p1text: () => `Вооружившись <strong style="color:#fde68a;">${activeGenesCount} целенаправленными мутациями</strong>, вы сохранили связь с природой, но укрепили её эволюционными инструментами. Ни чрезмерная нестабильность, ни слепой консерватизм — <strong style="color:#fde68a;">совершенный баланс генетической адаптации.</strong>`,
      p2: "С падением Абсолютного Паладина над замком взошло новое знамя. Ваш вид занял тронный зал и основал первую <strong style='color:#fde68a;'>эволюционную монархию</strong> — государство, где законы пишутся не мечом, а последовательностями ДНК.",
      p3: "Алхимики, бежавшие из замка, разнесли весть по всему континенту: <em style='color:#fde68a;'>«Эволюция победила сталь. Геном сломил доспехи. Пришествие новой эпохи неизбежно.»</em>"
    }
  };

  let ed = ENDINGS[endingType];

  let storyHtml = `
    <p style="font-size:11px;line-height:1.5;color:#e2e8f0;text-align:center;font-style:italic;border-left:3px solid ${ed.quoteColor};padding:8px 12px;margin:0 0 8px 0;background:${ed.quoteBg};border-radius:0 6px 6px 0;">${ed.quote}</p>
    <p style="font-size:10px;line-height:1.45;color:${ed.textColor};margin:0 0 7px 0;">${ed.p1text()}</p>
    <p style="font-size:10px;line-height:1.45;color:${ed.textColor};margin:0 0 7px 0;">${ed.p2}</p>
    <p style="font-size:10px;line-height:1.45;color:${ed.textColor};margin:0;">${ed.p3}</p>
  `;

  let html = `
    <div style="margin:4px 0;padding:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:6px;text-align:left;">
      <div style="max-height:160px;overflow-y:auto;margin-bottom:8px;scrollbar-width:thin;scrollbar-color:${ed.color}33 transparent;">
        ${storyHtml}
      </div>
      <div style="padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);margin-bottom:6px;">
        <h3 style="color:${ed.color};margin:0 0 4px 0;text-align:center;font-family:'Cinzel',serif;letter-spacing:1px;font-size:12px;">🧬 Итоговый вид: ${speciesTitle}</h3>
        <p style="font-size:9px;font-style:italic;color:#94a3b8;text-align:center;margin:0;line-height:1.3;">"${speciesDesc}"</p>
      </div>
      <div style="max-height:100px;overflow-y:auto;margin-bottom:8px;padding:6px 8px;background:rgba(0,0,0,0.3);border-radius:4px;border-left:3px solid ${ed.color};scrollbar-width:thin;scrollbar-color:${ed.color}33 transparent;">
        <h4 style="color:${ed.color};font-size:9px;margin:0 0 5px 0;font-family:'Share Tech Mono',monospace;text-transform:uppercase;letter-spacing:1px;">📜 ХРОНИКИ ВАШЕГО ВИДА:</h4>
        ${chronicleHtml}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;font-family:'Share Tech Mono',monospace;">
        <div>💀 Рыцарей: <strong style="color:#ef4444;">${state.guardsDefeated}</strong></div>
        <div>💰 Золото: <strong style="color:#facc15;">${state.gold}</strong></div>
        <div>🧬 ДНК: <strong style="color:#a855f7;">${state.dna}</strong></div>
        <div>🧬 Мутаций: <strong style="color:#22d3ee;">${activeGenesCount} / 10</strong></div>
      </div>
    </div>
  `;


  showVictoryCinematic(endingType, () => {
  let victoryOverlay = document.getElementById('victory-overlay');
  if (victoryOverlay) {
    victoryOverlay.style.background = ed.bg;
    victoryOverlay.style.borderColor = ed.color;
    victoryOverlay.style.boxShadow = `0 0 40px ${ed.glow}, inset 0 0 15px ${ed.glow.replace('0.5', '0.1')}`;
    let titleEl = victoryOverlay.querySelector('h2');
    if (titleEl) {
      titleEl.textContent = ed.icon + ' ' + ed.title;
      titleEl.style.color = ed.color;
      titleEl.style.textShadow = `0 0 15px ${ed.glow}`;
    }
    let subtitleEl = victoryOverlay.querySelector('p');
    if (subtitleEl) {
      subtitleEl.innerHTML = `<span style="font-size:10px;font-family:'Share Tech Mono',monospace;letter-spacing:2px;color:${ed.color};opacity:0.8;">${ed.epicText}</span><br/><br/><em>${ed.subtitle}</em>`;
    }
    let btn = victoryOverlay.querySelector('button');
    if (btn) {
      btn.style.background = `linear-gradient(135deg, ${ed.color}, ${ed.color}99)`;
      btn.style.borderColor = ed.color;
      btn.style.boxShadow = `0 0 15px ${ed.glow}`;
    }
    victoryOverlay.classList.remove('hidden');
  }
    let statsContainer = document.getElementById('victory-stats');
    if (statsContainer) statsContainer.innerHTML = html;

    synth.playVictorySong();
  });
}

function restartSimulation() {
  let deathOverlay = document.getElementById('death-overlay');
  if (deathOverlay) deathOverlay.classList.add('hidden');
  let victoryOverlay = document.getElementById('victory-overlay');
  if (victoryOverlay) victoryOverlay.classList.add('hidden');
  
  // Full reset for a fresh start
  state.level = 1;
  state.stage = 1;
  state.dna = 40;
  state.gold = 0;
  state.guardsDefeated = 0;
  
  for (let id in state.genes) {
    state.genes[id] = false;
  }
  for (let r in state.relics) {
    state.relics[r] = false;
  }
  
  recreateDrones();
  
  resetEcosystem();
  saveGame();
  gameActive = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
  logRow("[СИСТЕМА] Мир перезапущен. Эволюция генома начинается с начала.", "sys");
}

function logRow(text, type = "sys") {
  let logBox = document.getElementById('terminal-log-box');
  if (logBox) {
    let row = document.createElement('div');
    row.className = `log-row ${type}`;
    row.innerText = text;
    logBox.appendChild(row);
    logBox.scrollTop = logBox.scrollHeight;
    
    if (logBox.children.length > 25) logBox.removeChild(logBox.firstChild);
  }
}

// Bind to window context
window.selectGene = selectGene;
window.buySelectedMutation = buySelectedMutation;
window.closeGeneModal = closeGeneModal;
window.closeIntro = closeIntro;
window.toggleAutopilot = toggleAutopilot;
window.toggleSound = toggleSound;
window.triggerEvolution = triggerEvolution;
window.restartSimulation = restartSimulation;
window.upgradeStat = upgradeStat;
window.triggerVictory = triggerVictory;

// ============================================================
// CRYSTAL SHOP
// ============================================================
const CRYSTAL_ITEMS = {
  skin_ice:    { price: 150, type: 'skin', label: 'Ice Dragon', once: true },
  skin_fire:   { price: 150, type: 'skin', label: 'Fire Lord',  once: true },
  skin_shadow: { price: 200, type: 'skin', label: 'Shadow',     once: true },
  death_shield:{ price: 100, type: 'consumable', label: 'Death Shield', once: false },
  dna_boost:   { price: 80,  type: 'consumable', label: 'DNA x2 5min',  once: false },
};
const _ownedSkins = new Set(JSON.parse(localStorage.getItem('cf_ownedSkins') || '[]'));

function openCrystalShop() {
  document.getElementById('crystal-shop-modal').style.display = 'flex';
  refreshCrystalShopUI();
}
function closeCrystalShop() {
  document.getElementById('crystal-shop-modal').style.display = 'none';
}
function refreshCrystalShopUI() {
  document.getElementById('shop-crystal-count').innerText = state.crystals;
  for (let [id, item] of Object.entries(CRYSTAL_ITEMS)) {
    let elId = 'shop-' + id.replace(/_/g, '-');
    let el = document.getElementById(elId);
    if (!el) continue;
    let btn = el.querySelector('.btn-crystal-buy');
    if (!btn) continue;
    let isSkin = item.type === 'skin';
    let isOwned = isSkin && _ownedSkins.has(id);
    let isActive = isSkin && state.activeSkin === id;
    if (isOwned) {
      btn.textContent = isActive ? 'ACTIVE' : 'EQUIP';
      btn.className = 'btn-crystal-buy owned';
      btn.disabled = false;
      btn.onclick = () => buyCrystalItem(id, item.price);
      el.classList.add('owned');
    } else {
      btn.textContent = item.price + ' ' + String.fromCodePoint(0x1F48E);
      btn.className = 'btn-crystal-buy';
      btn.disabled = state.crystals < item.price;
      el.classList.remove('owned');
    }
    if (id === 'death_shield' && state.deathShield) {
      btn.textContent = 'ACTIVE'; btn.className = 'btn-crystal-buy owned'; btn.disabled = true;
    }
    if (id === 'dna_boost' && state.dnaBoostEnd > 0) {
      let mins = Math.ceil(state.dnaBoostEnd / 3600);
      btn.textContent = mins + 'min left'; btn.className = 'btn-crystal-buy owned'; btn.disabled = true;
    }
  }
}
function buyCrystalItem(id, price) {
  let item = CRYSTAL_ITEMS[id];
  if (!item) return;
  let isSkin = item.type === 'skin';
  let isOwned = isSkin && _ownedSkins.has(id);
  if (isOwned) {
    state.activeSkin = id;
    logRow('Skin "' + item.label + '" equipped!', 'gain');
    refreshCrystalShopUI(); updateHUD(); return;
  }
  if (state.crystals < price) {
    logRow('Not enough crystals! Need ' + price, 'sys'); return;
  }
  state.crystals -= price;
  if (id === 'death_shield') {
    state.deathShield = true;
    logRow('Death Shield active! Next fatal hit will not kill you.', 'gain');
  } else if (id === 'dna_boost') {
    state.dnaBoostEnd = 5 * 60 * 60;
    logRow('DNA x2 Boost activated for 5 minutes!', 'gain');
  } else if (isSkin) {
    _ownedSkins.add(id);
    localStorage.setItem('cf_ownedSkins', JSON.stringify([..._ownedSkins]));
    state.activeSkin = id;
    logRow('Skin "' + item.label + '" purchased and equipped!', 'gain');
  }
  refreshCrystalShopUI(); updateHUD();
}

window.openCrystalShop = openCrystalShop;
window.closeCrystalShop = closeCrystalShop;
window.buyCrystalItem = buyCrystalItem;

// ==========================================
// CHECKPOINT LEVEL SAVE / LOAD SYSTEM
// ==========================================
function saveGame() {
  if (!player) return;
  const saveData = {
    state: {
      level: state.level,
      stage: state.stage,
      dna: state.dna,
      gold: state.gold,
      crystals: state.crystals,
      guardsDefeated: state.guardsDefeated,
      generation: state.generation,
      activeSkin: state.activeSkin,
      dnaBoostEnd: state.dnaBoostEnd,
      deathShield: state.deathShield,
      relics: Object.assign({}, state.relics),
      genes: Object.assign({}, state.genes)
    },
    player: {
      health: player.health,
      maxHealth: player.maxHealth,
      energy: player.energy,
      maxEnergy: player.maxEnergy,
      statLevels: Object.assign({}, player.statLevels)
    }
  };
  localStorage.setItem('evolutio_savegame', JSON.stringify(saveData));
  logRow(`💾 Прогресс сохранен (Начало этажа ${state.level})`, 'sys');
}

function loadGame() {
  const saveStr = localStorage.getItem('evolutio_savegame');
  if (!saveStr) return false;
  
  try {
    const saveData = JSON.parse(saveStr);
    
    // Restore state values
    state.level = saveData.state.level;
    state.stage = saveData.state.stage;
    state.dna = saveData.state.dna;
    state.gold = saveData.state.gold;
    state.crystals = saveData.state.crystals;
    state.guardsDefeated = saveData.state.guardsDefeated;
    state.generation = saveData.state.generation;
    state.activeSkin = saveData.state.activeSkin;
    state.dnaBoostEnd = saveData.state.dnaBoostEnd;
    state.deathShield = saveData.state.deathShield;
    
    state.relics = Object.assign({}, saveData.state.relics);
    state.genes = Object.assign({}, saveData.state.genes);
    
    // Recreate ecosystem for this floor
    resetEcosystem(true);
    
    // Restore player attributes
    player.health = saveData.player.health;
    player.maxHealth = saveData.player.maxHealth;
    player.energy = saveData.player.energy;
    player.maxEnergy = saveData.player.maxEnergy;
    player.statLevels = Object.assign({}, saveData.player.statLevels);
    
    player.applyPlayerGenes();
    updateHUD();
    
    return true;
  } catch (e) {
    console.error('Error loading save:', e);
    return false;
  }
}

function loadSimulationSave() {
  let deathOverlay = document.getElementById('death-overlay');
  if (deathOverlay) deathOverlay.classList.add('hidden');
  let victoryOverlay = document.getElementById('victory-overlay');
  if (victoryOverlay) victoryOverlay.classList.add('hidden');
  
  let loaded = loadGame();
  if (loaded) {
    gameActive = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
    logRow("[СИСТЕМА] Прогресс восстановлен с начала этажа.", "sys");
  } else {
    logRow("[ОШИБКА] Не удалось загрузить сохранение.", "danger");
    restartSimulation();
  }
}

window.saveGame = saveGame;
window.loadGame = loadGame;
window.loadSimulationSave = loadSimulationSave;
