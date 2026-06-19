// Socket.io Connection
const socket = io();

// Parse Session ID from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

if (!sessionId) {
  alert('Сессия не найдена. Возврат в лобби.');
  window.location.href = '../';
}

document.getElementById('session-display').innerText = sessionId.toUpperCase();

// Local State
let gameState = null;
let mutationsCatalog = {};
let selectedMutationId = null;

// Telemetry Charts
let healthChart = null;
let dnaChart = null;

// Initialize WebSockets
socket.emit('join-session', { sessionId, role: 'geneticist' });

socket.on('session-started', ({ stage, state, mutations }) => {
  gameState = state;
  mutationsCatalog = mutations;
  
  // Initialize UI and Charts
  updateUI();
  initCharts(gameState.statsHistory || { health: [100], dna: [0], stages: [1], timestamps: [0] });
  logMessage(`[СИСТЕМА] Подключено к сессии: ${sessionId.toUpperCase()}`, 'system');
  logMessage(`[СИСТЕМА] Текущий этап эволюции: ${state.stageName}`, 'evolution');
});

socket.on('sync-state', ({ state }) => {
  gameState = state;
  updateUI();
});

socket.on('sync-organism-position', ({ position }) => {
  // Optional: can log position ticks or track on a minimap
});

socket.on('health-updated', ({ health, maxHealth, isDead }) => {
  if (gameState) {
    gameState.health = health;
    gameState.maxHealth = maxHealth;
    gameState.isDead = isDead;
    updateUI();
  }
});

socket.on('food-collected', ({ foodId, gain, dna, world }) => {
  if (gameState) {
    gameState.dna = dna;
    updateUI();
  }
});

socket.on('mutation-applied', ({ mutationId, state }) => {
  gameState = state;
  updateUI();
  // Highlight the mutation node as purchased
  const node = document.getElementById(`node-${mutationId}`);
  if (node) {
    node.classList.add('purchased');
  }
  // Re-render selected details
  if (selectedMutationId === mutationId) {
    selectNode(mutationId);
  }
});

socket.on('next-stage', ({ stage, state, world }) => {
  gameState = state;
  updateUI();
  logMessage(`[ЭВОЛЮЦИЯ] Организм перешел на этап ${stage}: ${state.stageName}!`, 'evolution');
  // Clear selection
  selectedMutationId = null;
  document.getElementById('details-content').style.display = 'none';
  document.getElementById('details-panel').querySelector('.placeholder-text').style.display = 'block';
  
  // Unhighlight all nodes and reapply purchased class based on new state
  document.querySelectorAll('.mutation-node').forEach(node => {
    node.classList.remove('selected');
    const id = node.id.replace('node-', '');
    if (gameState.genome[id]) {
      node.classList.add('purchased');
    } else {
      node.classList.remove('purchased');
    }
  });
});

socket.on('terminal-updated', ({ terminalId, progress, hacked, terminals }) => {
  // Update progress logging
  if (hacked) {
    logMessage(`[ВЗЛОМ] Терминал ${terminalId} полностью расшифрован!`, 'evolution');
  } else {
    logMessage(`[ДАННЫЕ] Дешифровка терминала ${terminalId}: ${progress}%`, 'system');
  }
});

socket.on('event-log', ({ type, message }) => {
  logMessage(message, type);
});

socket.on('player-disconnected', ({ role }) => {
  if (role === 'organism') {
    logMessage('[СИСТЕМА] Внимание: связь с Организмом потеряна!', 'danger');
    const dot = document.querySelector('#organism-status .status-dot');
    dot.className = 'status-dot disconnected';
    document.getElementById('organism-status-text').innerText = 'Отключен';
  }
});

socket.on('error-msg', (msg) => {
  alert('Ошибка сервера: ' + msg);
});

socket.on('mutation-failed', ({ reason }) => {
  alert('Сбой интеграции мутации: ' + reason);
});

socket.on('sync-charts', ({ statsHistory }) => {
  if (!healthChart || !dnaChart) return;
  
  // Update health chart
  healthChart.data.labels = statsHistory.timestamps.map(t => `${t}с`);
  healthChart.data.datasets[0].data = statsHistory.health;
  healthChart.update('none'); // Update without animation for performance

  // Update dna chart
  dnaChart.data.labels = statsHistory.timestamps.map(t => `${t}с`);
  dnaChart.data.datasets[0].data = statsHistory.dna;
  dnaChart.update('none');
});

