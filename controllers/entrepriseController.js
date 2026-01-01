const User = require("../models/User");
const catchAsync = require("../utils/catchAsync");

const getEntrepriseById = catchAsync(async (req, res) => {
    const { entrepriseId } = req.params;

    const user = await User
        .findById(entrepriseId)
        .select("-password");

    if (!user) {
        return res.status(404).json({
            status: "fail",
            message: "Entreprise not found"
        });
    }

    return res.status(200).json({
        status: "success",
        data: user
    });
});

module.exports = {
    getEntrepriseById
};
