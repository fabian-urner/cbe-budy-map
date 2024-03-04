"use strict";

import { config } from "dotenv";

config();

const btnLogin = document.getElementById("login");
btnLogin.addEventListener("click", (e) => {
  e.preventDefault();
  window.location.replace(process.env.DISCORD_REDIRECT_LINK);
});