socket.on('game-over', ({ endingType }) => {
  let endingTitle = '';
  let endingDesc = '';
  
  if (endingType === 'extinction') {
    endingTitle = 'ГЕНЕТИЧЕСКИЙ КРАХ (ВЫМИРАНИЕ)';
    endingDesc = 'Жизненные показатели Организма упали до нуля. Данная эволюционная ветвь оказалась нежизнеспособной в текущей среде.';
  } else if (endingType === 'cyber') {
    endingTitle = 'ФИНАЛ А: ТЕХНО-ТРАНСЦЕНДЕНТНОСТЬ';
    endingDesc = 'Организм соединился с квантовым ядром научной станции, оцифровав свой геном. Физическая плоть превзойдена — теперь это вечный цифровой разум.';
  } else if (endingType === 'nature') {
    endingTitle = 'ФИНАЛ Б: ХРАНИТЕЛЬ БИОСФЕРЫ';
    endingDesc = 'Активированный синтезатор восстановил экосистему планеты. Организм слился с глобальной вегетативной сетью, став защитником возрожденной природы.';
  } else if (endingType === 'weapon') {
    endingTitle = 'ФИНАЛ В: АБСОЛЮТНЫЙ ХИЩНИК';
    endingDesc = 'Реактор перегружен, уничтожив станцию. Организм поглотил изотопы излучения, мутировав в бронированного титана, господствующего на выжженной планете.';
  }

  // Display screen overlay
  const overlay = document.createElement('div');
  overlay.className = 'game-over-overlay';
  overlay.innerHTML = `
    <div class="game-over-content">
      <h1 class="ending-title">${endingTitle}</h1>
      <p class="ending-desc">${endingDesc}</p>
      <button class="btn-restart" onclick="window.location.reload()">ЗАПУСТИТЬ НОВУЮ СИМУЛЯЦИЮ</button>
    </div>
  `;
  document.body.appendChild(overlay);
});

// Update UI Text Elements
function updateUI() {
  if (!gameState) return;

  // Status connection dot
  const dot = document.querySelector('#organism-status .status-dot');
  if (gameState.organismSocketId) {
    dot.className = 'status-dot connected';
    document.getElementById('organism-status-text').innerText = 'На связи';
  } else {
    dot.className = 'status-dot disconnected';
    document.getElementById('organism-status-text').innerText = 'Ожидание подключения...';
  }

  // Health and stats
  const healthPercent = (gameState.health / gameState.maxHealth) * 100;
  document.getElementById('health-bar').style.width = `${healthPercent}%`;
  document.getElementById('health-value').innerText = `${gameState.health} / ${gameState.maxHealth} HP`;
  
  if (gameState.health < gameState.maxHealth * 0.3) {
    document.getElementById('health-bar').style.background = 'linear-gradient(90deg, #ff003c, #ff3b30)';
    document.getElementById('health-bar').style.boxShadow = '0 0 20px #ff003c';
  } else {
    document.getElementById('health-bar').style.background = 'linear-gradient(90deg, #ff0055, #ff00aa)';
    document.getElementById('health-bar').style.boxShadow = '0 0 15px #ff007f';
  }

  document.getElementById('stat-speed').innerText = `x${gameState.speedMultiplier.toFixed(1)}`;
  document.getElementById('stat-armor').innerText = `${Math.round(gameState.damageReduction * 100)}%`;
  document.getElementById('stat-dna-mult').innerText = `x${gameState.dnaMultiplier.toFixed(1)}`;
  document.getElementById('stat-radius').innerText = `x${gameState.collectionRadius.toFixed(1)}`;

  // Stage details
  document.getElementById('stage-number').innerText = `ЭТАП ${gameState.stage}`;
  document.getElementById('stage-name').innerText = gameState.stageName;

  // DNA progress to evolve
  const reqDna = gameState.dnaToEvolve;
  document.getElementById('dna-progress-text').innerText = `${gameState.dna} / ${reqDna} ДНК`;
  const dnaPercent = Math.min(100, (gameState.dna / reqDna) * 100);
  document.getElementById('dna-progress-bar').style.width = `${dnaPercent}%`;

  // Enable/disable evolve button
  const evolveBtn = document.getElementById('btn-evolve');
  if (gameState.dna >= reqDna && gameState.stage < 4) {
    evolveBtn.disabled = false;
    evolveBtn.classList.add('ready');
  } else {
    evolveBtn.disabled = true;
    evolveBtn.classList.remove('ready');
  }

  // Handle stage locking in DOM
  for (let s = 1; s <= 4; s++) {
    const stageGroup = document.getElementById(`tree-stage-${s}`);
    if (s <= gameState.stage) {
      stageGroup.classList.remove('locked');
    } else {
      stageGroup.classList.add('locked');
    }
  }

  // Update environmental telemetry based on stage
  updateEnvironmentIndicators();
  
  // Sync purchased status on nodes
  for (const mutId in mutationsCatalog) {
    const node = document.getElementById(`node-${mutId}`);
    if (node) {
      if (gameState.genome[mutId]) {
        node.classList.add('purchased');
      } else {
        node.classList.remove('purchased');
      }
    }
  }
}

