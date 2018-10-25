/**
 * File: all-tests.js 
 */

const bcrypt = require('bcryptjs');
const sinon = require('sinon');
const express = require('express');
const User = require('./user-model');
const routes = require('./user-routes');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const config = require('./config');

const supertest = require('supertest');

// More verbose assertion library
const { expect } = require('chai');

describe('User Route Tests', () => {
    let app, request;
    beforeEach(() => {

        // Create an express application object
        app = express();
        app.use(bodyParser.json());

        // Bind our routes to our application using the method explained earlier
        routes(app);

        // Add newly created app instance to supertest object
        request = supertest(app);
    });

    afterEach(() => {

    });

    /**
     * Always a good idea to write a simple test to make sure that you have everything setup 
     * correctly before getting into the more complex tests
     */
    it('Base route works', (done) => {
        request
            .get('/')
            .expect('Content-Type', 'text/html')
            .expect(200, (err, res) => {
                expect(res.text).to.equal('This is the home page');
                done();
            });
    });

    // This makes sure that we are pulling from the correct MongoDB collection
    it ('User exists and belongs to collection users', () => {
        expect(User.model).to.exist;
        expect(User.collection.name).to.equal('users');
    });
    
    
    it('User can register successfully at the /register route', (done) => {
        let newUser = {
            name: 'Steve Jobs',
            email: 'steve@gmail.com',
            password: 'some password'
        };

        const expectedResponse = {
            success: true,
            msg: 'User registered!'
        };

        /**
         * User.addUser() is an async functon, and Sinon does not automatically call the callback
         * We need to call the callback and then let Mocha know that it has completed execution
         */
        sinon.stub(User, 'addUser').callsArg(1);

        request
            .post('/register')
            .send(newUser)
            .set('Accept', 'application/json')
            .expect(200, (err, res) => {

                // Make sure to restore the stub, otherwise other tests will break
                User.addUser.restore();

                // Since we are comparing two objects, we need the Chai Expect library's 
                // deep.equal() method.
                expect(res.body).to.deep.equal(expectedResponse);
                done();
            });
    });

    it('/register route fails', (done) => {
        let newUser = {
            invalidProperty: 'Steve Jobs'
        };

        const expectedResponse = {
            success: false,
            msg: 'Failed to register'
        };

        // We need to call the addUser() method with an error because the user we are
        // trying to add is invalid
        sinon.stub(User, 'addUser').callsArgWith(1, new Error('Route threw error'));

        request
            .post('/register')
            .send(newUser)
            .set('Accept', 'application/json')
            .expect(200, (err, res) => {

                // Always remember to restore stubs!
                User.addUser.restore();

                expect(res.body).to.deep.equal(expectedResponse);
                done();
            });
    });

    it('Can get user from /:id route', (done) => {

        const returnedUser = {
            name: 'Steve Jobs',
            email: 'steve@gmail.com',
            password: 'some password'
        };

        const expectedResponse = {
            success: true,
            msg: returnedUser
        };

        sinon.stub(User, 'getUserById').callsArgWith(1, null, returnedUser);

        request
            .get('/some-id')
            .set('Accept', 'application/json')
            .expect(200, (err, res) => {
                User.getUserById.restore();
                expect(res.body).to.deep.equal(expectedResponse);
                done();
            });
    });

    it('Cannot get user from /:id route -- User with id does not exist', (done) => {

        const expectedResponse = {
            success: false,
            msg: 'Failed to find user'
        };

        // When there is no user, our method passes two arguments -- null for the error 
        // and null for the user 
        sinon.stub(User, 'getUserById').callsArgWith(1, null, null);

        request
            .get('/some-id')
            .set('Accept', 'application/json')
            .expect(200, (err, res) => {
                User.getUserById.restore();
                expect(res.body).to.deep.equal(expectedResponse);
                done();
            });
    });

    it('User is successfully authenticated', (done) => {
        const existingUser = {
            _id: 'some-id',
            name: 'Steve Jobs',
            email: 'steve@gmail.com',
            password: 'some password'
        };

        // Rather than stubbing the jwt.sign() method, we can just run it to determine result
        const token = jwt.sign({data: existingUser}, config.secret, {
            expiresIn: 2629746
        });

        const expectedResponse = {
            success: true,
            token: 'Bearer ' + token,
            user: {
                id: existingUser._id,
                name: existingUser.name,
                email: existingUser.email
            }
        };

        // We ensure that the user is successfully found in the database and returned through callback
        sinon.stub(User, 'getUserById').callsArgWith(1, null, existingUser);

        // We force the comparePassword() method to return a match
        sinon.stub(User, 'comparePassword').callsArgWith(2, null, true);

        request
            .post('/authenticate/some-id')
            .send(existingUser)
            .set('Accept', 'application/json')
            .expect(200, (err, res) => {

                // Always remember to restore stubs!
                User.getUserById.restore();
                User.comparePassword.restore();

                expect(res.body).to.deep.equal(expectedResponse);
                done();
            });
    });

    it('User typed in the wrong password', (done) => {
        const existingUser = {
            _id: 'some-invalid-id',
            name: 'Steve Jobs',
            email: 'steve@gmail.com',
            password: 'some password'
        };

        const expectedResponse = {
            success: false,
            msg: 'Wrong password'
        };

        // We ensure that the user is successfully found in the database and returned through callback
        sinon.stub(User, 'getUserById').callsArgWith(1, null, existingUser);

        // We force the comparePassword() method to return a mismatch (i.e. the user entered the wrong password)
        sinon.stub(User, 'comparePassword').callsArgWith(2, null, false);

        request
            .post('/authenticate/some-invalid-id')
            .send(existingUser)
            .set('Accept', 'application/json')
            .expect(200, (err, res) => {

                // Always remember to restore stubs!
                User.getUserById.restore();
                User.comparePassword.restore();

                expect(res.body).to.deep.equal(expectedResponse);
                done();
            });
    });
});

