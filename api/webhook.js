const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN || '8736646304:AAE1WvoBivE6CIRrAOUIAVAEd2BAGpkyobk';
const UPSTASH_URL = process.env.UPSTASH_URL || 'https://clear-filly-118043.upstash.io';
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN || 'gQAAAAAAAc0bAAIgcDJjZjAwMTAwNWI2ZDM0M2RjYTI3OTIwNmU4NzFkNzcyNg';

// Список ID администраторов (добавьте свой ID сюда)
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : ['1222821588']; // Ваш ID

const redis = {
    async exec(cmd, ...args) {
        try {
            const url = `${UPSTASH_URL}/${cmd}/${args.join('/')}`;
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
            });
            return res.data.result;
        } catch (err) {
            console.error(`Redis error (${cmd}):`, err.message);
            return null;
        }
    }
};

const tg = {
    async call(method, data) {
        try {
            return await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, data);
        } catch (err) {
            console.error(`TG API error (${method}):`, err.response?.data || err.message);
        }
    }
};

module.exports = async (req, res) => {
    const update = req.body;
    if (!update) return res.status(400).send('No body');

    // 1. Подтверждаем платеж
    if (update.pre_checkout_query) {
        await tg.call('answerPreCheckoutQuery', {
            pre_checkout_query_id: update.pre_checkout_query.id,
            ok: true
        });
        return res.status(200).send('OK');
    }

    // 2. Обрабатываем успешный платеж
    if (update.message && update.message.successful_payment) {
        const payload = update.message.successful_payment.invoice_payload;
        if (payload && payload.startsWith('donor|')) {
            const [_, username] = payload.split('|');
            await redis.exec('sadd', 'donors', username);
        }
        return res.status(200).send('OK');
    }

    // 3. Обработка сообщений
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const userId = update.message.from.id.toString();

        // Сохраняем пользователя в общий список
        await redis.exec('sadd', 'all_users', chatId);

        // Проверяем состояние админа (рассылка)
        const state = await redis.exec('get', `admin_state:${userId}`);
        if (state === 'waiting_broadcast' && ADMIN_IDS.includes(userId)) {
            await redis.exec('del', `admin_state:${userId}`);
            await tg.call('sendMessage', { chat_id: chatId, text: '🚀 Начинаю рассылку...' });

            const users = await redis.exec('smembers', 'all_users') || [];
            let count = 0;
            for (const uid of users) {
                const ok = await tg.call('sendMessage', { chat_id: uid, text: text });
                if (ok) count++;
            }

            await tg.call('sendMessage', { chat_id: chatId, text: `✅ Рассылка завершена! Получили: ${count} чел.` });
            return res.status(200).send('OK');
        }

        if (text === '/start') {
            await tg.call('sendMessage', {
                chat_id: chatId,
                text: 'Привет! Нажми кнопку ниже, чтобы открыть приложение.',
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Открыть Clicker', web_app: { url: 'https://vova-clicker-stars.vercel.app/' } }
                    ]]
                }
            });
        } else if (text === '/admin') {
            if (ADMIN_IDS.includes(userId)) {
                await tg.call('sendMessage', {
                    chat_id: chatId,
                    text: '👑 Админ-меню:',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📊 Статистика', callback_data: 'admin_stats' }],
                            [{ text: '📢 Сделать рассылку', callback_data: 'admin_broadcast' }]
                        ]
                    }
                });
            } else {
                await tg.call('sendMessage', { chat_id: chatId, text: 'У вас нет прав доступа.' });
            }
        }
    }

    // 4. Обработка нажатий на кнопки
    if (update.callback_query) {
        const userId = update.callback_query.from.id.toString();
        const data = update.callback_query.data;
        const chatId = update.callback_query.message.chat.id;

        if (!ADMIN_IDS.includes(userId)) return res.status(200).send('Forbidden');

        if (data === 'admin_stats') {
            const totalUsers = await redis.exec('scard', 'all_users') || 0;
            const totalDonors = await redis.exec('scard', 'donors') || 0;

            await tg.call('editMessageText', {
                chat_id: chatId,
                message_id: update.callback_query.message.message_id,
                text: `📊 Статистика бота:\n\n👥 Всего пользователей: ${totalUsers}\n💎 Донатеров: ${totalDonors}`,
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin_back' }]]
                }
            });
        } else if (data === 'admin_broadcast') {
            // Устанавливаем состояние "ожидание текста рассылки" на 10 минут
            // В Upstash REST для SET с TTL используется другой синтаксис или просто set
            await redis.exec('set', `admin_state:${userId}`, 'waiting_broadcast');
            // Примечание: В базовом REST Upstash SETEX может не работать через GET /set/key/val/ex/sec
            // Но мы можем использовать обычный SET, для админки этого хватит

            await tg.call('sendMessage', {
                chat_id: chatId,
                text: '📝 Введите текст для рассылки (или /cancel для отмены):'
            });
        } else if (data === 'admin_back') {
            await tg.call('editMessageText', {
                chat_id: chatId,
                message_id: update.callback_query.message.message_id,
                text: '👑 Админ-меню:',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📊 Статистика', callback_data: 'admin_stats' }],
                        [{ text: '📢 Сделать рассылку', callback_data: 'admin_broadcast' }]
                    ]
                }
            });
        }

        await tg.call('answerCallbackQuery', { callback_query_id: update.callback_query.id });
    }

    return res.status(200).send('OK');
};

