const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const axios = require('axios');
const nodemailer = require('nodemailer');

const app = express();
const port = 3000;

const CLIENT_ID = '1308617303071391837';
const CLIENT_SECRET = 'GCawIABfIqLhjaa82eTbeLST0562it-o';
const CALLBACK_URL = 'http://localhost:3000/callback';

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

passport.use(new DiscordStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['identify', 'email']
}, (accessToken, refreshToken, profile, done) => {
    profile.botToken = '';
    return done(null, profile);
}));

app.use(session({
    secret: 'some random secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

let userBots = {};

const getBotDetails = async (token) => {
    const response = await axios.get('https://discord.com/api/users/@me', {
        headers: {
            Authorization: `Bot ${token}`
        }
    });
    const { id, username, avatar } = response.data;
    return {
        id,
        username,
        avatar: `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
    };
};

// Nodemailer Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'itsrylave@gmail.com',
        pass: 'Jdurga21'
    }
});

let lastContactFormSubmission = {};

app.get('/', (req, res) => {
    res.render('index', { user: req.user });
});

app.get('/login', passport.authenticate('discord'));

app.get('/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});

app.get('/about', (req, res) => {
    res.render('about', { user: req.user });
});

app.get('/contact', (req, res) => {
    res.render('contact', { user: req.user });
});

app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;
    const userId = req.user ? req.user.id : email;

    const now = Date.now();
    if (lastContactFormSubmission[userId] && now - lastContactFormSubmission[userId] < 3600000) {
        // If less than 1 hour since last submission
        return res.send('Please wait at least an hour before submitting another message.');
    }

    lastContactFormSubmission[userId] = now;

    const mailOptions = {
        from: email,
        to: 'YOUR_EMAIL@gmail.com',
        subject: `Contact Form Submission from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error(`Error sending email: ${error}`);
            res.send('There was an error sending your message. Please try again later.');
        } else {
            console.log(`Email sent: ${info.response}`);
            res.send('Thank you for contacting us!');
        }
    });
});

app.get('/dashboard', ensureAuthenticated, (req, res) => {
    if (!userBots[req.user.id] || userBots[req.user.id].length === 0) {
        res.render('enter-bot-token', { user: req.user });
    } else {
        res.render('dashboard', { user: req.user, bots: userBots[req.user.id] });
    }
});

app.post('/bot-token', ensureAuthenticated, async (req, res) => {
    const botToken = req.body.botToken;
    if (!userBots[req.user.id]) {
        userBots[req.user.id] = [];
    }

    try {
        const botDetails = await getBotDetails(botToken);
        userBots[req.user.id].push({
            token: botToken,
            id: botDetails.id,
            name: botDetails.username,
            avatar: botDetails.avatar
        });
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error fetching bot details:', error);
        res.render('enter-bot-token', { user: req.user, error: 'Invalid token!' });
    }
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});
