const User = require("../models/User");
const catchAsync = require("../utils/catchAsync");

// userType must be "Particulier"
const getParticulierById = catchAsync(async (req, res) => {
    const { particulierId } = req.params;

    const user = await User.findOne({
        _id: particulierId,
        userType: "particulier"
    }).select("-password");

    if (!user) {
        return res.status(404).json({
            status: "fail",
            message: "Particulier not found"
        });
    }

    return res.status(200).json({
        status: "success",
        data: user
    });
});

module.exports = {
    getParticulierById
};