function updateEnvironmentIndicators() {
  const pressure = document.getElementById('env-pressure');
  const toxicity = document.getElementById('env-toxicity');
  const temp = document.getElementById('env-temp');
  const threat = document.getElementById('env-threat');

  if (gameState.stage === 1) {
    pressure.innerText = '1.0 atm';
    toxicity.innerText = 'Низкий (0.12%)';
    toxicity.style.color = '#ffe15d';
    temp.innerText = '22.4 °C';
    threat.innerText = 'Умеренная (споры)';
    threat.style.color = '#ffe15d';
  } else if (gameState.stage === 2) {
    pressure.innerText = '42.8 atm';
    pressure.style.color = '#00e5ff';
    toxicity.innerText = 'Минимальный (0.02%)';
    toxicity.style.color = '#39ff14';
    temp.innerText = '4.2 °C';
    threat.innerText = 'Хищники (Медузы)';
    threat.style.color = '#ff007f';
  } else if (gameState.stage === 3) {
    pressure.innerText = '0.9 atm';
    toxicity.innerText = 'Кислотный пар (4.12%)';
    toxicity.style.color = '#ff007f';
    temp.innerText = '39.8 °C';
    temp.style.color = '#ff007f';
    threat.innerText = 'Высокая (Лава)';
    threat.style.color = '#ff007f';
  } else if (gameState.stage === 4) {
    pressure.innerText = '1.0 atm';
    toxicity.innerText = 'Радиация (15 mSv/h)';
    toxicity.style.color = '#ff007f';
    temp.innerText = '18.1 °C';
    threat.innerText = 'Критическая (Лазеры)';
    threat.style.color = '#ff007f';
  }
}

// Log system messages to terminal
function logMessage(text, type = 'system') {
  const logList = document.getElementById('log-list');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  
  const time = new Date().toLocaleTimeString();
  entry.innerText = `[${time}] ${text}`;
  
  logList.appendChild(entry);
  logList.scrollTop = logList.scrollHeight;
}

