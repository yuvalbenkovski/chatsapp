module.exports.renderMain = async (req, res) => {
    if (!req.user) {
        res.render("landingpage");
    } else {
        res.render("index");
    }
}