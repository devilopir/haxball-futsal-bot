const TokenManager = require('./src/utils/TokenManager');

const botId = process.env.BOT_ID || process.argv[2] || 'bot1';
process.env.BOT_ID = botId;

const config = require('./config');
const apiKey = config.twoCaptchaApiKey;

if (!apiKey) {
  console.error('twoCaptchaApiKey config.js dosyasında tanımlı değil!');
  process.exit(1);
}

console.log(`Token yenileme başlatılıyor (${botId})...`);
console.log('2Captcha API Key:', apiKey.substring(0, 8) + '...');

const tokenManager = new TokenManager(apiKey);

tokenManager.getTokenWithRetry(3)
  .then(token => {
    console.log('\n========================================');
    console.log('YENİ TOKEN BAŞARIYLA ALINDI!');
    console.log('========================================');
    console.log('Token:', token.substring(0, 30) + '...');
    console.log(`\ndata/tokens/${botId}.token dosyası güncellendi.`);
    console.log('Botu "npm start" ile başlatabilirsiniz.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Token alınamadı:', err.message);
    process.exit(1);
  });
