const fs = require('fs');
const content = fs.readFileSync('game.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes("this.type === 'rat'") && line.includes('else if')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
