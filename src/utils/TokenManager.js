const puppeteer = require('puppeteer');
const Captcha = require('2captcha');
const fs = require('fs');

class TokenManager {
  constructor(apiKey) {
    this.solver = new Captcha.Solver(apiKey);
    this.tokenUrl = 'https://www.haxball.com/headlesstoken';
  }

  async getNewToken() {
    let browser = null;

    try {
      console.log('[TokenManager] Browser başlatılıyor...');

      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      console.log('[TokenManager] Haxball token sayfası açılıyor...');
      await page.goto(this.tokenUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      console.log('[TokenManager] Site key alınıyor...');
      const siteKey = await page.evaluate(() => {
        const recaptchaDiv = document.querySelector('.g-recaptcha');
        if (recaptchaDiv) {
          return recaptchaDiv.getAttribute('data-sitekey');
        }
        const iframe = document.querySelector('iframe[src*="recaptcha"]');
        if (iframe) {
          const src = iframe.getAttribute('src');
          const match = src.match(/k=([^&]+)/);
          if (match) return match[1];
        }
        return null;
      });

      if (!siteKey) {
        throw new Error('reCAPTCHA site key bulunamadı');
      }

      console.log('[TokenManager] Site key:', siteKey);
      console.log('[TokenManager] 2Captcha ile reCAPTCHA çözülüyor...');

      const captchaResponse = await this.solver.recaptcha(siteKey, this.tokenUrl);

      console.log('[TokenManager] Captcha çözüldü, token alınıyor...');

      await page.evaluate((response) => {
        const textarea = document.getElementById('g-recaptcha-response');
        if (textarea) {
          textarea.style.display = 'block';
          textarea.value = response;
        }
      }, captchaResponse.data);

      console.log('[TokenManager] Form submit ediliyor...');

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.click('input[type="submit"]')
      ]);

      console.log('[TokenManager] Sayfa yüklendi, token aranıyor...');

      const bodyText = await page.evaluate(() => document.body.innerText);

      const tokenMatch = bodyText.match(/"(thr1\.[^"]+)"/);
      if (!tokenMatch) {
        console.log('[TokenManager] Token bulunamadı, sayfa içeriği:', bodyText.substring(0, 100));
        throw new Error('Token parse edilemedi');
      }

      let token = tokenMatch[1];

      console.log('[TokenManager] Token başarıyla alındı!');
      return token.trim();

    } catch (error) {
      console.error('[TokenManager] Hata:', error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async refreshToken() {
    try {
      const newToken = await this.getNewToken();
      const config = require('../../config');

      const tokenDir = config.tokenDir;
      const tokenPath = config.tokenPath;

      if (!fs.existsSync(tokenDir)) {
        fs.mkdirSync(tokenDir, { recursive: true });
      }

      fs.writeFileSync(tokenPath, newToken.trim() + '\n');

      process.env.HAXBALL_TOKEN = newToken;

      console.log(`[TokenManager] ${tokenPath} güncellendi`);
      return newToken;

    } catch (error) {
      console.error('[TokenManager] Token yenileme hatası:', error.message);
      throw error;
    }
  }

  async getTokenWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.refreshToken();
      } catch (error) {
        console.error(`[TokenManager] Deneme ${i + 1}/${maxRetries} başarısız:`, error.message);
        if (i < maxRetries - 1) {
          console.log('[TokenManager] 5 saniye sonra tekrar denenecek...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    throw new Error('Token alınamadı, tüm denemeler başarısız');
  }
}

module.exports = TokenManager;
