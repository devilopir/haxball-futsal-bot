const { Team, ABBREVIATIONS } = require('../utils/constants');
const config = require('../../config');
const db = require('../database/Database');

class PlayerCommands {
    constructor(roomManager) {
        this.rm = roomManager;
        this.afkKickEnabled = true;
        this.chatEnabled = true;
        this.playerMutes = new Map();

        this.tempMuteNotice = new Map();
        this.vipPauseLimits = new Map();
        this.vipPauseTimeout = null;
        this.announcementInterval = null;
        this.ataturkInterval = null;
        this.animatedAvatars = new Map();
        this.avatarPending = new Map();
        this._avatarLoopRunning = false;
        this.ataturkQuotes = [
            "Hayatta en hakiki mürşit ilimdir, fendir.",
            "Egemenlik kayıtsız şartsız milletindir.",
            "Yurtta sulh, cihanda sulh.",
            "Benim naçiz vücudum elbet bir gün toprak olacaktır, ancak Türkiye Cumhuriyeti ilelebet payidar kalacaktır.",
            "Ey Türk gençliği! Birinci vazifen; Türk istiklalini, Türk cumhuriyetini, ilelebet muhafaza ve müdafaa etmektir.",
            "Bir milletin varlığını devam ettirebilmesi için o milletin kültürüne sahip çıkması şarttır.",
            "Dünyada her şey için, medeniyet için, hayat için, muvaffakiyet için en hakiki mürşit ilimdir, fendir.",
            "Hâkimiyet veraset yoluyla hiçbir ferde veya hanedana teslim edilemez.",
            "Beni görmek demek mutlaka yüzümü görmek değildir. Benim fikirlerimi, benim duygularımı anlıyorsanız ve hissediyorsanız bu yeterlidir.",
            "Bir ulusun gerçek kurtuluşu ancak fikir hürriyetine dayanarak olur.",
            "Ülkemizi dünya milletleri arasında en medenî ve en müreffeh bir vaziyete çıkarmak için çalışacağız.",
            "Cumhuriyet bir şahsın, bir ailenin malı değildir. Cumhuriyet, milletin malıdır.",
            "Muhtaç olduğumuz şey, fikir hürriyetine dayanan bir düzen ve emniyettir.",
            "Asıl vatanı koruyacak olan, köy sınırlarında yaşayan ve hakikî manada sade, faal, çalışkan olan köylülerimizdir.",
            "Şunu da unutmayınız ki, asla ümitsizliğe düşmeyiniz. Millet umudunu korur ve onu muhafaza ederse, kurtuluş yakındır.",
            "İstikbal göklerdedir.",
            "Milletimizin karakterinde tembelliğe ve miskinliğe yer yoktur.",
            "Zafer, 'zafer benimdir' diyebilenindir. Başarı ise, başarı için çalışanlarındır.",
            "Biz ilhamlarımızı gökten ve gaipten değil, doğrudan doğruya hayattan almış bulunuyoruz.",
            "Türkiye Cumhuriyeti şeyhler, dervişler, müritler, meczuplar memleketi olamaz. En doğru, en hakiki tarikat, medeniyet tarikatıdır.",
            "Eğer bir gün benim sözlerim bilimle ters düşerse, bilimi seçin.",
            "Milli egemenlik öyle bir nurdur ki, onun karşısında zincirler erir, taç ve tahtlar batar, mahvolur.",
            "İdare-i maslahatçılar esaslı devrim yapamazlar.",
            "Bizi yanlış yola sevk eden soysuzlar, bilirsiniz ki çok kere din perdesine bürünmüşler, saf ve temiz halkımızı hep din kuralları sözleriyle aldata gelmişlerdir.",
            "Bağımsızlık benim karakterimdir!",
            "Ya istiklal ya ölüm!",
            "Geldikleri gibi giderler!",
            "Umutsuz durumlar yoktur, umutsuz insanlar vardır. Ben hiçbir zaman umudumu yitirmedim.",
            "Muhtaç olduğun kudret, damarlarındaki asil kanda mevcuttur!",
            "Zafer, 'Zafer benimdir' diyebilenindir. Başarı ise, 'Başaracağım' diye başlayarak sonunda 'Başardım' diyebilenindir.",
            "Hattı müdafaa yoktur, sathı müdafaa vardır. O satıh bütün vatandır.",
            "Hiçbir şeye ihtiyacımız yok, yalnız bir şeye ihtiyacımız vardır; çalışkan olmak!",
            "İlk hedefiniz Akdeniz'dir. İleri!",
            "Büyük işleri yalnız büyük milletler yapar.",
            "Çalışmadan, yorulmadan, üretmeden, rahat yaşamak isteyen toplumlar; önce haysiyetlerini, sonra hürriyetlerini ve daha sonra da istiklal ve istikballerini kaybetmeye mahkumdurlar.",
            "Vatanını en çok seven, görevini en iyi yapandır.",
            "Yerinde duran, geriye gidiyor demektir… İleri, daima ileri!",
            "Dinlenmemek üzere yola çıkanlar asla ve asla yorulmazlar.",
            "Benim manevi mirasım ilim ve akıldır.",
            "Bütün ümidim gençliktedir.",
            "Ey yükselen yeni nesil! İstikbal sizsiniz. Cumhuriyeti biz kurduk, onu yaşatacak ve yüceltecek olan sizsiniz.",
            "Gençler! Cesaretimizi takviye ve idame eden sizlersiniz.",
            "Biz cahil dediğimiz zaman, mektepte okumamış olanları kastetmiyoruz. Kastettiğimiz ilim, hakikati bilmektir.",
            "Yolunda yürüyen bir yolcunun yalnız ufku görmesi kafi değildir. Muhakkak ufkun ötesini de görmesi ve bilmesi lazımdır.",
            "Öğretmenler; yeni nesli, Cumhuriyetin fedakâr öğretmen ve eğitimcileri, sizler yetiştireceksiniz ve yeni nesil, sizin eseriniz olacaktır.",
            "Bir millet sanattan ve sanatkardan yoksunsa tam bir hayata malik olamaz.",
            "Sanatsız kalan bir milletin hayat damarlarından biri kopmuş demektir.",
            "Ne mutlu Türküm diyene!",
            "Özgürlük olmayan bir memlekette ölüm ve çöküş vardır.",
            "Adalet gücü bağımsız olmayan bir milletin, devlet halinde varlığı kabul olunamaz.",
            "Savaş zaruri ve hayati olmalıdır. Milletin hayatı tehlikeye maruz kalmadıkça savaş bir cinayettir.",
            "Dünyada her şey kadının eseridir.",
            "Ey kahraman Türk kadını, sen yerde sürünmeye değil, omuzlar üzerinde göklere yükselmeye layıksın.",
            "İnsan topluluğu kadın ve erkek denilen iki cins insandan mürekkeptir. Mümkün müdür ki, bir cismin yarısı toprağa zincirle bağlı kaldıkça öteki kısmı göklere yükselebilsin?",
            "Tarih yazmak, tarih yapmak kadar mühimdir. Yazan yapana sadık kalmazsa değişmeyen hakikat insanlığı şaşırtacak bir mahiyet alır.",
            "Biz Türkler tarih boyunca hürriyet ve istiklale timsal olmuş bir milletiz.",
            "İki Mustafa Kemal vardır: Biri ben, et ve kemik, geçici Mustafa Kemal... İkinci Mustafa Kemal, onu 'ben' kelimesiyle ifade edemem; o, ben değil, bizdir!",
            "Bir ulus, sımsıkı birbirine bağlı olmayı bildikçe yeryüzünde onu dağıtabilecek bir güç düşünülemez.",
            "Kendiniz için değil, bağlı bulunduğunuz ulus için elbirliği ile çalışınız. Çalışmaların en yükseği budur.",
            "Millet sevgisi kadar büyük mükafat yoktur.",
            "Memleket mutlaka çağdaş, medeni ve yepyeni olacaktır. Bizim için bu, hayat davasıdır.",
            "Bizim başka milletlerden hiçbir eksiğimiz yoktur. Cesuruz, zekiyiz, çalışkanız. Yüksek amaçlar uğrunda ölmesini biliriz.",
            "Ben gerektiği zaman en büyük hediyem olmak üzere, Türk milletine canımı vereceğim."
        ];
        this.startAnnouncementInterval();
        this.startAtaturkQuotes();
    }

    async tempMuteAuth(auth, durationMs, reason = '') {
        if (!auth) return false;
        const ms = Number(durationMs) || 0;
        if (ms <= 0) return false;
        const until = Date.now() + ms;
        try {
            await db.run(
                `INSERT INTO temp_mutes (auth, until_ts, reason) VALUES (?, ?, ?)
                 ON CONFLICT (auth) DO UPDATE SET until_ts = EXCLUDED.until_ts, reason = EXCLUDED.reason`,
                [auth, until, String(reason || '')]
            );
        } catch (e) {
            console.error('[TEMP_MUTE] DB write error:', e.message);
        }
        return true;
    }

    async clearTempMuteAuth(auth) {
        if (!auth) return false;
        try {
            const existing = await db.get('SELECT id FROM temp_mutes WHERE auth = ?', [auth]);
            if (!existing) return false;
            await db.run('DELETE FROM temp_mutes WHERE auth = ?', [auth]);
            return true;
        } catch (e) {
            console.error('[TEMP_MUTE] DB delete error:', e.message);
            return false;
        }
    }

