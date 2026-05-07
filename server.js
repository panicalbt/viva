const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Твой токен бота
const BOT_TOKEN = '8736646304:AAE1WvoBivE6CIRrAOUIAVAEd2BAGpkyobk';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Маршрут для создания ссылки на оплату (Invoice Link)
 */
app.get('/create-invoice', async (req, res) => {
    const amount = req.query.amount || 50;
    
    try {
        const response = await axios.post(`${TELEGRAM_API}/createInvoiceLink`, {
            title: `Донат ${amount} звезд`,
            description: `Поддержка проекта Лабатамия на ${amount} звезд. Спасибо!`,
            payload: `donate_${amount}_${Date.now()}`, // Уникальный ID платежа
            provider_token: '', // Пусто для Telegram Stars
            currency: 'XTR',
            prices: [{ label: 'Stars', amount: parseInt(amount) }]
        });

        if (response.data.ok) {
            res.json({ link: response.data.result });
        } else {
            res.status(500).json({ error: 'Telegram API Error', details: response.data });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

/**
 * Обработка Webhook от Telegram (нужно настроить в BotFather или через API)
 * Бот должен отвечать на pre_checkout_query в течение 10 секунд!
 */
app.post('/webhook', async (req, res) => {
    const update = req.body;

    if (update.pre_checkout_query) {
        // Подтверждаем платеж
        await axios.post(`${TELEGRAM_API}/answerPreCheckoutQuery`, {
            pre_checkout_query_id: update.pre_checkout_query.id,
            ok: true
        });
    }

    if (update.message && update.message.successful_payment) {
        console.log('Платеж получен!', update.message.successful_payment);
        // Здесь можно добавить логику: выдать игроку бонусы, записать в базу и т.д.
    }

    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Ссылка для создания инвойса: http://localhost:${PORT}/create-invoice?amount=50`);
});
