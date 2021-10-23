const isLoggedIn = (req, res, next) => {
    if (!req.session) {
        req.flash("error", "You must sign in first");
        res.redirect("/login");
    } else {
        next();
    }
};