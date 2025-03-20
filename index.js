const { Client, GatewayIntentBits } = require('discord.js');
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
            data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
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
        message.reply('Commandes: .clockin, .clockout, .clockview, .clockshow');
    }

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
    }

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
    }

    if (message.content === '.clockview') {
        const userId = message.author.id;
        const entries = guildData.hours[userId] || [];
        
        if (entries.length === 0) return message.reply("Aucune heure enregistrée.");
        
        let response = `Historique des heures de ${message.author.username} :\n`;
        entries.forEach(e => {
            response += `Entrée: ${e.clockIn}, Sortie: ${e.clockOut || 'Non sorti'}\n`;
        });
        
        message.reply(response);
    }
});

client.login(process.env.TOKEN);