// Selection of mutation tree nodes
function selectNode(mutationId) {
  selectedMutationId = mutationId;
  const mut = mutationsCatalog[mutationId];
  if (!mut) return;

  // Visual selection ring
  document.querySelectorAll('.mutation-node').forEach(node => {
    node.classList.remove('selected');
  });
  document.getElementById(`node-${mutationId}`).classList.add('selected');

  // Show details panel
  document.getElementById('details-panel').querySelector('.placeholder-text').style.display = 'none';
  document.getElementById('details-content').style.display = 'block';

  document.getElementById('details-title').innerText = mut.name;
  document.getElementById('details-desc').innerText = mut.description;
  document.getElementById('details-cost').innerText = mut.cost;

  // Prerequisite details
  const prereqEl = document.getElementById('details-prereq');
  if (mut.prereq) {
    const prereqMut = mutationsCatalog[mut.prereq];
    prereqEl.innerText = `Требование: ${prereqMut.name}`;
    if (gameState.genome[mut.prereq]) {
      prereqEl.style.color = '#39ff14'; // met
    } else {
      prereqEl.style.color = '#ff007f'; // not met
    }
  } else {
    prereqEl.innerText = 'Требование: Нет';
    prereqEl.style.color = '#8a9fc4';
  }

  // Handle buy button states
  const buyBtn = document.getElementById('btn-buy-mutation');
  if (gameState.genome[mutationId]) {
    buyBtn.innerText = 'МУТАЦИЯ УЖЕ ВНЕДРЕНА';
    buyBtn.disabled = true;
    buyBtn.style.background = 'rgba(255,255,255,0.05)';
    buyBtn.style.color = 'rgba(255,255,255,0.2)';
    buyBtn.style.boxShadow = 'none';
  } else {
    const isStageMet = gameState.stage >= mut.stage;
    const isPrereqMet = !mut.prereq || gameState.genome[mut.prereq];
    const isDnaMet = gameState.dna >= mut.cost;

    if (!isStageMet) {
      buyBtn.innerText = `ДОСТУПНО НА ЭТАПЕ ${mut.stage}`;
      buyBtn.disabled = true;
      buyBtn.style.background = 'rgba(255,255,255,0.05)';
      buyBtn.style.color = 'rgba(255,255,255,0.2)';
      buyBtn.style.boxShadow = 'none';
    } else if (!isPrereqMet) {
      buyBtn.innerText = 'БЛОКИРОВКА (ТРЕБОВАНИЕ)';
      buyBtn.disabled = true;
      buyBtn.style.background = 'rgba(255,255,255,0.05)';
      buyBtn.style.color = 'rgba(255,255,255,0.2)';
      buyBtn.style.boxShadow = 'none';
    } else if (!isDnaMet) {
      buyBtn.innerText = 'НЕДОСТАТОЧНО ДНК';
      buyBtn.disabled = true;
      buyBtn.style.background = 'rgba(255,255,255,0.05)';
      buyBtn.style.color = 'rgba(255,255,255,0.2)';
      buyBtn.style.boxShadow = 'none';
    } else {
      buyBtn.innerText = 'ВНЕДРИТЬ МУТАЦИЮ';
      buyBtn.disabled = false;
      buyBtn.style.background = 'linear-gradient(90deg, #39ff14 0%, #00aa00 100%)';
      buyBtn.style.color = '#000';
      buyBtn.style.boxShadow = '0 0 15px rgba(57, 255, 20, 0.3)';
    }
  }
}

function buySelectedMutation() {
  if (!selectedMutationId) return;
  socket.emit('trigger-mutation', { mutationId: selectedMutationId });
}

function requestEvolve() {
  socket.emit('request-evolve');
}

// ChartJS Initializer
function initCharts(history) {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { color: 'rgba(0, 229, 255, 0.03)' },
        ticks: { color: '#5d6e85', font: { size: 9, family: 'Share Tech Mono' } }
      },
      y: {
        grid: { color: 'rgba(0, 229, 255, 0.03)' },
        ticks: { color: '#5d6e85', font: { size: 9, family: 'Share Tech Mono' } }
      }
    },
    elements: {
      point: { radius: 0 },
      line: { tension: 0.3 }
    }
  };

  // Health Chart
  const ctxHealth = document.getElementById('healthChart').getContext('2d');
  healthChart = new Chart(ctxHealth, {
    type: 'line',
    data: {
      labels: history.timestamps.map(t => `${t}с`),
      datasets: [{
        data: history.health,
        borderColor: '#ff007f',
        borderWidth: 2,
        backgroundColor: 'rgba(255, 0, 127, 0.05)',
        fill: true
      }]
    },
    options: chartOptions
  });

  // DNA Chart
  const ctxDna = document.getElementById('dnaChart').getContext('2d');
  dnaChart = new Chart(ctxDna, {
    type: 'line',
    data: {
      labels: history.timestamps.map(t => `${t}с`),
      datasets: [{
        data: history.dna,
        borderColor: '#00e5ff',
        borderWidth: 2,
        backgroundColor: 'rgba(0, 229, 255, 0.05)',
        fill: true
      }]
    },
    options: chartOptions
  });
}
