const { User } = require("../../models/user");
module.exports.renderLoginPage = (req, res) => {
    res.render("login");
}

module.exports.loginUser =
    (req, res) => {
        res.redirect("/");
    }

module.exports.logoutUser = (req, res) => {
    req.logout();
    res.redirect("/");
}

module.exports.renderRegistrationPage = (req, res) => {
    res.render("register");
}

module.exports.registerUser = async (req, res) => {
    const { username, password, email, name } = req.body;
    const user = new User({ username, email, name });
    user.profile_picture.path = req.file.path;
    const registeredUser = await User.register(user, password);
    req.login(registeredUser, function (err) {
        if (err) {
            console.log(err);
        } else {
            res.redirect("/");
        }
    });
}