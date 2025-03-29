const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const mysql = require('mysql2/promise');
const moment = require('moment');
require('dotenv').config();

// Importer les fonctions depuis modules.js
const { loadData, saveData, query } = require('./modules');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const shutdown = async (signal) => {
    console.log(`ℹ️  Processus de déconnexion en cours... Signal: ${signal}`);
    await client.destroy();
    await pool.end();
    console.log('✅  Bot et base de données déconnectés avec succès.');
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
    
    

    if (message.content.startsWith('.clockin')) {
        try {
            await pool.query(
                'INSERT INTO user_hours (guild_id, user_id, clock_in) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE clock_in = ?',
                [guildId, message.author.id, new Date(), new Date()]
            );
            message.reply('🟢 Vous avez enregistré votre entrée.');
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement de l\'entrée:', error);
            message.reply('❌ Une erreur est survenue.');
        }
    }

    if (message.content.startsWith('.clockout')) {
        try {
            await pool.query(
                'UPDATE user_hours SET clock_out = ? WHERE guild_id = ? AND user_id = ?',
                [new Date(), guildId, message.author.id]
            );
            message.reply('🔴 Vous avez enregistré votre sortie.');
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement de la sortie:', error);
            message.reply('❌ Une erreur est survenue.');
        }
    }

    
    if (message.content.startsWith('.clockset reset')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }

        try {
            await pool.query('DELETE FROM user_hours WHERE guild_id = ?', [guildId]);
            message.reply('✅ Toutes les heures ont été réinitialisées pour ce serveur.');
        } catch (error) {
            console.error('Erreur lors de la réinitialisation des heures:', error);
            message.reply('❌ Une erreur est survenue.');
        }
    }

    if (message.content.startsWith('.clockset log')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }

        try {
            const [logs] = await pool.query(
                'SELECT user_id, clock_in, clock_out, timestamp FROM user_hour_logs WHERE guild_id = ? ORDER BY timestamp DESC LIMIT 10',
                [guildId]
            );

            if (logs.length === 0) {
                return message.reply('📭 Aucun log disponible.');
            }

            let embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Logs des heures récentes')
                .setDescription('Voici les derniers logs des heures :');

            logs.forEach(log => {
                const clockIn = moment(log.clock_in).format('ddd MMM DD YYYY HH:mm');
                const clockOut = log.clock_out ? moment(log.clock_out).format('ddd MMM DD YYYY HH:mm') : 'En cours';
                embed.addFields({ name: `<@${log.user_id}>`, value: `🕐 Entrée : ${clockIn}, Sortie : ${clockOut}` });
            });

            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur lors de la récupération des logs:', error);
            message.reply('❌ Une erreur est survenue.');
        }
    }

    if (message.content === '.clockshow') {
        try {
            const [results] = await pool.query(
                'SELECT user_id, clock_in, clock_out FROM user_hours WHERE guild_id = ?',
                [guildId]
            );
    
            if (results.length === 0) {
                return message.reply('📭 Aucun membre n’a enregistré d’heures.');
            }
    
            let embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Historique des heures des membres sur ${message.guild.name}`)
                .setDescription('Voici l\'historique des heures de travail des membres :');
    
            // Regroupe les heures par utilisateur
            const userHours = {};
            results.forEach(row => {
                if (!userHours[row.user_id]) userHours[row.user_id] = [];
                userHours[row.user_id].push({
                    clockIn: moment(row.clock_in).format('ddd MMM DD YYYY HH:mm'),
                    clockOut: row.clock_out ? moment(row.clock_out).format('ddd MMM DD YYYY HH:mm') : null
                });
            });
    
            // Affiche les heures pour chaque utilisateur
            for (const userId of Object.keys(userHours)) {
                const user = message.guild.members.cache.get(userId);
                let userText = `**Historique des heures de <@${userId}> :**\n`;
                let totalWorkedMinutes = 0;
    
                userHours[userId].forEach(entry => {
                    const clockIn = entry.clockIn;
                    const clockOut = entry.clockOut ? entry.clockOut : 'En cours';
    
                    // Calcul du total de temps travaillé si sortie existe
                    if (entry.clockOut) {
                        const clockInTime = moment(entry.clockIn, 'ddd MMM DD YYYY HH:mm');
                        const clockOutTime = moment(entry.clockOut, 'ddd MMM DD YYYY HH:mm');
                        const diffMinutes = clockOutTime.diff(clockInTime, 'minutes');
                        totalWorkedMinutes += diffMinutes;
                    }
    
                    userText += `🕐 Entrée : ${clockIn}, Sortie : ${clockOut}\n`;
                });
    
                // Calcule les heures et minutes totales
                const hours = Math.floor(totalWorkedMinutes / 60);
                const minutes = totalWorkedMinutes % 60;
                userText += `⏳ **Total travaillé** : ${hours}h ${minutes}m\n`;
    
                // Ajouter les heures de l'utilisateur à l'embed
                embed.addFields({ name: user ? user.user.tag : `Utilisateur ${userId}`, value: userText });
            }
    
            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur lors de la récupération des heures:', error);
            message.reply('❌ Une erreur est survenue.');
        }
    }
    
    
    

    if (message.content.startsWith('.clockview')) {
        const userId = message.mentions.users.first()?.id || message.author.id;
    
        try {
            const [results] = await pool.query(
                'SELECT clock_in, clock_out FROM user_hours WHERE user_id = ? AND guild_id = ?',
                [userId, guildId]
            );
    
            if (results.length === 0) {
                return message.reply(`📭 Aucun historique pour <@${userId}>.`);
            }
    
            let embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Historique des heures de <@${userId}>`)
                .setDescription('Voici l\'historique des heures de travail de l\'utilisateur.');
    
            let totalWorkedMinutes = 0;
    
            results.forEach(row => {
                const clockIn = moment(row.clock_in);  // Moment de l'entrée
                const clockOut = row.clock_out ? moment(row.clock_out) : null;  // Moment de la sortie (peut être null)
    
                embed.addFields(
                    { name: `🕐 Entrée : ${clockIn.format('YYYY-MM-DD HH:mm')}`, value: `Sortie : ${clockOut ? clockOut.format('YYYY-MM-DD HH:mm') : 'En cours'}` }
                );
    
                // Calcul du temps travaillé si la sortie est définie
                if (clockOut) {
                    const diffMinutes = clockOut.diff(clockIn, 'minutes');
                    totalWorkedMinutes += diffMinutes;
                }
            });
    
            // Calcul des heures et minutes totales
            const hours = Math.floor(totalWorkedMinutes / 60);
            const minutes = totalWorkedMinutes % 60;
    
            embed.addFields(
                { name: '⏳ **Total travaillé**', value: `${hours}h ${minutes}m` }
            );
    
            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur lors de la récupération des heures:', error);
            message.reply('❌ Une erreur est survenue.');
        }
    }
    
    
    if (message.content.startsWith('.clockset role')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }

        try {
            const role = message.guild.roles.cache.find(r => r.name === 'Heure');
            if (role) {
                await message.reply(`Le rôle existant 'Heure' a été attribué à ce serveur.`);
            } else {
                await message.guild.roles.create({ name: 'Heure', color: '#ff0000' });
                message.reply(`Le rôle 'Heure' a été créé et attribué à ce serveur.`);
            }
        } catch (error) {
            console.error('Erreur lors de la gestion du rôle:', error);
            message.reply('❌ Une erreur est survenue.');
        }
    }

    if (message.content.startsWith('.invite')) {
        message.reply(`🔗 Voici le lien d'invitation du bot : https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`);
    }
});

client.on('ready', () => {
    console.log(`✅  Bot connecté avec succès en tant que ${client.user.tag}!`);
});

process.on('SIGINT', () => shutdown('SIGINT'));
client.login(process.env.BOT_TOKEN);
