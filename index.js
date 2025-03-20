const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

process.on('SIGINT', async () => {
    console.log('Arrêt du bot...');
    await client.destroy();
    process.exit(0);
});

let data = {};

function loadData() {
    if (fs.existsSync('data.json')) {
        try {
            const fileData = fs.readFileSync('data.json', 'utf8');
            if (fileData.trim()) { // Vérifie si le fichier n'est pas vide
                data = JSON.parse(fileData);
            }
        } catch (error) {
            console.error('Erreur de parsing JSON:', error);
        }
    }
}

function saveData() {
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

client.on('guildCreate', (guild) => {
    if (!data[guild.id]) {
        data[guild.id] = {
            settings: { logChannel: null, allowedRole: null },
            hours: {}
        };
        saveData();
    }
});

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    
    const guildId = message.guild.id;
    if (!data[guildId]) {
        data[guildId] = { settings: { logChannel: null, allowedRole: null }, hours: {} };
    }
    
    const guildData = data[guildId];
    
    if (message.content === '.clock') {
        message.reply('Commandes: .clockin, .clockout, .clockview, .clockshow, .clockset log <channelId>, .clockset role <roleId>');
    }

    // Commande .clockin
    if (message.content === '.clockin') {
        if (guildData.settings.allowedRole && !message.member.roles.cache.has(guildData.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }
        
        const userId = message.author.id;
        if (!guildData.hours[userId]) {
            guildData.hours[userId] = [];
        }
        
        if (guildData.hours[userId].some(entry => entry.clockOut === null)) {
            return message.reply("Vous êtes déjà pointé.");
        }
        
        const now = new Date().toLocaleString();
        guildData.hours[userId].push({ clockIn: now, clockOut: null });
        saveData();
        
        message.reply(`Vous êtes maintenant pointé à ${now}.`);
        
        // ✅ ENVOYER LE MESSAGE DANS LE CANAL DE LOGS
        if (guildData.settings.logChannel) {
            const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
            if (logChannel) {
                logChannel.send(`<@${userId}> a pointé à ${now}.`);
            } else {
                console.error(`Canal de log introuvable: ${guildData.settings.logChannel}`);
            }
        }
    }

    // Commande .clockout
    if (message.content === '.clockout') {
        if (guildData.settings.allowedRole && !message.member.roles.cache.has(guildData.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }
        
        const userId = message.author.id;
        const entry = guildData.hours[userId]?.find(entry => entry.clockOut === null);
        if (!entry) return message.reply("Vous n'êtes pas pointé.");
        
        entry.clockOut = new Date().toLocaleString();
        saveData();
        
        message.reply(`Vous êtes sorti à ${entry.clockOut}.`);
        
        // ✅ ENVOYER LE MESSAGE DANS LE CANAL DE LOGS
        if (guildData.settings.logChannel) {
            const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
            if (logChannel) {
                logChannel.send(`<@${userId}> a quitté à ${entry.clockOut}.`);
            } else {
                console.error(`Canal de log introuvable: ${guildData.settings.logChannel}`);
            }
        }
    }


    if (message.content === '.clockview') {
        const userId = message.author.id;
        const entries = guildData.hours[userId] || [];
    
        if (entries.length === 0) return message.reply("Aucune heure enregistrée.");
    
        let totalTime = 0;
        let response = `📜 **Historique des heures de ${message.author.username}** :\n`;
    
        entries.forEach(e => {
            response += `🕒 **Entrée :** ${e.clockIn} | **Sortie :** ${e.clockOut || 'Non sorti'}\n`;
            
            // Calculer le total uniquement si l'utilisateur est sorti
            if (e.clockOut) {
                const inTime = new Date(e.clockIn);
                const outTime = new Date(e.clockOut);
                if (!isNaN(inTime) && !isNaN(outTime)) {
                    totalTime += outTime - inTime;
                }
            }
        });
    
        // Convertir le total en heures et minutes
        const totalHours = Math.floor(totalTime / 3600000);
        const totalMinutes = Math.floor((totalTime % 3600000) / 60000);
    
        response += `\n⏳ **Total du temps travaillé :** ${totalHours}h ${totalMinutes}min`;
    
        message.reply(response);
    }
    

    if (message.content === '.clockshow') {
        let report = "Liste des membres ayant pointé :\n";
        
        Object.keys(guildData.hours).forEach(userId => {
            let history = `\nHistorique des heures de <@${userId}> :\n`;
            
            guildData.hours[userId].forEach(entry => {
                history += `Entrée: ${entry.clockIn}, Sortie: ${entry.clockOut || 'Non sorti'}\n`;
            });
            
            report += history;
        });
        
        message.channel.send(report);
    }

    if (message.content.startsWith('.clockset log')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }

        const args = message.content.split(' ');
        const channelId = args[2];
        const channel = message.guild.channels.cache.get(channelId);
        
        if (!channel) {
            return message.reply("Le canal spécifié est invalide.");
        }

        guildData.settings.logChannel = channelId;
        saveData();
        message.reply(`Le canal de logs a été défini sur ${channel.name}.`);
    }

    if (message.content.startsWith('.clockset role')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }

        const args = message.content.split(' ');
        const roleId = args[2];
        const role = message.guild.roles.cache.get(roleId);
        
        if (!role) {
            return message.reply("Le rôle spécifié est invalide.");
        }

        guildData.settings.allowedRole = roleId;
        saveData();
        message.reply(`Le rôle autorisé a été défini sur ${role.name}.`);
    }
});

client.login(process.env.TOKEN);
