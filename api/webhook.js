const axios = require('axios');

module.exports = async (req, res) => {
    const BOT_TOKEN = process.env.BOT_TOKEN; // Рекомендуется установить в Vercel
    const UPSTASH_URL = process.env.UPSTASH_URL || 'https://clear-filly-118043.upstash.io';
    const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN || 'gQAAAAAAAc0bAAIgcDJjZjAwMTAwNWI2ZDM0M2RjYTI3OTIwNmU4NzFkNzcyNg';
    
    const update = req.body;

    if (!update) return res.status(400).send('No body');

    // 1. Подтверждаем платеж (обязательно)
    if (update.pre_checkout_query) {
        try {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN || '8736646304:AAE1WvoBivE6CIRrAOUIAVAEd2BAGpkyobk'}/answerPreCheckoutQuery`, {
                pre_checkout_query_id: update.pre_checkout_query.id,
                ok: true
            });
        } catch (err) {
            console.error('Pre-checkout error:', err);
        }
    }

    // 2. Обрабатываем успешный платеж
    if (update.message && update.message.successful_payment) {
        const payload = update.message.successful_payment.invoice_payload;
        
        // Парсим payload (вид: donor|username|timestamp)
        if (payload && payload.startsWith('donor|')) {
            const [_, username] = payload.split('|');
            
            // Добавляем пользователя в список донатеров в Upstash
            try {
                await axios.get(`${UPSTASH_URL}/sadd/donors/${username}`, {
                    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
                });
                console.log(`User ${username} added to donors!`);
            } catch (err) {
                console.error('Upstash update error:', err);
            }
        }
    }

    return res.status(200).send('OK');
};