describe('User Model Tests', () => {

    beforeEach(() => {
        
    });

    afterEach(() => {
    });

    it('When addUser() is a success, the user should be added to the database with hash as password', (done) => {

        // Create a dummy user
        const user = new User({
            name: 'some name', 
            password: 'some password'
        });

        // Call the function we are testing with the dummy user as an argument
        User.addUser(user, function() {

            // We expect the original password to not match the new one because this method 
            // should transform the password into a secure hash for storage in the database
            expect(user.password).to.not.equal('some password');

            // Be sure to call done to tell Mocha that the asynchronous execution has finished
            done();
        });
    });

    it('When addUser() is a failure, the user will not be added to the database and we will get error', () => {
        
        // Create dummy user
        const user = new User({
            name: 'some name', 
            password: 'some password'
        });

        // Create an error to throw
        const expectedError = new Error('some error');
        
        // Force the bcrypt.genSalt() method to throw our expected error
        sinon.stub(bcrypt, 'genSalt').throws(expectedError);
        
        // Call the function we are testing in a try/catch block, and assert that we arrived at the catch block
        // with the expected error
        try {
            User.addUser(user, function() {});
        } catch (err) {
            sinon.assert.threw(bcrypt.genSalt, expectedError);
        }
        
        // Remember to restore!
        bcrypt.genSalt.restore();
    });

    it('When password matches hash, comparePassword() will return true', (done) => {
        const password = 'some password';
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        
        // No need to create any stubs.  Just call the method and check that the results are 
        // as expected.  We expect that given the above inputs, our password will be a match
        User.comparePassword(password, hash, (err, isMatch) => {
            expect(isMatch).to.be.true;
            expect(err).to.be.null;
            done();
        });
    });

    it('When password does not match hash, comparePassword() will return false', (done) => {
        
        // Create our expected error
        const expectedError = new Error('comparison did not work');

        // Create a stub on the bcrypt.compare() method and force it to throw our expectedError
        sinon.stub(bcrypt, 'compare').yieldsAsync(expectedError);
        
        // Create a spy on the callback so we can determine what arguments it was called with
        const callback = sinon.spy();

        // Call the function we are testing with the spy callback, and make sure to call done() to 
        // let Mocha know that the async function has completed
        User.comparePassword('some password', 'some salt', callback);
        done();

        // We expect that the callback will be called once with the expectedError as an argument
        sinon.assert.calledOnce(callback);
        sinon.assert.calledWith(callback, expectedError);

        // Remember to restore!
        bcrypt.compare.restore();
    });
});