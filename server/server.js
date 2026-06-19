const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { GameSession, MUTATIONS } = require('./game-state');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve client folder as static assets
app.use(express.static(path.join(__dirname, '../client')));

// Redirect default route to lobby index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Map of active game sessions: RoomID -> GameSession
const sessions = new Map();

io.on('connection', (socket) => {
  console.log(`[Socket] New connection: ${socket.id}`);

  // Join or create a session
  socket.on('join-session', ({ sessionId, role }) => {
    if (!sessionId) {
      socket.emit('error-msg', 'Session ID is required');
      return;
    }
    
    // Normalize session ID
    const room = sessionId.trim().toLowerCase();
    
    let session = sessions.get(room);
    if (!session) {
      session = new GameSession(room);
      sessions.set(room, session);
      console.log(`[Session] Created new session: ${room}`);
    }

    // Assign role
    if (role === 'organism') {
      if (session.organismSocketId && session.organismSocketId !== socket.id) {
        socket.emit('error-msg', 'Роль Организма уже занята в этой сессии');
        return;
      }
      session.organismSocketId = socket.id;
    } else if (role === 'geneticist') {
      if (session.geneticistSocketId && session.geneticistSocketId !== socket.id) {
        socket.emit('error-msg', 'Роль Генетика уже занята в этой сессии');
        return;
      }
      session.geneticistSocketId = socket.id;
    } else {
      socket.emit('error-msg', 'Invalid role requested');
      return;
    }

    socket.join(room);
    socket.sessionId = room;
    socket.role = role;

    console.log(`[Session] Socket ${socket.id} joined room ${room} as ${role}`);

    // Notify clients that session started/updated
    io.to(room).emit('session-started', {
      role: role,
      stage: session.stage,
      state: session.getStats(),
      world: session.world,
      mutations: MUTATIONS
    });
  });

  // Handle organism movement / state updates from Phaser client
  socket.on('organism-update', ({ position }) => {
    const room = socket.sessionId;
    if (!room) return;
    const session = sessions.get(room);
    if (!session || socket.id !== session.organismSocketId) return;

    // Update position
    session.position = position;

    // Send update to geneticist panel
    socket.to(room).emit('sync-organism-position', { position });
  });

  // Handle food gathering
  socket.on('collect-food', ({ foodId }) => {
    const room = socket.sessionId;
    if (!room) return;
    const session = sessions.get(room);
    if (!session || session.isDead) return;

    const result = session.collectFood(foodId);
    if (result) {
      io.to(room).emit('food-collected', {
        foodId: result.foodId,
        gain: result.gain,
        dna: result.currentDna,
        world: session.world // Send updated foods list
      });
      // Push event log to Geneticist
      socket.to(room).emit('event-log', {
        type: 'food',
        message: `Собрано питательное вещество. Получено +${result.gain} ДНК`
      });
    }
  });

  // Handle damage taken
  socket.on('take-damage', ({ amount, reason }) => {
    const room = socket.sessionId;
    if (!room) return;
    const session = sessions.get(room);
    if (!session || session.isDead) return;

    const actualDamage = session.takeDamage(amount);
    if (actualDamage > 0) {
      io.to(room).emit('health-updated', {
        health: session.health,
        maxHealth: session.maxHealth,
        isDead: session.isDead
      });

      socket.to(room).emit('event-log', {
        type: 'danger',
        message: `Внимание! Нанесен урон: -${actualDamage} HP (${reason})`
      });

      if (session.isDead) {
        io.to(room).emit('game-over', { endingType: 'extinction' });
      }
    }
  });

  // Handle mutation purchase from Geneticist panel
  socket.on('trigger-mutation', ({ mutationId }) => {
    const room = socket.sessionId;
    if (!room) return;
    const session = sessions.get(room);
    if (!session || socket.id !== session.geneticistSocketId) return;

    const result = session.buyMutation(mutationId);
    if (result.success) {
      io.to(room).emit('mutation-applied', {
        mutationId,
        state: session.getStats()
      });

      io.to(room).emit('event-log', {
        type: 'mutation',
        message: `Мутация успешно внедрена: ${MUTATIONS[mutationId].name}`
      });
    } else {
      socket.emit('mutation-failed', { reason: result.reason });
    }
  });

  // Handle evolve stage request
  socket.on('request-evolve', () => {
    const room = socket.sessionId;
    if (!room) return;
    const session = sessions.get(room);
    if (!session) return;

    const result = session.evolveStage();
    if (result.success) {
      io.to(room).emit('next-stage', {
        stage: session.stage,
        state: session.getStats(),
        world: session.world
      });

      io.to(room).emit('event-log', {
        type: 'evolution',
        message: `Эволюционный переход выполнен! Стадия: ${session.stage}`
      });
    } else {
      socket.emit('error-msg', result.reason || 'Эволюция невозможна');
    }
  });

  // Handle stage 4 terminal hacking
  socket.on('hack-terminal', ({ terminalId }) => {
    const room = socket.sessionId;
    if (!room) return;
    const session = sessions.get(room);
    if (!session || session.stage !== 4 || session.isDead) return;

    const result = session.hackTerminal(terminalId);
    if (result) {
      // Find terminal info
      const term = session.world.terminals.find(t => t.id === terminalId);
      io.to(room).emit('terminal-updated', {
        terminalId,
        progress: term.hackProgress,
        hacked: term.hacked,
        terminals: session.world.terminals
      });

      if (term.hacked) {
        let endingType = '';
        let message = '';
        if (term.type === 'cyber') {
          endingType = 'cyber';
          message = 'Подключение к Серверу установлено. Сознание загружено в сеть.';
        } else if (term.type === 'nature') {
          endingType = 'nature';
          message = 'Синтезатор активирован. Восстановлена биосфера планеты.';
        } else if (term.type === 'weapon') {
          endingType = 'weapon';
          message = 'Реактор перегружен. Станция и враждебная угроза уничтожены.';
        }

        io.to(room).emit('event-log', { type: 'ending', message });
        
        // Broadcast game completion after brief delay
        setTimeout(() => {
          io.to(room).emit('game-over', { endingType });
        }, 3000);
      }
    }
  });

  // Disconnect logic
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    const room = socket.sessionId;
    if (room) {
      const session = sessions.get(room);
      if (session) {
        if (session.organismSocketId === socket.id) {
          session.organismSocketId = null;
          socket.to(room).emit('player-disconnected', { role: 'organism' });
        }
        if (session.geneticistSocketId === socket.id) {
          session.geneticistSocketId = null;
          socket.to(room).emit('player-disconnected', { role: 'geneticist' });
        }

        // Clean up empty sessions
        if (!session.organismSocketId && !session.geneticistSocketId) {
          sessions.delete(room);
          console.log(`[Session] Cleaned up empty room: ${room}`);
        }
      }
    }
  });
});

// Periodic tick for health regen and charts syncing (every 1 second)
setInterval(() => {
  for (const [roomId, session] of sessions.entries()) {
    if (session.isDead) continue;
    
    // Regenerate health (if gills or other health regen mutation is active)
    const oldHealth = session.health;
    session.regenerateHealth();
    
    if (session.health !== oldHealth) {
      io.to(roomId).emit('health-updated', {
        health: session.health,
        maxHealth: session.maxHealth,
        isDead: session.isDead
      });
    }

    // Update charts data
    session.updateStatsHistory();

    // Send charts update to Geneticist
    if (session.geneticistSocketId) {
      io.to(session.geneticistSocketId).emit('sync-charts', {
        statsHistory: session.statsHistory
      });
    }
  }
}, 1000);

// Run the server
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` Evolutio Server is running on port ${PORT}`);
  console.log(` Access lobby at http://localhost:${PORT}`);
  console.log(`=========================================`);
});
