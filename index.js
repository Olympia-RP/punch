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
    
    

    // Exemple pour .clockin
    if (message.content === '.clockin') {
        const channelId = 'ID_DU_CANAL_LOG'; // Remplacez par l'ID de votre canal log
        const logChannel = message.guild.channels.cache.get(channelId);

        // Vérifier si le canal existe
        if (!logChannel) {
            return message.reply('❌ Le canal log est introuvable.');
        }

        // Enregistrer l'heure de clock-in
        connection.query(
            'INSERT INTO user_hours (user_id, clock_in, guild_id) VALUES (?, NOW(), ?)',
            [message.author.id, message.guild.id],
            (err) => {
                if (err) {
                    console.error('Erreur lors de l\'enregistrement de l\'entrée:', err);
                    return message.reply('❌ Une erreur est survenue.');
                }

                // Envoi du message dans le canal log
                logChannel.send(`🕒 <@${message.author.id}> a effectué un **clock-in** à ${moment().format('YYYY-MM-DD HH:mm')}.`);
                message.reply('✅ Vous êtes maintenant **clock-in**.');
            }
        );
    }

    // Exemple pour .clockout
    if (message.content === '.clockout') {
        const channelId = 'ID_DU_CANAL_LOG'; // Remplacez par l'ID de votre canal log
        const logChannel = message.guild.channels.cache.get(channelId);

        // Vérifier si le canal existe
        if (!logChannel) {
            return message.reply('❌ Le canal log est introuvable.');
        }

        // Enregistrer l'heure de clock-out
        connection.query(
            'UPDATE user_hours SET clock_out = NOW() WHERE user_id = ? AND clock_out IS NULL AND guild_id = ?',
            [message.author.id, message.guild.id],
            (err) => {
                if (err) {
                    console.error('Erreur lors de l\'enregistrement de la sortie:', err);
                    return message.reply('❌ Une erreur est survenue.');
                }

                // Envoi du message dans le canal log
                logChannel.send(`🕒 <@${message.author.id}> a effectué un **clock-out** à ${moment().format('YYYY-MM-DD HH:mm')}.`);
                message.reply('✅ Vous êtes maintenant **clock-out**.');
            }
        );
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
    
            // Récupère le membre de la guild pour obtenir son display name
            const member = message.guild.members.cache.get(userId);
            const displayName = member ? member.displayName : message.author.tag;  // Si membre existe, prends son displayName, sinon prends le tag de l'utilisateur
    
            let embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Historique des heures de ${displayName}`)  // Afficher le display name dans le titre
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
    
    

    if (message.content === '.clockset log') {
        const logMessage = `Nouvelle entrée pour ${message.author.tag} à ${moment().format('YYYY-MM-DD HH:mm')}`;
        
        // Insertion du log dans la base de données
        connection.query(
            'INSERT INTO user_hour_logs (user_id, log_message, timestamp, guild_id) VALUES (?, ?, ?, ?)',
            [message.author.id, logMessage, moment().format('YYYY-MM-DD HH:mm:ss'), message.guild.id],
            (err) => {
                if (err) {
                    console.error('Erreur lors de l\'insertion des logs:', err);
                    return message.reply('❌ Une erreur est survenue lors de l\'enregistrement du log.');
                }
                message.reply('✅ Log enregistré avec succès.');
            }
        );
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

    if (message.content.startsWith('.invite')) {
        message.reply(`🔗 Voici le lien d'invitation du bot : https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`);
    }
});

client.on('ready', () => {
    console.log(`✅  Bot connecté avec succès en tant que ${client.user.tag}!`);
});

process.on('SIGINT', () => shutdown('SIGINT'));
client.login(process.env.BOT_TOKEN);
