const axios = require('axios');

module.exports = async (req, res) => {
    const BOT_TOKEN = process.env.BOT_TOKEN || '8736646304:AAE1WvoBivE6CIRrAOUIAVAEd2BAGpkyobk';
    const update = req.body;

    if (!update) return res.status(400).send('No body');

    // Обязательное подтверждение платежа в течение 10 секунд
    if (update.pre_checkout_query) {
        try {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
                pre_checkout_query_id: update.pre_checkout_query.id,
                ok: true
            });
        } catch (err) {
            console.error('Error answering pre_checkout_query:', err);
        }
    }

    if (update.message && update.message.successful_payment) {
        console.log('Успешный платеж:', update.message.successful_payment);
    }

    return res.status(200).send('OK');
};
