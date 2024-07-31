const dotenv = require('dotenv');
dotenv.config();
const path = require('path');
const publicDirectory = path.join(__dirname, '../public');

const getHomePage = (req, res) => {
    return res.sendFile('/index.html');
}

const getAboutPage = (req, res) => {
    return res.sendFile('/about.html');
}

const getChatPage = (req, res) => {
    try {
        const chatPage = path.join(publicDirectory, 'chat.html');
        return res.sendFile(chatPage);
    } catch (error) {
        return res.send(error.message);
    }
}

module.exports = {
    getHomePage,
    getAboutPage,
    getChatPage
};