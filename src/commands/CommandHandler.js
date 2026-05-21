const RateLimiter = require('../classes/RateLimiter');
const config = require('../../config');

function normalizeTurkish(str) {
    return str
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .replace(/ş/g, 's')
        .replace(/Ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/Ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/Ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/Ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'c');
}

class CommandHandler {
    constructor(roomManager) {
        this.rm = roomManager;
        this.commands = new Map();
        this.playerCommands = null;
        this.rateLimiter = new RateLimiter(config.rateLimit || {});
    }

    setPlayerCommands(playerCommands) {
        this.playerCommands = playerCommands;
        this.registerPlayerCommands();
    }

    registerPlayerCommands() {
        if (!this.playerCommands) return;

        this.commands.set('kayit', {
            handler: this.playerCommands.handleKayit.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('register', {
            handler: this.playerCommands.handleKayit.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('giris', {
            handler: this.playerCommands.handleGiris.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('login', {
            handler: this.playerCommands.handleGiris.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('sifredegistir', {
            handler: this.playerCommands.handleSifreDegistir.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('rename', {
            handler: this.playerCommands.handleRename.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('hesap', {
            handler: this.playerCommands.handleHesap.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('bb', {
            handler: this.playerCommands.handleBb.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('bye', {
            handler: this.playerCommands.handleBb.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('yardim', {
            handler: this.playerCommands.handleYardim.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('help', {
            handler: this.playerCommands.handleYardim.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('afk', {
            handler: this.playerCommands.handleAfk.bind(this.playerCommands),
            isPrivate: false
        });
this.commands.set('kickkapat', {
            handler: this.playerCommands.handleKickkapat.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('kickac', {
            handler: this.playerCommands.handleKickac.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('admin', {
            handler: this.playerCommands.handleAdminCagir.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('kurallar', {
            handler: this.playerCommands.handleKurallar.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('rules', {
            handler: this.playerCommands.handleKurallar.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('kisaltmalar', {
            handler: this.playerCommands.handleKisaltmalar.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('kisalt', {
            handler: this.playerCommands.handleKisaltmalar.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('rank', {
            handler: this.playerCommands.handleRank.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('stats', {
            handler: this.playerCommands.handleRank.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('istatistik', {
            handler: this.playerCommands.handleRank.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('gizlirank', {
            handler: this.playerCommands.handleGizliRank.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('gr', {
            handler: this.playerCommands.handleGizliRank.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('top', {
            handler: this.playerCommands.handleTop.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('top5', {
            handler: this.playerCommands.handleTop.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('gol', {
            handler: this.playerCommands.handleGol.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('asist', {
            handler: this.playerCommands.handleAsist.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('cs', {
            handler: this.playerCommands.handleCs.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('mvp', {
            handler: this.playerCommands.handleMvp.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('galibiyet', {
            handler: this.playerCommands.handleGalibiyet.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('maglubiyet', {
            handler: this.playerCommands.handleMaglubiyet.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('puan', {
            handler: this.playerCommands.handlePuan.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('sira', {
            handler: this.playerCommands.handleSira.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('siram', {
            handler: this.playerCommands.handleSiram.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('serisıralama', {
            handler: this.playerCommands.handleSeriSiralama.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('serisiralama', {
            handler: this.playerCommands.handleSeriSiralama.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('statyardim', {
            handler: this.playerCommands.handleStatYardim.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('chatkapat', {
            handler: this.playerCommands.handleChatkapat.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('chatac', {
            handler: this.playerCommands.handleChatac.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('dengesiz', {
            handler: this.playerCommands.handleDengesiz.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('adminyardim', {
            handler: this.playerCommands.handleAdminYardim.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('a', {
            handler: this.playerCommands.handleAdminChat.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('afklar', {
            handler: this.playerCommands.handleAfkList.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('sevinc', {
            handler: this.playerCommands.handleSevinc.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('sevincsil', {
            handler: this.playerCommands.handleSevincsil.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('sevinctipi', {
            handler: this.playerCommands.handleSevincTipi.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('golefekt', {
            handler: this.playerCommands.handleGolEfekt.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('golyazi', {
            handler: this.playerCommands.handleGolYazi.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('avatar', {
            handler: this.playerCommands.handleAvatar.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('avatarsil', {
            handler: this.playerCommands.handleAvatarSil.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('mevki', {
            handler: this.playerCommands.handleMevki.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('pozisyon', {
            handler: this.playerCommands.handleMevki.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('mevkisil', {
            handler: this.playerCommands.handleMevkiSil.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('t', {
            handler: this.playerCommands.handleTeamChat.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('s', {
            handler: this.playerCommands.handleSpecChat.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('kick', {
            handler: this.playerCommands.handleKick.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('ban', {
            handler: this.playerCommands.handleBan.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('karaliste', {
            handler: this.playerCommands.handleKaraliste.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('unban', {
            handler: this.playerCommands.handleUnban.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('pmute', {
            handler: this.playerCommands.handlePMute.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('mute', {
            handler: this.playerCommands.handleMute.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('unmute', {
            handler: this.playerCommands.handleUnmute.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('mutelist', {
            handler: this.playerCommands.handleMuteList.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('pm', {
            handler: this.playerCommands.handlePm.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('ozel', {
            handler: this.playerCommands.handlePm.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('w', {
            handler: this.playerCommands.handlePm.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('pause', {
            handler: this.playerCommands.handleVipPause.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('p', {
            handler: this.playerCommands.handleVipPause.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('dur', {
            handler: this.playerCommands.handleVipPause.bind(this.playerCommands),
            isPrivate: false
        });
        this.commands.set('davetkodu', {
            handler: this.playerCommands.handleDavetKodu.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('vipyardim', {
            handler: this.playerCommands.handleVipYardim.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('online', {
            handler: this.playerCommands.handleOnline.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('gecmis', {
            handler: this.playerCommands.handleGecmis.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('sonmaclar', {
            handler: this.playerCommands.handleGecmis.bind(this.playerCommands),
            isPrivate: true
        });
        this.commands.set('oyla', {
            handler: (player, args) => this.rm.voteManager?.startVote(player, args.join(' ')),
            isPrivate: false
        });
        this.commands.set('evet', {
            handler: (player) => this.rm.voteManager?.castVote(player),
            isPrivate: false
        });
        this.commands.set('e', {
            handler: (player) => this.rm.voteManager?.castVote(player),
            isPrivate: false
        });
    }

    processCommand(player, message) {
        if (!message.startsWith('!')) return { handled: false };

        const parts = message.slice(1).split(' ');
        const rawCommandName = parts[0].toLowerCase();
        const commandName = normalizeTurkish(rawCommandName);
        const args = parts.slice(1);

        const command = this.commands.get(commandName);
        if (!command) return { handled: false };

        const isVip = !!this.rm?.authManager?.getLoggedInUser(player.id)?.isVip;
        const isAdmin = !!this.rm?.authManager?.getLoggedInUser(player.id)?.isAdmin;
        if (!isVip && !isAdmin) {
            const rateCheck = this.rateLimiter.check(player.id);
            if (!rateCheck.allowed) {
                if (rateCheck.kick) {
                    this.rm.safeKickPlayer(player.id, 'Çok fazla komut spam!', false);
                    return { handled: true, suppress: true };
                }

                if (rateCheck.warning) {
                    this.sendPrivate(
                        player.id,
                        `Yavaş! ${rateCheck.remainingTime}sn bekle. (Uyarı ${rateCheck.warningCount}/3)`,
                        0xFF6600
                    );
                }
                return { handled: true, suppress: true };
            }
        }

        const isPrivate = command.isPrivate;

        try {
            const result = command.handler(player, args);
            if (result && typeof result.catch === 'function') {
                result.catch(error => {
                    console.error(`Command error [${commandName}]:`, error);
                    this.sendPrivate(player.id, 'Bir hata oluştu!', 0xFF0000);
                });
            }
        } catch (error) {
            console.error(`Command error [${commandName}]:`, error);
            this.sendPrivate(player.id, 'Bir hata oluştu!', 0xFF0000);
        }

        return { handled: true, suppress: isPrivate };
    }

    sendPrivate(playerId, message, color = 0xFFFFFF) {
        this.rm.room.sendAnnouncement(message, playerId, color, 'normal', 1);
    }

    onPlayerLeave(playerId) {
        this.rateLimiter.reset(playerId);
        if (this.playerCommands?.tempAdmins) {
            this.playerCommands.tempAdmins.delete(playerId);
        }
    }
}

module.exports = CommandHandler;
