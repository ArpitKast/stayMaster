const asyncHandler = require("express-async-handler");
const Response = require("../helpers/responseHelper");
const Contact = require("../models/contactModel");

//@access private
const getContacts =  asyncHandler(async (req, res) => {
    const contacts = await Contact.find({user_id: req.user.id});
    return Response.success(res, {contacts }, 200);
});

//@access private
const createContact = asyncHandler(async(req, res) => {
    const {name, email, phone, message} = req.body;
    if(!name || !email || !message) {
        return Response.error(res, "ERROR", "Please fill required fields!", 400);
    }
    const contact = await Contact.create({
        name,
        email,
        phone,
        message,
        user_id: req.user.id
    });
    return Response.success(res, contact, 201);
});

//@access private
const getContact = asyncHandler(async(req, res) => {
    const contact = await Contact.findById(req.params.id);
    if(!contact) {
        return Response.error(res, "ERROR", "Contact not found!", 404);
    }
    return Response.success(res, contact, 200);
});

//@access private
const updateContact = asyncHandler(async(req, res) => {
    const contact = await Contact.findById(req.params.id);
    if(!contact) {
        return Response.error(res, "ERROR", "Contact not found!", 404);
    }
    if(contact.user_id.toString() !== req.user.id) {
        return Response.error(res, "ERROR", "You are not authorised to update other users contacts.", 403);
    }
    const updatedContact = await Contact.findByIdAndUpdate(req.params.id, req.body, {new: true});

    return Response.success(res, updatedContact, 200);
});

//@access private
const deleteContact = asyncHandler(async(req, res) => {
    const contact = await Contact.findById(req.params.id);
    if(!contact) {
        return Response.error(res, "ERROR", "Contact not found!", 404);
    }
    if(contact.user_id.toString() !== req.user.id) {
        return Response.error(res, "ERROR", "You are not authorised to delete other users contacts.", 403);
    }
    await Contact.findByIdAndDelete(req.params.id);
    return Response.success(res, contact, 200);
});


module.exports = {getContacts, createContact, getContact, updateContact, deleteContact}