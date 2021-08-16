if (process.env.NODE_ENV === 'production') {
    console.log('Running in production');
} else {
    console.log('Running in development');
    require('dotenv').config()
}

const express = require('express')
const app = express()
const mongoose = require('mongoose');
const session = require('express-session')
const sessionConfig = {
    secret: 'secret',
    saveUninitialized: true,
    resave: false
}
const passport = require('passport')
const LocalStrategy = require('passport-local')
const { User } = require('./models/user');
const multer = require('multer')
const { storage } = require('./cloudinary')
const upload = multer({ storage })
const flash = require('connect-flash')
//------------
mongoose.connect('mongodb://localhost:27017/chats-app', { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log('Mongoose Connected !')
});
//------------

app.set('view engine', 'ejs');
app.use(express.static('public'))
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(session(sessionConfig))

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//--------Middleware-------
app.use((req, res, next) => {
    res.locals.currentUser = req.user
    res.locals.success = req.flash('success')
    res.locals.error = req.flash('error')
    next()
})

const isLoggedIn = ((req, res, next) => {
    if (!req.session) {
        req.flash('error', 'You must sign in first')
        res.redirect('/login')
    } else {
        next()
    }
})
//-------------------------





/* app.get('/', (req, res) => {
    res.render('index')
}) */

app.get('/', (req, res) => {
    if (!req.user) {
        res.render('landingpage')
    } else {
        res.render('index')
    }
    console.log(req.user)
})

app.get('/register', (req, res) => {
    res.render('register')
})

app.post('/register', upload.single('inpFile'), async (req, res) => {
    const { username, password, email, name, passwordConfirm } = req.body
    if (password === passwordConfirm) {
        const user = new User({ username, email, name })
        user.profile_picture.path = req.file.path
        const registeredUser = await User.register(user, password)
        req.login(registeredUser, function (err) {
            if (err) {
                console.log(err);
            } else {
                res.redirect('/');
            }

        });
    } else {
        res.send('err')
    }
})

app.get('/login', (req, res) => {
    res.render('login')
})

app.post('/login', passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }), (req, res) => {
    res.redirect('/')
})

app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
})

const port = 3000 || process.env.PORT
app.listen(port, () => {
    console.log(`Listening on port ${port} !`)
})