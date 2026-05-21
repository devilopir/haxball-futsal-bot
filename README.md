# Haxball Futsal Bot

Haxball için geliştirilmiş, çoklu oda destekli futsal botudur. Rotasyon sistemi, kaptan seçimi, istatistik takibi ve VIP sistemi gibi birçok özellik barındırır.

## Özellikler

**Oyun Sistemi**
- 1v1, 2v2 ve 3v3 futsal desteği (oyuncu sayısına göre otomatik harita geçişi)
- Adil rotasyon sistemi (kazanan kalır, kaybeden çıkar)
- Kaptan seçim modu (3v3 maçlarda takım kurma)
- Gol, asist, kendi kalesine gol takibi
- Kaleci tespiti ve kurtarış sayacı
- MVP hesaplama ve maç sonu istatistikleri
- Top hızı ve şut mesafesi ölçümü
- AFK tespit ve otomatik atma sistemi
- Oylama ile oyuncu atma

**Kullanıcı Sistemi**
- Kayıt/giriş sistemi (şifre ile)
- Rank sistemi (Bronze, Silver, Gold, Platinum, Diamond, Master, Legend)
- Puan bazlı oda erişim kısıtlaması
- Oyuncu profili ve pozisyon etiketi (GK, DEF, MID, FWD)
- Başarım sistemi (20+ farklı başarım)
- Günlük istatistik takibi

**VIP Sistemi**
- Karakter sevinci (Spinning, Fireworks, Shockwave)
- Gol efektleri (Patlama, Konfeti, Halkalar, Sahaya Yazı)
- Hareketli avatar (emoji geçişli)
- Gol sevinci mesajı
- AFK koruması (5 maç)
- Oyun duraklatma hakkı

**Yönetim**
- Çoklu oda yönetimi
- Oyuncu arama, sorgulama, ban/kick/mute
- Karaliste sistemi (süresiz ban + rank sıfırlama)
- Admin ve rol yönetimi
- Duyuru sistemi (anlık, giriş, periyodik)
- Küfür filtresi
- Owner koruma sistemi

## Proje Yapısı

```
bot.js                  Ana bot başlatıcı (HaxballRoomManager)
config.js               Yapılandırma
maps.js                 Harita tanımları (Training, V2, V3)
bots.json               Oda yapılandırmaları (roomType, proxy)

src/
  handlers/
    EventHandlers.js    Haxball event yöneticisi (mixin yapısı)
    mixins/             Event handler modülleri
      PlayerConnectionMixin.js   Giriş/çıkış, doğrulama
      ChatMixin.js               Sohbet sistemi, spam koruması
      GameLifecycleMixin.js      Oyun başlangıç/bitiş, takım renkleri
      GoalMixin.js               Gol, asist, game tick
      CelebrationMixin.js        Kutlama efektleri
      StatsMixin.js              İstatistik, başarım, maç kaydı
      TeamMixin.js               Takım değişikliği, admin değişikliği

  managers/
    AuthManager.js       Kayıt/giriş sistemi
    BanManager.js        Ban/karaliste yönetimi
    CaptainManager.js    Kaptan seçim sistemi
    GameFlowManager.js   Oyun akışı, harita değişimi, denge
    RotationManager.js   Rotasyon sistemi
    StatsManager.js      İstatistik hesaplama
    TeamManager.js       Takım dengeleme
    VoteManager.js       Oylama sistemi
    RoomSyncManager.js   Odalar arası senkronizasyon

  commands/
    CommandHandler.js    Komut yönlendirici
    PlayerCommands.js    Oyuncu ve admin komutları

  classes/
    RoomState.js         Oda durumu
    TimeoutManager.js    Zamanlayıcı yönetimi
    PlayerActivityTracker.js  AFK takibi
    LogManager.js        Log sistemi
    RateLimiter.js       Hız sınırlayıcı

  database/
    Database.js          PostgreSQL bağlantısı ve tablo şemaları

  filters/
    ProfanityFilter.js   Küfür filtresi
    profanityWords.js    Kelime listesi

  utils/
    constants.js         Sabitler (Team, GameMode, TIMING vb.)
    TokenManager.js      Haxball token yönetimi
    dataPath.js          Veri dizini yardımcısı
```

## Kurulum

### Gereksinimler
- Node.js 18+
- PostgreSQL 16+
- Docker ve Docker Compose (opsiyonel)

### 1. Dosyaları aç ve bağımlılıkları kur
```bash
cd haxball-futsal-bot
npm install
```

### 2. Yapılandırma
`config.js` dosyasını düzenle:
- `twoCaptchaApiKey`, 2Captcha API anahtarı
- `ownerNickname`, Owner nick
- `siteUrl`, Web sitesi adresi
- `databaseUrl`, PostgreSQL bağlantı adresi

Oda yapılandırmaları için `bots.json` dosyasını düzenle.

### 3. Veritabanını başlat
```bash
docker compose up -d postgres
```

### 4. Botu çalıştır
```bash
node bot.js
```

### Docker ile Çalıştırma
```bash
docker compose up -d
```

Bu komut PostgreSQL ve 6 bot odasını başlatır.

## Oyun İçi Komutlar

### Genel
| Komut | Açıklama |
|-------|----------|
| `!kayit <şifre>` | Hesap oluştur |
| `!giris <şifre>` | Giriş yap |
| `!rank` | Kendi rankını gör |
| `!top` | İlk 10 sıralama |
| `!yardım` | Komut listesi |
| `!oyla <oyuncu>` | Oyuncu atma oylaması başlat |

### VIP
| Komut | Açıklama |
|-------|----------|
| `!sevinç <mesaj>` | Gol sevinci mesajı |
| `!sevinctipi <tip>` | Karakter sevinci (spinning/fireworks/shockwave/none) |
| `!golefekt <tip>` | Gol efekti (goal_burst/goal_confetti/goal_rings/goal_text/none) |
| `!golyazi <mesaj>` | Sahaya yazı (max 5 harf) |
| `!avatar <e1> <e2>` | Hareketli avatar |
| `!pause` | Oyunu duraklat |

### Admin
| Komut | Açıklama |
|-------|----------|
| `!kick <oyuncu>` | Oyuncu at |
| `!ban <oyuncu>` | 3 günlük ban |
| `!mute <oyuncu> <süre>` | Sustur |
| `!unmute <oyuncu>` | Susturmayı kaldır |

## Mimari

- Her bot instance ayrı bir Docker container'da çalışır
- Tüm botlar ortak PostgreSQL veritabanını paylaşır
- `pending_commands` tablosu ile tüm odalara komut gönderilebilir
- `room_status` tablosu ile anlık oda durumları takip edilir
- Mixin pattern ile büyük dosyalar modüler parçalara bölünmüştür

