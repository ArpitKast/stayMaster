"use strict";

const UserModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const constants = require("../config/constants");
const User = new UserModel();

class AuthService {
  async loginUserService(email, password) {
    const userAvailable = await User.getByEmail(email);

    if (
      !userAvailable ||
      userAvailable.role !== 270 ||
      !(await bcrypt.compare(password, userAvailable.password))
    ) {
      return {
        success: false,
        message: "Wrong email or password",
      };
    }

    const accessToken = jwt.sign(
      {
        user: {
          email: userAvailable.email,
          id: userAvailable.id,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "300m" },
    );

    return {
      success: true,
      accessToken,
    };
  }

  async guestLoginWithOTPService(phone, otp) {
    const otpRecords = await User.validatePhoneOTP(phone, otp);

    if (!otpRecords || otpRecords.length === 0) {
      return {
        success: false,
        error: "Invalid OTP",
      };
    }
    const user = await User.getByPhone(phone);

    if (!user || user.role !== constants.ROLE_GUEST) {
      return {
        success: false,
        error: "User not found",
      };
    }
    const accessToken = jwt.sign(
      {
        user: {
          id: user.id,
          phone: user.phone,
          role: user.role,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "300m" },
    );

    return {
      success: true,
      accessToken,
      user,
    };
  }

  async hostLoginService({ phone, otp, email, password }) {
    let user;
    if (phone && otp) {
      const otpRecords = await User.validatePhoneOTP(phone, otp);

      if (!otpRecords || otpRecords.length === 0) {
        return { success: false, error: "Invalid OTP" };
      }

      user = await User.getByPhone(phone);
    } else if (email && password) {
      user = await User.getByEmail(email);

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return { success: false, error: "Wrong email or password" };
      }
    } else {
      return {
        success: false,
        error: "Invalid login credentials",
      };
    }
    if (!user || user.role !== constants.ROLE_HOST) {
      return {
        success: false,
        error: "Host not found",
      };
    }
    const accessToken = jwt.sign(
      {
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          role: user.role,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "300m" },
    );
    return {
      success: true,
      accessToken,
      user,
    };
  }
}

module.exports = new AuthService();
