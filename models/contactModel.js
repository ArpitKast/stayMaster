/*const mongoose = require("mongoose");

const contactSchema = mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        require: true,
        ref: "User"
    },
    name: {
        type: String,
        required: [true, "Please add name"],
    },
    email: {
        type: String,
        required: [true, "Please add an eamil"],
    },
    phone: {
        type: Number,
        required: [false, "Please add a phone number"],
    },
    message: {
        type: String,
        required: [true, "Please add message"],
    }, 
}, {
    timestamps: true
});

module.exports = mongoose.model("Contact", contactSchema);*/