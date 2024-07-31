const express = require('express');
const router = express.Router();
const {
    authMiddleware1,
    authMiddleware2,
    authMiddleware3
} = require('../middlewares/auth.js');   
const {
    getHomePage,
    getAboutPage,
    getLoginPage,
    getVerifyPage,
    postLoginPage,
    postVerifyPage,
    getChatPage,
    getLogout
} = require('../controllers/controller.js');

const {
    getLoginLimiter,
    postLoginLimiter,
    getVerifyLimiter,
    postVerifyLimiter
} = require('../utils/rateLimiter.js');

router.get('/', getHomePage);

router.get('/about', getAboutPage);

router.get('/chat', getChatPage);

module.exports = router;