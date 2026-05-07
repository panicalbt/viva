const axios = require('axios');

module.exports = async (req, res) => {
    // Включаем CORS для Mini App
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const amount = req.query.amount || 50;
    const BOT_TOKEN = process.env.BOT_TOKEN || '8736646304:AAE1WvoBivE6CIRrAOUIAVAEd2BAGpkyobk';
    
    try {
        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            title: `Донат ${amount} звезд`,
            description: `Поддержка проекта Лабатамия на ${amount} звезд.`,
            payload: `donate_${amount}_${Date.now()}`,
            provider_token: '',
            currency: 'XTR',
            prices: [{ label: 'Stars', amount: parseInt(amount) }]
        });

        if (response.data.ok) {
            return res.status(200).json({ link: response.data.result });
        } else {
            return res.status(500).json({ error: 'Telegram API Error', details: response.data });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Server Error' });
    }
};
