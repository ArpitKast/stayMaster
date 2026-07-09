const Response = require("../helpers/responseHelper");
const settingHelper = require("../helpers/settingsHelper");
const SettingsHelper = new settingHelper();
const fields = require('../config/configs');
const {form_fields} = fields;
const forms = require("../models/formsModel");
const Forms = new forms;
const EmailHelper = require('../helpers/emailHelper');

const { format} = require("date-fns");

const parseRecipientList = (value) => {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map((recipient) => recipient.trim())
        .filter((recipient) => recipient.length > 0);
};

const defaultMailRecipients = parseRecipientList(
    process.env.FORM_NOTIFICATION_RECIPIENTS ||
    'info@thestaymaster.com'
);

const hostMailRecipients = (() => {
    const hostSpecific = parseRecipientList(
        process.env.HOST_FORM_NOTIFICATION_RECIPIENTS ||
        ''
    );
    return hostSpecific.length ? hostSpecific : defaultMailRecipients;
})();

const mailRecipientsByFormType = {
    get_in_touch: defaultMailRecipients,
    contact_us: defaultMailRecipients,
    host_page_form: hostMailRecipients,
};

class FormsController {
    constructor() {
        this.emailHelper = new EmailHelper();
    }

    async index(req, res) {
        try{
            const forms = await Forms.select('form_submissions');
            const property_types = await SettingsHelper.settings('property_type');
            forms.forEach(form => { 
                if(form.property_type){
                    form.property_type = property_types.find(property_type => property_type.id == form.property_type).display;
                }
                form.created_at = format(new Date(form.created_at), "dd/MM/yyyy HH:mm:ss");
            });
            const get_in_touch = forms.filter(form => form.form_type == 'get_in_touch');
            const contact_us = forms.filter(form => form.form_type == 'contact_us');
            const host_page_form = forms.filter(form => form.form_type == 'host_page_form');
            const newsletter = forms.filter(form => form.form_type == 'newsletter');
            await res.render('forms/list.ejs',{get_in_touch,contact_us,host_page_form,newsletter});
        }catch(err){
            return Response.error(res, "ERROR", "Forms not found", 400);
        }
    }

    async formSettings(req, res) {
        try{
            const result = await SettingsHelper.formSettings();
            return Response.success(res, result, 200);
        }catch(err){
            return Response.error(res, "ERROR", "Settings not found", 400);
        }
    }

    async submitForm(req, res) {
        const { form_type,name,email,phone,property_type,comment } = req.body;
        if(!form_type || (form_type != 'get_in_touch' && form_type != 'contact_us' && form_type != 'host_page_form' && form_type != 'newsletter')){
            return Response.error(res, "ERROR", "Invalid form type!", 400);
        }
        if(form_type == 'newsletter'){
            if(!email){
                return Response.error(res, "ERROR", "Email is required!", 400);
            }
        } else {
            if(!name || !email || !phone){
                return Response.error(res, "ERROR", "Mandatory parameters missing or incorrect!", 400);
            }
            if(form_type == 'get_in_touch' || form_type == 'host_page_form'){
                if(!property_type){
                    return Response.error(res, "ERROR", "Mandatory parameters missing or incorrect!", 400);
                }
            }
            if(form_type == 'contact_us'){
                if(!comment){
                    return Response.error(res, "ERROR", "Mandatory parameters missing or incorrect!", 400);
                }
            }
        }

        let propertyTypeLabel = '';
        if((form_type === 'get_in_touch' || form_type === 'host_page_form') && property_type){
            try{
                const propertyTypes = await SettingsHelper.settings('property_type');
                const propertyMatch = Array.isArray(propertyTypes)
                    ? propertyTypes.find((property) => `${property.id}` === `${property_type}`)
                    : null;
                propertyTypeLabel = propertyMatch?.display || `${property_type}`;
            }catch(fetchError){
                console.error('Failed to resolve property type display name for enquiry email.', fetchError);
                propertyTypeLabel = `${property_type}`;
            }
        }
        try {
            const fieldValues = {};
            form_fields.forEach(fieldName => {
                if(Object.hasOwnProperty.bind(req.body)(fieldName)){
                    fieldValues[fieldName] = req.body[fieldName];
                }
            });

            if (form_type === 'newsletter') {
                if (!fieldValues.name) fieldValues.name = 'Newsletter Subscriber';
                if (!fieldValues.phone) fieldValues.phone = 'N/A';
            }

            await Forms.saveFormDetails(fieldValues);

            // Build HTML content for email
            const FORM_TYPE_LABELS = {
                get_in_touch: 'Stay enquiry',
                contact_us: 'Contact enquiry',
                host_page_form: 'Host enquiry',
            };
            const formLabel = FORM_TYPE_LABELS[form_type] || form_type;
            const fullName = name || 'Not provided';
            const emailAddress = email || 'Not provided';
            const phoneNumber = phone || 'Not provided';
            const propertyValue = propertyTypeLabel || '';
            const commentValue = comment || '';

            const tableRows = [
                { label: 'Form type', value: formLabel },
                { label: 'Name', value: fullName },
                { label: 'Email', value: emailAddress },
                { label: 'Phone', value: phoneNumber },
                propertyValue ? { label: 'Property type', value: propertyValue } : null,
                commentValue ? { label: 'Comment', value: commentValue } : null,
            ].filter(Boolean)
                .map(({ label, value }) => {
                    const escapedValue = String(value)
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                    return `
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>${label}</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${escapedValue}</td>
                        </tr>
                    `;
                })
                .join('');

            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 520px; color: #222;">
                    <p style="font-size: 16px;">A new ${formLabel.toLowerCase()} has been submitted on <strong>Staymaster</strong>.</p>
                    <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
                        ${tableRows}
                    </table>
                </div>
            `;

            if (form_type === 'newsletter') {
                return Response.success(res, { message: 'Subscribed successfully' }, 201);
            }

            // Send email notification without blocking the API response
            const recipients = mailRecipientsByFormType[form_type] || defaultMailRecipients;
            this.emailHelper.sendMail(
                recipients,
                `New ${formLabel} submission from ${fullName}`,
                htmlContent
            )
            .then((emailDispatched) => {
                if (!emailDispatched) {
                    console.warn('Form submission stored but notification email was skipped (mail configuration missing).');
                }
            })
            .catch((emailError) => {
                console.error('Error sending enquiry notification email (request already succeeded).', emailError);
            });

            return Response.success(res, { message: 'Form saved successfully' }, 201);
        } catch (error) {
            console.error('Error submitting form:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Form data received:', {
                form_type,
                name,
                email,
                phone,
                property_type,
                comment: comment ? 'Present' : 'Missing'
            });
            
            // Return more specific error message
            let errorMessage = 'Internal server error';
            if (error.message) {
                errorMessage = error.message;
            } else if (error.code) {
                // Database errors
                if (error.code === 'ER_NO_SUCH_TABLE') {
                    errorMessage = 'Database table not found. Please run migrations.';
                } else if (error.code === 'ER_BAD_FIELD_ERROR') {
                    errorMessage = `Database column error: ${error.sqlMessage || error.message}`;
                } else if (error.code.startsWith('ER_')) {
                    errorMessage = `Database error: ${error.sqlMessage || error.message}`;
                } else {
                    errorMessage = error.message || 'Internal server error';
                }
            }
            
            return Response.error(res, "ERROR", errorMessage, 500);
        }
    }
}
module.exports = FormsController;
