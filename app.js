import { config } from "dotenv";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { request } from "undici";

import { createClient } from "@supabase/supabase-js";

import serverless from "serverless-http";

config();

const app = express();
app.use(cookieParser());

const corsOptions = {
  origin: process.env.FRONTEND_ORIGIN,
  credentials: true,
};
app.use(cors(corsOptions));

const port = process.env.API_SERVER_PORT || 3003;

app.get(process.env.API_PATH.concat("/auth"), async (req, res) => {
  // No code in url provided
  if (!req.query.code) {
    res.status(400);
    return res.send("no discord-auth-code provided");
  }

  // Get Discord OAuth2 access_token & refresh_token by provided code (req.query.code)
  const credentials = await getDiscordCredentialsByCode(req.query.code);

  if (credentials.error) {
    res.status(400);
    return res.send("invalid code");
  }

  // Check if User is on CBE-Discord-Server
  if (
    await isUserServerMember(
      credentials.access_token,
      process.env.GUILD_ID_TO_CHECK
    )
  ) {
    const cookie = {
      issued: Date.now(),
      credentials,
    };
    // set Cookie with credentials to remember user next time
    res.cookie(process.env.COOKIE_NAME, cookie, {
      httpOnly: true,
    });
  }

  return res.send();
});

app.get(process.env.API_PATH.concat("/positions"), async (req, res) => {
  let cookie = req.cookies.discordCredentials;

  // Ensure authentication & authorisation
  // -- Check if cookie with Discord-Credentials is set
  if (!cookie) {
    res.status(403);
    return res.send("Not logged in");
  }

  try {
    cookie = await updateCookie(cookie);
  } catch (err) {
    console.log(err.message);
    res.clearCookie(process.env.COOKIE_NAME);
    res.status(403);
    return res.send("Not logged in");
  }

  // -- renew cookie with fresh credentials
  res.cookie(process.env.COOKIE_NAME, cookie, {
    httpOnly: true,
  });

  // Get Positions from DB
  const state = { users: [] };

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase
    .from(process.env.SUPABASE_POSTIONS_TABLE)
    .select("*");

  // -- map DB-Data with user-objects
  for (const dbDate of data) {
    const myUser = {
      id: dbDate.id,
      discord_user_id: dbDate.discord_user_id,
      name: dbDate.name,
      avatar_url: dbDate.avatar_url,
      role: "Student",
      position: { lat: dbDate.lat, lon: dbDate.lon },
    };

    // ---- Checking for server-roles and set them by priority -> from low(Alumni) to high(Team)
    // ---- -> this is just for inidcation-reasons in the frontend to set different pin-icons
    if (dbDate.roles != null) {
      const alumni = dbDate.roles.find((role) =>
        role.name.toLowerCase().includes("alumni")
      );
      if (alumni !== undefined) {
        myUser.role = "Alumni";
      }

      const trainer = dbDate.roles.find((role) =>
        role.name.toLowerCase().includes("trainers")
      );
      if (trainer !== undefined) {
        myUser.role = "Trainers";
      }

      const team = dbDate.roles.find((role) =>
        role.name.toLowerCase().includes("team")
      );
      if (team !== undefined) {
        myUser.role = "CBE-Team";
      }
    }

    state.users.push(myUser);
  }

  res.status(200);
  return res.send(state.users);
});

app.get(process.env.API_PATH.concat("/logout"), async (req, res) => {
  res.clearCookie(process.env.COOKIE_NAME);
  return res.send("logged out");
});

app.listen(port, (err) => {
  if (err) throw err;
  console.log(`✨ API listening at http://localhost:${port}`);
});

async function getDiscordCredentialsByCode(code) {
  if (code) {
    try {
      const tokenResponseData = await request(process.env.DISCORD_TOKEN_URL, {
        method: "POST",
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          code, //generated code returned from Discord-API after user grandet access
          grant_type: "authorization_code",
          redirect_uri: process.env.FRONTEND_ORIGIN, // !IMPORTANT: This is only working as long as redirect uri in discord-oauth-link is the same as the frontend_origin!
          scope: "identify",
        }).toString(),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      return await tokenResponseData.body.json();
    } catch (err) {
      console.log(err);
    }
  }
  return {};
}

async function getDiscordCredentialsByRefreshToken(token) {
  if (token) {
    try {
      const tokenResponseData = await request(process.env.DISCORD_TOKEN_URL, {
        method: "POST",
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: token,
          scope: "identify",
        }).toString(),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      return await tokenResponseData.body.json();
    } catch (err) {
      console.log(err);
    }
  }
  return {};
}

async function isUserServerMember(discordAccessToken, serverId) {
  try {
    const userResult = await request(
      "https://discord.com/api/users/@me/guilds",
      {
        headers: {
          authorization: "Bearer " + discordAccessToken,
        },
      }
    );

    const guilds = await userResult.body.json();

    if (guilds.filter((guild) => guild.id === serverId).length > 0) return true;
  } catch (err) {
    console.log(err);
  }
  return false;
}

async function updateCookie(cookie) {
  // -- check if cookie is formal valid
  if (
    !(Object.keys(cookie).length === 2) ||
    !(Object.keys(cookie.credentials).length === 5)
  ) {
    throw new Error("invalid cookie");
  }

  // check if cookie is younger then 24h
  if (Date.now() - cookie.issued < 24 * 60 * 60 * 1000) {
    return cookie;
  }

  try {
    const credentials = await getDiscordCredentialsByRefreshToken(
      cookie.credentials.refresh_token
    );
  } catch (err) {
    throw new Error(err.message);
  }

  // check if user has access to in .env-file given Discord-Server
  if (
    !(await isUserServerMember(
      credentials.access_token,
      process.env.GUILD_ID_TO_CHECK
    ))
  ) {
    throw new Error("User has no access to given Discord-Server");
  }

  return {
    issued: Date.now(),
    credentials,
  };
}

export const handler = serverless(app);
