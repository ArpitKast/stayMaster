
class UserValidator {
    static isValidPhone(phone) {
        if (!phone) return false;

        phone = phone.toString().replace(/\s+/g, "");
        const intlRegex = /^\+?[1-9]\d{7,14}$/;

        return intlRegex.test(phone);
    }

    static isValidOTP(otp) {
        return /^\d{6}$/.test(String(otp));
    }
}

module.exports = UserValidator;
