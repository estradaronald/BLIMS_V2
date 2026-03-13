const session = require("express-session");
const MongoStore = require("connect-mongo");

function sessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  const mongoUrl = process.env.MONGO_URI;

  if (!secret) throw new Error("Missing SESSION_SECRET in .env");
  if (!mongoUrl) throw new Error("Missing MONGO_URI in .env");

  return session({
    name: "blims.sid",
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // set true if HTTPS
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
    store: MongoStore.create({
      mongoUrl,
      collectionName: "sessions",
      ttl: 60 * 60 * 8,
    }),
  });
}

module.exports = sessionMiddleware;