    async isTempMuted(auth) {
        if (!auth) return false;
        try {
            const row = await db.get('SELECT until_ts FROM temp_mutes WHERE auth = ?', [auth]);
            if (!row) return false;
            if (Date.now() >= row.until_ts) {
                await db.run('DELETE FROM temp_mutes WHERE auth = ?', [auth]);
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    async getTempMuteRemainingSeconds(auth) {
        if (!auth) return 0;
        try {
            const row = await db.get('SELECT until_ts FROM temp_mutes WHERE auth = ?', [auth]);
            if (!row) return 0;
            const ms = row.until_ts - Date.now();
            if (ms <= 0) return 0;
            return Math.ceil(ms / 1000);
        } catch (e) {
            return 0;
        }
    }

    shouldNotifyTempMute(playerId, windowMs = 10000) {
        const now = Date.now();
        const last = this.tempMuteNotice.get(playerId) || 0;
        if (now - last < windowMs) return false;
        this.tempMuteNotice.set(playerId, now);
        return true;
    }

    parseDurationMs(raw) {
        const s = String(raw || '').trim().toLowerCase();
        if (!s) return 0;
        const m = s.match(/^(\d+(?:\.\d+)?)([a-zçğıöşü]*)$/i);
        if (!m) return 0;
        const n = Number(m[1]);
        if (!Number.isFinite(n) || n <= 0) return 0;
        const unit = String(m[2] || '').toLowerCase() || 'dk';
        if (unit === 'sn' || unit === 's' || unit === 'sec' || unit === 'secs' || unit === 'second' || unit === 'seconds') return Math.round(n * 1000);
        if (unit === 'dk' || unit === 'm' || unit === 'min' || unit === 'mins' || unit === 'minute' || unit === 'minutes') return Math.round(n * 60 * 1000);
        if (unit === 'sa' || unit === 'saat' || unit === 'h' || unit === 'hr' || unit === 'hour' || unit === 'hours') return Math.round(n * 60 * 60 * 1000);
        if (unit === 'g' || unit === 'gun' || unit === 'day' || unit === 'days') return Math.round(n * 24 * 60 * 60 * 1000);
        return 0;
    }

    formatDurationLabel(ms) {
        const m = Number(ms) || 0;
        if (m <= 0) return '0sn';
        if (m >= 24 * 60 * 60 * 1000) return `${Math.ceil(m / (24 * 60 * 60 * 1000))} gün`;
        if (m >= 60 * 60 * 1000) return `${Math.ceil(m / (60 * 60 * 1000))} saat`;
        if (m >= 60 * 1000) return `${Math.ceil(m / (60 * 1000))} dk`;
        return `${Math.ceil(m / 1000)} sn`;
    }

    async logAdminAction(actionType, adminName, targetName, targetAuth, reason) {
        const roomName = config.roomConfig?.roomName || 'Bilinmeyen Oda';
        try {
            await db.run(
                `INSERT INTO action_logs (action_type, admin_name, target_name, target_auth, reason, room_name) VALUES (?, ?, ?, ?, ?, ?)`,
                [actionType, adminName, targetName, targetAuth || '', reason, roomName]
            );
        } catch (e) {
            console.error('[ADMIN_LOG] DB write error:', e.message);
        }
    }

    async getCelebration(auth) {
        const row = await db.get('SELECT message FROM celebrations WHERE auth = ?', [auth]);
        return row?.message || null;
    }

    async saveCelebration(auth, message) {
        const existing = await db.get('SELECT id FROM celebrations WHERE auth = ?', [auth]);
        if (existing) {
            await db.run('UPDATE celebrations SET message = ? WHERE auth = ?', [message, auth]);
        } else {
            await db.run('INSERT INTO celebrations (auth, message) VALUES (?, ?)', [auth, message]);
        }
    }

    async deleteCelebration(auth) {
        await db.run('DELETE FROM celebrations WHERE auth = ?', [auth]);
    }

    async _loadAnimatedAvatar(playerId, auth) {
        if (!auth) return;
        const settings = await db.get('SELECT animated_avatar, avatar_speed FROM vip_settings WHERE auth = ?', [auth]);
        if (!settings || !settings.animated_avatar) return;
        try {
            const frames = JSON.parse(settings.animated_avatar);
            if (!Array.isArray(frames) || frames.length < 2) return;
            this.animatedAvatars.set(playerId, {
                frames,
                speed: (settings.avatar_speed || 1) * 1000,
                index: 0,
                lastTick: Date.now(),
            });
            this.rm.room.setPlayerAvatar(playerId, frames[0]);
            this._startAvatarLoop();
        } catch (e) {}
    }

    _startAvatarLoop() {
        if (this._avatarLoopRunning) return;
        this._avatarLoopRunning = true;
        this._avatarInterval = setInterval(() => {
            if (this.animatedAvatars.size === 0) return;
            const now = Date.now();
            for (const [playerId, data] of this.animatedAvatars) {
                if (now - data.lastTick < data.speed) continue;
                data.index = (data.index + 1) % data.frames.length;
                data.lastTick = now;
                try {
                    this.rm.room.setPlayerAvatar(playerId, data.frames[data.index]);
                } catch (e) {
                    this.animatedAvatars.delete(playerId);
                }
            }
        }, 250);
    }

    stopAnimatedAvatar(playerId) {
        this.animatedAvatars.delete(playerId);
        try {
            this.rm.room.setPlayerAvatar(playerId, null);
        } catch (e) {}
        if (this.animatedAvatars.size === 0 && this._avatarInterval) {
            clearInterval(this._avatarInterval);
            this._avatarLoopRunning = false;
            this._avatarInterval = null;
        }
    }

    async getJoinAnnouncement() {
        const row = await db.get("SELECT message FROM announcements WHERE type = 'join'");
        return row?.message || null;
    }

    async setJoinAnnouncement(message) {
        const existing = await db.get("SELECT id FROM announcements WHERE type = 'join'");
        if (existing) {
            await db.run("UPDATE announcements SET message = ? WHERE type = 'join'", [message]);
        } else {
            await db.run("INSERT INTO announcements (type, message) VALUES ('join', ?)", [message]);
        }
    }

    async clearJoinAnnouncement() {
        await db.run("DELETE FROM announcements WHERE type = 'join'");
    }

    async getPeriodicAnnouncement() {
        return await db.get("SELECT message, interval_minutes FROM announcements WHERE type = 'periodic'");
    }

    async startAnnouncementInterval() {
        if (this.announcementInterval) {
            clearInterval(this.announcementInterval);
            this.announcementInterval = null;
        }
        const periodic = await this.getPeriodicAnnouncement();
        if (periodic?.message && periodic?.interval_minutes) {
            await this.setPeriodicAnnouncement(periodic.message, periodic.interval_minutes);
        }
    }

    async setPeriodicAnnouncement(message, intervalMinutes) {
        if (this.announcementInterval) {
            clearInterval(this.announcementInterval);
        }

        const existing = await db.get("SELECT id FROM announcements WHERE type = 'periodic'");
        if (existing) {
            await db.run("UPDATE announcements SET message = ?, interval_minutes = ? WHERE type = 'periodic'", [message, intervalMinutes]);
        } else {
            await db.run("INSERT INTO announcements (type, message, interval_minutes) VALUES ('periodic', ?, ?)", [message, intervalMinutes]);
        }

        this.announcementInterval = setInterval(() => {
            if (this.rm?.room) {
                this.rm.room.sendAnnouncement(`${message}`, null, 0xFFFF00, 'bold', 1);
            }
        }, intervalMinutes * 60 * 1000);
    }

    async clearPeriodicAnnouncement() {
        if (this.announcementInterval) {
            clearInterval(this.announcementInterval);
            this.announcementInterval = null;
        }
        await db.run("DELETE FROM announcements WHERE type = 'periodic'");
    }

    startAtaturkQuotes() {
        this.ataturkInterval = setInterval(() => {
            if (this.rm?.room && this.ataturkQuotes.length > 0) {
                const randomQuote = this.ataturkQuotes[Math.floor(Math.random() * this.ataturkQuotes.length)];
                this.rm.room.sendAnnouncement(
                    `🇹🇷 ${randomQuote}`,
                    null, 0xFF0000, 'bold', 2
                );
            }
        }, 5 * 60 * 1000);
    }

    async logChat(auth, playerName, message) {
        if (!auth) return;
        await db.run(
            'INSERT INTO chat_logs (auth, player_name, message) VALUES (?, ?, ?)',
            [auth, playerName, message]
        );
    }

    async getPlayerChatLogs(auth) {
        if (!auth) return [];
        return await db.all(
            'SELECT * FROM chat_logs WHERE auth = ? ORDER BY created_at DESC LIMIT 100',
            [auth]
        );
    }

    async addPermanentMute(auth, name, reason) {
        const existing = await db.get('SELECT id FROM permanent_mutes WHERE auth = ?', [auth]);
        if (existing) return false;
        await db.run(
            'INSERT INTO permanent_mutes (auth, name, reason) VALUES (?, ?, ?)',
            [auth, name, reason]
        );
        return true;
    }

    async removePermanentMute(auth) {
        const existing = await db.get('SELECT id FROM permanent_mutes WHERE auth = ?', [auth]);
        if (!existing) return false;
        await db.run('DELETE FROM permanent_mutes WHERE auth = ?', [auth]);
        return true;
    }

    async isPermanentlyMuted(auth) {
        if (!auth) return false;
        const mute = await db.get('SELECT * FROM permanent_mutes WHERE auth = ?', [auth]);
        return !!mute;
    }

    async getPermanentMuteList() {
        return await db.all('SELECT * FROM permanent_mutes ORDER BY muted_at DESC');
    }

    isAdmin(player) {
        if (!player?.id) return false;
        try {
            const p = this.rm.room?.getPlayer?.(player.id);
            if (p?.admin) return true;
        } catch (e) {}
        try {
            const list = this.rm.room?.getPlayerList?.() || [];
            const p = list.find(x => x.id === player.id);
            if (p?.admin) return true;
        } catch (e) {}
        const authData = this.rm.getPlayerAuthData(player.id);
        if (!authData?.auth) return false;
        return this.rm.authManager?.getLoggedInUser(player.id)?.isAdmin === true;
    }

    isOwnerNickname(name) {
        const owner = config.ownerNickname;
        if (!owner) return false;
        return String(name || '').toLowerCase() === owner.toLowerCase();
    }

    async notifyOwnerProtection(attackerPlayer, targetName, action) {
        const attackerName = typeof attackerPlayer === 'string' ? attackerPlayer : attackerPlayer?.name || '?';
        const attackerId = typeof attackerPlayer === 'object' ? attackerPlayer?.id : null;
        const roomName = config.roomConfig?.roomName || '';

        if (attackerId) {
            const attackerAuth = this.rm.getPlayerAuthData(attackerId);
            if (attackerAuth?.auth) {
                await this.rm.banManager.ban(
                    attackerName,
                    attackerAuth.auth,
                    attackerAuth.conn,
                    `Owner'a ${action} denemesi`,
                    'Sistem'
                );
                await this.logAdminAction('KARALISTE', 'Sistem', attackerName, attackerAuth.auth, `Owner'a ${action} denemesi`);
            }
            this.rm.room.sendAnnouncement(
                `${attackerName} karalisteye alındı!`,
                null, 0xFF0000, 'bold', 2
            );
            this.rm.safeKickPlayer(attackerId, `Owner'a işlem denemesi — karalisteye alındın`, true);
        }

    }

    sendPrivate(playerId, message, color = 0xFFFFFF) {
        this.rm.room.sendAnnouncement(message, playerId, color, 'normal', 1);
    }

    async handleKayit(player, args) {
        const password = args[0];

        if (!password) {
            this.sendPrivate(player.id, 'Kullanım: !kayit <şifre>', 0xFF6600);
            return;
        }

        const authData = this.rm.getPlayerAuthData(player.id);
        if (!authData?.auth) {
            this.sendPrivate(player.id, 'Hata: Auth bulunamadı!', 0xFF0000);
            return;
        }

        if (await this.rm.authManager.isRegistered(authData.auth, player.name)) {
            this.sendPrivate(player.id, 'Bu nick ile zaten kayıtlısın! Giriş için: !giris <şifre>', 0xFFFF00);
            return;
        }

        if (password.length < 4) {
            this.sendPrivate(player.id, 'Şifre en az 4 karakter olmalı!', 0xFF0000);
            return;
        }

        if (password.length > 20) {
            this.sendPrivate(player.id, 'Şifre en fazla 20 karakter olabilir!', 0xFF0000);
            return;
        }

        if (password.includes(' ')) {
            this.sendPrivate(player.id, 'Şifre boşluk içeremez!', 0xFF0000);
            return;
        }

        const result = await this.rm.authManager.register(authData.auth, password, player.name);

        if (result.success) {
            await this.rm.authManager.autoLogin(player.id, authData.auth, authData.conn, player.name);
            this.sendPrivate(player.id, 'Kayıt başarılı! Artık istatistiklerin tutulacak.', 0x00FF00);
        } else {
            this.sendPrivate(player.id, `Kayıt hatası: ${result.error}`, 0xFF0000);
        }
    }

    async handleGiris(player, args) {
        const password = args[0];

        if (!password) {
            this.sendPrivate(player.id, 'Kullanım: !giris <şifre>', 0xFF6600);
            return;
        }

        const authData = this.rm.getPlayerAuthData(player.id);
        if (!authData?.auth) {
            this.sendPrivate(player.id, 'Hata: Auth bulunamadı!', 0xFF0000);
            return;
        }

        if (this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Zaten giriş yapmışsın!', 0xFFFF00);
            return;
        }

        if (!(await this.rm.authManager.isNicknameTaken(player.name))) {
            this.sendPrivate(player.id, 'Bu nick ile kayıtlı değilsin! Kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const result = await this.rm.authManager.login(authData.auth, player.name, password);

        if (result.success) {
            const isAdmin = result.user.is_admin === 1;
            this.rm.authManager.loggedInPlayers.set(player.id, {
                userId: result.user.id,
                auth: authData.auth,
                nickname: result.user.nickname,
                isAdmin,
                isVip: result.user.allowed_room === 'vip'
            });
            if (isAdmin) this.rm.room.setPlayerAdmin(player.id, true);
            this.sendPrivate(player.id, `Giriş başarılı! Hoşgeldin ${result.user.nickname}`, 0x00FF00);
            await this._loadAnimatedAvatar(player.id, authData.auth);
        } else {
            this.sendPrivate(player.id, result.error || 'Yanlış şifre!', 0xFF0000);
        }
    }

    async handleSifreDegistir(player, args) {
        if (args.length < 2) {
            this.sendPrivate(player.id, 'Kullanım: !sifredegistir <eski_şifre> <yeni_şifre>', 0xFF6600);
            return;
        }

        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Önce giriş yapman gerekiyor!', 0xFF0000);
            return;
        }

        const [oldPassword, newPassword] = args;
        const authData = this.rm.getPlayerAuthData(player.id);

        if (newPassword.length < 4) {
            this.sendPrivate(player.id, 'Yeni şifre en az 4 karakter olmalı!', 0xFF0000);
            return;
        }

        if (newPassword.length > 20) {
            this.sendPrivate(player.id, 'Yeni şifre en fazla 20 karakter olabilir!', 0xFF0000);
            return;
        }

        const result = await this.rm.authManager.changePassword(authData.auth, player.name, oldPassword, newPassword);

        if (result.success) {
            this.sendPrivate(player.id, 'Şifren başarıyla değiştirildi!', 0x00FF00);
        } else {
            this.sendPrivate(player.id, result.error, 0xFF0000);
        }
    }

    async handleRename(player, args) {
        const newNick = args.join(' ').trim();

        if (!newNick) {
            this.sendPrivate(player.id, 'Kullanım: !rename <yeni_nick>', 0xFF6600);
            return;
        }

        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Önce giriş yapman gerekiyor!', 0xFF0000);
            return;
        }

        if (newNick.length < 2) {
            this.sendPrivate(player.id, 'Nick en az 2 karakter olmalı!', 0xFF0000);
            return;
        }

        if (newNick.length > 20) {
            this.sendPrivate(player.id, 'Nick en fazla 20 karakter olabilir!', 0xFF0000);
            return;
        }

        const profanityFilter = this.rm.eventHandlers?.profanityFilter;
        if (profanityFilter?.enabled && profanityFilter.check(newNick)) {
            this.sendPrivate(player.id, 'Nickte uygunsuz ifade tespit edildi!', 0xFF0000);
            return;
        }

        const authData = this.rm.getPlayerAuthData(player.id);
        const loggedUser = this.rm.authManager.getLoggedInUser(player.id);
        const oldNick = loggedUser.nickname;

        const existingUser = await this.rm.authManager.isNicknameTaken(newNick, loggedUser.userId);
        if (existingUser) {
            this.sendPrivate(player.id, `"${newNick}" nicki zaten kullanılıyor!`, 0xFF0000);
            return;
        }

        const result = await this.rm.authManager.changeNickname(authData.auth, newNick, loggedUser.nickname);
        if (!result.success) {
            this.sendPrivate(player.id, result.error || 'Nick değiştirme başarısız!', 0xFF0000);
            return;
        }

        loggedUser.nickname = newNick;
        this.rm.authManager.loggedInPlayers.set(player.id, loggedUser);

        this.rm.room.sendAnnouncement(
            `${oldNick} nickini "${newNick}" olarak değiştirdi!`,
            null, 0x00FFFF, 'normal', 1
        );

        this.sendPrivate(player.id, `Nick başarıyla değiştirildi! 5 saniye sonra kickleneceksin, "${newNick}" nickiyle tekrar gir.`, 0x00FF00);

        this.rm.timeouts.set('renameKick_' + player.id, () => {
            this.rm.safeKickPlayer(player.id, `Yeni nickin: ${newNick} - Bu nick ile tekrar gir!`, false);
        }, 5000);
    }

    async handleHesap(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Giriş yapmamışsın! Kayıt: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const loggedUser = this.rm.authManager.getLoggedInUser(player.id);
        const user = await this.rm.authManager.getUserByAuthAndNick(loggedUser.auth, loggedUser.nickname);

        this.sendPrivate(player.id, '━━━ HESAP BİLGİLERİN ━━━', 0x00FFFF);
        this.sendPrivate(player.id, `Nick: ${user.nickname}`, 0xFFFFFF);
        this.sendPrivate(player.id, `Kayıt: ${new Date(user.created_at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}`, 0xFFFFFF);
        this.sendPrivate(player.id, `Son giriş: ${user.last_login ? new Date(user.last_login).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '-'}`, 0xFFFFFF);
        this.sendPrivate(player.id, `Admin: ${user.is_admin ? 'Evet' : 'Hayır'}`, 0xFFFFFF);
    }

    handleBb(player, args) {
        this.rm.safeKickPlayer(player.id, 'Görüşürüz!', false);
    }

    async handleSira(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Sıralama için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const leaderboard = await this.rm.statsManager.getLeaderboard(5);
        const totalPlayers = await this.rm.statsManager.getTotalPlayers();

        if (leaderboard.length === 0) {
            this.rm.room.sendAnnouncement('Henüz sıralama yok!', null, 0xFFFF00, 'normal', 1);
            return;
        }

        const list = leaderboard.map(p => {
            const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : `${p.position}.`;
            return `${medal}${p.name}(${p.points}P)`;
        }).join(' | ');

        this.rm.room.sendAnnouncement(`🏆 TOP 5: ${list}`, null, 0x00FFFF, 'normal', 1);
        this.rm.room.sendAnnouncement(`Toplam ${totalPlayers} kayıtlı oyuncu`, null, 0x888888, 'normal', 1);
    }

    async handleSiram(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Sıralama için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const loggedUser = this.rm.authManager.getLoggedInUser(player.id);
        const position = await this.rm.statsManager.getPlayerPosition(loggedUser.userId);
        const totalPlayers = await this.rm.statsManager.getTotalPlayers();
        const stats = await this.rm.statsManager.getPlayerStats(loggedUser.userId);

        if (!position || !stats) {
            this.rm.room.sendAnnouncement(`${player.name} henüz sıralamada yok`, null, 0xFFFF00, 'normal', 1);
            return;
        }

        const streakText = stats.bestWinStreak > 0 ? ` | 🔥 ${stats.bestWinStreak} seri` : '';
        const activeStreak = stats.currentWinStreak >= 3 ? ` (aktif: ${stats.currentWinStreak})` : '';
        this.rm.room.sendAnnouncement(
            `🏆 ${player.name} #${position}/${totalPlayers} | ${stats.rank.emoji} ${stats.points}P${streakText}${activeStreak}`,
            null, 0x00FFFF, 'normal', 1
        );
    }

    handleYardim(player, args) {
        this.sendPrivate(player.id, '!kayit <şifre> | !giris <şifre> | !hesap | !rename <nick> | !bb | !afk', 0x00FFFF);
        this.sendPrivate(player.id, '!rank | !gizlirank | !top | !puan | !gol | !asist | !cs | !mvp | !sıra | !sıram', 0x00FFFF);
        this.sendPrivate(player.id, '!galibiyet | !mağlubiyet | !serisiralama | !statyardim | !kısaltmalar | !kurallar', 0x00FFFF);
        this.sendPrivate(player.id, '!t <mesaj> Takım chati | !s <mesaj> Spec chati | !pm <oyuncu> <mesaj> | !pmute', 0x00FFFF);
        this.sendPrivate(player.id, '!mevki <gk|def|mid|fwd> | !mevkisil | !oyla <oyuncu> | !evet | !admin | !dc', 0x00FFFF);
        this.sendPrivate(player.id, '!davetkodu | !site | !online | !gecmis', 0x00FFFF);
        if (this.rm.authManager?.getLoggedInUser(player.id)?.isVip || this.isAdmin(player)) {
            this.sendPrivate(player.id, '⭐ VIP: !vipyardım — Tüm VIP komutlarını göster', 0xFFD700);
        }
        if (this.isAdmin(player)) {
            this.sendPrivate(player.id, '!adminyardım — Admin komutlarını göster', 0xFF6600);
        }
    }

    handleKurallar(player, args) {
        this.rm.room.sendAnnouncement('ADK-DDK-Milli/Manevi değerlere küfür = Kalıcı BAN | Trollemek Ban sebebidir', null, 0xFF6600, 'bold', 1);
        this.rm.room.sendAnnouncement('Admin çağırmak için: !admin <mesaj>', null, 0x00FFFF, 'bold', 1);
    }

    async handleOnline(player, args) {
        const rooms = await this.rm.roomSync.loadAllRoomStatus();
        const entries = Object.entries(rooms).filter(([, r]) => r.total > 0);
        if (entries.length === 0) {
            this.sendPrivate(player.id, 'Şu an kimse online değil.', 0xFF6600);
            return;
        }
        let totalOnline = 0;
        entries.sort((a, b) => b[1].total - a[1].total);
        const parts = [];
        for (const [, room] of entries) {
            const status = (room.red > 0 && room.blue > 0) ? '⚽' : '⏸';
            totalOnline += room.total;
            const shortName = room.roomName.replace(/.*Futsal\s*/i, '');
            parts.push(`${status}${shortName}(${room.total})`);
        }
        this.sendPrivate(player.id, `Online ${totalOnline} | ${parts.join(' ')}`, 0x00FFFF);
    }

    async handleGecmis(player, args) {
        const authData = this.rm.getPlayerAuthData(player.id);
        const playerAuth = authData?.auth;
        const limit = 5;

        let matches;
        if (args.length > 0 && args[0].toLowerCase() === 'hepsi') {
            matches = await db.all(
                `SELECT * FROM match_replays WHERE bot_id = ? ORDER BY id DESC LIMIT ?`,
                [config.botId, limit]
            );
        } else if (playerAuth) {
            matches = await db.all(
                `SELECT * FROM match_replays WHERE (red_auths LIKE ? OR blue_auths LIKE ?) ORDER BY id DESC LIMIT ?`,
                [`%${playerAuth}%`, `%${playerAuth}%`, limit]
            );
        } else {
            matches = await db.all(
                `SELECT * FROM match_replays WHERE bot_id = ? ORDER BY id DESC LIMIT ?`,
                [config.botId, limit]
            );
        }

        if (!matches || matches.length === 0) {
            this.sendPrivate(player.id, 'Maç geçmişi bulunamadı.', 0xFF6600);
            return;
        }

        const lines = matches.map(m => {
            const winEmoji = m.winner === 'red' ? '🔴' : m.winner === 'blue' ? '🔵' : '🤝';
            const date = new Date(m.created_at);
            const timeStr = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
            let myResult = '';
            if (playerAuth) {
                const wasRed = (m.red_auths || '').includes(playerAuth);
                const wasBlue = (m.blue_auths || '').includes(playerAuth);
                if (wasRed) myResult = m.winner === 'red' ? '✅' : m.winner === 'draw' ? '🤝' : '❌';
                else if (wasBlue) myResult = m.winner === 'blue' ? '✅' : m.winner === 'draw' ? '🤝' : '❌';
            }
            return `${winEmoji}${m.red_score}-${m.blue_score} ${myResult} ${timeStr}`;
        });

        this.sendPrivate(player.id, `Son ${matches.length} Maç: ${lines.join(' | ')}`, 0x00FFFF);
    }

    handleVipYardim(player, args) {
        this.sendPrivate(player.id, '⭐ VIP KOMUTLARI', 0xFFD700);
        this.sendPrivate(player.id, '!sevinç <mesaj> — Gol sevinci mesajı ayarla', 0x00FFFF);
        this.sendPrivate(player.id, '!sevinçsil — Gol sevincini sil', 0x00FFFF);
        this.sendPrivate(player.id, '!sevinctipi <tip> — Karakter sevinci (spinning/fireworks/shockwave/none)', 0x00FFFF);
        this.sendPrivate(player.id, '!golefekt <tip> — Gol efekti (goal_burst/goal_confetti/goal_rings/goal_text/none)', 0x00FFFF);
        this.sendPrivate(player.id, '!golyazi <mesaj> — Gol yazısı (golefekt goal_text olmalı, max 5 harf)', 0x00FFFF);
        this.sendPrivate(player.id, '!avatar <emoji1> <emoji2> ... — Hareketli avatar (max 5 frame, her biri max 4 karakter)', 0x00FFFF);
        this.sendPrivate(player.id, '!avatarsil — Hareketli avatarı kaldır', 0x00FFFF);
        this.sendPrivate(player.id, '!pause — Oyunu duraklat (maç başına 1 hak)', 0x00FFFF);
    }

    async handleSevinc(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Sevinç ayarlamak için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const authData = this.rm.getPlayerAuthData(player.id);
        const message = args.join(' ').trim();
        const isAdminOrVip = this.isAdmin(player) || this.rm.authManager?.getLoggedInUser(player.id)?.isVip;

        if (!message) {
            const current = await this.getCelebration(authData.auth);
            if (current) {
                this.sendPrivate(player.id, `Mevcut sevincin: "${current}"`, 0x00FFFF);
            } else if (isAdminOrVip) {
                this.sendPrivate(player.id, 'Kullanım: !sevinç <mesaj> (örn: !sevinç Bu gol sana gelsin!)', 0xFF6600);
            } else {
                this.sendPrivate(player.id, 'Sevinç özelliği sadece VIP ve adminler içindir.', 0xFF6600);
            }
            return;
        }

        if (!isAdminOrVip) {
            this.sendPrivate(player.id, 'Sevinç ayarlamak sadece VIP ve adminler içindir.', 0xFF0000);
            return;
        }

        if (message.length > 100) {
            this.sendPrivate(player.id, 'Sevinç mesajı en fazla 100 karakter olabilir!', 0xFF0000);
            return;
        }

        await this.saveCelebration(authData.auth, message);
        this.sendPrivate(player.id, `Gol sevincin ayarlandı: "${message}"`, 0x00FF00);
    }

    async handleSevincsil(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Önce giriş yap!', 0xFF0000);
            return;
        }

        const authData = this.rm.getPlayerAuthData(player.id);
        const current = await this.getCelebration(authData.auth);

        if (current) {
            await this.deleteCelebration(authData.auth);
            this.sendPrivate(player.id, 'Gol sevincin silindi!', 0x00FF00);
        } else {
            this.sendPrivate(player.id, 'Zaten tanımlı bir sevincin yok!', 0xFFFF00);
        }
    }

    async _ensureVipSettings(auth) {
        const existing = await db.get('SELECT auth FROM vip_settings WHERE auth = ?', [auth]);
        if (!existing) await db.run('INSERT INTO vip_settings (auth) VALUES (?)', [auth]);
    }

    async handleSevincTipi(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) { this.sendPrivate(player.id, 'Önce giriş yap!', 0xFF0000); return; }
        const isVip = this.isAdmin(player) || this.rm.authManager?.getLoggedInUser(player.id)?.isVip;
        if (!isVip) { this.sendPrivate(player.id, 'Bu özellik sadece VIP ve adminler içindir.', 0xFF0000); return; }

        const types = ['spinning', 'fireworks', 'shockwave', 'none'];
        const tip = String(args[0] || '').toLowerCase();
        if (!tip || !types.includes(tip)) {
            this.sendPrivate(player.id, `Kullanım: !sevinctipi <${types.join('/')}>`, 0xFF6600);
            return;
        }

        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        await this._ensureVipSettings(auth);
        await db.run('UPDATE vip_settings SET celebration_type = ?, goal_celebration = ? WHERE auth = ?', [tip === 'none' ? 'spinning' : tip, tip === 'none' ? 0 : 1, auth]);
        this.sendPrivate(player.id, tip === 'none' ? 'Karakter sevinci kapatıldı.' : `Karakter sevinci: ${tip}`, 0x00FF00);
    }

    async handleGolEfekt(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) { this.sendPrivate(player.id, 'Önce giriş yap!', 0xFF0000); return; }
        const isVip = this.isAdmin(player) || this.rm.authManager?.getLoggedInUser(player.id)?.isVip;
        if (!isVip) { this.sendPrivate(player.id, 'Bu özellik sadece VIP ve adminler içindir.', 0xFF0000); return; }

        const types = ['goal_burst', 'goal_confetti', 'goal_rings', 'goal_text', 'none'];
        const tip = String(args[0] || '').toLowerCase();
        if (!tip || !types.includes(tip)) {
            this.sendPrivate(player.id, `Kullanım: !golefekt <${types.join('/')}>`, 0xFF6600);
            return;
        }

        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        await this._ensureVipSettings(auth);
        await db.run('UPDATE vip_settings SET goal_effect_type = ?, goal_effect_enabled = ? WHERE auth = ?', [tip === 'none' ? 'goal_burst' : tip, tip === 'none' ? 0 : 1, auth]);
        this.sendPrivate(player.id, tip === 'none' ? 'Gol efekti kapatıldı.' : `Gol efekti: ${tip}`, 0x00FF00);
    }

