const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const mysql = require('mysql2');
const moment = require('moment');
require('dotenv').config();

// Importation des fonctions depuis modules.js
const { loadData, saveData, connection } = require('./modules');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const botOwnerId = process.env.BOT_OWNER_ID;

const shutdown = async (signal) => {
    console.log(`ℹ️ Signal reçu: ${signal}. Déconnexion en cours...`);
    if (client && client.destroy) {
        await client.destroy();
        console.log('✅ Bot déconnecté avec succès.');
    } else {
        console.log('⚠️ Client déjà inactif ou non défini.');
    }
    process.exit(0);
};

client.on('guildCreate', async (guild) => {
    try {
        const guildData = await loadData(guild.id);
        await saveData(guild.id, guildData);
    } catch (error) {
        console.error(`Erreur lors du traitement du serveur ${guild.id}:`, error);
    }
});

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    
    const guildId = message.guild.id;
    let guildData = await loadData(guildId);
    const userId = message.author.id;

    if (message.content === '.clock') {
        return message.reply('Commandes disponibles: .clockin, .clockout, .clockview, .clockshow, .clockset log <channelId>, .clockset role <roleId>, .clockset reset');
    }

    if (message.content === '.clockin') {
        if (guildData.settings.allowedRole && !message.member.roles.cache.has(guildData.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }
        
        if (!guildData.hours[userId]) guildData.hours[userId] = [];
        if (guildData.hours[userId].some(entry => entry.clockOut === null)) {
            return message.reply("Vous êtes déjà pointé.");
        }

        const now = moment().format('YYYY-MM-DD HH:mm:ss');
        guildData.hours[userId].push({ clockIn: now, clockOut: null });
        await saveData(guildId, guildData);

        message.reply(`Vous êtes maintenant pointé à ${now}.`);
        if (guildData.settings.logChannel) {
            const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
            if (logChannel) logChannel.send(`<@${userId}> a pointé à ${now}.`);
        }
    }

    if (message.content === '.clockout') {
        if (guildData.settings.allowedRole && !message.member.roles.cache.has(guildData.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }

        const entry = guildData.hours[userId]?.find(entry => entry.clockOut === null);
        if (!entry) return message.reply("Vous n'êtes pas actuellement pointé.");

        entry.clockOut = moment().format('YYYY-MM-DD HH:mm:ss');
        await saveData(guildId, guildData);
        message.reply(`Vous êtes sorti à ${entry.clockOut}.`);

        if (guildData.settings.logChannel) {
            const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
            if (logChannel) logChannel.send(`<@${userId}> a quitté à ${entry.clockOut}.`);
        }
    }

    if (message.content.startsWith('.clockset log')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && userId !== botOwnerId) {
            return message.reply("Permission refusée.");
        }

        const channelId = message.content.split(' ')[2];
        if (!message.guild.channels.cache.has(channelId)) return message.reply("ID du canal invalide.");

        guildData.settings.logChannel = channelId;
        await saveData(guildId, guildData);
        message.reply(`Canal de logs défini sur <#${channelId}>.`);
    }

    if (message.content.startsWith('.clockset role')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && userId !== botOwnerId) {
            return message.reply("Permission refusée.");
        }

        const roleId = message.content.split(' ')[2];
        if (!message.guild.roles.cache.has(roleId)) return message.reply("ID du rôle invalide.");

        guildData.settings.allowedRole = roleId;
        await saveData(guildId, guildData);
        message.reply(`Rôle défini sur <@&${roleId}>.`);
    }

    if (message.content === '.clockset reset') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && userId !== botOwnerId) {
            return message.reply("Permission refusée.");
        }
        
        message.reply("Confirmez avec **oui** dans les 30 secondes.")
            .then(() => {
                const filter = response => response.author.id === userId && response.content.toLowerCase() === "oui";
                message.channel.awaitMessages({ filter, max: 1, time: 30000 })
                    .then(() => {
                        connection.query('DELETE FROM user_hours WHERE guild_id = ?', [guildId], (err) => {
                            if (err) return message.reply("Erreur lors de la réinitialisation.");
                            message.reply("Heures réinitialisées.");
                        });
                    })
                    .catch(() => message.reply("Réinitialisation annulée."));
            });
    }
});

client.on('ready', () => {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

client.on('error', console.error);
process.on('SIGINT', () => shutdown('SIGINT'));
client.login(process.env.BOT_TOKEN);
