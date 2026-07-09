class TwilioHelper {
    getClient() {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        return require('twilio')(accountSid, authToken);
    }

    async sendSMS(body, from, to) {
        const client = this.getClient();
        const message = await client.messages.create({ body, from, to });
        console.log(message.sid);
        return message;
    }
}
module.exports = TwilioHelper;
