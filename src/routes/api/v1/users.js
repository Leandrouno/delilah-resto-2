/*
    This file holds all routes belonging to /users.
*/
const path = require("path");
const express = require("express");
const router = express.Router();

// Middlewares
const tokenValidator = require(path.join(__dirname, "..", "..", "..", "middlewares", "tokenValidator.js"));
const adminAccessOnly = require(path.join(__dirname, "..", "..", "..", "middlewares", "adminAccessOnly.js"));

// Connect 2 db.
const { usersDB } = require(path.join(__dirname, "..", "..", "..", "db", "db.js"));

// Users own validation rules. All of them try to avoid to insert invalid data in the DB.
const validate = {
    full_name: full_name => {
        if (!full_name) return "Empty full_name.";
        if (full_name.length < 2) return "Full name is too short...";
    },

    username: async username => {
        if (!username) return "Empty username.";
        const checkUsername = await usersDB.getUser.byUsername(username);
        if (checkUsername) return "Username already exists.";
    },

    email: async email => {
        if (!email) return "Empty email.";
        const checkEmail = await usersDB.getUser.byEmail(email);
        if (checkEmail) return "Email already exists.";
    },

    phone: phone => {
        if (!phone) return "Empty phone.";
        if (phone.length < 4) return "Phone is too short...";

    },

    address: address => {
        if (!address) return "Empty address.";
        if (address.length < 4) return "Address is too short...)";

    },

    password: password => {
        if (!password) return "Empty password.";
        if (password.length < 4) return "Password is too short...";
    },

    id_security_type: id_security_type => {
        if (!+id_security_type > 0) return "id_security_type invalid number."
    },

    user_post_body: async (req, res, next) => {
        const { full_name, username, email, phone, address, password } = req.body;

        // Validate data
        const validations = {
            val_full_name: validate.full_name(full_name),
            val_username: await validate.username(username),
            val_email: await validate.email(email),
            val_phone: validate.phone(phone),
            val_address: validate.address(address),
            val_password: validate.password(password)
        };
        // If any validation find an error, exit.
        for (let val in validations) if (validations[val]) return res.status(400).send(validations[val]);

        res.locals.new_user = { full_name, username, email, phone, address, password };
        return next();
    },

    user_id_param: (req, res, next) => {
        // Take id from request's parameter
        let { id } = req.params;

        // Convert string to number
        id = +id;
        if (isNaN(id)) return res.status(401).send("Invalid user ID number.");

        // Store param in locas
        res.locals.param_id = id;
        return next();
    },

    own_user_data: (req, res, next) => {
        // If it's admin go on.
        if (res.locals.user.is_admin) return next();

        // Check whether order belongs to requester.
        if (res.locals.user.id !== res.locals.param_id) return res.sendStatus(401);

        return next();
    },
    searched_user: async (req, res, next) => {
        // Consulta SQL
        const user = await usersDB.getUser.byId(res.locals.param_id);
        if (!user) return res.status(404).send("The user was not found.");

        res.locals.searched_user = user;
        return next();
    },

    user_put_body: async (req, res, next) => {
        const { full_name, username, email, phone, address, password, id_security_type } = req.body;

        // Validate data, skip what wasn't included in body.
        const validations = {
            val_full_name: full_name && validate.full_name(full_name),
            val_username: username && await validate.username(username),
            val_email: email && await validate.email(email),
            val_phone: phone && validate.phone(phone),
            val_address: address && validate.address(address),
            val_password: password && validate.password(password),
            id_security_type: (res.locals.user.is_admin && id_security_type) && validate.id_security_type(id_security_type)
        }
        // If any validation find an error, exit.
        for (let val in validations) if (validations[val]) return res.status(400).send(validations[val]);

        res.locals.updated_info = { full_name, username, email, phone, address, password, id_security_type };
        return next();
    }
}

// Returns all info of user
router.get("/",
    tokenValidator,
    adminAccessOnly,
    async (req, res) => {
        if (!res.locals.user.is_admin) return res.sendStatus(401);
        return res.status(201).json(await usersDB.getAllUsers());
    });

// Create a new user
router.post("/",
    validate.user_post_body,
    async (req, res) => {
        return res.status(201).json(await usersDB.createNewUser(res.locals.new_user));
    });

// Returns user's info
router.get("/:id",
    tokenValidator,
    validate.user_id_param,
    validate.own_user_data,
    validate.searched_user,
    (req, res) => {
        const user = res.locals.searched_user;
        return res.status(200).json(user);
    });

// Update user's info
router.put("/:id",
    tokenValidator,
    adminAccessOnly,
    validate.user_id_param,
    validate.searched_user,
    validate.user_put_body,
    async (req, res) => {
        const user = res.locals.searched_user;
        const updated_info = res.locals.updated_info;

        // Update info, skip what wasn't included in body.
        if (updated_info.full_name) user.full_name = updated_info.full_name;
        if (updated_info.username) user.username = updated_info.username;
        if (updated_info.email) user.email = updated_info.email;
        if (updated_info.password) user.password = updated_info.password;
        if (updated_info.phone) user.phone = updated_info.phone;
        if (updated_info.address) user.address = updated_info.address;
        if (res.locals.user.is_admin && updated_info.id_security_type) user.id_security_type = updated_info.id_security_type;

        // return res.status(200).json(user);
        return res.status(200).json(await usersDB.updateUser(user));
    });

// Delete user
router.delete("/:id",
    tokenValidator,
    adminAccessOnly,
    validate.user_id_param,
    validate.searched_user,
    async (req, res) => {
        const user = res.locals.searched_user;

        // Delete action
        await usersDB.deleteUser(user);

        return res.sendStatus(204);
    });

// Get user's favourite dishes
router.get("/:id/dishes",
    tokenValidator,
    validate.user_id_param,
    validate.own_user_data,
    validate.searched_user,
    async (req, res) => {
        const user = res.locals.searched_user;
        return res.status(200).json(await usersDB.getFavDishes(user));
    });



module.exports = router;