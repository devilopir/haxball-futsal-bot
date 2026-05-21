const fs = require('fs');
const path = require('path');

function loadMap(filename) {
  const filePath = path.join(__dirname, 'maps', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  TRAINING: loadMap('training-map.hbs'),
  V2: loadMap('v2-map.hbs'),
  V3: loadMap('v3-map.hbs')
};
