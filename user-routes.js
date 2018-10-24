/**
 * user-routes.js
 */
// Require the Express Router object
const router = require('express').Router();
const User = require('./user-model');

module.exports = (app) => {
    app.use('/', router);

    router.get('/', (req, res, next) => {
        res.send('This is the home page');
    });

    // Register a user
    router.post('/register', (req, res, next) => {

        let newUser = new User({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password
        });

        User.addUser(newUser, (err, user) => {
            if (err){
                res.json({success: false, msg: 'Failed to register'});
            } else {
                res.json({success: true, msg: 'User registered!'});
            }
        });
    });

    // Get a user
    router.get('/:id', (req, res, next) => {

        User.getUserById(req.params.id, (err, user) => {
            if (err) next(err);
            if (!user){
                return res.json({success: false, msg: "Failed to authenticate user"});
            } else {
                return res.json({success: true, msg: user });
            }
        });
    });

    // Authenticate and login a user based on id and password
    router.post('/authenticate/:id', (req, res, next) => {

        const password = req.body.password;
        const id = req.params.id;

        User.getUserById(id, (err, user) => {
            if (err) next(err);

            if (!user){
                return res.json({success: false, msg: "Failed to authenticate user"});
            }

            User.comparePassword(password, user.password, (err, isMatch) => {
                if(err) next(err);
                if(isMatch){

                    // Token expires in 1 month = 2,629,746 seconds
                    const token = jwt.sign({data: user}, databaseConfig.secret, {
                        expiresIn: 2629746
                    });

                    res.json({
                        success: true,
                        token: 'Bearer ' + token,
                        user: {
                            id: user._id,
                            name: user.name,
                            email: user.email
                        }
                    });
                } else{
                    return res.json({success: false, msg: "Wrong password"});
                }
            });
        });
    });
}