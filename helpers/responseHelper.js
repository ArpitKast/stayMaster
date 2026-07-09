class Response {

    static success(res, data = null, statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            data: data
        });
    }

    static error(res, code = "ERROR", message = "Something went wrong", statusCode = 400) {
        return res.status(statusCode).json({
            success: false,
            error: message,
            code: code
        });
    }

}

module.exports = Response;
