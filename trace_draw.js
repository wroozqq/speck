const fs = require('fs');
const vm = require('vm');

// Mock browser globals
const mockElement = {
  getContext: function() {
    return {
      save: function() {},
      restore: function() {},
      translate: function() {},
      rotate: function() {},
      scale: function() {},
      beginPath: function() {},
      arc: function() {},
      fill: function() {},
      stroke: function() {},
      ellipse: function() {},
      moveTo: function() {},
      lineTo: function() {},
      closePath: function() {},
      fillRect: function() {},
      strokeRect: function() {},
      fillText: function() {},
      quadraticCurveTo: function() {},
      createRadialGradient: function() {
        return { addColorStop: function() {} };
      },
      createLinearGradient: function() {
        return { addColorStop: function() {} };
      }
    };
  },
  addEventListener: function() {},
  classList: {
    add: function() {},
    remove: function() {}
  },
  style: {},
  clientWidth: 1000,
  clientHeight: 800,
  querySelector: function() { return mockElement; },
  appendChild: function() {},
  children: []
};
mockElement.parentElement = mockElement;

global.window = {
  innerWidth: 1000,
  innerHeight: 800,
  addEventListener: function() {}
};
global.document = {
  getElementById: function(id) {
    return mockElement;
  },
  querySelectorAll: function() { return [mockElement]; },
  addEventListener: function() {},
  createElement: function() { return mockElement; }
};
global.navigator = { userAgent: "" };
global.localStorage = {
  getItem: function() { return null; },
  setItem: function() {}
};
global.AudioContext = function() {
  return {
    state: 'suspended',
    resume: function() { return Promise.resolve(); }
  };
};
global.requestAnimationFrame = function() {};

let code = fs.readFileSync('game.js', 'utf8');

// Inject traces into Organism.draw
code = code.replace(
  "draw(ctx) {",
  "draw(ctx) { console.log(`[draw] Entering draw for: isPlayer=${this.isPlayer}, type=${this.type}`);"
);
code = code.replace(
  "if (this.isPlayer) {\n      ctx.save();\n      ctx.translate(this.x, this.y);",
  "if (this.isPlayer) {\n      console.log(`[draw] Entered isPlayer block`);\n      ctx.save();\n      ctx.translate(this.x, this.y);"
);
code = code.replace(
  "if (stage === 1) {",
  "console.log(`[draw] Stage check: stage=${stage}`); if (stage === 1) { console.log(`[draw] Entered stage 1 block`);"
);
code = code.replace(
  "} else if (stage === 2) {",
  "} else if (stage === 2) { console.log(`[draw] Entered stage 2 block`);"
);
code = code.replace(
  "} else if (stage === 3) {",
  "} else if (stage === 3) { console.log(`[draw] Entered stage 3 block`);"
);
code = code.replace(
  "} else {\n        // ==========================================\n        // STAGE 4: STEEL KNIGHT",
  "} else {\n        console.log(`[draw] Entered stage 4 block`);\n        // ==========================================\n        // STAGE 4: STEEL KNIGHT"
);
code = code.replace(
  "} else if (this.type === 'boss') {",
  "} else if (this.type === 'boss') {\n      console.log(`[draw] Entered type===boss block`);"
);
code = code.replace(
  "} else {\n      // Player Hatchling/Drake/Dragon Models",
  "} else {\n      console.log(`[draw] Entered fallback else block`);\n      // Player Hatchling/Drake/Dragon Models"
);

code = code.replace('let player;', 'var player;');
code = code.replace('let bots =', 'var bots =');
code = code.replace('const state =', 'var state =');

const script = new vm.Script(code);
const context = vm.createContext(global);
script.runInContext(context);

// Initialize simulation
context.initSimulation();

console.log("=== Drawing Player ===");
context.player.draw(mockElement.getContext('2d'));

console.log("\n=== Drawing Boss ===");
const boss = context.bots.find(b => b.type === 'boss');
boss.draw(mockElement.getContext('2d'));
