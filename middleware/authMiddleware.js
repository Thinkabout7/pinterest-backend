// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user data
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    // ❌ Block deleted users
    if (req.user.isDeleted) {
      return res.status(403).json({ message: "Account no longer exists" });
    }

    // ❌ Block deactivated users from doing *anything*
    // except: /settings, /logout, /reactivate
    const allowedPaths = ["/settings", "/reactivate", "/logout", "/profile"];

    if (
      req.user.isDeactivated &&
      !allowedPaths.some((p) => req.path.startsWith(p))
    ) {
      return res
        .status(403)
        .json({ message: "Account is deactivated. Reactivate to continue." });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default protect;