    async handleGolYazi(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) { this.sendPrivate(player.id, 'Önce giriş yap!', 0xFF0000); return; }
        const isVip = this.isAdmin(player) || this.rm.authManager?.getLoggedInUser(player.id)?.isVip;
        if (!isVip) { this.sendPrivate(player.id, 'Bu özellik sadece VIP ve adminler içindir.', 0xFF0000); return; }

        const text = args.join(' ').trim().toUpperCase();
        if (!text || text.length > 5) {
            this.sendPrivate(player.id, 'Kullanım: !golyazi <mesaj> (max 5 karakter)', 0xFF6600);
            return;
        }

        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        await this._ensureVipSettings(auth);
        await db.run('UPDATE vip_settings SET goal_text_message = ?, goal_effect_type = ?, goal_effect_enabled = 1 WHERE auth = ?', [text, 'goal_text', auth]);
        this.sendPrivate(player.id, `Gol yazısı: "${text}" (efekt otomatik goal_text olarak ayarlandı)`, 0x00FF00);
    }

    async handleAvatar(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) { this.sendPrivate(player.id, 'Önce giriş yap!', 0xFF0000); return; }
        const isVip = this.isAdmin(player) || this.rm.authManager?.getLoggedInUser(player.id)?.isVip;
        if (!isVip) { this.sendPrivate(player.id, 'Bu özellik sadece VIP ve adminler içindir.', 0xFF0000); return; }

        if (args.length < 2 || args.length > 5) {
            this.sendPrivate(player.id, 'Kullanım: !avatar <emoji1> <emoji2> ... (2-5 frame)', 0xFF6600);
            this.sendPrivate(player.id, 'Örn: !avatar 😀 😎 🔥', 0xAAAAAA);
            return;
        }

        for (const frame of args) {
            if ([...frame].length > 4) {
                this.sendPrivate(player.id, `"${frame}" çok uzun! Her frame max 4 karakter.`, 0xFF0000);
                return;
            }
        }

        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        await this._ensureVipSettings(auth);
        await db.run('UPDATE vip_settings SET animated_avatar = ? WHERE auth = ?', [JSON.stringify(args), auth]);
        await this._loadAnimatedAvatar(player.id, auth);
        this.sendPrivate(player.id, `Hareketli avatar ayarlandı: ${args.join(' → ')}`, 0x00FF00);
    }

    async handleAvatarSil(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) { this.sendPrivate(player.id, 'Önce giriş yap!', 0xFF0000); return; }

        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        await db.run('UPDATE vip_settings SET animated_avatar = NULL WHERE auth = ?', [auth]);
        this.stopAnimatedAvatar(player.id);
        this.sendPrivate(player.id, 'Hareketli avatar kaldırıldı.', 0x00FF00);
    }

    handleAdminYardim(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }

        this.sendPrivate(player.id, '!kick <oyuncu> — Oyuncuyu at', 0xFFFFFF);
        this.sendPrivate(player.id, '!ban <oyuncu> | !unban <oyuncu>', 0xFFFFFF);
        this.sendPrivate(player.id, '!mute <#id/isim> <süre> | !unmute <#id/isim>', 0xFFFFFF);
        this.sendPrivate(player.id, '!chatkapat / !chatac | !kickkapat / !kickac', 0xFFFFFF);
        this.sendPrivate(player.id, '!a <mesaj> — Admin sohbeti (sadece adminler görür)', 0xFFFFFF);
        this.sendPrivate(player.id, '!afklar — AFK oyuncuları listele', 0xFFFFFF);
        this.sendPrivate(player.id, '!dengesiz — Takım dengesi kontrolünü aç/kapat (3v2 vb.)', 0xFFFFFF);
    }

    handleAdminChat(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }
        const msg = args.join(' ').trim();
        if (!msg) {
            this.sendPrivate(player.id, 'Kullanım: !a <mesaj>', 0xFF6600);
            return;
        }
        const admins = this.rm.getRealPlayers().filter(p => this.isAdmin(p));
        admins.forEach(a => {
            this.rm.room.sendAnnouncement(
                `[Admin] ${player.name}: ${msg}`,
                a.id, 0x4488FF, 'bold', 2
            );
        });
    }

    handleAfkList(player) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }
        const afkPlayers = this.rm.playerActivity.getAFKPlayers();
        if (afkPlayers.length === 0) {
            this.sendPrivate(player.id, 'AFK oyuncu yok.', 0x00FF00);
            return;
        }
        this.sendPrivate(player.id, `━━━ AFK Oyuncular (${afkPlayers.length}) ━━━`, 0xFF6600);
        afkPlayers.forEach(p => {
            this.sendPrivate(player.id, `💤 ${p.name} (${p.matchCount} maçtır AFK)`, 0xFFFFFF);
        });
    }

    handleKisaltmalar(player, args) {
        const abbrevList = Object.entries(ABBREVIATIONS);
        const perLine = 6;

        this.sendPrivate(player.id, 'Kısaltmalar (yazınca çevrilir):', 0x00FFFF);

        for (let i = 0; i < abbrevList.length; i += perLine) {
            const chunk = abbrevList.slice(i, i + perLine);
            const line = chunk.map(([k, v]) => `${k}=${v}`).join(' | ');
            this.sendPrivate(player.id, line, 0xFFFFFF);
        }
    }

    handleAfk(player, args) {
        const { Team, GameMode } = require('../utils/constants');
        const MAPS = require('../../maps');
        const isCurrentlyAFK = this.rm.playerActivity.isAFK(player.id);
        const isTraining = this.rm.state.currentMap === MAPS.TRAINING;
        const isPlaying = player.team === Team.RED || player.team === Team.BLUE;
        const isRotating = this.rm.state.mode === GameMode.ROTATING || this.rm.state.pendingRotation;

        if (isCurrentlyAFK) {
            this.rm.playerActivity.removeAFK(player.id);
            this.rm.room.sendAnnouncement(`${player.name} AFK'dan çıktı`, null, 0x00FF00, 'normal', 1);

            if (isRotating || this.rm.state.isCaptainMode()) {
                if (this.rm.state.isCaptainMode()) {
                    this.rm.captainManager.showSelectionList();
                }
                return;
            }

            if (this.rm.state.gameInProgress && isTraining && player.team === Team.SPECTATORS) {
                const redCount = this.rm.getRealPlayers().filter(p => p.team === Team.RED).length;
                const blueCount = this.rm.getRealPlayers().filter(p => p.team === Team.BLUE).length;
                if (redCount === 0) this.rm.safeSetTeam(player.id, Team.RED);
                else if (blueCount === 0) this.rm.safeSetTeam(player.id, Team.BLUE);
                else if (redCount <= blueCount) this.rm.safeSetTeam(player.id, Team.RED);
                else this.rm.safeSetTeam(player.id, Team.BLUE);
            } else if (this.rm.state.gameInProgress && !isTraining) {
                this.rm.gameFlow.checkMapUpgrade();
            } else {
                this.rm.gameFlow.scheduleBalance();
            }
        } else {
            if (isPlaying && this.rm.state.gameInProgress && !isTraining && !this.rm.state.isCaptainMode()) {
                this.sendPrivate(player.id, 'Oyun devam ederken AFK çekemezsin!', 0xFF0000);
                return;
            }

            const wasPlaying = isPlaying;
            const playerTeam = player.team;

            if (this.rm.state.isCaptainMode() &&
                this.rm.state.getCurrentCaptain()?.id === player.id) {
                const { Team } = require('../utils/constants');
                const teamPlayers = this.rm.getRealPlayers().filter(p => p.team === Team.BLUE && p.id !== player.id);
                if (teamPlayers.length > 0) {
                    const remaining = this.rm.state.getRemainingSelections();
                    this.rm.state.endCaptainMode();
                    this.rm.state.startCaptainMode(teamPlayers[0], remaining);
                    this.rm.captainManager.showSelectionList();
                    this.rm.captainManager.startCaptainTimeout();
                } else {
                    this.rm.captainManager.endCaptainSelection(true);
                }
            }

            this.rm.playerActivity.setAFK(player.id, player.name);

            if (!wasPlaying && this.rm.state.isCaptainMode()) {
                this.rm.captainManager.showSelectionList(true);
            }

            if (wasPlaying) {
                this.rm.safeSetTeam(player.id, Team.SPECTATORS);

                this.rm.room.sendAnnouncement(
                    `${player.name} AFK moduna geçti (3 maç sonra atılır)`,
                    null, 0xFFFF00, 'bold', 1
                );

                if (isRotating) {
                    return;
                }

                if (this.rm.state.isCaptainMode()) {
                    this.rm.captainManager.showSelectionList(true);
                    return;
                }

                if (this.rm.state.gameInProgress) {
                    this.findReplacementPlayer(playerTeam);
                } else {
                    this.rm.gameFlow.scheduleBalance();
                }
            } else {
                this.rm.room.sendAnnouncement(
                    `${player.name} AFK moduna geçti (3 maç sonra atılır)`,
                    null, 0xFFFF00, 'bold', 1
                );
            }
        }
    }



    async handleDavetKodu(player) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Önce giriş yap: !giris <şifre>', 0xFF0000);
            return;
        }
        const authData = this.rm.getPlayerAuthData(player.id);
        if (!authData?.auth) return;
        const user = this.rm.authManager.getLoggedInUser(player.id);
        const nickname = user?.nickname || player.name;
        const existing = await db.get('SELECT code FROM invite_codes WHERE auth = ? AND used = 0 AND created_at > ?', [authData.auth, Date.now() - 300000]);
        if (existing) {
            this.sendPrivate(player.id, `Davet kodun: ${existing.code}`, 0x5865F2);
            this.sendPrivate(player.id, 'Kod 5dk geçerli.', 0xAAAAAA);
            return;
        }
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        await db.run('DELETE FROM invite_codes WHERE auth = ?', [authData.auth]);
        await db.run('INSERT INTO invite_codes (code, auth, nickname, created_at) VALUES (?, ?, ?, ?)', [code, authData.auth, nickname, Date.now()]);
        this.sendPrivate(player.id, `Davet kodun: ${code}`, 0x5865F2);
        this.sendPrivate(player.id, 'Kod 5 dakika geçerli.', 0xAAAAAA);
    }

    async handleAdminCagir(player, args) {
        this.sendPrivate(player.id, 'Admin çağrı sistemi şu an aktif değil.', 0xFF6600);
    }

    handleKickkapat(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }

        this.afkKickEnabled = false;
        this.rm.room.sendAnnouncement(
            'AFK atma sistemi kapatıldı',
            null, 0xFF6600, 'bold', 1
        );
    }

    handleKickac(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }

        this.afkKickEnabled = true;
        const players = this.rm.getRealPlayers().filter(p => p.team === 1 || p.team === 2);
        players.forEach(p => this.rm.playerActivity.update(p.id));
        this.rm.gameFlow?.warnedPlayers?.clear();
        this.rm.room.sendAnnouncement(
            'AFK atma sistemi açıldı',
            null, 0x00FF00, 'bold', 1
        );
    }

    isAfkKickEnabled() {
        return this.afkKickEnabled;
    }

    isChatEnabled() {
        return this.chatEnabled;
    }

    handleChatkapat(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }

        this.chatEnabled = false;
        this.rm.room.sendAnnouncement('Chat kapatıldı', null, 0xFF6600, 'bold', 1);
    }

    handleChatac(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }

        this.chatEnabled = true;
        this.rm.room.sendAnnouncement('Chat açıldı', null, 0x00FF00, 'bold', 1);
    }

    handleDengesiz(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }

        this.rm.state.unbalancedMode = !this.rm.state.unbalancedMode;
        if (this.rm.state.unbalancedMode) {
            this.rm.room.sendAnnouncement('Dengesiz mod açıldı — takım dengesi kontrolü devre dışı', null, 0xFFD700, 'bold', 1);
        } else {
            this.rm.room.sendAnnouncement('Dengesiz mod kapatıldı — takım dengesi kontrolü aktif', null, 0x00FF00, 'bold', 1);
        }
    }

    async handleRank(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'İstatistik için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const loggedUser = this.rm.authManager.getLoggedInUser(player.id);
        const stats = await this.rm.statsManager.getPlayerStats(loggedUser.userId);
        const position = await this.rm.statsManager.getPlayerPosition(loggedUser.userId);

        if (!stats) {
            this.sendPrivate(player.id, 'İstatistik bulunamadı!', 0xFF0000);
            return;
        }

        const cs = stats.cleanSheets || 0;
        const rankLine = `${stats.rank.emoji} ${player.name} | ${stats.rank.name} #${position || '?'} | ${stats.points}P | ${stats.matches}M ${stats.wins}G/${stats.losses}M (%${stats.winRate}) | ${stats.goals}G ${stats.assists}A ${stats.ownGoals}KK ${cs}CS | MVP:${stats.mvpCount}`;
        this.rm.room.sendAnnouncement(rankLine, null, 0x00FFFF, 'normal', 1);
    }

    async handleGizliRank(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'İstatistik için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const loggedUser = this.rm.authManager.getLoggedInUser(player.id);
        const stats = await this.rm.statsManager.getPlayerStats(loggedUser.userId);
        const position = await this.rm.statsManager.getPlayerPosition(loggedUser.userId);

        if (!stats) {
            this.sendPrivate(player.id, 'İstatistik bulunamadı!', 0xFF0000);
            return;
        }

        const cs = stats.cleanSheets || 0;
        const nextInfo = stats.nextRank ? ` | Sonraki: ${stats.nextRank.emoji} ${stats.nextRank.name} (${stats.pointsToNext}P kaldı)` : ' | MAX RANK';
        const rankLine = `${stats.rank.emoji} ${player.name} | ${stats.rank.name} #${position || '?'} | ${stats.points}P${nextInfo}`;
        const statsLine = `${stats.matches}M ${stats.wins}G/${stats.losses}M (%${stats.winRate}) | ${stats.goals}G ${stats.assists}A ${stats.ownGoals}KK ${cs}CS | MVP:${stats.mvpCount} | En yüksek: ${stats.peakPoints}P`;
        this.sendPrivate(player.id, rankLine, 0x00FFFF);
        this.sendPrivate(player.id, statsLine, 0xAAAAAA);
    }

    async handleMevki(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Mevki seçmek için giriş yap!', 0xFF0000);
            return;
        }

        const POSITIONS = {
            'GK': 'GK', 'KAL': 'GK', 'KALECİ': 'GK', 'KALECİ': 'GK',
            'DEF': 'DEF', 'DEFANS': 'DEF',
            'MID': 'MID', 'OS': 'MID', 'ORTA': 'MID',
            'FWD': 'FWD', 'FRV': 'FWD', 'FORVET': 'FWD'
        };

        const input = args[0]?.toUpperCase().replace(/İ/g, 'İ').replace(/I/g, 'I');
        const normalized = input ? POSITIONS[input] : null;

        if (!normalized) {
            this.sendPrivate(player.id, 'Kullanım: !mevki <gk|def|mid|fwd>', 0xFF6600);
            this.sendPrivate(player.id, 'GK=Kaleci | DEF=Defans | MID=Orta Saha | FWD=Forvet', 0xAAAAAA);
            return;
        }

        const loggedUser = this.rm.authManager.getLoggedInUser(player.id);
        await db.run('UPDATE users SET position = ? WHERE id = ?', [normalized, loggedUser.userId]);
        this.sendPrivate(player.id, `Mevkin ayarlandı: ${normalized}`, 0x00FF00);
    }

    handleVipPause(player, args) {
        const loggedUser = this.rm.authManager?.getLoggedInUser(player.id);
        if (!loggedUser?.isVip && !loggedUser?.isAdmin) {
            this.sendPrivate(player.id, 'Bu komut sadece VIP oyuncular için!', 0xFF6600);
            return;
        }

        if (!this.rm.state.gameInProgress) {
            this.sendPrivate(player.id, 'Oyun devam etmiyor!', 0xFF6600);
            return;
        }

        if (this.vipPauseTimeout) {
            this.sendPrivate(player.id, 'Zaten aktif bir VIP pause var!', 0xFF6600);
            return;
        }

        const today = new Date().toDateString();
        const auth = this.rm.getPlayerAuthData(player.id)?.auth;
        if (!auth) return;

        const limitData = this.vipPauseLimits.get(auth) || { date: '', count: 0 };
        const count = limitData.date === today ? limitData.count : 0;

        if (count >= 2) {
            this.sendPrivate(player.id, 'Günlük pause hakkın bitti! (2/2)', 0xFF6600);
            return;
        }

        this.vipPauseLimits.set(auth, { date: today, count: count + 1 });

        this.rm.room.pauseGame(true);
        this.rm.room.sendAnnouncement(
            `${player.name} oyunu durdurdu! 10 saniye sonra devam edecek... (${count + 1}/2)`,
            null, 0xFFD700, 'bold', 1
        );

        this.vipPauseTimeout = setTimeout(() => {
            this.vipPauseTimeout = null;
            if (this.rm.state.gameInProgress) {
                this.rm.room.pauseGame(false);
                this.rm.room.sendAnnouncement('Oyun devam ediyor!', null, 0x00FF00, 'bold', 1);
            }
        }, 10000);
    }

    async handleMevkiSil(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Önce giriş yap!', 0xFF0000);
            return;
        }

        const loggedUser = this.rm.authManager.getLoggedInUser(player.id);
        await db.run('UPDATE users SET position = NULL WHERE id = ?', [loggedUser.userId]);
        this.sendPrivate(player.id, 'Mevkin kaldırıldı.', 0xAAAAAA);
    }

    async handleSeriSiralama(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Seri sıralaması için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const leaderboard = await this.rm.statsManager.getStreakLeaderboard(5);

        if (leaderboard.length === 0) {
            this.sendPrivate(player.id, 'Henüz seri verisi yok!', 0xFF6600);
            return;
        }

        this.sendPrivate(player.id, '━━━ 🔥 EN UZUN SERİLER ━━━', 0x00FFFF);
        leaderboard.forEach(p => {
            const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : `${p.position}.`;
            const active = p.currentStreak >= 3 ? ` (🔴 aktif: ${p.currentStreak})` : '';
            this.sendPrivate(player.id, `${medal} ${p.name} | 🏆 ${p.bestStreak} seri | ${p.rank.emoji} ${p.points}P${active}`, 0xFFFFFF);
        });
    }

    handleStatYardim(player, args) {
        this.sendPrivate(player.id, '🥉Bronze 0 | 🥈Silver 200 | 🥇Gold 500 | 💎Platinum 1000 | 👑Diamond 2000 | 🔥Master 3500 | ⭐Legend 5000', 0x00FFFF);
        this.sendPrivate(player.id, 'Galibiyet +10 | Gol +3 | Asist +2 | MVP +5 | CS +4 | Hat-trick +8', 0x00FF00);
        this.sendPrivate(player.id, 'Mağlubiyet -5 | Kendi Kalesine -8', 0xFF6600);
        this.sendPrivate(player.id, 'P=Puan M=Maç W=Win L=Loss G=Gol A=Asist KK=Kendi Kale CS=Clean Sheet', 0xFFFFFF);
        this.sendPrivate(player.id, 'Top listeleri: !top | !puan | !galibiyet | !mağlubiyet | !gol | !asist | !cs | !mvp | !serisiralama', 0x00FFFF);
    }

    async handleTop(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Top listesi için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const leaderboard = await this.rm.statsManager.getLeaderboard(5);

        if (leaderboard.length === 0) {
            this.sendPrivate(player.id, 'Henüz istatistik yok!', 0xFF6600);
            return;
        }

        this.sendPrivate(player.id, '━━━ TOP 5 ━━━', 0x00FFFF);
        leaderboard.forEach(p => {
            const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : `${p.position}.`;
            this.sendPrivate(player.id, `${medal} ${p.name} | ${p.rank.emoji} ${p.points}P | ${p.wins}G`, 0xFFFFFF);
        });
    }

    async handleGol(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Gol sıralaması için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const leaderboard = await this.rm.statsManager.getStatLeaderboard('goals', 5);
        if (leaderboard.length === 0 || (leaderboard[0]?.value || 0) <= 0) {
            this.sendPrivate(player.id, 'Henüz gol istatistiği yok!', 0xFF6600);
            return;
        }

        this.sendPrivate(player.id, '━━━ GOL TOP 5 ━━━', 0x00FFFF);
        leaderboard.forEach(p => {
            const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : `${p.position}.`;
            this.sendPrivate(player.id, `${medal} ${p.name} | ${p.value}G | ${p.rank.emoji} ${p.points}P`, 0xFFFFFF);
        });
    }

    async handleAsist(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Asist sıralaması için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const leaderboard = await this.rm.statsManager.getStatLeaderboard('assists', 5);
        if (leaderboard.length === 0 || (leaderboard[0]?.value || 0) <= 0) {
            this.sendPrivate(player.id, 'Henüz asist istatistiği yok!', 0xFF6600);
            return;
        }

        this.sendPrivate(player.id, '━━━ ASİST TOP 5 ━━━', 0x00FFFF);
        leaderboard.forEach(p => {
            const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : `${p.position}.`;
            this.sendPrivate(player.id, `${medal} ${p.name} | ${p.value}A | ${p.rank.emoji} ${p.points}P`, 0xFFFFFF);
        });
    }

    async handleCs(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'CS sıralaması için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const leaderboard = await this.rm.statsManager.getStatLeaderboard('cs', 5);
        if (leaderboard.length === 0 || (leaderboard[0]?.value || 0) <= 0) {
            this.sendPrivate(player.id, 'Henüz CS istatistiği yok!', 0xFF6600);
            return;
        }

        this.sendPrivate(player.id, '━━━ CS TOP 5 ━━━', 0x00FFFF);
        leaderboard.forEach(p => {
            const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : `${p.position}.`;
            this.sendPrivate(player.id, `${medal} ${p.name} | ${p.value}CS | ${p.rank.emoji} ${p.points}P`, 0xFFFFFF);
        });
    }

    async handleMvp(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'MVP sıralaması için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const leaderboard = await this.rm.statsManager.getStatLeaderboard('mvp', 5);
        if (leaderboard.length === 0 || (leaderboard[0]?.value || 0) <= 0) {
            this.sendPrivate(player.id, 'Henüz MVP istatistiği yok!', 0xFF6600);
            return;
        }

        this.sendPrivate(player.id, '━━━ MVP TOP 5 ━━━', 0x00FFFF);
        leaderboard.forEach(p => {
            const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : `${p.position}.`;
            this.sendPrivate(player.id, `${medal} ${p.name} | MVP:${p.value} | ${p.rank.emoji} ${p.points}P`, 0xFFFFFF);
        });
    }

    async handleGalibiyet(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Galibiyet sıralaması için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const leaderboard = await this.rm.statsManager.getStatLeaderboard('wins', 5);
        if (leaderboard.length === 0 || (leaderboard[0]?.value || 0) <= 0) {
            this.sendPrivate(player.id, 'Henüz galibiyet istatistiği yok!', 0xFF6600);
            return;
        }

        this.sendPrivate(player.id, '━━━ GALİBİYET TOP 5 ━━━', 0x00FFFF);
        leaderboard.forEach(p => {
            const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : `${p.position}.`;
            this.sendPrivate(player.id, `${medal} ${p.name} | ${p.value}W | ${p.rank.emoji} ${p.points}P`, 0xFFFFFF);
        });
    }

    async handleMaglubiyet(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Mağlubiyet sıralaması için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const leaderboard = await this.rm.statsManager.getStatLeaderboard('losses', 5);
        if (leaderboard.length === 0 || (leaderboard[0]?.value || 0) <= 0) {
            this.sendPrivate(player.id, 'Henüz mağlubiyet istatistiği yok!', 0xFF6600);
            return;
        }

        this.sendPrivate(player.id, '━━━ MAĞLUBİYET TOP 5 ━━━', 0x00FFFF);
        leaderboard.forEach(p => {
            const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : `${p.position}.`;
            this.sendPrivate(player.id, `${medal} ${p.name} | ${p.value}L | ${p.rank.emoji} ${p.points}P`, 0xFFFFFF);
        });
    }

    async handlePuan(player, args) {
        if (!this.rm.authManager.isLoggedIn(player.id)) {
            this.sendPrivate(player.id, 'Puan sıralaması için kayıt ol: !kayit <şifre>', 0xFFFF00);
            return;
        }

        const leaderboard = await this.rm.statsManager.getLeaderboard(5);
        if (leaderboard.length === 0 || (leaderboard[0]?.points || 0) <= 0) {
            this.sendPrivate(player.id, 'Henüz puan istatistiği yok!', 0xFF6600);
            return;
        }

        this.sendPrivate(player.id, '━━━ PUAN TOP 5 ━━━', 0x00FFFF);
        leaderboard.forEach(p => {
            const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : `${p.position}.`;
            this.sendPrivate(player.id, `${medal} ${p.name} | ${p.rank.emoji} ${p.points}P | ${p.wins}G/${p.losses}M`, 0xFFFFFF);
        });
    }

    async handleTeamChat(player, args) {
        if (player.team === Team.SPECTATORS) return;
        const message = args.join(' ').trim();
        if (!message) return;

        const authData = this.rm.getPlayerAuthData(player.id);
        const style = await this.rm.eventHandlers.getPlayerChatStyle(authData?.auth);
        const teamPlayers = this.rm.getRealPlayers().filter(p => p.team === player.team);
        const teamColor = player.team === Team.RED ? 0xE56E56 : 0x5689E5;
        const teamLabel = player.team === Team.RED ? 'KRM' : 'MVI';

        teamPlayers.forEach(p => {
            this.rm.room.sendAnnouncement(
                `${style.prefix} ${player.name}: ${message}`,
                p.id, teamColor, 'normal', 1
            );
        });

        const admins = this.rm.getRealPlayers().filter(p => this.isAdmin(p) && p.team !== player.team);
        admins.forEach(a => {
            this.rm.room.sendAnnouncement(
                `[${teamLabel}] ${player.name}: ${message}`,
                a.id, 0x888888, 'italic', 0
            );
        });
    }

    async handleSpecChat(player, args) {
        if (player.team !== Team.SPECTATORS) return;
        const message = args.join(' ').trim();
        if (!message) return;

        const authData = this.rm.getPlayerAuthData(player.id);
        const style = await this.rm.eventHandlers.getPlayerChatStyle(authData?.auth);
        const specPlayers = this.rm.getRealPlayers().filter(p => p.team === Team.SPECTATORS);

        specPlayers.forEach(p => {
            this.rm.room.sendAnnouncement(
                `${style.prefix} ${player.name}: ${message}`,
                p.id, 0x888888, 'normal', 1
            );
        });

        const admins = this.rm.getRealPlayers().filter(p => this.isAdmin(p) && p.team !== Team.SPECTATORS);
        admins.forEach(a => {
            this.rm.room.sendAnnouncement(
                `[SEYRC] ${player.name}: ${message}`,
                a.id, 0x888888, 'italic', 0
            );
        });
    }

    async handleKick(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }
        if (args.length < 1) {
            this.sendPrivate(player.id, 'Kullanım: !kick <oyuncu>', 0xFF6600);
            return;
        }

        const players = this.rm.getRealPlayers();
        let targetPlayer = null;

        const idMatch = args[0].match(/^#(\d+)$/);
        if (idMatch) {
            const pid = Number(idMatch[1]);
            if (Number.isFinite(pid)) targetPlayer = players.find(p => p.id === pid) || null;
            if (!targetPlayer) { this.sendPrivate(player.id, 'Bu id ile oyuncu bulunamadı!', 0xFF0000); return; }
        } else {
            const q = args[0].trim().toLowerCase();
            const exact = players.filter(p => p.id !== player.id && p.name.toLowerCase() === q);
            if (exact.length === 1) { targetPlayer = exact[0]; }
            else {
                const partial = players.filter(p => p.id !== player.id && p.name.toLowerCase().includes(q));
                if (partial.length === 1) targetPlayer = partial[0];
                else if (partial.length > 1) {
                    this.sendPrivate(player.id, `Birden fazla eşleşme: ${partial.slice(0, 10).map(p => '#' + p.id + ' ' + p.name).join(' | ')}`, 0xFF6600);
                    this.sendPrivate(player.id, '!kick #id kullan', 0xFF6600);
                    return;
                }
            }
        }

        if (!targetPlayer) { this.sendPrivate(player.id, 'Oyuncu bulunamadı!', 0xFF0000); return; }
        if (this.isOwnerNickname(targetPlayer.name)) {
            this.sendPrivate(player.id, 'Bu oyuncu hakkında işlem yapılamaz!', 0xFF0000);
            this.notifyOwnerProtection(player, targetPlayer.name, 'kick');
            return;
        }
        if (this.rm.authManager?.getLoggedInUser(targetPlayer.id)?.isAdmin) {
            this.sendPrivate(player.id, 'Admin oyuncular kicklenemez!', 0xFF0000);
            return;
        }

        this.rm.room.sendAnnouncement(`${targetPlayer.name} atıldı.`, null, 0xFF6600, 'bold', 1);
        this.rm.safeKickPlayer(targetPlayer.id, 'Admin tarafından atıldı', false);
        await this.logAdminAction('KICK', player.name, targetPlayer.name, this.rm.getPlayerAuthData(targetPlayer.id)?.auth || '', 'Kick');
    }

    async handleBan(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }

        if (args.length < 1) {
            this.sendPrivate(player.id, 'Kullanım: !ban <oyuncu>', 0xFF6600);
            return;
        }

        const players = this.rm.getRealPlayers();
        let targetPlayer = null;
        let targetName = args[0].trim();

        const idMatch = args[0].match(/^#(\d+)$/);
        if (idMatch) {
            const pid = Number(idMatch[1]);
            if (Number.isFinite(pid)) {
                targetPlayer = players.find(p => p.id === pid) || null;
            }
            if (!targetPlayer) {
                this.sendPrivate(player.id, 'Bu id ile oyuncu bulunamadı!', 0xFF0000);
                return;
            }
            targetName = targetPlayer.name;
        } else {
            const searchQuery = args[0].trim();
            const exact = players.filter(p => p.id !== player.id && p.name.toLowerCase() === searchQuery.toLowerCase());
            if (exact.length === 1) {
                targetPlayer = exact[0];
                targetName = targetPlayer.name;
            } else if (exact.length === 0) {
                const matches = players.filter(p => p.id !== player.id && p.name.toLowerCase().includes(searchQuery.toLowerCase()));
                if (matches.length === 1) {
                    targetPlayer = matches[0];
                    targetName = targetPlayer.name;
                } else if (matches.length > 1) {
                    const list = matches.slice(0, 10).map(p => `#${p.id} ${p.name}`).join(' | ');
                    this.sendPrivate(player.id, `Birden fazla eşleşme: ${list}`, 0xFF6600);
                    this.sendPrivate(player.id, '!ban #id kullan', 0xFF6600);
                    return;
                }
            }
        }

        if (targetPlayer) {
            const targetAuth = this.rm.getPlayerAuthData(targetPlayer.id);
            if (this.isOwnerNickname(targetPlayer.name)) {
                this.sendPrivate(player.id, 'Bu oyuncu hakkında işlem yapılamaz!', 0xFF0000);
                this.notifyOwnerProtection(player, targetPlayer.name, 'ban');
                return;
            }
            if (this.rm.authManager?.getLoggedInUser(targetPlayer.id)?.isAdmin) {
                this.sendPrivate(player.id, 'Admin oyuncular banlanamaz!', 0xFF0000);
                return;
            }

            await this.rm.banManager.tempBan(
                targetPlayer.name,
                targetAuth?.auth,
                targetAuth?.conn,
                'Geçici Ban',
                player.name,
                config.roomType,
                3
            );

            this.rm.room.sendAnnouncement(
                `${targetPlayer.name} bu odadan 3 günlüğüne yasaklandı!`,
                null, 0xFF6600, 'bold', 1
            );

            this.rm.safeKickPlayer(targetPlayer.id, '3 günlük oda yasağı', false);
            await this.logAdminAction('TEMPBAN', player.name, targetPlayer.name, targetAuth?.auth || '', config.roomType);
        } else {
            const history = await this.rm.banManager.getPlayerHistory(targetName);

            if (history?.auth && await this.rm.authManager?.isAdmin(history.auth)) {
                this.sendPrivate(player.id, 'Admin oyuncular banlanamaz!', 0xFF0000);
                return;
            }

            const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
            await this.rm.banManager.banByName(targetName, 'Geçici Ban', player.name, expiresAt, config.roomType);

            const displayName = history?.name || targetName;
            this.rm.room.sendAnnouncement(
                `${displayName} bu odadan 3 günlüğüne yasaklandı! (geçmiş kayıt bazlı)`,
                null, 0xFF6600, 'bold', 1
            );
            await this.logAdminAction('TEMPBAN', player.name, displayName, history?.auth || '', config.roomType);
        }
    }

    async handleKaraliste(player) {
        this.sendPrivate(player.id, 'Karaliste işlemleri sadece web panelinden yapılabilir.', 0xFF0000);
    }

    async handleUnban(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }

        if (args.length < 1) {
            this.sendPrivate(player.id, 'Kullanım: !unban <oyuncu>', 0xFF6600);
            return;
        }

        const banList = await this.rm.banManager.getBanList();
        for (let i = args.length; i >= 1; i--) {
            const nameCandidate = args.slice(0, i).join(' ');
            const match = banList.find(b => b.name.toLowerCase() === nameCandidate.toLowerCase());
            if (match) {
                const removed = await this.rm.banManager.unban(match.name);
                if (removed) {
                    this.rm.room.sendAnnouncement(
                        `✓ ${match.name} karalisteden çıkarıldı`,
                        null, 0x00FF00, 'bold', 1
                    );
                    await this.logAdminAction('UNBAN', player.name, match.name, '', '');
                }
                return;
            }
        }

        const targetName = args.join(' ');
        const removed = await this.rm.banManager.unban(targetName);
        if (removed) {
            this.rm.room.sendAnnouncement(
                `✓ ${targetName} karalisteden çıkarıldı`,
                null, 0x00FF00, 'bold', 1
            );
            await this.logAdminAction('UNBAN', player.name, targetName, '', '');
        } else {
            this.sendPrivate(player.id, 'Bu isimde biri karalistede bulunamadı!', 0xFF0000);
        }
    }

    async handleBanlist(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }

        const banList = await this.rm.banManager.getBanList();
        if (banList.length === 0) {
            this.sendPrivate(player.id, 'Karaliste boş.', 0xFFFF00);
            return;
        }

        this.sendPrivate(player.id, `━━━ KARALİSTE (${banList.length}) ━━━`, 0xFF0000);
        banList.slice(0, 20).forEach((ban, idx) => {
            const date = new Date(ban.banned_at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
            this.sendPrivate(player.id, `${idx + 1}. ${ban.name} (${date})`, 0xFFFFFF);
        });
    }


    handleAdminler(player, args) {
        const players = this.rm.getRealPlayers();
        const adminList = [];

        for (const p of players) {
            if (this.rm.authManager?.getLoggedInUser(p.id)?.isAdmin) {
                adminList.push(p.name);
            }
        }

        let msg = '👑 Adminler: ';
        if (adminList.length > 0) {
            msg += adminList.join(', ');
        } else {
            msg += 'Şu an odada admin yok';
        }

        this.sendPrivate(player.id, msg, 0xFFFF00);
    }

    async handleSorgu(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece kalıcı adminler içindir!', 0xFF0000);
            return;
        }

        const targetName = args.join(' ').trim();
        if (!targetName) {
            this.sendPrivate(player.id, 'Kullanım: !sorgu <oyuncu adı>', 0xFF6600);
            return;
        }

        const players = this.rm.getRealPlayers();
        const targetPlayer = players.find(p =>
            p.name.toLowerCase().includes(targetName.toLowerCase())
        );

        if (!targetPlayer) {
            const history = await this.rm.banManager.getPlayerHistory(targetName);
            if (history) {
                this.sendPrivate(player.id, `━━━ SORGU: ${history.name} (Offline) ━━━`, 0xFF6600);
                this.sendPrivate(player.id, `Auth: ${history.auth || '-'}`, 0xFFFFFF);
                this.sendPrivate(player.id, `Conn: ${history.conn || '-'}`, 0xFFFFFF);
                this.sendPrivate(player.id, `Son görülme: ${new Date(history.last_seen).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`, 0xAAAAAA);

                if (history.auth) {
                    const chatLogs = await this.getPlayerChatLogs(history.auth);
                    if (chatLogs.length > 0) {
                        this.sendPrivate(player.id, `━━━ SON MESAJLAR (${chatLogs.length}) ━━━`, 0xFF6600);
                        chatLogs.slice(0, 10).forEach(log => {
                            const time = new Date(log.created_at).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });
                            this.sendPrivate(player.id, `[${time}] ${log.message}`, 0xAAAAAA);
                        });
                    }
                }
            } else {
                this.sendPrivate(player.id, 'Oyuncu bulunamadı!', 0xFF0000);
            }
            return;
        }

        const targetAuth = this.rm.getPlayerAuthData(targetPlayer.id);
        this.sendPrivate(player.id, `━━━ SORGU: ${targetPlayer.name} ━━━`, 0x00FFFF);
        this.sendPrivate(player.id, `ID: ${targetPlayer.id}`, 0xFFFFFF);
        this.sendPrivate(player.id, `Auth: ${targetAuth?.auth || 'Bilinmiyor'}`, 0xFFFFFF);
        this.sendPrivate(player.id, `Conn: ${targetAuth?.conn || 'Bilinmiyor'}`, 0xFFFFFF);
        this.sendPrivate(player.id, `Takım: ${targetPlayer.team === 0 ? 'Spec' : targetPlayer.team === 1 ? 'Red' : 'Blue'}`, 0xFFFFFF);

        const isAdmin = targetAuth?.auth && await this.rm.authManager?.isAdmin(targetAuth.auth);
        const adminStatus = isAdmin ? 'Admin' : 'Oyuncu';
        this.sendPrivate(player.id, `Yetki: ${adminStatus}`, 0xFFFF00);

        const chatLogs = await this.getPlayerChatLogs(targetAuth?.auth);
        if (chatLogs.length > 0) {
            this.sendPrivate(player.id, `━━━ SON MESAJLAR (${chatLogs.length}) ━━━`, 0xFF6600);
            chatLogs.slice(0, 10).forEach(log => {
                const time = new Date(log.created_at).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });
                this.sendPrivate(player.id, `[${time}] ${log.message}`, 0xAAAAAA);
            });
        } else {
            this.sendPrivate(player.id, 'Mesaj kaydı yok.', 0x888888);
        }
    }

    async handleMute(player, args) {
        if (!this.isAdmin(player)) {
            this.sendPrivate(player.id, 'Bu komut sadece adminler içindir!', 0xFF0000);
            return;
        }

        if (args.length < 2) {
            this.sendPrivate(player.id, 'Kullanım: !mute <#id/isim> <süre>', 0xFF6600);
            this.sendPrivate(player.id, 'Örn: !mute #7 10dk', 0xAAAAAA);
            return;
        }

        const targetQuery = args[0];
        const durationRaw = args[1];
        const durationMs = this.parseDurationMs(durationRaw);
        if (!durationMs) {
            this.sendPrivate(player.id, 'Süre hatalı! Örn: 30sn | 10dk | 2saat', 0xFF0000);
            return;
        }

        const reason = args.slice(2).join(' ').trim();

        const players = this.rm.getRealPlayers();
        let targetPlayer = null;

        if (targetQuery.startsWith('#')) {
            const id = parseInt(targetQuery.slice(1), 10);
            if (!Number.isNaN(id)) {
                targetPlayer = players.find(p => p.id === id) || null;
            }
            if (!targetPlayer) {
                this.sendPrivate(player.id, 'Bu id ile oyuncu bulunamadı!', 0xFF0000);
                return;
            }
        } else {
            const exact = players.filter(p => p.id !== player.id && p.name.toLowerCase() === targetQuery.toLowerCase());
            if (exact.length === 1) {
                targetPlayer = exact[0];
            } else {
                const matches = players.filter(p => p.id !== player.id && p.name.toLowerCase().includes(targetQuery.toLowerCase()));
                if (matches.length === 1) {
                    targetPlayer = matches[0];
                } else if (matches.length > 1) {
                    const list = matches.slice(0, 10).map(p => `#${p.id} ${p.name}`).join(' | ');
                    this.sendPrivate(player.id, `Birden fazla eşleşme: ${list}`, 0xFF6600);
                    this.sendPrivate(player.id, '!mute #id <süre> kullan', 0xAAAAAA);
                    return;
                }
            }
        }

        if (!targetPlayer) {
            this.sendPrivate(player.id, 'Oyuncu bulunamadı!', 0xFF0000);
            return;
        }

        if (this.isOwnerNickname(targetPlayer.name)) {
            this.sendPrivate(player.id, 'Bu oyuncu hakkında işlem yapılamaz!', 0xFF0000);
            this.notifyOwnerProtection(player, targetPlayer.name, 'mute');
            return;
        }
        const targetAuth = this.rm.getPlayerAuthData(targetPlayer.id);
        if (this.rm.authManager?.getLoggedInUser(targetPlayer.id)?.isAdmin) {
            this.sendPrivate(player.id, 'Admin oyuncular susturulamaz!', 0xFF0000);
            return;
        }

        let auth = targetAuth?.auth;
        if (!auth) {
            const roomPlayer = this.rm.room.getPlayerList().find(p => p.id === targetPlayer.id);
            if (roomPlayer?.auth) {
                auth = roomPlayer.auth;
                this.rm.setPlayerAuthData(targetPlayer.id, roomPlayer.auth, roomPlayer.conn);
            }
        }
        if (!auth) {
            this.sendPrivate(player.id, 'Hata: Auth bulunamadı!', 0xFF0000);
            return;
        }

        const ok = await this.tempMuteAuth(auth, durationMs, reason);
        if (!ok) {
            this.sendPrivate(player.id, 'Susturma başarısız!', 0xFF0000);
            return;
        }

        const label = this.formatDurationLabel(durationMs);
        this.rm.room.sendAnnouncement(`🔇 ${targetPlayer.name} ${label} susturuldu.`, null, 0xFF0000, 'bold', 2);
        await this.logAdminAction('MUTE', player.name, targetPlayer.name, auth, reason);
    }

    async handlePMute(player, args) {
        if (args.length === 0) {
            this.sendPrivate(player.id, 'Kullanım: !pmute <oyuncu/all>', 0xFF6600);
            this.sendPrivate(player.id, '!pmute all - Tüm oyuncuları sustur', 0xAAAAAA);
            this.sendPrivate(player.id, '!pmute <isim> - Belirli oyuncuyu sustur', 0xAAAAAA);
            return;
        }

        if (!this.playerMutes.has(player.id)) {
            this.playerMutes.set(player.id, new Set());
        }
        const muted = this.playerMutes.get(player.id);

        const target = args.join(' ').toLowerCase();

        if (target === 'all' || target === 'hepsi') {
            muted.add('all');
            this.sendPrivate(player.id, '🔇 Tüm oyuncuları sustturdun. Kimsenin mesajını görmeyeceksin.', 0x00FF00);
            return;
        }

        const players = this.rm.getRealPlayers();
        const targetPlayer = players.find(p =>
            p.name.toLowerCase().includes(target) && p.id !== player.id
        );

        if (!targetPlayer) {
            this.sendPrivate(player.id, 'Oyuncu bulunamadı!', 0xFF0000);
            return;
        }

        let targetAuthData = this.rm.getPlayerAuthData(targetPlayer.id);
        let tAuth = targetAuthData?.auth;
        if (!tAuth) {
            const roomPlayer = this.rm.room.getPlayerList().find(p => p.id === targetPlayer.id);
            if (roomPlayer?.auth) {
                tAuth = roomPlayer.auth;
                this.rm.setPlayerAuthData(targetPlayer.id, roomPlayer.auth, roomPlayer.conn);
            }
        }
        if (tAuth) {
            muted.add(tAuth);
            this.sendPrivate(player.id, `🔇 ${targetPlayer.name} susturuldu.`, 0x00FF00);
        } else {
            muted.add(`id:${targetPlayer.id}`);
            this.sendPrivate(player.id, `🔇 ${targetPlayer.name} susturuldu (geçici).`, 0x00FF00);
        }
    }

    async handleUnmute(player, args) {
        const isAdmin = this.isAdmin(player);
        const arg0 = String(args?.[0] || '').toLowerCase();
        const wantsAll = args.length === 0 || arg0 === 'all' || arg0 === 'hepsi';

        if (isAdmin && !wantsAll) {
            if (args.length < 1) {
                this.sendPrivate(player.id, 'Kullanım: !unmute <#id/isim>', 0xFF6600);
                return;
            }

            const query = args[0];
            const reason = args.slice(1).join(' ').trim();

            const players = this.rm.getRealPlayers();
            let targetPlayer = null;

            if (query.startsWith('#')) {
                const id = parseInt(query.slice(1), 10);
                if (!Number.isNaN(id)) {
                    targetPlayer = players.find(p => p.id === id) || null;
                }
            }

            if (!targetPlayer) {
                const matches = players.filter(p =>
                    p.id !== player.id && p.name.toLowerCase().includes(query.toLowerCase())
                );
                if (matches.length === 0) {
                    const mutes = await this.getPermanentMuteList();
                    const offlineMatches = mutes.filter(m => String(m.name || '').toLowerCase().includes(query.toLowerCase()));
                    if (offlineMatches.length === 1) {
                        await this.removePermanentMute(offlineMatches[0].auth);
                        this.rm.eventHandlers?.profanityFilter?.resetOffenses(offlineMatches[0].auth);
                        this.rm.room.sendAnnouncement(
                            `🔊 ${offlineMatches[0].name} kalıcı susturması kaldırıldı`,
                            null, 0x00FF00, 'bold', 1
                        );
                        await this.logAdminAction('UNMUTE', player.name, offlineMatches[0].name, offlineMatches[0].auth || '', reason);
                        return;
                    }
                    if (offlineMatches.length > 1) {
                        this.sendPrivate(player.id, 'Birden fazla eşleşme bulundu (kalıcı susturma). Daha net isim yaz.', 0xFF6600);
                        return;
                    }

                    this.sendPrivate(player.id, 'Oyuncu bulunamadı!', 0xFF0000);
                    return;
                }
                if (matches.length > 1) {
                    const list = matches.slice(0, 6).map(p => `#${p.id} ${p.name}`).join(' | ');
                    this.sendPrivate(player.id, `Birden fazla eşleşme: ${list}`, 0xFF6600);
                    this.sendPrivate(player.id, '!unmute #id kullan', 0xAAAAAA);
                    return;
                }
                targetPlayer = matches[0];
            }

            const authData = this.rm.getPlayerAuthData(targetPlayer.id);
            const auth = authData?.auth;
            if (!auth) {
                this.sendPrivate(player.id, 'Hata: Auth bulunamadı!', 0xFF0000);
                return;
            }

            const removedTemp = await this.clearTempMuteAuth(auth);
            const removedPerm = await this.removePermanentMute(auth);
            this.rm.eventHandlers?.profanityFilter?.resetOffenses(auth);

            if (removedTemp || removedPerm) {
                this.rm.room.sendAnnouncement(
                    `🔊 ${targetPlayer.name} susturması kaldırıldı`,
                    null, 0x00FF00, 'bold', 1
                );
                await this.logAdminAction('UNMUTE', player.name, targetPlayer.name, auth, reason);
            } else {
                this.sendPrivate(player.id, `Bu oyuncu susturulmuş değil: ${targetPlayer.name}`, 0xFF6600);
            }
            return;
        }

        if (!this.playerMutes.has(player.id)) {
            this.sendPrivate(player.id, 'Susturulmuş oyuncun yok!', 0xFF6600);
            return;
        }

        const muted = this.playerMutes.get(player.id);

        if (wantsAll) {
            muted.clear();
            this.sendPrivate(player.id, '🔊 Tüm susturmalar kaldırıldı.', 0x00FF00);
            return;
        }

        const target = args.join(' ').toLowerCase();
        const players = this.rm.getRealPlayers();
        const targetPlayer = players.find(p =>
            p.name.toLowerCase().includes(target) && p.id !== player.id
        );

        if (targetPlayer) {
            const targetAuth = this.rm.getPlayerAuthData(targetPlayer.id);
            if (targetAuth?.auth) {
                muted.delete(targetAuth.auth);
            }
            muted.delete(`id:${targetPlayer.id}`);
            this.sendPrivate(player.id, `🔊 ${targetPlayer.name} susturması kaldırıldı.`, 0x00FF00);
        } else {
            this.sendPrivate(player.id, 'Oyuncu bulunamadı!', 0xFF0000);
        }
    }

    async handleMuteList(player, args) {
        if (!this.playerMutes.has(player.id) || this.playerMutes.get(player.id).size === 0) {
            this.sendPrivate(player.id, 'Susturulmuş oyuncun yok!', 0xFF6600);
            return;
        }

        const muted = this.playerMutes.get(player.id);
        this.sendPrivate(player.id, '━━━ SUSTURULANLAR ━━━', 0xFF6600);

        if (muted.has('all')) {
            this.sendPrivate(player.id, '🔇 Herkes susturulmuş', 0xFFFFFF);
        } else {
            const players = this.rm.getRealPlayers();
            muted.forEach(m => {
                if (m.startsWith('id:')) {
                    const id = parseInt(m.slice(3));
                    const p = players.find(pl => pl.id === id);
                    this.sendPrivate(player.id, `🔇 ${p?.name || 'Bilinmiyor'} (ID)`, 0xFFFFFF);
                } else {
                    const p = players.find(pl => {
                        const auth = this.rm.getPlayerAuthData(pl.id);
                        return auth?.auth === m;
                    });
                    this.sendPrivate(player.id, `🔇 ${p?.name || m}`, 0xFFFFFF);
                }
            });
        }
        this.sendPrivate(player.id, 'Kaldırmak için: !unmute <isim/all>', 0xAAAAAA);
    }

    isMutedFor(listenerPlayerId, senderPlayerId) {
        try {
            if (!this.playerMutes || !this.playerMutes.has(listenerPlayerId)) return false;
            const muted = this.playerMutes.get(listenerPlayerId);
            if (!muted) return false;

            if (muted.has('all')) return true;

            const senderAuth = this.rm.getPlayerAuthData(senderPlayerId);
            if (senderAuth?.auth && muted.has(senderAuth.auth)) return true;
            if (muted.has(`id:${senderPlayerId}`)) return true;

            return false;
        } catch (e) {
            return false;
        }
    }

    clearPlayerMutes(playerId) {
        this.playerMutes.delete(playerId);
    }

    handlePm(player, args) {
        if (args.length < 2) {
            this.sendPrivate(player.id, 'Kullanım: !pm <oyuncu> <mesaj>', 0xFF6600);
            return;
        }

        const targetName = args[0].toLowerCase();
        const message = args.slice(1).join(' ');

        const players = this.rm.getRealPlayers();
        const targetPlayer = players.find(p =>
            p.name.toLowerCase().includes(targetName) && p.id !== player.id
        );

        if (!targetPlayer) {
            this.sendPrivate(player.id, 'Oyuncu bulunamadı!', 0xFF0000);
            return;
        }

        if (this.isMutedFor(targetPlayer.id, player.id)) {
            this.sendPrivate(player.id, 'Bu oyuncu seni susturmuş!', 0xFF0000);
            return;
        }

        this.rm.room.sendAnnouncement(
            `🔒 ${player.name}: ${message}`,
            targetPlayer.id, 0xFF69B4, 'bold', 2
        );
        this.sendPrivate(player.id, `🔒 » ${targetPlayer.name}: ${message}`, 0xFF69B4);

        const admins = this.rm.getRealPlayers().filter(p => this.isAdmin(p) && p.id !== player.id && p.id !== targetPlayer.id);
        admins.forEach(a => {
            this.rm.room.sendAnnouncement(
                `[PM] ${player.name} » ${targetPlayer.name}: ${message}`,
                a.id, 0x888888, 'italic', 0
            );
        });
    }

    destroy() {
        if (this.announcementInterval) {
            clearInterval(this.announcementInterval);
            this.announcementInterval = null;
        }
        if (this.ataturkInterval) {
            clearInterval(this.ataturkInterval);
            this.ataturkInterval = null;
        }
        this.playerMutes.clear();
        this.tempMuteNotice.clear();
        this.vipPauseLimits.clear();
        if (this.vipPauseTimeout) {
            clearTimeout(this.vipPauseTimeout);
            this.vipPauseTimeout = null;
        }
    }

    findReplacementPlayer(teamToJoin) {
        if (!this.rm.state.gameInProgress) return;

        const activePlayers = this.rm.getActivePlayers();
        const specPlayers = activePlayers.filter(p =>
            p.team === Team.SPECTATORS && !this.rm.playerActivity.isAFK(p.id)
        );
        const teamPlayers = activePlayers.filter(p => p.team === teamToJoin);

        if (specPlayers.length === 0) {
            this.rm.gameFlow.checkTeamBalance();
            return;
        }

        if (specPlayers.length === 1) {
            const replacement = specPlayers[0];
            const teamName = teamToJoin === Team.RED ? 'kırmızıya' : 'maviye';
            this.rm.safeSetTeam(replacement.id, teamToJoin);
            this.rm.room.sendAnnouncement(
                `${replacement.name} ${teamName} katıldı!`,
                null, teamToJoin === Team.RED ? 0xE56E56 : 0x5689E5, 'bold', 1
            );
        } else if (teamPlayers.length > 0) {
            this.rm.room.pauseGame(true);
            const captain = teamPlayers[0];
            const teamName = teamToJoin === Team.RED ? 'Kırmızı' : 'Mavi';
            this.rm.room.sendAnnouncement(
                `${teamName} takımdan oyuncu AFK! ${captain.name} yeni oyuncu seçecek.`,
                null, 0xFF6600, 'bold', 1
            );
            this.rm.captainManager.startMidGameSelection(captain, specPlayers, 1, teamToJoin);
        }
    }

}

module.exports = PlayerCommands;
