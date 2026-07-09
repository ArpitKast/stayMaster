/*const mongoose = require("mongoose");

const feuserSchema = mongoose.Schema({
    first_name: {
        type: String,
        required: [true, "Please add first name"],
    },
    last_name: {
        type: String,
        required: [true, "Please add last name"],
    },
    profile_picture: {
        type: String,
        required: [false, "Please add first name"],
    },
    email: {
        type: String,
        required: [false, "Please add an eamil"],
        unique: [true, "Email address already taken."],
    },
    password: {
        type: String,
        required: [true, "Please add a password"],
    },
    mobile_number: {
        type: String,
        required: [true, "Please add mobile number"],
    },
    user_role: {
        type: String,
        required: [true, "Please select the user type"],
    },
    date_of_birth: {
        type: String,
        required: [false, "Please select date of birth"],
    },
    address: {
        type: String,
        required: [false, "Please add address"],
    },
    city: {
        type: String,
        required: [false, "Please add city"],
    },
    state: {
        type: String,
        required: [false, "Please add state"],
    },
    zipcode: {
        type: String,
        required: [false, "Please add zipcode"],
    },
    country: {
        type: String,
        required: [false, "Please add country"],
    },
    is_active: {
        type: Number,
        default: 0,
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Feuser", feuserSchema);
*/