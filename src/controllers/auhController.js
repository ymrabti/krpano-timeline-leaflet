const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
let users = [
    {
        username: 'Younes',
        password: 'ymrabti'
    },
    {
        username: 'sdmb',
        password: 'sonacos'
    },
]
module.exports = {
    Login: async (req, res) => {
        const password = req.body.password;
        const username = req.body.username;
        const salt = await bcrypt.genSalt();
        const hashedPassw = await bcrypt.hash(password, salt);
        const user = users.find(e => e.username === username);
        const pwdPassed = await bcrypt.compare(password, user.pwdHash);
        if (!pwdPassed) {
            return res.status(UNAUTHORIZED).json({
                error: loginFailedErr,
            });
        }
        res.json({ data: hashedPassw })
    },
    Logout: async (req, res) => {
        res.json({ data: 'Logout' })
    }
}